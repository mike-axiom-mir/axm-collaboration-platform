# AXM Foundation Planet: Caelus

Caelus is the large-world sibling of the AXM Living Globe. Its logical radius is 6,371 km, close to an Earth-scale terrestrial planet. It is intended to become the neutral ground planet beneath many future games. It does not replace the original Living Globe and does not give any game ownership of world state.

Open `/worlds/foundation-planet/` through the Workshop server. Run `node worlds/foundation-planet/selftest.js` before promotion.

## First serious rung

- deterministic planet-scale terrain with continents, ocean basins and mountain systems;
- physically meaningful latitude, longitude, elevation, temperature, moisture, day, year and planet-radius values;
- orbital exploration and a separate streamed 120 × 120 km local surface scale;
- climate-derived ocean, coast, desert, savanna, grassland, forest, rainforest, taiga, tundra, alpine and ice biomes;
- fourteen deterministic tectonic plate provinces with convergent, divergent and transform boundaries;
- coordinate-level crust age, bedrock, soil depth, precipitation and erosion-risk data;
- a planet-anchored 2.5 km drainage grid streamed through buffered canonical tiles, with catchment area, runoff, discharge, river order, width, depth and inland sinks;
- surface-rendered river reaches, lakes, exposed geology and orbital plate-boundary survey points;
- replaceable temperate, verdant, arid, glacial and barren condition profiles;
- independent hydrology, atmosphere, cloud, weather, vegetation, fauna and decomposer layers;
- one master control for all living layers;
- hierarchical local ecology: regional populations across 120 km and individual organisms in a 3 km focus sector;
- deterministic local vegetation and fauna populations streamed for the current sector;
- a versioned 96-entry species catalog spanning 33 producer, 47 animal and 16 decomposer archetypes;
- terrestrial, freshwater, coastal, marine and deep-marine realm occupancy with salinity, water-depth and freshwater-dependency envelopes;
- habitat envelopes, trophic roles, diet, mass, social structure, locomotion, activity, maturity, lifespan, reproduction, life strategy and keystone-role declarations;
- deterministic local community assembly and time-of-day fauna activity;
- regional producer biomass, animal carrying-capacity and decomposer-activity estimates beneath the visible individual tier;
- declared food-web links with herbivore pressure, predator support and resilience signals;
- browser-local continuity for location, time, profile, view and living age;
- a read-only `window.AXMFoundationPlanet` contract and selected-snapshot seam;
- an optional isolated named-world host contract with exact-revision writes, bounded journals, recovery snapshots and canonical sector subscriptions;
- a deterministic fixed-step authority kernel that accepts bounded controller intent and owns multiplayer movement.
- sparse stateful land and ocean columns with conserved water and surface-energy ledgers, soil layers, aquifers, snow and sea ice.
- canonical neighboring-cell transport for atmospheric moisture and heat, groundwater, ocean freshwater and ocean mixed-layer heat.
- finite clay, silt, sand and gravel ownership with receipted runoff, river-bed and coastal sediment routing across the loaded domain.
- persistent loaded-reach floodplain water, chemistry, suspended grains and deposits with receipted bankfull overflow and finite return flow.
- persistent floodplain live, standing-dead and litter carbon/nitrogen partitioned from loaded land-cell biomass by exact paired receipts.
- persistent floodplain plant phosphorus and live tissue water drawn from the local floodplain through exact uptake receipts, with mortality water returned to the same reservoir.

## Rungs 2–3: physical history and ecological scale

The second and third rungs add deterministic plate provinces, bedrock, soils, erosion signals, watershed drainage, visible freshwater, a versioned species catalog, local community assembly and a statistical regional food web beneath the visible individual tier. `Follow water` relocates a surface expedition to the nearest computed river reach. Physical geology/hydrology and all living tiers remain independently controllable.

## Rung 4: seasons, weather and persistent ecology

Axial tilt and latitude now drive season, solar declination, daylight and seasonal temperature. Deterministic local weather cells expose pressure, wind, humidity, cloud, precipitation type and intensity, snowpack, drought, lightning and fire risk. Loaded regional populations advance with births, natural mortality, predation pressure, carrying capacity and migration. Up to 100 visited sector-dynamics records persist in the browser save, including fires, recovery and explicitly governed intervention history.

## Rung 5: ecological breadth and marine expeditions

The catalog now spans 96 archetypes across land, freshwater and ocean food webs. Regional populations track juvenile, adult and senescent cohorts using catalog maturity, lifespan and reproduction strategy, while community diagnostics report only the realms occupied at the current coordinate. `Survey ocean` deploys directly into a productive marine sector with water-specific survey metrics, nearby swimming fauna, primary producers and decomposer activity. The master Life control makes every terrestrial and marine living tier dormant without pausing physical water, atmosphere or geology.

## Rung 6: continuous water, physics coordinates and revisioned state

Hydrology now samples a planet-anchored global grid through buffered canonical tiles. A river reach owns one stable `hydro-reach:v2:<grid-x>:<grid-z>` identity, canonical endpoints and a downstream reach link, regardless of which overlapping expedition sector requests it. Loaded sectors report explicit edge handoffs instead of silently terminating water at the render boundary. Catchment area, runoff, discharge, width, depth and stream order remain procedural approximations; depression filling was future work at this rung, while Rung 36 later adds finite loaded-domain sediment transport without claiming resolved channel morphology.

Every loaded sector also publishes a right-handed meter-scale floating-origin frame with east, radial-up and north axes, latitude-sensitive radial gravity, collision intentions and exact canonical/local coordinate transforms. The current explorer uses an accelerated kinematic ground/swim controller; a general rigid-body engine is deliberately not claimed.

Browser persistence is now a versioned v2 world-state envelope with lineage identity, monotonically increasing revision, parent revision, checksum, compact event journal and optimistic-concurrency rejection. Existing v1 saves migrate without deletion. This local envelope is not authoritative multiplayer state; Rung 7 adds the explicit service boundary that can host the same identity.

## Rung 7: optional authoritative host and multiplayer movement

The Workshop Living World service can now host multiple isolated named world lineages while preserving its original `living-globe` compatibility slot. Caelus uses `world.axm.foundation-planet`, its unchanged seed and its browser lineage when generating an explicit `axm.living-world.create/v1` bootstrap. The host owns expected-revision writes, bounded change journals, snapshots and guarded restore. Cross-world mutation, lineage transfer, ownership transfer, silent reset and secret-like state are refused.

`window.AXMFoundationPlanet` exposes read-only host status plus proposal builders for bootstrap, world patches and canonical sector subscriptions. Merely opening Caelus never creates or mutates hosted state. The browser continues with local revisioned persistence until a matching lineage has been created through the permission-gated Living World service.

The new fixed-step authority kernel binds controller seats to at most eight participants by default, rejects replayed input sequences and turns bounded movement intent into canonical latitude/longitude/elevation. Clients cannot submit position or collision truth. The kernel emits participant upserts as proposals; only the Living World service may commit them. This establishes real authoritative movement and transport seams without claiming that a multiplayer session is currently running.

## Rung 8: stateful water, ground and surface energy

Visited 0.25-degree Earth-system cells now retain physical state instead of regenerating every environmental value from the coordinate. Land cells carry ponded water, snow-water equivalent, root-zone and deep-soil reservoirs, aquifer storage, water-table depth, soil freeze and surface temperature. Their daily flux path includes rain, snow, melt, infiltration, evaporation, transpiration, percolation, recharge, capillary rise, surface runoff and baseflow. Turning Life off removes transpiration while leaving the abiotic water cycle active.

Ocean cells carry mixed-layer depth, temperature, heat content, freshwater anomaly, salinity and thermodynamic sea ice. Local water and energy ledgers expose numerical residuals, and the tests require them to close across wet, dry, snow, melt and ocean cases. Current runoff and baseflow modulate streamed river discharge without changing stable reach IDs or canonical long-term discharge. The sparse column cache persists in the revisioned browser envelope and refuses backward time.

At this rung the surface columns were locally conservative but not a global circulation model; lateral atmospheric moisture, ocean currents and neighboring aquifer exchange were still prescribed boundary forcing. Rung 9 replaces the loaded-neighbor portion of that forcing with explicit transport.

## Rung 9: conservative neighboring-cell transport

The active expedition now synchronizes a 3 Ã— 3 domain of canonical 0.25-degree cells. Loaded cardinal neighbors exchange atmospheric moisture and sensible heat, land aquifers exchange groundwater according to hydraulic head, and ocean neighbors mix freshwater anomaly and mixed-layer heat. Every transfer is derived from the pre-step graph and applied simultaneously, making the result independent of caller ordering.

Conservation is area weighted on the sphere: one millimeter in a high-latitude cell is not treated as the same water volume as one millimeter near the equator. Receipts report transferred kilograms and joules plus residuals. Missing neighbors remain explicit unresolved boundaries, and stale-time or mixed-profile edges refuse exchange rather than leaking state. Transport clocks and receipts survive browser save/restore independently for each condition profile.

This is still sparse local-to-regional transport, not global atmospheric or ocean circulation. Atmospheric moisture transport is not yet closed into local precipitation and evaporation, and there are no long-range pressure waves, resolved winds, river-to-ocean routing, ocean gyres or three-dimensional aquifers yet.

## Rung 10: closed atmospheric water and receipted runoff

Atmospheric precipitable water is now a real reservoir in every Earth-system column. Rain and snow withdraw from it, moisture-starved storms are supply limited, and evaporation plus transpiration return surface water to the same atmosphere. Deterministic weather relaxation remains a visible signed boundary-convergence term rather than hidden mass creation. The local ledger now closes atmosphere, surface, snow, soil, aquifer, runoff queue, ocean and sea ice together.

Land runoff and baseflow no longer disappear at the edge of the local column. They enter a persistent routing queue. Each transport step advances the pre-step queue toward the steepest lower loaded cardinal neighbor, one cell per step; land keeps the incoming channel water in its queue while a coastal ocean receives the exact area-weighted freshwater mass and updates salinity. If no lower downstream neighbor is loaded, the water remains queued and the receipt explains the unresolved boundary.

This closes the local-to-neighbor water path without pretending the sparse 0.25-degree graph is already the complete river network. The next bridge must reconcile these routing queues with the finer stable `hydro-reach:v2` drainage topology, including explicit downstream continuation outside the active 3 Ã— 3 domain.

## Rung 11: persistent basin and ocean-mouth bridge

The coarse Earth-system grid and fine canonical drainage grid now exchange water through a typed transport seam. A land-cell runoff queue enters one deterministic main reach only when a paired inlet receipt records the same kilogram debit at the Earth cell and credit at the reach. Reach storage is persistent, condition-profile isolated and keyed by the stable `hydro-reach:v2` identity rather than by disposable render coordinates.

Loaded reaches advance from the same pre-step state, so a pulse cannot teleport through several channels in one invocation. Reach-to-reach transfers retain exact source and receiver IDs. An ocean outlet delivers freshwater only when the canonical ocean Earth cell containing its mouth is loaded; the mouth receipt, river-storage debit and ocean freshwater credit close one mass ledger. Missing downstream reaches, unloaded sectors and unloaded mouth cells retain the water in channel storage and publish a typed boundary receipt.

The coarse topographic Earth-cell route remains as a fallback for queued water that has no loaded canonical river inlet. Rung 11 is therefore a conservative loaded-basin bridge, not a claim that every global basin is continuously active. At that rung, a planet-wide depression-filled graph, endorheic spill behavior and floodplains remained later work. Rung 36 later adds finite grain routing and Rung 37 bounded floodplain exchange through this bridge, while resolved channel morphology remains unsolved.

## Rung 12: loaded pressure mass and tangent momentum

Surface pressure now has a transported physical meaning: it represents dry-air column mass over each loaded spherical cell. A typed sender/receiver receipt moves that mass down a loaded pressure difference and carries the donor's eastward and northward momentum with it. Transfers use the same pre-step graph and simultaneous application as the water and heat paths, so caller ordering cannot choose the result.

Pressure-gradient wind forcing is bounded and separately receipted. The momentum ledger accounts for the exact applied eastward/northward impulse before checking its numerical residual, and one shared limiter keeps every resulting wind at or below 90 m/s without silently clipping individual cells. The live weather readout now uses the carried Earth-column pressure and vector wind; procedural synoptic values remain named boundary-forcing targets.

