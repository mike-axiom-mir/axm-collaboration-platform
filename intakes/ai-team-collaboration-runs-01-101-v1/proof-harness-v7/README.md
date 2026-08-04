
# AXM AI-Team Collaboration Deterministic Proof Harness

This standard-library-only harness is the evidence-producing continuation of Steward Run 31.

It contains:

- one compiled registry entry for each of the 100 modular seeds;
- 100 valid fixtures and 100 seed-linked adversarial fixtures;
- deterministic family-level invariant validation;
- append-only SHA-256 receipt chains and replay;
- stop, revoke, expiry, and explicit resume controls;
- corruption detection and known-state recovery;
- redacted read-only human projections;
- sparse impact selection with full-suite escalation for root/critical changes;
- ten compound adversarial scenarios;
- a complete unittest suite.

Run from this directory:

```bash
python run_all.py
python -m unittest discover -s tests -v
```

Evidence boundary: passing this harness proves only that these generated schemas, fixtures, validators, controls, receipts, replay paths, projections, and scenarios behave as tested. It does **not** prove integration with AXM runtime code, models, connectors, devices, private memory, production use, or CANON status.

Source SHA-256: `ca39b4a82ed5a9e2f9ddace06d89eb9200680401873bbc9676d22a3fa957e2ef`
Registry digest: `84352014e54359d4a48af731c92e6d002bb0ec8ac9386ad4808fefae609694bb`
