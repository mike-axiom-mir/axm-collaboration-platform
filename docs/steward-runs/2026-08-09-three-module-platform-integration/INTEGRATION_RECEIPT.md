# AXM capability intelligence trio — platform integration receipt

Date: 2026-08-09  
Human integration authority: Mike Tobi  
Outcome: **installed and discoverable as three `TEST` modules; operational with an explicit cross-contract hold**

## What was integrated

### Module 1 — Human Capability Atlas 0.11.0

Role: source-bound capability discovery, normalization, human-readable Capability Cards, learning paths, registry search/diff, batch production, and complete source-to-receipt verification.

Platform route: `/tools/human-capability-atlas/index.html`  
Engine: `tools/human-capability-atlas/engine`  
Key boundary: real registry materialization is explicit; a complete evidence chain is not runtime proof or Merge Gate approval.

### Module 2 — Human Interface Intelligence 0.6.0

Role: deterministic capability-to-interface recommendations, context validation, decision receipts, Recommendation Assurance, pattern coverage, and advisory evolution/quarantine signals.

Platform route: `/tools/human-interface-intelligence/index.html`  
Engine: `tools/human-interface-intelligence/engine`  
Key boundary: recommendations and assurance never grant execution, persistence, code-change, or canon authority.

### Module 3 — Grounded Evolution Intelligence 0.7.0

Role: reconstructable evidence/event/graph state, grounded diagnosis, candidate needs, signal metabolism, transactional intake rehearsal, and reversible evolution proposals.

Platform route: `/tools/grounded-evolution-intelligence/index.html`  
Engine: `tools/grounded-evolution-intelligence/engine`  
Key boundary: only the cumulative v0.7 body is active. v0.1–v0.6 checkpoints remain rollback lineage and were not merged as parallel truth bodies.

## Integrated flow

```text
Capability declarations / registries
        |
        v
Human Capability Atlas (source truth + human-readable records)
        |
        | native exact gate: BLOCKED
        | bounded adapter: REVIEW_REQUIRED + hashed source sidecar
        v
Human Interface Intelligence (interface recommendation + assurance)
        |
        | advisory observations, quarantine signals, receipts
        v
Grounded Evolution Intelligence (retain -> diagnose -> propose -> human review)
```

## Contract analysis

The packages contain a real same-version identity collision. Module 1 and Module 2 both declare `axm.capability-interface-contract/0.1.0`, but their schema bytes differ:

| Surface | Module 1 SHA-256 | Module 2 SHA-256 | Verdict |
|---|---|---|---|
| Capability record | `c63d2c5d4b0ae7aeb8754a5a006a1efd2364c330ad18b74064d74ec7428a71b3` | `cf5b3d94f6dafcd9b1f2d93e7af9219db5c85f57931ecae7481f27924929a644` | `CONFLICTED` |
| Interface recommendation | `b85e9916f599d2c469b00ea91b12bc3de1e7cd3cceedcd226340fad6dd636e4f` | `90ca0bb938fba5595ef29e8fab8ca18a7c91e1b46b14000456525230a40f4062` | `CONFLICTED` |

Module 1 serializes evidence states in lower case and owns a `knowledge` object; Module 2 requires upper-case evidence annotations and forbids the Module 1-only fields. The native paired gate therefore correctly returns `BLOCKED` and recommendation execution `NOT_RUN`.

The platform adapter does not rename that state to compatibility. It:

1. validates the source against Module 1's schema;
2. projects only fields admitted by Module 2;
3. maps the five declared truth states deterministically;
4. validates the output through Module 2's own shared-contract validator;
5. retains Module 1 `knowledge` and every removed field in a hashed sidecar;
6. labels every adaptation `REVIEW_REQUIRED` and preserves `native_paired_gate=BLOCKED`.

Module 3's supplier adapter expected Module 1 v0.10 and rejects the supplied rooted v0.11 ZIP. The platform adds a non-mutating v0.11 probe that detects the single archive root, verifies the exact outer digest, validates required layout, verifies all three nested digests, and applies path/collision checks. The legacy hold and the upgraded pass are both retained as evidence.

## Evidence route

