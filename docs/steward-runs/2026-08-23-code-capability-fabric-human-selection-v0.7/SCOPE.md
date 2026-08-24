# Code Capability Fabric human-selection steward run v0.7

Status: `TEST`

This rung adds one pure, provider-neutral capability: bind a human-declared review-seat choice to an exact v0.6 repair candidate, exact selected candidate bytes, exact sealed grounded-consent instance/evaluation, ordered four-root evidence references, a bounded time window, a nonce, and a declared replay-ledger snapshot.

The only successful result is `AUTHENTICATION_REQUIRED` with effect `INERT_REVIEW_BINDING` and authority `NONE`. The binder hashes the selected bytes in memory and retains only their reference. It reads no filesystem, writes nothing, loads no provider, uses no network, starts no process, and cannot execute, test, install, integrate, publish, promote, or change `CANON`.

Review found and repaired two concrete design gaps before commit:

1. A consent evaluation alone did not expose which candidate its consent instance named. v0.7 therefore requires the sealed instance, binds its subject digest to the candidate packet, and refuses permissions, network, or lifecycle authority.
2. A candidate packet SHA reference was not proof that the supplied selected bytes matched. v0.7 therefore hashes the actual in-memory bytes and fails closed on length or digest drift.

This rung does not authenticate Mike or another natural person. Seat references, root evidence references, supplied clocks, and supplied replay ledgers remain declarations until independent trusted services verify them.

Technical commit: `f9534d05bb231d7a9235e4589365cb4a0badfb08`

Base: `a2e29534c837de0ffec6347ba2023cdfea0a97b2` (Fabric v0.6 completed branch).
