# Robo Pong Cross 003

Four-player modular Robo Pong map. P1 guards the bottom, P2 the top, P3 the left, and P4 the right. Every player starts with five lives. Missing the ball costs one life; an eliminated side seals into a bounce wall so play continues until one survivor remains.

The central diamond reflects each ball on a diagonal normal and adds a small random deflection, so a strike can redirect toward any of the four goals. Three balls stay active while three or four players survive. When only two players remain, the surge ball retires and the duel continues with two balls. Human seats use a browser phone controller; adapter seats use the same authoritative movement and random-special rules.

Anti-loop design: paddle motion adds real tangential spin, the diamond rotates slowly, and active balls exchange momentum when they collide. A final safety nudge activates only after six repeated exchanges between the same pair of sides.

Play stays continuous after a miss: only the ball that escaped briefly respawns at midfield, while every other ball and paddle keeps moving. Each successful paddle contact also reduces that paddle's normal size by 1% for the rest of the match; Mega Shield remains a temporary full-size boost.

Controls: the two direction buttons move along your own wall. On a phone controller, tap anywhere on the arena view to activate the currently held random power; the colored special button and Space remain available too.

The random pool also contains two attacks: Chaos Curve redirects the most useful midfield ball toward a living rival, while Power Return arms the next paddle contact with extra speed and stronger spin.

For four-player shared-screen matches, phones render a controller-only dashboard instead of a duplicate arena: two oversized translucent movement zones, a large ability panel, personal lives, and the four-player score strip. This removes continuous phone-side canvas rendering and lowers controller load. The shared screen keeps the full 1000×1000 presentation, while the authoritative state stream runs at 25 updates per second and labels every side's held special, active effect, and cooldown.
