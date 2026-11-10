// House standard: a calendar day is the user's LOCAL day. 22:30 in São Paulo (UTC-3) is 01:30 UTC
// the next day — the UTC slice would file the photo under tomorrow. TZ must be set before any Date use.
process.env.TZ = 'America/Sao_Paulo';

import 'fake-indexeddb/auto';
import { describe, it, expect, vi, afterAll } from 'vitest';

const { todayISO } = await import('./format');
const { importBundle, BACKUP_APP } = await import('./local/backup');
const { tx, getAll } = await import('./local/store');

describe('local calendar day', () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 2, 14, 22, 30)); // 14 Mar 2026, 22:30 local
  afterAll(() => { vi.useRealTimers(); });

  it('runs in the intended zone', () => {
    expect(new Date().toISOString().slice(0, 10)).toBe('2026-03-15'); // UTC already rolled over
  });

  it('today is the local date', () => {
    expect(todayISO()).toBe('2026-03-14');
  });

  it('default capture date is the local date', async () => {
    await importBundle({
      app: BACKUP_APP, version: 1,
      athletes: [{ name: 'Ada', media: [{ file_name: '13985898-2ed3-48c6-8557-684228573aca.jpg' }] }],
    });
    const media = await tx('media', 'readonly', (t) => getAll<{ captured_at: string }>(t, 'media'));
    expect(media[0].captured_at).toBe('2026-03-14');
  });
});
