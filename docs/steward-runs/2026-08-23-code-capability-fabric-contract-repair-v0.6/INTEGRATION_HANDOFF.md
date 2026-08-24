# Integration handoff

Status: `REVIEWABLE` · integration: `HOLD`

Source branch: `codex/code-capability-fabric-contract-repair-v0.6`

Required target base: a clean Mike-selected ref containing `cf9145f980c1c6f732aae71e4a8d1f1c6f6aac59`.

Commits carrying the bounded result:

1. `662af77f59d1456e76d96ea628ee630070a11e14` — implementation and tests.
2. `8071a89c8b1efd7e77413bd865d506d6a8740961` — sealed steward evidence.

## Changed implementation paths

- `shared/code-capability-fabric/README.md`
- `shared/code-capability-fabric/module-workshop-contract-repair-planner-v1.contract.json`
- `shared/code-capability-fabric/selftest-workshop-contract-repair-planner-v1.js`
- `shared/code-capability-fabric/workshop-contract-observation.schema.json`
- `shared/code-capability-fabric/workshop-contract-repair-candidate.schema.json`
- `shared/code-capability-fabric/workshop-contract-repair-plan.schema.json`
- `shared/code-capability-fabric/workshop-contract-repair-planner-v1.js`
- `shared/code-capability-fabric/workshop-contract-repair-request.schema.json`
- `tools/sandbox/README-workshop-shadow-sandbox-v1.md`
- `tools/sandbox/selftest-workshop-contract-repair-sandbox-v1.js`
- `tools/sandbox/workshop-contract-repair-draft-receipt.schema.json`
- `tools/sandbox/workshop-contract-repair-preview-v1.js`
- `tools/sandbox/workshop-contract-repair-sandbox-v1.js`
- `tools/workshop-shadow/README.md`
- `tools/workshop-shadow/index.js`
- `tools/workshop-shadow/manifest.json`
- `tools/workshop-shadow/module.contract.json`
- `tools/workshop-shadow/selftest.js`

Evidence is confined to `docs/steward-runs/2026-08-23-code-capability-fabric-contract-repair-v0.6/`.

## Safe review now

Run from any checkout of the shared Workshop repository:

```powershell
git show --stat --oneline 662af77f59d1456e76d96ea628ee630070a11e14
git show --stat --oneline 8071a89c8b1efd7e77413bd865d506d6a8740961
git diff --stat cf9145f980c1c6f732aae71e4a8d1f1c6f6aac59..8071a89c8b1efd7e77413bd865d506d6a8740961
```

These commands are read-only.

## Safe integration after recovery settles

Run only from the clean Mike-selected canonical checkout. The guards deliberately stop if the checkout is dirty, if Fabric v0.5 is absent, or if the review worktree/branch already exists.

```powershell
$ExpectedBase = 'cf9145f980c1c6f732aae71e4a8d1f1c6f6aac59'
$SelectedTarget = (git rev-parse HEAD).Trim()
$Pending = @(git status --porcelain=v1 -uall)
if ($Pending.Count -ne 0) { throw 'HOLD: selected canonical checkout is not clean' }
git merge-base --is-ancestor $ExpectedBase $SelectedTarget
if ($LASTEXITCODE -ne 0) { throw 'HOLD: selected target does not contain Fabric v0.5' }
$ReviewPath = Join-Path (Split-Path (git rev-parse --show-toplevel) -Parent) 'workshop-contract-repair-v0.6-integration-review'
if (Test-Path -LiteralPath $ReviewPath) { throw 'HOLD: review worktree path already exists' }
git show-ref --verify --quiet refs/heads/codex/code-capability-fabric-contract-repair-v0.6-integration-review
if ($LASTEXITCODE -eq 0) { throw 'HOLD: review branch already exists' }
git worktree add $ReviewPath -b codex/code-capability-fabric-contract-repair-v0.6-integration-review $SelectedTarget
git -C $ReviewPath cherry-pick 662af77f59d1456e76d96ea628ee630070a11e14 8071a89c8b1efd7e77413bd865d506d6a8740961
```

After cherry-pick, rerun every AGENTS.md command and the focused Fabric suites in that review worktree. Mike then reviews the diff and decides whether to merge. Nothing in this route writes into the busy recovery checkout, and nothing promotes or changes `CANON`.

## Verification carried with the handoff

- all ten AGENTS.md commands: PASS;
- final focused continuity set: PASS after disclosed serial supersession;
- actual trusted-preview browser render/click: PASS;
- `verify.js`: exit 0, 22 warning lines, 0 failure lines;
- candidate-specific target tests: `NOT_RUN`;
- candidate execution/install/integration/promotion/CANON: false.
