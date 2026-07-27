# AXM Workshop Growth

Counts the active workshop source without inflating growth from copies.

Excluded directories: `.git`, `node_modules`, `exports`, `backups`, `logs`, `state`, `.cache`, and `coverage`.

Metrics include total files, text/binary split, UTF-8 characters, lines, bytes, tool manifests, game manifests and test files. Snapshots are explicit local actions and deduplicate identical measurements.

Compact snapshots are retained as the Workshop's full historical journey. The Hub groups them by year and month instead of deleting older moments. Only aggregate velocity samples use a bounded rolling window; snapshots contain metrics and short fingerprints, never source contents, screenshots, or full file lists.

## Mirror family

When `C:\AXM_MIRROR_LOCAL` is installed, the same explicit/daily snapshot also records a compact Mirror-family measurement. Original Mirror is the parent body and is always presented first. Its owned body/source, living state, installed substrates, Git history, outputs, and logs remain separate so a large runtime installation cannot masquerade as authored growth.

Declared identity branches and specialist bodies are discovered from their lineage declarations. Creative Mirror, RepairBuddy, English Learner Mirror, and future declared specializations receive separate footprint cards beneath Original Mirror. Those cards count only their descriptor and private branch/specialist footprint; shared parent code is counted once.

The scanner retains aggregate numbers and short fingerprints only. It reads file
metadata (counts, sizes and modification-derived fingerprints), but does not read
private state contents, retain source contents, or store absolute local paths.
Specialist runtime state is presented only as a lineage declaration; it is not a
live process measurement.
