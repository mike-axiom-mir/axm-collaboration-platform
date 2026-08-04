# AXM AI-Team Collaboration Deterministic Assurance Proof Harness v0.4

This extends the Run-61 v0.3 harness with executable proof for:

- capability attestations that expire, revoke, and cannot self-grant high-impact authority;
- independence-aware quorum with correlated seats counted once and human veto preserved;
- handoff chain-of-custody with delivery, acceptance, start, return, and result review kept separate;
- transactional proposal sagas with compensation and irreversible-step holds;
- metamorphic testing and exact semantic evidence reuse;
- fresh, source-linked claim ledgers that hold contradictions and reopen only on new evidence;
- compatible version negotiation and authority/evidence-loss-safe adapters;
- bounded human review attention, fatigue holds, aging, and zero backlog auto-approval;
- non-retaliatory appeal and reopening with minority reports preserved;
- a release-evidence bundle capped at `READY_FOR_READ_ONLY_MANIFEST_BINDING_CANDIDATE`.

Run:

```bash
python run_all_v4.py
python -m unittest discover -s tests -v
```

Truth boundary:

- Python standard library only.
- Executes deterministic fixtures and simulations, not AXM runtime modules.
- Does not access models, connectors, private memory, devices, network, GitHub, Dropbox, or CANON.
- No release bundle can self-approve, claim runtime proof, integrate, publish, or canonize.
- Source SHA-256: `ca39b4a82ed5a9e2f9ddace06d89eb9200680401873bbc9676d22a3fa957e2ef`
- Prior complete Runs 01–61 SHA-256: `0d8e41962096db0869286baddb0f207107918d940f1f0c64322afabb1e676e7e`
