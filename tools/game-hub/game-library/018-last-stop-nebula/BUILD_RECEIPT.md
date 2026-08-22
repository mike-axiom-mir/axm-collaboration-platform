# Build receipt — TEST beta 0.26 (unsealed)

Version: `0.26.0-beta`  
Observed: `2026-08-16T05:57:11Z`  
Status: `TEST` — playable local 3D beta; Mike Tobi review and balance acceptance pending.

## Result

Beta 0.26 adds Signal Dispatches, a repeatable optional objective layer that remains active throughout all three existing contracts. Four seed-ordered dispatches ask the player to cover all three lanes manually, complete a hands-on quota, protect a clean convoy, or clear customers early. The sequence rotates after completion or failure and repeats for longer contracts. Current objective, deadline, progress, completions, failures, streak, marks, and rotation revision persist in the browser-local save.

Dispatches do not change cash, supplies, debt split, bad reviews, arrivals, event effects, upgrade prices, or the 6/9/12-minute contract timers. Each captured mark adds 30 retirement-score points before the existing contract multiplier. A compact HUD strip and a physical roof-mounted 3D signal board show the same deterministic state; Reduced Motion preserves the semantic read while stopping decorative signal animation. Valid 0.9 through 0.25 saves migrate to 0.26.

## Verification

- Runtime syntax: `app.mjs`, `game-core.mjs`, `run-telemetry.mjs`, `scene.mjs`, and `server.cjs` passed `node --check`.
- Focused/full slot suite: **52/52 passing** (including three new deterministic dispatch/migration/score tests and an end-to-end HTTP check).
- Slot package verifier: **0 errors**, one unchanged honest warning (`physical phone qa is pending`).
- Required Workshop gates: all **10/10 commands exited 0**. Repository `verify.js` remained **0 failures / 43 warnings**; the warnings predate and remain outside this leaf lane.
- Isolated local server on port 19818 stopped cleanly; the port was confirmed free. Browser tabs were closed.

## Live desktop 3D proof

Visual backend: in-app browser at 1280×720. No rolling-video buffer or true 390×844 viewport override was exposed, so this receipt covers bounded desktop frames only and does not claim physical-phone or fresh portrait-browser proof.

- Held active route: HUD and canvas both reported `lane-circuit / active / 2/3 / 7 marks`; the roof board visibly showed the same title, progress, remaining time, and marks. Horizontal overflow was zero and no runtime-error UI appeared.
- Real interaction: the actual Serve Bay control removed the queued Bay customer and completed the dispatch through the normal manual-service path. HUD and canvas moved to `completed / 3/3 / 10 marks`, the completion announcement reported `+3 MARKS · 1 STREAK`, and the physical board entered its captured state.
- Rotation: after the authored 4.5-second result read, the same live run rotated to `early-clear / active / 0/4 / 10 marks`; the HUD and 3D board agreed.
- Persistence: a normal non-QA standard run was paused and reloaded through the player-facing save/continue flow. `early-clear / 0/4 / 0 marks / 0:48` matched before and after reload exactly.
- Reduced Motion: the real Pause control enabled the reduced branch. A completed clean-sweep route reported `7/7 / 11 marks / reduced`, while the dispatch signal's computed CSS animation was `none`.
- Fresh primary and secondary tab log reads were both empty. No screenshots were retained as files during this pass.

## Honest boundary

Human fun, Signal Dispatch difficulty, the 30-point mark value, physical-phone behavior, physical screen-reader behavior, representative GPU performance, gamepad/controller support, Steam packaging/depot upload, Steamworks integration, store review, and broader multi-player testing remain unproven. This is a `TEST` content expansion, not `CANON` and not a Steam-release certification.

## Selected digests

- deterministic core: `F35B2B2E6B67DC70CFEAEE872973A08832831E0BB79DECF733B5B74D5715EA24`
- UI/controller: `450ECC5E1D19B5BB8033C1C06227B7F4D20659D369BC40A58D29248B48896790`
- 3D scene: `71579050EF72427FDCBE824BEA5115C1B624277F89F732DB3AC6D729921A6191`
- slot manifest: `68F14F4D294D708A0F2486BE9D0F416B0EDC07E5E79FDE0BE4128A7567A7060D`

---

