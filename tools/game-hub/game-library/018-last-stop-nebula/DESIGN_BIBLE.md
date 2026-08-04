# Design Bible — beta 0.25

## Fantasy

The player is an exhausted alien one contract away from retirement. The station begins as a rusted, leaking liability. AXM's reopened nebula attraction makes growth inevitable. The player is not asked to discover a profitable business; they are asked to survive success.

## Pillars

1. **Guaranteed growth, constrained capture.** Demand rises with the timer. The meaningful question is which bottleneck the player removes next.
2. **Readable stress.** Three lanes show a front-customer patience bar, queue count, service state, and automation progress at all times.
3. **Visible rebuilding.** Every purchased upgrade changes the 3D station: tank shell, service drones, solar wings, repair arms, lighting, holograms, clone, or quantum rings.
4. **Push-your-luck retirement.** Short, standard, and legend contracts trade time exposure for score multiplier.
5. **Failure with a number.** At 1,000 bad reviews AXM revokes the license and the run pays zero.
6. **Balance from field evidence.** Every completed or failed run produces a compact local summary. The game can expose actual review velocity and a suggested timer without silently moving the goalposts.

## Core loop

Arrival → queue pressure → manual or automated service → cash/debt split → supplies and upgrades → higher throughput → denser arrivals → retirement or review collapse.

Manual work costs energy and has a short lane cooldown. Automation converts capital into continuous service. Micro naps recover energy but add reviews because customers are left waiting.

## Economy

Every sale routes roughly one third of gross income to outstanding debt until the debt reaches zero. The remainder becomes spendable cash. Fuel, stock, and upgrades compete for that cash. Final score uses spendable cash, residual supplies, station assets, review headroom, remaining debt, and the selected contract multiplier.

## Difficulty shape

Arrival intervals shrink non-linearly across the run. Event choices can accelerate or soften demand. Base manual service is viable early but intentionally cannot scale to the final rush. Representative deterministic strategy simulations are a regression guard, not a claim of final human balance.

The local balance ledger retains the newest 24 summaries, deduplicated by run identity. Quick, standard, and legend samples are never mixed into one recommendation. After three matching runs, a contract estimates a collapse horizon from observed bad reviews per day and shows 72% of that horizon as an informational suggestion, clamped to 14–30 days. A failed run remains at 1,000 reviews for later days on the aggregate curve, preventing survivor bias from making the pressure line look healthier after a revocation. This value is deliberately not applied to gameplay; human review remains the authority for future balancing.

The player can export an anonymous JSON field report for voluntary sharing. It contains aggregate metrics and compact run samples, but no run identity, exact completion timestamp, save state, or device information.

## Event presentation

Seven milestone decisions remain the mechanical event authority. Each now has two authored, seed-selected transmissions with the same choice IDs and effects, so repeat runs can receive different story framing without changing balance. A transmission cuts to its scene-relevant camera while the simulation is paused, labels its day/feed/dispatch, and closes with authored consequence copy after the player chooses. The selected transmission is deterministic for the run seed and therefore stable across save migration and resume.

The non-saving `?qa=event&event=<id>&seed=<number>` route exists only for focused presentation verification. It never writes save or ledger data.

## Accessible control

Required event decisions behave as modal dialogs: focus enters the first choice, Tab and Shift+Tab stay within the available choices, number-row or numpad `1`–`3` resolves the matching option, and focus returns to a live game control afterward. Pause, Help, and the private balance ledger use the same blocking-dialog contract: labelled and described semantics, deterministic initial focus, bidirectional Tab containment, Escape closure, and restoration to the invoking control. The Pause-to-Help transition preserves the nested return path. Mouse and touch selection remain unchanged, and the upgrade drawer remains intentionally non-modal because simulation continues behind it.

Reduced Motion defaults to the operating-system preference when no saved choice exists. The in-game toggle updates its pressed state, the Three.js reduced-motion branch, and CSS animation/transition timing together. It reduces motion rather than removing every ambient world cue.

## Scene language

