import { describe, it, expect } from 'vitest';
import { exifDate, captureDate } from './exif';

/** Builds a minimal JPEG whose APP1/EXIF carries one date tag. */
function jpegWithExif(date: string, { le = true, tag = 0x9003 } = {}): ArrayBuffer {
  const tiff = new DataView(new ArrayBuffer(64));
  const w16 = (o: number, n: number) => tiff.setUint16(o, n, le);
  const w32 = (o: number, n: number) => tiff.setUint32(o, n, le);
  tiff.setUint8(0, le ? 0x49 : 0x4d);
  tiff.setUint8(1, le ? 0x49 : 0x4d); // "II" | "MM"
  w16(2, 0x2a);
  w32(4, 8); // IFD0 at 8
  const sub = tag === 0x0132 ? 0 : 26;
  if (sub) {
    w16(8, 1); // IFD0: one entry — the Exif sub-IFD pointer
    w16(10, 0x8769); w16(12, 4); w32(14, 1); w32(18, sub);
    w16(26, 1); // sub-IFD: one entry — the date
    w16(28, tag); w16(30, 2); w32(32, 20); w32(36, 44);
  } else {
    w16(8, 1); // IFD0 carries the date itself
    w16(10, tag); w16(12, 2); w32(14, 20); w32(18, 44);
  }
  for (let i = 0; i < date.length; i++) tiff.setUint8(44 + i, date.charCodeAt(i));

  const out = new Uint8Array(2 + 4 + 6 + 64 + 2);
  const head = new DataView(out.buffer);
  head.setUint16(0, 0xffd8); // SOI
  head.setUint16(2, 0xffe1); // APP1
  head.setUint16(4, 2 + 6 + 64); // segment size
  out.set([0x45, 0x78, 0x69, 0x66, 0, 0], 6); // "Exif\0\0"
  out.set(new Uint8Array(tiff.buffer), 12);
  head.setUint16(76, 0xffda); // SOS
  return out.buffer;
}

describe('exifDate', () => {
  it('reads DateTimeOriginal (little-endian)', () => {
    expect(exifDate(jpegWithExif('2024:03:07 06:41:22'))).toBe('2024-03-07');
  });

  it('reads DateTimeOriginal (big-endian)', () => {
    expect(exifDate(jpegWithExif('2019:11:30 18:02:00', { le: false }))).toBe('2019-11-30');
  });

  it('falls back to IFD0 DateTime when there is no sub-IFD', () => {
    expect(exifDate(jpegWithExif('2021:01:09 12:00:00', { tag: 0x0132 }))).toBe('2021-01-09');
  });

  it('returns null for a non-JPEG', () => {
    expect(exifDate(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]).buffer)).toBeNull();
  });

  it('returns null for a JPEG with no EXIF', () => {
    expect(exifDate(new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0, 2]).buffer)).toBeNull();
  });

  it('returns null on a garbage date rather than inventing one', () => {
    expect(exifDate(jpegWithExif('not a date at all!!'))).toBeNull();
    expect(exifDate(jpegWithExif('2024:19:44 06:41:22'))).toBeNull();
  });

  it('survives a truncated EXIF block', () => {
    const full = new Uint8Array(jpegWithExif('2024:03:07 06:41:22'));
    expect(exifDate(full.slice(0, 40).buffer)).toBeNull();
  });
});

describe('captureDate', () => {
  it('prefers the shot date over the file date', async () => {
    const f = new File([jpegWithExif('2024:03:07 06:41:22')], 'a.jpg', { type: 'image/jpeg', lastModified: Date.UTC(2025, 5, 1) });
    expect(await captureDate(f)).toEqual({ date: '2024-03-07', src: 'exif' });
  });

  it('falls back to the file date, flagged as such', async () => {
    const noon = new Date(2025, 5, 1, 12).getTime(); // local noon — no UTC day-shift
    const f = new File([new Uint8Array([1, 2, 3])], 'b.png', { type: 'image/png', lastModified: noon });
    expect(await captureDate(f)).toEqual({ date: '2025-06-01', src: 'file' });
  });
});
