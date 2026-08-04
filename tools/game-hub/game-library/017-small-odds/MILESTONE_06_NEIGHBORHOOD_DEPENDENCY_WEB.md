# Milestone 06 - Neighborhood Dependency Web

Status: **VERIFIED local pre-alpha slice**.

This milestone deepens Lopsided Lane without multiplying shallow map markers. Each resident now has one repeatable authored arc, and all four arcs cross a persistent supplier household whose standing changes the street, the business, Living Threads, and Pip's parents' house. Nothing in this layer consumes entropy or changes portal/casino odds.

## Repeatable resident arcs

- Tavi Spool, Oola Ninehands, the Nibbin Choir, and Granduncle Latch each own one authored arc with two choices.
- Availability is an explicit relationship prerequisite plus a public day cooldown.
- Each choice states its time/resource effects, Crooked Kettle standing change, known return day, and cooldown end.
- Returns resolve exactly once, change authored resident/home/business state, and leave a visible kettle-crate memory at home.
- Arc cycles persist and can become eligible again after their cooldown; they are not one-shot quests or random events.

## Crooked Kettle Cooperative

- Supplier standing persists across four disclosed bands: `STRAINED` (x0.90), `BALANCING` (x1.00), `STOCKED` (x1.06), and `FLOURISHING` (x1.12).
- The active band selects authored Lane schedule overrides. No schedule roll, weight, pity, wealth check, or hidden personality score participates.
- The same disclosed factor multiplies daily storefront service income and appears in its exact receipt.
- The household is one bounded dependency node, not a planetary supplier graph.

## Relationship-routed Living Threads

- Four existing Living Thread families gain one neighbor route each: Latch for Dad's shelf, Tavi for dinner, Oola for Shellby's procession, and the Nibbin Choir for Grift's memory.
- Each route requires rapport 3 with its named resident, displays why it unlocked, applies exact resident/supplier effects, and keeps the existing delayed/unattended life-state model.
- The Starspite thread remains unchanged. The total authored Life Thread approaches is now 23.

## Receipts and save continuity

- `small-odds.district-arc-choice/v1` binds prerequisite, cycle, choice, costs/effects, supplier transition, due day, cooldown, `random:false`, and unchanged portal odds.
- `small-odds.district-arc-return/v1` binds the scheduled return, resident/home/business/supplier effects, house mark, `random:false`, and unchanged portal odds.
- `small-odds.life-choice/v1` records `neighborRoute` only when the relationship-gated route is used.
- Save version 6 migrates v1-v5 lives. A v5 life receives neutral supplier standing and empty arc/cooldown history rather than a fabricated past.

## Verified journey

The live v5 save resumed on Day 19. Pip chose Tavi's `COUNT EVERY ROOT VOTE`, moving Tavi rapport 1 to 3 and Crooked Kettle standing 0 to 2 (`STOCKED`). Resident schedules changed to authored stocked overrides and daily service income used the disclosed x1.06 factor. On Day 21 the return resolved once, raising home 10 to 11, storefront rating 6 to 7, and Tavi rapport 3 to 4 while adding a kettle-crate house mark. On Day 22 Dad's shelf exposed Latch's rapport-gated neighbor route; resolving it changed home 11 to 13, Latch rapport 5 to 7, and supplier standing 2 to 3. Reload preserved all of that state.

Desktop, 390x844 responsive, accessibility-semantic, persistence, and console audits passed. Live QA found one long-title mobile header overflow; the repaired header wraps while keeping its 38x38 close control inside the viewport.

## Boundary

This proves one bounded multi-system dependency household. It does not prove a citywide economy, competitors, employees, pet labor, planetary content, continuous frame pacing, longitudinal balance, physical assistive-technology coverage, production distribution, or external comparative quality.
