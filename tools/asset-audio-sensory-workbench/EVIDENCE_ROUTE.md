# Asset audio sensory evidence route

Status: **TEST**

Visual backend: `BROWSER_PRIMARY`. No Windows fallback was needed. The active
browser exposes visibility, viewport and page-asset capabilities but not
`visual.capture.ephemeral-rolling-buffer/v1`; therefore playback pacing and
dropout claims remain `UNKNOWN`. Repeated screenshots were ephemeral tool
outputs. No temporary recording or screenshot file was created or retained.

## Machine and bridge claims

### `AUDIO-HAND-CREATE-EDIT`

- claim: the public Asset Hand route creates and edits a four-artifact audio
  result.
- kind: deterministic behavior / transport.
- risk: medium.
- pass condition: create is READY/PASS; edit consumes the recipe source and
  replaces recipe, WAV, analysis, verification and result digest.
- primary surface: real loopback API calling the real CommonJS hand.
- counterevidence: missing provider, incompatible brief, stale artifacts, or
  unchanged WAV after a frequency edit.
- observed evidence: create returned 520 Hz source, result `94d818ff`, WAV SHA
  `e032…d65`; edit to 700 Hz returned result `6fa7f196`, WAV SHA `012a…e46f`,
  and all four expected artifact IDs. A later live browser run changed result
  `b9c4c11f → 2def2b91` with the same WAV SHA transition.
- verdict: **PASS**.
- named seam: none within the bounded TEST route.

### `AUDIO-WAV-TECHNICAL`

- claim: the delivery is genuine canonical mono 44100 Hz signed PCM16 WAV.
- kind: static structure / deterministic behavior.
- risk: medium.
- pass condition: RIFF/WAVE header, PCM16 format, channel/rate/frame/duration
  cross-checks and full SHA binding pass.
- primary surface: browser-independent core decode plus machine hand's second
  local decoder/analysis.
- counterevidence: malformed chunks, non-PCM16 data, or analysis/SHA mismatch.
- observed evidence: real initial result decoded as 44100 Hz, one channel,
  2646 frames, 0.060 s; analysis and verification SHA fields matched WAV
  metadata. Focused selftests reject malformed WAV.
- verdict: **PASS** for local technical structure.
- named seam: external independent conformance remains `UNKNOWN`.

### `AUDIO-HOST-BOUNDARY`

- claim: the tool-local host is loopback-bounded, origin/body-limited, has no
  filesystem-write path and degrades when the hand is absent.
- kind: authorization / transport / failure recovery.
- risk: medium.
- pass condition: bind is 127.0.0.1; same-origin JSON route works; evil origin
  and wrong content type fail; missing hand reports DEGRADED.
- primary surface: `server-selftest.js` plus live degraded browser run.
- counterevidence: non-loopback bind, accepted foreign origin, write API, or UI
  pretending READY without a provider.
- observed evidence: selftest passed loopback health, create/edit, fresh source
  digest, origin/type refusal and degraded mode. A separate missing-hand host at
  port 8792 rendered `DEGRADED`, `UNAVAILABLE`, `READ-ONLY / DEGRADED`, disabled
  play/review and retained the serialized-result loader with zero console logs.
- verdict: **PASS**.
- named seam: `CONTRACT-AUDIO-HOST-BRIDGE-001` closed at TEST.

## Human surface claims

### `AUDIO-WAVEFORM-VISIBLE`

- claim: the human receives a PCM-derived waveform rather than decorative art.
- kind: visual appearance / deterministic behavior.
- risk: low.
- pass condition: decoded WAV produces visible envelope bars and declared
  sample/channel/duration facts with no waiting overlay.
- primary surface: live browser screenshot and DOM/runtime state.
- counterevidence: blank panel, decorative fixed curve, stale facts or overlay.
- observed evidence: 320 `.wave-bar` elements rendered; waiting overlay was
  hidden; facts read `44100 Hz · 1 ch · 0.060 s`; screenshot showed the decaying
  square-wave candidate. Exact range steps displayed 0.005 attack and 0.45 gain.
- verdict: **PASS**.
- named seam: none.

### `AUDIO-PLAYBACK-TRANSPORT`

- claim: a user gesture starts the current WAV and browser transport reaches
  its declared endpoint.
- kind: interaction journey / timing.
- risk: medium.
- pass condition: play request is accepted, media reaches readyState 4 and
  currentTime/drawn playhead advance to the 0.060 s endpoint without error.
- primary surface: live browser click and media-element/runtime state.
- counterevidence: rejected play promise, media error, stuck time, wrong source.
- observed evidence: Play current transitioned to Pause, then currentTime
  reached `0.06`, displayed `0:00.060`, `ended:true`, `paused:true`, readyState 4;
  no console errors. Keyboard Space repeated the journey and enabled the review
  control only after the current `playing` observation.
- verdict: **PASS** for browser transport/decode.
- named seam: physical audibility, device identity, pacing/dropouts are not
  proved by this result.

### `AUDIO-AB-COMPARE`

- claim: A/B changes both the selected source and visible waveform.
- kind: interaction journey / visual appearance.
- risk: low.
- pass condition: A selects original, B selects current, labels/play controls
  follow, and waveform probes differ after a source edit.
- primary surface: live browser interaction and SVG attribute probes.
- counterevidence: label-only toggle or both seats playing the same delivery.
- observed evidence: after 520 → 700 Hz regeneration, switching to A changed
  the first twelve waveform probes, selected `A · ORIGINAL`, and changed the
  control to `Play original`; Alt+A and Alt+B also selected the correct seat.
- verdict: **PASS**.
- named seam: human preference between A/B remains a human judgment.

### `AUDIO-EDIT-REGENERATION-CONTINUITY`

