# AXM Browser Global Surface Observatory

Integrated `TEST` module. It consumes `axm.entry-resource-graph/v1`, rechecks every source hash, and maps explicit `window` / `globalThis` text patterns without loading a browser.

It distinguishes definitions, `Object.defineProperty`, references, deletions, literal or same-file-constant bracket names, and unresolved dynamic names. Exact definitions in more than one source ownership scope form a review group. That group is evidence for a question, not proof of a collision.

```bash
node selftest.js
node browser-global-surface-cli.js --root /path/to/workshop --graph /path/to/current-entry-resource-graph.json
node build-bundle.js
```

No permissions. No JavaScript execution. No runtime-global access or mutation. No ownership verdict, auto-rename, install, promotion, or CANON change. Browser runtime verification remains with Browser, LAN and Hardware QA Lab.
