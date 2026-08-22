# Model Shadow review challenge transition receiver acknowledgement

Status: `TEST`

This uninstalled and unpromoted read-only leaf follows v1.0 declared disclosure.
A caller supplies one exact assessment, a two-to-ten receiver Ed25519 policy, and
zero or one detached acknowledgement per enabled receiver label. The leaf:

- exact-rebuilds the complete v1.0 assessment;
- exact-rebuilds the caller receiver policy and its assessment binding;
- verifies every supplied detached Ed25519 acknowledgement;
- refuses duplicate labels, duplicate keys, unknown or disabled receivers, bad
  signatures, altered payload bindings, and invalid time windows;
- emits a typed threshold-met or threshold-incomplete decision; and
- retains only acknowledgement, label, key, payload, assessment, roster, and
  policy digests—not raw receiver labels, public keys, or signatures.

```text
exact v1.0 assessment + caller receiver-key policy
  + detached acknowledgements of exact assessment and roster references
  -> cryptographically valid declared-key threshold or incomplete hold
  -> no transport, persistence, adoption, execution, or CANON authority
```

The signature scope says only that the declared key signed an acknowledgement of
the exact references presented by the caller. Every acknowledgement explicitly
contains `NO_DURABLE_RETENTION_CLAIM`. The self-test creates two distinct keys in
one process and meets the threshold, proving that key and label distinctness are
not evidence of independent real-world receivers, actual network delivery,
receiver reads, durable storage, external retention, or rollback resistance.

Private keys exist only in the self-test signer fixture and are never passed to
the runtime leaf. Caller timestamps are not trusted time. Receipts grant no host,
identity, human, provider, evaluation, adoption, installation, promotion, merge,
Foundation, or `CANON` authority and prove no benefit or learning.

Run:

```powershell
node shared/model-shadow-review-challenge-transition-receiver-ack/selftest.js
```
