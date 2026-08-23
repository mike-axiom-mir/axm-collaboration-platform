# Code Recipe Foundry → Fabric bridge v1

Status: `TEST`

This bridge gives the provider-neutral Code Capability Fabric deterministic,
bounded access to the installed 1,000-entry Code Recipe Foundry catalog. It is
not Code Mirror, RepairBuddy, a provider, an executor, or a universal code
generator.

The bridge accepts only exact requester-specified `CC-####` source identifiers.
It does not claim the requester is an authenticated human. It
verifies the catalog, canonical recipe-set, syntax-audit, and Foundry-contract
digests before emitting an `axm.code-recipe-selection-packet/v1`.
The complete selection request is embedded and byte-bound inside the packet so
the chosen identifiers, mode, roots decisions, sources, and resource ceilings
can be checked without trusting an unattached request reference.
The installed selection entry point requires that complete sealed request. Only
the explicitly named test-fixture helper constructs synthetic root evidence.

Two modes exist:

- `REFERENCE_ONLY` emits metadata and snippet digests but no snippet text. Any
  structurally retained recipe may be inspected this way.
- `DETACHED_RESEARCH_CONTEXT` emits snippet text only when the recipe is not on
  structural hold and the installed parse-only audit says `SYNTAX_PASS`.

Both modes preserve `RESEARCH_ONLY_HOLD`, `directReuseAllowed: false`, unverified
source and license claims, and zero execution or lifecycle authority. Syntax
evidence proves only parsing in the named synthetic context. It does not prove
runtime behavior, correctness, security, suitability, or reuse rights.

The semantic generator may bind one exact selection packet into its request and
candidate lineage. v1 does not rewrite generated source from snippets; actual
recipe composition remains a separately typed future recipe and consent step.

Run:

```powershell
node shared/code-capability-fabric/selftest-code-recipe-fabric-bridge-v1.js
```
