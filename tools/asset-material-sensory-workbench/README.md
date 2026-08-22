# AXM Asset Material Sensory Workbench

Status: **TEST**. Candidate-only and non-promoting; not CANON.

This tool joins the deterministic `pbr-material-bake@1.1.0` machine hand to a bounded human visual-material review loop. It can create or edit a recipe through the public Asset Hands route, gate the whole READY/PASS result, verify every PNG with full SHA-256 before upload, render a reference sphere or plane in WebGL2, expose raw channels, preserve A/B state, and export source-neutral machine patches or viewer-bound human receipts.

## Run

From the Workshop root:

```bash
node tools/asset-material-sensory-workbench/server.js
```

Open `http://127.0.0.1:8793/`. The host listens only on loopback. Requests are limited to 256 KiB and reviewable responses to 12 MiB. JSON is the normal transport; a same-origin hidden-frame form fallback keeps the exact bridge usable in constrained local browsers that block scripted `fetch`. It does not write files, install assets, bind materials to models, promote candidates or canonize anything.

When the host is unavailable, the page remains a serialized-result inspector. A raw `axm.asset-hand-result/v1` is gated in the browser: exact hand/version, READY/PASS truth, eight exact artifact envelopes, candidate-only authority, recipe/receipt binding, PNG signature/IHDR/dimensions, sampling metadata and full PNG SHA-256 are checked before WebGL upload. Editing is disabled in this mode.

## Honest review boundary

The live view is a tool-local, direct-light reference renderer. It deliberately has no IBL, height displacement, GLB binding or target-engine shader parity. A dynamic WebGL observation plus an explicit reviewer checkbox is required for `ACCEPT_FOR_TEST`; `REVISE` and `REJECT` remain available as human reports. Any viewer or candidate change makes the current review stale while preserving it as append-only history.

Technical PASS does not prove realism, beauty, intended art direction, physical-surface behavior, representative GPU performance, accessibility conformance or external material conformance. Mike Tobi remains the review and canon gate.

## Focused checks

```bash
node --check tools/asset-material-sensory-workbench/core.js
node --check tools/asset-material-sensory-workbench/server.js
node --check tools/asset-material-sensory-workbench/renderer.js
node --check tools/asset-material-sensory-workbench/app.js
node tools/asset-material-sensory-workbench/selftest.js
node tools/asset-material-sensory-workbench/server-selftest.js
```

Browser rendering and interaction are separate evidence. Syntax, HTTP and core tests do not prove the live WebGL view.
