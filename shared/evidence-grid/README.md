# AXM LEGO City Evidence Grid

Status: **EXPERIMENTAL**

The grid wraps domain-specific payloads in one outer receipt without flattening
their schema. It tracks source snapshots, verifier labels, correlation,
causation, expiry, partial state, unknowns, and conflicts. Receipt presence and
hash identity are not correctness proof.

Warning baselines bind both the source snapshot and verifier version. A mismatch
is `STALE`, and baseline renewal data requires an authority-decision reference.
This block does not authenticate verifier identity or grant authority.
