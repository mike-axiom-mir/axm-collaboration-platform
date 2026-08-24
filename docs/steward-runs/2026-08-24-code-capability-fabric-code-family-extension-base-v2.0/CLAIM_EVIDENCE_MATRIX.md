# Claim/evidence matrix

| Claim | Minimum proof used | Result | Ceiling |
|---|---|---|---|
| Build-profile catalog exists and is structurally closed | Direct schema/catalog/module inspection plus JSON parse | PASS | Existence does not prove runtime behavior. |
| Catalog/profile/assessment bytes are deterministic | Rebuild digests and repeat normalization/assessment | PASS | Applies only to the tested pure records. |
| Profile resolution fails closed | 53-case adversarial registry selftest | PASS | Does not prove an absent family can generate code. |
| Existing JSON and HTML lanes survive the refactor | 202-case builder selftest plus all Fabric continuity suites | PASS | Generated candidate runtimes remain unexecuted in this run. |
| Tier-1 consent detects profile drift | Exact profile-catalog/profile digest drift countertests | PASS | Authenticated identity and replay-ledger proof remain unavailable. |
| Python is not falsely presented as ready | Synthetic Python profile assessment | PASS typed gap | Python generation and execution were not run. |
| Workshop remains structurally coherent | Required repository checks and deterministic City/schema/twin rebuild | PASS | The 25 known-open warnings remain visible. |
| Visual behavior changed | No visual source changed | N/A | No browser claim is made. |

The proof routes static structure to parsers/contracts, deterministic behavior
to focused execution and countertests, continuity to repository-wide suites,
and visual behavior to N/A because no visual surface changed.
