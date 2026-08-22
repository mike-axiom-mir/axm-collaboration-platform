# Model Shadow retention-audit review-outcome ledger v3.2

Status: `TEST`

## Bounded result

v3.2 adds explicitly invoked local persistence for exact v3.1 review outcomes.
Before capture, it verifies the complete v3.1 input/output package and requires
an exact unauthenticated confirmation. It then persists only the minimized
outcome beneath a fixed namespace in a caller-owned root that must be distinct
and nonnested from the upstream v2.8 observation root.

The manifest and records use canonical JSON, exclusive creation, file `fsync`,
contiguous 12-digit names, previous-record references, exact outcome references,
caller times, and self-digests. Duplicate record ids, outcome ids, or outcome
digests; non-forward time; partial chain drift; corrupt or noncanonical bytes;
gaps; unexpected files; stale locks; root overlap; oversize; and concurrent
duplicate writers fail closed.

All three v3.1 states are retained without adjudication. The public ledger omits
the complete capture input, raw Review Inbox item, raw actors, vote notes,
discussion, configured paths, model output, and private context. Reload proves
the stored pseudonymous bytes and chain are internally exact; it does not
re-prove actor-digest derivation from absent raw actors.

## Exact evidence

- Before implementation: 3 required routes `READY`, 22 required routes
  `BLOCKED`, and 10 broader routes `OPTIONAL_UNKNOWN`.
- After implementation: all 25 bounded required routes `READY`; the 10 broader
  routes remain `OPTIONAL_UNKNOWN`, so the result is `DEGRADED`, not complete.
- Focused v3.2 ledger: 157 assertions covering exact capture, all three states,
  minimization, corruption, concurrency, bounds, fresh-process reload, upstream
  loss, full local rewrite, replacement identity, and joint loss.
- Recorded verification: 50/50 commands passed, including 40 focused/inherited
  commands, all ten AGENTS checks, and 4,381 focused assertions.
- Source snapshot: 267 normalized current and inherited inputs.
- Session evidence: 38 ordered `TEST` events are retained in a byte-counted
  SHA-256 sealed JSONL segment without raw logs or synthetic filesystem state.
- Browser verification: not applicable because this leaf adds no browser
  surface; no render or click pass is claimed.
- Independent Draft 2020-12 schema meta-validation: unrun because no validator
  is installed; runtime and static schema checks passed.

Three upstream observation trees remained byte-identical around capture. Fresh
processes loaded the exact snapshot and records before and after verified
upstream-root removal. Two concurrent duplicate writers yielded exactly one
success and one fail-closed result.

## Counterevidence and open boundaries

A self-consistent full rewrite with a changed actor digest remained internally
loadable after every affected digest was recomputed. A separate replacement
ledger reused the same configured manifest identity with a different record.
After the original ledger root was removed, the original service had no
continuity. These cases prove the local ledger is not tamper-proof custody,
protected monotonic storage, deletion prevention, or original-history proof.

File `fsync` does not prove directory-entry, device, hardware, cache, or
power-loss durability. Confirmation is not authentication. Synthetic packages
are not live host observation or actual human review. Persisted approval does
not resolve the hold or authorize remediation, provider evaluation, execution,
adoption, promotion, merge, Foundation mutation, or `CANON`.

The separately owned global tools-index lane and incoming specialist ZIP
packages were not touched. Mike Tobi / AXM remains the merge and `CANON` gate.
