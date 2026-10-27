# Data schema

All data lives in the directory configured as `dataRoot` (the `_learner` folder). The demo is `examples/demo-learner/`.

## Files

| File | Shape | Purpose |
|---|---|---|
| `profile.md` | YAML frontmatter + Markdown body | learner profile and teaching preferences |
| `branches.json` | `{ version, branches: [] }` | course → concept tree |
| `concepts.json` | `{ version, concepts: [] }` | concept graph, mastery, evidence |
| `progress.jsonl` | one JSON object per line | append-only learning events (`seed:true` fixtures, `seed:false` real) |
| `errors.json` | `{ version, errors: [] }` | misconception/error ledger |
| `reviews.json` | `{ version, reviews: [] }` | review schedule; `record` syncs the target row |
| `sessions.jsonl` | one JSON object per line | routing/session log; real rows carry `session` + `seed:false` |
| `materials/index.md` | Markdown table | material index |
| `.backups/` | copies | pre-write backups, kept per file (default 20) |

## profile.md

```yaml
---
name: Demo Learner
stage: Year 1
major: Computer Science
goals:
  - Build foundations in Calculus, Linear Algebra, and C
teaching:
  language: en
  one_step_at_a_time: true
constraints:
  - No credentials in this directory
---
```

The body should contain “current state” and “next step” so a new session can orient quickly.

## branches.json

```json
{
  "version": 1,
  "branches": [
    {
      "id": "cs.c",
      "name": "C Programming",
      "parent": "cs",
      "workspace": "/path/to/c-course",
      "paths": ["courses/c"],
      "keywords": ["pointer", "array", "指针", "数组"],
      "materials": ["M-003"],
      "status": "active",
      "next": "Pointers: arithmetic and bounds checks"
    }
  ]
}
```

- `id` is dot-lowercase and globally unique.
- `status` ∈ `active | paused | planned | archived`.
- `workspace` is the cwd used by the router; `paths` are relative hints.
- `next` is a one-line next step; the panel shows it.

## concepts.json

```json
{
  "version": 1,
  "concepts": [
    {
      "id": "cs.c.pointer",
      "name": "Pointers and Addresses",
      "aliases": ["pointer", "指针"],
      "branches": ["cs.c"],
      "prereq": ["cs.c.array"],
      "related": [],
      "mastery": 1,
      "seed": false,
      "mastery_basis": "recorded_evidence",
      "evidence": ["homework-4 Q3"],
      "misconceptions": ["Incrementing an array name"],
      "sources": ["course notes"],
      "next_review": null
    }
  ]
}
```

Invariants:

- `id` prefix starts with one of `branches`.
- `prereq` references existing concepts, is acyclic.
- `related` is symmetric (A→B implies B→A); duplicate edges are collapsed on render.
- `mastery` is an integer 0–5.
- `next_review` is `YYYY-MM-DD` or `null`.
- `evidence` is a list of traceable strings. A missing or empty list means “not assessed”, not “known”.
- `seed:true` concepts keep mastery 0/1 and placeholder evidence; `seed:false` concepts may use 0–5 and real evidence, with `mastery_basis` (for example `recorded_evidence`).

## progress.jsonl

```json
{"ts":"2026-10-26T20:00:00+08:00","branch":"cs.c","unit":"Pointers and Addresses","action":"practice","mastery":2,"evidence":"homework-4 Q3","concept":"cs.c.pointer","session":"sess-1","seed":false}
```

`action` ∈ `study | practice | exam | review | misconception`.
The file is append-only; the plugin never rewrites history. Real records require non-placeholder evidence and a session; seed fixtures use `seed:true` and placeholder evidence.

## errors.json

```json
{
  "version": 1,
  "errors": [
    {
      "id": "E-001",
      "branch": "cs.c",
      "concept": "cs.c.pointer",
      "symptom": "array name incremented",
      "root_cause": "confused array with pointer variable",
      "fix": "use a separate pointer",
      "seen": 2,
      "last_at": "2026-10-26"
    }
  ]
}
```

## reviews.json

```json
{
  "version": 1,
  "reviews": [
    {"concept": "cs.c.pointer", "due": "2026-11-02", "mastery": 2}
  ]
}
```

`reviews.json` is merged into `due_reviews`; `record` updates the target concept's `next_review` and the matching review row (`due`, `mastery`, `interval_days`, `status`, `last_reviewed`). Keep both consistent if editing by hand.

## sessions.jsonl

```json
{"ts":"2026-10-26T20:00:00+08:00","cwd":"/path/to/c-course","primary":"cs.c","secondary":[],"confidence":0.91,"reason":"cwd + keywords","session":"sess-1","seed":false}
```

## Mastery scale

| Value | Meaning |
|---:|---|
| 0 | not encountered |
| 1 | seen / lecture only |
| 2 | can follow along |
| 3 | can do independently |
| 4 | fluent and stable |
| 5 | can explain it back |

`mastery` changes only through `learning_hub record` (or an explicit hand edit) with evidence. Demo values are illustrative.

## Adding a course

1. Add a branch to `branches.json`.
2. Add 8–12 concepts to `concepts.json`, with `prereq`/`related` that already exist.
3. Add materials and initial review rows.
4. Validate JSON, reload the panel, and record a first event.

There is no `add_course` tool yet; see `ROADMAP.md`.

## Versioning

The state schema is `learning-hub.state/v1`. The data files are intentionally plain; future schema changes should be additive and documented here.
