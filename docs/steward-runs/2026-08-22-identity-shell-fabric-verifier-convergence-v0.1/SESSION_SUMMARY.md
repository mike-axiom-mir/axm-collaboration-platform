# Session summary

The second hardening run found a real boundary split: compilation rejected several unsafe attachments, but a maliciously re-signed manifest could bypass parts of the primary verification/import/export path, while different canonical and policy drifts could bypass the independent verifier.

The product checkpoint closes those reproduced gaps without executing an adapter or changing the committed Keel shell. The primary verifier now replays compiler-owned semantic boundaries; the independent verifier separately checks portable canonical form and equivalent static invariants; import and export inherit the strengthened primary gate. Published schemas now state the component-class, continuity-state, lifecycle/lineage, event-specific lineage, retention, uniqueness, and local-reference topology clauses that can be expressed in JSON Schema.

Evidence at the exact product commit:

- 87 core assertions passed;
- 155 schema-topology assertions passed across 12 schemas;
- 26 held-out re-signed attacks were rejected at four gates;
- 20 fresh corpus processes, 20 Keel rebuild processes, and 20 fresh independent-verifier processes had zero failures;
- one Keel manifest digest was observed and it matches the prior committed digest;
- all ten required Workshop commands exited zero;
- `verify.js` reported 0 failures and 41 warnings;
- `verify-plus` reported `VERIFIED_WITH_LIMITS`.

Limits remain explicit. The evidence proves deterministic static compilation and manifest verification only. It does not prove live provider binding, human authorship authentication, runtime persistence, subjective continuity, consciousness, installation, promotion, inheritance, robotic actuation, browser behavior, or `CANON`.
