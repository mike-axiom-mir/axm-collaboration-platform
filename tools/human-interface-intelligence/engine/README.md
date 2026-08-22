# AXM Human Interface Intelligence — v0.6.0

Module 2 of the AXM capability/interface/evolution trio. It consumes the independent **AXM Capability Interface Shared Contract** and recommends human-interface patterns without rewriting the underlying machine capability declaration.

The shared contract remains unchanged at:

- identifier: `axm.capability-interface-contract`
- version: `0.1.0`

## v0.6.0 — decision safety and portable-intake hardening

This release is a focused reasoning and integrity pass over v0.5.0. It preserves the signal-first architecture while strengthening the boundary between a high-scoring interface, an eligible interface, and an implementation-ready interface.

Implemented:

- hard eligibility blocks for explicitly unsafe patterns and required-offline contexts, so score bonuses cannot overrule a boundary;
- shared-schema validation before capability fields are read;
- strict context budget enums and explicit manual review for accessibility needs without deterministic rules;
- a fix for the `reduced_cognitive_load` scoring crash found by context fuzzing;
- immutable capability/context snapshots inside issued recommendations;
- registry validation, exact instance fingerprinting, duplicate-ID rejection, and protected registry snapshots;
- stronger decision receipts that reject a mismatched capability or context;
- explicit `explicit_confirmation` and `non_destructive_preview` controls when the capability requires them;
- a separate **Recommendation Assurance** report that checks implementation readiness without changing the authoritative recommendation;
- duplicate-key and non-finite-number rejection for module JSON input;
- bounded, path-safe, non-executing Module 1 anchor ZIP intake with size, member-count, and compression-ratio limits;
- portable tests containing the old blocked Module 1 anchor as a clearly non-authoritative fixture;
- module-owned JSON Schemas for recommendation context, interface registry, assurance, receipt, intake audit, and signal-lab outputs.

## Authority separation

Module 2 keeps these questions separate:

1. **Contract/gate consistency** — did the supplied record pass the deterministic boundary checks?
2. **Interface recommendation** — which eligible interface pattern fits best, or why is selection blocked?
3. **Implementation assurance** — are required tools, controls, budgets, accessibility paths, previews, and confirmation gates actually ready?
4. **Signal retention** — what can be learned from blocked, conflicted, incomplete, or synthetic cases without granting execution authority?

An assurance result of `REVIEW` does not rewrite or invalidate the recommendation. It means the selected pattern still needs explicit implementation work before use.

## Shared-fixture status

The ten shared fixtures remain **10/10 deterministic consistency PASS**:

- 4 recommended;
- 4 conditional;
- 1 insufficient information;
- 1 no safe match.

The older supplied Module 1 stable anchor remains **BLOCKED** by the known shared-contract identity conflict. It is retained only as historical signal and a portable negative fixture. No recommendation is generated from that blocked anchor.

## Quick start

```bash
python -m pytest -q
python -m axm_hii.cli verify-lock
python -m axm_hii.cli registry-check
python -m axm_hii.cli context-check shared-contract/fixtures/01_file_rename.json --fixture
python -m axm_hii.cli recommend shared-contract/fixtures/01_file_rename.json --fixture
python -m axm_hii.cli assurance shared-contract/fixtures/01_file_rename.json --fixture
python -m axm_hii.cli intake-audit integration/examples/shared_fixture_handoff_batch.json
python -m axm_hii.cli signal-lab integration/examples/shared_fixture_handoff_batch.json
```

Read `integration/TRI_MODULE_INTAKE_GUIDE.md`, `docs/DECISION_ASSURANCE.md`, and `docs/INTAKE_RESOURCE_LIMITS.md` before local intake.

