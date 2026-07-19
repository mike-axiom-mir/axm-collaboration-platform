# Party-screen design

The persistent receivers are `/party-screen.html?party=party_a` and `/party-screen.html?party=party_b`. Each polls a validated local display route, occupies no seat and sends no actor controls.

The city is always one shared camera and one Canvas. It is never split into four gameplay viewports.

## Compact fixed status corners

| Relative player | Corner | Party A | Party B when selected |
| --- | --- | ---: | ---: |
| Player 1 | top-left | 1 | 5 |
| Player 2 | top-right | 2 | 6 |
| Player 3 | bottom-left | 3 | 7 |
| Player 4 | bottom-right | 4 | 8 |

Each compact card shows identity/state, HP bar/value, shield, loaded/total ammunition and District Credits. `party=all` stacks A/B cards by relative corner. An inventory temporarily covers only its owner's quarter; it does not become a separate world camera.

The centered panel shows mission title/hint/progress/time, party score, friendly-fire state and justice stage. District Dominion adds 13 compact ownership chips and an A/B score without splitting the city view. Co-op mission board/results are shared full-screen overlays and offer Continue, Replay and Mission List. Competitive results also have no timeout and remain until the host restarts or ends the session.

The camera bounds all living viewed-party actors, resolves actors in cars to their vehicle cluster, optionally includes the relay objective, smooths center/zoom and enforces the existing soft/warning/hard party ranges. Passenger aiming never changes the shared camera into an independent view.

Final browser rendering remains **UNRUN** because Chromium is absent; the markup/state and pure layout contracts are automated-test covered.
