# Verification Report — AXM AI Habitat v0.3.0

## Automated runtime verification

Command:

```text
python tests/verify_build.py
```

Result: **PASS — 13/13 stages**

Validated areas:

1. Python syntax.
2. JSON validity.
3. JavaScript syntax.
4. Non-destructive v0.1-to-v0.3 migration.
5. Local UI, eight rooms, Signal Lounge, CSP, and browser hardening.
6. Bridge-key and exact-origin enforcement.
7. Provider-neutral external seat registration and completion.
8. Voluntary words, face-only signals, explicit silence, mute, source labels, and proof.
9. Deterministic local SVG artifact generation.
10. Sensitive-action permission denial and safe seat release.
11. Multi-room Code Forge relay.
12. Server-authoritative Connect Four.
13. Final state and append-only evidence integrity.

The verifier backs up and restores the runtime. The distributable remained in a clean first-run state after testing.

## Browser render verification

A real headless Chromium session loaded the local Habitat and exercised the new signal flow.

- Title: `AXM AI Habitat · Living Workspace + Signal Language`
- Rooms rendered: **8**
- Avatars rendered: **3**
- Signal history updated: **yes**
- Voluntary demo face: `ᕕ( ᐛ )ᕗ`
- Voluntary demo line: “I have entered the room with extremely official little steps.”
- Console errors observed: **0**
- Page errors observed: **0**
- Preview: `docs/PREVIEW.png`

The demonstrated line is generated only through the clearly labelled deterministic demo responder. It is not claimed as live Mirror output.
