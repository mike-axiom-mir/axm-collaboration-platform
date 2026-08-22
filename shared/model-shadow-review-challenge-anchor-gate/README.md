# Model Shadow review challenge anchor gate

Status: `TEST`

This uninstalled and unpromoted read-only leaf follows the signed checkpoint
witness. It verifies that a separate threshold of anchor keys signed the exact
v0.4 witness, its checkpoint-specific witness policy, checkpoint, ledger
manifest, and entries digest. The expected anchor digest must also match the
exact anchor policy.

```text
exact v0.4 witness
  + caller-presented expected anchor digest
  + exact checkpoint-witness anchor policy
  + detached anchor authorizations
  -> anchored witness chain
  -> anchored checkpoint continuity audit
```

This blocks substitution of only the witness policy relative to the anchor and
pin that the caller presents. The receipt retains digested key and authorization
identifiers, key fingerprints, and steward digests—not raw identity strings,
public keys, signatures, private keys, state paths, private context, or model
output.

The anchor and its expected digest are both deliberately caller-presented and
unauthenticated. Replacing them together, with matching new signatures, can
produce a different valid anchored witness. The self-declared anchor epoch is
not proven monotonic. This module therefore does not prove Mike or host trust,
real-world signer identity, actual human participation, trusted time, external
retention, protected storage, deletion or rollback prevention, global
single-use, execution, evaluation, adoption, training, installation, promotion,
merge, Foundation mutation, or `CANON` authority.

Run:

```powershell
node shared/model-shadow-review-challenge-anchor-gate/selftest.js
```
