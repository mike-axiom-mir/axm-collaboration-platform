# Future physics integration

No physics engine is implemented or connected. A future physics service is evidence-producing and model-specific; it is not an oracle that upgrades every claim to physical truth.

A physics result must identify:

- input model and exact revision/hash;
- solver/model name and version;
- request parameters, units, tolerances, and assumptions;
- output evidence and integrity reference;
- limitations, convergence/failure state, and reproducibility information;
- which truth facet may change and which facets must not change.

The safe sequence is proposal → approved simulation request → bounded adapter invocation → evidence record → separate proposal to update the `verification` or `physical_status` facet. A successful simulation can support `simulated`; it cannot claim `physically_tested`, `measurement_backed`, safe construction, or a built object.

Before promotion, test unit/schema mismatch, unsupported model, stale input revision, solver failure, contradictory evidence, nondeterministic tolerance, cancellation, data leakage, and replay from the recorded request.
