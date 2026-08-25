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
project and a byte-bound static web game bundle. The admitted recipes are:

- `four-roots-grid-game`: the preserved one-player 16×10 route game in an
  11-file packet; and
- `twin-reactor-action-coop`: an offline two-keyboard-seat action arena with
  directional bolts, dashes, four enemy classes, deterministic waves, a shared
  reactor, proximity-linked damage, repair cores, partner revive, a visible
  Warden practice route, and shared victory or defeat. Candidate v0.4 is a
  14-file asset- and experience-aware rung; earlier candidates remain preserved
  by parent commits.

Before Twin Reactor source bytes are built, the planner byte-binds exact JSON
declarations from Asset Hands, Asset Fabric, and the visual capability catalog.
The snapshot exposes the bound inventory counts—including 46 built-in hands,
105 service capabilities, 30 visual adapters, 64 AetherFX modules, 6 PBR
families, 15 portable effects, 25 style presets, and 3 treatment molds—before
selecting seven game-relevant routes, five effects, and four known repairs,
including projectile spawn/collision, combat silhouette separation, asset
truth ceilings, and reduced-motion gameplay cues. Its exact Neon Circuit ×
Aetherglass choices then inform the native canvas and CSS renderer.

The separate `axm.game-experience-flow-plan/v1` is also emitted before source
bytes. It binds lobby, mission introduction, active play, wave transition,
Warden introduction, pause, victory, and defeat scenes; deterministic
transition ticks; and staged disclosure. Player-relevant HUD stays in the
arena, while exact controls, Asset Factory lineage, known repairs, and authority
holds remain inspectable through an on-demand review drawer. The plan does not
claim rendering quality or human taste approval.

This is truthful composition, not asset execution. The capability snapshot
means the relevant hands are declared by the Workshop contracts. The generator
does not load or run those hands, and the packet does not claim that separate
sprite, texture, audio, animation, or effect artifacts were produced.

Identical input produces
byte-identical output. The native generator calls no provider, executes no
candidate code, reads no workspace content beyond its exact declared component
contracts and catalog JSON, writes nothing, grants no permissions, and uses no
network.

Generated games are `EXPERIMENTAL`, detached, uninstalled, and session-only.
Installation remains a typed capability gap and a separate Mike decision.

Run:

```powershell
node shared/code-capability-fabric/selftest-deterministic-game-candidate-generator-v1.js
node shared/code-capability-fabric/selftest-asset-aware-game-prebuild-planner-v1.js
node shared/code-capability-fabric/selftest-game-experience-director-v1.js
node shared/code-capability-fabric/selftest-local-coop-action-game-recipe-v1.js
```
