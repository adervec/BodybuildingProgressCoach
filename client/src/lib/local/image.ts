// Canvas replacements for what `sharp` does server-side: read pixel dimensions and make a thumbnail.
// `imageOrientation: 'from-image'` is the equivalent of sharp's .rotate() — it applies the EXIF
// orientation flag, so a portrait phone photo isn't stored sideways.

export interface Decoded {
  width: number;
  height: number;
  bitmap: ImageBitmap;
}

export async function decode(blob: Blob): Promise<Decoded | null> {
  try {
    const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
    return { width: bitmap.width, height: bitmap.height, bitmap };
  } catch {
    return null; // not a decodable image (or a video) — caller falls back
  }
}

/** Same output shape as the server's thumbnailer: fit inside 640×640, never enlarged, JPEG q72. */
export async function thumbnail(bitmap: ImageBitmap, max = 640, quality = 0.72): Promise<Blob | null> {
  const scale = Math.min(max / bitmap.width, max / bitmap.height, 1);
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(bitmap, 0, 0, w, h);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', quality));
}

/** First decodable frame of a video, used as its poster thumbnail. */
export async function videoPoster(blob: Blob): Promise<{ thumb: Blob | null; width: number | null; height: number | null }> {
  const url = URL.createObjectURL(blob);
  try {
    const v = document.createElement('video');
    v.src = url;
    v.muted = true;
    v.playsInline = true;
    await new Promise<void>((resolve, reject) => {
      v.onloadeddata = () => resolve();
      v.onerror = () => reject(new Error('video decode failed'));
    });
    // Seek a little in: frame 0 of a posing clip is often a blur or a black lead-in.
    await new Promise<void>((resolve) => {
      v.onseeked = () => resolve();
      v.currentTime = Math.min(0.5, (v.duration || 1) / 2);
    });
    const canvas = document.createElement('canvas');
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext('2d')?.drawImage(v, 0, 0);
    const full = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.72));
    if (!full) return { thumb: null, width: v.videoWidth || null, height: v.videoHeight || null };
    const bmp = await createImageBitmap(full);
    return { thumb: await thumbnail(bmp), width: v.videoWidth || null, height: v.videoHeight || null };
  } catch {
    return { thumb: null, width: null, height: null };
  } finally {
    URL.revokeObjectURL(url);
  }
}
