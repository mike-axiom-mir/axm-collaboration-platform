# Model Shadow review challenge checkpoint witness

Status: `TEST`

This uninstalled and unpromoted read-only leaf follows the review challenge
continuity observer. It verifies detached Ed25519 signatures over one exact
challenge checkpoint, then makes that exact witnessed checkpoint drive a later
continuity comparison.

```text
exact checkpoint + checkpoint-specific caller key policy + detached signatures
  -> exact signer-key-possession witness
  -> witnessed checkpoint + current ledger snapshot
  -> exact / extends / hold continuity receipt
```

The witness makes checkpoint modification detectable while the original policy
and witness are available. Its receipt retains key fingerprints and actor
digests, not raw actor strings, public keys, signatures, private keys, private
context, or model output.

The key policy is deliberately `CALLER_SUPPLIED_UNAUTHENTICATED`. A replacement
policy and its own valid signatures can produce a different valid witness. The
module therefore does not authenticate a host trust root, a signer identity, a
human, observer origin, or trusted time. It does not store the checkpoint or
witness, prove external retention, prevent deletion or rollback, establish
global single-use, or grant execution, evaluation, adoption, training,
installation, promotion, merge, Foundation mutation, or `CANON` authority.

Run:

```powershell
node shared/model-shadow-review-challenge-witness/selftest.js
```
