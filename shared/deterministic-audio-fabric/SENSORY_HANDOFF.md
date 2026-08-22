# Deterministic Audio Machine-to-Human Handoff

Machine hand: `deterministic-audio-fabric` v1.0.0 (`TEST`, candidate-only).
Human lane owner: `tools/asset-audio-sensory-workbench/**` (separate task).

## Public Node route

Create uses exactly:

```js
Hands.create("deterministic-audio-fabric", brief, { seed })
```

Edit/regenerate uses the same route with `brief.operation_mode: "edit"` and one
recipe source artifact. The local human host must bridge the returned recipe
artifact's `metadata.schema` to source `content_schema` (the core normalizer does
this when `metadata.schema` is retained). The provider and leaf are CommonJS.

## Result fields the human surface may consume

- `status`: `READY` only when all technical/provider/postcondition checks pass.
- `validation_receipt.status`: `PASS` or `HOLD`; this is technical status only.
- `digest`: stable core result digest for the same normalized brief and output
  artifacts. It is an FNV-1a change detector, not a signature.
- `preview`: `{artifactId:"deterministic-audio-wav", mime:"audio/wav",
  format:"WAV", available:true}`. `available` means payload present, not played.
- `creation_recipe.parameters`: source-use flag and source digest plus recipe,
  source recipe digest, WAV, analysis, verification, duration, frame, channel
  and sample-rate fields.
- `measures`: byte size and technical audio metrics/digests.
- `notes`: machine boundary language; do not translate it into approval.

Exact artifacts:

| id | role | MIME | `metadata.schema` | editable | payload |
| --- | --- | --- | --- | --- | --- |
| `deterministic-audio-recipe` | `editable-audio-recipe` | `application/json` | `axm.deterministic-audio-recipe/v1` | yes | `text` |
| `deterministic-audio-wav` | `pcm16-wav-delivery` | `audio/wav` | `audio/wav` | no | `dataUrl` |
| `deterministic-audio-analysis` | `technical-audio-analysis` | `application/json` | `axm.deterministic-audio-analysis/v1` | no | `text` |
| `deterministic-audio-verification` | `technical-verification` | `application/json` | `axm.deterministic-audio-verification/v1` | no | `text` |

The WAV payload starts `data:audio/wav;base64,` and decodes to canonical mono
44100 Hz signed PCM16 RIFF/WAVE. WAV `metadata.sha256` is the full byte SHA-256.
Recipe/analysis/verification `metadata.digest` values are full canonical JSON
SHA-256 digests. Artifact `digest` and top-level result `digest` are separate
core change detectors; the UI must not substitute one digest family for another.
When source text changes, the bridge must omit or recompute the transport
artifact `digest` rather than forwarding the old artifact digest. The provider
also records a freshly calculated `sourceRecipeDigest` from canonical content.

## Safe round-trip edits

The human surface may edit only the canonical recipe and must send the whole
recipe back. Allowlisted fields are:

- `id` and `seed`;
- tone: `kind`, `wave`, `freq`, `sweep`, `freqEnd`, `dur`, `attack`, `gain`,
  `noise`, and, when noise is enabled, `noiseGain`/`filterFreq`;
- noise: `kind`, `dur`, `gain`, `filterFreq`.

Bounds are enforced by the runtime: duration 0.01–2 seconds, gains above zero
through 1, frequencies 1–20000 Hz, filters 20–20000 Hz, and the four named
waveforms. `sample_rate_hz:44100`, `channels:1`, and
`sample_format:"pcm-s16le"` are fixed engine constraints. Authority must remain
`installed:false`, `promoted:false`, `canonical:false`, and
`human_listening_review_required:true`.

Never edit the WAV, analysis, or verification in place. Every accepted recipe
edit must call the public route and replace all four artifacts as one result.
Archive any earlier listening judgment as stale when the source recipe/WAV,
listener/viewer state, or playback implementation changes.

## Claims this lane must not make

The machine result cannot claim successful audible playback, browser decode,
user-gesture satisfaction, playback clock/frame pacing, no dropouts, device
output, WebAudio sample identity, review-surface accessibility, human listening,
human aesthetic quality, external WAV conformance, approval, installation,
promotion, or canon.

## Cross-lane closure and remaining typed gaps

- `CONTRACT-AUDIO-HOST-BRIDGE-001`: **CLOSED AT TEST** by the separate human
  lane's 127.0.0.1-only, same-origin, 1 MiB-bounded, no-filesystem-write host;
  its independently rerun host selftest passes create/edit and degraded mode.
- `HAND-AUDIO-SENSORY-001`: **CLOSED AT TEST** by
  `tools/asset-audio-sensory-workbench/**` for PCM waveform, user-gesture browser
  transport, A/B, edit/regenerate, listener-state digest, transactional stale
  review history, non-promoting receipt, responsive/high-contrast behavior and
  explicit degraded mode. This does not close the evidence gaps below.
- `EVIDENCE-AUDIO-PLAYBACK-001`: live successful playback/browser decode.
- `EVIDENCE-AUDIO-PACING-001`: playback progress, clock behavior, seeking and
  dropout observation.
- `EVIDENCE-AUDIO-ACCESSIBILITY-001`: keyboard/screen-reader use, visible focus,
  high contrast, zoom, and reduced-motion waveform behavior.
- `EVIDENCE-AUDIO-DEVICE-001`: actual output device behavior.
- `EVIDENCE-AUDIO-HUMAN-APPROVAL-001`: explicit listening/aesthetic judgment
  bound to WAV SHA-256 plus listener/viewer state digest.
- `EVIDENCE-AUDIO-EXTERNAL-CONFORMANCE-001`: external independent WAV validation.

The human receipt may record listening evidence but must remain non-promoting;
it does not upgrade the shared machine receipt or canonize an artifact.
