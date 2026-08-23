# Phase 0 overlap map

Status: `EXPERIMENTAL`

## Reused contracts and patterns

| Read-only seam | Reused meaning | Decision |
|---|---|---|
| `tools/deterministic-json-core/` | Strict canonical JSON refuses lossy or unsupported state | Direct dependency; no duplicate canonicalizer |
| `tools/agent-command-center/IDENTITY_CONNECTOR_BINDING.md` and `identity-registry.js` | Identity and connector are separate; sharing and memory transfer require consent | Shell descriptors stay unbound; no named identity fixture or registry edit |
| `shared/continuity/` | Continuity metadata does not copy project/private data | Export carries digest references, not raw project or chat data |
| `shared/verified-capability-loop/` | PASS is not install, promotion, availability, or CANON; human decisions bind exact digests | Build receipt remains `EXPERIMENTAL`, installed false, promoted false, canon false |
| `shared/code-capability-fabric/` | Provider descriptors and route planning do not execute code; host observation is not execution proof | Compatibility proposal only; moving fabric remains read-only |
| `shared/model-shadow-continuity/` | Structured trace match is not persistent identity, same mind, correctness, or human value | Model/connector swaps are disclosed lineage evidence, never identity proof |
| `shared/verification-snapshot-continuity/` | Historical receipts remain immutable; exact source drift is held visibly | Continuity events are hash-chained and exact-rebuilt; altered/reordered history is refused |
| `shared/design-lineage/` | Preserve provenance, dissent, rejection, and conflicts without automatic promotion | Lineage receipts preserve event kind and parent digests; resemblance never proves continuity |
| `shared/evidence-retention/` and AI-native curator hand | Seal append-only evidence and summarize without retaining raw private sources | This steward run gets a bounded JSONL segment, structural seal, and semantic summary |
| AI-native capability-gap and evidence-router hands | Typed gaps and native proof surfaces | Requirements/inventory comparison and per-claim evidence routes are recorded here |
| `shared/cognitive-resource/` | Resource declarations need provenance, units, and UNKNOWN states | New shell envelope is narrower and does not reuse model-economics fields; UNKNOWN remains HOLD |
| `tools/branch-module-return-gate/` | Portable leaf return is an external, human-reviewed one-way valve | Integration route is prepared but not run |
| detached Grand Mirror + Code Mirror garden v1 | Descendants may act only inside their enclave; return and inheritance stay external | Shell forks require new ids and parents stay immutable; no garden edit or invocation |

## Governance evidence

The local Keel core was read from the canonical checkout as read-only governance evidence. Its relevant boundary—working identity is a file-backed role, not consciousness, personhood, hidden persistence, or another identity—guided the generic contract. No Keel, Axiom/Mir, Mirror, Nova, Mike, or other existing identity content is copied into schemas or fixtures.

## Lane classification

- `lane-owned`: `shared/identity-shell-fabric/` and this run directory.
- `shared-seam`: all contracts listed above; inspected immediately before design and left unchanged.
- `foreign-or-unknown`: all other repository paths and all existing worktrees; preserved.

The initial Git state was clean and detached exactly at `d9066284e45eaedb07d8e7998b7c6a972e67c0c1`. The initial timestamp-based workspace snapshot marked most freshly populated files as active; Git showed no concurrent edits in this isolated worktree, so those timestamps were not treated as ownership evidence.
