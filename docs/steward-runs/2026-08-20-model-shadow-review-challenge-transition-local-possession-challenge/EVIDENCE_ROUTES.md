# Evidence routes

Status: `TEST`

## `signed_challenge_exact_rebuild`

Claim: one configured challenger Ed25519 key signs an exact bounded challenge
for one v1.2 custody record and policy.

Kind: deterministic cryptographic behavior. Risk: medium.

Pass condition: challenge identity, configured key fingerprint, receiver,
custody and policy references, exact 32-byte nonce, caller times, digest and
signature all exact-rebuild; changed bytes or another configured key fail.

Primary surface: focused known-input execution and Ed25519 verification.
Counterevidence: a changed nonce/reference verifies, a wrong key is accepted, or
the challenge alone claims receiver possession.

Observed evidence: deterministic rebuild and signature, nonce, reference, key,
window and tamper cases pass. Verdict: `PASS` for a caller-declared challenger
key and bounded challenge artifact.

Named seam: the key and label authenticate no real identity or independent
operator, and caller timestamps are not trusted time.

## `local_custody_reread_and_response`

Claim: answering re-reads and exact-verifies the referenced v1.2 custody record
before exclusively persisting a receiver-signed response and reporting file
fsync.

Kind: deterministic behavior and local persistence. Risk: medium.

Pass condition: exact confirmation precedes all new writes; v1.2 record, stored
receipt, policy and receiver signatures validate; response references and
signature bind the exact challenge; persisted bytes are canonical and fsynced.

Primary surface: focused local filesystem execution plus native signatures.
Counterevidence: answer without confirmation, success without the custody file,
tampered record acceptance, mismatched receiver key, or noncanonical persisted
bytes.

Observed evidence: one answer child process passes and every named refusal path
fails closed. Verdict: `PASS` for one caller-owned local state root and reported
response-file fsync.

Named seam: no directory fsync, physical-media, power-loss or device-recovery
evidence was gathered.

## `nonce_replay_refusal_scope`

Claim: one logical challenge cannot be answered twice while its fixed response
file remains present.

Kind: local state transition. Risk: high because a broad replay claim would be
misleading.

Pass condition: same challenge and same challenge with a conflicting answer time
both hit the same exclusive-create filename and are refused; a distinct nonce
creates a distinct response; truth flags name the file-presence condition.

Primary surface: repeated filesystem execution. Counterevidence: overwrite,
silent replacement, same-nonce second success, or a claim that deletion/rollback
is prevented.

Observed evidence: exact and conflicting repeats fail with
`CHALLENGE_ALREADY_ANSWERED`; a second nonce succeeds. Verdict: `PASS` only while
the local response file remains present.

Named seam: deleting or rolling back the caller-owned directory can permit reuse;
there is no protected monotonic state.

## `fresh_process_response_reload`

Claim: a new process can reload both v1.2 custody and v1.3 response files and
verify the challenger and receiver signatures.

Kind: persistence. Risk: medium.

Pass condition: a child PID distinct from answer and parent reads both canonical
files, exact-validates challenge/response/custody/policy bindings and signatures,
and emits a data-minimized reload receipt; tamper and missing files fail.

Primary surface: fresh-process filesystem reload. Counterevidence: reload uses
only in-memory state, accepts changed bytes, or omits either signature check.

Observed evidence: distinct answer and reload child PIDs and all corruption,
missing, traversal, size and time cases pass. Verdict: `PASS` for local restart
reload.

Named seam: the public receipt deliberately keeps
`freshProcessProvenByReceipt` false; PID evidence belongs to the test harness.

## `public_receipt_minimization_and_authority`

Claim: public receipts expose bounded verification references and grant no wider
authority.

Kind: static structure, privacy and authorization. Risk: high.

Pass condition: public receipts omit raw receiver/challenger labels, public keys,
signatures, full custody records, stored assessment receipts, private keys and
machine paths; schemas keep external, outcome, execution, adoption and CANON
claims false.

Primary surface: serialized receipt inspection plus closed schema and contract
inspection. Counterevidence: sensitive fields or an authority/retention flag is
present or can exact-validate as true.

Observed evidence: runtime, schema and tamper checks pass. Verdict: `PASS` for
bounded public receipts.

Named seam: the persisted non-public response package necessarily contains the
signed challenge and signatures; callers own its retention.

## `independence_time_retention_and_rollback`

Claim: separate PIDs, labels, keys, a nonce challenge and local files prove
independent parties, trusted time, another host, external retention, retention
duration, protected monotonic state or rollback resistance.

Kind: identity, authorization, transport and persistence. Risk: high.

Pass condition: independently administered identities and endpoints, receiver-
owned retention, trusted timestamp evidence, device recovery and allowed/denied
rollback attempts against a protected substrate.

Primary surface: independent receiver/challenger-native audit and storage
receipts. Counterevidence: one controller creates all keys, times, processes and
state and can remove or replace the directory.

Observed evidence: the selftest is exactly that counterexample. Verdict: `FAIL`
as a broad external or rollback claim; intentionally not a v1.3 acceptance
condition.

Named seam: the next route requires independently administered endpoints or a
protected monotonic substrate with native authorization and time evidence.

## `human_provider_outcome_and_canon`

Claim: the possession protocol proves human review, provider execution,
evaluation, adoption, benefit, learning, promotion, merge or `CANON`.

Kind: human judgment, execution, learning and governance. Risk: high.

Pass condition: native human/provider/evaluation/outcome evidence and an explicit
Mike Tobi / AXM decision at the relevant gate.

Primary surface: those missing native seats and receipts. Counterevidence: only
synthetic fixtures and a local TEST branch exist.

Observed evidence: no such action or decision occurred. Verdict: `UNKNOWN` and
outside the bounded v1.3 route.

Named seam: Mike Tobi remains merge and `CANON` gate.
