import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { SERVER_ROOT, MEDIA_DIR, THUMB_DIR } from './db.js';
import { athletesRouter } from './routes/athletes.js';
import { mediaRouter } from './routes/media.js';
import { analysisRouter } from './routes/analysis.js';
import { bodyCompRouter } from './routes/bodycomp.js';
import { isAiEnabled } from './ai.js';

const app = express();
// Use a dedicated API port. NB: we intentionally ignore process.env.PORT because
// some dev tooling injects PORT for the *client* dev server; the API must stay on
// its own port (the Vite proxy targets 8787).
const PORT = Number(process.env.API_PORT) || 8787;

app.use(cors());
app.use(express.json({ limit: '2mb' }));

// Static media + the original style guides (read-only reference).
app.use('/media', express.static(MEDIA_DIR));
app.use('/thumbs', express.static(THUMB_DIR));
app.use('/guides', express.static(path.resolve(SERVER_ROOT, '..', 'Associated Guide')));

app.get('/api/status', (_req, res) => {
  res.json({ ok: true, ai: { enabled: isAiEnabled(), model: process.env.AI_MODEL || 'claude-opus-4-8' } });
});

app.use('/api/athletes', athletesRouter);
app.use('/api', mediaRouter);
app.use('/api', analysisRouter);
app.use('/api', bodyCompRouter);

// Single-server / production mode: serve the built client if it exists.
const CLIENT_DIST = path.resolve(SERVER_ROOT, '..', 'client', 'dist');
if (fs.existsSync(path.join(CLIENT_DIST, 'index.html'))) {
  app.use(express.static(CLIENT_DIST));
  app.get(/^\/(?!api|media|thumbs|guides)(.*)/, (_req, res) => res.sendFile(path.join(CLIENT_DIST, 'index.html')));
  console.log('  Serving built client from client/dist');
}

// JSON error handler (multer + thrown sync errors land here).
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[api error]', err.message);
  res.status(500).json({ error: err.message || 'Internal error' });
});

app.listen(PORT, () => {
  console.log(`\n  Bodybuilding Progress Coach API → http://localhost:${PORT}`);
  console.log(`  AI coaching: ${isAiEnabled() ? 'ENABLED' : 'disabled (set ANTHROPIC_API_KEY to enable)'}\n`);
});
