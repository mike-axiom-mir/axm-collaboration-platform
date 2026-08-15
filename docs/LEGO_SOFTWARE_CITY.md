# AXM LEGO Software City

Status: **EXPERIMENTAL build programme**

The city turns AXM's modules into composable, inspectable blocks without
flattening their differences or giving software hidden authority. It is built
in dependency order:

1. Truthful live City Map.
2. Schema Registry and compatibility resolver.
3. Content-addressed Artifact Depot and append-only Event Journal.
4. Typed Authority Grid and measured Hands Rail.
5. Durable Workflow Transit and correlated Evidence Grid.
6. Owner-defined local sync and human/machine twin surfaces.
7. Quarantined Intake Harbor and disabled-by-default external City Gates.

The LEGO kinds are `BRICK`, `SENSOR`, `ORGAN`, `HAND`, `ROOM`, `BRIDGE`,
`ROUTE`, and `DISTRICT`. A legacy name does not decide the kind. In particular,
a Mirror organ may become a Brick, Sensor, Organ, Hand, or Bridge after its
behavior, sockets, effects, proof, and authority boundary are measured.

## Phase 0 boundary

The first compiler scans configured declaration roots and produces:

- `registry/generated/city-graph.json`;
- module and capability registries;
- authority and proof maps;
- dependency and unresolved-edge views;
- `docs/generated/LEGO_CITY_MAP.md`;
- a digest-bound compilation receipt.

The committed view binds to the digest of the declarations and their source
files. Its Git commit field is deliberately unbound to avoid a self-referential
"commit containing its own hash" loop; the live compiler receipt reports the
observed repository `HEAD` separately.

All outputs use repository-relative paths. Semantic digests omit timestamps and
machine-local paths. Unknown schemas and capabilities remain explicit. Legacy
ambiguities are represented rather than silently erased.

The generated graph never claims that:

- availability means authorization;
- permission labels prove confinement;
- a digest proves correctness or safety;
- passing checks promotes a block;
- any block can change CANON or AXM roots.

Mike remains the merge and CANON gate.

## Phase 1 grammar

The Schema Registry compiles every `$id` already discovered by the City Map.
It resolves exact identities and compares schemas conservatively: exact bytes,
annotation-free structural equivalence, or an explicit adapter with an explicit
loss list. Same-major and newer-version labels never prove compatibility.
Existing modules are observed without migration or rewrite, and unresolved
schema sockets remain visible in the generated registry.

## Phase 2 state primitives

The Artifact Depot stores candidate bytes under a SHA-256 content address using
a partial file, fsync, and atomic rename. Existing bytes are reverified rather
than overwritten. Partial files never become artifacts. Leases and offline
export manifests are inert data, and v0.1 has no deletion or garbage collector.

The Event Journal appends canonical records to a local JSONL hash chain under a
short-lived exclusive lock. It fails on incomplete tails, invalid JSON,
sequence/hash drift, or duplicate event IDs. Correlation, causation, authority
decision references, and evidence references survive deterministic projection
replay. An event records an occurrence; it grants no authority.

## Phase 3 authority and hands

The Authority Grid compiles pure decision packets bound to an exact principal,
action, resource, effect class, target digest, structured scope, policy digest,
expiry, and correlation. Permits additionally require an external
decision-maker verifier: a `human:` string and an unkeyed digest are not
authentication. High-risk authority is human-verified and one-use. Capability
alone never grants authority.

The Hands Rail contains no shell, process, filesystem, browser, or network
executor. It can invoke only a caller-injected handler after the exact decision
passes. Executor declarations include budgets, denial probes, known gaps,
cancellation, and mandatory cleanup. The receipt retains success, partial,
failure, or cancellation; substrate names never prove confinement.

## Phase 4 workflow and evidence

Workflow Transit compiles inert `axm.route/v1` data into a deterministic plan.
It never executes a step. Profiles can remove steps and lower attempt budgets,
but cannot add steps, remove a required dependency while retaining its
consumer, increase budgets, or change effects. Only a `SUCCESS` effect paired
with `PASS` verification becomes `VERIFIED`; other outcomes block resume or
enter an explicit retry bounded by the locked attempt budget.

Evidence Grid wraps domain payloads without flattening their schemas. It binds
receipts to source snapshots, verifier labels, correlation/causation, freshness,
and exact payload bytes. Contradictions remain conflicts; unknown, partial, and
stale states never become pass. Warning baselines bind both source snapshot and
verifier version, and renewal retains an authority-decision reference.
