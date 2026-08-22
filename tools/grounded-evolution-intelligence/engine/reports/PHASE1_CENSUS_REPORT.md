# Phase 1 Simulated Factual Kernel Census

## Frozen intake

- Repository: `mike-axiom-mir/axm-collaboration-platform`
- Branch: `main`
- Commit: `c2dbeb69c39e4bc38363edb58adc7d671378da22`
- Commit time: `2026-08-04T03:16:31Z`
- Registry generated: `2026-08-04T03:02:23.281Z`
- Intake method: connected GitHub reads pinned to the immutable commit
- Repository checkout obtained: **No**
- Repository tests executed here: **No**

This package is a source-grounded simulation. It does not claim runtime reproduction,
production certification, or access to the private local Workshop body.

## Census

| Module/system | Version | Lifecycle | Truth state | Selected capabilities | Sampled dependencies |
|---|---:|---|---|---:|---:|
| AXM AI Team | v1.12 | TEST_HOLD_REVIEW | OBSERVED | 1 | 1 |
| AXM Asset Fabric | manifest:v0.9|contract:v0.12 | IN_PRODUCTION | CONFLICTED | 1 | 1 |
| AXM Audio Studio | v1.1 | TEST_HOLD_REVIEW | OBSERVED | 1 | 1 |
| Body Pulse | v0.8 | IN_PRODUCTION | OBSERVED | 1 | 0 |
| AXM Diagnostics & Operations Center | v0.3 | TEST_HOLD_REVIEW | OBSERVED | 1 | 2 |
| AXM Evidence Desk | v0.2 | TEST_HOLD_REVIEW | OBSERVED | 1 | 0 |
| AXM Game Forge | v1.3 | TEST_HOLD_REVIEW | OBSERVED | 1 | 2 |
| AXM Game Hub | manifest:v0.4|contract:v0.2 | TEST_HOLD_REVIEW | CONFLICTED | 1 | 0 |
| AXM Grounded Evolution Intelligence | 0.2.0 | IN_PRODUCTION | TESTED | 0 | 9 |
| AXM Recovery & Rollback Center | v0.2 | TEST_HOLD_REVIEW | OBSERVED | 1 | 1 |
| Deterministic Research Foundry | v0.1 | TEST_HOLD_REVIEW | OBSERVED | 1 | 0 |
| AXM Review & Promotion Inbox | v0.2 | TEST_HOLD_REVIEW | OBSERVED | 1 | 0 |
| AXM Studio | v2.7 | TEST_HOLD_REVIEW | OBSERVED | 1 | 0 |
| AXM Technical Glasses | v0.2 | TEST_HOLD_REVIEW | OBSERVED | 1 | 0 |
| Workshop Packager | v0.4 | TEST_HOLD_REVIEW | OBSERVED | 1 | 0 |
| AXM Workshop Public Snapshot | snapshot:c2dbeb69c39e | TEST_HOLD_REVIEW | CONFLICTED | 1 | 0 |

## Registry-scale observations

The generated registry reports:

- 210 modules
- 1,769 declared capabilities
- 121 TEST
- 4 WORKING
- 84 EXPERIMENTAL
- 1 SHELL
- 210 valid contracts
- 208 top-level self-test references
- at least one self-test reference for all 210 modules

These are structural observations. The repository explicitly rejects interpreting
structural eligibility, declarations, or self-test presence as blanket runtime proof.

## High-value findings

1. **Human discovery drift:** README counts (177 / 1,183) disagree with generated
   registry counts (210 / 1,769) at the same pinned commit.
2. **Version drift:** Asset Fabric exposes manifest v0.9 and contract v0.12.
3. **Version drift:** Game Hub exposes manifest v0.4 and contract v0.2.
4. **Proof gap:** capability declarations greatly outnumber capability-level reproduced proof.
5. **Human proof gap:** independent first-time-user comprehension is not run.
6. **Portability proof gaps:** clean macOS/Linux and source-route offline first launch
   remain unproven or unclaimed.
7. **Reuse seam:** Module 3 can reuse existing bounded siblings:
   Technical Glasses, Research Foundry, Evidence Desk, Body Pulse, Review Inbox,
   Diagnostics, Recovery Center, Workshop Packager, and AI Team.

## Architectural conclusion

Module 3 should remain the deterministic system graph, evolution ledger, need
registry, direction engine, and outcome tracker. Existing siblings should provide
bounded observation, research, evidence, scheduling, review, diagnostics, recovery,
packaging, and collaborator execution services. This prevents a new central
authority module from silently absorbing the powers of its siblings.
