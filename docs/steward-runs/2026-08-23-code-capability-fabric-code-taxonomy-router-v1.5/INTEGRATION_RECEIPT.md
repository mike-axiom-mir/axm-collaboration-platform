# Canonical integration and review handoff

Status: `REVIEW_REQUIRED` · integration not performed

## Exact source and target assumptions

- Technical source branch: `codex/code-capability-fabric-code-taxonomy-router-v1.5`
- Technical source commit: `3b2771a256c6b5b2a060260744aa7dfe23c60b54`
- Source parent/handoff: `94f536d16514b0f7207167e4721f60f248ab36cd`
- Canonical target branch observed: `codex/workshop-active-clean-20260823`
- Canonical target commit observed: `0f54e9db45679a2f5405e393a1236ebcaf75a4fa`
- Common base: `dadd8a9f87c2cf70a7c444244483ee853276e745`
- Canonical target status at observation: clean

The canonical target advanced during this steward run. Earlier target
assumptions are superseded by the exact commit above.

## Drift and overlap audit

- Source changed paths from the common base: 372.
- Target changed paths from the common base: 1470.
- Exact changed-path overlap: one path, `.gitattributes`.
- Read-only `git merge-tree` preview reports that path as changed in both but
  emits no textual conflict marker.
- The target now contains Deterministic Organ Fabric v1.1 and Capability Recipe
  Admission Gate changes that are absent from the source lineage.
- The target contains the base Fabric v2 planner but does not contain the
  semantic generator, v1.3 Collaboration Room, or v1.4 native game-rule
  candidate required by this branch's tested continuity.

Do **not** cherry-pick only the v1.5 technical commit onto the observed target.
The module imports prior Fabric lineage that the target does not yet contain.
Review a full branch merge in a separate worktree.

## `.gitattributes` union requirement

Preserve the observed target file in full, including its newer deterministic
organ, capability-fabric, runtime, vendor, registry, and tool byte-stability
rules. Confirm the reviewed merge also contains these source-line additions:

```gitattributes
tools/game-hub/game-library/020-four-roots-adventure/media/rendered/*.json text eol=lf
tools/game-hub/game-library/020-four-roots-adventure/media/rendered/*.vtt text eol=lf
```

The target already contains the `wasm-vips/vips.js text eol=lf` rule; do not
duplicate it. Never resolve this seam by replacing the target file wholesale
with the older source-line file.

## Exact safe review route

Run from the clean canonical checkout. This creates a separate sibling review
worktree; it does not alter the canonical checkout:

```powershell
$expectedTarget = '0f54e9db45679a2f5405e393a1236ebcaf75a4fa'
$sourceCommit = '3b2771a256c6b5b2a060260744aa7dfe23c60b54'
$actualTarget = (git rev-parse HEAD).Trim()
if ($actualTarget -ne $expectedTarget) { throw "Target drifted to $actualTarget; repeat the overlap and merge-tree audit." }
if ((git status --porcelain).Count -ne 0) { throw 'Canonical checkout is not clean; stop.' }
$canonicalRoot = (git rev-parse --show-toplevel).Trim()
$reviewRoot = Join-Path (Split-Path -Parent $canonicalRoot) 'workshop-code-capability-fabric-v1.5-integration-review'
if (Test-Path -LiteralPath $reviewRoot) { throw "Review path already exists: $reviewRoot" }
git worktree add -b codex/workshop-code-capability-fabric-v1.5-integration-review $reviewRoot $expectedTarget
git -C $reviewRoot merge --no-ff --no-commit $sourceCommit
```

Then inspect `.gitattributes` against the union requirement above and inspect
all staged changes. If Git reports a conflict, resolve only that exact file to
the described union; do not discard either lineage. Confirm no unresolved path
remains:

```powershell
git -C $reviewRoot diff --name-only --diff-filter=U
git -C $reviewRoot diff --cached --check
git -C $reviewRoot status --short
git -C $reviewRoot diff --cached --stat
```

Before Mike decides, rerun:

```powershell
Push-Location $reviewRoot
try {
node shared/code-capability-fabric/selftest-code-specialization-router-v1.js
$tests = Get-ChildItem -LiteralPath shared/code-capability-fabric -Filter 'selftest*.js' | Sort-Object Name
foreach ($test in $tests) { node $test.FullName; if ($LASTEXITCODE -ne 0) { throw "Fabric selftest failed: $($test.Name)" } }
node shared/deterministic-organ-fabric/selftest.js
node tools/deterministic-organ-fabric/selftest.js
node tests/deterministic-organ-fabric-package-test.js
node tests/deterministic-organ-fabric-mirror-connection-test.js
node tools/capability-recipe-admission-gate/selftest.js
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
} finally {
  Pop-Location
}
```

Also run the deterministic-organ-fabric and capability-recipe-admission-gate
focused suites from the target lineage, because those components changed after
the earlier Fabric handoff. Review their contracts beside the new code
specialist profile contract; do not infer the missing organ-intent adapter.

Only after the complete diff, `.gitattributes` union, all tests, visible 22
warning baseline, and the new organ-fabric compatibility seam are reviewed may
Mike choose whether to create a merge commit. No merge command completing that
decision was run by this steward task.
