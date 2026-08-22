# Grounded-growth frontier audit for v3.6

Status: `TEST`

The committed v3.5 frontier can exact-rebuild two caller-presented v3.4
packages, classify complete-history relations, and distinguish an ordinary
forward extension from replay, rollback, policy drift, equivocation, and fork
conditions. It deliberately proves no globally unique successor, protected
monotonic state, external retention, or authenticated authority.

The highest-value reachable additive seam was therefore a caller-owned local
transition-admission ledger: admit only an exact v3.5 forward receipt that
consumes the configured or current exact anchored-package, checkpoint, and
caller-epoch head; pin stable anchor and witness policy profiles; and use an
exclusive contiguous sequence file plus reload validation to serialize one
local branch.

The implementation persists only minimized v3.5 receipts and references. It
does not persist v3.4 packages, keys, signatures, paths, complete review
outcomes, review material, model output, or private context. Exact upstream
rebuild after reload still requires the caller package.

Counterexamples remain first-class evidence:

- two independent roots accept distinct candidates from the same genesis;
- deleting the namespace permits a different genesis successor;
- restoring an earlier namespace permits a different next successor;
- an injected entry-file `fsync` failure returns durability uncertainty even
  though the fully written canonical entry may remain readable.

The local root therefore narrows accidental same-root branching but does not
establish global uniqueness, withheld-branch exclusion, external custody,
directory or hardware durability, rollback prevention, trusted time, or
authority. Those capabilities require an authenticated externally retained
globally consistent log or protected monotonic store outside this lane.

The audited Workshop surface supplies no promoted trust root for inventing that
authority. The result remains uninstalled, unpromoted, review-only `TEST`
material outside Foundation and `CANON` authority.
