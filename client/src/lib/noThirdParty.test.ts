// House standard: no third-party requests. Every origin the app code can reach is listed here with
// its reason; a new one fails this test until someone decides it belongs.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { it, expect } from 'vitest';

const ALLOWED = [
  'https://adervec.github.io', // same origin: font.js, cowork.js, portal links
  'https://github.com', // plain links to DISCLAIMER / PRIVACY, never fetched
  'https://accounts.google.com', // Drive sync sign-in, only after the user presses Sync
  'https://www.googleapis.com', // Drive appDataFolder API, user-initiated sync only
  'http://www.w3.org', // SVG namespace, not a request
];

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(join(dir, e.name)) : /\.(tsx?|html)$/.test(e.name) && !e.name.includes('.test.') ? [join(dir, e.name)] : []
  );
}

it('app code reaches only allowed origins (MediaPipe is self-hosted)', () => {
  const found = new Set<string>();
  for (const f of [...files('src'), 'index.html'])
    for (const m of readFileSync(f, 'utf8').matchAll(/https?:\/\/[a-z0-9.-]+/gi)) found.add(m[0]);
  expect([...found].filter((o) => !ALLOWED.includes(o) && !/localhost|127\.0\.0\.1/.test(o))).toEqual([]);
  expect(readFileSync('src/lib/poseDetect.ts', 'utf8')).toMatch(/BASE_URL\}mediapipe\/wasm/);
});
