# AXM tool status and promotion ladder

As of 2026-07-23, the machine-readable source is `shared/readiness/promotion-ladder.json`.

`EXPERIMENTAL` means the tool is discoverable but may still lack complete runtime evidence. `TEST` means it has a declared contract and an executable verification route, but it is not yet a product claim. `WORKING` requires a current passing selftest bound to the current selftest digest, a fresh `verifiedAt`, and no unresolved high-risk hold. `CANON` additionally requires Mike’s explicit merge-gate decision, representative runtime evidence, and a compatibility/deprecation path.

`SHELL` and `BROKEN` are side states, not promotion stages. A shell remains visible until it is completed or explicitly archived. No script in this repository promotes a tool automatically. A selftest pass creates evidence for human review; it is not approval.

Run `npm run index:tools:verify` to execute eligible top-level tool selftests with a bounded worker pool and regenerate `tools-index.json`. The resulting promotion queue distinguishes structural blockers, tests that still need execution, and candidates ready for human review.

Use `npm run index:tools:verify -- --tool=tool-id` (or a comma-separated list)
when only named eligible tools require refreshed evidence. Selected mode refuses
unknown or ineligible IDs before writing, replaces the selected results, and
retains unrelated receipt rows only while their selftest digests remain current.
It still regenerates `tools-index.json`, keeps the raw receipt under local
`state/`, and grants no promotion or approval authority.
