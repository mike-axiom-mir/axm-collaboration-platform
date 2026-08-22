# AXM Capability Interface Shared Contract — v0.1.0

This folder is an independent dependency shared by:

- AXM Human Capability Atlas
- AXM Human Interface Intelligence

Consume it in place or as a versioned package. Do not copy fields into either module and privately redefine them.

## Entry points

- Capability schema: `schemas/capability-interface-contract.schema.json`
- Recommendation schema: `schemas/interface-recommendation.schema.json`
- Evidence annotation schema: `schemas/evidence-annotation.schema.json`
- Terminology: `docs/TERMINOLOGY.md`
- Atlas integration: `docs/INTEGRATION_ATLAS.md`
- Shared fixtures: `fixtures/`
- Validator: `validators/validate.py`
- Compatibility checker: `validators/compatibility.py`
- Migration framework: `migrations/migrate.py`
