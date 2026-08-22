# AXM Deterministic PR Base Refresh

Use this tool only after remote `main` advances beyond a clean, published,
checkpointed feature branch. `plan` binds the old checkpoint head, the exact
new `main`, the unchanged remote review branch, and the prospective merge tree.

Planning can download immutable commit/tree/blob objects into the repository
object database and can leave unreachable merge-analysis objects. It does not
move a ref, stage files, or edit the worktree.

`apply` requires this exact phrase:

```text
MERGE EXACT REMOTE MAIN INTO CHECKPOINTED REVIEW BRANCH
```

It creates one local `--no-ff` merge commit with fixed identity and a timestamp
deterministically one second after the newest parent. It never pushes
or edits the PR. After success, run the focused and full Workshop checks, create
a new deterministic checkpoint against the new main, and only then use the
deterministic publisher. Status remains `EXPERIMENTAL` until Mike/AXM decides
otherwise; this tool cannot promote, change roots, or change CANON.
