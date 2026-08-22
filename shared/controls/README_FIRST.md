# AXM Shared Controls + AI-Native Port Kit

Version: **0.1.0-portable**  
Status: **WORKING REFERENCE KIT**

This ZIP extracts the reusable control and connected-AI boundary from AXM District Party v0.1.7. It is deliberately independent from the city map, combat, missions, assets, Phaser, and the District Party server.

Use it to give several AXM games the same semantic controls while changing only a small machine-readable profile and the game-side meaning of each intention. The Game Hub now makes the universal Xbox/Brawl input profile the default requirement for party co-op on one shared screen; physical gamepads remain a `human` input source, not a different seat identity. See [PHYSICAL_CONTROLLER_ROUTE.md](PHYSICAL_CONTROLLER_ROUTE.md).

## Included

- Original floating twin-stick browser control with pointer capture, 14% radial dead zone, response curve, and independent thumbs.
- Transport-independent controller runtime with 20 Hz default sending, monotonically increasing sequence numbers, held actions, and reliable rising-edge pulses.
- HTTP JSON transport reference.
- Authoritative host input gate shared by `human` and connected `adapter` seats.
- Optional built-in `ai` identity kept separate and rejected by the external input gate.
- Screen-bounded semantic observation builder for connected AI.
- Connected-AI polling client that receives only its seat observation and sends the same semantic intentions as a human.
- Top-down twin-stick and first-person exploration example profiles.
- Browser feel demo, host example, AI example, JSON schemas, types, documentation, and automated tests.

No third-party art, audio, game assets, cloud service, browser framework, or npm runtime dependency is included.

## Try it

Node.js 18 or newer is recommended.

```sh
npm test
npm run demo
```

Then open:

`http://127.0.0.1:8808/`

The demo never sends data outside the local process. It displays the semantic packets that a game host would receive.

## Port it into another game

1. Copy `src/browser/`, `src/shared/`, and the desired file from `profiles/`.
2. Render two control zones and construct two `AxmVirtualStick` instances.
3. Feed their state to `AxmControllerRuntime`.
4. On the host, route packets through `createSeatInputGate()` before gameplay code reads them.
5. Let the host decide positions, cooldowns, hits, inventory, scores, and every other result.
6. For a connected AI seat, expose only `buildScreenBoundedObservation()` output and accept its actions through the same input gate.

Start with [PORTING_GUIDE.md](PORTING_GUIDE.md). The exact AI boundary is in [AI_NATIVE_CONTRACT.md](AI_NATIVE_CONTRACT.md).

## Controller identities

| Type | Action source | Phone UI | External semantic gate | Built-in bot loop |
| --- | --- | --- | --- | --- |
| `human` | Person | Yes | Yes | No |
| `adapter` | Connected local/cloud AI chosen in the Workshop | No | Yes, same rules as human | No |
| `ai` | Optional game-local state machine | No | No | Yes |

Empty seats remain empty. This kit does not invent substitute players.

## Physical-controller migration

The Hub inherits `axm-universal-xbox-brawl-v0.2.1` for qualifying shared-screen
co-op games. Bloomvale and Relaybound currently consume it. Phone / QR remains
an optional fallback where a game declares it. Games without a migrated
semantic mapping are visibly marked `MAPPING NEEDED`; the shared Controller
Dock and broad hardware proof are not complete. The machine-readable contract
is `PHYSICAL_CONTROLLER_ROUTE.json`.

This is a sparse baseline, not a demand to consume every physical button. A
game maps only the semantic actions it needs, may leave the rest unused, and
may offer keyboard bindings that mirror or extend those actions on PC.

## Honest boundary

Automated tests cover the portable math, mappings, packet sanitation, token and sequence checks, pulse latching, human/adapter parity, Host AI rejection, visibility filtering, and example files. The Hub policy and Bloomvale/Relaybound software integrations are tested separately; broad physical-controller, mixed-party, phone-comfort, and Wi-Fi evidence remains incomplete.
