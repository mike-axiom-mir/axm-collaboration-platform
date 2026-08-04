# Milestone 02 - Starspite first deck

Status: **verified local pre-alpha milestone**

Starspite turns the portal's independent one-in-a-million ticket from a receipt field into a playable destination. An authentic, unredeemed invitation can be boarded once; it becomes redeemed membership, adds the fifth travel location, and persists through save migration and reload.

## Player-facing slice

- Explore an animated observation deck above an alien planet, meet Vesper Coil, inspect the odds ticker, and move among three ship activities.
- Play Möbius Twelve (1/12, 11x gross, 91.667% RTP), Three-Moon Split (3/16, 5x gross, 93.75% RTP), or Truth Coin (1/2, 2x gross, 100% RTP).
- Read a receipt containing seed, RNG algorithm, mapped outcome, winning set, stake, payout, insurance, exact return/edge, and explicit `adaptiveLuck: false` / `pity: false` declarations.
- Pledge a portal item as loss insurance. Its power can refund a bounded part of a loss and consumes one durability; the receipt explicitly records that insurance cannot change the random outcome.
- Buy fixed-price authored artifacts without fake randomness. Their provenance receipts use `small-odds.authored-lot/v1`, set `random: false`, and contain no generated seed or rarity claim.
- Report a one-time probability crime and allow held objects to react only when their complete context signature is present.

## Mathematical and continuity contract

- Every casino play requests a fresh 256-bit Web Crypto seed.
- The current generator is `xoshiro128ss-v2-full-seed-mix`; all eight seed words influence the state before the first value.
- Mapping uses uint32 rejection sampling rather than modulo reduction.
- Legacy item receipts retain deterministic `xoshiro128ss-v1` replay.
- Save version 2 adds Starspite state and Vesper relationship while migrating version-one saves.
- Deterministic test seed `000000000000000000000000000000000000000000000000000000003e3f8dc3` reaches the exact 1,000,000 ticket boundary under RNG v2.

## Verification

- Focused suites: **26 passed, 0 failed**.
- Package self-test: **6 passed, 0 failed**.
- Isolated package verifier: **0 errors, 0 warnings**.
- Live browser: authentic ticket redemption, fifth-location arrival, all panel surfaces, random wager receipt, authored purchase receipt, item insurance loss/refund/durability, one-time consequence, contextual reaction, save/reload, desktop, and 390x844 layouts passed.
- Browser console: **0 errors, 0 warnings**.

The live journey found one real defect: the casino panel inherited an earlier panel's scroll offset and opened with its introduction clipped. `openPanel` now resets the panel body when identity changes; desktop and narrow measurements subsequently passed at `scrollTop: 0`. The failed observation is retained in the session chronology rather than erased.

## Honest boundary

This milestone is one strong casino deck, not the full ship or planet. It has no simulated-bidder auction, social multiplayer tables, alternate admission economy, ship ownership, production 3D pipeline, longitudinal balance cohort, physical accessibility audit, platform release, or independent comparative evidence. Sampled screenshots establish selected visible states; continuous frame pacing remains unknown.
