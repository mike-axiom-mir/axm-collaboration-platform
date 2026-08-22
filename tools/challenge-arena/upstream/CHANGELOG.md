# Changelog

## 0.6.0 — 2026-08-16

- Repaired standalone evidence verification so canonical event checks are independent of incidental ZIP member ordering.
- Added `public_progress()` and routed observer progress through count-only identity-safe output.
- Added `public_integrity_view()` so observer integrity exposes validity/counts without forensic identifiers.
- Added `public_lineage_view()` so copied participant ids, selected blind labels, operator identity, and sealed input details stay off the observer surface.
- Stopped observer HTTP errors from echoing raw exception messages.
- Added Cross-Origin-Resource-Policy, Cross-Origin-Opener-Policy, and X-Permitted-Cross-Domain-Policies headers.
- Added `tools/audit_bundle_portability.py` and regression coverage for reordered ZIPs and observer side-route privacy.
- Preserved the v0.5 challenge wire contract, opaque blind algorithm, scoring semantics, and human authority boundary.
- Final source suite: 164 pytest tests + 10 subtests and 164 unittest tests.

## 0.5.0 — 2026-08-16

- Replaced predictable sequential blind aliases for new v0.5 rounds with committed, seed-verifiable opaque aliases while preserving v0.4 replay behavior.
- Hid reviewer-own candidate aliases and the live public blind-label set to close simple missing-label/set-difference identity inference.
- Extended no-reveal public synthesis redaction to reviewer IDs and declared independence-group identities.
- Added exact previous-revision compare-and-swap preconditions for replacement submissions and reviews, preventing stale last-writer-wins updates.
- Added semantic orchestration verification tying completed BUILD/REVIEW tasks, task history, and attempts to the correct real participant records and active revisions.
- Strengthened task receipts with attempt-history, completion-history, and active-lease hashes.
- Added optional declared reviewer independence groups and a locked minimum-group coverage threshold that withholds readiness rather than modifying scores.
- Added non-punitive reviewer score-vector convergence diagnostics.
- Made malformed/non-object FileBridge import receipts fail closed instead of silently becoming “no receipt”.
- Added a v0.5 blind-seed-reveal contract and updated capability/task-receipt contracts where wire shapes changed; 30 runtime-produced contracts validate.
- Added 8 v0.5 semantic regression tests and strengthened CLI coverage isolation; final suite: 158 unittest tests, 158 pytest tests, and 10 pytest subtests.
- Re-audited deterministic balanced review assignment against an independent Edmonds-Karp max-flow oracle across 20,000 cases.
- Property-audited opaque blind alias generation across 20,000 generated cases.
- Measured branch-aware coverage across all 12 test modules: 79.98% statements, 62.19% branches, 75.33% combined coverage.py metric.

## 0.4.0 — 2026-08-15

