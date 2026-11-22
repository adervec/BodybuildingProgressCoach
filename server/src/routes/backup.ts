// Backup export/import. The bundle is the SQLite data only — nested by athlete so it carries no
// autoincrement ids across devices; media *bytes* ride separately (see the file endpoints below).
// Merge is insert-if-absent on natural keys, so importing the same bundle twice is a no-op and two
// devices converge instead of duplicating.
import { Router } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import sharp from 'sharp';
import { qAll, qGet, qRun, MEDIA_DIR, THUMB_DIR, type AthleteRow, type MediaRow, type AnalysisRow, type BodyCompRow } from '../db.js';
import { safeMediaName } from '../lib/safeName.js';
import { localDay } from '../lib/localDay.js';

export const backupRouter = Router();

export const BACKUP_APP = 'living-sculpture-backup';
export const BACKUP_VERSION = 1;

interface BundleAnalysis extends Omit<AnalysisRow, 'id' | 'media_id' | 'athlete_id'> { [k: string]: unknown }
interface BundleMedia extends Omit<MediaRow, 'id' | 'athlete_id'> { analyses?: BundleAnalysis[] }
interface BundleBodyComp extends Omit<BodyCompRow, 'id' | 'athlete_id'> { [k: string]: unknown }
interface BundleAthlete extends Omit<AthleteRow, 'id'> { media?: BundleMedia[]; bodycomp?: BundleBodyComp[] }

// GET /api/backup/export — the whole database as one nested JSON bundle.
backupRouter.get('/backup/export', (_req, res) => {
  const athletes = qAll<AthleteRow>('SELECT * FROM athletes ORDER BY id');
  const out = athletes.map((a) => {
    const media = qAll<MediaRow>('SELECT * FROM media_assets WHERE athlete_id = ? ORDER BY id', [a.id]).map((m) => {
      const { id, athlete_id, ...rest } = m;
      const analyses = qAll<AnalysisRow>('SELECT * FROM pose_analyses WHERE media_id = ? ORDER BY id', [id]).map(
        ({ id: _i, media_id: _m, athlete_id: _a, ...an }) => an
      );
      return { ...rest, analyses };
    });
    const bodycomp = qAll<BodyCompRow>('SELECT * FROM body_comp_entries WHERE athlete_id = ? ORDER BY id', [a.id]).map(
      ({ id: _i, athlete_id: _a, ...b }) => b
    );
    const { id: _id, ...athlete } = a;
    return { ...athlete, media, bodycomp };
  });
  res.json({ app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), athletes: out });
});

function bundleError(bundle: { app?: string; version?: number; athletes?: unknown } | null): string | null {
  if (!bundle || bundle.app !== BACKUP_APP) return 'Not a Living Sculpture backup file.';
  if (Number(bundle.version) > BACKUP_VERSION) return `That backup was written by a newer version (v${bundle.version}). Update this app first.`;
  if (!Array.isArray(bundle.athletes)) return 'Backup has no athletes array.';
  return null;
}

// POST /api/backup/import — merge a bundle in. Idempotent; returns what was actually added.
backupRouter.post('/backup/import', (req, res) => {
  const bundle = req.body as { app?: string; version?: number; athletes?: BundleAthlete[] };
  const err = bundleError(bundle);
  if (err) return res.status(400).json({ error: err });
  res.json({ ok: true, added: importInto(bundle.athletes!, false) });
});

// POST /api/backup/apply — cloud sync: { bundle, deletions } from an already-merged cloud copy
// (client/src/lib/sync/syncDoc.ts). Existing records are updated to match, then deletions applied.
backupRouter.post('/backup/apply', (req, res) => {
  const { bundle, deletions } = (req.body ?? {}) as { bundle?: { app?: string; version?: number; athletes?: BundleAthlete[] }; deletions?: unknown };
  const err = bundleError(bundle ?? null);
  if (err) return res.status(400).json({ error: err });
  if (!Array.isArray(deletions)) return res.status(400).json({ error: 'deletions must be a list' });
  const added = importInto(bundle!.athletes!, true);
  res.json({ ok: true, added, deleted: applyDeletions(deletions) });
});

function unlinkMedia(m: { file_name: string; thumb_name: string | null }) {
  for (const p of [safeMediaName(m.file_name) && path.join(MEDIA_DIR, m.file_name), safeMediaName(m.thumb_name) && path.join(THUMB_DIR, m.thumb_name!)]) {
    if (p && fs.existsSync(p)) try { fs.unlinkSync(p); } catch { /* ignore */ }
  }
}

