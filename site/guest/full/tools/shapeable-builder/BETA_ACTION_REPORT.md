# AXM Shapeable Builder Beta — Action Report

**Build:** v0.13.0-beta  
**Status:** Working local candidate beta / experimental / not automatic AXM canon  
**Date:** 2026-07-23  
**Requested change:** One final beginner-friendly drag-and-drop polish before local use.

## 1. Diagnosis

The v0.12 builder could already add palette blocks, move placed blocks with pointer input, move them by keyboard and undo a completed move. The path worked, but it still felt like a technical editor rather than a calm beginner surface:

- a palette drag showed only a generic canvas message rather than the exact landing block;
- the final position was not visibly resolved before release;
- nearby blocks gave no alignment feedback;
- movement near the edge did not continuously scroll while the pointer paused;
- touch users had the `+` fallback, but not a real palette-to-canvas drag path;
- a moving block did not lift clearly above the canvas;
- pointer cancellation was not explicitly treated as a no-change operation.

The repair keeps the same project model and three-layer architecture. It changes only the human interaction surface and placement calculation. No project schema migration, new permission, provider, telemetry, network call or external runtime was added.

The original v0.12 ZIP was not edited. Its SHA-256 remains:

```text
712a269f175025cd9f80572c0356fb32d8b53f51d4f208cbbe5452ed4e770c67
```

## 2. Screenshot-to-source trace

No new defect screenshot was supplied for this repair. The requested target was the existing drag-and-drop path itself.

The implementation was traced through verified v0.12 source:

- `app.js`
  - palette `dragstart` / canvas `dragover` / `drop` flow;
  - placed-node `pointerdown` / `pointermove` / `pointerup` flow;
  - canvas coordinate conversion, zoom, scroll, Undo/Redo and ledger behavior.
- `styles.css`
  - palette cards, canvas viewport, placed blocks and mobile palette transition.
- `index.html`
  - canvas landmarks, beginner tip, status bar and Quick Guide.
- `tests/`
  - real Chromium regressions for Per-Block Influence and the Young AI Workbench.

Verified root cause: the old code calculated a drop only at release and moved a node from pointer delta alone. It had no shared placement resolver, visual landing object, alignment resolver, continuous drag loop or touch palette-drag session.

## 3. Files changed and why

### `app.js`

Added one shared, bounded placement system used by both new blocks and moved blocks:

- 12-pixel gentle grid snap;
- nearby left/center/right and top/middle/bottom alignment;
- visible alignment positions;
- Shift free-placement bypass for mouse/keyboard-assisted dragging;
- canvas-boundary clamping;
- exact status-bar coordinates and placement mode.

Polished palette drag:

- full-size landing preview with the real icon and label;
- custom native drag card;
- payload validation against the active layer and known catalog;
- live preview during canvas edge scrolling;
- source remains unchanged until a valid drop.

Added touch and pen palette drag:

- horizontal drag threshold so ordinary vertical palette scrolling remains available;
- floating local block card;
- mobile palette moves out of the way after a drag begins;
- failed/cancelled drops add nothing and reopen the palette when appropriate;
- successful touch placement uses the same canonical placement resolver as mouse input.

Polished placed-block movement:

- requestAnimationFrame movement loop;
- continuous edge auto-scroll even while the pointer pauses;
- scroll-offset compensation so the block stays attached to the pointer;
- live route redraw;
- stronger moving state;
- pointer cancellation restores the original coordinates;
- one completed drag remains one ledger event and one Undo/Redo unit;
- the click immediately following a drag is suppressed without blocking normal selection.

### `styles.css`

Added or refined:

- landing-preview card;
- vertical and horizontal alignment guides;
- active canvas drop boundary;
- native and touch drag cards;
- mobile-safe drag-card positioning;
- lifted placed-block movement state;
- grab/grabbing cursors and touch-action boundaries;
- reduced visual ambiguity while preserving the existing AXM palette and layer colors.

### `index.html`

Added stable DOM landmarks for the landing preview and alignment guides.

Updated beginner wording to explain:

- drag to place;
- touch/pen support;
- header dragging;
- snapping and alignment;
- Shift free placement;
- edge auto-scroll;
- one-step Undo/Redo.

Updated the visible beta label to v0.13.

### `model.js`, `sw.js`, `manifest.webmanifest`

- updated the app version to `0.13.0-beta`;
- updated the offline cache name;
- updated the installable-app description.

No project schema, block catalog, proposal protocol or execution authority changed.

