# Curation receipt

- evidence_segment: `identity-shell-fabric-verifier-hardening-v0.1`
- sealed_segments: `SESSION_SEGMENT.jsonl` followed by append-only `SESSION_SEGMENT_EXTENSION.jsonl`
- seal_digests: `sha256:882d8c91f316582be0427b68fd0b1e19027c5a9b1055c5fa8b860bdaa2543c59` and `sha256:dbc2d5e5faab6c45f8d9160f1b7474b67e9c3e55a6ee3cf10bd1fa877d38cd9a`
- structural_seals: primary · 10 physical lines · 9 event/valid JSON lines; extension · 1 physical/event/valid JSON line; both 0 invalid and parse status `valid`
- durable_events_preserved: 10 (`verifier-gap-discovery`, `adversarial-reproduction`, `verifier-hardening`, `test-regression`, `migration-resource-boundary`, `focused-verification`, `broad-check-stall`, `broad-verification-recovery`, `capability-gap`, `reference-schema-hardening`)
- telemetry_aggregation: repeated fresh-process passes were compacted to counts, failures, and unique digest count; raw command output was not retained
- temporary_material_deleted: none; no screenshots, recordings, or temporary captures were created
- explicit_retention_exceptions: none
- derived_views_updated: `SESSION_SUMMARY.md`, `CHECK_RESULTS.json`, `EVIDENCE_ROUTES.md`, and `CAPABILITY_GAP.json`
- unclassified_items and review deadline: none
- authority_used: branch-local verifier repair, tests, verification, and evidence curation only
- memory_seam: closed for the static verifier-hardening run; live-host, authenticated-human, and runtime-continuity seams remain open
