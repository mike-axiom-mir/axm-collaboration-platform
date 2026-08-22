# Hearthgate dedicated-controller disconnect recovery — TEST receipt

- Status: `TEST`; this is evidence material, not promotion or canonization.
- Date: 2026-08-16 (Europe/Amsterdam).
- Visual backend: `BROWSER_PRIMARY`; no fallback was needed.
- Route: production dedicated P1 controller, `/controller.html?player=p1`, behind a leaf-only HTTP fault proxy.
- Launch roster: two human seats — Mike and Nova.

## Exact runtime under observation

- `runtime/controller.html` SHA-256: `599E76DEB46DD3A72541DFE3E2A02959DDDDF88DCDC3388DD764AB12765B8429`
- `runtime/app.js` SHA-256: `6C60ED6C7A2CCFB7769F11D0CEDF38A9A4F0A44A1753D258903920FFE771C73D`
- `runtime/server.js` SHA-256: `726413E66FDFF3DAA3EFA42AC7EA48534D57BA54ECBFDF85D6327C437D2FF6EA`
- `tests/disconnect-recovery-browser-harness.js` SHA-256: `F43415E6DA009146207ED1B6CC826CCBFC442E6BEC2F2AFFBDBC83F644778442`
- `tests/disconnect-recovery.test.js` SHA-256: `B3F83D3741BD89E43D38C4605538D9E517DCF428DB108AC94ED97E67778EC22B`

The production runtime hashes stayed unchanged from the pre-test snapshot through the final browser frame.

## Claim and prediction

Claim: the dedicated controller visibly identifies a severed relay, the managed server expires stale input, restoring transport automatically relinks the controller, and a recovered controller edge reaches the server relay.

Expected evidence: the controller changes from `NORTH LINK LIVE · P1` to `LINK LOST · CHECK SAME WI-FI`; the server's 650 ms TTL changes P1 from `fresh` to `disconnected`; restoration returns the live label; and a post-recovery button click increments an authoritative relay edge. A silent loss, stale input remaining fresh, a stuck loss label, or an absent recovered edge would refute the claim.

## Observed sequence

1. At baseline, the landscape controller rendered both joysticks and all eight action buttons. It showed `NORTH LINK LIVE · P1`; relay state reported `phoneStatus.p1=fresh`, `sequence=147`, and `ttlMs=650`.
2. The fault proxy rejected new controller traffic. The production controller visibly changed to `LINK LOST · CHECK SAME WI-FI` with its `connection lost` presentation.
3. A direct proxy request failed. The untouched origin reported `phoneStatus.p1=disconnected` and omitted P1 from fresh inputs after the TTL elapsed.
4. After proxy restoration, the same open controller automatically returned to `NORTH LINK LIVE · P1` without a reload.
5. P1 clicked the recovered `X / UPGRADE` control. Relay state reported `phoneStatus.p1=fresh`, `sequence=1053`, and `edges.upgrade=1`.

## Repeated visual evidence

- Browser viewport: 1280×720 landscape; device pixel ratio: 1.25.
- Connected frame SHA-256: `C87B0911E1D8EE894699D9E7127E2931A55B7AD250AD736D17AD97DFE83BA1DF`
- Lost-link frame SHA-256: `A2D65FBFF0F173074FB20B29E6D3F1F51DFCD722275B068134B2950C33617DF0`
- Recovered frame SHA-256: `C87B0911E1D8EE894699D9E7127E2931A55B7AD250AD736D17AD97DFE83BA1DF`
- Recovered-action frame SHA-256: `15A5F626FFE648DC11A4E011D0E2FB6B653F3A54FE2ABC4A27002F8CF005A497`

The connected and recovered frames are byte-identical, which is expected because the recovered surface returns to the same settled state. The action frame differs because the clicked upgrade control retains browser focus. These are bounded repeated screenshots, not rolling capture; raw screenshots were released after fingerprinting.

## Automated corroboration

`node --test tools/game-hub/game-library/021-hearthgate-two-sides/tests/disconnect-recovery.test.js` passed 2/2. It checks the production controller's retry/loss labels, the shared screen's explicit remote-link failure handling, and the server TTL contract, then exercises fresh → disconnected → fresh relay state through the same fault proxy.

## Verdict and boundaries

- Verdict: `PASS` for the named dedicated-controller HTTP relay scope.
- Verified: loss visibility, stale-input expiry, automatic relink, and accepted semantic input after restoration.
- Hearthgate's deterministic defense simulation remains browser-local. This receipt does not claim in-progress simulation persistence or recovery; reload intentionally restarts an active v1 run.
- Not run: physical-phone hardware, real Wi-Fi/LAN interruption, portrait controller layout, physical gamepad unplug/replug, OS network-adapter interruption, or server-process restart.
- Physical-phone QA remains pending and is not implied by this receipt.

## Cleanup

The browser tab was closed, screenshot buffers were released, the harness exited with code 0, and neither the proxy port nor the origin port remained listening. No temporary recording files were created.
