# Briarfront disconnect recovery — TEST receipt

- Status: `TEST`; this is not a canonization decision.
- Date: 2026-08-16 (Europe/Amsterdam).
- Route: production player-one browser route, `/?player=p1`, behind a leaf-only fault proxy.
- Seats: four human evidence seats — Mike, Errol, Nova, and Ivan.

## Exact runtime under observation

- `runtime/briarfront-client.html` SHA-256: `2539FD49BAE1BBFD331503C7BA417E0F9A031FA340831C146C6E7E4D3591474D`
- `runtime/briarfront-server.cjs` SHA-256: `FBDC9F540895602BC951EEBC25A2C8D8D68E3D9C03349268A9D363E84675D505`
- `tests/disconnect-recovery-browser-harness.js` SHA-256: `592039F1F16CDAC332506F7DF7C38EF8FD43963A94F9A7C14622D1086BFE4B49`
- `tests/disconnect-recovery.test.js` SHA-256: `445AD2D16F6A1257E146CBFF044C5E476B0D1B91F2127BB252AA161B8148FBB4`

A concurrent visual-runtime edit changed both production runtime files during an earlier attempt. That mixed-version attempt and all of its frames were discarded. The harness was restarted after the hashes above were present; every observation below belongs to the fresh, version-consistent run.

## Method and observations

The harness spawned the production Briarfront server, left it authoritative and running, and placed an HTTP/SSE proxy in front of it. The proxy cut destroys active tunnels and rejects new client traffic without restarting or pausing the production server.

1. At baseline, the browser showed the rendered low-poly forest and Mike's complete controller HUD. Proxy state was `phase=running`, `tick=2393`, and `players.p1.controllerConnected=true`.
2. After the proxy cut, a direct proxy `/state` request failed. The browser visibly reported `RECONNECTING`. The origin advanced independently to `tick=3419` and reported `players.p1.controllerConnected=false`, proving both authoritative continuity and controller-presence expiry during the cut.
3. After transport restoration, the browser returned to the live HUD and rendered forest. Proxy state reached `tick=4403` with `players.p1.controllerConnected=true`.
4. The recovered `SMALL MOB 5 WOOD` control was clicked. At `tick=4726`, the authoritative state reported `event="Mike QUEUED SMALL 20HP MOB"`, `players.p1.controllerConnected=true`, and the west wave queue's latest entry as `{ "kind": "small", "buyer": "p1" }`.

The client also contains an `OFFLINE` polling fallback. In this run, EventSource retry errors repeatedly repainted the stable visible state as `RECONNECTING`; the transport rejection and origin-only state were checked independently rather than inferring loss from that label alone.

## Repeated visual evidence

- Browser viewport: 1280×720; device pixel ratio: 1.25.
- Three.js canvas: 1280×720; no fallback flag was present.
- Connected frame SHA-256: `507161620B71F532320202C7BE795A5B11985D0B6498DEC5F58015A676EEF596`
- Transport-loss frame SHA-256: `44D7114EB60860965DFCEC458225251DA6425A8081EBC58197A4CC0708BA7D39`
- Recovered frame SHA-256: `3D32330A47D26B5ECFFFE4349F14326F6B87EA5520C4C525611634352795FA56`
- Recovered-action frame SHA-256: `38E3E2B5289C1424313193A2EF07D164475BFB7198891DFAE9C159753A8ECCCB`

These are repeated screenshots around bounded interaction, not rolling capture. Raw screenshots were not retained after their fingerprints and semantic observations were recorded.

## Boundaries

- Verified: desktop browser player-one route, client transport-loss visibility, continuing server authority, controller presence `true → false → true`, state resynchronization, and a recovered controller command.
- Not run: physical-phone hardware QA, LAN traversal, OS/network-adapter interruption, or server-process restart recovery.
- No claim is made about the separate blocking-overlay seam in this receipt.

## Cleanup

The browser tab was closed, screenshot buffers were released, the harness exited with code 0, and neither the proxy port nor the origin port remained listening.
