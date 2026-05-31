import { Router } from 'express';
import { qAll, qGet, qRun, parseJson, type BodyCompRow } from '../db.js';

export const bodyCompRouter = Router();

function hydrate(r: BodyCompRow) {
  return { ...r, measurements: parseJson<Record<string, number>>(r.measurements_json, {}) };
}

bodyCompRouter.get('/athletes/:id/bodycomp', (req, res) => {
  const rows = qAll<BodyCompRow>('SELECT * FROM body_comp_entries WHERE athlete_id = ? ORDER BY measured_at ASC, id ASC', [Number(req.params.id)]);
  res.json(rows.map(hydrate));
});

bodyCompRouter.post('/athletes/:id/bodycomp', (req, res) => {
  const athleteId = Number(req.params.id);
  if (!qGet('SELECT id FROM athletes WHERE id = ?', [athleteId])) return res.status(404).json({ error: 'athlete not found' });

  const { measured_at, weight, weight_unit, body_fat_pct, lean_mass, measurements, source, notes } = req.body ?? {};
  if (!measured_at) return res.status(400).json({ error: 'measured_at is required' });

  const info = qRun(
    `INSERT INTO body_comp_entries(athlete_id, measured_at, weight, weight_unit, body_fat_pct, lean_mass, measurements_json, source, notes)
     VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [athleteId, measured_at, weight ?? null, weight_unit || 'kg', body_fat_pct ?? null, lean_mass ?? null, measurements ? JSON.stringify(measurements) : null, source === 'scale' ? 'scale' : 'manual', notes ?? null]
  );
  res.status(201).json(hydrate(qGet<BodyCompRow>('SELECT * FROM body_comp_entries WHERE id = ?', [Number(info.lastInsertRowid)])!));
});

bodyCompRouter.patch('/bodycomp/:id', (req, res) => {
  const row = qGet<BodyCompRow>('SELECT * FROM body_comp_entries WHERE id = ?', [Number(req.params.id)]);
  if (!row) return res.status(404).json({ error: 'not found' });
  const { measured_at, weight, weight_unit, body_fat_pct, lean_mass, measurements, notes } = req.body ?? {};
  qRun(
    `UPDATE body_comp_entries SET measured_at = ?, weight = ?, weight_unit = ?, body_fat_pct = ?, lean_mass = ?, measurements_json = ?, notes = ? WHERE id = ?`,
    [
      measured_at ?? row.measured_at,
      weight ?? row.weight,
      weight_unit ?? row.weight_unit,
      body_fat_pct ?? row.body_fat_pct,
      lean_mass ?? row.lean_mass,
      measurements ? JSON.stringify(measurements) : row.measurements_json,
      notes ?? row.notes,
      row.id,
    ]
  );
  res.json(hydrate(qGet<BodyCompRow>('SELECT * FROM body_comp_entries WHERE id = ?', [row.id])!));
});

bodyCompRouter.delete('/bodycomp/:id', (req, res) => {
  qRun('DELETE FROM body_comp_entries WHERE id = ?', [Number(req.params.id)]);
  res.status(204).end();
});
