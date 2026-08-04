# Milestone 04 - Alien-Web Storefront

Status: **verified local pre-alpha slice**.

## Why this milestone exists

The original business converted an item into rating and paid one opaque daily number. That contradicted the game's strongest promise: random objects should gain use, value, ownership history, and consequences through a lived world. The Alien-Web Storefront turns commerce into a decision system without falsifying randomness.

## Playable system

- Open one of three bedroom businesses and display it as a local alien-web terminal in the room.
- Keep an item, instantly sell it at the market, equip it as recoverable store machinery, or place it into reversible escrow.
- Route each listing to one of five authored buyers through a deterministic score using item affinity, avoided tags, one existing relationship, and a rotation tie-break.
- Calculate offers from eleven disclosed factors: item condition, storefront match, buyer affinity, current world event, reputation, buyer relationship, matching equipment, permanent branch, trust upgrade, assigned-pet traits, and item-specific pet context.
- See the posted ask, current offer, and deterministic buyer ceiling before choosing to accept, counter, wait, or delist.
- Counter by a published patience formula. A buyer at or above the ask cannot be countered downward.
- Receive daily service income with its own exact formula and `random: false` receipt.
- Sell an item and receive an authored buyer callback on a later day. The callback remembers the object's rarity and reaction history plus family packing and pet assistance.
- Assign one pet. Traits stack literally: Accountant changes offers/service, Pockets adds a slot, Helpful improves callbacks, Tax-Scented applies only to legal/debt listings, and unrelated traits create no fake bonus.
- Install four infrastructure upgrades and choose one of two permanent branches for each business identity. No business capability alters portal rarity, the one-in-a-million ticket, or casino outcomes.

## State and evidence contracts

- Save version 4 migrates v1/v2/v3 lives. Legacy `business.assets` remain reusable storefront equipment.
- Offer receipt: `small-odds.storefront-offer/v1`.
- Counter receipt: `small-odds.storefront-counter/v1`.
- Sale receipt: `small-odds.storefront-sale/v1`.
- Daily service receipt: `small-odds.business-daily/v1`.
- Callback receipt: `small-odds.business-callback/v1`.
- Opening, equipment, upgrade, and branch receipts also declare `random: false`.

## Verification snapshot

- Core runtime suite: **39 passed, 0 failed**.
- Standalone package self-tests: **8 passed, 0 failed**.
- Isolated AXM verifier: **0 errors, 0 warnings**.
- Health endpoint: **HTTP 200**.
- Live desktop and narrow-browser journeys: **PASS**.
- Reload persistence: listing, pet shift, upgrade, receipts, sales, and history survived.
- Browser diagnostics: **0 errors, 0 warnings**.

The full planetary economy, production asset pipeline, longitudinal balance, physical accessibility audit, multiplatform distribution, and external comparative-quality evidence remain open.
