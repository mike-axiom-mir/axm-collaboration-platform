# Relaybound blocking-overlay Escape receipt

Status: `TEST`

This receipt verifies one bounded claim: in the production Relaybound client,
Escape bridges both blocking surfaces to one reversible session menu without
discarding the server-authoritative state. It does not canonize the package.

## Evidence boundary

- Production surface: `runtime/relaybound-client.html`
- Production runtime: `runtime/relaybound-server.cjs`
- Trusted test entry: existing `AXM_TEST_MODE=1` `/api/test/set` route
- Seats: two human seats (`Mike`, `Errol`)
- Visual backend: `BROWSER_PRIMARY`
- Viewport: 1280 × 720 CSS pixels, device pixel ratio 1.25
- Ready-gate route: shared screen, `/?player=screen`
- Forced-choice route: player-one controller, `/?player=p1`
- Capture method: bounded semantic snapshots and repeated screenshots; no
  rolling-video or motion-timing claim
- Physical phone, LAN, gamepad, focus-trap, and screen-reader behavior: not
  tested here

## Observable claims

### Ready gate

- Baseline: `READY TO BIND` and `START RELAY` were visible.
- Action: one focused `Escape` press on the page.
- Observed: `SESSION MENU` appeared above the still-present ready gate and
  focus moved to `RESUME RELAY`.
- Recovery: one focused `Escape` press on `RESUME RELAY` removed only the
  session menu and restored the ready gate.
- Verdict: `PASS`

Selected frame SHA-256 digests:

- baseline: `0427fa5e7eb8ab5c5934a67811cf4e80a488d08ae689fd71c528ccec782a41c3`
- session menu: `9d9db508cac4b6aea977aa91da1ab9d41ac8e8afe68825525d36b68fdf5494b5`
- restored gate: `cb65e0f52dd9eda77ee5468e8b20ddcd8456647327a870177e57b1bb499f2736`

### Forced relay choice

- Baseline: `CHOOSE WHAT YOU HAND OVER` exposed Attack and Defense choices.
- Action: one focused `Escape` press on the page.
- Observed: the same session menu appeared above the still-present choice and
  focus moved to `RESUME RELAY`.
- Recovery: one focused `Escape` press on `RESUME RELAY` removed only the
  session menu and restored both choices.
- Completion: clicking `ATTACK NODE` advanced the authoritative runtime to
  combat, swapped the local role to Ward, and removed the blocker.
- Non-blocker check: a subsequent focused `Escape` did not open the session
  menu. Live combat continued, so health changed between those frames.
- Verdict: `PASS`

Selected frame SHA-256 digests:

- baseline: `97c89ad57335126ffb7ad7986806aaf1827aee50da4e738d223b563ceb90b2c1`
- session menu: `a08254db11ab9b137ce65fdf8f80fbbd237d1810bea7c3d27c5bd258652d8200`
- restored choice: `09d3c3b32aeb5e501c2c3cbbefa84c3af3244a929646bae1c8f3eccf88994c61`
- resolved combat: `f9fb789a2583d3de1de13f661c3eb9d49cc386f21c0cb96421284223537a3483`
- inert Escape: `961a283a1001623cd7dc148a0c09dc7d2c6714e11705a63d58d28d4889c8dfd2`

The client-visible diagnostic remained `LOCAL LINK`; its `CLIENT ERROR` and
`MODULE ERROR` sentinel was not triggered. No screenshot files or video chunks
were written; the selected evidence is represented by typed observations and
frame digests only. The in-memory frames were released after sealing and the
browser tab was closed; cleanup is complete.

## Automated checks at capture time

```text
node --test tools/game-hub/game-library/004-relaybound/tests/blocking-overlay-escape.test.js
2 pass · 0 fail

node tests/html-script-syntax-test.js
55 PASS · 0 FAIL
```

Pinned source SHA-256 digests:

- `runtime/relaybound-client.html`: `F7C7F649A7CB958B2C26EB19392CEDEC264E038F0236E509E4CBBEDAFB4DE7A2`
- `tests/blocking-overlay-escape.test.js`: `229770A54C93514125029A86000D90D11C62A9319BE31B7171EE5CDEEB97F28A`

## Remaining seams

- `disconnect_recovery` remains pending.
- `physical_phone_qa` remains pending.
- This evidence does not establish CANON status; Mike Tobi remains the merge
  and canon gate.
