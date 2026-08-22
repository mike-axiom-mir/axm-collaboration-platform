# v3.9 transition-settlement complete-history pairwise-observer evidence

Status: `TEST` · installed: `false` · promoted: `false`

This folder binds the v3.9 normalized source snapshot, deterministic capability
comparison, 57-command verification receipt, five claim-to-evidence routes, and
a sealed ordered session segment.

The bounded result is a read-only observer over two caller-presented complete
v3.7 local histories. Each side requires three equal full-chain inspections,
two equal canonical history captures, self-digest-valid fixed artifacts, and
agreement between captured counts/references and every snapshot.

Compatible admitted sides distinguish exact complete artifact replay, matching
normalized event history, either direction of complete prefix extension, and
earliest event divergence. Normalization is declared and path-independent.

The decisive counterexample uses two valid roots with the exact same v3.7
snapshot reference, final head, counts, local ids, and latest settlement. Their
first held settlements differ. v3.8 therefore reports exact snapshot replay,
while v3.9 locates first-settlement complete-history divergence.

This remains sequential caller-presented local evidence. It is not an atomic
filesystem snapshot, cannot exclude transient mutation/reversion or withheld
histories, does not recapture live v3.6 state, and authenticates no independent
controller or external custody.

No global uniqueness, protected monotonic state, rollback prevention, trusted
time, actual human review, reconciliation, benefit, learning, execution,
adoption, promotion, merge, Foundation mutation, or CANON is proven.

Browser verification: not applicable. No browser surface changed.

Independent Draft 2020-12 schema meta-validation: unrun. Python `jsonschema`,
Ajv, Hyperjump, and Node `jsonschema` were unavailable; no dependency was
installed. Runtime validation and recursive closed-object topology checks pass.

Mike Tobi / AXM remains the merge and `CANON` gate.
