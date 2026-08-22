# Grounded-growth frontier audit after v4.0

Status: `TEST`

## Audited frontier

Committed v3.9 can exact-rebuild two caller-presented complete local v3.7
proposal/settlement histories and locate their first different normalized event.
Its next gate explicitly names authenticated external custody or protected
global history and steward reconciliation. It does not provide a review artifact
or a human-readable route into the Workshop's existing Review Inbox.

The Review Inbox already had an exact-digest queue and a strict typed renderer
for v2.9 held retention-audit artifacts. A v3.9 divergence could enter only as
opaque generic JSON. That shape was technically queue-compatible but left the
important commitments, first divergence, and authority boundaries difficult to
inspect and did not fail closed on a claimed v4.0 artifact.

## Selected bounded seam

The highest-value seam available without inventing custody, identity, human
review, or reconciliation was:

1. exact-rebuild one current v3.9 divergence from its original caller package;
2. minimize it to two history commitments, two snapshot references and counts,
   the common prefix, and the first different event;
3. bind that artifact to an existing Review Inbox-compatible exact digest while
   leaving actual submission as an explicit host action; and
4. render and rehash that artifact in the Inbox, failing closed before voting on
   malformed or mismatched evidence.

This is an agency improvement: a reviewer can see what differs and what approval
cannot do. No actual reviewer, benefit, or reconciliation is inferred.
Review approval is not reconciliation and does not resolve the divergence.

## Implemented result

- New v4.0 `TEST`, uninstalled, unpromoted, data-only reconciliation-review
  bridge.
- Exact v3.9 rebuild and divergence-only admission.
- Closed one-MiB review artifact and two-MiB request limits.
- Both complete-history commitment digests and earliest divergence retained.
- Full upstream receipt, histories, roots, raw records, output, and private
  context omitted.
- Existing Review Inbox route declared; runtime imports no ReviewService and
  performs no submit, network call, filesystem write, provider call, evaluation,
  reconciliation, or execution.
- Review Inbox v0.4 typed renderer with browser canonical SHA-256, item binding,
  corruption holds, safe escaping, raw JSON preservation, generic nondisruption,
  prior v2.9 regression coverage, and stale-selection protection.
- Live desktop and narrow browser journeys over a read-only synthetic harness.

## Exact evidence

- Bridge: 107 focused assertions.
- Typed renderer: 191 focused assertions.
- Updated Review Inbox integration: 45 assertions.
- Full inherited run: 59/59 commands and 5,708 focused assertions.
- Live browser: exact `VERIFIED`, mismatch `HOLD` with
  `ITEM_ARTIFACT_DIGEST_MISMATCH`, legacy v2.9 `VERIFIED`, generic typed panel
  absent, rapid mismatch selection settled to one hold, and 390×844 layout with
  no horizontal overflow.
- Capability comparison: before `BLOCKED` with 1 required route ready and 27
  blocked; after `DEGRADED` with all 28 bounded required routes ready and 11
  broader routes `OPTIONAL_UNKNOWN`.

## Counterevidence and open frontier

The new bridge and view do **not** prove:

- live host submission, receiver durability, independent receiver process, or
  external retention;
- submitter, reviewer, steward, controller, policy, or real-world identity;
- actual human participation or an informed review decision;
- authenticated steward reconciliation, a reconciliation result, or divergence
  resolution;
- atomic capture, later currentness, independent custody, protected monotonic
  storage, withheld-history exclusion, global uniqueness, or one globally
  consistent history;
- provider invocation, evaluation, human benefit, or learning;
- execution, adoption, permission, installation, promotion, merge, Foundation
  mutation, or `CANON` authority;
- independent Draft 2020-12 schema meta-validation or assistive-technology and
  human usability results.

Ajv and Python `jsonschema` were unavailable, so independent schema
meta-validation remains unrun rather than being silently replaced. Local closed
shape and corruption checks did run.

## Next honest advance

The next meaningful seam is not another local digest wrapper. It requires new
authority or infrastructure: an authenticated host-authorized submission and
review path, followed by a separately authorized steward reconciliation that
records its evidence and result without treating approval as execution. The
alternative systems seam is independently controlled external custody or a
protected globally consistent history. Neither is claimed here.

Mike Tobi / AXM remains the merge and `CANON` gate.
