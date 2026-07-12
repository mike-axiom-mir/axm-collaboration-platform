# Relaybound — slot 004

Relaybound is designed for one human and one AI as an actual co-op pair. The AI is not a substitute player bolted onto a normal game: both partners operate under complementary restrictions.

## The relay rule

- **Edge** is the attacker. Edge can damage exposed enemies but is fragile and cannot expose armor or block hostile bolts.
- **Ward** is the defender. Ward can project a shield, block bolts, expose nearby armor, and revive a downed partner, but cannot finish enemies.
- When either partner claims an **Attack** upgrade, that partner is forced into Ward and the other partner inherits the upgraded Edge role.
- When either partner claims a **Defense** upgrade, that partner is forced into Edge and the other partner inherits the upgraded Ward role.

Progress is therefore a handoff. Upgrading the ability you want means trusting the other partner with it.

## Current vertical slice

1. A first combat chamber teaches expose → protect → strike.
2. The first upgrade choice swaps the roles and wakes the guardian.
3. At half guardian health a second upgrade relay is required.
4. The guardian's final phase tests both versions of the partnership.
5. The shared screen then enters **Bondfire**, a separate post-match debrief page where match evidence, human perspective, and Nova's independent perspective can be discussed before any lesson is saved.

The shared screen is the main cinematic view. Phones are large, low-clutter controllers and role/status displays. Keyboard fallback: WASD move, arrows aim, Space act, 1 Attack node, 2 Defense node.

## Bondfire learning gate

Bondfire never auto-trains an identity from raw gameplay. It offers four outcomes for a proposed lesson: discard, keep for only the next Relaybound match, save privately to Nova, or explicitly promote to shared identity wisdom. Private/shared saving is available when the page runs through the Hub origin, where the identity registry owns its storage.

## Visual direction

The slice uses real animated Quaternius fantasy characters and a modular Kenney dungeon, rendered with local Three.js/WebGL, shadows, fog, role lighting, particles, and camera framing. All third-party art in the package is CC0; details are in `ASSET_LICENSES.md`.
