# Export integration routing · 2026-07-24

This record prevents a useful export from being rebuilt, silently crammed into
an unrelated tool, or mistaken for canon. Original exports remain unchanged.

## Installed as governed TEST or EXPERIMENTAL modules

| Export source | Installed owner | Decision |
|---|---|---|
| `exports/ui-fx/` | `shared/elements/axm-ui-fx.css`, `shared/elements/axm-ui-fx.js`, `tools/ui-fx/` | Installed as a separate UI appearance hand. Visual Kernel supplies default brand/action tokens; hosts still apply recipes explicitly. |
| `exports/command-deck-concept/` | `shared/elements/axm-ui-theme.css`, `shared/elements/dual-operator-command-deck.css`, `tools/workshop-command-center/` | Already promoted as presentation plus navigation. UI-FX now has one additional route tile; the Deck gained no new authority. |
| `exports/chroma-batch/` | `tools/chroma-studio/` | Already installed. It reads the existing Device Handoff inbox and defaults output to browser Downloads outside the Workshop. |
| Device QR join | `tools/device-handoff/` | Existing one-time LAN sidecar reused. Command Deck and Chroma request explicit expiring sessions; no permanent listener was added. |
| `exports/anim-kit/` | `tools/anim-kit/` | Already installed as an EXPERIMENTAL procedural-motion hand with its own contract rather than claiming the existing rig-clip schema. |
| `exports/fsm-kit/` | `tools/fsm-kit/` | Already installed as a separate EXPERIMENTAL deterministic state-machine hand. |
| `exports/fx-blocks/` | `shared/visual-fx/`, `tools/fx-blocks/` | Already installed as portable recipe/Shapeable-pack output. It remains distinct from UI-FX: FX Blocks describe portable visual recipes; UI-FX composes live interface classes. |
| `exports/sfx-bake/` | `shared/audio-sfx-bake/`, `tools/audio-studio/sfx-bake.js` | Already admitted as Audio Studio's deterministic headless back half for `axm.audio.sound/v1`. |
| `exports/sensorium-proposals/` | `shared/sensorium/` | Already integrated through Sensorium's canonical compiler and proof routes. Proposal exports stay preserved; runtime truth comes from current Sensorium receipts and self-tests. |

## Preserved as separate candidates or evidence

| Export source | Current route | Why it is not silently installed |
|---|---|---|
| `exports/toon-visual-kit/` | Candidate creation hand | It introduces `axm.toon-style/v1`, proof sheets and a deterministic compiler. The schema is not yet a registered shared contract and there is no live host adapter. It should enter as its own toon-style hand, then be connected to game/Studio consumers explicitly. |
| `exports/steam-game-organism-research-2026-07-24/` and `exports/AXM_STEAM_GAME_RESEARCH_BRIEF_2026-07-23.md` | Research evidence | Requirements and gap analysis inform game planning; they are not executable capability. |
| `exports/AXM_WORKSHOP_IMPROVEMENT_ROADMAP_2026-07-23.txt` | Roadmap evidence | A planning input, not a tool manifest or authority grant. Items should become bounded lanes only when selected. |

## Boundaries retained

- TEST/EXPERIMENTAL is not canon.
- Preview is not visual approval.
- A route is not permission to execute.
- Chroma and UI-FX do not write into a host automatically.
- Phone Drop is explicit, expiring and local-LAN only.
- Source exports remain intact for provenance and rollback comparison.

