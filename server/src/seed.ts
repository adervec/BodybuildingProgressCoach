import { db } from './db.js';

/**
 * Idempotent demo seed: two athletes (one men's bodybuilding → ink/bronze theme,
 * one bikini → marble/gold theme) plus a realistic body-composition series so
 * charts and trends are populated before any photos are uploaded.
 */

function isoWeeksAgo(weeks: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - weeks * 7);
  return d.toISOString().slice(0, 10);
}

function reseedAthlete(name: string, category: string, height: number) {
  db.prepare("DELETE FROM athletes WHERE name = ?").run(name);
  const info = db
    .prepare('INSERT INTO athletes(name, category, height_cm, notes) VALUES(?, ?, ?, ?)')
    .run(name, category, height, 'Demo profile created by the seed script.');
  return Number(info.lastInsertRowid);
}

function seedComp(
  athleteId: number,
  opts: { startWeight: number; endWeight: number; startBf: number; endBf: number; unit: string; weeks: number; base: Record<string, number> }
) {
  const { startWeight, endWeight, startBf, endBf, unit, weeks, base } = opts;
  for (let i = 0; i <= weeks; i++) {
    const t = i / weeks;
    const weight = +(startWeight + (endWeight - startWeight) * t).toFixed(1);
    const bf = +(startBf + (endBf - startBf) * t).toFixed(1);
    const lean = +(weight * (1 - bf / 100)).toFixed(1);
    const wiggle = (k: number) => +(k * (1 - 0.06 * t)).toFixed(1); // tissue tightens slightly over a cut
    const measurements = {
      chest: wiggle(base.chest),
      waist: +(base.waist * (1 - 0.09 * t)).toFixed(1),
      arm_l: wiggle(base.arm),
      arm_r: wiggle(base.arm + 0.3),
      thigh_l: wiggle(base.thigh),
      thigh_r: wiggle(base.thigh),
      calf: wiggle(base.calf),
    };
    db.prepare(
      `INSERT INTO body_comp_entries(athlete_id, measured_at, weight, weight_unit, body_fat_pct, lean_mass, measurements_json, source, notes)
       VALUES(?, ?, ?, ?, ?, ?, ?, 'manual', ?)`
    ).run(athleteId, isoWeeksAgo(weeks - i), weight, unit, bf, lean, JSON.stringify(measurements), i === 0 ? 'Start of prep' : null);
  }
}

const aId = reseedAthlete('Demo: Marcus (Bodybuilding)', 'men_bodybuilding', 178);
seedComp(aId, { startWeight: 98, endWeight: 89, startBf: 16, endBf: 8.5, unit: 'kg', weeks: 12, base: { chest: 122, waist: 86, arm: 44, thigh: 66, calf: 41 } });

const bId = reseedAthlete('Demo: Priya (Bikini)', 'bikini', 165);
seedComp(bId, { startWeight: 61, endWeight: 56, startBf: 24, endBf: 16, unit: 'kg', weeks: 12, base: { chest: 90, waist: 68, arm: 29, thigh: 56, calf: 35 } });

console.log('Seeded demo athletes:');
console.log(`  • Marcus (Bodybuilding)  id=${aId}`);
console.log(`  • Priya (Bikini)         id=${bId}`);
console.log('Open the app, pick a profile, and upload pose photos to see analysis.');
