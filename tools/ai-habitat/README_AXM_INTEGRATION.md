# AXM Workshop integration

This directory preserves the reviewed AXM AI Habitat v0.3.0 package and adds a
small, explicit Workshop integration layer.

## Start

Double-click `START_AI_HABITAT.cmd` or run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start_windows.ps1
```

The launcher tries system `python.exe`, the Windows `py -3` launcher, and then
the Codex desktop bundled Python runtime. It starts the Habitat on
`http://127.0.0.1:8765` and opens it in the default browser.

To stop a detached or background Habitat later, double-click
`STOP_AI_HABITAT.cmd`. Its PowerShell guard checks the process command line and
refuses to terminate an unrelated process that happens to own port 8765.

## What is wired

`workshop_runtime.py` starts the upstream Habitat server plus the loopback-only
`adapters/workshop_presence.py` bridge.

- It discovers AXM Workshop on ports 8788 through 8808.
- It reads `/api/presence` and mirrors AI or machine heartbeats as
  `workshop-*` Habitat seats.
- It posts an `ai-habitat` heartbeat back to the Workshop.
- It filters out human heartbeats and never grants mirrored seats action-room
  permissions beyond `commons`.
- If the Workshop disappears for three polls, mirrored seats become offline.

The bridge does not call a model, read credentials, execute Habitat intents,
approve permissions, expose either server beyond loopback, or contact the
internet.

## Workshop discovery

The Workshop server discovers `manifest.json` dynamically, so this module
appears in the Hub without editing `tools-index.json`, registry files, the Hub,
or the root server.

## Verify

```powershell
node selftest.js
$env:PYTHONUTF8 = '1'
python -m unittest tests.test_workshop_presence
python tests/verify_build.py
```

The last command is the upstream runtime-preserving verifier. It temporarily
replaces this module's `runtime` directory and restores it in a `finally`
block. Do not interrupt that verifier after storing important Habitat state.