function applyDeletions(list: unknown[]): number {
  let n = 0;
  for (const d of list as { kind?: string; key?: unknown }[]) {
    if (!Array.isArray(d?.key) || !d.key.every((k) => typeof k === 'string')) continue;
    const [k1, k2, k3] = d.key as string[];
    const athlete = () => qGet<{ id: number }>('SELECT id FROM athletes WHERE lower(trim(name)) = ?', [k1])?.id;
    let r = 0;
    if (d.kind === 'athletes') {
      const id = athlete();
      if (id == null) continue;
      for (const m of qAll<MediaRow>('SELECT * FROM media_assets WHERE athlete_id = ?', [id])) unlinkMedia(m);
      r = Number(qRun('DELETE FROM athletes WHERE id = ?', [id]).changes);
    } else if (d.kind === 'media') {
      const m = qGet<MediaRow>('SELECT * FROM media_assets WHERE file_name = ?', [k1]);
      if (!m) continue;
      unlinkMedia(m);
      r = Number(qRun('DELETE FROM media_assets WHERE id = ?', [m.id]).changes);
    } else if (d.kind === 'analyses') {
      r = Number(qRun('DELETE FROM pose_analyses WHERE media_id = (SELECT id FROM media_assets WHERE file_name = ?) AND source = ? AND created_at = ?', [k1, k2, k3]).changes);
    } else if (d.kind === 'bodycomp') {
      const id = athlete();
      if (id == null) continue;
      r = Number(qRun("DELETE FROM body_comp_entries WHERE athlete_id = ? AND measured_at = ? AND COALESCE(source, 'manual') = ?", [id, k2, k3]).changes);
    }
    n += r;
  }
  return n;
}

/** Insert-if-absent on natural keys; with `upsert`, a record that exists is updated to match too. */
function importInto(athletes: BundleAthlete[], upsert: boolean) {
  const added = { athletes: 0, media: 0, analyses: 0, bodycomp: 0 };
  for (const a of athletes) {
    const name = String(a?.name ?? '').trim();
    if (!name) continue;
    // Athlete identity is the name — a local, single-user library where two same-named athletes are
    // a genuine conflict, not two people.
    let athleteId = qGet<{ id: number }>('SELECT id FROM athletes WHERE name = ? COLLATE NOCASE', [name])?.id;
    if (!athleteId) {
      athleteId = Number(
        qRun('INSERT INTO athletes(name, category, height_cm, notes, created_at) VALUES(?,?,?,?,COALESCE(?, datetime(\'now\')))', [
          name,
          a.category || 'men_bodybuilding',
          a.height_cm ?? null,
          a.notes ?? null,
          a.created_at ?? null,
        ]).lastInsertRowid
      );
      added.athletes++;
    } else if (upsert) {
      qRun('UPDATE athletes SET name = ?, category = COALESCE(?, category), height_cm = ?, notes = ? WHERE id = ?', [
        name, a.category || null, a.height_cm ?? null, a.notes ?? null, athleteId,
      ]);
    }

    for (const m of a.media ?? []) {
      const fileName = safeMediaName(m?.file_name);
      if (!fileName) continue; // skip junk rather than failing the whole restore
      let mediaId = qGet<{ id: number }>('SELECT id FROM media_assets WHERE file_name = ?', [fileName])?.id;
      if (!mediaId) {
        mediaId = Number(
          qRun(
            `INSERT INTO media_assets(athlete_id, kind, file_name, thumb_name, mime, width, height, captured_at, pose_type, division, notes, created_at)
             VALUES(?,?,?,?,?,?,?,?,?,?,?,COALESCE(?, datetime('now')))`,
            [
              athleteId, m.kind === 'video' ? 'video' : 'photo', fileName, safeMediaName(m.thumb_name) ?? null, m.mime ?? null,
              m.width ?? null, m.height ?? null, m.captured_at || localDay(),
              m.pose_type ?? null, m.division ?? null, m.notes ?? null, m.created_at ?? null,
            ]
          ).lastInsertRowid
        );
        added.media++;
      } else if (upsert) {
        // the photo may have moved to another athlete (a rename on the other device)
        qRun('UPDATE media_assets SET athlete_id = ?, captured_at = COALESCE(?, captured_at), pose_type = ?, division = ?, notes = ? WHERE id = ?', [
          athleteId, m.captured_at || null, m.pose_type ?? null, m.division ?? null, m.notes ?? null, mediaId,
        ]);
        qRun('UPDATE pose_analyses SET athlete_id = ? WHERE media_id = ?', [athleteId, mediaId]);
      }
      for (const an of m.analyses ?? []) {
        const dupe = qGet<{ id: number }>('SELECT id FROM pose_analyses WHERE media_id = ? AND source = ? AND created_at = ?', [
          mediaId, an.source, an.created_at,
        ]);
        if (dupe && upsert) {
          qRun(
            `UPDATE pose_analyses SET pose_type = ?, form_score = ?, symmetry_score = ?, ref_match_score = ?, confidence = ?,
               metrics_json = ?, landmarks_json = ?, ai_feedback_json = ? WHERE id = ?`,
            [an.pose_type ?? null, an.form_score ?? null, an.symmetry_score ?? null, an.ref_match_score ?? null, an.confidence ?? null,
              an.metrics_json ?? null, an.landmarks_json ?? null, an.ai_feedback_json ?? null, dupe.id]
          );
        }
        if (dupe) continue;
        qRun(
          `INSERT INTO pose_analyses(media_id, athlete_id, source, pose_type, form_score, symmetry_score, ref_match_score,
             confidence, metrics_json, landmarks_json, ai_feedback_json, created_at)
           VALUES(?,?,?,?,?,?,?,?,?,?,?,COALESCE(?, datetime('now')))`,
          [
            mediaId, athleteId, an.source || 'geometry', an.pose_type ?? null, an.form_score ?? null, an.symmetry_score ?? null,
            an.ref_match_score ?? null, an.confidence ?? null, an.metrics_json ?? null, an.landmarks_json ?? null,
            an.ai_feedback_json ?? null, an.created_at ?? null,
          ]
        );
        added.analyses++;
      }
    }

    for (const b of a.bodycomp ?? []) {
      if (!b?.measured_at) continue;
      const dupe = qGet<{ id: number }>('SELECT id FROM body_comp_entries WHERE athlete_id = ? AND measured_at = ? AND source = ?', [
        athleteId, b.measured_at, b.source || 'manual',
      ]);
      if (dupe && upsert) {
        qRun('UPDATE body_comp_entries SET weight = ?, weight_unit = ?, body_fat_pct = ?, lean_mass = ?, measurements_json = ?, notes = ? WHERE id = ?', [
          b.weight ?? null, b.weight_unit ?? 'kg', b.body_fat_pct ?? null, b.lean_mass ?? null, b.measurements_json ?? null, b.notes ?? null, dupe.id,
        ]);
      }
      if (dupe) continue;
      qRun(
        `INSERT INTO body_comp_entries(athlete_id, measured_at, weight, weight_unit, body_fat_pct, lean_mass, measurements_json, source, notes, created_at)
         VALUES(?,?,?,?,?,?,?,?,?,COALESCE(?, datetime('now')))`,
        [
          athleteId, b.measured_at, b.weight ?? null, b.weight_unit ?? 'kg', b.body_fat_pct ?? null, b.lean_mass ?? null,
          b.measurements_json ?? null, b.source || 'manual', b.notes ?? null, b.created_at ?? null,
        ]
      );
      added.bodycomp++;
    }
  }
  return added;
}

