# Deterministic Game Candidate Generator v1

Status: `TEST`

This first game rung composes existing Workshop organs into one complete,
detached static game candidate. It is intentionally a typed recipe rather than
a general code executor.

Input is `axm.game-candidate-generation-request/v1`: a sealed 16×10 game brief,
the exact contracts for Game Capability Atlas, Game Forge, Sandbox, playtester,
Review Inbox, Evidence Desk, Detached Candidate Nursery, and deterministic JSON,
four technical-root `PASS` decisions, bounded sandbox-growth authorization,
resource ceilings, and a reuse-rights hold.

Output is `axm.game-candidate-packet/v1`, containing a Game Forge-compatible
project and an 11-file static web game bundle. Identical input produces
byte-identical output. The native generator calls no provider, executes no
candidate code, reads no workspace content beyond its declared component
contracts, writes nothing, grants no permissions, and uses no network.

The generated game is `EXPERIMENTAL`, detached, uninstalled, and session-only.
Installation remains a typed capability gap and a separate Mike decision.

Run:

```powershell
node shared/code-capability-fabric/selftest-deterministic-game-candidate-generator-v1.js
```
