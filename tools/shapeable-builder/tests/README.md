# AXM Shapeable Builder v0.13 tests

The shipped browser app has no runtime dependencies. These files are optional QA tools.

## 1. Targeted drag-and-drop polish browser smoke

Requires Python Playwright and a Chromium executable.

```bash
python tests/smoke_drag_drop_polish.py
```

The runner loads the real HTML, CSS and JavaScript in Chromium. It checks the exact landing preview, 12-pixel snap, alignment guides, Shift free placement, continuous edge auto-scroll, one-step Undo/Redo, real touch dragging from the mobile palette, browser errors and unexpected outside requests. It also produces desktop and mobile evidence screenshots.

Set `AXM_CHROMIUM_PATH` when Chromium is not available at `/usr/bin/chromium`.

## 2. Targeted Per-Block Influence Studio browser regression

Requires Python Playwright and Chromium.

```bash
python tests/smoke_influence_studio.py
```

This checks the beginner Inspector wording, guided reaction preview, source-safe add/edit/delete behavior, Undo/Redo, visual-state editing, local asset-request download, contract-only code drafts, generated website/game behavior, mobile layout, browser errors and unexpected outside requests.

## 3. Dependency-free influence model test

Requires Node.js only; no packages are installed.

```bash
node tests/model_influence_system.cjs
```

This exercises the nine module profiles, template influence data, safe simulation, asset request contract, legacy backfill, all six influence proposal verbs, code-execution rejection and the tested standalone website/game influence subset.

## 4. Targeted Young AI Workbench browser regression

Requires Python Playwright and Chromium.

```bash
python tests/smoke_agent_workbench.py
```

This checks the shared workspace/proposal contract, human apply gates, stale-source protection, Undo/Redo, semantic controls, mobile layout, browser errors and unexpected outside requests after the v0.13 drag-and-drop polish.

## 5. Dependency-free proposal protocol regression

Requires Node.js only.

```bash
node tests/model_agent_protocol.cjs
```

This checks the existing project-building proposal families, clone impact, permission preservation, review receipts and key rejection paths with the preserved 17-verb protocol.

## 6. Expanded whole-app browser suite

Requires the Node Playwright package and Chromium:

```bash
node tests/smoke.cjs
```

This is the broader whole-application suite. It starts a local Python HTTP server and covers templates, vault, checkpoints, packs, generated sites/games and offline behavior. The Node Playwright package is required only for this optional test runner, not for the shipped app.

`LAST_SMOKE_RESULT.json` states exactly which suites were run for the packaged candidate and which were only updated.
