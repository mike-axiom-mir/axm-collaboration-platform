# Lumenwake blocking-overlay Escape receipt

Status: `TEST`

This receipt verifies one bounded claim: on the production Lumenwake shared
screen, Escape bridges the authoritative ready gate and the live run to a
reversible local session menu. It does not canonize the package.

## Evidence boundary

- Production client: `runtime/lumenwake-client.html`
- Production runtime: `runtime/lumenwake-server.cjs`
- Route: `/?room=AXM1&player=screen`
- Runtime: one default Human seat on loopback port 18954
- Visual backend: `BROWSER_PRIMARY`
- Viewport: 1280 × 720 CSS pixels
- Renderer: Workshop-local Three.js r160 path; `world3d` computed opacity 1
- Capture method: bounded DOM observations, server `/state` samples, and
  repeated screenshots
- Rolling-frame capability `visual.capture.ephemeral-rolling-buffer/v1` was
  absent from the available tool surface. No frame-cadence or motion-timing
  claim is made.
- Phone, LAN, gamepad, result-phase, screen-reader, and Game Hub launch behavior
  were not tested in this slice.

## Ready-gate claim

The baseline showed `READY TO WAKE`, `WAITING FOR START`, the route selector,
and `START SHARED RUN`. The phase blocker occupied 1240 × 696.8 CSS pixels.

One focused Escape opened `SESSION MENU`, moved focus to
`RETURN TO READY GATE`, and exposed the boundary text `NO START, RESTART, MAP,
OR PAUSE AUTHORITY`. A second focused Escape removed only the session menu and
restored the original ready gate.

All three server samples retained:

```text
phase=ready
map=aurora-basin
createdAt=1786879003589
startAt=null
endsAt=null
```

Selected frame SHA-256 digests:

- baseline ready gate: `716a4780893f0a6a627d1abc160a72853dd930e44fc967c959619752c9ca4436`
- ready session menu: `e62e50906bc92a720083c6769d5d17e16637a72f5ddd84a8aa1e17336021de81`
- restored ready gate: `69748857a22cf6f95936e9ccdd2bf838b33d3ccd32910223d0f63e4cb499b837`

Verdict: `PASS`

## Active-run claim

Only the explicit `START SHARED RUN` click advanced the runtime. The browser
showed the countdown and then the unobstructed local Three.js arena.

One focused Escape during active play opened `RUN MENU`, moved focus to
`RETURN TO RUN`, and stated that the server-authoritative world remained live.
While the menu stayed open, `/state.now` advanced from `1786879135427` to
`1786879154881`. The phase remained `running`; `map=aurora-basin`,
`createdAt=1786879003589`, `startAt=1786879115395`, and
`endsAt=1786879325420` did not change. The player coordinates remained neutral
at `(50, 23)`, consistent with the menu's bounded input neutralization.

A second focused Escape removed only the session menu. The live arena returned
with the same run identity, `state.now=1786879169167`, and wave 2 visible.
The final health sample reported `runtime.ok=true` and `lastTickError=null`.

Selected frame SHA-256 digests:

- explicit countdown: `432a155598373dff65c80f8f57bfde12cb0d8844af87dad0a987fb9ee1e6b8e6`
- baseline active run: `1050900aca48cdf20101369d98c3dd0214684dda88bee957a997911bfaeaa089`
- active run menu: `a119e0e3a55864a767955b2b4b6bbbc1ffc36056ac7610d7eae639fb95144a02`
- restored active run: `1a86fdbf7eee620646c7b32b119bf0e40bd93ee2511436d42d88fbaf03122eaa`

Verdict: `PASS`

## Automated checks at capture time

```text
node tools/game-hub/game-library/006-lumenwake/tests/blocking-overlay-escape.test.js
PASS

node tools/game-hub/game-library/006-lumenwake/selftest.js
PASS

node tests/html-script-syntax-test.js
55 PASS · 0 FAIL
```

Pinned source SHA-256 digests:

- `runtime/lumenwake-client.html`: `6F18902CD28113872479AC2EC30410EE6BA00A444388E1258C947393D707C5BD`
- `tests/blocking-overlay-escape.test.js`: `89E8FA9FC9E1864A8EB5294FFBE4C938EE968BB7E6D30EDDC0D5F78912296AA8`

No screenshot files or video chunks were retained. The in-memory PNG buffers
were released, the browser tab was closed, and the loopback test server was
stopped after capture.

## Workshop checkpoint after sealing

All ten checks required by the repository `AGENTS.md` completed with exit 0:

```text
node verify.js
node hub/hub-selftest.js
node hub/route-selftest.js
node hub/graft-selftest.js
node hub/skin-selftest.js
node hub/verify-plus.js
node tests/html-script-syntax-test.js
node tests/tool-forge-package-test.js
node tools/agent-tool-forge/selftest.js
node tools/evidence-desk/selftest.js
```

The checkpoint remained honestly limited: `node verify.js` reported
`0 FAIL · 25 warn`, and the verification spine reported
`VERIFIED_WITH_LIMITS`. The warnings are open evidence gaps, not hidden test
failures.

## Remaining seams

- `disconnect_recovery` remains pending.
- `physical_phone_qa` remains pending.
- This evidence does not establish `CANON`; Mike Tobi remains the merge and
  canon gate.
