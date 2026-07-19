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

## Rungs 2–3: physical history and ecological scale

The second and third rungs add deterministic plate provinces, bedrock, soils, erosion signals, watershed drainage, visible freshwater, a versioned species catalog, local community assembly and a statistical regional food web beneath the visible individual tier. `Follow water` relocates a surface expedition to the nearest computed river reach. Physical geology/hydrology and all living tiers remain independently controllable.

## Rung 4: seasons, weather and persistent ecology

Axial tilt and latitude now drive season, solar declination, daylight and seasonal temperature. Deterministic local weather cells expose pressure, wind, humidity, cloud, precipitation type and intensity, snowpack, drought, lightning and fire risk. Loaded regional populations advance with births, natural mortality, predation pressure, carrying capacity and migration. Up to 100 visited sector-dynamics records persist in the browser save, including fires, recovery and explicitly governed intervention history.

## Rung 5: ecological breadth and marine expeditions

The catalog now spans 96 archetypes across land, freshwater and ocean food webs. Regional populations track juvenile, adult and senescent cohorts using catalog maturity, lifespan and reproduction strategy, while community diagnostics report only the realms occupied at the current coordinate. `Survey ocean` deploys directly into a productive marine sector with water-specific survey metrics, nearby swimming fauna, primary producers and decomposer activity. The master Life control makes every terrestrial and marine living tier dormant without pausing physical water, atmosphere or geology.

## Rung 6: continuous water, physics coordinates and revisioned state

Hydrology now samples a planet-anchored global grid through buffered canonical tiles. A river reach owns one stable `hydro-reach:v2:<grid-x>:<grid-z>` identity, canonical endpoints and a downstream reach link, regardless of which overlapping expedition sector requests it. Loaded sectors report explicit edge handoffs instead of silently terminating water at the render boundary. Catchment area, runoff, discharge, width, depth and stream order remain procedural approximations; depression filling and sediment transport are still future work.

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

The coarse topographic Earth-cell route remains as a fallback for queued water that has no loaded canonical river inlet. Rung 11 is therefore a conservative loaded-basin bridge, not a claim that every global basin is continuously active. A planet-wide depression-filled graph, endorheic spill behavior, floodplains, sediment and channel morphology remain later work.

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

## Why there are two render scales

A real-scale planet cannot render individual trees and a globe-sized continent mesh in one stable coordinate space. Caelus keeps one global latitude/longitude truth and renders it through two views:

1. Orbital view samples the complete planet into a bounded globe representation.
2. Surface view streams a local tangent sector in kilometers around the active expedition.

Games can eventually request smaller, higher-detail sectors without changing the global coordinate or terrain model. Distant populations can remain statistical; nearby populations can become individual simulated organisms.

## Living Globe knowledge carried forward

The original globe established seeded randomness, growth clocks, organism condition, crowding pressure, mortality boundaries, local persistence, a true day/night relationship and world-owned state. This foundation keeps those principles, but treats naturally occurring populations as deterministic sector data rather than permanent objects around one tiny sphere. Planting, chopping, fire and other interventions belong in a governed world-action adapter; they are not silently granted to every game.

## Controls

- Orbital: drag to rotate, wheel to change altitude, double-click a location to deploy.
- Surface: click the world to capture the mouse, use W/A/S/D to move, hold Shift for fast traversal, press Escape to release the cursor.
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

This is an exploratory procedural world model, not a scientific Earth simulator. Terrain, climate, tectonics, drainage and ecology are plausible abstractions. The loaded river network now has persistent cross-scale routing and ocean-mouth receipts, but no global depression filling, endorheic spill rules, floodplain dynamics, channel morphology or long-term sediment transport. Groundwater exchanges between loaded neighbors but has no three-dimensional aquifer geometry, plate provinces are not a full crustal dynamics solver, and soils have no chemistry horizons yet. Loaded atmosphere cells now conserve dry-air mass, carried tangent momentum and kinetic energy around explicit pressure and Coriolis terms, and carry a conservative bounded two-layer vertical exchange; they still have no global angular-momentum solve, resolved three-dimensional convection, buoyancy/gravitational-work ledger, upper-air horizontal transport, cloud microphysics, turbulence closure, global circulation or ocean-current solver. There is also no general rigid-body engine, automatically running shared host, active multiplayer session, complete species catalog, individual animal AI or interiors yet. The host and controller paths are explicit contracts and tested local services, not an always-on production world.
