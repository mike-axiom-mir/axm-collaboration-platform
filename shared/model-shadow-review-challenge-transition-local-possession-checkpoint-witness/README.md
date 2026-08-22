# Model Shadow local possession checkpoint witness

Status: `TEST`

This uninstalled and unpromoted v1.5 pure adapter follows the v1.4 local
possession continuity checkpoint. It adapts the existing v0.4 challenge-ledger
witness pattern to the incompatible v1.4 possession-checkpoint schema.

```text
exact v1.4 checkpoint
  + checkpoint-specific caller public-key policy
  + detached Ed25519 witness attestations
  -> exact threshold witness receipt
  + current exact v1.4 snapshot
  -> unchanged v1.4 comparison
  -> witnessed exact / extends / absence-invalid-identity / rollback-replacement
```

The witness binds the checkpoint digest, source snapshot, receiver and
challenger identity digests, receiver policy and response-set digest. It makes
checkpoint modification detectable while the original caller policy and witness
inputs remain available. Public receipts retain only references, digests, key
fingerprints, actor digests, declared actor kinds and caller times—not raw actor
labels, public keys, signatures, configured party labels, state paths, custody
records, assessment receipts, private keys, private context or model output.

The key policy is deliberately `CALLER_SUPPLIED_UNAUTHENTICATED`. A replacement
policy and its own valid signatures can witness a different valid checkpoint.
The module therefore authenticates no host trust root, signer identity, human,
observer origin or trusted time. It stores neither checkpoint nor witness,
proves no external retention, prevents no deletion or rollback, establishes no
global single-use, and grants no execution, evaluation, adoption, training,
installation, promotion, merge, Foundation mutation or `CANON` authority.

Run:

```powershell
node shared/model-shadow-review-challenge-transition-local-possession-checkpoint-witness/selftest.js
```
