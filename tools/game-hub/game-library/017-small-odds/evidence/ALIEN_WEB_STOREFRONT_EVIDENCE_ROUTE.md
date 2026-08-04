# Alien-Web Storefront evidence route - atomic claims

## storefront-model

claim: Generated objects can enter reversible escrow, remain unavailable for ordinary actions, delist unchanged, or leave ownership through a completed sale.
kind: deterministic behavior / persistence
risk: medium
pass_condition: focused tests observe inventory removal, listing state, exact object return, sale removal, and v4 reload continuity.
primary_surface: `tests/systems.test.mjs` plus live reload journey.
counterevidence: the object remains usable while listed, duplicates, disappears on delist, or reappears after sale.
secondary_surface_if_needed: serialized save inspection through normal export.
observed_evidence: focused escrow test passed; live listing persisted through reload; accepted Compass remained sold.
verdict: PASS
named_seam: inventory ↔ business escrow ↔ save migration.

## deterministic-offer

claim: Buyer routing and price use disclosed deterministic state, never hidden RNG or cash-on-hand adaptation.
kind: deterministic behavior
risk: high
pass_condition: identical non-money state yields the same buyer, factors, raw offer, rounded offer, and ceiling; receipt declares `random:false`, `moneyIgnored:true`, and `portalOddsChanged:false`.
primary_surface: held-input focused test plus `small-odds.storefront-offer/v1` inspection.
counterevidence: money changes the receipt, an entropy seed appears, a factor is omitted, or the buyer cannot be reproduced.
secondary_surface_if_needed: live receipt panel with all eleven multipliers and buyer score.
observed_evidence: cash values 3 and 900,000 produced identical receipts; desktop/mobile receipt panels showed all factors and Vesper/Grift-neighbor routing scores.
verdict: PASS
named_seam: authored buyer router ↔ offer arithmetic ↔ player-facing receipt.

## counter-choice

claim: Counteroffers move by a visible patience rule toward a hard ceiling and never accept less than an already above-ask offer.
kind: deterministic behavior / interaction journey
risk: medium
pass_condition: focused counters increase without exceeding the ceiling; above-ask counter is rejected; live UI disables it as `OFFER BEATS ASK`.
primary_surface: focused counter regression tests.
counterevidence: counter result exceeds ceiling, uses chance, reduces an above-ask price, or presents a misleading enabled control.
secondary_surface_if_needed: live desktop and phone offer cards.
observed_evidence: tests passed; the live 385-vs-335 defect was reproduced, repaired, and visually rechecked.
verdict: PASS
named_seam: price arithmetic ↔ offer control state.

## pets-upgrades-branches

claim: One assigned pet contributes literal stackable traits, while branches/upgrades add declared business capability without changing RNG tables.
kind: deterministic behavior / static contract
risk: medium
pass_condition: Accountant/Pockets/Helpful/Tax-Scented stack exactly; irrelevant live pet traits show 1.00; capacity/branch tests pass; rarity total remains 1,000,000.
primary_surface: focused behavior tests.
counterevidence: all pets get a generic bonus, unassigned pets affect offers, branch changes rarity, or capacity disagrees with the UI.
secondary_surface_if_needed: live pet-shift and upgrade journey.
observed_evidence: synthetic four-trait pet produced exact expected profile; live Ledger correctly contributed no generic multiplier; listing nest changed 2 slots to 3.
verdict: PASS
named_seam: pet trait catalog ↔ assigned shift ↔ commerce factors.

## delayed-buyer-life

claim: A sold object returns later as an authored buyer callback with causal rating/reputation effects.
kind: deterministic behavior / temporal interaction
risk: medium
pass_condition: sale schedules a future day, removes item ownership, later day resolves one callback receipt, and UI/history show the returning object story.
primary_surface: focused day-advance test.
counterevidence: callback resolves without a sale, never resolves, duplicates, or restores sold inventory.
secondary_surface_if_needed: live Compass sale across Day 16→18.
observed_evidence: live Vesper callback returned on Day 18 with rating +2/reputation +1; focused callback test passed.
verdict: PASS
named_seam: completed sale ↔ calendar ↔ storefront memory.

## desktop-visuals

claim: The desktop storefront, receipt, and room terminal are readable and visually integrated at 1280x720.
kind: visual appearance / interaction journey
risk: medium
pass_condition: offer/ask/ceiling/actions are legible; receipt factors fit a bounded panel; room terminal and shipment props appear without hiding Pip or controls.
primary_surface: selected screenshots at 1280x720.
counterevidence: clipped actions, unreadable factor table, panel overflow, or world props hiding primary characters/controls.
secondary_surface_if_needed: semantic snapshot and browser interaction.
observed_evidence: three desktop proof frames plus full live journey.
verdict: PASS
named_seam: DOM panel ↔ Canvas room renderer.

## phone-visuals

claim: The storefront listing and receipt remain usable on the narrow in-app browser surface.
kind: visual appearance / interaction journey
risk: medium
pass_condition: no horizontal clipping; three prices stack; accept/audit/delist and disabled counter remain reachable; factor table is readable.
primary_surface: selected captured page surface frames at 375x811 (outer target 390x844).
counterevidence: horizontal overflow, unreachable controls, obscured close button, or collapsed price meaning.
secondary_surface_if_needed: semantic snapshot after resize.
observed_evidence: live listing and receipt screenshots passed; reload-preserved state reopened through touch-sized dock control.
verdict: PASS
named_seam: responsive panel CSS ↔ in-app browser viewport chrome.

## scope-boundary

claim: This milestone improves local economy depth but does not prove the complete planetary or best-on-Earth objective.
kind: quality / evidence boundary
risk: high
pass_condition: production, planetary-volume, longitudinal-balance, physical-accessibility, continuous-frame, and external-comparative gaps remain explicit.
primary_surface: `CAPABILITY_GAPS.md`, `KNOWN_LIMITS.md`, and capability comparator.
counterevidence: milestone documentation calls the full game finished or promotes missing capability without native proof.
secondary_surface_if_needed: independent review.
observed_evidence: full objective remains DEGRADED; storefront slice is READY.
verdict: PASS
named_seam: verified vertical slice ↔ aspirational product claim.
