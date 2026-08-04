# Brace Room AI-native seat contract

Protocols:

- Input: `brace-room-direct-input-v1` (shared with the phone controller —
  see `runtime/controller.html`)
- Observation: `axm.brace-room-observation/v1`
- Authority gate: none — see "Why no authority gate" below. This is a
  deliberate departure from `003-robo-pong-cross`'s
  `cross-seat-authority-v1`, not an oversight.

## Seat truth

`human` and `adapter` are the two seat types this game actually
implements. There is no game-local `ai` (no built-in bot occupies a seat
during real play) — `dev/balance-sim.js` is an offline heuristic playtest
harness against `game-core.js` directly, not a live seat.

| Type | Controller | Runtime movement | Observation |
| --- | --- | --- | --- |
| `human` | Shared keyboard cluster, or a phone joined via Game Hub's QR/lobby | Client-side, browser-local simulation | The shared screen itself |
| `adapter` | Any external agent with HTTP access to this game's own port (Codex, another Claude instance, a bot) | Same input channel as the phone controller | `GET /api/adapter-observation` |

## Why this exists

Brace Room's simulation is intentionally browser-local (see
`README_FIRST.md`, `KNOWN_LIMITS.md`) — the server serves files and
relays input, it doesn't run the game. That's fine for a human at the
keyboard, but it means an external agent had nothing to look at: no
server-side state, no way to "see" the game short of reading pixels off a
screen. This contract adds exactly two endpoints to close that gap without
giving up the browser-local design:

- The shared-screen tab pushes a snapshot of the live `state` object to
  `POST /api/state` roughly 8 times a second while a session exists
  (`runtime/app.js`, `pushObservation`).
- `GET /api/adapter-observation` serves the latest pushed snapshot back
  out, optionally scoped to one seat via `?seat=p2`.
- An adapter acts through the same `POST /api/input` endpoint the phone
  controller already uses (see `KNOWN_LIMITS.md` for that endpoint's
  shape) — there's no separate adapter-only input path.

## Observation payload

```json
{
  "schema": "axm.brace-room-observation/v1",
  "sessionActive": true,
  "sequence": 42,
  "elapsedMs": 63000,
  "sessionLengthMs": 540000,
  "wave": 2,
  "hull": 71,
  "status": "running",
  "playerCount": 3,
  "currentStreak": 4,
  "bestStreak": 9,
  "stats": { "resolved": 11, "missed": 3, "falseAlarmsAvoided": 1, "falseAlarmsMisresolved": 0 },
  "stations": [ { "id": "engine-bay", "label": "Engine Bay", "verb": "mash", "x": 540, "y": 320 } ],
  "faults": [ { "id": 17, "stationId": "bulkhead", "verb": "crew2", "kind": "real", "effort": 40, "effortTarget": 100, "ringMs": 5000, "remainingMs": 2100 } ],
  "players": { "p1": { "x": 300, "y": 320, "active": true } },
  "seat": { "id": "p2", "x": 410, "y": 220, "active": true },
  "summary": null
}
```

`seat` only appears when the request included `?seat=pN`, and is a
convenience copy of that player's own entry from `players` — everything
an adapter needs to reason about "where am I" without re-deriving it.
`summary` is `null` until `status` leaves `running`, then carries the same
result-summary shape described in `README_FIRST.md`.

Before anything has been pushed, or if the tab stops pushing for more than
one second (closed, crashed, reloaded), the endpoint returns
`{"sessionActive": false, ...}` rather than an error or stale data —
an adapter should treat that as "nothing to play right now," not a
failure.

## Acting: `POST /api/input`

Identical to the phone controller's channel:

```json
{ "player": "p2", "moveX": -1, "moveY": 0, "action": true, "actionEdge": true }
```

`moveX`/`moveY` are clamped to `-1..1`. `action` is the current held
state of that seat's single action button; `actionEdge` should be `true`
only on the request where the adapter's own logic considers this a fresh
press (mirroring how `runtime/controller.html` computes it) — the mash
and rhythm verbs in `game-core.js` key off that edge, not off `action`
being merely true.

## Why no authority gate

`003-robo-pong-cross` protects `axis`/`power` intents with tokens, leases,
and monotonic sequence numbers because it's a competitive game where a
malicious or buggy client could fabricate an advantage. Brace Room is a
trusted-local co-op game with **no hidden information by design** — every
player already sees the entire shared screen, and the design bible's
explicit non-goal list rules out anything competitive. Layering
token/lease machinery onto an observation channel with nothing to protect
would be complexity for its own sake. This is bound to `127.0.0.1` by
`local_only_default: true` in `game.manifest.json`; if that default is
ever changed, this trust model needs to be revisited alongside it — this
paragraph is the flag for that.

## Evidence boundary

`tests/server-http.test.js` proves: an adapter observation before any
push reports `sessionActive: false`, a pushed snapshot round-trips
correctly including the per-seat convenience field, and an unknown seat
id is rejected the same way on both `/api/input` and
`/api/adapter-observation`. Not covered: staleness expiry after the tab
genuinely stops pushing (the logic is a straightforward timestamp
comparison — see `OBSERVATION_STALE_MS` in `runtime/server.js` — but
exercising it in a test means a real wait, which was skipped as low
value for the time cost).

Since the paragraph below was first written, a live adapter *has*
connected: a sandboxed Claude instance drove a real headless Edge
session (via a local file-based courier bridge, see below) through
`launch` → crew/session selection → `GET /api/adapter-observation?seat=p1`
→ `POST /api/input`-driven movement → a second observation confirming
`players.p1.x/y` moved to the expected position → and, incidentally, a
live "Hull breached" end screen when the session ran out the clock
during testing. That's real evidence the contract works end to end
against the actual running server, not just against the unit tests.

## A note on who can actually use this

This contract was originally written by a Claude instance running in an
isolated cloud sandbox (Cowork mode), which has no direct network route
to `127.0.0.1` on the machine this game actually runs on. That network
limitation is still true today — nothing about the sandbox's own
connectivity changed. What changed is that a separate local bridge
(`tools/game-hub/ai-seat-courier/`, built by a local Codex session) now
lets that same sandboxed Claude instance operate a real local browser
indirectly: the sandbox writes a JSON request file to a folder synced to
the local machine, a courier daemon running on the local machine drives
a real headless Edge instance via CDP and writes back a JSON receipt, and
the sandbox reads that receipt. No tunnel, no remote URL — the sandbox
still can't reach `127.0.0.1` itself, it's reaching a local file system
that something else on the same machine is watching. An agent running
directly on the local machine (a local Codex or Claude Code session)
still has the simpler, direct path this contract originally assumed and
doesn't need the courier at all.
