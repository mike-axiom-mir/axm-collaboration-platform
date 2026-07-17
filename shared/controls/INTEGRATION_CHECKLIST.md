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

