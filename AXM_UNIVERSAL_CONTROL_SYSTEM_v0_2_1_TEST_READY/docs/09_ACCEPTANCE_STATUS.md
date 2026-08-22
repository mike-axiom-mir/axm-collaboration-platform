# 9. Acceptance status

## Passed inside this package

- shared semantic action registry and validated game profiles;
- one `ControlRuntime` integration surface;
- phone, keyboard, gamepad, and network adapters targeting the same action bus;
- profile-driven standard Xbox-style aliases, triggers, D-pad navigation, and disconnect/unsupported-pad status;
- deterministic Brawl-style right-stick release-to-fire translation with an asserted one-frame semantic pulse;
- batched adapter updates;
- held-input transfer and release across visible context changes;
- deterministic tap, double-tap, hold, toggle, and repeat engine;
- profile-driven phone controls with hiding, labels, resizing, repositioning, and compatible remapping;
- required phone-action coverage gate;
- left-handed and explicit one-handed layouts;
- local short-code pairing and player assignment;
- private resume token and same-seat reconnection;
- malformed, oversized, duplicate, non-finite, and unknown-action rejection;
- disconnect and stale-timeout neutralization;
- separate global, device, and game settings with v0.1 migration;
- Robo Pong compatibility bridge with edge-triggered special action;
- explicit performance evidence probe;
- static package validation;
- 37 automated tests passing in the latest integrated full verification run (the original v0.2.1 receipt retains its earlier three-run 32-test checkpoint);
- deliberate-stall integration proof that observes host neutralization, same-seat resume, and no stale held-input replay;
- locally served Saturday host, phone TEST panel, session, and diagnostics surfaces;
- no runtime dependencies or cloud service.

## Not yet passed on real AXM games/devices

- Game Hub patch applied to a disposable test copy and played;
- measured phone movement latency on Mike's actual LAN;
- traffic and 30-minute battery measurements;
- host frame-rate impact with one to four controllers;
- reconnect proof during real play and Wi-Fi interruption;
- analog calibration on multiple phones;
- accidental-touch study;
- physical Xbox-style controller and handheld tests;
- eight meaningfully different live game migrations;
- switch-access and screen-reader-first paths;
- browser visual smoke test in this environment, because Chromium blocks localhost by organization policy.

## Merge-gate decision

```text
WORKING REFERENCE BUILD
MIGRATION FOUNDATION
NOT YET UNIVERSAL
```

A universal claim requires the live proof matrix, supported-device list, known limitations, and rollback route to be published.
