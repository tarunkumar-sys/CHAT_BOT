'use client';

import { useEffect, useRef } from 'react';

export type KiroExpression = 'idle' | 'happy' | 'think' | 'surprise' | 'loading' | 'sleep';

interface AnimState {
  t: number;
  y: number;
  vy: number;
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  txT: number;
  tyT: number;
  lx: number;
  ly: number;
  lxT: number;
  lyT: number;
  blink: number;
  blinkT: number;
  spinAngle: number;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function applyExpression(S: AnimState, expr: KiroExpression, R: number) {
  S.blinkT = 0;
  switch (expr) {
    case 'happy':
      S.vy = -(R * 0.082);
      S.tyT = -0.18;
      S.txT = (Math.random() - 0.5) * 0.35;
      S.lxT = 0; S.lyT = 0;
      break;
    case 'think':
      S.txT = 0.38;
      S.tyT = -0.12;
      S.lxT = 0.45;
      S.lyT = -0.35;
      break;
    case 'surprise':
      S.vy = -(R * 0.07);
      S.txT = 0;
      S.tyT = -0.30;
      S.lxT = 0; S.lyT = 0;
      break;
    case 'loading':
      S.txT = 0; S.tyT = 0; S.lxT = 0; S.lyT = 0;
      break;
    case 'idle':
    default:
      S.txT = 0; S.tyT = 0; S.lxT = 0; S.lyT = 0; S.blinkT = 0;
      break;
    case 'sleep':
      S.txT = 0; S.tyT = 0.08; S.lxT = 0; S.lyT = 0; S.blinkT = 1;
      break;
  }
}

interface KiroMascotProps {
  expression?: KiroExpression;
  size?: number;
  className?: string;
}

export default function KiroMascot({ expression = 'idle', size = 40, className }: KiroMascotProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<AnimState>({
    t: 0, y: 0, vy: 0,
    sx: 1, sy: 1,
    tx: 0, ty: 0, txT: 0, tyT: 0,
    lx: 0, ly: 0, lxT: 0, lyT: 0,
    blink: 0, blinkT: 0,
    spinAngle: 0,
  });
  const exprRef = useRef<KiroExpression>(expression);
  const rafRef = useRef<number>(0);
  const blinkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const glanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const RRef = useRef<number>(size * 0.40);

  // Canvas setup + RAF loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';

    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);

    const CX = size / 2;
    const CY = size / 2;
    const R = size * 0.40;
    RRef.current = R;

    const S = stateRef.current;

