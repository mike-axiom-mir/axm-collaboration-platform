# Code Capability Fabric v0.7 integration handoff

Status: `TEST` / `HOLD` for the currently active recovery checkout.

Mike remains the final merge gate. This document records a safe review route;
it is not permission to merge, install, promote, publish, or `CANON`.

## Exact source

- source branch: `codex/code-capability-fabric-human-selection-v0.7`
- required target base or ancestor: `a2e29534c837de0ffec6347ba2023cdfea0a97b2`
- technical commit: `f9534d05bb231d7a9235e4589365cb4a0badfb08`
- sealed test/evidence commit: `57e6a61e06a1fcce35c6760bb67cbe6ac7822f31`

The handoff-only commit containing this final drift record is review metadata;
the two commits above are the exact bounded product-and-evidence integration
set.

## Target assumptions

Before integration, Mike must select a target checkout that:

1. is clean;
2. contains `a2e29534c837de0ffec6347ba2023cdfea0a97b2` as an ancestor;
3. has been rechecked for changed-path overlap and target drift;
4. is copied into a separate review worktree rather than modified in the busy
   canonical checkout.

The final observed recovery target fails assumptions 1 and 2. Therefore the
commands below intentionally stop before creating a review worktree when run
against that target.

## Guarded review and integration route

Run these PowerShell commands from the Mike-selected canonical checkout only
after the recovery work has produced a clean target:

```powershell
$requiredBase = 'a2e29534c837de0ffec6347ba2023cdfea0a97b2'
$technicalCommit = 'f9534d05bb231d7a9235e4589365cb4a0badfb08'
$evidenceCommit = '57e6a61e06a1fcce35c6760bb67cbe6ac7822f31'
$reviewWorktree = '..\workshop-fabric-human-selection-review-v0.7'

git merge-base --is-ancestor $requiredBase HEAD
if ($LASTEXITCODE -ne 0) { throw 'HOLD: selected target does not contain v0.6' }

$dirty = git status --porcelain=v1 --untracked-files=all
if ($dirty) { throw 'HOLD: selected target is not clean' }

git diff --check "$requiredBase..$evidenceCommit"
if ($LASTEXITCODE -ne 0) { throw 'HOLD: source diff check failed' }

git worktree add $reviewWorktree -b codex/review-code-capability-fabric-human-selection-v0.7 HEAD
git -C $reviewWorktree cherry-pick $technicalCommit $evidenceCommit
if ($LASTEXITCODE -ne 0) { throw 'HOLD: cherry-pick requires human review' }
```

Do not run the final cherry-pick in the current dirty recovery checkout. After
the isolated review worktree passes all checks below, Mike may inspect the diff
and decide whether to integrate it through the recovery branch's own merge
process.

## Changed paths

Implementation commit (7 paths):

- `shared/code-capability-fabric/README.md`
- `shared/code-capability-fabric/human-candidate-selection-binder-v1.js`
- `shared/code-capability-fabric/human-candidate-selection-declaration.schema.json`
- `shared/code-capability-fabric/human-candidate-selection-evaluation.schema.json`
- `shared/code-capability-fabric/module-human-candidate-selection-binder-v1.contract.json`
- `shared/code-capability-fabric/selection-replay-ledger-snapshot.schema.json`
- `shared/code-capability-fabric/selftest-human-candidate-selection-binder-v1.js`

Sealed evidence commit (11 paths): every file present at that commit under
`docs/steward-runs/2026-08-23-code-capability-fabric-human-selection-v0.7/`.

## Verification to repeat in the isolated review worktree

The source branch passed:

- 35/35 new adversarial human-selection cases;
- 26/26 focused Fabric and continuity selftest scripts;
- all 10 commands required by `AGENTS.md`;
- JSON, schema-reference, Node syntax, sensitive-path, and diff checks.

`verify.js` and `hub/verify-plus.js` each retained the same 22 warning lines.
Browser testing was N/A because no visual surface changed. Candidate execution,
candidate target tests, installation, integration, promotion, publication, and
`CANON` were not run.

Repeat every `AGENTS.md` command after cherry-pick. A new warning, failed check,
changed byte, new path overlap, or target drift returns the handoff to `HOLD`.
