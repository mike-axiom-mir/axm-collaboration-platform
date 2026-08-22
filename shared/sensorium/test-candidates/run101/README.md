# AXM Sensory + Multimodal Run 101 intake

Status: **INTEGRATED — 7 CONTRACTS ADAPTED INTO WORKING FOUNDATION PREFLIGHT**  
Permission-bearing sensor activation: **BLOCKED**

## Result

The original 100-capsule archive is preserved byte-for-byte in `source/`. A
target-local comparison covered the generated module registry, the canonical
Sensorium registry, and local `module.contract.json` files. It found no exact
candidate ID, alias, or contract collisions.

Seven source-policy-eligible, dependency-complete capsules were committed by
the supplied transactional intake tool:

- `axm.sense.observation-session-envelope`
- `axm.sense.target-identity-binder`
- `axm.sense.capability-descriptor-registry`
- `axm.sense.host-adapter-negotiator`
- `axm.sense.resource-budget-contract`
- `axm.sense.cadence-duration-controller`
- `axm.sense.unit-reference-frame-contract`

They are stored under `working_candidates/axm_sensory/`. They remain disabled,
grant no permissions, activate no sensors, and have no CANON authority.

## Working use

The seven safe contracts now also drive executable behavior in
`shared/sensorium/foundation-contracts.js`, exported as
`require('./shared/sensorium').foundation`. This foundation layer:

- validates strict, effect-free observation-session requests;
- binds exact isolated targets and rejects wildcards, inferred targets, and
  person sources;
- resolves deterministic descriptors for all 13 current Sensorium senses;
- negotiates existing host adapters without installing anything;
- enforces finite resource, network, cadence, duration, and lease-window limits;
- validates bounded unit and reference-frame descriptions; and
- returns one compositional preflight receipt where only `READY` permits a
  caller to proceed.

This is real working preflight behavior, not a device driver. It performs no
capture or I/O, retains zero raw bytes, grants no permissions, and cannot turn a
supplied lease reference into authority. Permission-bearing routes remain
blocked until an authority validator, device implementation, and live proof
exist.

## Why only seven

Run 101 contains an internal gate conflict. Its proposed nine-module pilot
includes `axm.sense.authority-lease-gate`, while its
`OPEN_PROOF_DEBT_AND_GATES.json` explicitly blocks that capsule even from
disabled storage until `HUMAN_CONTROL_USABILITY_REVIEW` is complete. The
dependent `typed-observation-envelope` therefore cannot enter the stored
dependency closure either.

Applying the stricter source rule produced:

- 7 stored disabled working candidates;
- 47 direct source storage-gate holds;
- 46 dependency holds caused by a required capsule not being stored.

No source module was discarded. All 93 holds and their reasons are recorded in
`evidence/module-dispositions.json`.

## Proof boundary

The archive contains detailed contracts, policies, and steward history, but no
sensor implementations. Its own status says `runtime_proof: UNTESTED` and zero
live-device tests. This intake proves archive integrity, exact local comparison,
disabled transactional storage, journal agreement, and the bounded foundation
preflight described above. It does not prove camera, microphone, location,
wearable, HID, XR, or other live-device behavior.

## Evidence and verification

- `integration-receipt.json` — outcome and claim boundary
- `evidence/source-validation.json` — 118 source checksum results
- `evidence/local-inventory.json` — exact target inventory and input digests
- `evidence/full-preflight-plan.json` — all 100 source capsules compared locally
- `evidence/selected-preflight-plan.json` — clean seven-capsule commit plan
- `evidence/capability-gap-report.json` — ready intake route and blocked runtime route
- `evidence/foundation-use-receipt.json` — seven contract-to-code mappings and atomic claim verdicts
- `evidence/foundation-use-capability-gap-report.json` — working preflight capabilities and remaining live-runtime gaps
- `journals/` — transaction journal bound to the approved plan hash

Run the focused receipt check with:

```powershell
node intakes/sensory-multimodal-run101/intake-selftest.js
npm.cmd run test:sensorium
```
