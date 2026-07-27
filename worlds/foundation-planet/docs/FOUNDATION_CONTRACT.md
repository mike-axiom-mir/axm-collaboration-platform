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

`axm.foundation-planet.basin-routing-engine/v4` is the durable cross-scale bridge between the 0.25-degree Earth-system grid and those canonical reaches. For each loaded land cell, one deterministic main reach is selected from the canonical reach facts inside that cell. Water leaves the Earth-cell runoff queue only when `axm.foundation-planet.basin-inlet-receipt/v3` records equal sender debit and reach credit. That inlet also records an explicit parameterized land-runoff chemistry boundary derived from freshwater volume, local ecology, substrate and temperature. It credits persistent `axm.foundation-planet.river-chemistry-state/v1` reservoirs for dissolved inorganic and organic carbon, inorganic nitrogen and phosphorus, and dissolved oxygen. Land ecology does not yet own phosphorus or oxygen reservoirs and is not debited for those headwater inputs, so this boundary remains named rather than disguised as a closed soil-to-river material route.

Water and chemistry persist together by profile and stable reach ID. Each step derives all reach transfers from the same pre-step storage, so newly received material cannot cross several reaches in one invocation. `axm.foundation-planet.river-reach-transfer/v3` records the exact C/N/P/O2 sender debit and downstream receiver credit beside water. A reach marked as an ocean outlet may deliver only to the loaded canonical ocean Earth cell containing its mouth.

Before ocean credit, `axm.foundation-planet.estuary-state/v1` persistently retains sediment organic carbon, nitrogen and phosphorus at that mouth. `axm.foundation-planet.estuary-flux-receipt/v1` converts oxygen-limited DOC respiration into DIC, records dissolved-oxygen consumption, retains bounded C/N/P fractions, and exposes denitrified nitrogen as an explicit gas boundary. `axm.foundation-planet.ocean-mouth-receipt/v4` therefore partitions one exact river debit among persistent estuary sediment, oxygen consumption, a nested `axm.foundation-planet.atmosphere-gas-boundary-input-receipt/v1` that credits denitrified nitrogen to the receiving coastal column's local atmosphere, and a nested `axm.foundation-planet.ocean-ecology-river-input-receipt/v1` for the remaining dissolved coastal-ocean credit. River, estuary, atmosphere, ocean and combined ledgers close independently. Oxygen consumption remains an explicit reaction term rather than an atmospheric receiver, and this bounded reactor is not resolved estuary hydrodynamics. If the downstream reach, sector or mouth cell is not loaded, both water and chemistry stay in reach storage and `axm.foundation-planet.river-boundary-receipt/v1` names the unresolved handoff.

This implements stateful routing across the loaded canonical reach graph, not a complete planet-wide basin solve. Reach storage that leaves the visible sector remains persisted, but it cannot advance again until that canonical reach returns to a loaded graph. A v2 basin snapshot migrates with empty estuary storage rather than invented historical sediment. At this historical rung, depression filling, endorheic spill rules, floodplains, channel morphology, resolved estuary circulation and a resolved three-dimensional aquifer geometry remained intentionally unsolved. The Rung 36 and Rung 37 addenda below supersede only finite mineral routing and bounded floodplain exchange; neither claims resolved channel morphology or inundation hydraulics.

## Stateful surface Earth system

`axm.foundation-planet.earth-system-column/v1` is a sparse canonical 0.25-degree surface-column model. Every cell carries a boundary layer and an `axm.foundation-planet.free-troposphere/v2` compatibility reservoir, each with temperature, water vapor, bounded cloud liquid, bounded cloud ice and an independent eastward/northward wind vector, plus a runoff-routing queue. Boundary-layer and free-troposphere pressure thickness sum to surface pressure. New columns begin at a 25%/75% partition; horizontal transport may evolve the boundary fraction within 8% to 50%, and local pressure forcing preserves the transported fraction. Representative layer heights are terrain plus 0.5 km and terrain plus 4.5 km. Layer dry-air mass and sensible-heat capacity scale with actual pressure thickness. A visited land cell also carries ponded water, aged snow-water equivalent, root-zone water, deep-soil water, groundwater storage, soil freeze and surface heat. A visited ocean cell carries mixed-layer depth, temperature, freshwater anomaly, salinity, thermodynamic sea-ice water equivalent/fraction/thickness, and a distinct aged snow-on-sea-ice reservoir. Bedrock and soil depth select bounded porosity, field capacity, wilting point, conductivity, aquifer depth and specific yield.

Each column also owns `axm.foundation-planet.atmosphere-biogeochemistry-state/v3`: persistent local carbon-dioxide carbon, oxygen and nitrogen-gas reservoirs in eight ordered `axm.foundation-planet.atmosphere-biogeochemistry-layer/v1` records aligned with the native pressure column. The whole-column fields are exact sums and compatibility projections, not a second reservoir. Land and ocean ecology still expose their established exchangeable-atmosphere fields for compatibility, but those fields are synchronized mirrors rather than independent reservoirs. `axm.foundation-planet.atmosphere-biosphere-gas-flux-receipt/v1` closes each local land-atmosphere or ocean-atmosphere C/O2 exchange at native surface layer 0, and estuary denitrification credits that same surface layer through the typed boundary-input receipt described above. `axm.foundation-planet.atmosphere-biogeochemistry-vertical-transport-receipt/v1` consumes all seven native adjacent dry-air exchange receipts, applies ordered conservative lower/upper composition exchange, and closes C/O2/N2 without claiming molecular diffusion or three-dimensional plumes. Loaded horizontal transport is described with the Earth transport graph below. These gases are not globally mixed, so their CO2 ppm, oxygen and nitrogen fractions remain local bounded proxies rather than a global atmospheric-composition or chemistry claim.

`axm.foundation-planet.atmosphere-pressure-column/v2` is the persisted native vertical state inside
that Earth-system column. It contains eight bottom-to-top
`axm.foundation-planet.atmosphere-pressure-layer/v2` records. The lower two layers aggregate into the
boundary-layer compatibility band and the upper six aggregate into the free-troposphere compatibility
band. Each native layer persists pressure thickness and its derived dry-air mass, air temperature,
vapor water, cloud liquid, cloud ice, eastward/northward wind and momentum, sensible and moist enthalpy,
horizontal kinetic energy and terrain-referenced geopotential energy. Contiguous interface pressures
descend from surface pressure to the model top. Interface and center heights use the hypsometric
relation with the layer's vapor- and liquid-adjusted virtual temperature. The last geometry interval
uses a declared 0.1 hPa pressure floor so a zero-mass model-top boundary does not imply infinite
height; all pressure thickness and therefore all declared dry-air mass remains in the eight layers.

