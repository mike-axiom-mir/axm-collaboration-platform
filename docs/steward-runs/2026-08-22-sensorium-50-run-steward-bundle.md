# Sensorium Capability Stewards: 50-Run Rapid Stability Pack

Date: 2026-08-22
Scope: AXM Sensorium capability test lanes (sensory + contracts + lab + deterministic automation)
Runs: 50

Summary
- Total: 50
- Pass: 44
- Fail: 6
- Pass rate: 88%
- Elapsed: 8.346s

Command cycle (repeated)
1. S1: `node shared/sensorium/selftest.js`
2. S2: `node shared/sensorium/foundation-contracts-selftest.js`
3. S3: `node tests/sensorium-retention-conformance-test.js`
4. S4: `node tools/sensorium-lab/selftest.js`
5. S5: `node tools/sensorium-lab/discovery-seam-review.js`
6. S6: `node shared/sensorium/automation/parity-guard.js`
7. S7: `node shared/sensorium/automation/build.js`
8. S8: `node shared/sensorium/automation/lab-state-builder.js`

Result by command
- S1: 7 runs, 5 pass, 2 fail
- S2: 7 runs, 7 pass, 0 fail
- S3: 6 runs, 6 pass, 0 fail
- S4: 6 runs, 6 pass, 0 fail
- S5: 6 runs, 6 pass, 0 fail
- S6: 6 runs, 6 pass, 0 fail
- S7: 6 runs, 6 pass, 0 fail
- S8: 6 runs, 2 pass, 4 fail

Top failures
- `<AXM_WORKSHOP>\shared\sensorium\automation\lab-state-builder.js` write exception:
  - `UNKNOWN: unknown error, open '<AXM_WORKSHOP>\shared\sensorium\lab-state.json'`
- Failure stack points to `Object.writeFileSync` on `lab-state-builder.js:32:72`
- Selftest failures (`S1`) were intermittent and appear coupled to transient `lab-state` persistence instability (2/7)

Artifacts
- [50-run ledger](docs/steward-runs/2026-08-22-sensorium-50-run-quickcap-log.json)
- [50-run breakdown](docs/steward-runs/2026-08-22-sensorium-50-run-quickcap-breakdown.json)
- [correlation probe log](docs/steward-runs/2026-08-22-sensorium-50-run-failure-correlation.json)
- Existing pack handoff from prior work: [10-run pack](docs/steward-runs/2026-08-22-sensorium-10-run-steward-pack.md)

High-impact improvement spots
- Make `shared/sensorium/automation/lab-state-builder.js` write resilient with explicit error capture and retry/backoff around file write.
- Add write-temp + rename strategy for `lab-state.json` to avoid transient open failures.
- Add actionable preflight checks for filesystem write stability before running lanes depending on `lab-state` persistence.
- If this module is running in concurrent contexts, add single-writer guard or exponential wait for file lock release.

Recommended steward next pass
- Re-run command block with a stronger S8 retry patch and compare this 50-run pack with the same matrix. Target: S8 failures drop from 4/6 to 0/6.
