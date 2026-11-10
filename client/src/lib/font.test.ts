// House font standard: the page loads the shared font.js, body text follows --app-font,
// and the Dashboard offers the picker. (Static check — jsdom does not compute fonts.)
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

test('Atkinson Hyperlegible is the default body font and the reader can change it', () => {
  expect(readFileSync('index.html', 'utf8')).toContain('<script src="https://adervec.github.io/font.js"></script>');
  expect(readFileSync('src/styles/theme.css', 'utf8')).toMatch(/--serif:\s*var\(--app-font,/);
  expect(readFileSync('src/pages/Dashboard.tsx', 'utf8')).toContain("createElement('app-font-picker')");
});
