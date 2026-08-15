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
