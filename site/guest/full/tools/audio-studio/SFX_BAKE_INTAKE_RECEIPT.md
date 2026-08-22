# SFX Bake intake receipt

- Source: local Opus export `exports/sfx-bake/`
- Source script SHA-256: `A0FC88E2844F282D5E9F83C731EE39DA7176B8BB67337BB7C55050990F6637D3`
- Source README SHA-256: `F785686EA97661874F1826DC42E7FAF25996B85CD2CFB9241140BE7BEECABED2`
- Source status: DRAFT / TEST, preserved unchanged
- Fit: complementary headless back half for the existing Sound Lab
- Existing input contract: `axm.audio.sound/v1`
- Governed service: `shared/audio-sfx-bake/`
- Audio Studio adapter: `tools/audio-studio/sfx-bake.js`
- Output: PCM 16-bit, 44.1 kHz, mono WAV bytes plus an unreviewed receipt
- Determinism: same parameters and seed produce identical bytes
- Explicitly not claimed: Web Audio sample identity, human listening, quality approval, automatic publication
- File writes: caller-controlled only
