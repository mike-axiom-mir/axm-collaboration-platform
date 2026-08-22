# Grounded-growth frontier audit after v3.6

Status: `TEST`

## Proven starting point

Committed v3.6 exact-rebuilds and serializes a bounded sequence of exact v3.5
forward transitions beneath one caller-owned root. Its current head is local and
replayable from preserved bytes. It proves no separate decision phase, external
retention, global uniqueness, rollback resistance, authenticated authority, or
CANON status.

## Selected seam

The highest-value reachable seam was to split admission from settlement without
inventing a reviewer, custodian, provider, or human decision. v3.7 therefore
adds one distinct caller-owned settlement root:

1. `propose` exact-verifies a persisted v3.6 entry under equal bracketing source
   snapshots and records one pending proposal without advancing the settled head.
2. `settle` requires a separate exact confirmation and exact-rebuilds the stored
   proposal package.
3. A second source observation produces either an exact local settlement or one
   of four typed held settlements.

The observation records `PRESENT`, `ABSENT`, or `INVALID` capture states
separately from exact-entry verification and bracketing equality. Classification
is rederived from those facts. A later valid v3.6 entry does not invalidate the
still-exact proposed entry.

## Counterevidence retained

- The source observation ends before proposal or settlement persistence and is
  not atomic with either write.
- Transient source change and reversion are not excluded, and postwrite source
  currentness is not proven.
- Independent source/settlement pairs can settle divergent candidates from one
  genesis.
- Joint replacement of caller-owned source and settlement namespaces can reopen
  a divergent sequence one.
- File `fsync` is not directory-entry, hardware, or power-loss durability; a
  reported failure may leave inspectable bytes.
- Exact upstream rebuild still depends on caller-retained packages.

## Remaining frontier

The bounded technical requirements are ready, but the comparator remains
`DEGRADED` because 12 broader capabilities are unknown. The next genuine advance
requires an authenticated external settlement or custody surface, protected
monotonic state, a globally consistent log, atomic/current source semantics, or
real authorized review evidence. None can be inferred from a second local
directory or confirmation string.

Mike Tobi / AXM remains the merge and `CANON` gate.
