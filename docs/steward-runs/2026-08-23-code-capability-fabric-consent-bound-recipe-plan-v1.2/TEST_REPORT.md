# Test Report — Consent-Bound Recipe Planning v1.2

Status: `PASS` for the bounded `TEST` milestone

| Surface | Result | Evidence boundary |
| --- | --- | --- |
| v1.2 focused suite | 87 checks passed | Structure, determinism, installed lineage, mapping, consent drift, Windows aliases, resource limits, source/authority truth ceilings |
| Fabric continuity | 25 of 25 scripts passed | Existing Fabric contracts and behavior remain compatible |
| Code Recipe Foundry | 61 checks passed | Installed 1,000-entry catalog contract remains intact |
| Foundry discovery seam | Passed | Fabric still binds the installed Foundry discovery seam |
| Required Workshop commands | 10 of 10 passed | Exact `AGENTS.md` command set |
| `verify.js` | Exit 0; 22 warnings | Warnings preserved as baseline, not represented as passes |
| Static checks | Passed | JavaScript syntax, JSON parsing, and diff whitespace |
| Browser render/click | N/A, not run | No UI or visual claim was added |
| Runtime execution | Not run | Planner milestone is static and inert by contract |

The result proves only that exact eligible metadata, declared mappings, and
grounded scope can produce the reviewed inert plan shape deterministically. It
does not prove semantic fitness, source reuse rights, authenticated human
decision, implementation correctness, candidate creation, runtime behavior,
installation, or integration.
