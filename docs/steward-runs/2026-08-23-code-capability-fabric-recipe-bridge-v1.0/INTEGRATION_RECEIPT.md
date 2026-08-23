# Recipe bridge v1.0 integration receipt

Status: `TEST`

Integrated at: `2026-08-23T11:21:00.6189994Z`

## Route

- previous clean integration checkpoint:
  `codex/workshop-code-capability-fabric-v0.9-integration-20260823`
- checkpoint commit: `ee92c1d8704642eb9b3058493f67404c3bf01100`
- source branch: `codex/code-capability-fabric-recipe-bridge-v1.0`
- source tip: `70f8d675305251fb9a070d6f56419361611c3c81`
- new integration branch:
  `codex/workshop-code-capability-fabric-v1.0-integration-20260823`
- clean integration worktree:
  `D:\AXM_ACTIVE\workshop-code-capability-fabric-v1.0-integration`
- integration method: exact Git fast-forward

The new integration branch was created from the preserved v0.9 checkpoint and
fast-forwarded to the reviewed recipe-bridge source tip. The old checkpoint was
not rewritten. The busy `D:\AXM_ACTIVE\workshop` recovery checkout was not
modified, stashed, reset, overwritten, or merged.

## Included commits

- `04a3d97f682aebf579429dae344d01c38566d793` — bounded technical bridge
- `394d88f57c2d7e2ed188740141cffe1cec861ae9` — sealed steward evidence
- `70f8d675305251fb9a070d6f56419361611c3c81` — guarded handoff and final drift

## Integrated capability

The Fabric can consume exact, installed-lineage-verified Code Recipe Foundry
selection packets and bind them into semantic request, candidate, and Review
Card lineage. It cannot automatically choose recipes, treat rank as quality,
verify reuse rights, apply snippet text to generated source, execute snippets,
install, promote, or change `CANON`.

Code Mirror was not involved. RepairBuddy remains a separate repair experiment
and was not changed or called.

## Verification in the integration worktree

- all 23 Code Capability Fabric selftest scripts passed;
- Code Recipe Foundry selftest passed: 61 checks;
- Code Recipe Foundry discovery seam passed;
- all ten required `AGENTS.md` commands exited 0;
- `verify.js`: `0 FAIL · 22 warn`, spine `b618c5762240070c`;
- `hub/verify-plus.js`: `0 FAIL · 22 warn`, same spine;
- HTML syntax: 55 pass, 0 fail;
- Agent Tool Forge: 17 pass, 0 fail;
- Evidence Desk: 36 pass, 0 fail.

Browser render/click was N/A because no visual surface changed. No recipe,
provider, Mirror, RepairBuddy, candidate, or sandbox runtime was executed.

## PR46 donor boundary

GitHub PR46 (`steward/recipe-evidence-bridge-2026-08-23`, observed head
`08eff74b35a3ac19e76093bd53116038063199a5`) independently proposes a
metadata-only mechanical query over the same catalog. It was statically
inspected as an external donor candidate and was not executed, fetched into,
or merged with this integration.

Its bounded query and snippet-omission ideas may inform a future discovery
rung. Direct merge is held because it duplicates the bridge surface and does
not provide the exact installed pack/audit/request binding already required by
this integration. Any reuse requires a new comparison, tests, and Mike review.

## Authority

This integration makes the bridge available on a clean Workshop integration
branch under the `TEST` label. It is not integration into the busy recovery
checkout, promotion, publication, or `CANON`. Mike remains the final gate for
any later target-branch merge.
