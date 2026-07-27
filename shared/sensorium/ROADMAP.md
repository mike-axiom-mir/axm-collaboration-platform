# AXM Sensorium builder roadmap

Status: **IMPLEMENTED AND VERIFIED IN TEST — AWAITING MIKE'S PROMOTION GATE**  
Roadmap version: **0.2.0**  
Implementation version: **1.4.0**  
Grounded against Workshop state: **2026-07-23**  
Scope: `shared/sensorium/`, `tools/agent-tool-forge/skills/sensorium/`, the portable Sensorium bundle, focused tests, and the smallest shared discovery/UI seams needed to expose them.  
Gate: Mike remains the human promotion gate. This roadmap grants no authority and promotes nothing to canon.

## Implementation receipt

The roadmap is implemented as modular, independently testable parts. `node shared/sensorium/selftest.js` proves all nine phases and writes the machine-readable acceptance receipt to `exports/sensorium-roadmap-acceptance.json`. `TEST` remains distinct from canon.

| Phase | Status | Primary evidence |
|---|---|---|
| P0 · truth convergence | PASS | `canonical/sensorium.json`, generated registry/matrix, composite test lane |
| P1 · receipt envelope | PASS | `schemas/sensorium-receipt.schema.json`, `receipt-envelope.js` |
| P2 · independent proofs | PASS | thirteen modules in `proofs/`, `exports/sensorium-conformance-report.json` |
| P3 · composition | PASS | `coordinator.js`, full touch/time/observe/evidence/continuity journey |
| P4 · host negotiation | PASS | adapter schema, adapter catalog, READY/DEGRADED/BLOCKED/UNKNOWN tests |
| P5 · automation | PASS | fourteen separate automation/helper modules and deterministic acceptance checks |
| P6 · Lab/discovery | PASS | `tools/sensorium-lab/`, laptop/mobile live visual receipt |
| P7 · portable release | PASS | individual ZIPs, full bundle, checksums, compatibility and safety reports |
| P8 · body-safe activation | PASS | real Body Pulse lease integration plus throttle, pause, and expiry tests |

Remaining named holds: `WINDOWS_WINDOW_ISOLATION_UNAVAILABLE` and `SEAT_CAPACITY_ADAPTER_UNAVAILABLE`. The implementation does not weaken or hide either.

### v1.1 delegated-gate extension

Mike delegated the technical selection and local TEST integration of Opus's two
proposal cards. `corroboration-triangulator` was admitted with full runtime
proof. `interoception-capacity-gauge` was admitted with an executable bounded
classifier and contract proof, while its real host metric adapter remains
missing. This delegated merge is not CANON promotion; Mike remains the explicit
promotion gate.

### v1.2 delegated-gate extension

Mike delegated the technical judgment to implement Opus's next Sensorium card,
`taint-sniffer`. The new chemoreception sense inspects only caller-supplied,
bounded incoming material. It reports deterministic integrity and
injection-shaped warning codes, never raw excerpts or a guilt verdict, and
routes suspicion to review without blocking, quarantining, or changing
authority. It is `RUNTIME_PASS`; no host adapter is needed for its bounded
local checks. This TEST integration does not promote it to CANON.

### v1.3 delegated-gate visual extension

Mike delegated the technical selection and local TEST integration of Opus's two
visual proposals. `eye-change-differ` compares two attributable typed
observations of the same target and reached `RUNTIME_PASS`; it claims neither
pixel capture nor cause. `eye-accessibility-inspector` reuses Visual Kernel
contrast math and checks supplied presentation measurements against the Trust
Charter floor. Its deterministic inspector is real, but automatic live style
collection remains `MISSING_ADAPTER`, so it stays honestly `CONTRACT_PASS` with
`UI_COMPUTED_STYLE_ADAPTER_UNAVAILABLE`. Neither sense acts or restyles.

### v1.4 visual runtime stewardship extension

The previously named Eye 4 adapter gap is now closed in TEST by a real bounded
browser hand at `shared/ai-native-hands/computed-style-hand.js`. It resolves one
exact same-document DOM root, reads computed colours, target rectangles, font
sizes, and explicitly declared signal parity, and feeds the existing Eye 4
inspector. It never reads text content, captures pixels, mutates the page, or
converts incomplete coverage, gradients, images, transparency, or ancestor
opacity into a pass. Eye 4 is now `RUNTIME_PASS`; missing injection remains a
per-use UNKNOWN rather than a global adapter hold.

