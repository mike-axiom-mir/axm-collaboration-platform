# LEGO City Authority Grid and Hands Rail v0.1 receipt

Status: **EXPERIMENTAL — WORKING IN FOCUSED TESTS**

- City graph: `ad1a0ebc85e6b90f0d779d55d285180b4056b07aac6ec8f1a6b11d0018337bce`.
- Schema registry: `18135a144f76664b5d773944390f7e0faedab8cbb646c042871f22cdf2d401f7`.
- Authority Grid assertions: 14 passed.
- Hands Rail assertions: 8 passed.

Proven here: capability without a matching policy rule is denied; changed
target/scope, stale policy, expiry, unauthenticated decision-maker, AI
self-authorization, AI release of high-risk authority, and one-use replay all
fail. The injected hand proves mandatory cleanup and typed success, partial,
and cancellation receipts. `EXECUTE_CONFINED` refuses an executor whose denial
probes and known gaps do not prove its declared boundary.

No real executor is bundled or invoked. Decision-maker authentication remains
a required caller-supplied verifier; this phase does not create an identity or
signature authority. Post-hoc duration measurement is not a hard runtime kill.
No claim is made for OS sandboxing, network isolation, physical confinement,
promotion, merge, or CANON.
