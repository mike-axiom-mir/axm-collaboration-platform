# Brace Room universal gamepad verification

Status: **TEST / LOGIC + LIVE SIMULATION PASS / PHYSICAL DEVICE HOLD**

Date: 16 August 2026

Profile: `axm-universal-xbox-brawl-v0.2.1`

## Implemented contract

- Stable browser gamepad indexes 0-3 map to P1-P4.
- Left stick or D-pad maps to two-axis movement.
- A or right trigger maps to start, the station action, and replay.
- Menu maps to pause/resume.
- Neutral gamepads do not suppress keyboard or joined-phone input. The
  strongest movement axis wins and action edges are merged once per press.
- Non-standard mappings are rejected visibly; disconnect returns the HUD to
  `No gamepads detected · keyboard/phone ready`.

## Scripted evidence

- `npm test`: PASS — 18/18 core simulations, 24 gamepad contract checks, and
  25 HTTP/relay checks.
- `node tools/game-hub/game-package-verifier.js`: PASS for all 19 games with
  0 failures and 40 preserved warnings. Brace Room's universal-mapping warning
  is closed; `physical_gamepad_qa` remains pending.
- `node tools/game-hub/universal-control-policy-selftest.js`: PASS.

## Live browser evidence

The normal route first showed the universal mapping guide and
`No gamepads detected · keyboard/phone ready`. The explicitly labeled
`?gamepadQa=1` harness then supplied a simulated standard pad to the actual
browser input loop. The panel remained visibly marked `Logic/browser QA only ·
not physical-device evidence` throughout.

Observed action sequence:

1. Connect standard: HUD changed to `1 gamepad ready · P1` and exposed the
   expected profile identifier.
2. Press A: the setup overlay closed and a running session began; the runtime
   recorded `lastGamepadSeat=p1` and `lastGamepadInput=action`.
3. Toggle left-stick right: the server observation moved P1 from
   `x=237.30704937084005` to `x=443.96054937084114` while Y stayed
   `289.90222738734116`.
4. Press Menu: the pause overlay became visible; a second press resumed play.
5. Connect unsupported: HUD changed to
   `1 gamepad needs standard mapping · fallback ready` with ready count 0.
6. Disconnect: HUD returned to
   `No gamepads detected · keyboard/phone ready` with unsupported count 0.
7. Reconnect and press A after hull loss: a fresh run began at hull 100 and
   09:00, proving the replay path.

## Unproved boundary

No physical controller was attached. USB/Bluetooth enumeration, controller
identity/order across reconnect, two-pad assignment, stick feel, trigger feel,
and real-device disconnect/reconnect remain **UNRUN**. This receipt must not be
used to clear the physical-device Steam gate.
