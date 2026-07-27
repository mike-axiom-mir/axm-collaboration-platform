# AXM Shapeable Builder — v0.13 Beta

A dependency-free, local-first three-layer builder for interactive websites, dashboards/apps and playable Canvas games.

**v0.13 polishes the most basic human action in the builder: placing and moving blocks.** A beginner now sees a real landing preview before release, gentle 12-pixel snapping, alignment guides, continuous edge auto-scroll, a clearer moving state, and touch/pen dragging from the palette. Holding **Shift** temporarily gives free placement. Every completed move remains one ordinary Undo/Redo step.

The v0.12 Per-Block Influence Studio remains intact. A block in the palette is the reusable type. A block placed on a canvas is one specific copy with its own settings, guided reactions, visual-state slots and transparent advanced code drafts.

The shared human + young AI foundation from v0.11 also remains. Both seats read the same stable project IDs and influence data. A young AI may propose bounded changes, but it still cannot silently apply them, enable code, grant permissions, alter canon, delete projects, contact a provider or execute an outside engine.

The three synchronized canvases remain:

1. **Logic** — events, decisions, state, routes, bounded loops/randomness, proof gates, Hands and readable code.
2. **Capabilities** — local storage/files/assets, diagnostics, skills, AI contracts, LAN contracts, scenery/physics contracts and portable export.
3. **Visual** — screens, interface patterns, content, metrics, charts, game worlds, scenery layers, characters, camera, HUDs and feedback.

## Start it

The editor works when `index.html` is opened directly. For the full installable/offline-app behavior, serve the folder locally:

```bash
python3 -m http.server 8765
```

Then open `http://127.0.0.1:8765` in a modern browser.

On Windows, unzip the package and double-click `START_BUILDER_WINDOWS.bat`.

Nothing in the shipped app requires an account, cloud service, npm installation, build command, CDN, analytics service or internet connection.

## Beginner path: place and move blocks

1. Choose the Logic, Capabilities or Visual layer.
2. Drag a block from the library onto the canvas. On touch or pen, drag the card sideways and the library moves out of the way.
3. Follow the translucent landing card. It shows the exact block, position and placement mode before anything is added.
4. Release to place. The block gently snaps to a 12-pixel grid and lines up with nearby block edges or centers when close.
5. Move a placed block by dragging its header. The block lifts visually, the route lines update live and the canvas scrolls when the pointer rests near an edge.
6. Hold **Shift** while moving or dropping with a mouse/keyboard to bypass snapping for a precise free position.
7. Use the **+** button when dragging is inconvenient. Keyboard users can focus a placed block and use Arrow keys; **Shift + Arrow** moves one pixel.
8. Use Undo/Redo normally. One completed drag is one reversible history step; a cancelled touch/pointer move does not become a source change.

## Beginner path: shape one placed block

1. Open a starter project or place a block.
2. Select the block on the canvas.
3. In the Inspector, find **Per-block influence**.
4. Start with the ordinary settings already shown for that block.
5. Under **Reactions**, choose:
   - **When** something happens;
   - **Do** one understandable response;
   - **Detail** the visible message, state or value.
6. Press **Preview** to see the reaction explanation without changing project source.
7. Open **Visual states** only when that block needs different appearances.
8. Leave **Advanced code hook drafts** closed unless you deliberately need readable code notes. Drafts are stored but never executed in this beta.
9. Run diagnostics and test the actual generated experience.

The important distinction is:

```text
Block type:     the reusable blueprint in the palette
Placed block:   this exact copy on this exact canvas
```

Changing Luma the Guide does not silently change every future World character. Duplicating Luma copies her understandable instance settings and reactions, but does not copy permissions, routes or active code authority.

## What v0.13 adds

### Visible landing preview

Dragging a library block over the canvas now shows a full-size translucent preview at the exact resolved position. The preview carries the real block icon and label, while the status bar reports its `x`/`y` position and whether placement is snapped, aligned or free.

The project source is unchanged until release. Leaving the canvas or cancelling a touch drag removes the preview and adds nothing.

### Gentle snap and alignment

New and moved blocks use a 12-pixel placement grid by default. When a block comes close to another block’s left edge, center or right edge—or its top, middle or bottom—it gently aligns and shows a visible guide line.

Holding **Shift** bypasses both grid and alignment snapping for the current mouse drag. Existing source positions are not migrated or silently rearranged.

### Continuous edge auto-scroll

