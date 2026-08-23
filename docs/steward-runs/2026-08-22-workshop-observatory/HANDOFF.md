# Workshop Observatory v0.1 handoff

Status: `TEST`

This branch turns the existing Workshop Growth view into an evidence-backed
Observatory without treating size as success or manufacturing a quality score.
It does not alter the Foundation, promote a module, or change `CANON`.

## Ownership and isolation

- Branch: `codex/workshop-observatory-v0.1`
- Isolated worktree: `<isolated-worktree>/workshop-observatory-v0.1`
- Starting commit: `c6e7909267f51a6fa14395e46d6917678ef87d06`
- Shared live workspace was inspected read-only while this branch was built.
- No live-workspace file was overwritten or merged.

The live workspace already contains concurrent, uncommitted work on the Growth
worker/cache and on shared Hub files. Integrate by diff; do not copy this branch
over those files wholesale. The Observatory uses its own endpoint, worker, cache,
and milestone state so it can be reconciled with that faster Growth lane.

Final collision snapshot at handoff time:

- shared edited seams: `hub/growth.css`, `hub/growth.js`, `hub/index.html`,
  `server.js`, and `shared/growth/README.md`;
- concurrent Growth edits: `shared/growth/axm-growth-metrics.js`,
  `shared/growth/selftest.js`, and `shared/growth/discovery-seam-review.js`;
- concurrent new Growth-worker files: `growth-scan-worker.cjs`,
  `growth-worker-runner.js`, and `growth-worker-selftest.js`;
- `shared/operations/operations-utils.js` is also dirty in the live workspace.
  This branch only consumes its existing `atomicJson` API and does not modify it.

## What changed

- Added a deterministic Workshop Observatory measurement over live readiness,
  lifecycle declarations, contracts, selftest entrypoints, exact capability
  identifiers, verification-receipt metadata, and public evidence metadata.
- Added typed `BLOCKING`, `ATTENTION`, `OPPORTUNITY`, and `CONTEXT` signals with
  a bounded next action and evidence source.
- Added an isolated worker, coalesced refreshes, a five-minute freshness model,
  and a local ignored cache. The Hub does not perform the Observatory file walk.
- Added an explicit human milestone ledger. Each record attaches compact measured
  evidence, uses an atomic state write, and states that it is not automatic proof
  or canonization.
- Expanded the Hub panel with lifecycle, structural coverage, exact connection
  seams, improvement filters, milestones, and inline definitions.
- Added full metric/API/truth-boundary documentation in
  `docs/WORKSHOP_OBSERVATORY.md`.

## Truth boundaries

- No quality, health, intelligence, or maturity score is produced.
- Growth is not equated with success.
- `TEST`, `WORKING`, and `CANON` remain declarations, not converted pass counts.
- Capability connections are exact identifier matches; semantic compatibility is
  not guessed.
- Signals do not schedule work, repair modules, promote modules, or edit canon.
- Milestones record human importance; they do not prove success automatically.
- Private source contents and absolute file paths are not retained in the cache.

## Verification receipt

Focused checks passed:

```text
node shared/growth/selftest.js
node shared/growth/observatory-selftest.js
node shared/growth/observatory-worker-selftest.js
node shared/growth/observatory-route-selftest.js
node --check server.js
node --check hub/growth.js
node tests/html-script-syntax-test.js
git diff --check
```

Runtime API evidence passed:

- first read returned immediately while measurement started outside the page;
- the scan became `CURRENT` and returned the deterministic Observatory payload;
- refresh and milestone mutations refused requests without their explicit headers;
- the milestone route persisted valid JSON atomically;
- the saved record retained `automaticallyProven: false` and
  `canonChanged: false`;
- coalesced worker behavior and cache persistence passed their focused test.

Live browser evidence passed in the Codex in-app browser:

- desktop panel rendered the scale and evidence lanes together;
- severity filtering showed only the chosen signal type;
- metric definitions expanded;
- 390 x 844 responsive layout used one metric per row;
- Observatory panel and document had zero horizontal overflow;
- no browser warnings or errors were logged.

Follow-up visual repair: the optional Atrium skin files exist only as untracked
concurrent work in the live workspace and are absent from this isolated branch.
Without their positioning rule, the decorative 300 x 150 signal canvas became a
150-pixel CSS-grid row above the Hub. `hub-tokens.css` now owns a safe fallback
that removes that decorative canvas from layout. `hub/layout-fallback-selftest.js`
locks the boundary, and a repeated live render measured the top bar at `top: 0`
with zero horizontal overflow.

Required Workshop checks:

- `node verify.js`: PASS, 0 failures and 38 existing warnings.
- route, graft, skin, verify-plus, HTML syntax, tool-forge package,
  agent-tool-forge, and evidence-desk checks: PASS.
- `node hub/hub-selftest.js`: 3 failures already present at the starting commit:
  radio station source map incomplete, Growth incremental reuse not wired, and
  responsive command-bar polish missing. This branch does not claim to fix them.

## Mike's merge gate

No decision is required to inspect or continue testing the branch. Before merging,
Mike decides whether to accept this `TEST` Observatory and how to reconcile the
five shared Hub/server files with the concurrent Growth-worker lane. Any future
`CANON` status remains a separate explicit decision.
