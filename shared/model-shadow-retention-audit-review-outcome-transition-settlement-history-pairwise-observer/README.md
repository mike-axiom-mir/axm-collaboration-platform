# Transition-settlement history pairwise observer v3.9

Status: `TEST` · installed: `false` · promoted: `false`

This explicitly invoked read-only adapter compares two complete caller-presented
v3.7 local proposal/settlement histories. It uses only each explicit settlement
root's fixed v3.7 namespace. It does not accept caller-selected record paths.

For each side, three unchanged v3.7 `inspect` calls validate the full local
chain around two independent canonical artifact captures. Every stored manifest,
proposal, and settlement self-digest is rechecked. Admission requires equal
snapshot observations, equal complete history captures, and exact agreement
between captured counts/references and every snapshot.

The minimized receipt retains path-independent artifact-sequence commitments and
normalized event-history digests. Normalization removes only local settlement
log identifiers, local proposal/settlement identifiers and times, local manifest
and proposal references, and the corresponding self-digest fields. It preserves
source entry references, heads, source observations, settlement classifications,
decisions, states, gates, and truth fields.

Compatible admitted histories can distinguish:

- exact replay of one complete local artifact history;
- matching complete normalized histories under distinct local artifacts;
- either direction of complete normalized prefix extension; or
- divergence at the first different proposal or settlement event.

This exposes an important v3.8 blind spot: two roots can have the exact same
v3.7 snapshot reference while retaining different intermediate held settlement
outcomes. The v3.7 snapshot commits the latest settlement reference, but an
earlier held settlement is not part of that later settlement's reference chain.

The captures and inspections are sequential, not atomic. Equal repeated results
cannot exclude a transient mutation and reversion, and either root can change
after its final inspection. The observer does not rebuild caller packages,
recapture the live v3.6 source, authenticate independent controllers, establish
external custody or protected monotonic storage, observe withheld histories, or
prove a globally consistent log.

Receipts omit raw stored artifacts, source and settlement paths, caller rebuild
packages, keys, signatures, review material, model output, and private context.
The observer writes no files, invokes no provider or experiment, performs no
evaluation or reconciliation, and grants no execution, adoption, installation,
promotion, merge, Foundation mutation, or `CANON` authority.

Run:

```powershell
node shared/model-shadow-retention-audit-review-outcome-transition-settlement-history-pairwise-observer/selftest.js
```

Mike Tobi / AXM remains the merge and `CANON` gate.
