# Production Preset Vault

Built-in states:

| Preset | Purpose | Budget |
|---|---|---|
| `daily-workspace` | Calm ordinary platform use | Workspace |
| `deep-focus` | Dark clarity and minimal motion | Workspace |
| `creation-flow` | Warm creative energy | Balanced |
| `review-proof` | Evidence and verification reading | Accessibility |
| `live-command` | Active operating space | Balanced |
| `presentation-showcase` | Demonstrations and launches | Showcase |
| `celebration` | Finite completion/reveal state | Showcase |
| `low-power` | Static opaque fallback | Low Power |

Preset definitions are data, not executable code. Unknown top-level, engine, or field keys are rejected. Custom persistence is disabled by default and, when enabled, remains local and namespaced.

The first `apply()` captures the prior engine, scene, field, lighting, budget, and owned surface state. `restore()` returns to that captured composition. Target-platform state outside Aetherglass ownership remains outside the vault's control.
