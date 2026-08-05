// Post-build fixups that apply only to the static (GitHub Pages) variant. No-op otherwise, so the
// self-hosted build is untouched.
//
// The manifest is committed with the self-hosted app's clean-URL shortcuts (./capture). The Pages
// build routes on the hash, because Pages has no SPA rewrite — so its shortcuts need ./#/capture.
// Rewriting the emitted copy keeps one committed manifest instead of two.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.env.VITE_STATIC !== '1') process.exit(0);

const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
const manifestPath = path.join(dist, 'manifest.webmanifest');
if (!fs.existsSync(manifestPath)) {
  console.error('[static] manifest.webmanifest missing from dist');
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
manifest.shortcuts = (manifest.shortcuts ?? []).map((s) => ({ ...s, url: s.url.replace(/^\.\//, './#/') }));
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`[static] rewrote ${manifest.shortcuts.length} manifest shortcut(s) for hash routing`);
