# Migration from Atlas v0.5.0 to v0.6.0

## Shared contract

No shared-contract version change. It remains `0.1.0`.

## Behavioral changes

1. Contract compatibility is now exact: only `0.1.0` is currently accepted.
2. Every `INFERRED` field requires stable evidence metadata.
3. Defaulted shared fields receive explicit knowledge states.
4. Duplicate JSON object keys are rejected.
5. Strict provenance verifies the raw source SHA-256 against accessible bytes.
6. Every successful card build emits `producer_receipt.json`.
7. Writes are atomic and receipt is written last.
8. `ingest --resume` can reuse unchanged verified outputs.
9. `intake_gate_report.json` is generated for structural review.

## Existing v0.5 outputs

Do not relabel old v0.5 outputs as v0.6 RUN records.

Rebuild them with v0.6 when you want v0.6 producer receipts and strict evidence
conformance. Preserve v0.5 as rollback evidence.