When a placed block is held near a canvas edge, the viewport continues scrolling even if the pointer pauses. The dragged block stays attached to the pointer because its position accounts for the changing scroll offset. Palette drops also scroll near the edge.

### Mouse, touch and pen

Desktop mouse dragging still uses the browser’s native drag contract. Touch and pen use a bounded local pointer path with a floating block card. On a narrow screen, beginning a horizontal drag closes the palette so the canvas becomes available; a failed drop reopens it and leaves project source unchanged.

The **+** add button remains the simplest fallback, and all existing keyboard movement remains available.

### Clearer movement state and history

A moving block lifts above the canvas with a stronger outline and live routes. Pointer cancellation restores the original position. A successful move writes one ledger event and one Undo/Redo unit rather than dozens of tiny history entries.

## v0.12 foundation preserved: Per-Block Influence Studio

### Per-Block Influence Studio

Every selected block now receives a module-aware Inspector section marked **THIS COPY**. The wording and available choices depend on what kind of block it is.

Examples:

- a **person** can react when someone comes near, asks a question or completes a task;
- a **button** can react when someone activates it;
- a **world object** can react when it is approached, touched or collected;
- a **scene** can react when it starts, is entered or reaches completion;
- a **data display** can react when a value changes or reaches a threshold;
- a **logic or capability block** receives choices suited to its own module rather than character controls.

The built-in influence system currently has **9 module profiles**:

- Logic flow
- Capability
- Character
- Interface
- Scene or environment
- World object
- Content block
- Data display
- General block

### Guided reactions: When → Do → Detail

A beginner does not need to write code to describe a reaction. Each reaction has:

- a named moment;
- one bounded response;
- a plain-language detail;
- an optional boundary note;
- an active/paused switch;
- a safe explanation preview.

A selected person might read:

```text
WHEN someone comes near
DO say a message
DETAIL Welcome. Five star seeds will relight the grove.
```

Each placed block may hold up to **24 guided reactions**. Validation checks that the trigger and response belong to that block’s module.

### Visual-state slots for later assets

Each module declares sensible visual slots. A character can have states such as idle, walking, talking, listening and celebrating. A world object can have idle, highlighted, active and collected states.

A slot can hold:

- a local asset reference;
- a simple preview color;
- human-readable notes;
- its own source timestamp.

**Copy asset request** and **Download asset request** create a local `axm.asset.block-request` packet tied to the exact placed block and its stable ID. They do not generate, upload, replace or apply an asset. This is the safe attachment point for the future AXM asset generator.

### Transparent advanced code drafts

Advanced users can save module-specific code-hook drafts beside a placed block. The Inspector clearly labels every draft **Saved, not run**.

In this beta:

- code is preserved as visible source text;
- no code draft can be enabled in the UI;
- exported standalone builds do not include or execute these drafts;
- a young AI proposal cannot set a draft to enabled or change its execution mode;
- each block can hold up to **8** drafts;
- actual module execution remains a future reviewed runtime layer.

This keeps the route from beginner settings to advanced extensibility visible without turning “advanced” into hidden authority.

### Young AI proposal support

The bounded proposal protocol now has **17 verbs**. The original 11 source-building verbs remain, and six influence verbs were added:

- `add_influence_rule`
- `update_influence_rule`
- `remove_influence_rule`
- `set_visual_state`
- `set_code_hook`
- `remove_code_hook`

Influence proposals use exact block IDs or safe proposal aliases, validate on a clone and remain subject to the same human review, stale-source checks, separate confirmation and Undo/Redo history as other AI proposals.

Code-hook proposals are forcibly normalized to:

```text
enabled: false
execution: CONTRACT_ONLY
```

### Instance-aware project source

Each node can now carry a normalized influence record containing:

- its module ID;
- guided reactions;
- visual-state slots;
- code-hook drafts;
- schema version and source timestamps.

Older projects are backfilled when loaded. Unknown project and block source is preserved rather than silently rebuilt.

### Real but bounded standalone behavior

Generated standalone builds now consume a small, tested subset of the structured influence data:

- website buttons can show a local message, change their label and change their visual state after activation;
- playable games use the placed player’s movement-speed setting;
- a placed guide can show nearby and task-completion messages;
- a placed objective can show its collected message.

Other declared reactions remain readable project contracts until a matching runtime module is implemented. The editor does not pretend every listed action already runs everywhere.

### Beginner examples in rooted starters

