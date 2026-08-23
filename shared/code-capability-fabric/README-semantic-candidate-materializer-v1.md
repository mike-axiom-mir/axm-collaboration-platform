# Code Capability Fabric — consent-bound semantic candidate materializer v1

Status: `TEST`

This v0.9 rung connects existing Workshop organs instead of replacing them:

```text
semantic candidate generator
  -> exact inert native packet and Review Card
  -> host-selected human-seat trust policy
  -> Ed25519 Tier-1 decision over the exact candidate
  -> separately signed current revocation snapshot
  -> exclusive hashed nonce reservation
  -> one new direct-child candidate root
  -> byte readback and Detached Candidate Nursery inspection
  -> path-free materialization receipt
```

The materializer supports only the existing native
`creation-review-card-adapter` recipe. It regenerates the exact semantic packet
before checking the signed decision. AI challenger materialization, arbitrary
recipes, and the v0.8 bounded-program-to-semantic-request bridge remain typed
gaps.

## What “authenticated” means here

The decision signature is verified with the exact Ed25519 seat key inside a
trust policy whose digest the trusted host selects out-of-band. Revocation uses
a distinct Ed25519 key and a signed snapshot that must be current at the
host-observed evaluation time.

This proves that the decision bytes match the selected key and policy. It does
not prove natural-person identity, informed understanding, an independently
trusted clock, or that the host selected the correct trust policy. No private
key or signing operation exists in this module.

`AUTHORIZE`, `HOLD`, and `REJECT` are equal signed human choices. Only a current,
unrevoked `AUTHORIZE` decision over the exact candidate can reach replay
reservation. A root `HOLD` or `FAIL` cannot enter the signed subject.

## Write and replay boundary

The trusted host supplies:

- one canonical existing candidate parent;
- one pre-provisioned direct-child `.axm-tier1-nonce-ledger` directory;
- one exact candidate root name derived from the packet digest;
- one selected trust-policy digest; and
- one or more canonical protected source, workspace, or evidence roots.

The parent must be disjoint from every protected root. UNC, extended-device,
dot-segment, symlink, and junction aliases are refused. Candidate and replay
files use exclusive creation. Existing candidate roots are never overwritten.

The hashed nonce reservation is written first. It survives a failed attempt,
so the same signed decision cannot be silently retried after a partial failure
or after its candidate is discarded. This replay protection is scoped to one
host-bound Nursery ledger; cross-host/global replay prevention remains outside
the claim.

A failure removes only the newly owned candidate root. It never removes the
reservation, the selected parent, source, evidence, or another candidate.

## Resource and privacy truth

The signed subject binds the seven exact candidate files and candidate bytes.
The materialization receipt measures candidate bytes, replay-reservation bytes,
receipt bytes, evidence bytes, and total written bytes. File, candidate-byte,
evidence-byte, total-byte, and one-attempt ceilings are enforced. Duration and
memory are not independently enforced and remain false in the receipt.

Durable reservation and receipt records contain digests, identifiers, bounds,
verdicts, and lifecycle truth. They omit machine paths, raw goals, source
content, prompts, stdout, stderr, credentials, and private keys.

## Authority ceiling

Candidate bytes are written as `EXPERIMENTAL` data and statically inspected by
the Detached Candidate Nursery. The materializer never imports or executes
`adapter.js`. It calls no provider, uses no network, spawns no process, reads no
Workshop source, grants no candidate permissions, and cannot install,
integrate, publish, learn, train, actuate hardware, promote, or change `CANON`.

Generated source remains `RESEARCH_ONLY_HOLD` with direct reuse disabled. Mike
remains the separate integration and reuse-rights gate.

## Focused verification

```powershell
node shared/code-capability-fabric/selftest-semantic-candidate-materializer-v1.js
```

The selftest uses generated test-only Ed25519 key pairs and operating-system
temporary directories. It materializes and inspects native candidate data but
does not run the generated candidate.

Passing the suite proves only the tested Tier-1 decision and disposable-write
contracts. Browser rendering, accessibility, candidate runtime behavior,
installation, broader domain generation, persistent learning, and higher-tier
authority remain unproven.
