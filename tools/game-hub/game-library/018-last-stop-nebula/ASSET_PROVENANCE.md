# Asset provenance

All station geometry, vehicles, alien characters, particles, signs, nebula shader work, UI, copy, and synthesized sound design were authored for LAST STOP: NEBULA in this workspace.

Queue Constellation plates are runtime-generated local canvas textures; their beams, rings, pip stacks, glows, and overflow crowns use original procedural Three.js geometry and the game's existing authored color language.

Shift Horizon uses original local shader changes, procedural torus/marker geometry, existing glow-texture generation, and authored light/color palettes. It adds no downloaded or runtime-fetched asset.

Decision Archaeology uses original local primitive geometry, runtime-generated canvas labels, existing glow textures, and authored event-specific compositions. Its 17 artifacts add no downloaded model, image, font, or runtime-fetched asset.

Consequence Reveal uses original local cylinders, torus rings, octahedron shards, point lights, and the existing procedural glow textures. It adds no downloaded or runtime-fetched asset.

Debt Liberation uses original local torus links, line tethers, cylinders, an icosahedron lock, primitive lock jaws, point lights, procedural glow textures, and a runtime-generated canvas placard. It adds no downloaded model, image, font, sound, or runtime-fetched asset.

The renderer is the existing workspace-vendored Three.js r160 module copied byte-for-byte from `shared/vendor/three-r160/three.module.js` into `runtime/vendor/three.module.js` for a self-contained offline package. Verified SHA-256: `76DEA8151BC9352AEF3528B4262E249B2604F62543828328DB978D060D61A495`. Three.js licensing remains governed by its upstream license and the Workshop's dependency records.

There are no downloaded images, fonts, sound files, models, tracking scripts, advertising SDKs, or runtime network dependencies.
