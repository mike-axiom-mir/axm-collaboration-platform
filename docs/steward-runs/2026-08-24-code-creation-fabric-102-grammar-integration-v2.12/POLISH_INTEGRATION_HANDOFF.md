# Polished Current-Finish Integration Handoff

Status: `TEST`

- Exact polished technical source:
  `011bc5a54347d3181d075255f23fd40ee436db58`
- Required stacked target: `codex/code-work-context-dock-v1`
- Expected target commit:
  `370af1c9a506807610c18561a711650a6cbfb8d6`
- Review: GitHub PR 62, after PR 61

Use a fresh detached review worktree. Do not modify the busy canonical checkout:

```powershell
$repo = "D:\AXM_ACTIVE\workshop"
$review = "D:\AXM_ACTIVE\review\code-creation-fabric-v2.12-polished"
$expectedBase = "370af1c9a506807610c18561a711650a6cbfb8d6"
$sourceCommit = "011bc5a54347d3181d075255f23fd40ee436db58"

git -C $repo fetch origin codex/code-work-context-dock-v1 codex/code-creation-fabric-102-grammar-integration-v2.12
$observedBase = git -C $repo rev-parse refs/remotes/origin/codex/code-work-context-dock-v1
if ($observedBase -ne $expectedBase) { throw "Target drifted; repeat integration review." }
if (Test-Path -LiteralPath $review) { throw "Review path already exists; choose a fresh D:\AXM_ACTIVE path." }

git -C $repo worktree add --detach $review $expectedBase
git -C $review merge --ff-only $sourceCommit
```

Rerun the focused Fabric suites and all ten required `AGENTS.md` checks in that
detached tree. Installation, integration into the canonical branch, promotion,
publication, and CANON remain separate explicit Mike decisions.
