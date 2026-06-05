# Security policy

This is a personal, non-commercial open-source project maintained on a best-effort
basis. There is no warranty (see [LICENSE](./LICENSE)) and no bug-bounty program,
but security reports are genuinely appreciated.

## Reporting a vulnerability
**Please do not open a public issue for security problems.** Instead, use GitHub's
private reporting:

1. Go to the repository's **Security** tab → **Report a vulnerability** (GitHub
   Private Vulnerability Reporting), or
2. Open a regular issue that says only "I'd like to report a security issue
   privately" with no details, and a maintainer will follow up.

Please include enough detail to reproduce (affected file/endpoint, steps, and
impact). We'll aim to acknowledge within a reasonable time and fix verified issues
as the project's volunteer capacity allows.

## Scope notes
- The app is designed for **local, single-user** use. Running it as a public,
  multi-user service is outside its threat model — if you do, you are responsible
  for authentication, transport security (HTTPS), input limits, and the privacy
  obligations described in [PRIVACY.md](./PRIVACY.md).
- Optional AI coaching sends data to a third party only when you configure an API
  key; treat that key as a secret and never commit it.

## Supported versions
Only the latest commit on the default branch is supported.
