# Evidence routes

Status: `TEST`

| Claim | Native proof surface | Current verdict | Cannot prove |
| --- | --- | --- | --- |
| Current bytes were recorded by a later receipt | Exact path/current-digest match plus candidate self-digest and timestamp | Per-drift-row state | Original intent or correctness |
| Later receipt's tracked sources remain current | Candidate's digest-valid continuity receipt with zero tracked/missing/extra paths | Required for strongest coverage | Runtime behavior or quality |
| Candidate receipt's later source evolution is fully routed | Target exact attestation plus the candidate's exact evolution review with every drift row strongly covered | Transitive byte-lineage bridge | Candidate receipt byte-currentness, correctness, or regression absence |
| Legacy receipt is protected from future silent change | Current raw receipt SHA-256 external anchor | `PASS_FROM_ANCHOR_TIME` | Integrity before anchor |
| Game Night report is a known generated view | Exact `verify.js` writer statement, writer/report raw refs, exact path/schema and volatile field | `PASS` | Historical report bytes |
| Generated view's bounded semantics remain aligned | Current games/pass/failure/warning counts versus legacy recorded campaign counts | `PASS` or explicit mismatch | Full semantic equivalence or phone usability |
| Drift is intentional, correct, or beneficial | Human/steward decision plus native behavior and outcome evidence | `NOT_INFERRED` | Any digest or receipt alone |
| Human benefit improved | Voluntary LIVE human outcome and admitted bridge evidence | `NOT_RUN` | Source evolution review |

Counterevidence includes a candidate receipt that is not later, lacks a valid
self-digest, no longer has current tracked sources, records another digest, an
unrecognized generator/path/schema, a semantic-count mismatch, or any attempt
to treat a current external anchor as proof about history before the anchor.