- **Open invitation** includes a button with understandable activation reactions.
- **Cartoon world quest** includes:
  - Milo’s instance movement setting and visual states;
  - Luma’s nearby and completion reactions;
  - the star seed’s collected feedback and visual state.

The Cartoon world quest starter remains a clean 100% diagnostics example with 0 errors and 0 warnings.

## Human + young AI workflow

1. A human creates or opens a project and writes the human outcome and observable proof.
2. The human shapes blocks directly through settings and guided reactions.
3. Open **AI seat** when a young AI should inspect or propose work.
4. Export or copy the workspace observation. Nothing is sent automatically.
5. Give that packet to the AI system you deliberately choose. The builder itself does not include or contact an AI provider.
6. The AI returns an `axm.agent.proposal` packet containing assumptions, bounded actions, tests and unresolved risks.
7. Paste or import the proposal into the Workbench.
8. Validate and dry-run it on a clone.
9. Review every proposed action and authority boundary.
10. Apply, revise or reject. Apply requires all human checks and a second confirmation.
11. Run diagnostics and the changed path. An accepted proposal is still only a candidate until actual evidence supports it.

This is shared tooling, not hidden autonomy. “Learning” means a future AI turn can inspect visible project source, diagnostics, review receipts, influence settings and evidence. It does not mean the browser app secretly trains, remembers or rewrites itself.

## Human-controlled boundaries

A young AI proposal cannot directly:

- approve or revoke capability permissions;
- enable advanced code or change a code draft out of `CONTRACT_ONLY`;
- change canon or merge status;
- delete, trash, restore or permanently erase projects;
- overwrite checkpoints or imported source;
- publish, host, contact a provider or make network requests;
- execute external commands or an external game engine;
- conceal actions, uncertainty, test results or source changes.

Adding a capability through a proposal always starts its permission as **unapproved**, even when a similar capability was previously approved elsewhere.

## Core editor workflows

- Drag blocks from the palette with a visible landing preview, touch/pen support, snap, alignment and edge auto-scroll—or add by click.
- Move blocks by their headers with live routes, Shift free placement and one-step Undo/Redo; connect an output port to an input port.
- Create explicit cross-layer bindings in the Inspector.
- Edit one placed block’s identity, readable configuration and Per-block influence.
- Preview a guided reaction without mutating active project source.
- Prepare a local asset request tied to one placed block.
- Review, approve and revoke requested capability permissions.
- Disable a block without deleting its source.
- Inspect and edit the goal, success measure, state schema and protected invariants.
- Inspect the local change ledger and human/AI review receipts.
- Undo and redo project changes.
- Autosave all active vault projects in browser-local storage.
- Validate routes, compatibility, permissions, goals, bindings, influence data and source integrity.
- Preview a generated website, dashboard or playable Canvas game.
- Export complete project source, a standalone HTML build, an AI workspace, an AI intent packet or an engine handoff contract.
- Import validated project JSON as a separate vault project without overwriting the active project.

## Starter templates

- **Blank project** — source truth, invariants and export path only.
- **Open invitation** — polished interactive website with beginner button reactions.
- **Local stewardship board** — dashboard with metrics, chart and evidence list.
- **Parcel run** — playable top-down single-device collection mission.
- **Human + AI build loop** — Scout, Builder, Tester, Repair and Nugget with proof and human apply gates.
- **Cartoon world quest** — playable enchanted-forest mission with layered scenery, per-instance person/object influence and an optional external-engine handoff.
- **Young AI learning workshop** — shared observation, bounded proposals, human review, evidence and reflection across all three layers.

## Portable outputs

- `.axm-project.json` — complete canonical source with graphs, bindings, permissions, collaboration policy, review receipts, influence data, goal, invariants, provenance and ledger.
- `.html` — one working browser build with no external dependencies; blocked when diagnostics finds critical errors.
- `.axm-asset-request.json` — one local, reviewable asset request tied to a placed block and its visual-state slots. It does not contact a generator.
- `.axm-agent-workspace.json` — complete local machine-readable observation of the current project and allowed proposal protocol. Exporting does not contact an AI.
- `.axm-agent-proposal-template.json` — a fresh proposal shell carrying the current project ID, source timestamp and builder version.
- `.axm-intent.json` — a reviewable AI request contract. It does not contact a provider or apply a change.
- `.axm-engine-handoff.json` — a typed world/logic/physics contract. It does not execute an engine or overwrite files.
- Community block-pack JSON — palette definitions only; no executable script field exists in the pack schema. Packs may choose only safe built-in influence modules.