The two legacy bands are now an explicit compatibility projection rather than a claim that the
persisted vertical state has only two levels. Weather boundary relaxation and existing surface
consumers still produce or consume band aggregates. Before native local thermodynamics, an
`axm.foundation-planet.atmosphere-pressure-column-sync-receipt/v2` maps changed boundary forcing into
the eight levels. After compatibility-only surface processes, the same schema
rescales native layer pressure thicknesses within the affected band, preserves native temperature
anomalies, maps exact vapor and cloud totals, and shifts tangent-wind profiles to the requested
aggregate momentum. Native shear that would exceed the 90 m/s per-level bound is coherently reduced
around the requested band mean instead of clipping levels independently. The receipt closes surface
and band pressure, dry-air mass, vapor, cloud liquid, cloud ice, moist enthalpy and both tangent-momentum
components against the compatibility target. It also names native shear kinetic energy and the
geopotential representation adjustment between the old two representative heights and the eight
hypsometric layer centers.

Each fixed step is no longer than one planet day. Land fluxes include rain, snow, melt, sublimation, infiltration, evaporation, transpiration, percolation, recharge, capillary rise, surface runoff and baseflow. Ocean fluxes include typed rain and snow, evaporation, mixed-layer heat storage and sea-ice freeze/melt. Every native level computes a pressure-local saturation capacity blended over water and ice from its dry-air mass, center pressure and temperature. `axm.foundation-planet.atmosphere-pressure-layer-phase-receipt/v2` records that level's initial/final vapor, cloud liquid, cloud ice and temperature; condensation/deposition; evaporation/sublimation; liquid/ice freezing and melting; precipitation source phase; descent phase changes; vaporization and fusion heat; and water and moist-enthalpy residuals. The lower-two and upper-six results are also projected into `axm.foundation-planet.atmosphere-phase-change-receipt/v2` and `axm.foundation-planet.free-troposphere-phase-receipt/v2` compatibility schemas so existing consumers do not need to invent a second atmosphere.

Combined native cloud liquid plus ice remains bounded to 12 mm across the lower two levels and 8 mm across the upper six, apportioned by pressure thickness. When a long step needs more precipitation than that instantaneous capacity, deterministic condensation/deposition-to-precipitation subcycles may repeat without exceeding it. Each `axm.foundation-planet.atmosphere-precipitation-descent-receipt/v2` identifies the source level and rain/snow phase, every crossed interface, each melting/freezing transition with its receiving-layer fusion heat, and the typed surface rain/snow destination with equal sender debit and receiver credit. Upper condensate can therefore reach the surface only through an explicit native descent route. Precipitation can never exceed cloud plus vapor actually available above the declared 0.2 mm boundary-band vapor floor and the finite per-upper-level numerical floor. Weather-demanded condensation and deposition are bounded nucleation parameterizations, not resolved aerosol, droplets, ice crystals or collision/coalescence microphysics. Surface evaporation and transpiration return vapor to the boundary compatibility band and are reconciled back into the native column.

`axm.foundation-planet.native-cloud-optics/v1` derives independent liquid and ice water paths from all
eight native layers. Those paths produce bounded broadband shortwave and longwave optical depths,
cloud cover and a condensate-weighted emission temperature. The
`axm.foundation-planet.atmosphere-co2-radiative-coupling-receipt/v1` reads the authoritative eight-layer
gas state and matching native pressure-temperature paths. It derives a bounded grey optical depth and
surface contribution per layer, compares the result against 420 ppm at the same temperatures, applies
a bulk cloud-overlap mask and caps the surface adjustment at +/-20 W/m2. A true 420 ppm profile is
reference-neutral; layer ordering remains causal because emission temperature and transmission through
lower layers are retained in each typed layer record. The
`axm.foundation-planet.surface-radiation-receipt/v2` nests this receipt and records top-of-atmosphere
forcing, clear-sky and cloud transmissivity, absorbed surface shortwave, upward and downward longwave,
baseline downward longwave, the CO2 adjustment, cloud shortwave and longwave forcing, and the applied
surface albedo. Land albedo blends substrate, the persistent active
canopy and snow whose reflectivity decays with persisted age; snow masks part of the canopy rather than
silently replacing its structure. Ocean albedo blends open water with thickness-dependent sea
ice and any snow retained on that ice. These fluxes causally enter surface heat storage. Radiation
reads composition at local-step start, so gas exchange and transport affect the next local radiation
step. These are broadband bulk parameterizations, not spectral or line-by-line radiative transfer,
resolved cloud particle optics or a scientific climate closure.

`axm.foundation-planet.cryosphere-phase-receipt/v1` closes the phase enthalpy of land snow, ocean snow
and sea-ice water equivalent using the same 334,000 J/kg fusion constant and liquid-water reference as
the atmosphere. Incoming snow carries negative phase enthalpy. Melt and sublimation consume energy;
ice growth releases it. Ocean freezing uses the local salinity-derived freezing point, while conserved
mean ice mass determines bounded concentration and thickness. Snow falling over open water melts into
the freshwater anomaly; snow falling on the ice fraction persists and ages. This is thermodynamic
surface ice, not brine-pocket physics, leads, ridging, rafting or dynamic sea-ice transport.

`axm.foundation-planet.land-ecology-state/v1` is the persistent physical land-vegetation checkpoint.
It retains a bounded functional type; canopy cover, leaf area, height, root depth, roughness and
albedo; living, litter, soil-organic and local exchangeable-atmosphere carbon; and living, litter,
organic-soil and mineral nitrogen. `axm.foundation-planet.land-ecology-flux-receipt/v1` records
absorbed-light gross primary production, nitrogen-limited retained growth, autotrophic and
heterotrophic respiration, litterfall, humification, mineralization and uptake, with independently
tested carbon and nitrogen residuals. Rooted canopy demand feeds transpiration, canopy and litter
suppress exposed-soil evaporation, canopy cover changes surface albedo, and canopy height changes
aerodynamic roughness. The atmospheric carbon reservoir is deliberately a local exchangeable proxy
and exact mirror of its atmosphere-owned column state; it is carried only by loaded native dry-air
routes and is not a globally mixed pressure tracer.

`axm.foundation-planet.ocean-ecology-state/v2` is the persistent mixed-layer and deep-ocean marine checkpoint. It
retains local exchangeable-atmosphere and dissolved inorganic carbon, dissolved organic carbon,
phytoplankton, zooplankton and detritus carbon; dissolved, plankton and detrital nitrogen and
phosphorus; and local exchangeable-atmosphere plus dissolved oxygen. Its water-column diagnostics
derive chlorophyll, euphotic depth, oxygen saturation and hypoxia risk from those reservoirs.
`axm.foundation-planet.ocean-ecology-flux-receipt/v2` records light-, temperature-, open-water-,
nitrogen- and phosphorus-limited gross and retained primary production; grazing, mortality,
oxygen-limited respiration and remineralization; photosynthetic oxygen production; and local
air-sea carbon and oxygen exchange. Carbon, nitrogen and phosphorus close as local element ledgers;
oxygen closes against its declared photosynthetic and respiratory fluxes. The atmosphere values are
local exchangeable proxies, not globally mixed gas tracers. The plankton process is a bounded bulk
parameterization, not mechanistic plankton biochemistry or resolved individuals.

