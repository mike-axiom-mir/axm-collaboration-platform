# Baseline Simulation Lab run envelope

Status: **TEST**

Representation boundary: v0.2 uses the shared strict deterministic JSON core.
Safe JSON keeps the existing canonical bytes; unsupported, cyclic, sparse, or
otherwise non-JSON state is refused instead of being dropped or rewritten.

This leaf validates one bounded simulation/research run against an exact
Portable Baseline Capsule. It does not invoke models, execute submitted source,
choose a winner, build a candidate, or continue recursively.

The envelope keeps four things separate:

1. exact artifact ancestry;
2. idea and evidence ancestry;
3. claim-specific proof routed through an Evidence Desk receipt; and
4. authority, which remains outside the model seats and candidate.

An unchanged exact baseline with no new evidence, counterexample, requirement,
failure, or staged signal returns `NO_NEW_INFORMATION`. That is a successful
stop, not permission to spend another generation.

```powershell
node shared/baseline-simulation-lab/selftest.js
```

The resulting receipt is evidence-linking material only. Passing checks do not
make the module `WORKING` or `CANON`, and do not authorize installation, merge,
publication, permission changes, Foundation mutation, or model-weight training.
