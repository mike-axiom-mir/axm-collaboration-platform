# Evidence route

## `launch-local`

- Claim: the packaged game launches locally without internet access.
- Kind: transport / existence; risk: medium.
- Pass: health returns game id 018, playable route and JavaScript modules return 200, no runtime source contains an HTTP dependency.
- Primary: `tests/server-http.test.cjs`, `tests/package-selftest.cjs`.
- Counterevidence: missing module, wrong MIME, unsafe path, external URL, launcher health mismatch.

## `rules-work`

- Claim: service, resources, debt, upgrades, events, timer, save sanitation, automation, win, loss, and scoring behave deterministically.
- Kind: deterministic behavior; risk: medium.
- Pass: focused core tests pass with known inputs.
- Primary: `tests/core.test.mjs`.
- Counterevidence: failed assertion or unbounded/invalid state.

## `run-is-viable`

- Claim: an active representative policy can retire while inactivity fails.
- Kind: deterministic behavior / provisional balance; risk: medium.
- Pass: active policy retires across five fixed seeds with positive score; inactive policy hits the review limit.
- Primary: `tests/balance.test.mjs`.
- Cannot prove: human fun, fairness, or final difficulty.

## `visual-3d-quality`

- Claim: title, multiple camera scenes, customers, upgraded station, overlays, and results visibly render without critical obstruction.
- Kind: visual / temporal; risk: medium.
- Pass: live screenshots and before/action/settled observations at declared desktop and responsive viewports.
- Primary: live browser screenshots via the live-visual verification skill.
- Counterevidence: blank WebGL, clipping, unreadable HUD, hidden controls, static upgrade visuals, console/runtime failure.

## `upgrade-visual-integrity`

- Claim: every declared upgrade creates a dedicated, legible change in the live 3D station without changing simulation balance.
- Kind: structural / visual / temporal; risk: medium.
- Pass: a static route test maps all 12 upgrade IDs to scene objects; the isolated non-saving showcase route renders one requested upgrade at a time; all-upgrade forecourt, mart, engineering, and nebula views render cleanly; bounded frames show live movement.
- Primary: `tests/package-selftest.cjs`, `runtime/scene.mjs`, and focused in-app-browser observations of `?qa=showcase` and `?qa=showcase&upgrade=twin-pumps` at 1440×900.
- Counterevidence: an unmapped upgrade ID, a route that mutates save/ledger data, visually swallowed geometry, missing promised effect, scene exception, or gameplay-state mutation.
- Cannot prove: representative GPU performance or human preference for the art direction.

## `render-quality-control`

- Claim: a player can select a persistent graphics workload profile without changing gameplay state, and each profile applies its declared WebGL cost controls.
- Kind: interaction / deterministic UI state / visual / persistence; risk: medium.
- Pass: the real Pause control cycles Cinematic → Balanced → Eco → Cinematic; live DOM receipts expose the expected particle/light/shadow settings; Eco survives reload; the complete scene remains visually coherent; the three-setting row fits 390×844 without horizontal overflow.
- Primary: focused in-app-browser interaction and screenshots plus `tests/package-selftest.cjs`.
- Secondary: reload on the same origin and `evidence/requirements.json` capability comparison.
- Counterevidence: stale labels, unchanged draw ranges, wrong shadow state, lost setting after reload, gameplay state mutation, clipped Pause controls, or console/runtime errors.
- Cannot prove: a specific FPS, representative-device performance, thermal behavior, or automatic hardware suitability.

## `installed-upgrade-inspection`

- Claim: every installed upgrade can be deliberately revisited in its 3D context without changing the run, and keyboard focus does not remain inside the hidden drawer.
- Kind: interaction / visual / deterministic UI state; risk: medium.
- Pass: all 12 built cards expose named View actions; activating one closes the drawer, selects its authored camera, renders a temporary scan around its scene object, announces the target, preserves visible run/resource values, and focuses the active camera control. Ordinary drawer close returns focus to Build.
- Primary: focused in-app-browser desktop/mobile interaction and screenshots plus `tests/package-selftest.cjs`.
- Counterevidence: inert owned card, wrong camera, missing/obscured scan, purchase call, changed cash/resources/reviews/time, focus inside hidden content, clipped mobile card, or console/runtime error.
- Cannot prove: universal art preference or physical assistive-technology announcements.

## `service-choreography`

