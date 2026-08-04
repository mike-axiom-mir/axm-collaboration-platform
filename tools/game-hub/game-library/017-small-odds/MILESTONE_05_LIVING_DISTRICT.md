# Milestone 05 - Lopsided Lane Living District

Status: **verified local pre-alpha slice**.

## Why this milestone exists

The storefront made generated objects commercially meaningful, but its buyers still lived mostly inside receipts and callbacks. Lopsided Lane gives those transactions a physical destination: authored residents keep schedules, notice real object states, accept relevant gifts, receive sold parcels, and leave visible evidence at Pip's parents' house.

## Playable system

- Travel to Lopsided Lane as a sixth walkable location with its own animated street, four residents, lampmoss, tram-lung, parcel-spine, and parents' window.
- Meet Tavi Spool, Oola Ninehands, the Nibbin Choir, and Granduncle Latch. Each follows four public day phases with authored places and activity text; schedule selection has no random roll.
- Inspect distinct reactions to objects Pip carries, lists in escrow, gives, or sells and later delivers. Reaction priority is `gifted > sold-and-delivered > listed > carried > ordinary`.
- See context reactions only when both the current authored world event and the object's actual tags match.
- Give a held object to a resident. The item leaves inventory, relationship changes are exact, the house can gain one point, and Mum/Dad keep a visible, auditable thank-you mark.
- Accept an alien-web sale and disclose the buyer's fixed resident destination and due day. The parcel later resolves through the lane, creates neighborhood memory, and can add a parcel-periscope at home.
- Audit observation, gift, and delivery records. All declare `random: false`, ignored money where relevant, and `portalOddsChanged: false`.
- Use two authored local activities tied to Tavi and Oola while retaining the existing no-quest living-world structure.

## State and evidence contracts

- Save version 5 migrates v1/v2/v3/v4 lives. Older saves gain an empty district state; migration never fabricates visits, gifts, deliveries, relationships, or house marks.
- Observation receipt: `small-odds.district-observation/v1`.
- Gift receipt: `small-odds.district-gift/v1`.
- Delivery receipt: `small-odds.district-delivery/v1`.
- Storefront sale receipts now disclose the scheduled district delivery when a buyer has a fixed resident route.
- Parent and home changes reference the exact receipt that caused them.

## Verification snapshot

- Core/runtime/server suite: **45 passed, 0 failed**.
- Standalone package self-tests: **9 passed, 0 failed**.
- Full package suite: **54 passed, 0 failed**.
- Isolated AXM verifier: **0 errors, 0 warnings**.
- JSON validation: **20 files parsed before evidence expansion; final package pass recorded in the build receipt**.
- Health endpoint: **HTTP 200**.
- Live desktop journey: **PASS** for schedule changes, listed-state gossip, relevant gift, exact gift receipt, fixed sale destination, next-day delivery, delivery receipt, and home echo.
- Reload persistence: **PASS** for Day 19, Lane location, relationship, gift, delivery, house score/marks, storefront history, and receipt continuity.
- Narrow captured page surface 375x811: **PASS** for one-column resident cards, reachable close/action controls, preserved accessible names, and bounded panel scrolling.
- Browser diagnostics: **0 errors, 0 warnings**.

Selected still frames prove the named rendered states, not continuous animation frame pacing. The full planetary economy, production asset pipeline, longitudinal balance, physical accessibility audit, multiplatform distribution, and external comparative-quality evidence remain open.
