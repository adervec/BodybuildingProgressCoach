/**
 * Regression: in the browser build a JPEG's thumbnail is named `<uuid>.jpg`, the same as the photo,
 * and both live in one `blobs` store. Until 2026-11-21 the thumbnail overwrote the original of every
 * JPEG upload. Thumbnails now live under their own key; old data keeps working.
 */
import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { tx, put, get, thumbKey, thumbUrl, blobUrl } from './store';

const NAME = '13985898-2ed3-48c6-8557-684228573aca.jpg';

describe('photos and their thumbnails', () => {
  it('a JPEG and its thumbnail (same file name) are both kept', async () => {
    await tx('blobs', 'readwrite', async (t) => {
      await put(t, 'blobs', new Blob(['ORIGINAL-full-size']), NAME);
      await put(t, 'blobs', new Blob(['thumb']), thumbKey(NAME)); // what upload does now
    });
    const original = await tx('blobs', 'readonly', (t) => get<Blob>(t, 'blobs', NAME));
    expect(await original!.text()).toBe('ORIGINAL-full-size');
    expect(await thumbUrl({ thumb_name: NAME, file_name: NAME, kind: 'photo' })).toBe(await blobUrl(thumbKey(NAME)));
  });

  it('old data (thumbnail under the bare name) and restored photos (no thumbnail) still show a picture', async () => {
    const png = '22222222-2ed3-48c6-8557-684228573aca.png', legacyThumb = '22222222-2ed3-48c6-8557-684228573aca.jpg';
    const restored = '33333333-2ed3-48c6-8557-684228573aca.jpg';
    await tx('blobs', 'readwrite', async (t) => {
      await put(t, 'blobs', new Blob(['png']), png);
      await put(t, 'blobs', new Blob(['old thumb']), legacyThumb);
      await put(t, 'blobs', new Blob(['restored photo']), restored);
    });
    expect(await thumbUrl({ thumb_name: legacyThumb, file_name: png, kind: 'photo' })).toBe(await blobUrl(legacyThumb));
    expect(await thumbUrl({ thumb_name: '44444444-2ed3-48c6-8557-684228573aca.jpg', file_name: restored, kind: 'photo' })).toBe(await blobUrl(restored));
    expect(await thumbUrl({ thumb_name: null, file_name: 'missing.mp4', kind: 'video' })).toBeNull();
  });
});
