/**
 * The Guides page reaches into the guide HTML and fills each plate's photo frame
 * with the athlete's own shot, keyed by `data-figure`. That contract lives across
 * two files nothing else links — so assert it, or a re-exported guide breaks the
 * integration silently.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { findPose } from './poses';

const GUIDE_DIR = path.resolve(__dirname, '../../../Associated Guide');
const guides = {
  men: 'posing-guide.html',
  women: 'posing-guide-women.html',
};

/** Every <article class="plate"> chunk in the document. */
function plates(html: string): string[] {
  return html.split(/<article class="plate">/).slice(1);
}

describe.each(Object.entries(guides))('%s guide', (_name, file) => {
  const html = readFileSync(path.join(GUIDE_DIR, file), 'utf8');

  it('exists and is served as the app expects', () => {
    expect(html).toContain('<article class="plate">');
  });

  it('gives every plate a pose id the app knows', () => {
    const ids = plates(html).map((p) => /data-figure="([^"]+)"/.exec(p)?.[1]);
    expect(ids.length).toBeGreaterThan(3);
    expect(ids.filter((id) => !id || !findPose(id))).toEqual([]);
  });

  it('gives every plate a photo frame to fill', () => {
    expect(plates(html).filter((p) => !p.includes('class="plate-photo"'))).toEqual([]);
  });

  it('positions plate images absolutely, so an injected shot covers the placeholder', () => {
    expect(html).toMatch(/\.plate-photo img\s*{[^}]*position:absolute/);
  });
});