- Preserved v0.3 as the rollback point and performed a semantic-evidence audit rather than a feature-count pass.
- Found and repaired a real v0.3 defect: candidate diagnostics called an undefined `read_json` name and a broad exception converted the failure into apparently valid empty scan evidence.
- Rebuilt diagnostics around verified manifests, sealed artifact bytes, bounded hashed word-shingle sampling, explicit scan completeness/errors, artifact binding, and integrity-time semantic recomputation.
- Added integrity-time recomputation of candidate-content safety evidence, so a self-rehashed false report cannot pass merely through internal consistency.
- Added reviewer-specific exact `review_packet_hash` binding; stale, altered, or wrong-reviewer packets are rejected.
- Added bounded score evidence references to declared artifacts, deterministic check IDs, manifest roots, or explicit reviewer observations.
- Added explicit criterion abstentions and tied ranking tiers; no pairwise preference is invented inside a tie.
- Removed ranking influence from non-comparative one-candidate ballots.
- Added cryptographic blind-order seed commitment at lock, HMAC-derived ordering, post-vote reveal, public seed redaction, and integrity-time blind-map reproduction.
- Fixed FileBridge review transport so canonical reviewer packets are not rewritten after hashing.
- Added durable BUILD and REVIEW seat-task orchestration with immutable task cores, optional one-time lease tokens stored only as hashes, bounded heartbeats, retries, dead-letter/cancellation states, completion receipts, usage/budget evidence, public redaction, and bridge receipt binding. Operational failures remain evidence-only and do not silently alter candidate scores.
- Prefixed generated bearer tokens with `lease_` after coverage execution exposed an intermittent CLI ambiguity where an otherwise valid token beginning with `-` could be parsed as an option.
- Added standalone no-extraction evidence-bundle verification with member/path/resource checks, strict metadata JSON, manifest/tree/integrity bindings, canonical event and JSONL projection checks, and semantic-state verification.
- Changed evidence export to streamed, source-stability-checked reproducible ZIP creation and blocked export into managed challenge storage.
- Added event-bound checkpoint verification and exact resumable legacy-event migration evidence.
- Prevented incomplete comparative coverage or balanced partial rankings from silently breaking equal rubric scores; all-to-all comparative evidence can still contribute under the locked policy.
- Expanded bundled Draft 2020-12 schemas from 17 to 30 and added runtime-produced validation specimens for every schema.
- Expanded the regression suite from 86 to 150 passing unittest/pytest tests; pytest additionally reports 10 passing subtests.
- Completed branch-aware coverage by running the 150-test suite in isolated modules and combining the measured data: 79.42% statements, 61.55% branches, and 74.78% combined coverage. Coverage is evidence of exercised paths, not proof of correctness.

## 0.3.0 — 2026-08-15

- Preserved v0.2 as an unchanged rollback point while hardening reviewer scale, portable identity, strict intake, execution limits, and interruption recovery.
- Added strict JSON parsing that rejects duplicate object keys and non-finite numbers across CLI, stored JSON, JSONL recovery, and validators.
- Added cross-platform portable path and name validation for Windows device names, alternate data streams, forbidden/control/bidirectional characters, non-NFC names, trailing dot/space ambiguity, path limits, and case-fold or Unicode-normalization collisions.
- Added deterministic all-to-all or balanced review assignment; all-to-all remains the compatibility default.
- Replaced the first balanced allocator with a deterministic augmenting-path capacitated matcher after a real small-graph fairness counterexample was found.
- Added exact reviewer-cap and candidate-coverage evidence, unmet-target reporting, supplemental reviewer participation, assignment self-hashing, event binding, integrity recomputation, and pre-reveal privacy redaction.
- Added an independent Edmonds-Karp max-flow oracle and passed a 20,000-case deterministic assignment audit.
- Added assignment-bound v0.3 review packets and ballots; reviewers receive only assigned candidates and cannot evaluate unassigned labels.
- Added a hash-bound review protocol declaring candidate files untrusted evidence rather than reviewer instructions.
- Added a bounded, non-punitive candidate-content scanner for instruction override, score/rank demands, winner requests, role headers, identity/blindness requests, external action requests, participant references, and control/bidirectional characters.
- Added explicit scanner completeness and truncation evidence; scanner findings cannot automatically affect score or eligibility.
- Replaced command-validator temporary output capture with bounded stdout/stderr pipe readers, observed/retained byte accounting, stream hashes, output-limit termination, timeout handling, and best-effort process-tree cleanup.
- Added deterministic replay limits for generated file count, per-file bytes, total bytes, symlinks, and portable path collisions.
- Added portable-collision checks to ZIP members before decompression.
- Made private diagnostics, review assignment, review protocol, review-safety evidence, external receipts, and per-candidate deterministic result files event-bound crash-recoverable sidecars.
- Added submission cleanup compensation: non-recoverable pre-journal failures remove orphan copies, while pending recoverable commits preserve exact candidate bytes.
- Added three new `/0.3` review evidence contracts and updated challenge, review packet, review, capabilities, and integration-return contracts to `/0.3`; stable leaf contracts remain `/0.2` intentionally.
- Expanded wheel-bundled schemas from 14 to 17.
- Regenerated v0.3 module-job examples and review template.
- Expanded the automated suite from 63 to 86 passing regression tests.

