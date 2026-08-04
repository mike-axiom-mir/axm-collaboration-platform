# Repair & Resilience Library

This WORKING local gateway makes the 100 independently verified repair and resilience seed prototypes searchable, inspectable, loadable by local Node.js code, and self-testable. It also exposes one separately labeled authored health/telemetry integration helper, whose source contains code and a self-test but no seed manifest or contract.

The contained seeds deliberately retain their source posture: `EXPERIMENTAL` version `0.1.0`, empty permissions, no automatic mutation, and no promotion or CANON authority. The wrapper's WORKING status describes the catalog, loader, and verifier—not production certification of every repair strategy.

## Local commands

```text
node tools/repair-resilience-library/cli.js search heartbeat
node tools/repair-resilience-library/cli.js show heartbeat-lease-monitor
node tools/repair-resilience-library/cli.js test heartbeat-lease-monitor
node tools/repair-resilience-library/cli.js test-all
```

Local code can use `library.js` to inspect or load a named component. Loading exposes its API but does not authorize execution, repair, installation, process control, publication, promotion, or CANON changes.

Source provenance and intake evidence are preserved in `intakes/repair-resilience-run100`.
