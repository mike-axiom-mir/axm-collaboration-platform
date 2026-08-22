# AXM AI-Native Game Production Runner — Local Reconnaissance

**Date:** 2026-08-09  
**Intake version:** 0.2.0  
**Decision:** ACCEPT AS `DRAFT_INTAKE` / `TEST-HOLD`  
**Implementation authority:** none granted by this report  
**CANON, install, promotion, and release authority:** false

## Outcome

This intake has earned a distinct AXM module boundary. The live Workshop has
planning, capability knowledge, candidate game authoring, runtime gameplay
contracts, native substrate execution, verification, recovery, resource
governance, and game packaging. It does not have the proposed component that
locks a human outcome, compiles a complete production-package graph, executes
it in isolated candidate jobs, requires independent per-package proof,
assembles only verified outputs, and compares the result with the original
intent.

The proposed module must compose those existing systems without replacing
their authority. Game Organism remains planning. Game Capability Atlas remains
knowledge. Game Forge remains a human-facing project and candidate workspace.
Gameplay Organs retain runtime meaning. Verification Spine retains verdict and
failure-memory authority. Game Hub retains installation and launch boundaries.

## North-star direction

The long-range purpose is larger than automating one engine: provide the
production intelligence through which AI can eventually build, verify, repair,
and evolve an AXM-native game engine.

“Better than Unreal” is an ambition and future comparison horizon, not a
current claim. AXM must eventually define the dimensions in which “better” is
meant—for example AI operability, explicit contracts, reproducibility,
inspectability, repair locality, modular evolution, evidence quality,
local-first control, and human agency—while preserving honest comparison on
rendering, tooling, performance, platform reach, ecosystem, and production
maturity.

The first version remains one deterministic Godot 2D proof because a small
complete production path is stronger foundation evidence than a broad engine
claim.

## Intake seal and static evidence

- Source ZIP: `AXM_AI_NATIVE_GAME_PRODUCTION_RUNNER_LOCAL_INTAKE_v0_2_0.zip`
- ZIP bytes: `59,992`
- ZIP SHA-256: `A9E39AC778F2B8521B7BF3911461CAA1FC7F84EAF2635B5BEFC5FE7FA1A56B50`
- Entries: 42 total; 21 Markdown, 17 JSON, and 4 text files.
- Uncompressed payload: 157,812 bytes; compression ratio 3.2x.
- Unsafe traversal paths: 0. Duplicate normalized paths: 0.
- Executable or binary payloads: 0.
- Package checksum rows independently checked: 41/41 match.
- JSON syntax independently checked: 17/17 parse.
- Sealed example records independently checked: 21/21 digests match.
- Production library: 18 unique packages.
- Production graph: 18 unique nodes and 38 valid edges; acyclic; no missing,
  unknown, or duplicate package references.
- Every package names an executor and verifier; no package appoints the same
  identity as both.
- Fake-done corpus: 15 declared counterexamples.

The ZIP was inspected as data. No intake-supplied prompt, code, installer, or
native process was executed.

## Live Workshop reconciliation

| Existing system | Reuse | Preserved boundary |
|---|---|---|
| Game Organism | assembly-plan input | no runtime authority |
| Game Capability Atlas | coverage and capability planning | knowledge is not execution |
| Game Forge v1.3 | project and candidate handoff | not a universal runner |
| Gameplay Organ v0.1 | runtime gameplay contract | not auto-produced by planning |
| Asset Hands and shared engines | exact executors and reusable artifacts | proof ceilings remain native |
| Godot live executor v1.0.0 | eventual fresh-process adapter | bounded candidate jobs only |
| Verification Spine v2 | receipts, holds, conflicts, failure memory | no averaged universal score |
| Verification Proof Lab v0.3 | claim routing and proof-gap support | no approval or release authority |
| Game Hub | candidate package and launch-contract verification | structure is not full behavior |
| Heartbeat orchestrator | sequencing pattern only | no unattended production runs |
| Body Pulse v0.8 | future explicit resource-lease seam | no file or production authority |
| Recovery Center v0.2 | snapshot and rollback authority | runner does not own recovery |