At Rung 12 this was a loaded-domain tangent-momentum model without planetary rotation. It still had no vertical layers, global-angular-momentum solve, pressure-wave propagation across unloaded cells, turbulence closure or scientific forecast authority; Rung 13 adds the bounded Coriolis and energy terms below without erasing those limits.

## Rung 13: planetary rotation and atmospheric kinetic energy

Every loaded atmospheric column now receives a typed latitude-aware Coriolis rotation. The deflection uses the planet's declared 86,400-second rotation period, turns opposite ways across the equator and rotates the tangent wind vector exactly, so it changes direction without inventing wind speed or kinetic energy. The resulting eastward and northward impulses are recorded as exchange with planetary rotation rather than mislabeled as internal neighbor transport.

Atmospheric kinetic energy now has its own ledger. Moving dry air carries donor momentum; mixing different winds may dissipate kinetic energy and records that loss. Pressure impulses record their work, Coriolis records its near-zero numerical work, and the final stored vector closes against those terms. The live console exposes local rotation per step, mixing dissipation and the residual.

This still is not a global circulation or angular-momentum solver. There are no vertical pressure levels, resolved convection, turbulence closure, jet-stream continuity across unloaded cells or two-way solid-planet spin response.

## Rung 14: cloud liquid and atmospheric moist enthalpy

Atmospheric water is now split into transported vapor and bounded cloud liquid. Each local step emits a typed receipt for condensation, cloud evaporation and cloud-liquid precipitation. Condensation warms the single atmospheric layer, cloud evaporation cools it, and long steps can repeat bounded condensation-to-precipitation subcycles without ever holding more than the declared instantaneous cloud-water limit. Precipitation still cannot exceed the water actually available above the minimum vapor reservoir.

The atmospheric energy ledger now follows sensible heat plus vapor latent energy. It exposes diagnostic boundary enthalpy, exact internal phase exchange, surface latent input and the final numerical residual. Neighbor transport moves vapor and cloud liquid separately and closes their combined water plus moist enthalpy across the loaded graph. The live console exposes the local phase receipt and moist-enthalpy closure.

This is a conservative single-layer bulk parameterization, not resolved cloud droplets or ice crystals, aerosols, convective towers, vertical pressure levels, radar-quality precipitation or a scientific forecasting model.

## Rung 15: boundary layer and free troposphere

The atmospheric column now persists two hydrostatically partitioned reservoirs: a 25% pressure-thickness boundary layer and a 75% free troposphere referenced at 4.5 km. Each layer owns temperature, vapor and bounded cloud liquid. Upper-air condensation and cloud evaporation have a separate typed receipt and return latent heat to the free-troposphere sensible-energy reservoir; upper condensate does not directly bypass the boundary precipitation path.

A bounded lapse-rate response now exchanges sensible heat, vapor and cloud liquid between the layers. It applies equal gross dry-air parcel exchange, so neither layer silently gains dry mass, and records the exchange fraction, gross mass, tracer direction, lapse rate and numerical closure in a typed receipt. Water and two-layer moist enthalpy close across the exchange. Existing one-layer v7 saves migrate by partitioning their stored vapor and condensate without creating or deleting water.

Loaded-neighbor atmospheric transport remains a boundary-layer process at this rung, while eastward/northward wind remains column-mean momentum. This is not resolved three-dimensional convection, buoyancy or gravitational-potential work, cloud microphysics, upper-air horizontal transport, turbulence closure, a global circulation model or a scientific forecast.

## Rung 16: independent upper-air transport and geopotential receipts

Loaded boundary-layer and free-troposphere air now travel as independently conserved dry-mass reservoirs. Each layer owns its wind vector and carries vapor, cloud liquid and sensible enthalpy with the moving dry-air parcel; bounded mixing remains separately receipted. Pressure-gradient impulses, Coriolis rotation, tangent momentum and kinetic-energy closure are reported per layer as well as for the combined loaded atmosphere. The hydrostatic pressure partition may now evolve instead of being reset to 25/75 after every step.

Terrain-following transport now records the gravitational potential energy carried between representative layer heights and the exact adjustment work required at the destination. Vertical exchange records equal gross upward and downward geopotential transfers plus independently closed eastward and northward momentum. Existing v8/two-layer saves migrate without inventing upper-air shear or changing stored water.

These receipts expose the energetic boundary honestly; they do not yet solve buoyancy conversion or three-dimensional gravity work. The loaded graph remains a sparse bulk atmosphere rather than a continuous global circulation, angular-momentum, convection, turbulence, cloud-microphysics or scientific forecasting model.

## Rung 17: buoyant overturning and convective kinetic energy

The two-layer vertical exchange is now an explicit closed overturning loop: every dry-air updraft has an equal compensating downdraft, so a local convective step cannot manufacture net layer mass. A lifted parcel uses vapor- and cloud-adjusted virtual temperature to diagnose positive buoyancy only when the lapse rate is supercritical. Bounded buoyancy work converts moist sensible enthalpy into a persistent column convective-kinetic-energy reservoir and a diagnostic vertical-velocity proxy.

Stored convective kinetic energy decays on a declared time scale and returns to sensible heat. Horizontal momentum lost through vertical parcel mixing is likewise thermalized rather than deleted. The v2 vertical receipt closes water, eastward/northward momentum, horizontal kinetic energy, convective kinetic energy, moist-enthalpy mechanical conversion, equal gross pressure/geopotential work and their combined resolved energy. Existing v9 saves migrate with an empty convective reservoir and invalidate the accidentally mis-versioned R16 v1 vertical receipt instead of laundering it into the corrected lineage.

This resolves buoyancy conversion only inside the bounded two-reservoir parameterization. It is not a resolved cloud plume, downdraft shaft, vertical velocity field, entrainment profile, pressure-coordinate circulation, turbulence closure or three-dimensional convection model.

## Rung 18: persisted pressure-coordinate atmosphere

Each Earth-system cell now owns eight bottom-to-top pressure-thickness layers. Every native layer
persists dry-air mass, temperature, vapor water, cloud liquid, eastward/northward momentum and the
derived sensible, latent, kinetic and geopotential-energy terms. Contiguous interface pressures and
terrain-following interface heights are rebuilt with the hypsometric relation using each layer's
virtual temperature. The highest layer closes the remaining column pressure against a declared
0.1 hPa geometry floor, avoiding an infinite model-top height while retaining the complete dry-air
mass.

The existing boundary-layer and free-troposphere fields are now an explicit compatibility projection:
two native lower layers aggregate into the boundary band and six aggregate into the free band. Local
phase change, vertical overturning and loaded horizontal transport still act on those two aggregates;
after each forcing step a typed reconciliation receipt maps the changed pressure, vapor, cloud,
temperature and tangent momentum back into the eight layers. Pressure-layer masses and reservoirs
match the aggregate targets while the finer vertical temperature anomalies persist. If native wind
shear would violate the 90 m/s contract, its anomalies are reduced coherently around the requested
band mean so aggregate momentum still closes.

Existing v10 saves migrate into the eight-level schema without changing surface pressure,
atmospheric water, two-band moist enthalpy or tangent momentum. Existing v11 saves restore exactly,
including the native profile digest and its latest reconciliation receipt. This rung establishes a
real persistent vertical coordinate, but native pressure-level phase change, vertical transport,
entrainment and lateral advection remain future work; it does not claim that duplicating current
two-band forcing across a finer state is already pressure-level dynamics.

## Rung 19: native pressure-level thermodynamics and descent

Local atmospheric thermodynamics now run on all eight pressure levels. Each level derives its own
saturation capacity from dry-air mass, center pressure and temperature, persists bounded cloud liquid,
and emits a typed vapor/cloud/latent-heat receipt. Long storms can use bounded condensation/fallout
subcycles, while every upper-level precipitation source names every crossed native interface and an
exact surface credit. The established two-band phase receipts remain compatibility summaries for UI
and older consumers; they no longer drive the actual phase calculation.

All seven adjacent native interfaces now exchange equal gross dry-air parcels plus sensible heat,
vapor, cloud liquid and tangent momentum. Momentum-mixing kinetic loss is returned to native sensible
heat. A composite receipt closes native water, moist enthalpy, eastward/northward momentum, horizontal
kinetic energy and resolved energy and contains the eight phase receipts, seven exchange receipts and
all precipitation-descent routes. Engine v12 persists this evidence; v11 snapshots migrate without
inventing a receipt for work they never ran.

This is a genuine native-thermodynamics rung, not the end of atmospheric work. Loaded horizontal
advection and the bounded buoyancy/convective-kinetic-energy core still operate through the two-band
compatibility seam, so the broad `pressureLevelDynamicsResolved` claim stays false. Resolved vertical
momentum, entrainment, turbulence, aerosol/droplet/ice microphysics, three-dimensional convection and
scientific forecast authority remain later rungs.

## Rung 20: native eight-level horizontal atmosphere

Loaded cardinal neighbors now exchange dry air independently across all eight persisted pressure
levels. Each level combines bounded pressure-gradient and tangent-wind/Courant transport, and its dry
air carries native vapor, cloud liquid, absolute sensible enthalpy and tangent momentum. Separate
native mixing receipts cover those tracers, while pressure-gradient impulses, latitude-aware Coriolis
rotation and terrain-following geopotential adjustment are recorded at the same level resolution.

The typed domain receipt contains eight ordered conservation ledgers plus exact sender debit and
receiver credit for every routed quantity. Water, moist enthalpy, eastward/northward momentum,
horizontal kinetic energy, geopotential energy and resolved energy close after their named forcing,
mixing and geometry terms. Every destination column persists a compact local receipt tied to the
domain digest. The lower-two and upper-six UI fields are now projections of the transported native
state. Their lost within-band kinetic and height variance is explicitly receipted rather than
misreported as physical loss.

Engine v13 preserves that lineage; v12 snapshots migrate with native-horizontal truth false unless a
valid receipt actually exists. The broad `pressureLevelDynamicsResolved` claim remains false because
the buoyancy and convective-kinetic-energy core is still the bounded two-band compatibility model.
Continuous unloaded-cell circulation, a global angular-momentum solve, resolved vertical momentum,
entrainment, turbulence and scientific forecast authority remain later work.

## Rung 21: native pressure-interface convection

The last two-band physics dependency has been removed from local atmospheric stepping. All seven
pressure interfaces now own persistent convective kinetic energy, a bounded updraft velocity and an
exact compensating downdraft momentum. Each interface lifts the lower parcel through its actual
hypsometric separation, compares virtual temperature with the adjacent ambient layer, and converts
only bounded positive buoyancy work from sensible heat into its own kinetic reservoir. Stable motion
decays on the declared time scale and returns the lost kinetic energy to the two adjacent layers.

The v2 native dynamics receipt and its seven typed buoyancy/interface receipts record pressure and
geopotential conversion, equal-gross dry-air exchange, bulk entrainment/detrainment, water tracers,
tangent momentum, vertical momentum, horizontal and convective kinetic energy, thermalization and
resolved-energy residuals. The v3 vertical receipt remains a compatibility projection for older UI
consumers; it no longer runs a second two-band physical process. `pressureLevelDynamicsResolved` is
therefore true for a column only after that native local step has actually produced valid evidence.

Engine v14 persists the seven interface reservoirs. A v13 save maps its old two-band convective
energy onto the exact boundary/free interface, invalidates obsolete v1/v2 dynamics receipts, and does
not claim that native interface work occurred before the next real step. This is still a bounded bulk
column parameterization—not a resolved three-dimensional plume, turbulence closure, cloud
microphysics, global circulation model or scientific forecast.

## Rung 22: native mixed-phase clouds and typed precipitation

All eight pressure levels now persist cloud liquid and cloud ice independently. Saturation blends
over water and ice, while condensation, deposition, evaporation, sublimation, cloud freezing and
cloud melting exchange vaporization and fusion energy with the exact native layer. The declared
moist-enthalpy convention uses liquid as the phase reference, adds vapor latent energy and subtracts
cloud-ice fusion energy, so internal phase changes close without hidden heat.

Precipitation routes now carry rain and snow as typed mass. A falling route visits every crossed
native interface; snow can melt in a warm receiving layer and rain can refreeze in a cold one, with
the fusion heat applied to that layer and recorded in the route. Land snowpack, ocean rain/snow
fluxes and visible weather phase consume the physical surface result instead of reclassifying total
precipitation from a temperature label. Cloud ice is also a native tracer in adjacent vertical and
loaded horizontal transport.

