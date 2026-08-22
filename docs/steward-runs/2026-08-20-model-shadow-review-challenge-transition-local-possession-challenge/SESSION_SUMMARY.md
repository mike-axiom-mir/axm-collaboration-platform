# Session summary

Status: `TEST`

## Outcome

Added an additive v1.3 local possession challenge reference after v1.2 custody.
It advances one-time local storage into a signed, nonce-bound reread and response
protocol without converting local controller evidence into an external claim.

## Exact behavior proved

- deterministic signed challenge bound to one v1.2 custody record, v1.1 policy,
  receiver, configured challenger key, exact 32-byte nonce and bounded caller
  window;
- exact confirmation before the only new side effect;
- canonical v1.2 custody reread and unchanged record/policy/signature validation;
- receiver-signed data-minimized response, exclusive create and reported file
  fsync;
- repeat and conflicting answer refusal while the response file remains present;
- distinct nonce acceptance under a distinct fixed filename;
- fresh-process reload of both custody and response with both challenge and
  response signature verification;
- refusal of path traversal, missing/noncanonical/oversized files, wrong keys,
  altered signatures/references, invalid times, response tamper and overwrite;
- public receipts omit raw labels, keys, signatures, custody records, assessment
  receipts, private keys and machine paths.

## Failures and counterevidence preserved

The first complete focused run reached schema inspection before an assertion
looked for response truth at `properties.truth` rather than its `$defs.truth`
schema. Runtime behavior had passed, but the run was not accepted. The assertion
was corrected, the exact failed synthetic temp root was removed, and the full
suite passed 160 checks. Source review then added state-root symlink rechecks and
explicit signing-KeyObject validation.

All keys, labels, timestamps, processes and state remain controlled by one
synthetic test. Existing-file refusal lasts only while that file is present;
deletion or rollback can permit reuse. No independent party, trusted time,
network, other host, external retention, retention duration, protected monotonic
state or rollback resistance is proved.

## Authority and status

The adapter is `TEST`, uninstalled, unpromoted and not integrated into a host.
No human review, provider execution, evaluation, branch adoption, benefit,
learning, promotion, merge, Foundation mutation or `CANON` decision occurred.
Mike Tobi remains merge and `CANON` gate.

## Verification

`CHECK_RESULTS.json` records 31 passing commands: 21 focused lineage checks and
the 10 required `AGENTS.md` checks, with 1,621 focused assertions. The source
snapshot binds 98 normalized inputs. Evidence selftests and a clean detached
replay are separate handoff evidence, not canonization.
