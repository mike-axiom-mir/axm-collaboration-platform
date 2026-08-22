# AXM Asset Audio Sensory Workbench

Status: **TEST** · installed: `false` · promoted: `false` · canonical: `false`

This tool closes the human side of AXM's bounded deterministic-audio seam. It
consumes the public `deterministic-audio-fabric` Asset Hand result, renders the
actual PCM16 WAV as a waveform, provides user-gesture playback and A/B
comparison, sends allowlisted recipe edits back through the exact Node Asset
Hand route, and emits non-promoting machine and human receipts.

It is not Audio Studio and does not contain a competing synthesizer. Audio
Studio remains the broader creative workspace. This tool is the narrow
truth/evidence surface that binds one exact machine candidate to one exact
listening state and human report.

## Trusted local entry point

From `<AXM_WORKSHOP>`:

```powershell
node tools/asset-audio-sensory-workbench/server.js
```

Then open `http://127.0.0.1:8791/`.

The server binds only `127.0.0.1`, serves this leaf, accepts same-origin JSON,
limits request bodies to 1 MiB, calls the public CommonJS Asset Hand route, and
does not write files. It refuses cross-origin POSTs. If the registered hand is
missing, the UI enters an explicit read-only/degraded state and may still load
a user-selected serialized result.

## Exact machine route

Create:

```js
Hands.create("deterministic-audio-fabric", brief, { seed });
```

Edit uses the same route with `operation_mode: "edit"` and one whole
`axm.deterministic-audio-recipe/v1` source artifact. The bridge recomputes the
transport digest instead of forwarding the old artifact digest. Every accepted
edit replaces all four artifacts together:

1. editable canonical recipe JSON;
2. immutable genuine PCM16 WAV;
3. immutable technical analysis JSON;
4. immutable technical verification JSON.

The WAV display and listening receipt bind the full byte SHA-256 from
`artifact.metadata.sha256`, not the Asset Hand's shorter transport/change
detector digest.

## Human controls

- A/B original versus current candidate;
- play/pause, restart, scrub and keyboard Space;
- `Alt+A` / `Alt+B` A/B selection;
- PCM-derived waveform envelope and zoom;
- volume, playback rate, loop, mute and high contrast;
- allowlisted kind, waveform, frequency, sweep, duration, attack, gain, noise,
  filter and seed edits;
- reset through the same regeneration route;
- explicit `ACCEPT_FOR_TEST`, `REVISE` or `REJECT` judgment;
- JSON machine patch, serialized result, WAV and review downloads.

Listener changes do not change recipe/result/WAV truth. Source or listener
changes make an existing review stale and preserve it in append-only session
history. Failed regeneration is transactional: the still-current review is
not invalidated unless a new machine result is successfully bound.

## Listening truth

The browser records current-WAV media-element events only after a playback
attempt. `ACCEPT_FOR_TEST` additionally requires the human to check the explicit
heard-as-presented statement. A receipt binds:

- result and canonical recipe digests;
- WAV artifact digest and full WAV SHA-256;
- analysis and verification digests;
- listener state and `listener_state_digest`;
- matching browser playback observations;
- the human report and notes.

That receipt still sets physical-device and physical-audibility verification
to `false`. Browser transport cannot identify speakers/headphones, prove room
sound, certify no dropouts, establish accessibility conformance, promote the
asset, or replace Mike Tobi's merge/canon gate.

## Focused checks

```powershell
node tools/asset-audio-sensory-workbench/selftest.js
node tools/asset-audio-sensory-workbench/server-selftest.js
node shared/deterministic-audio-fabric/selftest.js
node shared/asset-hands/deterministic-audio-fabric-selftest.js
node shared/deterministic-audio-fabric/sensory-handoff-selftest.js
```

Live browser evidence is separate from these script checks and is recorded in
`EVIDENCE_ROUTE.md`.

## Remaining gaps

- physical audible-output/acoustic confirmation;
- exact output-device identity and device behavior;
- playback pacing/dropout proof (no ephemeral rolling-buffer hand available);
- screen-reader/assistive-technology conformance;
- external independent WAV conformance;
- a real human listening/aesthetic decision for each candidate.

These are typed evidence or human seats, not reasons to relabel technical PASS
as finished quality.
