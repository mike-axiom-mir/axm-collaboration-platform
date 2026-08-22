# Audio asset capability scout

Status: **DEGRADED overall; bounded required route READY**

Requested outcome: AXM can deterministically create and edit a genuine audio
asset through the public Asset Hand layer, let a human inspect/listen/A-B the
exact candidate, preserve machine and listener truth separately, and emit a
non-promoting listening receipt.

The normalized inputs are `capability-requirements.json`,
`capabilities-before.json`, and `capabilities-after.json`. The deterministic
comparator reports:

- before: `BLOCKED`;
- after: every required requirement `READY`;
- overall after: `DEGRADED` only because optional physical-audibility proof is
  still unavailable.

## Reused capabilities

- `shared/audio-sfx-bake`: preserved seeded renderer and PCM16 WAV bytes;
- `shared/asset-hands/upgrade-program/audio-production.js`: second local WAV
  decode/analysis surface;
- Asset Hand v2 create/edit registry and result contracts;
- browser `HTMLMediaElement` for bounded transport observations.

## Built adapters and hands

| Capability | Route | State |
| --- | --- | --- |
| `asset.audio.hand.create-edit` | `deterministic-audio-fabric` v1.0.0 | READY / TEST |
| `asset.audio.bridge.loopback-bounded` | tool-local `server.js`, 127.0.0.1 only | READY / TEST |
| `asset.audio.waveform.visualize` | browser PCM16 envelope | READY / TEST |
| `asset.audio.playback.user-gesture` | current-WAV media-element controls/events | READY / TEST |
| `asset.audio.listener-state.digest` | volume/rate/loop/mute/zoom/contrast/route digest | READY / TEST |
| `asset.audio.review.receipt.nonpromoting` | WAV SHA + listener + playback + report | READY / TEST |

## Remaining typed gap

```text
capability_id: asset.audio.audibility.physical.verify
gap_type: EVIDENCE + SUBSTRATE + HUMAN
purpose: prove that the declared device produced audible sound in the real room
inputs: exact WAV SHA-256, output-device identity, listener state, playback window
outputs: acoustic/device observation receipt tied to those inputs
side_effects: microphone/device access if authorized
permissions_and_consent: explicit human device and microphone consent
resource_budget: bounded one-candidate capture, no retained raw room recording by default
failure_and_recovery: UNKNOWN when device/acoustic evidence is absent; never infer from browser events
compatibility: must not mutate recipe, WAV or machine verification
verification: independent acoustic/device observation plus human report
promotion_gate: Mike Tobi / AXM review remains separate
```

Cheapest next evidence: Mike listens to one exact WAV with the displayed
settings and records a receipt. That can establish a human report, but it still
does not by itself close device identity, acoustic capture, accessibility,
dropout or external-conformance evidence.
