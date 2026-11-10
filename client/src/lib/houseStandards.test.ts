import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { pageTheme } from './poses';

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

describe('default theme follows the device', () => {
  it('uses the device setting when no athlete is chosen', () => {
    expect(pageTheme(null, true)).toBe('ink');
    expect(pageTheme(null, false)).toBe('marble');
  });
  it('a chosen athlete always wins', () => {
    expect(pageTheme('bikini', true)).toBe('marble');
    expect(pageTheme('men_bodybuilding', false)).toBe('ink');
  });
});
