# AXM Pixel 3D Representations - Implementation Receipt

Date: 2026-08-12  
Status: `EXPERIMENTAL` - installed: false - promoted: false - canonical: false

## Outcome

The platform now has exact, selectable `pixel-8bit-3d` and `pixel-16bit-3d`
representations for the Ferris wheel, carousel horse, ticket gate, and starter
sofa. Each pair keeps one identity, footprint, pivots, sockets, and simulation
meaning while changing only its visual representation. The output is eight real,
animated, engine-neutral GLB files rather than 2D sprites pretending to be 3D.

The 8-bit and 16-bit names are art-direction profiles, not literal GPU colour
depth. Neither is a required progression step, and explicit requests for
high-detail or cinematic output return `MISSING_REPRESENTATION` without a
nearest-profile fallback.

## Capability growth

`pixel-3d-representation` is the forty-first registered Asset Hand. It uses a
browser-safe pure resolver and GLB codec, honors host triangle/node/material/file
budgets, embeds AXM identity and representation metadata, and produces validation
receipts. Asset Hands, Asset Fabric, and the Choice-First Visual Lab advertise
the new contracts while retaining their no-install/no-promotion boundaries.

The GLB pilot generator produced four identities in both profiles. Two
consecutive runs produced the same proof SHA-256:
`d2c70629dc07c1b469b727727cb023886fe04558f4a3b53101fdf22af74f7802`.

## Live proof

The Visual Lab dynamically loads the existing native WebGL2 renderer. Live
browser interaction proved:

- Ferris wheel 8-bit: 24 nodes, 392 model triangles, running animation.
- Ferris wheel 16-bit: 44 nodes, 1776 model triangles, running animation.
- Carousel horse 8-bit, ticket gate 16-bit, and sofa 16-bit all rendered and
  animated as their intended identities.
- Exact profile and identity switching, orbit, zoom, and GLB download routes
  worked; the browser console had zero errors.
- The UI visibly reports high-detail/cinematic and whole-game walkable 3D as
  unavailable instead of silently substituting these pilots.

Five bounded screenshots and their SHA-256 digests are recorded in
`live-browser-evidence.json`. The evidence also documents the renderer's
14-triangle ground/player overhead separately from model-only receipt counts.

## Verification

All ten AGENTS.md-required Workshop checks pass. Focused checks also pass for
all eight packages, the new Hand, 119 schemas, Asset Hands, Asset Fabric,
Spatial Studio, the Visual Lab, HTML syntax, and repeated generation.

The repository aggregate remains `PARTIAL` only for two preserved unrelated
failures: the known Casino-alpha browser/phone-QA stance assertion and the
dormant physical-controller static-contract assertion. Operations, Asset Hands
completion, Asset Hands upgrades, and workspaces pass when continued after the
aggregate stop. Exact results are in `verification-receipt.json`.

## Honest remainder

- These four models prove the representation machinery; they are not a full
  theme-park or Sims-style game overhaul.
- Whole-game walkable 3D, textures, collision, physics, engine import,
  high-detail 3D, and cinematic output remain later capabilities.
- Real-device performance has not been benchmarked.
- Mike's review is still required for originality, readability, motion quality,
  game fitness, and any promotion or canon decision.
