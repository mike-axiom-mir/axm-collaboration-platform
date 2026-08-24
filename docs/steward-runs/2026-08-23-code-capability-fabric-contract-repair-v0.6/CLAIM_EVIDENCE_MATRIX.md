# Claim-to-evidence matrix

| Claim | Required evidence class | Result | Evidence |
|---|---|---:|---|
| Identical exact inputs produce identical drafts | deterministic behavioral tests plus byte digests | PASS | Planner selftest (20 cases), host selftest (17 cases), live byte-bound receipt |
| The draft is grounded in current source bytes | direct observation, lineage, stale-source countertest | PASS | Source-state digest, generator refs, stale materialization and per-request preview rejection tests |
| Alternatives are valid structurally | static schema/readiness/module-contract validation | PASS | All five alternatives report empty static validation errors |
| One alternative is semantically correct | human domain judgment | UNKNOWN | Machine ranking is null; human selection is required |
| No candidate or target test ran | authority/resource receipt plus process boundary | PASS | Candidate receipt reports candidateExecuted false, testsExecuted false, childProcesses 0, networkRequests 0 |
| Source was not modified | before/after byte comparison plus receipt | PASS | Host tests and live receipt report sourceWritten false |
| Review controls render and can be opened | actual browser render and click | PASS | In-app browser interaction recorded in `BROWSER_EVIDENCE.md` |
| The change is safe to integrate into the current recovery checkout now | clean target, ancestry, and drift evidence | HOLD | Recovery checkout has 2,445 status entries and does not contain Fabric v0.5 base |
| The bounded branch is reviewable | Git commit and scoped diff | PASS | Technical commit `662af77f59d1456e76d96ea628ee630070a11e14`, 18 paths, 1,049 insertions, 17 deletions |

`PASS` never means `CANON`. Candidate execution, semantic selection, and integration remain separate claims and decisions.
