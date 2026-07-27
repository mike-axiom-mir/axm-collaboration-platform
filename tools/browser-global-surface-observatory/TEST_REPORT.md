# Browser Global Surface Observatory focused test report

Status: `PASS` for 26 focused fixture and live Workshop checks. Candidate remains detached `EXPERIMENTAL`.

- All 282 unique graph-bounded HTML/JavaScript sources matched their graph hashes.
- The live map observed 224 explicit `window` / `globalThis` patterns: four definitions and 220 references.
- Two dynamic bracket names remain unresolved.
- No exact global symbol was defined across multiple source ownership scopes, so no live review packet was fabricated.
- Fixture checks cover dot/bracket definitions, same-file constants, dynamic holds, defineProperty, references, deletion, shared-source deduplication, hash drift, deterministic fingerprints, and question-only requests.
- Browser visual judgment is `NOT_RUN`.
- No JavaScript execution, live-global read/mutation, collision verdict, install, permission, promotion, GitHub, or CANON claim is made.
