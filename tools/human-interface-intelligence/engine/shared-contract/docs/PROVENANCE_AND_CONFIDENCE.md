# Provenance and Confidence Rules

1. Source references identify type, location, hash, verification time, and confidence.
2. `KNOWN` requires direct support from at least one source.
3. `INFERRED` requires written reasoning and at least one source basis.
4. `UNKNOWN` must not be converted to a confident default.
5. `CONFLICTED` blocks safety-sensitive recommendation until resolved or explicitly bounded.
6. `NOT_APPLICABLE` means the concept genuinely does not apply; it is not a substitute for missing evidence.
7. Recommendation confidence combines deterministic score separation and source confidence. It is not probability of success.
8. Generated explanations are provenance-bearing outputs, not new capability evidence.
