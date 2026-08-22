# Model Shadow Portable History Checkpoint Pairwise Transition v2.3

Status: `TEST` · installed: `false` · promoted: `false`

This pure adapter exact-rebuilds two v2.2 anchored portable settlement-history
checkpoints and compares them as one caller-presented pair:

```text
exact previous v2.2 anchored checkpoint package
  + exact candidate v2.2 anchored checkpoint package
  -> compare normalized anchor and witness policy profiles
  -> compare every v2.1 ledger-identity dimension
  -> compare complete proposal and settlement reference prefixes
  -> exact package replay, exact-history re-checkpoint, forward extension,
     or a typed HOLD
```

Policy profiles exclude validity-window times, checkpoint references, and policy
self-digests, which necessarily change between packages. They include stable
policy/anchor identity, anchor epoch, thresholds, signature-age bounds, declared
principal digests, and Ed25519 SPKI fingerprints. Any profile change is held;
v2.3 has no authenticated policy-rotation authority.

Two different candidates can independently extend the same previous history.
Only co-presenting them exposes their divergence; a withheld branch remains
invisible. Likewise, jointly replacing both checkpoints, both policy layers,
all signatures, and both expected anchors can produce another internally valid
pair. Pairwise success therefore proves no original pin, retention, global
uniqueness, globally consistent log, rollback prevention, or protected state.

The same controller can create every distinct key and declared digest. The
receipt stores only bounded references, counts, booleans, identity-drift names,
and profile digests—not public keys, signatures, private keys, ledger paths,
model output, or private context.

The module performs no write, network call, provider invocation, experiment,
evaluation, learning, installation, promotion, merge, or Foundation mutation.
It authorizes no execution or adoption and proves no human benefit or `CANON`.

Run:

```powershell
node shared/model-shadow-history-checkpoint-pairwise/selftest.js
```

Mike Tobi / AXM remains the merge and `CANON` gate.
