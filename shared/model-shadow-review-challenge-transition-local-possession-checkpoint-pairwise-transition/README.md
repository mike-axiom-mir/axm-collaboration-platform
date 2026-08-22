# Model Shadow local possession checkpoint pairwise transition

Status: `TEST`

This uninstalled and unpromoted v1.8 pure adapter follows the v1.7 local
possession checkpoint separator. It adapts the existing v0.7 pairwise
transition pattern to the incompatible possession-specific chain.

```text
exact previous v1.7 separated possession chain
  + exact candidate v1.7 separated possession chain
  -> compare anchor, witness-policy identity, declared receiver/challenger,
     receiver policy, checkpoint time and response entries
  -> exact replay, forward response extension, or typed HOLD
```

A forward extension must keep the anchor identity, witness-policy identity,
declared receiver and challenger digests, and exact receiver-policy reference;
advance checkpoint time; preserve every prior response entry; and add at least
one challenge response. The witness-policy digest is expected to change because
the exact policy binds its checkpoint and response set. Identity continuity is
therefore checked by policy id and schema, not by requiring the old digest.

The comparison remains pairwise. Two different candidates can each extend the
same previous checkpoint and pass independently. Only co-presenting those
forks exposes the response omitted by the other branch. A withheld or
never-presented branch remains invisible, so this is not a globally consistent
log, protected monotonic state, global single-use, rollback prevention or fork
exclusion.

Both checkpoints carry source-snapshot references, but this adapter receives no
live state root or snapshot bytes and performs no source recapture. Exact chain
verification therefore does not independently prove that either presented
checkpoint still describes current source state.

The same controller can still create every key, declared digest, policy,
checkpoint and branch. Public receipts retain bounded references, declared
party digests and response-entry digests, not raw actor/steward labels, public
keys, signatures, configured party labels, state paths, custody records,
assessment receipts, private keys, private context or model output.

The module stores nothing and proves no independent custody/controller,
authenticated identity, anti-collusion, host trust, policy authority, external
retention, trusted time, provider execution, evaluation, adoption, benefit,
learning, installation, promotion, merge, Foundation mutation or `CANON`.

Run:

```powershell
node shared/model-shadow-review-challenge-transition-local-possession-checkpoint-pairwise-transition/selftest.js
```
