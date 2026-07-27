# Audio SFX Bake

This is the governed, deterministic back half of Audio Studio's existing Sound Lab. It consumes the existing `axm.audio.sound/v1` parameter contract and returns WAV bytes plus a receipt. It does not replace the browser designer, write files, publish, approve, or claim that its one-pole low-pass output is sample-identical to Web Audio's biquad.

The original Opus export remains unchanged in `exports/sfx-bake/`. This admitted service makes seeded noise reproducible and exposes directed parameter variation for game and CI use.

```js
const SFX = require('./shared/audio-sfx-bake');
const result = SFX.bake({schema: 'axm.audio.sound/v1', params: SFX.PRESETS.coin}, {seed: 7});
// result.wav is a Buffer; the caller must explicitly decide whether and where to write it.
```

Status: **TEST**, not canon. Human listening remains a separate approval gate.
