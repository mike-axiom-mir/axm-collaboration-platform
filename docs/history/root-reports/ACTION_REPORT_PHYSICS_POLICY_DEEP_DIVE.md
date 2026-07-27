# Action Report: AXM Physics Policy Deep Dive

Date: 2026-07-19  
Lane: additive policy evidence for `shared/physics`  
Status: observation/proposal integration; no solver release

## Outcome

The pasted deep-dive was audited against reusable primary sources and current
v0.3.1 runtime behavior. Supported findings were converted into a source
register, an atomic evidence-route document, a machine-readable future contract
and permanent observation canaries. Conversation-internal citation markers were
not treated as durable citations.

## Corrections and boundaries

- Shewchuk's robust orientation/incircle work supports reliable classification
  near degeneracy, but is not a drop-in proof or implementation for every AXM
  circle/box predicate.
- RFC 8785 is a candidate for JSON-safe structural canonicalization, but it
  serializes both signs of zero as `0`; authoritative numeric state needs a
  separate bit-preserving rule.
- Double-pendulum experimental data with uncertainty exists, but v0.3.1 cannot
  consume it honestly because rotation and joints are absent.
- AXM's current thin-wall successes are substep mitigation, not TOI CCD.

## Added artifacts

- `shared/physics/physics-policy-deep-dive.js`
- `shared/physics/PHYSICS_POLICY_DEEP_DIVE.md`
- `shared/physics/PHYSICS_POLICY_SOURCE_REGISTER.json`
- `shared/physics/PHYSICS_POLICY_CONTRACT_PROPOSAL.json`

README, self-test, Discovery seam and the earlier policy/hash proposals receive
small additive references. `axm-physics-core.js` remains untouched at v0.3.1.

## Verification receipt

- Policy deep-dive canaries: 1 pass, 0 fail, 8 observations.
- Existing micro verification: 24 pass, 0 fail, 12 observations; budget pass.
- Physics core self-test: pass.
- Physics adversarial: 4 pass, 0 fail, 1 timing observation.
- Repeat adversarial: 4 pass, 0 fail.
- Broadphase adversarial: 3 pass, 0 fail.
- Manifold adversarial: 4 pass, 0 fail.
- Warm-start adversarial: 6 pass, 0 fail.
- Discovery seam review: 31 verified, 0 open.
- Workshop verifier: 0 fail, 30 existing repository warnings.
- All four physics JSON registers/contracts parsed successfully.

The first Discovery run exposed one stale phrase in its documentation assertion;
the evidence document itself was correct. The assertion was narrowed to the
actual capability phrase and the clean rerun produced 31 verified, 0 open.

## Workspace note

The bundled shared-workspace snapshot script could not run because this machine
has no `python` command. PowerShell SHA-256 hashes and timestamps were used as
the read-only fallback. No governing `AGENTS.md` applies to `shared/physics`.
No Git or GitHub operation is part of this action.
