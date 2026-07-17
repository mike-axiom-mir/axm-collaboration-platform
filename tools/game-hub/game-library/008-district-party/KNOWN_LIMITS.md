# Known Limits — AXM District Party v0.1.7

## Integration and devices

- **PARTIAL — AXM Foundation integration:** full ready records, sparse slots and adapter bindings are accepted, but this remains a standalone compatibility harness. The real Game Hub has not launched it.
- **UNTESTED — real connected AI:** no Workshop local/cloud AI consumed the binding during this build. Tests used simulated adapter packets.
- **UNTESTED — physical phone QR join:** no phone scanned a generated QR.
- **UNTESTED — two physical party displays:** both receiver routes pass server checks, but two laptops were not connected.
- **UNTESTED — private-LAN reachability:** the build environment exposed no private IPv4.
- **UNTESTED — Windows start/firewall flow:** Windows was unavailable.

## Flexible competitive roster

- **PASS — capacity versus population:** only ready records create actors. Default competitive fallback is 1v1; empty seats remain empty. Maximum remains 4v4/eight total.
- **PASS — asymmetric initialization:** 2v3 and other one-to-four-per-side shapes are accepted. A missing party is rejected.
- **PASS — optional Host AI:** individual Host AI seats and the fill toggle still work; fill defaults OFF.
- **PARTIAL — unequal-team balance:** no automatic handicap changes capture rate, money, health or respawns. A 4v1 match is legal but expected to be unfair.
- **PARTIAL — match ready flow:** the launcher uses seat checkboxes. The real Game Hub ready-order handoff remains untested.

## AI-native controls

- **PASS — identity separation:** `adapter` uses external semantic input; `ai` alone uses the built-in Host AI loop.
- **PASS — same control gate:** adapter and human packets share token, sequence, sanitation, timeout and host authority.
- **PASS — bounded observation tests:** off-screen opponents and named host internals are absent; visible opponents appear when entering the calculated party camera.
- **PARTIAL — screen equivalence:** the observation is semantic, not pixels. It represents the current camera target; the rendered camera may briefly lag because of visual smoothing.
- **PARTIAL — local threat model:** party display/state routes are intentionally usable by trusted LAN displays. The Workshop must not give a connected AI arbitrary process/network access if strict observation isolation is required.
- **NOT IMPLEMENTED — image/video vision feed:** adapters receive structured screen semantics only.

## Browser, controls and presentation

- **UNRUN — automated browser smoke:** Playwright exists, Chromium does not. The updated browser test specifies sparse 1v1 defaults and zero default Host AI cards but did not execute.
- **UNTESTED — physical twin-stick feel:** dead-zone math and host behavior pass; handset comfort and Wi-Fi latency need phones.
- **PARTIAL — visual verification:** markup/CSS/JavaScript parse, but sparse-corner layout and final Canvas composition remain browser/device-untested.
- **NOT IMPLEMENTED — audio.**

## AI and world behavior

- **PARTIAL — optional Host AI tactics:** captures, attacks, vehicle entry and initial all-AI squad purchase work. It has no advanced formations, revive logic or human pings.
- **PARTIAL — crew tactics:** paid crew route/capture/fight but cannot enter cars or accept a chosen district.
- **PARTIAL — civilians/justice/rivals:** basic behavior works; dialogue, loot, witnesses, arrest, saved gang ownership and territorial campaign do not.
- **NOT IMPLEMENTED — civilian road traffic/AI drivers.**

## Vehicles, combat, inventory and persistence

- **PARTIAL — cars:** driver plus three passengers, fire, collision, 50 HP, explosion/ejection/80 damage and respawn work. Impact damage, repair and vehicle weapons are absent.
- **PARTIAL — combat:** projectiles, NPC attacks, shield-before-health, respawn, safe zones and party rules work. Player melee equipment attacks and general explosions are absent.
- **PARTIAL — inventory content:** equipment/bag logic and automatic ammo replacement pass, but no real equipment catalogue or world gear set ships.
- **PARTIAL — economy:** personal/party funds, 40/60 co-op rewards and competitive squad spending work. Shops, bodyguards and profiles are absent.
- **PARTIAL — transport:** HTTP polling is used; eight external controllers plus two displays have not been target-LAN stress tested.
- **NOT IMPLEMENTED — persistence:** territory, scores, funds, adapter connections and inventory reset with the host session.
