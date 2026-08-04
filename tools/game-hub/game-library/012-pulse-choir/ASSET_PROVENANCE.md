# Asset provenance

Pulse Choir uses no downloaded or third-party art, audio, fonts, shaders, or runtime services.

- Players, beats, hazards, particles, stage lighting, and UI marks are procedural Canvas/CSS shapes authored for this prototype.
- Audio cues are local Web Audio oscillators generated at runtime after user interaction.
- The visual contract uses color plus shape, label, motion, and position so color is not the only gameplay signal.
- The deterministic simulation seed is declared in `game.manifest.json` and the runtime state.

## V2 arena backdrop

- File: `runtime/assets/pulse-choir-arena-v2.png`
- Created: 2026-07-28 with the built-in OpenAI image generation tool.
- Use: project-bound lobby and arena atmosphere beneath authoritative Canvas entities.
- Prompt intent: a wide top-down three-quarter cosmic television studio and rhythm-game stage with a clean central playfield, perimeter speakers and audience lights, no characters, UI, text, logos, or watermark.
- The generated source remains in the local Codex generated-images store; the project consumes the copied, versioned file above.

Third-party licenses: none.
