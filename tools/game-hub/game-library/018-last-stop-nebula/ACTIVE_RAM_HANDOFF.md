# ACTIVE RAM HANDOFF — LAST STOP: NEBULA

Sealed: `2026-07-28T08:02:06Z`  
Workspace: `C:\axm workshop`  
Owned lane: `tools/game-hub/game-library/018-last-stop-nebula`  
Current milestone: `0.11.0-beta`  
Persistent user goal: `steward it make it better` — paused for this handoff, not complete.

## Read this first

Continue from the existing game. Do not restart or replace it. The package is a polished, locally launchable 3D beta in Game Hub slot 018. Preserve every unrelated workspace change: other tasks actively own neighboring slots. Work only inside this slot unless the user explicitly expands scope.

## User intent

The player is an exhausted alien who owns a ruined petrol station beside a once-forgotten nebula attraction. The station is months in debt, fuel is leaking, food is scarce, and only three weeks remain before financial collapse. AXM Corp unexpectedly reopens the attraction, traffic arrives immediately, and guaranteed growth becomes the crisis. The game is about capturing as much of that growth as possible through fast service, upgrades, automation, and choices under pressure—not about discovering demand. Reaching 1,000 bad reviews revokes the license. Surviving the chosen retirement timer lets the alien escape with the remaining money as a high score. The experience must stay highly visual, cinematic, scene-rich, and genuinely 3D. Future seams may support more locations, co-op, and multiplayer, but those are not current claims.

## What exists now

- Original offline Three.js r160 diorama with animated nebula ribbons, traffic, aliens, queues, drones, lighting, and visible station transformation.
- Four authored cameras: forecourt, mart, engineering, and nebula.
- Three service lanes: Plasma Pumps, Nebula Mart, and Repair Bay.
- Manual service, energy, supplies, debt diversion, a leaking tank, restocking, micro-naps, queue patience, reviews, automation, event decisions, and twelve visible upgrades.
- Three retirement contracts targeting roughly 6, 9, and 12 minutes; the standard 21-day contract is the intended first run.
- Retirement payout/high score and immediate failure at 1,000 bad reviews.
- Versioned browser-local save, resume, settings, high score, and a capped private ledger containing the newest 24 compact run summaries.
- Contract-specific ledger filters for All / 14 / 21 / 30 days. Quick, standard, and legend samples are never mixed into one timer recommendation.
- Average review-pressure curve. Revoked runs remain at 1,000 reviews on later contract days, preventing survivor bias.
- A contract needs three matching runs before producing an informational 14–30 day timer estimate. Guidance never changes live balance automatically.
- Manual anonymous JSON report download/copy. Report schema: `last-stop-nebula-balance-report/v1`. It excludes run identity, exact run timestamps, save state, and device data; nothing uploads automatically.
- Valid 0.9 and 0.10 saves migrate to 0.11.
- Responsive browser layout at 390×844.

## Current verified state

- Full focused suite: **24/24 passing**.
- Slot verifier: **0 errors**, one honest warning: physical-phone QA pending.
- Runtime syntax checks passed for `app.mjs`, `game-core.mjs`, `run-telemetry.mjs`, and `server.cjs`.
- Desktop contract ledger at 1280×720: card client height 596, scroll height 596, all actions visible, no horizontal overflow.
- Mobile contract ledger at 390×844: no horizontal overflow; download, copy, and close controls are all reachable after an 88 px bounded internal scroll.
- Filter interaction proof: All shows five rows and no estimate; 14 Day shows one row and requests two more matching runs; 21 Day shows three matching rows.
- The live download data URI decoded to the correct schema with five samples and no run ID or exact completion timestamp. It was inspected without triggering a download.
- The prior 0.10 full visual journey captured zero console errors/warnings. The focused 0.11 ledger session did not expose a console-log reader, so do not broaden that claim.
- Local server was stopped cleanly; port 8818 was clean at handoff.
- Manifest version, server health version, and `GAME_VERSION` all read `0.11.0-beta`.
- Final manifest digest observed: `FB5E324D6C1401ACFFD1B2214F6CDCC4CC6B665F356AAF948BD4A4D4817D83FE`.

## Key files

