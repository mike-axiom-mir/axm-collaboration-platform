# Pixel 3D Representation Evidence Matrix

Status: `EXPERIMENTAL` · machine evidence complete · human visual acceptance pending

| Claim | Required evidence | Evidence | Result |
|---|---|---|---|
| Exact 8-bit and 16-bit 3D choices exist without fallback | Contract + deterministic behavior | `pixel-3d-core.js`, `pixel-3d-request.schema.json`, `pixel-3d-core-selftest.js` | PASS |
| Outputs are actual animated engine-neutral models | Structural model inspection + output files | `pixel-3d-codec.js`, eight `pilots/pixel-3d/**/*.glb` files, per-profile validation receipts | PASS |
| Identity, footprint, pivots, sockets, and semantic state survive both profiles | Contract comparison + embedded metadata | Per-identity `asset-representation-set.json`, scene recipes, GLB `extras.axm`, pilot proof cross-profile checks | PASS |
| The capability is modular and routable | Hand descriptor + registry test | `hands/pixel-3d-representation.js`, `pixel-3d-hand-selftest.js`, Asset Hands 41-provider selftest | PASS |
| Repeated models are measured against real draw complexity | Executable accounting + live corroboration | Instanced triangle accounting in `pixel-3d-codec.js`; receipt model counts differ from viewer totals by the documented 14 procedural triangles | PASS |
| The browser uses a real 3D renderer and interactive controls | Live rendered frames + bounded interaction | `live-browser-evidence.json` and five retained screenshots | PASS |
| Unavailable future 3D is never silently approximated | Typed negative test | `cinematic-render` and `realtime-3d-high-detail` return `MISSING_REPRESENTATION`, `fallback_used: false` | PASS |
| Four assets are not misrepresented as a complete game overhaul | Scope contract + visible boundary | Pilot proof boundary, lab UI, module contracts, and unchanged unavailable whole-game `walkable-3d` pack | PASS |
| Originality, readability, motion quality, and game fitness are acceptable | Mike Tobi review | Not yet provided | PENDING |

The capability-gap comparator therefore reports every machine requirement as `READY`; its overall result remains `BLOCKED` only because the explicitly required human quality review has not happened.
