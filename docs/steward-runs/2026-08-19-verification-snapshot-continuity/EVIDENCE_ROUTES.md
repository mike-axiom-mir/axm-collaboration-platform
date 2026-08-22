# Evidence routes

Status: `TEST`

| Claim | Native proof surface | Current verdict | Cannot prove |
| --- | --- | --- | --- |
| Historical receipt body is intact | Declared self-digest exact rebuild | Per-entry `VALID` or explicit hold | Historical broad-report bytes exist |
| Current tracked source is byte-identical | Raw current file SHA-256 versus historical source reference | Per-path exact comparison | Semantic equivalence or regression |
| Drift is limited to the mutable broad report | Every non-derived tracked source matches, exact report path/schema/digest boundary | `MUTABLE_DERIVED_VIEW_DRIFT_ONLY` only when all checks pass | Current broad verification passed |
| Tracked source changed | Exact digest mismatch retained with both digests | `TRACKED_SOURCE_DRIFT` | Whether the change is good, bad, intended, or unsafe |
| Current evidence set is complete | Exact historical/current path-set equality | `PASS` or hold | Files omitted before the historical receipt was made |
| Historical receipt was preserved | Pure module plus lane-local current portfolio | `PASS` | External copies were not changed elsewhere |
| Current broad state | Shared report metadata observed as data | `OBSERVED_NOT_REVERIFIED` | Browser behavior, human benefit, or CANON |

Counterevidence includes an invalid or absent historical self-digest, missing or
extra current paths, conflicting source references, an unrecognized report path
or schema, or any tracked-source digest mismatch hidden under mutable-report
drift.