- claim: a human source edit regenerates all derived truth and stales the old
  judgment only after successful binding.
- kind: interaction / deterministic behavior / persistence within session.
- risk: medium.
- pass condition: committed edit changes recipe/result/WAV, regenerates all four
  artifacts, clears current receipt and appends stale history; failed edit keeps
  the still-current receipt.
- primary surface: live browser journey plus core transactional selftest.
- counterevidence: in-place WAV mutation, unchanged SHA, erased judgment, or
  failed request invalidating a still-current receipt.
- observed evidence: synthetic `REVISE` fixture was current before edit. A 700
  Hz commit changed result and WAV SHA, displayed `CHANGED`, reported four
  regenerated artifacts, disabled receipt download and preserved `1 stale
  judgment`. Core selftest proves cancel preserves current review and successful
  bind stales it.
- verdict: **PASS**.
- named seam: session history is not automatically persisted across reload.

### `AUDIO-LISTENER-SOURCE-SEPARATION`

- claim: listening preferences invalidate the judgment without changing audio
  source truth.
- kind: deterministic state behavior.
- risk: medium.
- pass condition: listener digest changes; result, recipe and WAV SHA do not;
  old review becomes stale.
- primary surface: live browser state plus core selftest.
- counterevidence: volume/rate/contrast mutates machine artifacts or review
  remains current under different conditions.
- observed evidence: volume `0.75 → 0.4` changed listener digest
  `fnv1a32:ca75aa2e → fnv1a32:df3577f4`; result `b9c4c11f`, recipe `244e2500`
  and WAV SHA stayed identical; review cleared and one stale judgment remained.
- verdict: **PASS**.
- named seam: actual output route remains browser-default-unverified.

### `AUDIO-HIGH-CONTRAST-RESPONSIVE`

- claim: the review surface remains visible at high contrast and mobile width.
- kind: visual appearance / interaction journey.
- risk: medium.
- pass condition: waveform has strong foreground/background contrast; 390×844
  layout has no horizontal overflow and controls fit the viewport.
- primary surface: live screenshots and computed layout/style.
- counterevidence: clipping, hidden controls, overflow or indistinguishable wave.
- observed evidence: high contrast produced black background and RGB
  `255,237,74` waveform. At 390×844, document width was 375 within a 390 viewport,
  horizontal overflow was false, stage width 359.2 px and transport width
  268.8 px. The page collapsed to one column.
- verdict: **PASS** for the observed viewports.
- named seam: screen-reader and assistive-technology conformance remain UNKNOWN.

### `AUDIO-REVIEW-RECEIPT`

- claim: the UI can bind a non-promoting report to exact machine and listening
  conditions without fabricating a hearing claim.
- kind: interaction / authorization / human judgment.
- risk: high.
- pass condition: current playback is required; ACCEPT additionally requires
  explicit heard-as-presented; receipt includes WAV SHA/listener digest and false
  authority/device/acoustic claims.
- primary surface: core assertions and synthetic browser interaction.
- counterevidence: review before playback, stale receipt download, missing SHA,
  or promotion/audibility inferred from technical PASS.
- observed evidence: before current playback the button is disabled. A synthetic
  reviewer `browser-automation-fixture` recorded `REVISE/UNCERTAIN` with
  `heard_as_presented:false`; receipt became available. Source/listener changes
  disabled it and preserved history. No synthetic ACCEPT is retained as human
  evidence.
- verdict: **PASS** for receipt mechanics and boundaries.
- named seam: Mike's real listening/aesthetic judgment remains **UNKNOWN / HUMAN REQUIRED**.

## Unknown claims and missing hands

### `AUDIO-PACING-DROPOUTS`

- claim: playback clock pacing is smooth and no samples/dropouts are missed.
- kind: timing / performance.
- primary surface required: bounded timestamped rolling audio/video observation
  plus media timing/decoded sample telemetry.
- observed evidence: unavailable; the browser exposes no ephemeral rolling
  buffer capability.
- verdict: **UNKNOWN**.
- named seam: `EVIDENCE-AUDIO-PACING-001` /
  `visual.capture.ephemeral-rolling-buffer/v1`.

### `AUDIO-PHYSICAL-AUDIBILITY-DEVICE`

- claim: the named physical device emitted the exact WAV and a person heard it.
- kind: device / physical evidence / human judgment.
- primary surface required: authorized device identity, acoustic observation and
  explicit human report tied to WAV SHA/listener digest.
- observed evidence: browser transport only; no device or acoustic capture.
- verdict: **UNKNOWN**.
- named seam: `EVIDENCE-AUDIO-DEVICE-001` and
  `asset.audio.audibility.physical.verify`.

### `AUDIO-EXTERNAL-CONFORMANCE`

- claim: an implementation independent of AXM accepts the delivery as conforming
  WAV and reproduces declared facts.
- kind: independent technical validation.
- observed evidence: two local AXM modules agree; that is not external evidence.
- verdict: **UNKNOWN**.
- named seam: `EVIDENCE-AUDIO-EXTERNAL-CONFORMANCE-001`.

## Visual receipt summary

```text
surface / route: http://127.0.0.1:8791/ and degraded fixture :8792
visual backend: BROWSER_PRIMARY
viewports: normal 1280-wide surface; explicit mobile 390×844
observed sequence: READY → play → endpoint → synthetic REVISE → edit/regenerate → stale history; listener change → stale history; high contrast; A/B; degraded host
verdict: PASS for declared visual/interaction claims; UNKNOWN for pacing, physical device, acoustics and actual human taste
rolling buffer: unavailable
buffer digest: unavailable (no buffer created)
temporary paths deleted: none created
cleanup complete: yes
next cheapest test: Mike listens to one exact SHA-bound WAV and records a real review; separately add authorized device/acoustic evidence if physical proof is required
```
