# Recommendation Assurance

Recommendation Assurance is a module-owned, advisory cross-check applied after deterministic interface selection.

It does not change the shared recommendation schema, select a different pattern, grant execution, or become canon. It answers a different question: **what must still be true before this recommendation is implementation-ready?**

Checks include:

- context validity and exact recommendation/input binding;
- active registry identity and deterministic reproduction;
- hard unsafe/offline eligibility;
- compute, attention, time-proxy, and complexity-proxy budget fit;
- required interface-feature augmentation;
- explicit confirmation and non-destructive preview plans;
- supporting tools and device fit;
- deterministic accessibility conflicts and unsupported-needs review;
- top-candidate score margin.

Statuses:

- `PASS` — no deterministic implementation gap was found;
- `REVIEW` — the recommendation can remain valid, but named work or human review is required;
- `BLOCKED` — input binding, active dependencies, or a hard safety requirement conflicts;
- `NOT_APPLICABLE` — no executable pattern was recommended.

The schema is `integration/schemas/recommendation-assurance.schema.json`.
