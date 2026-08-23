# Evidence route

| Claim | Evidence used | Result | Ceiling |
|---|---|---|---|
| Identical native inputs are deterministic | Two exact in-memory rebuilds and canonical comparison | PASS | Tested fixtures only |
| Candidate source and lineage are byte-bound | SHA-256, byte length, canonical base64, bundle and packet rebuild checks | PASS | Static data only |
| Native-only works without AI or network | Native fixture, empty authority declarations, static entry-point inspection | PASS | No provider call was attempted |
| AI remains a separate challenger | Exact provider/observation/route fixtures and unranked comparison assertions | PASS | Host observer authenticity is not proven |
| Permission and network expansion fail closed | Manifest/contract mismatch and network-declaration adversarial cases | PASS | Current candidate contract is networkless |
| Four-root `HOLD` or `FAIL` cannot become `PASS` | Adversarial request mutations and deterministic reseal | PASS | Referenced root evidence content was not opened |
| Input and output byte ceilings are enforced | Sealed-request and complete-result under/over-budget cases | PASS | Duration and memory are not independently enforced |
| Candidate paths are portable on Windows | Traversal, drive, UNC, ADS, device, trailing alias, normalization, and case-collision cases | PASS | No filesystem materialization occurred |
| Generated adapter is syntactically valid | Parse-only `vm.Script` construction | PASS | Candidate was not imported or executed |
| Review card is visually and interactively usable | Browser render/click evidence | UNRUN | No live Review Inbox surface changed |
| Candidate runtime behavior is correct | Disposable sandbox evidence | UNRUN | Executor is not authorized |
| Installation or integration succeeded | Mike-controlled target action | UNRUN | Branch remains review-only |

Passing static and deterministic evidence does not prove runtime quality,
visual quality, human acceptance, legal reuse rights, installation, integration,
promotion, or `CANON`.

