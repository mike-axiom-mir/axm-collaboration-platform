# LEGO City Intake Harbor and External Gates v0.1 receipt

Status: **EXPERIMENTAL — DISABLED/WORKING IN FOCUSED TESTS**

- City graph: `9ade59d2008f9f124b151be71fd16e7d79014ceb1bc0558c7f161e5348ceb1c7`.
- Schema registry: `ba28514737f1ecb7a8df2a4af2dd5682d9ef5f0545dbd0dcfedbef13fe5ba4a0`.
- Twin surface: `0adcb6d32f19d25f619a6a74fcef45f2f3e0fe0306420cfc4ad0783acf0d08ec`.
- Intake Harbor assertions: 12 passed.
- City Gates assertions: 14 passed.
- Whole-blueprint conformance assertions: 15 passed.
- Live graph: 239 blocks; all 12 infrastructure modules represented.
- Schema registry: 427 identities; all seven common contracts represented.

Proven here: the Harbor route has exactly fifteen ordered steps; out-of-order,
private-value, missing temporary-install boundary, missing rollback receipt, and
state-tamper cases fail. A positive promotion decision remains an external
action and never changes `installed:false` or `promotionApplied:false`.

All five committed external adapters are disabled and bundle no transport.
Outbound plans require exact Authority Grid validation and remain inert. Inbound
bytes remain untrusted quarantine material. GitHub receiver proof requires exact
content plus open, unmerged, and final draft state; draft races fail. Offline
artifact manifests and bytes are locally verifiable.

Not claimed: actual unpacking/scanning/testing/installing, identity
authentication, any network call, protocol interoperability, public release,
transparency attestation, promotion, repository merge, or CANON.