- Launch: `START_LAST_STOP_NEBULA.cmd`
- Manifest: `game.manifest.json`
- UI/controller: `runtime/app.mjs`
- Deterministic mechanics: `runtime/game-core.mjs`
- Ledger/report logic: `runtime/run-telemetry.mjs`
- 3D scene: `runtime/scene.mjs`
- Markup and styling: `runtime/index.html`, `runtime/styles.css`
- Local server: `runtime/server.cjs`
- Main receipt: `BUILD_RECEIPT.md`
- Design authority: `DESIGN_BIBLE.md`
- Honest limits: `KNOWN_LIMITS.md`
- Durable stewardship notes: `STEWARD_MEMORY.md`
- Evidence routing: `evidence/EVIDENCE_ROUTE.md`
- Visual receipt: `evidence/visual-verification.json`

## Current visual proof

- `evidence/visual/contract-ledger-desktop-1280x720.png`
- `evidence/visual/contract-ledger-mobile-390x844.png`
- `evidence/visual/contract-ledger-mobile-actions-390x844.png`
- Existing title, opening, gameplay, upgrade, showcase, engineering, save-recovery, retirement, revocation, and run-analysis PNGs remain under `evidence/visual/`.

Selected SHA-256 digests:

- Desktop contract ledger: `E219C1370F05C37FCFAF504E721E43D10EA2FB2B4E628DC19DD2BA28A3089892`
- Mobile contract ledger top: `0800F6EFD9E672F7CD8D74FA8C1ABFA2F2B8B831B7750CC19C37F969EA2241A8`
- Mobile contract ledger actions: `B8F022CFD249CDD56676DDF8FB68EF77F8127779391A8627E323803EB89F9E8F`

## Verification commands

Run from `C:\axm workshop\tools\game-hub\game-library\018-last-stop-nebula`:

```powershell
node --check runtime/app.mjs
node --check runtime/game-core.mjs
node --check runtime/run-telemetry.mjs
node --check runtime/server.cjs
node --test tests/*.mjs tests/*.cjs
node -e "const {verifyGameDir}=require('../../game-package-verifier.js');const r=verifyGameDir(process.cwd());console.log(JSON.stringify(r,null,2));if(r.errors?.length)process.exit(1)"
```

Launch manually with `START_LAST_STOP_NEBULA.cmd`, or run `node runtime/server.cjs` and open `http://127.0.0.1:8818/games/018/`.

Useful non-saving QA URLs:

- `?qa=ledger`
- `?qa=showcase`
- `?qa=retirement`
- `?qa=revoked`

## Safest next improvement

The highest-value next step is real human playtesting, not another invented rebalance. Collect voluntarily exported anonymous reports from several players, analyze each contract separately, and then decide whether the 21-day standard retirement timer should change. Keep estimates advisory until representative samples exist.

Other honest next candidates:

1. Physical-phone QA at a real touch device, including readable HUD, drawer scrolling, service accuracy, audio resume, heat, and performance.
2. Representative low-end GPU measurement.
3. More authored event variety and richer audio, provided the pressure-management clarity remains intact.
4. Only after the single-player loop is stable: design explicit network authority for co-op/multiplayer rather than faking it locally.

## Guardrails

- Do not touch neighboring slots, shared Game Hub files, or unrelated dirty files without explicit scope.
- Re-read `game.manifest.json` immediately before and after any edit; it is a shared seam.
- Use `apply_patch` for edits.
- Preserve browser-local privacy. Never add automatic telemetry upload.
- Do not auto-apply the local timer estimate to live rules.
- Do not claim human balance, physical-phone certification, representative GPU performance, co-op, multiplayer, cloud saves, or extra locations until directly proven.
- If using the in-app browser for live verification, read and follow the browser and live-visual skills; reset viewport overrides and finalize browser tabs when done.

## Session curation receipt

- Classification: this file is a `DERIVED_VIEW` and handoff is a `DURABLE_EVENT`; game source, manifests, receipts, and evidence are `CANONICAL_STATE`.
- Durable events preserved: 0.11 promotion, 24/24 test verdict, package-verifier verdict, contract-isolation decision, survivor-bias correction, anonymous-report privacy boundary, responsive measurements, active limitations, and server shutdown.
- Repetitive telemetry: omitted; only final measurements and exceptions retained.
- Temporary material deleted: none in this handoff turn. Previously selected visual proof remains intentionally retained and referenced by package evidence.
- Private/user sources: no external user files copied or deleted.
- Unclassified items: none.
- Authority: explicit user request to place active RAM in the workshop and hand it to a new chat.
