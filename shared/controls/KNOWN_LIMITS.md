# Known limits

- **NOT IMPLEMENTED / UNTESTED** - USB, Bluetooth and wireless-receiver gamepad discovery, calibration, seat claiming and input.
- **NOT IMPLEMENTED / UNTESTED** - Mixed phone/gamepad parties, controller reconnect, fullscreen/background reliability, and four/eight simultaneous gamepads.
- **DORMANT ROUTE** - `PHYSICAL_CONTROLLER_ROUTE.json` records the intended adapter architecture and proof gates without claiming hardware support.

- **UNTESTED** — Physical phone comfort, multitouch behavior, aspect ratios, safe-area insets, and long play sessions.
- **UNTESTED** — Real Wi-Fi latency, packet loss, reconnection, and several simultaneous controllers.
- **UNTESTED** — Launch from the real AXM Game Hub and a real connected Workshop AI.
- **UNTESTED** — Integration into Fable, Globe, or another target game.
- **UNRUN** — Automated rendered-browser test. The loopback HTTP server and static browser modules are tested, but Playwright is not bundled.
- **PARTIAL** — The HTTP JSON transport is implemented. WebSocket, WebRTC, and native-app transports are adapter work for the target platform.
- **PARTIAL** — Semantic observation models the current camera target and public HUD; it is not a video frame and does not model visual occlusion inside the camera.
- **PARTIAL** — The final forbidden-key scrub is defense in depth. A target game still must deliberately project public fields instead of passing raw state.
- **NOT IMPLEMENTED** — Lobby, QR generation, account identity, matchmaking, cloud runtime, and public-server authentication. Those belong to the surrounding Foundation or target platform.
- **NOT IMPLEMENTED** — An AI model. `ConnectedAiSeatClient` only carries observations and semantic intentions for an AI chosen elsewhere.
- **NOT IMPLEMENTED** — Automatic empty-seat bots. Optional built-in Host AI stays a separate target-game feature.
- **NOT IMPLEMENTED** — Target-server body size limits and rate limiting; the integration host must add them.
- **NOT IMPLEMENTED** — A public open-source license selection. No third-party assets or runtime packages are bundled, but publication terms remain an AXM owner decision.
