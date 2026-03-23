/**
 * violaJonesDetector.ts — Pure TypeScript Viola-Jones face detector.
 * No OpenCV. No external fetches. No CORS.
 */

/* ─── Types ──────────────────────────────────────────────── */
interface HaarRect  { x1:number; y1:number; x2:number; y2:number; wt:number }
interface HaarStump { thr:number; lv:number; rv:number; rects:HaarRect[] }
interface HaarStage { thr:number; stumps:HaarStump[] }
interface HaarModel { winW:number; winH:number; stages:HaarStage[] }
interface Box       { x:number; y:number; w:number; h:number }

/* ─── XML parser ─────────────────────────────────────────── */
function parseHaarXML(xml: string): HaarModel {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');

  const sizeText = doc.querySelector('size')?.textContent?.trim().split(/\s+/) ?? ['24','24'];
  const winW = parseInt(sizeText[0]);
  const winH = parseInt(sizeText[1]);

  const stages: HaarStage[] = [];

  doc.querySelectorAll('stages > _').forEach(stageEl => {
    const stageThr = parseFloat(stageEl.querySelector('stage_threshold')?.textContent ?? '0');
    const stumps: HaarStump[] = [];

    const weakEls = stageEl.querySelectorAll('weak_classifiers > _');
    weakEls.forEach(weakEl => {
      const internalNodes = weakEl.querySelector('internal_nodes')?.textContent?.trim().split(/\s+/).map(Number) ?? [];
      const leafValues    = weakEl.querySelector('leaf_values')?.textContent?.trim().split(/\s+/).map(Number) ?? [0,0];

      // internal_nodes layout: left_node right_node threshold feat_idx
      // but in the default XML it's: 0 1 threshold feat_idx  (for stumps)
      // The threshold is at index 2, feature index at 3
      const thr = internalNodes[2] ?? 0;
      const lv  = leafValues[0] ?? 0;
      const rv  = leafValues[1] ?? 0;

      const rects: HaarRect[] = [];
      weakEl.querySelectorAll('rects > _').forEach(rectEl => {
        const p = rectEl.textContent?.trim().split(/\s+/).map(Number) ?? [];
        if (p.length >= 5) {
          // p = [x, y, w, h, weight]
          rects.push({ x1: p[0], y1: p[1], x2: p[0]+p[2], y2: p[1]+p[3], wt: p[4] });
        }
      });

      if (rects.length > 0) stumps.push({ thr, lv, rv, rects });
    });

    if (stumps.length > 0) stages.push({ thr: stageThr, stumps });
  });

  return { winW, winH, stages };
}

/* ─── Integral image ─────────────────────────────────────── */
function buildII(gray: Uint8ClampedArray, W: number, H: number) {
  const stride = W + 1;
  const ii  = new Float64Array(stride * (H + 1));
  const ii2 = new Float64Array(stride * (H + 1));

  for (let y = 1; y <= H; y++) {
    let rs = 0, rs2 = 0;
    for (let x = 1; x <= W; x++) {
      const v = gray[(y-1)*W + (x-1)];
      rs  += v;
      rs2 += v*v;
      ii [y*stride+x] = ii [(y-1)*stride+x] + rs;
      ii2[y*stride+x] = ii2[(y-1)*stride+x] + rs2;
    }
  }
  return { ii, ii2, stride };
}

function rsum(ii: Float64Array, stride: number, x1:number, y1:number, x2:number, y2:number): number {
  return ii[y2*stride+x2] - ii[y1*stride+x2] - ii[y2*stride+x1] + ii[y1*stride+x1];
}

/* ─── Histogram equalization ─────────────────────────────── */
function equalize(gray: Uint8ClampedArray): Uint8ClampedArray {
  const hist = new Int32Array(256);
  for (let i = 0; i < gray.length; i++) hist[gray[i]]++;
  let acc = 0;
  const lut = new Uint8ClampedArray(256);
  const scale = 255 / gray.length;
  for (let i = 0; i < 256; i++) { acc += hist[i]; lut[i] = Math.min(255, Math.round(acc * scale)); }
  const out = new Uint8ClampedArray(gray.length);
  for (let i = 0; i < gray.length; i++) out[i] = lut[gray[i]];
  return out;
}

