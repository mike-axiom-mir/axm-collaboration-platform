# AXM Challenge Arena v0.6 Threat Model

## Assets protected

- locked challenge, rubric, roster, review policy, and task budgets;
- sealed source inputs and candidate artifacts;
- independent-build boundary;
- reviewer assignment and exact reviewer packet;
- deterministic results and external receipts;
- blind-label ordering evidence;
- review evidence, abstentions, dissent, and minority preferences;
- append-only event history, recovery sidecars, and rollback branches;
- final human authority.

## Material threats and controls

### Packet or rubric drift

Control: lock-time hashes, immutable packet sidecar, acknowledgements, event binding, and integrity verification.

### Stale or changed candidate bytes

Control: manifest parity, file count/size/hash checks, immutable revisions, pre-test and pre-review revalidation.

### Self-voting or reviewing an unassigned candidate

Control: reviewer-specific assignment and packet, self-label exclusion, exact label validation, assignment hash, and review packet hash.

### Reviewer scores detached from evidence

Control: configured minimum evidence references per scored criterion; target validation against declared artifacts, checks, and manifest roots; explicit observations marked as such.

Residual risk: a reference can be real while the interpretation is weak, biased, or dishonest.

### Forced certainty

Control: criterion abstentions and tied ranking tiers. Missing evidence does not require a fabricated score or strict order.

### Meaningless ranking influence

Control: a ballot must compare at least two distinct candidates before first-choice or rank-point signals are counted. Unequal ranking opportunity disables ranking tie-break influence.

### Candidate prompt injection or reviewer manipulation

Control: hash-bound authority protocol, explicit untrusted-evidence framing, bounded heuristic scanner, and non-punitive treatment.

Residual risk: scanners can miss attacks and flag innocent content; a capable reviewer can still be socially influenced.

### False but self-consistent diagnostics

Control: v0.4 recomputes candidate diagnostics and content-safety reports from verified sealed artifacts. A recalculated self-hash cannot make semantically false evidence valid.

### Blind-label manipulation after seeing candidates

Control: a random seed commitment is recorded at lock. After voting, the seed is revealed and the blind map is reproduced from sealed submissions.

Residual risk: a local administrator with private filesystem access may read the seed before reveal; artifact content can reveal authorship.

### Forged specialist measurement

Control: exact challenge/submission/hash binding and optional HMAC signatures.

Residual risk: HMAC proves key possession and payload integrity, not truthful measurement.

### Seat impersonation, duplicate claims, or availability bias

Control: immutable participant-bound task cores, optional one-time bearer-token leases, contextual token hashes, heartbeat caps, retry/dead-letter history, task receipts, and semantic orchestration verification.

Residual risk: bearer-token possession authorizes that lease; protect the token. Self-reported cross-vendor usage may be inaccurate. Missing, expired, failed, cancelled, or over-budget seats remain operational evidence and are not silently translated into poor candidate scores.

### Hostile candidate execution

Control: execution off by default; bounded command gate; separate external runner seam.

Residual risk: the Arena is not a sandbox. Hostile code requires a real VM/container boundary.

### Path traversal, symlink escape, archive ambiguity, or cross-platform collisions

Control: strict portable path/name checks, symlink rejection, ZIP member validation, duplicate destination detection, size/ratio budgets, and hash checks.

### Tampered or hostile transferred evidence ZIP

Control: no-extraction standalone verification, strict ZIP/JSON limits, duplicate and portable-collision checks, exact manifest file set, per-file hashes, challenge-tree and semantic-state hashes, canonical event-chain reproduction, JSONL projection agreement, and integrity-report binding.

Residual risk: internal bundle consistency is not an external identity signature. Compare the bundle SHA-256 through a separately trusted channel when sender authenticity matters.

### Interrupted local mutation

Control: workspace lock, atomic replace, write-ahead journal, exact event-bound sidecars, recovery command, event-bound checkpoints, and an exact resumable marker when historical JSONL events are canonicalized.

Residual risk: this is local filesystem coordination, not distributed consensus over unreliable network storage.

### Automatic canon or destructive import

Control: recommendation and merge maps are proposed-only; bridge sync cannot finalize; final decision is explicit; downstream import is outside Arena authority.

## Non-goals

The Arena does not claim:

- perfect anonymity;
- complete prompt-injection, malware, or plagiarism detection;
- proof of reviewer honesty or self-reported worker usage;
- proof of rights/licensing from byte provenance alone;
- semantic correctness of a signed external measurement;
- safe execution of hostile code;
- distributed consensus;
- semantic merge correctness;
- external sender authenticity from an internally self-hashed bundle alone;
- automatic deployment, publication, or canon.

## Operator obligations

- keep v0.3 rollback artifacts when upgrading;
- run untrusted code inside a real sandbox;
- protect external-runner secrets, seat bearer tokens, and private workspace access;
- inspect evidence gaps, abstentions, dissent, and diagnostics rather than only the winner label;
- preserve source and rights provenance;
- make final imports and destructive actions explicitly and outside automatic sync.


## v0.5 additional threats

### Reviewer infers own candidate from label namespace
Control: v0.5 uses opaque aliases, withholds the reviewer-own alias, and hides the complete live alias set from public observer output. Boundary: candidate content can still self-identify.

### Stale worker overwrites a newer revision
Control: v0.5 replacement requires an exact expected previous submission/review ID. A stale precondition is rejected.

### Valid-looking task receipt points at another participant's real record
Control: orchestration verification resolves completed outputs/history/attempts to the real submission or review and verifies participant/reviewer ownership, content/review hash, active revision, and completion evidence.

### Reviewer population is not actually independent
Control: optional declared `independence_group` and minimum group coverage expose the evidence gap. Boundary: declarations are not proof of organizational/model independence.

### Similar ballots are mistaken for collusion
Control: convergence is diagnostic only; it cannot automatically exclude or penalize a reviewer.

### Corrupt bridge receipt is silently ignored
Control: an existing malformed/non-object import receipt causes a visible validation failure.

## v0.6 additional threats

**Transport-order false negatives.** A valid evidence ZIP can be repacked with a different member order without changing its files. Control: canonical event members are sorted before both parsing and filename binding.

**Observer side-route identity leakage.** A sanitized main dashboard is insufficient if progress, integrity, lineage, or exception routes expose seat or artifact identifiers. Control: the observer now uses dedicated public-safe count/topology views and generic exception text; forensic detail remains local.
