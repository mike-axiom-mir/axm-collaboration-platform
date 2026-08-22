# Migration from v2 to v5

v5 preserves the v2 modular core while adding v3 visual composition, v4 production safeguards, and v5 authoring contracts. A v2 platform can remain core-only and adopt later organs gradually.

## Safe route

1. Preserve the live v2 platform and its preference data.
2. Store the packaged v2 checkpoint separately.
3. Replace matching core files with v5 files without enabling optional production or authoring modules.
4. Run the old platform tests and `tests/smoke.html`.
5. Review visual differences before enabling any new scene, material, mapping, token pack, or blueprint.
6. Add modules one at a time with explicit selectors and a rollback test after each addition.
7. Run `tests/authoring.html` only after the authoring modules are deliberately mounted.

## Ownership boundary

Do not convert existing panels into local recipes, reroute semantic events, infer user state, or apply a blueprint without review. Preview and validation are read-only; application requires explicit approval.

## Rollback

Destroy v5 modules in reverse dependency order, restore the complete v2 source/preferences checkpoint, and rerun the platform’s original tests.
