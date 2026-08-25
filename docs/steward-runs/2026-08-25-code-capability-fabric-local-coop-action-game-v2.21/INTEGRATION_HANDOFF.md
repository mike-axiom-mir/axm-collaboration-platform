# Integration handoff — Code Capability Fabric v2.21

Status: reviewable `TEST` branch; no merge or promotion performed

PR: <https://github.com/mike-axiom-mir/axm-collaboration-platform/pull/71>

## Exact source and target

- Sealed game implementation/evidence source commit: `b958fc300b6a6c703531e248cbf7a879be045ad7`
- Cross-host city-projection portability repair commit: `ddef61f0242d08aa698a1cd23b75a10314d566fe`
- Effective technical source through: `ddef61f0242d08aa698a1cd23b75a10314d566fe`
- Source branch: `codex/code-capability-fabric-local-coop-action-game-v2.21`
- Assumed target branch: `codex/code-capability-fabric-local-coop-action-game-v2.20`
- Expected target head/base: `02f1bbdb6959d59b96fd3952b4b771a420a4bdc0`
- Target review: PR 70, open draft and mergeable at drift check.
- Integration shape: stacked fast-forward from the exact sealed v2.20 head; PR 71 is not based directly on `main`.

Documentation-only follow-ups after the effective technical source are reported in the task closeout and on PR 71.

## Target-drift check before publication

Observed immediately before publishing PR 71:

- remote v2.20 branch head: `02f1bbdb6959d59b96fd3952b4b771a420a4bdc0` — exact match;
- PR 70 head: `02f1bbdb6959d59b96fd3952b4b771a420a4bdc0` — exact match;
- PR 70: open, draft, mergeable;
- canonical `D:\AXM_ACTIVE\workshop`: branch `codex/workshop-active-clean-20260823`, head `7dd800d09731607b2936b580ab972d8033801736`, `17` status entries — intentionally untouched.

Because the canonical checkout is busy and not at the assumed target, it is not a safe integration surface.

## Changed paths

- `shared/code-capability-fabric/` — recipe, generator contract, documentation, and focused countertests;
- `shared/city-graph/` — explicit cross-host collation for deterministic generated projections;
- `tools/sandbox/preview-coop-game-v1.js` — exact preview session label;
- `registry/generated/` and `docs/generated/` — deterministic derived projections rebuilt for the contract change;
- `docs/steward-runs/2026-08-25-code-capability-fabric-local-coop-action-game-v2.21/` — candidate, browser, capability, test, root-gate, and handoff evidence.

## Verification carried with the source

- browser output journey: bounded visible claims PASS;
- focused checks: `12/12`, `21/21`, `12/12` PASS;
- all ten required `AGENTS.md` commands completed;
- `verify.js`: `0 FAIL · 25 warn`;
- local city-map selftest: `33` assertions PASS; city/schema/twin generated-view checks PASS after the portability repair;
- unknown/unrun boundaries are listed in `TEST_REPORT.md`.

## Precise safe review route

1. Review PR 70 first; confirm its head is still the expected v2.20 commit above.
2. Open PR 71 and confirm **base** is `codex/code-capability-fabric-local-coop-action-game-v2.20` and **head** is `codex/code-capability-fabric-local-coop-action-game-v2.21`.
3. Review the output evidence and changed files in PR 71. Mike may request repair, discard it, or approve it.
4. If either branch head drifts, stop and recompute the comparison before integration.
5. If Mike accepts the technical result, merge PR 70 through the chosen Workshop integration route first, then retarget/recheck PR 71 against that exact integrated commit. Do not merge it from the busy canonical checkout.

Read-only command check:

```powershell
git -C D:\AXM_ACTIVE\workshop fetch origin codex/code-capability-fabric-local-coop-action-game-v2.20 codex/code-capability-fabric-local-coop-action-game-v2.21
git -C D:\AXM_ACTIVE\workshop rev-parse origin/codex/code-capability-fabric-local-coop-action-game-v2.20
git -C D:\AXM_ACTIVE\workshop diff --stat origin/codex/code-capability-fabric-local-coop-action-game-v2.20..origin/codex/code-capability-fabric-local-coop-action-game-v2.21
gh pr view 71 --repo mike-axiom-mir/axm-collaboration-platform --json state,isDraft,baseRefName,headRefName,headRefOid,mergeable,url
```

These commands fetch and inspect only. They do not merge, overwrite, promote, or CANON.

## Authority boundary

Candidate output remains `EXPERIMENTAL`, uninstalled, unintegrated, unpromoted, and unable to change CANON. Direct reuse rights remain `RESEARCH_ONLY_HOLD`; the general executor remains unauthorized. Mike remains the final merge gate.
