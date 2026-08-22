# Model Shadow local possession checkpoint anchor

Status: `TEST`

This uninstalled and unpromoted v1.6 pure adapter follows the v1.5 local
possession checkpoint witness. It adapts the existing v0.5 anchor pattern to
the incompatible possession-specific witness contract.

```text
exact v1.5 checkpoint witness
  + caller-presented expected anchor digest
  + exact checkpoint-witness anchor policy
  + detached Ed25519 anchor authorizations
  -> exact anchored witness chain
  + current exact v1.4 local-possession snapshot
  -> unchanged v1.5 witnessed comparison
  -> anchored exact / extends / absence-invalid-identity / rollback-replacement
```

Each anchor authorization binds the exact anchor and presented pin, witness
policy, witness, checkpoint, source snapshot, configured receiver and
challenger identities, receiver policy and response entries. Substituting only
the v1.5 witness or witness policy is therefore detectable relative to the
presented anchor and its signatures.

That is relative integrity, not policy authority or replacement prevention.
The anchor and expected digest are both
`CALLER_PRESENTED_PIN_UNAUTHENTICATED`. Replacing the anchor, pin, witness
policy, witness and signatures together can produce another valid anchored
chain. The self-declared anchor epoch is not proven monotonic.

Public receipts retain references, digests, key fingerprints, steward digests,
declared steward kinds and caller times—not raw steward labels, public keys,
signatures, configured party labels, state paths, custody records, assessment
receipts, private keys, private context or model output. The module stores
nothing and proves no host trust, real-world identity, authenticated human,
trusted time, external retention, protected storage, deletion or rollback
prevention, global single-use, provider execution, evaluation, adoption,
benefit, learning, installation, promotion, merge, Foundation mutation or
`CANON` authority.

Run:

```powershell
node shared/model-shadow-review-challenge-transition-local-possession-checkpoint-anchor/selftest.js
```
