# Renderer previews

These PNG files were generated from the actual local Canvas renderer, chunk JSON, city-art profile and selected runtime assets. They are QA evidence, not separate concept art and not runtime dependencies.

`preview-sha256.txt` records the byte-identical result of two consecutive frozen-clock preview runs. The injected clock applies only to the QA harness; live gameplay animation keeps the browser clock.

Regenerate when the optional local `@napi-rs/canvas` build dependency is available:

```sh
npm run art:preview
```

Gameplay does not require that package or these PNG files.

Current v0.8 evidence: `city-visual-adventure-v0.8.0.png` is an actual renderer frame showing evening atmosphere, deeper city blocks, active storefronts and optional-activity breadcrumbs.

Retained QA views:

- `city-presentation-before-v0.2.9.png` — live 1870 × 1037 exterior gameplay baseline from the failed v0.2.9 treatment.
- `city-presentation-after-v0.3.0.png` — same live session, party camera, exterior position, and 1870 × 1037 viewport after the streetscape repair.
- `tilburg-city-overview.png` — complete city foundation.
- `tilburg-centre-art-pass.png` — central route and landmark treatment.
- `party-house-art-pass.png` — Party House and nearby city dressing.
- `open-venue-shells.png` — both empty venue floors, real door openings and player scale.
- `user-landmark-reeshof.png` — corner cafe aligned to existing Reeshof collision.
- `user-landmark-north-ring.png` — corner shop-house aligned to existing North Ring collision.
- `user-landmark-east-ring.png` — apartment block aligned to existing Moerenburg collision.
- `user-landmark-south-gate.png` — row houses aligned to existing South Gate collision.
- `city-minimap-ui.png` and `city-full-map-ui.png` — shared-screen map treatments.
- `user-art-runtime-contact-sheet.png` — derived QA montage of the seven most relevant runtime views; not a separately rendered scene.
