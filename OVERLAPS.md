# Overlaps

Places where this app and another app, or the hub, hold the same data, do the same job, or could
feed each other (house standard 27). Written down, not acted on: building one is the maker's call,
after a plan. The hub's register is `../CoworkSyncHub/OVERLAPS.md`.

Reviewed: 2026-11-20

- [idea] BodybuildingProgressCoach + GymTracker + MacroTrackro: weight and body composition are kept separately in each -> one `shared-body.json` in the shared Drive folder with one owner; physique trends, training and macro targets read it (from the hub register)
- [idea] BodybuildingProgressCoach + GymTracker: posing photos and timelapses sit apart from the training blocks that explain them -> show the training block beside a progress timelapse, read-only from GymTracker's shared data (from the hub register)
- [idea] BodybuildingProgressCoach + HandwritingHelper + MarksmanApp + MicroMiniger + Tachyread: each takes a photo and straightens, crops or reads it its own way -> one shared capture helper in font.js (from the hub register)
- [idea] BodybuildingProgressCoach + every app with Drive sync: this app still carries its own Google sign-in and Drive appDataFolder code (client/src/lib/sync/syncProviders.ts) -> move onto font.js `appFont.google` (token, read, write, signOut) so one sign-in serves every app (standard 1's to-do)
- [idea] BodybuildingProgressCoach + any other app that runs MediaPipe: each bundles its own ~11 MB wasm runtime and model -> one copy published on adervec.github.io, cached once by the browser for every app that needs it
