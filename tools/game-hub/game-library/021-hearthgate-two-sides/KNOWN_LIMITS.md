# Known limits

- This is a `WORKING` Oathbound 3D test build, not a canonized or final-balanced game.
- Physical Xbox and phone QA are still pending; automated and phone-size browser checks prove mappings, transport, and layout code paths, not real hardware feel or every mobile browser.
- Co-op gameplay is shared-screen with two QR phone controllers, local gamepads, or keyboard fallbacks. There is no remote internet co-op, matchmaking, persistence, or drop-in seat reassignment in v1.
- QR phones and the big screen must reach the same Game Hub host on the local network. If Wi-Fi isolation blocks device-to-device traffic, the controller page cannot connect.
- Runs now contain five authored Oaths across the first six minutes and then continue as Endless Vigil. They still reset on reload; receipts are run-local evidence, not campaign meta-progression or a save profile.
- WebGL supplies a genuine low-poly 3D presentation, but the browser-local deterministic core and transparent Canvas remain gameplay/interaction authority. Hardware/GPU coverage beyond the live test machine is not yet certified, and the Canvas fallback deliberately loses 3D depth.
- Building roles and upgrade output are now explicit, but controller proximity across four same-side plots still needs a physical playtest to tune nearest-plot selection.
- The RB radial wheel and held-state relay are covered by automated and browser checks, but simultaneous two-phone thumb comfort and directional accuracy still need Mike + Errol's actual devices.
- Sound is synthesized in the browser and intentionally minimal.
- A deterministic resource-aware semantic defense now completes 5/5 Oaths at 6:05 and enters Endless Vigil. That is a regression baseline, not proof of human fun or final balance; human sessions at 6, 10, and 20 minutes remain necessary.
