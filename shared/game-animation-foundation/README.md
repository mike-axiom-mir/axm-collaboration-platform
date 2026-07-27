# AXM Game Animation Foundation

This is the reusable runtime seam between authored clips and visible game behavior. It is independent of visual skin and rendering engine: a cartoon character, PS2 pedestrian, robot, creature, or later high-detail body can use the same typed state graph.

It adds semantic clip discovery, deterministic states, explicit cross-fades, timed foot-contact and impact events, bounded one-shot recovery, and a structural verifier. Renderers adapt the typed frames into their native mixers without becoming the state owner.

The verifier checks reachability, ambiguous transitions, stuck one-shots, locomotion contacts, action events, and missing gameplay groups. Its human visual gate stays open: technical structure cannot approve deformation or motion taste.

The PS2 Asset Forge street scene is the first live adopter. The street remains a benchmark and visual anchor, not yet a finished game.