Engine v15 migrates v14 liquid-only saves by adding explicit zero-valued ice reservoirs without
inventing mixed-phase history. The v3 dynamics receipt, v2 phase and descent receipts, v2 native
horizontal receipt and v5 Earth transport receipt close mixed-phase water and fusion-aware energy.
This remains bounded bulk microphysics: individual droplets, crystals, aerosols, collision and
coalescence are deliberately not claimed.

## Rung 23: mixed-phase radiation and persistent frozen-surface feedback

The native cloud reservoirs now alter the surface-energy path. Each of the eight pressure levels
contributes its independent liquid and ice water path to a broadband shortwave optical depth and
longwave emissivity. The resulting v1 radiation receipt records top-of-atmosphere forcing, clear and
cloudy transmissivity, absorbed surface sunlight, upward/downward infrared, mixed-phase cloud forcing
and the dynamic surface albedo. A held clear/cloudy test proves that this is causal: native condensate
changes both absorbed sunlight and the surface heat tendency under otherwise identical forcing.

Land snow now persists an age that darkens its albedo between fresh snowfall events. Ocean cells retain
snow on the sea-ice fraction separately from liquid seawater, use salinity to derive the local freezing
point, and derive ice concentration/thickness from conserved ice water equivalent. Snowmelt,
sublimation, ice growth and ice melt enter a v1 cryosphere phase receipt. The surface-energy ledger uses
liquid water as its reference and includes the exact fusion storage change plus the phase enthalpy of
incoming snow; frozen water therefore cannot change phase for free.

Engine v16 migrates v15 columns with explicit zero-age/no-receipt defaults and does not invent prior
radiation or fusion evidence. This is a bounded broadband and thermodynamic treatment, not spectral
radiative transfer, resolved snow grains, brine pockets, leads, ridging, dynamic sea-ice motion or a
scientific climate model.

## Rung 24: persistent land ecology and coupled carbon-water feedback

Land columns now contain a persistent ecology checkpoint instead of reconstructing vegetation from a
biome label on every frame. Nine bounded functional types derive canopy cover, leaf area, height, root
depth, roughness and canopy albedo from the canonical biome and climate. Carbon is retained in living
biomass, litter, soil organic matter and a local exchangeable atmospheric proxy. Nitrogen is retained
in living, litter, organic-soil and mineral pools.

Each real Earth-system step records absorbed-light gross primary production, nitrogen-limited retained
growth, autotrophic and heterotrophic respiration, litterfall, humification, mineralization and uptake.
The v1 land-ecology flux receipt closes both local carbon and nitrogen exactly. Plant water demand is
derived from the active canopy and roots; canopy and litter shade bare-soil evaporation. Canopy cover
also alters surface albedo, while canopy height alters aerodynamic roughness and sensible exchange.
These are therefore physical feedbacks, not display-only vegetation statistics.

Turning Life off freezes every ecology pool and produces a dormant zero-flux receipt while abiotic
water, atmosphere, radiation and cryosphere organs continue. Engine v17 migrates v16 columns with an
empty ecology checkpoint and no fabricated historic receipt; the first subsequent physical step seeds
and advances the organ from the column's real sample. This remains a bounded functional-type model
with a local carbon proxy—not individual plants, species succession, mechanistic photosynthesis,
globally mixed atmospheric CO2, nutrient transport, or a scientific Earth-system model.

## Rung 25: persistent ocean ecology and mixed-layer biogeochemistry

Ocean columns now retain dissolved inorganic and organic carbon, phytoplankton, zooplankton,
detritus, dissolved and biological nitrogen and phosphorus, and dissolved oxygen beside local
exchangeable atmospheric carbon and oxygen proxies. Light, temperature, sea ice, nitrogen and
phosphorus limit marine primary production. Grazing, mortality, oxygen-limited respiration and
remineralization return matter through the mixed layer, while chlorophyll, euphotic depth, oxygen
saturation and hypoxia are derived from the persistent reservoirs.

The v1 marine flux receipt independently closes carbon, nitrogen, phosphorus and the declared oxygen
flux ledger. Turning Life off freezes plankton, marine organic carbon and nutrients but keeps physical
air-sea C/O2 exchange active. Loaded ocean neighbors simultaneously mix fourteen dissolved,
plankton and detrital pools with area-weighted element conservation and typed donor/receiver receipts.
Loaded river mouths add explicit parameterized dissolved C/N/P/O2 concentrations beside freshwater;
this is deliberately not a claim that upstream river chemistry reservoirs already exist.

Engine v18 migrates v17 ocean columns through an empty checkpoint without inventing plankton or prior
flux evidence, then initializes the organ on the first real step. The local atmospheric gases are not
globally mixed, transport covers loaded surface neighbors rather than 3D currents, and plankton are
bulk functional pools rather than resolved organisms or mechanistic biochemistry.

## Rung 26: persistent river chemistry and exact ocean delivery

Canonical river reaches now retain dissolved inorganic and organic carbon, inorganic nitrogen and
phosphorus, and dissolved oxygen beside their water storage. A land-to-reach inlet adds a typed,
explicitly parameterized headwater chemistry boundary. Every loaded reach-to-reach move derives water
and solutes from the same pre-step state and records equal sender debit and receiver credit, so newly
received material cannot jump across multiple reaches in one invocation.

At a loaded ocean mouth, the v2 receipt removes the exact persistent C/N/P/O2 pools from the river and
credits those exact quantities into the receiving marine mixed layer. River-only, ocean-only and
combined ledgers are separately checked. Unloaded downstream handoffs retain both water and chemistry.
A v1 water-only basin snapshot migrates with an explicit empty chemistry checkpoint rather than
inventing historical solutes.

The upstream land-runoff concentrations remain a declared boundary: land ecology does not yet own and
debit complete C/N/P/O2 export reservoirs. At that rung, in-channel reactions, sediment, floodplains and a global
always-loaded basin network remain later work.

## Rung 27: persistent estuary processing

Loaded ocean mouths are now persistent material processors rather than transparent pipes. The v1
estuary organ consumes oxygen while converting a bounded fraction of dissolved organic carbon into
dissolved inorganic carbon, retains organic carbon, nitrogen and phosphorus in persistent sediment,
and exposes oxygen-sensitive denitrification as a named nitrogen-gas boundary. The ocean receives
only the remaining dissolved material, while the full river sender debit is partitioned exactly among
ocean credit, estuary storage, nitrogen loss and oxygen consumption.

River-only, estuary-only, ocean-only and combined C/N/P/O2 receipts close independently. Basin v2
snapshots migrate to v3 with explicit empty estuary storage rather than invented historical sediment.
The implementation is a bounded bulk reactor: it does not resolve tides, salinity wedges, sediment
resuspension, coastal currents or an atmospheric gas receiver for the declared gas terms.

## Rung 28: persistent deep ocean and biological carbon export

Ocean ecology v2 now carries a persistent deep-water organ below the mixed layer. Signed dissolved
DIC, DOC, inorganic nitrogen, phosphorus and oxygen exchange follows surface/deep concentration
gradients. Mixed-layer detritus sinks with its C/N/P composition, deep remineralization returns it to
dissolved pools only while oxygen is available, and a small fraction moves into persistent seafloor
organic burial. One typed receipt closes the mixed layer and interior together.

New ocean columns initialize bounded deep reservoirs from their canonical ocean sample. Existing v18
mixed-layer snapshots migrate into engine v19 with an explicit empty deep checkpoint, never invented
historical interior matter. Life-off continues physical dissolved exchange but freezes sinking,
remineralization and burial. This is not a 3D ocean-current solver: gyres, overturning water masses,
eddies, bathymetric flow and continuous unloaded-cell circulation remain future organs.

## Rung 29: atmosphere-owned local biosphere gases

Each sparse Earth-system column now owns persistent local carbon-dioxide carbon, oxygen and
nitrogen-gas reservoirs. Land and ocean ecology continue to expose their previous atmospheric fields
for compatibility, but those values are exact mirrors of the atmosphere-owned state rather than
duplicate stores. A typed atmosphere-biosphere receipt records land or ocean exchange and closes C/O2
around every step. Engine v19 saves migrate into v20 by adopting the existing proxy once, with an
explicit checkpoint and no fabricated historical flux.

At loaded ocean mouths, estuary denitrification now has a real persistent receiver. Basin v4 nests an
atmospheric boundary-input receipt inside the mouth receipt, credits nitrogen to the receiving coastal
column, and includes that reservoir in the coupled river/estuary/ocean/atmosphere nitrogen ledger.
Oxygen consumption remains a named estuary reaction term. Atmospheric gases are still local: there is
no horizontal gas transport, global mixing, full atmospheric chemistry or scientific composition
model yet.

## Rung 30: deterministic runtime integrity and handoff

`axm.foundation-planet.system-audit/v1` condenses the major cross-organ claims into a read-only
machine-verifiable report. It checks the current Earth-column lineage, eight-layer/seven-interface
pressure shape, local water and energy residuals, atmosphere-owned gas truth, atmosphere-biosphere
receipt, exact ecology mirrors, deep-ocean lineage, and—when supplied—the latest loaded transport and
basin receipts. Optional seams that have not produced a receipt are reported as unobserved rather than
silently passed.

The browser exposes the report through `AXMFoundationPlanet.audit()` and the streaming diagnostics.
Tests prove both directions: a healthy live-shaped state passes, while a deliberately corrupted
atmosphere/ecology mirror fails at the named check. The audit mutates nothing and does not convert the
procedural model into scientific authority; it is a compact trust and handoff seam for later games,
world organs and AI stewards.

## Rung 31: loaded atmospheric gas transport

Atmosphere-owned carbon-dioxide carbon, oxygen and nitrogen gas now ride the same typed native dry-air
mass routes used by the eight pressure levels. Every gas route names its parent dry-air transfer,
sender, receiver, native level and carried mass. All routes are derived from one pre-transport state and
committed simultaneously, so reversing caller order produces the same state and digest. The domain
receipt closes area-weighted C/O2/N2 mass, while per-column receipts retain incoming, outgoing and final
reservoir lineage. Land and ocean ecology gas fields remain exact compatibility mirrors of the
atmosphere owner after transport.

Engine v20 and atmosphere-gas state v1 snapshots migrate to engine v21/state v2 without inventing a
historical route. Transport step v7 integrates the gas receipt with the existing native dry-air route
ledger and exposes its conservation result to the runtime audit and browser diagnostics. This is sparse
transport between loaded canonical neighbors with explicit unloaded boundaries. It is not global
mixing, continuous circulation through unloaded cells, resolved atmospheric chemistry or a scientific
composition model.

## Rung 32: eight-level atmospheric composition

Carbon-dioxide carbon, oxygen and nitrogen gas are now persistent reservoirs in each of the eight
native pressure layers rather than one whole-column amount copied onto every horizontal route. Land,
ocean and estuary exchange enters through native layer 0. The local dynamics step consumes the same
seven adjacent dry-air exchange receipts already produced by the pressure organ and conservatively
mixes each gas across the named lower/upper interface. A typed vertical receipt retains initial and
final layer inventories, per-interface net material, throughput and exact C/O2/N2 closure.

Horizontal routes now sample the sender's pre-transport composition at the route's own native level.
The domain receipt contains eight ordered conservation ledgers and explicitly records that no
whole-column average was used. Engine v21/state v2 snapshots migrate to engine v22/state v3 by
partitioning their exact bulk reservoirs according to persisted pressure-layer dry-air fractions; this
is a migration checkpoint, not fabricated historical vertical or horizontal transport. Transport step
v8 and route/local receipt v2 provide the new lineage. The eight layers remain bounded bulk composition
reservoirs, not molecular diffusion, reaction chemistry, three-dimensional plumes, circulation through
unloaded cells, global mixing or a scientific atmospheric-composition model.

## Rung 33: atmosphere-owned CO2 radiative feedback

The persistent carbon inventory now affects the surface-energy path. A replaceable
`atmosphere-co2-radiation` organ reads all eight typed gas layers together with their native pressure
thicknesses and temperatures. It derives a concentration and bounded grey optical depth for each
path, integrates each layer's temperature-dependent downward-longwave contribution through the
layers below it, and compares that result with a 420 ppm reference using the same temperature profile.
The comparison is exactly neutral for a true 420 ppm fixture, responds monotonically above and below
that reference, and distinguishes equal total carbon placed in warm low air from carbon placed in cold
high air.

