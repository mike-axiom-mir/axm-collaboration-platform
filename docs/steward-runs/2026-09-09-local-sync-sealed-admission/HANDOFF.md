# Local Sync sealed admission handoff

Status: **EXPERIMENTAL / HOLD for human review**

## Lane identity

- Repository: `mike-axiom-mir/axm-collaboration-platform`
- Base: `main` at `2338e8e40c916b18f666446408ee811c3fd1441d`
- Branch: `automation/local-sync-sealed-admission-20260909-1426`
- Scope: `shared/local-sync` input admission and its compiler-owned City projections
- Merge, promotion, and CANON authority: none

## Reproduced truth gap

The base implementation recomputed the presented merge rule and never checked
its supplied `ruleDigest`. A rule sealed as `IMMUTABLE` could be changed to
`LAST_WRITER_NOT_ALLOWED` while retaining the old digest; base Local Sync
accepted it and returned `HOLD` instead of the sealed rule's `CONFLICT` path.

Observed against the exact base implementation:

```json
{"base":"2338e8e","sealedSemantics":"IMMUTABLE","presentedSemantics":"LAST_WRITER_NOT_ALLOWED","staleDigestAccepted":true,"outcome":"HOLD"}
```

The same boundary also admitted snapshots without the schema-required digest
by silently constructing a fresh one during `merge()`.

## Implemented contract

Local Sync v0.2 now requires three independently sealed inputs:

1. both `axm.state-snapshot/v1` envelopes;
2. one `axm.merge-rule/v1` envelope;
3. one caller-owned `axm.merge-admission/v1` pin naming the expected namespace
   and exact rule digest.

Admission rejects schema drift, missing or extra fields, invalid or stale
digests, non-canonical parent order, rule substitution, namespace mismatch, and
values outside the portable JSON domain. It also refuses ambiguous non-string
IDs in append-only state.

No result is applied or persisted. A valid digest proves integrity and exact
selection, not the identity or authority of the claimed owner.

## Compatibility

This is an explicit v0.1-to-v0.2 caller migration. Existing state and rule
schema identities remain v1, but unsealed objects no longer enter `merge()`.
Callers must construct an admission pin from trusted configuration and pass it
as the fourth argument. The repository had no production caller outside the
Local Sync self-test at the base commit.

## Verification receipt

- Base failure reproduced with the exact `origin/main` source.
- Focused Local Sync self-test: 42 assertions pass.
- Local Sync plus twin-surface integration: 54 assertions pass.
- JavaScript syntax and JSON parsing: pass.
- Compiler-owned City graph, schema registry, and twin views regenerated.
- Full City Map gate: pass across 318 blocks and 745 schema identities.
- Public discovery: pass across 219 modules and 2,048 declared capabilities.
- Repository-required direct checks: pass; `verify.js` reports 0 failures and
  retains 43 known warnings after index regeneration.
- Aggregate `npm test`: reached an inherited public README license-wording
  assertion owned by open PR #76; both the README and test are unchanged here.
- Continued broad suites reached two host/dependency limits in unchanged code:
  `uv_interface_addresses` is unavailable to Device Handoff in this container,
  and the pinned `wasm-vips` factory is not loaded for Animated Web. These are
  not recorded as passes.

## Overlap note

Open PR #77 owns the Workshop credential-file packaging boundary. It does not
touch Local Sync source or semantics. Both lanes regenerate the same City view
files, so whichever merges second must rerun the three City compilers; this is
derived-output overlap, not semantic overlap.
