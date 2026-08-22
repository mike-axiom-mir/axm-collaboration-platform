# AXM Briarfront 005

Small-scale experimental 2v2 forest combat built from Mike's early Grafthold visual prototype. Grafthold remains reserved for the future living-world stewardship sandbox; Briarfront is the separate match-based game.

Current experimental loop: P1/P2 form West Team and P3/P4 form East Team. The forest is divided organically by a river with two crossings rather than visible MOBA lanes. Phones show a lightweight first-person view: drag the left thumbstick to move, drag the right thumbstick to look/aim, then release it to fire. The shared screen shows the whole forest from above.

Combat rules: players have 100 HP with no regeneration. Arrows deal 10 damage or 20 on a critical hit, fire at no more than 1.2 arrows per second, and use a 12-arrow quiver that restores one arrow every 1.5 seconds. Regular mobs have 20 HP; the first elite mob has 70 HP.

Piercing is the single active ability. Arm it on the phone, aim with the right thumbstick, and release to fire. It costs four arrows, has a ten-second cooldown, travels at twice normal speed, deals 1.5× damage, and continues through every valid target on its flight line. Its bright trail and sound telegraph it to both sides.

Each pair shares a 550 HP respawn jar instead of owning a physical base. Every respawn withdraws up to 100 HP. When only 50 remains, the final respawn returns with 50 HP. Once the jar is empty, defeated teammates remain out; the team loses when neither ally can return.

Economy and waves: each living player produces one wood per second on their own side and two per second while invading. Team wood can queue a 20 HP small mob for five wood or a 70 HP big mob for 25. Purchases accumulate during a one-minute cycle and each side releases its complete queue together when the cycle ends. Every five minutes a sealed mystery gift spawns beside each player; gift effects intentionally remain undefined until playtesting establishes what the combat needs.

AI seats operate through the same virtual left and right thumbstick axes as humans. They wander, turn, aim, miss, fire, reload, buy mobs, and use Piercing under the same rules. They may shoot only when a target naturally enters their current view; the runtime does not snap their aim or provide hidden target lock.

External `adapter` seats are distinct from those built-in AI players. They remain still until an explicitly assigned collaborator sends a token-bound, sequenced semantic intent through the same server authority gate used by human controllers. Their bounded observation contains the assigned controller HUD and the public facts rendered on the shared top-down party screen; see `ADAPTER_SEAT_CONTRACT.md`.

This slot is intentionally separate from Robo Pong Cross 003, the reserved 004 experiment, and the future Grafthold sandbox. The original prototype stays preserved verbatim as `runtime/grafthold-source.html`, while `runtime/briarfront-client.html` and the managed runtime contain the authoritative 2v2 game.

Both active views now use the preserved prototype's Three.js 0.160.0 low-poly nature language. Phones use a perspective camera inside the shared authoritative forest; the shared display uses an orthographic 3D camera over the same geometry, lighting, materials, fog, shadows, river, bridges, actors, mobs, gifts, and health jars. Canvas2D is not used for the active game renderer. The managed runtime serves the Workshop's pinned local Three.js r160 module at `/vendor/three.module.js`; the active client has no CDN or other outside-network asset dependency.

The production shared-screen and player routes enter active play directly and contain no blocking start, pause, modal, or consent overlay. Escape is therefore inert on those routes. The click-to-enter overlay in `runtime/grafthold-source.html` remains part of the separately served preserved prototype, not the Briarfront launch client. The bounded desktop evidence is recorded in `evidence/2026-08-16-no-blocking-overlay-local-renderer/RECEIPT.md`; physical-phone QA remains separate and pending.
