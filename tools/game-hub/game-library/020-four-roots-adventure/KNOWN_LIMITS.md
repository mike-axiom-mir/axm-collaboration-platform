# Known limits

- `TEST`, not CANON; human taste and pacing review continues.
- Single-player only.
- Keyboard, pointer, and visible-button input only; gamepad and phone controller
  support are not advertised.
- No physical phone, gamepad, or assistive-technology device QA has been run.
- No audio, voiced dialogue, combat, procedural questing, or 3D world.
- The trailer is deliberately silent with visible text and WebVTT captions.
  Its gameplay images are reconstructed from deterministic native-engine replay
  states; they are not browser screen capture, live player input, audio,
  voice-over, a cinematic capture pipeline, or a public marketing claim.
- Saves are bound to this exact content digest. A content change starts a fresh
  state instead of pretending old progress is compatible.
- The content digest binds canonical UTF-8 JSON with LF line endings so an
  ordinary Windows checkout cannot break save lineage through CRLF conversion.
- Public direct-reuse rights remain unresolved; Mike authorized internal
  Workshop `TEST` use only.
- The trailer route is local review infrastructure. Its renderer and player
  have no publication action, and public distribution remains `HOLD`.
- The runtime is a reviewed native shell, not a general repaired executor and
  not evidence that arbitrary uploaded code is safe to run.
- The replay proves exact state reconstruction for this one reviewed engine and
  recipe. It does not prove control feel, frame pacing, GPU performance, or that
  arbitrary games already expose compatible replay contracts.