`surface-radiation-receipt/v2` nests the complete eight-layer CO2 receipt. Its cloud-overlap mask and
bounded surface adjustment enter the existing closed surface-energy ledger, so the result changes
heat storage rather than merely appearing as a diagnostic. The runtime exposes native ppm, signed
longwave adjustment and observed layer count. Engine v22 snapshots migrate to v23 by invalidating old
v1 radiation receipts; the first real post-migration step earns v2 evidence instead of having it
fabricated during restore.

This is a deliberately modest causality rung, not a spectral or line-by-line radiative-transfer solver.
The calibration is a bounded broadband grey-gas proxy, cloud overlap is bulk-parameterized, and no
scientific climate accuracy is claimed. Radiation consumes the atmosphere-owned profile present at
the start of a local step; biosphere and transport changes therefore affect the following local
radiation step.

## Rung 34: finite soil-water and runoff biogeochemistry

Land runoff chemistry is no longer created at a river inlet from a concentration formula. Every new
land column owns finite dissolved inorganic and organic carbon, inorganic nitrogen, inorganic
phosphorus and dissolved oxygen in its soil-water organ. A wet local step mobilizes a bounded fraction
from those persistent donors into a persistent runoff-biogeochemistry queue using the same generated
runoff event. The soil debit and queue credit close per pool; a dry step exports nothing.

Loaded topographic routing moves the same fraction of queued C/N/P/O2 as queued water. A land receiver
gets an area-weighted queue credit, while a loaded coastal ocean gets an exact dissolved-pool credit.
Canonical basin capture likewise debits the Earth cell's queue before crediting its persistent river
reach, and both sides carry one transfer identity. Basin v5 therefore treats land runoff chemistry as
an internal reservoir in the river/estuary/ocean/atmosphere ledger instead of subtracting an external
headwater boundary.

Engine v23 saves migrate to v24 with explicit empty soil and runoff checkpoints. The first real local
step establishes a declared canonical soil initial condition but exports no historical material; only
a following genuine runoff step may mobilize it. Old transport and basin receipts are invalidated
rather than relabeled as sender-debit evidence. This remains bounded bulk soil-water chemistry—not
mechanistic weathering, sorption, redox kinetics, soil horizons, pore flow or a scientific watershed
model.

## Rung 35: renderer-independent experience membrane

Caelus can now seal the currently loaded sector into
`axm.foundation-planet.experience-sector-capsule/v1`. The capsule is a deterministic, renderer-free
projection of canonical coordinates, environment, active layers, physics frame, loaded hydrology,
Earth-system state and regional ecology. Its world lineage, source revision, save checksum and six
component digests feed one capsule digest. Reordering set-like rivers, lakes, handoffs or species cannot
change the result; changing a semantic field does. A changed component under an old digest is refused.

`axm.foundation-planet.experience-lease/v1` makes three different relationships explicit. An observer
may receive structured state but cannot propose world actions. A player may create a typed
`axm.foundation-planet.world-action-proposal/v1`, but the proposal carries no apply or reset authority
and binds itself to the source revision for governed review. A sandbox may fork a complete detached
candidate in which creative mutation is permitted, but that candidate cannot write back, promote
itself or become canonical planet state. Every intent is actor-, lease-, capsule- and sequence-bound;
stale or replayed sequences are refused.

`axm.foundation-planet.experience-protocol-audit/v1` verifies capsule and component digests, the
authority membrane, lease lineage, intent receipts, unapplied proposals and sandbox detachment without
mutating Caelus. API v31 exposes capture, lease, dispatch and audit functions. This is preparation for
future Mirror, Holodeck and Experiment World brokers, not a claim that any of them is connected. Actual
writeback or automatic integration remains a deliberate human-governed checkpoint.

## Rung 36: finite geomorphic sediment cycle

Land no longer exports an unowned erosion-rate fiction. Each canonical land column owns a finite
`axm.foundation-planet.surface-sediment-state/v1` inventory split into clay, silt, sand and gravel.
Soil depth, substrate texture and bulk density establish the declared initial material. Surface
runoff, rain impact, slope proxy, canopy/litter protection and freeze state mobilize only a bounded
fraction. The exact surface debit credits a persistent
`axm.foundation-planet.runoff-sediment-queue/v1`; dry steps export zero and an exhausted grain donor
cannot go negative.

Loaded topographic transport moves sediment with the exact routed water fraction. Land receivers get
area-weighted queue credits, while loaded ocean receivers gain persistent suspended and deposited
coastal material. Canonical basin inlet v5 debits the same land queue before crediting persistent
river suspended load. Basin engine v6 routes that load from the pre-step reach state, partitions each
grain between persistent river-bed deposit and downstream export, retains all material at unloaded
handoffs, and grain-selectively credits a loaded coast at a river mouth. Clay remains more mobile;
sand and gravel settle more readily. Every surface, neighbor, river and coast seam carries paired
typed receipts and a per-grain conservation ledger.

Earth engine v24 and basin v5 snapshots migrate with explicit empty sediment checkpoints and no
invented historical erosion. The first land step after migration establishes finite ownership but
exports nothing. Old transport and basin receipts are invalidated instead of being relabeled as
current sediment evidence. The renderer-independent experience capsule now preserves surface,
runoff and coastal sediment state for future observer/player/game layers, and API v32 exposes the
organ description and complete state.

This is a finite, persistent geomorphic material cycle—not a scientific erosion or landscape
evolution solver. Erosion and deposition are bounded bulk parameterizations. Mechanistic soil
formation, abrasion, entrainment thresholds, channel cross-section evolution, bank migration,
delta geometry, resolved coastal morphodynamics and a continuously active global sediment network
remain explicit gaps. Rung 37 below supersedes only the absence of bounded loaded-reach floodplain
exchange; it does not claim resolved inundation hydraulics.

## Rung 37: persistent conservative floodplains

Loaded canonical reaches now own `axm.foundation-planet.floodplain-state/v1`. The state persists
overbank water, dissolved C/N/P/O2 chemistry, suspended clay/silt/sand/gravel and deposited mineral
material beside—not inside—the channel reservoirs. Reach length, width and depth form an explicit
parameterized bankfull storage threshold. Water above that threshold can cross into floodplain
storage, while a bounded recession timescale can return only water, chemistry and suspended grains
the floodplain actually owns.

`axm.foundation-planet.floodplain-exchange-receipt/v1` records both directions, the exact bankfull
control, grain-selective overbank entrainment, grain-selective settling and combined water, chemistry
and per-grain residuals. Coarse grains settle more readily; persistent deposits do not disappear when
the reach leaves the loaded sector. Basin engine v7 includes floodplain reservoirs in the same coupled
water, chemistry and sediment ledgers as channel, runoff, coast and estuary storage. Unloaded reach
receipts name retained floodplain water and mineral mass.

Basin v6 snapshots migrate through explicit empty floodplain checkpoints. Their first current step
cannot invent historical flooding or deposits, and old basin receipts are discarded instead of being
relabelled as observed floodplain evidence. The read-only system audit independently validates every
floodplain receipt, and API v33 exposes compact floodplain state to the interface and governed
experience capsule.

This is a bounded reach-scale storage organ, not a two-dimensional inundation solver or scientific
flood forecast. It does not rasterize water depth across terrain, resolve levees and bank failure,
erode channel banks, remobilize old deposits, couple vegetation succession to flooding, or advance
unloaded reaches continuously.

## Rung 38: persistent flood-pulse memory and habitat potential

Every persisted reach now also owns
`axm.foundation-planet.floodplain-habitat-state/v1`. This read-only observer
remembers genuinely observed wet and dry days, consecutive wet and dry
spells, flood-pulse count, fraction-weighted inundation exposure, a rolling
30-day hydroperiod, peak inundation and newly observed deposits. Dissolved
C/N/P and fine deposits provide bounded fertility signals; the observer never
debits, credits or otherwise mutates the floodplain material state it reads.

`axm.foundation-planet.floodplain-habitat-receipt/v1` binds every memory
transition to the exact floodplain-exchange digest and before/after material
digests. It projects a normalized five-part potential mosaic: open water,
mudflat, reed/sedge, wet meadow and riparian woodland. Basin engine v8
persists this memory, retains it across unloaded handoffs, produces
reach-order-invariant receipts and migrates v7 snapshots through an explicit
checkpoint. The checkpoint records current water and deposit baselines but
adds no historical days or flood pulses. The system audit independently
checks normalization, observer purity, memory monotonicity and truth
boundaries. API v34, the live diagnostics and experience capsules expose the
compact result.

These fractions describe habitat potential, not living vegetation. Rung 38
does not create plant biomass, species occupancy, population abundance,
succession, competition, mortality, seed dispersal, resolved wetland
topography or scientific wetland forecasts. A later ecology organ may consume
this potential through its own finite populations and receipts; it must not
retroactively relabel this observer as those populations.

## Rung 39: bounded flood-event chronicle

Every persisted reach now owns
`axm.foundation-planet.flood-event-history-state/v1` beside its material
floodplain and habitat-potential memory. The organ observes the exact current
floodplain-exchange receipt and records genuine event start, continuation and
completion boundaries. Each event retains wet duration, observation count,
peak water, peak inundated fraction, fraction-weighted inundation exposure,
overbank and return water, dissolved C/N/P/O2 payload, typed overbank grains
and typed deposited grains. It never owns or mutates those material pools.

Completed events enter a deterministic archive bounded to the most recent 32
events per reach. Lifetime completion and eviction counts, mean completed
duration, mean recurrence interval and historical peaks remain compact
statistics when older detail is evicted. Basin engine v9 binds every
`axm.foundation-planet.flood-event-transition-receipt/v1` to the exact
floodplain-exchange digest, includes event state in snapshot/restore and
unloaded-reach retention, and remains invariant to caller reach order. The
read-only audit independently rejects material mutation, broken lifecycle
claims, mismatched exchange lineage and archives beyond the declared bound.
API v35 and experience capsules expose a compact semantic projection.

Basin v8 snapshots migrate with an empty event checkpoint. If the material is
already wet, the organ waits for a genuine dry boundary before allowing a new
event to begin; it never converts an unknown pre-migration wet spell into
invented history. This is a loaded-reach disturbance chronicle, not resolved
hydraulics, a continuously simulated global river history, a scientific flood
frequency model or a forecast. Event completion is recorded at the first dry
observation while event duration counts only observed wet intervals.

## Rung 40: persistent functional-guild floodplain succession

Every persisted reach now also owns
`axm.foundation-planet.floodplain-succession-state/v1`. Five functional guilds
— aquatic pioneers, mudflat annuals, reed/sedge, wet meadow and riparian
woodland — carry finite seed banks plus juvenile and mature cover. Their daily
transition includes explicit local seed production, parameterized external
seed rain, germination, seed decay, recruitment, maturation, ordinary
mortality, flood-caused mortality and competition. Proposed cover is
deterministically limited to 0.98, leaving an explicit bare fraction rather
than silently overfilling the reach.

Every `axm.foundation-planet.floodplain-succession-receipt/v1` binds the
living transition to the exact habitat-memory and flood-event receipts it
consumed. Per-guild seed and cover ledgers expose their before, input, loss and
after terms; the system audit independently checks both closure and the cover
capacity. Flood tolerance changes disturbance mortality by guild, while a
completed event can increase bounded recovery seed rain. Turning Life off
freezes demography and seed banks without deleting history.

Basin engine v10 persists and streams the community, retains its summary at
unloaded boundaries, and keeps state and receipts invariant to caller reach
order. A v9 snapshot receives an empty migration checkpoint: its first step
adds no cover, seeds or living history. API v36, live diagnostics and governed
experience capsules expose the compact semantic state.

This is genuine functional-guild community state, but it is not plant biomass
material ownership, species occupancy, resolved individuals, mechanistic
plant biochemistry or a scientific succession forecast. External seed rain is
an explicit parameterized boundary. Those stronger claims require their own
future organs and evidence.

## Rung 41: material-backed floodplain plants

Floodplain cover no longer has to imply matter that the planet cannot locate.
Each reach now owns
`axm.foundation-planet.floodplain-plant-matter-state/v1`: live,
standing-dead and litter carbon and nitrogen for the same five functional
guilds. New post-R41 juvenile or mature cover demands a finite material target.
The target is credited only after the reach's deterministic donor Earth cell
debits its existing land-ecology live biomass through
`axm.foundation-planet.land-ecology-subgrid-biomass-debit/v1`. Sender and
receiver receipts carry the same per-guild transfer IDs and the receiver binds
the exact sender digest.

