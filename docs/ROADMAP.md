# Roadmap

## 0.1.1 — current

- [x] panel drilldown: KPI / mastery buckets / stacked bar / hero stats → concept dialog
- [x] photo attachment → selected DSH session (same-origin RPC)
- [x] `GET /learning-hub/auth` → DSH cookie, no manual token
- [x] mixed seed/real mode: `record` requires real evidence, writes session + `seed:false`, syncs reviews
- [x] 34 plugin tests; 523 panel selfcheck checks
- [x] demo data and sanitized open-source repo

## 0.1.0 — 2026-10-26

- [x] `learning_hub` tool: `status`, `route`, `record`, `link`, `search`, `review`
- [x] `_learner` normalisation, backups, atomic writes, path containment
- [x] panel: branch tree, KPIs, weak/due, activity, SVG graph, record form
- [x] collapsible sidebars; 3/2/1-column responsive layout
- [x] 23 plugin tests; 412 panel selfcheck checks

## 0.2 — course registration

- [ ] `action: "add_course"` and `action: "add_concept"` with validation and backups
- [ ] idempotent “new course” flow: name + directory + textbook → branch + 8–12 concepts
- [ ] panel “new course” dialog (optional)
- [ ] `learning-router` update: unknown course → one clarifying question, then register

## 0.3 — review and search

- [ ] server-side `/api/learning-hub/search` (concept, alias, error)
- [ ] review queue grouped by branch and overdue age
- [ ] export/import a learner folder as a zip

## 0.4 — panel polish

- [ ] mobile interaction tests (tap, scroll, collapse persistence)
- [ ] keyboard navigation for the graph and tree
- [ ] manual light/dark toggle (currently follows the system)
- [ ] print/export a one-page weekly summary

## Later

- [ ] optional remote access with authentication (do not expose without it)
- [ ] GitHub Actions: Windows + Node 22/24, tests + selfcheck
- [ ] npm publication (`dsh-learning-hub`) once the API stabilises
- [ ] schema migration tool for v2 data

## Non-goals

- A hosted SaaS or account system.
- A second database that duplicates `_learner`.
- Automatic mastery upgrades without evidence.
- Shipping real learner data in the repository.
