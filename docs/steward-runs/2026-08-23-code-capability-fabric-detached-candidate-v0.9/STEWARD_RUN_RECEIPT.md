# Steward-run receipt

Status: `TEST`

Branch: `codex/code-capability-fabric-detached-candidate-v0.9`

Base: `6e3a014a08acb23614ff3a72eab1ce8d266f1b99`

Technical commit: `1cc64239b4a88e50c9ac52f95d0a36f9376ccfdb`

Changed implementation paths: 12 (2,265 insertions).

## Outcome

The Fabric can now take the existing deterministic native semantic candidate,
prepare an exact Tier-1 materialization subject, verify an Ed25519 decision and
a separately signed revocation snapshot against a host-selected trust policy,
reserve the decision nonce exactly once in a host-bound Nursery ledger, and
write one inert candidate into one new direct-child root.

Every written byte is exclusive, read back, digest-checked, and inspected by the
Detached Candidate Nursery. The sibling receipt records bounded measurements
and truth ceilings without source, raw goals, prompts, stdout/stderr, signing
keys, or machine paths. A failed attempt removes only its new candidate root and
does not unspend the nonce.

## Boundaries

- native review-card adapter candidate only; no arbitrary-domain recipe;
- no AI challenger, provider, network, process, environment, or dynamic code;
- no candidate import or execution;
- no natural-person identity, informed-understanding, independent-time, or
  global-replay claim;
- no direct-reuse authorization; generated source remains research-only;
- no permission, learning, install, integration, publication, training,
  physical actuation, promotion, or `CANON` authority;
- repaired disposable executor remains separately unauthorized;
- Mike remains the final merge gate.

## Verification

80 new adversarial cases, all 22 Fabric scripts, deterministic JSON, Nursery
inspection, ten direct organ-continuity scripts, and all ten AGENTS.md commands
passed. `verify.js` retained exactly 22 warning lines. Browser testing was N/A
because no visual surface changed.

This receipt proves only the bounded native Tier-1 detached materialization
contract. It does not prove candidate quality, runtime behavior, installation,
integration, promotion, or `CANON`.