## Honest beta boundaries

- The asset generator is not embedded yet. The builder creates only a local request packet and visual-state attachment points.
- Advanced code hooks are saved source contracts only. They are not run by the editor or generated builds.
- Only the explicitly listed subset of guided reactions currently affects standalone website/game exports. The rest remain inspectable contracts for future module runtimes.
- No AI model or provider is embedded. The Workbench is a local observation/proposal/review protocol, not an autonomous agent runtime.
- The feature does not make an AI conscious, mature or independently trustworthy. “Young AI” means a guided early-stage collaborator operating through explicit source and narrow actions.
- Applying a structurally valid proposal does not prove the changed experience works. Human testing and observed evidence still matter.
- Generated working builds are browser-based. The External Engine Dock is a handoff seam, not a bundled Unreal, Unity or Godot runtime.
- AI-provider, state-mirror, media-render, phone-controller, LAN and host-authoritative multiplayer blocks remain inspectable contracts when their outside runtime is absent. Diagnostics marks them `contract-only β`.
- The playable game exports are real single-device Canvas proofs. LAN clients and phone-controller seats require a separate local host runtime that is not included here.
- Browser-local storage is convenient device state, not a backup system. Export important project JSON and block packs.
- Community packs extend the palette but cannot grant permission, execute code, overwrite project blocks or erase unknown source when removed.
- This package does not register itself into an existing AXM Workshop, AI provider, asset generator or external engine automatically.
- No public software or asset license has been silently assigned; see `LICENSE_STATUS.md`.

## Keyboard controls

- `Ctrl/Cmd + Z` — undo
- `Ctrl/Cmd + Shift + Z` or `Ctrl/Cmd + Y` — redo
- `Ctrl/Cmd + D` — safely duplicate the selected block
- `/` — search the block palette
- `Enter` or `Space` — select a focused canvas block
- Arrow keys — move a selected canvas block by 10 pixels
- `Shift` + Arrow keys — move a selected canvas block by 1 pixel
- `Delete` / `Backspace` — remove the selected block when not editing text
- `Escape` — cancel a confirmation/connection or close diagnostics
- Arrow keys / WASD — move in generated playable games

## Source integrity

Every exported project carries its schema and builder version, project identity, goal and proof, all three node/edge graphs, per-instance influence data, cross-layer bindings, capability decisions, collaboration authority, review receipts, state schema, invariants, provenance, compatibility information and visible local ledger.

Unknown imported block types and unknown project fields are preserved and reported. They are never silently replaced.

The original v0.11 archive is not modified by this package. v0.10 and v0.9 remain separate reference/rollback artifacts named in the coding handoff.

## Tests

The shipped app has zero runtime dependencies. Test runners are optional development tools:

```bash
# Targeted real-browser Per-Block Influence Studio test
python tests/smoke_influence_studio.py

# Dependency-free influence model/proposal/export test
node tests/model_influence_system.cjs

# Targeted real-browser Young AI Workbench regression test
python tests/smoke_agent_workbench.py

# Dependency-free Young AI proposal protocol regression test
node tests/model_agent_protocol.cjs

# Expanded whole-app browser suite; requires the Node Playwright package
node tests/smoke.cjs
```

See `tests/README.md` and `tests/LAST_SMOKE_RESULT.json` for the exact test status packaged with this candidate.

## Files

- `index.html` — accessible application shell, Quick Guide and dialogs
- `styles.css` — responsive visual system and beginner influence controls
- `model.js` — contracts, 77 blocks, seven templates, validation, influence model, proposal protocol and standalone generation
- `app.js` — vault, editor state, Inspector, Undo/Redo and Young AI Workbench
- `sw.js` — versioned offline shell cache
- `manifest.webmanifest` — installable app metadata
- `assets/axm-builder-mark.svg` — code-native transparent visual mark
- `tests/smoke_influence_studio.py` — targeted real-browser beginner influence test
- `tests/model_influence_system.cjs` — dependency-free influence/proposal/export test
- `tests/smoke_agent_workbench.py` — targeted real-browser Young AI safety-gate test
- `tests/model_agent_protocol.cjs` — dependency-free proposal protocol regression test
- `tests/smoke.cjs` — expanded whole-app browser suite
- `BETA_ACTION_REPORT.md` — delivered scope, QA evidence and boundaries

See `LICENSE_STATUS.md` before distributing this beta.