No exact `game-production-runner` directory, registered module ID, intent-lock
contract, production-package contract, or production-graph contract was found
in the active Workshop. `shared/production-session` is a temporary human/agent
session boundary, and `p1-production-foundation` is a deterministic scenario
lab; neither is the proposed runner.

The intake's public anchor commit is not present as a valid commit object in
this local repository, so commit-to-commit comparison was not possible. The
active local source was inspected directly instead.

## Evidence route

| Claim | Native evidence | Verdict |
|---|---|---|
| The intake container is safe to inspect statically | ZIP inventory, normalized paths, sizes, digest manifest | `PASS` |
| The supplied examples are internally coherent | JSON parse, canonical digests, graph and role checks | `PASS` |
| The schemas fully conform to JSON Schema Draft 2020-12 | Independent standards validator | `UNKNOWN` — no compatible validator is available locally |
| A distinct runner capability is absent locally | live directories, contracts, registry, and exact-term reconciliation | `PASS` |
| The proposal respects existing AXM authority boundaries | intake contracts compared with live module contracts | `PASS` — contract names and permissions still require live adaptation |
| The proposed Godot vertical slice can run now | trusted substrate resolver | `FAIL` — exact Godot substrate reports `MISSING` |
| The frozen rollback root is unambiguously classified | live authority map or explicit human declaration | `UNKNOWN` |
| A branch can safely be cut from the current worktree | shared-workspace status | `FAIL` — the current worktree contains thousands of unrelated changes |

## Capability scout receipt

**Overall route:** `DEGRADED`

- `archive.inspect.static`: available.
- `json.parse`: available.
- `content.digest.verify`: available.
- `graph.topology.verify`: available.
- `workspace.live-source.inspect`: available.
- `schema.jsonschema.draft202012.validate`: missing `HAND/EVIDENCE`.
- `runtime.godot.4.7.1.pinned`: missing `SUBSTRATE`.
- `workspace.rollback-root.classify`: unresolved `AUTHORITY/EVIDENCE`.
- `workspace.branch.isolated`: not yet established `CONTRACT`.

Phases 1 and 2 can proceed after explicit authorization in an isolated
worktree. Phase 3 is blocked until the exact Godot substrate is separately
installed and verified through AXM's explicit substrate gate. No dependency
installation is authorized by this intake.

## Proposed module and branch

Module ID: `game-production-runner`

Suggested leaf layout:

```text
shared/game-production-runner/   portable contracts, compiler, state machine
tools/game-production-runner/    explicit CLI and later human workbench
exports/game-production-runs/    private/candidate run products only
```

Suggested implementation branch:

```text
codex/game-production-runner-v0.1
```

Create it in a separate clean worktree from a reviewed base. Do not switch the
current dirty shared worktree onto it. Registry, Hub, Game Forge, Verification
Spine, and Game Hub files are shared seams and should remain untouched until a
leaf implementation proves its contracts through focused tests.

## Recommended build order

1. Reconcile the eight draft schemas with live AXM vocabulary and choose one
   declared canonical digest codec.
2. Build intent locking, exact bindings, graph validation, and deterministic
   plan receipts without native execution.
3. Build the explicit serial runner against fixture executors in isolated job
   roots, including interruption, cancellation, retry, and cleanup tests.
4. Add independent verifier routing and prove the 15 fake-done fixtures hold.
5. Resolve and verify the exact Godot substrate through its separate human
   gate; then add a complete-project adapter.
6. Build Proofyard, perform headless behavioral checks and fresh-process visual
   proof, assemble a non-installed Game Hub candidate, and compare it with the
   locked intent.
7. Only after that proof, begin the engine-system expansion ladder and define
   measurable AXM-versus-Unreal comparison criteria.

## Remaining gate

This report accepts the direction for TEST planning. It does not start the
implementation. Creating the isolated branch/worktree, installing Godot, or
writing module code requires a separate explicit start from Mike Tobi.
