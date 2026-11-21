import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const ls = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => ls.get(k) ?? null,
  setItem: (k: string, v: string) => void ls.set(k, String(v)),
  removeItem: (k: string) => void ls.delete(k),
});
const { fitWithin, photoPath, photosEnabled, setPhotosEnabled, photosTravel, addPhotos, sentFor } = await import('./coworkPhotos');

beforeEach(() => ls.clear());
afterEach(() => { delete (globalThis as { cowork?: unknown }).cowork; });

describe('photos for the cowork agent', () => {
  it('downsizes to 1600 px on the long side, keeping the shape, never enlarging', () => {
    expect(fitWithin(4032, 3024)).toEqual({ w: 1600, h: 1200 });
    expect(fitWithin(3000, 4000)).toEqual({ w: 1200, h: 1600 });
    expect(fitWithin(800, 600)).toEqual({ w: 800, h: 600 });
  });

  it('names each photo by its UUID, always .jpg (it is re-encoded, which also drops EXIF)', () => {
    expect(photoPath('pose-review', 'abc.HEIC')).toBe('pose-review/photos/abc.jpg');
  });

  it('is on by default, the reader can turn it off, and nothing travels unless the engine can write photos', async () => {
    expect(photosEnabled()).toBe(true);
    expect(photosTravel()).toBe(false); // no cowork.js v3 loaded
    (globalThis as { cowork?: unknown }).cowork = { version: 3 };
    expect(photosTravel()).toBe(true);
    setPhotosEnabled(false);
    expect(photosTravel()).toBe(false);

    const files: Record<string, unknown> = {};
    expect((await addPhotos(files, 'coach', ['a.jpg'])).size).toBe(0);
    expect(Object.keys(files)).toEqual([]);
    expect(sentFor('coach').size).toBe(0); // remembered as "nothing sent", so replies are marked numbers-only
  });
});
