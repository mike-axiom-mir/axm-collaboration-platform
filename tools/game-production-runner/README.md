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
node tools/game-production-runner/cli.js discover-cache-references --job-root D:\candidate\runs
node tools/game-production-runner/cli.js discover-cache-leases --cache-root D:\candidate\verified-cache
node tools/game-production-runner/cli.js plan-cache-lease-curation --cache-root D:\candidate\verified-cache --minimum-released-age-ms 604800000 --minimum-expired-age-ms 2592000000 --max-curation-candidates 100
node tools/game-production-runner/cli.js apply-cache-lease-curation --cache-root D:\candidate\verified-cache --proposal D:\candidate\lease-curation-proposal.json --approve-proposal SHA256 --explicit-apply
node tools/game-production-runner/cli.js audit-cache-lease-archives --cache-root D:\candidate\verified-cache
node tools/game-production-runner/cli.js inventory-cache --cache-root D:\candidate\verified-cache
node tools/game-production-runner/cli.js plan-cache-retention --cache-root D:\candidate\verified-cache --reference-job-root D:\candidate\runs --max-cache-entries 500 --max-cache-bytes 10737418240 --max-cache-age-ms 2592000000
node tools/game-production-runner/cli.js apply-cache-retention --cache-root D:\candidate\verified-cache --reference-job-root D:\candidate\runs --proposal D:\candidate\retention-proposal.json --approve-proposal SHA256 --explicit-apply
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
Every new graceful interruption also returns `run_checkpoint` and appends the
same sealed `axm.production-run-checkpoint/v1` record to
`run-checkpoints.jsonl`. Repeated interruptions extend that digest chain; a
terminal result still returns the separate terminal `run_receipt`.

`--cache-root` enables verified reuse only for an executor that explicitly
declares `deterministic-v1`. The cache root must be external to both the
Workshop and candidate job root. Every hit is byte-checked and sent through the
current verifier again; prior verifier testimony is never treated as current
evidence. Tampered entries and current-verifier disagreement fall back to fresh
execution and remain visible in the step receipt. Exact invalidation is a
separate command and does nothing without `--explicit-invalidate`. There is no
automatic eviction or cache garbage collection in v0.1.

A cache-enabled run acquires a bounded append-only lease before cache use and
protects each exact key before loading or publishing it. The owner fields are
path-private digests for local continuity, not authentication. Lease duration is
derived to cover cache-hit verification plus executor and verifier fallback for
every remaining attempt and is capped at seven days. Terminal or
graceful-checkpoint evidence releases it. If the
process exits abruptly, the lease remains protective only until expiry; the
same run can renew it during resume. No daemon, heartbeat, or polling task is
created. Run output exposes the sealed release event when one was written.

`plan-cache-lease-curation` is a deletion-free dry run. It considers only
released leases old enough for `--minimum-released-age-ms` and expired leases
old enough for `--minimum-expired-age-ms`, then selects at most the explicit
candidate budget. `apply-cache-lease-curation` requires the saved nested
`proposal`, its exact digest, the same observed cache root, and
`--explicit-apply`. Under the per-lease lock it
stores the complete original JSONL bytes as gzip, chains a sealed cold-archive
receipt, installs a small recovery anchor, and removes only that approved hot
segment. Active or changed leases hold. Reapplying the same proposal can finish
the safe crash window after an anchor was written but source removal did not
finish. Released anchors start a fresh generation; expired anchors preserve the
prior key set for same-run recovery.

`audit-cache-lease-archives` is the explicit heavy path. It walks each receipt
chain, rehashes and decompresses every bounded blob, validates every original
event transition, and emits a path-private audit. Routine
`discover-cache-leases` deliberately checks only the hot anchor, latest receipt,
and cold-blob presence and size, so it cannot claim full cold-byte integrity.

`discover-cache-leases` is bounded and read-only. It emits a sealed, path-free
set whose protection contains only unexpired active leases; released and
expired ledgers remain auditable but grant no authority. An invalid or
over-limit ledger set holds lease-based deletion. `inventory-cache` is read-only
and does not create an absent cache. It embeds the lease set, emits a sealed,
path-free inventory of exact cache layouts, and holds on unclassified or
actively publishing content. `discover-cache-references` is also read-only and
bounded. It derives a sealed, path-private protection set only from complete
terminal receipts or the latest exact graceful checkpoint. Checkpoint histories
must be append-only, bind every historical ledger prefix, and end at the current
step-ledger count and tail. Uncheckpointed progress, tampered or truncated
checkpoints, linked or mixed-schema ledgers, contradictory entry digests, and
over-limit observations hold the set. A bad terminal receipt cannot fall back
to older checkpoint evidence. `plan-cache-retention` adds independent entry,
logical-byte, and observed filesystem-age budgets. It can combine repeatable manual
`--protect-key` values with `--reference-job-root`; discovered bindings include
the exact cache key and entry digest. Its output performs no deletion. Save
only the nested `proposal` object to a JSON file. `apply-cache-retention`
rereads that file and both roots, refuses a stale cache, reference, or lease
snapshot, and deletes only when `--explicit-apply` and the proposal's exact
digest are supplied. Each final deletion is coordinated per key with runner
lease protection. The sealed application receipt includes the fresh reference
and lease snapshots, each selective invalidation digest, and post-delete usage.
No discovery, retention policy, lease renewal, or deletion runs in the
background. Direct `invalidate-cache` remains a distinct explicit human
override. Cold lease archives are append-only and never automatically deleted;
their storage and full-audit cost can still grow.

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
