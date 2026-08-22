# Build receipt

Status: `WORKING` · not CANON

Version: `0.6.0-oathbound-3d`

Lane: `tools/game-hub/game-library/021-hearthgate-two-sides/**`

Spot 021 remains an additive, self-contained Game Hub package. The authored game change is confined to this untracked lane and does not edit another game, the Hub router, Foundation, or a shared runtime.

Shared-workspace disclosure: a verification command was mistakenly launched as root `npm test` instead of lane `npm test`. It was stopped after the Workshop aggregate suite had progressed into `test:workshop`. Its documented deterministic preverify generators rewrote `tools-index.json`, `registry/modules.json`, `registry/capabilities.jsonl`, `registry/public-status.json`, and `registry/proofs.json` at 2026-08-16 09:23 local time. Those already-dirty derived files were preserved rather than reverted over concurrent work and are not claimed as Hearthgate content. No commit or promotion was performed.

## Automated checks

- `node --check runtime/game-core.js` — PASS
- `node --check runtime/hearthgate-three.js` — PASS
- `node --check runtime/app.js` — PASS
- `node --check runtime/server.js` — PASS
- `npm test` — PASS: deterministic Oathbound chapters/receipts, Hexer wards, Warlord commands, 6:05 semantic playthrough, 3D renderer contract, HTTP/QR routes, and the prior economy/control suite
- `node tests/oathbound-semantic-playtest.js` — PASS at 6:05: 5/5 Oaths, 500 defeated, gate level 5, twin Warlords defeated, same run active in Endless Vigil
- `node tests/hearthgate-3d-selftest.js` — PASS: depth-tested WebGL, sixteen quantized channel steps, aura rendering, Canvas fallback authority, and script/layer ordering
- `node tests/server-http.test.js` — PASS
- managed-host resolution — PASS; Game Hub launches bind `0.0.0.0` for same-Wi-Fi QR access while manual runs remain localhost-only
- focused `game-package-verifier.verifyGameDir(...)` — PASS with zero errors and two named warnings: disconnect recovery and physical-phone QA pending
- `node tools/game-hub/universal-control-policy-selftest.js` — PASS; spot 021 is recognized as integrated with `axm-universal-xbox-brawl-v0.2.1`

The ten AGENTS.md root commands passed 10/10 after the lane was complete. `node verify.js` and `node hub/verify-plus.js` reported 0 failures and 39 Workshop warnings; verify-plus remained `VERIFIED_WITH_LIMITS`. Hub, route, graft, skin, HTML script syntax (55/55), Tool Forge package, Agent Tool Forge (17/17), and Evidence Desk (36/36) all exited zero.

## Live browser check

The 2026-08-16 bounded browser pass verified the new layer at 1280×720. The renderer reported `webgl-low-poly`, `active`, `paletteSteps=16`, and `hybrid-webgl-canvas`; raised approach planes, paths, gate, hearth, plot pads, and the oblique camera were visibly dimensional. Hexer teal ward language and Warlord red command language were visibly distinct. The HUD changed from Ember Muster to `ENDLESS VIGIL` at 6:00 with 5/5 receipts while the same run continued. The result card showed Oaths and Warlords; replay returned to Ember Muster with zero receipts. Pause held 7:03 across 800 ms and resume advanced to 7:04. Reload honestly returned to title/0:00. Two Wardens exposed both 105-gold wallets and two warden chips. See `evidence/oathbound-3d-2026-08-16.json`.

The browser binding did not expose a valid viewport-resize hand, so the changed Oath HUD has not been re-proven at 900×600. The prior v0.5 compact result is not promoted to v0.6 evidence. No rolling-video capture hand was exposed; motion checks used bounded repeated screenshots and semantic state. Both limitations remain named rather than inferred away.

The in-app browser rendered and exercised the title, solo start, wave play, building modal and Forge income, tower upgrade, special reward callout, breached `×2` enemies spread across inner paths, game-over summary, two-warden co-op start, pause/frozen timer/resume, help card, and a compact 900×600 viewport. See `evidence/visual-verification.json`.

The dedicated QR controller was separately rendered at 844×390 for P1/North and P2/South. It had no page overflow, 150-pixel twin sticks, center targets at least 54 pixels tall, live semantic edge transport, simultaneous two-seat readiness, and an end-to-end North tower upgrade from the P1 phone page into the co-op game. All three browser pages had clean warning/error logs. See `evidence/phone-controller-readiness-2026-08-09.json`.

After the first physical playtest report, phone title control and P1 aim ownership were corrected. Live retest proved A start/resume, X solo, Y co-op, stale-edge protection after reload, quick aim-release direction transport, and P1 phone aim remaining authoritative after the shared-screen pointer moved in the opposite direction. See `evidence/controller-playtest-fix-2026-08-09.json`.

After the first pacing/economy playtest report, co-op expanded to four plots per side with separate owned wallets, income, rewards, and spending; build cards gained exact role/current/next output; and the enemy director gained Skitters, early Relicbacks, and announced surges. Live verification proved the eight-plot layout, exact build descriptions, independent W2 Market purchase/income, and corrected lower-plot selection without click-through. See `evidence/gameplay-depth-playtest-2026-08-09.json`.

The radial-build pass removes blueprint cycling from controller play. Holding RB at an empty nearby plot opens a four-direction canvas wheel driven by the left stick; releasing RB builds the highlighted choice. Pressing RB at an existing building upgrades it directly, while LB now fortifies the shared gate. The QR transport carries a real `buildHeld` state so phone selection is not approximated from pulses. Pointer/touch build cards remain as a fallback.

Live verification at 1280×720 observed Forge open, right-thumb choice move to Ballista, release create W1's Ballista without opening the modal, and the next RB action upgrade it to level 2. The 844×390 phone controller retained zero overflow with a 59×59 RB target and clear `HOLD WHEEL` / `GATE` labels. Game and phone logs were empty. See `evidence/radial-build-wheel-2026-08-09.json`.

Physical Xbox/phone feel, unplug/replug behavior, local-Wi-Fi reconnect behavior, v0.6 compact-viewport observation, Steam packaging, durable save/profile authority, and human balance testing remain pending until actually performed. `WORKING` does not mean accepted, shipped, or canonized; Mike Tobi remains the review and merge gate.