# Prior sealed build receipt — verified local beta 0.25

Version: `0.25.0-beta`  
Sealed: `2026-07-28T13:41:06.1126029Z`

## Result

LAST STOP: NEBULA is a launchable, self-contained Game Hub beta in slot 018. Beta 0.25 adds Debt Liberation: the existing 720-credit AXM lien now drives a persistent HUD release strip, central station lock, perimeter lattice, and six removable claim links. Real service receipts expose the established debt balance before and after payment; the actual final 14→0 service drops the last link, opens the lock, and announces station ownership. Responsive play keeps the HUD and lock while suppressing the redundant world placard, and Reduced Motion presents a static confirmation. No price, payout, arrival, queue, resource, upgrade, timer, event, score, or balance rule changed. Valid 0.9 through 0.24 saves migrate to 0.25. The complete focused suite passed **48/48** tests.

The slot-018 verifier reports zero errors. Its only remaining package warning is physical-phone QA.

## Live browser proof

Visual backend: `BROWSER_PRIMARY` (Codex in-app browser). No rolling-video buffer capability was exposed, so motion was observed through bounded baseline, midpoint, settled, and recovery screenshots rather than a continuous recording.

Observed at desktop viewports (1280×720 and 1440×900):

- 0.25 held lien stages produced matching HUD/canvas receipts and authored world states: `LIEN LOCKED` at 720 / `.000` / six links, `LIEN CRACKING` at 420 / `.417` / four links, `FINAL CLAIM` at 14 / `.981` / one link, and `STATION YOURS` at 0 / `1.000` / zero links;
- the real Serve Pumps control moved debt 14→0 through the established sale split, exposed `payment=cleared / phase=active`, dropped the final link, opened the lock, announced `AXM LIEN RELEASED / THE STATION IS YOURS`, and settled with zero links;
- Reduced Motion, enabled through the real Pause control, reported `motion=reduced / phase=static-confirmation` and the same authoritative 0-debt ownership state without spatial payoff travel;
- the clear-state mission label was rechecked after its text/background selector was separated; it rendered readable teal text instead of a solid block;
- the fresh focused 0.25 debt session returned zero console warnings/errors, no runtime-error UI, and zero horizontal overflow;
- 0.24 real Inspector / Emergency compliance choice moved from modal-open, `decisionCount=0`, reveal `idle` to modal-closed, `decisionCount=1`, `inspector:repair`, active assembly progress `.489` / artifact scale `1.044`, and settled progress/scale `1/1`;
- 0.24 Reduced Motion, enabled through the real Pause control, reported `static-confirmation`, `motion=reduced`, and artifact scale `1` in both bounded active and settled observations; a seven-trace restored-history route remained `reveal=none`, `phase=idle`, so history did not replay the effect;
- the fresh focused 0.24 consequence session returned zero console warnings/errors, no runtime-error UI, and zero horizontal overflow;
- 0.23 accumulated showcase exposed seven ordered event/choice IDs and seven distributed, choice-specific physical traces; the player-controlled motion branch reported `full` and the static Reduced Motion branch reported `reduced`;
- a real Inspector / Emergency compliance choice changed the authoritative station receipt from `decisionCount=0` to `1`, closed the event modal, and left `inspector:repair` visible as a labelled compliance seal in the engineering forecourt;
- 0.22 held routes exposed `FIRST LIGHT / 08:26 / .080`, `HIGH ORBIT / 13:50 / .380`, `EMBER SHIFT / 18:52 / .660`, and `DEEP WATCH / 22:50 / .880`; matching HUD and canvas receipts accompanied visibly distinct warm, cool, coral, and deep-night station atmospheres;
- Shift Horizon's reached markers and progress beacon followed the existing day-clock projection; full-motion reported `full`, Reduced Motion reported `reduced`, and neither branch changed cash, reviews, queues, or any simulation rule;
- 0.21 held critical queue state exposed `fuel:4|mart:3|garage:3`, lead/danger `fuel`, and tones `danger/warning/steady` as matching lane-anchored red/amber/violet holograms; zero horizontal overflow and no runtime-error UI were observed;
- a real 0.21 manual service changed Pumps from `01 / STABLE` to `00 / CLEAR` and removed its world marker through the existing serve path; cash rose 4,260→4,317, reviews stayed 386, and Mart/Bay remained `01 / STABLE`;
- 0.20 held forecast routes exposed `ON VECTOR · 2.4 SEC`, `FINAL APPROACH · 0.4 SEC`, and `CONVOY SURGE · 0.2 SEC · +3`; the HUD tone/progress and canvas receipts matched, while the imminent route rendered the authored red path, pips, and gate;
- a real unpaused 0.20 service route moved from `ON VECTOR · 2.3 SEC` to `APPROACHING · 1.1 SEC`; after the arrival, the waiting queue rose 3→4 while cash stayed 4,260 CR and reviews stayed 386;
- 0.19 urgent Repair Bay guidance selected Engineering, highlighted the bay, and focused Serve Bay while cash remained 4,260 CR, reviews 386, and the queue three; build guidance opened the non-modal drawer, highlighted/focused Pump Drone P-1, and preserved 4,260 CR, 2/12 built, and three waiting customers;
- Reduced Motion exposed the guided Pump Drone target with `animation=none` and `duration=0s`; ordinary HUD refreshes no longer recreated an unchanged drawer grid or discarded its focus;
- 0.18 manual Fuel service rendered a teal machinery-to-customer energy arc, chevrons, smooth departure, and `MANUAL CLEAR`; cash rose 4,260→4,319, Fuel queue fell 1→0, and reviews remained 386 through the existing service path;
- automated Garage service selected Engineering and exposed `AUTO CLEAR`; angry Fuel loss produced a red broken signal, unstable departure, `CUSTOMER LOST`, and the authored 386→410 review penalty; empty-lane input produced a local red X/ring and `BLOCKED` without moving a customer;
- Reduced Motion reported `class=true`, `aria-pressed=true`, service-card `animation=none`, and stable `.96` opacity while the scene used its bounded departure branch;
- 0.17 Station evolution exposed 12 named installed-upgrade buttons; Emergency Patch Kit selected Engineering and rendered the tank scan while day, clock, cash, debt, reviews, plasma, stock, and energy remained unchanged;
- inspection closed the drawer and returned focus to the active `03 ENGINEERING` camera control; a normal drawer close returned focus to Build;
- 0.16 Pause control applied Cinematic (`1700/280/30`, shadows on, 1.7 cap), Balanced (`1250/180/15`, shadows on, 1.35 cap), and Eco (`850/90/10`, shadows off, 1.0 cap);
- Eco remained selected with identical live renderer state after reload; resumed Eco gameplay and the final sealed Cinematic scene stayed coherent without horizontal overflow;
- 0.15 all-upgrade forecourt, mart, engineering, and nebula cameras with readable station atmosphere and dedicated upgrade effects;
- 0.15 isolated `twin-pumps` showcase with two visible canopy rails and six pressure nodes after correction;
- bounded 420 ms scene frames produced distinct SHA-256 prefixes (`75525d45133c`, `fadfeac8a462`), while the real Reduced Motion control reported `dataset=reduced` and `aria-pressed=true`;
- title and contract entry;
- cinematic opening plus camera transition;
- live queues, vehicles, customer urgency, resources, and growing review pressure;
- decision event and recovery to play;
- 0.12 seeded inspector dispatch at 1280×720, with the full three-choice card inside the viewport, engineering-camera context, and correct recovery to play after a real choice;
- 0.13 keyboard decision flow at 1280×720: focus entered choice 1, wrapped 1→3→1 with Shift+Tab/Tab, `2` selected hospitality, the modal closed, and focus returned to Pause;
- 0.14 Pause flow at 1280×720: focus entered Resume, wrapped Resume→Abandon→Resume, Escape closed the overlay, and focus returned to the game Pause control;
- 0.14 nested Help flow: focus entered Close help, wrapped Close→Done→Close, Escape returned to Pause with focus on Controls & Rules, then a second Escape returned focus to the game Pause control;
- 0.14 ledger flow: focus entered Close balance ledger, wrapped Close→Close Field Data→Close, and Escape returned focus to Private Field Data;
- Reduced Motion ON produced `0.00001s` computed UI animation/transition timing and `aria-pressed=true`; OFF restored authored timing and `aria-pressed=false`;
- manual service changing cash, debt, energy, and queue state;
- emergency patch purchase changing `LEAK` to `SLOW LEAK`;
- builder-drone choice granting pump automation;
- upgrade drawer while simulation continued;
- pause overlay and `Escape` recovery;
- save at day 5 / 77 CR / 701 reviews, reload, and exact-value resume;
- four authored camera views, including settled engineering and nebula views;
- full 12-upgrade high-tech station showcase;
- retirement payout (8,450 CR) and license-revocation payout (0 CR);
- upgraded retirement results with grade, reviews/day, demand capture, and automation share;
- populated contract-specific ledger with five runs, a 21-day estimate from three matching samples, average review curve, and results-to-ledger interaction;
- All / 14 Day / 21 Day filter behavior, including no mixed-contract estimate and insufficient-sample guidance;
- decoded local report download with schema `last-stop-nebula-balance-report/v1`, five anonymous run samples, and no run identity or exact run timestamp;
- focused 0.22 Shift Horizon console capture returned zero warnings and zero errors across desktop and responsive phase routes; no runtime-error UI was observed;
- a fresh focused 0.23 session covering the accumulated station, real event choice, and responsive isolated trace returned zero console warnings and zero errors after the material-constructor warning was corrected; no runtime-error UI was observed;
- zero captured console errors or warnings during the 0.10 full journey, focused 0.12/0.13 event sessions, focused 0.14 Pause/Help/ledger session, focused 0.15 visual-growth session, focused 0.16 renderer-profile session, and focused 0.17 upgrade-inspection session. The 0.11 ledger plus focused 0.18 service-choreography, 0.19 tactical-guidance, 0.20 Inbound Vector, and 0.21 Queue Constellations sessions had no exposed console-log reader, so no broader claim is inferred for those sessions; 0.21 showed no runtime-error UI and passed fresh-process HTTP plus automated checks.

