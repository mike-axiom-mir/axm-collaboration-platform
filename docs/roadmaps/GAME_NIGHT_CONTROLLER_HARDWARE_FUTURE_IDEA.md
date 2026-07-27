# Future idea — AXM Game Night phone controller hardware

| Field | Value |
| --- | --- |
| Recorded | 2026-07-24 |
| Status | **FUTURE IDEA / RESEARCH ONLY** |
| Product track | Game Night controller hardware |
| Current baseline | The existing phone touch controller |
| Owner | Undecided |

This document preserves a possible AXM hardware direction without presenting it as an implemented product. No AXM hardware prototype, selected component, procurement plan, manufacturing partner, price, certification, patent clearance or release commitment exists yet.

“Branch” means a separate product and research track here, not a Git branch. The current Workshop has no Git metadata.

## Product hypothesis

Create an inexpensive accessory around a player's own phone that makes AXM Game Night controls feel more like a handheld controller:

- tactile shoulder inputs that are easier to find without looking;
- optional physical thumb controls;
- quick setup for several players in one room;
- a reusable semantic controller profile that can work across AXM games;
- graceful fallback to the existing touch controller.

The goal is not to replace the current controller prematurely. The first goal is to discover which hardware route is comfortable, dependable and realistically affordable.

## Research tracks

```text
Game Night controller hardware
├── Passive touch accessory
├── Direct USB-C HID grip
├── Bluetooth Low Energy HID grip
└── Shared controller-profile software seam
```

### Track A — passive touch accessory

A clip, shell or removable overlay could use mechanical levers with soft conductive contact pads to press reserved areas of the phone screen. Removable thumbstick caps could mechanically drag touch input over the existing on-screen sticks.

Potential advantages:

- likely the cheapest route;
- no Bluetooth pairing;
- no battery, firmware or radio;
- compatible in principle with the current browser-based touch controller.

Important limitations:

- a passive trigger provides a touch press, not a true pressure-sensitive analog trigger;
- a passive thumb cap may imitate a drag, but precision, centering and multitouch reliability are unproven;
- phone widths, cases and screen protectors vary;
- contact material, clamping force and repeated use must not scratch or damage a screen;
- touch-zone alignment, palm rejection and simultaneous-touch behavior need testing on physical phones.

A sensible first prototype is an adjustable two-trigger clip with replaceable soft conductive tips, sliding alignment and a controller calibration screen. Existing passive phone triggers demonstrate that the mechanism category exists; they do not prove the proposed AXM design will be safe or good.

### Track B — direct USB-C HID grip

A wired grip could expose real buttons and analog sticks as a standard USB Human Interface Device. This is the strongest route to real input state without Bluetooth pairing.

Potential advantages:

- actual button and analog-axis state;
- low setup friction after physical connection;
- the phone can power the controller, potentially avoiding a controller battery;
- standard controller input may be readable by the browser Gamepad API.

Important limitations:

- USB-C alignment, phone cases and varying phone dimensions complicate the mechanical design;
- pass-through charging would add hardware and compatibility requirements;
- Android and iPhone support must be tested explicitly;
- browser, operating-system and controller mappings can differ;
- a commercial direct-connect controller proves the architecture exists, not that it is automatically compatible with AXM.

### Track C — Bluetooth Low Energy HID grip

A wireless grip could send real sticks, buttons and triggers through a standard Bluetooth HID game-controller profile.

Potential advantages:

- real analog and button state;
- greater freedom in phone fit and controller shape;
- possible future haptics and accessibility variants;
- no connector alignment or port strain during play.

Important limitations:

- players must pair the controller;
- battery, charging, sleep, wake and reconnect behavior become product requirements;
- a four-player Game Night needs predictable device identity and recovery when a controller disconnects;
- browser Gamepad support and mappings still need a phone-and-browser compatibility matrix.

ESP32-S3 and nRF52840 development boards are plausible research candidates because their official documentation describes relevant Bluetooth and USB capabilities. They are not selected AXM production parts.

## Shared controller-profile software seam

Any electronic prototype should be an additive input adapter, not a rewrite of each game. A future controller profile can map device axes and buttons onto the same semantic intentions the current touch controller already sends:

- movement X/Y;
- aim X/Y;
- primary action and fire;
- sprint and brake;
- inventory;
- map.

