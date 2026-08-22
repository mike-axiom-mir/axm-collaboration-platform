# Evidence routes

Status: `TEST`

## `local_sender_write`

Claim: exact confirmation writes one exact bounded envelope to a fixed local
outbox and reports success only after exclusive create and file fsync.

Kind: deterministic behavior and local persistence. Risk: medium.

Pass condition: v1.0 assessment and v1.1 policy exact-rebuild; the digest-named
file contains exact canonical JSON; missing confirmation, invalid packages,
conflicting identity reuse and overwrite perform no successful replacement.

Primary surface: focused filesystem execution. Counterevidence: a write occurs
without confirmation, a file is replaced, or persisted bytes differ from the
sender receipt.

Observed evidence: exact send and all listed refusal cases pass. Verdict: `PASS`
for one caller-owned local outbox file and reported file fsync.

Named seam: the unsigned sender receipt authenticates no host and does not prove
receiver read.

## `local_sender_receiver_handoff`

Claim: a receiver reads the same canonical local envelope written by the sender,
with sender and receiver receipts bound to the same envelope and payload digests.

Kind: local transport. Risk: medium.

Pass condition: receiver child process reads the fixed outbox file, exact-rebuilds
the envelope, and emits a receipt whose sender reference, envelope digest and
payload digest match; traversal, noncanonical JSON and changed sender receipt are
refused.

Primary surface: sender file plus receiver child-process receipt. Counterevidence:
digest mismatch, receiver success without the file, or altered bytes accepted.

Observed evidence: two receiver processes read two sender files and all exact
bindings match. Verdict: `PASS` for same-host local-file handoff.

Named seam: no socket, network, other host or independent operator was involved.

## `local_receiver_custody_and_reload`

Claim: the receiver persists a signed data-minimized assessment receipt and a
fresh process can reload and verify it.

Kind: persistence. Risk: medium.

Pass condition: receiver exact-rebuilds the full transient package, persists a
record containing the assessment receipt but not assessment input/private key,
fsyncs the file, and a new process verifies record/ack signatures and stored
receipt digests.

Primary surface: receiver custody file, native signed record and fresh-process
reload. Counterevidence: missing bytes, digest/signature mismatch, reload failure,
or private/full-input persistence.

Observed evidence: alpha and beta records reload from new process instances;
corrupt record variants fail closed. Verdict: `PASS` for caller-owned local-file
custody and reported file fsync.

Named seam: reload does not re-run upstream exact verification without the
transient input and does not prove durability beyond file fsync.

## `v1.1_acknowledgement_composition`

Claim: acknowledgements generated after local receiver read remain valid inputs
to the unchanged v1.1 threshold witness.

Kind: deterministic cryptographic behavior. Risk: medium.

Pass condition: two distinct declared receiver keys sign exact v1.1 payloads and
the unchanged witness verifies both and classifies threshold met.

Primary surface: v1.2 child-process outputs routed through v1.1. Counterevidence:
signature refusal, mismatched references or below-threshold result.

Observed evidence: two acknowledgements verify and meet threshold. Verdict:
`PASS` for the declared caller policy.

Named seam: each acknowledgement still states `NO_DURABLE_RETENTION_CLAIM`; the
separate custody record is the only local persistence evidence.

## `independence_external_retention_and_rollback`

Claim: distinct PIDs, receiver keys and local roots prove independently operated
receivers, other-host delivery, external retention, retention duration, protected
monotonic state or rollback resistance.

Kind: identity, transport, persistence and authorization. Risk: high.

Pass condition: independently administered endpoints and identities, network or
other-host transport receipts, receiver-owned persistence and retention policy,
device recovery and allowed/denied rollback evidence.

Primary surface: independent receiver-native audit and storage receipts.
Counterevidence: one controller creates every key, process and root and can remove
or replace the state.

Observed evidence: the bounded self-test is exactly that counterexample. Verdict:
`FAIL` as a broad independence/external-retention/rollback claim; intentionally
not a v1.2 acceptance condition.

Named seam: a future route requires an independently operated receiver endpoint
or protected monotonic substrate with its own authorization evidence.

## `public_receipt_privacy_and_authority`

Claim: public receipts expose only bounded review evidence and grant no broader
authority.

Kind: static structure, authorization and privacy. Risk: high.

Pass condition: public receipts omit raw labels, keys, signatures, full assessment
receipts, private keys and machine paths; schemas keep identity, external state,
execution, adoption and CANON claims false.

Primary surface: serialized receipt inspection plus schema/contract checks.
Counterevidence: sensitive material or an authority flag appears in a public
receipt.

Observed evidence: focused checks pass. Verdict: `PASS` for bounded public
receipts; human review, provider execution, outcomes and governance remain
`UNKNOWN`.

Named seam: Mike Tobi remains merge and `CANON` gate.