Observed at 390×844 responsive viewport:

- 0.25 kept the compact mission lien strip visible at `[19,272,158,26]` with `LIEN LOCKED / 720 CR`, retained the central lock and links, suppressed the redundant world placard with `debtLabel=hud-only`, and reported `scrollWidth=clientWidth=390`, full motion, and no runtime-error UI;
- 0.24 real Inspector choice reported full-motion assembly, responsive effect scale `.74`, progress `.404`, artifact scale `1.081`, zero horizontal overflow, and no runtime-error UI;
- 0.23 isolated `inspector.repair` kept the labelled compliance seal visible with `decisionCount=1`, `decisionIds=inspector:repair`, and zero horizontal overflow under the final source;
- 0.22 Ember Shift kept its phase label at `left=81.5`, `right=126.5`; Current Pressure remained `left=8`, `right=188`, resources `left=204.4`, `right=382.4`, and the lane dock `left=8`, `right=382.4`; horizontal overflow and runtime-error UI were both false under the static Reduced Motion branch;
- 0.21 Queue Constellations retained visible Mart and Bay plates in the close vista while Current Pressure and the lane cards preserved the cropped Pumps read; mission/resources/lane-dock bounds were unchanged, horizontal overflow was zero, and Reduced Motion reported pressed/shell/canvas `true/reduced/reduced`;
- 0.20 Current Pressure and Inbound Vector fit at `left=8`, `right=188`, `bottom=309.2` beside resources beginning at `left=204.4`; the arrival strip remained readable, horizontal overflow was zero, and Reduced Motion exposed `animation=none` on its decorative signal;
- 0.19 Current Pressure remained visible as a compact action (`left=8`, `right=188`, action `top=231.4`, `bottom=265.4`) beside resources (`left=204.4`, `right=382.4`) with zero horizontal overflow;
- 0.18 manual Mart service exposed `MANUAL CLEAR` on the visible lane card when the close camera cropped part of the 3D path; cash rose 4,260→4,295, reviews stayed 386, and `scrollWidth=clientWidth=390`;
- the 0.17 Station evolution drawer fit with zero horizontal overflow and exposed all 12 built-card actions; Pump Drone P-1 switched to Forecourt without changing cash or reviews;
- the 0.16 Pause card and its Reduced Motion, Sound, and Graphics controls fit inside the viewport (`left=8`, `right=382.4`, `bottom=626.65`) with zero horizontal overflow;
- the 0.15 expanded all-upgrade station, full HUD, camera dock, and all three service lanes rendered with `scrollWidth=clientWidth=390` and Reduced Motion active;
- title composition without body overflow;
- full gameplay HUD with all three service lanes usable;
- full-width scrollable upgrade drawer;
- retirement card within viewport bounds (`top 134`, `bottom 710`, viewport height `844`).
- upgraded result card within viewport bounds (`top 60`, `bottom 784`);
- contract ledger with zero horizontal overflow; its full report controls become visible after an 88 px bounded internal scroll;
- title card includes the private field-data entry point without overflow.
- alternate inspector dispatch at 390×844 with all three choices visible, no internal scroll, and no horizontal overflow (`card top 174`, `bottom 670`).

