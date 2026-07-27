# Workshop Needs Observatory

This module compares exact declared needs with exact installed capabilities and reviewed modular-intake candidates. Similar wording never silently proves that a capability exists.

Its declaration-drift audit is deterministic and read-only. Every refresh checks each top-level tool folder for a valid `manifest.json`, declared ID and entry, existing entry file, and typed module contract. Findings are classified as blocking, review, or legacy modernization work.

The Observatory also composes the generated `tools-index.json` into an `axm.workshop-readiness-view/v1` view. It recomputes the current source digest and review queue from module declarations, contracts, top-level self-tests, and the latest self-test receipt before showing any review candidate. Missing, malformed, or stale evidence becomes a visible hold with an empty candidate list.

“Ready for review” means only that current structural and self-test evidence is ready for Mike to inspect. It does not mean approved, promoted, CANON, authorized, or accepted as satisfying a Workshop need. This read-only view never changes need state.

The audit may name a missing declaration and re-check it after repair. It never invents a contract, registers a folder, installs a component, promotes a candidate, or closes a need automatically.

Run it without the UI:

```powershell
node tools\workshop-needs-observatory\audit.js
```

Use `--json` for a machine-readable receipt. The command exits non-zero only for blocking declaration failures; review and legacy findings remain visible without breaking unrelated work.

Focused checks:

```powershell
node tools\workshop-needs-observatory\readiness-composition-selftest.js
node tools\workshop-needs-observatory\declaration-audit-selftest.js
node tools\workshop-needs-observatory\selftest.js
```
