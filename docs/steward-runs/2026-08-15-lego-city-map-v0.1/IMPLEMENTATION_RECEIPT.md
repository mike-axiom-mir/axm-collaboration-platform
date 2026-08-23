# LEGO City Map v0.1 implementation receipt

Status: **EXPERIMENTAL — VERIFIED WITH LIMITS**

This receipt covers Phase 0 only: discovery, deterministic compilation,
generated views, omission/drift refusal, and the repository verification hook.
It does not claim that the remaining LEGO City infrastructure exists.

## Source and semantic intake

- Observed implementation base: `a4f99fbfc05268173458bf3fb8f3fe616919e376`.
- Platform intake package: `AXM_LEGO_CITY_GROUNDED_BUILDMAP_v0_1_LOCAL_INTAKE.zip`.
- Sealed semantic intake: 70 valid JSONL events, 0 invalid lines.
- Semantic intake SHA-256: `13f7f644026c9bd98172587cac5f2e7c6cb52fb1ebc59b839fe030702c2e2e01`.
- Mirror alignment: 115 archived organs were classified as inferred candidates;
  no organ was installed, executed, promoted, or granted authority.

The intake's capability comparison marked the Phase 0 compiler/proof route
`READY`; runtime schema resolution, artifact/event storage, authority
enforcement, workflows, sync, twins, intake, and external gates remained
`DEGRADED` or `OPTIONAL_UNKNOWN` and are not claimed here.

## Phase 0 result

- Declaration snapshot: `62c3898d7dc2b1f6c9138a03b0a88e5f16a2b69c9527445579b1618854b52346`.
- City graph: `b3d3cd19d1fa36348a62184820c0c5e03a04b0db56d7a5b098eeac280b4f5e39`.
- Generated graph contains 228 blocks, 1,929 capabilities, 395 schema IDs,
  31 resolved edges, and 1,508 unresolved edges.
- All 1,508 unresolved edges remain visible; none were guessed closed.
- Generated authority grants are empty. Availability is never authorization.
- The committed graph uses declaration/source bytes as its snapshot identity.
  The live command reports observed Git `HEAD` separately to avoid a
  self-referential commit-hash loop.

## Evidence route

| Claim | Evidence | Result |
|---|---|---|
| Declared modules are represented | live discovery plus `UNINDEXED_MODULE` negative test | PASS |
| Human and machine views agree | byte-exact regeneration plus `HUMAN_VIEW_DRIFT` negative test | PASS |
| Source/config changes cause drift | source digests plus `CITY_GRAPH_DRIFT` negative test | PASS |
| Duplicate logical identities are refused | `DUPLICATE_BLOCK_ID` negative test | PASS |
| Missing strict schemas are refused | `UNRESOLVED_SCHEMA` negative test | PASS |
| Declared effect permissions cannot silently disagree | `EFFECT_PERMISSION_DRIFT` negative test | PASS |
| Authority view cannot silently diverge | `AUTHORITY_MAP_STALE` negative test | PASS |
| Default committed output avoids Git self-reference | unbound-source and explicit-source tests | PASS |
| Runtime behavior or UI works | no browser/render/click test was run | NOT CLAIMED |
| Safety, correctness, promotion, merge, or CANON | map evidence cannot prove these | NOT CLAIMED |

Focused City Map verification passed 32 assertions. All ten required Workshop
commands exited successfully. `verify.js` reported 537 passes, 0 failures, and
43 warnings; those warnings remain visible as legacy readiness/promotion/index
limitations. `hub/verify-plus.js` reported `VERIFIED_WITH_LIMITS`.

## Authority receipt

```text
installed: false
executed-discovered-modules: false
network-write: false
promoted: false
merged: false
canonized: false
roots-changed: false
```

Mike Tobi remains the review, merge, promotion, and CANON gate.
