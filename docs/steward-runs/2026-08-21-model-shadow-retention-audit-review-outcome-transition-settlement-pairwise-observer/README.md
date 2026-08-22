# v3.8 transition-settlement pairwise-observer evidence

Status: `TEST` · installed: `false` · promoted: `false`

This folder binds the v3.8 normalized source snapshot, deterministic capability
comparison, 56-command verification receipt, five claim-to-evidence routes, and
a sealed ordered session segment.

The bounded result is a read-only observer over two caller-presented v3.7 local
frontiers. Each side requires equal bracketing settlement snapshots, an exact
v3.7 caller-package rebuild, no pending proposal, and a match to the current
last settlement receipt and head. All seven side observations and all eight
pairwise classifications execute.

Compatible admitted sides distinguish exact replay, matching settled heads,
either direction of one latest-receipt extension, different heads at the same
local epoch, and different local epochs whose relation is unresolved. Matching
heads do not prove matching histories. Different epochs are not called a fork
without complete histories.

This is co-presented local evidence only. v3.8 does not recapture either live
v3.6 source, authenticate the roots as independent, compare complete histories,
observe withheld frontiers, or make its two root observations atomic. A jointly
replaced pair can produce another exact replay.

No external custody, global uniqueness, protected monotonic state, rollback
prevention, trusted time, actual human review, benefit, learning, execution,
adoption, promotion, merge, Foundation mutation, or CANON is proven.

Browser verification: not applicable. No browser surface changed.

Independent Draft 2020-12 schema meta-validation: unrun. Python `jsonschema`,
Ajv, Hyperjump, and Node `jsonschema` were unavailable; no dependency was
installed. Runtime validation and recursive closed-object topology checks pass.

Mike Tobi / AXM remains the merge and `CANON` gate.
