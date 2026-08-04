# Capability gap receipt

Overall request route: **DEGRADED for full shared-world human networking; READY for a playable local RTS and an asymmetric two-human tactical-command co-op**.

Satisfied in this package:

- `game.rts.simulate.local`
- `game.rts.squad-command`
- `game.rts.economy.expansion-driven`
- `game.rts.expansion.charter-network`
- `game.rts.fog.remembered`
- `game.rts.scout.automatic`
- `game.rts.essence.casualty-funded`
- `game.rts.field-summon`
- `game.rts.ai.skirmish`
- `game.rts.ai.strategic-planner`
- `game.rts.ai.coop-ally`
- `game.rts.navigation.bridge-graph`
- `game.rts.coop.quartermaster-command-seat`
- `game.rts.coop.tactical-atlas`
- `game.rts.map.unique-mechanics`
- `game.rts.map.unique-topology`
- `game.rts.faction.asymmetry`
- `game.rts.faction.architecture`
- `game.rts.faction.doctrine-branches`
- `game.rts.faction.wonderworks`
- `asset.raster.generate`
- `runtime.http.local`

Degraded:

- `game.rts.coop.human-networked`: two browsers now cooperate through match-scoped acknowledged semantic commands, a fog-respecting tactical atlas, shared rival-scheme intelligence, roof-targeted orders, and token reconnect, but the Commander browser is still the single simulation authority and the Quartermaster is not a synchronized world client.
- `game.rts.faction.full-tech-tree`: eight modifiers, eight signature regiments, sixteen Grand Doctrine branches, eight unique macro Wonderworks, eight architectural treatments, 32 faction-role formation variants, and Clockwork formation-tempo, Boo vision, Moonwake route, Thorn repair, Mob target-coordination, Tin formation-cover, plus Graveyard casualty-Essence conversions now exist, but Temporal Mischief still lacks an ordinary conversion while the four core balance families, upgrades, and technology ages remain shared.

Missing HAND / SUBSTRATE / EVIDENCE capabilities:

- `game.rts.coop.shared-world-authority`: requires a server-authoritative or deterministic-lockstep simulation, world reconciliation, and multi-device testing.
- `game.rts.coop.physical-device-qa`: requires a real second device on the local network and a portrait/touch game-night pass.
- `game.rts.save-replay`: requires a versioned deterministic state/replay contract.
- `game.rts.performance.hardware-matrix`: requires representative devices and repeatable 400-fighter battle captures.
- `visual.capture.ephemeral-rolling-buffer/v1`: the browser exposes repeated exact-viewport still frames but no bounded rolling frame buffer, so sub-frame animation cadence remains unverified.

Cheapest honest next route: preserve the current `hexbound.coop-command/v2` intent and normalized-atlas layer, add versioned authoritative snapshot hashes, then extract simulation state behind a server-owned adapter before promoting the Quartermaster into a full world client.

## Missing-hand contract

```text
capability_id: game.rts.coop.shared-world-authority
purpose: let multiple human clients observe and mutate one reconciled HEXBOUND battle
inputs and schemas: versioned seat map; acknowledged semantic command stream; lobby session identifier
outputs and schemas: authoritative world snapshots or deterministic frames; disconnect/rejoin state
side effects: opens a local LAN session and mutates shared match state
permissions and consent: host explicitly launches; visible human seats only; local-only default
resource budget: 20 Hz or better authority; bounded snapshots; no runtime internet requirement
failure and recovery behavior: AI-safe-hold or pause on disconnect; resync from last acknowledged snapshot
compatibility/version contract: preserve hexbound.coop-command/v2; add hexbound.world-snapshot/v1
verification contract: two physical devices, divergent inputs, matching world digest, disconnect/rejoin test
promotion gate: Game Hub seat integration plus repeated two-device game-night QA
```
