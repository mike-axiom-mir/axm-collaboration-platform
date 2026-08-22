# Design bible

## Promise

Make one gate feel like two simultaneous responsibilities. Solo play is deliberate plate-spinning; co-op gives each warden a side, four owned plots, and a clearly separate wallet while preserving one shared inner hearth.

## Visual language

The chosen look is **warm dusk low-poly pixel theatre**: plum shadows, wheat-gold light, muted moss, chunky stone, and berry-colored enemies. A depth-tested 480×270 WebGL scene provides real raised terrain, buildings, silhouettes, paths, projectiles, and a locked oblique camera. Its fragment output is quantized to sixteen steps per color channel. A transparent 960×540 native-pixel Canvas adds exact tactical markers and owns interaction; both layers scale without smoothing. Reduced-motion mode locks the subtle camera drift and sprite bob.

This is influenced by the clarity and coziness of low-resolution valley games, but uses original shapes, colors, UI, names, and code-native artwork.

## Decision pressure

Tower damage uses gold; infrastructure uses metal. In co-op, kills and owned income pay the responsible side. Only whole-gate fortification splits its metal cost across both wallets. That prevents accidental resource stealing and creates recurring questions:

1. Can the current towers kill the next bulk increase?
2. Is the ward strong enough to survive a breach?
3. Is immediate income worth more than another weapon building?
4. Can both players afford the next shared gate fortification?

Quick rebuilds are cheaper and restore more health. Missing the window is recoverable, but expensive.

Construction uses one radial verb. Hold RB near an empty plot, point the movement stick, and release to commit. RB at an existing building upgrades it immediately. There is no separate blueprint-selection mode; LB has the single job of fortifying the shared gate.

## Oathbound pacing

The first six minutes are five 72-second chapters rather than an undifferentiated health ramp. Each chapter has a named tactical promise, a distinct weighted enemy mix, an entry formation, a palette accent, and a per-warden gold/metal reward. Sealing a chapter records score, defeats, breaches, hearth health, gate level, time, and reward in a run-local receipt. The fifth receipt changes the chapter label to Endless Vigil but does not reset or end the run.

Hexers create teal ward rings that reduce damage to nearby ordinary troops; their own bodies are not warded. Warlords create red command rings that accelerate nearby troops; commanders do not accelerate themselves. These are target-priority decisions, not merely larger health bars. The twin Warlords are a bounded final formation rather than an unlimited random spawn.

## Co-op roles

Both players share the hearth, not their everyday spending. Each warden owns one gate side, four plots, tower shortcuts, kill rewards, and building income. Both wallets stay visible on the same screen. Oath rewards go to both active wallets, while kills remain owned. Scheduled surges, fast Skitters, escalating nights, Hexer/Warlord priorities, and earlier Relicbacks create readable tempo changes instead of one uninterrupted enemy trickle.
