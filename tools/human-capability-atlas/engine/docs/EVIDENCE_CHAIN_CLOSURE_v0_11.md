# Evidence Chain Closure — v0.11.0

## Chain model

```text
repository/source bytes
  -> discovery integrity + repository snapshot
  -> source seal
  -> normalized records
  -> normalized inventory
  -> public-intake preflight
  -> exact + semantic batch plan
  -> deterministic record artifacts
  -> producer receipt per record
  -> batch receipt per batch
  -> production-run manifest
  -> full-chain verification
  -> local review / Merge Gate
```

Every arrow is independently re-verifiable. No downstream PASS upgrades a
source declaration into runtime proof.

## Implementation fingerprint

`implementation_identity.py` hashes the exact installed Module One `.py` source
and bundled runtime schemas. The stable payload also includes:

- Module ID/version;
- shared-contract version;
- Capability Record export version;
- implementation-fingerprint format version.

Plans and receipts reject a different implementation fingerprint.

This protects against running one plan with silently changed Module One logic.
It is not a signed publisher identity.

## Normalized inventory

`normalized_inventory.json` closes a subtle membership gap: an accepted-record
report alone does not prove that the normalized directory contains exactly those
records and bytes.

The inventory verifies:

- exact accepted membership;
- no extra/stale normalized files;
- no symbolic links;
- exact bytes and SHA-256;
- portable record identity;
- normalized semantic hash;
- deterministic ordering and counts.

## Public preflight

`public_intake_preflight.json` binds the complete preparation result before the
batch plan is trusted.

Its artifact binding includes the discovery report, enrichment catalog,
identity/graph analysis, role-target reports, accepted/rejected/duplicate
reports, ingestion report, intake gate, registry snapshot and normalized
inventory.

The exact preflight hash preserves the actual run evidence. The semantic hash
preserves stable meaning/layout while excluding run paths/timestamps and exact
artifact byte hashes.

## Producer closure

A producer receipt is no longer a hash of only the Capability Card.

It binds the complete generated directory and re-derives each deterministic
artifact from the card under the exact implementation fingerprint. Recalculating
the receipt after replacing a view with plausible unsupported text still fails
because the view differs from deterministic regeneration.

## Transaction semantics

Completion evidence is removed before replacement work starts.

On failure:

- the old completion receipt/manifest is absent;
- an in-progress marker remains;
- verification returns invalid/hold.

On success:

- output is atomically written;
- output is re-read and verified;
- only then is the in-progress marker durably removed.

## Full-chain verification

`production-chain-verify` revalidates:

- production manifest schema/hash/identity;
- exact and semantic plan hashes;
- implementation fingerprint;
- upstream ingestion/preflight equality;
- current normalized source alignment;
- every batch receipt;
- every producer receipt;
- every deterministic generated artifact;
- final record membership and batch hashes.

A production manifest can remain internally hash-valid while underlying
artifacts are later changed. Full-chain verification detects that distinction.

## Proof ceiling

None of these imply runtime behavior:

- declaration present;
- discovery integrity PASS;
- schema PASS;
- enrichment VERIFIED;
- producer `RUN`;
- batch `PASS`;
- `COMPLETE_VERIFIED`.

They prove evidence-chain properties only.
