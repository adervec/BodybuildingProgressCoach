/**
 * Backup export/import for the browser-only build, producing and consuming the *same* bundle format
 * as the server's `/api/backup/*` routes — same `app`/`version`, same nesting, same `*_json` string
 * columns, same UUID media names. That means a backup taken from the self-hosted server restores
 * into the Pages app and vice versa; Drive sync becomes the bridge between them.
 */
import { tx, get, getAll, put, del, byIndex, now, thumbKey, forgetBlobUrl } from './store';
import { safeMediaName } from '../../../../server/src/lib/safeName';
import { localDay } from '../../../../server/src/lib/localDay';
import { t } from '../i18n';

export const BACKUP_APP = 'living-sculpture-backup';
export const BACKUP_VERSION = 1;

interface Row { id: number; [k: string]: unknown }

const str = (v: unknown): string | null => (v == null ? null : JSON.stringify(v));
const parse = <T>(v: unknown, fallback: T): T => {
  if (typeof v !== 'string') return (v as T) ?? fallback;
  try {
    return JSON.parse(v) as T;
  } catch {
    return fallback;
  }
};

export async function exportBundle(): Promise<unknown> {
  const { athletes, media, analyses, bodycomp } = await tx(['athletes', 'media', 'analyses', 'bodycomp'], 'readonly', async (t) => ({
    athletes: await getAll<Row>(t, 'athletes'),
    media: await getAll<Row>(t, 'media'),
    analyses: await getAll<Row>(t, 'analyses'),
    bodycomp: await getAll<Row>(t, 'bodycomp'),
  }));

  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    athletes: athletes.map((a) => {
      const { id, ...athlete } = a;
      return {
        ...athlete,
        media: media
          .filter((m) => m.athlete_id === id)
          .map((m) => {
            const { id: mid, athlete_id: _a, ...rest } = m;
            return {
              ...rest,
              analyses: analyses
                .filter((an) => an.media_id === mid)
                .map(({ id: _i, media_id: _m, athlete_id: _at, metrics, landmarks, ai_feedback, ...an }) => ({
                  ...an,
                  metrics_json: str(metrics),
                  landmarks_json: str(landmarks),
                  ai_feedback_json: str(ai_feedback),
                })),
            };
          }),
        bodycomp: bodycomp
          .filter((b) => b.athlete_id === id)
          .map(({ id: _i, athlete_id: _a2, measurements, ...b }) => ({ ...b, measurements_json: str(measurements) })),
      };
    }),
  };
}

export interface ImportCounts { athletes: number; media: number; analyses: number; bodycomp: number }

/**
 * Insert-if-absent on the same natural keys the server uses, so imports are idempotent. With
 * `upsert` (cloud sync applying an already-merged copy) a record that exists is updated to match too.
 */
export async function importBundle(bundle: unknown, opts: { upsert?: boolean } = {}): Promise<ImportCounts> {
  const b = bundle as { app?: string; version?: number; athletes?: Record<string, unknown>[] };
  if (!b || b.app !== BACKUP_APP) throw new Error(t('Not a Living Sculpture backup file.'));
  if (Number(b.version) > BACKUP_VERSION) throw new Error(t('That backup was written by a newer version (v{version}). Update this app first.', { version: String(b.version) }));
  if (!Array.isArray(b.athletes)) throw new Error(t('Backup has no athletes array.'));

  const added: ImportCounts = { athletes: 0, media: 0, analyses: 0, bodycomp: 0 };

  for (const a of b.athletes) {
    const name = String(a?.name ?? '').trim();
    if (!name) continue;

    await tx(['athletes', 'media', 'analyses', 'bodycomp'], 'readwrite', async (t) => {
      const all = await getAll<Row>(t, 'athletes');
      let athleteId = all.find((x) => String(x.name).toLowerCase() === name.toLowerCase())?.id;
      if (!athleteId) {
        athleteId = Number(
          await put(t, 'athletes', {
            name,
            category: a.category || 'men_bodybuilding',
            height_cm: a.height_cm ?? null,
            notes: a.notes ?? null,
            created_at: a.created_at || now(),
          })
        );
        added.athletes++;
      } else if (opts.upsert) {
        const cur = all.find((x) => x.id === athleteId)!;
        await put(t, 'athletes', { ...cur, name, category: a.category || cur.category, height_cm: a.height_cm ?? null, notes: a.notes ?? null });
      }

      const existingMedia = await getAll<Row>(t, 'media');
      for (const m of (a.media as Record<string, unknown>[]) ?? []) {
        const fileName = safeMediaName(m?.file_name);
        if (!fileName) continue;
        const curMedia = existingMedia.find((x) => x.file_name === fileName);
        let mediaId = curMedia?.id;
        if (curMedia && opts.upsert) {
          // the photo may have moved to another athlete (a rename on the other device)
          await put(t, 'media', { ...curMedia, athlete_id: athleteId, captured_at: m.captured_at || curMedia.captured_at,
            pose_type: m.pose_type ?? null, division: m.division ?? null, notes: m.notes ?? null });
          for (const an of await byIndex<Row>(t, 'analyses', 'media_id', curMedia.id)) if (an.athlete_id !== athleteId) await put(t, 'analyses', { ...an, athlete_id: athleteId });
        }
        if (!mediaId) {
          mediaId = Number(
            await put(t, 'media', {
              athlete_id: athleteId,
              kind: m.kind === 'video' ? 'video' : 'photo',
              file_name: fileName,
              thumb_name: safeMediaName(m.thumb_name) ?? null,
              mime: m.mime ?? null,
              width: m.width ?? null,
              height: m.height ?? null,
              captured_at: m.captured_at || localDay(),
              pose_type: m.pose_type ?? null,
              division: m.division ?? null,
              notes: m.notes ?? null,
              created_at: m.created_at || now(),
            })
          );
          added.media++;
        }
        const mine = await byIndex<Row>(t, 'analyses', 'media_id', mediaId);
        for (const an of (m.analyses as Record<string, unknown>[]) ?? []) {
          const same = mine.find((x) => x.source === an.source && x.created_at === an.created_at);
          if (same && !opts.upsert) continue;
          await put(t, 'analyses', {
            ...(same ? { id: same.id } : {}),
            media_id: mediaId,
            athlete_id: athleteId,
            source: an.source || 'geometry',
            pose_type: an.pose_type ?? null,
            form_score: an.form_score ?? null,
            symmetry_score: an.symmetry_score ?? null,
            ref_match_score: an.ref_match_score ?? null,
            confidence: an.confidence ?? null,
            metrics: parse(an.metrics_json, null),
            landmarks: parse(an.landmarks_json, null),
            ai_feedback: parse(an.ai_feedback_json, null),
            created_at: an.created_at || now(),
          });
          if (!same) added.analyses++;
        }
      }

      const comps = await byIndex<Row>(t, 'bodycomp', 'athlete_id', athleteId);
      for (const c of (a.bodycomp as Record<string, unknown>[]) ?? []) {
        if (!c?.measured_at) continue;
        const source = c.source || 'manual';
        const same = comps.find((x) => x.measured_at === c.measured_at && x.source === source);
        if (same && !opts.upsert) continue;
        await put(t, 'bodycomp', {
          ...(same ? { id: same.id } : {}),
          athlete_id: athleteId,
          measured_at: c.measured_at,
          weight: c.weight ?? null,
          weight_unit: c.weight_unit ?? 'kg',
          body_fat_pct: c.body_fat_pct ?? null,
          lean_mass: c.lean_mass ?? null,
          measurements: parse(c.measurements_json, {}),
          source,
          notes: c.notes ?? null,
          created_at: c.created_at || now(),
        });
        if (!same) added.bodycomp++;
      }
    });
  }
  return added;
}

