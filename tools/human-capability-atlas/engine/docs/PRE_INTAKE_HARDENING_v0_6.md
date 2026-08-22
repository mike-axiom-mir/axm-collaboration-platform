# Pre-intake hardening in v0.6.0

## Why this release exists

v0.5.0 was already feature-complete enough to wait for local intake, but the
stable Module One -> Module Two handoff audit exposed a stricter interoperability
requirement: every `INFERRED` value needs reasoning, source basis, confidence,
and evidence reference.

A second audit found that the old contract compatibility helper accepted any
matching major version, even though the stable handoff anchor authorizes exactly
shared-contract v0.1.0.

v0.6.0 repairs these seams before the real registry is ingested.

## Evidence-state hardening

Default values required by the shared JSON shape no longer imply verified facts.
For example, the shared contract currently requires boolean fields such as
`risk_profile.human_confirmation_required`. If the source does not declare that
field, the serialized fallback can still be `false`, but the knowledge map now
marks the field `unknown`.

Consumers must use value + evidence state together.

## Producer receipts

Every completed card build writes `producer_receipt.json` last. The receipt
records:

- real producer module/version;
- exact shared-contract version;
- RUN state;
- original source identity/hash/pointer;
- normalized-source hash;
- AXM-CJ-1 Capability Card hash;
- schema, evidence-policy, and provenance-policy results.

A valid-looking Capability Card without a matching receipt is never treated as
proof that the real Atlas produced it.

## Resume

`ingest --resume` does not trust file existence. It reuses a generated card only
when its receipt verifies and its original source ID, revision, hash, and pointer
still match the newly normalized source.

Tampering, version drift, source changes, or policy failure forces a rebuild.

## Intake gate

`intake_gate_report.json` has three structural states:

- `READY_FOR_MERGE_REVIEW`
- `TEST_HOLD_REVIEW`
- `INGEST_FAILED`

`READY_FOR_MERGE_REVIEW` is not acceptance and never bypasses AXM Merge Gate.