- Claim: manual service, automation, angry customer loss, and blocked input have distinct, lane-relevant visual outcomes without changing the existing simulation rules.
- Kind: visual / temporal / interaction / deterministic behavior; risk: medium.
- Pass: the real input/action routes select four authored scene outcomes; served and lost removals use different vehicle paths; each outcome produces a matching lane-card flash; Reduced Motion holds a static HUD read and suppresses travel cadence; desktop and 390×844 routes remain usable without horizontal overflow.
- Primary: focused in-app-browser before/action/settled observations of `?qa=service`, `tests/package-selftest.cjs`, and unchanged deterministic core tests.
- Counterevidence: generic or wrong-color signal, action effect detached from its lane, blocked input animating a departure, clipped mobile feedback, reduced-motion feedback disappearing immediately, changed service economics, or runtime failure.
- Cannot prove: universal taste, representative GPU performance, or physical-device feel.

## `tactical-guidance`

- Claim: Current Pressure deterministically identifies a live operational constraint and can orient the player without executing or mutating gameplay state.
- Kind: deterministic behavior / interaction / visual / accessibility; risk: medium.
- Pass: a pure core function returns stable advice without changing serialized state; the UI route contains no service, supply, rest, or purchase calls; real urgent-lane input selects Engineering, highlights Repair Bay, and focuses Serve Bay; real build input opens the non-modal drawer, highlights and focuses Pump Drone P-1; displayed cash, reviews, queue, and ownership stay unchanged; the compact action fits 390×844 without horizontal overflow; Reduced Motion holds a static target.
- Primary: `tests/core.test.mjs`, `tests/package-selftest.cjs`, `evidence/visual/tactical-guidance-urgent-desktop-1280x720.png`, `evidence/visual/tactical-guidance-desktop-1280x720.png`, and `evidence/visual/tactical-guidance-mobile-390x844.png`.
- Counterevidence: nondeterministic output, state mutation, automatic gameplay action, wrong camera/control, lost focus during ordinary HUD refresh, hidden responsive cue, horizontal overflow, or motion persisting under Reduced Motion.
- Cannot prove: that the advice is optimal, universally understood, or preferred by representative human players.

## `inbound-vector`

- Claim: the next authoritative customer spawn is visible before it joins a lane through a truthful HUD forecast and matching 3D approach signal, without changing simulation balance.
- Kind: deterministic behavior / visual appearance / temporal interaction; risk: medium.
- Pass: a pure forecast maps fixed spawn-clock and burst states without changing serialized state; distant, final-approach, and surge QA states drive matching HUD and canvas presentation receipts; an unpaused route counts down, changes phase, and returns to a new forecast when the queue increases; cash and reviews remain unchanged; the compact strip fits 390×844; Reduced Motion suppresses decorative pulse while retaining semantic progress.
- Primary: `tests/core.test.mjs`, `tests/package-selftest.cjs`, `evidence/visual/inbound-vector-imminent-desktop-1280x720.png`, `evidence/visual/inbound-vector-live-before-desktop-1280x720.png`, `evidence/visual/inbound-vector-live-after-desktop-1280x720.png`, and `evidence/visual/inbound-vector-mobile-390x844.png`.
- Counterevidence: ETA diverging from `spawnClock`, phase mismatch between HUD and scene, random-state consumption, changed arrival timing or lane selection, queue increase without reset, clipped/hidden responsive forecast, motion persisting under Reduced Motion, or runtime failure.
- Cannot prove: future lane/species before the existing random spawn decision, a long-range demand forecast, universal comprehension, or physical-device performance.

## `queue-constellations`

- Claim: current queue load and front-customer danger are legible at their physical 3D service lanes without changing simulation behavior.
- Kind: deterministic behavior / visual appearance / interaction; risk: medium.
- Pass: a pure projection returns stable lane counts, capped pip stacks, overflow, and urgency without changing serialized state; steady and critical held routes expose matching world receipts; real manual service changes Pumps from `01 / STABLE` to clear through the existing serve path; cash/review results remain authoritative; the 390×844 HUD does not overflow; Reduced Motion reports and visibly holds the static signal branch.
- Primary: `tests/core.test.mjs`, `tests/package-selftest.cjs`, `evidence/visual/queue-constellations-critical-desktop-1280x720.png`, `evidence/visual/queue-constellations-critical-mobile-390x844.png`, `evidence/visual/queue-constellations-service-before-desktop-1280x720.png`, and `evidence/visual/queue-constellations-service-after-desktop-1280x720.png`.
- Counterevidence: count/status mismatch, nondeterministic output, state mutation, marker anchored to the wrong lane, served-to-empty marker remaining visible, misleading danger receipt, hidden responsive controls, motion continuing under Reduced Motion, or runtime failure.
- Cannot prove: future random lane/species, universal comprehension or visual taste, physical-device feel, or representative GPU performance.