The responsive result is not a physical-phone certification. `physical_phone_qa` remains pending.

## Selected digests

- deterministic core including Debt Liberation projection and payment receipts: `B0FA93F634B72096A28BFBD72E5777A4986FDC6433F0BD32D8A682CFD3893089`
- Debt Liberation app integration and QA routes: `DA3813CF616142AE2B35CE0812FC2A45AAD9BAF9C05C34FB21E898FEE3A2C401`
- Debt Liberation 3D scene and responsive placard fallback: `3C62C5D5591112A562CFE379FF4B0BA983B2EF639D61D2171B43CF77BBFFB37D`
- Debt Liberation HUD styling: `7C00FF5393781F501B864EB05628788C7517626618018A2EBAF4CE6FBC69FE95`
- locked desktop proof: `8460457B4D41537B6CF88911ED725EFC79B11A5C308177F6AB53E41819FF290C`
- cracking desktop proof: `D32DB7A2BF2C070EFC22C39DB4D7AC2BE6ABE458EE188EB3D7172C1621C1BE4C`
- final-claim desktop proof: `0C523A9571D3D06DAAD89DB3E08C65EC6192ED9EE05383EB2094E3138B8E21D2`
- ownership-release desktop proof: `BAA0D553B580A8B9FA53C8DFCECA9AF24C772760D0585CDB5B36236681075A71`
- settled ownership desktop proof: `D586658EA09C4B701D5A350372A12BF1969E3A792AB2BEE5B5190AFCFC56CF80`
- Reduced Motion ownership proof: `21955F0FDCC0F24CAA2767033A70FD0F1D8A88FE2743C283552D5B2E6159A732`
- clear-stage desktop proof: `F5582B077471878BADB9F857498A02C7BB2048F44CA775039DDB469A40E31E25`
- responsive Debt Liberation proof: `4E7862488EBABB8E27BC1444F386DC81364175F894222BB5F7BFC9776B3E5007`
- 0.25 local health route: `DE1F24ED3D7195C8E5EFC9E534706CBC02772465A01D74D34966AFC9C33D3232`
- 0.25 visual verification receipt: `563BAC15DE3C7FB03F2D72C3AA7FD76B49C2C924B08C91A4D04353EBEC8023F2`
- slot manifest: `A9CD23DE29A24CF62E9D7B1FAF5A122C43E581E07CDB1887A8E97B8EECD21A24`
- deterministic core including Consequence Reveal frame projection: `41436E96D873635ED631D8249057DA4680AD125D7A1A3E38CB75667E1377CA79`
- event-resolution integration and semantic reveal receipt: `5B6E32F8DB0B6FC92629C2D9A79217C7D2D06F2256764DAA3E310361301F5D4F`
- Consequence Reveal 3D scene: `D91748A58566C5ED2CC5191C6F1C425916FA95E154EF2E868AE740A6226CF851`
- baseline desktop proof: `F4B98DDC7C51A524A362541BA903F7C2787FE9E25C481F95976E1A449205378A`
- active desktop proof: `0091DA0D3A815EF24D4393A3882A413C54AB2C0282A3CFFA9E34062717A97F35`
- settled desktop proof: `0F92DE47EB00D2EA3BF674E1311F1092F73CE188752C57D5DE81D8BCA6CBB5E4`
- Reduced Motion active proof: `CE8C7F9A6DA7DD8064BD1699EC928FEFF5839FC5F62782F2BF26FACE312CF1C6`
- responsive active proof: `BEF4BB31541C84CAFA05F43E5019E63928006B2AE989D51C1986C2B6772C6365`
- deterministic core including Decision Archaeology projection and migration: `EDE9CF0D99A3097758C5F3DD90C2A0982121A565367F22C0D000968F6F47E635`
- Decision Archaeology integration and QA routes: `3128DFF074756D2A0CFF2C140115B75CA7EB38BE6EA58ECEE8013D5AD909A81D`
- Decision Archaeology 3D scene: `D1A179DE176C660C88380AF7D254222AC23D81B569C691E41E884C28D660FF6C`
- real-choice desktop proof: `775CC5903F76BDC1830E163C366214873D6D8765207EF0F5A52A5D4B1382C06E`
- accumulated desktop proof: `48F4EE5DD2FCF132AC9036C7451542AEAD6D6AE410EC40E01DF03870D25439BC`
- isolated responsive proof: `E2DD9822BE4B9C9E3A18AD86427A05DA6F397A93EF7FE1E73BC65D78909910D6`
- responsive Shift Horizon styling: `A0E0F548038DAE7B8477FA7267AFAC801EFB7BAE31BA955C58D5F4DD5A574130`
- First Light desktop proof: `4BBC9233B94317314EF6140990271A00128920D1AEABFCB45D73B22E566380F0`
- High Orbit desktop proof: `E1E4914156A971A99481FDEBAB57E0E55DE0580B4B9056A0984DB3968685DDCA`
- Ember Shift desktop proof: `A0FADC0468EC6A13036DE0F4584C3CEE9A466D78979E8D9630616BCBC7A41597`
- Deep Watch desktop proof: `FBD716D86B853EDA560453195BFF77CF68E1E92B2678221CDF2F9B6FA9A4A6BD`
- Ember Shift responsive proof: `5B75AACA3BDBEBC6D2CDA02EAB4B811123864BFA663BB3235AD3E443E4C274DD`
- critical desktop proof: `E5E708D35802311F4A8437D14D2DA9071504242A71BA278E71552621AEC147F7`
- critical responsive proof: `FF27837473B30AB2579BBC6C8DE0DAF908EDFED0EFCCB3662912DC0DD64846B4`
- live service before proof: `E1D94CD8A5CC2E9918876CC73A40EC1E19B5B3389B10912A927B4A55D5AAD887`
- live service after proof: `6C38F22691A2A8E348D73F08CE2C9B123ADD312EF15C6D90843A7800EC8AB22D`
- Three.js r160 vendor: `76DEA8151BC9352AEF3528B4262E249B2604F62543828328DB978D060D61A495`
- high-tech desktop proof: `29B657D01A566E78D3B18E1419F51CFE7947618E66CE8DD90523F5F730E30AB4`
- responsive high-tech proof: `D68972A37004EDCF684BDC040D354F49D822283A6BE86BFDC0E438E336AD82D7`
- desktop contract ledger (1280x720): `E219C1370F05C37FCFAF504E721E43D10EA2FB2B4E628DC19DD2BA28A3089892`
- mobile contract ledger top: `0800F6EFD9E672F7CD8D74FA8C1ABFA2F2B8B831B7750CC19C37F969EA2241A8`
- mobile contract ledger actions: `B8F022CFD249CDD56676DDF8FB68EF77F8127779391A8627E323803EB89F9E8F`
- desktop run analysis: `5A2D06B3D7EC4018301D494369CD01B1D148DA64BBDDB077F68EBE9EAFA955C1`
- desktop event dispatch: `287FE008BE7830ED31EC658181352EE0A391CFB23D703A59E80C1CE291C64B92`
- desktop event consequence: `E505157F2FED7631994BC0AAC7A01B9B8805E2A3935D80AE745036FA678F1809`
- mobile event dispatch: `33F6951B36EC96FC801DA1C7AF174F325BC042BE690A14197FCDA0FA91DB7953`
- desktop keyboard-focus event: `4742EE3AC4A32CF27D6167101CCEBA99C016B1965DDE66C54C01524821F0C226`

## Honest boundary

Human fun and final balance are not proven by deterministic policies. Representative GPU performance, physical-phone feel, physical screen-reader behavior, co-op, multiplayer, cloud saves, and additional locations are not claimed in this beta.
