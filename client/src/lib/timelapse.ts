import type { Landmark } from './types';
import { LM } from './geometry';

export interface Alignment {
  shoulderMid: { x: number; y: number };
  hipMid: { x: number; y: number };
}

export interface TimelapseFrame {
  img: HTMLImageElement;
  caption?: string;
  alignment?: Alignment | null;
}

export interface TimelapseOptions {
  width?: number;
  height?: number;
  holdMs?: number;
  align?: boolean;
  bg?: string;
  caption?: boolean;
  accent?: string;
  onProgress?: (p: number) => void;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Compute alignment anchors (in image pixels) from normalized landmarks. */
export function alignmentFromLandmarks(landmarks: Landmark[], imgW: number, imgH: number): Alignment {
  const px = (i: number) => ({ x: landmarks[i].x * imgW, y: landmarks[i].y * imgH });
  const lSh = px(LM.lShoulder), rSh = px(LM.rShoulder);
  const lHip = px(LM.lHip), rHip = px(LM.rHip);
  return {
    shoulderMid: { x: (lSh.x + rSh.x) / 2, y: (lSh.y + rSh.y) / 2 },
    hipMid: { x: (lHip.x + rHip.x) / 2, y: (lHip.y + rHip.y) / 2 },
  };
}

/** Draw one frame, optionally normalized so the torso is the same size/position. */
export function drawFrame(
  ctx: CanvasRenderingContext2D,
  frame: TimelapseFrame,
  W: number,
  H: number,
  opts: { align: boolean; bg: string; caption: boolean; accent: string }
): void {
  ctx.save();
  ctx.fillStyle = opts.bg;
  ctx.fillRect(0, 0, W, H);

  const img = frame.img;
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;

  if (opts.align && frame.alignment) {
    const a = frame.alignment;
    const torsoPx = Math.hypot(a.shoulderMid.x - a.hipMid.x, a.shoulderMid.y - a.hipMid.y) || ih * 0.25;
    const targetTorso = H * 0.3; // every athlete drawn to the same torso height
    const scale = targetTorso / torsoPx;
    const centerSrc = { x: (a.shoulderMid.x + a.hipMid.x) / 2, y: (a.shoulderMid.y + a.hipMid.y) / 2 };
    const targetCenter = { x: W / 2, y: H * 0.46 };
    ctx.translate(targetCenter.x, targetCenter.y);
    ctx.scale(scale, scale);
    ctx.translate(-centerSrc.x, -centerSrc.y);
    ctx.drawImage(img, 0, 0, iw, ih);
  } else {
    // contain-fit
    const scale = Math.min(W / iw, H / ih);
    const w = iw * scale, h = ih * scale;
    ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
  }
  ctx.restore();

  if (opts.caption && frame.caption) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, H - 64, W, 64);
    ctx.fillStyle = opts.accent;
    ctx.font = `500 ${Math.round(H * 0.026)}px 'DM Mono', monospace`;
    ctx.textBaseline = 'middle';
    ctx.fillText(frame.caption, 28, H - 32);
    ctx.restore();
  }
}

function pickMime(): string {
  // MP4 first: phones and social apps play it, many of them reject WebM outright.
  const candidates = [
    'video/mp4;codecs=avc1.42E01E',
    'video/mp4',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  for (const c of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c)) return c;
  }
  return 'video/webm';
}

/** File extension matching whatever the recorder actually produced. */
export function extForMime(mime: string): string {
  return mime.includes('mp4') ? 'mp4' : 'webm';
}

/** Render frames to an offscreen canvas and export a .webm progress timelapse. */
export async function exportTimelapseWebm(frames: TimelapseFrame[], options: TimelapseOptions = {}): Promise<Blob> {
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('This browser cannot export video (MediaRecorder unsupported). Use the in-app player instead.');
  }
  const W = options.width ?? 1080;
  const H = options.height ?? 1440;
  const holdMs = options.holdMs ?? 650;
  const draw = {
    align: options.align ?? true,
    bg: options.bg ?? '#0c0b08',
    caption: options.caption ?? true,
    accent: options.accent ?? '#e7c47a',
  };

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable.');

  const stream = canvas.captureStream(30);
  const mimeType = pickMime();
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };
  const finished = new Promise<Blob>((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
  });

  recorder.start();
  for (let i = 0; i < frames.length; i++) {
    drawFrame(ctx, frames[i], W, H, draw);
    options.onProgress?.((i + 1) / frames.length);
    await sleep(holdMs);
  }
  await sleep(150); // let the final frame land
  recorder.stop();
  return finished;
}
