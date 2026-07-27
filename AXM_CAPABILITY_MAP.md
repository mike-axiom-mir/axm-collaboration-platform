# AXM Capability Map

AXM's public body changes quickly. This page gives stable navigation while the
generated registries carry exact current records.

| Family | Primary public surfaces | What to inspect |
|---|---|---|
| Create and build | `tools/studio`, `tools/game-forge`, `tools/asset-fabric`, `tools/audio-studio`, `tools/film-motion-studio`, `tools/spatial-studio`, `tools/research-foundry` | Inputs, outputs, editable sources, validation, and declared permissions |
| Play and worlds | `tools/game-hub`, `worlds`, `shared/game-*`, `shared/physics` | Game manifests, controller paths, deterministic rules, saves, and known limits |
| Evidence, repair, governance | `tools/evidence-desk`, `tools/diagnostics-operations-center`, `tools/recovery-center`, `tools/review-inbox`, `shared/readiness`, `shared/governance` | Claim evidence, self-tests, rollback receipts, review seats, and refusal rules |
| Human-machine collaboration | `tools/ai-team`, `tools/technical-glasses`, `shared/handoffs`, `shared/specialists`, optional connectors | Identity, capabilities, typed handoffs, network boundaries, and authority limits |
| Local operations and delivery | `tools/workshop-packager`, `tools/source-control-merge-workbench`, `tools/workshop-updater`, `tools/body-pulse`, `shared/operations`, `shared/heartbeat` | Public-safety policy, exact digests, schedules, gates, and explicit human actions |

## Query the exact registry

Use [`registry/modules.json`](registry/modules.json) to select modules by status,
kind, audience, contract, or test path. Use
[`registry/capabilities.jsonl`](registry/capabilities.jsonl) to find providers
and consumers without guessing from filenames.

Example with Node.js:

```sh
node -e "const r=require('./registry/modules.json'); console.log(r.modules.filter(x=>x.status==='WORKING').map(x=>x.id))"
```

Provider records are declarations. Check the referenced module status and test
evidence before treating a capability as executable or verified.
