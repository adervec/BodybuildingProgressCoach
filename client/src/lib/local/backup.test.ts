/**
 * The browser-only backend has to produce and consume the *same* bundle the server does — that's
 * what lets a self-hosted backup restore into the Pages app and back. These tests pin the round
 * trip and the idempotent merge, which is the part most likely to silently duplicate data.
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { exportBundle, importBundle, mediaManifest, putMediaFile, getMediaBlob, BACKUP_APP } from './backup';
import { tx, put, getAll } from './store';

const FILE = '13985898-2ed3-48c6-8557-684228573aca.jpg';
const THUMB = '13985898-2ed3-48c6-8557-684228573aca.jpg';

async function wipe() {
  await tx(['athletes', 'media', 'analyses', 'bodycomp', 'blobs'], 'readwrite', (t) => {
    for (const s of ['athletes', 'media', 'analyses', 'bodycomp', 'blobs'] as const) t.objectStore(s).clear();
  });
}

async function seed() {
  await tx(['athletes', 'media', 'analyses', 'bodycomp', 'blobs'], 'readwrite', async (t) => {
    const aid = Number(await put(t, 'athletes', { name: 'Ada', category: 'classic_physique', height_cm: 178, notes: null, created_at: '2026-01-02 10:00:00' }));
    const mid = Number(
      await put(t, 'media', {
        athlete_id: aid, kind: 'photo', file_name: FILE, thumb_name: THUMB, mime: 'image/jpeg',
        width: 120, height: 160, captured_at: '2026-02-01', pose_type: 'fdb', division: null, notes: null,
        created_at: '2026-02-01 09:00:00',
      })
    );
    await put(t, 'analyses', {
      media_id: mid, athlete_id: aid, source: 'geometry', pose_type: 'fdb', form_score: 71.5,
      symmetry_score: 80, ref_match_score: 63, confidence: 0.9,
      metrics: { vTaper: 1.41 }, landmarks: [{ x: 0.5, y: 0.5, z: 0, visibility: 0.99 }],
      ai_feedback: null, created_at: '2026-02-01 09:05:00',
    });
    await put(t, 'bodycomp', {
      athlete_id: aid, measured_at: '2026-02-01', weight: 88.2, weight_unit: 'kg', body_fat_pct: 9.8,
      lean_mass: null, measurements: { waist: 78 }, source: 'manual', notes: null, created_at: '2026-02-01 09:10:00',
    });
    await put(t, 'blobs', new Blob(['jpeg-bytes']), FILE);
  });
}

describe('browser-only backup', () => {
  beforeEach(async () => {
    await wipe();
    await seed();
  });

  it('exports the server bundle format, with json columns stringified and no ids', async () => {
    const b = (await exportBundle()) as Record<string, never>;
    expect(b).toMatchObject({ app: BACKUP_APP, version: 1 });
    const a = (b.athletes as unknown as Record<string, never>[])[0];
    expect(a).toMatchObject({ name: 'Ada', category: 'classic_physique' });
    expect('id' in a).toBe(false);

    const m = (a.media as unknown as Record<string, never>[])[0];
    expect(m.file_name).toBe(FILE);
    expect('id' in m).toBe(false);
    // The server keeps these as TEXT columns; the browser build must match so bundles interchange.
    const an = (m.analyses as unknown as Record<string, string>[])[0];
    expect(JSON.parse(an.metrics_json)).toEqual({ vTaper: 1.41 });
    expect(JSON.parse(an.landmarks_json)).toHaveLength(1);
    const c = (a.bodycomp as unknown as Record<string, string>[])[0];
    expect(JSON.parse(c.measurements_json)).toEqual({ waist: 78 });
  });

  it('round-trips into an empty database', async () => {
    const bundle = await exportBundle();
    await wipe();

    const added = await importBundle(bundle);
    expect(added).toEqual({ athletes: 1, media: 1, analyses: 1, bodycomp: 1 });

    const { athletes, analyses, bodycomp } = await tx(['athletes', 'analyses', 'bodycomp'], 'readonly', async (t) => ({
      athletes: await getAll<{ name: string }>(t, 'athletes'),
      analyses: await getAll<{ metrics: { vTaper: number } }>(t, 'analyses'),
      bodycomp: await getAll<{ measurements: { waist: number } }>(t, 'bodycomp'),
    }));
    expect(athletes[0].name).toBe('Ada');
    // Parsed back out of the *_json strings, not left as text.
    expect(analyses[0].metrics.vTaper).toBe(1.41);
    expect(bodycomp[0].measurements.waist).toBe(78);
  });

  it('is idempotent — importing the same bundle twice adds nothing', async () => {
    const bundle = await exportBundle();
    expect(await importBundle(bundle)).toEqual({ athletes: 0, media: 0, analyses: 0, bodycomp: 0 });
    expect(await importBundle(bundle)).toEqual({ athletes: 0, media: 0, analyses: 0, bodycomp: 0 });
  });

  it('rejects a file that is not one of our backups', async () => {
    await expect(importBundle({ app: 'something-else', version: 1, athletes: [] })).rejects.toThrow(/Not a Living Sculpture backup/);
    await expect(importBundle({ app: BACKUP_APP, version: 99, athletes: [] })).rejects.toThrow(/newer version/);
  });

  it('reports which media bytes are present vs missing', async () => {
    expect(await mediaManifest()).toEqual({ present: [FILE], missing: [] });

    const bundle = await exportBundle();
    await wipe();
    await importBundle(bundle); // rows restored, bytes not yet
    expect(await mediaManifest()).toEqual({ present: [], missing: [FILE] });

    expect(await putMediaFile(FILE, new Blob(['jpeg-bytes']))).toBe(true);
    expect(await mediaManifest()).toEqual({ present: [FILE], missing: [] });
  });

  it('never overwrites media bytes it already has, and refuses unsafe names', async () => {
    expect(await putMediaFile(FILE, new Blob(['DIFFERENT']))).toBe(false);
    expect(await (await getMediaBlob(FILE))!.text()).toBe('jpeg-bytes');
    await expect(putMediaFile('../../evil.sh', new Blob(['x']))).rejects.toThrow(/bad media file name/);
  });
});