This is a subgrid ownership partition, not a second independent biomass pool.
Every basin step audits loaded land live C/N plus all persistent floodplain
plant C/N before and after transfer. Mortality moves live matter to standing
dead, and a bounded guild-specific fall rate moves standing dead to litter;
neither internal transition creates or deletes C/N. Turning Life off freezes
all plant-matter pools.

Basin engine v11 persists the organ and retains it at unloaded handoffs. A v10
snapshot initializes an explicit migration checkpoint: existing R40 cover is
recorded as a legacy unmaterialized baseline, and the first current step
creates no historical matter. Only genuinely new cover after migration can
claim donor-backed biomass. API v37, the live diagnostic row, the read-only
integrity audit and governed experience capsules expose the compact semantic
state.

Phosphorus and plant water remain unowned here because no compatible plant
reservoir exists to debit. Decomposition, respiration, nutrient uptake,
species occupancy, resolved individuals, mechanistic biochemistry and
scientific biomass calibration also remain explicit future organs rather than
being inferred from C/N bookkeeping.

## Rung 42: jointly resource-limited floodplain plants

The existing floodplain water and dissolved-phosphorus reservoirs now provide
the missing compatible owner. Each reach persists
`axm.foundation-planet.floodplain-plant-resources-state/v1` beside its C/N
matter. The new organ owns live tissue water and live, standing-dead and
litter phosphorus for the five functional guilds; its supported-carbon fields
are non-owning references back to the R41 matter receipt and therefore cannot
double-count carbon.

New cover is now jointly limited by four finite resources. Its proposed C/N
demand is first bounded by the loaded donor land cell, while the same growth
is bounded again by the reach's available floodplain water and dissolved P.
Only the shared minimum can become cover. Exact per-guild uptake IDs connect
the floodplain sender debit to the resource receiver. Mortality retains P in
standing dead, releases live tissue water back to the same local floodplain
under a second paired ID, and later transfers standing-dead P to litter.

Basin engine v12 includes live tissue water in the whole loaded water ledger
and plant P in the coupled runoff/river/floodplain/estuary/ocean phosphorus
ledger. Its independent audit checks both sender and receiver schemas,
digests, IDs, guild flows, pool closure and non-owning carbon references. Life
off freezes the organ, unloaded reaches retain it, and forward/reverse reach
orders must reproduce identical receipts and state.

A v11 save migrates without retroactive nutrient creation: existing R41 C/N
is recorded as an unsupported legacy checkpoint and receives zero P and zero
water on that first observation. R42 does not yet model decomposition into
soil nutrients, root hydraulics, transpiration to the atmosphere,
photosynthetic stoichiometry, species occupancy, individuals or scientific
calibration. API v38 and experience capsules expose the bounded state without
granting write authority.

## Rung 43: resource-backed floodplain detrital return

Standing-dead and litter matter now have a conservative downstream path.
Every reach persists
`axm.foundation-planet.floodplain-decomposition-state/v1`, which owns only
bounded process memory and cumulative observations—not carbon, nitrogen or
phosphorus. The actual material remains owned by the R41 plant-matter organ,
the R42 plant-resource organ, and the local floodplain chemistry receiver.

For each guild and detrital pool, decomposition can use only the smaller of
owned plant carbon and its paired resource-backed carbon reference. This
leaves legacy unsupported matter untouched. Moisture, Life abundance,
guild-specific standing-dead and litter rates, and a one-day maximum step
bound the aggregate transfer. Exact shared transfer IDs connect the plant
C/N debit, supported-C/P debit, and local floodplain dissolved-organic-C plus
inorganic-N/P credit. Independent receipts and the basin audit verify each
schema, digest, ID, quantity and C/N/P residual.

Basin engine v13 persists the organ, includes detrital return in the coupled
material ledgers, remains invariant to caller reach order, and explicitly
receipts the cumulative memory of unloaded reaches. A v12 snapshot receives
an empty migration checkpoint: its first v13 observation performs zero
transfer and invents no historical decomposition. Life off freezes the
process and all three transfer paths. API v39, the live diagnostic row and
renderer-neutral experience capsules expose the compact semantic state.

R43 credits only the existing local floodplain chemistry reservoirs. It does
not claim atmospheric respiration, oxygen consumption, soil delivery,
microbial populations, mechanistic biochemistry or scientific calibration.
Those require compatible persistent receivers and separate evidence-bearing
organs before they can affect the planet.

## Rung 44: oxygen-limited local floodplain respiration

Decomposition-returned dissolved organic carbon now has a separate,
conservative aerobic path. Every reach persists
`axm.foundation-planet.floodplain-respiration-state/v1`, which owns process
memory only. Its plan may consume only local floodplain-owned dissolved
organic C and dissolved O2. The paired
`axm.foundation-planet.floodplain-aerobic-mineralization-receipt/v1` debits
that DOC, credits exactly equal dissolved inorganic C to the same floodplain,
and debits O2 at the declared bulk ratio of 32/12 kg O2 per kg C.

Finite local oxygen caps the reaction before chemistry is touched. The
receipt closes the DOC debit, DIC credit, total carbon and O2 debit, while
`axm.foundation-planet.floodplain-respiration-receipt/v1` binds the exact
chemistry digest into persistent observed, dormant and oxygen-limited process
memory. Life off produces zero reaction and freezes the process. Basin engine
v14 includes the oxygen sink in its coupled ledger, preserves caller-order
invariance and explicitly receipts respiration memory retained by unloaded
reaches. A v13 snapshot gains an empty checkpoint whose first v14 step moves
no C or O2 and invents no history. API v40, the live diagnostic row and
renderer-neutral experience capsules expose the state without write
authority.

R44 is a bounded aerobic mineralization organ, not a microbial ecosystem or
scientific soil-water respiration model. It has no atmosphere exchange,
anaerobic pathway, microbial populations, resolved enzyme or redox chemistry,
temperature calibration, soil receiver or scientific calibration claim.

## Rung 45: paired floodplain-atmosphere gas exchange

Loaded floodplains can now exchange material with the already authoritative
eight-layer atmosphere without either owner reaching through the other. Every
reach persists `axm.foundation-planet.floodplain-gas-exchange-state/v1`, a
process-memory organ that owns no carbon or oxygen. It proposes bounded DIC
evasion and oxygen-deficit reaeration, then requires two receipts carrying the
same exchange ID before it can record an observed transition.

`axm.foundation-planet.floodplain-gas-exchange-receipt/v1` debits only local
floodplain dissolved inorganic carbon and credits only local dissolved oxygen.
`axm.foundation-planet.atmosphere-floodplain-gas-exchange-receipt/v1` performs
the opposite sides against native atmosphere layer 0: an exact CO2-carbon
credit and an exact oxygen debit. It refuses surface-layer oxygen overdraw.
The basin v15 ledger verifies both owners, quantities, IDs, digests and four
independent C/O2 residuals; the existing river/floodplain coupled material
ledger also includes the declared cross-owner transfer. The native atmosphere
owner declares a 0.001 kg absolute floating-point bound because the receipt
subtracts tiny local fluxes from planet-cell gas reservoirs; larger residuals
still fail independently of the basin's separate per-identity coupled
aggregate policy.

The exchange is physical and therefore continues when Life is disabled. A v14
save gains zero-history process memory, and its first v15 observation moves no
material. Missing loaded atmosphere produces an explicit zero-transfer process
receipt rather than a fabricated air reservoir. Caller order remains
deterministic, unloaded reach memory is retained, API v41 exposes the live
diagnostic, and renderer-independent experience capsules carry the compact
state without granting mutation authority.

R45 uses bounded exchangeable-DIC and oxygen-saturation proxies. It is not a
bidirectional Henry-law solver, resolved wind/wave or air-water turbulence,
carbonate speciation model, global atmosphere, calibrated reaeration model or
scientific gas-flux claim.

## Rung 46: temperature-aware two-way floodplain carbon exchange

Floodplain and atmosphere owners now support either direction of CO2-carbon
transfer without converting their paired membrane into shared mutable state.
`axm.foundation-planet.floodplain-gas-exchange-state/v2` compares the bounded
exchangeable fraction of local floodplain DIC with a temperature-adjusted
aqueous CO2-carbon equilibrium target derived from the native surface
atmosphere layer's local CO2 ppm proxy. A positive gradient evades carbon to
air; a negative gradient invades the water. The two directions are mutually
exclusive in one transition.

The target uses an explicit reference solubility proxy of 0.167 mg carbon per
litre at 420 ppm and 25 C, adjusted by the local CO2 proxy and a bounded
temperature factor. It does not relabel total DIC as dissolved CO2. The
floodplain owner caps evasion by its actual DIC, while the atmosphere owner
caps invasion by actual layer-0 CO2 carbon and refuses overdraw before
mutation. Oxygen-deficit reaeration remains the paired one-way oxygen path.

Both owner receipts and the process receipt advance to v2. Basin engine v16
verifies the exact exchange ID, exclusive direction, native layer, quantities,
digests and carbon/O2 residuals. A v15 save preserves prior observed and
cumulative evasion/reaeration memory, initializes cumulative invasion to zero,
and requires one zero-transfer checkpoint before the new direction becomes
active. Unloaded reaches retain all three cumulative fluxes. API v42, the live
diagnostic and renderer-independent experience capsules expose this semantic
state without granting mutation authority.

R46 closes the artificial one-way carbon boundary, but it is still a bounded
concentration-gradient parameterization. It is not a full Henry-law or
carbonate-speciation solver, has no pH or alkalinity state, and does not resolve
wind, waves, bubbles, turbulence, barometric pressure or salinity corrections.
Those remain separate realism rungs and scientific-calibration boundaries.

## Rung 47: oxygen-gated floodplain denitrification

Floodplain chemistry now has a bounded anaerobic nitrogen-loss path beside
the existing aerobic DOC mineralization. After aerobic respiration, the
denitrification plan reads floodplain-owned DOC, dissolved inorganic nitrogen
and dissolved oxygen. Activity rises only below a declared 2 mg/L oxygen
threshold, remains limited by living abundance and wetness, and can consume at
most a parameterized reactive nitrate-equivalent fraction of the DIN pool.
The default fraction is 0.5; this is deliberately not a claim that all DIN is
nitrate or that nitrate speciation has been resolved.

The local reaction converts equal DOC carbon to DIC and consumes 14/15 kg N
per kg C, producing the same nitrogen mass as N2-N. A typed floodplain receipt
debits DOC and DIN and credits DIC. Under the same exact transfer ID, a typed
atmosphere boundary receipt credits that N2 to native atmosphere layer 0. The
process receipt binds both owner digests and refuses an active transition when
the matching atmosphere cell is unavailable. Carbon, reaction nitrogen,
cross-owner nitrogen and both owner ledgers are independently audited.

Basin engine v17 persists the process memory, retains it at unloaded reaches,
freezes it with Life off, and migrates v16 saves through one zero-transfer,
zero-history checkpoint. API v43, the live text diagnostic and the
renderer-independent experience capsule expose the compact state without
granting mutation authority.

R47 is an explicit deterministic stoichiometric parameterization. It does not
resolve nitrate/ammonium speciation, microbial populations, redox chemistry,
pH, alkalinity, nitrous oxide, sediment porewater transport or scientific
calibration.

## Rung 48: temperature-responsive floodplain denitrification

Denitrification activity now responds to the loaded Earth-system surface
temperature through a declared water-temperature proxy. The process applies a
bounded Q10-style multiplier to the existing wetness, anoxia and living
activity controls: `Q10^((temperature - reference) / 10)`, with default Q10 2,
reference 20 °C and a final factor bounded to 0.05–4. The compact v2 process
memory records temperature-constrained days and the last proxy temperature,
reference, Q10 and bounded response factor.

Material authority does not change. Floodplain chemistry still owns DOC, DIN
and DIC; native atmosphere layer 0 still owns received nitrogen gas; and the
existing paired v1 reaction and atmosphere boundary receipts still move the
material. The v2 process receipt binds those owner receipts while exposing the
temperature response and truth boundary. Basin engine v18 migrates v17 state
by preserving observation and cumulative-reaction history, initializing only
new temperature history to zero, and requiring one zero-transfer checkpoint.
API v44 and the renderer-independent experience capsule expose the result.

Surface temperature is only a forcing proxy: Caelus does not yet persist
floodplain water temperature, resolve freeze/thaw or use Arrhenius kinetics.
The Q10 value and bounds are configurable model parameters, not calibrated
denitrification-rate claims.

