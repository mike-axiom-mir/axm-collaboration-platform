# Integration / Handoff Receipt — Native Game-Rule Candidate v1.4

Status: `TEST` · review branch only · not merged · not `CANON`

## Source

- Technical source commit:
  `f2a48de9569c3f10ed4c948422cc84f2375ace3c`
- Source branch:
  `codex/code-capability-fabric-native-game-rule-candidate-v1.4`
- Handoff branch:
  `codex/workshop-code-capability-fabric-native-game-rule-candidate-v1.4-integration-20260823`
- Source parent / previously verified Fabric v1.3 target:
  `e184f5b7542658da874ef4806ece871cfc8a3817`
- Common base with the current canonical recovery line:
  `dadd8a9f87c2cf70a7c444244483ee853276e745`

The technical source commit is a direct child of the previously verified v1.3
target. It contains the full required ancestry when merged as a branch, but it
must **not** be cherry-picked alone onto a target that lacks v1.0–v1.3.

## Current canonical target observation

Read-only observation at closeout:

- Branch: `codex/workshop-active-clean-20260823`
- Head: `6df59d8b9e63d09f73365c9ecee0216d54fd60b1`
- Git status entries: 0
- The previous Fabric target `e184f5b7...` is not an ancestor.
- The current target does not contain the v1.2 application planner, v1.2 plan
  schema, semantic candidate generator, or v1.3 Collaboration Room.

Therefore a direct fast-forward or one-commit cherry-pick is not a safe or
complete integration route.

## Drift and overlap analysis

Relative to common base `dadd8a9f...`:

- Current canonical recovery line changed 1,384 paths.
- Fabric source lineage through v1.4 changed 357 paths.
- Exact path overlap: one path, `.gitattributes`.
- Read-only `git merge-tree` preview reports that path as changed in both.

The safe union is the entire current canonical `.gitattributes` plus these two
Fabric-lineage rules (the source's `wasm-vips` rule already exists in the
current canonical file):

```gitattributes
tools/game-hub/game-library/020-four-roots-adventure/media/rendered/*.json text eol=lf
tools/game-hub/game-library/020-four-roots-adventure/media/rendered/*.vtt text eol=lf
```

Do not replace the current canonical `.gitattributes` with the older Fabric
side; it contains many recovery-line byte-stability rules that must survive.

## v1.4 changed paths

The bounded v1.4 source commit changes 19 paths:

- six new generator source/schema/contract/readme/selftest files under
  `shared/code-capability-fabric/`;
- one additive section in `shared/code-capability-fabric/README.md`;
- twelve append-only evidence files under this steward-run directory.

Review the full ancestry separately because the current canonical target lacks
the earlier Fabric integration rungs.

## Verified source result

- New focused suite: PASS, 77 checks.
- Inherited v1.2 planner: PASS, 87 checks.
- All Fabric selftests: PASS, 26/26 suites.
- All ten AGENTS.md checks: PASS, exit 0.
- `verify.js`: `0 FAIL · 22 warn · spine b618c5762240070c`.
- Browser: N/A; no visual surface changed.
- Candidate runtime, candidate tests, materialization, sandbox execution,
  installation, integration, publication, learning, promotion, and `CANON`:
  not run.

These results prove the source branch state. Because the current canonical
target has a divergent recovery lineage, the same checks must run again in the
combined review worktree before Mike considers integration.

## Exact safe review route

Run from the canonical Workshop checkout only after rechecking that it is clean
and still at the recorded head. This derives a sibling review worktree without
recording a machine-specific path, and does not switch, overwrite, or merge the
canonical checkout:

```powershell
$canonical = (git rev-parse --show-toplevel)
$review = Join-Path (Split-Path $canonical -Parent) 'workshop-code-capability-fabric-v1.4-review'
$expected = '6df59d8b9e63d09f73365c9ecee0216d54fd60b1'
$source = 'f2a48de9569c3f10ed4c948422cc84f2375ace3c'

if ((git -C $canonical status --porcelain=v1).Count -ne 0) { throw 'canonical checkout is dirty' }
if ((git -C $canonical rev-parse HEAD) -ne $expected) { throw 'canonical target drifted; re-audit first' }

git -C $canonical worktree add -b codex/workshop-code-capability-fabric-v1.4-review-20260823 $review $expected
git -C $review merge --no-commit --no-ff $source
```

Resolve only `.gitattributes` by preserving the current canonical file and
adding the two rendered-media rules above, then stage that one resolution.
Before any commit, inspect the complete staged merge and rerun:

```powershell
git -C $review diff --cached --name-status
git -C $review diff --cached --check

node verify.js
node hub/hub-selftest.js
node hub/route-selftest.js
node hub/graft-selftest.js
node hub/skin-selftest.js
node hub/verify-plus.js
node tests/html-script-syntax-test.js
node tests/tool-forge-package-test.js
node tools/agent-tool-forge/selftest.js
node tools/evidence-desk/selftest.js
```

Also rerun all `shared/code-capability-fabric/selftest*.js` suites. If any
conflict or regression appears beyond the recorded `.gitattributes` union,
abort the review merge with `git -C $review merge --abort` and re-steward the
seam. Do not commit the merge merely because it applies mechanically.

Mike remains the final decision and merge gate. This receipt authorizes no
merge into the canonical branch and no promotion or `CANON` change.
