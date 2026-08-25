# Integration handoff — deterministic local co-op action game v2.20

Status: `TEST` · reviewable · not merged · not installed · not promoted · not `CANON`

## Source and target assumptions

- Source branch: `codex/code-capability-fabric-local-coop-action-game-v2.20`
- Technical source commit:
  `71d2ad2dfc421cd3c315d1b279ff207bf3b03941`
- Exact source parent / required stacked base:
  `a34c6881aa793250fb970b33e7dc554f4ea20ff3`
- Intended target branch:
  `codex/code-capability-fabric-portable-fsm-v2.19`
- Target review: <https://github.com/mike-axiom-mir/axm-collaboration-platform/pull/69>
- Source review: create/use the stacked draft PR reported in the final steward
  handoff; do not target `main` until the v2.19 dependency is integrated.

The canonical `D:\AXM_ACTIVE\workshop` checkout was not edited, cleaned,
reset, merged, or overwritten. Its exact branch, head, and dirty paths must be
re-read again immediately before any local integration; a dirty or divergent
checkout is an automatic `HOLD`.

## Exact changed paths

```text
docs/generated/LEGO_CITY_BEGINNER_MAP.md
docs/generated/LEGO_CITY_MAP.md
docs/steward-runs/2026-08-25-code-capability-fabric-local-coop-action-game-v2.20/BROWSER_DESKTOP_READY.png
docs/steward-runs/2026-08-25-code-capability-fabric-local-coop-action-game-v2.20/BROWSER_JOURNEY_RECEIPT.json
docs/steward-runs/2026-08-25-code-capability-fabric-local-coop-action-game-v2.20/BROWSER_NARROW_ARENA.png
docs/steward-runs/2026-08-25-code-capability-fabric-local-coop-action-game-v2.20/BROWSER_NARROW_TOP.png
docs/steward-runs/2026-08-25-code-capability-fabric-local-coop-action-game-v2.20/BROWSER_TWO_SEATS_ACTIVE.png
docs/steward-runs/2026-08-25-code-capability-fabric-local-coop-action-game-v2.20/CANDIDATE_GENERATION_RECEIPT.json
docs/steward-runs/2026-08-25-code-capability-fabric-local-coop-action-game-v2.20/CAPABILITY_GAP_AFTER.json
docs/steward-runs/2026-08-25-code-capability-fabric-local-coop-action-game-v2.20/CAPABILITY_GAP_BEFORE.json
docs/steward-runs/2026-08-25-code-capability-fabric-local-coop-action-game-v2.20/CAPABILITY_INVENTORY_AFTER.json
docs/steward-runs/2026-08-25-code-capability-fabric-local-coop-action-game-v2.20/CAPABILITY_INVENTORY_BEFORE.json
docs/steward-runs/2026-08-25-code-capability-fabric-local-coop-action-game-v2.20/CAPABILITY_REQUIREMENTS.json
docs/steward-runs/2026-08-25-code-capability-fabric-local-coop-action-game-v2.20/EVIDENCE_ROUTE.md
docs/steward-runs/2026-08-25-code-capability-fabric-local-coop-action-game-v2.20/INTEGRATION_HANDOFF.md
docs/steward-runs/2026-08-25-code-capability-fabric-local-coop-action-game-v2.20/STEWARD_RECEIPT.md
docs/steward-runs/2026-08-25-code-capability-fabric-local-coop-action-game-v2.20/TEST_REPORT.md
registry/generated/city-authority-map.json
registry/generated/city-capabilities.jsonl
registry/generated/city-dependencies.json
registry/generated/city-graph.json
registry/generated/city-graph.receipt.json
registry/generated/city-modules.json
registry/generated/city-proof-map.json
registry/generated/city-schemas.json
registry/generated/city-twins.json
registry/generated/city-unresolved-edges.json
shared/code-capability-fabric/README-deterministic-game-candidate-generator-v1.md
shared/code-capability-fabric/README.md
shared/code-capability-fabric/deterministic-game-candidate-generator-v1.js
shared/code-capability-fabric/game-candidate-packet.schema.json
shared/code-capability-fabric/game-generation-brief.schema.json
shared/code-capability-fabric/local-coop-action-game-recipe-v1.js
shared/code-capability-fabric/module-deterministic-game-candidate-generator-v1.contract.json
shared/code-capability-fabric/selftest-local-coop-action-game-recipe-v1.js
tools-index.json
tools/sandbox/disposable-candidate-sandbox-v1.js
tools/sandbox/preview-coop-game-v1.js
tools/sandbox/selftest-disposable-candidate-sandbox-v1.js
```

## Verification summary

- Focused: deterministic generator `12/12`; co-op recipe `17/17`; Sandbox
  `12/12`.
- Browser: actual desktop and narrow render, click, P1/P2 keyboard, dash,
  attack, pause/resume, restart, and reload `PASS`.
- Recursive Fabric: `52/52 PASS`.
- Required `AGENTS.md`: `10/10 PASS`.
- Final verifier: `0 FAIL · 25 warn`; warning details are in `TEST_REPORT.md`.
- Unrun/held: rolling-buffer timing, physical players/devices, controllers,
  touch, online/persistence, long-form balance, general executor, installation,
  public rights, promotion, merge, and `CANON`.

## Exact no-surprise review route

Preferred action: review the stacked draft PR. Confirm its base is exactly the
v2.19 branch and that GitHub reports no unexpected commits or paths. Mike may
hold or reject regardless of technical passes.

For a disposable local review without touching the busy canonical checkout:

```powershell
git -C D:\AXM_ACTIVE\workshop fetch origin
git -C D:\AXM_ACTIVE\workshop worktree add --detach D:\AXM_ACTIVE\workshop-review-code-capability-fabric-v2.20 origin/codex/code-capability-fabric-local-coop-action-game-v2.20
git -C D:\AXM_ACTIVE\workshop-review-code-capability-fabric-v2.20 diff --stat a34c6881aa793250fb970b33e7dc554f4ea20ff3..HEAD
```

Do not create that review worktree if the destination already exists; inspect
or choose a new explicit destination instead.

Only after PR69/v2.19 is selected and the canonical checkout is clean and at
the exact parent should a fast-forward be considered:

```powershell
git -C D:\AXM_ACTIVE\workshop fetch origin
git -C D:\AXM_ACTIVE\workshop status --short
git -C D:\AXM_ACTIVE\workshop rev-parse HEAD
git -C D:\AXM_ACTIVE\workshop rev-parse origin/codex/code-capability-fabric-portable-fsm-v2.19
git -C D:\AXM_ACTIVE\workshop merge-base --is-ancestor a34c6881aa793250fb970b33e7dc554f4ea20ff3 origin/codex/code-capability-fabric-local-coop-action-game-v2.20
git -C D:\AXM_ACTIVE\workshop merge --ff-only origin/codex/code-capability-fabric-local-coop-action-game-v2.20
```

Required preconditions:

1. `status --short` prints nothing.
2. canonical `HEAD` and the remote v2.19 target both equal the exact selected
   parent, or Mike deliberately chooses a reviewed rebase/replay route.
3. the remote source branch still descends from that parent.
4. the final source head and draft PR match the commit reported at publication.

If any condition differs, stop. Do not merge, reset, clean, overwrite, install,
promote, or `CANON`; re-review the drift first.
