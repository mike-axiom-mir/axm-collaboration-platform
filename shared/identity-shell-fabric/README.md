# AXM Identity Shell Fabric

Status: `EXPERIMENTAL`

This leaf is a deterministic compiler for portable, provider-independent identity shell contracts. It does not create a personality, invoke a model, attach a live connector, execute tools, control a robot, authenticate a human, accept memory by itself, establish consciousness, or make lineage effective.

The core separation is:

```text
identity shell != neural model != capability != body
```

The v0.1 route is:

```text
strict user-authored blueprint
  + exact inert adapter/body descriptors and digests
  + explicit authority and resource envelope
  + exact continuity, lineage, and human-decision references
  -> deterministic validation and composition
  -> canonical inert shell manifest
  -> lineage receipt plus build/gap receipt
  -> separate future adapter host, executor, verifier, and human gate
```

`COMPILED` means only that the declared data contracts align. `HOLD` preserves a typed missing-evidence, authority, contract, or resource gap. Neither result is runtime proof, identity continuity proof, personhood, subjective continuity, installation, promotion, inheritance, or `CANON`.

## Contracts

The strict, versioned schemas live in `schemas/`:

- identity root: chosen display metadata, purpose, roots, authority, disclosure, ownership, and export policy;
- continuity policy and hash-chained continuity events: candidate memory, accepted events, dissent, retention, reconstruction, migration disclosure, rollback, and `UNKNOWN` continuity. An accepted event must name a digest-bound external `axm.human-acceptance/v1` reference; the fabric validates the reference contract but does not authenticate the human;
- inert adapter and body descriptors: declared roles/interfaces and evidence ceilings, with no code loading or actuation;
- resource envelope: requested and permitted compute, memory, storage, time, network, energy, and actuation limits; `UNKNOWN` compiles to `HOLD`, never unlimited;
- shell blueprint and compiled manifest: exact component digests, canonical JSON, provider-independent descriptors, and no hidden defaults;
- lineage receipt: origin, fork, migration, reconstruction, succession proposal, retirement proposal, and exact parent digests;
- build/gap receipt: compiled outputs or typed unresolved gaps without a runtime claim;
- human decision receipt: a digest-bound declarative input for succession or retirement proposals. The compiler explicitly does not authenticate its human authorship and never makes the proposal effective.

## Deterministic API

```js
const Fabric = require('./identity-shell-fabric');

const result = Fabric.compileShell({
  blueprint,
  descriptors,
  parentManifests: [],
  continuityReceipts: [],
  humanDecisionReceipts: []
});

if (result.status === 'COMPILED') {
  const bytes = Fabric.exportManifest(result.manifest);
  const imported = Fabric.importManifest(bytes);
  const verification = Fabric.verifyCompilation(input, result);
}
```

All timestamps, identifiers, choices, and evidence references are caller inputs. Compilation does not read clocks, environment variables, account state, sessions, chats, files, networks, models, or devices. The compiler uses the Workshop deterministic JSON core and Node's SHA-256 implementation only.

The primary manifest verifier rechecks compiler-only attachment invariants before import or export: an adapter and body must both remain present, descriptor identities must remain unambiguous, component permissions and resources must fit the shell envelope, continuity must fit policy retention and history order, and lineage evidence must be present in the declared continuity state. The independent verifier in `independent-verifier.js` deliberately does not import the compiler. It checks the same exported manifest boundaries through a separate implementation. Its evidence ceiling is static manifest verification only.

The verifier also re-validates nested semantics rather than trusting a freshly recomputed top digest: identity disclosures and ownership gates, unbound provider state, exact component roles, non-coerced resource requests, network/actuation ceilings, empty-versus-reconstructed continuity, lineage/lifecycle coupling, portability flags, and every inert truth field. Standalone build/gap and lineage receipts now have both primary and compiler-independent verification functions. Human authorization receipts must internally couple the decision, subject event, exact parent, and continuity evidence; the compilation replay then binds those references to the proposed lineage input. Malformed independent-verifier input returns `FAIL` instead of throwing.

## Fixtures and portability proofs

Synthetic fixtures provide two unbound neural adapter descriptors and two inert body descriptors:

- `neutral-neural-alpha` and `neutral-neural-beta` emit proposals only;
- `software-workspace-body` exposes software observation/output interfaces;
- `robotic-observer-body` demonstrates a robotic-class observation boundary while actuation remains unavailable.

No fixture copies or imitates an existing person, AI identity, account, chat, session, or private memory. The adversarial selftest compiles origin, fork, migration, body swap, adapter swap, export/import, reconstruction, and a synthetic succession proposal. The synthetic human decision exists only in test memory and is not an authenticated real-world decision.

The `examples/keel-workshop-collaborator/` trial is separate from the synthetic fixtures. It is an AI-proposed, human-reviewable shell for the Workshop-assigned Keel role with a disclosed Codex technical substrate. Its committed manifest is rebuilt and independently verified by `trial-selftest.js`; it remains inert, unbound, unaccepted as human identity state, and non-canonical.

Run:

```powershell
node shared/identity-shell-fabric/selftest.js
node shared/identity-shell-fabric/schema-selftest.js
node shared/identity-shell-fabric/adversarial-corpus-selftest.js
node shared/identity-shell-fabric/receipt-boundary-selftest.js
node shared/identity-shell-fabric/examples/keel-workshop-collaborator/trial-selftest.js
node shared/identity-shell-fabric/examples/keel-workshop-collaborator/fresh-process-verifier.js
node shared/identity-shell-fabric/examples/keel-workshop-collaborator/fresh-process-receipt-verifier.js
```

The schema selftest verifies the local `$ref` graph and the published lifecycle, lineage, component-class, continuity-state, receipt-status, human-decision, uniqueness, and finite-retention clauses. The held-out manifest corpus re-signs 26 structurally plausible attacks and requires rejection by the primary verifier, independent verifier, export gate, and import gate. The receipt-boundary corpus exercises coherent COMPILED/HOLD receipts, standalone lineage verification, exact human-acceptance references, and re-signed build and lineage attacks through both primary and independent gates.

## Refused boundaries

- unknown fields, implicit coercion, unstable ids, digest substitution, and ambiguous component versions;
- permission, identity-scope, resource, network, memory, or actuation expansion through attachment;
- adapter code loading, model/provider execution, tool execution, network use, filesystem writes, and robotic commands;
- generated or neural output becoming memory, identity state, verification, authority, or truth without an allowed acceptance event;
- fork identity-id reuse, hidden model/connector swaps, lineage without exact parents, and succession without exact continuity plus a human decision receipt;
- secrets, machine paths, session/task/chat ids, private chats, raw prompts, transcripts, hidden reasoning, and email-shaped personal data in export;
- self-installation, self-inheritance, self-promotion, Foundation mutation, or `CANON`.

Provider-independent does not mean value-free. A blueprint must state its roots, authority, ownership, disclosure, and neutrality position explicitly; `defaultsApplied` is always empty in v0.1.

## Held future surfaces

The visual blueprint editor, live adapter host, provider execution, authenticated human-decision service, operating-system isolation, and robotic actuation remain separate capability and authority gates. No browser or visual claim is made by this phase, so browser render/click verification is `NOT_RUN`.

`compatibility/compatibility-proposal.json` describes non-mutating future seams for the Code Capability Fabric and descendant garden experiments. No registry, Hub, Foundation, parent fabric, garden, or moving branch is edited by this leaf.
