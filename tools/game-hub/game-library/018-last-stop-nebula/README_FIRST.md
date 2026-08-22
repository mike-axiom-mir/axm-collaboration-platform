# LAST STOP: NEBULA

An offline, single-player 3D pressure-management beta for AXM Game Hub slot 018.

## Launch

Double-click `START_LAST_STOP_NEBULA.cmd`. The launcher starts a hidden local server, waits for the game-specific health receipt, and opens `http://127.0.0.1:8818/games/018/`.

The game can also be launched by Game Hub from its manifest. Runtime internet access is not required.

## The run

You own a ruined alien petrol station beside a forgotten nebula attraction. AXM reopens the attraction without warning. Demand is guaranteed to grow; the problem is capturing it before the station collapses.

- Serve Plasma Pumps, Nebula Mart, and Repair Bay with `1`, `2`, and `3`.
- Protect customer patience. Failed queues add bad reviews.
- Buy supplies, repair the leak, and build automation while the station stays open.
- Make permanent event choices that change demand, rewards, patience, or reputation.
- Chase four rotating Signal Dispatches for manual lane coverage, hands-on volume, clean convoys, and early clears. Captured dispatches award persistent signal marks and a modest retirement-score bonus without changing the survival economy.
- Reach the selected retirement timer under 1,000 bad reviews.
- Escape with cash, remaining assets, and a local high score. Debt lowers the payout.

Three retirement contracts target approximately 6, 9, and 12 minutes. The 21-day contract is the intended first run.

## Field data, save, and privacy

Run state, settings, and the best score use browser `localStorage`. Finished and failed runs also add a compact summary to a private balance ledger capped at the newest 24 runs. The ledger shows retire rate, reviews gained per day, projected review-collapse day, capture rate, automation share, and an average review-pressure curve. Quick, standard, and legend contracts are calibrated separately; a contract receives an informational retirement-timer estimate only after three matching runs.

No gameplay data leaves the computer, and the ledger never changes difficulty automatically. Its portable JSON report is created locally, excludes run identities and exact timestamps, and can be downloaded or copied only when the player asks. Returning to the title saves the current run; abandoning a run requires a second confirmation. Version 0.26 migrates valid 0.9 through 0.25 saves in place.

Signal Dispatches keep a second authored objective active across the full contract. The seeded four-dispatch rotation repeats for longer contracts and preserves completions, failures, streak, and marks in the local save. Its HUD strip and physical roof board expose the same progress. Dispatch timers stop whenever the simulation stops. Marks add 30 points each before the selected contract multiplier; they never buy supplies, erase reviews, change arrivals, or unlock upgrades.

Pause exposes persistent Cinematic, Balanced, and Eco graphics profiles. Cinematic retains the full authored scene; Balanced reduces particles and perimeter lights; Eco also disables soft shadows. These are player-controlled workload choices, not automatic performance claims.

Installed upgrades remain actionable in the Station evolution drawer. Selecting a built card closes the drawer, switches to its authored camera, and briefly scans the corresponding 3D structure without changing the run.

Service results now read in both the world and the HUD. Manual and automated clears send lane-colored energy from station machinery to the customer before a smooth departure; angry losses use a red warning path and unstable exit; blocked actions show a local red stop signal. Matching lane-card flashes keep the result legible when a close camera crops the 3D effect. Reduced Motion holds a static result card and suppresses the travel cadence.

Current Pressure is now operational rather than generic. A deterministic cue identifies the live bottleneck—urgent lane, blocked supply, depleted energy, leak repair, or affordable build—and its action only changes camera, focus, highlight, or opens the existing non-modal drawer. It never serves, buys, rests, or changes balance for the player. The compact cue remains visible in the 390×844 layout.

Inbound Vector exposes the simulation's existing arrival clock before a customer joins a lane. The HUD shifts from calm teal through amber approach to red final approach or convoy surge, while a matching 3D signal advances from the reopened attraction toward the forecourt. It is forecast-only: spawn timing, lane selection, demand, and rewards are unchanged.

Queue Constellations lift live lane pressure into the rebuilt station. Pumps, Mart, and Bay each project a lane-colored count/status plate over a five-pip queue stack; stressed fronts turn amber, critical fronts turn red, and queues above five gain a holding crown. The display is a pure view of current customers and patience. Serving, arrivals, automation, resources, rewards, and balance still use the existing simulation paths.

Shift Horizon makes the existing run clock part of the station's world. First Light, High Orbit, Ember Shift, and Deep Watch recolor the nebula shader and station lighting while a progress beacon crosses the horizon; the HUD names the current phase beside the exact time. This is deterministic presentation over `elapsed` and `dayLength`: it changes no timers, queues, resources, rewards, or balance rules. Reduced Motion keeps the semantic beacon position and removes its decorative pulse.

Decision Archaeology makes every permanent event choice leave a permanent physical trace around the station. All 17 choices have a distinct local procedural artifact, color language, and label; completed events accumulate at seven authored world anchors and restore from the existing saved choice history. The projection is deterministic and balance-neutral. Reduced Motion keeps every artifact and freezes its decorative spin, bob, and pulse.

Consequence Reveal now makes a new choice visibly become station history. The real event-resolution path assembles the selected artifact through a short beam, ring, shard, flare, and label sequence before leaving the permanent trace behind. Responsive play tightens the transient effect at 390px; Reduced Motion replaces spatial travel with a static confirmation. Restored history never replays the reveal, and the sequence changes no event effect or balance rule.

Debt Liberation makes the retirement fantasy visible throughout the run. The existing 720-credit AXM lien now projects a persistent station lock, six physical claim links, a perimeter lattice, and a compact HUD release strip. Real sale receipts still use the established cash/debt split; as debt falls the links disappear, the lock opens, and the final payment announces `THE STATION IS YOURS`. Responsive play keeps the HUD strip and central lock while hiding the redundant world placard, and Reduced Motion holds a static payoff confirmation. No economy or balance rule was changed.

## Verification

Deterministic mechanics, balance smoke tests, server confinement, packaging, live WebGL appearance, interaction journeys, and restart persistence have separate evidence routes. See `evidence/EVIDENCE_ROUTE.md` and `BUILD_RECEIPT.md` for the current state.
