# Milestone 07 - Paid Neighborhood Production

Status: **VERIFIED local pre-alpha slice**.

This milestone turns one Lopsided Lane household into both an employer and a competitor. The Long Table Works posts one authored order per day, hires Pip through the existing business, pays from a public formula, recognizes literal pet skills as labor, and returns consequences across the street, supplier, storefront, resident, pet, tool, and parents' house. This layer is deterministic and does not alter portal or casino odds.

## Authored work calendar

- Three work orders rotate by `(day - 1) modulo 3`; there is no work-order roll, weight, pity, or adaptive selection.
- Each order names a resident requester, required object tags, relevant pet species/trait tags, base pay, tool wear, and due day.
- Pip must own a matching carried object, have an assigned pet, operate a business, and have enough energy.
- Listings and equipped storefront assets are not silently borrowed as work tools; ownership state is part of the contract.

## Employer and competitor pressure

- `SHARE THE SHIFT AND MEASUREMENT` trades more time for standing, supplier goodwill, and lower pressure.
- `BEAT THE LONG TABLE'S BID` pays a disclosed premium, uses more energy, and increases rivalry pressure.
- Pressure persists across `CORDIAL`, `WATCHING`, and `CONTESTED` bands with public wage factors of x1.00, x0.96, and x0.90.
- Standing and pressure affect only this authored employment layer. They do not feed portal rarity, casino results, or hidden personal luck.

## Literal pet labor and exact pay

- A matching pet species tag contributes one labor point; each matching named trait tag contributes two.
- Unrelated traits contribute exactly zero. The UI lists every point and reason before Pip accepts the shift.
- Tool tags contribute four credits each, capped at three; pet labor contributes five credits per point; storefront rating contributes at most twelve credits.
- The frozen wage is `round((base pay + tool + pet + rating) x supplier factor x pressure factor x approach factor)`.

## Cross-system return

- Starting work spends energy and exactly one durability on the selected owned tool, then freezes the quote and due day.
- The return resolves once and can change credits, work standing, rivalry pressure, Crooked Kettle standing, storefront rating, a named resident relationship, home score, and the assigned pet's affection/mood.
- A `workbench-stamp` remains visible at home and links back to the causal receipt.
- Work standing 2 unlocks `FILE THE AFTERNOON AS PAID TRAINING` inside the existing Price Oracle Life Thread. It is an employment-routed choice, not a new quest or random event.

## Receipts and save continuity

- `small-odds.work-order-start/v1` binds the authored calendar order, selected owned tool and durability, literal pet matches, complete wage arithmetic, approach, scheduled effects, `random:false`, and unchanged portal odds.
- `small-odds.work-order-return/v1` binds exact pay and every applied cross-system delta.
- `small-odds.life-choice/v1` records `workRoute` only when the work-standing route is used.
- Save version 7 migrates v1-v6 lives. A v6 life receives neutral work standing/pressure and empty work history rather than a fabricated employment past.

## Verified journey

The live v6 save resumed on Day 22. One honest portal draw created the carried `Jealous Mood-Brass Unlicensed Key`; its `precision` and `power` tags matched Tavi's authored payroll-sleeve order. Ledger contributed five literal labor points: one legal species match and two matching named traits worth two points each. The cooperative quote froze at 70 credits from `(26 + 8 + 25 + 7) x 1.06 x 1.00 x 1.00`, spent seven energy and one tool durability, and left portal charges unchanged.

On Day 23 the return paid exactly 70 credits and resolved once: work standing 0 to 2, rivalry pressure remained 0 after clamping, Crooked Kettle standing 3 to 4, storefront rating 7 to 8, Tavi rapport 4 to 5, and the work contribution to home 13 to 14. Sleep's existing home effect then produced the visible total 15. Ledger gained affection and the mood `proudly named on the invoice`; Dad added an auditable workbench stamp. Daily business service separately paid 32 credits, so the total wallet moved 1,595 to 1,697 without conflating that receipt with the wage.

Reload preserved the completed order, standing, pressure, rating, supplier state, tool wear, pet state, home mark, and receipts. Desktop and 390x844 checks passed after live QA repaired a missing start-receipt wage header and raised mobile close/work controls to at least 44 px. The narrow panel stayed one column with no horizontal overflow; all visible buttons were named, Canvas/main/navigation/dialog semantics were present, and browser errors/warnings were zero. Two sampled Lane frames showed visibly changed animated positions, but continuous frame pacing remains unproved.

## Boundary

This proves one bounded employer/competitor household and one paid production chain. It does not prove a citywide labor market, autonomous employees, many competitors, planetary content, production art/animation, longitudinal balance, physical assistive-technology coverage, distribution readiness, continuous frame pacing, or external comparative quality.
