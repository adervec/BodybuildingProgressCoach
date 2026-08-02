/**
 * Dependency-free EXIF capture-date reader.
 *
 * A progress tracker lives or dies on honest dates: a photo copied off a phone in
 * March but *shot* in January must land in January, or every trend line lies.
 * So we read DateTimeOriginal out of the JPEG and only fall back to the file's
 * own timestamp — surfacing which one we used.
 */

const pad = (n: number) => String(n).padStart(2, '0');
const localISO = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const ascii = (v: DataView, off: number, len: number) => {
  let s = '';
  for (let i = 0; i < len; i++) s += String.fromCharCode(v.getUint8(off + i));
  return s;
};

/** "2024:03:07 06:41:22" → "2024-03-07"; anything else → null. */
function toISODate(exif: string): string | null {
  const m = /^(\d{4}):(\d{2}):(\d{2})/.exec(exif);
  if (!m) return null;
  const [, y, mo, d] = m;
  if (+mo < 1 || +mo > 12 || +d < 1 || +d > 31) return null;
  return `${y}-${mo}-${d}`;
}

/** Reads one IFD, returning the first date tag found and any Exif sub-IFD offset. */
function readIFD(v: DataView, tiff: number, ifd: number, le: boolean) {
  const count = v.getUint16(tiff + ifd, le);
  let date: string | null = null;
  let sub = 0;
  for (let i = 0; i < count; i++) {
    const e = tiff + ifd + 2 + i * 12;
    const tag = v.getUint16(e, le);
    if (tag === 0x8769) sub = v.getUint32(e + 8, le); // Exif sub-IFD pointer
    // DateTimeOriginal, DateTimeDigitized, DateTime — 20-byte ASCII, always out-of-line.
    else if ((tag === 0x9003 || tag === 0x9004 || tag === 0x0132) && !date) {
      date = toISODate(ascii(v, tiff + v.getUint32(e + 8, le), 19));
    }
  }
  return { date, sub };
}

/** @returns "YYYY-MM-DD" from a JPEG's EXIF, or null if it has none we can read. */
export function exifDate(buf: ArrayBuffer): string | null {
  try {
    const v = new DataView(buf);
    if (v.getUint16(0) !== 0xffd8) return null; // not a JPEG
    for (let off = 2; off + 4 <= v.byteLength; ) {
      if (v.getUint8(off) !== 0xff) return null; // marker desync — don't guess
      const marker = v.getUint8(off + 1);
      if (marker === 0xda || marker === 0xd9) return null; // image data starts; no EXIF
      const size = v.getUint16(off + 2);
      if (marker === 0xe1 && ascii(v, off + 4, 4) === 'Exif') {
        const tiff = off + 10;
        const le = ascii(v, tiff, 2) === 'II';
        if (!le && ascii(v, tiff, 2) !== 'MM') return null;
        if (v.getUint16(tiff + 2, le) !== 0x2a) return null;
        const ifd0 = readIFD(v, tiff, v.getUint32(tiff + 4, le), le);
        // DateTimeOriginal lives in the sub-IFD; prefer it over IFD0's DateTime.
        const exif = ifd0.sub ? readIFD(v, tiff, ifd0.sub, le) : null;
        return exif?.date ?? ifd0.date;
      }
      off += 2 + size;
    }
    return null;
  } catch {
    return null; // truncated or malformed — the file date is a fine fallback
  }
}

export interface CaptureDate {
  date: string;
  /** 'exif' = when it was shot; 'file' = when the file was last written. */
  src: 'exif' | 'file';
}

/** Best-known date a file was captured. Only the header is read, not the whole photo. */
export async function captureDate(file: File): Promise<CaptureDate> {
  if (/^image\/jpe?g$/.test(file.type)) {
    // ponytail: 128 KB covers EXIF in every camera/phone JPEG seen in the wild.
    const d = exifDate(await file.slice(0, 128 * 1024).arrayBuffer());
    if (d) return { date: d, src: 'exif' };
  }
  return { date: localISO(file.lastModified || Date.now()), src: 'file' };
}