Each v2 checkpoint owns `axm.foundation-planet.deep-ocean-state/v1`: deep dissolved inorganic and
organic carbon, inorganic nitrogen and phosphorus, dissolved oxygen, detrital C/N/P and persistent
seafloor-buried organic C/N/P. `axm.foundation-planet.deep-ocean-exchange-receipt/v1` records signed
dissolved exchange from concentration gradients, sinking detrital export, oxygen-limited deep
remineralization and burial. Mixed-layer plus deep C/N/P close internally; oxygen closes against the
explicit deep respiration term. Life-off keeps dissolved physical exchange active while freezing
sinking, remineralization and burial. This is a sparse vertical bulk organ, not resolved thermohaline
circulation, water masses, gyres, eddies or bathymetric currents.

All seven adjacent native interfaces emit `axm.foundation-planet.atmosphere-adjacent-layer-exchange-receipt/v3`. Each interface derives a bounded background and lapse/moisture-instability exchange fraction, moves equal gross dry-air parcels upward and downward without changing either layer's dry-air mass, and transports sensible heat, vapor, cloud liquid, cloud ice and both tangent-momentum components. Tangent kinetic energy lost by mixing is returned to native sensible heat. Equal gross geopotential transfer is recorded in both directions.

Every interface also owns `axm.foundation-planet.atmosphere-pressure-vertical-interface/v1` state: convective kinetic energy, effective moving mass, bounded updraft velocity, and an exactly compensating downdraft velocity and momentum. Its `axm.foundation-planet.atmosphere-pressure-interface-buoyancy-receipt/v1` lifts the lower parcel over the actual adjacent-center separation using the moisture-dependent critical lapse rate, compares virtual temperature to the upper ambient layer, and converts only bounded positive buoyancy work from sensible heat into that interface's kinetic reservoir. Stable kinetic energy decays on a declared time scale and is returned to both adjacent layers. Equal entrained and detrained bulk dry-air mass is explicit; this is a conservative bulk closure, not resolved plume geometry.

The composite `axm.foundation-planet.atmosphere-pressure-column-dynamics-receipt/v3` contains all eight mixed-phase receipts, all seven interface receipts, every typed precipitation route and per-interface rain/snow totals. Moist enthalpy uses liquid water as the phase reference, includes vapor latent energy and subtracts cloud-ice fusion energy; the outgoing phase enthalpy of surface snow is explicit. The receipt closes native water, moist enthalpy after fusion, horizontal and convective kinetic conversion, eastward/northward momentum, paired vertical momentum, horizontal kinetic energy, convective kinetic energy and resolved energy. `pressureLevelDynamicsResolved` is true only after this native step has produced valid evidence. It does not mean resolved droplets or crystals, three-dimensional convection, turbulence or scientific forecast authority.

`axm.foundation-planet.atmosphere-vertical-exchange-receipt/v3` is the compatibility projection of those seven native receipts. It retains the established boundary/free display fields and aggregate energy terms for consumers, but it does not run a second two-band physical process. It names all native interface receipts and explicitly marks `boundedTwoLayerParameterization: false` and `threeDimensionalConvection: false`.

Diagnostic weather relaxation remains an explicit signed atmospheric-boundary moisture and moist-enthalpy term. The atmospheric moist-enthalpy ledger uses the compatibility projection of all eight levels' sensible heat plus vapor latent energy, closes native phase change, records surface latent input, and subtracts native tangent-momentum thermalization plus the native interface buoyancy/dissipation conversion projected by the v3 receipt. The complete vertical ledger additionally includes horizontal and seven-interface convective kinetic energy plus terrain-referenced atmospheric geopotential energy. Surface runoff and baseflow enter the persistent routing queue rather than leaving the model without a receiver. The complete column water ledger closes all native atmospheric water, surface, soil, aquifer, routing queue, ocean, sea ice and snow-on-ice against only the explicit boundary term. The surface-energy ledger now accounts for receipted cloud radiation, sensible and vaporization flux, prescribed deep-surface boundary relaxation, incoming-snow phase enthalpy, frozen-water fusion storage and sensible surface storage. Numerical residuals are tested. Life-off freezes the persistent land-ecology carbon and nitrogen pools, emits a dormant zero-physiology receipt and removes transpiration. It also freezes plankton, particulate organic matter, sinking export, deep remineralization and burial while continuing receipted physical air-sea and mixed-to-deep dissolved exchange. Life-off does not stop abiotic evaporation, groundwater, pressure-level thermodynamics, radiation, snow/ice phase change, convective-energy decay, mixed-layer heat, salinity or physical ocean chemistry.

The `axm.foundation-planet.earth-system-engine/v23` sparse cache persists at most 32 recently visited columns in the browser world envelope. Condition profiles keep isolated history keys over the same canonical cell, and profile replacement is atomic so a new profile ID cannot be initialized from the preceding profile's sample. The engine refuses backward time while tolerating at most 0.0864 seconds of serialization skew between the world clock and a rounded column timestamp. Version 2 through 22 caches migrate into the v23 envelope with explicit transport clocks, runoff reservoirs, canonical-reach lineage, layer wind vectors, mixed-phase cloud fields, pressure-coordinate state and only the dynamics evidence those versions actually contained. A v22 column's legacy `surface-radiation-receipt/v1` is invalidated rather than promoted into fabricated CO2 evidence; the first real local step earns a v2 receipt. A v21 gas-state v2 column partitions its exact bulk C/O2/N2 totals over the eight persisted pressure layers in proportion to dry-air mass, marks the migration checkpoint, and gains no fabricated vertical or horizontal transport receipt. A v20 gas-state v1 column first gains the horizontal-lineage fields without fabricated routes; a v19 column promotes its existing land or ocean exchangeable-atmosphere proxy into the authoritative local gas reservoir exactly once without duplicating carbon or oxygen. Older land, ocean, cryosphere, cloud and native-interface migrations retain their established empty-checkpoint and conservation guarantees. Existing v23 snapshots restore exactly, including native clouds, frozen-surface state, all seven interface reservoirs, eight-level atmospheric gases, current CO2-radiation lineage and current vertical/horizontal lineage, land, mixed-layer and deep-ocean ecology pools and current receipts. Older unreleased mixed-profile caches remain invalid. The separate basin engine persists at most 4,096 reach states and never evicts stored water or chemistry to satisfy that bound. A v1 water-only basin snapshot migrates each reach with an explicit empty chemistry checkpoint and never fabricates historical solutes; v2 snapshots add empty estuary storage, and v3 snapshots gain the atmosphere receiver without invented historical nitrogen-gas inputs.