## `shift-horizon`

- Claim: the existing day clock is legible as four distinct HUD and 3D atmosphere states without changing simulation or balance behavior.
- Kind: deterministic behavior / visual appearance / responsive accessibility; risk: medium.
- Pass: a pure projection returns stable phase, tone, progress, and time without changing serialized state; held dawn/day/dusk/night routes produce matching HUD and canvas receipts; the nebula, lighting, stars, reached markers, and horizon beacon visibly differ; the 390x844 HUD fits without horizontal overflow; Reduced Motion preserves semantic progress while suppressing pulse/rotation; focused console warnings and errors remain zero.
- Primary: `tests/core.test.mjs`, `tests/package-selftest.cjs`, `evidence/visual/shift-horizon-dawn-desktop-1280x720.png`, `evidence/visual/shift-horizon-day-desktop-1280x720.png`, `evidence/visual/shift-horizon-dusk-desktop-1280x720.png`, `evidence/visual/shift-horizon-night-desktop-1280x720.png`, and `evidence/visual/shift-horizon-dusk-mobile-390x844.png`.
- Counterevidence: HUD/scene phase mismatch, state mutation, changed clock/economy/queue behavior, indistinguishable atmosphere states, clipped phase/time, responsive overflow, motion continuing under Reduced Motion, console error, or runtime failure.
- Cannot prove: universal comprehension or visual taste, physical-phone feel, physical screen-reader behavior, or representative GPU performance.

## `decision-archaeology`

- Claim: every permanent event choice leaves a distinct persistent physical trace on the 3D station without changing event mechanics or balance.
- Kind: deterministic behavior / persistence / visual appearance / responsive accessibility; risk: medium.
- Pass: all 17 authored event/choice pairs have unique trace metadata and isolated QA routes; a pure projection is deterministic and state-neutral; 0.22 saves preserve valid choice history while malformed or duplicate records are bounded; a real Inspector choice changes the world receipt from zero to one and leaves a visible compliance seal after the modal closes; seven curated traces compose at 1280x720; an isolated trace remains legible at 390x844 with zero horizontal overflow; full and Reduced Motion branches report accurately.
- Primary: `tests/core.test.mjs`, `tests/package-selftest.cjs`, `evidence/visual/decision-archaeology-choice-desktop-1280x720.png`, `evidence/visual/decision-archaeology-all-desktop-1280x720.png`, and `evidence/visual/decision-archaeology-mobile-390x844.png`.
- Counterevidence: unmapped choice, duplicate/unknown save record escaping sanitization, state mutation, event-effect change, modal closure without a trace, wrong event anchor, illegible artifact, responsive overflow, motion continuing under Reduced Motion, console error, or runtime failure.
- Cannot prove: universal comprehension or visual taste, physical-phone feel, physical screen-reader behavior, representative GPU performance, or human balance.

## `consequence-reveal`

- Claim: a newly resolved event choice visibly becomes its permanent station trace without replaying restored history or changing event mechanics.
- Kind: deterministic presentation / temporal visual / interaction / responsive accessibility; risk: medium.
- Pass: the real Inspector choice moves from modal-open, zero decisions, and reveal idle to one `inspector:repair` trace with active semantic phase/progress, then settles at artifact scale 1; the pure frame projection is deterministic; the static history renderer contains no reveal call; Reduced Motion starts and remains at scale 1 without spatial travel; compact play applies the authored 0.74 temporary effect scale; desktop and 390x844 routes have zero horizontal overflow, no runtime-error UI, and a clean focused console.
- Primary: `tests/core.test.mjs`, `tests/package-selftest.cjs`, `evidence/visual/consequence-reveal-baseline-desktop-1280x720.png`, `evidence/visual/consequence-reveal-midpoint-desktop-1280x720.png`, `evidence/visual/consequence-reveal-settled-desktop-1280x720.png`, `evidence/visual/consequence-reveal-reduced-desktop-1280x720.png`, and `evidence/visual/consequence-reveal-mobile-390x844.png`.
- Counterevidence: reveal on page load or history restore, wrong trace ID, modal closes without active reveal, artifact fails to remain after cleanup, Reduced Motion scale/travel changes, responsive effect overwhelms or overflows the layout, console error, runtime failure, or changed event-state result.
- Cannot prove: exact animation cadence, universal visual preference, physical-phone feel, physical screen-reader behavior, representative GPU performance, human balance, or fun.

