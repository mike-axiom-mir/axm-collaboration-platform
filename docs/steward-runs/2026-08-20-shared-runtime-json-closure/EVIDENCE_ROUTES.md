# Evidence routes

| Claim | Native evidence | Verdict / limit |
|---|---|---|
| Six selected exported runtime surfaces moved to strict canonical JSON | `CURRENT_WORKSHOP_JSON_AUDIT.json`; `CURRENT_SHARED_RUNTIME_CLOSURE.json`; `tests/shared-runtime-deterministic-json-test.js` | PASS for the named six surfaces only |
| Safe JSON bytes did not drift | 36 selected safe fixture comparisons in `CURRENT_SHARED_RUNTIME_CLOSURE.json`; 78 full-inventory comparisons in `CURRENT_WORKSHOP_JSON_AUDIT.json` | PASS |
| Unsafe/lossy state is refused | 78/78 selected pairs and 158/169 full-inventory pairs; `tests/shared-runtime-deterministic-json-test.js` | PASS for twelve modules; phone campaign remains typed gap |
| Persistence does not silently lose state | Six isolated persistence journeys plus Mirror atomic-write refusal in `CURRENT_SHARED_RUNTIME_CLOSURE.json` | PASS; no probe files retained |
| Existing module behavior remains compatible | `CHECK_RESULTS.json` native focused checks | PASS within exercised suites |
| Mirror package manifest matches changed package bytes | `shared/mirror-core/BUILD_MANIFEST.json`; Mirror build verifier entry in `CHECK_RESULTS.json` | PASS |
| Sensorium generated artifacts are byte-current | unchanged parity comparator, LF checkout policy, parity entries in closure and checks | PASS for 33 artifacts |
| Sensorium full suite passes | `SENSORIUM_TEST_DEPENDENCY.json` | PASS only with existing ignored local visual receipt; clean-checkout evidence gap remains |
| Holodeck Node/browser dependency is live | Node self-tests, VM browser-global assertions, `HOLODECK_VISUAL_RECEIPT.json` | PASS for Composer and Screen Deck at observed viewport |
| Workshop required regression suite remains green | ten `REQUIRED` entries in `CHECK_RESULTS.json` | 10/10 PASS |
| The whole Workshop is representation-closed | `CAPABILITY_GAP_AFTER.json`; 285 static potential seams | NOT CLAIMED |
| Human benefit, model learning, or future shadow clone works | `CAPABILITY_GAP_AFTER.json` | UNKNOWN / candidate not received |
| Branch may merge, promote, or become CANON automatically | authority blocks in closure and check receipts | REFUSED |

Visual evidence cannot prove persistence, and script tests cannot prove rendered
pixels; those claim classes are kept in separate receipts. A static seam is a
review lead, not a confirmed behavior bug.
