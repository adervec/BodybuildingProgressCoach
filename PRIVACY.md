# Privacy

This document describes **how the software behaves** with your data. It is not a
legal privacy policy. If you deploy this app for other people, *you* become
responsible for the data you collect from them (see "Self-hosting" below).

> Plain-language summary: by default, your photos, videos, and measurements stay on
> your own machine. The only time anything leaves your computer is if **you** turn
> on the optional AI critique, plus some fonts and an ML model that are downloaded
> from public CDNs.

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
2. **Third-party CDNs (on by default).** The web UI loads:
   - Web fonts from **Google Fonts** (`fonts.googleapis.com` / `fonts.gstatic.com`),
   - the **MediaPipe** WASM runtime from **jsDelivr**, and
   - the **pose model** from **Google Cloud Storage**.

   These requests expose your browser's IP address and request metadata to those
   providers. To eliminate them, vendor the fonts and model into the app for fully
   offline operation (noted in the README roadmap).

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
