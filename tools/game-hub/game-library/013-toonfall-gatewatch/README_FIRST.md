# Bloomvale: Gatewatch

Status: **WORKING · STEWARDED GAME NIGHT BUILD · NEEDS MIKE'S REVIEW**

Bloomvale: Gatewatch is a full-screen storybook exploration-and-defense shooter.
After a three-scene introduction, one human Scout and a selectable human,
connected-AI, or built-in Moxie partner can roam five named districts, meet five neighbors, gather ten color
wisps, clear Patch's six-target range, unlock six upgrades, and choose when to
start each of five named Heartlight watches. The last watch adds a Heartlight-
focused Siphon guard and the high-health Ink Crown.

## Play

Launch slot `013` through Game Hub, or run the local managed runtime:

```powershell
node tools/game-hub/game-library/013-toonfall-gatewatch/runtime/server.js
```

Then open `http://127.0.0.1:8803/`.

Controls: `WASD` move, mouse aim, hold left click or `Space` to fire, `Shift`
dash, `E` Heartburst, `F` interact/start a nearby wave, `M` field map after
meeting Maribel, and `Escape` pause. A standard dual-stick gamepad is also
mapped: sticks move/aim, RT or A fires, B dashes, X uses Heartburst, Y
interacts, View opens the map, and Menu pauses. `H` toggles the field manual.
Physical gamepad behavior remains a separate hardware check.

## What this beta proves

- one human and one visible AI companion share a single camera;
- deterministic server authority owns waves, combat, score, health, and result;
- five authored watches—Petal Breach, Ripple Rush, Bruiser Bloom, Lantern Siege,
  and Crown of Ink—use distinct enemy mixes and seal bounded run receipts;
- Siphons ignore nearby defenders to pressure the Heartlight, while the final
  Ink Crown is forced exactly once as the eighty-third and last authored slot;
- the local authority accepts only same-origin browser access, byte-bounds JSON
  bodies, and returns structured 400/413 errors without dropping the session;
- deterministic server authority also owns district discovery, meetings,
  collectibles, target progress, activity completion, and run unlocks;
- wave clears return to open exploration instead of forcing the next round;
- six upgrades materially change Heartlight capacity, Moxie fire rate, movement
  and dash tuning, player shot damage, player health, or map access;
- the live objective and expedition HUD point to the next useful lead with
  distance and cardinal direction, while the field map shows exact progress
  toward every locked upgrade;
- the play-first HUD keeps that route visible without crowding Pippa: narrow
  tablets use the compact rail, while small laptops retain the live objective
  and collapse nonessential expedition progress during play;
- combat groups enemies hidden beyond the camera or beneath HUD chrome into
  counted edge cues, with the same directions exposed through a polite status;
- Nibs, Sprinters, and Bruisers now lock an authoritative target and telegraph
  distinct bite, lane, or stomp shapes before contact damage resolves; moving
  or dashing clear cancels the hit, produces `DODGED` feedback, and exposes the
  active target and resolve time through the observation route;
- a perfect dodge now awards 35 color and arms one 2.4-second Prism Counter:
  the next Scout shot deals double damage, has a distinct two-tone projectile
  and impact, and exposes its exact ready window through both the Scout Kit and
  observation route; expiry, firing, or a reboot clears the single charge;
- pause freezes the full authority clock rather than only movement, so attack
  windups, cooldowns, effects, reboot timers, combo time, and Prism Counter
  windows resume with exactly the time they had when the modal opened;
- lethal Heartburst damage uses the same award path as projectile kills, keeping
  wave slots, player/ally attribution, score, combo, and result kills exact;
- every defender hit carries the authoritative attacker position and damage
  into a target ring, a safe-edge bearing and amount, a pulsing health card,
  and exact `hit from <direction>` health semantics; the same cues remain
  available when reduced motion is selected;
- Heartlight damage changes the active objective and persists as stable, amber,
  or critical HUD/vignette feedback, with exact percentage and urgency exposed
  through progressbar and polite live-status semantics;
- a downed defender takes over its team card with an exact reboot countdown and
  recovery rail, while the live objective prioritizes the outage and assistive
  output announces both the down and the return; the completed reboot adds a
  bounded world `ONLINE` ring, `BACK ONLINE` card state, and restored health
  semantics so control recovery is visible at the instant authority returns;
- downed fire, Dash, and Heartburst edges are discarded by both client and
  authority instead of firing on return; the Scout Kit visibly goes offline and
  the observation contract exposes only wait-for-reboot and pause;
- map, help, pause, story, briefing, and result surfaces manage keyboard focus
  inside the active dialog, make background canvas/footer controls inert, and
  never resume simulation behind an open panel;
- reload/reconnect aligns the semantic input sequence immediately, and quick
  fire/ability edges remain queued until the server accepts them; visible,
  accessible link feedback distinguishes connecting, reconnecting, and restored
  states without repeating the same outage alert; rejected, malformed, or
  restarted-session counters realign without permanently locking input;
- health meters stay normalized when Heart Pocket raises Pippa to 125 maximum
  health, and system reduced-motion preference is honored by default;
- the browser renders a dependency-free, low-resolution WebGL terrain layer
  with raised district mesas, roads, gates, Heartlight tower, and Crown marker;
  its fragment color is quantized to 16 steps per channel and the authoritative
  Canvas gameplay layer remains visible above it;
- reduced motion locks the 3D camera while retaining every gameplay cue;
- reload reconnects to the still-running server state;
- intro, briefing, exploration, combat, map, pause/help, victory/defeat, and
  restart are explicit states.

This is not CANON and not a release. Mike remains the gameplay, taste, CANON,
and release gate.
