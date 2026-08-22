# Grounded Growth Human Bridge

Status: `TEST`

Clone, canonical comparison, and digest preparation use the shared strict
`deterministic-json-core`. Existing JSON-safe bridge bytes remain unchanged;
unsupported JSON state is refused before evidence mapping.

This leaf adapter closes the boundary between native Human Benefit Evidence and
Grounded Growth Outcomes. A human verdict is mapped only when the capability
cycle, evaluation and judgment all verify natively; the evidence is declared
`LIVE`; claim, capability and beneficiary scope agree; source trust is routed;
the evaluated candidate surface is explicitly linked to the capability
candidate; and current closure covers the complete ancestry.

The bridge closure is itself a deterministic receipt. Its exact source list
derives both the closure digest and the `coveredDigests` passed to Grounded
Growth, so an unrelated receipt cannot be paired with a caller-written digest
list. External artifact state remains a caller declaration; the bridge only
re-verifies the native cycle, evaluation and judgment content it receives.

Synthetic evidence remains valuable for contract testing, but always maps to
`UNKNOWN` with `SYNTHETIC_HOLD`. Invalid, scope-mismatched or incompletely
closed inputs also map to `UNKNOWN`.

The bridge does not authenticate a human source. For a named local steward it
preserves an exact local declaration reference. A cohort requires an external
cohort-authentication reference. Those references are routing inputs, not
claims that this module performed identity verification.

The bridge performs no writes, execution, install, permission grant, promotion,
CANON decision, Foundation mutation or model-weight training.

Run the focused contract checks with:

```powershell
node shared/grounded-growth-human-bridge/selftest.js
```
