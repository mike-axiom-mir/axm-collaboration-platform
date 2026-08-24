# Evidence routes

Status: `TEST`

| Claim | Evidence that can support it | Result |
|---|---|---|
| Identical valid inputs produce identical records | exact repeat plus deterministic rebuild in the focused selftest | `PASS` |
| Lesson data excludes the named private/raw categories | closed request validator, all-false privacy declaration, output truth record, adversarial unknown-field checks | `PASS` for the exact implementation and fixtures |
| Fixed and held-out evidence remain distinct | suite authorship rule, duplicate-byte refusal, cross-suite overlap holds | `PASS` |
| Candidate and evidence lineage is byte-bound | SHA-256 plus byte-length references, exact candidate identity comparison, drift/alias countertests | `PASS` |
| Resources are bounded | closed maxima, one iteration, zero network/processes, finite arrays/strings, emitted lesson/release byte measurement | `PASS` for declared structural and byte ceilings |
| A technical pass does not admit learning | assessment, release candidate, receipt, contract, and snapshot all record persistent admission `false` | `PASS` |
| Rights are resolved | an exact authority reference can be bound, but issuer authenticity is not independently verified | `UNKNOWN`; separate verifier required |
| Supplied test observations are true | this steward validates structure, time, binding, failure/unknown state, and overlap; it does not run the tests | `UNKNOWN`; domain-native verifier required |
| Persistent lesson admission is authorized | authenticated Tier-3 decision and host admission do not exist in this rung | `NOT_RUN` / capability gap |
| Generated or supplied runtime is sandbox-safe | no supplied experimental runtime or general executor was run | `NOT_RUN` |
| Visual behavior works | no visual surface changed | `NOT_APPLICABLE`; no browser claim |
| Workshop continuity is preserved | 51/51 recursive Fabric suites, package continuity, City checks, and all required repository checks | `PASS` for the tested source commit |

Passing technical checks is not integration, promotion, CANON, or proof of a
human decision. Mike remains the final merge gate.
