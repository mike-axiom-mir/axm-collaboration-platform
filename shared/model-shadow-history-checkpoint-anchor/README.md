# Model Shadow Portable History Checkpoint Anchor v2.2

Status: `TEST` · installed: `false` · promoted: `false`

This bounded pure adapter adds two caller-presented cryptographic layers above
the v2.1 portable settlement-history checkpoint:

```text
exact self-validating v2.1 checkpoint
  + exact caller witness policy + detached Ed25519 attestations
  -> exact witness receipt
  + exact caller anchor policy + caller expected anchor digest
  + detached Ed25519 authorizations
  + verified cross-layer fingerprint and declared-digest non-overlap
  -> exact anchored checkpoint receipt
  + current v2.1 ledger packages
  -> unchanged read-only v2.1 relative-history classification
```

Receipts retain references, counts, and domain-separated set commitments. They
do not retain PEMs, signatures, private keys, signer labels, model output,
private context, or ledger paths. The runtime performs no writes, signing, key
generation, provider call, experiment, evaluation, learning, or promotion.

The signatures prove possession of keys admitted by the exact caller-supplied
policies. They do not authenticate those policies, the caller-presented anchor,
real people, or independent controllers. One controller can generate all
distinct keys and declared digests. A caller can also jointly replace the
checkpoint, both policies, every signature, and the expected anchor with a new
internally valid package. No retention, rollback prevention, protected
monotonic state, global consistency, execution authority, adoption authority,
human benefit, merge, or `CANON` follows.

Run the focused verifier:

```bash
node shared/model-shadow-history-checkpoint-anchor/selftest.js
```

Mike Tobi / AXM remains the merge and `CANON` gate.
