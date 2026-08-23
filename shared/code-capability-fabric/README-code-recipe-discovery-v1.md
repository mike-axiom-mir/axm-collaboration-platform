# Code Recipe Discovery v1.1

Status: `TEST`

This provider-neutral, permissionless adapter turns a bounded metadata query
into evidence over the exact installed 1,000-entry Code Recipe Foundry catalog.
It adapts the useful metadata-discovery idea from GitHub PR46 without merging
the donor implementation or weakening the integrated v1.0 lineage gate.

The request carries normalized search terms and optional exact metadata
filters. It also binds the installed catalog, syntax audit, Foundry contract,
resource envelope, purpose, and four-root decisions. The output separates
eligible evidence from held evidence and includes snippet digests only—never
snippet text. Every packet keeps source reuse at `RESEARCH_ONLY_HOLD` with
`directReuseAllowed: false` because source and license claims remain unverified.

Ordering is a deterministic mechanical match order. It is not a quality rank,
semantic judgment, recommendation, or selection. The packet always contains
`selection: null`. To use a result, a caller must create a separate exact
`axm.code-recipe-selection-request/v1` naming the chosen `CC-####` identifiers.

The adapter does not execute snippets, call providers, inspect a workspace,
verify source or license claims, generate candidates, install, integrate,
promote, or change `CANON`.

Run:

```powershell
node shared/code-capability-fabric/selftest-code-recipe-discovery-v1.js
```
