# Casino Alpha controller disconnect recovery — TEST receipt

- Status: `TEST`; this is evidence material, not promotion or canonization.
- Date: 2026-08-16 (Europe/Amsterdam).
- Visual backend: `BROWSER_PRIMARY`; no fallback was needed.
- Route: the production seat-1 controller issued by `/api/host/bootstrap`, behind an owned loopback leaf-only HTTP fault proxy.
- Launch roster: one human seat, Mike, in `backroom_story` mode.
- Persistence isolation: `CASINO_ALPHA_STATE_PATH` pointed at an owned OS temporary directory removed by the harness.

## Exact runtime under observation

- `alpha/client/app.js` SHA-256: `D27C9BE390723DD06C7BA79EC29D5E7C727BF35A9BACB0C16F82075A6A7186E8`
- `alpha/client/styles.css` SHA-256: `8159675D3E5F1550C85C706779D5B741C82CC4797A8F591E84072730B6A49679`
- `alpha/runtime/casino-server.cjs` SHA-256: `28F77CD0C1AD1455F346A90F81B69D03B2CEA651DD47753F6DB8026B33DAF5DF`
- `alpha/tests/disconnect-recovery-browser-harness.js` SHA-256: `4454BD3DB32E170A4C9699EA4C872CB11D550AA255E1FEE84C8555C11248A4C6`
- `alpha/tests/disconnect-recovery.test.js` SHA-256: `7952358B262029628B2686558680B15810CC281E4D1FDC67DDB5311CF9F65B8B`
- `alpha/tests/run-all.js` SHA-256: `24BEA68EBBF2C422DCC382E5E274DE14CED4BACDEA2520B33270E14EA7EFF41E`

The runtime and test hashes stayed unchanged from the pre-browser checkpoint through cleanup.

## Claim and prediction

Claim: severing controller HTTP traffic makes the production page persistently identify the loss and reject commands; restoring traffic relinks the same open controller automatically; the next command reaches the same authoritative server session exactly once.

Expected evidence: `LOCAL LINK LIVE` changes to `LOST · RETRYING`; every `[data-command]` control becomes disabled while local sound remains available; direct origin state retains the same session, wallet, wager, and accepted sequence; restoration returns `LIVE` without reload; and a recovered wager selection advances the accepted sequence. A silent loss, any enabled authority-bearing command, a stuck loss state, a new session, changed wallet, or an absent recovered command would refute the claim.

## Observed sequence

1. The production controller rendered `LOCAL LINK LIVE`, wallet 250, wager 1, and accepted sequence 0 for session `casino-disconnect-evidence-session`.
2. The proxy cut rejected controller traffic. The same page changed to `LOST · RETRYING` and stated that commands were disabled until the authoritative server returned. Semantic inspection marked every cabinet, wager, spin, travel, and house-action command disabled; the local sound control remained available.
3. During the cut, a direct read from the untouched origin retained the same session, status `running`, wallet 250, wager 1, and accepted sequence 0. Autonomous server time/draw activity continued and is not claimed to pause.
4. After restoration, the same open controller returned to `LOCAL LINK LIVE` without reload, re-enabled controls, and exposed the `Local link restored` status announcement.
5. The recovered wager-5 control was clicked. The page changed its last bet and spin label to 5; the origin reported the same session, wallet 250, selected wager 5, and accepted sequence 1.

## Repeated visual and semantic evidence

- Captured browser viewport: 1265×720 desktop landscape.
- Baseline semantic snapshot SHA-256: `9B89F242A289F665067F8C60929721DC20A51CA467D7A761FF66706FCFB7A56C`
- Lost-link semantic snapshot SHA-256: `B6B45EAF78A4A96ACD19EE5019C2CE785ED7722B4043DF7D9C02C359F049AC60`
- Recovered semantic snapshot SHA-256: `9FB4D3FEF217491DECD4B5FA61AEBEDB1E53B317DF2B540A87A57D775398FCD1`
- Recovered-command semantic snapshot SHA-256: `19BE6E309C2F52FC15F75C6F0582C0FDADAA816BCE225589EF2104BB6B8F89FA`

Three same-view screenshots corroborated the visible live, lost, and recovered states. These were bounded screenshots, not rolling capture; screenshot buffers were released after inspection and semantic fingerprinting.

## Capability route

The required reconnect route was `READY`: live same-view screenshots, semantic browser interaction, owned transport fault injection, and direct authority inspection were available. The overall scout route was `DEGRADED` only because optional `visual.capture.ephemeral-rolling-buffer/v1` was not exposed. Therefore transition cadence and animation timing remain unclaimed; no new hand was added merely to strengthen this bounded state-transition proof.

## Automated corroboration

- `node --test tools/game-hub/game-library/007-casino/alpha/tests/disconnect-recovery.test.js`: 2/2 passed.
- `node tools/game-hub/game-library/007-casino/alpha/tests/run-all.js`: passed the math book, draw spine, core (20 contracts), server, Game Hub integration, adapter seat, disconnect recovery, and package suites.

The deterministic recovery test verifies stable session authority and accepted sequences 0 → 1 → 2 across a proxy cut using wager-only commands, without spending credits.

## Verdict and boundaries

- Verdict: `PASS` for the named desktop controller HTTP scope.
- Verified: persistent loss visibility, fail-closed command controls, automatic relink without reload, stable server session/economy, and an accepted recovered command.
- Not run: physical-phone hardware, real Wi-Fi/LAN interruption, portrait phone layout, OS network-adapter interruption, server-process restart, or rolling-frame cadence capture.
- Physical-phone QA remains pending and is not implied by this receipt.

## Cleanup

The browser tab was closed, screenshot and semantic buffers were released, the harness exited with code 0, both origin and proxy ports had zero listeners, and the harness-owned casino state directory plus capability-comparison inputs were removed. No temporary recording files were created.

## Workshop checkpoint

After the manifest and receipt were sealed:

- `node tools/game-hub/game-package-verifier.js`: 0 failures, 16 warnings, 19 game folders; slot 007 retained only the separate physical-phone warning. The repository warning count also changed in another concurrently owned game lane, which is not attributed here.
- All ten root checks required by `AGENTS.md` passed.
- `node verify.js`: 0 failures, 16 warnings.
- `node hub/verify-plus.js`: `VERIFIED_WITH_LIMITS` (9 atomic claims across 6 receipts).
- `node tests/html-script-syntax-test.js`: 55 passed, 0 failed.
- `node tools/agent-tool-forge/selftest.js`: 17 passed, 0 failed.
- `node tools/evidence-desk/selftest.js`: 36 passed, 0 failed.

No browser render/click claim is inferred from those scripts; the separate live journey above supplies the visual and interaction evidence for this slot.