## Builder objective

Turn the existing AXM Sensorium from a collection of strong portable procedures and partially tested runtime adapters into one coherent, discoverable, bounded nervous system. Any compatible human or AI seat should be able to use it without inheriting permissions, accumulating raw sensory memory, or rebuilding the same integration work by hand.

Do not rewrite working senses. Converge their contracts, prove the executors that already exist, compose them through a common receipt envelope, and automate every exact mechanical task that deterministic machinery can perform for both human and machine collaborators.

## Non-negotiable roots

1. **Perception is not permission.** A sense observes only through an explicitly supplied adapter or current host capability. Permission never transfers between seats, turns, backends, or senses.
2. **Ephemeral by default.** Frames, recordings, stream buffers, directory readings, and probe output are released after the typed observation is sealed. Only bounded receipts and deliberately preserved proof artifacts survive.
3. **No fake executor.** A skill may be `HOST_MEDIATED`, `MISSING_ADAPTER`, or `BLOCKED`. Never add a stub merely to make an inventory green.
4. **Claim-native evidence.** Structure uses parsers; behavior uses focused execution; appearance uses live visual evidence; persistence uses restart/reload; authorization uses allowed and denied attempts.
5. **Continuity is not authority.** Handoffs carry state, assumptions, holds, and next steps—not access.
6. **Same identity for drift.** Drift compares one seat only with that seat's own typed baseline. It cannot punish, disable, or silently change routing.
7. **Automate repetition, not judgment.** Deterministic machinery may inventory, validate, route, package, expire, compact, and replay approved known repairs. It may not decide taste, intent, permission, promotion, or whether a novel exception is acceptable.
8. **Human and machine time have equal value.** Automation must remove bookkeeping and repeat work for Mike, Codex, Mirror, and future builders—not merely make a prettier human dashboard.

## Current truth — do not rediscover this

| Area | Observed state | Honest consequence |
|---|---|---|
| Portable bundle | Thirteen TEST skills: the original eight plus Corroboration, Interoception, Taint Sniffer, Eye 3, and Eye 4 | All dual forms derive from one canonical source. |
| Workshop runtime registry | Twelve executable routes and one honest host-mediated route | Inventory and capability counts agree; executable does not imply an installed host adapter. |
| Runtime proof | Twelve senses have `RUNTIME_PASS`; Interoception has `CONTRACT_PASS` with an explicit adapter hold | Registry-driven success, safety-boundary, envelope, and two-use retention tests pass at each declared proof level. |
| Runtime README | The documented `shared/sensorium/selftest.js` exists and runs in the composite foundation lane | A new builder has one real entry command. |
| Composition | Observe-only coordinator covers Touch → Time → sense → Time → evidence route → Continuity | Missing or stale senses become typed holds; permissions do not transfer. |
| Workshop integration | Sensorium Lab has a normal discoverable module manifest and reads generated canonical state | Disabling the Lab does not affect the service modules. |
| Dual forms | Workshop JSON, portable Markdown, index, host metadata, manifest, README, and handoff are generated | The parity guard detects manual drift. |
| Windows visual fallback | Declared; automatic activation and permission transfer are correctly false | Exact named-window isolation remains unavailable and must remain a visible hold. |

## Status vocabulary

Use separate fields. Never collapse them into one vague `working` label.

- `skillStatus`: `DRAFT | ACCEPT_FOR_TEST | REVIEWED`
- `executorStatus`: `EXECUTABLE | HOST_MEDIATED | MISSING_EXECUTOR | NOT_APPLICABLE`
- `adapterStatus`: `AVAILABLE | DEGRADED | MISSING_ADAPTER | BLOCKED | NOT_REQUIRED`
- `proofStatus`: `UNTESTED | CONTRACT_PASS | RUNTIME_PASS | JOURNEY_PASS | FAIL | UNKNOWN`
- `authorityStatus`: `NO_LEASE | LEASED | DENIED | EXPIRED`

## Phase 0 — Truth convergence

Historical note: Phases 0–8 below preserve the original v1.0 eight-sense build
plan and its acceptance numbers. The v1.1, v1.2, v1.3, and v1.4 extensions above add five TEST senses
through the same canonical compiler, envelope, proof, retention, and promotion
gates; current counts live in the generated registry and conformance report.

Goal: make inventory, documentation, runtime, and tests describe the same system.

### Build

