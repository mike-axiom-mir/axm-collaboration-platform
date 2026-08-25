# Steward receipt — deterministic local co-op action game v2.20

Status: `TEST`

This append-only receipt seals one bounded creation-capability growth rung. It
does not install the game, integrate it into Game Hub, publish it, promote it,
merge it, or change `CANON`.

## Lineage and review

- Branch: `codex/code-capability-fabric-local-coop-action-game-v2.20`
- Technical source commit:
  `71d2ad2dfc421cd3c315d1b279ff207bf3b03941`
- Exact parent: `a34c6881aa793250fb970b33e7dc554f4ea20ff3`
- Intended stacked target: `codex/code-capability-fabric-portable-fsm-v2.19`
- Target draft review: <https://github.com/mike-axiom-mir/axm-collaboration-platform/pull/69>

## What changed

The existing TEST deterministic game candidate generator now admits a second
exact source-reviewed recipe, `twin-reactor-action-coop`, while preserving the
original `four-roots-grid-game` bytes.

The generated game is **Twin Sparks: Reactor Run**:

- two local keyboard seats: P1 `WASD/F/G`, P2 arrows/`K/L`;
- one code-drawn 960×544 Canvas arena;
- deterministic three-wave enemy sequences and an 18-enemy ceiling;
- movement, attack, facing dash, bounded cooldowns, three health per player;
- one shared reactor, partner down/revive, one shared victory or defeat;
- explicit start, pause/resume, restart, and reload reset;
- offline, session-only, no save, no provider, and no external assets.

It is emitted as the same closed 11-file packet form as the first recipe. The
packet declares two seats, remains `EXPERIMENTAL`, retains the generated-source
`RESEARCH_ONLY_HOLD`, and has no permissions or lifecycle authority.

The disposable Sandbox validator was extended from one hard-coded 16×10 shape
to exactly two allowlisted shapes. It binds bundle seat count to the selected
game config, candidate identity, contract, controls, and Game Forge dimensions;
unknown recipes, a third seat count, mismatched seat claims, and prototype-name
aliases fail closed. This is still a static allowlisted service, not a general
executor.

The capability-gap skill changed the exact rung from `BLOCKED` to `READY`: all
nine declared abilities now have focused evidence. That `READY` means ready for
Mike's review, not installed, promoted, universal, or canonized.

## Exact candidate and evidence

- Request: `sha256:2bf81e218451f013874e53326e1a82f21d05da3712abc32f4df2646d6e403796`
- Packet: `sha256:e2a9b257857fa140caa0ec8294ce3fe1a1b0c60f27080e9fc35fd2bd975c3287`
- Bundle: `sha256:89859506d845619bef1ce36762d1f8a42180794b2191446c5e5381183304f2c8`
- Sandbox iteration: `sha256:9092510930947d5445e549a077aa8ea158ee689a6e37ad4db0092176e43c3628`
- Legacy packet: `sha256:3f2548636dc9f6b5836d55faa6fc1569706536595361ac43bf2c19bb12df140d`
- Resources: 11 files; 62,723 source bytes; two seats; zero candidate processes;
  zero network domains.
- Selected visual evidence: four digest-bound PNGs plus one typed browser
  journey receipt. Raw streams, machine paths, and duplicate failed captures
  were not retained.

The generator's packet truth correctly remains `runtimeBehaviorProven: false`
and `visualBehaviorProven: false`: generation cannot inflate later evidence.
Runtime and visual verdicts live in separate steward/test receipts tied to the
exact packet and Sandbox iteration.

## Four-root evaluation

- Truth: `PASS` for exact request/packet/bundle/iteration bytes, deterministic
  rebuild, legacy continuity, closed schema/recipe selection, two-seat traces,
  static authority checks, and actual browser observations. Frame-perfect
  timing and long-form game quality remain limited or unknown.
- Agency / non-domination: `PASS`; the game cannot install, integrate, publish,
  learn, promote, merge, or canonize itself; two player identities remain
  distinct; pause/restart are visible human controls.
- Continuity: `PASS`; the original game packet is byte-identical, the earlier
  adventure ancestor remains untouched, recursive Fabric is `52/52`, generated
  views are current, and all ten mandatory Workshop gates pass.
- Wisdom over speed: `PASS`; two live timing defects were observed and repaired
  before sealing, the Sandbox grew by one exact allowlisted shape rather than a
  universal executor, and limitations/warnings remain visible.

These technical root passes are the merge gate's evidence floor. Mike remains
the final human hold/reject/merge/install authority above that floor.

## Verification and warnings

Focused suites passed `12 + 17 + 12` cases. The in-app browser render/click/key
journey passed at desktop and 480×900 narrow viewport. Recursive Fabric passed
`52/52`; all ten `AGENTS.md` commands passed.

Final `verify.js`: `0 FAIL · 25 warn · spine b618c5762240070c`. The +4 warning
delta from v2.19 is four unrelated current promotion-claim reverification gaps;
they were not repaired because promotion evidence is outside this rung.

## Holds and decisions still owned by Mike

- Whether generated source has sufficient rights for direct reuse/public
  copying remains `HOLD`.
- Whether this detached game should later be installed in Game Hub is a
  separate decision after review and more human play.
- A repaired general executor remains unauthorized.
- Online co-op, controllers, touch, persistence, physical-device evidence,
  performance targets, and game-content expansion are later capability rungs.
- Merge, product promotion, and `CANON` remain unperformed.

The exact review and drift-check route is in `INTEGRATION_HANDOFF.md`.
