# Deterministic city-life vertical slice

Free-roam co-op now initializes a host-authoritative city-life layer. It is deliberately deterministic: the same map, traffic routes, residents, venue positions, job routes, activity order and casino outcome deck are created for every fresh world.

## Iron Lantern combat and loot

The Armory now sells a Pulse Repeater, three-projectile Scatter Blaster, one-target-piercing Arc Carbine, matched ammo, Street Weave, Riot Plate and Kinetic Boots. Purchases create normal host-validated inventory items instead of decorative flags, and their damage, cadence, projectile speed, armor reduction, maximum health or movement modifiers are applied by `server/combat-gear-system.js`.

The free mixed-role drill is optional and repeatable. It spawns one Charger, Strafer, Shield and Sapper, closes the venue menu so the player can immediately fight, pays DC 8,00 on a clear and leaves role-based pickups. Drops expire after 35 seconds and require ACTION; clients cannot choose or manufacture their rewards.

Current equipment and enemy tells use low-cost Canvas geometry and short presentation-clock animation. This is deliberately readable low-graphics feedback, not a claim of authored sprite-animation coverage.

## Streets and cars

- Six authored parked cars are explicitly marked as stealable.
- Four traffic cars circulate on two civic loops with a host-owned ambient driver state.
- ACTION near a traffic car transfers its driver seat to the player and disables ambient driving for that car.
- Taking a public parked or moving car records a vehicle theft, adds witnessed justice heat, and makes nearby citizens flee before resuming their deterministic routines.
- Player-purchased armored gang cars have four seats and 100 vehicle health.
- A garage roadblock places three visible barriers at the civic crossing and participates in authoritative vehicle collision for 60 seconds.
- The Undercroft Chop Shop locks its menu to the exact nearby empty car, repairs it, adds armor, upgrades its engine/tires/brakes, changes its handling tune, fits body kits, applies paint/livery packages, or swaps plates on a stolen car. A legalized car becomes party-owned and reduces heat instead of erasing the wider justice system.

Vehicle impact damage, visible civilian-driver exit characters, vehicle weapons and a persistent multi-session garage remain future work.

## Venues and upgrades

Five marked free-roam venue entrances open a shared-screen venue presentation while the controlling phone or assigned shared-screen gamepad becomes the menu input:

- Iron Lantern Armory: Sidearm MK II and armored lining.
- Neon Crown Casino: deterministic high-card table, VIP payout upgrade and current street-cache tip.
- Party Crew Garage: following bodyguards, armored gang cars and a temporary street roadblock.
- Metro Dispatch: three repeatable deterministic co-op jobs with visible shared targets and no forced quest state.
- Undercroft Chop Shop: tow an empty claimed party car to its service pad; nearby car repair; three engine stages; three tire stages; two brake stages; street armor; Balanced, Grip, Drift and Sprint handling presets; Stock, Street, Wide and Rally body kits; six visible paint/livery packages; and stolen-car legalization.

These are functional menu interiors anchored to the city, not yet walkable floor simulations. MOVE selects, ACTION buys or plays, and FIRE exits. Every option is optional; the mission board remains independent.

## Vehicle tuning contract

Every city car owns an independent host-authoritative tuning record. The Chop Shop locks onto one parked, empty vehicle so another nearby car cannot receive the purchase accidentally. Performance and cosmetic work require the car to be claimed by the player's party; repair and legalization keep their narrower service rules.

- Engine stages raise acceleration and maximum forward speed.
- Tire stages raise steering response.
- Brake stages improve stopping, reverse acceleration and reverse speed.
- ECU tuning costs once; afterward Balanced, Grip, Drift and Sprint can be switched for free. Drift adds a real travel-heading delay instead of being a label-only preset.
- Body kits and paint/livery packages change the rendered car outline, stripe, accent and tuned label.
- The shared menu shows current levels and before/after performance values before money is spent.
- A customized or purchased car keeps its owner and exact tuning record through destruction and host respawn. Multi-session garage persistence is not claimed yet.

## Repeatable cooperative city jobs

Each party can accept one independent Metro Dispatch job. Job progress is shared, but personal reward money stays in the contributors' separate wallets and the declared 60% group share goes to that party's common fund:

- **Neon Courier Circuit:** four ACTION handoffs at the armory, market, garage and harbour. Mike and Errol can alternate stops and both receive a contributor share.
- **Civic Night Run:** load the party into a car and drive four visible gates before the deterministic timer expires.
- **Neon Rival Patrol:** answer three street calls; each call spawns exactly two bounded rivals and advances only after the pair is cleared.

Jobs can complete, expire visibly, and be immediately chosen again. They do not replace the Party House mission board, force story progression, spend party funds, or silently change another party's job.

## Shared-screen universal controller

The host-local shared screen can bind standard gamepads to Human seats in visible seat order without exposing seat tokens over LAN. The Xbox/Brawl baseline is left stick or D-pad move, right stick aim, A action/choose, X or RT fire, RB sprint/throttle, B brake/reverse, Y or View inventory, and Menu map. Phone and gamepad sequences are independent; meaningful input takes temporary ownership so an idle pad cannot overwrite an active phone.

## Population and optional activity

Twelve deterministic centre residents supplement the eight authored civilians. All twenty now receive a stable identity, job, workplace, shift, home point and off-duty destination. A complete city day takes two real minutes so a normal playtest can observe multiple phases without waiting:

- commute to work;
- perform a role-specific task cycle at one or more workplace points;
- visit a fixed leisure destination after the shift;
- return home until the next shift.

The roster includes armory and casino staff, mechanics, day/night security, a courier, street medic, sanitation crew, market and cafe workers, a dock loader, musician, taxi dispatcher, delivery rider, park keeper, electrician, news seller and warehouse runner. Shift times intentionally differ, including evening and overnight jobs. Their schedule, route target and task are host-owned and repeat exactly between fresh sessions. Projectile and moving-car danger temporarily interrupts the routine; the citizen resumes the same schedule afterward.

Citizen rings show a short job badge, name, role and current task. ACTION near an unoccupied citizen reports their job, current activity and destination; nearby vehicle and venue actions retain priority. A rotating street cache pays 40% to the collecting player's separate personal wallet and 60% to that player's party fund.

The City Pulse HUD reports the city day, 24-hour clock, current on-duty and commuting counts, street phase and cache availability. Nearby phone and shared-screen prompts expose talk, take, hijack, enter, buy, collect and exit actions. The full map includes venues, activity and roadblock markers.

## Evidence

`tests/city-life-system.test.js`, `tests/city-contract-system.test.js`, `tests/vehicle-tuning-system.test.js`, and `tests/universal-gamepad.test.js` cover deterministic initialization, jobs, contributor payouts, race gates, bounded patrol waves, expiry cleanup, witnessed theft heat, exact-car Chop Shop ownership, staged performance, tune/paint/body cycling, tuned driving, respawn retention, independent phone/gamepad sequencing and the host-local binding boundary. The complete suite count is recorded by the latest test receipt rather than frozen in this design note. Live browser verification remains required after every presentation or control change.
