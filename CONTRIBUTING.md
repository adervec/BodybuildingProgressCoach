# Contributing

Thanks for your interest! This is a small, non-commercial project. Contributions,
issues, and suggestions are welcome.

## Developer setup
Requires **Node ≥ 22** (the server uses `node:sqlite`).

```bash
npm install        # installs both workspaces (server + client)
npm run dev        # client on http://localhost:5188, API on http://localhost:8787
```

Useful scripts:

```bash
npm run typecheck  # tsc on server + client
npm run test       # client geometry unit tests (vitest)
npm run build      # typecheck + build both workspaces
```

## Before opening a pull request
- Run `npm run typecheck`, `npm run test`, and `npm run build` — all must pass.
- CI runs the same checks on Node 22 and 24; your PR must be green.
- Keep changes focused, and update docs (`README.md`, etc.) when behavior changes.
- Don't commit secrets. `server/.env` is git-ignored; never paste an API key into
  code, tests, or fixtures.

## Licensing of contributions (inbound = outbound)
By submitting a contribution, you agree that your contribution is licensed under
the project's [Apache License 2.0](./LICENSE), and you certify that you have the
right to submit it (per the Apache-2.0 §5 contribution terms). Please only submit
work that is your own or that you are authorized to contribute.

## Project ethos
This app aims to be **honest and non-shaming**: objective, reproducible numbers
first; opinion clearly labeled and optional. Please keep that spirit in features
and copy. It is not a place for diet/medical advice or body-shaming language (see
[DISCLAIMER.md](./DISCLAIMER.md)).
