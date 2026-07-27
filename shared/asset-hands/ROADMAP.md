# Modular Asset Hands roadmap

## Current baseline: completion of the fifteen-hand build

Asset Hands v2.5 has 35 executable creation hands plus the explicit delivery
finisher. The curated visible-gap catalog is empty because all fifteen admitted
hands were implemented, registered and tested:

- production delivery: wide-colour raster, PDF/X press production, UV/material
  baking and CNC/laser toolpath simulation;
- motion, language and publishing: animated web delivery, final video,
  accessible documents, font shaping/localization, rigged animation and
  renderer material parity;
- scenes and procedural systems: OpenUSD/USDZ composition, geometry graphs and
  separate collision/navigation generation;
- new canvases and hosts: MIDI/MusicXML/device surfaces and the permission-gated
  native DCC/engine bridge.

This closes the planned list, not the universe of possible hands. Runtime
diagnosis remains authoritative: an unhandled medium returns
`UNSUPPORTED_CANVAS`; an understood medium with unmet constraints, source type,
output, recipe, capability or permission returns `MISSING_HAND`.

The thirty-fifth provider is the bounded Raster Compositor Hand. It accepts
real PNG sources and a typed composition recipe, applies deterministic sRGB
RGBA8 layers, masks, offsets, 14 blend modes and 13 filters, then emits a real
PNG, editable recipe and SHA-256-bound pixel round-trip receipt. It remains
candidate-only: passing technical checks never grants visual approval or canon.

The additive Universal Component Protocol now supplies a shared composition
root beneath those providers. Its first human surface is Play Composer: a
deterministic, no-AI interface that produces typed component graphs, directed
design branches and ephemeral previews. This widens reuse without weakening the
admission gates below; a graph contract never substitutes for a domain hand or
independent validator.

## Admission gate for every later hand

A later provider becomes installed only after all of these are true:

1. Its engine, dependencies and licences are reviewed and packageable.
2. Its descriptor states exact canvases, constraints, inputs, outputs,
   operations, permissions, network policy, losses and host requirements.
3. Target-canvas constraints change creation itself, not only conversion.
4. It emits genuine requested containers and editable recipes where promised.
5. An independent parser, decoder, simulator or measurable comparison validates
   the result.
6. Budget, malformed-input, tamper and impossible-request tests fail closed.
7. Asset Fabric, Studio and compatible specialist hosts preserve its complete
   target canvas, recipe, validation, provenance and hand identity.
8. Old Asset Fabric and Studio records remain readable.
9. READY, HOLD, MISSING_HAND and UNSUPPORTED_CANVAS stay visibly distinct.
10. Public-safe review finds no secrets, private paths, raw logs or bundled user
    content.

A convincing preview alone never passes this gate.

## Release gate for the current GitHub update

1. Run every portable JSON Schema declared by the live service contract and
   resolve every local reference; never freeze the release gate to a stale
   schema count.
2. Run every hand-focused deterministic/tamper/budget test, including the ten
   completion-wave suites now wired into `npm test`.
3. Run shared hardening and the Asset Fabric, Studio, Spatial Studio, Film &
   Motion Studio, Audio Studio, output and browser syntax suites.
4. Prove old saved Asset Fabric state and existing SVG workflows still load.
5. Confirm raster, PDF, video, audio, toolpath and 3D containers are never
   relabelled or interpreted as SVG.
6. Confirm the native bridge cannot route without its source bundle, installed
   adapter capability, filesystem-write permission and plugin-data permission.
7. Confirm no native command plan survives invalid version, canvas, integrity,
   path, approval or rollback checks.
8. Run the repository's existing public-safety/publish review before upload.

## Next roadmap: make the completed platform easier to trust and extend

### Phase A — registry conformance and capability negotiation

- Generate a machine-readable conformance matrix from every descriptor and
  deterministic test receipt.
- Add descriptor/schema linting so drift fails during development, not only in
  the release suite.
- Add explicit provider supersession/deprecation rules and migration receipts.
- Add capability-negotiation fixtures for Asset Fabric, Studio, Mirror and a
  minimal future host.

Exit: a new host can import the registry, compute honest routes and explain every
rejection without hand-specific code.

### Phase B — real host adapter SDK (reference build complete)

- Completed: a shared installed-adapter registry negotiates application version,
  target canvas, source MIME and the complete operation set, with visible
  `MISSING_NATIVE_ADAPTER`, `MISSING_NATIVE_CAPABILITY` and
  `UNSUPPORTED_CANVAS` results.
