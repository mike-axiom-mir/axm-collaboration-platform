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
node tools/game-production-runner/cli.js run-document-demo --job-root D:\candidate\runs --cache-root D:\candidate\verified-cache --run-id cached-document --confirm "RUN PRODUCTION CANDIDATE"
node tools/game-production-runner/cli.js invalidate-cache --cache-root D:\candidate\verified-cache --cache-key SHA256 --explicit-invalidate
node tools/game-production-runner/cli.js inventory-cache --cache-root D:\candidate\verified-cache
node tools/game-production-runner/cli.js plan-cache-retention --cache-root D:\candidate\verified-cache --max-cache-entries 500 --max-cache-bytes 10737418240 --max-cache-age-ms 2592000000 --protect-key SHA256
node tools/game-production-runner/cli.js apply-cache-retention --cache-root D:\candidate\verified-cache --proposal D:\candidate\retention-proposal.json --approve-proposal SHA256 --explicit-apply
node tools/game-production-runner/cli.js probe-godot --read-only-probe
node tools/game-production-runner/cli.js probe-hand-confinement --explicit-probe
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

`--cache-root` enables verified reuse only for an executor that explicitly
declares `deterministic-v1`. The cache root must be external to both the
Workshop and candidate job root. Every hit is byte-checked and sent through the
current verifier again; prior verifier testimony is never treated as current
evidence. Tampered entries and current-verifier disagreement fall back to fresh
execution and remain visible in the step receipt. Exact invalidation is a
separate command and does nothing without `--explicit-invalidate`. There is no
automatic eviction or cache garbage collection in v0.1.

`inventory-cache` is read-only and does not create an absent cache. It emits a
sealed, path-free inventory of exact cache layouts and holds on unclassified or
actively publishing content. `plan-cache-retention` adds independent entry,
logical-byte, and observed filesystem-age budgets plus repeatable
`--protect-key` references; its output performs no deletion. Save only the
nested `proposal` object to a JSON file. `apply-cache-retention` rereads that
file and the cache, refuses a stale snapshot, and deletes only when both
`--explicit-apply` and the proposal's exact digest are supplied. The sealed
application receipt includes each selective invalidation digest and post-delete
usage. No policy is persisted or scheduled, and live references are protected
only when their exact keys are supplied by the caller.

`probe-hand-confinement` is diagnostic and must be requested explicitly. It
creates and removes a disposable operating-system temporary root and opens only
an ephemeral local-loopback listener. The command exits `2` when any required
denial fails or is unknown. The supported local Node 24 runtime currently emits
a sealed `DEGRADED` receipt because loopback networking is allowed; activation
therefore remains `HOLD`. The probe never installs a runtime, executes supplied
code, grants Hand authority, or claims that Node permission mode is a
malicious-code sandbox.

The long-range module is intended to become the production intelligence used
to build and evolve an AXM-native engine. This CLI does not claim that engine
exists or that a fixture is a game.
