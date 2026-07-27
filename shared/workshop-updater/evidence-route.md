# Workshop Updater evidence route

Overall outcome: the dormant check-and-stage foundation is READY; a complete automatic Workshop update remains BLOCKED at transactional install and whole-generation rollback.

## off-zero-network

- claim: Disabled updater behavior invokes no external network adapter.
- kind: authorization and transport
- risk: high
- pass_condition: a refused check while disabled leaves the injected fetch counter at zero; live state remains disabled with no candidate or staging directory.
- primary_surface: deterministic service self-test
- counterevidence: any GitHub adapter call, receipt, candidate, or staging file while disabled
- secondary_surface_if_needed: live API and filesystem inspection
- observed_evidence: fixture counter remained zero; live API reports `OFF_ZERO_NETWORK`, zero receipts, no candidate, and no staging directory.
- verdict: PASS
- named_seam: configuration state to network adapter

## canonical-commit-check

- claim: An enabled check resolves only canonical GitHub main and reads a manifest pinned to that exact full commit SHA.
- kind: deterministic behavior and transport
- risk: high
- pass_condition: fixture URLs are canonical, manifest repository and SHA mismatches are refused, and archive URLs must bind the same repository and commit.
- primary_surface: core and service self-tests
- counterevidence: configurable repository/ref, shortened SHA acceptance, redirect following, or unpinned archive URL acceptance
- secondary_surface_if_needed: source inspection
- observed_evidence: mismatch cases are refused; source constants pin repository and main; fetches reject redirects.
- verdict: PASS
- named_seam: GitHub commit receipt to release manifest

## signed-bounded-stage

- claim: AUTO_STAGE writes only a signed, exact-size, exact-SHA-256 archive below the byte limit into local updater state.
- kind: authorization, deterministic behavior, and persistence
- risk: high
- pass_condition: an Ed25519 fixture stages successfully; tampered content or manifest fails; the candidate has no apply authority.
- primary_surface: cryptographic core test plus staged-file service test
- counterevidence: unsigned acceptance, unknown key acceptance, digest mismatch acceptance, extraction, or live source write
- secondary_surface_if_needed: contract and staging-path inspection
- observed_evidence: signed fixture staged under a temporary state root; tampered signature failed; live trust key set is empty so production staging is currently held.
- verdict: PASS for the engine; current readiness is DEGRADED until a trust root is promoted
- named_seam: release trust root to archive staging

## heartbeat-due-check

- claim: Scheduled Platform Heartbeats may trigger only a due, explicitly enabled updater check.
- kind: timing and authorization
- risk: high
- pass_condition: off and not-due beats make zero network calls; server composes updater and verifier consumers from the scheduled heartbeat.
- primary_surface: fixture service test and server integration inspection
- counterevidence: manual beat network use, off-state network use, or an updater-owned private timer
- secondary_surface_if_needed: live Heartbeat API
- observed_evidence: fixture off/not-due beats made zero calls; live Heartbeat reports updater bridge `HELD_OFF` and policy `OFF_ZERO_NETWORK`.
- verdict: PASS
- named_seam: Platform Heartbeat scheduled receipt to updater due gate

## body-pulse-budget

- claim: Every explicit or scheduled updater check needs one bounded Body Pulse lease before any GitHub request.
- kind: authorization and resource safety
- risk: high
- pass_condition: the updater module is registered disabled while OFF, enabling synchronizes that module, Pulse denial produces a zero-network hold receipt, and successful fixture checks produce exactly one Pulse receipt each.
- primary_surface: updater service self-test
- counterevidence: a GitHub adapter call without a granted lease or more than one simultaneous updater lease
- secondary_surface_if_needed: live Body Pulse and updater status
- observed_evidence: two fixture checks produced two updater Pulse receipts; live updater status is OFF and its Pulse module is disabled.
- verdict: PASS
- named_seam: updater due gate to Body Pulse lease

## transactional-whole-install

- claim: A verified candidate can replace a user Workshop without losing local changes and recover after interruption.
- kind: persistence, authorization, and quality
- risk: high
- pass_condition: stopped-Hub generation build, conflict ledger, complete backup, verified boot, atomic selection, and recovery receipts exist and pass interruption tests.
- primary_surface: missing installer hand
- counterevidence: any in-place overlay, silent conflict overwrite, partial update, or unverified restart
- secondary_surface_if_needed: independent fresh-copy and failure-injection drills
- observed_evidence: no qualifying hand exists; candidate state is `STAGED_HELD_FOR_INSTALLER` and apply authority is `NONE`.
- verdict: FAIL / BLOCKED
- named_seam: staged archive to live Workshop generation

## whole-generation-rollback

- claim: A failed update can restore the exact prior Workshop generation without network access.
- kind: persistence and recovery
- risk: high
- pass_condition: one complete prior generation, digest-bound switch receipt, stopped-Hub rollback, and restored boot proof exist.
- primary_surface: missing rollback hand
- counterevidence: partial file backup, automatic rollback, digest drift, or deletion of both generations
- secondary_surface_if_needed: power-loss and corrupted-generation drills
- observed_evidence: no qualifying whole-generation rollback hand exists.
- verdict: FAIL / BLOCKED
- named_seam: update selection to launcher recovery
