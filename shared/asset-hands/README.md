# AXM Asset Hands v2.5

Asset Hands are modular executable capabilities shared by Workshop modules.
They are not identities, agents, permissions or claims of artistic judgment.

A hand declares a versioned `axm.asset-hand/v2` descriptor. In addition to its
outputs and understood target canvases, v2 declares operation modes, canvas
models, typed source inputs, mutability, permissions, network policy, known
losses, portability, validation, rollback and implementation status. A module
supplies an `axm.asset-brief/v1`, an `axm.target-canvas/v1`, optional bounded
`axm.asset-source-artifact/v1` inputs and its host capabilities. New hands can
register without changing Studio, Asset Fabric or a later host. Legacy v1 hand
descriptors and saved Asset Fabric v1 records remain readable and are normalized
into the stricter v2 runtime shape.

Hands are software capabilities, not miniature identities. A skill can teach an
AI when and how to use a capability; a hand is the executable, testable module
that any compatible host can call. The same hand can therefore serve Studio,
Asset Fabric and future software without copying an AI-specific prompt.

## Target Canvas Contract

The target canvas is separate from the file container. It describes the actual
environment or material: screen, UI, game world, print, paper, fabric, wood,
metal, another physical object, 3D surface or an additive audio/device canvas.
It carries dimensions and units, colour requirements, material/tool constraints,
spatial and temporal semantics, accessibility, behaviour, performance budgets
and intended use.
The canonical standalone validator is `target-canvas.schema.json`; the runtime
normalizer in `target-canvas.js` emits the same `axm.target-canvas/v1` shape.

Compatibility is decided before creation. Canvas requirements therefore shape
the recipe and geometry rather than being applied as a conversion afterwards.
The old pixel `brief.canvas` remains as a compatibility view for existing SVG
providers, while `brief.target_canvas` is the authoritative contract.

Built-in creation providers:

- Vector Form — scalable screen, UI and game symbols.
- Surface & Pattern — seamless screen and game-world tiles.
- Native Raster Texture — direct bounded PNG pixels and editable procedural
  recipes for screen and game-world surfaces.
- UI Component — responsive and interactive interface components.
- Pixel & Sprite — pixel grids, spritesheets and timing metadata.
- Layered Composition — screen compositions and Studio draw packets.
- Print Layout Preview — millimetre and bleed-aware sRGB layout proofs that
  explicitly remain non-press-ready.
- Fabric Repeat — physical textile repeats with material behaviour metadata.
- Physical Mark — engraving/cutting SVG, DXF and tooling specifications.
- Paper & Fabric Cut Layout — kerf-aware SVG, DXF and operator specifications.
- Production Print — deterministic DeviceCMYK PDF bytes with target-derived trim,
  bleed, crop marks, minimum stroke and an editable print document.
- Animated Raster — CRC-validated APNG animation plus an editable procedural
  frame recipe.
- KTX2 / Basis Texture Delivery — pinned ETC1S/BasisLZ compression with real
  mip chains, GPU-memory receipts, independent container checks and decoder
  transcode proof.
- Theme Token — Visual Kernel semantic JSON tokens, CSS variables and a
  contrast-checked preview.
- Layout & Responsive — editable responsive layout contracts, deterministic
  CSS and a geometry-derived preview.
- Inspect & Codegen — read-only structural inspection of typed JSON, CSS, SVG,
  PNG/APNG, PDF, GLB, OTIO, MaterialX, DXF, OBJ or text sources, with
  source-digest verification.
- Parametric Mesh — real triangulated OBJ and glTF 2.0 GLB plus an editable
  Spatial Studio project and geometry-derived wireframe preview.
- Material & Shader — MaterialX 1.38 standard-surface source, editable material
  graph and matching glTF PBR preview scene.
- Timeline & Sequencing — frame-accurate Film & Motion project, loss-declared
  AXM EDL, OpenTimelineIO document and a static timeline proof.
- Wide-colour Raster — ICC-bearing Display P3/linear-sRGB raster delivery,
  high bit depth and an explicitly gamut-mapped sRGB preview.
- PDF/X Press Production — PDF/X output intent, press-profile binding and
  conformance receipt kept separate from the ordinary DeviceCMYK PDF hand.
- UV & Material Baking — UV layout, tangent checks and canvas-derived material
  channel maps with source-mesh binding.
- CNC Toolpath Simulation — bounded toolpath and collision/bounds simulation;
  machine export remains independently approved and operator gated.
- Animated Web Delivery — genuine animated WebP/GIF containers, timing and
  independent frame/container inspection.
- Final Video Encoder — genuine bounded video container generation with frame,
  duration, audio-policy and independent container validation receipts.
- Accessible Document — tagged document and EPUB-oriented source, reading
  order, alt text, language and accessibility validation.
- Font Shaping & Localization — pinned HarfBuzz/Noto shaping, fallback,
  bidirectional runs and localization-overflow receipts.
