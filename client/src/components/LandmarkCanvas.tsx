import { useEffect, useRef } from 'react';
import type { Landmark } from '../lib/types';
import { SKELETON } from '../lib/geometry';
import { loadImage } from '../lib/poseDetect';

interface Props {
  imageUrl: string;
  landmarks?: Landmark[] | null;
  height?: number;
}

/** Draws a photo with the detected pose skeleton overlaid. */
export function LandmarkCanvas({ imageUrl, landmarks, height = 460 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const img = await loadImage(imageUrl).catch(() => null);
      if (!img || cancelled) return;
      const iw = img.naturalWidth || img.width;
      const ih = img.naturalHeight || img.height;
      const scale = height / ih;
      const W = Math.round(iw * scale);
      const H = height;
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, W, H);

      if (landmarks && landmarks.length) {
        const pt = (i: number) => ({ x: landmarks[i].x * W, y: landmarks[i].y * H, v: landmarks[i].visibility });
        const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent-bright').trim() || '#e7c47a';
        ctx.lineWidth = 3;
        ctx.strokeStyle = accent;
        ctx.globalAlpha = 0.9;
        for (const [a, b] of SKELETON) {
          const pa = pt(a), pb = pt(b);
          if (pa.v < 0.25 || pb.v < 0.25) continue;
          ctx.beginPath();
          ctx.moveTo(pa.x, pa.y);
          ctx.lineTo(pb.x, pb.y);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        for (const i of [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]) {
          const p = pt(i);
          if (p.v < 0.25) continue;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2);
          ctx.fillStyle = accent;
          ctx.fill();
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = 'rgba(0,0,0,0.5)';
          ctx.stroke();
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [imageUrl, landmarks, height]);

  return <canvas ref={canvasRef} style={{ maxWidth: '100%', height: 'auto', borderRadius: 4, border: '1px solid var(--line)' }} />;
}
