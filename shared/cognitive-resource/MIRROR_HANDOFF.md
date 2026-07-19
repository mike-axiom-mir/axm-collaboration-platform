# Paste-ready Mirror handoff: Cognitive Resource Meter stack

```text
WORKSHOP HANDOFF - COGNITIVE RESOURCE EVIDENCE STACK

parentModuleId: cognitive-resource-meter
status: TEST
claimCeiling: TEST_MACHINE_BOUND_COGNITIVE_RESOURCE_AND_ECONOMICS_PROFILE_PRODUCER

EXACT MIRROR CONTRACT BINDINGS
- axm.mirror.cognitive-work-observation-draft/v1
  path: shared/cognitive-resource/contracts/cognitive-work-observation-draft.schema.json
  sha256: 74a135eca16239f502d73ecbee296ae49fa8a09316cae4437188b923c500286d
- axm.mirror.cognitive-resource-economics-profile-draft/v1
  path: shared/cognitive-resource/contracts/cognitive-resource-economics-profile-draft.schema.json
  sha256: fa66b93360b0a43da9ac35bd6b128d2c62e9e341d06a4f1fad9c15f31f073ef3

REQUIRED PROVIDER IDS (ADDITIVE CATALOG)
- codex-goal-completion-receipt/v1
- local-hardware-process-meter/v1
- declared-provider-compute-meter/v1 (HOLD_UNBOUND_PROVIDER)
- codex-goal-receipt-explicit-import/v1
- workshop-server-process-window-meter/v1

INVARIANTS
- provider IDs are unique
- every provider has automaticCapture=false
- future providers may be added without changing an exact count
- the eight declared Hand IDs remain exact and authority-free
- no absolute Mirror path is stored

PARENT CAPABILITIES
- guided explicit goal-receipt preview/import
- explicit native Workshop-server process window meter
- profile and rate-schedule vaults
- hold explanations without automatic repair
- separate-dimension resource timeline
- exact-record evidence ZIP bundle
- exact Mirror draft exports
- content-addressed append/supersede/archive/restore ledger

TECHNICAL CHILD MODULES
- cognitive-evidence-explorer: read-only cross-ledger inspection
- cognitive-calibration-lab: exact observation-bound prediction intervals
- human-attention-ledger: opted-in pseudonymous observations and future withdrawal
- sustainability-metrology-lab: direct/imported/manual energy and carbon evidence
- mirror-intake-monitor: explicit exact-draft-bound Mirror intake receipts

FUTURE COMMAND CENTER
- shared/cognitive-resource/command-center-controls.json (15 required controls)
- presentationOwner=workshop-command-center
- required control IDs are additive, unique, automatic=false and authority-free
- Workshop Direction contributes open/status/preview/explicit-commit/lifecycle controls
- Direction commit queues only bounded declared Body Pulse goals; it does not start Body Pulse
- this is a safe integration seam consumed by the TEST Workshop Command Center, not a claim of production readiness or new authority

STATE AND EXPORTS
- state/cognitive-resource-meter
- state/cognitive-evidence-labs
- exports/cognitive-resource-meter

AUTHORITY CEILING
No Mirror write or calculation; no automatic capture, repair, provider/rate selection,
ranking, optimization, budget allocation, permission change, training, release, CANON,
or world action. Tokens are not universal compute. Money, energy, carbon, attention and
calibration evidence remain separate.

VERIFICATION
- shared/cognitive-resource/selftest.js: 61 PASS, 0 FAIL
- shared/cognitive-resource/cognitive-evidence-labs-selftest.js: 21 PASS, 0 FAIL
- shared/cognitive-resource/objective-audit.js: 11 PASS, 0 FAIL
- parent and five child selftests/discovery seams: PASS
- Hub, Operations, HTML/script syntax and full Workshop gate: PASS
- Technical Glasses: 77 modules, 0 broken, 49/49 contracts passing, 0 critical/high
```
