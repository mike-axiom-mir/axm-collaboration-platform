# Briarfront launch-surface and local-renderer receipt

`TEST EVIDENCE · BROWSER-OBSERVED WITH LIMITS · NOT CANON`

Observed 2026-08-16 from the production Briarfront server on loopback port
18953. The server was launched directly from `runtime/briarfront-server.cjs`.
No Game Hub registry, Foundation file, or preserved Grafthold source was changed
or promoted.

## Bounded visual observation

- claim: the production shared-screen and player-one launch routes enter active
  play without a blocking overlay, and Escape does not create one.
- surface / route: `/?player=screen` and `/?player=p1`.
- visual backend and fallback reason: `BROWSER_PRIMARY`; no fallback used.
- viewport / device / seat: 1280x720 desktop browser; shared screen and P1.
- baseline evidence: both routes visibly rendered the live low-poly forest.
  Read-only DOM geometry found zero visible, pointer-active, non-canvas elements
  covering at least 80 percent of the viewport. P1 exposed the Move stick,
  Pierce, Small Mob, Big Mob, and Aim/Fire stick immediately.
- action: one focused Escape keypress on each route.
- expected visible change: none, because the production client has no blocking
  start, pause, modal, or consent overlay.
- observed sequence: each route remained in active play after Escape. The
  shared screen still exposed no interactive blocker. P1 retained the same five
  controls and the same `controller` body state.
- typed observation: `{shared:{blockersBefore:0,blockersAfter:0},
  player:{blockersBefore:0,blockersAfter:0,controlsBefore:5,controlsAfter:5},
  viewport:{width:1280,height:720}}`.
- verdict: `PASS` for the bounded no-blocking-overlay claim.
- named seam: the separately served preserved file
  `runtime/grafthold-source.html` does contain its original click-to-enter
  overlay. It is not either production launch client and is outside this claim.
- buffer digest: selected PNG frame SHA-256 values were
  `4b93b92b9f5ee950b29a235576a27e5864e7578d3352ffcdacc3326f92581e92`
  (shared before),
  `3e7c7a96aab28fcb5a54c2504dd00cf5563acfd2130624bf3887c962453f4a33`
  (shared after Escape),
  `dbd8972e43aa4f5738aa0513160a675de019ad70cf0a4c027d35ea2a93ce660d`
  (P1 before), and
  `2aa71d91444d4dcdf7ba7f88aa84c7641fc741ecc9ced5d80ba1265fb2dc73f0`
  (P1 after Escape).
- temporary paths deleted: no filesystem video or screenshot path was created;
  the four bounded in-memory PNG buffers were released after their digests and
  typed observations were recorded.
- cleanup complete: yes.
- next cheapest test: physical-phone QA remains separate; it is not implied by
  this desktop observation.

The browser did not expose
`visual.capture.ephemeral-rolling-buffer/v1`. Repeated screenshots were enough
for this non-temporal overlay claim, but no animation cadence or continuous
frame claim is made. The capability comparison was `DEGRADED` only because
that optional rolling-buffer capability was absent; rendered launch, DOM
geometry, Escape input, and local static transport were all `READY`.

## Native evidence route

| Claim | Kind / risk | Pass condition | Observed evidence | Counterevidence | Verdict |
| --- | --- | --- | --- | --- | --- |
| Production launch has no blocking overlay | Visual appearance / medium | Both declared launch routes visibly enter play with no viewport blocker | Live frames plus DOM geometry on shared screen and P1 | A start, pause, consent, or modal layer intercepts the route | PASS |
| Escape is inert when no blocker exists | Interaction journey / medium | One focused Escape preserves the live view and P1 controls | Before/action/settled screenshots, DOM state, and semantic snapshots | Escape opens a blocker, removes controls, or leaves a blank/stuck view | PASS |
| Three.js is served locally | Transport + static structure / medium | Launch HTML contains no HTTP(S) asset URL and the same-origin vendor route returns the pinned module | `/vendor/three.module.js` returned 200, JavaScript content type, and 1,272,972 bytes; client selftest asserts the route and absence of outside URLs | Any CDN request is required for the active renderer | PASS |
| Simulation remains live through the observation | Deterministic runtime behavior / low | Server phase stays running and tick advances | Phase stayed `running`; tick advanced from 4691 to 4698 across 250 ms | Phase stalls, server exits, or tick does not advance | PASS |

## Limits

This receipt does not prove physical-phone layout, touch ergonomics, reconnect
recovery, sustained performance, continuous animation cadence, adversarial LAN
behavior, human acceptance, publication readiness, or CANON status.
