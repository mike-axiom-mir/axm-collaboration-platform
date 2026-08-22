# AXM Pixel Asset Foundation - Scout and Evidence Receipt

Date: 2026-08-11  
Workshop status: `EXPERIMENTAL`  
Overall route: `DEGRADED` for the full researched v0; `READY` for all four required capability groups in the adjacent comparator inputs.

The deterministic capability comparator reports `DEGRADED` because optional
multi-format, live visual authoring, engine export, semantic and generative
capabilities remain absent. These required groups are `READY`:

- bounded PNG raster foundation;
- lineage and deterministic reproduction;
- pixel animation workflow profiles;
- modular game/video animation bridges.

No package was installed. No network, native write, promotion or canon authority
was added.

## What was missing

AXM already had upper-layer asset creation, raster generation/compositing, a
fixed-grid SVG sprite generator, an animation state spine and video encoding.
It did not have an admitted lower layer that could preserve an ordinary source
image, make reproducible pixel derivations, attach engine-neutral animation
metadata and carry the resulting frames toward games or video without coupling
those concerns together.

The existing `pixel-sprite` hand creates SVG cells; it does not transform
imported pixels. `raster-compositor` combines compatible PNG layers and refuses
implicit resampling. The game animation foundation owns state transitions, not
sprite-sheet extraction. The final video encoder owns containers/codecs, not
pixel animation authorship. Those boundaries remain intact.

## Implemented route

### Source-preserving pixel foundation

The Raster Operations Core and `pixel-asset-workshop` hand accept one bounded
RGBA8/sRGB PNG and an explicit `axm.raster-operations-recipe/v1`. Supported
operations are crop, alpha trim, nearest resize, anchored padding, alpha
threshold, declared-palette mapping, exact grid slicing and deterministic grid
packing.

The hand emits an immutable byte-identical source copy, derived PNG candidates,
a normalized recipe, an `axm.pixel-asset-package/v1` entity/activity graph and a
SHA-256-bound validation receipt.

### Modular pixel animation layer

The pure `pixel-animation-core.js` and `pixel-animation-workshop` hand add:

- `pixel-8bit`, `pixel-16bit` and `pixel-custom` workflow profiles;
- exact sheet grid, frame, animation, direction, index, duration, atlas, bounds,
  pivot, tag and event metadata;
- loop/once playback with forward, reverse and ping-pong order;
- palette ceilings, exact-palette checking and duplicate-frame policy;
- explicit human/AI/program/mixed/unknown provenance with derived `ai_used`;
- native variable-delay APNG clips and optional integer-nearest APNG previews;
- a clip/sampler adapter for `axm.game-animation-graph/v1`;
- a codec-neutral, millisecond-timed video-frame sequence;
- normalized editable recipe, sprite manifest and validation receipt schemas.

The 8-bit and 16-bit names are AXM art-direction/workflow presets. Both retain
RGBA8/sRGB storage; neither claims historical hardware restrictions or binary
console formats. The core supports at most 256 authored frames. The current APNG
delivery hand bounds each expanded clip to 60 frames. A real game renderer and a
real video encoder remain separate consumers.

Humans, AI systems and deterministic programs share the same draft normalizer.
Only its normalized `axm.pixel-animation-recipe/v1` result is the portable wire
artifact consumed/emitted by the hand.

Every result remains candidate-only with `installed: false`, `promoted: false`
and `canonical: false`.

## Remaining capability gaps

| Capability | Gap type | State | Cheapest next proof |
|---|---|---|---|
| JPEG and WebP import | `HAND` + `CONTRACT` | unavailable | Add bounded decoder adapters and immutable-source fixtures. |
| Live native/integer/game-context preview | `HAND` + `EVIDENCE` | unavailable | Build a dedicated workshop surface and capture native, integer-zoom and game-context journeys. |
| Tiled or Godot native export | `HAND` + `CONTRACT` | unavailable | Implement one adapter and reopen its output in the real engine. |
| Actual video-container consumption | `HAND` + `EVIDENCE` | unavailable in this layer | Bind the emitted sequence to the existing encoder and inspect the decoded result. |
| Semantic mask proposal | `HAND` + `AUTHORITY` | unavailable | Add a proposal-only mask seam with human correction and deterministic application. |
| Structured artistic abstraction | `SKILL` + `EVIDENCE` | unavailable | Define reference criteria and compare against naive resize/quantize baselines. |
| Generative variants or missing frames | `HAND` + `AUTHORITY` + `EVIDENCE` | unavailable | Add a candidate-only provider after deterministic structure is stable. |

## Routed evidence

