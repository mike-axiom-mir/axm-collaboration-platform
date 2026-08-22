# Milestone 03 - Living Threads

Status: **verified local pre-alpha milestone**

Living Threads turn the right-side activity rail from a catalog of repeatable actions into the beginning of a persistent social simulation. People and places develop authored situations from the current life. Pip can respond with time, energy, money, ethics, or a genuinely relevant object; the world remembers the choice and may answer days later. If Pip does nothing, the situation continues without becoming a paused quest.

## Current thread families

1. Dad's shelf remembers being a ladder - three approaches involving time, a suitable object, or reputation risk.
2. Dinner applies for legal personhood - four approaches through paperwork, object testimony, money, or hunger.
3. Smaller machine-shells follow Shellby - four approaches spanning courage, shelter, betrayal, and municipal routes.
4. The Price Oracle values Auntie Grift's memory - four approaches through listening, appraisal, gift, or rumor commerce.
5. A Starspite patron alleges Pip stole their streak - four approaches through mathematical education, object evidence, care, or profitable deception.

That is 19 authored responses. Object approaches appear only when an inventory item's real tags intersect the declared suitability tags. Used objects lose durability, gain value and reaction history, and remain eligible for their independent complete-signature trigger.

## Simulation contract

- Emergence is deterministic from day, place, world-event index, relationships, unlocked locations, cooldowns, and current thread state.
- Thread definitions contain no weight or rarity field.
- At most two situations are active. One may emerge per planetary day.
- Every situation has an `expiresDay` and an authored unattended result.
- A selected response writes `small-odds.life-choice/v1` with `random: false`, costs, item contribution, applied effects, and delayed due day.
- Delayed consequences resolve during calendar progression, apply effects, wake matching item triggers, and write new history.
- Save version 3 migrates older lives and preserves all prior systems.

## Verification

- Focused suite: **33 passed, 0 failed**.
- Package suite: **7 passed, 0 failed**.
- Isolated package verifier: **0 errors, 0 warnings**.
- Live desktop: emergence, dedicated scene tableau, four response cards, matching-object route, immediate consequence, delayed return, receipt audit, and existing v2 migration passed.
- Live 390x844: no horizontal overflow, panel bounds within the viewport, initial `scrollTop: 0`, completed mobile choice, and reload-preserved history/pending consequence passed.

## Defects preserved and repaired

- Initial life-card symbols were double-encoded in the live browser. Source Unicode and a package regression check repaired the seam.
- A sentence used as an item-reaction source produced `..`. Terminal punctuation is now normalized and deterministically tested.
- The first UI did not expose the promised life receipt. The journal now routes each choice to a dedicated causality receipt panel.

## Honest boundary

This is a systemic grammar with five families, not a planet-scale content claim. Actor schedules, interdependent multi-actor threads, generational memory, business and pet participation, large variant pools, localization, longitudinal balance, independent desirability evidence, production art, and continuous-frame capture remain open.
