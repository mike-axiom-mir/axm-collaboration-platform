# Mirror Code Clone

## Steward hold: repair prototype is not the future Code Mirror role

Mike clarified on 2026-07-27 that **repair needs stability** while coding needs
**story and innovation**. RepairBuddy owns stability-oriented repair. A future
**Code Mirror originates new capability-bearing code stories**. Its human view
explains the new experience or possibility; its machine view contains the
executable capability contract, disposable candidate, and verification
evidence. They are two views of one trace. Story is creative context and a
design constraint; it is never truth, evidence, permission, a release gate, or
CANON. A story without working capability is a concept, while capability
without story and intent lineage is machinery, not Code Mirror innovation. The
current v0.2 body below is therefore
preserved as a role-mismatched repair experiment, not treated as the intended
innovation clone. Its fourteen repair candidates remain reviewable historical
evidence; they must not be relabelled or trained as Code Mirror innovation.

The future innovation body is not built. It needs its own proposal-only
contract, attributed story-brief lineage, a declared new-capability contract,
an executable disposable candidate, independently authored held-out capability
behavior, story-coherence, novelty, and usefulness exams, regression and
authority canaries, and human review
before any transfer. The machine-readable direction and current honest hold
are recorded in `role-direction-v1.json`.

Mirror Code Clone is the first deliberately narrow coding body in the Mirror lineage. It can choose and make a code/configuration repair without a named target, but only inside a disposable candidate root carrying its marker.

Its first allowlisted repair class is exact module-permission parity: when a modern module contract requests a permission that its manifest forgot to declare, the clone may add only those already-requested permission strings to the candidate manifest. It cannot invent a permission or touch an unrelated field.

Its second allowlisted repair class adds a missing `permissions: []` completeness field without granting authority or changing any other manifest value. The hourly heartbeat uses this class to turn real Workshop backlog items into reviewable candidate drafts.

## Hourly draft queue

Scheduled heartbeat beats may ask Body Pulse for at most five Code Clone draft leases per rolling hour. Each lease:

1. selects the smallest unseen allow-listed improvement without receiving a module target;
2. stages only a disposable candidate beneath `exports/mirror-code-clone/candidates/`;
3. verifies the bounded change and proves source SHA-256 stayed identical;
4. submits the exact candidate digest to the shared review inbox with two required seats;
5. leaves apply, install, promotion, GitHub, and publishing unavailable.

The review item waits for up to seven days even when no operator is present. The first scheduled beat after its expiry archives it as `EXPIRED` while retaining evidence. Unchanged source fingerprints are not drafted twice.

## Run the autonomous trial

```powershell
node tools/mirror-code-clone/mirror-code-clone-cli.js trial
```

The trial creates an unseen-at-selection-time candidate nursery in the operating-system temp folder, mixes healthy and defective modules, invokes the clone without a target, and independently checks its chosen result. The printed receipt identifies what changed, the verifier result, and the exact before/after hashes.

## Candidate boundary

A candidate root must:

- live below the operating-system temp folder, or below `exports/mirror-code-clone/candidates/`;
- contain `.axm-mirror-code-clone-candidate.json` with schema `axm.disposable-code-candidate/v1`;
- contain no symlink on the selected module or repair path.

The Workshop source root, `shared/mirror-core`, `museum/first-mirror/original`, pure Mirror, installation, promotion, publishing, networking, and CANON are outside this body's write authority. A successful candidate is evidence for human review, not a promoted repair.

Run `node tools/mirror-code-clone/selftest.js` for boundary, discovery, repair, receipt, and rollback checks.
