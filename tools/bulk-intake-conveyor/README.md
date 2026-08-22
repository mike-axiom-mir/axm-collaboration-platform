# AXM Bulk Intake Conveyor

Bulk Intake Conveyor is the preparation layer for large modular deliveries. It composes the existing Archive Intake Cartographer into one resumable work receipt so fourteen carriers can arrive together without becoming fourteen separate orientation meetings.

It does four deterministic things:

1. hashes and structurally maps every ZIP below one explicit folder;
2. parks byte-exact duplicate copies while keeping all source files untouched;
3. routes unsafe structure, overlapping carriers, and active module name collisions into compact judgment queues;
4. groups manifest-root candidates into bounded deeper-review batches.

## One-command intake map

```powershell
node tools\bulk-intake-conveyor\intake-cli.js `
  --root "C:\path\to\tonights-intake" `
  --workshop-root "C:\axm workshop" `
  --output "C:\axm workshop\state\bulk-intake\current-receipt.json" `
  --receipt-dir "C:\axm workshop\state\bulk-intake\receipts"
```

Run the same command with `--resume`. Unchanged archive decisions are marked `UNCHANGED`; changed relationships are marked `RECLASSIFIED`; new carriers are marked `NEW`.

The default candidate batch size is 50, so about 1,400 structurally visible organs become at most 28 bounded deeper-review batches before real merge judgment begins. This is a queue-shape calculation, not a promise that all candidates are valid or useful.

## Meanings

- `PARK_EXACT_DUPLICATE`: whole-archive SHA-256 equals another batch carrier. Nothing is deleted.
- `HOLD_*`: bounded structure could not safely continue.
- `JUDGMENT_*`: the machine found a collision or ambiguity but refuses to choose precedence.
- `READY_FOR_DEEPER_REVIEW`: ready for content, contract, runtime, and merge-gate work; not accepted, installed, promoted, or CANON.

## Preserved authority

The conveyor never watches Downloads, extracts archives, reads archived file bodies, executes code, votes in Review Inbox, stages Module Installer, installs, promotes, pushes GitHub, or changes CANON. Mike and Codex remain the merge gate.

Run `node tools\bulk-intake-conveyor\selftest.js` for the synthetic 14-carrier and authority-hold suite.
