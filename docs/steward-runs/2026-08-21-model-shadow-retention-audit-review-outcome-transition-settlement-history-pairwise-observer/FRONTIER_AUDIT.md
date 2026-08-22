# Grounded-growth frontier audit after v3.8

Status: `TEST`

## Proven starting point

Committed v3.8 exact-rebuilds two latest caller packages against current v3.7
snapshots and compares heads. It explicitly does not compare complete proposal
and settlement histories. A v3.7 snapshot commits its last proposal and last
settlement references, but a later settlement does not chain an earlier held
settlement reference.

## Selected seam

The cheapest honest next step was an additive read-only complete-history
observer, not a v3.7 storage rewrite or another local custody claim. v3.9 reads
only each explicit settlement root's fixed canonical namespace. Three v3.7
inspections bracket two complete captures; every stored artifact self-digest is
rechecked under inherited byte and record limits.

The observer creates two path-independent views:

- an exact local artifact-sequence commitment; and
- a normalized ordered proposal/settlement event commitment that removes only
  declared local ids, times, bindings, and self-digest fields.

Compatible admitted histories can prove exact presented replay, normalized
equality, either local prefix direction, or the first different stored event.

## Counterevidence retained

- Two roots with the exact same v3.7 snapshot can retain different earlier held
  settlements; v3.8 exact replay is therefore not complete-history replay.
- Sequential inspection and capture are not atomic and cannot exclude a
  transient mutation and reversion.
- Either root can change after its final observation.
- The roots and controllers are not authenticated independent.
- Jointly replacing both presented pairs can produce another exact replay.
- Unpresented and withheld histories remain invisible.

## Remaining frontier

All 22 bounded requirements are ready, but 12 broader capabilities remain
unknown, so the route is `DEGRADED`. A genuine next advance needs atomic or
protected history capture, authenticated external custody, a globally
consistent log, or real authorized steward reconciliation. A caller-controlled
pairwise commitment cannot supply those facts.

Mike Tobi / AXM remains the merge and `CANON` gate.
