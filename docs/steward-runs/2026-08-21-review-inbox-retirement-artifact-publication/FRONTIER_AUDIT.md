# Grounded-growth frontier audit — Review Inbox retirement publication v5.0

Status: `TEST`

The v4.9 publication helper exclusively opened each authoritative JSON path before writing its first byte. Three child-process reproductions—intent, decision, and result—each left a zero-byte final file and a `HELD` recovery view when the process exited immediately after that open.

v5.0 moves the publication point. It writes complete JSON to a private sibling stage, fsyncs and closes the stage, then creates the authoritative name with a same-filesystem hard link. The six-case process-crash matrix observes an absent final path before the link and complete schema-valid bytes after it for all three artifact types. Existing final bytes are not overwritten.

Residual stages are explicitly non-authoritative and visible through a bounded host-local status. They are not deleted or reclaimed automatically. The seam requires hard-link support. It does not establish power-loss durability, directory-entry durability, cross-file atomicity, multi-host or network-filesystem safety, noncooperating-writer exclusion, or a hard-link-free fallback.

All 20 scoped commands pass: ten focused commands with 725 assertions or controls and the ten required AGENTS.md checks. A clean 104-file product slice replays the ten focused commands with unchanged tracked bytes. Aggregate `npm run test:operations` remains `FOREIGN_FAILURE` after reaching all product checks because `intakes/verification-proof-99-v0.1` is still absent and unchanged by this lane.

No browser-facing file changed and no browser render/click test is claimed. No real human review, human benefit, provider execution, learning, adoption, promotion, merge, Foundation mutation, or `CANON` evidence is claimed. Mike Tobi / AXM remains the merge and `CANON` gate, and the broad grounded-growth objective remains active.
