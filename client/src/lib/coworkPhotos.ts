/**
 * Photos for the cowork agent. The built-in analysis only sees 33 body landmarks; a vision agent
 * reading the photo itself can judge muscle, conditioning and presentation. So the review channels
 * put the photos beside their request, in the folder the reader picked:
 *   - on by default, with a switch on the Dashboard (the reader chose this, 2026-11-21);
 *   - downsized to 1600 px on the long side and re-encoded as JPEG, which also drops EXIF
 *     (GPS location, camera serials) — only pixels travel;
 *   - only when the shared cowork.js can write bytes (v3+); older engines get numbers only.
 * ponytail: photos written for earlier requests stay in the folder (cowork.js has no app-side
 * delete); add a cleanup if folders grow too big.
 */
import { IS_STATIC } from '../api';
import { getMediaBlob } from './local/backup';

export const COWORK_PHOTOS_KEY = 'bpc-cowork-photos';
export const PHOTO_MAX_SIDE = 1600;

export function photosEnabled(): boolean {
  try { return localStorage.getItem(COWORK_PHOTOS_KEY) !== '0'; } catch { return true; }
}
export function setPhotosEnabled(on: boolean) {
  try { localStorage.setItem(COWORK_PHOTOS_KEY, on ? '1' : '0'); } catch { /* storage off */ }
}

/** The live cowork.js can write Blobs (v3). */
export function engineTakesPhotos(): boolean {
  const v = (globalThis as unknown as { cowork?: { version?: number } }).cowork?.version;
  return typeof v === 'number' && v >= 3;
}

/** Photos actually travel: the reader allows it and the engine can write them. */
export function photosTravel(): boolean {
  return photosEnabled() && engineTakesPhotos();
}

/** Scale (w, h) to fit within `max` on the long side, never enlarging. */
export function fitWithin(w: number, h: number, max = PHOTO_MAX_SIDE): { w: number; h: number } {
  const s = Math.min(1, max / Math.max(w, h, 1));
  return { w: Math.max(1, Math.round(w * s)), h: Math.max(1, Math.round(h * s)) };
}

/** The request-folder path for a media file: always .jpg (we re-encode), named by its UUID. */
export function photoPath(channel: string, fileName: string): string {
  return `${channel}/photos/${fileName.replace(/\.[^.]+$/, '')}.jpg`;
}

async function originalBytes(fileName: string): Promise<Blob | null> {
  if (IS_STATIC) return getMediaBlob(fileName);
  const r = await fetch(`/media/${encodeURIComponent(fileName)}`);
  return r.ok ? r.blob() : null;
}

/** Downsized, EXIF-free JPEG of one media photo, or null if it cannot be read. */
export async function preparePhoto(fileName: string): Promise<Blob | null> {
  try {
    const src = await originalBytes(fileName);
    if (!src || !src.type.startsWith('image/')) return null;
    const bmp = await createImageBitmap(src, { imageOrientation: 'from-image' });
    const { w, h } = fitWithin(bmp.width, bmp.height);
    const canvas = new OffscreenCanvas(w, h);
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, w, h);
    bmp.close();
    return await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.86 });
  } catch {
    return null; // an unreadable photo (e.g. HEIC in a browser without it) goes without its picture
  }
}

// Which photos each channel's latest request carried, so a reply read after a reload still knows
// whether the agent saw the picture.
const SENT_KEY = 'bpc-cowork-sent';
function readSent(): Record<string, string[]> {
  try {
    const v = JSON.parse(localStorage.getItem(SENT_KEY) || '{}');
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}
export function sentFor(channel: string): Set<string> {
  const v = readSent()[channel];
  return new Set(Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);
}

/** Add prepared photos for `fileNames` to a cowork files map, under `channel/photos/`, and remember them. */
export async function addPhotos(files: Record<string, unknown>, channel: string, fileNames: string[]): Promise<Set<string>> {
  const sent = new Set<string>();
  if (photosTravel()) {
    for (const name of new Set(fileNames)) {
      const blob = await preparePhoto(name);
      if (blob) { files[photoPath(channel, name)] = blob; sent.add(name); }
    }
  }
  try { localStorage.setItem(SENT_KEY, JSON.stringify({ ...readSent(), [channel]: [...sent] })); } catch { /* quota */ }
  return sent;
}
