# Foundation Planet contract

## World identity and ownership

`world.axm.foundation-planet` owns its seed, global coordinate model, physical substrate, environmental profiles, world clock and persisted interventions. A game may read those systems and submit a governed action proposal later. Loading a game must never replace, reset or privately fork the canonical planet without explicit creation of a separate world lineage.

## Coordinates

Canonical locations use decimal latitude and longitude plus meters relative to mean sea level:

```json
{
  "schema": "axm.foundation-planet.coordinate/v1",
  "world_id": "world.axm.foundation-planet",
  "latitude_deg": 18.5,
  "longitude_deg": 24.5,
  "elevation_m": 412,
  "reference": "planet-mean-sea-level"
}
```

Render coordinates are disposable projections. Orbital Three.js units and local tangent-sector kilometers must never be persisted as canonical world positions.

## Hierarchical streaming

The intended simulation hierarchy is:

```text
planet climate and population fields
  → regional statistical populations
    → loaded local sectors
      → individual visible and interactive organisms
```

The first renderer uses a 120 km regional sector and a 3 km individual-organism focus sector. Leaving a sector may collapse unchanged individuals back into deterministic population state. Interventions, named organisms and game-relevant state must be recorded before collapse.

The regional tier now estimates producer biomass, species-level animal abundance, carrying capacity, decomposition activity and food-web support across the 14,400 km² sector. Those values are simulation priors, not a claim that every estimated animal exists as an individual record. Only a small focus subset is rendered. Later authoritative population state must version interventions and migration separately from these deterministic priors.

## Layer contract

Physical layers: `terrain`, `hydrology`, `groundwater`, `geology`.

Condition layers: `atmosphere`, `clouds`, `weather`, `cryosphere`.

Living layers: `vegetation`, `fauna`, `decomposers`.

The terrain substrate cannot be disabled in this lineage. Other layers can be enabled independently. The living master control changes all living layers together but does not merge their state. A barren condition profile sets natural life abundance to zero without deleting living-state history.

## Condition profiles

Profiles are parameter sets over one planet identity. They may change sea level, temperature, moisture, ice line, atmosphere rendering and natural-life abundance. They may not change the world ID, seed, coordinate reference, ownership or persisted interventions.

## Geology and hydrology

Geology is sampled from fourteen deterministic spherical plate provinces. Plate identity, crust type, crust age, motion proxy, nearest-boundary type and boundary proximity are stable coordinate data. Bedrock, soil depth and erosion risk combine that substrate with relief and climate.

Hydrology v2 is anchored to a canonical latitude/longitude grid rather than the center of a requested render window. Buffered canonical tiles route each land cell to its steepest lower neighbor. Accumulated catchment area and climate runoff determine visible reaches, discharge, width, depth and order. Each reach owns a stable grid-derived ID, canonical endpoints and a downstream-reach link. Overlapping loaded sectors must return identical canonical reach facts; their local render coordinates may differ. Sector edges publish handoffs rather than pretending the river ends. Interior sinks may form lakes. Stateful Earth columns may add current discharge, runoff, baseflow and water-table diagnostics without rewriting canonical reach identity or long-term discharge.

`axm.foundation-planet.basin-routing-engine/v1` is the durable cross-scale bridge between the 0.25-degree Earth-system grid and those canonical reaches. For each loaded land cell, one deterministic main reach is selected from the canonical reach facts inside that cell. Water leaves the Earth-cell runoff queue only when `axm.foundation-planet.basin-inlet-receipt/v1` records equal sender debit and reach credit. Reach storage persists by profile and stable reach ID. Each step derives all reach transfers from the same pre-step storage, so newly received water cannot cross several reaches in one invocation. Loaded downstream reaches receive typed reach-transfer receipts. A reach marked as an ocean outlet may deliver only to the loaded canonical ocean Earth cell containing its mouth; the receiver gains the exact freshwater mass and salinity changes from that same reservoir update. If the downstream reach, sector or mouth cell is not loaded, water stays in reach storage and `axm.foundation-planet.river-boundary-receipt/v1` names the unresolved handoff.