## `debt-liberation`

- Claim: the existing AXM debt visibly releases its claim on the station as real service payments reduce the authoritative balance, without changing economy or balance rules.
- Kind: deterministic projection / visual appearance / temporal interaction / responsive accessibility; risk: medium.
- Pass: the pure projection maps fixed debt balances to 720/0/six links/`LIEN LOCKED`, 420/.417/four links/`LIEN CRACKING`, 14/.981/one link/`FINAL CLAIM`, and 0/1/zero links/`STATION YOURS` without mutating state; HUD and 3D receipts match; the real Serve Pumps control moves 14→0 through the established cash/debt split, drops the final link, opens the lock, and announces ownership; Reduced Motion reports a static confirmation; 390x844 retains the compact lien strip and lock with the redundant world placard suppressed; desktop/mobile overflow and fresh focused console warnings/errors remain zero.
- Primary: `tests/core.test.mjs`, `tests/package-selftest.cjs`, `evidence/visual/debt-liberation-locked-desktop-1280x720.png`, `evidence/visual/debt-liberation-cracking-desktop-1280x720.png`, `evidence/visual/debt-liberation-final-before-desktop-1280x720.png`, `evidence/visual/debt-liberation-release-desktop-1280x720.png`, `evidence/visual/debt-liberation-settled-desktop-1280x720.png`, `evidence/visual/debt-liberation-release-reduced-motion-desktop-1280x720.png`, `evidence/visual/debt-liberation-clear-desktop-1280x720.png`, and `evidence/visual/debt-liberation-mobile-390x844.png`.
- Counterevidence: stage/link/progress mismatch, debt projection mutating state, payoff bypassing the real service split, stale link after debt reaches zero, unreadable clear label, redundant mobile placard overlap, spatial travel under Reduced Motion, responsive overflow, console error, runtime failure, or changed economy result.
- Cannot prove: exact animation cadence, universal comprehension or visual preference, physical-phone feel, physical screen-reader behavior, representative GPU performance, human balance, or fun.

## `interaction-journey`

- Claim: a user can choose a contract, advance/skip the opening, serve, restock, upgrade, resolve an event, pause, and reach a result.
- Kind: interaction journey; risk: medium.
- Pass: real browser inputs complete the path with observed state transitions.
- Primary: in-app browser actions plus `window.__LAST_STOP_NEBULA__.snapshot()` countercheck.
- Counterevidence: blocked modal, no state mutation, missing escape route.

## `save-recovery`

- Claim: an in-progress run survives reload and resumes.
- Kind: persistence; risk: medium.
- Pass: save known state, reload the page, use Continue, compare day/cash/reviews/upgrades.
- Primary: fresh browser reload plus local runtime snapshot.
- Counterevidence: missing Continue, reset state, incompatible save.

## `local-balance-ledger`

- Claim: completed and failed runs produce bounded local summaries that can guide future retirement-timer balancing without changing live rules.
- Kind: persistence / deterministic aggregation / visual; risk: medium.
- Pass: telemetry captures day/final points, valid 0.9–0.20 saves migrate, ledger deduplicates and caps at 24, each contract waits for three matching runs, failed runs remain at the review limit on later curve days, QA routes do not write, and desktop/mobile ledger surfaces remain usable.
- Primary: `tests/core.test.mjs`, `tests/telemetry.test.mjs`, `evidence/visual/contract-ledger-desktop-1280x720.png`, `evidence/visual/contract-ledger-mobile-390x844.png`, and `evidence/visual/contract-ledger-mobile-actions-390x844.png`.
- Counterevidence: unbounded storage, duplicate runs, mixed-contract recommendations, survivor-biased curves, automatic balance mutation, lost valid saves, clipped metrics, or external transmission.

## `anonymous-balance-report`

- Claim: a player can voluntarily carry compact field data out of the browser without exposing run identity, exact run timestamps, save state, or device data.
- Kind: privacy / serialization / interaction; risk: medium.
- Pass: deterministic report tests reject identity fields, the live download link decodes to the declared report schema, and mobile report actions remain reachable.
- Primary: `tests/telemetry.test.mjs`, `tests/package-selftest.cjs`, and the contract-ledger visual evidence above.
- Counterevidence: automatic upload, identity-bearing fields, malformed JSON, missing download action, or unreachable mobile controls.