`axm.foundation-planet.earth-transport-graph/v1` connects loaded cardinal neighbors on the same canonical grid and profile. Each `axm.foundation-planet.earth-transport-step/v8` derives every edge flux from the same pre-step state, scales water and pressure-derived dry-air mass by actual spherical cell area, then applies all transfers simultaneously. `axm.foundation-planet.atmosphere-pressure-horizontal-transport-receipt/v2` contains eight ordered level ledgers plus every mass, tracer, pressure-impulse and Coriolis receipt. Each `axm.foundation-planet.atmosphere-pressure-layer-horizontal-mass-route-receipt/v1` identifies one native level, sender, receiver and transfer ID; records equal dry-air debit and credit; and names the parcel's carried vapor, cloud liquid, cloud ice, absolute sensible enthalpy, tangent momentum and geopotential energy. Independent bounded pressure-gradient and wind/Courant terms determine each level's route. Native-level tracer mixing is separate from dry-air advection. `axm.foundation-planet.atmosphere-biogeochemistry-transport-receipt/v2` reuses those exact native dry-air routes as its backbone. Every `axm.foundation-planet.atmosphere-biogeochemistry-route-receipt/v2` names its parent transfer and carries carbon-dioxide carbon, oxygen and nitrogen gas from the sender's pre-step composition at that route's native layer; it explicitly records that no whole-column average was used. Simultaneous application closes all three area-weighted loaded-domain reservoirs and eight separate level ledgers; per-column local receipts retain eight layer ledgers, the domain digest and exact incoming/outgoing lineage, and compatibility ecology mirrors are resynchronized after commit. Hydraulic-head groundwater flow between land cells and freshwater-anomaly plus mixed-layer heat exchange between ocean cells remain parallel processes. Loaded ocean-ocean edges also mix fourteen persistent dissolved, plankton and detrital C/N/P/O2 pools. Every pool emits a typed `axm.foundation-planet.ocean-ecology-transport-receipt/v1`, is bounded by donor availability, and closes area-weighted carbon, nitrogen, phosphorus and oxygen domain ledgers. Local exchangeable atmospheric gas proxies are deliberately not transported by this ocean process because the atmosphere-owned transport seam is authoritative. Water and dry air are transferred as mass, momentum as kilograms-meters per second and heat as energy, so unequal cell areas at different latitudes do not manufacture those quantities. Reversing caller cell order must produce the same state and digest.

Every absent cardinal neighbor emits `axm.foundation-planet.earth-boundary-receipt/v1`; a sparse domain never silently invents a source or sink outside the loaded graph. Time-misaligned neighbors emit an explicit refusal and do not exchange future state. Transport clocks, the domain receipt, each column's compact `axm.foundation-planet.atmosphere-pressure-column-horizontal-local-receipt/v2` and altered reservoirs persist with the engine. Atmospheric vapor plus cloud liquid plus cloud ice close into the local precipitation/evaporation ledger while deterministic weather relaxation remains visible as signed boundary convergence. Neighbor transport closes every native level's dry-air mass, combined mixed-phase water, fusion-aware moist enthalpy, tangent momentum, horizontal kinetic energy and resolved energy. Surface pressure is the sum of all eight native pressure thicknesses; the two scalar band displays are mass-weighted compatibility projections. `axm.foundation-planet.atmosphere-pressure-layer-horizontal-coriolis-receipt/v1` rotates every native tangent vector by the exact local Coriolis parameter derived from latitude and the planet's 86,400-second day. Northern and southern latitudes deflect opposite ways; exact rotation changes direction without materially changing speed or kinetic energy.

The loaded-domain momentum ledger subtracts every level's exact declared pressure and Coriolis impulses before testing its residual. Its kinetic-energy ledger separates inelastic momentum-mixing dissipation, pressure work and numerically neutral Coriolis work. Each mass receipt embeds `axm.foundation-planet.atmosphere-pressure-layer-horizontal-geopotential-route-receipt/v1`, which records terrain-following sender/receiver heights, carried potential energy and exact destination adjustment work. Hydrostatic height reconstruction is also named so the eight-level geopotential and resolved-energy ledgers close. Projecting eight distinct winds and heights into two display bands necessarily discards within-band variance; the compatibility ledger records those kinetic and geopotential representation terms instead of reporting them as physical loss. Native interface convection is still a bounded bulk parameterization. None of these paths is resolved droplet/ice microphysics, aerosol nucleation, three-dimensional plumes, continuous circulation across unloaded cells, a global circulation solution or scientific precipitation forecasting. This is conservative sparse transport plus explicit forcing and planetary exchange in local tangent coordinates, not global angular-momentum conservation or a scientific pressure-wave solver.

After loaded horizontal transport commits its simultaneous eight-level state, every destination
column normalizes its hypsometric geometry and projects the result into the two compatibility bands.
The native domain receipt proves level-indexed sender/receiver routes and per-level closure; the
per-column local receipt retains its exact domain digest. The pressure-column sync receipt separately
proves that the compatibility projection preserves dry-air mass, water, moist enthalpy and tangent
momentum. The compatibility fields are consumers of native state, not horizontal transport authority.

`axm.foundation-planet.runoff-route-receipt/v1` remains the coarse topographic fallback for water that did not enter a loaded canonical river inlet. It advances a land cell's pre-step routing queue toward its steepest lower, time-aligned loaded cardinal neighbor. Application is simultaneous: new incoming water cannot traverse several cells in one step. A land receiver retains it in its own queue; an ocean receiver gains the exact area-weighted freshwater mass and updates salinity. When no lower neighbor is loaded, the queue is retained and the receipt names the unresolved condition. Together with the basin engine this prevents sparse-domain water deletion while preserving two distinct, receipted scales. At this historical rung, floodplains and sediment remained absent; Rungs 36 and 37 later add finite material and bounded loaded-reach floodplain storage. Long-range pressure waves across unloaded cells, resolved three-dimensional vertical circulation, continuous plume-scale buoyancy and entrainment, continuous upper-air circulation outside the sparse loaded graph, ocean currents and three-dimensional aquifers remain later rungs.

### Rung 34 soil/runoff material ownership addendum

This addendum supersedes the earlier parameterized land-runoff boundary text. Earth-system engine v24
adds `axm.foundation-planet.soil-biogeochemistry-state/v1` to every land column and
`axm.foundation-planet.runoff-biogeochemistry-queue/v1` beside its water queue. The soil state owns
finite dissolved inorganic carbon, dissolved organic carbon, inorganic nitrogen, inorganic phosphorus
and oxygen per square meter. `axm.foundation-planet.soil-runoff-mobilization-receipt/v1` debits those
pools and credits the persistent queue by an identical amount using a runoff-dependent fraction.
Zero runoff moves zero material.

