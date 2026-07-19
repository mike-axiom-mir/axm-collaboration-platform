# AXM Tycoon Steward Layer — EXPERIMENTAL v0.1 ruleset, v0.7 palace-polish host

**Status:** `EXPERIMENTAL · LOCAL TEST CANDIDATE · NOT INSTALLED · NOT PROMOTED · PROPOSAL-ONLY HOST HANDOFF`

This standalone module tests a different kind of city-management loop. The
steward paints broad zones, reserves resource envelopes, sets policy direction,
advances turns, inspects consequences, and can hold, redirect or repair a
district. The region chooses exact structures and roads through visible,
versioned rules.

In the v0.7 Living Globe package, the same v0.1 state/API identity retains its
typed supply and emergence-memory modules, with an original warm-island visual layer. A real post-starter
district can be captured as causal evidence, then applied to other cells as a
Preserve or Evolve preference. It never copies buildings or bypasses zoning,
labor, allocation, products or money. This extends the ruleset without silently
promoting or renaming its experimental module contract. Map glyphs, terrain
patterns and palace notices are presentation only and cannot advance a turn.

It is an abstract civic-game simulation. It is not a scientific city model,
autonomous optimizer, living-globe integration, or claim of fun or balance.

## Open it locally

No installation, account, cloud connection, package manager or build step is
required.

1. Extract the ZIP into a normal local folder.
2. Serve the Living Globe package, then open
   `http://127.0.0.1:8765/game/tycoon-steward/`.
3. The starter region appears, but no turn advances and no saved state loads.
4. Preview an allocation, accept it explicitly, then choose **Advance 1 turn**.
5. Click a structure, district or receipt to inspect its causal record.

To run this subfolder alone, open a terminal in `game/tycoon-steward/` and run
one of these optional local-only commands:

```bash
py -m http.server 8000
```

or:

```bash
python -m http.server 8000
```

Then open `http://127.0.0.1:8000`. This server is optional and is not part of
the simulation architecture.

## Steward loop

```text
Observe → allocate → set direction → simulate → inspect consequences
        → approve / hold / redirect / repair
```

Nothing runs on a timer. A turn is possible only through an explicit
`advanceTurn()` call or a visible turn button. The 24-turn sample also requires
an explicit button, a replacement confirmation, and then records one receipt
per turn.

## What is modeled

- Zones: `HOUSING`, `INDUSTRY`, `ENTERTAINMENT`, `NATURE`,
  `INFRASTRUCTURE`, and first-class `NEUTRAL` land.
- Distinct resources: population, labor, energy, materials, funds and steward
  attention. Their stocks, capacity, flows, reservations, commitments and units
  remain separate.
- Separate vitals: livability, access, resilience, ecological health, economic
  circulation, diversity, unmet needs and steward trust.
- District states: healthy, strained, stalled, failed, held, repairing and
  recovered. Failure history is never reset away.
- Road emergence: measured origin/destination pressure, deterministic path
  search, resource cost, terrain cost and nature constraints.
- Neutral emergence: mixed quarters, small settlements, trade paths, civic
  services and ecological buffers depending on full state and seed.
- Typed supply: timber, clay, stone, ore, crops and fish deposits on every
  cell; 13 conserved raw/intermediate/finished products; exact construction
  bills and operating recipes; real shortages and stock-driven bounded prices.
- Supply-aware emergence: extractors, sawmills, brickworks, metalworks,
  canneries, furniture workshops, construction yards, markets and food halls
  compete through disclosed need, demand, supply, logistics, labor, terrain and
  deterministic-founder components.
- Future trade seam: protected surplus lots are marked `READY_NOT_EXPORTED`;
  no product, money or fictitious foreign buyer appears automatically.
- Emergence memory: an operating district with genuine post-starter structures
  can be captured through an explicit, costed decision. The pattern records
  roles and local conditions, never buildings, stock or funds.
- Goal overlays: 1–20 selected cells may follow a captured pattern in
  `PRESERVE` or `EVOLVE` mode. Applying one builds and paints nothing; ordinary
  feasibility and exact product bills remain mandatory.
- Novelty review: unknown metric bindings remain
  `UNSCORED_REVIEW_REQUIRED`, affect no vital, and cannot enter an adapter
  proposal until a visible review decision supplies bindings.

There is deliberately no composite victory, power, growth or city-level score.
Candidate scores are disclosed local rule selectors, not universal value.

## Public headless API

Create an engine in Node:

```js
const Steward = require('./core/steward-state.js');
const engine = Steward.createSteward('my-seed');
```

All inputs and outputs below are plain JSON-compatible data. The core has no
DOM, canvas, CSS, network, browser storage or model dependency.

### `observeState(query?)`

Arguments:

```text
query?: {
  summary?: boolean,
  districtId?: string,
  cellId?: string
}
```

Returns a full cloned state, a summary, or a district-filtered observation.
Full truth includes turn, revision, seed/PRNG state, resources, reservations,
map, zones, terrain, districts, structures, roads, policies, vitals, needs,
decisions, novelty review, receipts, versions and boundaries.

### `listNeeds(query?)`

Arguments:

```text
query?: {
  kind?: string,
  districtId?: string,
  minPressure?: number
}
```

Returns ranked needs with evidence, pressure, affected locations, constraints,
candidate zones and observations that could disconfirm the need.

### `proposeAllocation(input, actor?)`

Arguments:

```text
input: {
  zone: "HOUSING" | "INDUSTRY" | "ENTERTAINMENT" |
        "NATURE" | "INFRASTRUCTURE" | "NEUTRAL",
  amounts: {
    population?: number,
    energy?: number,
    materials?: number,
    funds?: number,
    attention?: number
  }
}

actor?: { id?: string, type?: string, displayName?: string }
```

