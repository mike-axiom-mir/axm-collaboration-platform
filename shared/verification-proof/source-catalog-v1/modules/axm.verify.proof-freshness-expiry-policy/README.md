# Proof Freshness and Expiry Policy

Detached AXM Verification & Proof organ for seed 010.

It evaluates whether a proof is still relevant under an explicit age limit and exact context dimensions. It distinguishes `FRESH`, `STALE`, and `UNKNOWN`; freshness never becomes PASS.

## Truth boundaries

- Context changes are compared exactly under declared dimensions.
- Missing required context yields UNKNOWN, not FRESH.
- Age expiry yields STALE.
- Future-dated receipts yield UNKNOWN.
- FRESH means no declared invalidator was found, not that the claim is true.

Status: TEST-HOLD, detached, v0.1.0.