## `event-presentation-variety`

- Claim: milestone decisions can replay with alternate authored framing while preserving their established mechanics and readable pressure pause.
- Kind: deterministic behavior / visual appearance / interaction; risk: medium.
- Pass: all seven events expose two deterministic seed-selected presentations with identical choice arrays; the live card cuts to its declared camera, fits desktop and responsive viewports, and returns to play with authored consequence copy after one real choice.
- Primary: `tests/core.test.mjs`, `evidence/visual/event-dispatch-desktop-1280x720.png`, `evidence/visual/event-consequence-desktop-1280x720.png`, and `evidence/visual/event-dispatch-mobile-390x844.png`.
- Counterevidence: seed instability, changed choice effects, clipped choices, wrong camera context, unresolved blocking modal, or immediate display of a different pending event.

## `accessible-event-control`

- Claim: a keyboard player can understand, traverse, and resolve every required event decision without focus escaping behind the blocking overlay, and can reduce UI motion through the declared setting.
- Kind: interaction / accessibility / deterministic UI state; risk: medium.
- Pass: the dialog exposes role/name/description semantics, focus enters choice 1, Shift+Tab and Tab wrap across only the available choices, `1`–`3` resolve matching choices, focus returns to a visible control, and Reduced Motion changes CSS timing plus the scene branch while accurately reporting pressed state.
- Primary: live in-app-browser keyboard inputs and computed-style inspection, `tests/package-selftest.cjs`, and `evidence/visual/event-keyboard-focus-desktop-1280x720.png`.
- Counterevidence: body focus on open, focus moving behind the dialog, ignored numeric input, unresolved modal, hidden focus, stale pressed state, or unchanged CSS timing.

## `accessible-blocking-overlays`

- Claim: keyboard users can enter, traverse, leave, and recover from Pause, Help, and the private balance ledger without focus escaping behind a blocking overlay.
- Kind: interaction / accessibility / deterministic UI state; risk: medium.
- Pass: all three overlays expose labelled and described modal-dialog semantics; focus enters Resume or the relevant close control; Shift+Tab and Tab wrap first-to-last and last-to-first; Help returns to Controls & Rules inside Pause; closing Pause returns to the game Pause control; closing the ledger returns to Private Field Data.
- Primary: live in-app-browser keyboard inputs at 1280×720 and `tests/package-selftest.cjs`.
- Counterevidence: body focus on open, background focus while an overlay remains visible, broken nested return, missing Escape path, or focus restored into hidden content.
- Cannot prove: physical screen-reader announcements or assistive-technology interoperability.

## Sealed verdicts — 2026-07-28

