# Going public — readiness plan & checklist

A practical checklist for taking **Bodybuilding Progress Coach** from a private repo
to a public, open-source one. Built for a non-commercial release with no plans to
monetize.

> ⚠️ **Not legal advice.** This was prepared by a software engineer (and an AI
> assistant), not a lawyer. It reflects common open-source best practice, not a
> formal legal review. For anything you're unsure about, ask a licensed attorney.

## Decisions (made)
| Decision | Choice |
|---|---|
| License | **Apache License 2.0** (permissive + patent grant + explicit no-trademark clause) |
| Posing guides provenance | **Original work** of the contributors — safe to publish & redistribute |
| Copyright attribution | **"Bodybuilding Progress Coach contributors"** |
| Monetization | None planned (Apache-2.0 still lets *others* use it commercially; that's expected and fine) |

## What's already done in this repo ✅
- [x] **`LICENSE`** — verbatim Apache License 2.0.
- [x] **`NOTICE`** — Apache notice + project copyright + pointer to third-party notices.
- [x] **`THIRD-PARTY-NOTICES.md`** — dependency licenses + runtime-fetched assets (fonts, MediaPipe model) + trademark note.
- [x] **`DISCLAIMER.md`** — "not a doctor/coach/lawyer," not medical/coaching advice, AI-output caveat, no-warranty, trademark nominative-use, body-image note.
- [x] **`PRIVACY.md`** — local-first behavior, optional-AI data flow, third-party CDN exposure, self-hosting responsibilities.
- [x] **`SECURITY.md`** — private vulnerability reporting process.
- [x] **`CONTRIBUTING.md`** — dev setup + inbound=outbound Apache-2.0 licensing of contributions.
- [x] **`license` field = `Apache-2.0`** set in root, `server`, and `client` `package.json`.
- [x] **README** — license badge, disclaimer callout, and Legal/Privacy section.
- [x] **Secret scan** — no API keys in the tree or git history; `.env` is git-ignored; `.env.example` has a blank key.
- [x] **No bundled third-party assets** — no images, fonts, models, or media are redistributed; all are user-supplied or CDN-fetched.
- [x] **In-app disclaimer** — first-run acknowledgement (persisted in `localStorage`) + reopenable from the sidebar; links to `DISCLAIMER.md` / `PRIVACY.md`.
- [x] **Issue & PR templates** — `.github/ISSUE_TEMPLATE/` (bug + feature forms, security contact link) and `PULL_REQUEST_TEMPLATE.md`.

## Before you flip the repo to Public — do these on GitHub
- [ ] **Read `DISCLAIMER.md` and `PRIVACY.md`** end-to-end and confirm you're comfortable with every statement.
- [ ] *(Optional but wise)* Have a lawyer skim `LICENSE`, `DISCLAIMER.md`, and `PRIVACY.md` given the health/fitness subject matter.
- [ ] **Repo → Settings → General**: add a description and topics (e.g. `bodybuilding`, `pose-estimation`, `react`, `typescript`, `mediapipe`).
- [ ] **Repo → Settings → Code security**: enable **Dependabot alerts**, **Dependabot security updates**, **Secret scanning** + **push protection**, and **Private vulnerability reporting**. *(Dependabot version-update config is already committed in `.github/dependabot.yml`.)*
- [ ] **Repo → Settings → Branches**: protect `main` — require the **CI** check to pass before merge, and disallow force-pushes.
- [ ] **Decide GHCR package visibility**: after the first image publish, make the package public (Packages → package → Settings) if you want anyone to `docker pull` it; otherwise leave it private.
- [ ] **(Optional) Set a security contact** email in `SECURITY.md`, or rely on GitHub's private reporting (already referenced).
- [ ] **Flip visibility**: Settings → Danger Zone → **Change visibility → Public**.
- [ ] **(Optional) Tag a release** (`v0.1.0`) — this triggers the Docker publish workflow and creates `ghcr.io/adervec/bodybuildingprogresscoach:0.1.0`.

## Residual risks & recommendations (low, with mitigations)
- **Health/fitness liability** — mitigated by Apache-2.0's no-warranty terms + `DISCLAIMER.md`, and now also surfaced **in the UI**: a first-run disclaimer the user acknowledges once (persisted), reopenable from the sidebar. ✅
- **Trademarks** (Olympia / Sandow / etc.) — only nominative/historical references; disclaimer added. Low risk for a non-commercial project. Revisit if you ever monetize or add logos.
- **User-supplied photos** — sensitive data; responsibility shifts to anyone who self-hosts for others. Covered in `PRIVACY.md`; consider an in-app consent note if you add multi-user hosting.
- **Third-party CDN exposure** (Google Fonts, jsDelivr, Google model storage) — leaks user IP to those providers. *Recommended for privacy/offline:* vendor the fonts and the `pose_landmarker_lite.task` model into the app and self-host them.
- **AI critique accuracy** — labeled as optional opinion that may be wrong; data flow disclosed.

## Nice-to-have follow-ups (optional)
- [x] In-app disclaimer / consent banner (ties the legal docs to the actual UI). ✅
- [x] `.github/ISSUE_TEMPLATE/` + `PULL_REQUEST_TEMPLATE.md`. ✅
- [ ] Vendor fonts + MediaPipe model for fully offline, no-third-party-call operation. *(adds ~MBs of binary assets — decide if you want this; best done as one complete, verified pass.)*
- [ ] `CODE_OF_CONDUCT.md` (e.g. Contributor Covenant) if you expect outside contributors.
- [ ] A short `CHANGELOG.md` and a tagged `v0.1.0` release.
