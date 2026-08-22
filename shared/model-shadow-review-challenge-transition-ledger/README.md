# Model Shadow review challenge transition ledger

Status: `TEST`

This uninstalled and unpromoted stateful leaf follows the v0.7 pairwise
transition gate. An explicit caller can record one exact forward transition
only when its previous separated-witness reference equals the current head of
one preserved caller-owned state root.

```text
exact v0.7 forward transition + explicit confirmation + exact local head
  -> exclusive-create next 12-digit sequence entry
  -> file fsync
  -> derive the next local head from the validated entry chain
  -> no execution or adoption authority
```

The immutable manifest binds a log id and genesis separated-witness reference
to the root. Each entry embeds the bounded v0.7 transition receipt, but not its
exact-rebuild input (which contains signatures and public keys). Reload can
therefore validate the local filename sequence, digest chain, transition
receipt digest, fixed truth boundary, and derived head. Exact upstream
signature re-verification after restart still requires the caller to present
the original transition package to `verifyPersisted`.

This closes one local race: after fork A advances a preserved root, fork B from
the same prior head is stale there. It does not close the global fork. Two
independent roots can accept A and B separately, and deleting or rolling back a
root can reopen either branch. The selftest preserves both counterexamples.
The caller-owned filesystem is not authenticated, protected, externally
retained, globally consistent, or deletion-resistant.

The exact confirmation phrase is not host authorization. Recording grants no
experiment execution, evaluation, adoption, training, installation,
promotion, merge, Foundation mutation, or `CANON` authority and proves no
human participation, human benefit, or learning.

Run:

```powershell
node shared/model-shadow-review-challenge-transition-ledger/selftest.js
```

