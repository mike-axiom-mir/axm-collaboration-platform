# Append-only steward receipt — Code Capability Fabric v2.21

Date: 2026-08-25 (Europe/Amsterdam)

Status: `TEST`

Candidate status: `EXPERIMENTAL`

Parent/base commit: `02f1bbdb6959d59b96fd3952b4b771a420a4bdc0`

Technical source commit: `61b012a4ee2896d7b05ddb8eeb5848d06087d7df`

Branch: `codex/code-capability-fabric-local-coop-action-game-v2.21`

## What changed

- Advanced only the exact `twin-reactor-action-coop` deterministic recipe from candidate v0.1 to v0.2.
- Added bounded directional bolts, facing markers, a proximity co-op damage link, typed enemies, Warden boss practice, and repair-core/shared-reactor feedback.
- Preserved both player seats as independent controls and score identities.
- Added the exact new capabilities to the deterministic generator and its organ contract without changing the generator core version or the legacy one-player digest.
- Added adversarial output tests, including the projectile-spawn tunneling regression.
- Regenerated existing deterministic city/schema/twin views because the organ contract changed.
- Captured the exact candidate, capability-gap, browser, and verification evidence in this run folder.

Changed path families:

- `shared/code-capability-fabric/`
- `tools/sandbox/preview-coop-game-v1.js`
- `registry/generated/`
- `docs/generated/`
- `docs/steward-runs/2026-08-25-code-capability-fabric-local-coop-action-game-v2.21/`

## Root gate

- **Truth — PASS for the bounded claims:** output evidence found and drove repair of a real collision defect; unknowns remain explicit.
- **Agency / non-domination — PASS for this rung:** two seats remain independent; the candidate has no install, merge, provider, publish, promotion, lesson, or CANON authority.
- **Continuity — PASS for this rung:** work is stacked on the exact sealed v2.20 head; legacy deterministic behavior remains covered; generated projections were rebuilt instead of left stale.
- **Wisdom over speed — PASS for this rung:** the scope is one recipe and one real vertical slice, not a claim of universal creation or a general executor.

This technical gate is not Mike's merge decision. Mike may hold or reject it.

## Decisions and holds

- Direct reuse rights remain `RESEARCH_ONLY_HOLD`.
- Native generation remains the default; no AI/provider was called.
- A repaired general executor remains unauthorized and was not built or run.
- The detached candidate was browser-previewed through an exact allowlisted preview path; it was not installed or integrated.
- Capability-library lesson admission was not requested and did not occur.
- Mike remains the final integration, promotion, and CANON gate.

## Verification summary

- Real browser journey: PASS for the exact visible claims recorded in `BROWSER_JOURNEY_RECEIPT.md`.
- Focused suites: `12/12`, `21/21`, and `12/12` PASS.
- All ten required `AGENTS.md` commands completed; `verify.js` ended `0 FAIL · 25 warn`.
- Fun/balance, frame-perfect timing, controller/touch, persistence, installation, and publication remain unproved or out of scope.

No file in this run claims consciousness, identity, self-approval, installation, promotion, or CANON.
