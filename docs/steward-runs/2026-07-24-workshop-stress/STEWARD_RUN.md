# AXM Workshop steward stress run

Run window: 2026-07-24, Europe/Amsterdam  
Scope: full deterministic acceptance, live loopback pressure, fail-closed API probes, rendered Hub/runtime interaction, responsive checks, and shared-workspace reconciliation.

## Verdict

**PASS WITH REPAIRS QUEUED.** The final, fresh-snapshot `npm test` completed with exit code 0. The live server survived the bounded pressure run without restart or request failure. Desktop Hub navigation and the local WebGL2 runtime lifecycle worked. The run does not support a claim of production readiness because compact Hub layout, static accessibility, physical/LAN hardware, long-duration stability, and installed native substrates remain incomplete or unverified.

## Final deterministic acceptance

- Tool index: 154 tools, 983 capabilities, 23 ready for human review.
- `verify.js`: 0 FAIL, 37 warnings, spine `b618c5762240070c`.
- Final top-level `npm test`: PASS, exit 0.
- Workshop Discovery: 154/154 authored coverage; six-pass closure; 0 actionable seams.
- Global HTML script syntax: 53/53 pages PASS.
- Studio discovery: 16 verified, 0 open.
- Game library: 10 packages verified, 0 failures, 31 known-experience warnings.
- Cognitive Resource focused adversarial suite: 61 PASS, 0 FAIL; evidence labs: 21 PASS, 0 FAIL.
- Asset Hands: 36 providers, 0 curated hand gaps; 50-upgrade program and all four waves PASS.
- Operations roadmap: 225 checks across 20 modules PASS.
- District Party: 188 runtime/unit tests PASS; its optional Playwright browser smoke remained UNRUN because that package is not installed.

Three deterministic seams failed early while files were moving: Workshop Discovery coverage, Studio's shared Creation Hands evidence, and the global HTML script syntax scanner. Concurrent builders repaired all three during this run. Each was re-read and re-run against the fresh snapshot before the final top-level acceptance passed.

## Live HTTP pressure

Instrument: `steward-http-stress.js`  
Workload: 2,400 GET requests, concurrency 32, eight rotating Hub/API/module routes.

| Measurement | Result |
| --- | ---: |
| HTTP 200 | 2,400 / 2,400 |
| Network or HTTP failures | 0 |
| Duration | 36.986 s |
| Throughput | 64.89 requests/s |
| p50 latency | 532.84 ms |
| p95 latency | 883.85 ms |
| p99 latency | 1,108.51 ms |
| Maximum latency | 1,311.73 ms |
| Response bytes read | 137,380,800 |

The server stayed on PID 23404 and `/api/tools` returned 200 after the run. Working set moved from 72.87 MB to 134.77 MB, private memory from 100.67 MB to 163.89 MB, handles from 252 to 250, threads stayed at 13, and server CPU advanced by 32.50 seconds. This proves bounded survival and recovery of handles, not leak-free long-duration behavior or maximum capacity.

Read-only status routes remained available. Mutation probes without their explicit-intent headers failed closed: Secrets lock and Permission decision returned 400. The Secrets status response exposed metadata without a literal `value` field.

## Rendered behavior

Desktop Hub:

- 10/10 foundation services healthy.
- 104 dashboards visible and 20 resume routes shown; the complete registry contains 154 tools.
- Command Center appears above the five parent rooms.
- Create, Build, Marketplace & Deployment, Play, and AI Team each opened to the correct room.
- No browser warning or error logs were emitted during the Hub run.

Compact Hub at 390 px: **FAIL**. The document width expanded to 886 px and the primary content was visibly clipped behind the fixed navigation.

Local 3D Game Runtime:

- One live WebGL canvas; no runtime network and no Three.js claim.
- Ready → playing → paused → resumed lifecycle passed.
- PS3 lighting preview selection persisted after resume.
- Reported live evidence: 144 FPS, 53 draw calls, 11,566 triangles; simulation advanced from 18 to 1,114 fixed ticks.
- Five digest-bound local assets and the 10/10 P0 production cell were visible.
- No browser warning/error logs.
- Compact 390 px view had no horizontal overflow; canvas measured about 375 × 574 px.

## Repairs and holds

### P0 — compact Hub usability

Collapse or overlay the navigation below the intended breakpoint, constrain the main grid to the viewport, and add an executable 390 px no-horizontal-overflow check. The current compact Hub is not usable without horizontal panning.

### P1 — accessible form names

The static accessibility audit found 389 definite `FORM_NAME_MISSING` findings across 40 of 153 HTML files. Highest concentrations: AI Team 51, Film & Motion 39, Knowledge Canvas 34, Geographic Market Map 31, Verifier 27, Asset Fabric 27, Asset Vault 26, Prompt Vault 24, Audio Studio 17, and Game Forge 15. Repair labels/accessible names, then make this audit part of normal acceptance.

### P1 — refresh the old Next-50 acceptance contract

`docs/roadmaps/next-50-modules/full-audit.js` still assumes every roadmap module declares zero automatic writes. The current Source Control & Merge Workbench intentionally declares two bounded writes to a separate clean Git working copy and automation branch. Its focused selftest passes 20 checks and refuses live-Workshop mutation, dirty/detached copies, direct main, credentials, deletion, merge, or canon authority. Update the old audit to validate these bounded rules instead of enforcing the obsolete zero-write count.

### P1/P2 — warning debt

- `verify.js` retains 37 warnings, including older lifecycle gaps and game-experience gaps.
- The game library retains disconnect, blocking-overlay, physical-phone, and external-collaborator warnings across the ten packages.
- The broad report identifies 15 manifests without permissions, 20 tools without contracts, 20 without executable selftests, and 121 legacy `UNDECLARED` kinds.
- PS2 Asset Forge emits Node's typeless-package reparsing warning for its vendored Three module.

### UNKNOWN / external evidence still required

- Live substrate runtime test: no installed substrate root was supplied.
- Physical phone/controller behavior and real LAN joins.
- GPU timing/thermals, power draw, and energy/carbon measurements.
- Long unattended soak, suspend/resume, and repeated server restart recovery.
- Independent external conformance for advanced asset outputs/native hosts.

## Shared-workspace receipt

This folder is not a Git worktree. Final snapshot: 5,089 files scanned; 224 changed in 15 minutes; 210 changed in five minutes; one active shared seam, `tools/world-tile-foundry/sources/blank-12288x8192/raster-manifest.json`. The high activity is dominated by the 96-tile world rebuild and normal test-generated outputs.

This steward lane did not patch Workshop product sources. It added the reusable zero-dependency pressure instrument and this receipt; the official tests regenerated their declared indexes/reports/fixtures. Concurrent builder repairs were preserved and reverified instead of overwritten.