Host authority and game rules must stay unchanged. Touch remains the fallback. Games should consume semantic intentions rather than depend on one vendor's button labels or numbering.

A passive accessory instead needs a calibration mode that positions reserved touch targets beneath its conductive pads. An electronic adapter would read a user-activated controller through the browser Gamepad API and translate its reported axes and buttons.

## Smallest honest experiment ladder

1. Borrow or buy inexpensive passive trigger clips, including any locally available supermarket example, and record the exact product tested. This is category research, not an endorsement.
2. Build a disposable cardboard or 3D-printed passive shell with screen-safe conductive tips. Test fit and screen safety before normal play.
3. Test the browser Gamepad API using an existing standards-compatible controller. This isolates the software path before custom electronics.
4. Build one development-board HID prototype using a candidate such as ESP32-S3 or nRF52840.
5. Run a four-player Game Night trial before considering an enclosure or production design.

Each experiment should record:

- setup or pairing time;
- screen marks, pressure and wear;
- missed, stuck and ghost inputs;
- simultaneous button and stick behavior;
- analog drift, centering and dead zones;
- phone, case and hand-size fit;
- disconnect, reconnect and battery behavior;
- accessibility observations;
- measured end-to-end input latency.

Suggested provisional decision order:

1. Test passive hardware first because it is the cheapest way to validate the physical-control idea.
2. Prefer direct USB-C for a serious no-pairing route if the compatibility matrix is acceptable.
3. Prefer Bluetooth for broader physical compatibility only if pairing and reconnect behavior survive a multi-player Game Night.

These are research priorities, not approved product decisions.

## Claim and approval boundary

- This file saves an idea; it does not claim that AXM hardware exists.
- Linked products and platforms establish category or protocol evidence only. They are not AXM suppliers, endorsements or compatibility guarantees.
- No licensing, ownership, safety, radio compliance, certification, patent, price or manufacturability claim has been made.
- Physical-device evidence and human approval are required before purchasing parts beyond a small experiment, changing the live controller contract or describing the idea as a product.

## Research sources

Sources were reviewed on 2026-07-24.

| Source | What it supports | Caveat |
| --- | --- | --- |
| [Plutoos mechanical mobile triggers](https://plutoos.ch/en/PL11786/Plutoos-PUBG-Mobile-Trigger-L1-R1-Gaming-Controller-mechanical-for-Android-iPhone) | A clamp-on conductive lever can actuate a touchscreen without Bluetooth, a battery or an app. | One retailer/product page; category evidence only. |
| [W3C Gamepad specification](https://www.w3.org/TR/gamepad/) | Browsers have a standardized low-level model for controller buttons, axes and connection state. | Implementations and mappings can still vary. |
| [MDN Gamepad API](https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API) | Practical browser access through gamepad events and `navigator.getGamepads()`. | Physical phones and browsers still require testing. |
| [Apple Game Controller framework](https://developer.apple.com/documentation/gamecontroller) | Apple platforms define support for attached and wireless game controllers. | Native-platform evidence; it does not guarantee identical browser behavior. |
| [Android game controller guidance](https://developer.android.com/develop/ui/views/touch-and-input/game-controllers) | Android documents controller buttons, axes and multiple-controller handling. | Native Android guidance; browser compatibility needs separate evidence. |
| [Razer Kishi for Android](https://www.razer.com/mobile-controllers/razer-kishi-for-android) | A commercial phone grip can use a direct USB-C connection and pass-through charging. | Architecture example only, not an AXM recommendation. |
| [Espressif BLE HID solution overview](https://docs.espressif.com/projects/esp-techpedia/en/latest/esp-friends/solution-introduction/esp-ble/esp-ble-solution.html) | Espressif documents BLE HID game-controller use and combined BLE/USB HID possibilities on relevant chips. | The page carries an AI-translation notice; confirm details against chip documentation before design. |
| [Espressif ESP32-S3 BLE overview](https://docs.espressif.com/projects/esp-idf/en/latest/esp32s3/api-guides/ble/overview.html) | Official ESP32-S3 Bluetooth Low Energy platform documentation. | Capability evidence only; no AXM part selection. |
| [Nordic nRF52840 key features](https://docs.nordicsemi.com/r/bundle/ps_nrf52840/page/keyfeatures_html5.html) | The chip exposes Bluetooth Low Energy and USB 2.0 full-speed capabilities. | Capability evidence only; no AXM part selection. |
