# Steward-run receipt

Status: `TEST` · not installed · not integrated · not promoted · not `CANON`

Technical commit:
`6fb342894d98c3f606d79a9f48225c658a0dfab4`

## Changed paths

- `shared/code-capability-fabric/README.md`
- `shared/code-capability-fabric/module-workshop-shadow-improvement-planner-v1.contract.json`
- `shared/code-capability-fabric/selftest-workshop-shadow-improvement-planner-v1.js`
- `shared/code-capability-fabric/workshop-shadow-improvement-plan.schema.json`
- `shared/code-capability-fabric/workshop-shadow-improvement-planner-v1.js`
- `shared/code-capability-fabric/workshop-shadow-refresh-request.schema.json`
- `shared/code-capability-fabric/workshop-shadow-snapshot.schema.json`
- `tools/sandbox/README-workshop-shadow-sandbox-v1.md`
- `tools/sandbox/selftest-workshop-shadow-sandbox-v1.js`
- `tools/sandbox/workshop-shadow-draft-receipt.schema.json`
- `tools/sandbox/workshop-shadow-preview-v1.js`
- `tools/sandbox/workshop-shadow-sandbox-v1.js`
- `tools/workshop-shadow/README.md`
- `tools/workshop-shadow/index.js`
- `tools/workshop-shadow/manifest.json`
- `tools/workshop-shadow/module.contract.json`
- `tools/workshop-shadow/selftest.js`

## What changed

- added closed request, snapshot, plan, and receipt contracts
- added a pure deterministic planner with an exact four-root gate
- added one allowlisted current-Workshop `tools-index.json` refresh recipe
- added privacy-scoped exact input observations and generator-byte lineage
- added disjoint immutable source/output/evidence shadow roots
- added pre-write, post-write, resume, refresh, and preview stale checks
- added strict emitted-record, path, alias, resource, privacy, and authority checks
- added a script-free trusted loopback review with an inert JSON candidate
- added a separate `workshop-shadow` TEST tool identity without changing the
  byte-bound existing Sandbox identity

## Truth ceiling

The implemented result can detect and draft only a stale/missing/invalid tools
index. It cannot judge arbitrary improvements, recover repository history,
execute candidates, write back, install, integrate, publish, promote, learn, or
alter CANON. Passing tests do not make it CANON. Mike remains the merge gate.

See `TEST_REPORT.md`, `BROWSER_EVIDENCE.md`, `LIVE_SHADOW_OBSERVATION.json`,
`FOUR_ROOT_GATE.json`, and `TARGET_DRIFT_PRECOMMIT.md` for exact evidence and
remaining holds.

