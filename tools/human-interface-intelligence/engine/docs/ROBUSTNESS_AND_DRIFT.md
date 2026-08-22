# Robustness and Decision Drift

## Bounded robustness

`axm_hii.robustness:probe_recommendation_stability` reruns the deterministic selection engine on a small set of synthetic, valid context variations.

Possible classifications:

- `stable_under_bounded_probes`
- `stable_blocked_under_bounded_probes`
- `pattern_sensitive`
- `status_sensitive`
- `not_enough_probe_surface`

A stable result is limited evidence that the current choice is not fragile to the tested dimensions. A sensitive result is an invitation to inspect the decision boundary, not a declaration that the base recommendation is wrong.

## Decision drift

`axm_hii.drift:classify_decision_drift` compares two decision receipts and reports which fingerprints changed:

- capability input;
- recommendation context;
- interface registry;
- engine identity/version;
- shared-contract identity/version;
- recommendation decision core.

The report describes candidate change causes. When several inputs change at once it does not claim causal sufficiency.

This is intended for future Module 1/2 growth: a changed recommendation can be traced back to a changed input or boundary instead of being mistaken for unexplained model drift.
