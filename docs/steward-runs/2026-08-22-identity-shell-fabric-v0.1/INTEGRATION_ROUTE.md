# Review and integration route

Status: `EXPERIMENTAL` · route prepared, not executed.

The source branch is `codex/identity-shell-fabric-v0.1`, based on `d9066284e45eaedb07d8e7998b7c6a972e67c0c1`. The reviewable diff is intentionally additive and limited to:

- `shared/identity-shell-fabric/`
- `docs/steward-runs/2026-08-22-identity-shell-fabric-v0.1/`

## Before integration

1. Wait until the canonical Workshop checkout is not busy and confirm its current branch, head, and worktree state.
2. Review `git diff d9066284e45eaedb07d8e7998b7c6a972e67c0c1..codex/identity-shell-fabric-v0.1 --` and compare the 23 product hashes with `PRODUCT_FILE_HASHES.json`.
3. Confirm no shared registry, Hub, Foundation, Code Capability Fabric, Model Shadow Continuity, identity registry, return gate, or garden path appears in the diff.
4. Review the six optional gaps and the 41 preserved broad warnings. Neither set is closed by integration.

## Candidate integration command

From a clean, explicitly selected integration branch in the canonical Workshop repository:

```powershell
git cherry-pick codex/identity-shell-fabric-v0.1
```

If the target has moved and the cherry-pick conflicts, abort that integration attempt and re-evaluate the exact overlapping semantics. Do not resolve by overwriting a moving shared seam.

## Required post-integration evidence

Run the focused test:

```powershell
node shared/identity-shell-fabric/selftest.js
```

Then rerun all ten checks listed in the root `AGENTS.md`. A future visual editor requires a separate real browser render/click test. A future adapter host, authenticated human gate, or robotic body requires new native evidence and authority tests; current compiler evidence cannot be reused as runtime proof.

## Human gate

Mike Tobi remains the merge and `CANON` gate. Integration may make the leaf available for review in the target branch, but it does not install adapters, authenticate succession, activate a body, promote the fabric, or change `CANON`. No integration command was run by this steward task.
