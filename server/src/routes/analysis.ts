import { Router } from 'express';
import sharp from 'sharp';
import path from 'node:path';
import { qAll, qGet, qRun, MEDIA_DIR, parseJson, type MediaRow, type AnalysisRow } from '../db.js';
import { analyzePhoto, isAiEnabled } from '../ai.js';

export const analysisRouter = Router();

// Store an objective geometry analysis computed client-side (MediaPipe).
analysisRouter.post('/media/:id/analysis/geometry', (req, res) => {
  const media = qGet<MediaRow>('SELECT * FROM media_assets WHERE id = ?', [Number(req.params.id)]);
  if (!media) return res.status(404).json({ error: 'media not found' });

  const { pose_type, form_score, symmetry_score, ref_match_score, confidence, metrics, landmarks } = req.body ?? {};

  // Replace prior geometry rows for this media with the freshest analysis.
  qRun("DELETE FROM pose_analyses WHERE media_id = ? AND source = 'geometry'", [media.id]);
  const info = qRun(
    `INSERT INTO pose_analyses(media_id, athlete_id, source, pose_type, form_score, symmetry_score, ref_match_score, confidence, metrics_json, landmarks_json)
     VALUES(?, ?, 'geometry', ?, ?, ?, ?, ?, ?, ?)`,
    [
      media.id,
      media.athlete_id,
      pose_type ?? media.pose_type ?? null,
      form_score ?? null,
      symmetry_score ?? null,
      ref_match_score ?? null,
      confidence ?? null,
      metrics ? JSON.stringify(metrics) : null,
      landmarks ? JSON.stringify(landmarks) : null,
    ]
  );
  res.status(201).json(qGet<AnalysisRow>('SELECT * FROM pose_analyses WHERE id = ?', [Number(info.lastInsertRowid)]));
});

// AI status (so the UI can show enabled/disabled clearly).
analysisRouter.get('/ai/status', (_req, res) => {
  res.json({ enabled: isAiEnabled(), model: process.env.AI_MODEL || 'claude-opus-4-8' });
});

// Optional Claude-vision coaching for one photo.
analysisRouter.post('/media/:id/analysis/ai', async (req, res) => {
  try {
    if (!isAiEnabled()) {
      return res.status(503).json({ error: 'AI coaching is disabled. Add ANTHROPIC_API_KEY to server/.env to enable it.' });
    }
    const media = qGet<MediaRow>('SELECT * FROM media_assets WHERE id = ?', [Number(req.params.id)]);
    if (!media) return res.status(404).json({ error: 'media not found' });
    if (media.kind !== 'photo') {
      return res.status(400).json({ error: 'AI coaching runs on photos. Capture a frame from the video first.' });
    }

    const buf = await sharp(path.join(MEDIA_DIR, media.file_name))
      .rotate()
      .resize(1568, 1568, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();

    const result = await analyzePhoto({
      imageBase64: buf.toString('base64'),
      mediaType: 'image/jpeg',
      poseId: req.body?.pose_type ?? media.pose_type,
      division: req.body?.division ?? media.division,
      objectiveMetrics: req.body?.objectiveMetrics ?? null,
    });

    const info = qRun(
      `INSERT INTO pose_analyses(media_id, athlete_id, source, pose_type, confidence, ai_feedback_json)
       VALUES(?, ?, 'ai', ?, ?, ?)`,
      [media.id, media.athlete_id, media.pose_type ?? null, result.confidence ?? null, JSON.stringify(result)]
    );
    res.status(201).json({ id: Number(info.lastInsertRowid), ai_feedback: result });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Progress series: latest geometry analysis per dated photo for a pose.
analysisRouter.get('/athletes/:id/analyses', (req, res) => {
  const params: unknown[] = [Number(req.params.id)];
  let poseClause = '';
  if (req.query.pose_type) {
    poseClause = 'AND m.pose_type = ?';
    params.push(String(req.query.pose_type));
  }
  const rows = qAll<AnalysisRow & { captured_at: string; media_pose: string | null; thumb_name: string | null; file_name: string; kind: string }>(
    `SELECT pa.*, m.captured_at, m.pose_type AS media_pose, m.thumb_name, m.file_name, m.kind
     FROM pose_analyses pa
     JOIN media_assets m ON m.id = pa.media_id
     WHERE pa.athlete_id = ? AND pa.source = 'geometry' ${poseClause}
     ORDER BY m.captured_at ASC, pa.id ASC`,
    params
  );
  res.json(
    rows.map((r) => ({
      ...r,
      metrics: parseJson(r.metrics_json, null),
      landmarks: parseJson(r.landmarks_json, null),
      thumb_url: r.thumb_name ? `/thumbs/${r.thumb_name}` : null,
      url: `/media/${r.file_name}`,
    }))
  );
});
