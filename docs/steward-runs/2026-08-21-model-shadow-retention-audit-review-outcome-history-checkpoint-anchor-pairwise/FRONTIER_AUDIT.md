# Grounded-growth frontier audit for v3.5

Status: `TEST`

The committed v3.4 frontier provides exact, minimized two-layer detached
Ed25519 evidence over a v3.3 review-outcome history checkpoint. It deliberately
does not provide an authenticated trust root, original-history proof, external
custody, or protected monotonic state. The Workshop updater trust-root registry
also contains no promoted release key. Inventing any of those capabilities in
this lane would therefore be false.

The highest-value reachable additive seam is pairwise anchored continuity:
exact-rebuild two v3.4 caller packages, compare stable policy profiles and the
complete ordered history, and use the caller-declared anchor epoch as an extra
hold dimension without treating it as trusted monotonic state.

The adapter admits only:

- exact replay of the same anchored package;
- a later exact-history recheckpoint with exactly the next declared epoch; or
- a complete-history prefix extension with exactly the next declared epoch.

It holds policy, identity, time, checkpoint-id, snapshot, epoch, rollback, and
fork anomalies. History ancestry precedes epoch symptoms so two independently
valid candidates at the same next epoch remain visibly divergent when both are
presented.

Counterexamples retained as first-class evidence:

- either forward candidate can be withheld;
- two divergent candidates can independently claim the same next epoch;
- both compared packages, policies, keys, signatures, anchors, and epochs can be
  jointly replaced by one controller and still form another internally valid
  relative pair.

Consequently the result stays `TEST`, uninstalled, unpromoted, review-only, and
outside Foundation or `CANON` authority.
