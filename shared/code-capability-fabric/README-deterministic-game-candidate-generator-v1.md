# Deterministic Game Candidate Generator v1

Status: `TEST`

This game rung composes existing Workshop organs into complete, detached static
game candidates. It remains an exact typed-recipe engine, not a general code
executor.

Input is `axm.game-candidate-generation-request/v1`: a sealed recipe-specific game brief,
the exact contracts for Game Capability Atlas, Game Forge, Sandbox, playtester,
Review Inbox, Evidence Desk, Detached Candidate Nursery, and deterministic JSON,
four technical-root `PASS` decisions, bounded sandbox-growth authorization,
resource ceilings, and a reuse-rights hold.

Output is `axm.game-candidate-packet/v1`, containing a Game Forge-compatible
project and an 11-file static web game bundle. The admitted recipes are:

- `four-roots-grid-game`: the original one-player 16×10 route game; and
- `twin-reactor-action-coop`: an offline two-keyboard-seat action arena with
  directional bolts, dashes, four enemy classes, deterministic waves, a shared
  reactor, proximity-linked damage, repair cores, partner revive, a visible
  Warden practice route, and shared victory or defeat. Candidate v0.2 is the
  output-first patch; v0.1 remains preserved by the parent commit.

Identical input produces
byte-identical output. The native generator calls no provider, executes no
candidate code, reads no workspace content beyond its declared component
contracts, writes nothing, grants no permissions, and uses no network.

Generated games are `EXPERIMENTAL`, detached, uninstalled, and session-only.
Installation remains a typed capability gap and a separate Mike decision.

Run:

```powershell
node shared/code-capability-fabric/selftest-deterministic-game-candidate-generator-v1.js
```
