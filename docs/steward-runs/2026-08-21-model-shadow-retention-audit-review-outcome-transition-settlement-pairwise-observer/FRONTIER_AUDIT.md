# Grounded-growth frontier audit after v3.7

Status: `TEST`

## Proven starting point

Committed v3.7 exact-rebuilds a persisted v3.6 entry at proposal time and again
at separately confirmed local settlement. It serializes exact and held receipts
beneath one caller-owned settlement root. It cannot expose a contradictory root
that the caller does not co-present.

## Selected seam

The cheapest honest next step was a read-only pairwise observer, not another
local custody claim. v3.8 takes two explicit v3.7 configurations plus each
caller-retained latest-settlement package. For each side it brackets exact
package verification with settlement-root snapshots and requires the receipt to
be current with no pending proposal.

Admitted compatible frontiers can establish only bounded relative facts:

- exact presented snapshot replay;
- matching current heads in distinct snapshots;
- one latest exact settlement directly extending the other head;
- different heads at the same local epoch; or
- different epochs whose relation is unresolved.

The last category is deliberately not called a fork: complete histories could
contain ancestry that the latest receipt pair cannot reveal.

## Counterevidence retained

- An exact replay pair cannot expose a separately withheld same-epoch conflict.
- Matching heads do not prove matching proposal or settlement histories.
- The two caller-owned roots and controllers are not authenticated independent.
- Root observations are sequential rather than atomic and either root can
  change after its final snapshot.
- v3.8 does not recapture live v3.6 source state or source-entry currentness.
- Jointly replacing both presented pairs can produce another exact replay.

## Remaining frontier

All 21 bounded requirements are ready, but 13 broader capabilities remain
unknown, so the route is `DEGRADED`. A genuine next advance needs complete
history comparison, authenticated independent custody, protected monotonic
state, atomic observation, a globally consistent log, or real authorized human
reconciliation. A caller-controlled pairwise receipt cannot supply those facts.

Mike Tobi / AXM remains the merge and `CANON` gate.
