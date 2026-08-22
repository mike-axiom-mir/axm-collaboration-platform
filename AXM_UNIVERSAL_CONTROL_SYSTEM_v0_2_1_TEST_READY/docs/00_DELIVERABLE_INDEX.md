# Deliverable index

1. System architecture overview — `docs/02_ARCHITECTURE.md`
2. Current-system inspection report — `docs/01_CURRENT_SYSTEM_INSPECTION.md`
3. Shared action schema — `schemas/action-schema.json`, `profiles/core-actions.json`
4. Device adapter specification — `docs/13_DEVICE_ADAPTER_SPEC.md`, `src/adapters/`
5. Phone layout and remapping specification — `docs/04_PHONE_LAYOUT_SPEC.md`, `src/ui/phone-controller.js`
6. Accessibility specification — `docs/05_ACCESSIBILITY_SPEC.md`
7. Game control profile format and validation — `schemas/game-control-profile.schema.json`, `src/core/profile.js`, `profiles/`
8. Context-switching model — `src/core/context-stack.js`, `src/core/action-bus.js`
9. Connection and pairing design — `docs/06_CONNECTION_PAIRING.md`, `server/reference-server.cjs`
10. Configuration persistence and migration — `docs/14_CONFIGURATION_PERSISTENCE.md`, `src/persistence/settings-store.js`
11. Migration bridge for existing games — `migrations/robo-pong/`
12. Working reference implementation — `demo/`, `server/`
13. Migrated compatibility example — Robo Pong semantic bridge and optional patch
14. Test harness — `tests/`, `tools/RUN_TESTS_WINDOWS.cmd`
15. Measurable acceptance tests — `docs/12_MEASURABLE_ACCEPTANCE_TESTS.md`
16. Developer integration guide — `docs/07_DEVELOPER_INTEGRATION.md`
17. Beginner explanation for Mike — `docs/08_BEGINNER_EXPLANATION_FOR_MIKE.md`
18. Expansion roadmap — `docs/10_ROADMAP.md`
19. Performance evidence probe — `src/core/performance-probe.js`
20. Required-phone-action coverage gate — `src/core/binding-coverage.js`
21. Static package verifier — `tools/validate-package.cjs`, `proof/STATIC_VALIDATION_REPORT.json`
22. Browser smoke harness and blocked-environment record — `tools/browser-smoke-test.cjs`, `proof/BROWSER_SMOKE_BLOCKED.json`
23. v0.2 change log — `docs/15_V0_2_CHANGELOG.md`
24. Scenario proof matrix — `proof/SCENARIO_PROOF_MATRIX.json`


## Saturday test additions

- `docs/16_SATURDAY_LIVE_TEST_CARD.md` — short two-person physical test sequence and pass/failure labels.
- `docs/17_V0_2_1_CHANGELOG.md` — exact reliability and observability changes.
- `tools/START_SATURDAY_TEST_WINDOWS.cmd` — Windows test launcher.
- `tools/START_SATURDAY_TEST.sh` — Linux/macOS test launcher.
- Host **DOWNLOAD TEST LOG** button — exports measured live evidence as JSON.
