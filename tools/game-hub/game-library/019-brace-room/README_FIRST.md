# Brace Room

Brace Room is a compact, playable Game Night co-op prototype: a shared-screen
emergency-station game where the crew wins or loses together.

Player promise: **one hull, four crew, nothing fixes itself — run to the
fire, not away from it.**

The 30-second truth:

`fault appears at a station → someone runs to it → resolve the correct
action before the ring empties → hull holds → repeat, faster, until the
crew's shift timer runs out`

Six stations ring a central Hull Integrity gauge. Each fault has its own
resolve verb — mash, hold, rhythm-tap, or (Bulkhead only) a genuine
two-crew hold that cannot be soloed. From wave 3 onward, some faults are
false alarms (a grey ring instead of amber) — the correct play is to leave
them alone; acting on one costs hull instead of saving it.

Start it directly:

```powershell
$env:PORT=8819
node runtime/server.js
```

Then open `http://127.0.0.1:8819/`. Game Hub owns the real launch/port
assignment when it starts the package; this direct route is for local
development and playtesting.

Keyboard controls on the shared screen (same clusters as `012-pulse-choir`
so a game night doesn't require re-learning controls between titles):

- P1: `WASD` + `Space`
- P2: Arrow keys + `Enter`
- P3: `IJKL` + `O`
- P4: Numpad `8456` + Numpad `0`
- `H` help, `M` reduced motion, `C` high contrast, `Esc` pause / close overlay
- Speaker icon (top-right of the HUD) mutes/unmutes procedural sound — all synthesized, no audio files

Session length is chosen at the start screen: 6, 9, or 12 minutes, split
into three time-based waves (see `DESIGN_BIBLE.md` §6 for the exact spawn
and difficulty table). Crew size is 1-4; solo play is legitimate (fewer
simultaneous faults, no Bulkhead faults until a second player is present)
but the game is designed to peak at 3-4 players.

There is no third-party art in this build — every visual is a flat vector
shape drawn directly on canvas (see `ASSET_PROVENANCE.md`).

A joined phone can also play a seat: use Game Hub's existing QR/lobby join,
and once launched that phone gets redirected to `runtime/controller.html`
with a d-pad and one ACTION button for its assigned seat, instead of the
shared-screen keyboard cluster. This isn't a separate networked game mode —
the shared screen still owns the whole simulation; the phone just feeds
input into it. See `KNOWN_LIMITS.md` for what's still unverified about that
path (no real device has tested it yet).

This is a first playable build, not a claim of finished balance. Its
deterministic simulation, server health check, static file serving,
phone-input relay, and core game-loop math are unit tested (`npm test`,
27 checks). Human playtest judgment on the wave-table numbers is the next
gate — see `KNOWN_LIMITS.md` for exactly what hasn't been proven yet.
