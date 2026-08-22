# Model Shadow retention-audit review-outcome history checkpoint anchor v3.4

Status: `TEST`

## Bounded result

v3.4 adds a pure two-layer detached-Ed25519 verification adapter above the
portable v3.3 review-outcome history checkpoint. The first layer exact-rebuilds
a caller-supplied witness policy and verifies fresh threshold attestations over
the exact checkpoint. The second exact-rebuilds a caller-supplied anchor policy,
matches a caller-presented expected anchor commitment, verifies threshold
authorizations, and refuses verified public-key or declared-principal reuse
between layers.

Minimized receipts retain references, counts, fingerprints as set commitments,
and attestation or authorization set commitments. They omit PEMs, signatures,
private keys, raw labels, paths, complete v3.2 records, complete v3.1 outcomes,
raw review material, model output, and private context. The anchored audit
exact-rebuilds the complete caller package before composing unchanged v3.3
exact, forward, rollback, replacement/fork, identity, absence, and invalid
classification behavior.

## Exact evidence

- Before: 1 required route `READY`, 20 bounded routes `BLOCKED`, and 12 broader
  routes `OPTIONAL_GAP`.
- After: all 21 bounded required routes `READY`; 12 broader routes remain
  `OPTIONAL_UNKNOWN`, so the result is `DEGRADED`, not complete.
- Focused v3.4: 109 assertions.
- Recorded verification: 52/52 commands passed, including 42 focused/inherited
  checks, all ten `AGENTS.md` checks, and 4,629 focused assertions.
- Source snapshot: 286 normalized current and inherited inputs.
- Browser verification: not applicable; no render or click pass is claimed.
- Independent Draft 2020-12 schema meta-validation: unrun because no validator
  is installed; runtime checks, static schema checks, and JSON parsing passed.

The first focused run correctly exposed a fixture-order mistake: a fresh-process
“exact” audit was replayed after its mutable ledger had been extended and
returned `FORWARD_HISTORY_EXTENSION`. Freezing a separate exact-ledger fixture
fixed the harness without weakening runtime behavior.

Parallel inherited checks then exposed a genuine v3.3 test flake: a
joint-replacement audit time could predate the replacement checkpoint because it
was derived from an earlier checkpoint plus ten seconds. The test now derives
that time from the replacement checkpoint. Production v3.3 behavior was not
changed; its 136-assertion suite passes.

## Counterevidence and open boundaries

Valid signatures prove key possession only relative to exact unauthenticated
caller policies. One controller generated every distinct test key and declared
digest, so non-overlap proves no independent controller or actual human. A
jointly regenerated checkpoint, policies, keys, signatures, and expected anchor
also formed another internally valid receipt, proving no original history or
replacement prevention.

No authenticated policy or checkpoint origin, separate retention, independent
custody, protected monotonic state, trusted time, global consistency, hold
resolution, live host observation, provider evaluation, human benefit,
learning, execution, adoption, promotion, merge, Foundation mutation, or
`CANON` is claimed. The dirty shared main checkout, specialist ZIP intake lane,
and global tools-index lane were not touched. Mike Tobi / AXM remains the merge
and `CANON` gate.
