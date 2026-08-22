# Production Integration Route

## Purpose

Adopt Aetherglass incrementally without allowing a visual layer to silently control the platform.

## Gate 0 — Preserve

- Make a platform checkpoint before adding files.
- Keep `rollback/AXM_AETHERGLASS_VISUAL_ENGINE_v3_0_0_STABLE.zip` unchanged.
- Record existing page IDs, routes, permissions, keyboard paths, and critical selectors.

## Gate 1 — Core only

Load `axm-aetherglass.css` and `axm-aetherglass.js`, mount one root engine, then test destroy. Do not add particle fields, transitions, or automatic mapping yet.

## Gate 2 — Reviewed surfaces

Use existing explicit classes or `AXMVisualAdapter` for known selectors. For unknown/legacy pages use `AXMProductionAdapter.analyze()` first. Review its exported plan. Apply only approved types or candidate IDs.

```js
const mapper = new AXMProductionAdapter({ root: document.querySelector("#app") });
const report = mapper.analyze({ minimumConfidence: 0.82 });
console.table(report.plan);
mapper.apply({ ids: approvedCandidateIds });
```

Mutation observation queues new elements by default. Do not enable `autoApprove` unless the target platform has separately reviewed that policy.

## Gate 3 — Readability

Audit first, inspect the report, then apply only where justified.

```js
const guardian = new AXMReadabilityGuardian({ root: document.querySelector("#app") });
const report = guardian.audit({ minimumRatio: 4.5 });
const repair = guardian.apply(report); // reversible
```

The guardian evaluates computed visual styles. It does not understand text meaning, importance, reading level, or full WCAG conformance.

## Gate 4 — Consistency

```js
const auditor = new AXMConsistencyAuditor({ root: document.querySelector("#app"), guardian });
const result = auditor.audit();
```

Keep audit read-only during first intake. Safe repairs remain explicit and should be reviewed by category.

## Gate 5 — Operating presets

Connect only modules that exist. Start with `daily-workspace`, `review-proof`, and `low-power`; introduce showcase states later.

```js
const vault = new AXMPresetVault(visuals, { field, lighting, scenes, transitions, surfaces, cues });
await vault.apply("daily-workspace", { transition: false, cue: false });
// ... target-platform checks ...
vault.restore();
```

## Gate 6 — Performance budgets

Keep the governor in recommendation mode first. Record actual target devices. Adaptive mode is allowed only after the target platform proves that reduced profiles restore correctly.

## Gate 7 — Finite stress and real long session

Run `AXMRuntimeSupervisor.stress()` for rapid state-switch checks. Then separately run the actual platform for a meaningful session with browser/device tooling. The supervisor's DOM observations do not prove memory safety.

## Cleanup order

1. Stop cues.
2. Cancel transitions.
3. Restore active production preset.
4. Stop runtime supervisor/watchers.
5. Restore consistency/readability repairs.
6. Roll back production/selector adapters.
7. Restore scenes and lighting.
8. Destroy interaction FX and Aetherfield.
9. Destroy the core engine last.