This implements stateful routing across the loaded canonical reach graph, not a complete planet-wide basin solve. Reach storage that leaves the visible sector remains persisted, but it cannot advance again until that canonical reach returns to a loaded graph. Depression filling, endorheic spill rules, floodplains, sediment transport, channel morphology and a resolved three-dimensional aquifer geometry remain intentionally unsolved.

## Stateful surface Earth system

`axm.foundation-planet.earth-system-column/v1` is a sparse canonical 0.25-degree surface-column model. Every cell carries a boundary layer and an `axm.foundation-planet.free-troposphere/v1` reservoir, each with temperature, water vapor and bounded cloud liquid, plus a runoff-routing queue. Boundary-layer and free-troposphere pressure thickness sum to surface pressure; the current fixed partition is 25% and 75%. The upper layer is referenced at 4.5 km. A visited land cell also carries ponded water, snow-water equivalent, root-zone water, deep-soil water, groundwater storage, soil freeze and surface heat. A visited ocean cell carries mixed-layer depth, temperature, freshwater anomaly, salinity and thermodynamic sea-ice fraction and thickness. Bedrock and soil depth select bounded porosity, field capacity, wilting point, conductivity, aquifer depth and specific yield.

Each fixed step is no longer than one planet day. Land fluxes include rain, snow, melt, sublimation, infiltration, evaporation, transpiration, percolation, recharge, capillary rise, surface runoff and baseflow. Ocean fluxes include precipitation, evaporation, mixed-layer heat storage and sea-ice freeze/melt. `axm.foundation-planet.atmosphere-phase-change-receipt/v1` names boundary-layer vapor-to-cloud condensation, cloud-to-vapor evaporation, cloud-liquid precipitation and the corresponding latent heating or cooling. `axm.foundation-planet.free-troposphere-phase-receipt/v1` separately records upper condensation, evaporation and latent heat; upper condensate does not precipitate directly at this rung. Boundary precipitation drains boundary-layer cloud liquid; when a long step needs more rain than the bounded instantaneous cloud reservoir can hold, deterministic condensation-to-precipitation subcycles may repeat without exceeding that bound. Precipitation can never exceed the vapor plus cloud water actually available above the declared minimum boundary vapor reservoir. Surface evaporation and transpiration return vapor to the boundary layer.

`axm.foundation-planet.atmosphere-vertical-exchange-receipt/v1` records a bounded two-layer lapse-rate response. It exchanges equal gross dry-air parcels, so the declared layer masses and hydrostatic pressure partition do not change, while sensible heat, vapor and cloud liquid relax conservatively between the layers. The receipt names lapse rate, moisture-dependent critical lapse, exchange fraction, gross parcel mass, tracer direction and residuals. The parameterization closes water and moist enthalpy, but it does not resolve three-dimensional convection, buoyancy or gravitational-potential work, cloud microphysics or turbulence.

Diagnostic weather relaxation remains an explicit signed atmospheric-boundary moisture and moist-enthalpy term. The atmospheric energy ledger uses the sum of both layers' sensible heat plus both vapor reservoirs' latent energy, closes both phase paths and vertical exchange internally and records surface latent input. Surface runoff and baseflow enter the persistent routing queue rather than leaving the model without a receiver. The complete column water ledger closes both atmospheric layers, surface, soil, aquifer, routing queue, ocean and ice against only the explicit boundary term. The separate surface-energy ledger accounts for surface flux, storage change and prescribed boundary heat. Numerical residuals are tested. Life-off removes transpiration but does not stop abiotic evaporation, groundwater, either atmosphere layer, cloud phase change or ocean state.

