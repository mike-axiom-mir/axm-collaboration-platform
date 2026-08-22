# Exact next-tool gaps

Overall route: **DEGRADED, PLAYABLE NOW**. The current workshop can deliver and
verify a local 3D First Edition. The following tools would materially raise it
from a strong procedural browser game to a commercial-quality production.

Current TEST expansion note: the Workshop was sufficient to add and verify a
sixth non-combat adventure plus three saved route rehearsals. This reduces the
immediate content-depth gap, but it does not replace human pacing review, a
physical-controller pass, Steam packaging, representative hardware coverage or
commercial-scale authored region production.

## 1. Remaining `asset.character.skeletal-3d-production` breadth

- Gap type: **HAND + SUBSTRATE**
- Purpose: author consistent high-quality Humans, Toons, enemies, miniature
  robots, facial rigs, comedy poses, and reusable animation sets.
- Inputs: approved turnaround sheets, scale guide, equipment socket contract,
  per-character silhouette and expression list.
- Outputs: GLB 2.0 with named skeleton, skinned meshes, animation clips, LODs,
  material/texture set, collision proxy, and provenance JSON.
- Side effects: creates versioned source and runtime assets only inside slot 014.
- Permissions: local filesystem; no publication or library promotion.
- Resource budget: Blender-capable GPU workstation; target under 20 MB per hero,
  under 5 MB per miniature/enemy after compression.
- Failure/recovery: source `.blend` remains canonical; failed exports never
  overwrite the last verified GLB.
- Compatibility: Three.js r160 GLTFLoader or the Workshop's native GLB runtime.
- Verification: render turntable, animation-loop screenshots, socket tests,
  silhouette comparison, load/performance receipt.
- Promotion gate: Mike approves one Human, one Toon and one miniature robot in
  live combat before the rest are produced.

Current capability: one Quaternius CC0 Human GLB is packaged locally with 31
joints and 11 authored clips. Its exact hash, source, license and relative path
are enforced by tests; the live browser proved idle, walk, Panzer slash,
settlement, reduced-motion and forced-fallback states. The existing primitive is
still the safe runtime fallback, while Toon identity remains code-native.

Remaining gap: cast breadth and bespoke authorship. A locally installed Blender
4.x hand with rigging, weight painting, GLB export, texture baking and render
verification is still needed for a Bonk & Bolt-specific Human sculpt, Toon and
robot production rigs, facial animation, grip corrections, costume variants and
LODs. Blender is not currently installed or callable on this machine.

The version-1 semantic motion system remains the authority for class identity.
Future assets should keep the tested Panzer slam, Pun-Slinger fan and Gear
Shepherd command language rather than creating a second combat-animation system.

## 2. `game.coop.networked-authority`

- Gap type: **HAND + CONTRACT**
- Purpose: two players on separate devices with reconnect, deterministic combat,
  shared quests, pet ownership, and save-conflict protection.
- Inputs: semantic player intentions and authenticated local room seats.
- Outputs: 20–30 Hz authoritative snapshots, event ledger, reconnect token,
  versioned save checkpoints, and result summary.
- Side effects: writes only game-local server saves and append-only session logs.
- Permissions: explicit LAN hosting; internet hosting remains a separate choice.
- Resource budget: two local clients, under 100 KB/s per player, 50 ms server
  tick budget.
- Failure/recovery: freeze world changes during split-brain; resume from last
  acknowledged checkpoint; never silently merge pet or equipment ownership.
- Compatibility: AXM Game Hub seat map and `axm-semantic-input-v1`.
- Verification: packet-loss test, host reload, client reconnect, concurrent
  equipment pickup, quest choice, and 60-minute two-device soak.
- Promotion gate: zero item duplication/loss and clean reconnect in ten runs.

Recommended tool: a bounded local multiplayer/server-authority hand. No external
plugin in the recommended-plugin list supplies game networking.

## 3. `audio.cartoon-production-suite`

- Gap type: **HAND**
- Purpose: original comedy impacts, robot voices, village beds, dynamic omen
  music, cook-off/fishing feedback, and final mix.
- Inputs: event cue sheet from `app.js`, character list, biome list, loudness and
  accessibility targets.
- Outputs: local OGG/WAV stems, cue manifest, loop points, captions, and mix
  presets.
- Side effects: versioned assets inside the game package.
- Permissions: local generation/editing only.
- Verification: missing-cue scan, loop-pop test, loudness report, muted and
  reduced-sensory play passes.
- Promotion gate: every gameplay-critical cue remains distinguishable without
  relying on volume alone.

The Workshop already has Audio Studio, so the cheapest route is to adapt that
existing capability before adding a new external tool.

## 4. `qa.game.long-session-human`

- Gap type: **EVIDENCE**
- Purpose: prove fun, pacing, readable comedy, camera comfort, save continuity,
  co-op friction, and the literal 24-hour transition.
- Inputs: packaged First Edition, two people, target laptop/gamepad, test
  checklist and issue capture.
- Outputs: timestamped play notes, screenshots/video, save hashes, balance
  changes, and an approval/refusal decision.
- Side effects: evidence only; no automatic status promotion.
- Verification: at least three fresh solo runs, three co-op runs, a 2-hour soak,
  and a cumulative 24-hour save transition.
- Promotion gate: Mike—not automation—decides whether the game is funny and
  worth stewarding toward perfection.

## 5. `content.openworld.authored-scale`

- Gap type: **HAND + RESOURCE**
- Purpose: expand from one dense valley to multiple districts without filler,
  repeated junk, forgettable lore, or opaque challenges.
- Inputs: approved First Edition systems, content budget, quest-writing rules,
  biome kit, enemy/gear/pet matrices.
- Outputs: region packages with adventures, visible tasks, inhabitants, drops,
  cook-offs, fish ecology, robot roles, traversal and performance budgets.
- Failure/recovery: each region is additive and removable; no shared-world save
  migration without a tested adapter.
- Verification: per-region completion path, no-internet challenge audit, drop
  density report, navigation readability, and human play evidence.
- Promotion gate: every new region must contain at least one memorable fight,
  one non-combat world change, and one adventure worth retelling.

Recommended tool: a game-content production hand with quest graphs, region
budgets, nav/collision bake, asset assignment, and automated no-filler audits.

Current rung: `The Lantern That Missed Curfew` proves one additive pattern that
does not copy the existing combat or cook-off chapters. It opens three
non-failing traversal courses with persistent bests and a mechanical world
choice. Future content should preserve that standard: a new interaction rule,
an explicit route, a saved consequence and no substitute grind.
