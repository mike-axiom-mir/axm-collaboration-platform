# Verified deterministic artifact cache — implementation receipt

Date: 2026-08-09  
Branch: `codex/game-production-runner-v0.1`  
Status: **EXPERIMENTAL**

## Outcome

The Game Production Runner now has an opt-in cross-run artifact cache for
executors that explicitly declare `deterministic-v1`. The cache is local,
external to both the Workshop and candidate job root, immutable per exact key,
and published through a temporary directory plus atomic rename.

A key binds the exact package digest; dependency package, path, digest, and byte
descriptors; executor and verifier identities; and a digest of the seed. Entry
manifests and every artifact are revalidated on read. Cache hits never reuse a
prior verifier receipt: the current appointed verifier runs again against the
cached bytes and current declared inputs before candidate acceptance.

Observed complete three-package route:

- cold run: three executor calls, three verifier calls, three `MISS_STORED`;
- warm independent run: zero executor calls, three verifier calls, three `HIT`;
- artifact tamper: `REJECTED`, one affected executor rerun, all three current
  verifier calls, two unaffected hits, valid candidate output;
- verifier disagreement: `REJECTED`, fresh execution and fresh verification;
- two simultaneous publisher processes: one `STORED`, one `EXISTS`, one exact
  entry, no temporary residue;
- same key with different result: `CONFLICT`, original entry preserved;
- invalidation without authority: no state created or removed;
- explicit exact-key invalidation: selected entry removed, unrelated entries
  preserved and reusable.

## Boundaries

- No cache root means no cache write.
- Cache and job roots must be absolute, external, disjoint, and free of link
  traversal.
- Executors without the exact deterministic policy are `BYPASSED`.
- A cache hit cannot bypass the current verifier.
- Corrupt or contradictory cache material cannot overwrite prior evidence.
- Invalidation is exact and explicit; there is no automatic eviction.
- No performance claim is made from executor-call counts alone.
- Storage quotas, retention planning, reachability analysis, and garbage
  collection remain a named missing Hand.

## Focused verification

- `node shared/game-production-runner/selftest.js` — PASS, 155 checks.
- `node tools/game-production-runner/selftest.js` — PASS, 71 checks.
- `node tools/game-production-runner/discovery-seam-review.js` — PASS, 25
  contract/discovery checks.
- Deterministic capability comparison — `READY`, no required capability gaps
  within the declared local-cache scope.

## Workshop regression verification

- `node verify.js` — PASS, 0 failures and 38 existing warnings.
- Route, graft, skin, verify-plus, HTML script syntax, tool packaging, Agent
  Tool Forge, and Evidence Desk — PASS.
- Hub self-test — FOREIGN FAILURE, the same three clean-branch baseline checks:
  radio source-map completeness, isolated incremental measurement reuse, and
  responsive command-bar polish. This cache slice edits no Hub or growth file.

No native game, cache performance benchmark, browser interaction, installation,
promotion, CANON transition, release, or external network action is claimed.
