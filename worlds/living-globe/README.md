# AXM Living Globe

This is the first round living-world base in the Grafthold lineage. It is a world, not Game 009. Future games attach as modular rulesets and may not silently own, replace, or reset its state.

## What works now

- local Three.js renderer with no runtime internet dependency;
- walkable spherical world and day/night terminator;
- small gameplay ecology, planting, chopping and campfires;
- namespaced local browser save;
- read-only `window.AXMLivingWorld` description and selected-snapshot API;
- a disconnected Mirror adapter descriptor for future reviewed integration.

## Honest limits

- single browser player only;
- browser-local persistence, not authoritative shared persistence;
- no live Mirror, physics, Shared Controls, seats, AI observation or game-ruleset adapter yet;
- ecology is gameplay simulation, not a scientific claim;
- the original intake remains preserved by hash in the intake manifest.

Open `/worlds/living-globe/`. Run `node selftest.js` before promotion.
