# Integration checklist

## Shared control surface

- [ ] Import `axm-virtual-stick.mjs` once; do not copy its math into each game.
- [ ] Choose or create one controller profile for the game.
- [ ] Keep the left and right physical zones stable across games where practical.
- [ ] Change labels and semantic mappings through profile data.
- [ ] Disable scrolling, selection, pinch zoom, and long-press menus on the controller page.
- [ ] Keep the phone controller lightweight; do not render the full game there.
- [ ] Give each human controller a host-bound room, session, seat, and token.
- [ ] Stop or neutralize input on blur, disconnect, pause, and session end.

## Authoritative host

- [ ] Route both `human` and `adapter` packets through `createSeatInputGate()`.
- [ ] Reject external packets for built-in `ai` seats.
- [ ] Consume pulse fields once per authoritative simulation event.
- [ ] Let the host own positions, hits, damage, cooldowns, inventory, money, scores, and mission state.
- [ ] Apply request-body and per-seat rate limits in the target server.
- [ ] Expire seat tokens with the session.
- [ ] Never log or display private tokens.
- [ ] Keep shared or spectator screens input-free.

## AI-native seat

- [ ] Create an `adapter` only when selected and ready in the Foundation.
- [ ] Do not auto-fill empty seats.
- [ ] Give the adapter only its own binding and token.
- [ ] Build observations from explicit public projections.
- [ ] Filter spatial entities by the seat’s actual shared-screen camera.
- [ ] Exclude raw world state and host internals.
- [ ] Apply the same disconnect timeout as a human seat unless the game deliberately documents another rule.
- [ ] Verify the adapter cannot control a different seat by changing a label or query parameter.

## Target test gate

- [ ] Unit-test each profile’s vector and button mapping.
- [ ] Test stale sequence and wrong-token rejection.
- [ ] Test quick pulse delivery across network/simulation tick timing.
- [ ] Test two simultaneous thumbs on representative phones.
- [ ] Test Wi-Fi latency and reconnect behavior.
- [ ] Test off-screen opponent non-disclosure.
- [ ] Test the real Game Hub launch and end lifecycle.

## Future physical controller adapter

- [ ] Keep the occupied seat `controllerType` as `human`; record hardware separately as `inputSource`.
- [ ] Poll gamepads only in a host Controller Dock or the individual controller page, never the shared party screen.
- [ ] Require press-any-button seat claiming; do not equate a reusable gamepad index with a player number.
- [ ] Arm a visible claim window, require a new button edge, and confirm before replacing an active input source.
- [ ] Keep exactly one opaque versioned input-source binding active per human seat; reject packets from the previous binding and epoch.
- [ ] Never persist, log, or display a raw browser gamepad identifier as player identity.
- [ ] Auto-map only a standard browser layout; hold non-standard devices for explicit calibration.
- [ ] Map device axes and buttons into `AxmControllerRuntime`; do not bypass the semantic packet gate.
- [ ] Keep device binding profiles separate from game semantic profiles.
- [ ] Use a trigger/button for a gamepad fire pulse; do not inherit phone stick-release firing accidentally.
- [ ] Immediately neutralize vectors and held buttons when the gamepad disconnects.
- [ ] Preserve the human seat, never auto-fill it with AI, and allow return to phone control.
- [ ] Keep Connected AI outside the human hardware selector; `human` to `adapter` is a separate consented authority transition.
- [ ] Prove USB and Bluetooth operation on physical hardware before changing the route status.
