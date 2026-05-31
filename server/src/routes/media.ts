import { Router } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { qAll, qGet, qRun, MEDIA_DIR, THUMB_DIR, parseJson, type MediaRow, type AnalysisRow } from '../db.js';

export const mediaRouter = Router();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, MEDIA_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '';
    cb(null, `${crypto.randomUUID()}${ext.toLowerCase()}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 250 * 1024 * 1024 }, // 250 MB (videos)
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) cb(null, true);
    else cb(new Error('Only image and video files are supported.'));
  },
});

function hydrate(m: MediaRow) {
  return {
    ...m,
    url: `/media/${m.file_name}`,
    thumb_url: m.thumb_name ? `/thumbs/${m.thumb_name}` : null,
  };
}

// Upload one media file for an athlete.
mediaRouter.post('/athletes/:id/media', upload.single('file'), async (req, res) => {
  try {
    const athleteId = Number(req.params.id);
    if (!qGet('SELECT id FROM athletes WHERE id = ?', [athleteId])) return res.status(404).json({ error: 'athlete not found' });
    if (!req.file) return res.status(400).json({ error: 'file is required' });

    const isImage = req.file.mimetype.startsWith('image/');
    const kind = isImage ? 'photo' : 'video';
    let thumbName: string | null = null;
    let width: number | null = null;
    let height: number | null = null;

    if (isImage) {
      try {
        const meta = await sharp(req.file.path).metadata();
        width = meta.width ?? null;
        height = meta.height ?? null;
        thumbName = `${path.parse(req.file.filename).name}.jpg`;
        await sharp(req.file.path)
          .rotate()
          .resize(640, 640, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 72 })
          .toFile(path.join(THUMB_DIR, thumbName));
      } catch {
        thumbName = null; // non-fatal: keep original, skip thumb
      }
    }

    const capturedAt: string = (req.body?.captured_at as string) || new Date().toISOString().slice(0, 10);
    const info = qRun(
      `INSERT INTO media_assets(athlete_id, kind, file_name, thumb_name, mime, width, height, captured_at, pose_type, division, notes)
       VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [athleteId, kind, req.file.filename, thumbName, req.file.mimetype, width, height, capturedAt, req.body?.pose_type || null, req.body?.division || null, req.body?.notes || null]
    );
    const row = qGet<MediaRow>('SELECT * FROM media_assets WHERE id = ?', [Number(info.lastInsertRowid)])!;
    res.status(201).json(hydrate(row));
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// List an athlete's media (optionally filter by pose / kind).
mediaRouter.get('/athletes/:id/media', (req, res) => {
  const filters: string[] = ['athlete_id = ?'];
  const params: unknown[] = [Number(req.params.id)];
  if (req.query.pose_type) {
    filters.push('pose_type = ?');
    params.push(String(req.query.pose_type));
  }
  if (req.query.kind) {
    filters.push('kind = ?');
    params.push(String(req.query.kind));
  }
  const rows = qAll<MediaRow>(`SELECT * FROM media_assets WHERE ${filters.join(' AND ')} ORDER BY captured_at ASC, id ASC`, params);
  res.json(rows.map(hydrate));
});

// Single media item including its analyses.
mediaRouter.get('/media/:id', (req, res) => {
  const row = qGet<MediaRow>('SELECT * FROM media_assets WHERE id = ?', [Number(req.params.id)]);
  if (!row) return res.status(404).json({ error: 'not found' });
  const analyses = qAll<AnalysisRow>('SELECT * FROM pose_analyses WHERE media_id = ? ORDER BY created_at DESC', [row.id]).map((a) => ({
    ...a,
    metrics: parseJson(a.metrics_json, null),
    landmarks: parseJson(a.landmarks_json, null),
    ai_feedback: parseJson(a.ai_feedback_json, null),
  }));
  res.json({ ...hydrate(row), analyses });
});

mediaRouter.patch('/media/:id', (req, res) => {
  const row = qGet<MediaRow>('SELECT * FROM media_assets WHERE id = ?', [Number(req.params.id)]);
  if (!row) return res.status(404).json({ error: 'not found' });
  const { pose_type, division, captured_at, notes } = req.body ?? {};
  qRun('UPDATE media_assets SET pose_type = ?, division = ?, captured_at = ?, notes = ? WHERE id = ?', [
    pose_type ?? row.pose_type,
    division ?? row.division,
    captured_at ?? row.captured_at,
    notes ?? row.notes,
    row.id,
  ]);
  res.json(hydrate(qGet<MediaRow>('SELECT * FROM media_assets WHERE id = ?', [row.id])!));
});

mediaRouter.delete('/media/:id', (req, res) => {
  const row = qGet<MediaRow>('SELECT * FROM media_assets WHERE id = ?', [Number(req.params.id)]);
  if (!row) return res.status(404).json({ error: 'not found' });
  for (const p of [path.join(MEDIA_DIR, row.file_name), row.thumb_name ? path.join(THUMB_DIR, row.thumb_name) : '']) {
    if (p && fs.existsSync(p)) {
      try {
        fs.unlinkSync(p);
      } catch {
        /* ignore */
      }
    }
  }
  qRun('DELETE FROM media_assets WHERE id = ?', [row.id]);
  res.status(204).end();
});
