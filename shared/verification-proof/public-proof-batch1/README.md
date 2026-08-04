# Public Proof Batch 1 contracts

This leaf implements the ten approved Run 40 Batch 1 data-contract slices. It
preserves the Runs 01–39 schemas and synthetic fixtures, adds the P1 comparison
fixtures that were absent from Run 02, and exposes read-only validation through
the internal Verification Proof service.

The implementation is deliberately bounded:

- standard-library Node.js only;
- no network, process execution, publication, recording, telemetry, or writes;
- no automatic proof-strength, lifecycle, approval, publication, or CANON change;
- deterministic JSON and SHA-256 result digests;
- synthetic privacy canaries are quarantined rather than accepted;
- rollback fixtures must restore the exact pre-mutation digest.

Run the focused suite through:

```powershell
node tools/verification-proof-lab/selftest.js
```

Passing this suite proves only that the local contract layer behaves as tested.
It does not prove the ten concepts in a real AXM runtime or public environment.
