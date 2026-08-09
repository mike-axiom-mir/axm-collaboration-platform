# AXM Game Production Runner CLI

Status: **EXPERIMENTAL**

The v0.1 CLI exposes the runner core without registering it in the Hub or
granting native execution. It can inspect the tracked AXM seams, compile any
supplied JSON spec, execute the inert Proofyard fixture, resume an interrupted
fixture run, and perform an explicitly requested read-only Godot availability
probe. A separate portable-profile demo runs a documentation pipeline through
the same mechanics while keeping the adapter boundary visible. The document
demo uses a deterministic Hand plus a content-inspecting verifier rather than
executor-declared fixture facts.

```powershell
node tools/game-production-runner/cli.js inspect
node tools/game-production-runner/cli.js plan-demo
node tools/game-production-runner/cli.js plan-profile-demo
node tools/game-production-runner/cli.js plan-document-demo
node tools/game-production-runner/cli.js plan --spec D:\candidate\spec.json
node tools/game-production-runner/cli.js run-demo --job-root D:\candidate\runs --run-id proofyard-demo --confirm "RUN GAME PRODUCTION CANDIDATE"
node tools/game-production-runner/cli.js run-demo --job-root D:\candidate\runs --run-id proofyard-demo --resume --confirm "RUN GAME PRODUCTION CANDIDATE"
node tools/game-production-runner/cli.js run-profile-demo --job-root D:\candidate\runs --run-id portable-demo --confirm "RUN PRODUCTION CANDIDATE"
node tools/game-production-runner/cli.js run-document-demo --job-root D:\candidate\runs --run-id document-demo --confirm "RUN PRODUCTION CANDIDATE"
node tools/game-production-runner/cli.js probe-godot --read-only-probe
```

`plan` may honestly return `HELD` when a supplied spec names executors or
verifiers that are not in the v0.1 inventories. The fixture run commands use
inert declarative fixtures, while the document command uses a trusted in-process
deterministic Hand. None can write inside the Workshop. The portable fixture
demo proves reuse of orchestration mechanics, not a universal production
kernel or documentation quality. The document demo proves deterministic content
coverage and digest binding; editorial quality remains human review. Both
portable commands emit `axm.production-step-receipt/v1` ledgers and disclose
that schema in new portable state and terminal receipts. An interrupted
pre-upgrade ledger continues its original game receipt schema without mixing.

The long-range module is intended to become the production intelligence used
to build and evolve an AXM-native engine. This CLI does not claim that engine
exists or that a fixture is a game.
