# Full Semantic Intake — AXM LEGO Software City

Status: **DRAFT_INTAKE**

Decision: **ACCEPT_AS_PROPOSED_RESEARCH_MAP**. This preserves the platform buildmap as structured research and build direction. It does not install, execute, merge, promote, canonize, or alter AXM roots. Mike remains the final decision maker.

## Direct answer: LEGO blocks and Mirror

There is no direct runtime integration yet. The LEGO vocabulary is a behavior/contract classification layer; the Mirror package is a TEST, dormant archive containing 115 real organ source objects. A Mirror “organ” is not automatically an AXM `ORGAN` block. After inspection it may classify as a `BRICK`, `SENSOR`, `ORGAN`, `HAND`, or `BRIDGE`. The generated alignment is **INFERRED_UNCONFIRMED**, proves no socket compatibility, and grants no execution authority.

## Verified facts

- The Markdown and JSON blueprint were hash-bound and the JSON parsed as `axm.lego-city-blueprint/v0.1`.
- The blueprint is `PROPOSED` and explicitly denies automatic merge, promotion, and CANON authority.
- GitHub main and the claimed inspected snapshot both resolved to `a4f99fbfc05268173458bf3fb8f3fe616919e376` during intake.
- That snapshot reports 210 tools, 1,769 capabilities, and 210 present/valid module contracts.
- `tools/deterministic-pr-checkpoint` exists at that snapshot but is absent from both `tools-index.json` and `registry/capabilities.jsonl`.
- The authority observatory reports 81 modules against the 210-tool index: a 129-module coverage difference, not proof that all 129 have authority defects.
- PR #33’s final receipt checks do not require final receiver draft state even though they record `pullRequestDraft`.
- The current Mirror portable library pointer resolves to 115 archived organs, status `TEST`; compatibility and runtime admission are not implied.

## Architectural lock

Compile one complete city graph from live source, manifests, contracts, schemas, evidence locators, status/promotion records, and a named source commit. Generate every machine and human view from that graph. Narrative files remain downstream views; they cannot silently become a third source of truth.

The proposed block kinds are: `BRICK`, `SENSOR`, `ORGAN`, `HAND`, `ROOM`, `BRIDGE`, `ROUTE`, `DISTRICT`. The effect classes are: `NONE`, `OBSERVE_LOCAL`, `READ_PRIVATE`, `WRITE_CANDIDATE`, `EXECUTE_CONFINED`, `EXECUTE_TRUSTED`, `NETWORK_READ`, `NETWORK_WRITE`, `PUBLIC_RELEASE`, `PHYSICAL_ACTUATION`, `PROMOTION`, `CANON_CHANGE`, `ROOT_CHANGE`. Ability, authority, execution, and proof remain separate.

## Seven common contracts

- `axm.block-view/v1`: compiled block discovery, compatibility, effects, authority and proof view. Source-of-truth field: `false`.
- `axm.city-graph/v1`: complete deterministic graph for a named source snapshot. Source-of-truth field: `false`.
- `axm.artifact-ref/v1`: immutable byte and semantic artifact reference. Source-of-truth field: `true`.
- `axm.event/v1`: common occurrence envelope with correlation, causation, authority and evidence. Source-of-truth field: `true`.
- `axm.decision/v1`: typed authority decision bound to exact effect scope. Source-of-truth field: `true`.
- `axm.receipt/v1`: common outer evidence envelope retaining domain payload schemas. Source-of-truth field: `true`.
- `axm.route/v1`: durable workflow declaration. Source-of-truth field: `true`.

## Twelve-block reconciliation

