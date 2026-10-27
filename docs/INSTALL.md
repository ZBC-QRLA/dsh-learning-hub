# Install and update

## Requirements

- DSH `>=0.2.1-rc.3 <0.3.0-0`
- Node.js `>=20` for tests and local tools
- A directory for learner data (`_learner`) containing at least `profile.md`, `branches.json`, `concepts.json`

Replace `<DSH_HOME>` below with your DSH install directory.

## From a checkout

```powershell
# 1. Link into a profile (desktop or a test profile)
dsh plugin --profile desktop add D:\path\to\dsh-learning-hub

# 2. Configure the profile
# <DSH_HOME>\profiles\desktop\cordis.patch.yml
```

```yaml
- id: learning-hub
  name: dsh-learning-hub
  config:
    dataRoot: 'D:\path\to\learner'
    panelDir: 'D:\path\to\dsh-learning-hub\public'
    # port: 19480   # optional separate loopback port
```

3. Restart DSH. Confirm:
   - tool `learning_hub` appears;
   - `http://127.0.0.1:<port>/learning-hub/` returns 200;
   - `/api/learning-hub/state` returns `schema: learning-hub.state/v1`.

Without config, the plugin uses `examples/demo-learner` and `public/`.

## Test profile (recommended for changes)

```powershell
dsh plugin --profile learning-hub-test add D:\path\to\dsh-learning-hub
```

Set a fixed web port in the test profile (`cordis.patch.yml`) and point `dataRoot` to a copy of the demo — never to real data.

## Update

```powershell
# backup profile first
Copy-Item <DSH_HOME>\profiles\desktop\package.json <DSH_HOME>\profiles\desktop\package.json.bak-YYYYMMDD
Copy-Item <DSH_HOME>\profiles\desktop\cordis.patch.yml <DSH_HOME>\profiles\desktop\cordis.patch.yml.bak-YYYYMMDD

dsh plugin --profile desktop add D:\path\to\dsh-learning-hub
```

- `lib/` changes need a DSH restart.
- `public/` panel changes only need a browser refresh.
- Data changes are hot; the plugin reads files per request.

## Uninstall / rollback

```powershell
dsh plugin --profile desktop remove dsh-learning-hub
```

Restore profile backups and restart DSH.
Restore data from `_learner/.backups/` (per-file snapshots) or your own `.bak-*` copies.

## Troubleshooting

| Symptom | Check |
|---|---|
| `learning_hub` missing | plugin installed? profile bundle includes `dsh-learning-hub`? restart done? |
| `/learning-hub/` 404 | DSH port changed? open current origin + `/learning-hub/` (use the launcher) |
| HTML loads but CSS/JS 404 | an old DSH process is serving a pre-fix route; restart DSH |
| `state` empty / demo | `dataRoot` wrong; check config and file permissions |
| record 403 | request not same-origin; use the panel or same-origin fetch |
| record 413 | body over 64 KiB |
| panel shows builtin fallback | `panelDir` missing `index.html`; check config |
| path escapes | `dataRoot` must be the real learner root; symlinks outside are rejected |

## Ports

DSH desktop starts with `--port 0`, so the port changes on restart. Do not bookmark `127.0.0.1:<port>`. Use a launcher that reads the current port, or ask the agent to open the panel with the current origin.
