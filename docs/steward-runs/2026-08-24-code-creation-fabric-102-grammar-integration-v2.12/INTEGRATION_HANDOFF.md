# Integration Handoff

Status: `TEST`

## Exact source and target assumption

- Draft review: GitHub PR 62
- Source branch:
  `codex/code-creation-fabric-102-grammar-integration-v2.12`
- Exact technical source commit:
  `0f00909e6263dae831426bcc3516be8bb346e071`
- Required stacked target branch: `codex/code-work-context-dock-v1`
- Expected target/base commit:
  `370af1c9a506807610c18561a711650a6cbfb8d6`

The technical source is a direct descendant of the expected target. It must not
be applied to a different base without repeating the integration review and all
verification.

## Changed paths relative to the expected target

Authored implementation and continuity tests:

- `shared/code-capability-fabric/README.md`
- `shared/code-capability-fabric/module.contract.json`
- `shared/code-capability-fabric/language-organs/README.md`
- `shared/code-capability-fabric/language-organs/code-creation-session-planner.js`
- `shared/code-capability-fabric/language-organs/code-creation-session-planner.contract.json`
- `shared/code-capability-fabric/language-organs/selftest-code-creation-session-planner.js`
- `tests/capability-fabric-package-test.js`
- `tools/capability-fabric/README.md`
- `tools/capability-fabric/selftest.js`
- `tools/capability-recipe-admission-gate/README.md`
- `tools/capability-recipe-admission-gate/selftest.js`

Regenerated views:

- `docs/generated/LEGO_CITY_BEGINNER_MAP.md`
- `docs/generated/LEGO_CITY_MAP.md`
- `registry/generated/city-authority-map.json`
- `registry/generated/city-capabilities.jsonl`
- `registry/generated/city-dependencies.json`
- `registry/generated/city-graph.json`
- `registry/generated/city-graph.receipt.json`
- `registry/generated/city-modules.json`
- `registry/generated/city-proof-map.json`
- `registry/generated/city-schemas.json`
- `registry/generated/city-twins.json`
- `registry/generated/city-unresolved-edges.json`
- `tools-index.json`

This steward-run directory is evidence-only and is added after the technical
source commit above.

## Safe Mike-controlled review route

Review PR 61 first, then PR 62 as a stacked descendant. To reproduce the exact
fast-forward in a detached `D:\AXM_ACTIVE` review worktree without touching the
busy canonical checkout:

```powershell
$repo = "D:\AXM_ACTIVE\workshop"
$review = "D:\AXM_ACTIVE\review\code-creation-fabric-v2.12"
$expectedBase = "370af1c9a506807610c18561a711650a6cbfb8d6"
$sourceCommit = "0f00909e6263dae831426bcc3516be8bb346e071"

git -C $repo fetch origin codex/code-work-context-dock-v1 codex/code-creation-fabric-102-grammar-integration-v2.12
$observedBase = git -C $repo rev-parse refs/remotes/origin/codex/code-work-context-dock-v1
if ($observedBase -ne $expectedBase) { throw "Target drifted; repeat integration review." }
if (Test-Path -LiteralPath $review) { throw "Review path already exists; choose a fresh D:\AXM_ACTIVE path." }

git -C $repo worktree add --detach $review $expectedBase
git -C $review merge --ff-only $sourceCommit
```

Rerun the focused Fabric suites and all ten required AGENTS checks in that
detached review tree. The commands above perform no update to
`D:\AXM_ACTIVE\workshop`. Installation, merge into the canonical branch,
promotion, and CANON remain separate explicit Mike decisions.
