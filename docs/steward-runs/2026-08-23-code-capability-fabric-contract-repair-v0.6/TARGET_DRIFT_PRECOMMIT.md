# Target drift snapshot before evidence commit

Observed recovery checkout:

- branch: `codex/workshop-recovery-fabric-integration-20260822`
- HEAD: `dadd8a9f87c2cf70a7c444244483ee853276e745`
- status entries: 2,445
- tracked changes: 245
- untracked entries: 2,200
- scoped target files changed by recovery: 3

The three scoped target paths are the manifest, module contract, and selftest under `tools/browser-lan-hardware-qa-lab/`. This steward run read them as source data and did not edit them.

The recovery HEAD does not contain the Fabric v0.5 base `cf9145f980c1c6f732aae71e4a8d1f1c6f6aac59`. Its merge base with technical commit `662af77f59d1456e76d96ea628ee630070a11e14` is `03e1899f92ad52bdca6b988ad5ce13e75adbaf2b`, with observed divergence `7 19` (recovery-only, v0.6-only).

Verdict: `HOLD` for direct integration into the active recovery checkout. Review is safe; integration must wait for a clean Mike-selected target that already contains Fabric v0.5, followed by a fresh drift/ancestry check.