/* ─── Classifier ─────────────────────────────────────────── */
function classifyWindow(
  ii: Float64Array, ii2: Float64Array, stride: number,
  model: HaarModel,
  wx: number, wy: number, scale: number,
  stdDev: number   // actual std-dev of pixel values in this window
): boolean {
  const { winW, winH, stages } = model;
  const winArea = Math.round(winW * scale) * Math.round(winH * scale);

  for (const stage of stages) {
    let stageSum = 0;
    for (const stump of stage.stumps) {
      let featSum = 0;
      for (const r of stump.rects) {
        const rx1 = wx + Math.round(r.x1 * scale);
        const ry1 = wy + Math.round(r.y1 * scale);
        const rx2 = wx + Math.round(r.x2 * scale);
        const ry2 = wy + Math.round(r.y2 * scale);
        featSum += rsum(ii, stride, rx1, ry1, rx2, ry2) * r.wt;
      }
      // Normalize by window area and std-dev (Viola-Jones variance normalization)
      const normalizedFeat = featSum / (winArea * stdDev + 1e-10);
      stageSum += normalizedFeat >= stump.thr ? stump.rv : stump.lv;
    }
    if (stageSum < stage.thr) return false; // fast reject
  }
  return true;
}

/* ─── Sliding window ─────────────────────────────────────── */
function slideWindow(
  ii: Float64Array, ii2: Float64Array, stride: number,
  W: number, H: number,
  model: HaarModel,
  scale: number
): Box[] {
  const winW = Math.round(model.winW * scale);
  const winH = Math.round(model.winH * scale);
  const step  = Math.max(2, Math.round(winW * 0.1));
  const boxes: Box[] = [];

  for (let y = 0; y + winH <= H; y += step) {
    for (let x = 0; x + winW <= W; x += step) {
      const area = winW * winH;
      const s1   = rsum(ii,  stride, x, y, x+winW, y+winH);
      const s2   = rsum(ii2, stride, x, y, x+winW, y+winH);
      const mean = s1 / area;
      const variance = Math.max(0, s2/area - mean*mean);
      if (variance < 100) continue; // skip flat/uniform regions early
      const stdDev = Math.sqrt(variance);

      if (classifyWindow(ii, ii2, stride, model, x, y, scale, stdDev)) {
        boxes.push({ x, y, w: winW, h: winH });
      }
    }
  }
  return boxes;
}

/* ─── IoU ────────────────────────────────────────────────── */
function iou(a: Box, b: Box): number {
  const ix1 = Math.max(a.x, b.x), iy1 = Math.max(a.y, b.y);
  const ix2 = Math.min(a.x+a.w, b.x+b.w), iy2 = Math.min(a.y+a.h, b.y+b.h);
  if (ix2 <= ix1 || iy2 <= iy1) return 0;
  const inter = (ix2-ix1)*(iy2-iy1);
  return inter / (a.w*a.h + b.w*b.h - inter);
}

/* ─── Union-Find (iterative, no recursion → no stack overflow) ── */
function makeUF(n: number) {
  const parent = Array.from({length: n}, (_, i) => i);
  const rank   = new Int32Array(n);

  function find(x: number): number {
    // Iterative path compression
    let root = x;
    while (parent[root] !== root) root = parent[root];
    while (parent[x] !== root) {
      const next = parent[x];
      parent[x] = root;
      x = next;
    }
    return root;
  }

  function union(a: number, b: number) {
    const ra = find(a), rb = find(b);
    if (ra === rb) return;
    if (rank[ra] < rank[rb]) parent[ra] = rb;
    else if (rank[ra] > rank[rb]) parent[rb] = ra;
    else { parent[rb] = ra; rank[ra]++; }
  }

  return { find, union };
}

