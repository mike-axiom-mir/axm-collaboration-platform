# Test report — local co-op action game v2.21

Status: branch `TEST` · detached output `EXPERIMENTAL`

Technical source commit: `61b012a4ee2896d7b05ddb8eeb5848d06087d7df`

## Output-first browser journey

PASS on the exact final game bytes (`game.js` SHA-256 `f38402c41637cf94371cfe76e6d21ce4fffa466b9f8c469959f7a855f2f38799`):

- two independently controlled local keyboard seats;
- visible directional bolts and facing markers;
- visible linked/separated co-op state;
- visible Warden practice route and boss health;
- Warden defeat changed enemies `1 → 0` and P1 score `0 → 5`;
- repair core changed shared reactor `76 → 88`.

The journey caught a real projectile-tunneling defect. Collision at bolt spawn was repaired before movement and retained as a countertest.

## Focused checks

- deterministic game candidate generator: `12/12 PASS`;
- local co-op action recipe and adversarial checks: `21/21 PASS`;
- bounded preview sandbox checks: `12/12 PASS`;
- capability-gap comparison: `READY`, zero missing capabilities for this exact rung.

## Required `AGENTS.md` checks

Run once after the final code patch:

| Command | Result |
| --- | --- |
| `node verify.js` | PASS — `0 FAIL`, `25 warn`, spine `b618c5762240070c` |
| `node hub/hub-selftest.js` | PASS |
| `node hub/route-selftest.js` | PASS |
| `node hub/graft-selftest.js` | PASS |
| `node hub/skin-selftest.js` | PASS |
| `node hub/verify-plus.js` | `VERIFIED_WITH_LIMITS` |
| `node tests/html-script-syntax-test.js` | `57 PASS · 0 FAIL` |
| `node tests/tool-forge-package-test.js` | PASS |
| `node tools/agent-tool-forge/selftest.js` | `17 PASS · 0 FAIL` |
| `node tools/evidence-desk/selftest.js` | `36 PASS · 0 FAIL` |

The first mandatory pass correctly rejected stale generated city/schema/twin projections after the capability contract changed. Those deterministic views were rebuilt; the final pass above is the post-repair result.

## Warnings retained

`verify.js` reports `25` visible warnings. They include evidence gaps, a legacy undeclared manifest kind, and claims that require promotion-time reverification. They are warnings, not silently converted to proof. The roadmap's earlier `41` warning count is not the current branch count.

## Not run or not proved

- two-human fun, difficulty, and balance judgment;
- rolling-buffer/frame-perfect flicker review (capability unavailable);
- controller, touch, online multiplayer, or persistence behavior;
- installation, Workshop integration, publication, promotion, or CANON;
- any provider, AI runtime, general executor, or supplied experimental runtime.

The local HTTP preview executed only the exact allowlisted generated HTML/CSS/JavaScript candidate for browser review. It granted no installation or Workshop-writing authority.
