# Grounded-growth frontier audit for v2.8

Status: `TEST` design freeze

## Observed frontier

The v2.7 retention ledger persists a complete v2.6 checkpoint and can detect an
exact source, forward source, rollback, replacement or fork, identity drift,
absence, or invalid current source. Its returned audit states
`auditReceiptPersistedByModule: false`. If the caller discards that receipt and
the source or retention root later disappears, the exact observation is lost.

The generic `shared/evidence-retention` service is not a compatible reuse route:
it accepts arbitrary event payloads, does not exact-rebuild a v2.7 audit package,
and does not provide one exclusive-created file-fsynced record per observation.
The v1.2 local receiver-custody adapter is protocol-specific to the v1.0/v1.1
assessment and acknowledgement package. The mirror event journal likewise
accepts arbitrary payloads and uses ordinary append writes. Reusing any of these
as if it closed the v2.7 audit boundary would overstate their contracts.

## Bounded v2.8 seam

Add a leaf-only local observation ledger which:

1. requires the complete v2.7 audit input and receipt and exact-rebuilds them
   against the live source and retention roots before any durable write;
2. writes only after an exact explicit unauthenticated confirmation;
3. requires a third existing caller-owned local root that is distinct and
   nonnested from both compared roots;
4. stores the complete minimized v2.7 audit in a canonical, digest-bound,
   exclusive-created, file-fsynced append-only observation chain;
5. reloads and validates that chain in a fresh process without either compared
   root or the transient v2.7 audit input;
6. preserves both hold and non-hold observations without adjudicating them;
7. fails closed on gaps, corruption, unexpected state, identity movement,
   concurrency, stale locks, and resource-bound violations.

## Decisive counterevidence

- The same controller may own all three roots, processes, confirmations, and
  caller-supplied times.
- A stored observation proves what this module validated at `observedAt`; it
  does not continuously monitor later source or retention state.
- Joint deletion or replacement of source, retention, and observation roots can
  create another internally exact triple and defeats original continuity.
- File `fsync` does not prove directory-entry, device-cache, hardware, power-loss,
  external-retention, or protected-monotonic durability.
- Confirmation text authenticates no host, actor, human, organization, or
  policy authority.
- No receipt authorizes provider execution, evaluation, learning, adoption,
  promotion, merge, Foundation mutation, or `CANON`.

Mike Tobi / AXM remains the merge and `CANON` gate.