| City block | Current fit | Strongest local reuse candidates | Principal gap |
|---|---|---|---|
| live-city-map | PARTIAL_DRIFTED | scripts/generate-tools-index.js; tools-index.json; registry/capabilities.jsonl | No single live compiler owns all generated views |
| schema-registry | PARTIAL | shared/mirror-core/core/schema-registry.js; shared/mirror-core/schemas; shared/readiness | No city-wide schema ID/version/compatibility resolver |
| artifact-depot | PARTIAL_INCUBATED | shared/handoffs/artifact-handoff-broker.js; shared/evidence-retention; shared/module-evolution-ledger | No single immutable artifact-ref contract |
| event-journal | PARTIAL | shared/mirror-core/journal/event-journal.js; shared/mirror-core/journal/hash-chain.js; shared/module-evolution-ledger/schemas/event.schema.json | No common city event envelope |
| authority-grid | PARTIAL_DRIFTED | shared/mirror-core/gate/permission-engine.js; shared/operations/permission-service.js; tools/authority-surface-observatory | Authority observatory covers 81 of 210 indexed modules at inspected commit |
| hands-rail | PARTIAL | shared/ai-native-hands; tools/agent-tool-forge; shared/native-host-adapters | Executor substrate evidence is fragmented |
| workflow-transit | PARTIAL_INCUBATED | shared/heartbeat; shared/capability-intelligence/generated/verified-workflow; hub/production-session.js | No common axm.route/v1 route lifecycle |
| evidence-grid | STRONG_FRAGMENTED | shared/verification-spine; tools/evidence-desk; tools/evidence-chain-inspector | Receipt envelopes and freshness are not unified |
| local-sync | PARTIAL | shared/mirror-core/journal/snapshot-store.js; shared/mirror-core/journal/rollback-service.js; shared/mirror-core/journal/diff-engine.js | No city-wide typed merge semantics registry |
| twin-surfaces | PARTIAL_MANUAL | tools-index.json; docs/HUB_MAP.md; tools/authority-surface-observatory | Human and machine views have independent generators |
| intake-harbor | STRONG_FRAGMENTED | shared/modular-intake; tools/bulk-intake-conveyor; tools/archive-intake-cartographer | No single 15-step intake state machine |
| city-gates | PARTIAL_HIGH_RISK | shared/operations/github-sync-service.js; tools/chatgpt-connector; tools/discord-bridge | PR 33 receiver draft assertion gap |

Detailed features, refusals, reuse candidates, and gaps are preserved in `SEMANTIC_SESSION.jsonl` and `CITY_COMPONENT_ALIGNMENT.json`. The 115-organ browsing alignment is in `ORGAN_CITY_ALIGNMENT.json`.

## Grounded findings

- **finding-a-discovery-omission:** Generated discovery views can omit real declared modules while remaining internally self-consistent. Verified observation: At source commit a4f99fbfc05268173458bf3fb8f3fe616919e376, tools/deterministic-pr-checkpoint exists with a manifest and contract but is absent from tools-index.json and registry/capabilities.jsonl. Build implication: Compile all derived maps from a live filesystem/manifest/contract scan and fail when any declared module is unindexed.
- **finding-b-domain-islands:** Strong general-purpose civic capacities can become trapped inside domain-specific modules. Verified observation: PR 29 contains workflow, checkpoint, cache, lease, retention/archive, portable profile, and confinement-probe structures inside shared/game-production-runner. Build implication: Keep the game runner as a domain incubator; extract reusable organs only through explicit generic contracts and compatibility adapters.
- **finding-c-authority-drift:** Authority views can become stale or partial when compiled independently from capability discovery. Verified observation: The authority observatory snapshot reports 81 modules while the same source commit tools index reports 210. Build implication: Compile capability, effects, permissions, authority, proof freshness, and unknowns from the same city graph.
- **finding-d-pr33-draft-gap:** PR 33 records final draft state but does not require it for a passing receiver receipt. Verified observation: buildReceipt checks exact head/base/title/body/open/merge state but has no pull-request-draft check; pullRequestDraft is only copied into transport output. Build implication: Add a final receiver assertion for pullRequestDraft === true and a draft-state race negative test before enabling the publisher.
- **finding-e-substrate-is-not-sandbox:** A runtime or substrate label is not evidence of confinement. Verified observation: The intake correctly distinguishes executor class declarations from measured denials and remaining reachable effects. Build implication: Every executor must declare substrate, resources, denial probes, known gaps, budgets, cancellation, cleanup, and effect receipts.

