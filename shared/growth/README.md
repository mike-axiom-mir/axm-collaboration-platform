# AXM Workshop Growth and Observatory

Counts the active workshop source without inflating growth from copies.

Excluded directories: `.git`, `node_modules`, `exports`, `backups`, `logs`, `state`, `local-data`, `intakes`, `.cache`, `coverage`, and `tmp`. Raw intake carriers remain recoverable evidence, not active Workshop source.

Snapshots carry a counting-rules version. When the scope changes, the Hub preserves older history but starts a fresh comparable baseline instead of presenting archive movement as source loss.

An unreadable directory or a file that disappears during a scan is skipped instead of failing the whole measurement. The live response reports a compact partial-scan warning using relative paths and error codes only; source contents and absolute paths remain excluded.

Metrics include total files, text/binary split, UTF-8 characters, lines, bytes, tool manifests, game manifests and test files. Snapshots are explicit local actions and deduplicate identical measurements.

The Hub's **Workshop Observatory** keeps this growth history intact and adds a
separate, read-only evidence layer. That layer measures live lifecycle
declarations, contract and selftest coverage, exact capability seams, local
verification-receipt metadata, public proof metadata, and deterministic
improvement signals. It runs in an isolated worker and uses a freshness-labelled
cache so the heavier readiness scan cannot freeze the existing growth view.

Human-recorded milestones live in a separate compact ledger. A milestone
attaches the current Observatory evidence summary, but remains explicitly
`automaticallyProven: false`; it does not promote a tool or alter CANON.

Full definitions and operating instructions are in
[`docs/WORKSHOP_OBSERVATORY.md`](../../docs/WORKSHOP_OBSERVATORY.md).

Compact snapshots are retained as the Workshop's full historical journey. The Hub groups them by year and month instead of deleting older moments. Only aggregate velocity samples use a bounded rolling window; snapshots contain metrics and short fingerprints, never source contents, screenshots, or full file lists.

## Mirror family

When `C:\AXM_MIRROR_LOCAL` is installed, the same explicit/daily snapshot also records a compact Mirror-family measurement. Original Mirror is the parent body and is always presented first. Its owned body/source, living state, installed substrates, Git history, outputs, and logs remain separate so a large runtime installation cannot masquerade as authored growth.

Declared identity branches and specialist bodies are discovered from their lineage declarations. Creative Mirror, RepairBuddy, English Learner Mirror, and future declared specializations receive separate footprint cards beneath Original Mirror. Those cards count only their descriptor and private branch/specialist footprint; shared parent code is counted once.

The scanner retains aggregate numbers and short fingerprints only. It reads file
metadata (counts, sizes and modification-derived fingerprints), but does not read
private state contents, retain source contents, or store absolute local paths.
Specialist runtime state is presented only as a lineage declaration; it is not a
live process measurement.
