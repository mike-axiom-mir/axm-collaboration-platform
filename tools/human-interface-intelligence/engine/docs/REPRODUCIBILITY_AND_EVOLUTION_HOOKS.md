# Reproducibility and Evolution Hooks

Module 2 v0.4.0 adds two outputs that remain separate from the shared Capability–Interface Contract.

## Decision receipts

A decision receipt fingerprints:

- the full Capability Record;
- the full runtime context;
- the exact interface-pattern registry bytes;
- Module 2 engine version;
- shared contract identity;
- recommendation decision fields excluding only `generated_at`.

The receipt is evidence that a later run used the same decision-bearing inputs and produced the same decision. It is not embedded into the shared recommendation because the `0.1.0` recommendation schema is intentionally unchanged.

## Evolution observations

Module 2 may derive advisory observations from gate evidence and deterministic score traces. These observations are explicitly non-authoritative. They exist so a system such as Grounded Evolution Intelligence can ask *where should we investigate next?* without silently converting a recommendation failure into an automatic architecture change.

No observation is proof that a new module, interface pattern, capability, or weight is required. Investigation remains separate from adoption.
