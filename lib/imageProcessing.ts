/**
 * imageProcessing.ts
 *
 * - sepia           → Canvas 2D pixel loop (no OpenCV)
 * - everything else → OpenCV.js (lazy-loaded from CDN)
 *
 * processImage(toolId, imageSrc) always returns a PNG dataURL.
 */


/* ─── Tool definitions ───────────────────────────────────── */
export type ImageToolId =
  | 'grayscale' | 'gaussian_blur' | 'edge_detection'
  | 'threshold' | 'sharpen' | 'emboss' | 'sepia'
  | 'contour_detect';

export interface ImageTool {
  id: ImageToolId;
  icon: string;
  name: string;
  description: string;
  section: 'Basic' | 'Filters' | 'Detection';
}

export const IMAGE_TOOLS: ImageTool[] = [
  { id: 'grayscale',      icon: 'Film',       name: 'Grayscale',      description: 'Convert to black & white',      section: 'Basic'     },
  { id: 'gaussian_blur',  icon: 'Blend',      name: 'Gaussian Blur',  description: 'Smooth out noise and details',  section: 'Basic'     },
  { id: 'edge_detection', icon: 'ScanSearch', name: 'Edge Detection', description: 'Highlight edges with Canny',    section: 'Basic'     },
  { id: 'threshold',      icon: 'CircleOff',  name: 'Threshold',      description: 'Binary black/white cutoff',     section: 'Filters'   },
  { id: 'sharpen',        icon: 'Sparkles',   name: 'Sharpen',        description: 'Enhance fine details',          section: 'Filters'   },
  { id: 'emboss',         icon: 'Layers',     name: 'Emboss',         description: '3D relief effect',              section: 'Filters'   },
  { id: 'sepia',          icon: 'Sunset',     name: 'Sepia Tone',     description: 'Warm vintage brown tint',       section: 'Filters'   },
  { id: 'contour_detect', icon: 'PenTool',    name: 'Contour Detect', description: 'Find and draw object contours', section: 'Detection' },
];

/* ─── OpenCV lazy loader ─────────────────────────────────── */
let cvLoadPromise: Promise<void> | null = null;

function loadOpenCV(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('SSR'));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  if (w.cv && typeof w.cv.Mat === 'function') return Promise.resolve();
  if (cvLoadPromise) return cvLoadPromise;

  cvLoadPromise = new Promise((resolve, reject) => {
    function poll(n = 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((window as any).cv && typeof (window as any).cv.Mat === 'function') return resolve();
      if (n > 300) { cvLoadPromise = null; return reject(new Error('OpenCV WASM timed out')); }
      setTimeout(() => poll(n + 1), 100);
    }
    if (w.cv !== undefined) { poll(); return; }
    const s = document.createElement('script');
    s.src = 'https://docs.opencv.org/4.8.0/opencv.js';
    s.async = true;
    s.onload  = () => poll();
    s.onerror = () => { cvLoadPromise = null; reject(new Error('Failed to load OpenCV.js')); };
    document.head.appendChild(s);
  });
  return cvLoadPromise;
}

/* ─── Image loader helper ────────────────────────────────── */
function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload  = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
}

/* ─── Main entry point ───────────────────────────────────── */
export async function processImage(
  toolId: ImageToolId,
  imageSrc: string,
): Promise<string> {


  /* ── Sepia: Canvas 2D pixel loop ── */
  if (toolId === 'sepia') {
    const img = await loadImg(imageSrc);
    const c   = document.createElement('canvas');
    c.width   = img.naturalWidth;
    c.height  = img.naturalHeight;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const id  = ctx.getImageData(0, 0, c.width, c.height);
    const d   = id.data;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i+1], b = d[i+2];
      d[i]   = Math.min(255, r*0.393 + g*0.769 + b*0.189);
      d[i+1] = Math.min(255, r*0.349 + g*0.686 + b*0.168);
      d[i+2] = Math.min(255, r*0.272 + g*0.534 + b*0.131);
    }
    ctx.putImageData(id, 0, 0);
    return c.toDataURL('image/png');
  }

  /* ── All other tools: OpenCV.js ── */
  await loadOpenCV();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cv = (window as any).cv;

  const img = await loadImg(imageSrc);
  const tmp = document.createElement('canvas');
  tmp.width  = img.naturalWidth;
  tmp.height = img.naturalHeight;
  tmp.getContext('2d')!.drawImage(img, 0, 0);

  const out = document.createElement('canvas');
  out.width  = img.naturalWidth;
  out.height = img.naturalHeight;

  const src = cv.imread(tmp);
  let   dst = new cv.Mat();

  try {
    switch (toolId) {

      case 'grayscale': {
        const gray = new cv.Mat();
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
        cv.cvtColor(gray, dst, cv.COLOR_GRAY2RGBA);
        gray.delete();
        break;
      }

      case 'gaussian_blur': {
        cv.GaussianBlur(src, dst, new cv.Size(21, 21), 0, 0, cv.BORDER_DEFAULT);
        break;
      }

      case 'edge_detection': {
        const gray  = new cv.Mat();
        const edges = new cv.Mat();
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
        cv.Canny(gray, edges, 50, 150);
        cv.cvtColor(edges, dst, cv.COLOR_GRAY2RGBA);
        gray.delete(); edges.delete();
        break;
      }

      case 'threshold': {
        const gray = new cv.Mat();
        const bin  = new cv.Mat();
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
        cv.threshold(gray, bin, 127, 255, cv.THRESH_BINARY);
        cv.cvtColor(bin, dst, cv.COLOR_GRAY2RGBA);
        gray.delete(); bin.delete();
        break;
      }

      case 'sharpen': {
        const kernel = cv.matFromArray(3, 3, cv.CV_32F, [
           0, -1,  0,
          -1,  5, -1,
           0, -1,  0,
        ]);
        cv.filter2D(src, dst, cv.CV_8U, kernel, new cv.Point(-1,-1), 0, cv.BORDER_DEFAULT);
        kernel.delete();
        break;
      }

      case 'emboss': {
        const gray     = new cv.Mat();
        const embossed = new cv.Mat();
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
        const kernel = cv.matFromArray(3, 3, cv.CV_32F, [
          -2, -1, 0,
          -1,  1, 1,
           0,  1, 2,
        ]);
        cv.filter2D(gray, embossed, cv.CV_8U, kernel, new cv.Point(-1,-1), 128, cv.BORDER_DEFAULT);
        cv.cvtColor(embossed, dst, cv.COLOR_GRAY2RGBA);
        kernel.delete(); gray.delete(); embossed.delete();
        break;
      }

      case 'contour_detect': {
        dst = src.clone();
        const gray      = new cv.Mat();
        const binary    = new cv.Mat();
        const contours  = new cv.MatVector();
        const hierarchy = new cv.Mat();
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
        cv.threshold(gray, binary, 100, 255, cv.THRESH_BINARY);
        cv.findContours(binary, contours, hierarchy, cv.RETR_CCOMP, cv.CHAIN_APPROX_SIMPLE);
        for (let i = 0; i < contours.size(); i++) {
          cv.drawContours(dst, contours, i, [0, 200, 255, 255], 1, cv.LINE_8, hierarchy, 0);
        }
        gray.delete(); binary.delete(); contours.delete(); hierarchy.delete();
        break;
      }

      default:
        dst = src.clone();
    }

    cv.imshow(out, dst);
    return out.toDataURL('image/png');

  } finally {
    try { src.delete(); } catch { /* ok */ }
    try { dst.delete(); } catch { /* ok */ }
  }
}