- Completed: adapter packages bind identity, capabilities and a fixed entrypoint
  with SHA-256 plus a trusted Ed25519 signature; no private signing key is
  stored in the repository.
- Completed: the Blender 4.2–5.2 reference adapter confines paths to a configured
  workspace, stages an exact GLB, snapshots the baseline, records a write-ahead
  journal, imports through a fixed Python boundary and refuses overwrite.
- Completed: a fresh Blender process reopens the real `.blend` and checks source,
  change, metadata, project, package and target-canvas budget facts before an
  independently verified receipt exists.
- Completed: deterministic tests cover tampering, incompatible canvases, crashes
  before prepare commit and after native save, partial application, post-edit
  rollback blocking and idempotent rollback. The same path passed against the
  official portable Blender 5.2.0 Stable binary after its exact archive and
  executable SHA-256 values matched. Blender 5.3+ remains visibly unsupported.
- Completed: Mirror accepts the adapter only through explicit injection and
  consent; built-in reset never auto-connects or resets the native adapter.

Exit: one native host passes apply, inspect and rollback tests without granting
the shared hand direct application authority. **Exit passed for the Blender
reference adapter.** Expansion to another native application remains a separate
admission decision, not an implied capability.

### Phase C — stronger validators (in progress; reference boundary complete)

- Completed: exact claim + MIME + target-canvas + installed-runtime reference
  validator routing, with SHA-256-bound receipts and visible
  `MISSING_VALIDATOR`, `UNSUPPORTED_ARTIFACT`, `FAIL` and `TOOL_ERROR` states.
- Completed: separate pypdf structural corroboration for tagged PDF and the
  bounded PDF/X profile. These checks do not claim PDF/UA or PDF/X external
  certification.
- Completed: separate lxml structural MusicXML validation and optional official
  W3C MusicXML 4.0 XSD validation. The first authoritative run found and drove
  removal of an invalid per-note `velocity` element.
- Completed: official OpenUSD `UsdUtils.ComplianceChecker` / `usdchecker`
  providers; the real 26.5 runtime passed generated USDZ and rejected a damaged
  package. The pinned Java 21 + W3C EPUBCheck 5.3 substrate now passes a
  generated EPUB and rejects a deliberately damaged publication in separate
  fresh JVM processes.
- Completed: optional verification envelopes survive Asset Fabric, Studio and
  shared handoffs while old saved records remain readable.
- Completed: package-reviewed local veraPDF 1.30.2 execution for PDF/A and
  PDF/UA reports; the bounded tagged PDF is honestly rejected as non-PDF/A.
- Remaining: add standards-valid PDF/A/UA positive corpora and decide whether a
  suitable external PDF/X certification engine can be redistributed or must
  remain an operator-configured verifier.
- Remaining: add perceptual thresholds and renderer matrices to material parity.
- Remaining: add scene-scale stress corpora and fuzzed malformed inputs.
- Remaining: add reproducible benchmark receipts for memory, time and output size.

Exit: important claims are corroborated by an implementation independent of the
writer wherever practical. **Partially passed:** MusicXML, OpenUSD, EPUBCheck,
veraPDF execution and bounded PDF structure now have live second-implementation
evidence; formal PDF/X and positive PDF/A/UA certification corpora remain
visible verifier gaps, and performance/stress work is still open.

### Phase D — next candidate hands, driven by real blocked requests

Candidates are not installed or promised merely by appearing here:

- UASTC/HDR texture delivery and reviewed colour pipelines;
- audio waveform/synthesis and audible playback validation;
- richer notation, MIDI 2.0/UMP and hardware-device mappings;
- advanced CAD/B-rep, CAM posts and robot/display/material canvases;
- signed plugin packages and sandboxed third-party hand execution.

Select the next candidate by blocked real requests, reuse across hosts,
dependency safety, independent validation quality and bounded execution.

## Permanent non-goals

- Hands do not become identities, reviewers or approval seats.
- A preview does not prove print, manufacturing, playback or renderer quality.
- A roadmap entry does not count as installed capability.
- Host integration does not grant publish, promotion or machine-operation
  authority.
- Generalist or lossy fallbacks remain forbidden unless a request explicitly
  opts in and the receipt records the transformation.
- A host-reported result is never described as independently verified unless an
  independent inspection actually ran.
