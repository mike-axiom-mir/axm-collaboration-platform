# Game Visual Choice Layers — Evidence Matrix

Status: `EXPERIMENTAL` candidate evidence. None of this is installation,
promotion, canonization, or approval.

| Claim | Kind | Native evidence | Countercheck | What it does not prove |
|---|---|---|---|---|
| Six game visual contracts exist and have resolvable local JSON Schema references | Static structure | `shared/asset-hands/schema-contract-selftest.js` reports 116 schemas | `service.contract.json` maps every runtime tag to a portable file | Runtime behavior or good art direction |
| Selection is pure and deterministic | Deterministic behavior | `game-visual-pack-selftest.js` repeats seven known-input scenarios | `pilots/game-visual-choice-proof.json` records request digests and replay equality | Behavior inside an integrated external game engine |
| The minimum declared machine retains the bundled 8-bit baseline | Deterministic behavior | `axm.game-visual-baseline-receipt/v1` is `PASS` in the proof | Live browser old-machine route keeps Pixel 8 active when Pixel 16 is refused | Performance on a real vintage PC; fixtures are declared, not measured hardware |
| Recommendations do not activate packs | Authorization | Family-laptop recommendation returns `READY_FOR_CHOICE` with `selection: null` | Live browser changes layer only after clicking “Choose recommendation” | That every future host UI will preserve this authority boundary |
| A capable machine can still choose the baseline | Interaction journey | `family-player-overrides-to-baseline` returns `SELECTED` for Pixel 8 | Live browser pack card returns the stage and linked asset to Pixel 8 | Player preference or visual quality |
| Incompatible and missing packs never silently fall back | Deterministic behavior | Typed `INCOMPATIBLE_VISUAL_PACK` and `MISSING_VISUAL_PACK` scenarios assert `fallback_used: false` | Browser refusal status leaves active pack and save digest unchanged | Pack installation, download, or runtime hot-swap in a shipped game |
| Visual choice does not mutate save truth | Deterministic behavior | All seven proof scenarios have equal before/after save digests | Browser remained at save digest `283b46b5951e1312` through 8/16 selection and two refusals | Persistence across a real game restart; this pilot is browser-memory only |
| The whole-game stage visibly changes between Pixel 8 and Pixel 16 | Visual appearance | `evidence/live-16bit-selected.png` | `evidence/live-old-machine-refusal.png` shows the retained baseline state | Taste, originality, accessibility, or a complete production asset pack |
| The film is playable and linked asset controls still work | Interaction journey / timing | Live browser video reached ready state 4 and advanced to 0.714 seconds of 20 seconds via playback controls | Integer zoom changed 5x to 6x and one-year idle kept condition 100 | Continuous long-run playback or frame-perfect browser timing |
| Human quality approval remains outstanding | Taste / meaning | Explicit boundary in contracts, UI, and capability report | Mike is the only merge/canon gate | Approval cannot be inferred from tests or screenshots |

## Live-capture boundary

The available browser hand supports repeated screenshots, not
`visual.capture.ephemeral-rolling-buffer/v1`. Two deliberately selected proof
frames were retained. No raw rolling video buffer was created or claimed.
