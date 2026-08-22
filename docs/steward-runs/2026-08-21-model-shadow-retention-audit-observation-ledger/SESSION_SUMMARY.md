# Session summary

Status: `TEST`

v2.8 closes one bounded loss mode left by v2.7: an exact rollback, absence,
replacement, invalid, exact, or forward audit was returned to the caller but not
persisted by that module. The new adapter exact-rebuilds the complete live v2.7
audit package before writing the complete minimized audit into a third existing
caller-owned local root.

The observation log uses one canonical manifest, contiguous exclusive-created
file-fsynced records, previous-record references, self-digests, strict caller
time ordering, duplicate audit refusal, one v2.7 retention-manifest binding, a
fixed fail-closed operation lock, and 4 MiB artifact, 384 MiB transient input,
10,000-record, and 256 MiB aggregate bounds. Both non-held exact observations
and held absence observations are exercised. Corrupt digests, broken chains,
gaps, extras, missing manifests, noncanonical bytes, oversized records,
configured identity movement, retention identity drift, and stale locks fail
closed. Two concurrent child writers persist exactly one copy.

Persistence is tested at its native surface. After the synthetic source roots
and v2.7 retention root are removed, a distinct Node.js process reloads the
byte-identical snapshot and full held observation from the third root without
the audit input. A separate joint-replacement case forms another internally
exact triple after the original three-root boundary is lost, preserving the
counterexample rather than relabeling local files as protected continuity.

The focused v2.8 suite passes 161 assertions. The retained verification ledger
passes 44 commands with 3,641 focused assertions, including every inherited
grounded-growth command and all ten `AGENTS.md` checks. The normalized source
snapshot binds 230 current and inherited inputs. The deterministic capability
comparison moves from `BLOCKED` with 1 required route ready and 18 required
routes missing to `DEGRADED` with all 19 bounded required routes ready and 7
broader optional routes still unknown.

The implementation audit also tightened concurrent namespace initialization:
losing a create race now rechecks the exact directory boundary instead of
surfacing an untyped `EEXIST`. Write-completion manifest and observation builders
remain private so callers cannot construct successful file-fsync receipts
without a service write.

Counterevidence remains decisive. One synthetic controller owns every root,
process, confirmation, and caller time. The record does not monitor later state.
File `fsync` proves neither directory-entry nor hardware or power-loss durability.
No external retention, protected monotonic storage, identity, human review,
provider execution, evaluation, benefit, learning, adoption, promotion, merge,
Foundation mutation, or `CANON` is proven. Browser verification is not applicable
to this nonvisual Node.js adapter. Three Draft 2020-12 schemas parse and their
runtime structures are exercised; independent meta-validation remains unrun
because no compatible validator was available and no dependency was installed.

Mike Tobi / AXM remains the merge and `CANON` gate.
