# AXM Game Night twin-stick controller

## Implemented v0.1.7 proof

District Party now uses an original reusable twin-stick phone controller designed for local Game Night modules:

- A floating left stick sends movement intentions.
- A floating right stick sends a separate aim vector.
- Releasing the right stick sends one host-latched fire pulse.
- Tapping the right area fires using the actor's last authoritative facing.
- Both sticks use independent pointer capture, so two thumbs work simultaneously.
- A 14% radial dead zone prevents touch drift.
- A gentle response curve preserves slow precision while still reaching full movement.
- The phone submits at 20 Hz while the authoritative city remains at 30 simulation ticks per second.
- A four-tick host fire buffer prevents a shot released just before cooldown completion from being silently lost.
- A quick **INVENTORY** tap preserves the inventory action; a 650 ms hold sends one party-scoped `mapToggle` presentation pulse instead.

The controller does not copy another game's art, branding, layout or assets. It uses the common twin-stick interaction pattern with an original AXM interface.

## District Party mapping

| Context | Left stick | Right stick |
| --- | --- | --- |
| On foot | Move/strafe | Aim; release to fire |
| Driver | Steer and throttle/reverse | Release to fire forward |
| Passenger | No vehicle authority | Aim independently; release to fire |
| Mission/results menu | Select up/down | Disabled |
| Inventory open | Disabled | Disabled |

Buttons remain for context action, a forward-fire accessibility fallback, dash/accelerate and brake/reverse. The temporary phone layout labels **HOLD · MAP** on the Inventory button. Keyboard testing uses WASD for movement, arrows for aim, Space for held fire, E for action, I for inventory and M on the shared screen for the map.

## Reuse contract

The reusable browser math and pointer implementation is `client/controller/axm-game-night-controls.js`. The machine-readable contract is `data/controller-profile.json`.

Games may remap the meaning of generic intentions, but should retain these boundaries:

- `moveX`/`moveY` and `aimX`/`aimY` are separately normalized vectors.
- `fire` is a rising-edge pulse; `attack` remains a legacy/keyboard hold field.
- `mapToggle` is a rising-edge presentation pulse and never carries a desired map mode or gameplay state.
- The controller sends intention only.
- The host decides facing, cooldown, ammunition, projectile creation, hits and damage.
- A party screen never imports or instantiates the controller module.
- Seat token, room and session validation remain outside the reusable stick module.

## AI-native boundary

The same profile is machine-readable for connected AI. A Foundation `adapter` seat receives an `axm-semantic-input-v1` binding instead of a phone URL. It submits the same vectors, buttons, token and monotonically increasing sequence through `/api/input`; it cannot set coordinates or report hits.

Its observation comes from `/api/adapter-observation`, not the raw host world. That endpoint exposes the semantic equivalent of its party screen and controller HUD: camera bounds, visible entities/map features, ally corner cards, public mission/territory indicators and its own status. Off-screen opponents and host-only AI/input internals are removed. See `AI_NATIVE_SEAT_CONTRACT.md`.

The optional game-local Host AI remains controller type `ai`. It may generate intentions internally, but it is never inserted into an empty slot unless the host explicitly enables **Fill unused seats with Host AI** or selects a Host AI seat.

## Honest verification boundary

Automated tests verify radial math, protocol sanitation, multi-vector host behavior, quick-release latching, map-pulse party isolation, cooldown buffering, passenger aiming, local module loading and static two-stick markup. Live browser verification covers the controller label and party-screen toggle transport. Actual long-press comfort, different phone aspect ratios, touch sampling and Wi-Fi latency still require physical-device testing.

## Future hardware track

The separate [Game Night controller hardware future idea](../../../../../docs/roadmaps/GAME_NIGHT_CONTROLLER_HARDWARE_FUTURE_IDEA.md) records passive-touch, direct USB-C and Bluetooth HID research routes. It is a conceptual product track, not implemented controller behavior. The current touch controller and its existing semantic input contract remain the working baseline until physical prototypes, phone compatibility and multi-player Game Night use have been tested and approved.
