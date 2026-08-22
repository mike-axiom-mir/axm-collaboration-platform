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

Each column also owns `axm.foundation-planet.atmosphere-biogeochemistry-state/v3`: persistent local carbon-dioxide carbon, oxygen and nitrogen-gas reservoirs in eight ordered `axm.foundation-planet.atmosphere-biogeochemistry-layer/v1` records aligned with the native pressure column. The whole-column fields are exact sums and compatibility projections, not a second reservoir. Land and ocean ecology still expose their established exchangeable-atmosphere fields for compatibility, but those fields are synchronized mirrors rather than independent reservoirs. `axm.foundation-planet.atmosphere-biosphere-gas-flux-receipt/v1` closes each local land-atmosphere or ocean-atmosphere C/O2 exchange at native surface layer 0; estuary and floodplain denitrification credit nitrogen to that same surface layer through typed boundary-input receipts. `axm.foundation-planet.atmosphere-biogeochemistry-vertical-transport-receipt/v1` consumes all seven native adjacent dry-air exchange receipts, applies ordered conservative lower/upper composition exchange, and closes C/O2/N2 without claiming molecular diffusion or three-dimensional plumes. Loaded horizontal transport is described with the Earth transport graph below. These gases are not globally mixed, so their CO2 ppm, oxygen and nitrogen fractions remain local bounded proxies rather than a global atmospheric-composition or chemistry claim.

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

Each fixed step is no longer than one planet day. Land fluxes include rain, snow, melt, sublimation, infiltration, evaporation, transpiration, percolation, recharge, capillary rise, surface runoff and baseflow. Ocean fluxes include typed rain and snow, evaporation, mixed-layer heat storage and sea-ice freeze/melt. Every native level computes a pressure-local saturation capacity blended over water and ice from its dry-air mass, center pressure and temperature. `axm.foundation-planet.atmosphere-pressure-layer-phase-receipt/v3` records that level's initial/final vapor, cloud liquid, cloud ice and temperature; condensation/deposition; evaporation/sublimation; liquid/ice freezing and melting; precipitation source phase; descent phase changes; vaporization and fusion heat; water and moist-enthalpy residuals; and any phase mass retained because its latent heat would cross the declared -120 to 70 °C native-layer envelope. The lower-two and upper-six results are also projected into `axm.foundation-planet.atmosphere-phase-change-receipt/v3` and `axm.foundation-planet.free-troposphere-phase-receipt/v3` compatibility schemas so existing consumers do not need to invent a second atmosphere.

Combined native cloud liquid plus ice remains bounded to 12 mm across the lower two levels and 8 mm across the upper six, apportioned by pressure thickness. When a long step needs more precipitation than that instantaneous capacity, deterministic condensation/deposition-to-precipitation subcycles may repeat without exceeding it. Each `axm.foundation-planet.atmosphere-precipitation-descent-receipt/v3` identifies the source level and rain/snow phase, every crossed interface, each thermally bounded melting/freezing transition with its receiving-layer fusion heat, and the typed surface rain/snow destination with equal sender debit and receiver credit. Upper condensate can therefore reach the surface only through an explicit native descent route. Precipitation can never exceed cloud plus vapor actually available above the declared 0.2 mm boundary-band vapor floor and the finite per-upper-level numerical floor. Weather-demanded condensation and deposition are bounded nucleation parameterizations, not resolved aerosol, droplets, ice crystals or collision/coalescence microphysics. Surface evaporation and transpiration return vapor to the boundary compatibility band and are reconciled back into the native column.

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
the coupled basin aggregate policy: its measured residual and unrounded signed
operands determine a per-identity IEEE-754 bound with a one-kilogram floor.
The partition therefore cannot be counted as both unchanged land biomass and
new floodplain biomass.

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
per-identity coupled aggregate policy.
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

## Rung 46 bidirectional floodplain carbon-gradient addendum

`axm.foundation-planet.basin-routing-engine/v16` migrates the gas-exchange
process to `axm.foundation-planet.floodplain-gas-exchange-state/v2`. The state
still owns process memory only. Floodplain chemistry remains the local DIC and
dissolved-O2 owner, and the native eight-layer atmosphere remains the CO2
carbon and atmospheric-O2 owner.

The carbon plan compares two bounded quantities:

1. an exchangeable fraction of floodplain-owned DIC; and
2. an aqueous CO2-carbon equilibrium target derived from local water mass,
   temperature and the native atmosphere surface layer's CO2 ppm proxy.

The declared reference is 0.167 mg C/L at 420 ppm and 25 C. The temperature
factor is `exp(-0.025 * (temperatureC - 25))`; local CO2 scales the target
linearly relative to 420 ppm. This is an explicit deterministic proxy, not a
claim that total DIC is dissolved molecular CO2 or that pH, alkalinity and
carbonate speciation have been solved.

A positive signed gradient proposes `carbonToAtmosphereKgC`; a negative
gradient proposes `carbonToFloodplainKgC`. Both cannot be positive in one
transition. Evasion is bounded by actual floodplain DIC. Invasion is bounded by
actual native atmosphere layer-0 CO2 carbon. Oxygen-deficit reaeration remains
bounded separately by local dissolved-O2 saturation deficit and actual layer-0
atmospheric oxygen.

Commit requires one exchange ID across these v2 receipts:

1. `axm.foundation-planet.floodplain-gas-exchange-receipt/v2` records the
   exclusive DIC debit or credit plus any dissolved-O2 credit;
2. `axm.foundation-planet.atmosphere-floodplain-gas-exchange-receipt/v2`
   records the opposite CO2-carbon side and the atmospheric-O2 debit in native
   layer 0;
3. `axm.foundation-planet.floodplain-gas-exchange-process-receipt/v2` binds
   both owner digests, direction, quantities, reach and atmosphere cell.

The atmosphere hand refuses either CO2-carbon or oxygen overdraw before
mutation. Basin v16 checks the signed owner-to-owner carbon residual, oxygen
residual, native-layer lineage, exclusive direction and process/owner digest
binding. The prior owner-level 0.001 kg absolute floating-point bound remains
explicit for subtracting small fluxes from planet-cell reservoirs.

A v15 snapshot preserves v1 observed days, unavailable days, cumulative
evasion and cumulative reaeration. It initializes cumulative carbon invasion
to zero and sets a migration checkpoint. The first v16 observation performs no
transfer, clears the checkpoint and invents no reverse history. Previous basin
receipts are not accepted as v16 bidirectional evidence. API v42 and the
renderer-independent experience projection expose the compact v2 state without
write authority.

