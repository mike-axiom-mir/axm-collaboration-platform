# Session summary

Status: `TEST`

## Outcome

Added an additive v1.5 pure local-possession checkpoint witness after v1.4. It
adapts the existing threshold-witness pattern to the incompatible v1.4
possession-checkpoint schema and makes checkpoint modification detectable while
the original caller policy and detached witness inputs remain available.

## Exact behavior proved

- unchanged v1.4 checkpoint and current-snapshot exact validation;
- checkpoint-specific `CALLER_SUPPLIED_UNAUTHENTICATED` public-key policy;
- one through ten bounded Ed25519 witness seats with an exact caller threshold;
- distinct attestation id, actor digest and public-key fingerprint per seat;
- signatures bind checkpoint, source snapshot, receiver/challenger identity,
  receiver policy, response set, caller policy and validity window;
- witness and witnessed-continuity exact rebuild with fixed truth boundaries;
- fresh-process exact match and valid extension through unchanged v1.4
  comparison;
- relative deletion and valid receiver-signed replacement detection;
- typed absence, invalid-state and identity-drift holds with zero autonomous
  actions;
- refusal of wrong keys/signatures/bindings, insufficient or duplicate seats,
  private/non-Ed25519 keys, expired/future inputs, oversized artifacts and
  invented authority;
- public receipts omit raw actor/key/signature identifiers, configured party
  labels, state paths, custody records, assessment receipts, private keys,
  private context and model output;
- runtime performs no file, process, network or signing operation.

## Failures and counterevidence preserved

The first focused run stopped at the deliberate old-witness incompatibility
case because the assertion expected a schema-mismatch phrase while the older
validator rejected v1.4 earlier as unknown possession-specific fields. The
diagnostic expectation was widened without changing runtime behavior.

The second run completed behavioral and schema cases before a source-only check
mistook the required `privateKeyIngested: false` truth flag for a forbidden
private-key operation. The check was narrowed to signing/private-key APIs and
input fields while explicitly requiring the false truth flag. Both failed
synthetic roots were removed after exact path verification. The next full run
passed 212 checks.

The first evidence-bundle selftest then expected a fully rendered label that the
focused harness constructs dynamically from a binding-case table. The evidence
assertion was corrected to inspect the exact table field and label fragment, and
the still-uncommitted session segment was appended and resealed.

The seal utility then refused to overwrite its earlier derived seal. That stale
seal correctly failed the curation builder and verification selftest against the
longer segment, while the evidence-content selftest passed 86 checks. Only the
stale uncommitted seal was removed before regeneration; no durable event or
product evidence was deleted.

A v1.4 checkpoint can be modified and internally re-digested into another
structurally valid checkpoint. Original witness policy/signatures detect that
change. A replacement caller policy with its own keys can nevertheless witness
the modified checkpoint, so policy authority and policy continuity remain
unproven.

One synthetic controller owns keys, policy, times, checkpoint, witness inputs,
processes and state. No external witness/checkpoint retention, independent
operator, authenticated human, host trust root, trusted time, protected
monotonic state, rollback prevention or pre-checkpoint history is proved.

## Authority and status

The adapter is `TEST`, uninstalled, unpromoted and not integrated into a host.
No human review, provider execution, evaluation, adoption, benefit, learning,
promotion, merge, Foundation mutation or `CANON` decision occurred. Mike Tobi
remains merge and `CANON` gate.

## Verification

`CHECK_RESULTS.json` records 33 passing commands: 23 focused lineage checks and
the 10 required `AGENTS.md` checks, with 1,988 focused assertions. The source
snapshot binds 116 normalized inputs. Evidence selftests and a clean detached
replay are separate handoff evidence, not canonization.
