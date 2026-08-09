# Portable Production Profile v0.1 — implementation receipt

Date: 2026-08-09  
Branch: `codex/game-production-runner-v0.1`  
Status: **EXPERIMENTAL**

## Outcome

The Game Production Runner now has a bounded portable-profile adapter for
testing its orchestration mechanics outside games. It adds neutral intent,
package, graph, binding, plan, and run contracts and a documentation-domain
fixture with three serial packages.

The adapter preserves both identities: neutral source digests stay visible in
the portable plan and run receipt, while an exact sealed binding records the
internal game-runner digests used for execution. Adapting a profile grants no
execution authority. A run requires the distinct phrase
`RUN PRODUCTION CANDIDATE`.

This is not a rename and not a universal-kernel claim. Internal step receipts
remain `axm.game-step-receipt/v1`; the adapter receipt names that limitation.
Domain quality, native process isolation, installation, promotion, CANON, and
release remain outside its authority.

## Evidence

- Game Production Runner core self-test: PASS, 66 checks.
- Game Production Runner CLI self-test: PASS, 34 checks.
- Discovery seam review: PASS, 10 checks.
- `node verify.js`: PASS, 0 failures; existing Workshop warnings retained.
- Route, graft, skin, verify-plus, HTML script syntax, tool packaging,
  Agent Tool Forge, and Evidence Desk required checks: PASS.
- The clean branch still reproduces the three historical Hub failures from its
  base commit. The live shared-workspace Hub lane already contains the foreign
  repairs and passed with 0 failures; those uncommitted files were not copied
  into this branch.
- Adversarial cases cover missing verifier, wrong confirmation phrase, mutated
  portable intent, re-sealed graph reference drift, altered adapter authority
  receipt, and exact terminal resume.

The complete claim-to-evidence routing is in `EVIDENCE_ROUTE.json` beside this
receipt.

## Shared-workspace stewardship

The live Workshop was inspected before choosing this lane. Another builder had
already repaired the three Hub baseline failures and added the isolated growth
worker; its Hub, growth-worker, and growth suites passed read-only. Those dirty
Hub/growth files were preserved without copying, reverting, staging, or editing
them. This change remains confined to the clean Game Production Runner branch.

## Open capability gaps

- `contract.production.step-receipt.neutral` — CONTRACT: step evidence remains
  game-named internally.
- `hand.production.process-sandbox` — HAND/SUBSTRATE: v0.1 runs trusted inert
  in-process fixtures only.
- `evidence.production.multi-domain-real` — EVIDENCE: one non-game fixture does
  not prove broad generalization.
- `hand.production.profile-ui` — HAND: no Hub workbench exists.
- `authority.production.install-promote-release` — AUTHORITY: deliberately not
  granted.

The cheapest next proof is a second real domain profile with separately
implemented Hands and verifiers, followed by neutral step-receipt extraction if
the adapter semantics remain stable.
