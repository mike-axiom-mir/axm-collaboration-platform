
# AXM AI-Team Collaboration Deterministic Governance Proof Harness v0.3

This extends the Run-51 v0.2 harness with executable proof for:

- delegated authority, target, privacy, deadline, and depth conservation;
- context minimization and privacy-taint propagation;
- lineage-based independence and correlated-consensus detection;
- parent/child resource accounting and deterministic fairness;
- proof-graph invalidation and exact evidence reuse keys;
- explicit, fresh, scoped, and reversible human decisions;
- incident stop propagation and authorized restart;
- identity-safe provider/node failover and split-brain holds;
- public-safe disclosure and unsupported-claim rejection;
- a model-free reference dry-run orchestrator that cannot self-approve, integrate, or make CANON.

Run:

```bash
python run_all_v3.py
python -m unittest discover -s tests -v
```

Truth boundary:

- Python standard library only.
- Executes deterministic fixtures and simulations, not AXM runtime modules.
- Does not access models, connectors, private memory, devices, network, GitHub, Dropbox, or CANON.
- The dry-run orchestrator emits proposals and receipts only; it cannot approve, integrate, publish, or canonize.
- `READY_FOR_LOCAL_INTAKE_CANDIDATE` is not integration or runtime proof.
- Source SHA-256: `ca39b4a82ed5a9e2f9ddace06d89eb9200680401873bbc9676d22a3fa957e2ef`
- Prior complete Runs 01–51 SHA-256: `63621318e96305a3acf59b016fc13d83accdda22840f1bb26ab4c121c38ee6ca`
