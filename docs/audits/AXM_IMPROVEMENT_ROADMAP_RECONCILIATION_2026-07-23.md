# AXM 100-Item Improvement Roadmap Reconciliation

Date: 2026-07-23  
Scope: local workshop only; no GitHub operation  
Roadmap source SHA-256: `B9DBAB89CAE461E83E8D5D4AE94EA8F7DA9818F745FDE85754B2DCB3BE47921B`

## Executive result

The roadmap was reconciled against the live tree before changes. Its counts were a useful snapshot, but several premises were already stale. This pass implemented the safe, cross-cutting foundations that could be proved without fabricating contracts or widening authority: a promotion/readiness model, live tool and capability index, bounded selftest runner, target manifest schemas, stronger module template, machine-readable verification, world-registry validation, Evidence Desk contract, repository/security/navigation documentation, and truthful daily/a11y audit commands.

No tool was automatically promoted. No destructive wipe, automatic archive, bulk contract generation, vendored-library deduplication, OS scheduling, or GitHub action was performed.

Live inventory after the pass:

- 145 tool manifests: 73 EXPERIMENTAL, 70 TEST, 1 SHELL, 1 WORKING.
- 125 contracts present; 121 pass the current contract verifier.
- 117 tools have some selftest; 28 still have none.
- 129 manifests declare permissions; 16 still omit them.
- 2 manifests use the new `kind` field; 143 remain an explicit migration backlog.
- 55 tools have a README.
- 857 declared/contract capabilities are represented in the generated index.
- 42 top-level TEST selftests passed in the bounded promotion run; zero tools currently satisfy every promotion prerequisite.
- Static accessibility baseline: 378 definite findings in 38 of 145 directly scanned tool pages.

## Verdict meanings

- **IMPLEMENTED** — completed in this pass and directly verified.
- **IMPROVED / PARTIAL** — useful, verified progress exists, but the roadmap's whole outcome is not proven.
- **ALREADY SATISFIED** — the live tree already contained the capability; a source/test receipt is retained below.
- **PRESERVED HOLD** — the limitation is real and remains visible; weakening the requirement would create a false green.
- **DEFERRED — AUTHORITY** — requires Mike's policy, destructive-action, scheduling, archive, release, or promotion decision.
- **DEFERRED — MIGRATION** — valid work, but unsafe to apply as an automatic bulk rewrite without owner-specific evidence.
- **CLARIFIED / REJECTED PREMISE** — the proposed claim would be inaccurate for the current architecture.

## Item-by-item reconciliation

