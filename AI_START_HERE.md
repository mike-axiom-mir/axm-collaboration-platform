# AI: start with current ground truth

Do not reconstruct AXM from chat memory, archive names, or this repository's
narrative README.

## Static public discovery

Read these without running the Workshop:

1. [`AXM_DISCOVERY_ROOT.md`](AXM_DISCOVERY_ROOT.md) - scope and navigation.
2. [`registry/public-status.json`](registry/public-status.json) - honest public
   gates and limitations.
3. [`registry/modules.json`](registry/modules.json) - modules, contracts,
   self-tests, readiness, and source paths.
4. [`registry/capabilities.jsonl`](registry/capabilities.jsonl) - one
   capability relationship per line for search and machine intake.
5. [`registry/proofs.json`](registry/proofs.json) - which evidence can support
   each public claim.

These files are generated from `tools-index.json`; they describe declared and
structural facts. They do not turn a declaration or self-test path into runtime
proof, permission, promotion, or canon.

## Live ground truth

If the local Hub is running, read:

- `/api/workshop/technical-glasses?focus=<the current task>` for structured JSON.
- `/api/workshop/technical-glasses.txt?focus=<the current task>` for a compact
  briefing.

If the Hub is not running, compile the same view directly:

```powershell
node shared/technical-glasses/technical-glasses-cli.js --focus="the current task"
```

Recompile after edits. Cite manifests, contracts, readiness, tests, and exact
digests. Mark missing facts `UNKNOWN`; do not guess permissions, readiness,
completion, quality, or human approval.
