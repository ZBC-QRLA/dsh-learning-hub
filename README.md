# dsh-learning-hub

A **local-first learning hub** for [DeepSeek Harness](https://github.com/deepseek-ai) (DSH).

It turns plain Markdown/JSON files in a `_learner` directory into:

- a course → concept **branch tree**;
- a prerequisite/relationship **concept graph**;
- mastery, evidence-backed progress, and 1/3/7/14-day review;
- a `learning_hub` tool for DSH agents;
- a small three-column **dashboard** with a records form.

There is no database, no CDN, no telemetry and no cloud dependency. The data stays in your `_learner` folder and can be read, diffed, backed up and edited by hand.

> Status: **0.1.1, early**. The data schema and tool actions may evolve. See [ROADMAP](docs/ROADMAP.md).

## Changelog

### 0.1.1 — 2026-10-27

- **Dashboard drilldown**: click KPI cards, mastery buckets, the stacked bar, or hero stats to inspect the concepts behind the number in a native dialog.
- **Photo to DSH**: the record form can attach a photo, compress it in the browser, and send it to a selected DSH session over same-origin RPC.
- **One-click DSH login**: `GET /learning-hub/auth` redirects through DSH's browser auth and sets an HttpOnly cookie; the panel then loads `session/list` and `session/prompt` without manual token handling.
- **Mixed seed/real mode**: `seed:true` fixture rows stay strict; real `record` rows use `seed:false` + a session id + non-placeholder evidence.
- **Session and review sync**: `record` creates/reuses a `sessions.jsonl` row and updates the matching `reviews.json` entry (`due`, `mastery`, `interval_days`, `status`, `last_reviewed`) on every concept update.
- **Safer evidence gate**: empty evidence or `seed:` / `待补充` / `示例:` placeholders are rejected before anything is written.
- Tests: **34 plugin tests** + **523 panel selfcheck checks**.

### 0.1.0 — 2026-10-26

- Initial open-source release: `learning_hub` tool, branch/concept graph, dashboard, records, spaced review, local HTTP API, demo `_learner`.
- Tests: 23 plugin tests + 412 panel selfcheck checks.

---

## Features

| | |
|---|---|
| Branch tree | Active and planned courses, each with concepts and a next step |
| Concept graph | Prerequisite edges, related edges, mastery colours, click-to-inspect |
| Evidence first | `mastery` only changes with a record; no silent "I think you know it" upgrades |
| Records | study / practice / exam / review / misconception |
| Review | 1 / 3 / 7 / 14-day schedule; `review` returns due concepts |
| Routing | cwd, keywords, branch names and concept names → primary/secondary branch + confidence |
| Dashboard | collapsible sidebars, desktop/tablet/mobile layouts, light/dark, no build step |
| Drilldown | click KPI / distribution / stacked bar / hero stats to inspect the concepts behind a number |
| Photo to DSH | compress a photo in the browser and send it to a selected DSH session over same-origin RPC |
| Safe writes | loopback-only HTTP, same-origin writes, realpath containment, 64 KiB body limit, pre-write backups |
| Mixed data | seed fixtures and real `record` rows can coexist; real rows carry `seed:false`, session and evidence |

## Requirements

- DSH `>=0.2.1-rc.3 <0.3.0-0`
- Node.js `>=20` (DSH ships its own runtime; a standalone Node is useful for tests)

## Install from a checkout

```powershell
# 1. Link the package into a DSH profile
dsh plugin --profile desktop add D:\path\to\dsh-learning-hub

# 2. Point the plugin at your learner data and the bundled panel
#    Edit <DSH_HOME>\profiles\desktop\cordis.patch.yml:
```

```yaml
- id: learning-hub
  name: dsh-learning-hub
  config:
    dataRoot: 'D:\path\to\learner'
    panelDir: 'D:\path\to\dsh-learning-hub\public'
    # port: 19480   # optional loopback-only extra port
```

Restart DSH, then:

- tool `learning_hub` is available;
- panel: `http://127.0.0.1:<DSH_PORT>/learning-hub/`;
- API: `/api/learning-hub/state`, `/record`, `/route`.

Without any config, the plugin uses the bundled demo:

- data: `examples/demo-learner/`
- panel: `public/`

## Quick start (demo)

```powershell
node --test                    # 35 tests (34 plugin + panel selfcheck)
node test/panel-selfcheck.mjs  # 523 panel checks
```

Open `public/index.html` via any static server, or install the plugin and open `/learning-hub/`.

## Tool

One tool, several actions:

```json
{"action":"status"}
{"action":"route","cwd":"D:/courses/c","text":"pointers and arrays"}
{"action":"record","branch":"cs.c","unit":"pointer","event":"practice","mastery":2,"evidence":"homework-4 Q3"}
{"action":"search","query":"pointer"}
{"action":"review","withinDays":7}
{"action":"link","from":"cs.c.array","to":"cs.c.pointer","relation":"prereq"}
```

`event` is `study | practice | exam | review | misconception`.
`evidence` is required and must be traceable (homework id, file, session id).

## HTTP API

| Route | Method | |
|---|---|---|
| `/learning-hub` | GET | 302 → `/learning-hub/` |
| `/learning-hub/` | GET | dashboard |
| `/learning-hub/auth` | GET | 302 → DSH `/?token=…`; sets a 30-day HttpOnly cookie |
| `/learning-hub/<asset>` | GET | static assets |
| `/api/learning-hub/state` | GET | canonical state |
| `/api/learning-hub/record` | POST | append a record |
| `/api/learning-hub/route` | POST | route text/cwd |

All non-loopback requests are rejected. Write requests must be same-origin JSON and are limited to 64 KiB.

## Data model

`_learner/` is the single source of truth:

```
profile.md
branches.json
concepts.json
progress.jsonl
errors.json
reviews.json
sessions.jsonl
materials/index.md
.backups/          # created by the plugin before writes
```

A concept has `id`, `name`, `aliases`, `branches`, `prereq`, `related`, `mastery` (0–5), `evidence`, `misconceptions`, `sources`, `next_review`, plus `seed` and `mastery_basis` in mixed mode.
Prerequisites are directed and acyclic; related links are symmetric.

Seed rows keep `seed:true` and placeholder evidence; a real `record` writes `seed:false`, appends a real evidence string, adds a `session`, and syncs the matching `reviews.json` row. See [docs/DATA-SCHEMA.md](docs/DATA-SCHEMA.md).

## Security and privacy

- Local data only; no outbound network calls, no telemetry, no credentials in `_learner`.
- HTTP is loopback-only; writes require a same-origin `Origin`/`Referer` and JSON.
- The panel uses DSH's browser auth via `GET /learning-hub/auth` (30-day HttpOnly cookie); no token is returned in JSON or stored in `_learner`.
- Static paths are realpath-checked; `..`, absolute paths, symlink escapes and NUL bytes are rejected.
- Every write is atomic and backed up under `_learner/.backups/`.

Please read [SECURITY.md](docs/SECURITY.md) before exposing the panel through a tunnel or reverse proxy. Authentication is for the local DSH browser only; this is **not** a multi-user or remote-access product.

## Development

```powershell
node --test                 # store/router/api/escape tests
node --check public/app.js
node test/panel-selfcheck.mjs
```

The panel is plain HTML/CSS/JS. There is no build step and no frontend dependency.
The plugin is a normal Cordis package (`lib/index.js`); edits to `lib/` require a DSH restart, panel edits only need a browser refresh.

See [CONTRIBUTING.md](CONTRIBUTING.md) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## License

MIT. See [LICENSE](LICENSE).
