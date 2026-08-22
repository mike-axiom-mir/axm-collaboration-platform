# Migration from v3 to v5

v5 preserves the v3 visual-world architecture, includes the v4 production safeguards, and adds optional authoring contracts. A v3 integration can migrate gradually without enabling every later organ.

## Safe route

1. Preserve the current platform and v3 package as independent rollback checkpoints.
2. Replace matching core files with v5 files, but mount only the core modules already used by the platform.
3. Run the platform’s existing v3 tests, then the packaged v5 smoke tests.
4. Add production organs individually and preview mappings before approval.
5. Add authoring organs individually only when visual contracts and token ownership are useful.
6. Verify mount/destroy, scene restoration, mobile overflow, reduced motion, opaque mode, and later platform-owned changes.

## Preferences

v5 uses `axm-aetherglass-v5-preferences`. v3 preferences are not silently copied. Import only reviewed values through an explicit migration step.

## Rollback

Stop/destroy v5 authoring and production organs in reverse dependency order, restore the v3 files and preferences, and rerun the platform’s own tests. Do not mix a partially restored v3 core with v5 optional organs.
