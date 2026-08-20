# Shadow Specialist package intake stewardship run

Status: `TEST`

This milestone treats the supplied `AXM_MIRROR_SHADOW_SPECIALIST` v0.1 and
v0.2 ZIPs plus their intake note as data. The packages were structurally
inspected, independently hashed, and compared without loading their modules,
running their tests, installing dependencies, or modifying a backend.

The package knowledge is useful. Fresh epochs, evidence-kind separation,
explicit observation-loss holds, source intake before stewardship,
common-mode lineage fields, and an external promotion gate are grounded design
patterns. The supplied runtime is still held because static review found exact
file-set, privacy enforcement, evidence-authentication, independence,
resource, compatibility, and license gaps.

AXM already has the stricter safe route:

```text
external artifact digests + static evidence + disclosed contributor seat
  -> Research Contribution Intake
  -> Baseline Simulation Lab planning projection
  -> future explicit challenger decision
```

The resulting native assessment is
`READY_FOR_BASELINE_SIMULATION_PLANNING`. That is not a simulation run,
backend-install decision, code-transplant approval, provider test, learning
claim, human-benefit claim, promotion, merge, or `CANON` decision.

Run the evidence checks with:

```powershell
node docs/steward-runs/2026-08-20-shadow-specialist-package-intake/build-shadow-specialist-intake.js
node docs/steward-runs/2026-08-20-shadow-specialist-package-intake/selftest.js
node shared/research-contribution-intake/selftest.js
node shared/model-shadow-continuity/selftest.js
node shared/model-shadow-challenger-gate/selftest.js
node shared/grounded-growth-challenger-lab/selftest.js
node tools/branch-module-return-gate/selftest.js
```

No browser surface changed, so browser render/click testing is not applicable.
Mike remains the merge and `CANON` gate.
