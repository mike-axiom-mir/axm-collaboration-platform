# Fixed-roster group saves

Status: **IMPLEMENTED IN THE v0.2.4 STANDALONE HARNESS · NINE LOCAL SLOTS · REAL GAME HUB LAUNCH UNTESTED**

## Player-facing rule

The Party House contains a visible cyan **GROUP SAVE COMPUTER**. Press **ACTION** while standing beside it. The authoritative world pauses and one shared overlay displays nine slots.

- Up/down selects save slot 1–9.
- Left selects Save.
- Right selects Load.
- ACTION arms the operation; a second ACTION within five seconds confirms it.
- INVENTORY closes the computer.

The overlay is shared party UI, not four split screens. Only the actor who opened the computer navigates it.

## Fixed roster

A newly occupied slot records the active seat roster, for example:

```json
{
  "seatCount": 4,
  "seatSlots": [1, 2, 3, 4],
  "partyDistribution": { "party_a": 4, "party_b": 0 }
}
```

That save slot cannot later become a two-, three- or different-seat save. An overwrite must use the same exact seat slots. A differently sized group uses another one of the nine save slots. This prevents per-seat progress from silently sliding to another slot.

## Loading with fewer connected players

Loading examines authoritative connection state at that moment:

1. A connected `human` or Foundation `adapter` whose seat is in the save keeps that seat, current display name and existing token.
2. Every saved seat without a connected external controller becomes the existing built-in `ai` actor, named `Group AI N`.
3. The AI actor has the saved slot's money and inventory and obeys ordinary collision, health, vehicle, combat and mission rules.
4. A disconnected phone token for an AI-filled seat is removed. If that old page later sends input, the host returns `seat-host-controlled`.
5. A connected seat outside the fixed saved roster blocks the load. No connected participant is silently removed or remapped.

This AI substitution is a deliberate save-restore rule. It does not change the launcher default: new sessions still leave unselected seats empty and Host AI fill remains off unless explicitly selected.

## Saved data

The first format stores only bounded group progress:

- exact active seat slots;
- each seat's personal fund;
- each seat's six equipment slots and twelve bag slots, including finite ammo quantities;
- lightweight per-seat delivery/mission counters reserved for later use;
- Party A and Party B group funds;
- lifetime party income;
- rival-gang enabled/pressure/progress fields.

It deliberately does not store:

- player/display names;
- controller type preference;
- host or seat tokens;
- account/profile identifiers;
- phone/LAN addresses;
- current health or shield;
- position, facing or velocity;
- vehicle occupancy/damage;
- active mission countdown/timer;
- NPCs, projectiles, justice heat or other transient combat state.

Loading builds a clean authoritative world at the Party House with 100 base HP and one shield, then restores the saved possessions and funds by slot.

## Local storage and integrity

Runtime files are written under:

`local-data/group-saves/save-slot-1.json` through `save-slot-9.json`

The host uses only those fixed paths. Each file is capped at 256 KiB, schema-validated, stored inside a SHA-256 integrity envelope and replaced atomically. A malformed, oversized, mismatched or hand-corrupted file is marked **CORRUPT** and is never partially applied.

The controller sends only ordinary semantic directions and ACTION/INVENTORY pulses. It never submits money, inventory, save JSON, a filename or a claimed player count.

The public `GET /api/group-saves` endpoint exposes only the nine safe summaries needed by local UI: status, roster shape, update time and aggregate funds. It does not expose inventory contents or tokens.

## Current mode boundary

The physical Party House computer is enabled in Co-op Adventure base state. It cannot open during a mission, countdown, results screen or District Dominion. The schema and restoration code accept all eight reserved seats and pass an eight-record test, preserving the future Party B seam, but an eight-seat campaign/base flow is not presented as completed.

## Tests

Automated coverage includes:

- nine empty slots;
- exact fixed roster and overwrite rejection;
- per-seat money/inventory round trip;
- no player names, tokens, position or injury in the file;
- corrupt-file rejection;
- two connected humans loading a four-seat save with two Host AI fills;
- token preservation for connected seats;
- token removal for an AI-filled missing phone seat;
- connected seat outside roster rejection;
- pause, double confirmation and host-only write from the in-world computer;
- live HTTP input/save/load/controller-rejection flow;
- eight saved seat records restoring without P1–P4-only assumptions.

Physical phones and full browser composition remain separately untested.
