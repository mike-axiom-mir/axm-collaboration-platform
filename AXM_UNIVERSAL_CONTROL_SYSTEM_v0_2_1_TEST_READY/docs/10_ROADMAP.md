# 10. Expansion roadmap

## Completed foundation — v0.2.1 test-ready

- semantic core and `ControlRuntime`;
- context-safe held-input transfer;
- keyboard, gamepad, phone, and network adapters;
- profile-driven phone UI and compatible remapping;
- left-handed and explicit one-handed modes;
- behavior engine for tap/hold/toggle/repeat;
- settings migration and scoped persistence;
- short-code pairing, resume tokens, watchdog release, and frame validation;
- Robo Pong bridge;
- static validation and 32 automated tests;
- coalesced reconnect state, heartbeat/open timeout, lifecycle wake handling, and deliberate-stall test tooling;
- host diagnostics and downloadable live-test evidence.

## Next — Robo Pong live proof

- apply the optional patch only to an extracted/disposable Game Hub copy;
- compare old buttons and semantic controls side by side;
- measure RTT, sample rate, sequence gaps, server forwarding, and host frame impact;
- interrupt Wi-Fi and confirm safe neutral/reclaim behavior;
- test phone, keyboard, and a physical Xbox-style controller through the same actions;
- preserve the original button layout as a Simple accessibility profile.

## Second live game

Migrate a top-down or twin-stick game. The proof condition is that the shared core remains unchanged and only the profile plus game behavior bindings are added.

## Accessibility depth

- expose behavior timing and repeat assistance in the settings UI;
- add vibration strength where supported;
- add switch-access adapter;
- add screen-reader-first controller mode;
- run one-handed usability tests;
- add visible aim-assist policy per game.

## Transport depth

- local QR display;
- optional local HTTPS/WSS;
- multi-room isolation;
- consent-based local settings sync;
- clock-offset experiment before any one-way latency claim;
- compression only if measurements show it is needed.

## Collection rollout order

1. simple/top-down movement;
2. twin-stick action;
3. platformer;
4. driving/vehicle;
5. menu-heavy simulation;
6. turn-based;
7. local cooperative multiplayer;
8. multiple phone controllers.

## Universal claim gate

Publish measured results, failures, supported devices, accessibility coverage, and rollback instructions. Do not hide weak phone behavior behind visual polish.
