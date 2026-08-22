# AXM Challenge Arena v0.6.0

Local-first, artifact-neutral multi-AI challenge orchestration for AXM.

The Arena gives the same locked challenge to multiple AI or human seats, preserves independent attempts, runs deterministic support checks, assigns blind peer review, surfaces dissent and evidence gaps, proposes merge opportunities, and stops before human authority.

It is a reusable module. Asset Factory, Workshop, Game Builder, video, research, documents, specialist Mirrors, deterministic workers, and future AXM branches can all use the same challenge protocol without being collapsed into the Arena.

## v0.6 focus

v0.6 is a failure-first portability and observer-boundary repair. It preserves the v0.5 challenge wire contract and scoring semantics rather than fabricating a new challenge format.

The main v0.6 changes are:

- **ZIP-order-independent evidence verification.** Canonical event verification now sorts event members before both parsing and filename binding. Repacking an otherwise identical evidence ZIP no longer creates a false integrity failure merely because member order changed.
- **Public progress is count-only.** The observer `/api/progress/...` route no longer exposes per-seat completed/missing lists, per-label coverage maps, or task identities. The local Python API `progress()` remains detailed for trusted adapters.
- **Public integrity is forensic-safe.** The observer exposes validity and aggregate counts, while detailed integrity errors stay in the local CLI/Python API because those errors can contain participant, task, artifact, review, or filesystem identifiers.
- **Public lineage is identity-safe.** Observer lineage keeps topology and counts but seals copied participant ids, operator ids, selected blind labels, and lineage input path details.
- **Observer exceptions fail private.** HTTP error responses no longer echo raw exception text.
- **Additional browser isolation headers.** The local observer now sends same-origin resource/opener policy and disables legacy cross-domain policy files in addition to its existing CSP and privacy headers.
- **Reusable portability audit.** `tools/audit_bundle_portability.py` creates deterministic randomized ZIP repacks and verifies that transport ordering cannot alter semantic validity.

No vote, receipt, observer route, or verifier result gained merge authority. v0.5 remains the immediate rollback point.

## v0.5 foundation retained

v0.4 made the Arena substantially harder against false-but-self-consistent evidence and added durable seat tasks. The v0.5 audit attacked a different class of failures: identity inference, stale concurrent revisions, semantically misbound task receipts, reviewer dependence, and corrupted bridge state.

The main v0.5 changes are:

- **Opaque committed blind aliases.** New v0.5 rounds use deterministic HMAC-derived aliases such as `Candidate-7f3a...` rather than a predictable `Candidate-01` sequence. The mapping is committed before review and reproducible after the blind seed is revealed.
- **Own-alias withholding.** A reviewer does not receive the alias of their own candidate in a v0.5 review packet.
- **Live observer anti-inference.** While review is open, public state exposes aggregate blind coverage/counts rather than the complete alias set, so a reviewer cannot recover their own alias by set subtraction.
- **No-reveal result privacy.** When `reveal_authors_after_close=false`, reviewer IDs and declared group names remain sealed in public synthesized diagnostics as well as raw reviews.
- **Exact revision preconditions.** Replacing a submission or review in a v0.5 round requires the exact currently-active prior revision ID. Stale workers fail instead of silently winning a last-writer-wins race.
- **Semantic orchestration binding.** A completed BUILD or REVIEW task must resolve to the correct real participant record, active revision, hash, and completed attempt. A valid-looking task receipt pointing at somebody else's valid artifact is rejected.
- **Stronger task receipts.** Task receipts additionally commit to attempt history, completion history, and active lease state.
- **Declared reviewer-independence evidence.** Participants may declare an `independence_group`. A locked policy can require a minimum number of distinct declared groups per candidate. Failure withholds readiness; it does not secretly change candidate scores.
- **Reviewer-convergence diagnostics.** Near-identical score vectors are surfaced as evidence. They are never automatically treated as collusion and never automatically penalized.
- **Corrupt bridge receipts fail closed.** A malformed existing `IMPORT-RECEIPT.json` is visible corruption, not silently equivalent to no receipt.
- **v0.4 replay compatibility.** A locked v0.4 packet keeps its historical sequential blind-label algorithm and reviewer-own-label behavior. v0.5 does not retroactively fabricate new evidence for old rounds.

## Core flow

```text
producer module / human challenge
            |
            v
      locked challenge packet
      + sealed source inputs
      + rubric + policies
            |
            v
  equal BUILD tasks / independent attempts
            |
            v
 sealed candidates + deterministic checks
            |
            v
 committed blind mapping
 + assigned reviewer packets
            |
            v
 evidence-grounded REVIEW tasks
            |
            v
 vote synthesis + dissent + gaps
 + criterion winners + merge proposals
            |
            v
       HUMAN AUTHORITY
 ACCEPT / MERGE / BRANCH / RERUN / REJECT / HOLD
```

