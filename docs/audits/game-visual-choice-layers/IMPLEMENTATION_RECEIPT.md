# AXM Game Visual Choice Layers — Implementation Receipt

Date: 2026-08-12  
Status: `EXPERIMENTAL` · installed: false · promoted: false · canonical: false

## Outcome

The platform now has a bounded game-wide visual-pack seam above the existing
asset representation system. A visual overhaul can replace every declared
presentation slot while the simulation, gameplay proxies, object identities,
and save remain stable. Compatibility may produce a recommendation, but cannot
activate it. A requested pack either resolves exactly or returns a typed
refusal; it never silently chooses a cheaper pack.

## Added contracts

- `axm.game-visual-contract/v1`
- `axm.game-visual-pack/v1`
- `axm.hardware-capability-profile/v1`
- `axm.game-visual-pack-inventory/v1`
- `axm.game-visual-selection-request/v1`
- `axm.game-visual-selection-result/v1`

The request carries both the selection machine and the game contract's minimum
machine profile, so the baseline proof is portable and does not depend on a
hidden pilot catalog.

## Executable behavior

- The pure resolver checks the exact game-contract digest, pack-content digest,
  all nine required visual slots, representation-profile bindings, inventory,
  and declared runtime resources.
- `recommend` returns `READY_FOR_CHOICE` and never a selection.
- `select` requires an explicit pack id or an explicitly accepted
  recommendation.
- Exact typed refusals are `MISSING_VISUAL_PACK`,
  `INCOMPATIBLE_VISUAL_PACK`, and `PACK_CONTRACT_MISMATCH`.
- Every route reports `fallback_used: false` and preserves the save digest.
- The bundled Pixel 8 baseline passes the declared minimum-machine receipt.
- A more capable machine may still choose Pixel 8; fidelity is a choice, not a
  forced ladder.

## Capability growth

`game-visual-pack-selection` is the fortieth registered Asset Hand. Asset Hands
and Asset Fabric load its browser-safe core and provider, advertise the new
contracts, and retain their existing no-install/no-promotion boundaries. The
Workshop tools index now discovers the visual-choice capabilities.

## Live proof

The Choice-First Visual Lab v0.2 includes a complete game-layer selector,
declared hardware fixtures, advisory recommendation, exact pack cards, stable
truth/save digests, and a whole-park 8-bit/16-bit stage. Successful selection
also drives the existing identity-bound asset renderer. Live interaction proved:

- Family laptop + accepted recommendation → `SELECTED`, Pixel 16 on both game
  stage and asset renderer.
- Museum PC + Pixel 16 request → `INCOMPATIBLE_VISUAL_PACK`, Pixel 8 retained.
- Creator desktop + cinematic request → `MISSING_VISUAL_PACK`, Pixel 8 retained.
- Save digest stayed `283b46b5951e1312`; fallback stayed false.
- One-year idle kept condition at 100; zoom moved from 5x to 6x.
- The 20-second film reached ready state 4 and advanced under browser controls.
- Browser console messages: none.

Selected screenshots and their SHA-256 digests are in `live-browser-evidence.json`.
The browser hand supports repeated screenshots, not a rolling buffer; no raw
video capture is claimed.

## Verification

Focused implementation tests, all ten AGENTS.md-required checks, Asset Hands,
Asset Fabric, schema resolution, 55 HTML script surfaces, and live browser
interaction pass. Deterministic proof digest: `9a6cc1b9ed6e685b`.

The repository aggregate remains `PARTIAL` for two unrelated failures preserved
in `verification-receipt.json`: the known Casino-alpha browser/phone-QA stance
check and a dormant physical-controller static-contract assertion. Operations,
Asset Hands completion, Asset Hands upgrades, and workspaces pass when continued
after the aggregate stop.

## Honest remainder

- These are declared hardware fixtures, not actual device detection or measured
  performance.
- The platform has portable contracts and candidate packs; neither game has a
  runtime adapter yet.
- Realtime 3D and cinematic are advertised but unavailable.
- Mike's review is still required for originality, readability, animation,
  usefulness, and canon/merge decisions.
