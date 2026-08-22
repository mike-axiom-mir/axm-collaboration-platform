# Migrating from v6 to v7.1

v7.1 includes the v7 hardening plus the optional Luminous Layer Forge and offline Product Design workflow. It remains source-compatible for normal engine, scene, field, authoring, Storycraft, and capture use. Review these deliberate changes:

1. Preference storage uses axm-aetherglass-v7-preferences; v6 preferences are not silently imported.
2. getConfig() now includes palette. Applying a config palette replaces prior engine-owned palette slots.
3. Runtime Supervisor connects the full v7 organ set and no longer marks a successfully restored stress run as cancelled.
4. Decorative effects return a skipped result under reduced/off motion. Do not assume a pulse node is always created.
5. Journey dwell is no longer shortened by motion preference. Set journey speed explicitly when a faster narrative is desired.
6. Capture readiness remains false while observable animations are running.
7. Workbench preview reports transitionAvailable and cueAvailable; application blocks invalid dependencies.
8. Demo journeys default to manual stepping. Enable autoplay explicitly.
9. Luminous Layer Forge is not mounted by the core. Include and mount it explicitly when the target needs the additional light planes.
10. The offline Product Design workflow is a separate local helper and does not edit runtime files automatically.

The packaged v7.0 rollback contains the earlier v6 checkpoint. Keep v7.0 until the target platform passes its own browser, accessibility, lifecycle, and visual-regression checks.
