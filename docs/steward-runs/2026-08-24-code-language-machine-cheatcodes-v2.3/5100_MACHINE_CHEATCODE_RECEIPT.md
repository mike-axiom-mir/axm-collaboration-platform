# AXM Code Language Machine Cheatcodes v2.3 — evidence receipt

Status: `TEST`

This receipt records the bounded machine-cheatcode and influence-mesh work stacked on PR #52. It does **not** convert heuristic matches, soft influence, parser acceptance, or fixture success into semantic correctness, runtime correctness, execution authority, architecture authority, or CANON.

## Source binding

- Repository: `mike-axiom-mir/axm-collaboration-platform`
- Pull request: `#53`
- Base / PR #52 head: `ee70266db3b0ee39f210bbce0309e22bb5591a6d`
- Branch: `codex/code-language-machine-cheatcodes-v1`
- Latest no-writer code/gate-architecture head before this docs-only receipt: `4459f4255fe624bc557d9196d4cb9736b702a19b`
- Previous no-writer head with City PASS: `11dba0fdd51b95c0b7f17a5413a520382dd5662d`

This receipt commit is documentation-only and therefore is not represented as having been inside the cited code test runs.

## Physical capture

Every one of the 102 language organs physically owns a deterministic `machine.cheatcodes.json` bank generated from its exact:

- organ identity/digest
- grammar-profile identity/digest
- specialist-eye identity/digest

The runtime/compiler does not store one human-facing global tip list and pretend it is language knowledge.

Invariant:

```text
language banks: 102
rules per bank: 50
phases per bank: 10
total machine cheatcodes: 5100
unique bank digests: 102
```

Machine-cheatcode fabric snapshot SHA-256:

`6ffa100c40706754864f6d98f86ed528bd3631c797ab6b64f447cd768340d746`

## Ten machine phases

Each grammar bank contains exactly five rules for each phase:

1. parse
2. symbols
3. dependencies
4. types-state
5. control-effects
6. rewrite-safety
7. verification
8. performance-build
9. debugging
10. discovery

A rule is a machine-oriented micro-pass, not prose advice. It can encode:

- trigger mode and caller-supplied fact/signal requirements
- native grammar bindings
- read set
- emitted fact/candidate class
- falsifiers/counter-evidence
- invalidated analyses
- native verifier candidates
- bounded next step
- explicit no-authority state

## Influence mesh

The 50 rules inside each grammar are also connected through a deterministic bounded influence mesh.

Invariant from the passing steward run:

```text
meshes: 102
nodes: 5100
influence edges: 120125
max propagation depth: 3
self edges: forbidden
looping paths: forbidden
isolated rules: forbidden
```

Influence-mesh snapshot SHA-256:

`bb69e9e22829ef6fb2632d37e3fea723e3c77e77282dbc4e98c0b350554a8be1`

Influence edges may arise from shared native bindings, shared verifiers, phase succession, invalidation/recheck relationships, concept bridges, and a small deterministic creative bridge. These edges **do not** assert that the destination rule is true.

## Hard activation vs soft influence

The fabric deliberately separates two states:

- **hard activation** — the caller-supplied observation actually satisfies a rule trigger;
- **soft influence** — an activated or influenced rule suggests another rule should be inspected.

Every soft result is emitted as:

`INFLUENCE_CANDIDATE_REQUIRES_EVIDENCE`

The contract explicitly preserves:

```text
influenceIsActivation: false
influenceIsEvidence: false
moreInfluenceIsNotMoreTruth: true
softInfluenceRequiresEvidence: true
influenceDoesNotUpgradeConfidence: true
authority: NONE
```

Therefore a dense cluster of mutually influential rules cannot vote itself into truth or permission.

## Concrete propagation probes

Passing bounded examples from the materialization/steward test:

- Rust: `7` hard activations -> `43` soft influence candidates
- Helm templates: `6` hard activations -> `44` soft influence candidates
- DAX: `7` hard activations -> `43` soft influence candidates
- unrelated inactive VHDL on an ordinary responsive-frontend observation: `0` hard activations -> `0` soft candidates

The VHDL zero-seed regression matters: the mesh cannot spontaneously create a cascade when a grammar has no justified starting evidence.

## Representative native knowledge

The permanent selftest requires representative grammar-specific bindings, including:

- Rust: borrow semantics and unsafe boundaries
- Helm: template/YAML duality
- DAX: row-vs-filter context
- VHDL: delta cycles

These are examples only; all 102 banks contain their own resolved grammar/profile/eye-derived rule set.

## Passing write-bounded steward runs

Temporary write authority existed only to materialize deterministic generated files and derived repository views, then was decommissioned.

- `AXM Code Machine Cheatcode Materializer` run `32698531780` — PASS
  - materialized 102 physical banks
  - 5,100-rule selftest PASS
  - influence-mesh selftest PASS
  - lower grammar/eye/organ invariants PASS
  - City/schema/twin regeneration PASS
  - repository verification PASS
- final v0.6 refresh run `32698713158` — PASS
  - 102-bank check PASS
  - 5,100-rule check PASS
  - influence mesh PASS
  - lower invariants PASS
  - deterministic views PASS
  - repository verification PASS

The repository verification observed `verify.js` at `0 FAIL · 25 warn`. Existing warnings remained visible and were not converted into passes.

## Final no-writer state

The temporary materializer workflow was decommissioned after generation. Its remaining stub has:

- manual dispatch only
- `contents: read`
- no repository mutation

The permanent `AXM Code Language Organs Gate` is read-only and now directly requires:

- grammar-profile drift check
- 102 grammar-profile/planner binding test
- specialist-eye drift check
- 102 specialist-eye + Discovery Seam test
- machine-cheatcode bank drift check
- exact 102 x 50 / 5,100-rule test
- bounded inter-cheatcode influence-mesh test
- core organ/adversarial/donor checks

On no-writer head `4459f4255fe624bc557d9196d4cb9736b702a19b`, the deterministic `language-organs` job passed after the legacy host-tool census was separated into its own bounded job. This prevents slow external compiler/tool availability from cancelling the deterministic fabric proof.

`AXM LEGO City Map Gate` passed on the preceding no-writer head `11dba0fdd51b95c0b7f17a5413a520382dd5662d`; the subsequent gate-architecture-only change does not alter the City source roots.

## Code Fabric contract v0.6 boundary

The Code Fabric remains `permissions: []` and explicitly refuses, among other things:

- machine-cheatcode output as authority
- machine-cheatcode match as semantic proof
- machine-cheatcode drift as pass
- soft influence as hard activation
- soft influence as evidence
- influence count as confidence
- influence count as truth
- unbounded cheatcode propagation
- self-amplifying influence loops
- automatic action from influence

## Truth boundary

This receipt supports this statement:

> AXM has 102 grammar-bound physical machine-cheatcode banks containing exactly 50 deterministic machine-oriented micro-passes each (5,100 total), plus a bounded influence mesh that lets rules suggest other rules for inspection while preserving explicit provenance and requiring fresh evidence before any soft suggestion becomes a hard finding.

It does **not** support these stronger claims:

- the 5,100 rules are universal truths
- they guarantee good code
- they prove semantic or runtime correctness
- the 50 rules are a complete language knowledge set
- influence is creativity proof or intelligence proof
- more influence means more confidence
- AI feedback automatically rewrites these heuristics
- the fabric may autonomously choose a language, mutate a workspace, install tools, promote artifacts, or enter CANON

Capability is not authority. Mike remains the merge gate.