- **Forecourt:** the main operations view and queue read.
- **Mart:** warm commercial interior against a cold nebula.
- **Engineering:** leaking tank, repairs, and solar infrastructure.
- **Nebula:** the station silhouette, AXM attraction, and long-term transformation.

The art is an original procedural Three.js diorama with emissive materials, volumetric-feeling shader ribbons, hover traffic, animated drones, geometric aliens, and upgrade-dependent station silhouettes. Every one of the 12 upgrades now has a dedicated world-space visual route: patch clamps, warm mart shelving, roof manifolds, beacon satellites, repair arms, a chef hologram, and the established drones, solar wings, tank shell, canopy, clone, and quantum forecourt. Station dust, perimeter chase lights, exhaust trails, and a review-pressure beacon make the wider diorama feel active without changing simulation balance.

The non-saving `?qa=showcase&upgrade=<id>` route isolates a declared upgrade for visual verification. Unknown or omitted IDs fall back to the complete rebuilt-station showcase, and QA routes never write save or ledger data.

Built cards in Station evolution become inspection controls rather than inert completion markers. Each of the 12 upgrades maps to an authored camera. Inspection closes the drawer, restores keyboard focus to that camera control, and draws a temporary holographic outline, ground ring, and glow around the installed scene object. The scan is presentation-only and does not call the purchase path or mutate run state.

Service has an outcome language shared by the 3D station and lane cards. Manual clears use lane-colored chevrons and an energy arc; automation uses white orbital glyphs over the lane color; an angry departure becomes a red broken signal and unstable outbound path; a blocked input produces a red local stop marker without pretending a customer moved. The transient HUD label mirrors the same four outcomes so close mobile cameras cannot hide the result. Reduced Motion replaces travel and pulsing with a short static read. The non-saving `?qa=service&lane=<fuel|mart|garage>&outcome=<manual|automated|lost>` route exercises the real service paths under a stabilized clock.

Current Pressure is a deterministic presentation layer over the existing run state. Resource-blocked customers, insufficient manual energy, urgent patience, the emergency patch, affordable upgrades, active queues, and low reserves are ranked in a stable order. The cue exposes one focus-only action: it can select an authored camera, highlight and focus a relevant existing control, or open Station evolution on the suggested card. It never invokes service, supply, rest, or purchase mechanics. Station evolution remains non-modal and live; its cards are only rebuilt when cash or upgrade ownership changes so keyboard focus survives ordinary HUD refreshes. At responsive widths the full explanation compacts to a visible, accessible action rather than disappearing.

Inbound Vector turns the already-authoritative `spawnClock` into anticipation rather than a hidden surprise. A pure forecast classifies distant, approaching, final-approach, surge, held-QA, and settled states without consuming randomness or modifying the run. The mission panel shows phase, tenths-of-a-second ETA, surge remainder, and normalized approach progress. The same presentation state drives a dashed 3D route, advancing signal pips, and a forecourt arrival gate between the reopened attraction and station. Teal, amber, and red use the existing operational color language. Reduced Motion removes the decorative pulse while preserving countdown-driven position because elapsed game time remains meaningful state.

The non-saving `?qa=showcase&arrival=<inbound|imminent|surge>` route holds authored forecast states for visual inspection. The same parameter can be combined with `?qa=service` to observe a real unpaused countdown and arrival; QA routes still never write save or ledger data.

Queue Constellations make the three active service pressures part of the world rather than a HUD-only abstraction. A pure queue projection ranks the current front-customer urgency, preserves lane order as its deterministic tie-break, caps the visible stack at five pips, and reports any overflow separately. Each physical lane receives a floating count/status plate, beam, base ring, pip stack, and overflow crown. The lane's authored teal/amber/violet identity remains visible while shared amber and red states communicate stress and critical patience. A served-to-empty lane removes its constellation through the existing service path. Reduced Motion freezes rotation, bobbing, and urgency pulse without hiding counts or states.

The non-saving `?qa=showcase&queues=<steady|critical>` route holds authored queue-pressure states for visual inspection and can be combined with the existing service verifier. Close mobile cameras may crop a world-space plate; the matching Current Pressure cue and lane card remain the deliberate readable fallback.