| # | Verdict | Result, evidence, or reason |
|---:|---|---|
| 1 | IMPLEMENTED | Exact EXPERIMENTAL → TEST → WORKING → CANON prerequisites now live in `shared/readiness/promotion-ladder.json` and `docs/STATUS_LADDER.md`; automatic promotion is explicitly false. |
| 2 | IMPLEMENTED | `scripts/generate-tools-index.js --verify` produces a promotion queue and bounded timing receipts. The evidence run used 2 workers/45 s timeout: 42 PASS, 0 non-pass, 0 ready for human review. |
| 3 | IMPROVED / PARTIAL | `main-hub` is now explicitly `kind: scaffold`, remains SHELL, and is mapped in `docs/HUB_MAP.md`. Finishing or archiving it is a Mike decision. |
| 4 | IMPROVED / PARTIAL | Target schema and template support nullable `verifiedAt`; `prehub` truthfully remains null because its WORKING claim lacks a current local selftest. No timestamp was fabricated. |
| 5 | IMPROVED / PARTIAL | Target schema distinguishes product/service/scaffold/adapter/machine-capability. Template, `main-hub`, and `prehub` were seeded; 143 legacy manifests remain visible. |
| 6 | DEFERRED — AUTHORITY | A WORKING-ratio target and deadline are product/governance choices, not facts discoverable from the tree. |
| 7 | IMPROVED / PARTIAL | The live index proves the exact 28-tool no-selftest backlog. Existing shared behavioral coverage is retained; empty wrapper selftests were not fabricated. |
| 8 | IMPROVED / PARTIAL | Evidence Desk and prehub gained verified, owner-accurate contracts; missing-contract count fell 22 → 20. The remaining 20 require owner-by-owner modeling. |
| 9 | DEFERRED — MIGRATION | The monolithic top-level test chain remains. Splitting it changes operational/test ownership across many modules and was not safe as a drive-by rewrite. |
| 10 | IMPROVED / PARTIAL | Promotion selftests now run with bounded parallel workers, per-test duration, digest, timeout, and failure tail. The complete `npm test` remains deliberately ordered. |
| 11 | DEFERRED — MIGRATION | Coverage requires a coverage engine, thresholds, and instrumentation policy. No dependency was downloaded merely to improve a metric. |
| 12 | DEFERRED — AUTHORITY | The locked `SPINE_SHA` is a governance invariant. Existing spine verification passes; changing its ownership or gate requires an explicit charter decision. |
| 13 | IMPLEMENTED | `_module-template/discovery-seam-review.js` is now included and passes, so new modules start with an executable discovery seam. |
| 14 | IMPROVED / PARTIAL | `verify.js` now checks the generated manifest inventory and exposes completeness backlogs. The v1 target schema is strict; legacy manifests are warnings until migrated. |
| 15 | IMPLEMENTED | `scripts/package-script-path-selftest.js` resolves all 173 JavaScript paths referenced by package scripts and passes. |
| 16 | IMPLEMENTED | `verify.js` now writes `exports/verify-report.json` using `axm.verify-report/v1`; current receipt is PASS, 354 passes, 0 failures, 35 warnings. |
| 17 | DEFERRED — MIGRATION | All manifests declare `uses`, but converting vocabulary into enforceable provider/consumer API gates requires an owned capability-map migration. The live index now exposes the edges. |
| 18 | IMPROVED / PARTIAL | New schema/template require permissions; prehub and main-hub were corrected. The verifier exposes the remaining 16 rather than guessing empty permissions. |
| 19 | DEFERRED — AUTHORITY | Suitcase export is explicitly human-triggered under the Trust Charter. Automating the one-button path changes authority and release behavior. |
| 20 | DEFERRED — AUTHORITY | The Goodbye Path is destructive device-wide work. No wipe implementation or destructive test was authorized. |
| 21 | IMPROVED / PARTIAL | Tool IDs and world IDs now receive deterministic duplicate checks; save/pack namespace collision policy still needs a broader owned design. |
| 22 | IMPROVED / PARTIAL | Existing `verify.config.json` failure memory remains active and tested. Turning it into an automatically maintained living ledger needs retention/retirement policy. |
| 23 | IMPROVED / PARTIAL | Sensorium coordinator/selftests prove handoff without permission transfer and lease inheritance for that subsystem. A system-wide authority audit remains broader work. |
| 24 | IMPROVED / PARTIAL | `scripts/accessibility-static-audit.js` establishes a reproducible static baseline: 378 definite issues in 38 files. It fails honestly; it does not claim WCAG/live keyboard proof. |
| 25 | IMPLEMENTED | New-module template now uses a 16 px base, 44 px controls, visible focus styling, and explicit form labels. Contrast/live assistive-tech proof remains per module. |
| 26 | IMPROVED / PARTIAL | Static audit detects unnamed controls, missing labels, and pointer-only inline controls. Real keyboard journeys still need browser-level tests. |
| 27 | DEFERRED — MIGRATION | Vulnerability scanning requires a chosen advisory source/tool and network/cache policy. No library was downloaded. |
| 28 | DEFERRED — MIGRATION | Vendored integrity needs an authoritative library inventory and owner-approved hashes before enforcement. |
| 29 | IMPLEMENTED | `docs/PORTS.md` records bind address, purpose, and override. It also preserves the intentional Game Hub `0.0.0.0:8789` LAN exception instead of falsely claiming loopback-only. |
| 30 | IMPLEMENTED | Root `.gitignore` now covers dependencies, runtime state/saves/logs/backups/exports, secrets, bridge artifacts, overrides, and temp noise. |
| 31 | IMPLEMENTED | `SECURITY.md` documents environment keys, bridge tokens, no-key honesty, optional egress, and the port map. |
| 32 | CLARIFIED / REJECTED PREMISE | The core has explicit optional network routes, so a blanket zero-egress claim would be false. `SECURITY.md` states the narrower offline-first/default-deny boundary. |
| 33 | IMPROVED / PARTIAL | The live root contained 9—not 18—`PATCH*` files. All 9 were moved to `docs/history/patches/`; other root reports need human classification before relocation. |
| 34 | DEFERRED — MIGRATION | Forge/vault consolidation affects ownership, storage, and compatibility. A name similarity scan is insufficient evidence for merging modules. |
| 35 | DEFERRED — MIGRATION | Deduplicating `three.module.js` changes package/runtime path assumptions. It needs consumer mapping and compatibility tests first. |
| 36 | IMPLEMENTED | `docs/HUB_MAP.md` distinguishes hub server, main-hub scaffold, prehub workspace, Game Hub, and related child roles. |
| 37 | DEFERRED — AUTHORITY | Creating an archive convention is harmless; deciding which live tools are retired is not. No module was archived without Mike. |
| 38 | IMPLEMENTED | Root `tools-index.json` lists all 145 tools, status, structural readiness, contract/selftest evidence, permissions, kind, and 857 capability edges. |
| 39 | IMPROVED / PARTIAL | New module template includes a README. Existing coverage is 55/145; mass-generated README text would not prove owner intent. |
| 40 | DEFERRED — MIGRATION | Detecting narrative/contract contradiction needs a defined semantic rule set; plain string matching would create unreliable evidence. |
| 41 | IMPLEMENTED | `docs/README.md` declares `docs/` canonical and `docs/from-github/` imported reference material. |
| 42 | IMPLEMENTED | `docs/CONTRIBUTING_SEAMS.md` gives future AIs the evidence-first, no-auto-authority, template, test, and promotion workflow. |
| 43 | IMPLEMENTED | `docs/STATUS_LADDER.md` is the canonical human-readable status/promotion guide. |
| 44 | IMPROVED / PARTIAL | New governance/audit docs are dated and limitations are explicit. Existing long-lived docs were not mass-stamped without owner review. |
| 45 | PRESERVED HOLD | Eye remains `WINDOWS_WINDOW_ISOLATION_UNAVAILABLE`; `shared/sensorium/roadmap-status.json` and Sensorium tests preserve the host limitation. No weaker selection rule was substituted. |
| 46 | PRESERVED HOLD | Drift detector still needs a real same-seat reviewed baseline. Its updater only proposes; no synthetic baseline was promoted. |
| 47 | IMPROVED / PARTIAL | `scripts/daily-verification.js` runs verifier + Sensorium retention and writes dated JSON. Receipt says `schedulerInstalled:false`; no OS task was installed. |
| 48 | ALREADY SATISFIED | `shared/sensorium/automation/parity-guard.js` plus `shared/sensorium/selftest.js` already verify canonical/generated skill parity. |
| 49 | ALREADY SATISFIED | `shared/sensorium/coordinator.js` and its selftest already prove shared-clock composition, closeout, stale holds, and no permission transfer. |
| 50 | ALREADY SATISFIED | `shared/sensorium/registry.json` contains 8 canonical senses; retention conformance reports 8/8, 7 executable + 1 honest host-mediated route. |
| 51 | ALREADY SATISFIED | `shared/technical-glasses/technical-glasses-core.js` already emits stable `axm.technical-glasses/v1`; shared and UI selftests pass. |
| 52 | DEFERRED — MIGRATION | Skill/shared-handoff coexistence needs an ownership/compatibility decision; deleting or merging either from naming evidence would be unsafe. |
| 53 | ALREADY SATISFIED | `/api/workshop/capabilities` and the shared capability index already exist. This pass additionally exports 857 provider/consumer declarations through `tools-index.json`. |
| 54 | DEFERRED — MIGRATION | A cross-AI seat registry overlaps identity/profile/Sensorium ownership and privacy. It needs explicit schema and retention decisions. |
| 55 | DEFERRED — MIGRATION | Sensorium has a canonical receipt envelope, but system-wide standardization must reconcile Evidence Desk, operations, release, and other schemas without erasing provenance. |
| 56 | IMPROVED / PARTIAL | Existing verifier keeps 110 historical package spines outside the active canon lock. DOM walking now skips generated state/export/log/history surfaces; no evidence was deleted. |
| 57 | ALREADY SATISFIED | `shared/operations/wave2-selftest.js` behaviorally proves source connector, media render, living-world, multiplayer, and public-release paths (38 PASS). Folder-local discoverability remains uneven. |
| 58 | DEFERRED — MIGRATION | No fresh two-build identical workshop-package receipt was produced; deterministic packaging requires a bounded target and normalized timestamp policy. |
| 59 | IMPROVED / PARTIAL | Existing START_HERE/packager material and `docs/DEPENDENCIES.md` describe local installation constraints. A clean-machine portable release smoke test is still needed. |
| 60 | IMPROVED / PARTIAL | Verification now excludes generated/history-heavy DOM roots and reuses a structural tool index. A true changed-tools incremental test planner is not yet implemented. |
| 61 | IMPROVED / PARTIAL | Accessibility baseline exists; per-tool load/bundle budgets and representative runtime measurements remain undefined. |
| 62 | DEFERRED — MIGRATION | Hub discovery indexing requires server/UI ownership changes and measurements; raw tool count alone does not prove a performance defect. |
| 63 | DEFERRED — MIGRATION | Lazy loading of wasm-vips/three.js needs runtime network/module observations. Static presence is not proof of eager loading. |
| 64 | IMPROVED / PARTIAL | `docs/DEPENDENCIES.md` records 3 direct dependencies, lockfile/offline-cache truth, and no automatic download/audit. Vendoring policy remains a decision. |
| 65 | IMPLEMENTED | `package.json` now pins supported Node range `>=20 <25`; current runtime is Node 24.17.0. |
| 66 | DEFERRED — MIGRATION | Adding lint/format tooling would introduce dependencies and mass formatting risk; no style migration was authorized. |
| 67 | DEFERRED — AUTHORITY | User explicitly requested local-first and GitHub later. No CI workflow or push was created in this pass. |
| 68 | IMPROVED / PARTIAL | `docs/RETENTION.md` inventories current runtime areas and explicitly says no automatic deletion/rotation exists. Durations need owner policy. |
| 69 | IMPROVED / PARTIAL | Versioned schemas exist across subsystems and new readiness/world schemas were added. A single save-version promise needs owner-by-owner migration evidence. |
| 70 | IMPROVED / PARTIAL | `docs/RETENTION.md` documents the current backups gap and restore boundary. No backup was removed or declared restorable without a drill. |
| 71 | ALREADY SATISFIED | Hub manifest/audience machinery and hub-shell already distinguish machine- and human-audience modules; current contract roadmap selftests pass. |
| 72 | DEFERRED — MIGRATION | A live health banner needs Hub UI/API ownership and browser verification; writing a static badge would create stale truth. |
| 73 | DEFERRED — MIGRATION | “Since last opened” requires trustworthy `verifiedAt`/change-state adoption and user-local persistence. The target field now exists but legacy adoption does not. |
| 74 | DEFERRED — MIGRATION | Shared empty/error states require a visual component contract and live regression pass across independent tools. |
| 75 | ALREADY SATISFIED | Game experience recovery remains in `verify.config.json` failure memory and passes its dedicated selftest; automatic periodic execution remains uninstalled. |
| 76 | ALREADY SATISFIED | Living-world and multiplayer behavior are covered in the 38-check operations wave. Local selftest files were not fabricated solely to satisfy folder counts. |
| 77 | DEFERRED — MIGRATION | Foundation-planet decomposition changes fixture lifecycle and assertion grouping; it needs an owner-led test refactor. |
| 78 | IMPLEMENTED | `worlds/world-registry.schema.json` and `worlds/world-registry-selftest.js` validate both worlds and reject duplicate IDs/paths. |
| 79 | DEFERRED — MIGRATION | Same multi-owner schema reconciliation as item 55; present variation was documented, not hidden. |
| 80 | DEFERRED — AUTHORITY | A global audit timeline entails cross-subsystem retention, privacy, and access choices. No receipts were silently centralized. |
| 81 | IMPLEMENTED | `tools/evidence-desk/module.contract.json` now records its read-only machine behavior and explicit download/save boundaries; verifier and selftest pass. |
| 82 | DEFERRED — MIGRATION | “Unsourced observation” is correctly enforced inside Evidence Desk. Shared lint needs a canonical cross-tool receipt envelope first. |
| 83 | DEFERRED — MIGRATION | Restart/resume proofs require owner-specific durable-state contracts. A generic wrapper test would not prove recovery. |
| 84 | IMPROVED / PARTIAL | New readiness and world validators include negative mismatch/duplicate cases; a general corrupt-file/bad-port chaos suite remains broader work. |
| 85 | DEFERRED — MIGRATION | Bridge no-key behavior is not currently exposed as a safe importable test seam. It needs a bridge refactor, not a brittle launcher wrapper. |
| 86 | IMPROVED / PARTIAL | Sensorium negotiation and existing readiness guidance preserve missing-capability holds. A system-wide fallback/refusal contract is not yet canonical. |
| 87 | IMPROVED / PARTIAL | v1 schema/template/index expose the two-generation migration explicitly. Legacy manifests remain compatible and visible. |
| 88 | IMPROVED / PARTIAL | New manifests must match folder ID. Legacy `hermes`/`hermes-local` remains through explicit `folderAlias` because canonical references use `hermes-local`; blind rename was rejected. |
| 89 | IMPROVED / PARTIAL | JSON Schemas plus deterministic validators now cover target tool manifests, tool index, and world registry. Full legacy schema migration remains. |
| 90 | DEFERRED — MIGRATION | Status vocabulary now has a canonical ladder, but rewriting legacy statuses requires per-tool evidence and Mike's promotions. |
| 91 | IMPLEMENTED | Moved the 9 actual root `PATCH*` files to `docs/history/patches/`. They are recoverable by moving them back; nothing was deleted. |
| 92 | IMPLEMENTED | Same `.gitignore` result as item 30. |
| 93 | IMPLEMENTED | Same Node engine result as item 65. |
| 94 | IMPLEMENTED | Same generated live `tools-index.json` result as item 38, with deterministic structural source digest. |
| 95 | IMPLEMENTED | Root `INDEX.txt` points to the five canonical entry documents and live verification/index commands. |
| 96 | PRESERVED HOLD | `prehub` and `main-hub` have `verifiedAt:null`; neither has sufficient current proof for a truthful timestamp. |
| 97 | IMPLEMENTED | Same JSON verification receipt result as item 16. |
| 98 | ALREADY SATISFIED | Sensorium parity guard is already in `test:sensorium`; the full command passed all P0–P8 and retention checks. |
| 99 | IMPLEMENTED | Same centralized `docs/PORTS.md` result as item 29. |
| 100 | IMPROVED / PARTIAL | `npm run check:daily` is available and produces a dated receipt, but OS scheduling was intentionally not installed; receipt records that fact. |

## Verification receipts

- `npm.cmd test` — PASS, exit 0. This includes verify/readiness, operations, Physics Core, Asset Hands completion/upgrades, and workspace suites.
- `npm.cmd run verify` — PASS, 0 failures and 35 warnings; warnings remain visible backlog.
- Bounded promotion run — 42/42 top-level TEST selftests PASS with 2 workers and 45 s timeout.
- `npm.cmd run test:sensorium` — PASS; 9/9 phases, 8/8 canonical senses, promotion at Mike gate.
- `node shared/operations/wave2-selftest.js` — PASS, 38 checks.
- `node shared/operations/roadmap-selftest.js` — PASS, 225 checks across 20 modules.
- Template, package path, readiness, world registry, Evidence Desk, and module-contract-verifier selftests — PASS.
- Static accessibility audit — expected non-zero exit with 378 definite findings; this is a baseline/backlog receipt, not a compliance certificate.

## Safe next tranche

The highest-value next work is owner-specific rather than bulk: fix the 38 accessibility-affected tool pages in bounded batches, migrate legacy manifests as each tool is touched, add honest local selftests/contracts only where behavior can be proved, and establish a real reviewed drift baseline. Archive/destructive/CI/scheduler/promotion decisions remain with Mike.
