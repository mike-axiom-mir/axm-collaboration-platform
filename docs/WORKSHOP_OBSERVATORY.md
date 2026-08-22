# AXM Workshop Observatory

Status: **TEST implementation candidate**. It is not CANON and does not promote
modules. Mike Tobi remains the human merge gate.

## Purpose

The old Workshop Growth view answers an important but narrow question: how large
is the active source body, and how did its aggregate shape change between saved
snapshots?

The Observatory keeps that answer and adds four questions that size alone cannot
answer:

1. What lifecycle states are actually declared now?
2. What structural and verification evidence exists now?
3. Which exact capability seams connect, and which are one-sided?
4. What deterministic gaps or reuse opportunities deserve attention next?

No composite health, quality, intelligence, productivity, or success score is
produced. Such a score would hide incompatible evidence behind one attractive
number.

## Two independent measurement lanes

### Growth lane

Source: `shared/growth/axm-growth-metrics.js` and `/api/workshop-growth`.

It counts active Workshop source and preserves compact historical snapshots.
The current exclusion set includes Git internals, dependencies, generated
exports, backups, logs, state, local data, caches, and coverage output. Existing
growth and Mirror-family rules remain unchanged.

Growth proves scale and aggregate change only. It does not prove that work is
correct, complete, useful, accepted, or ready for promotion.

### Observatory lane

Source: `shared/growth/axm-workshop-observatory.js` and
`/api/workshop-observatory`.

The scan runs in `observatory-scan-worker.cjs`. The Hub can continue rendering
the existing growth lane while the deeper readiness scan runs. The most recent
result is cached under local `state/workshop-observatory/latest.json` and always
shown with `CURRENT`, `STALE`, `MEASURING`, `NOT_MEASURED`, or `UNAVAILABLE`
freshness.

The cache contains aggregate public Workshop metadata and short identifiers. It
does not retain source contents, private project contents, absolute machine
paths, screenshots, or raw verification output.

## Metric catalog

### Declared lifecycle

Counts live top-level tool manifests by the Workshop's supported labels:

- `EXPERIMENTAL`
- `TEST`
- `WORKING`
- `CANON`
- `SHELL`
- `BROKEN`
- `UNKNOWN` for unsupported or absent declarations

These are declarations. A `TEST` label is not counted as a current passing test.
A `CANON` label is not created or changed by the Observatory.

### Structural coverage

- **Valid contracts:** present contracts that pass the existing deterministic
  module-contract verifier.
- **Top-level selftests:** tools with the conventional executable promotion
  selftest entrypoint.
- **Current PASS receipts:** local selftest results whose recorded digest still
  matches the current selftest file.
- **Documented proof claims:** bounded claims in `registry/proofs.json`. Every
  claim retains its `does_not_prove` boundary.

Contract or selftest coverage is structural evidence, not runtime proof or human
approval.

### Exact capability seams

The Observatory uses the existing readiness index's contract identifiers:

- **Connected:** at least one exact provider and one exact consumer.
- **Consumer-only:** a declared consumer has no exact provider.
- **Provider-only:** a declared provider has no exact consumer.

Matching is exact-string-only. Wildcard, version, semantic, transport, runtime,
and data-shape compatibility are not inferred. Provider-only capabilities can be
intentional public outputs; they are review candidates, not automatic defects.

### Evidence freshness

The live readiness digest is compared with `tools-index.json`. A mismatch is
reported as `SOURCE_DRIFT`; it means the generated public registry should be
regenerated and verified in its owned workflow. Generated registry files are
never hand-edited by the Observatory.

The local verification receipt is optional. When missing, the page reports zero
current receipts and says that the receipt is unavailable. It does not treat all
declared `TEST` tools as passing.

## Typed improvement signals

Signals are ordered as:

1. `BLOCKING` — invalid live manifests or invalid present contracts.
2. `ATTENTION` — exact consumer-only seams or higher-lifecycle claims needing
   reverification.
3. `OPPORTUNITY` — useful structural work such as missing contracts, top-level
   selftests, kinds, or READMEs.
4. `CONTEXT` — provider-only reuse candidates, registry freshness, and unresolved
   public release gates.

Each signal includes a count, why it exists, a bounded next action, its evidence
source, and a small sample of public identifiers. Signals do not trigger work,
generate adapters, repair files, change permissions, promote modules, or alter
CANON.

## Human-recorded milestones

`POST /api/workshop-observatory/milestones` requires the explicit local header:

```text
x-axm-observatory: explicit-local-milestone
```

A milestone records:

- a human title and optional note;
- the current Observatory source digest and measurement time;
- compact counts for tools, valid contracts, connected exact seams, and current
  PASS receipts;
- the truth boundary `automaticallyProven: false`.

Recording importance and proving success are separate. Acceptance evidence can
be added in the note, but the Observatory does not reinterpret prose as a passed
verifier.

## Local API

### Read current result

```text
GET /api/workshop-observatory
```

Returns the cached result immediately. When it is absent or stale, the server
starts an isolated refresh without blocking the existing growth response.

### Request a fresh scan

```text
POST /api/workshop-observatory/refresh
x-axm-observatory: explicit-local-refresh
```

Returns `202 MEASURING`. Concurrent refreshes are coalesced.

### Record a milestone

```text
POST /api/workshop-observatory/milestones
x-axm-observatory: explicit-local-milestone
content-type: application/json

{"label":"...","note":"...","actor":"local-human"}
```

Milestone storage is local state and is not committed.

## Verification boundary

Relevant deterministic checks:

```text
node shared/growth/selftest.js
node shared/growth/observatory-selftest.js
node shared/growth/observatory-worker-selftest.js
node shared/growth/observatory-route-selftest.js
node tests/html-script-syntax-test.js
```

The full required Workshop check set remains in `AGENTS.md`. Browser rendering,
responsive layout, filtering, refresh behavior, and milestone interaction require
a separate live browser test; source checks and HTTP smoke tests cannot prove the
visual result.
