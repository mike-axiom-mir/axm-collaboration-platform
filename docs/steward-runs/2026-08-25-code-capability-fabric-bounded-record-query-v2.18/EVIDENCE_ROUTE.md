# Evidence route — bounded record query v2.18

Status: `TEST` planning evidence

| Claim | Required evidence | This rung |
|---|---|---|
| An exact native recipe can emit one bounded JavaScript record-query candidate. | Recipe/catalog validation, exact builder-digest binding, deterministic package rebuild. | Focused Fabric and Code Specialist selftests. |
| The emitted hand filters, stably orders, projects, limits, and reports bounded counts as declared. | Execution evidence against exact emitted bytes in the trusted disjoint candidate-test harness, including counterexamples. | Focused adversarial proof; never executed by the Fabric itself. |
| Malformed records, accessors, unsupported predicates, type drift, duplicate query fields, and resource overrun fail closed. | Behavioral countertests plus static source inspection. | Focused adversarial proof. |
| The candidate has no provider, network, filesystem, process, environment, install, integration, publication, promotion, or CANON authority. | Contract inspection, forbidden-surface scan, and zero-authority profile assertions. | Focused proof plus existing package/recursive suites. |
| The change does not regress Workshop continuity. | All `AGENTS.md` checks, focused Fabric suites, recursive package tests, and generated registry projections. | Required before receipt sealing. |
| Visual or browser behavior works. | Actual browser render/click evidence. | `NOT_APPLICABLE`; this rung has no visual surface. |

Passing tests will establish only the tested `TEST` contract. They will not install,
integrate, promote, publish, or canonize the generated candidate.
