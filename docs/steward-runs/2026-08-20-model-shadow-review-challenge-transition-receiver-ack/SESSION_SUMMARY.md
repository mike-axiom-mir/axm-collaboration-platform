# Session summary

Status: `TEST`

## Outcome

Added an additive v1.1 read-only receiver-acknowledgement leaf. It binds an exact
v1.0 assessment to a bounded caller policy, verifies exact detached Ed25519
acknowledgements, and distinguishes declared threshold met from an incomplete
threshold hold without filesystem, network, process, state-write, adoption, or
execution capability.

## Exact behavior proved

- exact receiver policy rebuild with unique labels and Ed25519 key fingerprints;
- exact acknowledgement binding to policy, assessment, roster, receiver, time,
  scope and `NO_DURABLE_RETENTION_CLAIM`;
- threshold-met and typed incomplete-threshold decisions;
- refusal of altered or wrongly signed payloads, duplicate or disabled receivers,
  invalid times, unknown authority fields, excessive entries and excess bytes;
- fresh-process witness rebuild with exact digest, classification and count;
- witnesses omit raw receiver labels, keys, signatures, private keys, transient
  assessment packages and machine paths.

## Counterevidence preserved

The focused fixture generates multiple Ed25519 keypairs in one Node process.
Two keys produce valid acknowledgements and meet the declared threshold while
the witness explicitly keeps real-world receiver independence, actual transport,
receiver read/application, receiver persistence, independent external retention,
protected monotonic state and rollback prevention false. Key distinctness and a
signature threshold therefore do not prove independent delivery or retention.

The first focused run failed because the generic exact-text validator rejected
the newline included by Node in canonical Ed25519 SPKI PEM. Public-key validation
was corrected to require exact equality with Node crypto's canonical export; the
full 134-check leaf suite then passed. The failure remains a durable event.

After the primary session segment was sealed, the evidence-package selftest
also exposed a brittle README phrase predicate. The evidence-only predicate was
aligned to the exact wording and passed 65 checks. A separate sealed supplement
preserves that later failure and correction without rewriting the primary seal.

## Authority and status

The leaf is `TEST`, uninstalled, unpromoted, and not integrated into a host. No
real transport, receiver, identity, human review, provider execution, evaluation,
branch adoption, benefit, learning, promotion, merge, Foundation mutation, or
`CANON` decision occurred. Mike Tobi remains the merge and `CANON` gate.

## Verification

`CHECK_RESULTS.json` records 29 passing commands: 19 focused lineage checks and
the 10 required `AGENTS.md` checks, with 1,308 focused assertions. The source
snapshot binds 77 normalized inputs. Separate evidence selftests and a clean
detached replay are handoff evidence, not canonization.