1. Establish one canonical inventory covering all eight skills.
2. Represent Eye 1 as `HOST_MEDIATED` with required capability `visual.inspect.static/v1`; do not invent a JavaScript image-understanding engine.
3. Link each of the other seven entries to its real executor or runtime route.
4. Create `shared/sensorium/selftest.js` and make the README command real.
5. Replace hard-coded runtime status in `tests/sensorium-retention-conformance-test.js` with registry-driven executor discovery and focused calls into every executor.
6. Add Sensorium checks to an existing composite test lane; do not create an uncalled green island.
7. Correct stale documentation only after proof exists.

### Acceptance gate

- Canonical inventory reports 8 skills, 7 executable/runtime routes, and 1 honest host-mediated route.
- Every declared module path loads and its exported capability matches the registry exactly.
- `node shared/sensorium/selftest.js` exits 0.
- The retention conformance test no longer reports existing adapters as `MISSING_EXECUTOR`.
- Every repeated sense use leaves `rawRetainedBytes === 0` and `rawRetainedItems === 0` after its release boundary.
- Missing host sight returns `MISSING_VISUAL_INPUT` or `MISSING_VISUAL_CAPTURE`, never PASS.

## Phase 1 — One receipt envelope

Goal: let senses exchange typed observations without exchanging raw material or authority.

Create versioned `axm.sensorium-receipt/v1` envelopes around the existing sense-specific receipts. Preserve each specific receipt; do not flatten useful evidence.

Required envelope fields:

```text
receiptId
claimId
senseId / capabilityId / capabilityVersion
seatId / targetId / backendId
observedAt / sealedAt / ttlMs / freshnessStatus
verdict: PASS | FAIL | UNKNOWN
namedSeams[]
typedObservationDigest
specificReceiptSchema / specificReceiptDigest
authorityLeaseId | null
authorityInherited: false
rawRetainedBytesAfterSeal: 0
rawRetainedItemsAfterSeal: 0
cleanupComplete
```

### Acceptance gate

- All seven runtime routes emit valid envelopes.
- Host-mediated Eye 1 wraps supplied static evidence without claiming capture.
- No envelope contains raw frames, recordings, transcripts, directory trees, secrets, or source files.
- Receipts join by `claimId` without sharing permissions.
- TTL is calculated from observation time, not receipt-read time.

## Phase 2 — Prove every sense independently

Goal: move statuses from `ACCEPT_FOR_TEST` to evidence-backed runtime states one sense at a time.

| Sense | Cheapest meaningful proof | Required countercheck |
|---|---|---|
| Eye 1 | Known screenshot with visible and absent facts | A live/motion claim must return `UNKNOWN` or hand off to Eye 2 |
| Eye 2 | Baseline → bounded action → intermediate → settled → cleanup | Denied capture or low cadence must not become PASS |
| Ears | Expected event, refuting event, silence, eviction, staleness | Source log remains untouched after buffer release |
| Time | LIVE, STALE, UNTIMED, invalid timestamp, shortest inherited TTL | Future or malformed evidence cannot silently become fresh |
| Touch | OS/path/tool match, mismatch, unknown version, wildcard refusal | Probe stays inside named items and performs no install or repair |
| Continuity | Write, new process/read, expired-fact recheck, broken chain | Access is re-read and raw sense material never crosses handoff |
| Compaction | Preview, hash, archive, read-back, digest, retrieval | Hash mismatch or uncertain ownership leaves original untouched |
| Drift | Baseline forming, no drift, possible drift, flagged drift | Cross-identity comparison is refused; no direct action is taken |

### Acceptance gate

- Every proof has a focused test and evidence receipt.
- `proofStatus` is promoted independently per sense.
- Safety checks prove the system's limits, not only happy paths.

## Phase 3 — Compose the nervous system

Goal: build a small coordinator that routes observations, not an autonomous actor.

Default route:

```text
Touch preflight
  → Time stamps assumptions
  → Eye and/or Ears observe one bounded claim
  → Time stamps resulting evidence
  → Evidence router judges the claim
  → Continuity carries the digest and open hold
```

Optional routes:

- Compaction receives sealed provenance only, never sensory bulk.
- Drift receives bounded same-seat receipt features only, never hidden reasoning or raw transcripts.
- A missing sense returns a typed capability gap and the cheapest honest alternative.

### Acceptance gate

- A full journey completes with zero raw retained bytes/items.
- One unavailable sense degrades only its dependent claim.
- Permissions never transfer across senses, seats, turns, or backends.
- Stale evidence is rechecked before an action recommendation.
- The coordinator emits recommendations and holds only; it cannot click, write, publish, promote, install, or delete source material.

