# Relaybound disconnect-recovery receipt

Status: `TEST`

This receipt verifies one bounded claim: the production Relaybound browser
client visibly reports a severed local transport and reconnects to the same
still-running server authority after transport is restored. It does not
canonize the package.

## Evidence boundary

- Production client: `runtime/relaybound-client.html`
- Production server: `runtime/relaybound-server.cjs`
- Trusted fault entry: `tests/disconnect-recovery-browser-harness.js`
- Fault model: a leaf-only local proxy destroyed active requests and rejected
  new proxy traffic; the production server process stayed alive and reachable
  directly throughout the fault
- Seats: two human seats (`Mike`, `Errol`)
- Visual backend: `BROWSER_PRIMARY`
- Route: shared screen, `/?player=screen`
- Viewport: 1280 × 720 CSS pixels, device pixel ratio 1.25
- Capture method: bounded semantic snapshots and repeated screenshots; no
  rolling-video or frame-timing claim

No production route, server behavior, or packaged asset was added or changed
for this evidence.

## Ready-state interruption

- Baseline: `READY TO BIND`, both human seat cards, `START RELAY`, and
  `LOCAL LINK` were visible.
- Authority baseline: phase `ready`, event timestamp `1786877334947`, Attack
  tier 1, Defense tier 1, Mike Edge 80 HP, Errol Ward 130 HP.
- Action: the fault proxy severed the EventSource and rejected polling.
- Offline observation: the unchanged ready surface remained visible and the
  client settled on `RUNTIME OFFLINE`. A proxy `/state` request failed while a
  direct origin `/state` request returned the same authority fields and the
  same event timestamp.
- Recovery observation: after the proxy restored transport, the same ready
  surface returned to `LOCAL LINK`; proxy `/state` again returned the same
  authority fields and event timestamp.
- Recovered-control check: clicking the original `START RELAY` control produced
  `RELAY OPENS IN 3`, then entered visible 3D combat.
- Verdict: `PASS`

Selected frame SHA-256 digests:

- connected ready: `bbcad713c1bd6684609c892d5d0b0d7cd91ce5c85e19645f8a40f7f44975df3c`
- ready offline: `4a86d311014b46974bdeef98e0ed7b2bd21b830056600a4a2144f700c6da3cea`
- ready recovered: `a947ee395c4c16f331f437ad1f0533d745e3564ef3dc1d178305cd939fe25957`
- recovered countdown: `0b36a75cfc9b9d068a214639799ffc9a832243031c0e4650a0358fb4f788a994`
- recovered active play: `f52e57d9f7a780b2e6ad1ea7442dc88ca845a465d468ffafec3650961ca6896e`

## Active-combat interruption

- Baseline: combat was live with both seat cards, enemies, the 3D arena, and
  `LOCAL LINK` visible.
- Action: the same proxy severed transport during combat.
- Offline observation: the last accepted combat frame remained readable and
  the client settled on `RUNTIME OFFLINE`.
- Authority continuity: the direct origin stayed in phase `combat`. Its
  timeline advanced from 10 entries before the fault to 12 while the client
  was offline; the authority event timestamp advanced from `1786877486369` to
  `1786877491867`.
- Recovery observation: after transport restoration, the browser accepted the
  newer combat state and returned to `LOCAL LINK`. The proxy state then exposed
  15 timeline entries and event timestamp `1786877511194`.
- Verdict: `PASS`

Health and event copy changed during this loop because the production combat
simulation continued while transport was unavailable; that change is evidence
of continuous server authority, not byte-equivalent frozen state.

Selected frame SHA-256 digests:

- combat connected: `3569a16fa6a7f611b3182db7df96c00299c2cd000c8292db377e1e8caf81712b`
- combat offline: `e246b87f667e0881c40c116a15ea42ed11b5264717100a253658cae6d625fdc0`
- combat recovered: `9d3b3204a526f994cb72d3c1959b96dd463ff4c26e57e946a63d0f327549d3eb`

The final client-visible diagnostic was `LOCAL LINK`; its `CLIENT ERROR` and
`MODULE ERROR` sentinel was not triggered. No screenshot files or video chunks
were written. The in-memory frames were released, the browser tab was closed,
and both the fault proxy and origin server stopped; cleanup is complete.

## Automated checks at capture time

```text
node --test tools/game-hub/game-library/004-relaybound/tests/disconnect-recovery.test.js
2 pass · 0 fail
```

The integration test independently proves that proxy requests fail during the
fault, direct origin state remains available, restored proxy state matches the
same stable authority fields, and a fresh EventSource packet is received after
recovery.

Pinned source SHA-256 digests:

- `runtime/relaybound-client.html`: `F7C7F649A7CB958B2C26EB19392CEDEC264E038F0236E509E4CBBEDAFB4DE7A2`
- `tests/disconnect-recovery-browser-harness.js`: `29E5259FFD2F2F40AE77E61CD2CEB841FF65E370C2223E9A4A9BC47CD0826363`
- `tests/disconnect-recovery.test.js`: `B62271BA42947E686732438A51D6F11F81644BAB461196B3032CB0906FAF7D33`

## Remaining boundaries

- No physical phone, LAN handoff, gamepad, adapter-seat, server-process crash,
  or process-restart continuity was tested here.
- `physical_phone_qa` remains pending.
- This evidence does not establish CANON status; Mike Tobi remains the merge
  and canon gate.
