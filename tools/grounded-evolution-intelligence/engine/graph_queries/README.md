# Graph Query Commands

Run from the package root:

```bash
python graph_queries/query_engine.py capability-dependents axm:capability:live-technical-ground-truth
python graph_queries/query_engine.py overlap "technical ground truth"
python graph_queries/query_engine.py top-unproven-blocker
python graph_queries/query_engine.py largest-scope-improvement
python graph_queries/query_engine.py modules-without-current-evidence --days 30
python graph_queries/query_engine.py path axm:direction:reuse-evolution-sibling-services axm:evidence:technical-glasses-contract
```

Every result carries a truth boundary. Query output is analysis, not authority or
an accepted steward decision.
