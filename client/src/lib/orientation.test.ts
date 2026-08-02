import { describe, it, expect, vi } from 'vitest';
import { applyOrientation, savedOrientation, saveOrientation } from './orientation';

const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
});

function stubOrientation(orientation: object | undefined) {
  vi.stubGlobal('screen', orientation === undefined ? {} : { orientation });
}

describe('applyOrientation', () => {
  it.each(['portrait', 'landscape'] as const)('locks %s', async (mode) => {
    const lock = vi.fn().mockResolvedValue(undefined);
    stubOrientation({ lock });
    expect(await applyOrientation(mode)).toBe(true);
    expect(lock).toHaveBeenCalledWith(mode);
  });

  it('auto unlocks instead of locking', async () => {
    const lock = vi.fn();
    const unlock = vi.fn();
    stubOrientation({ lock, unlock });
    expect(await applyOrientation('auto')).toBe(true);
    expect(unlock).toHaveBeenCalled();
    expect(lock).not.toHaveBeenCalled();
  });

  it('reports false when the browser refuses (iOS, desktop tab)', async () => {
    stubOrientation({ lock: vi.fn().mockRejectedValue(new Error('NotSupportedError')) });
    expect(await applyOrientation('portrait')).toBe(false);
  });

  it('reports false when lock() does not exist', async () => {
    stubOrientation(undefined);
    expect(await applyOrientation('landscape')).toBe(false);
  });
});

describe('saved preference', () => {
  it('defaults to portrait, ignores garbage, round-trips', () => {
    store.clear();
    expect(savedOrientation()).toBe('portrait');
    store.set('ls.orientation', 'sideways');
    expect(savedOrientation()).toBe('portrait');
    saveOrientation('landscape');
    expect(savedOrientation()).toBe('landscape');
  });
});
