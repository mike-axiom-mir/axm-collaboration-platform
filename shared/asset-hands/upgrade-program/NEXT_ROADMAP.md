# Asset Hands next roadmap

## Current release truth

The fifty-upgrade build is complete at the **executable contract** layer:

- 50/50 modular upgrade descriptors are installed.
- 206 stable capability identifiers are covered.
- All 50 map to a real implementation module and declared operations.
- Target Canvas, required outputs, recipes, constraints and operations are
  matched before execution.
- Multi-capability requests receive a deterministic dependency-ordered plan.
- Every invocation carries artifacts, the original canvas, a replayable recipe,
  preview when one exists, a validation receipt, provenance and hand identity.
- The existing 36 provider registry, saved state and governance remain intact.

Rank 8, `asset.performance.benchmark-receipts`, now has a runtime-observed
v1.1 receipt engine: separate warmups, per-repetition samples, distribution
statistics, host-bound runtime labels, bounded failure evidence, budget checks,
tamper verification and a portable JSON Schema. It remains `PARTIAL`, not
`READY`: execution is synchronous and in-process, heap use is sampled only at
repetition boundaries, and independent workload-specific review is still
required for production performance claims.

This is not the same as fifty production certifications. On the current local
machine the visible acceptance audit reports:

| Status | Hands | Meaning |
| --- | ---: | --- |
| `MISSING_SUBSTRATE` | 9 | The implementation contract exists, but an exact runtime, independent validator or human/physical proof surface is absent. |
| `REVIEW_REQUIRED` | 41 | The implementation and required local substrate are present, but the declared quality or authority evidence is not yet sufficient for `READY`. |
| `READY` | 0 | Intentionally zero until each program pass condition is actually satisfied. |

Run `auditUpgradeHands()` to produce the current machine-readable truth rather
than copying these counts into another system.

## Release lane for the current GitHub update

1. Ship the upgrade program as **experimental executable infrastructure**.
2. Include the schemas, 50-entry registry, browser-safe read-only service,
   Asset Fabric v0.10 integration and Studio v2.6 handoff.
3. Publish the exact acceptance states; do not describe all fifty as
   production-certified.
4. Keep the 36 existing creation providers separate from the 50 capability
   extensions so old consumers do not change behavior.
5. Keep raw sessions, logs, local paths, runtime tokens and generated private
   evidence outside the public package.
6. Report the repository-wide verifier honestly. In the 2026-07-19 final
   Asset Hands audit snapshot it stops at 47 failures and 30 warnings: the
   failures are missing/incomplete manifests and undeclared `export`
   permissions in other tool lanes, while the focused Asset Hands live,
   completion and upgrade suites pass. Re-run the broad verifier after those
   manifest owners finish; do not publish the older zero-failure claim.

## P0 — external standards and renderer substrate pack

The first pinned, hash-verified, licence-reviewed substrate bundle is now
built. It is an explicit local install, never a source-tree binary bundle or
an automatic application download. Twenty-one exact components pass archive,
installed-file, dependency and live-version probes and expose twenty-two substrate
capabilities.

- Completed: Godot 4.7.1 import, fresh scene process, offscreen frame capture
  and declared frame/texture/draw-call budget receipt. Headless-only mode
  remains a visible visual hold.
- Completed: Blender 5.2.0/Cycles CPU executes the same bounded scene in two
  fresh processes, creates visible PNG frames and editable `.blend` sources,
  reopens all 36,864 RGBA samples and produces matching decoded-pixel digests.
  PNG container-byte variance remains explicitly reported rather than hidden.
- Completed: a separate two-process Blender matrix creates a real AO texture
  bake, deforms a four-vertex fully weighted mesh through a keyed armature and
  bakes a rigid body from Z=3 to the passive floor with identical metrics.
  This exposes texture-baker, rig-runtime and simulation-runtime substrates;
  richer hand-specific maps, retargeting and cloth/hair/destruction evidence
  remain review work.
- Completed: `cross-renderer-runtime` becomes available only as the composition
  of the exact Godot and Blender runtimes. This is runtime availability—not a
  claim of asset-level visual or MaterialX parity.
- Completed: W3C EPUBCheck 5.3 positive/negative corpus and veraPDF 1.30.2
  fresh-process structured validation. A standards-valid PDF/A/UA positive
  corpus is still required before production acceptance.
- Missing: formal independent PDF/X validation.
- Completed: OpenImageIO 3.1.15.0 and OpenEXR 3.4.13 inspection, including
  deliberately unreadable counterexamples.
- Completed: OpenColorIO 2.5.2 with ACES config 4.0.0 / ACES 2 numeric display
  transforms and image-read binding.
- Partial: Khronos glTF Validator passes/rejects a structural corpus and an
  offline renderer is now available; the artifact-bound rendered corpus still
  has to be executed and compared before the hand can become `READY`.
- Partial: KTX 4.4.2 creates and validates KTX2 in the live corpus; the full
  UASTC/HDR multi-target transcode matrix remains open.
- Partial: MaterialX 1.39.5 validates a renderable document and emits fresh
  GLSL and OSL digests. Two independent renderers are now installed, while the
  shared asset/material comparative render matrix remains to be executed.
