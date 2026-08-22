# Model Shadow local possession checkpoint separation

Status: `TEST`

This uninstalled and unpromoted v1.7 pure adapter follows the v1.6 local
possession anchored witness. It adapts the existing v0.6 cross-layer separation
pattern to the incompatible possession-specific anchored-witness contract.

```text
exact v1.6 anchored witness
  + verified v1.5 witness key fingerprints and declared actor digests
  + verified v1.6 anchor key fingerprints and declared steward digests
  -> refuse exact cross-layer key or declared-principal overlap
  -> exact observable-nonoverlap receipt
  + current exact local-possession snapshot
  -> unchanged v1.6 anchored continuity audit
```

The receipt proves only that the exact presented chain contains no identical
verified public-key fingerprint and no identical declared principal digest
across its witness and anchor layers. It retains domain-separated set digests
and seat counts, not the underlying sets.

One controller can generate distinct keys and declare distinct digests for both
layers. The focused selftest preserves that valid counterexample. Different
keys therefore do not prove independent custody; different declared digests do
not prove different real-world people; observable non-overlap does not exclude
collusion or prevent joint anchor/pin/witness-policy replacement.

Public receipts omit raw principal labels, public keys, signatures, configured
party labels, state paths, custody records, assessment receipts, private keys,
private context and model output. The module stores nothing and proves no host
trust, authenticated identity, actual human participation, independent
governance, trusted time, external retention, protected state, deletion or
rollback prevention, global single-use, provider execution, evaluation,
adoption, benefit, learning, installation, promotion, merge, Foundation
mutation or `CANON` authority.

Run:

```powershell
node shared/model-shadow-review-challenge-transition-local-possession-checkpoint-separation/selftest.js
```
