# Living Sculpture — Bodybuilding Progress Coach

[![CI](https://github.com/adervec/BodybuildingProgressCoach/actions/workflows/ci.yml/badge.svg)](https://github.com/adervec/BodybuildingProgressCoach/actions/workflows/ci.yml)
[![Publish Docker image](https://github.com/adervec/BodybuildingProgressCoach/actions/workflows/docker-publish.yml/badge.svg)](https://github.com/adervec/BodybuildingProgressCoach/actions/workflows/docker-publish.yml)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./LICENSE)

An honest, fair tracker for bodybuilding progress from your **photos and video** — covering
both **physique** and **posing technique**, corroborated by **body-composition** data, with
**progress timelapses**. The interface and the analysis rubric are both drawn directly from the
two included posing guides (*The Sandow Plates* for men, *The Atalanta Plates* for women).

> Muscle is built in the gym. The champion is built on the stage.

> **Heads-up:** This is a software project — **not** medical, coaching, or legal advice,
> and not a substitute for a doctor, certified coach, or lawyer. It's provided "as is"
> for informational use. See **[DISCLAIMER.md](./DISCLAIMER.md)** and **[PRIVACY.md](./PRIVACY.md)**.

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
npm start            # installs + builds if needed, serves on :8787, opens your browser
```

That's the whole thing. Variants:

```bash
npm start -- --dev       # dev servers instead (client :5188, API :8787, hot reload)
npm start -- --rebuild   # force a fresh build first
npm run seed             # optional: two demo athletes with body-comp history
```

Pick (or create) an athlete, and start uploading pose photos.

### Adding photos

Drag photos or video anywhere onto the **Capture** page — or onto a specific plate in **Guides**
to file them under that pose in one motion. Each photo is dated from its own **EXIF capture
time**, not the day you copied it off your phone, so trend lines stay honest; the app tells you
when it had to fall back to the file's timestamp.

### Install it as an app

The client is a PWA: open it and use your browser's **Install** button (Chrome/Edge address bar,
or *Share → Add to Home Screen* on iOS). It then launches in its own window, works offline for
everything already loaded — the UI, the guides, the on-device pose model — and only needs the
server running for reading and writing your data.

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

### Production with Docker

The repo ships a multi-stage `Dockerfile` that builds both workspaces and runs the single
production process (API + built client + guides). Images are published to GHCR on every push to
`main` (see [CI/CD](#continuous-integration--deployment)).

```bash
# Pull the published image (or `docker build -t bpc .` to build locally)
docker run -d --name bpc \
  -p 8787:8787 \
  -v bpc-data:/app/server/data \                 # persists the SQLite db + uploaded media
  ghcr.io/adervec/bodybuildingprogresscoach:latest

# Optional: enable Claude coaching
docker run -d --name bpc -p 8787:8787 -v bpc-data:/app/server/data \
  -e ANTHROPIC_API_KEY=sk-ant-... \
  ghcr.io/adervec/bodybuildingprogresscoach:latest
```

Then open **http://localhost:8787**. The container exposes a health check on `/api/status`.

---

## What's inside

| Page | What it does |
|------|--------------|
| **Athletes** | Local profiles (no login). Category sets the theme + which guide's poses apply. |
| **Dashboard** | Latest body-comp KPIs + trend chart, per-pose readiness, "focus next", recent captures. |
| **Capture** | Drag & drop photos/videos (or browse), tag pose + date; grab analyzable frames from videos. Dates come from each photo's own EXIF. |
| **Pose Studio** | Ideal-form diagram + your detected-landmark overlay, objective score breakdown, optional AI coaching, per-pose history. |
| **Physique** | Log weight / body-fat / measurements (manual now; schema is smart-scale ready). Charts + history. |
| **Compare** | Two dates of one pose, side by side, with metric deltas. |
| **Timelapse** | Body-aligned, honest progress timelapse; in-app player + MP4 export (WebM where MP4 isn't supported). |
| **Guides** | The two original posing guides, embedded — with *your own* photos set into their empty plate frames. |

## Architecture

- **client/** — React + Vite + TypeScript SPA. Two CSS-variable themes (**ink/bronze** for men's,
  **marble/gold** for women's) ported verbatim from the guides; the active theme follows the
  athlete's category. Pose detection runs **in the browser** via MediaPipe Tasks Vision
  (`@mediapipe/tasks-vision`); scoring math lives in `src/lib/geometry.ts` (unit-tested).
- **server/** — Express + TypeScript API using Node's built-in `node:sqlite` (no native build
  step). Media is stored on disk under `server/data/`; thumbnails via `sharp`. Optional Claude
  vision coaching (`server/src/ai.ts`) with prompt caching on the rubric.
- **Associated Guide/** — the original HTML guides, served read-only at `/guides`.

### Guide integration (three senses)

1. **Visual** — colors, fonts (Bodoni Moda / Spectral / DM Mono), film-grain/marble overlays, and
   the plate aesthetic are ported into the app's design system.
2. **Analytical** — the guides' per-pose judging criteria become the scoring rubric, and the ideal
   joint angles encoded in each guide's figure renderer become the "reference-form" target. The
   guides' SVG mannequin renderers are reused as the in-app ideal-form diagrams.
3. **Photographic** — every plate in the guides ships an empty frame captioned *"Drop a clean
   reference photo of this pose here."* The Guides page makes that literal: each frame is filled
   with your most recent shot of that pose (matched on the plate's own `data-figure` id), and is
   itself a drop target — drop a photo on a plate and it uploads tagged with that pose. The guide
   files stay untouched; the app decorates them at runtime. `client/src/lib/guides.test.ts`
   guards that contract.

## Scripts

```bash
npm run dev          # run client + API together
npm run build        # typecheck + build both workspaces
npm run typecheck    # tsc on both workspaces
npm run test         # unit tests: geometry, EXIF dating, guide contract, service worker
npm run seed         # demo data
npm start            # launcher: install/build if needed, serve, open a browser
```

## Continuous integration & deployment

GitHub Actions handles both CI and image publishing:

| Workflow | Trigger | What it does |
|----------|---------|--------------|
| **CI** (`.github/workflows/ci.yml`) | push / PR to `main` & `dev` | `npm ci` → `typecheck` → `test` → `build` on a Node **22.x + 24.x** matrix, then uploads `client/dist` as an artifact. |
| **Publish Docker image** (`.github/workflows/docker-publish.yml`) | push to `main`, `v*.*.*` tags (PRs build-only) | Builds the production `Dockerfile` and pushes to **GHCR** (`ghcr.io/adervec/bodybuildingprogresscoach`), tagged `latest`, the branch/sha, and semver on tags. |

`Dependabot` (`.github/dependabot.yml`) keeps the npm deps, GitHub Actions, and the Docker base
image up to date weekly.

**No extra secrets are required** — image publishing uses the built-in `GITHUB_TOKEN`. After the
first successful publish, make the package public (or grant pull access) under the repo's
**Packages** settings if you want to pull it without authenticating.

**Deploying elsewhere.** The image runs anywhere that runs containers (Fly.io, Render, Railway, a
VPS, etc.). Map a persistent volume to `/app/server/data` so the SQLite database and uploaded media
survive restarts, publish port `8787`, and optionally set `ANTHROPIC_API_KEY`. To deploy
automatically, add a deploy job to the publish workflow once you've chosen a host.

## Notes & roadmap

- **Self-hosted & offline.** The MediaPipe runtime + pose model and the web fonts are served from
  the app's own origin (provisioned at build time), so the app makes **no third-party network
  requests** and runs fully offline. Inference runs locally; photos are never uploaded for geometry
  analysis.
- **Reference-form angles are stylized** (drawn to teach shape), so that sub-score is directional;
  symmetry and proportions are the camera-robust headline metrics.
- **Later:** smart-scale / Bluetooth import (schema already supports `source='scale'`), full video
  *motion* analysis (transition smoothness/timing) beyond key-frame sampling, and code-splitting
  the MediaPipe bundle.

## Tech

React 18 · Vite 5 · React Router · Recharts · MediaPipe Tasks Vision · Express 4 · node:sqlite ·
sharp · @anthropic-ai/sdk · TypeScript · Vitest.

## License & legal

- **License:** [Apache License 2.0](./LICENSE) — free to use, modify, and redistribute
  (including commercially) with attribution; provided **without warranty**.
  Copyright 2026 Bodybuilding Progress Coach contributors. See [`NOTICE`](./NOTICE).
- **Disclaimer:** Not medical, coaching, or legal advice — see [DISCLAIMER.md](./DISCLAIMER.md).
- **Privacy:** Local-first by design; optional AI is off by default — see [PRIVACY.md](./PRIVACY.md).
- **Third-party notices:** dependency and asset licenses are listed in
  [THIRD-PARTY-NOTICES.md](./THIRD-PARTY-NOTICES.md).
- **Security:** report vulnerabilities privately per [SECURITY.md](./SECURITY.md).
- **Contributing:** see [CONTRIBUTING.md](./CONTRIBUTING.md) (contributions are Apache-2.0).

> Going from private to public? The step-by-step checklist lives in
> [GOING-PUBLIC.md](./GOING-PUBLIC.md).

Names, trademarks, and competitions referenced in the guides (e.g. "Mr./Ms. Olympia,"
the "Sandow" trophy) belong to their respective owners and are used nominatively for
description and education. This project is not affiliated with or endorsed by any
federation or trademark owner.
