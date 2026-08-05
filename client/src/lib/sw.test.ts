// Checks the service worker's fetch routing: what it must never intercept,
// and that navigations fall back to the cached shell offline.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

type Req = { url: string; method?: string; mode?: string };

/** Load sw.js into a fake ServiceWorkerGlobalScope and return its fetch handler. */
function loadSw(fetchImpl: (r: Req) => Promise<unknown>) {
  const src = readFileSync(path.resolve(__dirname, '../../public/sw.js'), 'utf8');
  const handlers: Record<string, (e: any) => void> = {};
  const cache = { match: async () => undefined, put: async () => {}, add: async () => {} };
  const self = {
    location: { origin: 'http://localhost:8787', href: 'http://localhost:8787/sw.js' },
    addEventListener: (t: string, fn: (e: any) => void) => (handlers[t] = fn),
    skipWaiting: () => {},
    clients: { claim: () => {} },
  };
  const caches = { open: async () => cache, keys: async () => [], delete: async () => true, match: async () => 'SHELL' };
  new Function('self', 'caches', 'fetch', 'Response', src)(self, caches, fetchImpl, { error: () => 'ERR' });
  return (request: Req) => {
    let responded: unknown;
    handlers.fetch({ request, respondWith: (p: unknown) => (responded = p) });
    return responded;
  };
}

const ok = async () => ({ ok: true, type: 'basic', clone: () => ({}) });

describe('service worker fetch routing', () => {
  const cases: Array<[string, Req, boolean]> = [
    ['API reads stay live', { url: 'http://localhost:8787/api/athletes' }, false],
    ['POSTs are never intercepted', { url: 'http://localhost:8787/assets/x.js', method: 'POST' }, false],
    ['cross-origin is never intercepted', { url: 'https://api.anthropic.com/v1/messages' }, false],
    ['hashed assets are cached', { url: 'http://localhost:8787/assets/index-abc.js' }, true],
    ['the pose model is cached', { url: 'http://localhost:8787/mediapipe/models/pose_landmarker_lite.task' }, true],
  ];

  for (const [name, req, intercepted] of cases) {
    it(name, () => {
      const sw = loadSw(ok);
      expect(sw({ method: 'GET', ...req }) !== undefined).toBe(intercepted);
    });
  }

  it('serves the cached shell when a navigation fails offline', async () => {
    const sw = loadSw(async () => {
      throw new Error('offline');
    });
    const res = sw({ url: 'http://localhost:8787/compare', method: 'GET', mode: 'navigate' });
    await expect(res as Promise<unknown>).resolves.toBe('SHELL');
  });
});