/* ─── Group & refine ─────────────────────────────────────── */
function groupAndRefine(boxes: Box[], minNeighbors = 2): Box[] {
  if (boxes.length === 0) return [];

  const uf = makeUF(boxes.length);

  for (let i = 0; i < boxes.length; i++)
    for (let j = i+1; j < boxes.length; j++)
      if (iou(boxes[i], boxes[j]) > 0.25) uf.union(i, j);

  // Collect groups
  const groups = new Map<number, Box[]>();
  for (let i = 0; i < boxes.length; i++) {
    const r = uf.find(i);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r)!.push(boxes[i]);
  }

  const result: Box[] = [];
  for (const group of groups.values()) {
    if (group.length < minNeighbors) continue;
    // Area-weighted average
    let totalArea = 0, mx=0, my=0, mw=0, mh=0;
    for (const b of group) {
      const a = b.w * b.h;
      totalArea += a;
      mx += b.x*a; my += b.y*a; mw += b.w*a; mh += b.h*a;
    }
    result.push({
      x: Math.round(mx/totalArea), y: Math.round(my/totalArea),
      w: Math.round(mw/totalArea), h: Math.round(mh/totalArea),
    });
  }

  // NMS
  result.sort((a,b) => b.w*b.h - a.w*a.h);
  const kept: Box[] = [];
  for (const box of result) {
    if (!kept.some(k => iou(k, box) > 0.35)) kept.push(box);
  }
  return kept;
}

/* ─── Main detector ──────────────────────────────────────── */
function detectFaces(
  gray: Uint8ClampedArray, W: number, H: number,
  model: HaarModel,
  opts: { minFace?: number; scaleFactor?: number } = {}
): Box[] {
  const { minFace = 24, scaleFactor = 1.2 } = opts;
  const maxFace = Math.round(Math.min(W, H) * 0.9);

  const eq = equalize(gray);
  const { ii, ii2, stride } = buildII(eq, W, H);

  const allBoxes: Box[] = [];
  let scale = minFace / model.winW;

  while (Math.round(model.winW * scale) <= maxFace) {
    allBoxes.push(...slideWindow(ii, ii2, stride, W, H, model, scale));
    scale *= scaleFactor;
  }

  return groupAndRefine(allBoxes, 2);
}

/* ─── Cached model ───────────────────────────────────────── */
let _model: HaarModel | null = null;

/* ─── Public API ─────────────────────────────────────────── */
export async function detectAndDraw(imageSrc: string, haarXML: string): Promise<string> {
  if (!_model) _model = parseHaarXML(haarXML);
  const model = _model;

  const img  = await loadImg(imageSrc);
  const fullW = img.naturalWidth;
  const fullH = img.naturalHeight;

  // Downscale for speed
  const MAX_DIM = 640;
  const ds = Math.min(1, MAX_DIM / Math.max(fullW, fullH));
  const dW = Math.round(fullW * ds);
  const dH = Math.round(fullH * ds);

  const dc = document.createElement('canvas');
  dc.width = dW; dc.height = dH;
  const dctx = dc.getContext('2d')!;
  dctx.drawImage(img, 0, 0, dW, dH);
  const rgba = dctx.getImageData(0, 0, dW, dH).data;

  // RGBA → gray
  const gray = new Uint8ClampedArray(dW * dH);
  for (let i = 0; i < dW * dH; i++)
    gray[i] = Math.round(rgba[i*4]*0.299 + rgba[i*4+1]*0.587 + rgba[i*4+2]*0.114);

  const detBoxes = detectFaces(gray, dW, dH, model);

  // Scale boxes back to full res
  const up = 1 / ds;
  const boxes = detBoxes.map(b => ({
    x: Math.round(b.x * up),
    y: Math.round(b.y * up),
    w: Math.round(b.w * up),
    h: Math.round(b.h * up),
  }));

  // Draw on full-res canvas
  const oc = document.createElement('canvas');
  oc.width = fullW; oc.height = fullH;
  const ctx = oc.getContext('2d')!;
  ctx.drawImage(img, 0, 0);

  if (boxes.length === 0) {
    ctx.fillStyle = 'rgba(220,38,38,0.85)';
    ctx.fillRect(10, 10, 220, 34);
    ctx.font = 'bold 14px sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText('No faces detected', 18, 32);
  } else {
    const lw = Math.max(2, Math.round(fullW / 400));
    ctx.lineWidth   = lw;
    ctx.strokeStyle = '#00e050';
    ctx.fillStyle   = '#00e050';
    const fs = Math.max(13, Math.round(fullW / 55));
    ctx.font = `bold ${fs}px sans-serif`;

    boxes.forEach((b, i) => {
      ctx.strokeRect(b.x, b.y, b.w, b.h);
      const labelY = b.y > fs + 4 ? b.y - 4 : b.y + b.h + fs + 2;
      ctx.fillText(`Face ${i+1}`, b.x + 2, labelY);
    });
  }

  return oc.toDataURL('image/png');
}

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload  = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
}
