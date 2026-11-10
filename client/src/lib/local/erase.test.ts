import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';

const ls = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => ls.get(k) ?? null,
  setItem: (k: string, v: string) => void ls.set(k, String(v)),
  removeItem: (k: string) => void ls.delete(k),
  clear: () => { throw new Error('never clear the shared origin'); },
});

const { eraseEverything, APP_KEYS } = await import('./erase');
const { tx, put, getAll } = await import('./store');

describe('erase everything', () => {
  it('removes only this app’s data and leaves other apps alone', async () => {
    for (const k of APP_KEYS) ls.set(k, 'x');
    ls.set('gymtracker.data', 'keep');
    ls.set('portal-installed', JSON.stringify({ BodybuildingProgressCoach: 1, GymTracker: 2 }));
    ls.set('portal-activity', JSON.stringify([[1, 'BodybuildingProgressCoach', 'checkin', 1], [2, 'GymTracker', 'set', 1]]));
    await tx('athletes', 'readwrite', (t) => put(t, 'athletes', { name: 'Ada' }));

    await eraseEverything();

    for (const k of APP_KEYS) expect(ls.has(k)).toBe(false);
    expect(ls.get('gymtracker.data')).toBe('keep');
    expect(JSON.parse(ls.get('portal-installed')!)).toEqual({ GymTracker: 2 });
    expect(JSON.parse(ls.get('portal-activity')!)).toEqual([[2, 'GymTracker', 'set', 1]]);
    // The database was deleted, and reopens empty.
    expect(await tx('athletes', 'readonly', (t) => getAll(t, 'athletes'))).toEqual([]);
  });
});
