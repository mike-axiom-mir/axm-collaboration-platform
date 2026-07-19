# Known Limits — AXM District Party v0.2.7 Interactable Asset Pass

## Version and integration

- **PARTIAL — local version alignment:** this was built over the validated v0.2.6 package. Mike reported a newer Local Codex bugfixed copy; use the focused v0.2.7 port kit instead of replacing that project wholesale.
- **PARTIAL — AXM Foundation integration:** selected records and adapter bindings work in the standalone harness, but the real Game Hub has not launched this exact build.
- **UNTESTED — real connected platform AI:** tests use authenticated simulated adapter packets and the separate optional Host AI.

## New art

- **PASS — raw preservation:** all 15 supplied originals are retained and hashed.
- **PASS — runtime alpha:** all 16 accepted runtime images have real alpha rather than baked checkerboards.
- **PASS — local loading:** representative modern assets return HTTP 200 and every `CityScene` path exists locally.
- **PASS — fallback safety:** retained Kenney player, NPC and vehicle art remains available if a modern image cannot decode.
- **PARTIAL — animation:** player and resident images are one static top-down pose. Actors move correctly, but no directional walk/attack frames exist yet.
- **PARTIAL — eight-seat appearance:** slots 5–8 cycle the same four images as slots 1–4. Server seat IDs, player numbers, names and party markers remain distinct.
- **PARTIAL — style depth:** the supplied buildings are oblique/isometric overlays on a top-down structured map. Footprints and approaches align, but roof occlusion and per-entity depth sorting are not implemented.
- **PARTIAL — curation:** four single-building images are loaded. Two multi-building sheets remain preserved for later deliberate separation and placement.
- **PARTIAL — public licensing:** the batch was user supplied for this local AXM prototype. No public redistribution license was independently verified or assigned; do not publish it as CC0 without review.
- **NOT IMPLEMENTED — equipment-driven character visuals or skins.**

## Interactable alpha-pack intake

- **PASS — source preservation:** the exact 17,467,852-byte ZIP, source manifest and source QA notes are retained and hashed.
- **PASS — curated runtime alpha:** all 14 promoted files are RGBA PNGs with both alpha 0 and alpha 255 pixels; hashes match the runtime manifest.
- **PARTIAL — source-pack alpha:** all 158 individual source images decode as RGBA, but only 157 have a complete transparent-to-opaque alpha range.
- **PARTIAL — source-pack cleanup:** several candidates retain speckles, alpha holes, fragments or checker contamination. The pack is not safe for wholesale runtime loading.
- **PASS — quarantine:** the known phone fragment and checker-contaminated card are not referenced by the runtime; damaged money and phone/card/key candidates remain held back.
- **PASS — package presentation:** five parcel/crate images are selected stably from host-owned package identity without changing mission state.
- **PASS — honest placement:** 25 new placements are `visual-only`; the ATM, vending machine and Party House safe are visibly `reserved`.
- **NOT IMPLEMENTED — ATM, vending, safe storage, cash-register, key/card/phone, loot-container, door or window interactions.**
- **NOT IMPLEMENTED — breakable health, replacement states, debris, repair or loot drops.**
- **PARTIAL — asset style:** the new assets are detailed oblique renders over a low-resolution top-down city. The tested scale is readable, but a future factory should normalize view angle, lighting, palette and pixel density.
- **BOUNDED — project-art authorization:** `AXM-PROJECT-ART-PUBLIC-REPO-AUTHORIZATION-2026-07-19` permits inclusion in this AXM public repository and its public-safe packages. It is not CC0, a recognised open-source asset license, or permission for standalone/general reuse.

## Shopkeepers and stores

- **PASS — honest previews:** the neutral city shopkeeper and AXM Party House shopkeeper are visibly labelled as future stock modules.
- **NOT IMPLEMENTED — shopping:** no stock list, prices, buy/sell flow, dialogue, opening hours or ownership exists.
- **NOT IMPLEMENTED — four distributed stores:** the map has future locations/landmarks, but this pass does not pretend they are active stores.

## Devices and browser

- **UNRUN — automated browser smoke:** Playwright exists but its Chromium executable is unavailable. Actual Canvas previews pass; DOM/browser composition is not marked passed.
- **UNTESTED — physical phone QR join, four/eight simultaneous phones, two physical party displays, private LAN and Windows start/firewall flow.**
- **UNTESTED — physical display scale:** the higher-detail art may need size/contrast tuning at television distance.

## Existing game limits retained

- **PARTIAL — mission variety:** four modes × four layouts work, but there are no difficulty tiers, story chains or rare route rewards.
- **PARTIAL — group saves:** nine fixed-roster slots persist bounded progress, not live city/health/position state. No profiles, cloud sync, rename, delete or export UI.
- **PARTIAL — combat:** ranged projectiles and central damage rules work. General explosions, vehicle impact and broader melee feel remain limited.
- **PARTIAL — cars:** occupants, passenger fire, destruction/ejection and respawn work; impact damage, repair, vehicle weapons and civilian drivers are absent.
- **PARTIAL — inventory content:** six equipped plus twelve bag slots and ammo replacement work, but no complete item/shop catalogue ships.
- **PARTIAL — economy:** personal/party funds and 40/60 rewards work; shops, bodyguards and profiles remain absent.
- **PARTIAL — AI:** built-in Host AI can follow, fight, enter vehicles and complete bounded objectives, but has no advanced formations, revive system or hot seat handback.
- **NOT IMPLEMENTED — audio.**

## Competitive and capacity truth

- **PASS — up to eight, not forced eight:** only selected seats create normal actors; default Host AI fill remains off.
- **PASS — asymmetric District Dominion initialization:** sparse 1v1 and asymmetric simulations pass.
- **UNTESTED — physical eight-player play:** eight simulated records are not proof of eight people, phones or two laptops.
