# Deterministic Audio Capability Scout

Overall machine route: **READY** for the bounded adapter implemented here.
Implementation status: **TEST** pending human listening/review and Mike Tobi's
merge decision.

## Reuse decision

The Workshop already had the required bounded engines. `audio-sfx-bake` creates
deterministic PCM16 WAV bytes and an honest `RENDERED_UNREVIEWED` receipt.
`audio-production.js` can independently parse those bytes inside the same local
Node process and calculate technical metrics. Building another synthesizer
would have duplicated capability without closing the public Asset Hand seam.

## Typed gaps and route

| Capability | Before | Gap | Route now |
| --- | --- | --- | --- |
| `audio.recipe.canonical-edit` | missing | CONTRACT | New strict bounded recipe schema and normalizer |
| `audio.wav.pcm16.deterministic-render` | engine existed, no public Hand | CONTRACT | Reuse `audio-sfx-bake`; expose through Hand v1.0.0 |
| `audio.wav.local-technical-analyze` | engine existed, no artifact handoff | CONTRACT | Reuse `audio-production.wavDecode/analyze` |
| `audio.wav.repeat-byte-verify` | receipt existed, no adapter replay | EVIDENCE | Repeat render plus exact SHA-256/byte comparison |
| `asset.fabric.sound-effect.route` | missing | HAND | Register `deterministic-audio-fabric` in the Node Asset Hands registry |
| `audio.waveform.sensory-review` | missing | HAND | Remains owned by `tools/asset-audio-sensory-workbench/**` |
| `audio.browser.host-bridge` | missing | CONTRACT | `CONTRACT-AUDIO-HOST-BRIDGE-001`; human lane owns bounded loopback host |
| `audio.audible-playback` | unobserved | EVIDENCE | Human lane must obtain user-gesture playback evidence |
| `audio.playback-pacing` | unobserved | EVIDENCE | Human lane must observe playback clock/progress/dropout behavior |
| `audio.review-accessibility` | unobserved | EVIDENCE | Keyboard, screen-reader, contrast/zoom and reduced-motion checks |
| `audio.human-aesthetic-approval` | absent | EVIDENCE | Explicit listener receipt bound to source and listener/viewer state |

## Honest boundary

This lane proves deterministic source normalization, genuine WAV structure,
local decode, bounded technical metrics, repeat bytes, artifact regeneration,
and candidate authority. The second decoder is another local implementation,
not an external conformance laboratory. Nothing here proves audible playback,
browser/device behavior, playback pacing, accessibility of a review surface,
human listening, aesthetic quality, external WAV conformance, or approval.
