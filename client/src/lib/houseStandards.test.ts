import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { lookFor, EXTRA_THEMES } from './theme';
import { APP_KEYS, APP_DBS } from './local/erase';

describe('what’s new', () => {
  it('is declared and well-formed, newest first', () => {
    expect(readFileSync('index.html', 'utf8')).toContain('<meta name="app-whatsnew" content="%BASE_URL%whatsnew.json" />');
    const log = JSON.parse(readFileSync('public/whatsnew.json', 'utf8')) as { date: string; items: string[] }[];
    expect(log.length).toBeGreaterThan(0);
    for (const e of log) {
      expect(e.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(e.items.length).toBeGreaterThan(0);
    }
    const dates = log.map((e) => e.date);
    expect(dates).toEqual([...dates].sort().reverse());
  });
});

describe('themes: the shared base list plus Ink and Marble', () => {
  it('System follows the device in the app’s own dark (Ink) and light (Marble)', () => {
    expect(lookFor('system', true)).toBe('ink');
    expect(lookFor('system', false)).toBe('marble');
  });
  it('a saved choice always wins, whatever the device', () => {
    expect(lookFor('marble', true)).toBe('marble');
    expect(lookFor('ink', false)).toBe('ink');
    expect(lookFor('midnight', false)).toBe('house'); // a base theme wears the shared palette
    expect(lookFor('contrast', true)).toBe('house');
  });
  it('each extra gives font.js all eleven colours as #rrggbb', () => {
    const keys = ['bg', 'surface', 'surface2', 'line', 'text', 'dim', 'accent', 'on-accent', 'good', 'warn', 'bad'];
    for (const x of EXTRA_THEMES) {
      expect(Object.keys(x.colors).sort()).toEqual([...keys].sort());
      for (const v of Object.values(x.colors)) expect(v).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});

describe('data inventory (app-data.json)', () => {
  const inv = JSON.parse(readFileSync('public/app-data.json', 'utf8')) as Record<string, unknown>;
  const covered = (list: string[], name: string) => list.some((p) => p === name || (p.endsWith('*') && name.startsWith(p.slice(0, -1))));
  it('declares every key and database the app erases (house keys are the hub’s)', () => {
    expect(Number.isInteger(inv.schema)).toBe(true);
    for (const k of APP_KEYS.filter((k) => !/^(maker-|portal-|app-|cowork-)/.test(k))) expect(covered(inv.localStorage as string[], k)).toBe(true);
    for (const d of APP_DBS) expect(covered(inv.indexedDB as string[], d)).toBe(true);
  });
});
