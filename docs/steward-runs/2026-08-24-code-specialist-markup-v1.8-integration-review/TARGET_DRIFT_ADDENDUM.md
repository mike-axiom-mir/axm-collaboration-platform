# Target Drift Addendum

Date: 2026-08-24

Status: `TEST` source sealed; canonical integration paused because the target
checkout is busy.

## Sealed source

- Technical integration merge:
  `bfdaaabadf597ae487c824d3e62f6ef311acc940`
- Evidence-closure source:
  `6df8e999c9a5ee40a7645510856450dec69c2fb4`
- Evidence closure adds seven receipt paths to the 435-path technical payload.
- Relative to the committed target, the evidence-closure source has 442 changed
  paths with UTF-8 LF path-set SHA-256
  `c07d6c396bd71de06b6a110edc969ac374e5e9b4cca28a0981e689dd53cea14d`.

## Final target re-check

- Target branch: `codex/workshop-active-clean-20260823`
- Target commit remained:
  `4aa2097aa1145109a801ae76d3ee9ce7d1bb7a57`
- The committed target remains an ancestor of the evidence-closure source.
- Merge-tree against the committed target: exit 0, tree
  `48c46bd3e95fbe111e26e3997e598fcc107ad963`.
- The canonical working checkout was not clean at final re-check: 16 porcelain
  entries comprising four modified paths, ten deleted paths under the prior
  object-adapter pilot, and two untracked entries.

The live changes appear to be a concurrent object-adapter repair/re-pilot:

- modified `package.json`, builder registry, adapter parameter schema, and
  tools index;
- removal of the prior `b215a3643afe` adapter pilot directory;
- an untracked adapter review test and replacement `35d55de7fc30` pilot
  directory.

This is observation, not ownership attribution. No file in the canonical
checkout was edited, staged, restored, removed, or committed by this run.

## Safe integration condition

Do not fast-forward the canonical branch while those changes are present. The
following guard is the exact next review action and currently stops by design:

```powershell
$expectedTarget = "4aa2097aa1145109a801ae76d3ee9ce7d1bb7a57"
$sourceCommit = "6df8e999c9a5ee40a7645510856450dec69c2fb4"
$targetCommit = git -C $targetRepo rev-parse HEAD
$targetState = @(git -C $targetRepo status --porcelain)
if ($targetState.Count -ne 0) { throw "Target is busy; preserve and finish its current work first." }
if ($targetCommit -ne $expectedTarget) { throw "Target drifted; rebuild the merge-tree and review the new overlap." }
git -C $targetRepo merge-base --is-ancestor $expectedTarget $sourceCommit
if ($LASTEXITCODE -ne 0) { throw "Target is not an ancestor of the reviewed source." }
git -C $targetRepo merge-tree --write-tree --messages $expectedTarget $sourceCommit
```

Only after those guards pass should a detached review worktree perform
`git merge --ff-only 6df8e999c9a5ee40a7645510856450dec69c2fb4`, rerun the receipt's tests, and
hand the final fast-forward decision to Mike.

If the live adapter repair is committed, the target commit will change and
this integration review must be recomposed against that new commit. Do not
discard the repair and do not assume the current clean merge-tree still
applies.

No canonical merge, installation, adapter activation, publication, promotion,
or CANON action was performed.

