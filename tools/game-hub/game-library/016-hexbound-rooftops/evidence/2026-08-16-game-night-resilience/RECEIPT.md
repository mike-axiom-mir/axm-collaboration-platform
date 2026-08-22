# Hexbound game-night resilience — TEST receipt

- Status: `TEST`; this is evidence material, not promotion or canonization.
- Date: 2026-08-16 (Europe/Amsterdam).
- Visual backend: `BROWSER_PRIMARY`; no fallback was needed.
- Viewport: 1280×720 landscape at device pixel ratio 1.25.
- Routes: production shared screen at `/games/016/` and dedicated Quartermaster controller at `/games/016/controller.html`, served through a leaf-only HTTP fault proxy.

## Exact runtime under observation

- `runtime/index.html` SHA-256: `A8EBC92D973793CC8AF349B0FF12040C129ECA4B691C32D9E703DCA35B9F46DE`
- `runtime/app.js` SHA-256: `FCA004F256F9D698D8CFC2151F578FA96AA63BD2D4A7A57681C1CBDC8E29AC6E`
- `runtime/controller.html` SHA-256: `3ACC323974C2E3305685DC4888F123D04FCAF7FAF8E0B432293DB27C4DB3291C`
- `runtime/controller.css` SHA-256: `FDC9AB73E7395FA9648E8E771BEAB6309380CA3F6C9AD45EA772A55FDA2A2673`
- `runtime/controller.js` SHA-256: `5EB7270032DC166146356A6B4352EA07DD317D67F5E923706F9A47B0AE75CCF0`
- `runtime/server.js` SHA-256: `D476B52B1BD5FC3E33B678B99C88F5D39FC35B0BA97C1FA7A37EEB9B79277641`
- `tests/blocking-overlay-escape.test.js` SHA-256: `E186AAFB5F896B0B326BB5181456CC597B704018A67A5DCF05B597E9605867FD`
- `tests/disconnect-recovery-browser-harness.js` SHA-256: `5042F90435D37DE1E62A8FA240E5808AB47B1D5EF99649A650373E6E099C823D`
- `tests/disconnect-recovery.test.js` SHA-256: `0E0BFC070861FBC9BB2718EC5D6500FB8352FBB3CA30AE39BCEBE66703648484`

These runtime and test hashes stayed unchanged from the pre-browser checkpoint through the final observed action.

## Blocking-overlay claim

Claim: Escape is inert on the title, and during active battle one focused Escape dismisses the blocking command guide and restores the same battle surface. The outcome dialog uses its existing primary action rather than being overwritten by the guide.

Expected evidence: title Escape leaves the title byte-identical; the battle guide is the only visible modal; one Escape removes that modal while the HUD and battle remain visible. A stale modal, hidden HUD, unexpected title guide, or overwritten outcome action would refute the claim.

Observed sequence:

1. The title rendered at 1280×720 with no modal. One focused Escape left the title visible, setup hidden, and the modal hidden; the before and after screenshots were byte-identical.
2. `PLAN THE INVASION` opened setup, and `Open the rooftop` entered an active skirmish with the HUD, three canvases, command controls, and minimap visible.
3. The pause control opened `COMMAND CROWDS, NOT CHORES`; the semantic snapshot found exactly one visible blocker, `#modal`, with both `Close` and `Back to the war` controls.
4. One focused Escape on the dialog removed the blocker. The HUD remained visible, the war room remained hidden, and the active battle returned.

The live path covered title and battle-guide behavior. The outcome-primary routing is corroborated by the focused source contract, not a forced live outcome.

## Disconnect-recovery claim

Claim: after an already-linked Quartermaster controller loses HTTP relay traffic, the UI visibly fails closed, the server expires the seat, restoring transport relinks the same open page automatically, and a recovered command reaches the authoritative relay.

Expected evidence: `LIVE WITH COMMANDER` changes to an error state with all command controls disabled; the untouched origin reports `seat.connected=false` after its 6500 ms TTL; the same page returns to `LIVE WITH COMMANDER` without reload; a post-recovery command is queued by the server. Silent loss, enabled controls during loss, a stale connected seat, a stuck error, or a missing recovered command would refute the claim.

