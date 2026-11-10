# BodybuildingProgressCoach

Notes for the coding agent that works on this repo.

## House standards (shared across every app by this maker)

@../CoworkSyncHub/HOUSE-STANDARDS.md

For this app:
- Check the standards: `node ../CoworkSyncHub/standards.mjs bodybuilding -v`. Keep it all `ok` before pushing.
- Test: `npm run typecheck && npm test && npm run build`
- Deploy: push to main: pages.yml tests, publishes, live-checks and tags (plus the Docker image)
- Work on `main`, push your own work when it passes, and add user-visible changes to `whatsnew.json`.
