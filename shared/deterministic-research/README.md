# Deterministic Research Foundry

This subsystem turns explicit goals and current Workshop evidence into a reproducible research backlog. It composes existing Workshop Direction, module contracts, the capability-gap hand, module seam audit, and evidence-router hand. It does not replace the Discovery Engine; it gives Discovery and future reasoning builders precise questions and proof obligations.

The machinery is deterministic at the decision layer: the same semantic goal and Workshop snapshot produce the same `researchDigest`. Observation timestamps and filesystem locations are recorded but excluded from that semantic digest.

## Run

```powershell
node shared/deterministic-research/cli.js
node shared/deterministic-research/cli.js --goal path/to/goal.json
node shared/deterministic-research/cli.js --direction <saved-direction-id>
```

Outputs live under `exports/deterministic-research/latest/` as JSON, Markdown, a Workshop snapshot, an empty evidence ledger, and a run receipt.

## Boundaries

- Exact identifiers close capability requirements; token overlap is only a research lead.
- A declared capability is not runtime proof.
- Every gap receives a falsifiable question, a provisional route, counterevidence, and a cheapest test.
- Contradictory observations become `CONFLICT`; they are never averaged into confidence.
- Builder and steward queues remain separate.
- Nothing is assigned, executed, installed, authorized, promoted, published, or made canonical automatically.