### `README.md`, `START_HERE.txt`, `tests/README.md`

Documented the new beginner placement path, exact boundaries and test commands.

### `tests/smoke_drag_drop_polish.py`

Added a focused real-Chromium suite covering native mouse drag, touch drag, landing preview, snap, alignment, Shift free placement, edge auto-scroll and history behavior.

Generated direct visual evidence:

- `tests/drag-drop-polish-desktop.png`
- `tests/drag-drop-polish-mobile.png`

### Existing regression tests

Updated only their expected app version. Their underlying Per-Block Influence and Young AI safety checks remain intact.

## 4. Tests actually run and results

### Focused real-browser drag-and-drop suite

```text
python tests/smoke_drag_drop_polish.py
PASS
browser errors: 0
outside requests: 0
console messages: []
```

Verified:

- exact landing preview appears before source mutation;
- preview and final node coordinates match;
- default positions resolve to the 12-pixel grid;
- alignment guide appears and the completed block aligns exactly;
- Undo restores the original position and Redo restores the move;
- Shift drag bypasses snap/alignment and preserves the requested free delta;
- holding a moved block near the edge continuously scrolls the canvas;
- real Chromium touch input starts from the mobile palette, closes it, shows a floating card and landing preview, and places one snapped block;
- no browser errors or outside requests.

### Existing real-browser regressions

```text
python tests/smoke_influence_studio.py
PASS browser per-block influence smoke
console messages: []
requests: []

python tests/smoke_agent_workbench.py
PASS browser workbench smoke
console messages: []
requests: []
```

These preserved the v0.12 Per-Block Influence Studio, structured asset request, disabled code-draft boundary, generated website/game subset, Young AI proposal review gates, stale-source protection, Undo/Redo and mobile layout.

### Dependency-free model regressions

```text
node tests/model_influence_system.cjs
PASS
version: 0.13.0-beta
modules: 9
code execution: CONTRACT_ONLY

node tests/model_agent_protocol.cjs
PASS
version: 0.13.0-beta
templates: 7
catalog blocks: 77
proposal verbs: 17
```

### Syntax and static checks

Passed:

```text
node --check model.js
node --check app.js
node --check tests/model_agent_protocol.cjs
node --check tests/model_influence_system.cjs
node --check tests/smoke.cjs
python -m py_compile tests/smoke_drag_drop_polish.py tests/smoke_influence_studio.py tests/smoke_agent_workbench.py
```

Also verified:

```text
HTML IDs:              134
Unique HTML IDs:       134
Cached JavaScript IDs: 130
Missing cached IDs:    0
Remote runtime URLs:   0
```

### Optional broad Node Playwright suite

Attempted:

```text
node tests/smoke.cjs
```

It could not start because the optional Node `playwright` package is not installed in this environment. The shipped application does not require that package.

A separate browser navigation check through `file://` or a localhost server was also blocked by this environment’s administrator policy before the page could load. The focused Python Chromium suites did execute the real shipped HTML, CSS and JavaScript together, and the service-worker logic was not otherwise changed beyond its v0.13 cache name.

## 5. Updated versioned ZIP/files

Candidate package name:

```text
AXM_SHAPEABLE_BUILDER_BETA_v0_13_0_2026-07-23.zip
```

The package contains the app, documentation, optional QA tests and directly relevant test screenshots. It does not include unrelated chat screenshots, the conceptual poster, old ZIP archives, working-copy folders, browser profiles, package caches or hidden source-control data.

## 6. Honest boundaries or unresolved seams

- Dragging remains single-block movement. Multi-select, group movement and free canvas panning are not included.
- Alignment uses the builder’s fixed current card dimensions. Variable-sized future nodes will need size-aware anchors.
- Shift free placement is available for mouse/keyboard-assisted drag. Touch and pen use the safer snapped path because there is no modifier key in that interaction.
- Browser-native mouse drag visuals can still vary slightly by browser, but the canonical landing preview and final placement are controlled by AXM source.
- The local-install/offline shell was not fully re-executed through real `file://` or localhost navigation here because that navigation was blocked by the execution environment. No network or service-worker architecture was added or removed.
- AI, LAN, Mirror runtime, asset generation and Engine Dock execution remain contract-only wherever their outside runtimes are absent.
- This is a v0.13 candidate, not an automatic canon or MergeGate decision.

## 7. SOULCHECK

**PASS** — the repair makes the first human action calmer, clearer, touchable and reversible without flattening the three-layer fabric, adding hidden authority or changing the source model beneath it.
