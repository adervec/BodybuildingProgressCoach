# Living Sculpture — Bodybuilding Progress Coach

An honest, fair tracker for bodybuilding progress from your **photos and video** — covering
both **physique** and **posing technique**, corroborated by **body-composition** data, with
**progress timelapses**. The interface and the analysis rubric are both drawn directly from the
two included posing guides (*The Sandow Plates* for men, *The Atalanta Plates* for women).

> Muscle is built in the gym. The champion is built on the stage.

---

## Why "honest & fair"?

Most progress apps flatter you. This one leads with **reproducible numbers**, then offers optional
opinion:

- **Objective geometry first.** From the body landmarks detected in your own photo we compute
  left/right **symmetry**, scale-normalized **proportions** (shoulder:waist V-taper, etc.), and a
  **reference-form match** against the guides' ideal joint angles. Distances are normalized by
  torso length, so moving the camera closer or further can't fake progress.
- **The same rubric every time.** Scores are judged against the exact criteria printed in the
  posing guides — the same text the app shows you and the same text the AI coach is told to use.
- **Confidence flags.** Low landmark visibility (bad lighting/framing) is surfaced, and poses that
  can't be scored fairly by geometry (side / S-curve poses) are *not* given a fake number.
- **Optional AI, clearly labelled.** A written critique from Claude is available only if you add an
  API key, and the UI tells you plainly that the photo is sent to Anthropic for that one request.
- **Responsible by design.** Photos stay on your machine for the local analysis. The coach is
  constrained to posing/conditioning/stagecraft — never diet, calorie, weight-loss, or medical
  prescriptions, and never body-shaming.

---

## Quick start

```bash
npm install          # installs both workspaces
npm run seed         # optional: creates two demo athletes with body-comp history
npm run dev          # client on http://localhost:5188, API on http://localhost:8787
```

Open **http://localhost:5188**, pick (or create) an athlete, and start uploading pose photos.

### Optional: enable AI coaching

```bash
cp server/.env.example server/.env
# then set ANTHROPIC_API_KEY=... in server/.env and restart
```

Without a key the app is fully functional — only the written AI critique is disabled (the local
geometry analysis is always on and fully private).

### Production (single process)

```bash
npm run build -w client     # outputs client/dist
npm run dev:server          # the API server also serves the built client at http://localhost:8787
```

---

## What's inside

| Page | What it does |
|------|--------------|
| **Athletes** | Local profiles (no login). Category sets the theme + which guide's poses apply. |
| **Dashboard** | Latest body-comp KPIs + trend chart, per-pose readiness, "focus next", recent captures. |
| **Capture** | Upload photos/videos, tag pose + date; grab analyzable frames from videos. |
| **Pose Studio** | Ideal-form diagram + your detected-landmark overlay, objective score breakdown, optional AI coaching, per-pose history. |
| **Physique** | Log weight / body-fat / measurements (manual now; schema is smart-scale ready). Charts + history. |
| **Compare** | Two dates of one pose, side by side, with metric deltas. |
| **Timelapse** | Body-aligned, honest progress timelapse; in-app player + `.webm` export. |
| **Guides** | The two original posing guides, embedded for reference. |

## Architecture

- **client/** — React + Vite + TypeScript SPA. Two CSS-variable themes (**ink/bronze** for men's,
  **marble/gold** for women's) ported verbatim from the guides; the active theme follows the
  athlete's category. Pose detection runs **in the browser** via MediaPipe Tasks Vision
  (`@mediapipe/tasks-vision`); scoring math lives in `src/lib/geometry.ts` (unit-tested).
- **server/** — Express + TypeScript API using Node's built-in `node:sqlite` (no native build
  step). Media is stored on disk under `server/data/`; thumbnails via `sharp`. Optional Claude
  vision coaching (`server/src/ai.ts`) with prompt caching on the rubric.
- **Associated Guide/** — the original HTML guides, served read-only at `/guides`.

### Guide integration (both senses)

1. **Visual** — colors, fonts (Bodoni Moda / Spectral / DM Mono), film-grain/marble overlays, and
   the plate aesthetic are ported into the app's design system.
2. **Analytical** — the guides' per-pose judging criteria become the scoring rubric, and the ideal
   joint angles encoded in each guide's figure renderer become the "reference-form" target. The
   guides' SVG mannequin renderers are reused as the in-app ideal-form diagrams.

## Scripts

```bash
npm run dev          # run client + API together
npm run build        # typecheck + build both workspaces
npm run typecheck    # tsc on both workspaces
npm run test         # geometry unit tests (vitest)
npm run seed         # demo data
```

## Notes & roadmap

- **MediaPipe model** is fetched once from a CDN on first analysis, then browser-cached. Inference
  runs locally; photos are not uploaded for geometry analysis. (Vendor the model into `public/`
  for fully offline first-run.)
- **Reference-form angles are stylized** (drawn to teach shape), so that sub-score is directional;
  symmetry and proportions are the camera-robust headline metrics.
- **Later:** smart-scale / Bluetooth import (schema already supports `source='scale'`), full video
  *motion* analysis (transition smoothness/timing) beyond key-frame sampling, and code-splitting
  the MediaPipe bundle.

## Tech

React 18 · Vite 5 · React Router · Recharts · MediaPipe Tasks Vision · Express 4 · node:sqlite ·
sharp · @anthropic-ai/sdk · TypeScript · Vitest.
