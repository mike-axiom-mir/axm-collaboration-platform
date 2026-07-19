# Architecture — AXM Tycoon Steward Layer v0.1 in the v0.7 palace-polish host

## Typed supply extension

`core/supply-chain.js` is deterministic, graphics-independent and composed by
`core/steward-state.js`. It seeds timber, clay, stone, ore, crop and fish
deposits for all 64 cells; owns 13 bounded product inventories, prices, exact
transactions, recipes, shortages and trade-ready lots; and refuses automatic
external trade.

`core/emergence-engine.js` asks this module to score and fund candidates.
Selection weights are need 15%, product demand 20%, input/deposit supply 25%,
logistics 15%, workforce 10%, terrain/resource 10% and deterministic local
founder variation 5%. A selected structure must also pass the original broad
zone, resource-envelope, terrain and labor gates, then consume its entire typed
bill atomically. Existing processors run before candidate generation each
explicit turn; missing inputs create an idle record and shortage rather than
output.

The ruleset retains its experimental v0.1 state/API identity. The surrounding
Living Globe host artifact is v0.7; neither fact promotes this module to canon.

## Emergence-memory extension

`core/emergence-patterns.js` owns bounded captured patterns and goal layers.
Capture requires an explicit decision, one attention point and at least one
post-starter structure in an operating district. It stores role mix, density,
zone/terrain/deposit context, access, supply flows and a baseline tier—not
buildings, inventory, reservations or cash.

Applying a pattern costs two attention and selects 1–20 cells outside the source
district. It creates an overlay only. Exact missing roles receive the largest
bounded candidate bonus; same-category adaptations and supply continuity are
smaller. Zone, terrain, labor, resource reservation and exact typed product-bill
checks still run normally.

`PRESERVE` refuses further new emergence after the target functional count is
reached. `EVOLVE` allows growth beyond the baseline and modestly favors a
compatible candidate above the captured tier. Mode changes and retirement are
explicit, receipt-linked decisions. Exact/adapted progress and history are
bounded and validated.

## Status and ownership boundary

`EXPERIMENTAL · LOCAL TEST CANDIDATE · NOT INSTALLED · NOT PROMOTED · NOT GLOBE-INTEGRATED`

The standalone module owns only its isolated abstract simulation state. It does
not own, import, wrap or modify the AXM Living Globe. A future host would remain
authoritative over its native world state.

## Runtime map

```text
Human UI / headless client / future AI steward
                    ↓ same JSON calls
             public StewardEngine API
                    ↓
 seeded map · ledger · needs · emergence · roads · consequences
                    ↓
          canonical state + receipt hash chain
                    ↓
     explicit export/import or disconnected GlobeAdapter
```

The browser UI is one client. It has no privileged simulation path. An AI
steward, Node test or future adapter sees the same serializable truth and uses
the same accepted-decision gate.

## Core files

| File | Responsibility |
|---|---|
| `steward-state.js` | Versioned world state, public API, explicit decision validation and import/export |
| `zone-model.js` | Six zones, seeded 8 × 8 terrain, district membership and broad zone painting |
| `resource-ledger.js` | Atomic stock, flow, reservation and commitment transactions |
| `needs-model.js` | Ranked evidence-bearing needs and disconfirmers |
| `deterministic-rng.js` | Serializable xorshift32 state and stable seed derivation |
| `canonical-state.js` | Stable JSON ordering, synchronous SHA-256, state/export validation |
| `emergence-engine.js` | Versioned structure rules, candidate selection, commitments and lifecycle transitions |
| `emergence-patterns.js` | Causal capture, Preserve/Evolve goal overlays, progress and candidate influence |
| `road-emergence.js` | Origin/destination pressure and deterministic terrain-aware A* routing |
| `consequence-model.js` | Explicit per-structure bindings to eight separate vitals |
| `receipt-log.js` | Logical sequence, readable explanations and append-only hash chain |
| `globe-adapter.js` | Narrow disconnected/proposal-only future-host contract |

## Turn pipeline

One explicit turn call performs this deterministic order:

1. Increment logical turn.
2. Recalculate known operating flows.
3. Apply inflow/outflow without spending reserved stock.
4. Refresh captured-goal progress and calculate evidence-bearing needs and connection pressure.
5. Generate versioned structure candidates with bounded disclosed goal influence.
6. Refuse held, failed, repairing, prohibited, unfunded or labor-constrained
   candidates.
