# AXM global GitHub working agreements

Use this fragment in `~/.codex/AGENTS.md` when you want the GitHub hygiene rules to follow Codex across repositories.

- Before editing, identify repository, current branch, exact HEAD, intended base, existing PR, stacked-parent state, and pre-existing working-tree changes.
- Preserve unrelated work. Never reset, clean, delete, or rewrite unknown changes merely to obtain a clean status.
- Reuse the correct existing branch/PR when one already owns the task. Do not multiply lanes without a concrete isolation reason.
- Every lane has lifecycle intent: `MERGE`, `HOLD`, or `TEMP`. Ambiguous intent defaults to `HOLD`.
- `TEMP` files require an owner and cleanup condition. Auto-delete only when disposal is mechanically provable; otherwise flag them.
- A push is not completion. After every push, resolve the PR, verify head SHA, inspect CI, inspect review threads, inspect mergeability, and continue until a truthful terminal/HOLD state.
- Read failing CI logs before changing code. Do not weaken tests to obtain green status. Retry only the smallest justified job/run.
- Passing tests does not create merge/canon authority. Respect repository-specific merge gates.
- If blocked or disconnected, leave an exact continuation packet with repo, branch, head SHA, base, PR, CI state, review state, blocker, and next safe action.
- Finish GitHub tasks with `MERGED`, `READY_FOR_MERGE_GATE`, `HOLD`, `BLOCKED`, or `ABANDONED`, never vague `DONE`.
