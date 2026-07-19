# CIRCUITSEED — THE PROTOCOL WILDS

**Descriptor:** A local-first agent-world adventure  
**Build:** v0.2.0 local alpha candidate — director's cut  
**Honest status:** **ALPHA CANDIDATE / WORKING** — not production-ready and not yet visually certified in a real browser

Circuitseed is an original top-down technical-wilderness adventure. The beings you meet are unfinished Circuitseeds. They become individual Circuitkin through repair, trust, help, negotiation, shared missions, failure, recovery and explicit choices. They are never captured.

## Fast local launch for Mike

### Windows

1. Keep the whole Workshop folder together.
2. Open `tools\game-hub\game-library\009-circuitseed-protocol-wilds`.
3. Double-click `START_CIRCUITSEED_VIA_GAME_HUB.bat`.
4. Keep the command window open.
5. Open the exact address printed in that window—normally:

   `http://127.0.0.1:8799/games/009/`

6. Press **New Journey** or **Continue**.

### Linux / macOS

Run:

```sh
./START_CIRCUITSEED_VIA_GAME_HUB.sh
```

Then open the exact printed local address.

The helper goes through the real local Game Hub, assigns and readies one visible human seat, asks the Hub to start slot `009`, and leaves all other seats empty. It does not create AI substitutes.

**Continue** reopens the last selected local host world. **New Journey** creates a new deterministic world without erasing prior worlds or the selected participant profile.

## Controls

- Move: `WASD` or arrow keys.
- Scan: `Q` or the **SCAN** dock button.
- Connect after scanning an unfinished signal: `C` or the **CONNECT** dock button.
- Interact / collect / open a nearby system: `E` or **ACT**.
- Open the Memory Echo Journal: `J` or the **JOURNAL** button under the field map.
- Open the optional Signal Board: `B`, or **BUILD / SELL → REQUESTS**.
- The remaining verbs are always visible: **CONNECT**, **DEPLOY**, **ASSIST**, **RECOVER**, **RETURN**, and **BUILD / SELL**.
- In a tactical encounter, choose one of: **Scan, Anchor, Shield, Patch, Reroute, Challenge, Isolate, Synchronize**.

Phone controller links appear under **BUILD / SELL → LOCAL PARTY** after the host starts an in-game session. The party screen is `http://127.0.0.1:8799/party/`. A party screen renders but occupies no player seat.

Under **BUILD / SELL → CIRCUITKIN**, the player can open the 30-design Field Codex, inspect trust/use history, deploy any connected companion, make an eligible focus-branch choice, evolve a two-parent Confluence specialist, and start friendly 1v1 or 2v2 signal simulations when enough seats are occupied.

Under **JOURNAL**, the player can read recovered Memory Echoes, inspect provenance-bearing keepsakes, see every material and crafted item, and review milestones. Under **REQUESTS**, sixteen optional persistent jobs show real profile-derived progress. They have no timer or away penalty; their rewards are validated and committed by the host.

The field HUD now includes a full minimap, live coordinates, region-entry cards, and nearby action guidance. Memory Echoes use the same ordinary exploration verb as other evidence: move close and **Scan**.

Field recruitment is a three-part loop: find a luminous Circuitseed site, **Scan** its unfinished need, then **Connect** after helping. A Confluence evolution requires both listed parent Circuitkin at trust 3 with two validated field uses each. It inherits both roles and a stronger signature action; neither parent is consumed.

Ending a managed session saves the separate participant/world state, returns the result summary to the Game Hub, restores its lobby state, and stops the game child. Run the launch helper again to begin another managed session.

## What the alpha candidate contains

- Premium animated title presentation, New/Continue/Profile choices, accessibility settings and procedural WebAudio.
- Lumen Yard settlement plus the Relayborn Route, Threadwild, North Corewild and Rootsignal Convergence.
- Thirty distinct roster designs: 20 individual Circuitkin and 10 two-parent Confluence specialists.
- Nineteen authored field-signal sites, alternate routes to the two unchosen starters, and an encounter-earned Aegis relationship make all 20 individuals available to one persistent profile.
- Trace, Mend and Relay starters, each with two use/trust/history-driven branches.
- Ten-stage authored first chapter, a state-derived dynamic mission, a cooperative synchronization event, and a Rootsignal finale.
- Sixteen optional persistent Field Requests spanning exploration, archive work, relationships, training, Confluence development, making, trade, and chapter return.
- Ten discoverable Memory Echoes with full journal fragments, ten archive keepsakes, and five recipe unlocks.
- Original tactical containment and friendly 1v1/2v2 simulations.
- Discovery → 34 resource nodes → 10 recipes → 9 local orders → reputation/world-demand loop, backed by a 45-entry item catalog.
- Three optional business paths and session-visible stalls with no away punishment.
- Explicit portable profile export and import with visible conflict recovery and strict schema refusal.
- One-to-eight occupied seats, real drop-in/out, stable local profiles, recovery copies and no automatic AI fill.
- Same semantic action gate for human and connected adapter seats; seat-bounded adapter observation.

## Privacy and persistence

No internet, cloud account, external AI, telemetry, advertising or remote asset is required. Runtime state is stored under this game folder's ignored `local-data/` directory:

- participant profiles;
- host world saves;
- append-only session ledgers.

They remain separate. Browser storage holds only UI preferences, the selected profile ID and the current tab's seat binding. A portable profile JSON is exported only when the player presses the explicit export button.

## Test command

```sh
npm test
```

See `TEST_REPORT.md` for what actually passed and `KNOWN_LIMITS.md` for every current non-pass.

## First later local test

Use a desktop browser and a phone on the same private LAN if available. Check title sculpture, profile import/export, New/Continue, Lumen Yard movement, minimap and nearby guidance, every region reveal/texture, at least two Memory Echo discovery cards, journal/inventory, one Field Request claim, recipe locked/ready states, the 30-entry codex, several distinct companion forms, active switching, one Confluence evolution, both major encounters, Circuitkin branch cards, crafting/shop, party screen, phone portrait/landscape controls, disconnect/reconnect, and managed return to the Hub. Record screenshots before changing the status label.

For a later local ChatGPT/Codex handoff, start with `LOCAL_CHATGPT_INTAKE.md`. The full latest change inventory is in `DIRECTORS_CUT_CHANGELOG.md`.
