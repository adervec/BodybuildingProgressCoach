#!/usr/bin/env node
// One-command launcher: `npm start` (production, single process) or `npm start -- --dev`.
// ponytail: node stdlib + npm scripts that already exist — no shell script per OS.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const dev = args.includes('--dev');
const rebuild = args.includes('--rebuild');
// shell:true so `npm` resolves to npm.cmd on Windows; the command is a fixed
// string (no user input) so concatenation is safe and avoids the DEP0190 warning.
const run = (cmdline) =>
  new Promise((resolve, reject) => {
    const p = spawn(cmdline, { cwd: ROOT, stdio: 'inherit', shell: true });
    p.on('error', reject);
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmdline} → exit ${code}`))));
  });

const open = (url) => {
  const [cmd, argv] =
    process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]]
    : process.platform === 'darwin' ? ['open', [url]]
    : ['xdg-open', [url]];
  spawn(cmd, argv, { stdio: 'ignore', detached: true }).on('error', () => {}).unref();
};

if (!existsSync(path.join(ROOT, 'node_modules', '.package-lock.json'))) {
  console.log('→ installing dependencies…');
  await run('npm install');
}

const url = dev ? 'http://localhost:5188' : 'http://localhost:8787';

const built = existsSync(path.join(ROOT, 'client', 'dist', 'index.html')) && existsSync(path.join(ROOT, 'server', 'dist', 'index.js'));
if (!dev && (rebuild || !built)) {
  console.log('→ building…');
  await run('npm run build');
}

console.log(`→ starting ${dev ? 'dev servers' : 'server'} — opening ${url}`);
// The server prints its own banner once listening; 1.5s is enough for the port to bind.
setTimeout(() => open(url), 1500);
await run(dev ? 'npm run dev' : 'npm start -w server');
