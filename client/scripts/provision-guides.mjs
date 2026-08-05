// The posing guides are served by the Express server at /guides in the self-hosted build. The
// static build has no server, so copy them into the client's own public/ instead. Generated, not
// committed (they live in "Associated Guide/" — one copy, one source of truth).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(here, '../../Associated Guide');
const DEST = path.resolve(here, '../public/guides');

if (!fs.existsSync(SRC)) {
  console.error(`[guides] source missing: ${SRC}`);
  process.exit(1);
}

fs.mkdirSync(DEST, { recursive: true });
let copied = 0;
for (const entry of fs.readdirSync(SRC, { withFileTypes: true })) {
  if (!entry.isFile()) continue;
  const from = path.join(SRC, entry.name);
  const to = path.join(DEST, entry.name);
  // Skip unchanged files so repeat builds stay quiet and fast.
  if (fs.existsSync(to) && fs.statSync(to).size === fs.statSync(from).size && fs.readFileSync(to).equals(fs.readFileSync(from))) continue;
  fs.copyFileSync(from, to);
  copied++;
}
console.log(copied ? `[guides] copied ${copied} file(s) into client/public/guides` : '[guides] up to date');