## Rung 49: persistent nitrate and ammonium ownership

River and floodplain chemistry now own nitrate-N and ammonium-N as separate
persistent material pools. Aggregate dissolved inorganic nitrogen remains an
exact compatibility sum of those two owners; it is no longer the only
nitrogen reservoir. Generic land-runoff DIN is partitioned at the receiving
river boundary with an explicit configurable nitrate fraction (0.5 by
default). That partition is a declared model parameter, never a measured
speciation claim.

Reach routing and bankfull floodplain exchange carry both species with the
same exact water fraction and independently close their ledgers. Resource-
backed plant detrital nitrogen returns to the floodplain ammonium pool.
Temperature-responsive denitrification now reads and consumes owned nitrate
only, leaves ammonium unchanged, and binds that nitrate debit to the existing
DOC/DIC and native-atmosphere nitrogen-gas owner receipts. The runtime audit
checks both species, their aggregate compatibility sum, owner lineage and
cross-boundary conservation.

River chemistry state v3, floodplain state and exchange receipt v2,
denitrification state and process receipt v3, and basin engine v19 carry the
new contract. A v18 basin snapshot retains total DIN and cumulative reaction
history, initializes legacy aggregate DIN 50/50 as an explicit model
initialization, drops legacy receipts, and requires one zero-transfer v19
migration checkpoint. API v45 and renderer-independent experience capsules
project the owned species read-only.

