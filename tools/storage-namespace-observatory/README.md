# AXM Storage Namespace Observatory

Detached `EXPERIMENTAL` graph consumer. It reads only HTML and JavaScript text
nodes already bounded by `axm.entry-resource-graph/v1`, and first verifies that
each current source hash still matches the graph.

## What it owns

- exact textual patterns for `localStorage`, `sessionStorage`,
  `indexedDB.open`, and `caches.open`;
- literal and same-file string-constant namespace resolution;
- dynamic and whole-store operations kept visibly unresolved;
- exact repeated namespace groups across distinct source ownership scopes;
- one question-only owner review packet.

A repeated namespace may be intentional cooperation. It is never labeled harm
or a defect without runtime owners separately checking value shape, lifecycle,
and migration needs.

## Preserved owners

Declaring modules and Workshop storage services retain runtime data. Authority
Surface and permission owners retain grants. Browser/LAN/Hardware QA retains
runtime behavior. Entry Resource Closure retains source scope. Technical
Glasses retains readiness.

## Run

```text
node storage-namespace-cli.js --root /path/to/workshop --graph /path/to/current-entry-resource-graph.json
node storage-namespace-cli.js --root /path/to/workshop --graph graph.json --output current-storage-namespace-map.json --browser-output current-storage-namespace-map.js --quiet
node selftest.js --workshop-root /path/to/workshop --graph /path/to/current-entry-resource-graph.json
```

No live storage, cookie, stored value, IndexedDB database, or Cache Storage
entry is opened. No key is renamed and no migration is generated or applied.
