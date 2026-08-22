# Human Sensory Surface Handoff

Status: **TEST**. Coordination target: a separate human editing/review surface.
This handoff describes the live `deterministic-animation-fabric` Asset Hand at
version `1.1.0`. It does not install, promote, canonize, or aesthetically
approve any asset. No human-sensory workbench path is owned or changed here.

## Result gate and preview truth

Accept an input only when all of these fields agree:

- `result.schema === "axm.asset-hand-result/v1"`
- `result.hand.id === "deterministic-animation-fabric"`
- `result.hand.version === "1.1.0"`
- `result.status === "READY"` and `result.validation_receipt.status === "PASS"`
- `result.hand.authority === "candidate-only"`

`READY` and `PASS` mean the typed artifact envelope and deterministic checks
passed. They do not mean that the motion played live, held its requested frame
pacing, met accessibility needs, or looked good.

The current preview fields are:

```text
result.previewArtifactId = "deterministic-motion-filmstrip"
result.preview = {
  artifactId: "deterministic-motion-filmstrip",
  mime: "image/svg+xml",
  format: "SVG",
  available: true
}
```

That artifact is a static sample sheet of at most 16 frames. Its
`metadata.static_proof_only` is `true`. A surface must label it **filmstrip** or
**static proof**, never live preview.

## Artifact map

Every item uses the `axm.asset-artifact/v1` envelope. The useful envelope
fields are `id`, `role`, `filename`, `mime`, `format`, `editable`, `text`,
`width`, `height`, `metadata`, and `digest`.

| Exact artifact id | Role | Payload/schema lookup | Edit truth |
| --- | --- | --- | --- |
| `deterministic-motion-composition` | `editable-motion-composition` | JSON; `metadata.schema === axm.deterministic-animation-composition/v1`; `metadata.digest` is the composition digest | Primary round-trip source; edit this for clips, timing, blends and embedded recipes |
| `deterministic-motion-recipe` | `editable-motion-recipe` | JSON; `metadata.schema === axm.deterministic-animation-recipe/v1`; `metadata.digest` is the primary recipe digest | Safe single-recipe round trip; re-import wraps it as a one-layer composition |
| `deterministic-motion-bake` | `fixed-point-motion-bake` | JSON; `metadata.schema === axm.deterministic-animation-bake/v1`; `metadata.digest` is the bake digest | Derived technical truth; inspect or scrub, do not edit |
| `deterministic-motion-css` | `web-motion-adapter` | CSS; `metadata.source_bake_digest`; `metadata.lossy === true` | A downstream override only; it cannot round-trip to the canonical graph |
| `deterministic-motion-atlas-image` | `motion-sprite-atlas-image` | SVG; every frame when emitted; `metadata.exact_frame_coverage === true` | Derived presentation geometry; do not edit as source |
| `deterministic-motion-atlas-manifest` | `motion-sprite-atlas-manifest` | JSON; `metadata.schema === axm.sprite-atlas/v1`; `metadata.source_bake_digest` | Playback input; do not edit as source |
| `deterministic-motion-filmstrip` | `motion-filmstrip-proof` | Static SVG; `metadata.source_bake_digest`; `metadata.static_proof_only === true` | Static review aid only |
| `deterministic-motion-verification` | `technical-verification` | JSON; `metadata.schema === axm.deterministic-animation-verification/v1` | Immutable technical receipt, not sensory or human approval |

An output artifact has no top-level `content_schema`. For JSON artifacts,
resolve it from `artifact.metadata.schema`, with parsed `artifact.text.schema`
as a consistency check. When returning an edit, copy that value into the
required input field `source_artifacts[*].content_schema`. This output-to-input
mapping is deliberate current behavior and must not be guessed from MIME alone.

The two digest families have different scope:

- `artifact.digest` binds the Asset Hand envelope payload, MIME and dimensions.
- `artifact.metadata.digest` and `result.measures.{recipeDigest,compositionDigest,bakeDigest}`
  bind the deterministic fabric's canonical data.

Keep both. Do not substitute one for the other.

## Creation receipt fields to display

`result.creation_recipe` is `axm.asset-creation-recipe/v1`. A review surface
should retain and show at least:

```text
hand.id, hand.version, operation_mode, source_artifact_digests, seed
target_canvas, target_canvas_original, canvas_transformations
parameters.compositionDigest, parameters.recipeDigest, parameters.bakeDigest
parameters.ticksPerSecond, parameters.framesPerSecond, parameters.frameCount
parameters.fixedPointPrecision, parameters.compositionSources
parameters.compositionLayers, parameters.spriteAtlasEmitted
editable, deterministic
```

Also retain `result.digest`, `result.measures`, `result.validation_receipt`, and
the three `authority` objects in the composition/recipe, bake, and verification
payloads. They all remain candidate-only.

## Safe edit and round-trip boundary

Use the composition JSON for multi-clip editing. The schema and compiler accept
these bounded operations:

- Change `presentation.target`, `background`, `fill`, `stroke`, or `shape`.
- Change composition or source-recipe integer timebases only when
  `ticks_per_second` divides exactly by `frames_per_second`, duration contains a
  whole frame count, FPS stays `1..240`, and a bake stays at most 20,000 frames.
- Edit source-recipe data-only `blocks`, `instances`, `nodes`, `tracks`, and
  explicit `events`. Supported nodes are `constant`, `keyframes`, `wave`,
  `noise`, `add`, `multiply`, `clamp`, `remap`, and `abs`.