## Build order and exit gates

0. **Truthful map** — no live manifest or contract can be silently unindexed; generated views byte-match clean regeneration; semantic digest excludes timestamps and machine-local paths.
1. **Grammar without migration** — existing modules compile without rewrite; duplicate IDs fail; incompatible sockets are explicit.
2. **Artifact Depot and Event Streets** — interrupted writes cannot produce valid artifacts; event replay reproduces derived projection; no automatic deletion.
3. **Authority Grid and Hands Rail** — capability does not grant authority; stale decisions fail; effect target matches exact digest and scope; partial failure is typed.
4. **Durable Workflow Transit** — same locked route reproduces plan digest; resume cannot skip unverified work; domain profile cannot expand authority.
5. **Twin Surfaces** — human labels never exceed machine truth; every human effect maps to an exact packet; beginner view preserves capability and risk.
6. **City Gates and distribution** — private local operation works with external gates disabled; adapters cannot become internal authority; public package can be independently verified.

The first build is `axm-city-map-gate-v0.1`: Make omission of a real declared module from the machine map a CI failure. It is read-only and has no install, execute, network-write, promote, merge, CANON, or root authority. Required failure cases: `UNINDEXED_MODULE`, `CITY_GRAPH_DRIFT`, `DUPLICATE_BLOCK_ID`, `UNRESOLVED_SCHEMA`, `EFFECT_PERMISSION_DRIFT`, `AUTHORITY_MAP_STALE`, `HUMAN_VIEW_DRIFT` plus stable semantic digests when only timestamps or machine-local paths change.

## Open PR routing retained from the proposal

- PR #32: **MERGE_EARLY_AFTER_LIFECYCLE_CHECK** — bind baseline to source commit and verifier version; define exact baseline renewal authority and delta receipt; report stale baseline as STALE.
- PR #30: **REBASE_RECOMPILE_AND_MERGE_AS_DISTRICT** — rebase against current main; regenerate city graph; declare domain-profile relationship to deterministic research.
- PR #29: **STRUCTURAL_HOLD_NOT_REJECTION** — rebase against current main; declare DOMAIN_INCUBATOR; add generic-versus-domain extraction map; prevent other domains depending on internal generic organs; extract with compatibility adapters.
- PR #33: **REPAIR_THREAT_TEST_MERGE_LAST_DISABLED_BY_DEFAULT** — require final receiver pullRequestDraft true; add plan-to-readback draft-race negative test.

These are recommendations, not merge decisions. Live PR state can change and must be rechecked before action.

## Standards boundary

Official sources were checked for the reference patterns named by the intake. AXM borrows bounded ideas—schema vocabularies, event correlation, subject-bound provenance, typed policy inputs, content-addressed distribution, local-first merge classes, portable interfaces, and external agent/tool protocols. None of those external standards becomes AXM’s internal ontology or grants authority. See `OFFICIAL_REFERENCE_INDEX.json`.

## Preserved unknowns

- Full-tree clean-regeneration stability and performance remain unmeasured until the City Map compiler exists.
- Unpushed/private branches may contain modules not visible in the named snapshot.
- Mirror organ behavior and socket compatibility remain unknown until direct tests exist.
- Executor labels do not prove confinement; denial probes and remaining reachable effects are required.
- Open PR recommendations require revalidation against their final heads and lifecycle decisions.

## Curation and retrieval

The raw ZIP/Markdown/TXT/JSON remain preserved as user-source artifacts. The compact semantic record is `SEMANTIC_SESSION.jsonl`; `KNOWLEDGE_INDEX.json` provides term-to-event lookup. The session is sealed separately so future intakes can verify that the semantic record did not drift.
