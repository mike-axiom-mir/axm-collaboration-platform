# Grounded-growth frontier audit for v3.4

Status: `TEST` design freeze

## Observed frontier

v3.3 provides a caller-portable full-history boundary that can detect a later
ledger rewrite relative to a retained checkpoint. Its self-digest authenticates
no checkpoint origin, steward, reviewer, host, policy, retention, or custody.
The repository already demonstrates a bounded two-layer detached-signature
pattern for an older incompatible checkpoint contract.

## Bounded v3.4 seam

Add an adapter above the exact v3.3 checkpoint which:

1. self-validates the exact v3.3 checkpoint;
2. exact-rebuilds a closed caller-supplied witness policy;
3. verifies bounded, fresh, domain-separated Ed25519 attestations with unique
   key, fingerprint, and declared-principal seats;
4. emits a minimized witness receipt without PEMs or signatures;
5. exact-rebuilds a second caller-supplied anchor policy and exact expected
   anchor commitment;
6. verifies bounded detached Ed25519 authorizations;
7. refuses any public-key fingerprint or declared-principal digest reused
   across the two verified layers;
8. emits a minimized anchored receipt and composes the unchanged v3.3
   read-only audit;
9. performs no signing, key generation, durable write, provider call,
   execution, evaluation, adoption, or promotion; and
10. remains `TEST`, uninstalled, unpromoted, and gated by Mike Tobi / AXM.

## Decisive counterevidence

- The policies and expected anchor are caller-supplied and unauthenticated.
- Distinct keys and declared digests do not prove distinct controllers; one
  controller can create every seat.
- Replacing the checkpoint, policies, keys, signatures, and expected anchor
  together can create another internally valid package.
- Signatures do not prove separate retention, external custody, original
  history, protected monotonic state, rollback prevention, global consistency,
  trusted time, actual human review, or hold resolution.
- Synthetic fixtures prove no live host observation, provider evaluation,
  human benefit, learning, execution, adoption, merge, or `CANON`.

Mike Tobi / AXM remains the merge and `CANON` gate.
