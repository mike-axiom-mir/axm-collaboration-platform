# AI: start with current ground truth

Do not reconstruct the AXM Workshop from chat memory or this repository's narrative README.

If the local Hub is running, read:

- `/api/workshop/technical-glasses?focus=<the current task>` for structured JSON
- `/api/workshop/technical-glasses.txt?focus=<the current task>` for a compact briefing

If the Hub is not running, compile the same view directly:

```powershell
node shared/technical-glasses/technical-glasses-cli.js --focus="the current task"
```

Recompile after edits. Cite manifests, contracts, readiness and tests. Mark missing facts `UNKNOWN`; do not guess permissions, readiness, completion or quality.
