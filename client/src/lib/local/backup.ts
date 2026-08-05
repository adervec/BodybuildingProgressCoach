/**
 * Backup export/import for the browser-only build, producing and consuming the *same* bundle format
 * as the server's `/api/backup/*` routes — same `app`/`version`, same nesting, same `*_json` string
 * columns, same UUID media names. That means a backup taken from the self-hosted server restores
 * into the Pages app and vice versa; Drive sync becomes the bridge between them.
 */
import { tx, get, getAll, put, byIndex, now } from './store';
import { safeMediaName } from '../../../../server/src/lib/safeName';

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

/** Insert-if-absent on the same natural keys the server uses, so imports are idempotent. */
export async function importBundle(bundle: unknown): Promise<ImportCounts> {
  const b = bundle as { app?: string; version?: number; athletes?: Record<string, unknown>[] };
  if (!b || b.app !== BACKUP_APP) throw new Error('Not a Living Sculpture backup file.');
  if (Number(b.version) > BACKUP_VERSION) throw new Error(`That backup was written by a newer version (v${b.version}). Update this app first.`);
  if (!Array.isArray(b.athletes)) throw new Error('Backup has no athletes array.');

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
      }

      const existingMedia = await getAll<Row>(t, 'media');
      for (const m of (a.media as Record<string, unknown>[]) ?? []) {
        const fileName = safeMediaName(m?.file_name);
        if (!fileName) continue;
        let mediaId = existingMedia.find((x) => x.file_name === fileName)?.id;
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
              captured_at: m.captured_at || new Date().toISOString().slice(0, 10),
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
          if (mine.some((x) => x.source === an.source && x.created_at === an.created_at)) continue;
          await put(t, 'analyses', {
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
          added.analyses++;
        }
      }

      const comps = await byIndex<Row>(t, 'bodycomp', 'athlete_id', athleteId);
      for (const c of (a.bodycomp as Record<string, unknown>[]) ?? []) {
        if (!c?.measured_at) continue;
        const source = c.source || 'manual';
        if (comps.some((x) => x.measured_at === c.measured_at && x.source === source)) continue;
        await put(t, 'bodycomp', {
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
        added.bodycomp++;
      }
    });
  }
  return added;
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
  if (!safe) throw new Error('bad media file name');
  return tx('blobs', 'readwrite', async (t) => {
    if (await get<Blob>(t, 'blobs', safe)) return false;
    await put(t, 'blobs', blob, safe);
    return true;
  });
}
