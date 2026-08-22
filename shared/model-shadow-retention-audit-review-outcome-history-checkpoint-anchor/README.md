# Model Shadow retention-audit review-outcome history checkpoint anchor

Status: `TEST` · installed: `false` · promoted: `false`

This pure, read-only v3.4 adapter adds two caller-presented cryptographic
layers above the v3.3 portable review-outcome history checkpoint:

```text
exact self-validating v3.3 checkpoint
  + exact caller witness policy + detached Ed25519 attestations
  -> minimized exact witness receipt
  + exact caller anchor policy + caller-presented expected anchor digest
  + detached Ed25519 authorizations
  + verified cross-layer public-key and declared-principal non-overlap
  -> minimized exact anchored-checkpoint receipt
  + current configured v3.2 ledger
  -> unchanged read-only v3.3 relative-history classification
```

The receipts retain references, counts, and domain-separated set commitments.
They omit public-key PEMs, signatures, private keys, raw actor or steward
labels, configured paths, complete ledger records, complete review outcomes,
raw review material, model output, and private context. The runtime verifies but
does not generate signatures or keys and performs no durable write.

The signatures prove possession of keys admitted by the exact caller-supplied
policies. They do not authenticate those policies, their declared identities,
the caller-presented anchor, the checkpoint origin, a host, a real person, an
independent controller, or trusted time. One controller can create every
distinct key and digest. A caller can also replace the checkpoint, both
policies, every signature, and expected anchor with another internally valid
package. No separate retention, independent custody, rollback prevention,
protected monotonic state, global consistency, hold resolution, provider
execution, evaluation, benefit, learning, execution or adoption authority,
promotion, merge, or `CANON` follows.

Run:

```powershell
node shared/model-shadow-retention-audit-review-outcome-history-checkpoint-anchor/selftest.js
```

Mike Tobi / AXM remains the merge and `CANON` gate.
