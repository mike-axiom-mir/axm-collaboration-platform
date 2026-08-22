# Capability gap receipt

## Route

READY for a polished local single-player 3D beta. The workspace provides a local Node runtime, a vendored Three.js r160 renderer, Game Hub packaging conventions, writable game-library storage, deterministic Node tests, and live browser verification.

## Satisfied

- `runtime.webgl.local`: vendored Three.js and local server.
- `game.simulation.deterministic`: isolated state and rules in `runtime/game-core.mjs`.
- `state.session.restore`: versioned browser-local save plus planned restart check.
- `visual.capture.live`: in-app browser inspection and screenshot route.
- `visual.upgrade.routes.complete`: all 12 declared upgrades have static route coverage plus an isolated non-saving showcase route.
- `asset.procedural.threejs.modify`: original local scene geometry and materials can be extended without external runtime assets.
- `visual.compare.frames`: bounded repeated browser frames can verify temporal change.
- `ui.render-quality.control`: the Pause dialog exposes Cinematic, Balanced, and Eco profiles.
- `runtime.webgl.quality-adjust`: profiles change pixel-ratio caps, particle draw ranges, visible perimeter lights, and soft shadows.
- `state.setting.persist`: the selected profile survives a same-origin reload in the browser-local settings record.
- `ui.upgrade.inspect`: all 12 installed cards route to named camera views with focus recovery.
- `visual.target.highlight`: a temporary reduced-motion-aware holographic scan identifies the selected scene object.
- `visual.service.outcome-feedback`: manual, automated, angry-loss, and blocked actions have distinct 3D signals plus camera-independent lane-card flashes.
- `visual.vehicle.departure-outcome`: successful and angry customer removals use different outbound paths and flares.
- `ui.motion.reduced`: the player setting holds service feedback as a static read and suppresses service/departure travel cadence.
- `game.advice.deterministic` / `ui.advice.focus-only`: Current Pressure derives a stable bottleneck and only orients camera, focus, highlight, or the non-modal drawer.
- `game.arrival.forecast` / `visual.inbound.vector-3d`: the authoritative spawn clock drives the matching HUD and attraction-to-forecourt signal without random consumption.
- `game.queue.constellation` / `visual.queue.constellations-3d`: current counts and front patience drive three lane-anchored holographic signals without state mutation.
- `game.shift.atmosphere` / `visual.shift.horizon-3d`: the existing day clock drives four HUD/scene atmosphere states and a progress beacon without state mutation or balance changes.
- `game.event.legacy-projection` / `visual.event.consequence-traces-3d`: validated saved event choices drive 17 distinct procedural artifacts across seven authored station anchors without state mutation or balance changes.
- `game.event.reveal-projection` / `visual.event.consequence-reveal-3d`: only the real new-choice path starts the bounded artifact assembly; semantic phase/progress receipts, a compact responsive scale, and a static Reduced Motion branch are live-verified without replaying restored history.
- `game.debt.liberation-projection` / `visual.debt.lien-3d`: authoritative debt drives four deterministic HUD/world stages, zero to six physical claim links, the station lock, and a responsive HUD-only placard fallback without state mutation.
- `visual.debt.payment-release`: the real existing service path carries before/after debt receipts and triggers the final ownership confirmation; full and static Reduced Motion branches are live-verified.
- `game.launch.local`: dedicated health-checked launcher and Game Hub manifest.
- `ui.dialog.keyboard`: semantic blocking dialogs with initial focus, bidirectional Tab wrapping, Escape paths, and focus restoration.

## Degraded

- `balance.human.representative`: deterministic policy smoke test exists; multi-person human data does not.
- `performance.gpu.representative`: live development machine only until representative device telemetry exists.
- `visual.capture.ephemeral-rolling-buffer`: unavailable; bounded repeated screenshots are the declared fallback.
- `visual.mobile.physical`: responsive viewport can be tested; physical phone observation remains pending.
- `accessibility.screenreader.physical`: browser semantics and keyboard behavior are verified; physical assistive-technology behavior is not.

## Missing for future scope

- `network.multiplayer.authority`
- `coop.intent.routing`
- `location.content.additional`
- `save.cloud.roaming`

These gaps do not block the authorized local beta and are not simulated by placeholders.