- `launch-local`: **PASS** — target health, observation, HTML, module MIME, path confinement, and offline-source tests passed.
- `rules-work`: **PASS** — focused deterministic suite passed.
- `run-is-viable`: **PASS WITH LIMIT** — five active fixed seeds retired; inactive policy failed. Human balance remains unmeasured.
- `visual-3d-quality`: **PASS** — desktop and responsive frames show the 3D world, scene changes, queues, complete upgrade state, drawers, decisions, and outcomes without console errors.
- `upgrade-visual-integrity`: **PASS WITH LIMIT** — all 12 declared upgrades have static route coverage, the isolated Twin Pumps route visibly rendered its paired roof rails and six nodes after correction, all four complete-station camera views rendered, and bounded frames differed; representative GPU performance and human art preference remain unmeasured.
- `render-quality-control`: **PASS WITH LIMIT** — the real Pause control applied all three declared renderer profiles, Eco persisted across reload, Cinematic was restored after QA, desktop and 390×844 layouts had no horizontal overflow, and focused console capture was clean; representative-device performance remains unmeasured.
- `installed-upgrade-inspection`: **PASS WITH LIMIT** — all 12 built cards exposed semantic View actions; desktop Patch Kit and mobile Pump Drone scans selected the correct cameras, closed the drawer, preserved visible run/resource values, and rendered without overflow; focus recovery passed for inspection and ordinary close. Physical assistive-technology behavior and human art preference remain unmeasured.
- `service-choreography`: **PASS WITH LIMIT** — manual, automated, angry-loss, and blocked routes produced distinct world/HUD signals; served and lost customer state changed only through the existing core paths; the 390×844 Mart route had zero horizontal overflow; Reduced Motion held a static `MANUAL CLEAR` card with animation disabled. Bounded screenshots do not establish exact cadence, representative GPU performance, physical-device feel, or universal visual taste.
- `tactical-guidance`: **PASS WITH LIMIT** — deterministic/state-neutral tests, focus-only static routing, real urgent-lane and non-modal build interactions, stable drawer focus, 390×844 bounds, zero horizontal overflow, and a static Reduced Motion target passed. Representative human comprehension, strategic optimality, and visual preference remain unmeasured.
- `inbound-vector`: **PASS WITH LIMIT** — deterministic/state-neutral forecast tests, three authored visual states, a real unpaused `2.3 SEC → 1.1 SEC → arrival` sequence, queue reset evidence, matching HUD/scene receipts, 390×844 bounds, and Reduced Motion CSS suppression passed. The visual does not predict the future random lane/species and has no physical-device or human-comprehension certification.
- `queue-constellations`: **PASS WITH LIMIT** — deterministic/state-neutral queue projection, steady/critical world receipts, lane-anchored desktop/mobile frames, and a real Pumps `01 → 00` service transition passed; cash changed only through the existing serve path, reviews stayed 386, and Reduced Motion held the static branch. Close portrait cameras can crop a world-space plate, and physical-device performance plus human comprehension remain unmeasured.
- `decision-archaeology`: **PASS WITH LIMIT** — all 17 choices have unique deterministic trace routes; 0.22 migration preserved valid history; a real Inspector choice produced a persistent compliance seal; seven accumulated desktop traces and the isolated responsive trace rendered without horizontal overflow; full and Reduced Motion branches reported accurately. Physical-device feel, human comprehension, and representative GPU performance remain unmeasured.
- `consequence-reveal`: **PASS WITH LIMIT** — deterministic frame tests, real baseline/active/settled choice observations, static Reduced Motion at scale 1, no history replay, compact effect scale `.74`, desktop/mobile zero-overflow checks, and clean focused console capture passed. Bounded screenshots do not establish exact cadence; physical-device feel, human preference, screen-reader behavior, and representative GPU performance remain unmeasured.
- `debt-liberation`: **PASS WITH LIMIT** — deterministic/state-neutral stage tests, four authored desktop stages, a real 14→0 service payment, final link/lock release, static Reduced Motion confirmation, responsive HUD-only placard fallback, zero desktop/mobile overflow, and a clean focused console passed. Bounded screenshots do not establish exact cadence; physical-device feel, human comprehension, screen-reader behavior, and representative GPU performance remain unmeasured.
- `interaction-journey`: **PASS** — real inputs completed contract, opening, service, supply/upgrade, event, pause/recovery, and result paths.
- `save-recovery`: **PASS** — day 5, 77 CR, and 701 reviews matched exactly after reload and Continue.
- `local-balance-ledger`: **PASS WITH LIMIT** — contract isolation, survivor-bias handling, deterministic storage/aggregation tests, and responsive live visuals passed; representative human samples do not exist yet.
- `anonymous-balance-report`: **PASS** — the generated report is valid local JSON, carries no run identities or exact run timestamps, and both download and copy controls are visibly reachable.
- `event-presentation-variety`: **PASS** — deterministic tests covered all seven two-dispatch event definitions without mechanical mutation; desktop and mobile live checks showed both inspector dispatches, the engineering feed, reachable choices, consequence feedback, and recovery to play.
- `accessible-event-control`: **PASS WITH LIMIT** — keyboard focus/choice/recovery and reduced-motion computed timing passed at 1280×720 with zero console warnings/errors; no physical assistive-technology or phone certification is claimed.
- `accessible-blocking-overlays`: **PASS WITH LIMIT** — Pause, nested Help, and ledger initial focus, bidirectional wrapping, Escape closure, and return focus passed at 1280×720 with zero focused console warnings/errors; no physical screen-reader certification is claimed.

- `shift-horizon`: **PASS WITH LIMIT** — deterministic/state-neutral projection, four distinct desktop phase frames, matching HUD/canvas receipts, responsive bounds, full/static motion branches, and clean focused console capture passed. Physical-device performance, physical assistive-technology behavior, and human visual preference remain unmeasured.

No raw recording buffer was created. Selected proof PNGs were preserved under `evidence/visual`; intermediate motion frames existed only in the bounded in-memory browser response. Cleanup complete: yes.
