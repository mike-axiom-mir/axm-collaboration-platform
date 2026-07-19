# Casino Game Alpha Gameplay Route

Status: **LOCKED FOR LOCAL ALPHA / WORKING**  
Version: `0.3.2-alpha`  
Target: local Game Hub testing before any GitHub version

## One game, two routes

### Backroom Story

- One to four opt-in Party A players; empty seats remain empty.
- One shared casino treasury, story save, unlock path, and quest ledger.
- Ten chapters introduce the ten starting cabinets in order.
- LUX-5 keeps its six-step opening: wake the cabinet, fund the float, serve an
  NPC, prove wager neutrality, close a solvent shift, and claim the first lease.
- Each of the next nine chapters has four steps: reveal the cabinet, settle
  three paid spins, use two wagers, and serve one NPC on that style.
- The complete first campaign contains 42 linear quests. Any co-op seat can
  contribute to the same current objective.
- Quests listen to already-settled domain events. They cannot inspect, replace,
  skip, reroll, or repair a draw.

### House War

- District Party seat mapping is reused: Party A seats 1–4 and Party B seats
  5–8.
- Standard teams are equal 1v1, 2v2, 3v3, or 4v4.
- Both parties receive all ten cabinets immediately.
- Players operate their own casino, move money between wallets and house float,
  gamble at the rival casino, and compete for NPC traffic.
- Bankruptcy ends the match when the rival has no party equity; otherwise the
  default 20-minute closing bell compares server-owned party equity.

## Ten starting slots

| Slot | Core resolution | Volatility direction |
|---|---|---|
| LUX-5 | Four horizontal reel lines, scatters, 4/7/18 free spins, six-face Overdrive | Balanced |
| Graftgarden | Mechanical roots grow from an edge and graft through the centre | Low-medium |
| Mirror Mice | Reflected coordinates pair across two mirrored boards | Medium-high |
| Night Courier | Pip completes parcel routes around a twelve-stop night circuit | Low-medium |
| Pocket Vault Crew | Role combinations open progressively deeper tiny vault rooms | High |
| Weatherheart | A precommitted sun, rain, wind, or frost transform resolves the board | Medium |
| Spare Parts Choir | Order-independent note sets form chords and an encore | Low |
| Nullbloom | Closed neon loops score around negative space | High |
| Orbit Oven | Radial recipes connect three concentric ingredient rings | Medium |
| Twinlight Relay | Two independent beacon boards bridge through the centre | Medium-high |

LUX-5 retains its full solved reel model. The nine additions are not skins of
one payout profile: each has a unique 50,000-record distribution, hit rate,
maximum result, layout evaluator, symbols, feature, and story identity. Every
base book closes to exactly 96% RTP over its complete finite set.

## AXM 50K Draw Spine

At session start the server derives:

1. one unbiased Fisher–Yates permutation of neutral ticket IDs `0..49,999`;
2. one independent full 50K ticket-to-row permutation for each slot style;
3. a style-specific presentation seed for deterministic visual reconstruction.

For a paid spin or earned free spin:

1. the actor has already chosen a cabinet, except when a contest fixes it;
2. the next neutral ticket is consumed globally;
3. the selected cabinet maps that ticket into its own immutable outcome book;
4. wager scales the committed payout result;
5. the authoritative ledger transfers wager, contribution, slot payout, and
   any jackpot payout.

Humans, adapter/AI seats, NPCs, and free spins all consume this same next draw.
The public state exposes only cursor totals, never seed, order, mappings, or
future rows. When a 50K epoch is exhausted, the server deterministically derives
a fresh full epoch from the same private session seed.

## Economy and jackpot contract

- Base slot RTP: 96% per complete style book; jackpot sits outside base RTP.
- Human/player paid contribution: 5% of wager from the receiving house.
- NPC paid contribution: 1% of wager from the receiving house.
- Human/player jackpot chance: exactly 1% of a full neutral 50K epoch.
- NPC jackpot chance: exactly 0.05% of a full neutral 50K epoch.
- Maximum jackpot payment: 100× that spin's wager.
- Any unpaid pool remainder stays for a later winner.
- Wager affects payout scale and risk, never which result is selected.
- A fair committed result is paid even when it makes a casino insolvent.
- No jackpot sink is attached to an individual cabinet; the progressive is
  district-wide and locally persistent between ordinary sessions.

## NPC contract

- Entry bankroll: a world-random whole number from 14 through 200 credits.
- Fixed wager: exactly 1% of that NPC's initial bankroll.
- Completed visit: exactly 100 paid wagers.
- Cabinet stay: 20–50 consecutive paid wagers before choosing another available
  style; the visit is partitioned so every segment stays in range and totals 100.
- Legitimately awarded LUX-5 free spins are additional outcomes and keep the
  wager, target, and style that triggered them.
- Every NPC outcome advances the same Draw Spine as human play.

## District contest cycle

- Six traffic spots exist on the shared map.
- A contest chooses one spot and one random slot style.
- The window lasts two minutes and the selected style is fixed for all parties.
- Highest gross settled payout wins; wager sizes remain free risk/reward choices.
- The claimed spot sends NPC traffic to the winner for five minutes.
- Starting a contest every two minutes with five-minute claims supports roughly
  2.5 concurrently claimed spots in the long run.

## Ability boundary

The server reserves one ability slot per party, but the first effect remains
unimplemented until its visible counterplay is approved. No future ability may
read, alter, replace, reroll, skip, or bias outcomes. It may affect information,
access, cost, timing, or another declared world rule only.

## Authority and client contract

- The Node.js runtime owns seats, money, timers, Draw Spine, style books, NPCs,
  quests, traffic, results, and persistence.
- Seat commands use increasing sequences and request IDs for exactly-once
  settlement.
- Player and party observations filter rival money and all future probability
  state.
- Host, party screens, and the light controller are views of the same session.
- The later mobile/PWA route must remain a thin client of this runtime.
- No outside service, analytics, font, image, script, or network casino is used.

## Honest alpha gate

Automated source, math, replay, ledger, HTTP, and staged Game Hub checks are
part of this package. Real browser rendering, physical-phone LAN play, physical
4v4, long balance sessions, accessibility review, final art/audio, continuous
world movement, and the first interference ability remain separate work. The
status stays WORKING / TEST until those gates are explicitly run.
