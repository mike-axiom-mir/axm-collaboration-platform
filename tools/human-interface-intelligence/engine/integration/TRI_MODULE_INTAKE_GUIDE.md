# AXM Three-Module Intake Guide — Module 2 v0.6.0

This guide prepares **AXM Human Interface Intelligence** for local intake beside the Human Capability Atlas and Grounded Evolution Intelligence without coupling their internal implementations.

## Intake order

1. Run the clean-bundle verifier before copying anything into local AXM.
2. Verify Module 2's `integration/dependency_lock.json`.
3. Confirm the standalone shared contract is still byte-identical to accepted `0.1.0`.
4. Validate the latest Module 1 stable anchor before consuming Capability Records.
5. Validate every capability against the shared schema and every context against the module context rules.
6. Run the authoritative paired/cross-module gate.
7. Keep a decision receipt beside every generated recommendation.
8. Run Recommendation Assurance before treating a recommendation as implementation-ready.
9. Produce intake health, pattern coverage, and evidence observations.
10. Retain blocked or failed material as quarantine signal, never executable truth.
11. Run robustness probes only in shadow/advisory mode.
12. Hand Module 3 evidence-backed observations and signal packets with authority markers intact.
13. Persist locally only through AXM's own approved merge/storage authority.

## Three distinct outcomes

- **Gate status** answers whether the record and boundary are consistent.
- **Recommendation status** answers whether a suitable interface can be recommended directly, conditionally, or not at all.
- **Assurance status** answers whether the selected interface is ready to implement without unresolved controls, tools, budget, accessibility, preview, confirmation, or dependency work.

A gate `PASS` does not imply execution authority. An assurance `REVIEW` does not silently rewrite the recommendation; it names the remaining implementation work.

## Commands

```bash
python -m axm_hii.cli verify-lock
python -m axm_hii.cli registry-check
python -m axm_hii.cli context-check <fixture-or-context.json> --fixture
python -m axm_hii.cli recommend <fixture-or-input.json> --fixture
python -m axm_hii.cli assurance <fixture-or-input.json> --fixture
python -m axm_hii.cli receipt <fixture-or-input.json> --fixture
python -m axm_hii.cli intake-audit <handoff.json>
python -m axm_hii.cli signal-lab <handoff.json>
python -m axm_hii.cli paired-gate <handoff.json> --anchor <latest-module-one-anchor.zip>
```

`signal-lab` may complete even when its nested authoritative gate is blocked. Consumers must inspect `authoritative_audit`; lab completion is not recommendation success.

## Historic Module 1 boundary

The previously supplied Module 1 anchor is packaged under `tests/fixtures/` solely as a portable, non-authoritative regression fixture. It remains blocked by the documented contract identity conflict. Do not use it as the latest Module 1 authority during local intake.

## Module 3 surfaces

Module 2 can provide:

- `evolution_observations` derived from authoritative gate evidence;
- `quarantine_signal_packet` for observed blocked/failed intake;
- `shadow_signal_packet` for bounded synthetic sensitivity and coverage findings;
- Recommendation Assurance findings for implementation gaps.

All are advisory and disable automatic canon, automatic code change, and execution authority.

## Intentionally unfrozen

- Atlas explanation wording, course logic, categories, and internal architecture;
- Module 3's internal evolution model;
- future interface pattern additions;
- future shared-contract versions through explicit migration;
- local signal-store and registry wiring;
- rendered UI implementation.