## Phase 4 — Host adapters and capability negotiation

Goal: make skills portable without pretending every host exposes the same body.

Define a versioned adapter contract:

```text
adapterId / version
capabilities[] / constraints[]
resourceBudget
authorityRequired
targetIsolation
open / observe / seal / release / status
```

Register only adapters the host truly exposes: supplied-image inspection, in-app browser capture, Windows named-window capture when exact isolation exists, bounded terminal/process streams, exact read-only environment probes, owned continuity storage, and owned hot/cold provenance storage.

### Acceptance gate

- Negotiation returns `READY`, `DEGRADED`, `BLOCKED`, or `UNKNOWN` before work.
- No dependency is installed merely to make readiness green.
- Windows capture remains degraded until exact target isolation exists.
- Rolling/repeated observation declares memory, cadence, and thermal budgets.

## Phase 5 — Deterministic automation for both collaborators

Goal: remove repeatable bookkeeping from Mike, Codex, Mirror, and future builders while keeping judgment and authority explicit.

### Build these machines

1. **Inventory compiler** — scans canonical definitions and produces the runtime registry, skill index, capability matrix, and counts. It fails on duplicates, missing artifacts, version conflicts, or undeclared host mediation.
2. **Dual-form compiler** — generates Workshop JSON, Workshop Markdown, portable `SKILL.md`, host metadata, and bundle manifests from one canonical source.
3. **Parity guard** — detects manual drift among generated forms before packaging or release.
4. **Conformance runner** — discovers every executor and runs contract, safety-boundary, two-use retention, and receipt-schema tests automatically.
5. **Capability-gap router** — compares the requested sense with current host capabilities and returns the cheapest reuse, composition, adapter, or honest hold.
6. **Freshness scheduler** — marks receipts stale by TTL and queues re-observation; it never performs the observation without current authority.
7. **Retention janitor** — releases only exact Sensorium-owned temporary paths/IDs and verifies post-cleanup counters are zero. No wildcards or recursive sweeps.
8. **Session closer** — seals the compact handoff, lists open holds, expires leases, and releases all sensory buffers at the end of a bounded work session.
9. **Evidence compactor** — moves verified cold provenance, confirms hashes and retrieval, and leaves a hot digest. It never receives raw sensory buffers.
10. **Regression-memory candidate writer** — when a verified Sensorium failure is repaired and independently reproduced, prepares a proposed verifier case. Human approval is required before the new rule becomes binding.
11. **Known-repair router** — sends an exact, previously approved failure signature to Repair Buddy. Repair Buddy may replay only the matching approved recipe; novel failures stop for a builder.
12. **Release packager** — generates individual ZIPs, the full bundle, checksums, changelog, compatibility matrix, and public-safety scan from approved sources.
13. **Technical Glasses feed** — derives live counts, proof states, holds, TTLs, and zero-retention health from the canonical registry and receipts; no hand-entered dashboard numbers.
14. **Drift-safe baseline updater** — proposes bounded same-seat baseline windows after enough reviewed receipts. It cannot silently replace a baseline.

### Automation law

```text
If the task can be decided by exact schema, digest, path, capability id,
timestamp, counter, approved signature, or deterministic test: automate it.

If it requires meaning, taste, novel diagnosis, permission, risk acceptance,
promotion, or a change to the rule itself: route it to the relevant human and
machine judgment seats with evidence.
```

### Acceptance gate

- A clean source can regenerate all derived Sensorium artifacts without manual copying.
- Re-running unchanged inputs is byte-identical or explains a deliberately time-varying receipt field.
- Automation emits typed `PASS`, `FAIL`, `UNKNOWN`, or `HOLD`; it never invents completion.
- Every write path is owned and exact; every destructive action has a preview and bounded authority.
- Both a human builder and an AI builder can resume from the generated handoff without reconstructing the inventory.
- Novel failures and novel capabilities remain visible work, not silent auto-repair.

## Phase 6 — Sensorium Lab and Workshop discovery

Goal: provide one honest page showing what can currently be sensed and why.

Show all eight senses and their separate statuses, host constraints, lease scope/expiry without secrets, latest bounded receipt, evidence age, raw retained bytes/items, named holds, cheapest alternative, journey trace, and synthetic test controls.

The Lab reads canonical state; it is never the source of truth.