This addendum supersedes R45 only for carbon directionality. It remains a
bounded concentration-gradient parameterization, not a complete Henry-law,
carbonate-speciation, air-water turbulence, wind/wave, bubble, barometric,
salinity or scientific gas-flux model.

## Rung 47 floodplain denitrification addendum

`axm.foundation-planet.basin-routing-engine/v17` adds persistent
`axm.foundation-planet.floodplain-denitrification-state/v1` process memory to
each reach. Floodplain chemistry remains the DOC, DIC and DIN material owner;
the native eight-layer atmosphere remains the nitrogen-gas owner. The process
state owns observation counts, bounded activity diagnostics, cumulative
reaction quantities and evidence digests only.

The plan runs after local aerobic respiration and before physical air-water gas
exchange. It reads actual floodplain water and chemistry, computes dissolved
oxygen in mg/L, and opens an anoxia gate only below the bounded configurable
threshold (2 mg/L by default). Potential daily DOC consumption is further
bounded by wetness, living abundance, actual DOC and a configurable reactive
nitrate-equivalent fraction of actual DIN (0.5 by default). Calling that
fraction nitrate-equivalent is a truth boundary: DIN is not relabelled as
fully nitrate and nitrate/ammonium speciation is not present.

The declared bounded stoichiometry is one kg DOC-C to one kg DIC-C and 14/15
kg DIN-N to 14/15 kg N2-N. A material-moving transition requires one transfer
ID across:

1. `axm.foundation-planet.floodplain-denitrification-reaction-receipt/v1`,
   which debits floodplain DOC and DIN, credits floodplain DIC and closes the
   local carbon and nitrogen boundary;
2. `axm.foundation-planet.atmosphere-gas-boundary-input-receipt/v1`, which
   identifies `floodplain-denitrification`, binds the reaction digest and
   credits nitrogen only to native atmosphere layer 0; and
3. `axm.foundation-planet.floodplain-denitrification-receipt/v1`, which binds
   the reach, atmosphere cell, transfer ID, quantities and both owner digests.

The system audit checks both owner schemas, exact lineage and quantities,
surface-layer placement, carbon closure, nitrogen reaction closure,
floodplain-to-atmosphere transfer closure and both owner residuals. An unloaded
atmosphere produces a typed zero-transfer process observation and no owner
receipts. Life off freezes all reaction pools. A v16 snapshot initializes
empty process memory with a migration checkpoint; its first v17 observation
moves no material and invents no history. Previous v16 receipts remain legacy
evidence and are not relabelled as v17 denitrification evidence. API v43 and
the renderer-independent experience projection expose this state read-only.

This is not a mechanistic microbial or redox model. It does not resolve
nitrate/ammonium, nitrite, nitrous oxide, pH, alkalinity, porewater transport,
temperature kinetics or scientifically calibrated denitrification rates.

## Rung 48 temperature-responsive denitrification addendum

`axm.foundation-planet.basin-routing-engine/v18` and
`axm.foundation-planet.floodplain-denitrification-state/v2` add a bounded
temperature response to the R47 process without changing material ownership.
For each loaded reach, the plan uses the owning Earth-system column's surface
temperature as an explicit floodplain-water-temperature proxy. It multiplies
the existing wetness, anoxia and living activity factors by
`Q10^((temperatureC - referenceTemperatureC) / 10)`. Defaults are Q10 2 and
reference 20 °C; accepted Q10 is bounded to 0.5–4 and the resulting response
factor is bounded to 0.05–4.

The v2 process state adds temperature-constrained duration and the latest proxy
temperature, reference, Q10, unclamped factor, bounded factor and constraint
flag. `axm.foundation-planet.floodplain-denitrification-receipt/v2` binds those
diagnostics to the unchanged v1 floodplain reaction receipt and v1 atmosphere
boundary receipt. Therefore all R47 transfer IDs, paired owner debits/credits,
stoichiometry and conservation checks remain authoritative. The audit also
requires finite bounded temperature diagnostics and the declared proxy truth
boundary.

A v17 basin snapshot preserves every prior denitrification observation counter
and cumulative reaction total, initializes temperature-constrained history to
zero, drops legacy receipts and requires one v18 zero-transfer checkpoint. The
checkpoint cannot invent historical reaction or temperature evidence. API v44
and experience capsules project the new diagnostics read-only.

The surface value is a forcing proxy, not persistent floodplain water
temperature. This rung does not resolve thermal inertia, freeze/thaw,
Arrhenius kinetics, microbial populations, nitrate/ammonium speciation or
scientifically calibrated rates.

## Rung 49 nitrate and ammonium ownership addendum

`axm.foundation-planet.river-chemistry-state/v3` replaces aggregate DIN-only
ownership with persistent `dissolvedNitrateNitrogenKgN` and
`dissolvedAmmoniumNitrogenKgN` reservoirs. The retained
`dissolvedInorganicNitrogenKgN` field is an exact compatibility sum and must
equal nitrate plus ammonium after every normalization, debit, credit and
transport. `axm.foundation-planet.floodplain-state/v2` owns the same pair.

A generic land-runoff nitrogen input is partitioned by
`nitrateFraction` at the river receiver; the default is 0.5. The v3 river
input receipt records both credited species, the fraction, exact transfer
identity and a `measuredInputSpeciationClaimed: false` boundary. The sender's
total-N debit is unchanged. River-to-river, river-to-estuary, overbank and
return-flow transfers carry nitrate and ammonium with the exact transported
water fraction. Basin v19 reports independent nitrate, ammonium and aggregate
compatibility residuals, each under the existing one-kilogram numerical
tolerance.

`axm.foundation-planet.floodplain-detrital-return-credit/v3` credits returned
plant nitrogen to ammonium and proves nitrate is unchanged under the R60
per-channel numeric policy. Denitrification
then reads actual owned nitrate. The v2 local reaction receipt debits nitrate,
leaves ammonium invariant, closes DOC-to-DIC carbon and nitrate-to-N2-N
stoichiometry, and preserves the exact native-atmosphere receiver lineage.
`axm.foundation-planet.floodplain-denitrification-state/v3` and its v3 process
receipt retain the R48 temperature response while removing the former
reactive-nitrate-equivalent fraction. Ammonium is never eligible for this
reaction.

