# AXM LEGO Software City v0.1 final build receipt

Status: **EXPERIMENTAL — VERIFIED WITH LIMITS**

This receipt covers the staged implementation on branch
`codex/lego-software-city-v0.1`. It does not merge, promote, install, publish,
or canonize that branch.

## Source identity

- Base commit: `a4f99fbfc05268173458bf3fb8f3fe616919e376`.
- Covered implementation commit: `0cab12b09789503e9fc5e0fd55d6e35941f1dc5c`.
- Phase commits before this receipt: 7.
- Receipt commit: intentionally unbound; a commit cannot contain its own hash.
- Sealed semantic intake SHA-256:
  `13f7f644026c9bd98172587cac5f2e7c6cb52fb1ebc59b839fe030702c2e2e01`.
- Intake events: 70 valid JSONL events, 0 invalid.
- Mirror alignment retained: 115 archived organs, all
  `INFERRED_UNCONFIRMED`, none installed or executed.

## Built city

All twelve grounded infrastructure blocks have bounded local implementations:

1. Live City Map;
2. Schema Registry;
3. Artifact Depot;
4. Event Journal;
5. Authority Grid;
6. Hands Rail;
7. Workflow Transit;
8. Evidence Grid;
9. Local Sync;
10. Twin Surfaces;
11. Intake Harbor;
12. City Gates.

The seven common contracts are registered: `axm.block-view/v1`,
`axm.city-graph/v1`, `axm.artifact-ref/v1`, `axm.event/v1`,
`axm.decision/v1`, `axm.receipt/v1`, and `axm.route/v1`.

Current generated identities:

- graph: `9ade59d2008f9f124b151be71fd16e7d79014ceb1bc0558c7f161e5348ceb1c7`;
- schema registry: `ba28514737f1ecb7a8df2a4af2dd5682d9ef5f0545dbd0dcfedbef13fe5ba4a0`;
- human/machine twin: `0adcb6d32f19d25f619a6a74fcef45f2f3e0fe0306420cfc4ad0783acf0d08ec`.

The graph records 239 blocks, 1,993 capability sockets, 427 schema identities,
32 resolved edges, and 1,532 unresolved edges. The 622 unresolved schema
sockets and remaining capability sockets stay explicit; they were not guessed
closed. Twin coverage is 239 machine packets and 239 human labels.

## Verification

The final committed-state audit ran 21 commands and all 21 passed:

- eight focused city/conformance commands;
- three generated-view drift checks;
- all ten Workshop commands required by `AGENTS.md`.

Focused City suites passed 181 assertions. `verify.js` reported 543 passes,
0 failures, and 43 warnings. The verification spine reported
`VERIFIED_WITH_LIMITS`, with 0 failures and 0 holds. The 43 warnings remain
visible: principally legacy manifest-kind backlog, stale promotion evidence,
and the pre-existing tools index drift warning.

The changed-diff scan found no machine-local AXM paths, user-profile paths,
bridge tokens, authorization headers, or key-shaped `sk-` strings. The isolated
worktree was clean after the implementation commits.

## Truth and authority boundary

```text
installed: false
executed-imported-code: false
real-executor-bundled: false
external-transport-bundled: false
external-gates-enabled: false
network-write-performed: false
public-release-performed: false
promoted: false
merged: false
canonized: false
roots-changed: false
```

Passing local tests proves the named deterministic behaviors and negative
boundaries only. It does not prove complete JSON Schema semantics, OS-level
confinement, authenticated identity, distributed convergence, crash durability
on every filesystem, external protocol interoperability, browser behavior,
artifact safety, or compatibility of the 115 Mirror organs.

Mike Tobi remains the review, merge, promotion, and CANON gate.
