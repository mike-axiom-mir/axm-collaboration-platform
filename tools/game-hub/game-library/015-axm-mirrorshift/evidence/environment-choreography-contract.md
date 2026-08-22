# Living Circuits contract

V23 adds a bounded presentation layer to the three existing circuits and Mirror Core. It does not add tracks, hazards, routes, racers, collisions, authority writes, or mechanical modifiers.

## Frozen presentation contract

- `axm.environment-choreography-pose/v1` resolves one of four frozen identities: Forge Countercycle, Bloom Tide, Foundry Heat Cycle, or Core Vector Scan.
- Pose fields are deterministic and bounded: phase, secondary phase, rotation, drift, glow, and density.
- Every profile and pose declares `changesPerformance: false` and `changesAuthority: false`.
- Reduced motion is time-invariant: phase and secondary phase settle at 0.5, drift settles at zero, and each scene retains a static authored composition.
- `axm.environment-choreography-diagnostics/v1` is exposed on the live game frame for DOM-tied verification.

## Evidence boundary

`tests/environment-choreography.test.js` sweeps 72,000 poses, checks four distinct frozen identities, finite bounds, reduced-motion invariance, authority immutability, manifest/static wiring, and the original equal-stat, +7.5% catch-up, 85% race attack, and three-segment Flux Guard contracts.

Live desktop and responsive visual checks can prove composition and wiring on the local browser. They cannot prove representative target-hardware cadence, four physical phones/router behavior, human attachment, art direction, or steward approval. Those gates remain external.