- Rigged & Animated 3D — real glTF/GLB skin, joint, inverse-bind and animation
  data with independent structural validation.
- Renderer Material Parity — glTF metallic-roughness and MaterialX
  standard-surface reference renders with measurable linear-light diffs.
- OpenUSD Scene Composition — real USDA reference/payload/variant layers and
  CRC/alignment-checked package-relative USDZ archives.
- Procedural Geometry Graph — allowlisted acyclic geometry DAGs, deterministic
  content caching and integrity-bound real OBJ/GLB bakes.
- Spatial Collision & Navigation — distinct non-render collision triangles and
  navigation polygons with obstacle, adjacency and connectivity validation.
- Audio, MIDI & Notation — genuine Standard MIDI File 1, MusicXML 4.0 and an
  accessible keyboard-labelled device/MIDI control surface.
- Native DCC / Engine Bridge — permission-gated, version-checked, dual-approved
  and rollback-bound transactions for installed Blender, Godot, Unity, Unreal
  or FreeCAD host adapters. The shared hand never executes native writes itself.
- Asset Finishing — explicit reviewed SVG-to-raster derivation through the
  isolated output engine.

The shared Visual Kernel in `../visual-kernel/` defines three deterministic
semantic profiles (dark, light and high contrast), their token schema, CSS
mapping and contrast checks. Theme and layout hands consume this common visual
language without gaining authority to apply a theme to a host automatically.

The shared workbench at `shared/asset-hands/index.html` can run alone or be
embedded. Pressing **Send to host** is explicit; creation never publishes,
promotes or writes into a game package automatically.

## Results and honest failure

The common `axm.asset-hand-result/v1` preserves the target canvas,
machine-readable `axm.asset-creation-recipe/v1`, preview descriptor,
`axm.asset-validation-receipt/v1`, editable artifacts, hand/engine identity,
hashes and candidate-only authority. Artifacts retain their real MIME and format;
PDF, raster, KTX2, JSON, DXF, OBJ, GLB, MaterialX and OTIO are never parsed as SVG.

If no executable hand understands a medium, the family status is
`UNSUPPORTED_CANVAS`. If the medium is known but no hand can honour every
operation, source input, constraint, output and recipe requirement, it is
`MISSING_HAND`. Static OBJ and GLB scene delivery, MaterialX standard-surface
authoring, APNG animation, ETC1S/BasisLZ KTX2 delivery, DeviceCMYK PDF and OTIO
timeline interchange, UV baking, rigged animation, PDF/X output-intent
production, animated WebP, bounded final-video encoding, OpenUSD/USDZ, MIDI,
MusicXML and permission-gated native bridge transactions are now executable.
The curated planned-gap catalog is currently empty: all fifteen admitted gaps
were closed through real providers and validators. This does not mean every
possible request is supported. UASTC/HDR KTX2, audio waveform synthesis,
advanced notation, cryptographically signed native adapters and independent
inspection of proprietary native application state remain explicit provider
limits. Any request outside installed canvas/output/constraint support still
returns `MISSING_HAND` or `UNSUPPORTED_CANVAS` rather than a substitute.

`diagnose()` emits an `axm.asset-hand-gap-report/v1` with the exact missing
kind, canvas profile, constraints, outputs, recipe formats and operations. This
lets a later module or Hand Forge scaffold the needed capability without
guessing. Declared canvas limits are checked before creation so bounded raster
hands cannot be routed into unsafe allocations.

Lossy outputs must declare their known losses. Read-only inspection verifies the
source envelope is unchanged. Permission or network requirements are compared
with the host before execution, and no hand may silently widen its authority.

Each provider exports `{ descriptor, create(context) }` or the additive async
form `{ descriptor, createAsync(context) }`. Browser providers
append themselves to `AXMAssetHandProviders`; Node providers export the same
object. Runtime `register()` remains available for future modular hands.

Machine-readable JSON artifacts are checked after generation through
`artifact-schema-catalog.js`. The standalone schema files listed in
`service.contract.json` are the portable contract surface for other modules and
future hand implementations.

## Reference validators

The Node-side registry in `reference-validators/` provides a second evidence
boundary for finished PDF, MusicXML, OpenUSD/USDZ and EPUB artifacts. It matches
the exact claim, artifact MIME, target canvas and installed verifier, emits
SHA-256-bound `axm.reference-validation-receipt/v1` records, and groups them in
an optional `axm.asset-verification-envelope/v1`. Asset Fabric, Studio and the
shared handoff broker preserve that envelope when present; old state does not
require it.

Structural corroboration is not relabelled as external certification. Official
MusicXML XSD, OpenUSD and EPUBCheck providers return `MISSING_VALIDATOR` until
their separately managed runtime is configured. See
`reference-validators/README.md` for the provider matrix and configuration.

The completed admission record and the next hardening/interoperability roadmap
are maintained in `ROADMAP.md`.
