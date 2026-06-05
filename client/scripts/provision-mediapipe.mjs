/**
 * Provision self-hosted MediaPipe assets so the app makes ZERO third-party calls.
 *
 *   - WASM runtime: copied from the installed @mediapipe/tasks-vision package
 *     (hermetic — no network, version always matches the JS API).
 *   - Pose model: downloaded once from Google (network needed only the first time).
 *
 * Output lands in client/public/mediapipe/ (git-ignored); Vite copies it into dist
 * at build, and the server serves it from the same origin at runtime.
 *
 * Runs automatically via the client's "predev" / "prebuild" npm hooks.
 */
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const here = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(here, '..');
const outWasm = path.join(clientRoot, 'public', 'mediapipe', 'wasm');
const outModels = path.join(clientRoot, 'public', 'mediapipe', 'models');

// SIMD + no-SIMD loaders/binaries — FilesetResolver picks the right pair per browser.
const WASM_FILES = [
  'vision_wasm_internal.js',
  'vision_wasm_internal.wasm',
  'vision_wasm_nosimd_internal.js',
  'vision_wasm_nosimd_internal.wasm',
];
const MODEL_NAME = 'pose_landmarker_lite.task';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
const MODEL_BYTES = 5777746;

const log = (m) => console.log(`[mediapipe] ${m}`);

// 1) Copy the WASM runtime from the installed package (no network).
// Walk up looking for the (possibly hoisted) node_modules/@mediapipe/tasks-vision/wasm.
function findWasmDir(startDir) {
  let dir = startDir;
  for (let i = 0; i < 8; i++) {
    const cand = path.join(dir, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
    if (fs.existsSync(cand)) return cand;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}
const wasmSrcDir = findWasmDir(clientRoot);
if (!wasmSrcDir) {
  console.error('[mediapipe] could not locate @mediapipe/tasks-vision/wasm — run npm install first.');
  process.exit(1);
}
fs.mkdirSync(outWasm, { recursive: true });
let copied = 0;
for (const f of WASM_FILES) {
  const src = path.join(wasmSrcDir, f);
  if (!fs.existsSync(src)) {
    console.error(`[mediapipe] missing ${f} in ${wasmSrcDir} — is @mediapipe/tasks-vision installed?`);
    process.exit(1);
  }
  const dst = path.join(outWasm, f);
  const size = fs.statSync(src).size;
  if (fs.existsSync(dst) && fs.statSync(dst).size === size) continue;
  fs.copyFileSync(src, dst);
  copied++;
}
log(copied ? `copied ${copied} WASM file(s) → public/mediapipe/wasm` : 'WASM runtime up to date');

// 2) Download the pose model once.
fs.mkdirSync(outModels, { recursive: true });
const modelPath = path.join(outModels, MODEL_NAME);
if (fs.existsSync(modelPath) && fs.statSync(modelPath).size === MODEL_BYTES) {
  log('pose model up to date');
} else {
  log(`downloading pose model (${(MODEL_BYTES / 1048576).toFixed(1)} MB)…`);
  const res = await fetch(MODEL_URL);
  if (!res.ok) {
    console.error(`[mediapipe] model download failed: HTTP ${res.status}. Network is required for the first build.`);
    process.exit(1);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(modelPath, buf);
  log(`saved ${MODEL_NAME} (${(buf.length / 1048576).toFixed(1)} MB)`);
}
