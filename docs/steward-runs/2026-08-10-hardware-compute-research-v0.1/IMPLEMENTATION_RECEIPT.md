# Hardware + Compute Research Modules v0.1 — Implementation Receipt

Status: `EXPERIMENTAL`

## Outcome

Created two separate but interoperable research modules in the shared
`HARDWARE_COMPUTE_RESEARCH` family:

- **Hardware Research & Build Registry** defaults to `HARDWARE` in the
  `ROBOTICA_AND_PHYSICAL_SYSTEMS` domain.
- **Compute Substrate Lab** defaults to `COMPUTE` in the
  `COMPUTATION_AND_PHYSICAL_SYSTEMS` domain.

Both compose the existing Deterministic Research Foundry for stable digests
and conflict-preserving evidence. Neither duplicates its generic engine.

## Known-start decision

The compute module records **1837** as the provisional formal programmable-
machine lineage root requested by Mike. It explicitly does not claim earliest
human computation, earliest calculator, earliest Analytical Engine conception,
a completed physical engine, or CANON.

The known 1834 conception boundary is retained as an earlier research
candidate. It cannot replace 1837 automatically. A change requires two
independent digest-bound evidence surfaces, an exact proposal, and a named
human `WORKING_ROOT_ONLY` decision with PASS evidence and independent review.
The superseded root remains in an append-only digest chain.

## Retention and privacy

The modules preserve semantic packages, evidence references, verdicts,
conflicts, and root decisions. They do not retain raw browsing sessions,
telemetry, private conversations, screenshots, or unrelated user material.
Source locators remain untrusted until separately evidenced.

## Boundaries

- Research and build recipes are data by default.
- Hardware builds remain `DESIGN_ONLY`.
- Compute architectures remain `PROPOSED`.
- No hardware execution, procurement, safety certification, live benchmark,
  workload deployment, automatic root change, promotion, or CANON exists.
- CLI file output is explicit and must remain outside the Workshop source tree.

## Verification

Focused suites cover deterministic compilation, reference validation,
same-identifier merge conflicts, evidence contradiction preservation, package
and root-history tampering, exact/stale approvals, machine-steward refusal,
external output, source-write refusal, and cross-module discovery.

- Hardware core: 29 checks passed.
- Compute core: 38 checks passed.
- Hardware CLI: 15 checks passed.
- Compute CLI: 16 checks passed.
- Hardware discovery seam: 7 checks passed.
- Compute discovery seam: 9 checks passed.
- Deterministic capability comparison: `READY` for all nine required v0.1
  research-registry capabilities.

Workshop-required regression results from the final tree:

- `node verify.js`: `0 FAIL · 43 warn`.
- `node hub/hub-selftest.js`: `0 FAIL`.
- `node hub/route-selftest.js`: `0 FAIL`.
- `node hub/graft-selftest.js`: `0 FAIL`.
- `node hub/skin-selftest.js`: `0 FAIL`.
- `node hub/verify-plus.js`: core OK; module claims `PASS=3`.
- `node tests/html-script-syntax-test.js`: `55 PASS · 0 FAIL`.
- `node tests/tool-forge-package-test.js`: passed; output remained
  `installed: false`.
- `node tools/agent-tool-forge/selftest.js`: `17 PASS · 0 FAIL`.
- `node tools/evidence-desk/selftest.js`: `36 PASS · 0 FAIL`.

Passing software checks does not close the named physical capability gaps.
