# Atlas → Human Interface Intelligence Handoff

**Module B version:** `0.3.0`  
**Shared contract consumed:** `axm.capability-interface-contract` `0.1.0`  
**Atlas handoff batch format:** `0.2.0` (unchanged)

This handoff remains module-specific. It does **not** alter or extend the shared Capability Record contract.

## Two-stage gate

Module Two now uses two gates in order:

1. **Stable anchor gate**
   - verifies the Module One anchor package and inventory;
   - confirms module and contract identifiers;
   - compares exact shared-schema fingerprints;
   - compares evidence-state serialization;
   - verifies AXM-CJ-1 vectors independently;
   - reviews fixture identities and producer evidence;
   - blocks private or unrepresentable contract growth.

2. **Capability Record gate**
   - validates actual Capability Records;
   - protects immutable source identity and provenance;
   - runs deterministic interface selection;
   - validates recommendations;
   - compares cross-module expectations when supplied.

The second gate does not run if the first gate is blocked.

## Current supplied-anchor result

The supplied Module One anchor passed package integrity, stable identities, canonicalization, authority vocabulary, export guarantees, and ten-fixture identity/run evidence.

It did not pass strict paired compatibility because:

- shared Capability Record schema hashes differ;
- interface recommendation schema hashes differ;
- evidence-state tokens differ in case and spelling;
- the anchor declares a shared `knowledge` field absent from the standalone contract;
- two newly mandatory inference metadata concepts cannot be represented by the current evidence schema;
- six of ten fixture outputs fail the anchor’s own strict evidence policy.

The paired gate therefore returned `BLOCKED` with recommendation execution `NOT_RUN`.

## Gate states

- `PASS` — the relevant validation and expectation checks agree.
- `FAIL` — malformed data, engine failure, invalid output, or failed required check.
- `BLOCKED` — an identity, provenance, safety, or contract conflict prevents execution.
- `NOT_RUN` — the stage was deliberately not executed.
- `CONFLICTED` — credible shared-boundary claims disagree and require resolution.
- `TEST-HOLD-REVIEW` — noncritical structure passed, but policy failures remain.

## Commands

```bash
python -m axm_hii.cli anchor-gate /path/to/anchor.zip

python -m axm_hii.cli paired-gate \
  /path/to/atlas-handoff.json \
  --anchor /path/to/anchor.zip
```

Use the standalone `gate` command only when the accepted shared-contract identity is already known and the input is not being represented as a real paired Atlas intake.