Shift Horizon turns the day clock into environmental storytelling. A pure projection maps normalized `elapsed / dayLength` progress to First Light, High Orbit, Ember Shift, or Deep Watch plus the same 07:00-to-01:00 display clock already used by the HUD. That projection drives phase text, nebula warmth/night weight, hemisphere/key/station lighting, star visibility, and a reached-marker horizon beacon. The beacon position follows meaningful elapsed time; only its pulse and ornament rotation stop under Reduced Motion. The feature never advances time, consumes randomness, or changes queue, resource, reward, event, or score rules.

The non-saving `?qa=showcase&shift=<dawn|day|dusk|night>` route holds each authored atmosphere for visual inspection and composes with the queue routes. At compact widths the phase label and exact time remain the authoritative readable fallback when the world-space horizon arc is cropped.

Decision Archaeology turns milestone choices into station history rather than disposable modal copy. A pure projection validates and de-duplicates the existing `stats.choices` history, orders it by authored event day, and maps all 17 event/choice pairs to distinct IDs, labels, tones, shapes, and camera context. Seven world anchors accumulate plinths, holographic labels, and choice-specific artifacts: beacons, shelters, drones, contracts, compliance seals, shrouds, crowns, vaults, and related silhouettes. The renderer reads this projection only; event effects, timing, scoring, queues, and balance are unchanged. Reduced Motion preserves every semantic object while freezing decorative spin, bob, and pulse.

The non-saving `?qa=showcase&legacy=all` route composes one curated trace from every event. `?qa=showcase&legacy=<eventId>.<choiceId>` isolates any of the 17 authored outcomes and selects its event camera. The existing `?qa=event&event=<eventId>` route proves the real modal-to-world transition without writing save or ledger data.

Consequence Reveal is the authored transition between decision and archaeology. Only a newly resolved choice can start it: the artifact scales into place while a local assembly beam, three rings, orbiting shards, flare, and point light establish its anchor, then the temporary effect disposes and the permanent trace remains. The renderer exposes semantic phase/progress receipts for verification. Compact play scales the temporary effect to 74% so it does not overwhelm the portrait composition. Reduced Motion presents the final artifact at scale 1 from its first frame and holds a static confirmation; restored or QA-composed history uses `setDecisionLegacy` and cannot trigger a replay. The choreography is presentation-only and never calls an event effect, changes state, or pauses the resumed simulation.

Debt Liberation turns the existing AXM debt into a visible release arc. A pure projection maps authoritative debt into `LIEN LOCKED`, `LIEN CRACKING`, `FINAL CLAIM`, or `STATION YOURS`, plus normalized progress and zero to six remaining claim links. The world renderer binds that projection to a station-spanning perimeter lattice, central lock, beam, tethers, and placard; the mission HUD retains the same phase, progress, and balance. Every real service receipt carries the debt balance before and after the established split, allowing the final payment to drop the last link, open the lock, and announce ownership without introducing another economy path. At widths through 820px the compact HUD replaces the redundant world placard while the lock and links remain. Reduced Motion freezes decorative lien motion and uses a static final-payment confirmation.

The non-saving `?qa=showcase&debt=<locked|cracking|final|clear>` route holds each authored debt stage. `?qa=service&lane=fuel&debt=final` exercises the real existing service path from 14 credits to zero. These routes never write save or ledger data.

Graphics quality is a browser-local player preference with three explicit profiles. Cinematic keeps 1,700 stars, 280 station-dust motes, 30 perimeter lights, soft shadows, and the authored desktop pixel-ratio cap. Balanced retains shadows while reducing those scene populations and the cap. Eco reduces them again and disables shadows. Profile changes never alter customers, timers, resources, upgrade rules, scores, or save authority.

## Future seams

Additional locations can replace scene layout and event tables while retaining the deterministic run core. Co-op can divide lane intents between seats. Competitive multiplayer would require a declared network authority and is not represented by this local beta.
