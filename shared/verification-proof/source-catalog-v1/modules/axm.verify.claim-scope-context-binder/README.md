# Claim Scope and Context Binder

Detached AXM Verification & Proof organ for seed 002.

It binds a typed claim to exact declared artifact versions, environments, devices, datasets, configurations, time windows, and exclusions. It does not infer missing context or claim that a partial binding is complete.

## Truth boundaries

- Unknown top-level dimensions are refused rather than silently reinterpreted.
- Required dimensions are supplied by the caller or verification profile.
- Missing required dimensions remain explicit.
- Binding IDs are deterministic hashes of the claim identity and normalized context.
- The module does not inspect devices, files, datasets, or environments.
- A complete binding is not evidence that the bound facts are true.

## Reference API

- `validate_context(context)`
- `ClaimScopeContextBinder(required_dimensions).bind(claim, context)`

Status: TEST-HOLD, detached, v0.1.0.
