AXM SANDBOX — its own Workshop module (tools/sandbox/)
=======================================================
Removable: delete tools/sandbox/ and nothing else changes. Spine untouched.
Port 8795 (Bridge 8787, Workshop 8788, Game Hub 8794).

Session 1 = project skeleton ONLY:
- projects/<folder>/ are portable, self-contained, inspectable, removable
- project.manifest.json declares identity + boundaries (bodies, cores, degrade)
- Host lists/validates/creates projects (pattern reused from Game Hub)

What this module does NOT do yet (honest): no entities, no clock, no renderer,
no editor, no saves beyond the folder itself. Sessions 2-6 per ALPHA_SANDBOX_SLICE.

Long-goal guardrails already baked in:
- bodies declared per project, never assumed -> 3D/headless later = a new body
- cores[] = adapter seats -> a physics core later plugs a seat, not the spine
- schema_version -> migration seat (W07.05) exists before it is needed
- unknown manifest keys preserved, never deleted (no-loss)

Run:  node tools/sandbox/sandbox-server.js  ->  http://localhost:8795
Test: node tools/sandbox/selftest.js

Disposable candidate extension (`TEST`):

- accepts only the exact byte-bound native game packet and bounded growth authorization
- writes only below `state/disposable-candidate-sandboxes/`
- keeps `source/`, `output/`, `evidence/`, and `lessons/` as disjoint roots
- parses and validates candidate structure without executing it
- launches no candidate process and passes no host environment or credentials
- repairs by new immutable iteration; it never edits the source packet or prior output
- serves one selected static iteration on `127.0.0.1` inside a script-only iframe with network-denying CSP
- lessons remain privacy-safe, inactive `EXPERIMENTAL` candidates pending a separate Tier 3 decision
- install, integrate, publish, promote, and `CANON` remain outside this service

See `README-disposable-candidate-sandbox-v1.md`.

```powershell
node tools/sandbox/selftest-disposable-candidate-sandbox-v1.js
```
