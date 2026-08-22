# AXM Deterministic PR Sequencer v0.1

Status: **EXPERIMENTAL**

This read-only advisor closes the multi-PR gap after deterministic checkpoint
and publication. It combines one explicit candidate order, exact expected
heads, public-safe platform handoff receipts, and fresh GitHub receiver facts.
It emits at most one technical next candidate, then requires a complete reprobe
after that candidate is acted on.

The compact handoff also projects which later checkpointed candidates will need
refresh if that exact merge advances `main`, while keeping already-held work and
its reasons separate. This forecast is conditional and never substitutes for
the required post-action receiver reprobe.

`NEXT_READY` means the declared technical evidence matched. It is not approval,
merge permission, promotion, roots, or CANON. Platform Axiom/Mir still performs
an independent review and may reject the candidate.

The sequencer holds when it observes a stale checkpoint base, changed head,
missing or invalid handoff, draft PR, incomplete or failed required checks,
unclean GitHub merge state, route mismatch, unlisted review work, or an
out-of-order merge. It never skips a blocked predecessor.

## Windows-safe commands

```powershell
tools\deterministic-pr-sequencer\pr-sequencer-cli.cmd plan `
  --policy D:\receipts\sequence-policy.json `
  --handoff D:\receipts\pr-32-handoff.json `
  --handoff D:\receipts\pr-33-handoff.json
```

To preserve a packet, add `--workspace-root <git-root> --out
<external-create-new-file>`. Output inside the repository and overwrite are
refused.

The host must already provide an authenticated `gh` session. The sequencer does
not read, accept, store, or print a token. Its host adapter only calls `gh
--version`, `gh auth status`, `gh api` for the main ref, and `gh pr list/view`.

After any platform action, discard the old plan and run `plan` again.
