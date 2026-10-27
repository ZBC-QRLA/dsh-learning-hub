# Architecture

## Shape

```
DSH host
  └─ dsh-learning-hub (Cordis plugin)
       ├─ ctx.tools.register("learning_hub")
       ├─ ctx.webServer.register(exact/prefix routes)
       ├─ lib/store.js ── _learner/*.md,*.json,*.jsonl
       └─ lib/panel.js ── public/index.html + assets

Skills (separate, installed in DSH)
  ├─ learning-router   route a new session to a branch
  └─ ai-teacher        teach, record, review, engineering mode
```

`_learner` is the **single source of truth**. The plugin is a thin adapter: it reads, normalises, validates and writes those files; it does not keep a second database.

## Plugin lifecycle

1. DSH loads the profile bundle and applies `cordis.patch.yml`; a `learning-hub` row is inserted.
2. `apply(ctx, config)` normalises `dataRoot`, `panelDir`, `port`, `backupKeep`.
3. `lib/index.js` registers:
   - one `learning_hub` tool;
   - exact `GET /learning-hub` → 302;
   - exact `GET /learning-hub/auth` → DSH browser-auth redirect + 30-day cookie;
   - prefix `/learning-hub` for the panel/assets;
   - exact API routes under `/api/learning-hub/`.
4. `ctx.effect` disposes routes and the optional server on unload.

## Data flow

```
tool/API request
  → store.serialize(...)         one writer at a time
  → read JSON/MD/JSONL           normalise + validate
  → backup target file           _learner/.backups/
  → write temp file + rename     atomic
  → return canonical state       buildState()
```

Reads are stateless. Writes are serialized per process; backups are kept per file (default 20).

## Store

`lib/store.js` responsibilities:

- path resolution and `realpath` containment;
- simple YAML frontmatter parser for `profile.md`;
- normalisation of branches/concepts/errors/reviews/progress/sessions;
- `buildState(now)` for the panel;
- `record`, `link`, `search`, `review`, `route`;
- backup + atomic write helpers;
- unknown-field preservation when editing JSON.

The store intentionally does **not** know DSH or HTTP; it can be unit-tested with a temp directory.

## Router

`lib/router.js` is a pure function. It scores branches by:

- cwd matching `workspace` / `paths` (strongest);
- branch name and keywords;
- concept names/aliases (split on `与/和/、` so “pointers and arrays” hits both).

It returns `{ primary, secondary, confidence, reasons, concepts }`. Confidence below `0.6` should make the teaching skill ask one clarifying question.

## Panel

- Plain HTML/CSS/JS; no bundler, no CDN, no runtime dependency.
- `app.js` normalises the state, renders the tree, KPIs, graph, detail, activity and the record form.
- The graph is deterministic: parent rows, minimum spacing within a row, prerequisite transitive reduction, related edges only for the selected node.
- Layout: three columns ≥1040px; two ≤1040px with a static tree and the graph below; one ≤900px. The left and right columns can be collapsed; state is stored in `localStorage`.
- The panel calls `/api/learning-hub/...` on the same origin; if the API is unavailable it falls back to `sample-state.json`, then a built-in demo.

## HTTP

`lib/api.js`:

- loopback-only (`127.0.0.1`, `::1`);
- same-origin checks for writes (`Origin`/`Referer`);
- JSON `content-type`; 64 KiB body limit;
- 302 for `/learning-hub`, 405 for wrong methods, 415/400/403 for bad requests;
- static paths resolved by `lib/panel.js` with `realpath` containment.

## Design decisions

| Decision | Why |
|---|---|
| Plain files, no DB | portable, diffable, backupable, hand-editable |
| One tool, many actions | fewer tool schemas; DSH agent can compose |
| Panel without a build | no dependency supply chain; edits are immediate |
| Write backups + atomic rename | a crash cannot leave a half-written `concepts.json` |
| Seed data separate from real data | open-source demo can never leak a real learner |
| Localhost only | no accidental public exposure of grades/notes |

## Failure modes

- Missing `_learner` → `buildState` returns an empty seed shape, panel shows demo.
- Invalid JSON → tool/API returns a validation error; no partial write.
- Path escape / symlink escape → 403.
- Panel asset missing → built-in fallback page with a diagnostic message.
- Plugin `lib/` changed while DSH is running → restart DSH; panel-only changes need a refresh.