Restoring `axm.foundation-planet.basin-routing-engine/v18` into v19 preserves
total channel and floodplain DIN, cumulative denitrification reaction history
and temperature history. Legacy aggregate DIN is initialized 50/50 into the
new pools as a declared model initialization, not reconstructed evidence.
Legacy receipts are dropped, all new owner states carry migration checkpoints,
and the first v19 process observation must move zero material and invent no
history. API v45 and the experience capsule expose compact river and
floodplain species projections without mutation authority.

Nitrite, nitrification, pH and alkalinity remain unresolved. A future
nitrification rung must add an explicit ammonium debit, nitrate credit and
oxygen/alkalinity ledger; the [EPA Nutrient Control Design Manual](https://www.epa.gov/sites/production/files/2019-08/documents/nutrient_control_design_manual.pdf)
documents the oxygen and alkalinity demands that make a silent conversion
scientifically dishonest.

## Rung 50 oxygen-ledgered floodplain nitrification addendum

`axm.foundation-planet.floodplain-state/v3` adds the local
`axm.foundation-planet.floodplain-nitrification-reaction-receipt/v1` owner
boundary. The reaction debits persistent dissolved ammonium-N, credits
persistent dissolved nitrate-N by the same amount, and debits persistent
dissolved oxygen at 4.57 kg O2 per kg N. Its receipt proves exact transfer
identity and independently closes ammonium debit, nitrate credit, aggregate
DIN, dissolved-oxygen debit and oxygen stoichiometry. No atmospheric boundary
receipt exists because all three material pools belong to the same floodplain
chemistry owner.

`axm.foundation-planet.floodplain-nitrification-state/v1` is persistent
process memory, and `axm.foundation-planet.floodplain-nitrification-receipt/v1`
binds its transition to the current local reaction receipt and digest. The
bounded first-order plan reads actual owned ammonium and dissolved oxygen,
requires aerobic availability, uses wetness and Life controls, and applies the
loaded Earth-system surface temperature as an explicit water-temperature proxy
with default Q10 2 and reference 20 C. Gas exchange runs first, so current-step
reaeration is material available to the reaction. Only oxygen above the
configured minimum concentration is reactive, so a bounded step retains that
aerobic reserve. Life-off permits no reaction or cumulative-process change.

Nitrification also creates an explicit 7.14 kg CaCO3-equivalent alkalinity
demand diagnostic per kg N. The 4.57 oxygen factor and 7.14 alkalinity factor
follow the [EPA Nutrient Control Design Manual](https://www.epa.gov/sites/default/files/2019-08/documents/nutrient_control_design_manual.pdf).
The diagnostic is not a debit: Caelus does not yet own floodplain alkalinity,
river alkalinity or pH state. This rung therefore makes no material-alkalinity,
pH-feedback, nitrite-intermediate, microbial-population, persistent
water-temperature or calibrated-rate claim. Its ammonium-to-nitrate reaction
is a declared one-step approximation.

`axm.foundation-planet.basin-routing-engine/v20` and step v20 include the
reaction in species-specific nitrogen and dissolved-oxygen conservation
ledgers, retain unloaded nitrification memory, and expose typed reaction and
process receipt arrays to the read-only system audit. Restoring v19 preserves
all existing owner and process state, initializes only the absent v1
nitrification organ to zero, drops legacy receipts, and requires one typed
zero-reaction checkpoint without invented history. API v46 and the experience
capsule project the compact result without mutation authority.

## Rung 51 end-to-end alkalinity addendum

This addendum supersedes R50 only for material alkalinity. R50's cumulative
alkalinity-demand value remains preserved as explicitly legacy diagnostic
history and is not migrated into the v2 material-debit total.

R51 adds a persistent acid-neutralizing-capacity ledger represented only as
kilograms of CaCO3 equivalent. The material owners are
`axm.foundation-planet.soil-biogeochemistry-state/v2`,
`axm.foundation-planet.runoff-biogeochemistry-queue/v2`,
`axm.foundation-planet.river-chemistry-state/v4`,
`axm.foundation-planet.floodplain-state/v4`,
and the mixed layer in
`axm.foundation-planet.ocean-ecology-state/v3`. Process organs observe and bind
these owners; they do not silently become material owners.
`axm.foundation-planet.estuary-state/v2` retains sediment and cumulative
reaction history, while alkalinity itself crosses the estuary as an exact
transformation flux rather than a persistent estuary-water pool.

New canonical soil state receives a deterministic bedrock-responsive initial
condition. Carbonate/limestone substrates begin with more capacity than
granite/gneiss substrates under otherwise comparable forcing, consistent with
the qualitative [USGS alkalinity overview](https://www.usgs.gov/water-science-school/science/alkalinity-and-water).
New canonical ocean state uses a declared open-ocean 2,300 micromole/kg total
alkalinity reference at salinity 35 from NOAA's
[CO2 system calculation guidance](https://www.ncei.noaa.gov/access/ocean-carbon-acidification-data-system/oceans/co2rprt.html).
Neither value is a measured local observation. Restoring prior soil, runoff,
river, floodplain or ocean schemas preserves all prior C/N/P/O2, species and
process history, initializes material alkalinity to zero and records a
migration checkpoint. Prior estuary state preserves sediment and reaction
history while initializing cumulative generated alkalinity to zero. No
historical material alkalinity is reconstructed.

Every material route carries alkalinity beside the existing dissolved tracers:

1. v2 soil mobilization and runoff-transfer receipts debit the finite soil or
   runoff owner and credit the exact receiving queue, land cell or loaded ocean;
2. river input v4, floodplain exchange v3 and basin inlet/reach/mouth v7 receipts
   bind sender and receiver quantities under one transfer ID;
3. estuary flux v2 passes river alkalinity to the coast while separately
   recording reaction generation; and
4. ocean flux v3 plus river/runoff input v2 receipts and Earth transport v11
   conserve mixed-layer alkalinity across loaded neighbors.

Nitrification in `axm.foundation-planet.floodplain-nitrification-state/v2`
debits 7.14 kg CaCO3 equivalent per kg ammonium-N converted, in addition to the
existing 4.57 kg O2 debit. Available owned alkalinity is a hard material cap;
the plan cannot overdraw it. Floodplain denitrification state/receipt v4 and
local reaction receipt v3 credit 3.57 kg CaCO3 equivalent per kg nitrate-N
converted to N2-N. Estuary denitrification applies the same generation factor.
The nitrification factors follow the
[EPA Nutrient Control Design Manual](https://www.epa.gov/sites/default/files/2019-08/documents/nutrient_control_design_manual.pdf);
the denitrification factor follows EPA's
[Municipal Nutrient Removal Technologies report](https://www.epa.gov/sites/default/files/2019-08/documents/municipal_nutrient_removal_technologies_vol_i.pdf).

`axm.foundation-planet.basin-routing-engine/v21` and step v21 include specific
runoff, river, estuary and ocean alkalinity residuals plus a coupled residual
that accounts for nitrification consumption and floodplain/estuary
denitrification generation. The read-only system audit adds a dedicated
`end-to-end-alkalinity-ledger` check for schemas, route lineage, reaction
stoichiometry, owner debits/credits and all residuals. Experience capsules and
API v47 expose only read-only projections.

The [USGS field-method definition](https://www.usgs.gov/publications/chapter-a6-section-66-alkalinity-and-acid-neutralizing-capacity)
supports interpreting the pool as capacity to neutralize strong acid. It does
not support relabelling that capacity as pH. R51 does not resolve carbonate,
bicarbonate, borate or other species; solve the carbonate system; couple DIC to
equilibrium; calculate pH; exchange alkalinity with the deep ocean; claim
measured concentrations; or claim calibrated watershed, estuary or ocean
chemistry.

## Rung 52 mixed-layer/deep-ocean alkalinity addendum

R52 extends, but does not reinterpret, R51's kg-CaCO3-equivalent
acid-neutralizing-capacity ledger. The additional material owner is
`axm.foundation-planet.deep-ocean-state/v2`, whose
`alkalinity.dissolvedKgCaCO3Eqm2` field is finite, non-negative and included in
the ocean column's total alkalinity. The mixed owner remains
`axm.foundation-planet.ocean-ecology-state/v4`;
`axm.foundation-planet.deep-ocean-exchange-receipt/v2` is the only local
vertical transfer authority between them.

The existing bounded exchange-depth calculation compares mixed and deep
concentrations and produces a signed
`alkalinitySurfaceToDeepKgCaCO3Eqm2`. A positive value debits the mixed layer
and credits the deep ocean; a negative value performs the exact reverse. The
receipt publishes
`alkalinityResidualKgCaCO3Eqm2 = finalMixed + finalDeep - initialMixed -
initialDeep`, with tolerance `1e-9 kg-CaCO3-equivalent/m2`. Ocean ecology flux
v4 includes the deep owner in its initial/final total and requires both its
local total residual and the nested vertical residual to close. Physical
alkalinity exchange continues when Life is disabled and creates no biological
reaction claim.

New canonical deep state receives the same declared salinity-scaled 2,300
micromole/kg open-ocean reference used at the R51 mixed-layer boundary. It is a
model initial condition, never a measured local value. NOAA PMEL's
[carbonate-system guidance](https://www.pmel.noaa.gov/co2/files/dickson_thecarbondioxidesysteminseawater_equilibriumchemistryandmeasurementspp17-40.pdf)
identifies DIC and total alkalinity as conservative quantities with respect to
mixing. NOAA NCEI's
[Guide to Best Practices for Ocean CO2 Measurements](https://www.ncei.noaa.gov/access/ocean-carbon-acidification-data-system/oceans/Handbook_2007/Guide_all_in_one.pdf)
defines measured total alkalinity and the broader equilibrium system; R52 does
not claim either.

Normalization of `axm.foundation-planet.deep-ocean-state/v1` preserves all
prior carbon, nitrogen, phosphorus and oxygen values, creates deep alkalinity
at exact zero with `explicit-zero-migration`, sets a migration checkpoint, and
drops the obsolete v1 exchange receipt. A v26 Earth-system checkpoint preserves
the R51 mixed-layer alkalinity unchanged while applying that deep migration.
No historical deep alkalinity or vertical flux is fabricated. Current v27
snapshots restore byte-for-byte through the JSON checkpoint boundary.

`axm.foundation-planet.system-audit/v2` adds
`mixed-deep-ocean-alkalinity-ledger`. When a current vertical receipt exists,
the check requires current owner and receipt schemas, finite non-negative
owners, a finite signed exchange, exact residual closure, nested receipt
lineage, and false measurement/speciation/pH claims. With typed owners but no
committed step it reports the exchange seam as honestly unobserved. The audit,
API v48 and experience projection remain read-only.

This addendum does not implement carbonate or bicarbonate pools, borate or
other minor species, DIC/alkalinity equilibrium, pH, buffering feedbacks,
calcium-carbonate precipitation/dissolution, measured-chemistry assimilation,
benthic or hydrothermal alkalinity reactions, unloaded-column exchange or
three-dimensional circulation. The local exchange-depth proxy is not a
scientific ocean-circulation model.

### R52 restore-clock continuity boundary

`axm.foundation-planet.basin-routing-engine/v22` adds
`axm.foundation-planet.basin-clock-alignment-checkpoint/v1`. It is available
once, and only for a profile loaded through `restore()`. If that saved basin
clock differs from the already committed Earth-transport clock, the latter is
the continuity authority. The engine records the old basin day, committed
transport day and signed delta; preserves all reach-owned material exactly;
sets the basin clock to the committed day; and invalidates the latest routing
receipt because it no longer describes the aligned boundary.

The checkpoint explicitly states that no historical routing was reconstructed
and no material replay occurred. A matching restored clock is left unchanged.
Fresh profiles are ineligible, a profile cannot align twice, and all later
clock mismatches retain the existing hard refusal. Basin routing step v21 is
unchanged because this repair changes saved-state continuity, not transport or
material-transfer semantics. API v48 projects the result read-only through
`basinRoutingStatus()`.

Browser-local world-state v2 also defines a transactional storage boundary.
The next in-memory envelope and revision are installed only after `setItem`
succeeds. If the normal JSON envelope exceeds the origin quota, the store
retries with
`axm.foundation-planet.compressed-world-state-storage/v1` using the explicit
lossless `lzw-uint16-base64` encoding. Loading decompresses first and then
applies the unchanged world identity and checksum validation. Compression does
not grant secrecy or authority. If raw and compressed writes both fail, the
old envelope remains active and the runtime exposes a visible `SAVE FAILED`
diagnostic plus a console error.

## Rung 53 mixed-layer carbonate diagnostic addendum

R53 adds no material owner. The persistent mixed-layer DIC, total-alkalinity
and dissolved-inorganic-phosphorus fields remain authoritative. The new
`axm.foundation-planet.mixed-layer-carbonate-diagnostic/v1` is a deterministic,
read-only observer of those fields plus mixed-layer depth, temperature and
salinity. Its output is current equilibrium state, not a separate pool and not
historical evidence.
Mixed-layer depth is converted to solution mass with an explicit 1,000 kg/m3
reference density. R53 does not claim a measured density or TEOS-10 state.

The declared surface-pressure constant set uses Lueker et al. (2000) K1/K2,
Dickson (1990) KB, Millero (1995) KW and phosphate constants, and the Lee et
al. (2010) boron-to-salinity relationship. Hydrogen ion and equilibrium
constants use the total scale. The Lueker open-ocean validity envelope is
2–35 °C and salinity 19–43. Inputs outside it produce a typed
`OUTSIDE_CONSTANT_VALIDITY` result with no pH or species; clamping and silent
extrapolation are forbidden.

For a solved result, CO2-star + bicarbonate + carbonate must reproduce input
DIC, the four phosphate species must reproduce input dissolved inorganic
phosphorus, and calculated total alkalinity must match the owner within
`1e-12 mol/kg`. The output publishes the pH bracket, iteration count and all
three residuals. Bisection is bounded to 80 iterations and pH 3–12. A failure
to bracket or converge is not a valid typed environmental refusal and fails
the runtime integrity check.

`axm.foundation-planet.ocean-ecology-state/v5` and flux v5 carry the diagnostic
and exact source-owner binding. Restoring ocean state v4 preserves all
C/N/P/O2/alkalinity owners, recomputes only the current observer and invalidates
the old v4 ocean flux receipt rather than relabelling it. Earth-system engine
v28 preserves compatible v27 transport receipts, while system audit v3 adds
`mixed-layer-carbonate-diagnostic`. API v49 and experience projections are
read-only.

The observer includes carbonate, borate, water and phosphate alkalinity. It
does not include silicate, fluoride, sulfide or ammonia alkalinity; pressure corrections;
deep-ocean pH; calcium or mineral saturation; precipitation/dissolution;
measured inputs; or pH feedback on any process. It must not be used as evidence
for those absent capabilities.

## Rung 54 carbonate-informed air-sea carbon addendum

R54 grants no new material owner. The persistent local atmosphere carbon pool
and mixed-layer DIC pool remain authoritative. The pure
`axm.foundation-planet.air-sea-carbon-exchange-proposal/v1` may propose one
signed transfer, and only the existing paired owner-move seam may apply it.
Positive means atmosphere to mixed-layer DIC; negative means mixed-layer DIC
to atmosphere. The applied amount must equal the proposal after sender bounds,
and combined atmosphere-plus-ocean carbon must remain unchanged.

A solved proposal requires the current
`axm.foundation-planet.mixed-layer-carbonate-diagnostic/v1`. Its DIC,
alkalinity, dissolved inorganic phosphorus, depth, temperature and salinity
source signature must match the proposal inputs at their declared publication
precision. `CARBONATE_DIAGNOSTIC_UNAVAILABLE`,
`CARBONATE_SOURCE_MISMATCH` and other typed method refusals carry zero proposed
and applied carbon. A refusal cannot be relabelled as active exchange.

Atmospheric dry CO2 is the local atmosphere-owned ppm compatibility proxy, not
an observation. At surface pressure, the proposal applies Weiss-and-Price
seawater vapor pressure, Weiss (1974) CO2 solubility, and the Weiss virial `B`
plus cross-virial delta fugacity correction. The audit holds
`ln(K0) = -3.5617` at 25 °C and salinity 35 and independently recomputes wet-air
pCO2, fCO2, equilibrium CO2-star, disequilibrium, raw relaxed mass, sender
bound, direction and application. The declared method pressure envelope is
800–1,150 hPa; it is not authority for deep or unusual-pressure chemistry.

The relaxation fraction may respond to wind, sea ice and duration but is an
explicit bounded bulk parameterization. R54 does not claim a calibrated
gas-transfer velocity, measured ocean skin temperature, measured pCO2,
cool-skin/warm-layer correction, global ocean circulation, or
species-resolved pH response. Those absent capabilities remain false in state,
receipt, audit, manifest and API projections.

Ocean ecology state/flux v6 migrates v5 material exactly and invalidates the
empirical v5 flux receipt. Earth-system engine v29 migrates v28 and may retain
compatible transport receipts. System audit v4 adds
`carbonate-informed-air-sea-carbon-exchange`; API v50 exposes the current
receipt read-only. None of these migrations fabricates historical R54 evidence.

## Rung 55 native phase thermal-envelope addendum

R55 grants no new water, heat or momentum owner. The pure
`axm.foundation-planet.atmosphere-phase-thermal-envelope/v1` proposal bounds
each warming or cooling phase change by the native layer's available sensible
temperature headroom between -120 and 70 °C. Only the supported mass moves and
its complete latent energy is applied. The unsupported request remains in its
source phase; a later pressure-column normalization may not use temperature
clipping to erase energy after the material move.

Pressure dynamics v4, layer phase v3, precipitation descent v3, and both
compatibility phase v3 schemas publish their envelope lineage, limit counts,
largest rejected request and closure residuals. Earth-system engine v30
migrates v29 by preserving current material, thermal and momentum owners,
invalidating old phase receipts and resetting only the ephemeral atmosphere
energy receipt to a labelled present-state checkpoint. It may not fabricate
historical R55 evidence. System audit v5 requires current envelope lineage,
eight valid layer receipts, in-envelope temperatures and sub-tolerance native
water, moist-enthalpy and resolved-energy residuals when a current receipt is
present. With valid state but no current receipt, the check is honestly
`NOT_APPLICABLE`.

The held R54 ocean counterexample and the 36-location adversarial sweep support
the bounded repair. They do not establish resolved cloud microphysics,
upper-atmosphere chemistry, calibrated convection, scientific forecast quality
or closure under every indefinitely repeated boundary forcing. The separately
observed constant-wet 365-day land residual remains typed **BROKEN**
counterevidence outside this repair's acceptance claim.

## Rung 56 boundary-energy ledger addendum

The prescribed compatibility boundary may request an aggregate two-band
temperature that cannot be represented without moving one or more native
pressure layers outside the declared -120 to 70 °C envelope. Native state
remains authoritative. A reconciliation that retains a layer at an envelope
limit is not allowed to silently charge the compatibility request as though it
were fully applied.

Every current local step therefore persists
`axm.foundation-planet.atmosphere-boundary-energy-receipt/v1`. It records the
compatibility initial and requested final moist enthalpy, native initial and
final moist enthalpy, requested and applied boundary changes, initial and final
projection adjustments, their native-envelope reconciliation, the boundary
sync residual, envelope-limited layer IDs and a closed receipt identity. The
whole-atmosphere ledger uses the applied native boundary change. Requested and
applied values remain separately inspectable; the reconciliation term may not
be used to erase an unrelated phase, transport, surface or rounding residual.

Earth-system engine v31 migrates v30 material, temperature and momentum owners
unchanged. Valid v4 native pressure-dynamics evidence remains valid, while the
new boundary receipt is `NOT_APPLICABLE` until a current v31 step produces it.
A migration checkpoint must say whether legacy phase evidence or legacy
boundary-energy evidence was discarded. System audit v6 fails a stepped current
column when the receipt is missing, its identity is altered, its budget copy
diverges, or its applied value is not the value charged by the atmosphere
ledger.

The held constant-wet land replay proves the bounded contract only: the first
material boundary-envelope reconciliation occurs on day 215; the maximum
explicit adjustment is 207,978.793070 J/m²; and the 365-day maximum
whole-atmosphere residual is 0.006005 J/m². It does not grant scientific
boundary-layer calibration, global circulation, upper-atmosphere chemistry, or
forecast authority.

## Rung 57 land subgrid numeric-closure addendum

A land-to-floodplain biomass debit must preserve its measured carbon and
nitrogen residuals. It may not erase those residuals, round them to zero, or
declare a free-form tolerance. Current evidence uses
`axm.foundation-planet.land-ecology-subgrid-biomass-debit/v2` and the typed
`axm.foundation-planet.land-ecology-mass-closure-policy/v1`.

For each mass channel, the permitted representation bound is the greater of
0.000001 kg and eight times `Number.EPSILON` times the largest absolute recorded
operand participating in the debit identity. The receipt records the operand
scale, factor, floor, derived bound and unmodified residual. System audit v7
must independently recompute the bound from the before, debit and after values;
it fails missing policy evidence, changed residuals, altered factors or an
inflated sender-supplied bound. Passing this check proves only that the measured
closure error is consistent with the declared binary floating-point policy.

Basin engine v23 and step receipt v22 require current v2 land sender evidence
before `truthBoundaryValid` can pass. Migration from engine v22 preserves
basin-owned profiles, material owners and clocks, but an older step v21 receipt
is discarded into an explicit no-current-receipt state. Migration does not
rewrite old evidence as though it satisfied the new policy.

The held 48-case Earth-cell sweep observed a maximum 0.000061035 kg residual
and no failures after this repair, versus 11 failures under the former fixed
one-milligram comparison. The maximum observed use of the derived bound was
11.9%. These measurements bound the tested contract; they do not establish
arbitrary-precision conservation, scientific calibration or closure for all
unobserved states.

## Rung 58 floodplain plant-resource numeric-closure addendum

A floodplain plant-resource transition must preserve the measured supported
carbon, phosphorus and live tissue-water residuals separately for every guild
and for the aggregate owner. Current evidence uses
`axm.foundation-planet.floodplain-plant-resources-receipt/v2` and the typed
`axm.foundation-planet.floodplain-plant-resource-mass-closure-policy/v1`.

For each material channel, the representation bound is the greater of
0.0000001 kg and eight times `Number.EPSILON` times the largest absolute
recorded operand in that channel's before-transfer-after identity. A receipt
may not substitute an operand from another channel, erase the measured residue,
or choose a larger free-form tolerance. System audit v8 independently derives
all guild and aggregate bounds from the recorded operands, verifies the
reported maximum residue and utilization, and fails an inflated tolerance even
when the underlying transition is otherwise conservative.

Basin engine v24 and step receipt v23 require current v2 plant-resource
evidence before the basin plant-resource truth boundary can pass. Migration
from engine v23 preserves profiles, material owners and clocks, but discards an
older step-v22 receipt until a current step creates current evidence. It does
not reconstruct historical floating-point closure.

The held 150-case Earth-cell sweep observed a maximum 0.000000476837 kg
residual and no failures under the derived policy, versus five failures under
the former fixed 0.0000001 kg comparison. Maximum observed bound utilization
was 3.36%. A wider 250-case adversarial representation sweep produced no
derived-bound failures while preserving a maximum 0.25 kg residue at a
5-quadrillion-kilogram operand scale. These are bounded representation tests,
not scientific calibration, arbitrary-precision conservation or an exhaustive
planet-state proof.

## Rung 59 floodplain plant-matter numeric-closure addendum

A floodplain plant-matter transition must preserve measured carbon and
nitrogen residuals separately for every functional guild and for the aggregate
owner. Current evidence uses
`axm.foundation-planet.floodplain-plant-matter-receipt/v2` and the typed
`axm.foundation-planet.floodplain-plant-matter-mass-closure-policy/v1`.

For each material channel, the representation bound is the greater of
0.0000001 kg and eight times `Number.EPSILON` times the largest absolute
recorded operand in that channel's before-credit-after identity. The receipt
must retain its measured residue and may not choose a larger free-form
tolerance. System audit v9 independently recomputes every guild and aggregate
identity, policy bound, maximum residue and maximum utilization. A changed
receipt-supplied tolerance fails even when the underlying transition remains
conservative.

Basin engine v25 and step receipt v24 require current v2 plant-matter evidence
before the basin plant-matter truth boundary can pass. Migration from engine
v24 preserves profiles, material owners and clocks, but discards older
step-v23 evidence until a current transition creates current evidence. It does
not reconstruct historical floating-point closure.

The held 250-case standing-dead/litter representation sweep observed a maximum
0.000030517578 kg residual and no failures under the derived policy, versus 22
failures under the former fixed 0.0000001 kg comparison. Maximum observed bound
utilization was 12.19%. These are bounded representation tests, not scientific
calibration, arbitrary-precision conservation or an exhaustive planet-state
proof.

## Rung 60 floodplain detrital-return receiver numeric-closure addendum

A persistent floodplain detrital-return credit must preserve the measured
carbon, total-nitrogen, ammonium-nitrogen, unchanged-nitrate and phosphorus
residuals as separate material-channel evidence. Current receiver evidence uses
`axm.foundation-planet.floodplain-detrital-return-credit/v3` and the typed
`axm.foundation-planet.floodplain-detrital-return-mass-closure-policy/v1`.

Carbon, total nitrogen and ammonium retain a 0.0000001 kg absolute floor;
unchanged nitrate and phosphorus retain a 0.000000001 kg floor. Each actual
bound is the greater of its floor and eight times `Number.EPSILON` times that
channel's largest absolute recorded before-credit-after operand. The receiver
must retain its measured residual, may not use an operand from another material
channel, and may not choose a larger free-form tolerance. System audit v10
independently recomputes all five identities, policy bounds, maximum residue and
maximum utilization; a changed receipt-supplied tolerance fails even when its
truth flags remain green.

Basin engine v26 and step receipt v25 require current v3 receiver evidence
before the decomposition sender-and-receiver truth boundary can pass.
Migration from engine v25 preserves profiles, material owners and clocks, but
discards older step-v24 evidence until a current step creates current receiver
evidence. Historical floating-point closure is never reconstructed.

The held 250-case receiver representation sweep observed a maximum
0.000164031982 kg residual and no failures under the derived policy, versus 35
failures under the former fixed thresholds. Maximum observed bound utilization
was 33.2%. These are bounded representation tests, not scientific calibration,
arbitrary-precision conservation or an exhaustive planet-state proof.

## Rung 61 floodplain reaction receiver numeric-closure addendum

Every persistent floodplain aerobic-mineralization, denitrification,
nitrification and gas-exchange chemistry owner must preserve each measured
carbon, nitrogen, ammonium, oxygen and alkalinity residual that its reaction
actually produces. Current evidence uses aerobic-mineralization receipt v2,
denitrification-reaction receipt v4, nitrification-reaction receipt v3 and
floodplain gas-exchange receipt v3 under the shared typed
`axm.foundation-planet.floodplain-reaction-mass-closure-policy/v1`.

Carbon, total nitrogen, oxygen and alkalinity retain a 0.0000001 kg absolute
floor; ammonium nitrogen retains a 0.000000001 kg floor. Each identity's actual
bound is the greater of its material-channel floor and eight times
`Number.EPSILON` times the largest absolute operand recorded for that identity.
A receipt may not borrow another identity's operand scale, erase a measured
residue or choose a larger free-form tolerance. Immediate process wrappers use
the same derived policy when comparing a process plan with its chemistry owner.
The atmosphere-side gas-exchange owner remains governed by its existing
separate contract.

System audit v11 independently reconstructs every receiver identity and bound,
including the declared maxima and utilization. Altering any one of the four
reaction families' receipt-supplied bounds fails its owning process audit even
when its residuals and truth flags are left untouched. Basin engine v27 and
step receipt v26 require current reaction-owner evidence before their reaction
truth boundaries can pass. Migration from engine v26 preserves profiles,
material owners and clocks, but discards step-v25 evidence until a current step
creates current receipts; it never manufactures historical numeric closure.

The held 240-case representation sweep observed a maximum
0.00048828125 kg residual and no failures under the derived policy, versus 54
false failures under the former fixed thresholds. Maximum observed bound
utilization remained below 11%. These are bounded representation tests, not
scientific calibration, arbitrary-precision conservation or an exhaustive
planet-state proof.

## Rung 62 atmosphere gas-exchange owner numeric-closure addendum

The native-atmosphere owner of paired floodplain gas exchange must preserve the
measured carbon and oxygen residuals produced when per-square-meter native-layer
state is reconciled with total-kilogram exchange. Current evidence uses
`axm.foundation-planet.atmosphere-floodplain-gas-exchange-receipt/v3` under
`axm.foundation-planet.atmosphere-floodplain-gas-exchange-mass-closure-policy/v1`.

Carbon and oxygen each retain a 0.001 kg absolute material floor. Each
identity's actual bound is the greater of that floor and eight times
`Number.EPSILON` times the largest absolute total-kilogram operand recorded for
the identity. The carbon identity records atmosphere before, floodplain credit,
floodplain debit and atmosphere after; oxygen records atmosphere before,
floodplain debit and atmosphere after. A receipt may not erase a measured
residual, borrow another identity's scale or choose a larger free-form bound.

System audit v12 independently reconstructs both identities, their bounds,
maximum residual and maximum utilization. Altering a receipt-supplied bound
fails the gas-exchange audit even if its truth flags remain green. Atmosphere
state v4 migrates v3 material layers and cumulative movement without preserving
the old v2 gas receipt. Gas-process state v3 likewise preserves clocks,
cumulative exchange and owner digests from v2 while dropping the old process
receipt. Basin engine v28 preserves v27 profiles, material owners and clocks,
but accepts only step-v27 evidence; step-v26 history is not promoted.

The held 105-case representation sweep observed a maximum 262,144 kg residual
and no failures under the derived policy, versus 23 false failures under the
former fixed threshold. Maximum observed bound utilization stayed below 12%.
The extreme receiving-area sweep is a bounded binary floating-point accounting
test, not scientific gas-transfer calibration, arbitrary-precision
conservation, a resolved air-water interface or exhaustive planet-state proof.

## Rung 63 geomorphic sediment transfer numeric-closure addendum

Every persistent absolute-kilogram geomorphic sediment transfer owner must
preserve its measured clay, silt, sand and gravel residuals separately. Current
evidence uses runoff sediment transfer receipt v2, river sediment input and
route receipts v2, and coastal sediment input receipt v2 under the shared typed
`axm.foundation-planet.geomorphic-sediment-transfer-mass-closure-policy/v1`.

Each identity and grain retains a 0.0000001 kg material floor. Its actual bound
is the greater of that floor and eight times `Number.EPSILON` times the largest
absolute operand recorded for that exact identity and grain. A receipt may not
borrow another grain or identity's scale, erase a measured residual, or choose
a larger free-form tolerance. River routing must prove sender debit, persistent
bed credit and requested-load partition identities. Coastal input must prove
both persistent receiver credit and input partition. The surface erosion
kg/m2 ledger is outside this absolute-kilogram policy.

System audit v13 independently reconstructs the recorded identities, each
derived bound, maximum residual and maximum utilization. Altering a single
receipt-supplied per-grain bound fails its owning transport or basin audit even
when the residual and truth flags remain unchanged. Earth engine v32 and basin
engine v29 preserve v31/v28 material owners and clocks through normalization,
but old transport step v11 and basin step v27 evidence is discarded rather
than promoted. Current transport step v12 and basin step v28 evidence is
required to pass the new truth boundary.

The held 150-case discovery sweep observed a maximum 136,445,952 kg residual
and no failures under the derived policy, versus 72 false failures under the
former fixed floor. Maximum observed bound utilization remained below 7.5%.
These are bounded binary floating-point representation tests, not scientific
erosion or sediment-transport calibration, arbitrary-precision conservation,
resolved morphodynamics, a global sediment-network proof or an exhaustive
planet-state proof.

## Rung 65 channel–floodplain exchange numeric-closure addendum

Every loaded channel/floodplain transfer must preserve twelve measured
material-owner residuals: water; total carbon and nitrogen; nitrate and
ammonium; phosphorus, oxygen and alkalinity; and clay, silt, sand and gravel.
Current evidence uses
`axm.foundation-planet.floodplain-exchange-receipt/v4` with nested
`axm.foundation-planet.floodplain-exchange-mass-closure/v1` under the typed
`axm.foundation-planet.floodplain-exchange-mass-closure-policy/v1`.

Water retains its one-kilogram material floor. Each chemistry and grain identity
retains its 0.000001 kg floor. The actual numerical bound is the greater of that
identity's floor and eight times `Number.EPSILON` times the sum of the absolute
unrounded signed operands for that identity alone. Water records final channel,
final floodplain, negative initial channel and negative initial floodplain
owners. Each dissolved identity records the same four owner positions. Each
grain records final channel suspended, channel bed, floodplain suspended and
floodplain deposited owners followed by their four negative initial owners. A
receipt may not erase a measured residue, borrow another identity's scale or
choose a larger free-form bound.

System audit v15 independently reconstructs the exact identity set, operand
counts, signed sums, policy bounds, compatibility residual projections,
aggregate maximum residual, maximum bound and maximum utilization. Altering one
recorded operand or one receipt-supplied tolerance fails the dedicated
`floodplain-exchange-receipts` check even when green truth flags remain. Basin
engine v31 accepts v30 state, preserves its material owners and clocks, and
discards step-v29 evidence instead of promoting the old exchange contract.
Floodplain state normalization likewise preserves current material and
cumulative history but drops a stored v3 exchange receipt; it does not invent a
new migration transfer.

The held 150-case representation sweep covered all twelve operand shapes. All
150 mathematically zero sums exceeded their former fixed floors, while none
failed the derived policy. Maximum measured residue was 3.25 kg, maximum bound
was 32,768 kg and maximum bound utilization was 2.5390625%. This is a bounded
binary floating-point accounting test, not arbitrary-precision conservation,
resolved inundation hydraulics, scientific flood calibration or an exhaustive
planet-state proof.

## Rung 66 floodplain thermal-owner addendum

Every persisted reach owns one
`axm.foundation-planet.floodplain-thermal-state/v1` beside its floodplain
material owner. The state carries liquid-water temperature, the water mass to
which that temperature applies, sensible heat, observed wet and dry time,
cumulative net-advected heat, cumulative parameterized external-boundary heat
and the latest typed transition. Denitrification, nitrification and
floodplain-atmosphere gas exchange must read the same final temperature and
record the exact digest of that reach's thermal transition. A same-step direct
surface-temperature proxy is no longer sufficient evidence.

Current thermal evidence is
`axm.foundation-planet.floodplain-thermal-receipt/v1` with nested
`axm.foundation-planet.floodplain-thermal-energy-closure/v1` under
`axm.foundation-planet.floodplain-thermal-energy-closure-policy/v1`. For an
observed transition the signed energy operands are final sensible heat,
negative initial heat, negative inflow heat, positive outflow heat and negative
external-boundary heat. The numerical decision bound is the greater of one
joule or eight times `Number.EPSILON` times the sum of those absolute unrounded
operands. The measured residual and utilization remain evidence and may not be
clamped, replaced or hidden by a receipt-supplied tolerance.

Basin engine v32 accepts v31 state. A reach without the R66 owner receives an
empty one-shot thermal checkpoint while every pre-existing material,
chemistry, biological, clock and cumulative owner remains unchanged. The first
step initializes current sensible heat from current water and the declared
incoming-temperature boundary, records that pre-R66 heat history is
unobserved, and makes no historical closure claim. Step-v30 receipts are not
promoted to step v31.

System audit v16 independently reconstructs water change, the five energy
terms, signed operands, policy bound, residual, utilization, aggregate maxima
and the exact digest/temperature binding of all three consumer processes. It
must fail tolerance inflation, altered energy operands or altered consumer
digests even when receipt truth flags remain green. API v62 exposes the owner,
policy, receipts and live mean-temperature/residual/bound/utilization
diagnostics read-only.

This contract does not claim a resolved channel-water temperature, an
atmosphere or soil debit for the parameterized external heat boundary,
freeze–thaw phase ownership, latent heat, scientific calibration, arbitrary
precision, exhaustive planet-state proof, promotion or canonization.

## Runtime integrity and handoff

`axm.foundation-planet.system-audit/v16` is a read-only report over the currently selected Earth-system
column plus the latest loaded transport and basin receipts when those optional seams have run. It
routes each claim to evidence that can prove it: current schema lineage; the eight-level/seven-interface
pressure shape; the native phase thermal envelope and per-layer latent ledger; requested, applied and envelope-reconciled atmosphere boundary energy; water, surface-energy and moist-enthalpy residuals; atmosphere-owned gas state and gas
receipt; nested native-layer CO2-radiation schema, eight-layer shape, longwave accounting and truth
boundary; exact land/ocean compatibility mirrors; deep-ocean lineage and mixed/deep alkalinity closure; bounded mixed-layer carbonate source binding, species closure, alkalinity residual and typed refusals; carbonate-informed air-sea wet-air fugacity, direction, sender bound, paired owner application and carbon closure; loaded gas-domain receipt and
area-weighted C/O2/N2 residuals; transport truth boundaries; scale-aware
land-subgrid and per-channel floodplain plant-matter, plant-resource and
detrital-return, reaction-receiver, channel/floodplain exchange, floodplain sensible-heat closure and exact shared-temperature receipt binding, and per-grain geomorphic-sediment numeric closure; and
finite surface/runoff sediment ownership, paired land/river/coast sediment receipts, independently
recomputed scale-aware coupled basin water, chemistry, plant-matter and
per-grain basin material residuals, and typed channel/floodplain exchange receipts. A required failure makes the verdict `FAIL`. An optional seam with no
receipt is `NOT_APPLICABLE`, producing `PASS_WITH_UNOBSERVED_OPTIONAL_SEAMS` instead of an invented pass.
`axm.foundation-planet.basin-aggregate-mass-closure-policy/v1` covers exactly
twelve coupled identities: water; C/N/P/O2/alkalinity; loaded-land plus
floodplain-plant C/N; and clay/silt/sand/gravel. Each identity records its
unrounded signed kilogram operands and measured residual. Its numerical bound
is the greater of the retained one-kilogram floor or eight IEEE-754 epsilon
steps at the sum of the absolute operands. The residual is never clamped or
relabelled as transported matter, and a value beyond its derived bound fails.

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
