# Waldo / Mirror Code Fabric bridge experiment v0.1

Status: `EXPERIMENTAL / DETACHED / NOT CANON`

This experiment uses the existing public Code Capability Fabric in its native repository rather than copying or modifying the donor implementation. The branch starts from platform `main` commit `fd6ec98a6a98a6666a980c359730ccec57a8cbe9`.

## Question

Can one sealed concept be translated through the same deterministic Fabric into several structurally different inert bodies while preserving one ancestor reference and the Fabric's existing truth/authority boundaries?

The default challenge creates three blueprint bodies:

1. `evidence-trail-mini-game` — a tiny game-mechanic contract;
2. `continuity-diagnostic-tool` — a read-only continuity diagnostic contract;
3. `lineage-how-to-guide` — a tutorial/how-to contract.

Each body is passed through the existing `declarative-blueprint-composer-v1` and `blueprint-schema-compiler-v1`. Different body blueprints must keep the same concept digest, remain permissionless, leave desired outcomes `UNPROVEN`, and produce acceptance matrices whose cases remain `UNRUN`.

## AI opt-in lane

AI is not a hidden dependency. The default run does not load an AI proposal.

An explicit `--ai-opt-in <proposal.json>` may add one externally proposed body. The checked example was authored as an AI proposal for a tool-episode quarantine bridge. The proposal still passes through the exact same deterministic Fabric composer and schema compiler as every deterministic body.

The harness itself performs no live model call. A later Waldo/Mirror runtime may provide an AI proposal through the same file/contract seam. AI proposes; Fabric validates and composes.

## Private Organ Factory boundary

The Organ Factory is intentionally absent because it is not in the public GitHub donor at this checkpoint. The experiment receipt records:

```text
included: false
availability: NOT_PUBLIC_IN_DONOR
effectOnThisResult: NONE
```

When a public or otherwise explicitly supplied donor snapshot becomes available, the same challenge can be rerun with an Organ Factory provider and compared against this baseline.

## Donor bytes

The harness records the exact platform commit and Git blob IDs for the Code Fabric router, grounded-consent scope, slow-creation pilot, declarative blueprint composer, schema compiler, and deterministic JSON core. The donor files are not edited by this experiment.

## Run

Deterministic default:

```bash
node experiments/waldo-mirror-code-fabric-bridge-v0.1/selftest.js
```

Explicit AI-proposal lane:

```bash
node experiments/waldo-mirror-code-fabric-bridge-v0.1/selftest.js \
  --ai-opt-in experiments/waldo-mirror-code-fabric-bridge-v0.1/ai-proposal.example.json
```

A runner may add `--output <new-path>` to write a no-overwrite JSON receipt.

## Truth ceiling

This experiment proves only deterministic composition/replay properties if the runner passes. It does not prove that any generated blueprint is a good game, useful diagnostic, correct tutorial, safe training recipe, or executable implementation. It generates no executable code, performs no installation, grants no runtime authority, admits no persistent learning, changes no machine default, and makes no CANON decision.
