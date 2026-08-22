# Deterministic Animation Capability Scout

Overall route: **READY** for the bounded local increments implemented here.
Implementation status: **TEST** pending Mike Tobi's review and each downstream
runtime's own visual/parity evidence.

## Requested outcome

Increase the Workshop's deterministic, modular animation capability and turn
that capability into reusable candidate asset creation inside Asset Fabric.

## Before

The Workshop already had semantic animation state graphs, ten governed
procedural motion presets, pixel/APNG animation, rigged GLTF animation, timeline
interchange and final-video substrate routing. Those are real capabilities, but
none supplied a common fixed-tick, fixed-point, composable motion recipe that
could be sampled at arbitrary ticks and baked into portable CSS/JSON/SVG assets.

## Gap types and route

| Capability | Before | Gap | Route |
| --- | --- | --- | --- |
| `animation.fixed-tick.sample` | missing | HAND | New stateless integer-time sampler |
| `animation.fixed-point.bake` | missing | HAND | New bounded fixed-point baker |
| `animation.modular.compose` | missing | CONTRACT | Data-only blocks, instances and DAG |
| `animation.procedural-motion.adapt` | missing | CONTRACT | Loss-declared adapter for the existing motion contract |
| `asset.motion.css.create` | missing | HAND | Deterministic transform/opacity CSS export |
| `asset.motion.svg-filmstrip.create` | missing | HAND | Static visual proof export |
| `asset.fabric.procedural-animation.route` | missing | CONTRACT | New candidate-only Asset Hand and UI kind |

## Second increment

The single-recipe graph could not yet remix independently reusable clips or
emit an engine-style frame atlas. The second increment closes those bounded
gaps without replacing the existing recipe, APNG, pixel-animation, rigged-GLTF
or timeline contracts.

| Capability | Before increment 2 | Gap | Route |
| --- | --- | --- | --- |
| `animation.clip-layer.compose` | missing | CONTRACT | Embedded canonical recipes plus explicitly ordered layers |
| `animation.time-domain.rational-remap` | missing | HAND | Integer/BigInt trim, source-in, rational rate and clamp/loop/ping-pong mapping |
| `animation.layer.fixed-point-blend` | missing | HAND | Replace/add/multiply blends with fixed-point weights |
| `asset.motion.svg-sprite-atlas.create` | missing | HAND | Exact-frame bounded SVG atlas renderer |
| `asset.motion.sprite-atlas-manifest.create` | missing | CONTRACT | Reuse the existing `axm.sprite-atlas/v1` interchange schema |

No new dependency, permission, network service, installation authority or
native substrate is required. The route reuses the existing Asset Hand v2
contract and browser provider registry.

## Honest boundary

The capability can prove graph validity, layer ordering, exact rational time
mapping, fixed-point blending, repeat baking, atlas cell coverage and artifact
bytes. It cannot prove motion taste, deformation quality, browser/GPU raster
equivalence, final video, or an engine adapter that has not been built. Source
clip events are intentionally not remapped implicitly; explicit composition
events preserve semantic ownership. Those remain `EVIDENCE` or adapter gaps and
are not represented as complete.
