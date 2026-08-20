# Claim-to-evidence routes

| Claim | Required evidence surface | Evidence | Result |
| --- | --- | --- | --- |
| The historical public baseline has the recorded Git identity | Fresh deterministic Git-object reads | `PUBLIC_BASELINE_OBSERVATION.json`; focused self-test | `PASS` |
| The seven research inputs are the recorded bytes | Fresh byte length and SHA-256 checks without source execution | `RESEARCH_INPUT_MANIFEST.json`; focused self-test | `PASS` |
| The disposition preserves stages, dissent, refusals, and authority boundaries | Acceptance review plus structural assertions | `RESEARCH_DISPOSITION.json`; `EVIDENCE_RECEIPT.json`; focused self-test | `PASS` |
| The research feed can use the existing bounded lab | Exact run reconstruction and digest comparison | `build-research-run.js`; `RUN_SUMMARY.json`; focused self-test | `PASS` |
| Every required capability for this replay exists | Deterministic requirement/inventory comparison | `CAPABILITY_REQUIREMENTS.json`; `CAPABILITY_INVENTORY.json`; `CAPABILITY_GAP_REPORT.json` | `READY` |
| The research independently converged across four models | Provider/runtime provenance and prior-exposure evidence | Not supplied | `UNKNOWN` |
| Signal links improve human comprehension | Voluntary representative live comparison | Protocol exists; no opt-in evaluation occurred | `UNKNOWN` / `DEGRADED` |
| The public baseline is still the current GitHub state | Fresh remote observation | Not performed | `NOT_PROVEN` |

Passing structural and deterministic checks proves the bounded technical claims
only. It does not prove subjective benefit, remote freshness, independence, or
`CANON` fitness.

