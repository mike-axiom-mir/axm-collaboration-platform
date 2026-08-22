# Tilburg Visual Adventure art pass

Current pass: **v0.8.0 visual adventure - agent visual pass, human visual approval required**

The current art profile is `data/city-art.json` with id `axm-tilburg-visual-adventure-v0-4-0`. It is a deterministic presentation layer clipped to the existing Tilburg-derived material masks. It does not claim bespoke address-level buildings or navigation accuracy.

The renderer supplies readable roads and curbs, paved sidewalks, connected roof components, selective source-aligned markings, water and rail detail, park canopies, street lamps, landmarks, district wayfinding and the curated local prop/building overlays.

The v0.8 extension adds roof extrusion and parapets, facade windows and service entrances, rooftop machinery and solar panels, stronger overlay-building foundations, animated landmark motifs, bounded city-clock lighting, venue-specific storefronts and activity breadcrumbs on both the shared world and expanded map. The route cue is a visual bearing, not authoritative pathfinding.

No collision, spawn, mission, route, territory, controller, save or multiplayer-authority data is changed. No new bitmap art was introduced. Canvas primitives are original project presentation; existing local images retain the provenance recorded in `ASSET_PROVENANCE.md` and the asset manifests.

See `CITY_TEXTURE_PASS.md` for the v0.2.9 rejection, before/after evidence, maturity limits and acceptance status. The generated `docs/previews/city-visual-adventure-v0.8.0.png` is actual Canvas renderer evidence for this pass.
