# AXM Grounded Evolution Intelligence — v0.7.0

Status: **IN PRODUCTION — MODULE 1 DEFERRED-MATERIALIZATION ADAPTER**

This checkpoint preserves the complete v0.6 transactional intake system and adds
one evidence-driven compatibility layer based on the real
`MODULE1_STABLE_INTAKE_HANDOFF.txt`.

## Why v0.7 exists

Module 1 v0.10.0 is a sealed **pre-intake software package**, not a finished real
1,769-record Capability Card corpus. The real corpus, receipts and batch plan are
created only during an explicitly authorized local run. Its canonical external ID
is also `axm.module.human_capability_atlas`, not the earlier Module 3 fixture ID.

The adapter therefore changes the safe state from vague `MERGE_READY` language to:

`WAITING_FOR_ARTIFACT_BYTES → PACKAGE_REHEARSAL_PASS_MATERIALIZATION_REQUIRED → CORPUS_REHEARSAL_PASS → MERGE_REVIEW_READY → explicit Merge Gate`

No step executes automatically.

## New components

- `module1_adapter/MODULE1_INTAKE_PROFILE.json`
- `module1_adapter/module1_adapter.py`
- `module1_adapter/materialization_state.py`
- `module1_adapter/nested_bundle_probe.py`
- `module1_adapter/semantic_identity.py`
- `module1_adapter/validate_module1_adapter.py`
- `interop_preflight/intake_manifest_v2.schema.json`
- `interop_preflight/preflight_three_module_intake_v3.py`
- Module 1 truth, evidence, semantic identity and materialization policies
- synthetic nested package, tamper, traversal, deferred-intake and conflict fixtures

## Key truth boundaries

- Module 1 `known` defaults to a Module 3 ceiling of `DECLARED`, not runtime proof.
- `CONFIRMED` is not a canonical Module 1 truth token.
- There is no standalone canonical Module 1 `Evidence Tuple`.
- Full generated card hashes may vary with timestamps/run IDs; semantic hashes are
  used to avoid false conflicts.
- Consumer-only dependency references remain dependency references, not provided
  capabilities.
- `COMPLETE_VERIFIED` is neither runtime proof nor Merge Gate acceptance.

## Current state

The user supplied the stable handoff text, not the actual final Module 1 ZIP.
Current state is therefore **WAITING_FOR_ARTIFACT_BYTES**.

## Validation

```bash
python module1_adapter/validate_module1_adapter.py
python -m unittest discover -s tests -p "test_*.py" -v
```

Result: **41/41 tests PASS**. The v0.6 canonical registry, Phase 3 event history and
full graph remain byte-identical.

Start with `MODULE1_ADAPTER_HANDOFF.txt` during local/Codex intake.