Earth transport v9 applies the same pre-step water fraction to the runoff chemistry queue. Each routed
receipt nests `axm.foundation-planet.runoff-biogeochemistry-transfer-receipt/v1` sender evidence and
either an area-weighted land-queue receiver or
`axm.foundation-planet.ocean-ecology-runoff-input-receipt/v1`. All applications are simultaneous, so
newly received chemistry cannot traverse a second cell during the same invocation. Dedicated runoff
queue and dissolved-ocean receiver ledgers close C/N/P/O2 independently of atmospheric compatibility
mirrors.

Basin engine v5 and inlet receipt v4 debit the same Earth-cell queue before river chemistry v2 accepts
the exact pools. Sender and receiver use one transfer ID. The coupled basin ledger includes land runoff
as an internal persistent reservoir; `parameterizedLandRunoffChemistryBoundary` is false. River,
estuary, ocean and atmosphere behavior downstream remains as previously contracted.

Engine v23 saves migrate to v24 with an explicit empty soil checkpoint and empty runoff chemistry
queue. The first genuine local step establishes a named canonical soil initial condition and exports
nothing; a later real step may mobilize it. Transport v8 and basin v4 receipts are retained only as
legacy evidence and cannot satisfy v9/v5 sender-debit checks. Basin v4 reach chemistry pools migrate
exactly to river chemistry v2, while old parameterized cumulative inputs remain labeled as legacy.
The organ is bounded bulk soil-water chemistry, not resolved soil horizons, mineral weathering,
sorption, redox kinetics, pore networks or scientific watershed chemistry.

### Rung 35 experience projection and authority membrane addendum

`axm.foundation-planet.experience-sector-capsule/v1` is the planet-owned, renderer-independent handoff
for games, observers, AI stewards and future Holodeck or Experiment World brokers. It is created from a
typed `axm.foundation-planet.experience-source/v1` and binds the Caelus world ID, lineage, exact source
revision, current save checksum, canonical latitude/longitude/elevation anchor, local floating-origin
physics frame, active layers, environment, loaded hydrology, Earth-system column and regional ecology.
Environment, layers, hydrology, Earth-system, ecology and physics each receive a component checksum;
their aggregate enters the capsule checksum. Set-like feature lists are normalized before hashing.

The capsule is not canonical state, contains no live Three.js renderer objects and has no mutation,
apply, reset or promotion authority. `axm.foundation-planet.experience-lease/v1` declares exactly one of
three access modes:

- `observer` may receive `axm.foundation-planet.experience-observation/v1` structured state and cannot
  propose a world action;
- `player` may emit `axm.foundation-planet.world-action-proposal/v1`, bound to the capsule and expected
  source revision, but cannot apply it;
- `sandbox` may emit `axm.foundation-planet.detached-sandbox-fork/v1` and mutate that detached candidate
  creatively, but the fork cannot write back or promote itself.

All three use `axm.foundation-planet.experience-intent/v1` plus a monotonic lease sequence. Receipts use
`axm.foundation-planet.experience-intent-receipt/v1`, preserve refusals, and state that neither capsule
nor canonical world was changed. A stale sequence, mismatched actor, wrong capsule lineage, unsupported
schema, exhausted lease budget or mode/authority mismatch fails closed. Proposal payloads are finite,
JSON-only and bounded; open-ended action kinds do not imply permission to execute them.

`axm.foundation-planet.experience-protocol-audit/v1` is read-only and independently validates capsule,
lease, receipt, proposal and sandbox-fork digests plus the no-authority truth boundary. API v31 exposes
the capsule/lease/dispatch/audit seam. Mirror, Holodeck and Experiment World are explicitly unconnected;
the first real cross-system broker, canonical writeback adapter or promotion path is a separate serious
integration step requiring human-governed review.

### Rung 36 finite geomorphic sediment addendum

Each canonical land column now owns finite clay, silt, sand and gravel in
`axm.foundation-planet.surface-sediment-state/v1`. Its declared initial inventory is derived from
substrate texture, soil depth and bulk density. `axm.foundation-planet.surface-erosion-receipt/v1`
uses surface runoff, rainfall impact, a bounded slope proxy, substrate erosion risk, canopy/litter
protection and freeze state to debit only material actually owned by that cell. The exact debit credits
`axm.foundation-planet.runoff-sediment-queue/v1`. A dry step exports zero, no grain can become negative,
and `geomorphicElevationAdjustmentM` records only the bounded local lowering associated with the
debited mass.

Earth transport v10 uses the exact routed water fraction for
`axm.foundation-planet.runoff-sediment-transfer-receipt/v1`. A loaded land receiver gets an
area-weighted queue credit; a loaded ocean receiver gets
`axm.foundation-planet.coastal-sediment-input-receipt/v1`, partitioned between persistent suspended
and deposited coastal grain pools. Sender and receiver share one transfer ID. Missing neighbors retain
the queue rather than dropping mineral mass.

Basin engine v6 and inlet receipt v5 debit the Earth-cell sediment queue before
`axm.foundation-planet.river-sediment-input-receipt/v1` credits persistent reach suspended load.
`axm.foundation-planet.river-reach-transfer/v4` derives its load from the pre-step reach state,
grain-selectively deposits a fraction into persistent bed storage and credits the remainder to the
downstream reach. `axm.foundation-planet.ocean-mouth-receipt/v5` performs the same exact sender debit
and bed partition before crediting the loaded coast. Unloaded downstream or mouth handoffs retain both
suspended and bed material and publish `retainedSedimentKg`. Runoff, river, coast and combined ledgers
close independently for clay, silt, sand and gravel.

Earth engine v24 and basin v5 restore through explicit empty migration checkpoints. They invent no
historical erosion or sediment transport, invalidate legacy receipts and require a genuine later step
to earn current evidence. `axm.foundation-planet.system-audit/v1` now verifies the local surface/queue
schema pair, exact transport sender/receiver receipts, basin inlet lineage, persistent river/coastal
truth and per-grain residuals. The experience capsule retains land surface sediment, runoff queue and
ocean coastal sediment inside its digest-bound Earth-system component. API v32 exposes the organ
description and complete selected state.

The contract remains deliberately bounded: this is a finite bulk material cycle, not a scientific
erosion, soil-formation or landscape-evolution model. It does not resolve entrainment thresholds,
abrasion, grain-shape evolution, channel cross-sections, bank migration, floodplains, deltas, coastal
currents, morphodynamic feedbacks or an always-loaded global sediment network.

## Rung 37 floodplain addendum

