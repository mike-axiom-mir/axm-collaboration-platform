# AXM Deterministic PR Checkpoint v0.1

Status: **EXPERIMENTAL**

This machine-only gate reduces repeated review reasoning by turning one clean local Git branch into a compact, deterministic review packet. It binds the exact local base and head commits, head tree, ordered commits, changed paths, before/after Git objects, SHA-256 content digests, explicit scope policy, and optional evidence receipts.

The same committed objects, policy, and evidence produce the same checkpoint digest in a different filesystem location. The repository root, observation time, user identity, credentials, and raw remote URL are not retained.

## Honest boundary

`READY` means the inspected local Git objects satisfy the explicit policy. It does **not** mean:

- the remote ref is current (the gate never fetches);
- declared tests were executed by this tool;
- runtime, browser, visual, performance, or physical behavior passed;
- a PR was created or approved;
- merge, promotion, installation, or CANON is authorized.

Mike Tobi remains AXM's review, merge, and canon gate.

## Commands

On Windows, use the checked-in `.cmd` launcher below. Do not open or invoke the
`.js` file through its Windows file association: that can hand Node.js source to
Windows Script Host instead of Node.js.

```powershell
tools\deterministic-pr-checkpoint\pr-checkpoint-cli.cmd inspect `
  --repo D:\path\to\clean-worktree `
  --policy D:\receipts\policy.json `
  --evidence D:\receipts\evidence.json `
  --out D:\receipts\checkpoint.json

tools\deterministic-pr-checkpoint\pr-checkpoint-cli.cmd verify `
  --packet D:\receipts\checkpoint.json

tools\deterministic-pr-checkpoint\pr-checkpoint-cli.cmd render `
  --packet D:\receipts\checkpoint.json `
  --metadata D:\receipts\metadata.json
```

On any platform, explicit `node tools/deterministic-pr-checkpoint/pr-checkpoint-cli.js ...`
invocation remains supported.

Output is printed to stdout unless `--out` is supplied. File output is create-new, requires `--repo`, and must remain outside the inspected repository. A held checkpoint is still emitted and exits with code `2` so automation can preserve the exact reasons.

## Evidence semantics

Evidence receipts are data, not commands. The gate never runs the `command` field. A `PASS` claim requires a repository-relative evidence locator and a SHA-256 digest; the checkpoint independently reads that file from the exact head commit and holds a missing or mismatched blob. Required missing, failed, or unknown claims hold the packet. The native verifier for each claim still decides what the receipt actually proves.
