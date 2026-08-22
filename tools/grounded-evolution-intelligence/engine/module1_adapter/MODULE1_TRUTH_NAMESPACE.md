# Module 1 Truth Namespace Adapter

Module 1 machine tokens are preserved exactly:

- `known`
- `inferred`
- `unknown`
- `conflicted`
- `not_applicable`

`CONFIRMED` is rejected as a Module 1 machine token.

Module 3 must retain both the raw token and its namespace. Default cross-module
ceilings are deliberately conservative:

| Module 1 token | Default Module 3 ceiling | Reason |
|---|---|---|
| `known` | `DECLARED` | Known can mean known within source/declaration scope; it is not runtime proof. |
| `inferred` | `INFERRED` | Preserve reasoning, source basis, confidence and evidence reference. |
| `unknown` | `UNKNOWN` | Missing evidence stays visible. |
| `conflicted` | `CONFLICTED` | Preserve all credible claims; no silent winner. |
| `not_applicable` | no direct flattening | Preserve applicability metadata separately. |

A separate reproduced runtime receipt may raise a Module 3 proof state. Module 1
processing alone cannot do that.
