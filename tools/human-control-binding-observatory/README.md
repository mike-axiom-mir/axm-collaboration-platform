# AXM Human Control Binding Observatory

Detached `EXPERIMENTAL` candidate. It consumes `axm.entry-resource-graph/v1`, rechecks source hashes, then inventories human-facing controls in each declared entry HTML file.

It separates inline handlers, native semantic actions, exact selector plus event-binding evidence, selector-only references, and no static match. It also observes missing names, hidden/disabled declarations, and duplicate IDs. Those are static observations, never a verdict that a control is broken or accessible.

```bash
node selftest.js
node human-control-binding-cli.js --root /path/to/workshop --graph /path/to/current-entry-resource-graph.json
node build-bundle.js
```

No DOM, browser, clicks, automatic fixes, permission grants, installation, promotion, or CANON change. Browser QA and human observation retain behavior, accessibility, focus, keyboard, and visual approval.
