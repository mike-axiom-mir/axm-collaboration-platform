# Model Shadow review challenge transition gate

Status: `TEST`

This uninstalled and unpromoted read-only leaf compares two exact-rebuilt v0.6
separated chains. It emits one pairwise receipt for an exact replay, a forward
checkpoint extension, or a typed contradiction involving anchor identity,
self-declared anchor epoch, anchor policy, ledger identity, checkpoint identity,
checkpoint time, or prior entries.

```text
exact previous v0.6 separated chain
  + exact candidate v0.6 separated chain
  -> pairwise anchor/checkpoint/entry comparison
  -> consistent replay, consistent extension, or typed HOLD
```

The comparison is deliberately pairwise. Two different candidates can each
extend the same previous chain and pass independently. Only when those forks are
co-presented does the comparison expose that one omits the other's entry. The
selftest preserves this counterexample. A withheld or never-presented branch
therefore remains invisible; this is not a globally consistent log, global
single-use, or fork-exclusion proof.

Anchor epochs and all timestamps remain caller-declared. A later presented
epoch is not protected monotonic state. The receipt grants no host, identity,
human, execution, evaluation, adoption, training, installation, promotion,
merge, Foundation, or `CANON` authority and proves no external retention,
rollback prevention, controller independence, collusion resistance, benefit,
or learning.

Run:

```powershell
node shared/model-shadow-review-challenge-transition-gate/selftest.js
```
