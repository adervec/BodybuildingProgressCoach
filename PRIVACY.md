# Privacy

This document describes **how the software behaves** with your data. It is not a
legal privacy policy. If you deploy this app for other people, *you* become
responsible for the data you collect from them (see "Self-hosting" below).

> Plain-language summary: by default, your photos, videos, and measurements stay on
> your own machine. The web fonts and the ML model are bundled with the app (no
> CDNs), so the only times anything leaves your computer are if **you** turn on the
> optional AI critique or the optional cloud backup.

## Two builds, same guarantee
The **hosted** build at `adervec.github.io/BodybuildingProgressCoach` has no server
at all: your photos, measurements and analyses are held in **your own browser's
IndexedDB** and never transmitted. GitHub serves the page's static files and
nothing else — no upload endpoint exists. The trade-offs are that clearing site
data erases everything (back up!) and AI coaching is unavailable, because there is
no server to hold an API key.

The **self-hosted** build stores the same data on your own machine under
`server/data/`. Everything below describes it; the hosted build behaves the same
minus the AI section.

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
2. **Optional cloud backup (off by default).** The **Backup** page can copy your
   data — and, if you tick the box, your photos and videos — to a location you
   choose:
   - **Local folder**: a directory you pick on your own machine. Nothing touches
     the network. (Point it at a Drive/Dropbox/OneDrive *desktop sync folder* and
     their client does the uploading, under their privacy policy, not ours.)
   - **Google Drive**: your browser signs in to Google and uploads into Drive's
     private **app-data folder** — an area only this app can read, invisible to the
     rest of your Drive. Enabling it loads Google's sign-in script from
     `accounts.google.com` and talks to `googleapis.com`; those are **the only
     third-party requests this app can make**, they happen only while sync is on,
     and the data goes to *your* Drive. The access token is held in memory for the
     session and never written to disk. The app requests the narrowest scope that
     works (`drive.appdata`), so it cannot see your other Drive files.

   Your `ANTHROPIC_API_KEY` is server-side configuration and is **never** included
   in a backup.
3. **That's all of them.** The web fonts, the MediaPipe WASM runtime, and the
   pose-detection model are all **self-hosted** (served from the app's own origin),
   so with both options off the app makes **no third-party network requests** and
   works fully offline. Pose detection always runs entirely in your browser.

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
