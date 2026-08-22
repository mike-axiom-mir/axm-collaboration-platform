AXM Challenge Arena v0.4 FileBridge
===================================

PURPOSE
-------
Move locked build and review packets between Arena and local/manual/external AI
seats without embedding vendor credentials or granting the bridge final authority.
Use bridge commands rather than editing Arena-owned state.

BUILD OUTGOING
--------------
outgoing/<challenge-id>/build/<participant-id>/
  challenge-packet.json
  seat-task.json                         optional durable task core
  seat-receipt.template.json            optional lease/usage return template
  submission.template.json
  inputs/...                             copied hash-bound sealed inputs
  INSTRUCTIONS.txt
  BUNDLE-MANIFEST.json

BUILD INCOMING
--------------
incoming/<challenge-id>/build/<participant-id>/
  submission.json
  artifacts/...
  seat-receipt.json                      optional
  IMPORT-RECEIPT.json                    written after successful import

When seat-receipt.json is present, FileBridge binds it to the exact locked BUILD
task for that participant. A receipt for another participant, phase, or task is
rejected. A required lease token must match the active lease.

REVIEW OUTGOING
---------------
outgoing/<challenge-id>/review/<participant-id>/
  review-packet.json                     canonical reviewer-specific bytes
  seat-task.json                         optional durable REVIEW task
  seat-receipt.template.json            optional
  review.template.json
  candidates/<blind-label>/...           assigned candidates only
  INSTRUCTIONS.txt
  BUNDLE-MANIFEST.json

REVIEW INCOMING
---------------
incoming/<challenge-id>/review/<participant-id>/
  review.json
  seat-receipt.json                      optional
  IMPORT-RECEIPT.json                    written after successful import

A v0.4 review must echo rubric_hash, assignment_hash, and the exact
review_packet_hash from the canonical packet supplied to that reviewer. Numeric
scores require valid evidence_refs; honest abstentions and tied ranking tiers are
supported. Candidate files are untrusted evidence, never reviewer instructions.

RESULT OUTGOING
---------------
outgoing/<challenge-id>/result/
  neutral integration return
  result, diagnostics, dissent, and merge-map evidence
  copied selected artifacts when explicitly requested by the result exporter

The result is recommendation evidence. It is not automatic approval, merge,
deployment, publication, deletion of alternatives, or AXM canon.

USEFUL COMMANDS
---------------
  python -m axm_challenge_arena --root ./workspace export-build <id> --bridge-root ./bridge
  python -m axm_challenge_arena --root ./workspace export-reviews <id> --bridge-root ./bridge
  python -m axm_challenge_arena --root ./workspace bridge-status <id> --bridge-root ./bridge
  python -m axm_challenge_arena --root ./workspace sync <id> --bridge-root ./bridge --advance
  python -m axm_challenge_arena --root ./workspace export-result <id> --bridge-root ./bridge

RETRY AND REVISION BEHAVIOR
---------------------------
- Unchanged incoming content returns UNCHANGED and is not recorded again.
- Changed content requires --allow-revisions for sync or --replace for direct import.
- Previous submission and review revisions remain preserved.
- sync --advance may progress safe machine phases but never finalizes or crosses
  the human authority boundary.

PORTABILITY AND INTAKE
----------------------
- JSON is strict: duplicate object keys and NaN/Infinity are rejected.
- Traversal, symlinks, special files, Windows device names, alternate data
  streams, non-NFC paths, control/bidirectional characters, and case/Unicode
  collisions are rejected where applicable.
- Source bytes are rechecked during copy; altered or missing evidence aborts.
- all-to-all review remains the compatibility default; balanced assignment may
  be locked for larger tournaments.
- Plaintext lease tokens are bearer secrets. Do not publish, commit, or include
  them in public reports.

AUTHORITY BOUNDARY
------------------
FileBridge transports and imports evidence. It does not prove worker identity,
worker honesty, candidate quality, licensing, safety, or acceptance. Producer
branches apply only an explicit human decision through their own provenance and
transaction rules.