## 0.2.0 — 2026-08-12

- Preserved the v0.1 challenge/build/review/merge root while adding a reliability and portable-integration layer.
- Added atomic state writes with a bounded retry for transiently vanished same-directory temp files, write-ahead recovery journals, canonical event files, rebuildable JSONL projections, checkpoints, and semantic state hashes.
- Made the immutable locked-packet sidecar precede and hash-bind into the recoverable lock event, with exact interruption recovery coverage.
- Bound review and report sidecars into their semantic events and write-ahead transactions, preserving exact review revisions and recovering synthesis/final-decision reports after interruption.
- Added pre-deterministic revalidation of stored submission identity, lock acknowledgements, artifact-root safety, declared/actual file parity, hashes, counts, and bytes.
- Added re-entrant local cross-process advisory locking, stale-state protection, and coherent serialized public reads.
- Added strict locked packet/rubric acknowledgement, sealed roster evidence, explicit late-registration handling, artifact limits, symlink refusal, and deliverable cardinality enforcement.
- Added challenge-owned, hash-bound sealing of declared local draft inputs, with local-path removal, immutable input receipts, portable builder copies, and tamper/undeclared-file detection.
- Expanded deterministic support to 28 validators, including bounded ZIP checks, lightweight JSON schema, file trees, magic signatures, image aspect ratios, deterministic replay, and external receipts.
- Added hash-bound external runner jobs and HMAC-SHA256 receipts without storing secrets.
- Preserved the exact signed receipt payload while normalizing scores separately, fixing receipt re-read hash stability.
- Added non-punitive exact-duplicate and text-convergence diagnostics.
- Added best-effort blind review redaction for direct author/revision metadata, free-form summary, claims, notes, and detailed provenance identity.
- Added median/mean/trimmed-mean aggregation, score dispersion, review audit flags, Condorcet evidence, dissent, and evidence gaps.
- Added correct winner withholding for exact ties, insufficient evidence, human-only rubrics, no candidates, and universal required-check failure.
- Added portable FileBridge build/review/result bundles, idempotent imports, readiness status, and safe `sync --advance` orchestration that cannot finalize.
- Added explicit lineage-preserving follow-up modes with default child-local evidence copies, a self-hashed lineage receipt, and copied-artifact tamper detection.
- Re-verified and resealed inherited challenge source inputs into each follow-up child, with new child-bound receipts and a post-verification race check that aborts rather than accepting changed bytes.
- Added byte-reproducible full evidence ZIP export.
- Added capabilities CLI/API, restrictive observer security headers, and expanded integrity verification.
- Updated normalized submission and review outputs to explicit v0.2 schema identifiers while continuing to accept v0.1 intake forms for migration.
- Added v0.2 schemas for challenge, submission, review, return, deterministic receipt, external runner job, lineage receipt, and capabilities.
- Bundled 14 contract schemas inside the installable wheel with traversal-safe `schema_names()` / `load_schema()` access.
- Tightened `axm.module-job/0.1` translation to reject unsupported versions and malformed list/object fields instead of ambiguously coercing them.
- Added a deterministic standard-library release builder that regenerates internal checksums, fixed-metadata ZIPs, compressed-data verification, and an external SHA-256 sidecar.
- Regenerated examples and the included demo under v0.2.
- Expanded the automated suite from 5 original tests to 63 passing regression tests.

## 0.1.0 — 2026-08-12

- First standalone AXM Challenge Arena module.
- Universal artifact presets and neutral module integration contract.
- Immutable challenge, submission, review, and evidence flow.
- Deterministic checks, anonymous peer review, no self-voting, weighted results, dissent, and merge maps.
- Local filesystem bridge, callable adapter seam, read-only dashboard, demo, tests, and documentation.
