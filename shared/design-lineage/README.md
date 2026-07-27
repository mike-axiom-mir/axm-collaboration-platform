# AXM Design Lineage

This deterministic core turns compact, provenance-bearing design observations into
an append-only evidence ledger. It exists so old visual pressure tests, rejected
variants, corrections, and reusable design lessons can remain useful without
turning screenshots, complete chats, or generation history into permanent memory.

It performs only evidence-safe operations:

- exact canonical deduplication;
- repeated-lesson detection without claiming semantic identity;
- visible conflict detection by subject and criterion;
- exact or partial provenance labelling;
- review-required visual-vocabulary candidate extraction.

It never scores taste, merges contradictions, edits source artifacts, promotes a
rule into Asset Fabric, or retains raw images/video/chat transcripts. Those remain
separate human and machine review decisions.

Run the focused verifier:

```powershell
node tools/design-lineage-lab/selftest.js
```

