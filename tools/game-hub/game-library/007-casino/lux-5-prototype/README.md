# LUX-5 · Neon Overdrive

LUX-5 is the first local playable slot prototype for the casino game. Its
5×4 reels are built into a procedural 3D robot cabinet. A five-in-a-row wakes
the robot, opens its arms, and turns its body into the six-face boost wheel.

This is deliberately a standalone workbench prototype. It is not registered in
Game Hub, it has no multiplayer or map layer yet, and running it does not upload
or publish anything.

## Start it locally

You need Node.js 18 or newer. No package installation is required.

On Windows, double-click:

```text
START_LUX5_LOCAL.bat
```

On macOS or Linux, run from this directory:

```sh
./start-lux5.sh
```

Or start it directly on any platform:

```sh
node runtime/server.js
```

Then open <http://127.0.0.1:4175/>. Stop the server with `Ctrl+C`.

Use the wager buttons or slider and press **SPIN**. The Space bar also spins.
The sound button in the top-right mutes and unmutes the synthesized effects.

## What is real in this prototype

- One canonical 50,000-outcome session book and one shared style cursor.
- Wager size never changes symbols, the wheel face, or the jackpot ticket.
- Four horizontal left-to-right paylines across five reels and four rows.
- Three, four, or five scatters award 4, 7, or 18 free spins.
- Free-spin line wins use the approved Overdrive ×1.5 treatment.
- Five-in-a-row uses an equal six-face wheel: −30%, −15%, −5%, +5%, +25%,
  or +35% of that line's profit.
- Paid player spins move 5% of the wager from the house into the shared jackpot.
- A jackpot pays no more than 100× the current wager; the remainder stays.
- Wallet, house, and jackpot are separate conserved ledger accounts. A resolved
  fair win is honored even when it bankrupts the house.
- No result correction, bankroll reading, wager-based rerolling, or pity system.

The temporary test economy starts at 250 player credits, 5,000 house credits,
and a 100-credit jackpot, with wagers of 1, 2, 5, and 10. Those are laboratory
defaults, not the final tycoon economy.

Current candidate rule: queued free spins keep the triggering wager, add no new
jackpot contribution, and remain jackpot-eligible at that locked wager. We can
change this after playtesting without altering the outcome-book principle.

## Verification

Run:

```sh
node runtime/runtime-selftest.js
```

The self-test checks canonical book equality, deterministic replay, wager
neutrality, ledger conservation, duplicate and concurrent requests, free-spin
locking, jackpot settlement, static serving, and reset safety. Math validation
lives next door in `../slots/lux-5/`.

Automated source, API, and integration checks pass. Real WebGL appearance,
touch layout, audio, and animation timing still need the first visual playtest
in a normal browser because this workspace had no private browser preview.
