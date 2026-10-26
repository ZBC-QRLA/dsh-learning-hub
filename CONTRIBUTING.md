# Contributing

Thanks for improving `dsh-learning-hub`.

## Ground rules

- **Local-first**: no telemetry, no analytics, no cloud storage, no remote fonts/CDNs.
- **No personal data**: never commit a real `_learner`, names, grades, homework, screenshots, tokens or absolute personal paths. Demo data belongs in `examples/demo-learner/` and must be marked seed.
- **Small surfaces**: the plugin is a thin host adapter over plain files. Prefer fixing the data model or a small tool action over adding a second database.
- **Evidence, not vibes**: a mastery change must be traceable to a record.

## Development

```powershell
git clone <repo>
cd dsh-learning-hub
node --test
node --check public/app.js
node test/panel-selfcheck.mjs
```

No `npm install` is required for tests. The package has no runtime dependencies; DSH supplies `@deepseek-ai/cordis` and `@deepseek-ai/dsh-tools`.

## Pull requests

1. One focused change per PR.
2. Add or update tests for `lib/store.js`, `lib/router.js`, `lib/api.js` or `lib/panel.js` changes.
3. For panel changes, include a screenshot at 1440 and a narrow width, and run the selfcheck.
4. Update `README.md` / `docs/` when behaviour or the schema changes.
5. Do not bump the version in a feature PR; releases are cut separately.

## Security reports

Do not open a public issue for a vulnerability. See `SECURITY.md` and contact the maintainers privately.

## License

By contributing you agree that your contribution is licensed under the MIT License.
