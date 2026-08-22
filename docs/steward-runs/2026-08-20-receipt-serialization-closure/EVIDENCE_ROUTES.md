# Evidence routes

| Claim | Required evidence | Current route | State |
|---|---|---|---|
| A real receipt serialization failure occurred | Sealed append-only event plus exact source digest | `../2026-08-20-grounded-growth-voluntary-choice-frontier/SESSION_SEGMENT.jsonl`, sequence 14 | `OBSERVED` |
| Current Grounded Growth serializers remain exposed | Direct execution against one bounded undefined-property fixture plus source digests | `CURRENT_SERIALIZATION_CLOSURE_EVALUATION.json` → `legacyConsumers` | `TESTED` |
| The existing core refuses unsafe representations | Held-out unsafe fixtures and explicit thrown errors | `CURRENT_SERIALIZATION_CLOSURE_EVALUATION.json` → `heldOutEvaluation.unsafe` | `TESTED` |
| The existing core preserves valid representations | Canonicalize, parse, and exact re-canonicalize | `CURRENT_SERIALIZATION_CLOSURE_EVALUATION.json` → `heldOutEvaluation.safe` | `TESTED` |
| Reuse is better than a duplicate serializer | Existing published-byte provenance, self-test, held-out comparison, and no new implementation | evaluation `capability` and `decision` | `SUPPORTED_WITH_LIMITS` |
| Current consumers are migrated | Clean checkout, path-scoped diffs, native verifiers, persistence replay | none | `NOT_RUN` |
| Browser and Node outputs are identical | Same fixtures executed in both live runtimes | none | `NOT_RUN` |
| Human benefit or model reasoning equivalence exists | Voluntary human evidence or an evidence route capable of proving hidden reasoning identity | none | `NOT_CLAIMED` |

The deterministic continuity mirror is a deferred direction only. Platform research can return a candidate later; this lane grants it no execution or integration authority.
