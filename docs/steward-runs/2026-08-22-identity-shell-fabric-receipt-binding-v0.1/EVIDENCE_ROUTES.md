# Evidence routes

Status: `TEST`

| Claim | Claim class | Strongest evidence used | Result | Evidence ceiling |
|---|---|---|---|---|
| Build/gap receipts reject re-signed status, output, gap, schema, truth, field, and digest drift | behavioral + integrity | `receipt-boundary-selftest.js`, 13 build attacks through primary and independent gates | PASS | Static supplied receipt only; output targets are not fetched |
| Lineage receipts reject re-signed state, parent, continuity, decision, disclosure, truth, and digest drift | behavioral + integrity | `receipt-boundary-selftest.js`, 13 lineage attacks through primary and independent gates | PASS | Static supplied receipt only; referenced evidence is not fetched |
| The independent receipt verifier does not import the compiler | structural + behavioral | fresh Node process checks `require.cache`, accepts two committed receipts, rejects four re-signed variants | PASS | Module non-import is shown; implementation independence is bounded to source separation |
| Accepted continuity events require an exact acceptance contract | contract + behavioral | schema topology assertion plus create/verify rejection of `axm.fake-acceptance/v1` | PASS | Exact reference schema only; no human authentication claim |
| Authorization decisions bind their subject and evidence | contract + behavioral | wrong event, absent/wrong parent, absent/wrong/duplicate continuity, and compilation evidence-drift cases | PASS | Declarative digest binding only; actor authorship is not authenticated |
| Compilation results detect receipt replay drift | deterministic + behavioral | re-signed build and standalone lineage receipt mutations fail exact rebuild | PASS | Exact supplied inputs and v0.1 compiler only |
| The Keel trial remains deterministic after hardening | deterministic | 20 fresh trial processes, zero failures, one digest | PASS | Inert proposed shell only; no live identity or subjective continuity claim |
| The Workshop remains regression-compatible | repository + behavioral | all ten required `AGENTS.md` checks exit 0 | PASS with limits | `verify.js` retains 41 repository-wide warnings; no browser test was run |
| Live host operation, human authenticity, or runtime continuity exists | runtime + authorization | capability-gap comparison | NOT AVAILABLE | Explicit optional gaps; no inference from static receipts |

The routing rule for this run was that a valid digest could prove byte integrity but could not, by itself, prove coherent receipt meaning. Semantic claims therefore required held-out re-signed mutations through two verification implementations. No screenshot or browser evidence was routed because no UI changed and no visual claim is made.
