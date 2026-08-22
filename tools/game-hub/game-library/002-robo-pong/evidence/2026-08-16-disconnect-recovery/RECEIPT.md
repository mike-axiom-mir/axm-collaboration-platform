# AXM Pong: Duet disconnect recovery — TEST receipt

- Status: `TEST`; this does not promote the package or make a canon decision.
- Date: 2026-08-16 (Europe/Amsterdam).
- Visual backend: `BROWSER_PRIMARY`; no fallback was needed.
- Route: production player-one route, `/?room=AXM1&player=p1`, behind a leaf-only HTTP/SSE fault proxy.
- Seats: two human evidence seats — Mike and Nova.

## Exact runtime under observation

- `runtime/neon-pong-duet-client.html` SHA-256: `855DD901E86B18F638452BDFE3CCEB5066AE4A565FF5747DD51688F78EFA4A6D`
- `runtime/neon-pong-duet.js` SHA-256: `B77463D84F8E8B307359CBDF6CE94B00932F28A239827D7B9DA7A483BBFAE4D0`
- `runtime/neon-pong-duet-server.cjs` SHA-256: `29195A8CA4A6F445F9D461F5FBC526EAC3B06AF5ADC2E8C0481F48DC9270A060`
- `tests/disconnect-recovery-browser-harness.js` SHA-256: `6A2B8CB9DB009924ED4EFADE013200461D9F72628DDD95867488FFD4400F5937`
- `tests/disconnect-recovery.test.js` SHA-256: `F765CB0134C8639DADDDB4996784160CB799E082DFE3AF4DCD50BF43E063E2F0`

The production runtime hashes stayed unchanged from the pre-test snapshot through the final browser frame.

## Claim and prediction

Claim: the desktop P1 browser route visibly reports transport loss, the production authority continues independently, restored transport resynchronizes the client, and a recovered controller action reaches the authority.

Expected evidence: `LIVE · AXM1` changes to a visible loss label during the proxy cut, direct proxy traffic fails while the origin tick advances, restoration returns the browser to `LIVE · AXM1`, and the recovered rematch control changes authoritative phase back to `running`. A frozen tick, silent loss, stale post-recovery screen, or refused rematch would refute the claim.

## Observed sequence

1. The ready route rendered the Cathedral Cross setup, arena choices, and `START MATCH` with `LIVE · AXM1`.
2. During active play, P1 clicked `USE POWER`. The browser visibly reported `Mike · MEGA SHIELD`; the authoritative state later sampled at `tick=5462`, `phase=running`, `players.p1.controllerConnected=true`, and `core=2`.
3. The fault proxy destroyed the active SSE/HTTP tunnels and rejected new client requests. The browser visibly changed to `RECONNECTING`. A direct proxy `/state` request failed while the untouched origin advanced to `tick=6177`, reached authoritative `phase=gameover`, and retained `players.p1.controllerConnected=true`.
4. After proxy restoration, the browser resynchronized to the authoritative `THE CORE FELL` result and returned to `LIVE · AXM1` with `START REMATCH` available.
5. P1 clicked the recovered `START REMATCH` control. The browser returned to the active controls; authoritative state sampled at `tick=7309`, `phase=running`, `players.p1.controllerConnected=true`, and `countdownRemaining=0`.

The client's polling fallback also contains an `OFFLINE` label. EventSource retry produced the stable visible `RECONNECTING` state in this run, so transport loss was proved independently by the proxy rejection and origin-only state rather than inferred from a label alone.

## Repeated visual evidence

- Browser viewport: 1280×720; device pixel ratio: 1.25.
- Gameplay and depth canvases: 1200×800 each.
- Ready frame SHA-256: `14C6FC3CD436A1C7AE34007D9613C9CD7E6D990BBD0BC7DA7015928AF8254678`
- Connected-action frame SHA-256: `8FF44D99069546400EA1231459C3258FD46CA982C1EC86FB3F15CC2F061DC32F`
- Transport-loss frame SHA-256: `E5A182B800BD5C31D7C596C7F6FB94CA47427C25818F86F346E07286C4C680C7`
- Recovered-state frame SHA-256: `AF94A2C866506937939F207AEFFFFF074806528B356739B47E595EF8C57249E3`
- Recovered-action frame SHA-256: `25EAFC3059EE7C71BFFA67712C56D1D9DC944D25ADB6FF0BEB1B48551A6CA423`

These are bounded repeated screenshots, not rolling capture. Timing between individual visual frames is therefore not claimed beyond the observed sequence. Raw screenshots were released after their fingerprints and typed observations were recorded.

## Automated corroboration

`node --test tools/game-hub/game-library/002-robo-pong/tests/disconnect-recovery.test.js` passed 2/2. It checks the production client's explicit EventSource retry and stale polling, then proves through the same fault proxy that an active authoritative match keeps ticking and accepts a left-moving P1 command after restoration.

## Verdict and boundaries

- Verdict: `PASS` for the named desktop-browser disconnect-recovery scope.
- Verified: visible loss and recovery, independent server authority, SSE resynchronization, pre-cut controller delivery, recovered HTTP input in the focused test, and a recovered rematch control in the browser.
- Not run: physical-phone hardware, portrait phone layout, real gamepad, Wi-Fi/LAN traversal, OS network-adapter interruption, or server-process restart recovery.
- Physical-phone QA remains pending and is not implied by this receipt.

## Cleanup

The browser tab was closed, screenshot buffers were released, the harness exited with code 0, and neither the proxy port nor the origin port remained listening. No temporary recording files were created.