- Edit layer `order`, trim (`start_tick`, `end_tick`), `source_in_tick`, positive
  rational `rate`, `playback` (`clamp`, `loop`, `ping-pong`), `blend`
  (`replace`, `add`, `multiply`), `weight` (`0..1`), `target_prefix`, and
  property filters.
- Add, remove, or edit composition events explicitly. Source events are not
  implicitly remapped through layer time domains.

Reverse or zero playback rates, executable nodes, arbitrary script, hidden
network generation, and over-boundary graphs are not supported.

Round-trip the edited JSON through the public Asset Hand rather than directly
patching bake, CSS, atlas, filmstrip, or receipt artifacts:

```js
const editedSource = {
  id: compositionArtifact.id,
  role: "composition",
  name: compositionArtifact.name,
  mime: "application/json",
  format: "JSON",
  content_schema: compositionArtifact.metadata.schema,
  editable: true,
  text: editedCompositionText,
  digest: compositionArtifact.digest,
  metadata: { source_result_digest: result.digest },
};

const editedResult = Hands.create(
  "deterministic-animation-fabric",
  { ...brief, operation_mode: "edit", source_artifacts: [editedSource] },
  { seed: result.seed },
);
```

After every edit, replace all derived artifacts with the newly emitted set.
Treat a `HOLD`, a changed digest, or a failed validation check as visible
counterevidence. Never preserve an old verification receipt beside a changed
composition.

## Live playback input, not live-playback proof

For deterministic scrubbing, consume `deterministic-motion-bake`:

- `timebase.frames_per_second`, `ticks_per_frame`, `duration_ticks`, and
  `frame_count` define the exact sample grid.
- `tracks[*]` bind `id`, `target`, `property`, `unit`, and `precision`.
- `frames[*].values_i[track.id] / track.precision` gives a renderer value.
- `events[*]` bind an event to `tick` and `frame_index`.

For atlas playback, consume the manifest's `image`, `frameWidth`, `frameHeight`,
`frameCount`, `fps`, `loop`, `tags`, and every frame's rectangle,
`durationMs`, and `pivot`. Bind it to the atlas whose
`metadata.source_bake_digest` matches the manifest and bake.

For arbitrary-tick scrubbing in a trusted local host, the fabric exposes
`compileComposition(composition)` and `sampleComposition(compiled, integerTick)`.
The returned `values[*]` include both `value_i` and renderer-boundary `value`.

None of those APIs supplies or verifies a wall-clock scheduler. CSS keyframes
and manifest frame durations are delivery inputs, not evidence of observed
frame pacing.

## Typed gaps for the human surface

| Gap id | Type | Current evidence | Honest next route |
| --- | --- | --- | --- |
| `HAND-LIVE-PLAYER-001` | HAND | Only static filmstrip/atlas and derived CSS exist in Asset Fabric | A bounded play/pause/scrub/loop surface that consumes bake or atlas data without rewriting source |
| `CONTRACT-ARTIFACT-SCHEMA-BRIDGE-001` | CONTRACT | Output schema is in `metadata.schema`; edit input requires `content_schema` | Implement the exact mapping above and refuse disagreement between metadata and parsed JSON |
| `CONTRACT-TEMPORAL-OBSERVATION-001` | CONTRACT | No receipt binds requested FPS/duration to an observed playback run | Define a sensory observation receipt bound to result, composition, bake and runtime identity; keep it non-promoting |
| `EVIDENCE-FRAME-PACING-001` | EVIDENCE | No repeated live observation of cadence, dropped/late frames, loop seam, background-tab behavior, or CSS timing | Observe real playback over time and record requested versus observed cadence and counterevidence |
| `CONTRACT-REDUCED-MOTION-001` | CONTRACT | `brief.accessibility.reducedMotionSafe` and `target_canvas.responsive.reduced_motion` are declarations; the hand emits no alternate-motion policy | Require an explicit keep/reduce/replace/disable strategy and bind it to an alternate artifact or verified control state |
| `EVIDENCE-ACCESSIBILITY-001` | EVIDENCE | Filmstrip has an SVG label; no keyboard, pause control, screen-reader journey, flashing/vestibular review, zoom, contrast, or `prefers-reduced-motion` observation exists | Perform bounded keyboard, assistive, reduced-motion, zoom and motion-safety review against the live surface |
| `CONTRACT-HUMAN-REVIEW-001` | CONTRACT | No typed sensory review receipt binds a person's decision to exact result/composition/bake digests and exact viewer state | Define `REVISE`, `ACCEPT_FOR_TEST`, or `REJECT` only; it must record reviewer, criteria, observations, artifact digests and a `viewer_state_digest`, and must not canonize/promote |
| `EVIDENCE-AESTHETIC-001` | EVIDENCE | Technical verification explicitly does not prove motion taste; no Mike Tobi decision exists | Human review of timing, weight, rhythm, continuity, composition, legibility and intended-use fit |

The viewer-state binding must cover at least zoom, contrast mode, playback
speed, and reduced-motion mode. A change to any bound viewing condition makes
the old sensory receipt stale and requires a new observation. Preserve the old
receipt as history; do not silently rewrite or reuse it. A viewing preference
change is not itself a canonical source edit and must not change the
composition or bake digest.

The human surface may produce observations and a review recommendation. It may
not convert technical `PASS` into aesthetic approval, mark an asset `CANON`,
promote/install it, claim browser/GPU/engine parity, claim final encoded media,
or overwrite the canonical candidate source without a new digest-bound result.
