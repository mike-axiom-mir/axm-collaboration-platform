# Code Capability Fabric contract-repair steward run v0.6

Status: `TEST`

This run adds one bounded capability: inspect three exact Workshop contract files, plan a deterministic legacy-manifest repair, and materialize detached alternatives for human review. It does not select, execute, test, write back, install, integrate, publish, promote, or canonize a candidate.

The observed target was `tools/browser-lan-hardware-qa-lab/manifest.json`. Direct inspection corrected the starting hypothesis: the legacy record omitted both `schema` and `kind`, not only `kind`. The recipe therefore applies only when both properties are absent and all other admitted preconditions hold. Additional defects produce `HOLD`.

The planner emits five equal alternatives using the currently admitted manifest kinds: `adapter`, `machine-capability`, `product`, `scaffold`, and `service`. Static manifest and module-contract validation pass for every alternative, while semantic fitness remains `UNKNOWN` and machine ranking remains `null`.

In scope:

- closed request, observation, plan, candidate, and durable-receipt schemas;
- pure deterministic planning and exact resource declarations;
- byte-bound source, generator, plan, packet, and output lineage;
- Windows path, alias, traversal, ADS, reparse-point, overlap, stale-source, duplicate-key, malformed-record, and forged-lineage rejection;
- detached append-only source/output/evidence roots;
- a script-free loopback review surface with explicit authority controls;
- focused, required, and actual browser interaction evidence.

Out of scope:

- choosing which `kind` is semantically correct;
- executing a generated candidate or its required test commands;
- repairing or authorizing a disposable executor;
- writing to the observed target;
- installation, integration, publication, promotion, or `CANON`;
- resolving direct-reuse rights;
- modifying the active recovery checkout.

Technical source commit: `662af77f59d1456e76d96ea628ee630070a11e14`

Base assumption: `cf9145f980c1c6f732aae71e4a8d1f1c6f6aac59` (Fabric v0.5). Integration must target a clean Mike-selected ref that contains this base.
