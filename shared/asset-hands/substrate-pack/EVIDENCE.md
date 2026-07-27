# External substrate pack evidence

Audit date: 2026-07-19. This is public-safe, digest-only evidence. Downloaded archives, installed runtimes, generated projects, frames, process output and private machine paths remain outside the repository.

## Exact local pack

- Lock: `axm.external-substrate-lock/v1` version 1.7.0 for Windows x64.
- Components: 21/21 `READY` after exact source-size, source SHA-256, installed-entrypoint, dependency and live-version probes.
- Compositions: 1/1 `READY`. `cross-renderer-runtime` exists only when both the exact Godot and Blender components are ready.
- Exposed substrates: 22 (`brep-step-kernel`, `cross-renderer-runtime`, `embroidery-parser-or-simulator`, `epubcheck`, `godot-runtime`, `independent-audio-decoder`, `independent-av-decoder`, `khronos-gltf-validator`, `ktx-tools`, `ktx-validator`, `loudness-meter`, `materialx-1.39-runtime`, `official-3mf-validator`, `offline-renderer`, `opencolorio`, `openexr`, `openimageio`, `rig-runtime`, `simulation-runtime`, `texture-baker`, `verapdf`, `video-muxer`).
- Installation: explicit CLI consent only; no automatic application install and no runtime bytes in source.
- Licence boundary: every entry is reviewed for local testing. Blender, FFmpeg, veraPDF, CadQuery OCP and VTK remain local-install-only until a human public-release review confirms redistribution obligations and notices.

The exact versions, upstream release/asset URLs, byte counts, digests, licence sources and dependency graph are authoritative in `substrates.lock.json`.

## Live proof surfaces

- EPUBCheck: valid EPUB 3 passes and a deliberately damaged counterexample fails.
- veraPDF: a non-PDF/A document is rejected honestly. This does not provide PDF/X validation.
- Khronos glTF Validator: valid glTF 2 passes and an invalid counterexample fails.
- Khronos KTX: a real KTX2 is created and validated; invalid bytes fail.
- OpenImageIO/OpenEXR: PNG and generated EXR reopen successfully; invalid image bytes fail.
- OpenColorIO + ACES: a numeric colour transform runs and produces changed, finite samples bound to the image receipt.
- MaterialX: a material validates and produces GLSL/OSL source digests; malformed MaterialX fails.
- Godot 4.7.1: import and fresh scene execution pass. Visual mode produces a frame plus texture, viewport, frame-time, memory and draw-call facts; headless-only mode remains a visible visual hold.
- Blender 5.2.0 Stable/Cycles: two fresh CPU processes render the same bounded 96×96 recipe, create editable `.blend` sources, reopen exactly 36,864 RGBA floating-point samples and produce matching decoded-pixel digests. PNG container-byte variance is reported separately.
- Blender capability matrix: two fresh processes produce matching AO bake pixels, matching weighted armature deformation and matching baked rigid-body motion from Z=3 to Z≈0.375; both runs create editable `.blend` projects.
- Blender native adapter: the signed package imports an Asset Hand GLB, saves a `.blend`, reopens it in another Blender process, verifies the exact executable digest and rolls back to the baseline. Blender 5.3+ remains refused until tested.
- FFmpeg 8.1.2: two fresh matrices mux one-second FFV1/PCM Matroska media, inspect both streams, decode exactly ten RGB frames and 48,000 mono samples, measure −21.1 LUFS / −18.1 dBFS true peak, reproduce decoded digests and reject malformed media.
- pyembroidery 1.5.1: AXM's DST output reopens as 72 records with 68 stitch commands, two jumps, one colour change and a 1.0 mm maximum movement; two simulations match and a truncated counterexample fails.
- 3MF Consortium Editor 1.0.0: the valid package has zero issues. The invalid `parsec` unit produces two critical `SC_000` issues even though the beta CLI's headline incorrectly says `Pass`; the AXM wrapper rejects from issue records and preserves the known-bug flag.
- CadQuery OCP/Open CASCADE 7.9.3.1.1: a holed boolean solid produces one solid, seven faces, thirty edges and 11,214.6018366 mm³ volume. STEP and editable B-rep sources are created; two fresh reopens preserve topology, volume and bounds, while truncated STEP fails.

All temporary jobs are removed after bounded receipts are built. The final machine-local job inventory was empty.

## Capability truth after staging

The 50-upgrade audit reports:

| State | Count | Meaning |
| --- | ---: | --- |
| `MISSING_SUBSTRATE` | 9 | A required external runtime, formal validator, physical/human proof surface or operator authority is absent. |
| `REVIEW_REQUIRED` | 41 | Required local substrates exist, but the hand-specific production pass condition is not yet fully evidenced. |
| `READY` | 0 | No hand is pre-promoted from code presence or a green fixture. |

The offline renderer and Godot+Blender composition moved ranks 12, 19, 21 and 43 from missing substrate to review required. The Blender capability matrix moved ranks 40, 42 and 44; FFmpeg moved ranks 47 and 50; embroidery moved rank 35; official 3MF moved rank 38; and the B-rep/STEP kernel moved ranks 36 and 37. None became production-ready automatically.

## Named remaining seams

- No honest formal independent PDF/X validator was found. veraPDF is not relabelled as PDF/X.
- Cross-renderer runtime availability does not prove glTF or MaterialX parity; the same artifact/material must still be rendered and compared in both engines.
- KTX UASTC/HDR multi-target delivery remains a matrix-level review.
- Human accessibility, visual, printed, fabric, garment and operator approvals remain external seats.
- CAM still requires a machine-specific postprocessor and human approval.
- Retopology/LOD still requires mesh repair, mesh compression and live visual review as one bound evidence surface.
- Audible playback review and the official SMF2/MIDI Clip codec remain visible gaps. Audio decoding, loudness measurement and AV mux/decode are available substrates, not replacements for listening or hardware evidence.

## Verification record

The following focused surfaces pass:

- substrate-pack deterministic tamper/missing/anti-spoof tests;
- full live substrate corpus with 21 exact components;
- 50-hand upgrade registry and service tests;
- Asset Fabric old-state and receipt attachment tests;
- Studio SVG/raster handoff and nested receipt tests;
- Asset Hands completion suite;
- Native Bridge 5.2-positive/5.3-negative tests;
- real Blender 5.2 import, fresh reopen and rollback test;
- all 89 local schema references.

The repository-wide `npm test` is not green in this shared snapshot: `verify.js` reports 47 unrelated module-manifest failures and 30 declared QA warnings before later suites run. This evidence therefore claims focused Asset Hands completion only, not repository-wide completion.