### Acceptance gate

- Laptop and narrow/mobile visual checks show every state legibly.
- Refresh restores configuration but not expired authority.
- Missing adapter and failed observation are visibly distinct.
- Disabling the Lab does not break the shared service.

## Phase 7 — Portable release pipeline

Goal: make the standalone skills derive from the same source as the Workshop pack.

Generate Workshop JSON, Workshop Markdown, portable Markdown, host metadata, bundle manifests, individual ZIPs, checksums, compatibility matrix, and public-safety report deterministically.

### Acceptance gate

- Unchanged source regenerates byte-identical outputs.
- Manual generated-form drift is detected.
- Each ZIP installs independently and honestly reports missing host capabilities.
- No local paths, receipts, raw captures, tokens, or machine state ship.

## Phase 8 — Mirror and unattended use, only after prior gates

Preconditions: Phases 0–4 pass; Body Pulse supplies compute/memory/thermal/cadence limits; Mike explicitly enables senses; Drift has a reviewed same-seat baseline; stop, idle, and lease expiry are tested.

### Acceptance gate

- Low-pressure sensing continues within body budgets.
- Thermal/resource pressure reduces cadence or pauses before unsafe load.
- Expired authority stops the affected adapter; continuity preserves only a typed hold.
- Sensory output cannot directly promote learning, code, assets, or world state without that domain's separate gate.

## Recommended builder order

Do not parallelize the first three items; they touch the same truth seam.

1. Canonical eight-sense inventory and status vocabulary.
2. Missing runtime selftest and registry-driven conformance repair.
3. Canonical-source/dual-form compiler and parity guard.
4. Common receipt envelope.
5. Independent proofs for the six existing adapters.
6. Composition coordinator and journey test.
7. Host adapter negotiation.
8. Deterministic automation machines.
9. Sensorium Lab and discovery.
10. Portable release pipeline.
11. Mirror activation under Body Pulse.

## Evidence routes

| Claim | Native proof | Counterevidence that fails the claim |
|---|---|---|
| A sense exists | Canonical registry plus resolvable artifact | Unknown artifact or capability |
| An executor works | Focused run with asserted receipt | Missing adapter, thrown error, wrong verdict, retained raw material |
| Retention is flat | Two sequential uses with post-seal counters | Either use retains bytes/items, or use 2 grows |
| Composition works | End-to-end typed receipt chain | Missing link, raw transfer, stale evidence, permission inheritance |
| Automation saves repeat work | Regenerate from clean canonical input | Manual copying or unexplained nondeterministic output remains |
| UI is usable | Live journey at declared viewport | Clipping, ambiguity, dead control, silent reversion |
| Continuity persists | Write → stop/restart → read/compare | In-memory-only survival or inherited access |
| Authorization is bounded | Allowed and denied attempts | Denied or expired lease still observes or acts |
| Body-safe unattended sensing | Telemetry under named cadence/duration | Thermal climb, memory accumulation, throttling, failure to idle |

## Explicit non-goals

- No global desktop surveillance, background microphone, or camera activation.
- No hidden chain-of-thought capture or biometric identification.
- No automatic action merely because a sense produced PASS or FAIL.
- No universal confidence score replacing claim-specific evidence.
- No raw-video, screenshot, transcript, or environment-dump archive.
- No automated taste, permission, promotion, or novel repair decision.
- No Mirror canon promotion in this roadmap.

## Capability-gap receipt

```text
overall route: DEGRADED but buildable
satisfied: eight portable procedures; seven runtime routes; six real non-Eye adapters; bounded receipts; flat-retention design; live Eye cleanup proof
misreported: six existing adapters are still labeled MISSING_EXECUTOR by the conformance test
missing: canonical eight-sense inventory; real runtime selftest; common envelope; composition coordinator; adapter negotiation; deterministic compilers; discovery UI
contract gap: Workshop seven-route registry and portable eight-skill bundle do not share one source of truth
evidence gap: six adapters exist but lack registry-driven independent runtime proof
authority gap: none for documentation/tests; real host adapters still require injected authority
substrate gap: exact named-window Windows isolation remains unavailable
cheapest next test: create the missing selftest and prove every module path/capability plus two-use zero-retention behavior
```

## Builder handoff definition

A phase is complete only when implementation, focused test, evidence receipt, status update, and remaining hold all agree. Report files changed, commands run, verdicts, shared seams touched, and anything unverified. `TEST` is not canon; no fake done.
