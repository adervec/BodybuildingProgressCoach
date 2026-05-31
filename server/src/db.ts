import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Server package root (…/server). All app data lives under server/data. */
export const SERVER_ROOT = path.resolve(__dirname, '..');
export const DATA_DIR = path.join(SERVER_ROOT, 'data');
export const MEDIA_DIR = path.join(DATA_DIR, 'media');
export const THUMB_DIR = path.join(DATA_DIR, 'thumbs');
const DB_PATH = path.join(DATA_DIR, 'app.db');

for (const dir of [DATA_DIR, MEDIA_DIR, THUMB_DIR]) {
  fs.mkdirSync(dir, { recursive: true });
}

export const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS athletes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  category    TEXT NOT NULL DEFAULT 'men_bodybuilding',
  height_cm   REAL,
  notes       TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS media_assets (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  athlete_id   INTEGER NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL,                 -- 'photo' | 'video'
  file_name    TEXT NOT NULL,
  thumb_name   TEXT,
  mime         TEXT,
  width        INTEGER,
  height       INTEGER,
  captured_at  TEXT NOT NULL,                 -- ISO date the shot was taken
  pose_type    TEXT,                          -- e.g. 'fdb', 'bikiniFront'
  division     TEXT,                          -- e.g. 'men_bodybuilding'
  notes        TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pose_analyses (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  media_id        INTEGER NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
  athlete_id      INTEGER NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  source          TEXT NOT NULL,              -- 'geometry' | 'ai' | 'manual'
  pose_type       TEXT,
  form_score      REAL,
  symmetry_score  REAL,
  ref_match_score REAL,
  confidence      REAL,
  metrics_json    TEXT,
  landmarks_json  TEXT,
  ai_feedback_json TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS body_comp_entries (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  athlete_id        INTEGER NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  measured_at       TEXT NOT NULL,
  weight            REAL,
  weight_unit       TEXT DEFAULT 'kg',
  body_fat_pct      REAL,
  lean_mass         REAL,
  measurements_json TEXT,                     -- {chest, waist, arm_l, arm_r, thigh_l, ...}
  source            TEXT NOT NULL DEFAULT 'manual', -- 'manual' | 'scale'
  notes             TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

CREATE INDEX IF NOT EXISTS idx_media_athlete ON media_assets(athlete_id, captured_at);
CREATE INDEX IF NOT EXISTS idx_media_pose ON media_assets(athlete_id, pose_type, captured_at);
CREATE INDEX IF NOT EXISTS idx_analyses_media ON pose_analyses(media_id);
CREATE INDEX IF NOT EXISTS idx_bodycomp_athlete ON body_comp_entries(athlete_id, measured_at);
`);

export interface AthleteRow {
  id: number;
  name: string;
  category: string;
  height_cm: number | null;
  notes: string | null;
  created_at: string;
}

export interface MediaRow {
  id: number;
  athlete_id: number;
  kind: string;
  file_name: string;
  thumb_name: string | null;
  mime: string | null;
  width: number | null;
  height: number | null;
  captured_at: string;
  pose_type: string | null;
  division: string | null;
  notes: string | null;
  created_at: string;
}

export interface AnalysisRow {
  id: number;
  media_id: number;
  athlete_id: number;
  source: string;
  pose_type: string | null;
  form_score: number | null;
  symmetry_score: number | null;
  ref_match_score: number | null;
  confidence: number | null;
  metrics_json: string | null;
  landmarks_json: string | null;
  ai_feedback_json: string | null;
  created_at: string;
}

export interface BodyCompRow {
  id: number;
  athlete_id: number;
  measured_at: string;
  weight: number | null;
  weight_unit: string | null;
  body_fat_pct: number | null;
  lean_mass: number | null;
  measurements_json: string | null;
  source: string;
  notes: string | null;
  created_at: string;
}

/** Safe JSON parse for *_json columns. */
export function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

/**
 * Typed query helpers. node:sqlite's get/all return Record<string, SQLOutputValue>,
 * so we centralize the cast-through-unknown here instead of at every call site.
 */
type SqlParams = unknown[];

export function qAll<T>(sql: string, params: SqlParams = []): T[] {
  return db.prepare(sql).all(...(params as never[])) as unknown as T[];
}

export function qGet<T>(sql: string, params: SqlParams = []): T | undefined {
  return db.prepare(sql).get(...(params as never[])) as unknown as T | undefined;
}

export function qRun(sql: string, params: SqlParams = []): { changes: number | bigint; lastInsertRowid: number | bigint } {
  return db.prepare(sql).run(...(params as never[]));
}

export function getSetting(key: string): string | null {
  return qGet<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key])?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  qRun('INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [key, value]);
}
