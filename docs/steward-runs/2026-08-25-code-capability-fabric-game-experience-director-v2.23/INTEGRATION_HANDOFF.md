# Integration handoff

Status: reviewable `TEST`; not merged.

## Target assumption

The selected target must already contain
`e5e0163e513e02f147c791fecd98decd3caec87c`, the final v2.22 base. The v2.23
branch is stacked on that commit. Do not cherry-pick only the promotion commit:
it depends on the experience-flow source commit immediately before it.

## Safe review route

Prefer review of the complete branch diff against
`codex/code-capability-fabric-prebuild-asset-aware-game-v2.22`. Before any local
integration, use a clean Mike-selected checkout and re-check both ancestry and
worktree state:

```powershell
git fetch origin
git status --short
git merge-base --is-ancestor e5e0163e513e02f147c791fecd98decd3caec87c HEAD
git merge --ff-only origin/codex/code-capability-fabric-game-experience-director-v2.23
```

The status output must be empty and the ancestry command must exit zero. If the
selected target has moved or contains unrelated work, stop and review the PR
instead of overwriting, force-merging, or mutating a busy checkout.

## Review scope

- Code Capability Fabric experience-flow source and schemas.
- Exact Twin Sparks v0.4 candidate and Game Hub slot 023 trusted host.
- Mike direction and installation receipts.
- Deterministically refreshed city, schema, twin, and tools-index views.
- Append-only steward evidence in this directory.

Mike remains the merge gate. Passing this route does not make the result
`CANON`.
