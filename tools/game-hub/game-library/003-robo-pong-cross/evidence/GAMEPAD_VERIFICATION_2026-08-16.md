# AXM Pong: Cross universal gamepad verification

Status: **TEST / LOGIC + LIVE SIMULATION PASS / PHYSICAL DEVICE HOLD**

Date: 16 August 2026

Profile: `axm-universal-xbox-brawl-v0.2.1`

## Implemented contract

- Standard browser gamepad indexes 0-3 stay bound to P1-P4.
- P1/P2 use left-stick X or D-pad left/right for their horizontal edges.
- P3/P4 use left-stick Y or D-pad up/down for their vertical edges.
- A or right trigger starts, uses power, and rematches; Menu pauses/resumes.
- Only matching human participant seats accept shared-screen gamepad input.
  AI, adapter, and unused seats remain under their existing authorities.
- A 750 ms shared-screen heartbeat renews the server's 2.5-second controller
  lease so held input cannot expire mid-move.
- Unsupported mappings, blocked seats, and disconnect fallback are visible in
  the top-bar status stack without covering the arena.

## Scripted evidence

- `node neon-cross-selftest.cjs`: PASS, including horizontal/vertical stick and
  D-pad orientation, dead zone, A/RT/Menu edges, non-standard rejection,
  manifest/runtime agreement, heartbeat wiring, static asset delivery, and the
  existing 3/4-seat authoritative match/adapter/disconnect scenarios.
- `node tools/game-hub/game-package-verifier.js`: PASS for 19 games with
  0 failures and 39 preserved warnings. Pong Cross's missing-mapping warning
  is closed; `physical_gamepad_qa` remains pending.
- `node tools/game-hub/universal-control-policy-selftest.js`: PASS.

## Live browser evidence

Visual backend: **BROWSER_PRIMARY**. Viewport: 1280×720 shared screen.
Repeated still frames were used because no rolling-video hand was needed for
these settled input states.

Baseline: the normal route rendered Cathedral Cross with the setup controls,
an unobstructed arena, `No gamepads detected · keyboard/phones ready`, the
universal profile in semantic state, and the QA panel hidden.

The explicitly labeled `?gamepadQa=1` harness then exercised the actual browser
polling and authoritative HTTP input loop:

1. `Connect P1 + P3` produced `2 gamepads ready · P1 / P3`.
2. P1 A closed the setup overlay and started a running match.
3. P1 horizontal positive input moved its paddle from x=500 to x=848; P3
   vertical positive input moved its paddle from y=500 to y=848.
4. After another 3.2 seconds—longer than the server's 2.5-second lease—both
   `controllerConnected` values remained true, proving heartbeat renewal.
5. The unattended match reached a visible `GAMMA WINS` outcome; P1 A rematched.
6. A second P1 A activated its power with `readyIn=6258` and `active=true`.
7. Menu changed the pause button to `RESUME`; a second press restored `PAUSE`.
8. A non-standard P1 pad produced `1 gamepad needs standard mapping`; disconnect
   restored `No gamepads detected · keyboard/phones ready`.
9. In a mixed Human/Adapter/AI roster, the same simulated P1/P3 connection
   produced `1 gamepad ready · P1 · P3 not assigned to human seats`. P3 input
   emitted no gamepad activity and the server retained `kind=ai` with
   `controllerConnected=null`.
10. A final normal-route reload hid the QA panel and left its simulation marker
    absent.

The harness remained visibly labeled `Logic/browser QA only · not
physical-device evidence` throughout.

## Visual receipt

- Claim: edge-relative multi-seat gamepad mapping reaches the authoritative
  runtime without obscuring the arena or crossing seat authority.
- Baseline/action/settled evidence: recorded above from normal, two-human-pad,
  unsupported/disconnected, outcome/replay, and mixed-authority states.
- Verdict: **PASS** for logic and live browser integration.
- Named seam: `PHYSICAL_GAMEPAD_QA_PENDING`.
- Buffer digest: not applicable; no video buffer or retained screenshot file
  was created.
- Temporary paths deleted: none created.
- Cleanup complete: yes; browser tab and local verification server were closed.

## Unproved boundary

No physical controller was attached. USB/Bluetooth enumeration, real pad order,
simultaneous-device feel, vibration, unplug/replug, Steam Input translation,
and couch-distance readability remain **UNRUN**. This receipt cannot clear the
physical-controller Steam gate.