`axm.foundation-planet.basin-routing-engine/v7` adds one persistent
`axm.foundation-planet.floodplain-state/v1` beside every owned canonical reach state. The reservoir
owns water, dissolved C/N/P/O2 chemistry, suspended clay/silt/sand/gravel and grain-resolved deposits.
Channel and floodplain are distinct owners. Reach length, width and depth define a declared bulk
bankfull capacity; channel water above it can be debited into floodplain storage. A finite recession
fraction can later debit floodplain water and its proportional chemistry/suspended load back to the
channel.

Every exchange publishes `axm.foundation-planet.floodplain-exchange-receipt/v1`. The receipt binds the
reach, clock, bankfull controls, overbank and return water, both chemistry directions, grain-selective
overbank entrainment, grain-selective deposition and combined residuals. Basin water totals include
both channel and floodplain storage. Basin chemistry and sediment totals likewise include floodplain
reservoirs, so internal exchange cannot masquerade as a boundary source or sink. Unloaded reaches
retain their floodplain state and boundary receipts name retained floodplain water and sediment.

A basin v6 snapshot without floodplain state restores through an empty migration checkpoint. The
first v7 exchange observation clears that checkpoint without moving channel matter, preventing
invented historical inundation. Pre-v7 receipts are not accepted as current floodplain evidence.
The system audit checks receipt schema, paired ownership, water/chemistry/grain residuals and the
truth boundary independently of the general basin check. API v33 exposes the state and compact
diagnostics; experience capsules may carry the bounded semantic reach projection without renderer or
world-mutation authority.

This addendum resolves only persistent, conservative bulk overbank storage and return at loaded
canonical reaches. It does not claim a terrain-raster inundation surface, hydraulic backwater,
levees, bank erosion or failure, floodplain vegetation succession, deposit remobilization, continuous
unloaded-reach evolution or scientific flood forecasting.

## Rung 38 habitat-potential addendum

`axm.foundation-planet.basin-routing-engine/v8` adds a read-only
`axm.foundation-planet.floodplain-habitat-state/v1` to each owned reach. It observes persisted
floodplain material and stores only witnessed wet/dry duration, spell continuity, flood-pulse count,
rolling hydroperiod, peak inundation, deposit increments and bounded fertility signals. Its normalized
open-water, mudflat, reed/sedge, wet-meadow and riparian-woodland fractions are habitat potential, not
plant biomass, species occupancy or population state. Every transition binds to the exact material
exchange digest and proves the observer left the floodplain byte-identical. A v7 migration starts with
zero historical days and pulses.

## Rung 39 flood-event addendum

`axm.foundation-planet.basin-routing-engine/v9` adds
`axm.foundation-planet.flood-event-history-state/v1` beside material floodplain ownership and habitat
memory. The organ observes, but cannot mutate, the exact v1 floodplain exchange. A wet observation
starts or continues an event; the first later dry observation completes it. Events preserve start/end
boundaries, wet duration, observation count, peak water and inundated fraction, integrated inundation
exposure, overbank and return water, C/N/P/O2 payload, and clay/silt/sand/gravel overbank and deposit
payload. `axm.foundation-planet.flood-event-transition-receipt/v1` binds each lifecycle transition to
the exact exchange digest plus equal before/after material digests.

Each reach retains at most the most recent 32 completed events. Lifetime completion/eviction counts,
mean duration, mean recurrence interval and historical peaks remain compact after detail eviction.
The archive and receipt ordering are deterministic. A v8 snapshot restores through an empty event
checkpoint; if its current floodplain is wet, the state must first witness a dry boundary and cannot
invent a pre-migration event. API v35 and the experience capsule expose only a bounded, non-authoritative
semantic projection. The system audit checks schema, exchange lineage, observer purity, lifecycle truth
and archive bounds independently.

This event record is limited to loaded reach observations. It is not a scientific flood-frequency
model, flood forecast, terrain-resolved inundation history, or proof of events while a reach was
unloaded. Completed-event duration counts observed wet intervals; `endDay` is the first observed dry
boundary.

## Rung 40 floodplain-succession addendum

`axm.foundation-planet.basin-routing-engine/v10` adds
`axm.foundation-planet.floodplain-succession-state/v1` to every owned reach. It consumes the exact
current habitat-memory and flood-event receipts and advances five functional guilds with finite seed
banks, juvenile cover and mature cover. Its explicit boundary and internal flows are local seed
production, parameterized external seed rain, germination, decay, recruitment, maturation, ordinary
mortality, flood-caused mortality and post-flood recovery. Guild flood-tolerance traits affect the
disturbance loss. Competition deterministically limits total living cover to 0.98.

`axm.foundation-planet.floodplain-succession-receipt/v1` carries the exact habitat and event digests,
per-guild seed and cover ledgers, closure residuals, the before/after community and truth boundaries.
The audit independently rejects open ledgers, mismatched lineage, duplicate or missing guild flows,
cover beyond capacity and false material authority. With Life disabled, cover and seed banks are
frozen while dormant time remains observable. State, receipts and the basin result are invariant to
caller reach order.

A v9 snapshot restores through an empty succession checkpoint. Its first transition establishes no
cover, seed bank or living history; later colonization can arise only from newly processed boundary
inputs and local reproduction. API v36 and experience capsules expose a bounded renderer-independent
projection. This organ owns functional-guild community state, not plant biomass matter, species
occupancy, resolved individuals, mechanistic plant biochemistry, unloaded continuous evolution or a
scientific succession forecast.

## Rung 41 floodplain-plant-matter addendum

`axm.foundation-planet.basin-routing-engine/v11` adds
`axm.foundation-planet.floodplain-plant-matter-state/v1` beside the v10
functional-guild community. The new organ owns persistent live,
standing-dead and litter carbon and nitrogen for aquatic pioneers, mudflat
annuals, reed/sedge, wet meadow and riparian woodland. It consumes the exact
current succession receipt and derives a finite live-matter target from only
the cover above any migration baseline.

Positive growth is a paired ownership transfer. The deterministic midpoint
Earth cell must be loaded land and must debit its existing land-ecology live
biomass through
`axm.foundation-planet.land-ecology-subgrid-biomass-debit/v1`. One sender
receipt may batch several reach/guild allocations; each receiver records the
same transfer IDs and binds the sender digest. The basin receipt closes loaded
land live biomass plus all persistent reach plant matter across C and N with
the same one-kilogram absolute audit tolerance used for planetary-scale
subtraction. The partition therefore cannot be counted as both unchanged land
biomass and new floodplain biomass.

Mortality transfers live matter to standing dead. A bounded guild-specific
fall fraction transfers standing dead to litter. Those are internal C/N moves,
not boundaries. Life-off freezes all three pools. Unloaded reaches retain the
state. A v10 snapshot receives a plant-matter migration checkpoint; its first
v11 observation records existing cover as `legacyUnmaterializedCover` and
creates no matter. Later growth above that baseline requires a genuine paired
land-cell debit.

