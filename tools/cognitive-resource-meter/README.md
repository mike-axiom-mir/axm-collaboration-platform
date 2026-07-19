# Cognitive Resource Meter

Status: `TEST`

Cognitive Resource Meter is the Workshop's dependency-free producer for privacy-safe, machine-bound cognitive-work receipts and separated resource/economics evidence. It validates and archives evidence; it does not calculate or certify Mirror results.

## Hub route

Open **Hub -> Build -> Cognitive Resource Meter**. Five technical children live behind it instead of becoming everyday Hub cards:

- Cognitive Evidence Explorer
- Cognitive Calibration & Benchmark Lab
- Human Attention Ledger
- Sustainability Metrology Lab
- Mirror Intake Monitor

## Operator tools

- Guided, explicit Codex goal-completion receipt import with preview and hold explanations.
- Explicit local Workshop-server process window meter using native elapsed, CPU, and RSS counters. It reports partial whole-process coverage, never isolated task compute or accelerator use.
- Privacy-safe Model, Toolchain, Environment, Hardware, and meter-definition profile vaults.
- Versioned rate-schedule vault for the three separate accounting modes.
- Separate-dimension timeline for tokens, compute, time, money, energy, carbon, and verification; no composite score.
- Dependency-free ZIP evidence bundles containing exact selected records, contract copies, provider declarations, and a truth manifest.
- Exact exports for both copied, digest-bound Mirror draft contracts.
- Append, supersede, archive, and restore continuity over a content-addressed private ledger.

Missing values remain `null` or `UNKNOWN`. Prompts, responses, hidden reasoning, secrets, identities, private memories, and content snapshots are refused.

## Providers and additive catalogs

The catalog requires five provider IDs but permits future additive providers. Provider IDs must be unique and every provider must keep `automaticCapture: false`.

The Command Center control catalog follows the same rule: required IDs, unique IDs, no automatic controls, and zero authority. Workshop Direction is included as its deterministic planner with open, status, preview, explicit commit, and lifecycle controls. Its TEST presentation owner is `workshop-command-center`; mutating controls still open their specialist room instead of running from an underspecified generic button.

## Permission and storage

Evidence mutation requires `cognitive.evidence.write`; explicit native process measurement requires `cognitive.measure.local`. Every mutation route also requires its exact action header. Permission holds validate but archive nothing.

- Meter state: `state/cognitive-resource-meter/`
- Lab state: `state/cognitive-evidence-labs/`
- Explicit exports: `exports/cognitive-resource-meter/`

## Verification

```text
npm.cmd run test:cognitive-resource
npm.cmd test
node shared/technical-glasses/technical-glasses-cli.js --focus="cognitive resource evidence" --write --json
```

Claim ceiling: `TEST_MACHINE_BOUND_COGNITIVE_RESOURCE_AND_ECONOMICS_PROFILE_PRODUCER`