/** Remove what another device deleted, by the natural keys of syncDoc.ts (Deletion.key). */
export async function applyDeletions(deletions: { kind: string; key: string[] }[]): Promise<number> {
  let n = 0;
  const forget: string[] = [];
  await tx(['athletes', 'media', 'analyses', 'bodycomp', 'blobs'], 'readwrite', async (t) => {
    const athletes = await getAll<Row>(t, 'athletes');
    const athleteId = (k: string) => athletes.find((a) => String(a.name).trim().toLowerCase() === k)?.id;
    const dropMedia = async (m: Row) => {
      for (const a of await byIndex<Row>(t, 'analyses', 'media_id', m.id)) await del(t, 'analyses', a.id);
      for (const b of [m.file_name, m.thumb_name && thumbKey(String(m.thumb_name)), m.thumb_name]) if (b) { await del(t, 'blobs', String(b)); forget.push(String(b)); }
      await del(t, 'media', m.id);
    };
    for (const d of deletions) {
      const [k1, k2, k3] = d.key;
      if (d.kind === 'athletes') {
        const id = athleteId(k1);
        if (id == null) continue;
        for (const m of await byIndex<Row>(t, 'media', 'athlete_id', id)) await dropMedia(m);
        for (const b of await byIndex<Row>(t, 'bodycomp', 'athlete_id', id)) await del(t, 'bodycomp', b.id);
        await del(t, 'athletes', id);
      } else if (d.kind === 'media') {
        const m = (await byIndex<Row>(t, 'media', 'file_name', k1))[0];
        if (!m) continue;
        await dropMedia(m);
      } else if (d.kind === 'analyses') {
        const m = (await byIndex<Row>(t, 'media', 'file_name', k1))[0];
        const an = m && (await byIndex<Row>(t, 'analyses', 'media_id', m.id)).find((x) => x.source === k2 && x.created_at === k3);
        if (!an) continue;
        await del(t, 'analyses', an.id);
      } else if (d.kind === 'bodycomp') {
        const id = athleteId(k1);
        const b = id == null ? null : (await byIndex<Row>(t, 'bodycomp', 'athlete_id', id)).find((x) => x.measured_at === k2 && (x.source || 'manual') === k3);
        if (!b) continue;
        await del(t, 'bodycomp', b.id);
      } else continue;
      n++;
    }
  });
  forget.forEach(forgetBlobUrl);
  return n;
}

/** Which media blobs this browser holds, and which its rows reference but lack. */
export async function mediaManifest(): Promise<{ present: string[]; missing: string[] }> {
  return tx(['media', 'blobs'], 'readonly', async (t) => {
    const rows = await getAll<Row>(t, 'media');
    const present: string[] = [];
    const missing: string[] = [];
    for (const r of rows) {
      const name = safeMediaName(r.file_name);
      if (!name) continue;
      ((await get<Blob>(t, 'blobs', name)) ? present : missing).push(name);
    }
    return { present, missing };
  });
}

export async function getMediaBlob(name: string): Promise<Blob | null> {
  const safe = safeMediaName(name);
  if (!safe) return null;
  return (await tx('blobs', 'readonly', (t) => get<Blob>(t, 'blobs', safe))) ?? null;
}

/** Store restored bytes. Immutable: an existing blob is never rewritten. */
export async function putMediaFile(name: string, blob: Blob): Promise<boolean> {
  const safe = safeMediaName(name);
  if (!safe) throw new Error(t('bad media file name'));
  return tx('blobs', 'readwrite', async (t) => {
    if (await get<Blob>(t, 'blobs', safe)) return false;
    await put(t, 'blobs', blob, safe);
    return true;
  });
}