Observed sequence:

1. The Quartermaster deck showed `LIVE WITH COMMANDER`, the evidence battlefield state and resources, and all 16 command controls enabled.
2. The fault proxy severed active and new traffic. The open production controller changed to `FAILED TO FETCH`, used its error presentation, and disabled all 16 command controls.
3. The untouched origin reported the occupied Quartermaster seat as `connected=false` after the 6500 ms relay TTL.
4. Restoring the proxy returned the same open page to `LIVE WITH COMMANDER` with all 16 controls enabled; no reload or reconnect-button click was used.
5. The recovered `Guard` control produced visible receipt `#1 · Guard queued`. The origin exposed command sequence 1 for match `hexbound-browser-evidence`, type `macro`, value `guard`, with the seat connected.

The final browser diagnostic log was empty.

## Repeated visual evidence

- Title baseline: `E677364748D65845F56215F54B4AC75651FD3A7D8C9548D6F9488B4176D77935`
- Title after inert Escape: `E677364748D65845F56215F54B4AC75651FD3A7D8C9548D6F9488B4176D77935`
- Active battle: `3001DD5322678ED919F1DEC86ECD2B8C2E034A1A93094076C081511E11F57317`
- Blocking guide: `4792297058DFE481727576BBFA5676CD4EF4EEB9117FD4C0DA3B354A6F22171A`
- Battle restored by Escape: `692234D0D40E43A89647585B24E01C95B372DF1EA181A87391D2EFC9D5AF3269`
- Controller live with Commander: `D6BD049B0FCBB86C4E37510B20BE3D41E285CEC040353DF08CFCDCB9EDDD75DB`
- Controller relay severed: `562A75CBF078EB8C07D45E44EEB9726C07E3112DB73E64194EF7F47F99643768`
- Controller automatically recovered: `E785E5A5C574429C2CF30E652C605F737D346139F575C074D26184848D139393`
- Recovered `Guard` receipt: `2DAD01D41DB57E25B2163A77ACF0B8A594941A0844B3C9A7003B203945EAF186`

These are bounded repeated screenshots, not rolling capture. They prove settled visible states and transitions at the available cadence; they do not support animation or frame-timing claims. Raw screenshot buffers were released after fingerprinting, and no capture files or recordings were created.

## Automated corroboration

- `node --test tests/blocking-overlay-escape.test.js tests/disconnect-recovery.test.js`: 4/4 passed.
- The disconnect integration test launches the exact production server behind the same fault-proxy implementation, observes connected → TTL-expired → connected relay state, and queues a recovered command.
- The pre-change package baseline passed 73/73 tests across all 15 existing `*.test.js` files.
- The final package run passed 77/77 tests across all 17 `*.test.js` files; `tests/package-selftest.js` also passed all 69 package checks.
- All ten repository-required commands exited 0. Notable exact totals were 55/55 HTML syntax checks, 17/17 Agent Tool Forge checks, and 36/36 Evidence Desk checks.
- `shared/readiness/selftest.js` passed with 218 tools and 1,907 capabilities.
- Final verifier checkpoint: `0 FAIL · 21 warn · spine b618c5762240070c`. Hexbound's only remaining game-night warning is physical-phone QA.

## Verdict and boundaries

- Verdict: `PASS` for the named 1280×720 desktop shared-screen Escape and dedicated-controller HTTP relay scopes.
- The production change is limited to Escape/modal routing in `runtime/app.js`; simulation, server authority, command validation, and gameplay systems were not altered.
- Hexbound's world simulation remains browser-host. This receipt does not claim in-progress simulation persistence across reload, browser navigation, or server restart.
- Not run: physical-phone hardware, real Wi-Fi/LAN interruption, portrait layout, physical gamepad behavior, OS network-adapter interruption, forced live battle outcome, or server-process restart.
- Physical-phone QA remains pending and is not implied by this receipt.

## Cleanup

The browser tab was closed after the evidence loop, screenshot buffers were released, the harness exited normally, and neither proxy nor origin port remained listening. No temporary recording paths were created.
