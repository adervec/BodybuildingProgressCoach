# Privacy

This document describes **how the software behaves** with your data. It is not a
legal privacy policy. If you deploy this app for other people, *you* become
responsible for the data you collect from them (see "Self-hosting" below).

> Plain-language summary: by default, your photos, videos, and measurements stay on
> your own machine. The web fonts and the ML model are bundled with the app (no
> CDNs), so the only time anything leaves your computer is if **you** turn on the
> optional AI critique.

## What stays local
- **Photos & videos** you upload are stored on the server's local disk under
  `server/data/media` (thumbnails in `server/data/thumbs`). They are not uploaded
  anywhere for the geometry analysis.
- **Pose detection runs in your browser** via MediaPipe. The image is analyzed
  on-device; the landmarks (not the photo) are sent to your local server to store
  the score.
- **Body-composition data** (weight, body fat, measurements) is stored in a local
  SQLite database at `server/data/app.db`.
- There is **no account system, no analytics, no telemetry, and no tracking** in
  this project. It does not "phone home."

## What can leave your machine
1. **Optional AI coaching (off by default).** If you set `ANTHROPIC_API_KEY`, then
   when you explicitly request an AI critique, the single image being analyzed and
   the posing rubric are sent to **Anthropic's Claude API** for that one request.
   This is governed by Anthropic's
   [Terms](https://www.anthropic.com/legal/commercial-terms) and
   [Usage Policy](https://www.anthropic.com/legal/aup). With no key set, this never
   happens and the app remains fully functional.
2. **That's the only one.** The web fonts, the MediaPipe WASM runtime, and the
   pose-detection model are all **self-hosted** (served from the app's own origin),
   so by default the app makes **no third-party network requests** and works fully
   offline. Pose detection still runs entirely in your browser. *(This is verified:
   on load, every request goes to the app's own origin.)*

## Deleting your data
All app data lives under `server/data/`. Deleting that directory (or the specific
media files / database) permanently removes it. In Docker, remove the mounted
volume (e.g. `docker volume rm bpc-data`).

## Self-hosting for others (important)
This app is built for personal, local use. If you host it so that **other people**
upload their photos:
- Physique photos are **sensitive personal data** (and may be treated as biometric
  data in some jurisdictions). You become the data controller.
- You are responsible for obtaining informed consent and for complying with
  applicable laws (e.g. GDPR, UK GDPR, CCPA/CPRA, Illinois BIPA), including data
  security, retention, access, and deletion obligations.
- Do not upload images of other people without their permission, and never upload
  images of minors.

This project's contributors provide the software "AS IS" and are not the data
controller for any deployment you operate. See [DISCLAIMER.md](./DISCLAIMER.md).
