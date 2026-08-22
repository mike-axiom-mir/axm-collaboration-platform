# Evidence routes

Status: `TEST`

| Claim | Pass condition and primary evidence | Counterevidence / boundary |
|---|---|---|
| A v2.4 pin is a strict self-digested commitment to one exact v2.2 package | Parsed schemas plus focused exact derivation, validation, tamper, and unknown-field tests | Self-validation authenticates neither who made nor who retained the pin |
| A presented pin matches the previous package across receipt, checkpoint, normalized policies, ledger identity, and full histories | Runtime recomputes every binding and reports exact drift dimensions | A caller may replace the pin and both packages together |
| v2.3 pairwise classification is composed unchanged | v2.4 rebuilds a v2.3 receipt from the exact same two packages and exposes its digest/classification | Pairwise success remains relative to presented data and excludes no withheld branch |
| Only forward extension or exact-history recheckpoint may produce a successor-pin proposal | Closed v2.4 classifier and adversarial replay, upstream-hold, pin-mismatch, forward, and recheckpoint cases | A proposal is data, not retained state or adoption authority |
| Retaining the original pin exposes joint replacement of both presented packages | Focused counterexample presents a jointly replaced pair against the original pin and receives a typed hold | Replacing the pin together with the pair remains internally valid and is preserved as counterevidence |
| Runtime is pure, bounded, and data-minimized | Source inspection, size-limit cases, receipt scans, and ledger tree digest | Caller inputs still contain public policies/signatures and the module stores nothing |
| Broader grounded-growth authority remains open | Capability comparison, contract refusals, truth fields, and counterexamples | No authenticated origin, retention, monotonic store, global log, provider execution, evaluation, human benefit, learning, promotion, merge, or `CANON` evidence |

Browser render/click evidence is not applicable to this pure nonvisual Node.js adapter with no browser route or visual surface.
