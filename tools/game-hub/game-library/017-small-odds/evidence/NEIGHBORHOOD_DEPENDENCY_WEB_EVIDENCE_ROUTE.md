# Neighborhood Dependency Web evidence route - atomic claims

## repeatable-authored-arcs

claim: Each Lane resident has a repeatable two-choice arc gated only by disclosed relationship, due-day, and cooldown state.
kind: deterministic temporal behavior
risk: high
pass_condition: four arcs map one-to-one to residents; locked/eligible/pending/cooldown states reproduce from saved data; returns resolve once; a new cycle opens after cooldown; no entropy field appears.
primary_surface: focused systems tests plus live Tavi Day 19-24 state observations.
counterevidence: weighted availability, hidden luck, duplicate return, skipped cooldown, or permanent quest acceptance.
observed_evidence: all four catalog contracts passed; the live Tavi arc showed prerequisite 1, due Day 21, cooldown Day 24, resolved once, and remained repeatable.
verdict: PASS
named_seam: relationship state <-> authored arc calendar <-> persistent district history.

## persistent-supplier-state

claim: Crooked Kettle standing selects one disclosed schedule band and one disclosed business-service factor.
kind: deterministic cross-system state / arithmetic
risk: high
pass_condition: band boundaries reproduce exactly; Lane positions use the selected authored override; daily-income receipt includes the same factor and formula; portal/casino state is ignored.
primary_surface: supplier-factor tests, daily receipt, and live balancing-to-stocked transition.
counterevidence: randomized schedules, undisclosed factor, wealth/history input, or changed RNG tables.
observed_evidence: standing 0 used BALANCING/x1.00; standing 2 used STOCKED/x1.06 and stocked schedule labels; Day 20 income was 39 with supplierFactor 1.06 in the exact formula.
verdict: PASS
named_seam: district supplier <-> Lane schedules <-> storefront service income.

## authored-return-crossing

claim: A scheduled arc return changes resident, home, business, and supplier state exactly once and leaves an auditable visual memory.
kind: persistence / causal explanation / visual state
risk: high
pass_condition: return receipt binds the scheduled choice and exact deltas; a kettle-crate mark links the same receipt; repeat day advancement cannot duplicate the return.
primary_surface: focused return test and live Day 21 return.
counterevidence: duplicate effects, unlinked house decoration, inferred randomness, or missing reload continuity.
observed_evidence: Tavi's return moved home 10->11, rating 6->7, rapport 3->4, created one kettle-crate mark, and was absent from the pending queue after resolution.
verdict: PASS
named_seam: scheduled district return <-> home memory <-> business rating.

## relationship-routed-life-choice

claim: Four existing Living Thread families expose one neighbor route only when the named resident has rapport 3 or more.
kind: deterministic option gating / cross-location consequence
risk: high
pass_condition: each route is absent below threshold, visible at threshold, identifies the resident, applies declared resident/supplier effects, and uses the existing non-random life receipt.
primary_surface: focused route test plus live Day 22 Dad-shelf/Latch journey.
counterevidence: route appears without rapport, uses a generic neighbor, changes odds, or loses delayed consequence continuity.
observed_evidence: Latch route appeared at rapport 5, moved rapport 5->7, home 11->13, supplier 2->3, and wrote exact `neighborRoute` data with `random:false`.
verdict: PASS
named_seam: resident relationship <-> Living Thread choice <-> supplier/home state.

## migration-without-fabricated-history

claim: A v5 save migrates to v6 with neutral supplier state and no invented arc cycles, choices, returns, or cooldowns.
kind: persistence / data integrity
risk: high
pass_condition: migration retains prior world/business/district continuity while initializing only neutral v6 fields.
primary_surface: focused v5-to-v6 migration test and live Continue journey.
counterevidence: fabricated completion, standing, house mark, cooldown, or lost inherited state.
observed_evidence: focused test produced standing 0/cycles 0/empty arc history; the live v5 save retained Day 19, Lane, business rating, relationships, and prior house marks.
verdict: PASS
named_seam: v5 localStorage <-> v6 dependency state.

## responsive-accessible-persistent-ui

claim: The dependency panel remains operable on desktop and 390x844, persists after reload, and exposes meaningful accessible names without console faults.
kind: visual appearance / accessibility semantics / persistence
risk: medium
pass_condition: arc choices and supplier state fit a bounded panel; mobile choices collapse to one column; title and close remain inside viewport; reload restores state; unnamed controls and browser errors/warnings are absent.
primary_surface: live in-app browser journey and computed geometry/semantic inspection.
counterevidence: clipped controls, horizontal overflow, missing label, state loss, or browser diagnostic fault.
observed_evidence: live QA found and repaired a long-header overflow; final close geometry was 38x38 and bounded, choice grid was one column, scrollWidth matched the panel, reload restored Day 22 state, and console errors/warnings were zero.
verdict: PASS
named_seam: dependency DOM <-> responsive CSS <-> local persistence <-> accessibility tree.

## scope-boundary

claim: Milestone 06 is ready while the enormous persistent product objective remains open.
kind: quality / evidence boundary
risk: high
pass_condition: planetary volume, production assets, continuous-motion evidence, long-run balance, physical accessibility, distribution authority, and external comparison remain explicitly unpromoted.
primary_surface: capability comparison, `CAPABILITY_GAPS.md`, and `KNOWN_LIMITS.md`.
counterevidence: the slice is called the finished game or a missing capability is promoted without native proof.
observed_evidence: the dependency-web requirement is satisfied while overall route remains DEGRADED/BLOCKED.
verdict: PASS
named_seam: verified bounded slice <-> aspirational whole-product claim.
