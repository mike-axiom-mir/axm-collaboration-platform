# Relaybound — slot 004

Relaybound is designed for one human and a selectable partner: another human, a Connected AI, or an in-game AI. Every pairing operates under the same complementary restrictions, so changing the second seat does not change the co-op rules.

## The relay rule

- **Edge** is the attacker. Edge can damage exposed enemies but is fragile and cannot expose armor or block hostile bolts.
- **Ward** is the defender. Ward can project a shield, block bolts, expose nearby armor, and revive a downed partner, but cannot finish enemies.
- When either partner claims an **Attack** upgrade, that partner is forced into Ward and the other partner inherits the upgraded Edge role.
- When either partner claims a **Defense** upgrade, that partner is forced into Edge and the other partner inherits the upgraded Ward role.

Progress is therefore a handoff. Upgrading the ability you want means trusting the other partner with it.

## TEST route · Echo Chamber expansion

1. The run waits at **Ready to Bind** until either human phone/shared-screen control starts the shared 3-2-1 countdown.
2. A first combat chamber teaches expose → protect → strike.
3. Two optional **Bond Beacons** reward both partners for standing together: each completed beacon heals the team and grants a twelve-second attack/expose/shield boost. They never gate progression.
4. The first upgrade choice swaps the roles and opens the **Echo Chamber**.
5. Six tougher Echoes move and shoot faster than the first chamber's Shades, asking the new Edge and Ward to prove the inherited upgrade under heavier pressure.
6. Clearing the Echo Chamber opens a second upgrade choice and wakes the guardian.
7. At half guardian health a third upgrade relay is required.
8. The guardian's final phase tests all three handoffs of the partnership.
9. The shared screen then enters **Bondfire**, a separate post-match debrief page where match evidence, human perspective, and Nova's independent perspective can be discussed before any lesson is saved. **Play Again** resets the run to the ready gate.

This expansion raises the intended route to roughly eight minutes. It remains
`TEST`: scripted state and transport checks do not replace a human balance pass,
physical controller/phone QA, or the separate browser render-and-click check.

The shared screen is the main cinematic view. Phones are large, low-clutter controllers and role/status displays; either human phone can start the run after both players are ready. Keyboard fallback: WASD move, arrows aim, Space act, 1 Attack node, 2 Defense node.

Xbox/Brawl profile: controller 1 drives seat 1 and controller 2 drives a Human seat 2. Left stick or D-pad moves, right stick aims and acts when released, RT/A acts directly, and X/Y select Attack/Defense upgrades. A Connected AI uses the same semantic input gate through its token-bound adapter binding; an In-game AI runs only the local bot loop.

## Movement hotfix (0.3.1)

- Phone routes do not load or render the hidden Three.js world.
- Phone state uses a compact stream, and input transport keeps only one request in flight while retaining the newest stick position.
- The idle shared-screen keyboard no longer sends zero movement over Player 1's active phone controller.
- The shared view interpolates network positions instead of snapping between state packets.
- Enemies keep separation, enter with a grace window, and stagger range-limited shots with lower burst damage.
- `tests/movement-pressure-http.test.js` sustains two-human movement through the first enemy pressure window and checks for queued-input tails and enemy stacking.

## Bondfire learning gate

Bondfire never auto-trains an identity from raw gameplay. It offers four outcomes for a proposed lesson: discard, keep for only the next Relaybound match, save privately to Nova, or explicitly promote to shared identity wisdom. Private/shared saving is available when the page runs through the Hub origin, where the identity registry owns its storage.

## Visual direction

The route uses real animated Quaternius fantasy characters and a modular Kenney dungeon, rendered with local Three.js/WebGL, shadows, fog, role lighting, particles, and camera framing. Echoes reuse the licensed Demon rig as a tougher second-chamber pressure tier without adding an unverified asset dependency. All third-party art in the package is CC0; details are in `ASSET_LICENSES.md`.

## Visual verification record

The first 2026-08-16 in-app browser pass confirmed the lobby, countdown, active
3D combat, Echo Chamber, relay-choice overlay, and downed-AI recovery, but also
recorded five `GLTFLoader` errors for the Kenney dungeon's missing
`Textures/colormap.png`. Geometry remained visible with a pale fallback look.

The low-poly visual pass restored that atlas from Kenney's official CC0 archive,
changed the local server to prefer the packaged file before its emergency 1x1
fallback, cache-versions the restored atlas request, and applies
nearest-filtered palette textures, faceted shading, and
distinct muted stone tints to the existing dungeon meshes.
`tests/visual-assets.test.js` pins the atlas hash and proves the HTTP response is
the packaged 28,309-byte image. Baseline and repaired browser captures are retained under
`evidence/2026-08-16-low-poly-visual-pass-01/`. Relaybound remains `TEST`: this
repair does not replace physical controller/phone QA or a human balance pass.
