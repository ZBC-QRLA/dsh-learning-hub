# API

Two surfaces: the DSH tool `learning_hub` and the local HTTP routes.

## Tool `learning_hub`

One tool, one `action` per call.

| Action | Required | Optional | Returns |
|---|---|---|---|
| `status` | — | — | text summary |
| `route` | `text` or `cwd` | — | `{primary, secondary, confidence, reasons, concepts}` |
| `record` | `branch`, `unit`, `event`, `evidence` | `mastery`, `note`, `concept`, `session` | `{ok, updated, state}` |
| `link` | `from`, `to`, `relation` | — | `{ok, from, to, relation}` |
| `search` | `query` | `branch` | `{concepts, errors}` |
| `review` | — | `withinDays` (default 7) | `{due, withinDays}` |

### record

```json
{
  "action": "record",
  "branch": "cs.c",
  "unit": "Pointers and Addresses",
  "event": "practice",
  "mastery": 2,
  "evidence": "homework-4 Q3",
  "note": "retyped the traversal example"
}
```

- `unit` is matched against concept `name`, `aliases` and `id`.
- `mastery` is optional; if omitted the current value is kept.
- `evidence` is required.
- The store appends to `progress.jsonl`, updates the matched concept's `mastery`/`next_review`, and backs up `concepts.json`.

### route

```json
{"action":"route","cwd":"/path/to/c-course","text":"pointers and arrays"}
```

Scoring: cwd > branch name/keywords > concept names. `confidence < 0.6` means “ask one clarifying question”, not “guess”.

### link

```json
{"action":"link","from":"cs.c.array","to":"cs.c.pointer","relation":"prereq"}
```

`relation` is `prereq` or `related`. `related` is stored symmetrically; `prereq` is directed and checked for cycles.

## HTTP

All routes are served by the DSH web server; the plugin only claims its own paths.

| Route | Method | Notes |
|---|---|---|
| `/learning-hub` | GET | 302 to `/learning-hub/` |
| `/learning-hub/` | GET | dashboard |
| `/learning-hub/<asset>` | GET | static asset from `panelDir` |
| `/api/learning-hub/state` | GET | canonical state |
| `/api/learning-hub/record` | POST | same body as tool `record` (without `action`) |
| `/api/learning-hub/route` | POST | `{text, cwd}` |

### state

```json
{
  "schema": "learning-hub.state/v1",
  "seed": false,
  "as_of": "2026-10-26",
  "generated_at": "2026-10-26T20:00:00+08:00",
  "profile": {"name": "...", "stage": "..."},
  "current_branch": "cs.c",
  "branches": [],
  "concepts": [],
  "weak_concepts": [],
  "due_reviews": [],
  "recent_activity": []
}
```

Branch objects also carry camelCase (`masteryAvg`, `conceptCount`, `dueCount`) and snake_case aliases (`mastery_avg`, `concept_count`, `due_count`) for compatibility.

### record

```json
{"branch":"cs.c","unit":"Pointers and Addresses","event":"practice","mastery":2,"evidence":"homework-4 Q3"}
```

### route

```json
{"text":"pointers and arrays","cwd":"/path/to/c-course"}
```

## Security headers and limits

- Loopback only: `127.0.0.1`, `::1`.
- Writes require `Origin` or `Referer` matching the host.
- `content-type: application/json` required for POST.
- Body limit: 64 KiB.
- `Cache-Control: no-store` on panel/API responses.
- Static paths: realpath containment; `..`, absolute paths, NUL and symlink escapes rejected.
- Wrong method → 405; bad JSON → 400; non-JSON → 415; cross-site → 403; unknown → 404.

## Errors

```json
{"error":{"code":"VALIDATION","message":"..."}}
```

Codes include `VALIDATION`, `NOT_FOUND`, `METHOD_NOT_ALLOWED`, `UNSUPPORTED_MEDIA_TYPE`, `FORBIDDEN`, `PAYLOAD_TOO_LARGE`, `INTERNAL`.
