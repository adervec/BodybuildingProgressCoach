import { describe, it, expect, vi } from 'vitest';

const ls = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => ls.get(k) ?? null,
  setItem: (k: string, v: string) => void ls.set(k, String(v)),
  removeItem: (k: string) => void ls.delete(k),
});
const { coachChannel, COACH_REPLY_KEY } = await import('./coachChannel');

describe('cowork v2 coach channel', () => {
  it('previews the advice as text, applies it, and undoes back to the old advice', () => {
    ls.set(COACH_REPLY_KEY, 'old advice');
    let shown = '';
    const ch = coachChannel((t) => { shown = t; });

    const [item] = ch.preview({ requestHash: 'abc', reply: 'x'.repeat(500) });
    expect(item).toMatchObject({ id: 'reply', label: expect.stringContaining('replaces') });
    expect(item.detail).toBe('x'.repeat(400));

    const res = ch.apply({ requestHash: 'abc', reply: 'Bring up the rear delts.' });
    expect(shown).toBe('Bring up the rear delts.');
    expect(ls.get(COACH_REPLY_KEY)).toBe('Bring up the rear delts.');
    expect(JSON.parse(JSON.stringify(res.undo))).toEqual({ prev: 'old advice' }); // undo data must be JSON

    ch.undo(res.undo);
    expect(shown).toBe('old advice');
    expect(ls.get(COACH_REPLY_KEY)).toBe('old advice');
  });
});