// Which media files this server already has on disk — lets the client upload/download only the gap.
backupRouter.get('/backup/media-manifest', (_req, res) => {
  const rows = qAll<{ file_name: string }>('SELECT file_name FROM media_assets');
  const present: string[] = [];
  const missing: string[] = [];
  for (const r of rows) {
    const safe = safeMediaName(r.file_name);
    if (!safe) continue;
    (fs.existsSync(path.join(MEDIA_DIR, safe)) ? present : missing).push(safe);
  }
  res.json({ present, missing });
});

// PUT /api/backup/media-file/:name — restore one media file's bytes, rebuilding its thumbnail.
// Raw body (see the express.raw mount in index.ts); the name is traversal-checked above.
backupRouter.put('/backup/media-file/:name', async (req, res) => {
  const name = safeMediaName(req.params.name);
  if (!name) return res.status(400).json({ error: 'bad media file name' });
  const body = req.body as Buffer;
  if (!Buffer.isBuffer(body) || body.length === 0) return res.status(400).json({ error: 'empty body' });

  const dest = path.join(MEDIA_DIR, name);
  if (fs.existsSync(dest)) return res.json({ ok: true, skipped: true }); // immutable: never rewrite
  fs.writeFileSync(dest, body);

  const row = qGet<{ thumb_name: string | null }>('SELECT thumb_name FROM media_assets WHERE file_name = ?', [name]);
  const thumb = safeMediaName(row?.thumb_name);
  if (thumb) {
    // ponytail: rebuild the thumb from the original instead of syncing thumbs — halves the bytes.
    try {
      await sharp(dest).rotate().resize(640, 640, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 72 })
        .toFile(path.join(THUMB_DIR, thumb));
    } catch { /* non-fatal: original is what matters */ }
  }
  res.json({ ok: true, bytes: body.length });
});