Returns:

```text
{
  schema, id, actor, expectedRevision, zone, amounts,
  affordable, errors[], warnings[], assumptions[],
  applied: false,
  forecastRange: {
    knownCandidateTypes[], guaranteedDevelopments: 0,
    maximumDevelopmentsPerTurn: 1
  },
  decisionDraft
}
```

This method is pure. It never reserves or spends resources.

### `applyStewardDecision(decision, context?)`

Decision schema:

```text
{
  schema: "axm.tycoon-steward.decision/v0.1",
  id: string,
  type: "ALLOCATE" | "PAINT_ZONE" | "SET_POLICY" |
        "HOLD_DISTRICT" | "RELEASE_DISTRICT" |
        "REDIRECT_DISTRICT" | "REPAIR_DISTRICT" |
        "REVIEW_NOVELTY" | "CAPTURE_EMERGENCE" |
        "APPLY_GOAL_LAYER" | "SET_GOAL_LAYER_MODE" |
        "RETIRE_GOAL_LAYER",
  expectedRevision: integer,
  reason: string,
  payload: object
}
```

Context:

```text
context?: { actor?: { id, type, displayName } }
```

Returns:

```text
{ ok, state, receipt, warnings[], errors[] }
```

The method validates first, commits atomically, refuses stale and duplicate
decisions, and never silently overwrites input. `REPAIR_DISTRICT` must name the
district's recorded failure cause. `REVIEW_NOVELTY` approval must supply explicit
finite bindings to known vitals. Capture and goal decisions spend their declared
attention cost atomically.

### `advanceTurn(input?)`

Arguments:

```text
input?: {
  count?: integer 1..20,
  expectedRevision?: integer,
  actionId?: string,
  actor?: { id, type, displayName }
}
```

Returns:

```text
{ ok, state, receipts[], warnings[], errors[] }
```

A multi-turn call remains explicit. It creates one complete receipt for every
turn.

### `explainChange(reference)`

`reference` may be a receipt, structure, road, district, captured pattern, goal
layer, resource transaction or novelty-review ID, or an object containing one
of those IDs.

Returns:

```text
{ found, type, id, readable, data }
```

### `exportReceipt(query?)`

Arguments:

```text
query?: { kind?: string, turn?: number, id?: string, limit?: number }
```

Returns a machine-readable `axm.tycoon-steward.receipt-export/v0.1` packet with
the selected receipts, current chain head and chain-verification result.

### `exportState()`

Returns:

```text
{
  schema: "axm.tycoon-steward.export/v0.1",
  stateSchema: "axm.tycoon-steward.state/v0.1",
  checksum: { algorithm: "sha256", value: string },
  state: object
}
```

### `importState(packet)`

Validates the exact supported export and state schemas, 1 MB limit, unsafe
keys, finite values, checksum, ID bounds, resource invariants, receipt chain,
receipt head and final state hash. Unknown future schemas and malformed packets
are refused. A supported older v0.1 state without emergence memory receives an
empty memory object and one visible migration receipt; no pattern is inferred.

Returns:

```text
{ ok, state, warnings[], errors[] }
```

## Receipt truth

Every turn and accepted steward decision appends a canonical receipt containing
logical time, actor, decision references, seed pre/post state, pre/post state
hashes, observed needs, considered/refused candidates, resource transactions,
changes, separate vital deltas, unmet needs, novelty flags, warnings,
limitations and the previous/current receipt hashes.

State hashes intentionally exclude the receipt array, receipt head and optional
observational metadata to avoid circular self-hashing. Export checksums cover
the complete state, including all receipts.

## GlobeAdapter seam

`core/globe-adapter.js` declares exactly:

```text
readTerrainSeed()
readWorldResources()
readExistingSettlements()
submitCityPatchProposal()
receiveWorldEvent()
exportEmergentContent()
```

The default `DisconnectedGlobeAdapter` reads nothing. The contract has no live
host mutation method. A fixture adapter can validate host-supplied snapshots and
create a `PROPOSAL_ONLY` packet only when world ID and revision match. The host
world remains authoritative. See `ARCHITECTURE.md` for packet details.

## Tests

From the extracted Living Globe package root, run:

```bash
node game/tycoon-steward/tests/run-tests.js
```

No `npm install` is needed. See `TEST_REPORT.md` for observed results and the
separate browser-test boundary.

## Storage and import boundary

- Browser key: `axm.tycoon-steward.v0.1.palace-polish-v1`.
- The v0.6 `axm.tycoon-steward.v0.1.emergence-memory-v1` and original
  `axm.tycoon-steward.v0.1` keys are read only as explicit-load fallbacks and
  are never overwritten or deleted by v0.7.
- Save, load, import, overwrite, clear and reset require visible actions.
- No state loads on page open.
- Imported text is rendered through `textContent`, not executable markup.
- No remote runtime, telemetry, analytics, service worker or background state
  timer exists.
- User downloads are explicit and remain local to the browser's download path.

## Known limits

- Rules are small, abstract and not balanced through human playtesting.
- The 8 × 8 region is a vertical slice, not a city or globe.
- Browser storage is origin-specific and not shared multiplayer state.
- Population and resource flows are intentionally compact game abstractions.
- Node tests do not prove touch usability, accessibility conformance, fun,
  realism, security, learning or production readiness.
- The adapter seam is disconnected and proposal-only. No integration has been
  attempted or claimed.

Mike Tobi remains the human tester, direction-setter and future merge gate.
Passing tests does not install, promote or canonize this module.