| Claim | Primary evidence | Counterevidence sought | Verdict |
|---|---|---|---|
| Source PNG is preserved | End-to-end byte/data URL and SHA-256 assertions | Changed source accepted or source used as mutable output | `PASS` for bounded fixtures |
| Recipe is deterministic | Two hand executions plus repeated extraction/encode comparisons | Any dimension, metadata, byte or pixel difference | `PASS` for bounded fixtures |
| Slice/pack is exact | Direct RGBA comparison after grid slice and zero-padding pack | Changed order, dimensions or pixel | `PASS` for bounded fixtures |
| Parent lineage is bound | Parent package id and source digest validation | Wrong parent id or absent source digest accepted | `PASS`; mismatch is rejected |
| 8/16 profiles are workflow-only | Normalized profile objects and both end-to-end fixtures | Storage/hardware claim or profile ambiguity | `PASS` at contract/runtime surfaces |
| Variable timing survives APNG | Independent APNG chunk inspection of per-frame delays and total duration | Flattened/equalized timing or invalid sequence/CRC | `PASS` for 200/300 ms and 83/83 ms fixtures |
| Game adapter follows state | Real game-animation controller transition sampled through adapter | State/clip mismatch or wrong frame boundary | `PASS` for tested idle-to-walk transition |
| Video bridge preserves timing/binding | Contiguous segment assertions with frame artifact ids and SHA-256 values | Gaps, overlaps, missing digest or wrong cycle duration | `PASS` for codec-neutral sequence only |
| Asset Fabric can load the new layer | Node registry, static browser script-order checks and live Asset Fabric load | Missing scripts, registration count drift or console errors | `PASS`; live page showed 36 browser providers (38 Node providers minus two pre-existing Node-only providers) and no warnings/errors |
| Animation looks good in motion | Live rendered animation in game/video context | Only encoded artifacts and structural checks exist | `UNKNOWN`; no artistic/motion approval claimed |

## Source boundary

The supplied discovery log and deep-research report were treated as design
evidence, not executable authority. Their central separation of source,
deterministic pixel operations, animation semantics and downstream adapters was
adopted. Their external citations were not independently re-browsed in this
implementation pass, so this receipt does not restate them as newly verified
claims.

## Verification ledger

Focused checks all exited 0:

- `node shared/asset-hands/pixel-asset-workshop-selftest.js`;
- `node shared/asset-hands/pixel-animation-workshop-selftest.js`;
- `npm.cmd run test:pixel-animation-workshop` (root package-script route);
- `node shared/asset-hands/schema-contract-selftest.js` - 103 schemas;
- `node shared/asset-hands/selftest.js` - 38 providers;
- `node shared/asset-hands/hardening-selftest.js` - 20 `PASS`, 0 `FAIL`;
- `node shared/asset-hands/interchange-selftest.js`;
- `node shared/game-animation-foundation/selftest.js`;
- `node tools/asset-fabric/selftest.js` - 34 `PASS`, 0 `FAIL`.

Live browser observation:

- Asset Fabric rendered at its local route with 36 installed browser hands;
- the raster operations core, pixel animation core and both workshop hand scripts
  were loaded in document order;
- the browser log contained no warnings or errors;
- this proved shell/load health, not animation motion quality.

Required Workshop checks from `AGENTS.md` all exited 0:

- `node verify.js`;
- `node hub/hub-selftest.js`;
- `node hub/route-selftest.js`;
- `node hub/graft-selftest.js`;
- `node hub/skin-selftest.js`;
- `node hub/verify-plus.js` - `VERIFIED_WITH_LIMITS`, retaining the existing
  foundation/game warnings;
- `node tests/html-script-syntax-test.js` - 55 `PASS`, 0 `FAIL`;
- `node tests/tool-forge-package-test.js`;
- `node tools/agent-tool-forge/selftest.js` - 17 `PASS`, 0 `FAIL`;
- `node tools/evidence-desk/selftest.js` - 36 `PASS`, 0 `FAIL`.

The changed/new JSON contracts parse successfully. `git diff --check` exited 0;
Git emitted the repository's existing LF-to-CRLF conversion warnings but no
whitespace-error verdict.

`verify.js` also reports two existing maintenance warnings: 60 legacy
`UNDECLARED` manifest kinds and a stale generated `tools-index.json`.

The full `npm.cmd test` aggregate was run and is **not green**. It reached the
new pixel test, then failed an unrelated existing intake-seam stance assertion:
`Casino alpha is honestly labeled TEST/WORKING and still requires browser/phone
QA` (24/25 pass; external review still required). This receipt does not relabel
that aggregate as passing or expand scope to repair it.

## Shared-workspace handoff

The work stayed on branch `local-visual-fabric-20260728`; nothing was staged or
committed. The final read-only snapshot reported 11,114 Git status entries and
hit its 50,001-file scan limit, so the repository is not globally clean or fully
enumerated. The four active shared seams were unrelated Aetherglass files. No
task-relevant shared seam was observed changing during the final check; the only
task-active path was this receipt. Existing and unexplained work was preserved.

Mike Tobi remains the review, promotion and canon gate.