This organ owns neither phosphorus nor plant water because compatible sender
reservoirs have not been established. It also does not implement litter
decomposition, respiration, nutrient uptake, resolved individuals, species
occupancy, mechanistic plant biochemistry or scientific biomass calibration.
API v37, read-only system-audit evidence and experience capsules expose the
bounded semantic state without granting mutation authority.

## Rung 42 floodplain-plant-resource addendum

`axm.foundation-planet.basin-routing-engine/v12` persists
`axm.foundation-planet.floodplain-plant-resources-state/v1` beside the v11
plant C/N organ. The resource organ owns live tissue water plus live,
standing-dead and litter phosphorus. It may carry a supported-carbon
reference solely to bind each resource pool to the exact R41 matter flow; that
reference is not carbon ownership and is excluded from material totals.

Every positive resource increment requires two native evidence lines. The
current plant-matter receipt names the per-guild new-carbon increment, and
`axm.foundation-planet.floodplain-plant-resource-debit/v1` removes the exact
derived water and dissolved P from the persistent local floodplain. Both sides
carry the same uptake transfer IDs and the resource receipt binds the sender
digest. Growth is scaled to the minimum of loaded land C capacity, loaded land
N capacity, local floodplain water capacity and local dissolved-P capacity
before any sender is debited.

Guild mortality transfers supported P from live matter to standing dead and
returns the proportional live tissue water to the local floodplain through
`axm.foundation-planet.floodplain-plant-water-return/v1`. The return sender and
receiver share an exact ID. Standing-dead fall moves P to litter. No
decomposition boundary exists, so P cannot silently leave litter. The basin
step includes live plant water in its loaded water conservation equation and
all plant P in the coupled aquatic phosphorus equation.

Life-off freezes the resource state. Unloaded reaches retain it. A v11 save
receives a migration checkpoint that records existing C/N as legacy
unsupported matter but creates no historical P or water and performs no
uptake. API v38, the read-only resource integrity check and renderer-neutral
experience projection expose this truth.

This contract does not claim root-resolved hydraulics, plant transpiration to
the atmosphere, decomposition or soil-nutrient return, mechanistic
stoichiometry, resolved individuals, species occupancy or scientific
calibration. Mortality water returns to the local floodplain reservoir only;
partitioning it between soil and atmosphere is a named future seam.

## Rung 43 floodplain-decomposition addendum

`axm.foundation-planet.basin-routing-engine/v13` persists
`axm.foundation-planet.floodplain-decomposition-state/v1` beside the plant
matter and resource organs. Decomposition state is process memory only. It
does not own C, N or P and cannot serve as an independent material source.

An eligible per-guild standing-dead or litter transfer is bounded by the
minimum of the plant-matter pool's owned carbon and the plant-resource pool's
supported-carbon reference. Its nitrogen is proportional to the selected
owned matter and its phosphorus is proportional to the selected resource
pool. Unsupported legacy plant matter remains in place and cannot receive
retroactive phosphorus through this seam.

Every positive transfer requires three exact evidence lines with the same
reach, guild, pool and transfer ID:

1. `axm.foundation-planet.floodplain-plant-detritus-matter-debit/v1`
   removes owned C/N from persistent standing dead or litter.
2. `axm.foundation-planet.floodplain-plant-detritus-resource-debit/v1`
   removes the matching non-owning supported-C reference and owned P.
3. `axm.foundation-planet.floodplain-detrital-return-credit/v1` credits that
   C to local dissolved organic carbon and that N/P to local dissolved
   inorganic nitrogen/phosphorus.

`axm.foundation-planet.floodplain-decomposition-receipt/v1` binds all three
receipt digests and exact transfer quantities. The basin ledger closes donor
C/N/P against the local floodplain credit and separately verifies that the
supported-carbon reference mirrors, but never owns, the transferred carbon.
The read-only audit rejects missing or mismatched schemas, reach lineage,
digests, IDs, pool identities, quantities, transition status or residuals.

Moisture, Life abundance and bounded aggregate guild/pool turnover rates
govern activity; a single call cannot exceed one day. Life-off requires zero
allocations and freezes process memory except for explicit dormant time. A
v12 save receives a zero-history checkpoint and its first v13 step moves no
matter. Caller order must reproduce the same three sender/receiver receipt
sets, decomposition receipt, basin digest and persisted state. Unloaded
reaches retain and receipt cumulative return memory. API v39 and the
renderer-neutral experience projection expose the state without granting
mutation authority.

The only R43 receiver is local floodplain chemistry. Atmospheric respiration,
oxygen consumption, soil nutrient delivery, microbial population state,
mechanistic decomposition and scientific calibration remain false. No later
layer may infer those processes from the local C/N/P return receipt.

## Rung 44 floodplain-respiration addendum

`axm.foundation-planet.basin-routing-engine/v14` persists
`axm.foundation-planet.floodplain-respiration-state/v1` beside the material
owners. Respiration state owns only process memory: observed, dormant and
oxygen-limited days, cumulative observed reaction and exact last-receipt
lineage. Floodplain chemistry remains the sole owner of DOC, DIC and dissolved
O2.

`axm.foundation-planet.floodplain-respiration-receipt/v1` first plans a
bounded aerobic reaction from local floodplain moisture, Life abundance and
available DOC. Its potential DOC mineralization is capped by local dissolved
oxygen at 32/12 kg O2 per kg C. The paired
`axm.foundation-planet.floodplain-aerobic-mineralization-receipt/v1` then
records one local atomic chemistry transition:

1. debit floodplain dissolved organic carbon;
2. credit exactly equal floodplain dissolved inorganic carbon;
3. debit only the stoichiometrically required floodplain dissolved oxygen.

The chemistry hand rejects unequal DOC/DIC, incorrect oxygen stoichiometry,
sender overdraw and non-zero Life-off reactions before commit. The process
hand rejects missing, wrong-reach or quantity-mismatched chemistry receipts.
The read-only system audit independently verifies schemas, reach lineage,
receipt digests, transition statuses, local truth boundaries and the basin
carbon/O2 residuals. The coupled basin oxygen ledger includes this declared
local sink rather than hiding it as numerical loss.

One call cannot exceed one day. Life-off freezes all chemistry transfer and
records dormant process time only. A v13 save gains zeroed respiration memory;
the first v14 transition clears its migration checkpoint without moving C/O2
or inventing history. Reversing reach and column order must reproduce the
same chemistry receipts, process receipts, basin digest and persisted state.
Unloaded reaches retain and explicitly receipt cumulative respiration memory.
API v40 and the renderer-independent experience projection expose compact
semantic observations without mutation authority.

