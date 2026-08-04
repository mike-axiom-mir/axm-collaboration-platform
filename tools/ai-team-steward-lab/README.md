# AXM AI Team Steward Lab

This read-only companion to the existing AXM AI Team exposes the useful portion of the Steward Runs 01–101 archive: a searchable 100-seed contract catalog, a risk-bounded review planner, and deterministic local contract preflight.

The preflight runtime ports the retained source validator into AXM and checks every seed through its family guardrails. Its parity self-check executes all 100 passing fixtures and all 100 unsafe fixtures. PASS means only that the supplied collaboration packet clears this retained local contract; HOLD returns machine-readable error codes and repair guidance.

The runtime does not start agents, call providers or connectors, grant authority, assign work, approve merges, expose private payload values, judge result quality, or modify CANON. Plans remain recommendations for human review.

Run the local checks with:

```powershell
npm.cmd run test:ai-team-steward
```
