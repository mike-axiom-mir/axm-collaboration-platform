# AXM Grounded Evolution Intelligence — Phase 3 Diagnosis Report

Package version: **0.4.0**  
Shared contract: **0.1.0**  
Source graph: `sha256:8c6fd1e82c7ae776ecace4f2df2fa1a1bf36cddc2d038f215a4968fa94e9e9e1`

## Roadmap gate

Phase 3 implements the deterministic diagnosis engine over the retained Phase 2 graph. Every finding is reproducible from the same graph hash; every finding that maps to an existing Improvement Need carries exact retained evidence references. Candidate new needs are stored outside the canonical registry until explicit review.

## Detector results

| Detector | Status | Findings |
|---|---:|---:|
| `declared_but_unproven` | FINDINGS | 15 |
| `missing_tests` | INSUFFICIENT_DATA | 0 |
| `stale_evidence` | CLEAR | 0 |
| `orphan_module` | CLEAR | 0 |
| `orphan_capability` | CLEAR | 0 |
| `dependency_without_provider` | CLEAR | 0 |
| `duplicated_capability` | CLEAR | 0 |
| `conflicting_versions` | FINDINGS | 2 |
| `missing_human_interface` | FINDINGS | 15 |
| `missing_beginner_layer` | FINDINGS | 1 aggregated |
| `high_reach_single_point_of_failure` | FINDINGS | 6 |
| `repeated_failure_pattern` | NOT_APPLICABLE | 0 |
| `undocumented_input_output` | CLEAR | 0 |
| `excessive_resource_cost` | INSUFFICIENT_DATA | 0 |
| `unverified_build_claim` | FINDINGS | 1 aggregated |
| `unused_reusable_component` | FINDINGS | 9 |
| `unresolved_research_blocker` | FINDINGS | 3 |
| `regression_without_follow_up` | NOT_APPLICABLE | 0 |

Total: **18 detectors / 52 findings**.

## Important interpretation

The 15 `missing_human_interface` findings do **not** claim that Human Interface Intelligence lacks those interfaces. Module 2 is still an explicit external reference in this package. The findings mean only that no real Module 2 interface records have been ingested here yet. All 15 therefore map to `axm:need:import-real-module1-module2-artifacts` rather than creating fifteen fake repair jobs.

The six single-provider findings are resilience signals, not failure claims. They currently concern Evidence Desk, Technical Glasses, Workshop Packager, Body Pulse, Game Forge, and Review Inbox. A candidate need to verify high-reach single-provider behavior is generated outside canonical state for later steward review.

The `excessive_resource_cost` detector returns `INSUFFICIENT_DATA` because the current capability cost fields are not comparable numeric measurements. It refuses to turn UNKNOWN into “expensive.”

The two intervention-history detectors remain `NOT_APPLICABLE` because the closed-loop intervention corpus has not been built yet.

## Pre-merge discovery

The strongest immediate blocker for the upcoming three-module take-in is now explicit:

`axm:need:import-real-module1-module2-artifacts`

Phase 2 contained only interoperability references for Module 1 and Module 2. Phase 3 records that as an observed need and adds a dry-run intake preflight. Placeholder references are never silently treated as implementation imports.