- Completed substrate: FFmpeg 8.1.2 performs real mux, stream inspection,
  audio/video decode and EBU R128 loudness measurement twice, with malformed
  media rejection. Audible and final-delivery review remain separate.
- Completed substrate: pyembroidery 1.5.1 parses AXM-generated Tajima DST,
  checks command/movement limits, renders deterministic stitch simulations and
  rejects a truncated file. A physical test stitch remains human evidence.
- Completed substrate: the official 3MF Editor 1.0.0 and pinned schemas accept
  a valid AXM package and report critical issues for an invalid unit. AXM
  overrides the beta CLI's disclosed false `Pass` headline from issue records.
- Completed substrate: CadQuery OCP/Open CASCADE 7.9.3.1.1 creates a boolean
  B-rep, exports STEP and editable B-rep, and preserves topology, volume and
  bounds across two fresh reopens. The VTK visualisation surface is not claimed.

The bundle-level acceptance condition now passes: every installed tool reports
its exact version and package digest; a missing, tampered or unreviewed binary
remains unavailable; fixture execution never promotes live conformance. The
individual hand pass conditions above remain independently evidence-gated.

## P1 — human, accessibility and physical proof bench

The next bottleneck is evidence authority, not more algorithms.

- Human visual benchmark receipts for family coherence and promotion.
- Keyboard, focus, reflow, target-size, reduced-motion and assistive-technology
  journeys on real browsers/devices.
- Printed packaging mock-up and formal preflight review.
- Fabric swatches under declared stretch, shrink, grain and colour profiles.
- Garment pattern-maker review and marker-layout inspection.
- Operator-reviewed physical embroidery test stitch; parser and deterministic
  simulation evidence are now available.

Acceptance: receipts bind the exact artifact, hand version, Target Canvas,
criteria and reviewer identity. Machine checks remain separate from human and
operator seats.

## P2 — manufacturing and native creation depth

- Expand the available B-rep/STEP kernel into sheet-metal unfold/refold against
  the same solid and bind a fabrication review.
- Expand official 3MF validation with more conformance-suite profiles and an
  independent library reopen before production promotion.
- Machine-specific CAM postprocessors, stock/fixture simulation and expiring
  human operator approval for bounded dry runs.
- Expand the native adapter SDK only through signed, rollback-capable packages.

Acceptance: no G-code becomes machine-ready from simulation alone; no native
write occurs without exact permissions, approvals, baseline digest and
rollback evidence.

## P3 — high-end 3D, audio and video production

### 3D and worlds

- Expand the available texture-bake substrate to the full high/low normal, AO,
  curvature and packed-map tangent/ray-hit/render-parity corpus.
- Mesh repair, retopology, LOD compression and live distance renders.
- Expand the available rig runtime with retargeted clips, blend shapes, IK/FK,
  root-motion and reviewed visible-mesh inspection.
- Expand the available offline lookdev renderer with AOV recomposition and an
  artifact-bound reference corpus.
- Expand the deterministic rigid-body simulation substrate to particles,
  cloth, hair and destruction with visible cache comparison.
- Real game-world traversal and streaming-budget receipts for world packages.

### Audio

- Use the available independent decoder and loudness meter in digest-bound
  production receipts; add the still-missing audible review surface.
- Official SMF2/MIDI Clip File codec, MIDI-CI negotiation and hardware profiles.

### Video

- Expand the available FFmpeg mux/decode substrate into the requested delivery
  codec matrix, including AV1/Opus where the Target Canvas asks for it.
- Caption stream, colour-finish and loudness receipts bound into delivery.
- Bounded render queue with retry lineage and no success before decoded output
  matches the requested streams, timing and budgets.

## P4 — shared host adoption

The Workshop server now exposes read-only catalog, diagnosis, plan and audit
routes to browser modules. The next safe step is not a generic remote-execution
endpoint. Instead:

1. Define a permission-bounded execution lease per hand and operation.
2. Route heavy/native work through Body Pulse capacity and runtime inventory.
3. Return invocation receipts and artifacts through the existing handoff
   contracts.
4. Add host conformance fixtures for Asset Fabric, Studio, Spatial Studio,
   Film & Motion Studio, Audio Studio, Mirror and one blank future module.
5. Prove all hosts calculate the same route from the same request without
   hand-ID-specific branches.

## Standards anchors

- W3C Design Tokens Format 2025.10:
  <https://www.w3.org/community/reports/design-tokens/CG-FINAL-format-20251028/>
- W3C Design Tokens Resolver 2025.10:
  <https://www.w3.org/community/reports/design-tokens/CG-FINAL-resolver-20251028/>
- W3C Design Tokens Color 2025.10:
  <https://www.w3.org/community/reports/design-tokens/CG-FINAL-color-20251028/>
- MIDI 2.0 Core Specification collection:
  <https://midi.org/midi-2-0-core-specification-collection>
- MIDI Clip File specification:
  <https://midi.org/midi-clip-file-specification-smf-midi-2-0>
- Universal MIDI Packet specification:
  <https://midi.org/universal-midi-packet-ump-and-midi-2-0-protocol-specification>

## Definition of done for a future `READY`

A hand becomes `READY` only when its native proof surface passes, its output and
canvas claims match the actual artifact inventory, independent counterevidence
does not refute the claim, and every required human or operator authority has
approved the exact digest-bound result. Code presence and green fixture tests
alone are never enough.
