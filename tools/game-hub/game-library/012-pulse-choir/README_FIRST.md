# Pulse Choir

Pulse Choir is a five-venue, playable Game Night TEST build built from the Run 111 Game Production Atlas.

Player promise: **read the room, build a shared rhythm, and turn one synchronized decision into a spectacular team payoff.**

After the opening round, the server-owned **LIVE CONDUCTOR** reads the bounded show receipt and announces why the next three-act Setlist is an OPENING, RECONNECT, LOCK-IN, or HEADLINER plan. Its cue, reason, and exact acts appear before the room starts; this is deterministic authored adaptation, not opaque machine learning.

Human seats can then steer that transparent next-round plan with **ROOM SIGNAL**. Each human gets one replaceable vote for TOGETHER, BOLD, or FLOW; the host resolves the tally with a stable tie order, shows the winning count and reason on both surfaces, and locks the exact three acts before Start. AI seats cannot vote.

## Constellation Circuit expansion

One show now tours five deterministic venues instead of ending its main arc after three rounds. Each venue has its own server-owned beat population, Spark/Chord/Wild mix, movement pace, glitch cadence, warning length, score factor, and mastery goal:

1. **Moonwell Atrium** — clear one Setlist act.
2. **Prism Causeway** — build a three-bank chain.
3. **Static Garden** — finish without an unshielded glitch hit.
4. **Twin Comet Bridge** — land one perfect choir.
5. **Dawn Archive** — clear all three Setlist acts.

Visits, best venue scores, and mastery stamps live in bounded SHOW MEMORY and survive same-host recovery. A second circuit starts a new show number while retaining the bounded tour record.

The shared screen now has a lane-local WebGL stage beneath the authoritative Canvas gameplay layer. Low-poly venue architecture, face shading, depth testing, a perspective camera, deliberately quantized color, and reduced internal resolution provide an actual pixelated 3D presentation without a network runtime or third-party renderer. Reduced motion keeps the 3D camera fixed while play continues.

The upgraded 30-second truth is:

`move → collect distinct beats → bank safely or complete a TRIAD → chain the multiplier → pulse together → earn shields → survive the next glitch`

Gameplay stakes:

- Banking one or two beats is fast and safe.
- Carrying Spark + Chord + Wild creates a TRIAD worth a large score and charge bonus, but a full carry slows you down.
- Banking again within 6.5 seconds raises the room multiplier.
- Taking an unshielded glitch hit breaks the chain.
- A perfect synchronized surge gives every player a one-hit choir shield.

Start it through Game Hub, or run it directly:

```powershell
$env:PORT=8802
node runtime/server.js
```

Then open `http://127.0.0.1:8802/`. The direct-development roster contains one human and two AI seats. Game Hub owns the real selected roster when it launches the package.

Keyboard controls on the shared screen:

- P1: `WASD` + `Space`
- P2: arrow keys + `Enter`
- P3: `IJKL` + `O`
- P4: numpad `8456` + numpad `0`
- `H`: help, `M`: reduced motion, `C`: high contrast, `Esc`: close an overlay

The phone controller uses a touch joystick, one large PULSE button, and the three ROOM SIGNAL choices while waiting between rounds. It is browser-viewport tested; physical-phone QA remains pending.

This is a `TEST` content expansion, not a claim of finished balance, Steam readiness, or proven replay value. Its deterministic rules, five-venue circuit, WebGL stage, transparent Conductor, server authority, HTTP lifecycle, recovery, and bounded browser journey are verifiable. Human playtest judgment remains the next gate.