R49 does not add nitrite, nitrification, pH or alkalinity. Nitrification is a
future reaction rung because it must debit oxygen and represent its associated
alkalinity demand rather than silently relabel ammonium as nitrate; see the
[EPA Nutrient Control Design Manual](https://www.epa.gov/sites/production/files/2019-08/documents/nutrient_control_design_manual.pdf).

## Rung 50: oxygen-ledgered floodplain nitrification

Floodplain chemistry now performs an explicit aerobic ammonium-to-nitrate
reaction. Every transition debits the owned ammonium-N pool, credits the owned
nitrate-N pool by the same mass, and debits owned dissolved oxygen at 4.57 kg
O2 per kg N. The local reaction receipt independently closes ammonium debit,
nitrate credit, total-DIN conservation, dissolved-oxygen debit and oxygen
stoichiometry. A persistent process organ binds that owner receipt to aerobic
availability, wetness, Life, a bounded first-order rate and the existing
surface-temperature proxy with a parameterized Q10 response. Only dissolved
oxygen above the configured aerobic minimum is reactive, so an oxygen-limited
step can approach but not silently cross that threshold.

The same receipt records 7.14 kg CaCO3-equivalent alkalinity demand per kg N as
an explicit diagnostic. It does not debit a material alkalinity reservoir or
feed pH because Caelus does not yet own those pools. Both factors follow the
[EPA Nutrient Control Design Manual](https://www.epa.gov/sites/default/files/2019-08/documents/nutrient_control_design_manual.pdf).
The reaction is a declared one-step ammonium-to-nitrate approximation; nitrite,
nitrifier populations, floodplain water-temperature memory and calibrated
kinetics remain unresolved.

Floodplain state v3, nitrification state and process receipt v1, and basin
engine v20 carry the contract. Basin nitrogen and oxygen ledgers include the
reaction, the system audit validates typed and digest-bound process evidence,
unloaded reach memory is retained, and Life-off freezes the biological
reaction. A v19 basin snapshot preserves all existing material and process
history, adds empty nitrification memory, drops legacy receipts, and requires
one typed zero-reaction checkpoint. API v46 and renderer-independent
experience capsules expose compact read-only nitrification truth.

## Rung 51: end-to-end alkalinity ownership

This rung supersedes R50 only where R50 labelled alkalinity demand as a
non-material diagnostic. Pre-R51 diagnostic history remains separately exposed
and is never relabelled as an owner debit.

Caelus now owns acid-neutralizing capacity as kilograms of CaCO3 equivalent
from dissolved soil water through the runoff queue, canonical rivers,
floodplains, estuaries and the ocean mixed layer. New canonical soil state uses
a deterministic lithology-responsive initial condition; new canonical ocean
state uses a 2,300 micromole/kg open-ocean reference at salinity 35. These are
model initial conditions, not observations. Exact receipts carry alkalinity
with the same water fractions and transfer IDs as C/N/P/O2, including loaded
neighbor runoff, reach routing, bankfull exchange, estuary passage, river-mouth
delivery and mixed-layer neighbor transport.

Floodplain nitrification now consumes the owned pool at 7.14 kg CaCO3
equivalent per kg ammonium-N converted and becomes alkalinity-limited before an
overdraft. Floodplain and estuary denitrification generate 3.57 kg CaCO3
equivalent per kg nitrate-N converted to nitrogen gas. These factors follow the
[EPA Nutrient Control Design Manual](https://www.epa.gov/sites/default/files/2019-08/documents/nutrient_control_design_manual.pdf)
and EPA's [Municipal Nutrient Removal Technologies report](https://www.epa.gov/sites/default/files/2019-08/documents/municipal_nutrient_removal_technologies_vol_i.pdf).
The interpretation follows the USGS definition of
[alkalinity and acid-neutralizing capacity](https://www.usgs.gov/publications/chapter-a6-section-66-alkalinity-and-acid-neutralizing-capacity),
while the ocean reference follows NOAA's
[CO2 system calculation guidance](https://www.ncei.noaa.gov/access/ocean-carbon-acidification-data-system/oceans/co2rprt.html).

Soil/runoff state v2, river chemistry v4, floodplain state v4,
denitrification state v4, nitrification state v2, estuary state v2 and ocean
ecology state v3 carry the material contract. Basin engine v21 closes dedicated
soil, runoff, river, floodplain, estuary, ocean and coupled residuals; the
read-only system audit exposes a separate end-to-end alkalinity check. Restored
pre-R51 snapshots preserve every previous pool and reaction history but add
zero alkalinity with explicit migration checkpoints rather than inventing past
chemistry. API v47 and experience capsules project the ledger read-only.

Alkalinity is not pH. At the R51 checkpoint Caelus did not resolve carbonate
species, dissolved-inorganic-carbon equilibrium, buffering feedbacks,
deep-ocean alkalinity exchange, measured concentrations or calibrated
watershed chemistry. R51 is a conservative capacity ledger with declared bulk
reaction stoichiometry.

## Rung 52: mixed-layer/deep-ocean alkalinity ownership

Caelus now extends the same CaCO3-equivalent capacity owner into the persistent
deep ocean. `axm.foundation-planet.deep-ocean-state/v2` owns dissolved deep
alkalinity, and `axm.foundation-planet.deep-ocean-exchange-receipt/v2` moves one
signed amount between the mixed layer and that deep owner using the existing
bounded concentration-gradient exchange depth. The sender is debited and the
receiver is credited in one commit; the receipt closes the combined
mixed-plus-deep residual. Physical exchange continues while Life is off, while
particle export, remineralization and burial retain their prior Life boundary.

New canonical deep-ocean state uses the same declared salinity-scaled 2,300
micromole/kg open-ocean reference as the mixed layer. This is a parameterized
initial condition, not a local observation. Treating total alkalinity as a
conservative mixing quantity follows NOAA PMEL's
[seawater carbonate-system guidance](https://www.pmel.noaa.gov/co2/files/dickson_thecarbondioxidesysteminseawater_equilibriumchemistryandmeasurementspp17-40.pdf);
NOAA NCEI's
[Guide to Best Practices for Ocean CO2 Measurements](https://www.ncei.noaa.gov/access/ocean-carbon-acidification-data-system/oceans/Handbook_2007/Guide_all_in_one.pdf)
defines the larger measurement and carbonate-system boundary that Caelus does
not claim to implement.

Ocean ecology state/flux v4 includes the deep owner in total alkalinity and
publishes the signed vertical amount beside its residual. Earth-system engine
v27 persists that lineage. The read-only system audit v2 adds a dedicated
`mixed-deep-ocean-alkalinity-ledger` check, and API v48 plus renderer-independent
experience capsules project the current owners and receipt without mutation
authority.

Restoring an R51 deep-ocean v1 checkpoint preserves its C/N/P/O2 reservoirs and
the already-owned mixed-layer alkalinity exactly, adds zero deep alkalinity,
marks an explicit migration checkpoint, and invalidates the obsolete vertical
receipt. It does not reconstruct historical deep alkalinity. Only a genuine
post-migration step can earn the v2 exchange evidence.

R52 still does not solve carbonate, bicarbonate, borate or minor acid-base
species; derive pH; equilibrate DIC and alkalinity; model calcium-carbonate
precipitation or dissolution; assimilate measured total alkalinity; resolve
benthic or hydrothermal alkalinity reactions; or claim three-dimensional ocean
circulation. The vertical exchange remains a bounded local bulk
parameterization.

### R52 continuity repair after the workspace move

Basin routing engine v22 adds a restore-only clock-alignment checkpoint for
browser saves whose committed Earth-transport clock and basin-routing clock
were persisted at different instants. On the first restored synchronization,
the committed Earth clock is authoritative: reach, floodplain, estuary,
sediment and chemistry material are preserved exactly; the basin clock is
aligned; and the stale latest routing receipt is invalidated. The checkpoint
records both prior clocks and the delta.

This is a one-shot state-continuity migration, not a material replay. It does
not reconstruct unobserved river transfers or claim that the intervening
period was simulated. Fresh state cannot invoke it, and a later clock mismatch
still throws. The step receipt remains v21 because the routing/material
contract itself did not change. API v48 exposes the checkpoint through
read-only `basinRoutingStatus()`.

The D-hosted live save also crossed the browser's raw `localStorage` quota at
about 5.69 million payload characters. World-state v2 commits are therefore
transactional: the in-memory revision changes only after storage accepts the
new envelope. When the readable JSON envelope does not fit, the same
checksummed envelope is stored through the explicit lossless
`lzw-uint16-base64` fallback and validated normally after decompression.
Compression is a storage encoding, not encryption. If both writes fail, the
prior revision remains authoritative and the UI/console report `SAVE FAILED`
instead of silently displaying an unpersisted revision.

## Rung 53: bounded mixed-layer carbonate equilibrium

Caelus now derives a read-only mixed-layer carbonate diagnostic from the
persistent dissolved-inorganic-carbon, CaCO3-equivalent total-alkalinity and
dissolved-inorganic-phosphorus owners plus mixed-layer depth, temperature and
salinity. The observer solves total-scale pH by a deterministic bracketed
alkalinity root and publishes CO2-star, bicarbonate and carbonate. Their sum
must reconstruct the input DIC; phosphate species must reconstruct the input
phosphorus; and the calculated alkalinity residual must close within the
declared tolerance. No carbon, phosphorus or alkalinity is created, moved or
owned by the diagnostic.
Depth is converted to solution mass with the declared 1,000 kg/m3 reference
density already used by the mixed-layer initialization; this is not a measured
or TEOS-10 density calculation.

The constant set is explicit: Lueker et al. (2000) carbonic-acid constants,
Dickson (1990) boric acid, Millero (1995) water and phosphoric-acid constants,
and the Lee et al. (2010) boron-to-salinity relationship, all at surface
pressure on the total hydrogen-ion scale. NOAA NCEI recommends the Lueker set
for open-ocean salinity 19–43 and 2–35 °C; Caelus therefore returns a typed
`OUTSIDE_CONSTANT_VALIDITY` non-solution outside that envelope instead of
clamping the water into it. See NOAA NCEI's
[OCADS carbonate-system guidance](https://www.ncei.noaa.gov/products/ocean-carbon-acidification-data-system),
the official
[Guide to Best Practices for Ocean CO2 Measurements](https://www.nodc.noaa.gov/media/pdf/oceanacidification/Dicksonetal2007_guide_all_in_one.pdf),
and the primary
[Lueker et al. study](https://doi.org/10.1016/S0304-4203(00)00022-0).

Ocean ecology state/flux v5 carries the current diagnostic and its source-owner
binding. Earth-system engine v28 migrates v27 columns by recomputing this
present-state observer while preserving all material owners and compatible
transport receipts. System audit v3 adds
`mixed-layer-carbonate-diagnostic`; API v49 and the live `Marine carbonate / pH`
row expose the same read-only result. The diagnostic is EXPERIMENTAL and its
parameterized DIC and alkalinity inputs are not observations.

R53 does not include dissolved silicate, fluoride, sulfide or ammonia alkalinity; deep
pressure corrections; deep-ocean pH; calcium ownership or calcite/aragonite
saturation; precipitation/dissolution kinetics; observation assimilation; or
pH feedback on biology and reactions. Those omissions stay machine-readable
in every diagnostic and audit result.

## Rung 54: carbonate-informed air-sea carbon exchange

R54 replaces the old empirical target-DIC carbon exchange with a pure
`axm.foundation-planet.air-sea-carbon-exchange-proposal/v1`. Before any owner
move, the proposal requires a solved R53 diagnostic whose DIC, alkalinity,
phosphorus, depth, temperature and salinity sources match the current ocean
state. It compares that diagnostic's actual CO2-star with the atmospheric
equilibrium CO2-star. A stale, unavailable or out-of-envelope diagnostic
produces a typed zero-carbon-flux result; oxygen exchange remains a separate
physical path.

The atmospheric side reuses the atmosphere-owned carbon compatibility mirror
as a dry-air ppm proxy, not a measurement. Seawater vapor pressure converts it
to wet-air pCO2. The [Weiss (1974) primary
paper](https://doi.org/10.1016/0304-4203(74)90015-2) supplies CO2 solubility
`K0` and the virial `B` term; the cross-virial correction and wet-air
construction follow NOAA NCEI's [NDP-047 calculation
procedure](https://www.ncei.noaa.gov/access/ocean-carbon-acidification-data-system/oceans/ndp_047/datacalc047.html).
The held 25 °C, salinity-35 value `ln(K0) = -3.5617` is checked against the
official [Guide to Best Practices for Ocean CO2
Measurements](https://www.ncei.noaa.gov/access/ocean-carbon-acidification-data-system/oceans/Handbook_2007/Guide_all_in_one.pdf).

Actual minus equilibrium CO2-star determines direction. Wind, open water and
duration supply the existing bounded bulk relaxation fraction; the proposal
converts the relaxed concentration difference through the declared 1,000
kg/m3 reference water mass and carbon molar mass. One signed amount is then
applied as an exactly paired atmosphere-to-DIC owner move, bounded by sender
availability. The receipt records the source diagnostic, wet and dry pressure,
pCO2, fCO2, solubility, disequilibrium, unbounded proposal, bounded proposal
and applied amount. System audit v4 recomputes those values and fails corrupted
fugacity, direction, bounds, owner application or carbon closure evidence.

Ocean ecology state/flux v6 migrates v5 without changing any C/N/P/O2 or
alkalinity owner and discards the old empirical v5 flux receipt. Earth-system
engine v29 migrates v28 while retaining compatible transport receipts. API v50
adds read-only `airSeaCarbonExchange()` and the live
`Air-sea CO2 equilibrium` row. R54 remains **EXPERIMENTAL**: there is no
measured atmospheric/ocean pCO2, measured ocean skin temperature, cool-skin or
warm-layer correction, scientifically calibrated piston velocity, or
species-resolved pH response. It is a bounded local process model, not a
scientific air-sea flux product.

## Rung 55: native phase-change thermal headroom

R55 repairs a preserved long-run atmosphere-energy failure without creating a
new material owner. Native condensation, deposition, evaporation, sublimation,
freezing and melting now ask the pure
`axm.foundation-planet.atmosphere-phase-thermal-envelope/v1` helper how much
latent heating or cooling fits between -120 and 70 °C before any water changes
phase. The supported mass moves with its full latent heat; unsupported requested
mass remains in its source phase. The pressure-column normalizer therefore no
longer has to silently discard heat after a material move.

Pressure dynamics v4 and its layer/precipitation and compatibility phase v3
receipts expose the number of thermal limits, the largest rejected request,
the declared envelope, and water/moist-enthalpy closure. Engine v30 migrates
v29 by preserving material, temperature and momentum owners, discarding legacy
phase receipts, and installing a neutral present-state atmosphere-energy
checkpoint. Audit v5 independently rejects out-of-envelope layers and malformed
native phase ledgers. API v51 shows the limit count and retained source-phase
mass in the existing `Cloud phase change` diagnostic.

The repair is **WORKING** within its held scope: the exact R54 ocean
counterexample reaches its old day-343 trigger during a 365-day run while the
maximum whole-atmosphere residual remains 0.005901 J/m², and a 432-step sweep
across 36 land/ocean locations and all condition profiles remains below
0.006682 J/m². This is not resolved cloud microphysics, upper-atmosphere
radiative chemistry, calibrated convection or a scientific forecast.

One distinct extreme stress remains **BROKEN** and is not hidden by R55: a
365-day land column under the same constant wet-storm boundary forcing reaches
a 207,978.797706 J/m² whole-atmosphere residual even though its native pressure
receipt itself closes below 0.00001 J/m². That separate compatibility/column
ledger failure remains counterevidence for a later repair; R55 does not claim
arbitrary long-run forcing closure.

## Rung 56: requested versus applied boundary energy

R56 resolves that preserved R55 counterexample without subtracting the observed
residual or expanding the native temperature envelope. The root cause was the
prescribed two-band boundary target requesting cooling that would place the
highest native pressure layer below -120 °C. Native reconciliation correctly
retained the layer at the declared minimum, but the whole-atmosphere ledger was
still charging the unachievable requested cooling instead of the energy change
actually applied to the authoritative eight-level column.

The typed
`axm.foundation-planet.atmosphere-boundary-energy-receipt/v1` now retains the
compatibility request, authoritative native initial and final moist enthalpy,
applied boundary change, initial/final compatibility projection adjustments,
and their explicit native-envelope reconciliation. The ledger charges the
applied native boundary energy while preserving the refused request as evidence.
It does not zero a checkpoint or claim that the boundary parameterization is a
scientific atmosphere model.

Engine v31 migrates v30 by preserving material, temperature and momentum owners
and valid R55 phase evidence while discarding unsupported historical R56
boundary-energy evidence into a labelled present-state checkpoint. Audit v6
independently checks the receipt identities, its embedded budget copy, envelope
limit evidence and the final water/surface/atmosphere ledgers. API v52 shows the
boundary-envelope energy beside the existing moist-enthalpy residual.

The repair is **WORKING** in its held scope. The exact 365-day constant wet-land
replay first encounters boundary-envelope reconciliation on day 215, retains a
maximum 207,978.793070 J/m² refused cooling adjustment, and keeps the maximum
whole-atmosphere residual to 0.006005 J/m². R55's original observation remains
part of the evidence trail; R56 changes its status from an unexplained
compatibility-ledger failure to an explicit requested-versus-applied boundary
receipt. This is still a bounded local process model, not a global circulation
model, scientific forecast, or calibrated upper-atmosphere boundary solver.

## Rung 57: scale-aware land subgrid mass closure

R57 resolves the intermittent live `basin-routing-receipt` and
`floodplain-plant-matter-receipts` failures that survived for an entire model
step. The land-to-floodplain debit compared carbon and nitrogen residuals with
a fixed 0.000001 kg (one milligram) limit even when its recorded operands were
tens or hundreds of billions of kilograms. Binary floating-point spacing at
that scale can be several milligrams, so an otherwise conservative debit could
be falsely marked open and then invalidate the basin receipt that carried it.

`axm.foundation-planet.land-ecology-subgrid-biomass-debit/v2` preserves the
measured carbon and nitrogen residuals and declares a reproducible numeric
policy: the greater of the one-milligram floor or eight IEEE-754 epsilon steps
at the largest recorded operand magnitude. System audit v7 recomputes that
bound from the receipt operands; a sender cannot inflate its own tolerance.
Basin engine v23 accepts only this current evidence. Its v22 migration retains
basin owners and clocks but discards the older v21 sender receipt rather than
promoting unsupported history.

The repair is **WORKING** within its held numeric scope. A deterministic
48-case Earth-cell sweep changed from 11 false failures to none; the largest
measured residue was 0.000061035 kg and the largest bound utilization was
11.9%. In the live browser, 48 repeated observations spanning two complete
model steps stayed at 26 pass / 0 fail / 4 not applicable. API v53 shows the
maximum sender residue and its independently auditable bound in milligrams.
This is a bounded floating-point accounting policy, not arbitrary-precision
arithmetic, ecological calibration or proof over every possible planet state.

## Rung 58: scale-aware floodplain plant-resource mass closure

R58 applies the same evidence discipline to the persistent floodplain plant
phosphorus and tissue-water owner. Its v1 transition receipt used a fixed
0.0000001 kg comparison for supported carbon, phosphorus and live tissue water.
At Earth-cell reservoir scale, an exactly conservative mortality transfer can
leave a representational residue larger than that floor; a 10-billion-kilogram
tissue-water fixture records 0.000000476837 kg and was therefore falsely marked
open.

`axm.foundation-planet.floodplain-plant-resources-receipt/v2` records the before,
transfer and after operands for every guild and for the aggregate receipt. Each
of the three material channels receives its own reproducible bound: the greater
of the 0.0000001 kg floor or eight IEEE-754 epsilon steps at the largest operand
magnitude in that channel. The measured residue remains visible. System audit
v8 independently recomputes every guild and aggregate identity and rejects an
inflated receipt-supplied tolerance. Basin engine v24 preserves v23 owners and
clocks but discards its older step-v22 receipt rather than inventing v2
plant-resource evidence.

The repair is **WORKING** within its held numeric scope. In a 150-case bounded
Earth-cell sweep, five conservative transitions exceeded the former fixed
floor and none exceeded the derived per-channel bound; the largest measured
residue was 0.000000476837 kg and maximum bound utilization was 3.36%. A wider
250-case adversarial representation sweep found 20 former fixed-floor failures
and no derived-bound failures. API v54 publishes the live maximum plant-resource
residue and bound. This does not claim arbitrary-precision accounting,
scientific plant calibration, or proof over every planet state.

## Rung 59: scale-aware floodplain plant-matter mass closure

R59 applies the same measured-residual policy to the persistent floodplain
plant carbon and nitrogen transition. Its v1 receipt judged each guild and the
aggregate owner against a fixed 0.0000001 kg limit. Large live,
standing-dead and litter pools can conserve material while ordinary binary
floating-point evaluation leaves a larger representational residue, so the
former comparison could falsely open the basin truth boundary.

`axm.foundation-planet.floodplain-plant-matter-receipt/v2` now records the
before, land-credit and after operands for carbon and nitrogen separately in
every guild and in the aggregate transition. The typed
`axm.foundation-planet.floodplain-plant-matter-mass-closure-policy/v1` bounds
each channel by the greater of the 0.0000001 kg floor or eight IEEE-754 epsilon
steps at its largest recorded operand. The measured residue is preserved.
System audit v9 independently recomputes the identities and bounds and rejects
an inflated receipt-supplied tolerance. Basin engine v25 retains v24 profiles,
material owners and clocks but discards its step-v23 evidence rather than
claiming that old evidence satisfies the v2 receipt contract.

The repair is **WORKING** within its held numeric scope. A deterministic
250-case standing-dead/litter representation sweep changed from 22 false
fixed-floor failures to no derived-bound failures. Its largest measured
residue was 0.000030517578 kg and maximum bound utilization was 12.19%.
API v55 publishes the live maximum plant-matter residue and bound beside the
land sender evidence. This does not claim arbitrary-precision accounting,
scientific plant calibration, or proof over every possible planet state.

## Rung 60: scale-aware floodplain detrital-return receiver closure

R60 repairs the persistent floodplain chemistry receiver at the other side of
resource-backed plant decomposition. The former v2 credit receipt compared its
aggregate carbon, total nitrogen, ammonium nitrogen and phosphorus identities
against fixed absolute floors. Large existing chemistry pools can conserve a
valid detrital credit while normal binary floating-point evaluation leaves a
larger measured residue, falsely opening the receiver boundary even though the
plant-matter sender, plant-resource sender and decomposition handoff remain
closed.

`axm.foundation-planet.floodplain-detrital-return-credit/v3` records separate
carbon, total-nitrogen, ammonium, unchanged-nitrate and phosphorus identities.
The typed
`axm.foundation-planet.floodplain-detrital-return-mass-closure-policy/v1`
derives each bound from that channel's recorded before, credit and after
operands using eight IEEE-754 epsilon steps, with the prior absolute floor as a
minimum. The receipt retains every measured residue and has no free-form
tolerance authority. System audit v10 independently recomputes the identities,
bounds, maximum residue and utilization, and rejects an inflated declared
bound. Basin engine v26 preserves v25 profiles, owners and clocks but discards
step-v24 evidence rather than relabelling the old receiver receipt as v3.

The repair is **WORKING** within its held numeric scope. A deterministic
250-case receiver representation sweep changed from 35 fixed-floor false
failures to no derived-bound failures. Its largest measured residue was
0.000164031982 kg and maximum bound utilization was 33.2%. API v56 publishes
the live maximum receiver residue and derived bound in milligrams. This does
not claim arbitrary-precision accounting, scientific decomposition
calibration, or proof over every possible planet state.

## Rung 61: scale-aware floodplain reaction receiver closure

R61 extends the same measured-residual discipline to the four persistent
floodplain chemistry reaction receivers: aerobic DOC mineralization,
denitrification, nitrification and bidirectional floodplain gas exchange. Their
former receipts applied fixed absolute comparisons to carbon, nitrogen,
ammonium, oxygen and alkalinity identities. At large stored-pool scales, a
conservative reaction could therefore retain an ordinary binary
floating-point residue above the fixed floor and falsely open the process and
basin truth boundaries.

The typed
`axm.foundation-planet.floodplain-reaction-mass-closure-policy/v1` derives a
separate bound for every recorded identity from that identity's own operands:
the greater of its declared material-channel floor or eight IEEE-754 epsilon
steps at the largest operand magnitude. Aerobic mineralization receipt v2,
denitrification reaction receipt v4, nitrification reaction receipt v3 and
floodplain gas-exchange receipt v3 retain the measured identities, per-identity
bounds, maximum residue and utilization. Their immediate process wrappers use
the same policy for plan-to-owner comparisons instead of reintroducing a fixed
threshold. System audit v11 independently reconstructs every identity and
rejects an inflated receipt-supplied bound. Basin engine v27 preserves v26
profiles, owners and clocks but discards step-v25 evidence rather than
inventing current reaction evidence.

The repair is **WORKING** within its held numeric scope. A deterministic
240-case sweep across all four reaction families changed from 54 fixed-floor
false failures to no derived-bound failures. Its largest measured residue was
0.00048828125 kg and maximum derived-bound utilization stayed below 11%. API
v57 publishes the live aggregate and per-reaction maximum residue, bound and
utilization. The atmosphere-side gas owner retains its separate existing
contract. R61 does not claim arbitrary-precision accounting, calibrated
reaction kinetics, mechanistic microbial ecology or proof over every possible
planet state.

## Rung 62: scale-aware atmosphere gas-exchange owner closure

R62 repairs the separate native-atmosphere owner used by paired floodplain gas
exchange. That owner mutates per-square-meter native-layer reservoirs but proves
its carbon and oxygen identities after scaling them to the receiving area's
total kilograms. Its former fixed 0.001 kg comparison could therefore reject a
conservative move solely because ordinary binary floating-point residue grows
with a very large operand scale.

`axm.foundation-planet.atmosphere-floodplain-gas-exchange-mass-closure-policy/v1`
now derives carbon and oxygen bounds independently as the greater of the
existing 0.001 kg material floor or eight IEEE-754 epsilon steps at the largest
recorded total-kilogram operand. Atmosphere gas-exchange receipt v3 records the
before, credit, debit and after operands, measured residuals, per-identity
bounds, maximum residual and utilization. Atmosphere state v4 and gas-process
state/receipt v3 preserve material and cumulative process memory while dropping
older receipts rather than relabelling them. Basin engine v28 and step v27 bind
the new owner evidence, and system audit v12 reconstructs both identities and
rejects inflated receipt-supplied bounds.

The repair is **WORKING** within its held numeric scope. A deterministic
105-case sweep across seven receiving-area scales, five exchange fractions and
three transfer directions changed from 23 fixed-floor false failures to no
derived-bound failures. The deliberately extreme sweep retained a largest
measured residue of 262,144 kg while maximum derived-bound utilization stayed
below 12%. API v58 publishes separate live water-owner and atmosphere-owner
residue/bound telemetry. R62 does not claim arbitrary-precision accounting,
scientific gas-transfer calibration, a resolved air-water interface, proof over
every possible planet state, promotion or canonization.

## Rung 63: scale-aware geomorphic sediment transfer closure

R63 repairs the five persistent absolute-kilogram transfer owners in the
finite geomorphic sediment cycle: runoff sender debit, runoff receiver credit,
river input credit, river route sender/bed partition, and coastal input
partition. Their former fixed 0.0000001 kg comparison could reject a
conservative transfer once area conversion or a large persistent reservoir
made ordinary binary floating-point residue exceed that fixed floor.

`axm.foundation-planet.geomorphic-sediment-transfer-mass-closure-policy/v1`
now derives a separate clay, silt, sand and gravel bound for every identity as
the greater of the existing 0.0000001 kg floor or eight IEEE-754 epsilon steps
at that identity and grain's largest recorded operand. Runoff queue, river and
coastal state plus their transfer receipts advance to v2. Each receipt retains
the unrounded operands, measured residuals, derived per-grain bounds, maximum
residual and maximum utilization. River routes additionally prove the
persistent bed credit and requested-load partition; coastal credits prove the
input partition. Surface erosion remains on its separate kg/m2 ledger.

Earth engine v32, transport step v12, basin engine v29 and basin step v28 carry
the current evidence. Their migrations preserve owned mineral reservoirs,
cumulative movement and clocks while dropping older fixed-threshold receipts;
they never manufacture historical numeric closure. System audit v13
independently reconstructs every sediment identity and declared bound, so an
inflated receipt-supplied tolerance fails even when its measured residue is
unchanged. API v59 publishes the typed policy plus aggregate measured residual,
bound and utilization telemetry.

The repair is **WORKING** within its held numeric scope. A deterministic
150-case discovery sweep across six scales, five fractions and all five owner
families changed from 72 fixed-floor false failures to no derived-bound
failures. It preserved a largest measured residual of 136,445,952 kg while the
worst bound utilization remained below 7.5%. The maintained self-test repeats
150 cross-family cases, includes the bed and coastal partition identities, and
rejects tolerance inflation. R63 does not claim arbitrary-precision
accounting, scientific erosion or transport calibration, resolved channel or
coastal morphodynamics, a continuously active global sediment network, proof
over every possible planet state, promotion or canonization.

## Rung 64: scale-aware coupled basin aggregate closure

R64 replaces the coupled basin ledger's fixed one-kilogram-only decision with
`axm.foundation-planet.basin-aggregate-mass-closure-policy/v1`. The retained
one-kilogram floor still catches material imbalance at ordinary scales, while
each of the twelve water, chemistry, plant-matter and grain-sediment identities
may derive a larger IEEE-754 bound only from the sum of its own unrounded signed
kilogram operands. Measured residuals are preserved; they are never zeroed,
clamped or synthesized from the bound.

Basin engine v30 and step receipt v29 record those operands, residuals,
per-identity bounds, closure results and aggregate maximum residual, bound and
utilization. The v29-to-v30 migration preserves reach-owned material and clocks
but discards v28 receipts instead of inventing R64 evidence. System audit v14
independently reconstructs every signed sum and bound and rejects altered
operands or tolerance inflation. API v60 exposes the typed policy and live
aggregate telemetry, including the visible River-routing residual-versus-bound
diagnostic.

The repair is **WORKING** within that numeric scope. Its deterministic 150-case
reproduction spans all twelve operand-count shapes: all 150 mathematically
zero planetary-scale sums fail the old fixed one-kilogram decision, while all
150 close under the derived policy with their measured binary residue intact.
R64 does not claim arbitrary-precision accounting, proof over every planet
state, a continuously active global basin network, scientific calibration,
promotion or canonization.

## Why there are two render scales

A real-scale planet cannot render individual trees and a globe-sized continent mesh in one stable coordinate space. Caelus keeps one global latitude/longitude truth and renders it through two views:

1. Orbital view samples the complete planet into a bounded globe representation.
2. Surface view streams a local tangent sector in kilometers around the active expedition.

Games can eventually request smaller, higher-detail sectors without changing the global coordinate or terrain model. Distant populations can remain statistical; nearby populations can become individual simulated organisms.

## Living Globe knowledge carried forward

The original globe established seeded randomness, growth clocks, organism condition, crowding pressure, mortality boundaries, local persistence, a true day/night relationship and world-owned state. This foundation keeps those principles, but treats naturally occurring populations as deterministic sector data rather than permanent objects around one tiny sphere. Planting, chopping, fire and other interventions belong in a governed world-action adapter; they are not silently granted to every game.

## Controls

- Orbital: drag to rotate, wheel to change altitude, double-click a location to deploy.
- Surface: click the world to capture the mouse, use W/A/S/D to move, look with the mouse or arrow keys, hold Shift for fast traversal, and press Escape to release the cursor. If pointer lock is unavailable, click-drag remains available. Mouse look follows the conventional direction: right turns right and up looks up.
- Use **Find viable land** or **Relocate expedition** to stream another habitable sector.
- Use **Follow water** for a computed river reach or **Survey ocean** for a productive marine sector.
- Use the left console to change condition profiles and toggle systems independently.

## Extension rules

- The global coordinate model and world seed are world-owned foundation state.
- Games attach as rulesets or governed adapters. They may not own or reset the planet.
- Condition profiles alter climate, water and habitability without replacing planet identity.
- Earth-system columns keep condition-specific water and heat history while preserving the same coordinate and world lineage.
- The species catalog adds organisms by habitat requirements and behavior modules; species are no longer hard-coded into the renderer.
- Global simulation should remain hierarchical: planet statistics → regional populations → local individuals.
- Physics attaches at the active-sector scale through the v1 floating-origin frame. A future rigid-body engine must not require simulating the whole planet as one scene.
- Multiplayer controllers emit bounded `axm.controller-input/v1` intent. The host authority kernel owns canonical movement and the Living World service owns persistence.
- Named-world creation and attachment are explicit permission-gated operations; the planet never silently promotes browser state into shared truth.

See `docs/FOUNDATION_CONTRACT.md` for the coordinate, layer and future adapter contract.

## Honest limits

This is an exploratory procedural world model, not a scientific Earth simulator. Terrain, climate, tectonics, drainage and ecology are plausible abstractions. The loaded river network has persistent cross-scale routing, ocean-mouth receipts, a finite clay/silt/sand/gravel material cycle and conservative reach-scale floodplain storage, but no global depression filling, endorheic spill rules, resolved two-dimensional inundation, levee or bank-failure dynamics, resolved channel/coastal morphodynamics or continuously active global sediment network. Groundwater exchanges between loaded neighbors but has no three-dimensional aquifer geometry, plate provinces are not a full crustal dynamics solver, and soils have no chemistry horizons yet. Loaded atmosphere cells persist eight pressure levels with per-level dry-air mass, water tracers, sensible heat, tangent momentum, kinetic energy and hydrostatic geometry plus seven pressure-interface convective-energy and compensating-momentum states. Native level saturation, phase change, cloud reservoirs, precipitation descent, adjacent vertical exchange, interface buoyancy and loaded lateral transport are implemented and receipted. Atmosphere-owned C/O2/N2 state closes biosphere exchange, receives estuary nitrogen and is conservatively carried across loaded native dry-air routes, but it has no global mixing, continuous unloaded-cell circulation or resolved atmospheric chemistry. Paired floodplain-atmosphere exchange now moves CO2 carbon in either concentration-gradient direction and reaerates oxygen, but it remains a bounded temperature-aware proxy without pH, alkalinity, carbonate speciation, resolved turbulence or scientific calibration. Horizontal terrain adjustment and bounded interface overturning expose geopotential, pressure, buoyancy and kinetic-conversion work rather than hiding it. Native liquid/ice cloud paths drive bounded broadband shortwave/longwave feedback, and native-layer CO2 now adds a reference-relative, temperature-path-aware grey-gas adjustment to the surface ledger; aged land snow, snow on sea ice, sea-ice mass and surface fusion energy persist. This is not spectral, line-by-line or scientifically validated radiative transfer and does not resolve droplet/crystal size distributions, snow grains, brine, leads, ridging or dynamic ice motion. The atmosphere still has no global angular-momentum solve, resolved three-dimensional plumes, continuous unloaded-cell upper-air circulation, resolved aerosol/droplet/ice microphysics, turbulence closure, global circulation or ocean-current solver. There is also no general rigid-body engine, automatically running shared host, active multiplayer session, complete species catalog, individual animal AI or interiors yet. The host and controller paths are explicit contracts and tested local services, not an always-on production world.
