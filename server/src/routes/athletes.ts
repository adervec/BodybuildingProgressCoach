import { Router } from 'express';
import { qAll, qGet, qRun, type AthleteRow } from '../db.js';

export const athletesRouter = Router();

const VALID_CATEGORIES = new Set([
  'men_bodybuilding',
  'classic_physique',
  'mens_physique',
  'bikini',
  'wellness',
  'figure',
  'womens_physique',
  'womens_bodybuilding',
]);

athletesRouter.get('/', (_req, res) => {
  const rows = qAll(
    `SELECT a.*,
      (SELECT COUNT(*) FROM media_assets m WHERE m.athlete_id = a.id) AS media_count,
      (SELECT COUNT(*) FROM body_comp_entries b WHERE b.athlete_id = a.id) AS comp_count,
      (SELECT m.thumb_name FROM media_assets m WHERE m.athlete_id = a.id AND m.thumb_name IS NOT NULL
         ORDER BY m.captured_at DESC LIMIT 1) AS latest_thumb
     FROM athletes a ORDER BY a.created_at DESC`
  );
  res.json(rows);
});

athletesRouter.post('/', (req, res) => {
  const { name, category, height_cm, notes } = req.body ?? {};
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }
  const cat = VALID_CATEGORIES.has(category) ? category : 'men_bodybuilding';
  const info = qRun('INSERT INTO athletes(name, category, height_cm, notes) VALUES(?, ?, ?, ?)', [name.trim(), cat, height_cm ?? null, notes ?? null]);
  res.status(201).json(qGet<AthleteRow>('SELECT * FROM athletes WHERE id = ?', [Number(info.lastInsertRowid)]));
});

athletesRouter.get('/:id', (req, res) => {
  const row = qGet<AthleteRow>('SELECT * FROM athletes WHERE id = ?', [Number(req.params.id)]);
  if (!row) return res.status(404).json({ error: 'not found' });
  res.json(row);
});

athletesRouter.patch('/:id', (req, res) => {
  const existing = qGet<AthleteRow>('SELECT * FROM athletes WHERE id = ?', [Number(req.params.id)]);
  if (!existing) return res.status(404).json({ error: 'not found' });
  const { name, category, height_cm, notes } = req.body ?? {};
  qRun('UPDATE athletes SET name = ?, category = ?, height_cm = ?, notes = ? WHERE id = ?', [
    name?.trim() || existing.name,
    VALID_CATEGORIES.has(category) ? category : existing.category,
    height_cm ?? existing.height_cm,
    notes ?? existing.notes,
    existing.id,
  ]);
  res.json(qGet<AthleteRow>('SELECT * FROM athletes WHERE id = ?', [existing.id]));
});

athletesRouter.delete('/:id', (req, res) => {
  qRun('DELETE FROM athletes WHERE id = ?', [Number(req.params.id)]);
  res.status(204).end();
});
