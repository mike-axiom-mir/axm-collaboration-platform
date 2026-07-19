# Cognitive Resource Evidence Stack delivery report

Date: 2026-07-19  
Parent: `cognitive-resource-meter`  
Status: `TEST`  
Claim ceiling: `TEST_MACHINE_BOUND_COGNITIVE_RESOURCE_AND_ECONOMICS_PROFILE_PRODUCER`

## Outcome

The Workshop now has a dependency-free cognitive resource evidence stack under **Hub -> Build -> Cognitive Resource Meter**. The parent supplies guided receipt import, an explicit native local process window, profile/rate vaults, hold explanations, separate resource timelines, exact draft exports, and portable evidence bundles. Five machine-layer children add read-only exploration, calibration comparisons, opted-in human attention evidence, sustainability metrology, and explicit Mirror intake receipt inspection.

The stack writes only its private Workshop ledgers and explicit Workshop export folder. It does not write Mirror, calculate a Mirror result, refresh network prices, rank/select candidates, allocate budgets, grant permissions, train, release, promote CANON, or act on the world.

## Exact contract bindings

| Contract | Copied Workshop path | SHA-256 |
|---|---|---|
| `axm.mirror.cognitive-work-observation-draft/v1` | `shared/cognitive-resource/contracts/cognitive-work-observation-draft.schema.json` | `74a135eca16239f502d73ecbee296ae49fa8a09316cae4437188b923c500286d` |
| `axm.mirror.cognitive-resource-economics-profile-draft/v1` | `shared/cognitive-resource/contracts/cognitive-resource-economics-profile-draft.schema.json` | `fa66b93360b0a43da9ac35bd6b128d2c62e9e341d06a4f1fad9c15f31f073ef3` |

Bindings use schema ID and copied digest. No absolute Mirror path is stored.

## Parent improvements delivered

1. Guided Receipt Wizard and preview.
2. Explicit Codex goal-completion receipt import.
3. Explicit local Workshop server process meter with honest partial/whole-process coverage.
4. Privacy-safe machine Profile Vault.
5. Versioned Rate Schedule Vault across provider-token, provider-compute-unit, and local-hardware-time modes.
6. Hold Explainer with no persistence or automatic repair.
7. Dependency-free exact-record evidence ZIP bundle.
8. Resource Timeline with tokens, compute, time, money, energy, carbon, and verification kept separate.

## Child modules delivered

| Module | Purpose | Boundary |
|---|---|---|
| `cognitive-evidence-explorer` | Cross-ledger read-only inspection | No permissions or writes |
| `cognitive-calibration-lab` | Exact observation-bound prediction interval comparison | No ranking or calibrated-accuracy claim |
| `human-attention-ledger` | Opted-in pseudonymous review observations and future withdrawal | No identity, private memory, background timing, or productivity score |
| `sustainability-metrology-lab` | Hardware-bound energy/carbon evidence | No token-to-energy shortcut or green score |
| `mirror-intake-monitor` | Explicit exact-draft-bound Mirror receipt import | No automatic Mirror connection/read/write or acceptance inference |

All five are `integratedInto: cognitive-resource-meter`, route to the machine layer, and do not clutter the main Hub.

## Additive provider and command-center seams

`provider-declarations.json` contains five required providers. Startup and tests verify required IDs, uniqueness, and `automaticCapture: false` while allowing future additions.

`command-center-controls.json` supplies fifteen required safe controls to the TEST `workshop-command-center` operator surface. Five belong to Workshop Direction: open planner, read status, compile a non-persistent bounded preview, explicitly commit reviewed routes, and set direction lifecycle. A committed direction can queue only declared Body Pulse goal records; it cannot start Body Pulse or gain tool, file, network, promotion, release, or world authority. All controls are additive, unique, `automatic: false`, permission/header/confirmation explicit, and authority-free. Mutating specialist controls are presented as doorways rather than underspecified generic execution buttons.

## Storage and continuity

- Meter ledger: `state/cognitive-resource-meter/`
- Evidence-labs ledger: `state/cognitive-evidence-labs/`
- Exact exports/bundles: `exports/cognitive-resource-meter/`
- Meter cold detail is content-addressed; the hot index preserves active/superseded/archived state.
- Source-record drift, path traversal, symlink escape, content-address collisions, and cold-record tampering are refused.
- Archive/restore requires exact confirmations and does not delete cold detail.
- Lab evidence is content-addressed and append-only. Attention withdrawal blocks future capture while preserving prior evidence.

## Verification evidence

- `npm.cmd run test:cognitive-resource`: 61 parent adversarial checks, 21 labs checks, and 11 complete-objective checks passed; all parent/child selftests and discovery seams passed.
- `node hub/hub-selftest.js`: passed, including all five machine-layer child routes.
- `node tests/html-script-syntax-test.js`: 52 pages passed, 0 failed, including the parent and five children.
- Operations foundation/wave-2/roadmap integration: passed, including 225 governed-roadmap checks.
- `npm.cmd test`: complete Workshop gate passed with exit code 0.
- Workshop Verifier/Doctor: 0 failures and 27 existing warnings; no cognitive module is broken.
- Technical Glasses live scan: 77 modules, 0 broken, 49/49 declared contracts passing, 0 critical, 0 high. The Meter is the top focus route.
- Technical Glasses correctly reports live readiness as `UNKNOWN` where no live probe exists; no ready/offline state is guessed.

Two repository-wide hardening repairs were also required for a clean current-tree gate: additive Asset Hands inventory assertions/discovery truth were updated for newly implemented PDF/X, UV/PBR, and concurrent Hands; Mirror Core atomic rename gained a bounded retry for transient Windows `EPERM`/`EACCES`/`EBUSY` without weakening atomicity.

## Known limits and intentionally unrun evidence

- No external provider price fetch or automatic rate refresh.
- No third-party provider compute adapter beyond explicit declarations.
- No physical power meter, physical press proof, or independent PDF/X preflight was run.
- No live Mirror connection or private Mirror-state read; intake is explicit receipt import only.
- The local meter covers the Workshop server process window, not isolated task/model/accelerator compute.
- No browser-pixel or physical-device usability claim for the new pages; static compilation and service behavior are verified.
- No nonlinear billing, taxes, credits, reservations, or universal token-to-compute conversion.
- The Workshop Command Center is delivered at TEST status; visual and operator trials remain before any production claim.

Paste-ready consumer instructions are in `shared/cognitive-resource/MIRROR_HANDOFF.md`.