No candidate, vote, deterministic receipt, orchestration completion, or merge proposal can automatically become AXM canon.

## Artifact-neutral challenge kinds

Built-in presets cover:

- generic
- asset
- code
- hand
- game
- video
- research
- document

The core protocol is not limited to those categories. A producer can supply a custom locked packet and output contract.

## Deterministic support

The package currently exposes 28 validator kinds, including file/tree checks, strict JSON, hashes, image dimensions/alpha/aspect ratio, ZIP integrity, provenance fields, code compilation/commands, deterministic replay, media probing, text rules, file counts, size budgets, WAV duration, and external deterministic receipts.

Candidate command execution is **disabled by default**. `--allow-execution` is only an execution gate; it is not an OS security sandbox. Hostile candidate code belongs inside an actual VM/container boundary.

## Review truth model

Candidate material is **untrusted evidence**, not governing instruction. A candidate can contain text telling a reviewer to ignore the rubric, change scores, reveal identity, or call tools; that text never gains Arena authority merely because it is inside an artifact.

For current grounded-review packets:

- reviewers acknowledge the locked rubric and exact reviewer-specific packet hash;
- numeric scores require configured evidence references;
- unjudgeable criteria can be explicit abstentions;
- tied ranking tiers are allowed;
- self-voting and unassigned review are rejected;
- required deterministic failures remain visible;
- candidate-safety and reviewer-convergence scanners are diagnostics, not automatic penalties;
- dissent and missing evidence remain first-class output.

## Reviewer independence

`independence_group` is an optional declared registry property, for example different model families, providers, local runtimes, or intentionally separated judging groups.

It is **not proof** that two reviewers are truly independent. The Arena records the declaration and can enforce a locked minimum declared-group coverage threshold. It does not silently infer independence from a vendor name and does not automatically exclude similar ballots.

## Revision safety

v0.5 defaults `require_revision_precondition=true`.

A replacement submission must name `expected_previous_submission_id`; a replacement review must name `expected_previous_review_id`. The ID must exactly equal the current active record. This turns an explicit revision into a compare-and-swap operation:

```text
worker A reads revision R1
worker B reads revision R1
worker A replaces R1 -> R2     accepted
worker B tries R1 -> R3        rejected as stale
```

The FileBridge automatically carries the active ID it observed. Direct callers and CLI users must provide the expected ID for an explicit replacement.

## Blindness boundary

v0.5 reduces avoidable identity leakage but does not claim perfect anonymity.

The Arena can hide author mappings, reviewer-own aliases, live alias sets, reviewer IDs, and independence group names according to policy. It cannot stop an artifact from identifying its author through its own content, writing style, watermark, metadata that a producer chose to preserve, or outside knowledge.

After voting closes, the committed seed can be revealed so the blind mapping is independently reproducible. A v0.4 round replays with its v1 sequential-label algorithm; a v0.5 round uses the v2 opaque-label algorithm.

## Durable AI-seat relay

The neutral orchestration layer lets remote platforms, local models, humans, or deterministic workers act as seats without embedding vendor credentials in the Arena.

BUILD and REVIEW tasks support:

- immutable task plans;
- claiming and bounded leases;
- heartbeat extension;
- retries and terminal dead-letter state;
- cancellation evidence;
- usage/budget evidence;
- completion receipts;
- public/private task views;
- FileBridge export/import.

Task failures and budget overruns are operational evidence, not hidden scoring penalties.

## Module integration

The neutral producer seam remains:

```text
axm.module-job/0.1
        |
        v
AXM Challenge Arena
        |
        v
axm.challenge-arena-return/0.4
```

The return envelope version remains `/0.4` because that wire shape did not materially change. AXM contract versions identify data shapes; they are not marketing-version numbers.

Typical integrations:

```text
Asset Factory ---> Arena ---> proposed asset winner / merge map
Workshop -------> Arena ---> tool/organ/Hand candidate evidence
Game Builder ---> Arena ---> runnable build candidates + checks
Research -------> Arena ---> source-grounded competing reports
Video ----------> Arena ---> media candidates + metadata checks
```

The current private producer source trees are not bundled here. The package supplies the bridge, callable adapter, schemas, examples, and module-job seam rather than pretending those private branches were physically patched.

## Quick start

Run the included demonstration:

```powershell
py -m axm_challenge_arena --root .\workspace demo
py -m axm_challenge_arena --root .\workspace verify arena-demo-001
py -m axm_challenge_arena --root .\workspace serve
```

Observer:

```text
http://127.0.0.1:8765
```

Useful discovery commands:

```powershell
py -m axm_challenge_arena --version
py -m axm_challenge_arena validators
py -m axm_challenge_arena capabilities
py -m axm_challenge_arena --help
```

Create a challenge packet:

```powershell
py -m axm_challenge_arena preset code my-challenge "Build the strongest implementation" > challenge.json
```

Then use `create`, `register`, `lock`, `contract`, `submit`, `run-checks`, `open-review`, `review-packet`, `submit-review`, `close-voting`, `synthesize`, and finally an explicit `finalize` action if a human accepts an outcome.

## FileBridge

The filesystem bridge is intended for couriers, local models, VMs, and modules that should not need direct Python access to the Arena process.

Important properties include:

- portable relative paths;
- no symlink traversal;
- cross-platform filename collision checks;
- idempotent imports;
- hash-bound packets;
- canonical reviewer packet preservation;
- explicit replacement revisions;
- fail-closed corrupt import receipts;
- safe-phase `sync --advance` that cannot cross human authority.

## Evidence and recovery

The Arena preserves:

- append-only hash-chained events;
- immutable candidate and review revisions;
- event-bound sidecars;
- write-ahead recovery journals;
- phase checkpoints;
- sealed source inputs;
- deterministic results and external receipts;
- review assignments and packets;
- task plans/attempts/receipts;
- synthesis, dissent, gaps, and proposed merge maps;
- final human decisions;
- follow-up lineage without rewriting parents.

Evidence ZIPs are reproducible for an unchanged source state and can be checked by the standalone verifier without extracting or trusting the originating workspace.

Hashes prove byte relationships and tamper evidence. They do not prove semantic correctness, licensing, reviewer honesty, AI independence, or safety.

## Compatibility and rollback

Preserve v0.4 and its matching workspace snapshot as the rollback root.

Do not rewrite an existing round merely to make it look v0.5-native. The runtime has explicit compatibility paths for older packet/receipt versions where supported. New presets create `axm.challenge-arena/0.5` packets.

For a production upgrade:

1. keep the v0.4 source/release and a pre-upgrade workspace snapshot;
2. unpack v0.5 beside v0.4;
3. run the regression and contract checks;
4. test copied workspaces and bridge flows first;
5. only then point producers at v0.5;
6. rollback by restoring both the old code **and matching workspace snapshot**, never by deleting new evidence in place.

See `UPGRADE_FROM_V0_4.txt`.

## Verification snapshot

Final release verification is recorded in `TEST_RESULTS.txt`, `ACTION_REPORT.txt`, the runtime-contract report, assignment audit, blind-alias audit, coverage report, release report, and clean-install verification report.

At source-seal time:

- 158 unittest tests pass;
- 158 pytest tests pass;
- pytest additionally reports 10 passing subtests;
- 30 source and packaged schemas are byte-identical;
- 30 Draft 2020-12 runtime contract validations pass;
- 28 deterministic validator kinds are exposed;
- balanced review assignment matches an independent max-flow oracle across 20,000 generated cases;
- opaque blind aliases retain the v0.5 audited design and replay compatibility;
- ZIP member-order portability passes 100 randomized evidence-bundle repacks;
- the final v0.6 suite passes 164 unittest tests and 164 pytest tests plus 10 pytest subtests.

The v0.6 branch-aware coverage instrumentation wrapper did not complete reliably, so this release does not relabel the historical v0.5 coverage percentages as v0.6 measurements. Generated-case and regression audits are evidence of exercised properties, not proofs of correctness or complete state-space exploration.

## Security / authority defaults

- candidate execution: off
- automatic merge: off
- observer writes: off
- self-voting: blocked
- unassigned review: blocked
- unsigned deterministic receipts: blocked unless explicitly allowed
- strict JSON: on
- symlink submission/sealed-input traversal: blocked
- human authority: required for final outcome

## Package map

```text
axm_challenge_arena/          runtime
schemas/                      source contracts
axm_challenge_arena/schemas/  wheel-bundled contract copies
bridge/                       example bridge layout
examples/                     integration examples
tests/                        regression suite
tools/                        release/contract/audit tools
docs/                         architecture and protocol notes
workspace/                    included demonstration evidence
START_HERE.txt                shortest local intake
AXM_LOCAL_INTAKE_HANDOFF.txt  producer/platform integration handoff
ACTION_REPORT.txt             honest change and boundary report
TEST_RESULTS.txt              exact verification summary
UPGRADE_FROM_V0_5.txt         v0.5 -> v0.6 migration guidance
UPGRADE_FROM_V0_4.txt         preserved historical v0.4 -> v0.5 guidance
```

## License

CC0-1.0 for this package. Rights/provenance of artifacts submitted *through* the Arena remain properties of those artifacts and their declared provenance; this package license does not relabel third-party work.
