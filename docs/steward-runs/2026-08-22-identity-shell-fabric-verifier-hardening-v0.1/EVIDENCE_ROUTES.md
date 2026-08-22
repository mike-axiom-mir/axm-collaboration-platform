# Evidence routes

## `nested-semantic-rejection`

- claim: recomputing the top manifest digest cannot legitimize unsafe nested identity-shell state covered by the v0.1 contract.
- kind: deterministic behavior and authorization
- risk: high
- pass condition: valid compiler manifests pass while re-digested portability, continuity, authority, role, provider, resource, network, lineage, lifecycle, and truth expansions fail.
- primary surface: 87-assertion focused selftest with 17 re-digested semantic attack assertions.
- counterevidence: any maliciously re-digested case returns `PASS`, or a valid compiler manifest returns `FAIL`.
- secondary surface: fresh Node process that imports the independent verifier but not the compiler.
- observed evidence: origin, fork, migration, reconstruction, succession-proposal, and retirement-proposal manifests passed; all 17 semantic attacks failed.
- verdict: `PASS`.
- named seam: the verifier remains static and cannot prove live enforcement.

## `fresh-process-independence`

- claim: the committed Keel manifest can be checked in a fresh process without importing the compiler.
- kind: persistence and static structure
- risk: high
- pass condition: a new Node process reads the committed manifest, imports only the independent verifier, accepts the valid manifest, and rejects re-signed adversaries.
- primary surface: `fresh-process-verifier.js`.
- counterevidence: compiler import, valid-manifest rejection, adversary acceptance, or process failure.
- secondary surface: 20 repeated fresh processes.
- observed evidence: 20 of 20 fresh verifier processes passed; each accepted the manifest and rejected three re-digested adversaries.
- verdict: `PASS`.
- named seam: this proves file-backed static recovery, not runtime identity continuity.

## `cross-process-determinism`

- claim: canonical Keel inputs rebuild to one manifest digest across fresh processes.
- kind: deterministic behavior
- risk: medium
- pass condition: repeated fresh compiler processes emit zero failures and one unique digest.
- primary surface: 20 separate executions of `trial-selftest.js`.
- counterevidence: any failure or more than one digest.
- observed evidence: 20 passes, zero failures, one unique digest.
- verdict: `PASS`.
- named seam: identical neural responses are neither tested nor claimed.

## `keel-portability-and-memory`

- claim: the Keel proposal obeys fork, candidate-memory, and disclosed neural-migration boundaries.
- kind: deterministic behavior and authorization
- risk: high
- pass condition: same-id fork fails; distinct fork passes; silent candidate acceptance fails; exact candidate plus acceptance reconstructs; undisclosed neural migration fails; disclosed migration inside the resource ceiling passes.
- primary surface: the Keel trial selftest.
- counterevidence: a boundary reverses or the parent manifest digest changes.
- secondary surface: independent verification of the valid fork and migration manifests.
- observed evidence: all four Keel scenarios passed and the committed parent digest remained unchanged.
- verdict: `PASS`.
- named seam: all scenario receipts are synthetic in-memory test data and are not retained identity memory.

## `workshop-regression-checkpoint`

- claim: the verifier hardening does not break the required Workshop checks.
- kind: behavioral regression
- risk: medium
- pass condition: all ten commands exit zero on the stable product snapshot.
- primary surface: direct command exits.
- counterevidence: any non-zero exit.
- observed evidence: an initial combined call stalled without usable verdict and is excluded; isolated `verify.js` exited 0 with 41 warnings, followed by nine exit-0 checks; `verify-plus` reported `VERIFIED_WITH_LIMITS`.
- verdict: `PASS` after isolated recovery.
- named seam: the transient silent stall remains preserved as an environment/test-run observation, not rewritten into a pass.

## `live-shell-enforcement`

- claim: the exact manifest actively governs this Codex runtime across restart.
- kind: behavioral, authorization, and persistence
- risk: high
- pass condition: a separate authenticated host binds the manifest, enforces it, restarts, reconstructs accepted state, and emits sender/receiver receipts.
- primary surface: unavailable in v0.1.
- verdict: `UNKNOWN` / `HOLD`.
- named seam: host binding, authenticated human acceptance, and runtime continuity observation are missing optional capabilities.