| Claim | Native proof surface | Verdict | Evidence |
|---|---|---|---|
| Supplied bundles are intact and path-safe | Bundled outer verifiers and exact SHA-256 | `PASS` | Module 1: 14 outer checks; Module 2: clean-bundle verifier; Module 3: 352 indexed files plus nested ZIP safety |
| Installed engines match supplier inventories | Installed-source package/lock verifiers | `PASS` | Module 1: 538 checks; Module 2: dependency lock + registry fingerprint; Module 3: 334 indexed files |
| Deterministic module suites pass locally | Full suites on disposable source copies | `PASS` | Module 1: 133 passed, 2 Windows-only skips; Module 2: 108 passed; Module 3: 41 passed |
| Three modules have valid platform contracts and entries | AXM readiness scanner | `PASS` | All three manifests valid; all three contracts valid; all three entries exist |
| Modules are in public discovery | Generated index and discovery verifier | `PASS` | 214 modules, 1,826 declared capabilities, registry digest `cc9ef549c757d057357e1367bb3b1f2e1785777edc0d5c6ee17d389784d79b6c` |
| Hub entry points are served by the live local Workshop | HTTP requests to the active local server | `PASS` | All three `/tools/.../index.html` routes and `shared/capability-intelligence/status.json` returned HTTP 200 |
| Module 1 v0.11 can be safely admitted to Module 3's platform seam | Root-aware exact-byte probe | `PASS` | `platform-module1-v011-probe.json` |
| Module 1 and Module 2 are natively exact-contract compatible | Module 2 paired gate | `FAIL / HOLD` | `native-module1-module2-paired-gate.json`; no recommendation executed |
| Bounded translation preserves omitted source knowledge | Adapter source/target validation, fixture, and receipt hash | `PASS / REVIEW_ONLY` | `shared/capability-intelligence/selftest.py` |
| Local integration grants public CANON | Human/public promotion gate | `NOT CLAIMED` | All three manifests remain `TEST`; Merge Gate remains `HOLD` |

The full machine-readable test receipt is `verification-receipt.json`, SHA-256 receipt ID `sha256:2d30b87c0752f73f90df1d883674f230a4955761de5d5aafc34502d65dd572dd`.

## Capability-gap receipt

Initial route: `READY` for integrity verification, additive source installation, isolated runtime, platform contracts, and discovery generation.

Discovered contract gap:

- capability: `contract:axm.capability-interface-contract/0.1.0-exact-identity`
- type: `CONTRACT`
- native state: `BLOCKED`
- cheapest honest route: bounded adapter without changing either supplier engine
- adapter state: `TESTED_REVIEW_ONLY`
- unresolved promotion action: approve a versioned contract change or replace one side with byte-identical schema ownership; do not silently reuse `0.1.0`

## Shared-workspace handoff

Lane-owned additions:

- `intakes/tri-20260809`
- `shared/capability-intelligence`
- `tools/human-capability-atlas`
- `tools/human-interface-intelligence`
- `tools/grounded-evolution-intelligence`
- `docs/steward-runs/2026-08-09-three-module-platform-integration`

Shared derived seams regenerated:

- `tools-index.json`
- `registry/modules.json`
- `registry/capabilities.jsonl`
- `registry/proofs.json`
- `registry/public-status.json`

No existing source module, launcher, server route, package manifest, or unrelated user change was reset or reverted. The isolated runtime is `runtime/python/capability-intelligence`; rebuild instructions and its exact dependency lock are in `shared/capability-intelligence`.

Concurrent movement observed outside this lane: `tools/agent-command-center/identity-registry.js` and `tools/agent-command-center/identity-registry-selftest.js` changed while the integration was running. They do not overlap this task's files, and discovery verification passed after those changes. The task-owned lane was stable at final verification. The repository-wide snapshot cannot be called globally stable because the worktree was already extensively dirty and includes unrelated files with future timestamps; those cautions were preserved rather than "cleaned".

## Honest next promotion gate

The modules are usable independently and through the review-only platform adapter now. Promotion beyond `TEST` requires a deliberate contract decision: either publish a new shared-contract version with one authoritative schema family, or update the producer/consumer to byte-identical `0.1.0` ownership and rerun the native paired gate. Until then, adapted recommendations may be inspected and tested but must not be treated as native exact-contract output.
