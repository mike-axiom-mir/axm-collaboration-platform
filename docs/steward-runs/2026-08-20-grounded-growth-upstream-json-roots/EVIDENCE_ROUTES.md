# Evidence routes

Status: `TEST`

## Workshop production-JavaScript inventory

- Claim: the recorded audit reproducibly identifies representation review seams
  within its declared JavaScript roots and exclusions.
- Kind/risk: static technical inventory, medium.
- Pass: before and current audit digests verify; counts move from 16 to 22 strict
  core references and from 297 to 291 potential seams.
- Primary: `BEFORE_WORKSHOP_JSON_AUDIT.json`,
  `CURRENT_WORKSHOP_JSON_AUDIT.json`, and `scan-workshop-json-seams.js`.
- Counterevidence: digest drift, changed scope, or an unreproducible count.

## Six-root representation closure

- Claim: all six selected upstream roots refuse unsupported state at their
  exported canonical boundary while preserving recorded safe bytes.
- Kind/risk: deterministic behavior and persistence, medium.
- Pass: 78/78 unsafe fixture pairs refuse; 36/36 safe canonical and object
  digests remain exact; 6/6 write/read/parse journeys remain exact.
- Primary: `CURRENT_UPSTREAM_CLOSURE.json`, six native self-tests, and the
  verification matrix.
- Counterevidence: acceptance, invalid canonical output, silent transformation,
  safe-byte drift, digest drift, or persistence mismatch.

## Downstream compatibility

- Claim: the already-closed fifteen Grounded Growth consumers still pass their
  native semantics after the upstream migration.
- Kind/risk: bounded regression evidence, medium.
- Pass: all fifteen downstream native self-tests and the prior full-closure
  builder/self-test pass inside the 39-command matrix.
- Primary: `CHECK_RESULTS.json` and `verification-selftest.js`.
- Counterevidence: any downstream native or prior full-closure check fails.

## Voluntary physical-phone QA

- Claim: no compatibility or physical-observation capability is claimed.
- Kind/risk: contract and physical evidence, high.
- Evidence: the current campaign native baseline fails first with
  `QA Lab device evidence handoff missing`; all five campaign-specific QA Lab
  contract facts are absent.
- Verdict: `DEFERRED_CONTRACT_AND_EVIDENCE_GAP`.
- Primary: `PHONE_QA_GAP.json` and `probe-voluntary-phone-qa-gap.js`.

## Human benefit, model learning, and wider shadow clones

- Claim: none.
- Kind/risk: human meaning, learning improvement, and architecture, high.
- Required evidence: voluntary human judgment, held-out learning evaluation,
  and the user's not-yet-received wider shadow-clone candidate.
- Verdict: `NOT_RUN` / `NOT_RECEIVED`.
