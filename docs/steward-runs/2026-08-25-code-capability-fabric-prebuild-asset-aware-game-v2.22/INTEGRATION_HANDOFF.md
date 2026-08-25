# Integration handoff — Code Capability Fabric v2.22

Status: reviewable `TEST` branch; no merge, installation, promotion, or CANON performed

PR: <https://github.com/mike-axiom-mir/axm-collaboration-platform/pull/72>

## Exact source and target assumptions

- Technical source commit: `eed88b8c7c616a77228852ab1be71f641b85ab2c`.
- Sealed evidence source commit: `829b47886bf99de3d17c98ae865ba5b990947c96`.
- Source branch: `codex/code-capability-fabric-prebuild-asset-aware-game-v2.22`.
- Assumed target branch: `codex/code-capability-fabric-local-coop-action-game-v2.21`.
- Expected target head/base: `e37854fdd08b4e8c5f5e54d542c38ea9e9671c54`.
- Target review: PR 71, observed open, draft, and mergeable.
- Integration shape: stacked review from exact sealed v2.21; PR 72 is not
  based directly on `main`.

This handoff file is a documentation-only child of the sealed evidence commit;
the final branch head is reported by PR 72 and the task closeout.

## Target-drift check before the recommendation

Observed immediately after creating PR 72:

- remote v2.21 target head: `e37854fdd08b4e8c5f5e54d542c38ea9e9671c54` — exact match;
- PR 71 head: `e37854fdd08b4e8c5f5e54d542c38ea9e9671c54` — exact match;
- PR 71: open, draft, mergeable;
- PR 72 base/head: exact v2.21/v2.22 stacked branches, open draft, mergeable;
- PR 72 city-map gate: initially `IN_PROGRESS`; do not infer PASS until GitHub reports it;
- canonical `D:\AXM_ACTIVE\workshop`: branch
  `codex/workshop-active-clean-20260823`, head
  `7dd800d09731607b2936b580ab972d8033801736`, `17` status entries —
  intentionally untouched.

The canonical checkout is busy and not at the assumed target; it is not a safe
integration surface.

## Changed paths

- `shared/code-capability-fabric/` — Asset Factory snapshot/planner schemas,
  generator/recipe v0.3, contracts, docs, and adversarial tests;
- `tools/sandbox/` — recipe-specific 11/13-file validation, asset/prebuild
  lineage checks, bounded review-port support, and focused tests;
- `registry/generated/` and `docs/generated/` — deterministic city/schema/twin
  projections rebuilt after contract/schema changes;
- `docs/steward-runs/2026-08-25-code-capability-fabric-prebuild-asset-aware-game-v2.22/`
  — exact capability, candidate, browser-attempt, test, root-gate, and handoff evidence.

## Verification carried with the source

- focused checks: `60/60 PASS`;
- all ten required `AGENTS.md` commands passed on technical commit `eed88b8c…`;
- `verify.js`: `0 FAIL · 26 warn`;
- fresh browser visual/click claim: `UNKNOWN` with an exact policy-block receipt;
- candidate packet: `sha256:6cd68e9cfb308d64fed4803fa19d8addaf0b986aaf8246b5070e3e84bfc9086c`.

## Exact safe review route

1. Review PR 71 first and confirm its head is still the expected v2.21 commit.
2. Open PR 72 and confirm its base is
   `codex/code-capability-fabric-local-coop-action-game-v2.21` and its head is
   `codex/code-capability-fabric-prebuild-asset-aware-game-v2.22`.
3. Wait for the PR 72 city-map gate and inspect this run's evidence and diff.
4. If either branch head drifts, stop and recompute the comparison.
5. If Mike accepts the technical result, integrate PR 71 through the chosen
   Workshop route first, then retarget/recheck PR 72 against that exact
   integrated commit. Do not merge from the busy canonical checkout.

Read-only drift check:

```powershell
git -C D:\AXM_ACTIVE\workshop fetch origin codex/code-capability-fabric-local-coop-action-game-v2.21 codex/code-capability-fabric-prebuild-asset-aware-game-v2.22
git -C D:\AXM_ACTIVE\workshop rev-parse origin/codex/code-capability-fabric-local-coop-action-game-v2.21
git -C D:\AXM_ACTIVE\workshop diff --stat origin/codex/code-capability-fabric-local-coop-action-game-v2.21..origin/codex/code-capability-fabric-prebuild-asset-aware-game-v2.22
gh pr view 72 --repo mike-axiom-mir/axm-collaboration-platform --json state,isDraft,baseRefName,headRefName,headRefOid,mergeable,statusCheckRollup,url
```

These commands fetch and inspect only. They do not merge, overwrite, install,
promote, or CANON.

## Authority boundary

Candidate output remains `EXPERIMENTAL`, uninstalled, unintegrated,
unpublished, unpromoted, and unable to change CANON. Direct reuse remains
`RESEARCH_ONLY_HOLD`; the general executor remains unauthorized. Mike remains
the final merge gate.
