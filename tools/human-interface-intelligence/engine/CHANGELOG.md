# AXM Human Interface Intelligence Changelog

## 0.6.0 — 2026-08-08

- Tightened module-owned JSON parsing to reject non-standard `NaN`, `Infinity`, and `-Infinity` values.

- Preserved the standalone shared contract byte-for-byte at `axm.capability-interface-contract` `0.1.0`.
- Fixed a deterministic scoring crash for `reduced_cognitive_load` contexts found during cross-fixture fuzzing.
- Separated hard eligibility from preference scoring: explicit unsafe-pattern and required-offline boundaries can no longer be overcome by positive score weight.
- Added shared-schema validation before capability field access and strict recommendation-context budget enums without silent defaults.
- Added explicit manual-review handling for accessibility needs not covered by deterministic rules.
- Made recommendations hold deep snapshots of capability/context and bound recommendation identity to the full capability revision, context, registry fingerprint, engine version, and contract.
- Hardened decision receipts against mismatched capability/context inputs.
- Added interface-pattern registry validation, duplicate-ID rejection, exact custom-registry fingerprinting, and immutable internal registry snapshots.
- Added module-specific Recommendation Assurance reports for context binding, hard constraints, budget fit, required controls, preview/confirmation plans, devices, tools, accessibility, and score-margin reproduction. Assurance remains advisory and cannot grant execution.
- Added explicit `explicit_confirmation` and `non_destructive_preview` controls when declared by capability risk requirements.
- Added bounded Module 1 anchor ZIP consumption with path, encryption, symbolic-link, member-count, per-member size, total size, name length, and compression-ratio checks.
- Replaced external `/mnt/data` test dependencies with a packaged, clearly non-authoritative historical anchor fixture.
- Added recommendation-context and interface-pattern-registry schemas, upgraded receipt/audit/gate/anchor/signal-lab schemas, and added hardening regression tests.
- No local AXM integration was performed; the historic Module 1 anchor remains blocked and is not treated as current authority.

## 0.5.0 — 2026-08-08

- Preserved the authoritative v0.4 deterministic recommendation and merge-gate path; shared contract remains `axm.capability-interface-contract` `0.1.0`.
- Added quarantine signal packets so blocked/failed intake can be retained as evidence without granting execution authority or promoting failed records to facts.
- Added bounded synthetic counterfactual robustness probes in explicit `shadow_advisory_only` mode.
- Added pattern-coverage reporting with safeguards against treating one-batch non-use as evidence for pattern removal.
- Added decision-drift classification using capability, context, registry, engine, contract, and recommendation receipt fingerprints.
- Added a separate shadow-analysis signal packet for Module 3; synthetic counterfactuals are explicitly marked non-observed.
- Added an append-only hash-chain signal-ledger preview with tamper detection and explicit `NOT_WRITTEN_TO_LOCAL_LEDGER` state.
- Added `robustness`, `decision-drift`, and `signal-lab` CLI commands.
- Added module-specific schemas and regression tests for signal retention, shadow authority separation, robustness determinism, drift, coverage, ledger chaining, and tamper detection.
- Ten shared fixtures remain 10/10 consistency PASS. Bounded probe result: 4 non-blocked stable, 2 stable-blocked, 2 pattern-sensitive, 2 status-sensitive.
- The current Module One anchor remains BLOCKED before record consumption; the block is retained as signal but no recommendation is fabricated.

## 0.4.0 — 2026-08-08

- Preserved shared contract `axm.capability-interface-contract` at `0.1.0`; no private shared-field additions.
- Added strict context preflight that rejects missing, malformed, or undeclared context fields without silent defaults.
- Added exact dependency locking for the three shared schemas, shared enums, and interface-pattern registry.
- Added reproducible decision receipts that fingerprint capability, context, registry, engine version, contract identity, and timestamp-independent recommendation core.
- Added intake health reporting that separates cross-module consistency from direct, conditional, blocked, and unprocessed recommendation states.
- Added advisory evolution-observation batches for ecosystem analysis with automatic canon/code changes explicitly disabled.
- Added `context-check`, `verify-lock`, `receipt`, and `intake-audit` CLI commands.
- Added schemas and ten regression tests covering context integrity, lock mutation, receipt reproducibility, health semantics, advisory governance, and the still-blocked Module One anchor.
- The existing Module One anchor conflict remains blocked; no adapter or silent normalization was added.

## 0.3.0 — 2026-08-05

- Preserved the standalone shared contract at `axm.capability-interface-contract` `0.1.0`.
- Added safe Module One anchor ZIP inspection without importing or executing producer code.
- Added an independent AXM-CJ-1 implementation and canonicalization-vector verification.
- Added package inventory, identity, authority-map, export-guarantee, fixture, and run-evidence validation.
- Added byte-level shared-schema fingerprint comparison and evidence-state token comparison.
- Added detection for stable-anchor fields and inference requirements absent from the accepted contract.
- Added the anchor-aware `paired-gate`, which refuses to consume records when the anchor is blocked.
- Inspected the supplied Atlas stable anchor: integrity and ten-fixture evidence passed, but paired merge is blocked by contract identity conflicts and six strict evidence-policy failures.
- Added CCR-0001 and a constrained Module One repair request; no mutable Atlas internals were frozen.
- No real registry intake, recommendation execution from Atlas output, or local AXM integration was claimed.

## 0.2.0 — 2026-08-05

- Preserved shared contract `axm.capability-interface-contract` at version `0.1.0`.
- Added Atlas handoff batch format without adding private fields to the shared contract.
- Added deterministic cross-module gate with `PASS`, `FAIL`, `BLOCKED`, and `NOT_RUN` states.
- Added immutable source identity checks and optional canonical source-payload SHA-256 verification.
- Added full deterministic pattern score traces and registry fingerprinting.
- Added `gate` and `trace` CLI commands.
- Added ten-record fixture-surrogate handoff, strict verified example, tampered-source negative example, and no-expectation example.
- Added module-specific handoff/report schemas, merge checklist, integration documentation, and regression tests.
- Real Human Capability Atlas execution and local AXM integration remain not performed.

## 0.1.0 — 2026-08-03

- Established the independent `axm.capability-interface-contract` v0.1.0 dependency.
- Implemented 27 reusable interface patterns.
- Implemented deterministic ranking, reason traces, beginner-layer planning, advanced-layer gates, evidence reports, and cost comparisons.
- Added ten shared cross-module fixtures and positive/negative validation examples.
- Added CLI, compatibility checker, migration refusal framework, local intake manifests, and automated tests.
- No local AXM runtime integration was claimed or performed.
