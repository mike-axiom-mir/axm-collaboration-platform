# AXM Deterministic Run Integrator

This tool prevents completed builder runs from being poured back into a mixed,
dirty Workshop. It creates one isolated Git worktree, admits only declared and
hashed changes, seals them as one deterministic commit, fast-forwards the exact
unchanged target, and removes the integrated lane.

## Workflow

1. Copy `policy.example.json` outside the repository and set a unique `runId`,
   the current `codex/` or `agent/` target branch, and exact allowed paths.
2. Run `begin` with `CREATE EXACT ISOLATED RUN LANE`.
3. Run the already-authorized builder and focused tests inside the new lane.
4. Run `plan`, then `verify-plan`. A held plan makes no Git mutation.
5. Run `apply` with `SEAL AND FAST-FORWARD EXACT RUN`.
6. Run the full Workshop verification and deterministic PR checkpoint.

`apply` is deliberately the single post-run integration command: it rechecks
the plan, stages only declared paths, creates a deterministic commit,
proves the staged blob IDs and file modes still match the plan, fast-forwards
only the exact clean target, and removes the lane and run branch.
If the target drifted after sealing, the exact run commit stays safely isolated
and the receipt says so.

This module is `EXPERIMENTAL`. It does not choose or execute a builder, execute
tests, resolve conflicts, fetch, push, write `main`, rebase, reset, force-update,
run configured Git content filters, promote, alter roots, or change CANON.
