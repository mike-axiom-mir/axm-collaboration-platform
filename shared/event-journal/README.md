# AXM LEGO City Event Journal

Status: **EXPERIMENTAL**

The journal stores canonical JSONL records in an append-only SHA-256 chain.
Each event retains correlation, causation, actor, subject, authority-decision
reference, evidence references, and its domain payload schema. Events record
occurrences; they never grant authority.

Readers fail on invalid JSON, incomplete tails, sequence drift, hash drift, or
duplicate event IDs. Projections are rebuilt by replay. v0.1 exposes no rewrite,
delete, or automatic repair function.
