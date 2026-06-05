# Third-party notices

Bodybuilding Progress Coach is released under the [Apache License 2.0](./LICENSE).
It uses third-party software and assets, summarized here for attribution.

**This repository does not redistribute any third-party source, fonts, models, or
media.** Dependencies are installed from npm (`node_modules/` is git-ignored), and
a few assets are fetched from third-party CDNs at run time. This document is a
good-faith summary, not a legal instrument; the authoritative license for each
package is the one shipped inside that package.

---

## Direct dependencies

All direct dependencies are under permissive licenses (MIT / Apache-2.0 /
BSD-2-Clause) and are compatible with this project's Apache-2.0 license.

| Package | Version | License | Scope |
|---|---|---|---|
| `@anthropic-ai/sdk` | 0.32.x | MIT | runtime (server) |
| `@mediapipe/tasks-vision` | 0.10.x | Apache-2.0 | runtime (client) |
| `cors` | 2.8.x | MIT | runtime (server) |
| `dotenv` | 16.x | BSD-2-Clause | runtime (server) |
| `express` | 4.x | MIT | runtime (server) |
| `multer` | 1.4.x | MIT | runtime (server) |
| `react` / `react-dom` | 18.3.x | MIT | runtime (client) |
| `react-router-dom` | 6.x | MIT | runtime (client) |
| `recharts` | 2.x | MIT | runtime (client) |
| `sharp` | 0.33.x | Apache-2.0 | runtime (server) |
| `concurrently` | 9.x | MIT | dev |
| `tsx` | 4.x | MIT | dev |
| `typescript` | 5.x | Apache-2.0 | dev |
| `vite` / `@vitejs/plugin-react` | 5.x / 4.x | MIT | dev |
| `vitest` | 2.x | MIT | dev |
| `@types/*` | — | MIT | dev (type defs only) |

The full transitive tree (≈289 packages) is pinned in `package-lock.json` and is
entirely permissive (MIT, ISC, BSD-2/3-Clause, Apache-2.0, 0BSD, CC-BY-4.0). A
machine-readable report can be regenerated at any time, e.g. with
`npx license-checker-rseidelsohn --summary`.

### Notable transitive components

- **libvips** — bundled by `sharp` as a prebuilt, platform-specific binary
  (`@img/sharp-*`). libvips is **LGPL-3.0-or-later**; `sharp` links it dynamically.
  It runs **server-side only** (never shipped to the browser) and is installed via
  npm rather than redistributed by this repository, so its copyleft terms are
  satisfied by the standard "user installs it themselves / it can be replaced"
  arrangement.
- **`caniuse-lite`** — browser-support data under **CC-BY-4.0**; used at build
  time by the toolchain, not shipped to users.

---

## Assets fetched at run time (not vendored)

| Asset | Source | License / terms |
|---|---|---|
| **Web fonts** — Bodoni Moda, Spectral, DM Mono | Google Fonts API (`fonts.googleapis.com` / `fonts.gstatic.com`) | SIL Open Font License 1.1 (served by Google Fonts) |
| **MediaPipe WASM runtime** | jsDelivr CDN (`@mediapipe/tasks-vision`) | Apache-2.0 |
| **Pose landmarker model** (`pose_landmarker_lite.task`) | Google (`storage.googleapis.com/mediapipe-models/…`) | Apache-2.0 (Google MediaPipe model) — see the MediaPipe model card |

Because these are fetched from third-party servers, the end user's browser/IP is
exposed to those providers. To run fully offline and avoid that exposure, the
fonts and model can be vendored into the app (see the roadmap in `README.md` and
`PRIVACY.md`).

---

## Optional AI coaching

When an `ANTHROPIC_API_KEY` is configured, the optional written critique is
produced by **Anthropic's Claude API**. Use of that API is governed by Anthropic's
[Terms of Service](https://www.anthropic.com/legal/commercial-terms) and
[Usage Policy](https://www.anthropic.com/legal/aup). This feature is **off by
default**; with no key configured, no image is ever sent to Anthropic.

---

## Trademarks

Product names, logos, brands, competitions (e.g. "Mr. Olympia," "Ms. Olympia"),
and the "Sandow" trophy referenced anywhere in this project are the property of
their respective owners and are used **nominatively** for description, history,
and education. Their use here does not imply any affiliation or endorsement.
