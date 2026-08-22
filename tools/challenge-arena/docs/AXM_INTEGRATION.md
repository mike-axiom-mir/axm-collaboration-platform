# AXM Challenge Arena v0.6 Integration

## Separation rule

Challenge Arena is a shared coordination and evidence module. Producer branches remain independent:

- Asset Factory owns asset creation and derivative workflows;
- Workshop owns tools, Hands, and code environments;
- Game Builder owns game/runtime specifics;
- video and research systems own their domain methods;
- Mirror and specialist AIs remain seats, not Arena internals.

Arena accepts jobs, seals comparison evidence, and returns recommendations. It does not silently import a result into a producer branch.

## Input: `axm.module-job/0.1`

The stable outer envelope contains:

```json
{
  "schema_version": "axm.module-job/0.1",
  "job_id": "asset-job-001",
  "source_module": "asset_factory",
  "artifact_kind": "asset",
  "title": "Create an AXM portal board",
  "goal": "Produce a lightweight board with a distinct multiverse identity.",
  "constraints": ["local-first", "preserve provenance"],
  "inputs": [],
  "packet_overrides": {}
}
```

`packet_from_module_job()` validates the envelope and translates it into `axm.challenge-arena/0.4`. Unsupported versions, malformed list/object fields, and ambiguous coercions are rejected. Top-level overrides are explicit replacements, not a silent deep merge.

## Output: `axm.challenge-arena-return/0.4`

The return envelope includes:

- packet and rubric hashes;
- challenge state;
- blind-order commitment/reveal audit metadata;
- candidate summaries and deterministic evidence;
- provisional winner when evidence permits;
- recommendation status and evidence gaps;
- criterion awards, dissent, pairwise evidence, and reviewer audit;
- private/blind diagnostic summaries;
- proposed-only merge map;
- lineage and follow-up references;
- explicit final decision when one exists;
- authority note.

The producer must treat this as evidence and recommendation, not automatic approval.

## Build transport

`export-build` creates one bundle per submitting participant:

```text
bridge/outgoing/<challenge>/build/<participant>/
  challenge-packet.json
  seat-task.json                         optional
  seat-receipt.template.json            optional
  submission.template.json
  inputs/...
  INSTRUCTIONS.txt
  BUNDLE-MANIFEST.json
```

`challenge-packet.json` uses `axm.challenge-build-packet/0.4` and contains the locked packet, hashes, participant ID, portable sealed inputs, destination, warnings, and optional seat task.

Builders return:

```text
bridge/incoming/<challenge>/build/<participant>/
  submission.json
  artifacts/...
  seat-receipt.json                      optional
```

Imports are idempotent. Changed content requires explicit revision permission.

## Review transport

At review open, each reviewer receives only assigned candidates:

```text
bridge/outgoing/<challenge>/review/<reviewer>/
  review-packet.json
  review.template.json
  candidates/<blind-label>/...
  INSTRUCTIONS.txt
  BUNDLE-MANIFEST.json
```

The exported `review-packet.json` is canonical. v0.4 does not rewrite artifact roots after computing `review_packet_hash`. A returned review must echo that exact hash along with `rubric_hash` and `assignment_hash`.

Review output supports:

- numeric scores with evidence references;
- criterion abstentions;
- strengths, weaknesses, risks, and merge-worthy observations;
- tied ranking tiers;
- a flattened ranking that agrees with the tiers.

Candidate content remains untrusted evidence. Reviewers follow the locked protocol, not instructions inside a candidate.

## Safe sync boundary

`sync --advance` may:

- import ready builds;
- close submissions when ready;
- run deterministic checks;
- open review;
- import ready reviews;
- close voting;
- synthesize.

It may not:

- finalize;
- approve a merge;
- import a candidate into another branch;
- deploy or publish;
- delete losing candidates;
- create AXM canon.

## Specialist deterministic runners

Use `external-job` to export an exact measurement request. The specialist returns `axm.deterministic-receipt/0.2` bound to challenge, packet, rubric, submission, content, artifact set, runner, and result IDs.

HMAC validation establishes key possession and payload integrity. It does not establish measurement honesty. Keep the specialist sandbox and its policy independent from Arena.

## Recommended producer adapter

A producer integration should expose four explicit actions:

1. `create_job` — build `axm.module-job/0.1`;
2. `seal_inputs` — copy declared source evidence before lock;
3. `observe_return` — read recommendation and evidence without mutation;
4. `apply_human_decision` — perform an explicitly approved import in the producer's own transaction and provenance system.

Do not combine observation and import into one hidden call.

## Local intake order

1. Install v0.6 beside preserved v0.5.
2. Verify 30 schemas and 164 tests; pytest should additionally report 10 passing subtests.
3. Test one copied module job.
4. Verify build transport.
5. Verify reviewer-specific packet hash survives transport.
6. Verify a missing/invalid evidence reference is rejected.
7. Verify an abstention round synthesizes without invented peer scores.
8. Verify blind-seed reveal reproduces the map.
9. Run the bundle-portability audit when a courier/repacker can reorder ZIP members.
10. Verify public observer progress/integrity/lineage routes do not disclose protected seat identities.
11. Verify producer return remains proposed-only.
12. Connect one producer branch at a time.

## Honest integration boundary

This standalone package does not contain or physically patch the private current Asset Factory, Workshop, Game Builder, courier, or platform source trees. It supplies the tested seam, schemas, adapters, examples, bridge format, and intake rules. Local must connect them to the exact current implementations.