The `axm.foundation-planet.earth-system-engine/v8` sparse cache persists at most 32 recently visited columns in the browser world envelope. Condition profiles keep isolated history keys over the same canonical cell, and profile replacement is atomic so a new profile ID cannot be initialized from the preceding profile's sample. The engine refuses backward time while tolerating at most 0.0864 seconds of serialization skew between the world clock and a rounded column timestamp. Version 2 through 7 caches migrate into the v8 envelope with explicit transport clocks, runoff reservoirs, canonical-reach lineage, eastward/northward wind vectors and cloud liquid where earlier versions did not contain them. A v7 single-layer column partitions its existing vapor and cloud liquid between the new layers without creating or deleting atmospheric water and records a migration checkpoint instead of pretending the old one-layer energy ledger proves the new vertical state. Older unreleased mixed-profile caches remain invalid. The separate basin engine persists at most 4,096 reach states and never evicts stored water to satisfy that bound.

`axm.foundation-planet.earth-transport-graph/v1` connects loaded cardinal neighbors on the same canonical grid and profile. Each step derives every edge flux from the same pre-step state, scales water and pressure-derived dry-air column mass by the actual spherical cell area, then applies all transfers simultaneously. The current processes are column dry-air mass exchange down loaded pressure gradients, carried column-mean eastward/northward momentum, receipted bounded pressure-gradient forcing, exact latitude-dependent Coriolis rotation, separate boundary-layer vapor and cloud-liquid mixing, boundary-layer sensible-heat exchange with a complete two-layer moist-enthalpy ledger, hydraulic-head groundwater flow between land cells, and freshwater-anomaly plus mixed-layer heat exchange between ocean cells. Free-troposphere temperature, vapor and cloud liquid do not yet move horizontally. Water and dry air are transferred as mass, momentum as kilograms-meters per second and heat as energy, so unequal cell areas at different latitudes do not manufacture those quantities. Reversing caller cell order must produce the same state and digest.

Every absent cardinal neighbor emits `axm.foundation-planet.earth-boundary-receipt/v1`; a sparse domain never silently invents a source or sink outside the loaded graph. Time-misaligned neighbors emit an explicit refusal and do not exchange future state. Transport clocks, the last receipt and altered reservoirs persist with the engine. Atmospheric vapor plus cloud liquid are closed into the local precipitation/evaporation ledger while deterministic weather relaxation remains visible as signed boundary convergence. Neighbor transport closes vapor mass, cloud-liquid mass, their combined water mass, sensible heat and moist enthalpy independently. Surface pressure represents dry-air column mass, and scalar wind displays are derived from the carried tangent vector. `axm.foundation-planet.atmosphere-coriolis-receipt/v1` rotates that vector by the exact local Coriolis parameter derived from latitude and the planet's 86,400-second day. Northern and southern latitudes deflect opposite ways; exact rotation changes direction without materially changing speed or kinetic energy.

The loaded-domain momentum ledger subtracts the exact declared pressure and Coriolis impulses before testing its residual. Its kinetic-energy ledger separates inelastic momentum-mixing dissipation, pressure work and numerically neutral Coriolis work. The phase-change and vertical-exchange models are bounded two-layer bulk parameterizations: they conserve declared water and moist enthalpy, but they are not resolved droplet/ice microphysics, aerosol nucleation, three-dimensional convection, buoyancy or gravitational work, upper-air horizontal transport, a global circulation solution or scientific precipitation forecasting. This is conservative sparse transport plus explicit forcing and planetary exchange in local tangent coordinates, not global angular-momentum conservation or a scientific pressure-wave solver.

`axm.foundation-planet.runoff-route-receipt/v1` remains the coarse topographic fallback for water that did not enter a loaded canonical river inlet. It advances a land cell's pre-step routing queue toward its steepest lower, time-aligned loaded cardinal neighbor. Application is simultaneous: new incoming water cannot traverse several cells in one step. A land receiver retains it in its own queue; an ocean receiver gains the exact area-weighted freshwater mass and updates salinity. When no lower neighbor is loaded, the queue is retained and the receipt names the unresolved condition. Together with the basin engine this prevents sparse-domain water deletion while preserving two distinct, receipted scales. It is still not a complete global river or atmosphere model: floodplains, sediment, long-range pressure waves across unloaded cells, resolved three-dimensional vertical circulation, upper-air horizontal transport, ocean currents and three-dimensional aquifers remain later rungs.

## Seasonal and ecosystem dynamics

