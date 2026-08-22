# Lumenwake

A short-session 1–4 player cooperative game for AXM Game Night.

Collect cyan, violet and gold fallen light, carry up to three pieces, and return them to the central aurora. Gloom hunts carriers and drains the core. Pulse to stun it, dash to escape, and stand close to relight fallen teammates.

Two optional **Aurora Duets** add a deliberately co-op side objective. Distinct
players hold the paired pads together for 2.2 seconds. A completed duet heals
the active party, stuns the current gloom, and returns eight light. The main
carry/cover/revive route remains playable without completing either duet.

Choose **Aurora Basin** or **Prism Causeway** between runs. Each route also has
three partner Pulse shrines: one keeper arms the chord and another completes it
before its window closes, rewarding the team with light, healing and a short
enemy stun. These resonance objectives are optional.

- One to four visible Human, external Adapter, or built-in AI seats
- Solo difficulty scales from the same rules
- Same server-authoritative move, pulse and dash vocabulary for humans and adapters; built-in AI uses that vocabulary inside the simulation
- Keyboard desktop play, touch phone controller and shared spectator screen
- Explicit Start Shared Run and Play Again actions on the shared screen and phones
- Three-and-a-half-minute sessions and nine local in-game achievements
- No hidden players, automatic seat replacement, internet dependency or purchases

## Controls

- Xbox/Brawl profile: left stick or D-pad moves, A/X/RB pulses, B/RT dashes,
  and Menu starts or replays the shared run
- Shared keyboard: P1 uses WASD + F/G; P2 uses arrows + Enter/Right Ctrl
- Solo desktop keyboard: WASD or arrows, Space to Pulse, Shift to Dash
- Shared desktop: Escape opens a local session menu; Escape again returns to
  the unchanged ready gate, countdown, result, or live run
- Phone: move stick, Pulse and Dash
- AI seats: imperfect local decision loop using the same movement and action fields

The Escape menu has no start, restart, map-change, or pause authority. During a
live run the server-authoritative world continues behind it; opening the menu
only neutralizes local human input until the player returns.

## External adapter boundary

An external collaborator must be explicitly assigned an `adapter` seat by the
host. It receives a session-only capability and a bounded semantic observation;
it never inherits Lumenwake's built-in AI loop. Human and adapter movement,
Pulse, and Dash intentions pass through the same strict authority gate before
the server simulation applies them. See `ADAPTER_SEAT_CONTRACT.md` for the
wire format, authorization boundary, evidence, and known LAN-isolation limit.

## Achievement boundary

Game achievements are stored locally under `axm.lumenwake.achievements.v1`. The shared AXM profile still receives its normal verified `game-played` receipt from Game Hub; Lumenwake does not invent shared-profile event types.
