# Migration Rules

- Semantic versioning applies to the contract.
- Patch releases may clarify documentation or add non-behavioral fixtures without changing schema acceptance.
- Minor releases may add optional fields or enum values, but must include a migration note and compatibility report.
- Major releases may remove, rename, or redefine fields and require an explicit migration utility.
- No migration may invent missing capability facts.
- Lossy migration must mark affected paths `UNKNOWN` or `CONFLICTED` and report the loss.
- The migration utility refuses unregistered version transitions.