Seasonal state derives from canonical coordinate, axial tilt and world day. Weather cells are deterministic local conditions, not a forecast and not a global fluid solve. Pressure, wind, humidity, precipitation, lightning and fire risk provide atmospheric forcing. When a sparse Earth column exists, carried surface temperature, snow storage, plant-available soil water, surface pressure and vector wind feed back into visible local weather rather than being regenerated as unrelated values. The procedural synoptic pressure and wind remain an explicit boundary-forcing target for the local column; they do not silently replace transported state. These coupled values may drive render effects and ecosystem stepping, but their truth boundary remains `scientificModel: false`.

Visited regional population state is persisted separately from deterministic carrying-capacity priors. State records retain cumulative births, mortality, predation losses, migration, fire disturbance, recovery and governed interventions. Animal totals are reconciled into juvenile, adult and senescent cohorts; maturation and senescence use catalog life-history values. Disabling Life makes terrestrial, freshwater and marine tiers dormant; it must not delete their history. A game may not call an intervention a world fact without a future governed world-action adapter.

## Physics seam

Every loaded sector publishes `axm.foundation-planet.physics-sector/v1`: a meter-scale, right-handed floating origin whose axes are east, radial-up and north; exact transforms between that frame and canonical planet coordinates; radial gravity with latitude and altitude variation; simulation bounds; and intended collider classes for terrain, ocean, rivers and organisms. The current explorer is kinematic and ground constrained. A future general rigid-body engine attaches to this descriptor rather than turning the whole planet into one physics scene. Physics results that alter canonical world state must return governed world actions rather than writing planet state directly.

## Revisioned persistence and shared-host seam

The v2 local save is a lineage-bound, checksummed envelope. Each commit receives a monotonically increasing revision and parent revision and appends a compact typed event. A writer may provide its expected revision; stale writes fail with `REVISION_CONFLICT`.

The optional shared authority is the Workshop Living World service v0.2. It preserves the original `living-globe` compatibility slot and stores every additional world under an isolated named lineage. A Caelus bootstrap must carry `world.axm.foundation-planet`, seed `18470219`, the local lineage ID, `axm.foundation-planet.coordinate/v1` and `axm.foundation-planet.host-contract/v1`. Creation is explicit and permission-gated. Opening the renderer never creates, attaches or mutates a host.

Hosted writes carry world ID, lineage and expected revision. Stale revisions, cross-world mutation, ownership or lineage transfer, silent reset and secret-like fields are refused. The host publishes a bounded change journal and creates world-specific snapshots with guarded restore. A matching hosted lineage may become authoritative; the browser-local save remains active otherwise.

Games and physics adapters produce governed intents. They never receive apply or reset authority. `axm.foundation-planet.sector-subscription/v1` selects nearby canonical entities by great-circle radius without treating render coordinates as truth.

## Authoritative participant movement

`axm.foundation-planet.authority-kernel/v1` binds controller seats to canonical participant records. The default cap is eight participants. Inputs use `axm.controller-input/v1`, monotonically increasing seat sequences and bounded axes/buttons. Replays, unbound seats and direct client position claims are refused. A deterministic fixed-step kernel owns acceleration, speed bounds, surface or swim mode and canonical latitude/longitude/elevation updates. It emits `axm.foundation-planet.authority-patch/v1` proposals; only the Living World service may persist them. This kernel is implemented and tested, but it does not mean a shared session is automatically running.

## Species catalog seam

The local `axm.foundation-planet.species-catalog/v1` schema and versioned catalog data now declare realm occupancy, habitat envelope, salinity and water-depth bounds, freshwater dependency, trophic role, maturity, reproduction strategy, life strategy, keystone role, movement model, activity cycle, asset archetype and simulation fidelity tiers. The renderer consumes catalog entries; it does not define biological truth. Rung 5 contains 96 broad ecological archetypes across terrestrial, freshwater, coastal, marine and deep-marine systems, not every real species. Future catalog versions may add entries without changing world coordinates or render code. A catalog update must preserve stable species IDs or publish an explicit migration.
