# Security

## Threat model

The plugin handles **personal learning data**: course notes, misconceptions, evidence paths and mastery. Treat it as private local data.

Assets:

- `_learner/*` (profile, progress, errors, reviews)
- panel HTML/JS
- optional HTTP API

Adversaries considered:

- a malicious web page in the same browser trying to POST to localhost;
- a path traversal / symlink attempt against the panel or data root;
- accidental exposure through a tunnel/reverse proxy;
- a contributor accidentally committing real learner data to a public repo.

Out of scope for 0.1.1: multi-user accounts, remote access control, encryption at rest.

## Controls

| Control | Implementation |
|---|---|
| Loopback only | API rejects non-loopback remote addresses |
| Same-origin writes | `Origin`/`Referer` must match the host |
| JSON-only writes | `content-type: application/json`, 64 KiB limit |
| Path containment | `realpath` + `isInside` for data and panel assets; `..`, absolute paths, NUL rejected |
| Atomic writes | temp file + rename; no partial JSON |
| Backups | pre-write snapshot in `_learner/.backups/` (default 20) |
| Browser auth | `GET /learning-hub/auth` uses DSH's browser auth, 302 to `/?token=…`, sets a 30-day HttpOnly cookie; only loopback authority; rejects forwarded/CF headers |
| No credentials in data | plugin never writes tokens/passwords to `_learner`; cookie stays in the browser |
| No outbound network | plugin makes no external requests |

## Known limitations

- The panel uses DSH's loopback browser auth (30-day HttpOnly cookie). This is **not** multi-user auth and does not make remote exposure safe; do not put it behind a public tunnel/reverse proxy.
- `state` includes evidence text and paths; treat the panel as sensitive.
- Browser `localStorage` stores only panel UI preferences (collapsed sidebars), not learner data.
- The plugin trusts the DSH host for workspace isolation; cross-workspace file access is governed by the host's policy.

## Reporting

Do not open a public issue for a vulnerability. Contact the maintainers privately (see the repository profile) with:

- affected version/commit;
- reproduction steps;
- impact (data read/write, path escape, etc.);
- a suggested fix if available.

## Public repository hygiene

Before publishing or accepting a contribution:

- no real `_learner` directory, names, grades, homework, screenshots or absolute personal paths;
- demo data in `examples/demo-learner/` only, clearly marked seed;
- no tokens, `.env`, credentials, `.backups/` or `node_modules/`;
- commit author email should be a GitHub noreply address, not a personal address;
- run `node --test`, `node --check public/app.js`, `node test/panel-selfcheck.mjs`;
- review `git diff --cached` and `git status` before pushing.
