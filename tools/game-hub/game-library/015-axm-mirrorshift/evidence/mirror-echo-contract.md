# MIRRORSHIFT Mirror Echo contract

Schema: `axm.mirror-echo/v2`

V19 added a presentation-only fastest-lap replay for each authored circuit and signal-condition pairing. V20 extends its course identity with the server-selected route direction so a forward trace can never overwrite or replay on a reflection route. The shared-screen client derives bounded pose samples from ordinary authoritative state packets; it sends no new input, adds no server state, changes no packet, and cannot collide, score, collect an item, block a racer, or occupy a seat.

## Capture and playback

- Up to 18 browser-session records cover three circuits by three race variants by two route directions. Nothing is uploaded or persisted after the page session ends.
- Each active racer can contribute a completed lap. A trace begins only from an observed lap boundary, rejects skipped boundaries or insufficient samples, and replaces the course record only when its duration is strictly faster.
- Each trace is capped at 720 pose samples. Long traces compact deterministically by retaining alternating samples and increasing their sampling interval, so memory remains bounded without silently truncating the finish.
- Playback uses linear position/speed interpolation and the shortest heading arc. It repeats only when circuit, signal condition, and route direction all match.
- Mirror Core is excluded because it has no lap contract.

## Player-facing boundary

The echo is a translucent dashed hologram labelled `ECHO // <CHARACTER>`. Lobby, race HUD, results, and the playback toggle call it a fastest-lap replay. The lobby explicitly says `NON-COLLIDING // NOT A FIFTH RACER`. Four authoritative racers remain visible and keep the original equal-stat, catch-up, item, and Flux Guard contracts.

## Verification contract

- `tests/mirror-echo.test.js` covers capture, fastest replacement, shortest-arc interpolation, forward/reflection isolation, session bounds/compaction, battle exclusion, immutable records, unchanged authority packets, and the frozen mechanics.
- `window.__MIRRORSHIFT_ECHO__` plus `data-echo-*` expose schema, status, count, enablement, bounded-capture diagnostics, and playback-frame counts without authority writes.
- A live verification journey must show empty lobby disclosure, first-race seal, results disclosure, rematch HUD/hologram, four real racers still present, a working pause/resume toggle, responsive layout, and no browser errors.

This local pass advances repeatable circuit depth and replay motivation. It does not prove human preference, representative-device cadence, four-phone/router behavior, broader tournament/time-trial breadth, high-cadence motion quality, physical touch quality, or steward approval.
