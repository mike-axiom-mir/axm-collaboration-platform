# District Dominion · up to 4v4

Status: **PLAYABLE AUTOMATED ALPHA · PHYSICAL EIGHT-PLAYER STRESS TEST UNTESTED**

District Dominion is AXM District Party's local Party A versus Party B mode. Seats 1–4 are Party A; seats 5–8 are Party B. Each side may ready one through four seats, and sides may be unequal. Both parties exist in one host-owned city world. The Party A and Party B display routes are cameras into that same state, not separate servers or separate maps.

## Quick setup

1. Start the local host and open the launcher.
2. Select **District Dominion · 1–4 vs 1–4**.
3. Ready only participating seats. Leave unused seats unchecked.
4. Start the session.
5. Open `party_a` on one display and `party_b` on the other.
6. Give each human only the named controller link generated for that seat.

The fallback launcher defaults to one human per party (P1 and P5) and no substitutes. An OFF-by-default option can deliberately fill every unused slot with built-in Host AI. The real Game Hub selected-ready array is the intended roster source.

## Match rules

- Round length: 600 seconds.
- Score target: 360.
- Districts: 13 zones distributed from Reeshof West through the centre to East Gate.
- Reeshof West begins under Party B control; East Gate begins under Party A control; the other 11 begin neutral.
- Living player actors count as 1 capture presence.
- Paid crew NPCs count as 0.75 capture presence.
- A solo actor captures a neutral district in about 6.7 seconds. A numerical advantage captures faster, capped at 2.5× speed.
- Equal opposing presence stops progress. A district marked contested grants no score or income.
- Each uncontested owned district grants one point per second.
- First to 360 wins. If time expires, higher score wins; equal scores produce a draw.
- Results do not auto-dismiss. The host restarts or ends the session from the launcher.

All capture progress, score, timers, ownership and results are advanced by the 30 Hz host loop. Screens and phones cannot claim a district or report a win.

## Reinforcement economy

Each party begins District Dominion with `DC 50,00` in its isolated party treasury.

At the matching colored command post:

- press **ACTION**;
- the host checks party identity, range, cooldown, active cap and balance;
- `DC 25,00` is deducted from only that party;
- two crew NPCs spawn;
- no party may have more than four living crew at once;
- a crew squad expires after 120 seconds if it survives;
- uncontested districts produce `DC 1,00` per district every five seconds.

One controller cannot spend the other party's treasury. When a party contains a human or Foundation adapter seat, built-in Host AI does not automatically spend group funds. A deliberately all-Host-AI party may buy its initial squad so an unattended simulation still exercises the macro layer.

Crew uses the same collision, health and damage permission paths as other NPCs. Party crew cannot damage allied actors or allied crew while that party's friendly fire is off. It can attack opposing actors and crew when cross-party damage is enabled.

## Combat, vehicles and screens

- Same-party projectile damage defaults OFF independently for Party A and Party B.
- Cross-party damage defaults ON.
- Players retain 100 base HP and one starting shield.
- The west/east command staging zones block player damage and regenerate only their matching party at 10 HP/s.
- Six 50-HP, four-seat cars spawn at mirrored bases and central travel points. Drivers steer and fire forward; passengers may aim and fire.
- A destroyed car ejects occupants and applies 80 environment damage.
- Each party screen follows only its living four actors and their occupied vehicles.
- The city view is never split into four play viewports. Only four small health/shield/ammo/money cards sit in that party's screen corners.

## Host-owned state

`server/territory-system.js` owns:

- capture presence and progress;
- district ownership;
- score and timer completion;
- party income;
- command-post purchase validation;
- crew population limits and expiry;
- match result.

`data/territory-zones.json` owns tunable values and coordinates. The world and protocol continue to use the central `partyIdForSlot()` mapping; gameplay code does not create a second slot-to-party mapping.

## Automated evidence

The v0.2.0 test suite covers:

- exact sparse 1v1 and asymmetric 2v3 rosters without substitute actors;
- one optional full eight-actor authoritative world;
- mirrored party spawns, bases and vehicles;
- neutral capture, equal contest, ownership retention and score victory;
- isolated party spending, cooldown and crew cap;
- allied crew damage rejection and opposing crew damage;
- 600-tick sparse 1v1/asymmetric 2v3 Host AI simulations and 900 ticks at full capacity;
- Party A and Party B state serialization over one world;
- restart clearing old score, crews and purchases;
- live HTTP start with a five-seat 2v3 roster, human and adapter tokens, filtered adapter observation, Party B display, ACTION purchases and state readback.

Automated browser rendering is **UNRUN** in the build environment because Playwright's Chromium executable is absent. Physical phones, two physical laptop displays, eight humans, Wi-Fi latency and long-session desynchronization remain **UNTESTED**.