7. Select at most one structure with a visible local candidate score and stable
   tie-break.
8. Atomically consume a matching zone reservation and labor.
9. Generate a road only if actual origin/destination pressure crosses the
   disclosed threshold and deterministic routing succeeds.
10. Update district lifecycle thresholds and costed repair countdowns.
11. Recalculate each vital independently.
12. Refresh goal progress and append one canonical turn receipt.

No step calls a model, network service, wall clock, locale, DOM, canvas or
browser storage API.

## Determinism boundary

- One seeded xorshift32 generator has serializable `{state, draws}`.
- Canonical JSON sorts every object key; arrays retain explicit order.
- All candidate arrays and path queues have stable secondary ID ordering.
- IDs derive from seed/turn/revision/cell/sequence inputs.
- Canonical simulation code contains no unseeded random or current-time call.
- Numbers entering state must be finite; stored calculations use declared
  rounding.
- Same seed plus same ordered decisions produces byte-equivalent export and
  receipt packets in fresh engines.

`hashState()` excludes `receipts`, `receiptHead` and optional observational
metadata so a receipt can contain the post-state hash without circularity. The
export checksum covers the complete state and therefore protects the receipt
array as well.

## Resource atomicity

An allocation creates a reservation, not a building. `available = stock -
reserved`. Emergence can commit only against a matching active zone reservation
and available labor. Each multi-resource operation validates a cloned draft
before the engine adopts it. Failed validation returns the unchanged state.

Population is an unassigned-person stock, labor uses worker-turn units, energy
uses energy units, materials use material units, funds use civic credits and
attention uses attention points. They are not interchangeable currency.

## Vitals and novelty

Known structures declare exact bindings to:

- livability;
- access;
- resilience;
- ecological health;
- economic circulation;
- diversity;
- unmet needs;
- steward trust.

The module has no composite city-success score. Candidate scores exist only to
select among visible candidates for one turn.

Content without a known binding remains in `noveltyReview` with
`UNSCORED_REVIEW_REQUIRED`. It cannot affect a vital, place itself, or enter an
adapter proposal. An explicit `REVIEW_NOVELTY` decision may add finite bindings
and writes an `INTERNAL_PROMOTION` receipt; even then it is not placed
automatically.

## Exact GlobeAdapter seam

The class declares these six methods and no live host mutation method:

```text
readTerrainSeed()
readWorldResources()
readExistingSettlements()
submitCityPatchProposal(input)
receiveWorldEvent(event)
exportEmergentContent(content)
```

### Host snapshot

```text
{
  schema: "axm.tycoon-steward.host-snapshot/v0.1",
  sourceWorldId,
  sourceRevision,
  provenance,
  units,
  uncertainty,
  limitations,
  consentReference,
  data
}
```

### City patch proposal

```text
{
  schema: "axm.tycoon-steward.city-patch-proposal/v0.1",
  id,
  status: "PROPOSAL_ONLY",
  targetWorldId,
  targetRevision,
  preconditions,
  requestedOperations,
  causeCostTrace,
  reversibilityStatement,
  risks,
  unknowns,
  consentReference,
  packageHash,
  liveHostMutation: false
}
```

Allowlisted operation types are `PROPOSE_DISTRICT`, `PROPOSE_ROAD`,
`PROPOSE_SERVICE` and `PROPOSE_ECO_BUFFER`. Unknown operations and stale target
revisions are refused. A disconnected adapter cannot verify a target revision
and therefore refuses proposal submission.

### Explicit host event

`receiveWorldEvent()` accepts only
`axm.tycoon-steward.globe-event/v0.1` packets with matching world ID,
non-stale revision and one of `RESOURCE_UPDATED`, `SETTLEMENT_CHANGED` or
`TERRAIN_REVISION`. It is a direct call, not a listener, fetch or subscription.

Every adapter call returns a deterministic adapter receipt stating that no live
host mutation occurred. `exportEmergentContent()` creates portable content only
and refuses unreviewed novelty.

## Browser boundary

`app.js` may render DOM, handle files, create explicit downloads and access one
namespaced local-storage key. The core cannot. Nothing loads from storage or
advances on open. Imported data is checksum/schema/chain validated before
replacement and displayed with text nodes.
