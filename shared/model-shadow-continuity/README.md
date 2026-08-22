# Model Shadow Continuity Observer

Status: `TEST`

This data-only leaf observes one model seat's **structured** output trace across
two exact snapshots. It is the bounded technical seam behind the idea of a
deterministic shadow clone watching model continuity and drift.

It compares only caller-declared identifiers, positions, evidence stages,
content digests, source references, capability identifiers, permission
requests, and authority requests. It does not read hidden reasoning, infer
free-text semantic equivalence, invoke a provider, or claim that two snapshots
represent the same persistent mind.

`STRUCTURED_TRACE_MATCH` means only that those declared fields match. The
receipt separately shows whether the referenced output artifacts differ and
never upgrades a structured match into raw-output equivalence.

The comparison is valid only when both snapshots bind:

- the same exact task and context references;
- the same exactly disclosed provider, model, seat, and provenance;
- a forward capture sequence; and
- digest-valid strict-JSON snapshot bodies.

Permission expansion, new authority requests, or loss of an affirmed
constraint are `CRITICAL_DRIFT`. Other changes remain visible without being
called failure, correctness, learning, or human benefit.

The strongest outputs are:

1. an exact-rebuild continuity receipt;
2. an input-shaped Baseline Simulation Lab planning projection; and
3. a note-free Review Inbox projection that is **not submitted** by this leaf.

No raw output or private context is embedded. No source, model, memory,
Foundation, permission, training state, install state, promotion state, merge
state, or `CANON` state is changed.

Run:

```powershell
node shared/model-shadow-continuity/selftest.js
```
