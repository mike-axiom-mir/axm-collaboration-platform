# AXM Deterministic PR Publisher v0.1

Status: **EXPERIMENTAL**

This is the narrow network-writing adapter after the read-only Deterministic PR
Checkpoint. It turns an exact clean feature branch plus three verified packets
into a remote review branch, one draft pull request, and a sender/receiver
transport receipt. That lets local Keel spend reasoning on engineering while a
platform Axiom/Mir chat independently checks and merges the compact handoff.

It is deliberately not a general Git bot. It never stages or commits files,
force-pushes, pushes `main`, changes an existing branch non-fast-forward, marks a
PR ready, edits an existing non-draft PR, closes or merges a PR, deletes a
branch, promotes a module, changes AXM roots, or changes CANON.

## Windows-safe commands

Plan with remote reads only:

```powershell
tools\deterministic-pr-publisher\pr-publisher-cli.cmd plan `
  --repo D:\path\inside\publish\feature `
  --publish-root D:\path\inside\publish `
  --checkpoint D:\receipts\checkpoint.json `
  --verification D:\receipts\verification.json `
  --review D:\receipts\review-packet.json `
  --out D:\receipts\publish-plan.json
```

After reviewing that exact plan, publish once:

```powershell
tools\deterministic-pr-publisher\pr-publisher-cli.cmd publish `
  --repo D:\path\inside\publish\feature `
  --publish-root D:\path\inside\publish `
  --checkpoint D:\receipts\checkpoint.json `
  --verification D:\receipts\verification.json `
  --review D:\receipts\review-packet.json `
  --plan D:\receipts\publish-plan.json `
  --confirmation "PUBLISH EXACT CHECKPOINTED PR HANDOFF" `
  --out D:\receipts\publish-receipt.json
```

The host must already provide authenticated `git` and `gh` commands. AXM does
not read, accept, store, or print a token. Output is create-new and must remain
outside the inspected repository.

## Failure recovery

If the remote branch was accepted but GitHub PR confirmation failed, the tool
returns `REMOTE_BRANCH_PUSHED_PR_UNCONFIRMED`. Do not repush blindly. Inspect the
exact remote head, rebuild the plan, and retry the PR upsert. The tool never
deletes or rewinds remote state as an automatic rollback.
