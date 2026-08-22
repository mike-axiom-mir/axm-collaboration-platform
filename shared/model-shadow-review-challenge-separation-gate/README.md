# Model Shadow review challenge separation gate

Status: `TEST`

This uninstalled and unpromoted read-only leaf follows the v0.5 anchored
checkpoint witness. It compares the verified witness seats with the verified
anchor seats and refuses an exact public-key fingerprint or declared principal
digest that appears in both layers.

```text
exact v0.5 anchored witness
  + witness key fingerprints and declared actor digests
  + anchor key fingerprints and declared steward digests
  -> cross-layer non-overlap receipt
  -> separated anchored checkpoint continuity audit
```

This proves only observable non-overlap in the exact presented chain. One
controller can generate different keys and declare different digests for both
layers, and the selftest preserves that valid counterexample. Different keys
therefore do not prove independent custody, different digests do not prove
different real-world people, and absence of exact overlap does not exclude
collusion.

The receipt retains domain-separated set digests and counts, not raw identity
strings, public keys, signatures, private keys, state paths, private context, or
model output. This module does not prove Mike or host trust, actual human
participation, independent governance, trusted time, external retention,
protected storage, deletion or rollback prevention, global single-use,
execution, evaluation, adoption, training, installation, promotion, merge,
Foundation mutation, or `CANON` authority.

Run:

```powershell
node shared/model-shadow-review-challenge-separation-gate/selftest.js
```