    function drawFrame() {
      const expr = exprRef.current;

      // ── UPDATE ──
      S.t++;
      S.spinAngle += 0.08;

      // Bounce physics
      if (S.y < 0 || S.vy < 0) {
        S.vy += R * 0.006;
        S.y += S.vy;
        if (S.y >= 0) {
          S.y = 0;
          const impact = Math.abs(S.vy);
          S.vy = -S.vy * 0.30;
          if (Math.abs(S.vy) < 1.5) S.vy = 0;
          const sq = Math.min(0.28, impact * 0.022);
          S.sx = 1 + sq * 1.3;
          S.sy = 1 - sq;
        }
      }

      // Squash recovery
      S.sx = lerp(S.sx, 1, 0.11);
      S.sy = lerp(S.sy, 1, 0.11);

      // Float patterns
      if (expr === 'idle' || expr === 'think') {
        const ft = Math.sin(S.t * 0.022) * R * 0.14 + Math.sin(S.t * 0.017) * R * 0.04;
        if (Math.abs(S.vy) < 2) S.y = lerp(S.y, ft, 0.03);
      } else if (expr === 'happy') {
        const ft = Math.sin(S.t * 0.022) * R * 0.08;
        if (Math.abs(S.vy) < 2) S.y = lerp(S.y, ft, 0.04);
      } else if (expr === 'loading') {
        S.y = lerp(S.y, Math.sin(S.t * 0.05) * R * 0.09, 0.06);
        S.txT = Math.sin(S.t * 0.04) * 0.22;
        S.tyT = Math.cos(S.t * 0.04) * 0.11;
      } else if (expr === 'sleep') {
        // Very slow, shallow breathing float
        const ft = Math.sin(S.t * 0.012) * R * 0.06;
        if (Math.abs(S.vy) < 2) S.y = lerp(S.y, ft, 0.015);
        S.txT = 0; S.tyT = 0.08; // head droops slightly
      }

      // Smooth targets
      S.tx = lerp(S.tx, S.txT, 0.075);
      S.ty = lerp(S.ty, S.tyT, 0.075);
      S.lx = lerp(S.lx, S.lxT, 0.12);
      S.ly = lerp(S.ly, S.lyT, 0.12);
      S.blink = lerp(S.blink, S.blinkT, 0.22);

      // ── RENDER ──
      ctx.clearRect(0, 0, size, size);

      // 1. Ground shadow
      const shadowAlpha = 0.28 * Math.max(0, 1 - Math.abs(S.y) / (R * 0.7));
      if (shadowAlpha > 0.001) {
        ctx.save();
        ctx.translate(CX, CY + R * 0.88);
        ctx.scale(1, 0.16);
        const shadowGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.72);
        shadowGrad.addColorStop(0, `rgba(0,0,0,${shadowAlpha})`);
        shadowGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = shadowGrad;
        ctx.beginPath();
        ctx.arc(0, 0, R * 0.72, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 2. Sphere body
      ctx.save();
      ctx.translate(CX, CY + S.y);
      ctx.scale(S.sx, S.sy);

      // Clip to circle
      ctx.beginPath();
      ctx.arc(0, 0, R, 0, Math.PI * 2);
      ctx.clip();

      // Sphere gradient
      const hlx = -R * 0.17 + S.tx * -0.11;
      const hly = -R * 0.21 + S.ty * 0.09;
      const sphereGrad = ctx.createRadialGradient(hlx, hly, R * 0.04, 0, 0, R * 1.05);
      sphereGrad.addColorStop(0, '#ffffff');
      sphereGrad.addColorStop(0.22, '#f9f9f9');
      sphereGrad.addColorStop(0.5, '#e3e3e3');
      sphereGrad.addColorStop(0.78, '#c4c4c4');
      sphereGrad.addColorStop(1, '#9a9a9a');
      ctx.fillStyle = sphereGrad;
      ctx.fillRect(-R, -R, R * 2, R * 2);

      // Ambient occlusion
      const aoGrad = ctx.createRadialGradient(0, 0, R * 0.55, 0, 0, R);
      aoGrad.addColorStop(0, 'rgba(0,0,0,0)');
      aoGrad.addColorStop(0.78, 'rgba(0,0,0,0.03)');
      aoGrad.addColorStop(1, 'rgba(0,0,0,0.22)');
      ctx.fillStyle = aoGrad;
      ctx.fillRect(-R, -R, R * 2, R * 2);

      // End clip, draw border
      ctx.restore();
      ctx.save();
      ctx.translate(CX, CY + S.y);
      ctx.scale(S.sx, S.sy);
      ctx.beginPath();
      ctx.arc(0, 0, R, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0,0,0,0.07)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Specular highlights
      ctx.save();
      ctx.translate(hlx + R * 0.04, hly + R * 0.04);
      ctx.rotate(-0.45);
      ctx.fillStyle = 'rgba(255,255,255,0.70)';
      ctx.beginPath();
      ctx.ellipse(0, 0, R * 0.20, R * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.beginPath();
      ctx.ellipse(R * 0.055, R * 0.045, R * 0.08, R * 0.05, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.restore();

      // 3. Eyes
      ctx.save();
      ctx.translate(CX, CY + S.y);
      ctx.scale(S.sx, S.sy);

      for (let i = 0; i < 2; i++) {
        const faceX = i === 0 ? -0.285 : 0.285;

        // 3D perspective projection
        const pX = faceX * Math.cos(S.tx * 0.42);
        const pZ = faceX * Math.sin(S.tx * 0.42);
        const pY = (-0.06 - pZ * Math.sin(S.ty * 0.22)) * Math.cos(S.ty * 0.22);
        const depth = 1 + pZ * 0.52;

        if (pZ < -0.42) continue;

        const er = R * 0.148 * Math.max(0.35, depth);
        const ex = pX * R * 0.58 + S.lx * R * 0.095 * depth;
        const ey = pY * R * 0.58 + S.ly * R * 0.088 * depth;

        ctx.save();
        ctx.translate(ex, ey);
        ctx.scale(1, Math.max(0.02, 1 - S.blink * 0.97));

        if (expr === 'happy') {
          // Thick arc = upturned happy eye
          ctx.beginPath();
          ctx.arc(0, er * 0.22, er * 0.82, Math.PI, 0, false);
          ctx.strokeStyle = '#111';
          ctx.lineWidth = er * 0.72;
          ctx.lineCap = 'round';
          ctx.stroke();
          // cute cheek blush
          ctx.save();
          ctx.globalAlpha = 0.18;
          ctx.fillStyle = '#ff6b8a';
          ctx.beginPath();
          ctx.ellipse(er * 0.9, er * 0.7, er * 0.7, er * 0.38, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else if (expr === 'think' && i === 0) {
          // Left eye: squinted slit with slight curve
          ctx.fillStyle = '#111';
          ctx.beginPath();
          ctx.ellipse(0, 0, er, er * 0.28, 0, 0, Math.PI * 2);
          ctx.fill();
        } else if (expr === 'surprise') {
          // Large surprised eye with iris ring for depth
          ctx.fillStyle = '#111';
          ctx.beginPath();
          ctx.arc(0, 0, er * 1.45, 0, Math.PI * 2);
          ctx.fill();
          // inner iris highlight ring
          ctx.fillStyle = 'rgba(255,255,255,0.12)';
          ctx.beginPath();
          ctx.arc(0, 0, er * 0.85, 0, Math.PI * 2);
          ctx.fill();
          // main shine
          ctx.fillStyle = 'rgba(255,255,255,0.92)';
          ctx.beginPath();
          ctx.arc(er * 0.40, -er * 0.40, er * 0.34, 0, Math.PI * 2);
          ctx.fill();
          // small secondary shine
          ctx.fillStyle = 'rgba(255,255,255,0.70)';
          ctx.beginPath();
          ctx.arc(-er * 0.30, er * 0.30, er * 0.16, 0, Math.PI * 2);
          ctx.fill();
        } else if (expr === 'loading') {
          // Orbiting dot with trail
          ctx.rotate(S.spinAngle + (faceX > 0 ? Math.PI : 0));
          ctx.fillStyle = '#111';
          ctx.beginPath();
          ctx.arc(er * 0.55, 0, er * 0.40, 0, Math.PI * 2);
          ctx.fill();
          // faint trail dot
          ctx.globalAlpha = 0.25;
          ctx.beginPath();
          ctx.arc(er * 0.55, 0, er * 0.55, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        } else if (expr === 'sleep') {
          // Closed eye — flat arc line (sleeping)
          ctx.beginPath();
          ctx.arc(0, er * 0.1, er * 0.82, Math.PI, 0, true);
          ctx.strokeStyle = '#111';
          ctx.lineWidth = er * 0.52;
          ctx.lineCap = 'round';
          ctx.stroke();
        } else {
          // idle / think right eye / default — cute round eye
          ctx.fillStyle = '#111';
          ctx.beginPath();
          ctx.arc(0, 0, er, 0, Math.PI * 2);
          ctx.fill();
          // large primary shine
          ctx.fillStyle = 'rgba(255,255,255,0.92)';
          ctx.beginPath();
          ctx.arc(er * 0.30, -er * 0.30, er * 0.30, 0, Math.PI * 2);
          ctx.fill();
          // small secondary shine for depth
          ctx.fillStyle = 'rgba(255,255,255,0.65)';
          ctx.beginPath();
          ctx.arc(-er * 0.22, er * 0.22, er * 0.14, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      }

      ctx.restore();

      // Floating "z z" for sleep expression
      if (expr === 'sleep') {
        const zScale = 0.5 + 0.5 * Math.sin(S.t * 0.04);
        const zX = CX + R * 0.62;
        const zY = CY + S.y - R * 0.55 - Math.sin(S.t * 0.03) * R * 0.18;
        ctx.save();
        ctx.globalAlpha = 0.55 + 0.3 * Math.sin(S.t * 0.04);
        ctx.font = `bold ${Math.round(R * 0.38 * (0.8 + 0.2 * zScale))}px sans-serif`;
        ctx.fillStyle = '#555';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('z', zX, zY);
        ctx.globalAlpha *= 0.55;
        ctx.font = `bold ${Math.round(R * 0.26)}px sans-serif`;
        ctx.fillText('z', zX + R * 0.28, zY - R * 0.30);
        ctx.restore();
      }

      rafRef.current = requestAnimationFrame(drawFrame);
    }

    rafRef.current = requestAnimationFrame(drawFrame);

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [size]);

  // Expression changes
  useEffect(() => {
    exprRef.current = expression;
    applyExpression(stateRef.current, expression, RRef.current);
  }, [expression]);

  // Auto-blink + auto-glance (idle only)
  useEffect(() => {
    function scheduleBlink() {
      blinkTimerRef.current = setTimeout(() => {
        if (exprRef.current === 'idle') {
          stateRef.current.blinkT = 1;
          setTimeout(() => {
            if (exprRef.current === 'idle') stateRef.current.blinkT = 0;
          }, 115);
        }
        scheduleBlink();
      }, 1500 + Math.random() * 2500);
    }

    function scheduleGlance() {
      glanceTimerRef.current = setTimeout(() => {
        if (exprRef.current === 'idle') {
          const gx = (Math.random() - 0.5) * 0.55;
          const gy = (Math.random() - 0.5) * 0.35;
          stateRef.current.txT = gx * 0.55;
          stateRef.current.tyT = gy * 0.45;
          stateRef.current.lxT = gx;
          stateRef.current.lyT = gy;
          setTimeout(() => {
            if (exprRef.current === 'idle') {
              stateRef.current.txT = 0;
              stateRef.current.tyT = 0;
              stateRef.current.lxT = 0;
              stateRef.current.lyT = 0;
            }
          }, 500 + Math.random() * 600);
        }
        scheduleGlance();
      }, 2500 + Math.random() * 3000);
    }

    scheduleBlink();
    scheduleGlance();

    return () => {
      if (blinkTimerRef.current) clearTimeout(blinkTimerRef.current);
      if (glanceTimerRef.current) clearTimeout(glanceTimerRef.current);
    };
  }, []);

  return (
    <div className={className}>
      <canvas ref={canvasRef} />
    </div>
  );
}

export function KiroAvatar({
  expression = 'idle',
  size = 36,
}: {
  expression?: KiroExpression;
  size?: number;
}) {
  return <KiroMascot expression={expression} size={size} />;
}
