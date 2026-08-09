# AXM Game Production Runner CLI

Status: **EXPERIMENTAL**

The v0.1 CLI exposes the runner core without registering it in the Hub or
granting native execution. It can inspect the tracked AXM seams, compile any
supplied JSON spec, execute the inert Proofyard fixture, resume an interrupted
fixture run, and perform an explicitly requested read-only Godot availability
probe.

```powershell
node tools/game-production-runner/cli.js inspect
node tools/game-production-runner/cli.js plan-demo
node tools/game-production-runner/cli.js plan --spec D:\candidate\spec.json
node tools/game-production-runner/cli.js run-demo --job-root D:\candidate\runs --run-id proofyard-demo --confirm "RUN GAME PRODUCTION CANDIDATE"
node tools/game-production-runner/cli.js run-demo --job-root D:\candidate\runs --run-id proofyard-demo --resume --confirm "RUN GAME PRODUCTION CANDIDATE"
node tools/game-production-runner/cli.js probe-godot --read-only-probe
```

`plan` may honestly return `HELD` when a supplied spec names executors or
verifiers that are not in the v0.1 fixture inventory. `run-demo` is the only
execution command in this version. It cannot write inside the Workshop.

The long-range module is intended to become the production intelligence used
to build and evolve an AXM-native engine. This CLI does not claim that engine
exists or that a fixture is a game.
