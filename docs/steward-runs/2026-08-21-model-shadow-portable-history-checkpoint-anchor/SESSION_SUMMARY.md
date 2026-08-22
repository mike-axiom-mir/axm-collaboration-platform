# Session summary

Status: `TEST`

v2.2 adds two caller-presented cryptographic layers above the v2.1 portable
settlement-history checkpoint. The first exact-rebuilds a checkpoint-specific
witness policy and verifies a bounded threshold of detached Ed25519
attestations. The second exact-rebuilds an anchor policy, matches a
caller-presented expected digest over the checkpoint/witness/policy/set
commitment, and verifies detached Ed25519 authorizations.

The combined receipt refuses reuse of any verified SPKI fingerprint or declared
principal digest across the two layers. Public receipts retain only references,
counts, and domain-separated set commitments. They contain no PEMs, signatures,
private keys, ledger paths, model output, or private context. The runtime writes
nothing, opens no network route, generates no key, and accepts no private key.

The audit exact-rebuilds the complete anchored package before composing the
unchanged v2.1 read-only relative-history classifier. Focused tests cover exact
and absent/held audit states plus fresh-process rebuilds.

The red-team boundary is decisive. One process can generate every distinct key
and declared digest, so observable non-overlap proves no controller independence,
human participation, or collusion exclusion. A different self-valid checkpoint,
new policies, new keys/digests, new signatures, and a new expected anchor also
form another valid relative package. The seam therefore proves no authenticated
origin or pin, retention, protected monotonicity, rollback prevention, atomicity,
global consistency, provider execution, evaluation, learning, human benefit,
permission, adoption, promotion, merge, or `CANON`.

All 38 recorded commands passed with 2,718 focused assertions, including all ten
AGENTS.md commands. Browser render/click verification is not applicable because
the module has no visual surface.