This contract does not claim atmospheric gas exchange, an anaerobic pathway,
microbial population state, resolved redox or enzyme chemistry, mechanistic
temperature dependence, soil delivery or scientific calibration. Oxygen
limitation is an enforced availability boundary, not a complete ecological or
biogeochemical model.

## Rung 45 floodplain-atmosphere gas-exchange addendum

`axm.foundation-planet.basin-routing-engine/v15` adds persistent
`axm.foundation-planet.floodplain-gas-exchange-state/v1` to each reach. This
state owns only observed, inactive and atmosphere-unavailable time, cumulative
observed exchange and exact last-receipt lineage. Floodplain chemistry remains
the DIC and dissolved-O2 owner; the existing eight-layer local atmosphere
remains the CO2-carbon and atmospheric-O2 owner.

For a loaded atmosphere cell, one bounded plan computes an exchangeable-DIC
evasion amount and a dissolved-oxygen deficit reaeration amount. DIC evasion is
capped by the local floodplain DIC reservoir. Reaeration is capped by the
temperature-parameterized freshwater saturation deficit and the actual native
surface-layer atmospheric oxygen reservoir. The plan cannot mutate either
owner.

Commit requires one shared exchange ID across two atomic owner hands:

1. `axm.foundation-planet.floodplain-gas-exchange-receipt/v1` debits local DIC
   and credits local dissolved O2;
2. `axm.foundation-planet.atmosphere-floodplain-gas-exchange-receipt/v1`
   credits native atmosphere layer-0 CO2 carbon and debits layer-0 oxygen;
3. `axm.foundation-planet.floodplain-gas-exchange-process-receipt/v1` binds
   both owner digests, exact quantities, reach, atmosphere cell and transition.

The atmosphere hand rejects a surface-layer oxygen overdraw before mutation.
The process hand rejects a missing, mismatched or wrong-lineage owner pair.
The read-only audit independently checks schemas, transfer identity, quantity
pairing, native layer ownership, transition statuses and four C/O2 residuals.
The native atmosphere owner permits at most 0.001 kg absolute binary
floating-point residue when a small flux is subtracted from a planet-cell gas
reservoir; this explicit owner-level bound is separate from the basin's
one-kilogram aggregate planetary-ledger bound.
The coupled basin carbon and oxygen ledgers include the same explicit transfer,
so gas exchange cannot hide material loss or creation.

Physical exchange continues with Life off. A v14 basin snapshot gains an empty
migration checkpoint whose first v15 transition moves no C/O2 and invents no
history. If the matching atmosphere cell is not loaded, the process emits an
explicit zero-transfer unavailable observation and no owner receipts. Unloaded
reach memory remains persisted and receipted. API v41 and the experience
projection expose compact state without write authority.

This is a local bounded one-way CO2-evasion/O2-reaeration parameterization. It
does not claim bidirectional Henry-law equilibrium, carbonate speciation,
resolved boundary-layer turbulence, wind or wave transfer, barometric and
salinity corrections, global mixing, continuous unloaded exchange or
scientific calibration.

## Runtime integrity and handoff

`axm.foundation-planet.system-audit/v1` is a read-only report over the currently selected Earth-system
column plus the latest loaded transport and basin receipts when those optional seams have run. It
routes each claim to evidence that can prove it: current schema lineage; the eight-level/seven-interface
pressure shape; water, surface-energy and moist-enthalpy residuals; atmosphere-owned gas state and gas
receipt; nested native-layer CO2-radiation schema, eight-layer shape, longwave accounting and truth
boundary; exact land/ocean compatibility mirrors; deep-ocean lineage; loaded gas-domain receipt and
area-weighted C/O2/N2 residuals; transport truth boundaries; and
finite surface/runoff sediment ownership, paired land/river/coast sediment receipts, coupled
per-grain basin material residuals, and typed channel/floodplain exchange receipts. A required failure makes the verdict `FAIL`. An optional seam with no
receipt is `NOT_APPLICABLE`, producing `PASS_WITH_UNOBSERVED_OPTIONAL_SEAMS` instead of an invented pass.
The coupled basin ledger declares a one-kilogram absolute numerical tolerance because it subtracts
planetary-scale water, oxygen and material totals in binary floating point; sub-kilogram residue is
not relabelled as transported matter, while any residual beyond that bound fails the audit.

The browser publishes this report through `AXMFoundationPlanet.audit()` and the System integrity
diagnostic. The audit never mutates the world, repairs evidence, creates a receipt or grants scientific
authority. Its purpose is compact runtime trust, regression detection and exact handoff between later
AI stewards, game rulesets and world organs.

A persisted `surface-radiation-receipt/v1` predates the CO2 seam and is therefore honestly
`NOT_APPLICABLE` for this check. A current v2 receipt that omits or contradicts its nested CO2 evidence
is malformed and must return `FAIL`; version age cannot be used to hide a current contract violation.

## Seasonal and ecosystem dynamics

Seasonal state derives from canonical coordinate, axial tilt and world day. Weather cells are deterministic local conditions, not a forecast and not a global fluid solve. Pressure, wind, humidity, precipitation, lightning and fire risk provide atmospheric forcing. When a sparse Earth column exists, carried surface temperature, snow storage and age, sea-ice state, dynamic albedo, mixed-phase cloud optical depths, shortwave/longwave fluxes, cryosphere fusion receipt, plant-available soil water, persistent canopy/root/litter structure, local land carbon and nitrogen pools, physiological water demand, land-ecology flux receipt, persistent marine C/N/P/O2 and plankton pools, chlorophyll and hypoxia diagnostics, marine flux receipt, surface pressure, both compatibility-band wind vectors, the eight-level pressure-column schema, seven interface states, model-top height, lowest/highest layer temperatures, native water totals, sync residual, native dynamics schema, eight phase receipts, seven interface receipts, eight horizontal-level ledgers, precipitation routes, native water/resolved-energy residuals, convective kinetic energy, maximum interface velocity, buoyancy work and complete vertical-energy residual feed back into visible local weather rather than being regenerated as unrelated values. The procedural synoptic pressure and wind remain explicit boundary-forcing targets for the local column; they do not silently replace transported state. These coupled values may drive render effects and ecosystem stepping, but their truth boundary remains `scientificModel: false`. `pressureLevelDynamicsResolved` is true only when the loaded column has actually run the native local vertical organ; it is not a claim of forecast quality or three-dimensional fluid resolution.

Visited regional population state is persisted separately from both deterministic carrying-capacity priors and the physical column's aggregate land-ecology pools. State records retain cumulative births, mortality, predation losses, migration, fire disturbance, recovery and governed interventions. Animal totals are reconciled into juvenile, adult and senescent cohorts; maturation and senescence use catalog life-history values. Disabling Life makes physical vegetation physiology plus terrestrial, freshwater and marine population tiers dormant; it must not delete their history. A game may not call an intervention a world fact without a future governed world-action adapter.

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
