# Lopsided Lane evidence route - atomic claims

## authored-schedules

claim: Four residents change authored position and activity across four public day phases without a hidden roll.
kind: deterministic behavior / visual state
risk: medium
pass_condition: focused tests reproduce phase assignments from the same hour; live semantic state changes Tavi/Oola presence as time advances; receipts declare `random:false`.
primary_surface: `tests/systems.test.mjs` plus live Day 18/19 browser journey.
counterevidence: an entropy seed, weight, pity field, or non-reproducible schedule appears.
secondary_surface_if_needed: `DISTRICT_RESIDENTS` data inspection.
observed_evidence: schedule tests passed; live highglow/afterglow/foreglow states showed the authored resident changes.
verdict: PASS
named_seam: authored district data <-> calendar phase <-> Canvas/DOM resident presentation.

## object-state-gossip

claim: Residents distinguish carried, escrow-listed, gifted, and sold-and-delivered objects, with context prose requiring real event and item tags.
kind: deterministic behavior / causal explanation
risk: high
pass_condition: focused fixtures produce all four states; a listed object remains listed rather than sold; context matching fails if either event or tag is absent; inspection receipt identifies exact inputs.
primary_surface: focused systems tests and `small-odds.district-observation/v1`.
counterevidence: state is guessed from prose, escrow is treated as ownership transfer, context uses partial tag signatures, or money changes the observation.
secondary_surface_if_needed: live resident card and audit panel.
observed_evidence: all state and context tests passed; live Tavi/Oola cards noticed the escrowed Contract under Neighborhood Power Nap with a non-random receipt.
verdict: PASS
named_seam: inventory/business ownership <-> district observation <-> current world event.

## resident-gift

claim: A relevant gift transfers one exact item, changes one resident relationship, and leaves an auditable parent/house consequence without changing odds.
kind: deterministic behavior / persistence
risk: high
pass_condition: the held item disappears once, matching tags and gains appear in `small-odds.district-gift/v1`, the house mark references the same receipt, and reload preserves it.
primary_surface: focused gift test plus live Granduncle Latch journey.
counterevidence: duplication, arbitrary bonus, missing receipt, fabricated random field, or lost reload continuity.
secondary_surface_if_needed: home panel and recent-consequence ledger.
observed_evidence: the Bureaucratic Timefelt Remembering Brick left inventory, Latch gained 5 rapport, home gained 1, Dad hung a thank-you pennant, and the exact receipt survived reload.
verdict: PASS
named_seam: held item <-> resident relationship <-> parents' house.

## fixed-delivery

claim: A completed storefront sale schedules and resolves a disclosed buyer-to-resident route on a fixed day.
kind: deterministic temporal behavior
risk: high
pass_condition: the sale names due Day and resident; day advance resolves exactly once; delivery receipt binds buyer, listing, item, price, fixed route, and unchanged portal odds.
primary_surface: focused sale/delivery test plus live Day 18 to Day 19 journey.
counterevidence: delivery picks a resident randomly, duplicates, resolves early, restores sold ownership, or omits the route.
secondary_surface_if_needed: storefront history and district parcel-spine row.
observed_evidence: Auntie Grift's Other Neighbor mapped to Granduncle Latch; the 194-credit Contract arrived on Day 19 with `small-odds.district-delivery/v1`, `random:false`, and the fixed-route record.
verdict: PASS
named_seam: completed storefront sale <-> calendar <-> neighborhood parcel spine.

## family-echo

claim: District consequences become visible at home without becoming quests.
kind: cross-location persistence / visual consequence
risk: medium
pass_condition: gift/delivery house marks change the renderer and home panel, carry parent-authored text, provide an audit route, and persist across reload.
primary_surface: live house panel and selected desktop frame.
counterevidence: the result exists only in a log, presents an objective/checklist, lacks a causal receipt, or disappears after reload.
secondary_surface_if_needed: house renderer source and state snapshot.
observed_evidence: the home panel showed `THE HOUSE NOTICED · NOT A QUEST`, a parcel-periscope explanation, all four district relationships, and an audit control after reload.
verdict: PASS
named_seam: district history <-> home state <-> Canvas/DOM house evidence.

## responsive-accessible-visuals

claim: The district scene and panel remain readable and operable at desktop and narrow sizes with meaningful accessible names.
kind: visual appearance / accessibility semantics
risk: medium
pass_condition: desktop scene retains Pip, residents, hotspots, travel, and dock; panel remains bounded; narrow panel becomes one column; Lane/action/close controls retain names; console remains clean.
primary_surface: selected browser frames plus semantic snapshots.
counterevidence: horizontal loss, hidden close/action controls, glyph-only names, obscured Pip, or browser warnings/errors.
secondary_surface_if_needed: responsive CSS and package self-test.
observed_evidence: desktop 1280x720 and captured page surface 375x811 passed; semantic snapshots exposed named controls and dialogs; console returned zero errors/warnings.
verdict: PASS
named_seam: Canvas scene <-> responsive panel CSS <-> accessibility tree.

## scope-boundary

claim: This milestone adds one genuine district loop but does not prove the full planetary or best-on-Earth objective.
kind: quality / evidence boundary
risk: high
pass_condition: planetary volume, production assets, longitudinal balance, physical accessibility, continuous-frame, distribution, and external-comparison gaps remain explicit.
primary_surface: `CAPABILITY_GAPS.md`, `KNOWN_LIMITS.md`, and capability comparison.
counterevidence: the milestone calls the complete game finished or promotes a missing capability without native proof.
secondary_surface_if_needed: independent review.
observed_evidence: `living-district` is READY while the overall comparison remains BLOCKED.
verdict: PASS
named_seam: verified vertical slice <-> aspirational product claim.
