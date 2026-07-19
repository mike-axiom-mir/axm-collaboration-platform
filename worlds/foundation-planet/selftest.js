'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const childProcess = require('child_process');
const { pathToFileURL } = require('url');

const root = __dirname;
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const manifest = JSON.parse(read('world.manifest.json'));
const registry = JSON.parse(fs.readFileSync(path.join(root, '..', 'world-registry.json'), 'utf8'));

async function run() {
  const model = await import(pathToFileURL(path.join(root, 'core', 'planet-model.mjs')).href);
  const livingModule = await import(pathToFileURL(path.join(root, 'core', 'living-system.mjs')).href);
  const layerModule = await import(pathToFileURL(path.join(root, 'core', 'layer-system.mjs')).href);
  const geophysics = await import(pathToFileURL(path.join(root, 'core', 'geophysics.mjs')).href);
  const hydrology = await import(pathToFileURL(path.join(root, 'core', 'hydrology-model.mjs')).href);
  const speciesCatalog = await import(pathToFileURL(path.join(root, 'core', 'species-catalog.mjs')).href);
  const communityModel = await import(pathToFileURL(path.join(root, 'core', 'community-model.mjs')).href);
  const seasonalWeather = await import(pathToFileURL(path.join(root, 'core', 'seasonal-weather.mjs')).href);
  const earthSystem = await import(pathToFileURL(path.join(root, 'core', 'earth-system.mjs')).href);
  const earthTransport = await import(pathToFileURL(path.join(root, 'core', 'earth-transport.mjs')).href);
  const basinRouting = await import(pathToFileURL(path.join(root, 'core', 'basin-routing.mjs')).href);
  const ecosystemDynamics = await import(pathToFileURL(path.join(root, 'core', 'ecosystem-dynamics.mjs')).href);
  const physicsContract = await import(pathToFileURL(path.join(root, 'core', 'physics-contract.mjs')).href);
  const worldStateModule = await import(pathToFileURL(path.join(root, 'core', 'world-state.mjs')).href);
  const hostProtocol = await import(pathToFileURL(path.join(root, 'core', 'host-protocol.mjs')).href);
  const worldAuthority = await import(pathToFileURL(path.join(root, 'core', 'world-authority.mjs')).href);
  const setAtmospherePressure = (column, surfacePressureHpa) => {
    column.atmosphere.surfacePressureHpa = surfacePressureHpa;
    column.atmosphere.boundaryLayerPressureHpa = surfacePressureHpa * .25;
    column.atmosphere.freeTroposphere.pressureThicknessHpa = surfacePressureHpa * .75;
  };
  const html = read('index.html'), app = read('app.mjs'), styles = read('styles.css');
  const server = fs.readFileSync(path.join(root, '..', '..', 'server.js'), 'utf8');
  const operationsApi = fs.readFileSync(path.join(root, '..', '..', 'shared', 'operations', 'operations-api.js'), 'utf8');
  const multiworldService = fs.readFileSync(path.join(root, '..', '..', 'shared', 'operations', 'multiworld-state-service.js'), 'utf8');

  assert.equal(manifest.id, 'world.axm.foundation-planet');
  assert.equal(manifest.version, '0.15.0');
  assert.equal(manifest.scale.logical_radius_m, 6371000);
  assert.equal(manifest.scale.surface_streaming, true);
  assert.equal(manifest.scale.surface_focus_km, 3);
  assert.equal(manifest.scale.earth_system_cell_degrees, 0.25);
  assert.equal(manifest.scale.maximum_persisted_earth_system_columns, 32);
  assert.equal(manifest.runtime.remote_dependencies, false);
  assert.equal(manifest.ownership.state_owner, 'foundation-planet');
  assert.equal(manifest.ownership.games_may_own_world, false);
  assert.equal(manifest.ownership.games_may_reset_world, false);
  assert.equal(manifest.layers.living_master_toggle, true);
  assert.deepEqual(manifest.layers.living, ['vegetation', 'fauna', 'decomposers']);
  assert.equal(manifest.systems.replaceable_condition_profiles, true);
  assert.equal(manifest.systems.tectonic_plate_provinces, true);
  assert.equal(manifest.systems.local_watershed_drainage, true);
  assert.equal(manifest.systems.species_catalog, true);
  assert.equal(manifest.systems.regional_population_estimates, true);
  assert.equal(manifest.systems.axial_tilt_seasons, true);
  assert.equal(manifest.systems.persistent_visited_sector_dynamics, true);
  assert.equal(manifest.systems.regional_age_cohorts, true);
  assert.equal(manifest.systems.terrestrial_freshwater_marine_realms, true);
  assert.equal(manifest.systems.freshwater_and_marine_catalog, true);
  assert.equal(manifest.systems.stable_cross_sector_river_reach_ids, true);
  assert.equal(manifest.systems.explicit_river_boundary_handoffs, true);
  assert.equal(manifest.systems.revisioned_world_state_envelope, true);
  assert.equal(manifest.systems.floating_origin_physics_frame, true);
  assert.equal(manifest.systems.isolated_named_world_host, true);
  assert.equal(manifest.systems.authoritative_expected_revision_host_patches, true);
  assert.equal(manifest.systems.canonical_sector_subscriptions, true);
  assert.equal(manifest.systems.authoritative_multiplayer_movement_kernel, true);
  assert.equal(manifest.systems.controller_sequence_replay_protection, true);
  assert.equal(manifest.systems.bounded_default_multiplayer_participants, 8);
  assert.equal(manifest.systems.stateful_sparse_earth_system_columns, true);
  assert.equal(manifest.systems.locally_conservative_water_budget, true);
  assert.equal(manifest.systems.locally_conservative_surface_energy_budget, true);
  assert.equal(manifest.systems.groundwater_recharge_capillary_rise_and_baseflow, true);
  assert.equal(manifest.systems.ocean_mixed_layer_heat_and_salinity, true);
  assert.equal(manifest.systems.thermodynamic_sea_ice_state, true);
  assert.equal(manifest.systems.seasonal_discharge_from_earth_system_fluxes, true);
  assert.equal(manifest.systems.canonical_cardinal_neighbor_transport_graph, true);
  assert.equal(manifest.systems.area_weighted_conservative_lateral_exchange, true);
  assert.equal(manifest.systems.atmospheric_moisture_and_heat_exchange, true);
  assert.equal(manifest.systems.surface_pressure_dry_air_column_mass, true);
  assert.equal(manifest.systems.loaded_neighbor_dry_air_mass_exchange, true);
  assert.equal(manifest.systems.dry_air_carried_vector_momentum_transport, true);
  assert.equal(manifest.systems.receipted_loaded_pressure_gradient_forcing, true);
  assert.equal(manifest.systems.rotation_aware_coriolis_deflection, true);
  assert.equal(manifest.systems.atmospheric_kinetic_energy_ledger, true);
  assert.equal(manifest.systems.receipted_momentum_mixing_dissipation, true);
  assert.equal(manifest.systems.atmospheric_water_vapor_and_cloud_liquid_reservoirs, true);
  assert.equal(manifest.systems.receipted_condensation_cloud_evaporation_and_precipitation, true);
  assert.equal(manifest.systems.latent_heat_coupled_atmospheric_phase_change, true);
  assert.equal(manifest.systems.atmospheric_moist_enthalpy_ledger, true);
  assert.equal(manifest.systems.loaded_neighbor_cloud_liquid_transport, true);
  assert.equal(manifest.systems.atmospheric_moist_enthalpy_transport_conservation, true);
  assert.equal(manifest.systems.boundary_layer_and_free_troposphere_reservoirs, true);
  assert.equal(manifest.systems.hydrostatic_vertical_pressure_partition, true);
  assert.equal(manifest.systems.free_troposphere_vapor_cloud_phase_change, true);
  assert.equal(manifest.systems.receipted_conservative_vertical_atmosphere_exchange, true);
  assert.equal(manifest.systems.vertical_atmosphere_water_and_moist_enthalpy_closure, true);
  assert.equal(manifest.systems.hydraulic_head_groundwater_exchange, true);
  assert.equal(manifest.systems.ocean_freshwater_and_mixed_layer_heat_exchange, true);
  assert.equal(manifest.systems.explicit_sparse_transport_boundary_receipts, true);
  assert.equal(manifest.systems.order_invariant_simultaneous_transport, true);
  assert.equal(manifest.systems.atmospheric_precipitation_evaporation_mass_closure, true);
  assert.equal(manifest.systems.atmospheric_moisture_limited_precipitation, true);
  assert.equal(manifest.systems.persistent_runoff_routing_queue, true);
  assert.equal(manifest.systems.topographic_loaded_neighbor_runoff_routing, true);
  assert.equal(manifest.systems.coastal_runoff_freshens_ocean_mixed_layer, true);
  assert.equal(manifest.systems.unresolved_downstream_water_is_retained, true);
  assert.equal(manifest.systems.earth_cell_runoff_to_canonical_river_inlets, true);
  assert.equal(manifest.systems.persistent_canonical_river_reach_storage, true);
  assert.equal(manifest.systems.simultaneous_loaded_reach_routing, true);
  assert.equal(manifest.systems.receipted_loaded_ocean_mouth_delivery, true);
  assert.equal(manifest.systems.unloaded_river_handoff_water_is_retained, true);
  assert.equal(manifest.runtime.physics, 'FLOATING_ORIGIN_SECTOR_FRAME_V1');
  assert.equal(manifest.runtime.earth_system, 'TWO_LAYER_MOIST_ROTATING_ATMOSPHERE_BASIN_MOMENTUM_V1');
  assert.equal(manifest.truth.scientific_earth_model, false);
  assert.equal(manifest.truth.canonical_living_globe_unchanged, true);
  assert.equal(manifest.truth.authoritative_host_seam_implemented, true);
  assert.equal(manifest.truth.automatic_host_attachment, false);
  assert.equal(manifest.truth.runtime_multiplayer_session, false);
  assert.equal(manifest.truth.global_circulation_model, false);
  assert.equal(manifest.truth.local_water_energy_column_model, true);
  assert.equal(manifest.truth.sparse_neighbor_transport_model, true);
  assert.equal(manifest.truth.lateral_transport_conservation_checked, true);
  assert.equal(manifest.truth.loaded_tangent_atmosphere_momentum_ledger, true);
  assert.equal(manifest.truth.loaded_rotation_aware_coriolis_model, true);
  assert.equal(manifest.truth.atmospheric_kinetic_energy_conservation_checked, true);
  assert.equal(manifest.truth.single_layer_cloud_phase_change_model, false);
  assert.equal(manifest.truth.two_layer_cloud_phase_change_model, true);
  assert.equal(manifest.truth.atmospheric_moist_enthalpy_conservation_checked, true);
  assert.equal(manifest.truth.resolved_cloud_microphysics, false);
  assert.equal(manifest.truth.vertical_convection_model, false);
  assert.equal(manifest.truth.bounded_two_layer_vertical_exchange, true);
  assert.equal(manifest.truth.resolved_three_dimensional_convection, false);
  assert.equal(manifest.truth.buoyancy_and_gravitational_work_resolved, false);
  assert.equal(manifest.truth.upper_air_horizontal_transport, false);
  assert.equal(manifest.truth.global_angular_momentum_model, false);
  assert.equal(manifest.truth.atmospheric_transport_coupled_to_local_precipitation_budget, true);
  assert.equal(manifest.truth.runoff_discarded_at_sparse_boundary, false);
  assert.equal(manifest.truth.global_river_to_ocean_network, false);
  assert.equal(manifest.truth.loaded_canonical_basin_routing, true);
  assert.equal(manifest.truth.river_water_discarded_at_unloaded_handoff, false);
  assert.equal(registry.worlds.filter(world => world.id === manifest.id).length, 1, 'foundation planet registered exactly once');
  assert.equal(registry.worlds.filter(world => world.id === 'world.grafthold.globe').length, 1, 'original living globe remains registered');

  assert.ok(html.includes('id="lifeMaster"'), 'living master UI');
  assert.ok(html.includes('id="profileSelect"'), 'replaceable condition UI');
  assert.ok(html.includes('id="riverHandoffs"') && html.includes('id="physicsFrame"') && html.includes('id="persistenceRevision"') && html.includes('id="hostAuthority"'), 'continuity, physics, persistence and host diagnostics');
  assert.ok(html.includes('id="earthCell"') && html.includes('id="waterBudget"') && html.includes('id="energyBudget"') && html.includes('id="seaIce"'), 'Earth-system reservoirs and conservation are visible');
  assert.ok(html.includes('id="transportDomain"') && html.includes('id="transportWater"') && html.includes('id="transportClosure"'), 'neighbor transport graph and conservation are visible');
  assert.ok(html.includes('id="atmosphereWater"') && html.includes('id="runoffQueue"') && html.includes('id="runoffDestination"'), 'closed atmospheric water and runoff routing are visible');
  assert.ok(html.includes('id="channelStorage"') && html.includes('id="channelClosure"') && html.includes('id="riverMouth"'), 'persistent channel storage, routing closure, and ocean-mouth receipts are visible');
  assert.ok(html.includes('id="airMassRoute"') && html.includes('id="momentumClosure"'), 'dry-air transport and tangent-momentum closure are visible');
  assert.ok(html.includes('id="rotationDeflection"') && html.includes('id="kineticClosure"'), 'Coriolis deflection and atmospheric kinetic-energy closure are visible');
  assert.ok(html.includes('id="cloudPhaseChange"') && html.includes('id="verticalAtmosphere"') && html.includes('id="convectiveExchange"') && html.includes('id="moistEnthalpyClosure"'), 'two-layer phase, vertical exchange and moist-enthalpy closure are visible');
  assert.ok(app.includes("from '/shared/vendor/three-r160/three.module.js'"), 'local Three.js renderer');
  assert.ok(app.includes('window.AXMFoundationPlanet'), 'read-only world API');
  assert.ok(app.includes('SURFACE_SIZE_KM = 120'), 'bounded local surface stream');
  assert.ok(app.includes('buildHydrologySector'), 'hydrology is integrated into surface streaming');
  assert.ok(app.includes('EarthSystemEngine') && app.includes('coupleHydrologyToEarthSystem') && app.includes('earthSystemColumn'), 'stateful Earth system is integrated into runtime, rivers and read API');
  assert.ok(app.includes('transportEarthSystemColumns') && app.includes('synchronizeEarthTransportDomain') && app.includes('earthTransportDescription'), 'canonical neighbor transport is integrated into runtime and read API');
  assert.ok(app.includes("AXMFoundationPlanet/v11") && app.includes('lastVerticalExchangeReceipt') && app.includes('lastBasinRoutingReceipt') && app.includes('basinRoutingDescription'), 'Rung 15 two-layer atmosphere, vertical exchange and basin receipts are exposed by the live API');
  assert.ok(app.includes('conditionTransitioning') && app.includes('if (conditionTransitioning && !force) return'), 'condition replacement cannot mix a new profile ID with the previous surface sample');
  assert.ok(app.includes('probeFoundationHost') && app.includes('proposeHostBootstrap') && app.includes('createSectorSubscription'), 'read-only API exposes explicit named-host proposals and sector subscriptions');
  assert.ok(operationsApi.includes("'/api/living-worlds'") && operationsApi.includes("'/api/living-world/create'"), 'Workshop exposes named-world catalog and explicit creation endpoints');
  assert.ok(multiworldService.includes("const CREATE_SCHEMA = 'axm.living-world.create/v1'") && multiworldService.includes("if (worldId === 'living-globe')"), 'multiworld service preserves the Living Globe compatibility slot');
  assert.ok(!/https?:\/\//.test(html + app + styles), 'no remote runtime dependency');
  assert.ok(!/Math\.random\(/.test(app + read('core/planet-model.mjs') + read('core/living-system.mjs')), 'world generation avoids unseeded randomness');
  assert.ok(/["']\.mjs["']\s*:\s*["']text\/javascript; charset=utf-8["']/.test(server), 'Workshop serves planet modules with JavaScript MIME');

  ['app.mjs', 'core/planet-model.mjs', 'core/layer-system.mjs', 'core/living-system.mjs', 'core/geophysics.mjs', 'core/hydrology-model.mjs', 'core/species-catalog.mjs', 'core/community-model.mjs', 'core/seasonal-weather.mjs', 'core/earth-system.mjs', 'core/earth-transport.mjs', 'core/basin-routing.mjs', 'core/ecosystem-dynamics.mjs', 'core/physics-contract.mjs', 'core/world-state.mjs', 'core/host-protocol.mjs', 'core/world-authority.mjs'].forEach(file => {
    childProcess.execFileSync(process.execPath, ['--check', path.join(root, file)], { stdio: 'pipe' });
  });

  const a = model.sampleLatLon(31.25, -42.75, { profile: 'temperate', seed: model.PLANET_DEFAULTS.seed });
  const b = model.sampleLatLon(31.25, -42.75, { profile: 'temperate', seed: model.PLANET_DEFAULTS.seed });
  assert.deepEqual(a, b, 'terrain and climate sampling are deterministic');
  assert.ok(Number.isFinite(a.elevationM) && Number.isFinite(a.temperatureC), 'sample exposes physical values');
  assert.ok(a.geology && /^plate-/.test(a.geology.plateId), 'sample exposes tectonic province');
  assert.ok(a.geology.bedrock && Number.isFinite(a.geology.soilDepthM), 'sample exposes bedrock and soil');
  assert.ok(Number.isFinite(a.annualPrecipMm), 'sample exposes precipitation');
  assert.ok(model.CONDITION_PROFILES.barren.lifeAbundance === 0, 'barren conditions disable natural life without replacing model');
  assert.ok(Object.keys(model.CONDITION_PROFILES).length >= 5, 'multiple condition profiles');

  const biomes = new Set(); let land = 0;
  for (let i = 0; i < 2000; i++) {
    const y = 1 - i / 1999 * 2, radius = Math.sqrt(Math.max(0, 1 - y * y));
    const angle = Math.PI * (3 - Math.sqrt(5)) * i;
    const sample = model.sampleVector({ x: Math.cos(angle) * radius, y, z: Math.sin(angle) * radius });
    biomes.add(sample.biome); if (sample.land) land++;
  }
  assert.ok(land / 2000 > .2 && land / 2000 < .55, 'planet has plausible mixed land/ocean coverage');
  ['deep_ocean', 'ocean', 'desert', 'grassland', 'temperate_forest', 'taiga', 'alpine', 'ice'].forEach(biome => assert.ok(biomes.has(biome), `global samples include ${biome}`));

  const livingA = new livingModule.LivingSystem({ seed: 72, profileId: 'temperate' }).buildSector(12, 14);
  const livingB = new livingModule.LivingSystem({ seed: 72, profileId: 'temperate' }).buildSector(12, 14);
  assert.deepEqual(livingA, livingB, 'living sector generation is deterministic');
  assert.ok(livingA.vegetation.every(item => Number.isFinite(item.lat) && Number.isFinite(item.lon)), 'organisms retain canonical coordinates');
  const barren = new livingModule.LivingSystem({ seed: 72, profileId: 'barren' }).buildSector(12, 14);
  assert.equal(barren.vegetation.length, 0, 'barren profile generates no natural vegetation');

  const memoryStore = { value: null, getItem() { return this.value; }, setItem(_key, value) { this.value = value; } };
  const layerSystem = new layerModule.LayerSystem({ storage: memoryStore });
  assert.equal(layerSystem.enabled('vegetation'), true);
  layerSystem.setLiving(false, 'selftest');
  assert.equal(layerSystem.enabled('vegetation'), false);
  assert.equal(layerSystem.enabled('fauna'), false);
  assert.equal(layerSystem.enabled('decomposers'), false);
  assert.equal(layerSystem.enabled('terrain'), true);
  assert.equal(layerSystem.enabled('geology'), true);
  assert.equal(layerSystem.enabled('groundwater'), true);
  assert.equal(layerSystem.enabled('cryosphere'), true);
  assert.equal(layerSystem.set('groundwater', false, 'selftest'), true, 'groundwater view can be hidden independently of hydrology');
  assert.equal(layerSystem.enabled('hydrology'), true, 'groundwater visibility does not disable surface water');
  assert.equal(layerSystem.set('terrain', false, 'selftest'), false, 'terrain substrate cannot be disabled');

  const catalog = speciesCatalog.catalogDescription();
  assert.equal(catalog.entryCount, 96, 'expanded species catalog size');
  assert.deepEqual(catalog.counts, { vegetation: 33, fauna: 47, decomposers: 16 });
  assert.equal(new Set(speciesCatalog.SPECIES_CATALOG.map(species => species.id)).size, catalog.entryCount, 'species ids unique');
  assert.ok(speciesCatalog.SPECIES_CATALOG.every(species => species.biomes.length && species.trophicRole && species.behavior), 'catalog entries declare ecology and behavior');
  assert.ok(speciesCatalog.SPECIES_CATALOG.every(species => species.realms.length && species.maturityYears >= 0 && species.lifeStrategy), 'catalog entries declare realms and life history');
  const grasslandSample = model.sampleLatLon(25.46855, -140.963, { profile: 'temperate' });
  assert.ok(speciesCatalog.candidatesFor(grasslandSample, 'vegetation').length >= 3, 'grassland resolves multiple plant candidates');
  assert.ok(speciesCatalog.candidatesFor(grasslandSample, 'fauna').length >= 5, 'grassland resolves multiple fauna candidates');
  const community = new livingModule.LivingSystem({ seed: model.PLANET_DEFAULTS.seed, profileId: 'temperate' }).buildSector(25.46855, -140.963);
  assert.ok(community.community.observedSpeciesCount >= 10, 'streamed sector assembles a multi-guild community');
  ['producer','large-herbivore','apex-predator'].forEach(guild => assert.ok(community.community.guilds[guild] > 0, `community includes ${guild}`));
  assert.ok(community.soil.some(item => item.species && item.species.startsWith('decomposer.')), 'soil activity names decomposer catalog entries');
  const regional = communityModel.buildRegionalCommunity(grasslandSample, { areaKm2: 14_400, dayOfYear: 118 });
  assert.ok(regional.summary.animalPopulationEstimate > community.fauna.reduce((sum, group) => sum + group.groupSize, 0), 'regional population tier exceeds visible subset');
  assert.ok(regional.foodWebLinks.length >= 8, 'community declares food-web resource links');
  assert.ok(regional.summary.herbivorePressure >= 0 && regional.summary.herbivorePressure <= 1, 'herbivore pressure bounded');
  assert.ok(regional.summary.predatorSupport >= 0 && regional.summary.predatorSupport <= 1, 'predator support bounded');
  assert.ok(['resilient','pressured','fragile'].includes(regional.summary.balance), 'regional balance classified');
  assert.ok(regional.summary.activeRealms.includes('terrestrial') && regional.summary.aquaticSpecies > 0, 'wet grassland includes terrestrial and freshwater guilds');

  const oceanSample = model.sampleLatLon(-30, -160, { profile: 'temperate' });
  assert.equal(oceanSample.biome, 'ocean', 'canonical marine test coordinate remains ocean');
  assert.ok(oceanSample.ecology.realms.includes('marine') && oceanSample.ecology.productivity > 0, 'ocean sample exposes marine productivity');
  assert.ok(speciesCatalog.candidatesFor(oceanSample, 'vegetation').some(candidate => candidate.species.id === 'plant.phytoplankton'), 'ocean resolves phytoplankton producer');
  assert.ok(speciesCatalog.candidatesFor(oceanSample, 'fauna').length >= 6, 'ocean resolves a multi-guild fauna catalog');
  assert.ok(speciesCatalog.candidatesFor(oceanSample, 'decomposers').length >= 4, 'ocean resolves marine decomposers');
  const marineRegional = communityModel.buildRegionalCommunity(oceanSample, { areaKm2: 14_400, dayOfYear: 118 });
  assert.ok(marineRegional.producerBiomassTons > 0 && marineRegional.summary.animalPopulationEstimate > 0, 'marine regional tier carries producers and animals');
  assert.ok(marineRegional.summary.activeRealms.includes('marine') && marineRegional.summary.aquaticSpecies >= 10, 'marine community reports aquatic realm breadth');
  assert.ok(marineRegional.foodWebLinks.some(link => link.resource === 'plant.phytoplankton'), 'marine food web links consumers to phytoplankton');
  const marineSector = new livingModule.LivingSystem({ seed: model.PLANET_DEFAULTS.seed, profileId: 'temperate' }).buildSector(-30, -160, { dayOfYear: 118 });
  assert.ok(marineSector.fauna.length > 0 && marineSector.fauna.every(group => group.realms.some(realm => /marine/.test(realm))), 'marine sector streams local aquatic fauna groups');
  assert.ok(marineSector.vegetation.some(item => item.species === 'plant.phytoplankton'), 'marine focus sector streams primary producers');
  assert.ok(marineSector.soil.some(item => item.species.startsWith('decomposer.marine-')), 'marine focus sector streams decomposer activity');
  const oceanWeather = seasonalWeather.buildSeasonalWeather(-30, -160, oceanSample, { dayOfYear: 118, profile: 'temperate' });
  assert.equal(oceanWeather.droughtIndex, 0, 'open water does not report terrestrial drought');
  assert.equal(oceanWeather.fireRisk, 0, 'open water does not report wildfire risk');
  const barrenMarine = communityModel.buildRegionalCommunity(model.sampleLatLon(-30, -160, { profile: 'barren' }), { areaKm2: 14_400, dayOfYear: 118 });
  assert.equal(barrenMarine.summary.animalPopulationEstimate, 0, 'barren profile has no hidden marine population');

  const winterWeather = seasonalWeather.buildSeasonalWeather(60, 10, model.sampleLatLon(60, 10), { dayOfYear: 0 });
  const summerWeather = seasonalWeather.buildSeasonalWeather(60, 10, model.sampleLatLon(60, 10), { dayOfYear: 180 });
  assert.deepEqual(winterWeather, seasonalWeather.buildSeasonalWeather(60, 10, model.sampleLatLon(60, 10), { dayOfYear: 0 }), 'seasonal weather deterministic');
  assert.ok(summerWeather.solar.daylightHours > winterWeather.solar.daylightHours + 8, 'northern summer has materially longer daylight');
  assert.ok(summerWeather.seasonalTemperatureC > winterWeather.seasonalTemperatureC, 'northern summer is warmer than winter');
  assert.ok(winterWeather.snowpackMm >= summerWeather.snowpackMm, 'winter snowpack is not below summer');
  [winterWeather, summerWeather].forEach(weather => {
    assert.ok(weather.droughtIndex >= 0 && weather.droughtIndex <= 1, 'drought index bounded');
    assert.ok(weather.fireRisk >= 0 && weather.fireRisk <= 1, 'fire risk bounded');
    assert.ok(weather.solar.daylightHours >= 0 && weather.solar.daylightHours <= 24, 'daylight bounded');
  });
  const wetStorm = seasonalWeather.buildSeasonalWeather(25.46855, -140.963, grasslandSample, { dayOfYear: 156, profile: 'temperate' });
  const drySeason = seasonalWeather.buildSeasonalWeather(25.46855, -140.963, model.sampleLatLon(25.46855, -140.963, { profile: 'arid' }), { dayOfYear: 156, profile: 'arid' });
  assert.ok(wetStorm.precipitation.mmHour > 2 && wetStorm.fireRisk < .02, 'steady rain suppresses immediate ignition risk');
  assert.ok(wetStorm.droughtIndex < .35, 'wet annual climate does not start in severe drought');
  assert.ok(drySeason.droughtIndex > wetStorm.droughtIndex + .35, 'dry profile has materially greater water stress');

  const earthColumnA = earthSystem.createEarthSystemColumn(25.46855, -140.963, grasslandSample, wetStorm, { day: 156, profile: 'temperate' });
  const earthColumnB = earthSystem.createEarthSystemColumn(25.46855, -140.963, grasslandSample, wetStorm, { day: 156, profile: 'temperate' });
  assert.deepEqual(earthColumnA, earthColumnB, 'Earth-system column initialization is deterministic');
  assert.equal(earthSystem.EARTH_SYSTEM_ENGINE_SCHEMA, 'axm.foundation-planet.earth-system-engine/v8', 'engine schema records the conservative two-layer atmosphere lineage');
  assert.equal(earthSystem.EARTH_ATMOSPHERE_PHASE_CHANGE_SCHEMA, 'axm.foundation-planet.atmosphere-phase-change-receipt/v1', 'phase change uses a typed receipt');
  assert.equal(earthSystem.EARTH_FREE_TROPOSPHERE_SCHEMA, 'axm.foundation-planet.free-troposphere/v1', 'the upper atmospheric reservoir has a typed schema');
  assert.equal(earthSystem.EARTH_FREE_TROPOSPHERE_PHASE_SCHEMA, 'axm.foundation-planet.free-troposphere-phase-receipt/v1', 'upper phase change uses a typed receipt');
  assert.equal(earthSystem.EARTH_ATMOSPHERE_VERTICAL_EXCHANGE_SCHEMA, 'axm.foundation-planet.atmosphere-vertical-exchange-receipt/v1', 'vertical exchange uses a typed receipt');
  assert.equal(earthSystem.earthSystemDescription().phaseChangeReceiptSchema, earthSystem.EARTH_ATMOSPHERE_PHASE_CHANGE_SCHEMA, 'Earth-system contract exposes the phase-change receipt schema');
  assert.equal(earthSystem.earthSystemDescription().verticalExchangeReceiptSchema, earthSystem.EARTH_ATMOSPHERE_VERTICAL_EXCHANGE_SCHEMA, 'Earth-system contract exposes the vertical-exchange receipt schema');
  assert.equal(earthTransport.earthTransportDescription().runoffRouteReceiptSchema, 'axm.foundation-planet.runoff-route-receipt/v1', 'transport contract exposes typed runoff receipts');
  assert.equal(earthTransport.earthTransportDescription().atmosphereMassRouteReceiptSchema, 'axm.foundation-planet.atmosphere-mass-route-receipt/v1', 'transport contract exposes typed dry-air mass receipts');
  assert.equal(earthTransport.earthTransportDescription().atmospherePressureImpulseReceiptSchema, 'axm.foundation-planet.atmosphere-pressure-impulse-receipt/v1', 'transport contract exposes typed pressure-gradient impulse receipts');
  assert.equal(earthTransport.earthTransportDescription().atmosphereCoriolisReceiptSchema, 'axm.foundation-planet.atmosphere-coriolis-receipt/v1', 'transport contract exposes typed rotation-aware Coriolis receipts');
  assert.equal(basinRouting.basinRoutingDescription().oceanMouthReceiptSchema, 'axm.foundation-planet.ocean-mouth-receipt/v1', 'basin contract exposes typed ocean-mouth delivery');
  assert.equal(earthColumnA.kind, 'land', 'land sample creates a terrestrial water-energy column');
  assert.equal(earthColumnA.atmosphere.freeTroposphere.schema, earthSystem.EARTH_FREE_TROPOSPHERE_SCHEMA, 'new columns persist a typed free-troposphere reservoir');
  assert.ok(Math.abs(earthColumnA.atmosphere.boundaryLayerPressureHpa + earthColumnA.atmosphere.freeTroposphere.pressureThicknessHpa - earthColumnA.atmosphere.surfacePressureHpa) < 1e-8, 'boundary and free-troposphere pressure partitions close to surface pressure');
  assert.ok(Math.abs(Object.values(earthSystem.atmosphereLayerHeatCapacitiesJm2K(earthColumnA)).reduce((sum, value) => sum + value, 0) - 1.02e7) < 1e-6, 'layer heat capacities partition the declared atmospheric column capacity');
  assert.ok(earthColumnA.substrate.rootCapacityMm > earthColumnA.substrate.rootWiltingPointMm, 'soil substrate carries ordered physical water capacities');
  assert.ok(earthColumnA.land.groundwaterStorageMm > 0 && earthColumnA.land.waterTableDepthM > 0, 'land column initializes a bounded aquifer and water table');
  const wetEarthStep = earthSystem.advanceEarthSystemColumn(earthColumnA, wetStorm, grasslandSample, 1, { livingEnabled: true, lifeAbundance: 1 });
  assert.ok(Math.abs(wetEarthStep.budget.water.residualMm) < 1e-5, 'land precipitation, soil, aquifer and runoff close their water budget');
  assert.equal(wetEarthStep.atmosphere.lastPhaseChangeReceipt.schema, earthSystem.EARTH_ATMOSPHERE_PHASE_CHANGE_SCHEMA, 'local condensation and precipitation emit the typed phase-change receipt');
  assert.equal(wetEarthStep.atmosphere.lastFreeTropospherePhaseReceipt.schema, earthSystem.EARTH_FREE_TROPOSPHERE_PHASE_SCHEMA, 'upper vapor and condensate emit their own phase receipt');
  assert.equal(wetEarthStep.atmosphere.lastVerticalExchangeReceipt.schema, earthSystem.EARTH_ATMOSPHERE_VERTICAL_EXCHANGE_SCHEMA, 'each two-layer step emits a vertical-exchange receipt');
  assert.ok(Math.abs(wetEarthStep.atmosphere.lastVerticalExchangeReceipt.hydrostaticPressureResidualHpa) < 1e-8, 'vertical receipt closes the hydrostatic pressure partition');
  assert.ok(Math.abs(wetEarthStep.atmosphere.lastVerticalExchangeReceipt.waterResidualMm) < 1e-7 && Math.abs(wetEarthStep.atmosphere.lastVerticalExchangeReceipt.moistEnthalpyResidualJm2) < 1, 'vertical parcel/tracer exchange closes water and moist enthalpy');
  const wetVerticalReceipt = wetEarthStep.atmosphere.lastVerticalExchangeReceipt;
  assert.ok(Math.abs(wetVerticalReceipt.grossDryAirExchangeKgM2 -
    Math.min(wetVerticalReceipt.boundaryDryAirKgM2, wetVerticalReceipt.freeDryAirKgM2) *
      wetVerticalReceipt.exchangeFraction) < 1e-6, 'vertical receipt derives one equal gross dry-air parcel exchange from the smaller layer mass');
  assert.ok(Math.abs(wetVerticalReceipt.initialBoundaryVaporMm - wetVerticalReceipt.finalBoundaryVaporMm - wetVerticalReceipt.vaporUpwardMm) < 2e-9 &&
    Math.abs(wetVerticalReceipt.initialFreeVaporMm + wetVerticalReceipt.vaporUpwardMm - wetVerticalReceipt.finalFreeVaporMm) < 2e-9,
  'the receipted parcel mixing-ratio contrast debits and credits the same vapor tracer');
  assert.ok(wetEarthStep.atmosphere.lastPhaseChangeReceipt.condensationMm > 0 && wetEarthStep.atmosphere.lastPhaseChangeReceipt.precipitationMm > 0, 'wet weather condenses vapor into cloud liquid before it precipitates');
  assert.ok(wetEarthStep.atmosphere.lastPhaseChangeReceipt.precipitationMm > 12 && wetEarthStep.atmosphere.lastPhaseChangeReceipt.finalCloudWaterMm <= 12, 'bounded condensation-to-precipitation subcycles can deliver a long storm without exceeding instantaneous cloud capacity');
  assert.ok(wetEarthStep.atmosphere.lastPhaseChangeReceipt.finalAirTemperatureC > wetEarthStep.atmosphere.lastPhaseChangeReceipt.initialAirTemperatureC, 'condensation releases latent heat into atmospheric sensible heat');
  assert.ok(Math.abs(wetEarthStep.atmosphere.lastPhaseChangeReceipt.waterResidualMm) < 1e-7, 'phase-change receipt closes vapor, cloud liquid and precipitation water');
  assert.ok(Math.abs(wetEarthStep.atmosphere.lastPhaseChangeReceipt.moistEnthalpyResidualJm2) < 1, 'phase change conserves moist enthalpy while exchanging latent and sensible forms');
  assert.ok(Math.abs(wetEarthStep.budget.atmosphereEnergy.residualJm2) < 1, 'boundary forcing, phase change and surface evaporation close the atmospheric moist-enthalpy budget');
  assert.equal(wetEarthStep.truth.moistEnthalpyBudgetClosed, true, 'closed atmospheric moist enthalpy is explicit truth');
  assert.equal(wetEarthStep.truth.freeTroposphereReservoir, true, 'the free-troposphere reservoir is explicit truth');
  assert.equal(wetEarthStep.truth.resolvedThreeDimensionalConvection, false, 'the bounded two-layer exchange does not claim resolved 3D convection');
  assert.equal(wetEarthStep.truth.atmosphereCoupledToPrecipitationBudget, true, 'atmospheric water is part of the closed local column ledger');
  assert.equal(wetEarthStep.budget.water.exportedRunoffMm, 0, 'generated runoff is queued instead of disappearing across an unreceipted boundary');
  assert.equal(wetEarthStep.budget.water.generatedRunoffMm, wetEarthStep.routing.runoffQueueMm, 'new land-column runoff enters the persistent routing queue');
  assert.ok(Math.abs(
    wetEarthStep.budget.water.atmosphere.afterBoundaryWaterMm -
    wetEarthStep.budget.water.precipitationMm + wetEarthStep.budget.water.evaporationMm -
    wetEarthStep.budget.water.atmosphere.finalWaterMm
  ) < 1e-5, 'precipitation leaves and evaporation returns to the atmospheric reservoir');
  assert.ok(Math.abs(wetEarthStep.budget.energy.residualJm2) < 1, 'land surface heat storage closes its prescribed energy budget');
  assert.equal(wetEarthStep.truth.waterBudgetClosed, true, 'closed land water budget is explicit truth');
  assert.ok(wetEarthStep.fluxes.infiltrationMmDay > 0, 'rain infiltrates the physical root zone');
  assert.ok(wetEarthStep.land.rootZoneWaterMm >= 0 && wetEarthStep.land.deepSoilWaterMm >= 0 && wetEarthStep.land.groundwaterStorageMm >= 0, 'all terrestrial reservoirs stay non-negative');
  const noLifeWetStep = earthSystem.advanceEarthSystemColumn(earthColumnA, wetStorm, grasslandSample, 1, { livingEnabled: false, lifeAbundance: 1 });
  assert.equal(noLifeWetStep.fluxes.transpirationMmDay, 0, 'life-off state removes biological transpiration without deleting physical evaporation');
  assert.ok(noLifeWetStep.fluxes.evaporationMmDay > 0, 'abiotic evaporation continues when living layers are off');
  const clearingColumn = JSON.parse(JSON.stringify(earthColumnA));
  clearingColumn.atmosphere.precipitableWaterMm = .3;
  clearingColumn.atmosphere.cloudWaterMm = 4;
  clearingColumn.atmosphere.cloudFraction = 0;
  clearingColumn.atmosphere.relativeHumidity = .01;
  const clearingWeather = {
    ...wetStorm,
    humidity: .01,
    cloudCover: 0,
    precipitation: { type: 'none', mmHour: 0, potential: 0 },
    evapotranspirationMmDay: 0
  };
  const clearingStep = earthSystem.advanceEarthSystemColumn(clearingColumn, clearingWeather, grasslandSample, .25, { livingEnabled: true });
  assert.ok(clearingStep.atmosphere.lastPhaseChangeReceipt.cloudEvaporationMm > 0, 'subsaturated clearing air evaporates stored cloud liquid');
  assert.ok(clearingStep.atmosphere.lastPhaseChangeReceipt.finalAirTemperatureC < clearingStep.atmosphere.lastPhaseChangeReceipt.initialAirTemperatureC, 'cloud evaporation consumes atmospheric sensible heat');
  assert.ok(Math.abs(clearingStep.atmosphere.lastPhaseChangeReceipt.moistEnthalpyResidualJm2) < 1, 'cloud evaporation preserves moist enthalpy');
  assert.ok(Math.abs(clearingStep.budget.water.residualMm) < 1e-5 && Math.abs(clearingStep.budget.atmosphereEnergy.residualJm2) < 1, 'clearing-cloud water and atmospheric energy budgets close together');
  const upperSaturatedColumn = JSON.parse(JSON.stringify(earthColumnA));
  upperSaturatedColumn.atmosphere.freeTroposphere.airTemperatureC = -38;
  upperSaturatedColumn.atmosphere.freeTroposphere.precipitableWaterMm = 18;
  upperSaturatedColumn.atmosphere.freeTroposphere.cloudWaterMm = 0;
  upperSaturatedColumn.atmosphere.freeTroposphere.relativeHumidity = 1;
  const upperSaturatedStep = earthSystem.advanceEarthSystemColumn(
    upperSaturatedColumn,
    { ...wetStorm, precipitation: { type: 'none', mmHour: 0, potential: 0 }, evapotranspirationMmDay: 0 },
    grasslandSample,
    .05,
    { livingEnabled: true }
  );
  assert.ok(upperSaturatedStep.atmosphere.lastFreeTropospherePhaseReceipt.condensationMm > 0, 'supersaturated upper air condenses into its own cloud-liquid reservoir');
  assert.ok(upperSaturatedStep.atmosphere.lastFreeTropospherePhaseReceipt.finalAirTemperatureC > upperSaturatedStep.atmosphere.lastFreeTropospherePhaseReceipt.initialAirTemperatureC, 'upper condensation returns latent heat to upper-air sensible heat');
  assert.equal(upperSaturatedStep.atmosphere.lastFreeTropospherePhaseReceipt.truth.directPrecipitation, false, 'free-troposphere condensate does not bypass the boundary precipitation path');

  const unstableColumn = JSON.parse(JSON.stringify(earthColumnA));
  unstableColumn.atmosphere.airTemperatureC = 36;
  unstableColumn.atmosphere.freeTroposphere.airTemperatureC = -32;
  const unstableStep = earthSystem.advanceEarthSystemColumn(
    unstableColumn,
    { ...wetStorm, seasonalTemperatureC: 36, precipitation: { type: 'none', mmHour: 0, potential: 0 }, evapotranspirationMmDay: 0 },
    grasslandSample,
    .05,
    { livingEnabled: true }
  );
  const unstableExchange = unstableStep.atmosphere.lastVerticalExchangeReceipt;
  assert.ok(unstableExchange.instabilityKPerKm > 0 && unstableExchange.exchangeFraction > .004 * .05, 'supercritical lapse rate activates exchange above the bounded background fraction');
  assert.ok(unstableExchange.finalLapseRateKPerKm < unstableExchange.initialLapseRateKPerKm, 'unstable vertical sensible exchange reduces the two-layer lapse rate');
  assert.ok(Math.abs(unstableExchange.waterResidualMm) < 1e-7 && Math.abs(unstableExchange.moistEnthalpyResidualJm2) < 1, 'unstable exchange remains conservative');

  const stableColumn = JSON.parse(JSON.stringify(earthColumnA));
  stableColumn.atmosphere.airTemperatureC = 10;
  stableColumn.atmosphere.freeTroposphere.airTemperatureC = -14;
  const stableStep = earthSystem.advanceEarthSystemColumn(
    stableColumn,
    { ...wetStorm, seasonalTemperatureC: 10, precipitation: { type: 'none', mmHour: 0, potential: 0 }, evapotranspirationMmDay: 0 },
    grasslandSample,
    .05,
    { livingEnabled: true }
  );
  assert.equal(stableStep.atmosphere.lastVerticalExchangeReceipt.instabilityKPerKm, 0, 'subcritical lapse rate stays on the background vertical-exchange path');
  assert.ok(stableStep.atmosphere.lastVerticalExchangeReceipt.exchangeFraction <= .000200001, 'stable upper air receives only the declared bounded background exchange');
  let phaseSweepColumn = JSON.parse(JSON.stringify(earthColumnA));
  for (let phaseStep = 0; phaseStep < 32; phaseStep++) {
    phaseSweepColumn = earthSystem.advanceEarthSystemColumn(
      phaseSweepColumn,
      phaseStep % 4 === 0 ? wetStorm : clearingWeather,
      grasslandSample,
      .25,
      { livingEnabled: true, lifeAbundance: 1 }
    );
    assert.ok(Math.abs(phaseSweepColumn.budget.water.residualMm) < 1e-5, 'repeated wet/dry phase steps keep the complete water ledger closed');
    assert.ok(Math.abs(phaseSweepColumn.budget.atmosphereEnergy.residualJm2) < 1, 'repeated wet/dry phase steps keep moist enthalpy closed');
    const recomputedMoistResidualJm2 = earthSystem.atmosphereMoistEnthalpyJm2(phaseSweepColumn) -
      phaseSweepColumn.budget.atmosphereEnergy.initialMoistEnthalpyJm2 -
      phaseSweepColumn.budget.atmosphereEnergy.boundaryMoistEnthalpyJm2 -
      phaseSweepColumn.budget.atmosphereEnergy.surfaceLatentInputJm2;
    assert.ok(Math.abs(recomputedMoistResidualJm2 - phaseSweepColumn.budget.atmosphereEnergy.residualJm2) < 1e-4, 'published moist-enthalpy residual matches the quantized state that persists');
    assert.ok(Math.abs(phaseSweepColumn.atmosphere.lastPhaseChangeReceipt.waterResidualMm) < 1e-7 && Math.abs(phaseSweepColumn.atmosphere.lastPhaseChangeReceipt.moistEnthalpyResidualJm2) < 1, 'every repeated phase receipt closes water and moist enthalpy');
    assert.ok(phaseSweepColumn.atmosphere.precipitableWaterMm >= .2 && phaseSweepColumn.atmosphere.precipitableWaterMm <= 75 && phaseSweepColumn.atmosphere.cloudWaterMm >= 0 && phaseSweepColumn.atmosphere.cloudWaterMm <= 12, 'repeated wet/dry phase steps keep vapor and cloud liquid bounded');
    assert.ok(phaseSweepColumn.atmosphere.freeTroposphere.precipitableWaterMm >= 0 && phaseSweepColumn.atmosphere.freeTroposphere.precipitableWaterMm <= 20 && phaseSweepColumn.atmosphere.freeTroposphere.cloudWaterMm >= 0 && phaseSweepColumn.atmosphere.freeTroposphere.cloudWaterMm <= 8, 'repeated wet/dry steps keep upper vapor and condensate bounded');
    assert.ok(Math.abs(phaseSweepColumn.atmosphere.boundaryLayerPressureHpa + phaseSweepColumn.atmosphere.freeTroposphere.pressureThicknessHpa - phaseSweepColumn.atmosphere.surfacePressureHpa) < 1e-8, 'every persisted step closes its two-layer pressure partition');
    assert.ok(Math.abs(phaseSweepColumn.atmosphere.lastFreeTropospherePhaseReceipt.waterResidualMm) < 1e-7 && Math.abs(phaseSweepColumn.atmosphere.lastVerticalExchangeReceipt.waterResidualMm) < 1e-7, 'upper phase and vertical receipts close on every repeated step');
  }
  const forcedDry = {
    ...wetStorm,
    seasonalTemperatureC: 34,
    humidity: .18,
    precipitation: { type: 'none', mmHour: 0, potential: 0 },
    evapotranspirationMmDay: 9
  };
  const dryEarthStep = earthSystem.advanceEarthSystemColumn(earthColumnA, forcedDry, grasslandSample, 1, { livingEnabled: true, lifeAbundance: 1 });
  assert.ok(dryEarthStep.land.rootZoneWaterMm < earthColumnA.land.rootZoneWaterMm, 'hot dry day draws down root-zone water');
  assert.ok(dryEarthStep.budget.water.atmosphere.finalWaterMm > dryEarthStep.budget.water.atmosphere.afterBoundaryWaterMm, 'dry-day evaporation returns surface water to the atmospheric reservoir');
  assert.ok(Math.abs(dryEarthStep.budget.water.residualMm) < 1e-5, 'dry-day water loss also closes its budget');
  const moistureLimitedColumn = JSON.parse(JSON.stringify(earthColumnA));
  moistureLimitedColumn.atmosphere.precipitableWaterMm = .25;
  moistureLimitedColumn.atmosphere.relativeHumidity = .01;
  const moistureLimitedStorm = {
    ...wetStorm,
    humidity: .01,
    precipitation: { type: 'rain', mmHour: 20, potential: 1 },
    evapotranspirationMmDay: 0
  };
  const moistureLimitedStep = earthSystem.advanceEarthSystemColumn(moistureLimitedColumn, moistureLimitedStorm, grasslandSample, .01, { livingEnabled: true });
  assert.ok(moistureLimitedStep.budget.water.unmetPrecipitationMm > 0, 'weather cannot precipitate water that the atmospheric column does not contain');
  assert.ok(moistureLimitedStep.atmosphere.precipitableWaterMm >= .2, 'precipitation preserves the declared minimum atmospheric-water reservoir');
  assert.ok(Math.abs(moistureLimitedStep.budget.water.residualMm) < 1e-5, 'moisture-limited storm remains conservative');
  const forcedSnow = {
    ...winterWeather,
    seasonalTemperatureC: -9,
    precipitation: { type: 'snow', mmHour: 3, potential: .7 },
    evapotranspirationMmDay: .2
  };
  const snowEarthStep = earthSystem.advanceEarthSystemColumn(earthColumnA, forcedSnow, grasslandSample, 1, { livingEnabled: true });
  assert.ok(snowEarthStep.cryosphere.snowWaterEquivalentMm > earthColumnA.cryosphere.snowWaterEquivalentMm, 'cold precipitation accumulates conserved snow-water equivalent');
  const forcedMelt = { ...summerWeather, seasonalTemperatureC: 18, precipitation: { type: 'none', mmHour: 0, potential: 0 } };
  const meltEarthStep = earthSystem.advanceEarthSystemColumn(snowEarthStep, forcedMelt, grasslandSample, 1, { livingEnabled: true });
  assert.ok(meltEarthStep.cryosphere.snowWaterEquivalentMm < snowEarthStep.cryosphere.snowWaterEquivalentMm, 'warm energy forcing melts stored snow into the land water path');
  assert.ok(Math.abs(meltEarthStep.budget.water.residualMm) < 1e-5, 'snowmelt transfer remains water-conservative');

  const oceanColumn = earthSystem.createEarthSystemColumn(-30, -160, oceanSample, oceanWeather, { day: 118, profile: 'temperate' });
  assert.equal(oceanColumn.kind, 'ocean', 'ocean sample creates a mixed-layer column');
  assert.ok(oceanColumn.ocean.mixedLayerDepthM >= 12 && oceanColumn.ocean.mixedLayerDepthM <= 180, 'ocean mixed layer stays physically bounded');
  const oceanStep = earthSystem.advanceEarthSystemColumn(oceanColumn, oceanWeather, oceanSample, 1);
  assert.ok(Math.abs(oceanStep.budget.water.residualMm) < 1e-5, 'ocean precipitation, evaporation and sea ice close their freshwater budget');
  assert.ok(Math.abs(
    oceanStep.budget.water.atmosphere.afterBoundaryWaterMm - oceanStep.budget.water.precipitationMm +
    oceanStep.budget.water.evaporationMm - oceanStep.budget.water.atmosphere.finalWaterMm
  ) < 1e-5, 'ocean precipitation and evaporation exchange water with the same atmospheric reservoir');
  assert.ok(Math.abs(oceanStep.budget.energy.residualJm2) < 1, 'ocean mixed-layer heat closes its prescribed energy budget');
  assert.ok(oceanStep.ocean.salinityPsu >= 2 && oceanStep.ocean.salinityPsu <= 43, 'mixed-layer salinity stays bounded');
  assert.ok(oceanStep.cryosphere.seaIceFraction >= 0 && oceanStep.cryosphere.seaIceFraction <= 1, 'thermodynamic sea-ice fraction stays bounded');
  const coupledWeather = seasonalWeather.buildSeasonalWeather(25.46855, -140.963, grasslandSample, { dayOfYear: 157, profile: 'temperate', earthSystem: wetEarthStep });
  assert.equal(coupledWeather.truth.coupledWaterEnergyColumn, true, 'weather consumes the stateful surface column');
  assert.equal(coupledWeather.truth.coupledPressureAndVectorWind, true, 'weather exposes carried pressure and vector wind rather than a disconnected scalar diagnostic');
  assert.equal(coupledWeather.truth.coupledCloudLiquidAndLatentHeat, true, 'weather exposes the stored cloud-liquid and latent-heat column rather than a disconnected cloud diagnostic');
  assert.equal(coupledWeather.truth.coupledTwoLayerAtmosphere, true, 'weather exposes the stateful boundary/free-troposphere column rather than collapsing it back to one layer');
  assert.equal(coupledWeather.pressureHpa, wetEarthStep.atmosphere.surfacePressureHpa, 'visible coupled pressure comes from the transported Earth column');
  assert.equal(coupledWeather.windSpeedMps, wetEarthStep.atmosphere.windSpeedMps, 'visible coupled wind speed is derived from carried tangent momentum');
  assert.ok(Number.isFinite(coupledWeather.boundaryForcing.pressureHpa) && Number.isFinite(coupledWeather.boundaryForcing.windSpeedMps), 'procedural synoptic targets remain explicit local boundary forcing');
  assert.equal(coupledWeather.coupling.cloudWaterMm, wetEarthStep.atmosphere.cloudWaterMm, 'weather coupling names the exact stored cloud-liquid reservoir');
  assert.equal(coupledWeather.coupling.freeTroposphere.schema, earthSystem.EARTH_FREE_TROPOSPHERE_SCHEMA, 'weather coupling carries the exact typed free-troposphere reservoir');
  assert.equal(coupledWeather.coupling.freeTroposphere.verticalExchangeReceiptSchema, earthSystem.EARTH_ATMOSPHERE_VERTICAL_EXCHANGE_SCHEMA, 'weather coupling exposes the vertical-exchange receipt lineage');
  assert.equal(coupledWeather.coupling.moistEnthalpyResidualJm2, wetEarthStep.budget.atmosphereEnergy.residualJm2, 'weather coupling exposes the atmospheric moist-enthalpy residual');
  assert.equal(coupledWeather.snowpackMm, Math.round(wetEarthStep.cryosphere.snowWaterEquivalentMm), 'weather reads stored snow rather than inventing a second snowpack');
  assert.equal(coupledWeather.coupling.cellId, wetEarthStep.id, 'weather exposes exact canonical Earth-cell coupling');

  const earthEngineA = new earthSystem.EarthSystemEngine({ seed: model.PLANET_DEFAULTS.seed, profileId: 'temperate', maximumColumns: 4 });
  const engineFirst = earthEngineA.advanceAt(25.46855, -140.963, grasslandSample, wetStorm, 156, { livingEnabled: true });
  const initialOnlySave = earthEngineA.snapshot();
  const initialOnlyRestore = new earthSystem.EarthSystemEngine({ seed: model.PLANET_DEFAULTS.seed, profileId: 'temperate', maximumColumns: 4, state: initialOnlySave });
  assert.deepEqual(initialOnlyRestore.snapshot(), initialOnlySave, 'unstepped v8 two-layer columns survive exact restore without inventing a vertical receipt');
  const engineSecond = earthEngineA.advanceAt(25.46855, -140.963, grasslandSample, wetStorm, 157, { livingEnabled: true });
  assert.equal(engineFirst.stepCount, 0, 'new sparse Earth cell begins at its observed planet day without fake catch-up');
  assert.equal(engineSecond.stepCount, 1, 'revisited sparse Earth cell advances state by bounded daily steps');
  assert.equal(earthEngineA.advanceAt(25.46855, -140.963, grasslandSample, wetStorm, 156.9999995).stepCount, 1, 'sub-second checkpoint serialization skew does not prevent restore');
  assert.throws(() => earthEngineA.advanceAt(25.46855, -140.963, grasslandSample, wetStorm, 156.5), /cannot run backward/, 'Earth-system engine refuses clock reversal');
  const earthSave = earthEngineA.snapshot();
  const earthEngineB = new earthSystem.EarthSystemEngine({ seed: model.PLANET_DEFAULTS.seed, profileId: 'temperate', maximumColumns: 4, state: earthSave });
  assert.deepEqual(earthEngineB.snapshot(), earthSave, 'sparse reservoir state survives save and restore exactly');
  const legacyEarthEngine = new earthSystem.EarthSystemEngine({ seed: model.PLANET_DEFAULTS.seed, profileId: 'temperate', maximumColumns: 4, state: { ...earthSave, schema: 'axm.foundation-planet.earth-system-engine/v1' } });
  assert.equal(legacyEarthEngine.descriptor().loadedColumns, 0, 'unreleased pre-fix cache envelope is invalidated instead of preserving mixed-profile history');
  const rungNineEarthEngine = new earthSystem.EarthSystemEngine({ seed: model.PLANET_DEFAULTS.seed, profileId: 'temperate', maximumColumns: 4, state: { ...earthSave, schema: 'axm.foundation-planet.earth-system-engine/v3' } });
  assert.equal(rungNineEarthEngine.descriptor().loadedColumns, earthSave.columns.length, 'Rung 9 transport caches migrate into the atmosphere-and-runoff-closed engine envelope');
  assert.ok(rungNineEarthEngine.columnsForProfile('temperate').every(column => column.routing && column.truth.runoffHeldForReceiptedRouting), 'migrated columns gain an explicit empty routing reservoir');
  const rungTenEarthEngine = new earthSystem.EarthSystemEngine({ seed: model.PLANET_DEFAULTS.seed, profileId: 'temperate', maximumColumns: 4, state: { ...earthSave, schema: 'axm.foundation-planet.earth-system-engine/v4' } });
  assert.ok(rungTenEarthEngine.columnsForProfile('temperate').every(column => column.routing.cumulativeChannelizedRunoffMm === 0 && column.routing.lastDownstreamReachId === null), 'Rung 10 columns migrate with an empty canonical river lineage');
  const rungElevenEarthEngine = new earthSystem.EarthSystemEngine({ seed: model.PLANET_DEFAULTS.seed, profileId: 'temperate', maximumColumns: 4, state: { ...earthSave, schema: 'axm.foundation-planet.earth-system-engine/v5' } });
  assert.ok(rungElevenEarthEngine.columnsForProfile('temperate').every(column => Number.isFinite(column.atmosphere.eastwardWindMps) && Number.isFinite(column.atmosphere.northwardWindMps)), 'Rung 11 scalar winds migrate into explicit tangent-vector momentum state');
  const rungTwelveSave = JSON.parse(JSON.stringify({ ...earthSave, schema: 'axm.foundation-planet.earth-system-engine/v6' }));
  rungTwelveSave.columns.forEach(entry => {
    delete entry.column.atmosphere.cloudWaterMm;
    delete entry.column.atmosphere.lastPhaseChangeReceipt;
    delete entry.column.budget.atmosphereEnergy;
    delete entry.column.truth.cloudLiquidWaterReservoir;
    delete entry.column.truth.atmosphericPhaseChangeReceipted;
    delete entry.column.truth.moistEnthalpyBudgetClosed;
  });
  const rungTwelveEarthEngine = new earthSystem.EarthSystemEngine({ seed: model.PLANET_DEFAULTS.seed, profileId: 'temperate', maximumColumns: 4, state: rungTwelveSave });
  assert.ok(rungTwelveEarthEngine.columnsForProfile('temperate').every(column => column.atmosphere.cloudWaterMm === 0 && column.atmosphere.lastPhaseChangeReceipt === null), 'Rung 12 columns migrate with an explicit empty cloud-liquid reservoir');
  const rungFourteenSave = JSON.parse(JSON.stringify({ ...earthSave, schema: 'axm.foundation-planet.earth-system-engine/v7' }));
  const rungFourteenWater = new Map();
  rungFourteenSave.columns.forEach(entry => {
    const atmosphere = entry.column.atmosphere;
    atmosphere.precipitableWaterMm += atmosphere.freeTroposphere.precipitableWaterMm;
    atmosphere.cloudWaterMm += atmosphere.freeTroposphere.cloudWaterMm;
    rungFourteenWater.set(entry.column.id, atmosphere.precipitableWaterMm + atmosphere.cloudWaterMm);
    delete atmosphere.boundaryLayerPressureHpa;
    delete atmosphere.freeTroposphere;
    delete atmosphere.lastFreeTropospherePhaseReceipt;
    delete atmosphere.lastVerticalExchangeReceipt;
  });
  const rungFourteenEarthEngine = new earthSystem.EarthSystemEngine({ seed: model.PLANET_DEFAULTS.seed, profileId: 'temperate', maximumColumns: 4, state: rungFourteenSave });
  assert.ok(rungFourteenEarthEngine.columnsForProfile('temperate').every(column =>
    column.atmosphere.freeTroposphere?.schema === earthSystem.EARTH_FREE_TROPOSPHERE_SCHEMA &&
    Math.abs(earthSystem.atmosphereWaterStorageMm(column) - rungFourteenWater.get(column.id)) < 1e-8
  ), 'Rung 14 single-layer columns migrate into two layers without creating or deleting atmospheric water');

  const transportLandCoordinates = [[25.375, -140.875], [25.375, -140.625]];
  const transportLandColumns = transportLandCoordinates.map(([latitude, longitude]) => {
    const sample = model.sampleLatLon(latitude, longitude, { profile: 'temperate' });
    const weather = seasonalWeather.buildSeasonalWeather(latitude, longitude, sample, { dayOfYear: 156, profile: 'temperate' });
    return earthSystem.createEarthSystemColumn(latitude, longitude, sample, weather, { day: 156, profile: 'temperate' });
  });
  transportLandColumns[0].land.groundwaterStorageMm = transportLandColumns[0].substrate.aquiferCapacityMm * .9;
  transportLandColumns[0].land.waterTableDepthM = transportLandColumns[0].substrate.aquiferDepthM * .1;
  transportLandColumns[0].surface.elevationM = 1500;
  transportLandColumns[0].atmosphere.precipitableWaterMm = 60;
  transportLandColumns[0].atmosphere.cloudWaterMm = 4;
  transportLandColumns[0].atmosphere.airTemperatureC = 28;
  setAtmospherePressure(transportLandColumns[0], 1040);
  transportLandColumns[0].atmosphere.windSpeedMps = 0;
  transportLandColumns[0].atmosphere.eastwardWindMps = 0;
  transportLandColumns[0].atmosphere.northwardWindMps = 0;
  transportLandColumns[1].land.groundwaterStorageMm = transportLandColumns[1].substrate.aquiferCapacityMm * .1;
  transportLandColumns[1].land.waterTableDepthM = transportLandColumns[1].substrate.aquiferDepthM * .9;
  transportLandColumns[1].surface.elevationM = 900;
  transportLandColumns[1].atmosphere.precipitableWaterMm = 5;
  transportLandColumns[1].atmosphere.cloudWaterMm = 0;
  transportLandColumns[1].atmosphere.airTemperatureC = 2;
  setAtmospherePressure(transportLandColumns[1], 980);
  transportLandColumns[1].atmosphere.windSpeedMps = 0;
  transportLandColumns[1].atmosphere.eastwardWindMps = 0;
  transportLandColumns[1].atmosphere.northwardWindMps = 0;
  transportLandColumns[0].routing.runoffQueueMm = 10;
  transportLandColumns[0].routing.cumulativeGeneratedRunoffMm = 10;
  const freeTroposphereBeforeTransport = new Map(transportLandColumns.map(column => [
    column.id,
    {
      airTemperatureC: column.atmosphere.freeTroposphere.airTemperatureC,
      precipitableWaterMm: column.atmosphere.freeTroposphere.precipitableWaterMm,
      cloudWaterMm: column.atmosphere.freeTroposphere.cloudWaterMm
    }
  ]));
  const transportedLand = earthTransport.transportEarthSystemColumns(transportLandColumns, .25);
  const transportedLandReverse = earthTransport.transportEarthSystemColumns([...transportLandColumns].reverse(), .25);
  assert.equal(transportedLand.receipt.activeEdgeCount, 1, 'two adjacent canonical land cells form one transport edge');
  assert.equal(transportedLand.receipt.boundaryReceipts.length, 6, 'sparse two-cell domain exposes every unloaded cardinal boundary');
  assert.equal(transportedLand.receipt.digest, transportedLandReverse.receipt.digest, 'transport receipt is invariant to caller cell ordering');
  assert.deepEqual(transportedLand.columns, transportedLandReverse.columns, 'simultaneous transport result is invariant to caller cell ordering');
  assert.ok(transportedLand.columns[0].atmosphere.surfacePressureHpa < 1040 && transportedLand.columns[1].atmosphere.surfacePressureHpa > 980, 'surface-pressure dry-air mass moves from the loaded high toward the loaded low');
  assert.ok(transportedLand.columns.every(column => column.atmosphere.windSpeedMps > 0), 'loaded pressure gradient produces explicit vector wind momentum');
  assert.equal(transportedLand.receipt.atmosphereMassReceipts[0].schema, earthTransport.EARTH_ATMOSPHERE_MASS_ROUTE_SCHEMA, 'dry-air transfer has a typed sender/receiver receipt');
  assert.equal(transportedLand.receipt.atmosphereImpulseReceipts[0].schema, earthTransport.EARTH_ATMOSPHERE_IMPULSE_SCHEMA, 'pressure forcing has a typed impulse receipt');
  assert.equal(transportedLand.receipt.atmosphereCoriolisReceipts.length, 2, 'every loaded atmospheric column emits one rotation receipt');
  assert.ok(transportedLand.receipt.atmosphereCoriolisReceipts.every(receipt => receipt.schema === earthTransport.EARTH_ATMOSPHERE_CORIOLIS_SCHEMA && receipt.rotationRadians > 0), 'northern loaded cells use positive latitude-dependent Coriolis rotation');
  assert.ok(transportedLand.columns.every(column => column.atmosphere.northwardWindMps < 0), 'northern Coriolis deflects an eastward pressure response toward the right without changing its speed bound');
  assert.ok(transportedLand.columns[0].atmosphere.precipitableWaterMm < 60 && transportedLand.columns[1].atmosphere.precipitableWaterMm > 5, 'atmospheric moisture crosses the shared edge down-gradient');
  assert.ok(transportedLand.columns[0].atmosphere.cloudWaterMm < 4 && transportedLand.columns[1].atmosphere.cloudWaterMm > 0, 'cloud liquid crosses the shared edge without being collapsed into vapor');
  assert.ok(transportedLand.columns[0].atmosphere.airTemperatureC < 28 && transportedLand.columns[1].atmosphere.airTemperatureC > 2, 'atmospheric sensible heat crosses the shared edge down-gradient');
  assert.ok(transportedLand.columns.every(column => {
    const before = freeTroposphereBeforeTransport.get(column.id);
    return column.atmosphere.freeTroposphere.airTemperatureC === before.airTemperatureC &&
      column.atmosphere.freeTroposphere.precipitableWaterMm === before.precipitableWaterMm &&
      column.atmosphere.freeTroposphere.cloudWaterMm === before.cloudWaterMm;
  }), 'Rung 15 horizontal transport leaves upper-air tracers and sensible heat unchanged rather than claiming an unimplemented path');
  assert.ok(transportedLand.columns.every(column => Math.abs(
    column.atmosphere.boundaryLayerPressureHpa +
    column.atmosphere.freeTroposphere.pressureThicknessHpa -
    column.atmosphere.surfacePressureHpa
  ) < 1e-8), 'horizontal dry-air transport preserves the two-layer hydrostatic pressure partition');
  assert.equal(transportedLand.receipt.truth.upperAirHorizontalTransport, false, 'transport receipt exposes the absent upper-air horizontal path');
  assert.ok(transportedLand.columns[0].land.groundwaterStorageMm < transportLandColumns[0].land.groundwaterStorageMm, 'groundwater follows hydraulic head into the neighboring aquifer');
  assert.ok(transportedLand.columns[0].routing.runoffQueueMm < 10 && transportedLand.columns[1].routing.runoffQueueMm > 0, 'queued runoff advances to the lower loaded land neighbor');
  assert.equal(transportedLand.receipt.runoffReceipts[0].status, 'routed', 'land-to-land runoff emits a typed routing receipt');
  assert.ok(Math.abs(transportedLand.receipt.conservation.runoffQueueResidualKg) < .1, 'land-to-land runoff routing conserves area-weighted mass');
  assert.ok(Math.abs(transportedLand.receipt.conservation.atmosphereWaterResidualKg) < .1, 'area-weighted atmospheric moisture exchange conserves mass');
  assert.ok(Math.abs(transportedLand.receipt.conservation.atmosphereCloudWaterResidualKg) < .1, 'area-weighted cloud-liquid transport conserves mass');
  assert.ok(Math.abs(transportedLand.receipt.conservation.atmosphereDryAirResidualKg) < .1, 'surface-pressure dry-air exchange conserves loaded-domain mass');
  assert.ok(Math.abs(transportedLand.receipt.conservation.atmosphereEastwardMomentumResidualKgMps) < 1e4, 'eastward momentum closes after the declared pressure impulse');
  assert.ok(Math.abs(transportedLand.receipt.conservation.atmosphereNorthwardMomentumResidualKgMps) < 1e4, 'northward momentum closes after the declared pressure impulse');
  assert.ok(Math.abs(transportedLand.receipt.conservation.atmosphereKineticEnergyResidualJ) < 1e7, 'atmospheric kinetic energy closes after mixing, pressure work and Coriolis terms');
  assert.ok(Math.abs(transportedLand.receipt.transfers.coriolisWorkJ) < 1e4, 'exact Coriolis vector rotation performs no material kinetic-energy work');
  assert.ok(Math.abs(transportedLand.receipt.conservation.groundwaterResidualKg) < .1, 'area-weighted groundwater exchange conserves mass');
  assert.ok(Math.abs(transportedLand.receipt.conservation.atmosphereHeatResidualJ) < 1e5, `area-weighted atmospheric heat exchange conserves energy (${transportedLand.receipt.conservation.atmosphereHeatResidualJ} J)`);
  assert.ok(Math.abs(transportedLand.receipt.conservation.atmosphereMoistEnthalpyResidualJ) < 1e6, 'vapor latent energy and sensible heat close the loaded moist-enthalpy ledger');
  const invalidVerticalPartition = JSON.parse(JSON.stringify(transportLandColumns[0]));
  invalidVerticalPartition.atmosphere.freeTroposphere.pressureThicknessHpa -= 1;
  assert.throws(() => earthTransport.transportEarthSystemColumns([invalidVerticalPartition], .25), /invalid vertical pressure partition/, 'horizontal transport refuses a malformed hydrostatic layer partition instead of silently repairing it');
  const limitedWindColumns = JSON.parse(JSON.stringify(transportLandColumns));
  setAtmospherePressure(limitedWindColumns[0], 1085);
  setAtmospherePressure(limitedWindColumns[1], 850);
  limitedWindColumns.forEach(column => {
    column.atmosphere.windSpeedMps = 89;
    column.atmosphere.windDirectionDeg = 90;
    column.atmosphere.eastwardWindMps = 89;
    column.atmosphere.northwardWindMps = 0;
  });
  const limitedWindResult = earthTransport.transportEarthSystemColumns(limitedWindColumns, 1);
  assert.ok(limitedWindResult.receipt.transfers.pressureImpulseLimiterScale > 0 && limitedWindResult.receipt.transfers.pressureImpulseLimiterScale < 1, 'one shared pressure-impulse limiter activates before any cell exceeds the wind contract');
  assert.ok(limitedWindResult.columns.every(column => column.atmosphere.windSpeedMps <= 90.000000001), 'shared impulse limiting keeps every vector wind bounded without per-cell clipping');
  assert.ok(Math.abs(limitedWindResult.receipt.conservation.atmosphereEastwardMomentumResidualKgMps) < 1e4, 'limited pressure forcing remains exactly included in the eastward momentum ledger');
  const southernCoriolisSample = model.sampleLatLon(-25.375, -140.875, { profile: 'temperate' });
  const southernCoriolisWeather = seasonalWeather.buildSeasonalWeather(-25.375, -140.875, southernCoriolisSample, { dayOfYear: 156, profile: 'temperate' });
  const southernCoriolisColumn = earthSystem.createEarthSystemColumn(-25.375, -140.875, southernCoriolisSample, southernCoriolisWeather, { day: 156, profile: 'temperate' });
  southernCoriolisColumn.atmosphere.windSpeedMps = 20;
  southernCoriolisColumn.atmosphere.windDirectionDeg = 90;
  southernCoriolisColumn.atmosphere.eastwardWindMps = 20;
  southernCoriolisColumn.atmosphere.northwardWindMps = 0;
  const southernCoriolisResult = earthTransport.transportEarthSystemColumns([southernCoriolisColumn], .125);
  assert.ok(southernCoriolisResult.columns[0].atmosphere.northwardWindMps > 0, 'southern Coriolis deflects the same eastward wind toward the opposite hemisphere-aware side');
  assert.ok(Math.abs(southernCoriolisResult.columns[0].atmosphere.windSpeedMps - 20) < 1e-8, 'Coriolis changes direction without changing single-column wind speed');
  assert.ok(Math.abs(southernCoriolisResult.receipt.transfers.coriolisWorkJ) < 1e4 && Math.abs(southernCoriolisResult.receipt.conservation.atmosphereKineticEnergyResidualJ) < 1e7, 'single-column rotation is energy-neutral within floating precision');
  const mixingColumns = JSON.parse(JSON.stringify(transportLandColumns));
  setAtmospherePressure(mixingColumns[0], 1040);
  setAtmospherePressure(mixingColumns[1], 980);
  mixingColumns[0].atmosphere.windSpeedMps = 20;
  mixingColumns[0].atmosphere.windDirectionDeg = 90;
  mixingColumns[0].atmosphere.eastwardWindMps = 20;
  mixingColumns[0].atmosphere.northwardWindMps = 0;
  mixingColumns[1].atmosphere.windSpeedMps = 20;
  mixingColumns[1].atmosphere.windDirectionDeg = 270;
  mixingColumns[1].atmosphere.eastwardWindMps = -20;
  mixingColumns[1].atmosphere.northwardWindMps = 0;
  const mixingResult = earthTransport.transportEarthSystemColumns(mixingColumns, .25);
  assert.ok(mixingResult.receipt.transfers.momentumMixingDissipationJ > 0, 'opposing winds lose explicitly receipted kinetic energy when transferred dry air mixes inelastically');
  assert.ok(Math.abs(mixingResult.receipt.conservation.atmosphereKineticEnergyResidualJ) < 1e7, 'mixing dissipation and pressure work close the kinetic-energy ledger');

  const transportOceanCoordinates = [[-30.125, -159.875], [-30.125, -159.625]];
  const transportOceanColumns = transportOceanCoordinates.map(([latitude, longitude]) => {
    const sample = model.sampleLatLon(latitude, longitude, { profile: 'temperate' });
    const weather = seasonalWeather.buildSeasonalWeather(latitude, longitude, sample, { dayOfYear: 118, profile: 'temperate' });
    return earthSystem.createEarthSystemColumn(latitude, longitude, sample, weather, { day: 118, profile: 'temperate' });
  });
  transportOceanColumns[0].ocean.freshwaterAnomalyMm = 120;
  transportOceanColumns[0].ocean.mixedLayerTemperatureC = 24;
  transportOceanColumns[0].surface.temperatureC = 24;
  transportOceanColumns[1].ocean.freshwaterAnomalyMm = -80;
  transportOceanColumns[1].ocean.mixedLayerTemperatureC = 4;
  transportOceanColumns[1].surface.temperatureC = 4;
  const transportedOcean = earthTransport.transportEarthSystemColumns(transportOceanColumns, .5);
  assert.ok(transportedOcean.columns[0].ocean.freshwaterAnomalyMm < 120 && transportedOcean.columns[1].ocean.freshwaterAnomalyMm > -80, 'ocean freshwater anomaly mixes across the shared edge');
  assert.ok(transportedOcean.columns[0].ocean.mixedLayerTemperatureC < 24 && transportedOcean.columns[1].ocean.mixedLayerTemperatureC > 4, 'ocean mixed-layer heat crosses the shared edge');
  assert.ok(Math.abs(transportedOcean.receipt.conservation.oceanFreshwaterResidualKg) < .1, 'ocean freshwater exchange conserves area-weighted mass');
  assert.ok(Math.abs(transportedOcean.receipt.conservation.oceanHeatResidualJ) < 1e6, 'ocean heat exchange conserves area-weighted energy');
  const coastCoordinates = [[-49.875, -136.875], [-49.875, -136.625]];
  const coastColumns = coastCoordinates.map(([latitude, longitude]) => {
    const sample = model.sampleLatLon(latitude, longitude, { profile: 'temperate' });
    const weather = seasonalWeather.buildSeasonalWeather(latitude, longitude, sample, { dayOfYear: 118, profile: 'temperate' });
    return earthSystem.createEarthSystemColumn(latitude, longitude, sample, weather, { day: 118, profile: 'temperate' });
  });
  assert.equal(coastColumns[0].kind, 'land', 'canonical coastal routing fixture starts on land');
  assert.equal(coastColumns[1].kind, 'ocean', 'canonical coastal routing fixture ends in ocean');
  coastColumns[0].routing.runoffQueueMm = 20;
  coastColumns[0].routing.cumulativeGeneratedRunoffMm = 20;
  coastColumns[1].ocean.freshwaterAnomalyMm = 0;
  const coastRouting = earthTransport.transportEarthSystemColumns(coastColumns, .25);
  assert.ok(coastRouting.columns[0].routing.runoffQueueMm < 20, 'coastal land queue releases runoff toward lower ocean');
  assert.ok(coastRouting.columns[1].ocean.freshwaterAnomalyMm > 0, 'routed runoff freshens the receiving ocean mixed layer');
  assert.ok(coastRouting.receipt.transfers.runoffDeliveredToOceanKg > 0, 'coastal receipt reports delivered freshwater mass');
  assert.ok(Math.abs(coastRouting.receipt.conservation.runoffQueueResidualKg) < .1, 'coastal runoff queue closes after ocean delivery');
  assert.ok(Math.abs(coastRouting.receipt.conservation.oceanFreshwaterResidualKg) < .1, 'receiving ocean anomaly closes against delivered runoff');

  const basinCoordinates = [[-49.875, -137.125], [-49.875, -136.875], [-49.875, -136.625]];
  const basinColumns = basinCoordinates.map(([latitude, longitude]) => {
    const sample = model.sampleLatLon(latitude, longitude, { profile: 'temperate' });
    const weather = seasonalWeather.buildSeasonalWeather(latitude, longitude, sample, { dayOfYear: 118, profile: 'temperate' });
    return earthSystem.createEarthSystemColumn(latitude, longitude, sample, weather, { day: 118, profile: 'temperate' });
  });
  assert.deepEqual(basinColumns.map(column => column.kind), ['land', 'land', 'ocean'], 'basin fixture crosses two canonical land cells into a loaded ocean mouth');
  basinColumns[0].routing.runoffQueueMm = 10;
  basinColumns[0].routing.cumulativeGeneratedRunoffMm = 10;
  const basinSector = {
    schema: hydrology.HYDROLOGY_SCHEMA,
    center: { lat: -49.875, lon: -136.875 },
    rivers: [
      {
        id: 'hydro-reach:v2:basin-a', downstreamReachId: 'hydro-reach:v2:basin-b',
        canonicalFrom: { lat: -49.875, lon: -137.125, elevationM: 124 },
        canonicalTo: { lat: -49.875, lon: -136.875, elevationM: 100 },
        contributingAreaKm2: 1200, dischargeM3s: 8, slope: .001, reachesOcean: false
      },
      {
        id: 'hydro-reach:v2:basin-b', downstreamReachId: null,
        canonicalFrom: { lat: -49.875, lon: -136.875, elevationM: 100 },
        canonicalTo: { lat: -49.875, lon: -136.625, elevationM: -71 },
        contributingAreaKm2: 2400, dischargeM3s: 16, slope: .004, reachesOcean: true
      }
    ],
    summary: { riverSegments: 2 },
    truth: { planetAnchoredGrid: true }
  };
  const basinEngine = new basinRouting.BasinRoutingEngine({ maximumReachStates: 64 });
  const basinStepOne = basinEngine.advance(basinColumns, basinSector, 1, {
    profileId: 'temperate', startDay: 118, captureTimeDays: .02
  });
  assert.equal(basinStepOne.receipt.inletReceipts.length, 1, 'one land Earth cell enters its canonical main reach');
  assert.equal(basinStepOne.receipt.inletReceipts[0].sender.debitedKg, basinStepOne.receipt.inletReceipts[0].receiver.creditedKg, 'paired sender and receiver inlet receipts carry identical mass');
  assert.ok(basinStepOne.columns[0].routing.runoffQueueMm < 10 && basinEngine.status('temperate').storedWaterKg > 0, 'Earth-cell runoff becomes persistent river storage');
  assert.equal(basinStepOne.columns[0].routing.lastDownstreamReachId, 'hydro-reach:v2:basin-a', 'source column retains exact canonical inlet lineage');
  assert.ok(Math.abs(basinStepOne.receipt.conservation.waterResidualKg) < .1, 'Earth-cell to reach capture closes the cross-scale water ledger');
  const basinStepTwo = basinEngine.advance(basinStepOne.columns, basinSector, 1, {
    profileId: 'temperate', startDay: 119, captureTimeDays: .02
  });
  assert.ok(basinStepTwo.receipt.routeReceipts.some(receipt => receipt.schema === basinRouting.RIVER_REACH_TRANSFER_SCHEMA && receipt.destinationReachId === 'hydro-reach:v2:basin-b'), 'stored water advances through the downstream canonical reach');
  assert.ok(Math.abs(basinStepTwo.receipt.conservation.waterResidualKg) < .1, 'reach-to-reach transfer conserves the combined ledger');
  const oceanSalinityBeforeMouth = basinStepTwo.columns[2].ocean.salinityPsu;
  const oceanFreshwaterBeforeMouth = basinStepTwo.columns[2].ocean.freshwaterAnomalyMm;
  const basinStepThree = basinEngine.advance(basinStepTwo.columns, basinSector, 1, {
    profileId: 'temperate', startDay: 120, captureTimeDays: .02
  });
  const mouthReceipt = basinStepThree.receipt.routeReceipts.find(receipt => receipt.schema === basinRouting.OCEAN_MOUTH_RECEIPT_SCHEMA);
  assert.ok(mouthReceipt && mouthReceipt.deliveredFreshwaterKg > 0, 'loaded ocean mouth emits a typed freshwater delivery receipt');
  assert.ok(basinStepThree.columns[2].ocean.freshwaterAnomalyMm > oceanFreshwaterBeforeMouth, 'receipted river water enters the loaded ocean freshwater reservoir');
  assert.ok(basinStepThree.columns[2].ocean.salinityPsu < oceanSalinityBeforeMouth, 'river-mouth delivery freshens the receiving mixed layer');
  assert.ok(Math.abs(basinStepThree.receipt.conservation.waterResidualKg) < .1, 'river-to-ocean delivery closes river storage and ocean freshwater together');
  const decoratedBasin = basinEngine.decorateSector(basinSector, 'temperate');
  assert.equal(decoratedBasin.truth.statefulBasinRouting, true, 'streamed hydrology exposes persistent basin state without replacing canonical reaches');
  assert.ok(decoratedBasin.rivers.every(reach => Number.isFinite(reach.channelStorageKg) && Number.isFinite(reach.routedDischargeM3s)), 'every loaded reach exposes bounded channel state diagnostics');
  const basinSave = basinEngine.snapshot();
  const restoredBasin = new basinRouting.BasinRoutingEngine({ maximumReachStates: 64, state: basinSave });
  assert.deepEqual(restoredBasin.snapshot(), basinSave, 'river reach storage, clocks and latest receipts survive exact restore');
  assert.throws(() => basinEngine.advance(basinStepThree.columns, basinSector, .25, { profileId: 'glacial', startDay: 121 }), /profile does not match/, 'basin routing refuses mixed condition history');
  assert.throws(() => basinEngine.advance(basinStepThree.columns, basinSector, .25, { profileId: 'temperate', startDay: 120 }), /clock does not match/, 'basin routing refuses a rewound transport clock');

  const basinForwardEngine = new basinRouting.BasinRoutingEngine({ maximumReachStates: 64 });
  const basinReverseEngine = new basinRouting.BasinRoutingEngine({ maximumReachStates: 64 });
  const basinForward = basinForwardEngine.advance(basinColumns, basinSector, .5, { profileId: 'temperate', startDay: 118 });
  const basinReverse = basinReverseEngine.advance([...basinColumns].reverse(), { ...basinSector, rivers: [...basinSector.rivers].reverse() }, .5, { profileId: 'temperate', startDay: 118 });
  assert.equal(basinForward.receipt.digest, basinReverse.receipt.digest, 'cross-scale basin receipt is invariant to caller column and reach ordering');
  assert.deepEqual(basinForward.columns, basinReverse.columns, 'cross-scale basin state applies simultaneously and order-invariantly');

  const boundaryEngine = new basinRouting.BasinRoutingEngine({ maximumReachStates: 64 });
  const boundarySector = {
    ...basinSector,
    rivers: [{ ...basinSector.rivers[0], downstreamReachId: 'hydro-reach:v2:not-loaded' }],
    summary: { riverSegments: 1 }
  };
  const boundaryFirst = boundaryEngine.advance(basinColumns, boundarySector, 1, { profileId: 'temperate', startDay: 118, captureTimeDays: .02 });
  const boundarySecond = boundaryEngine.advance(boundaryFirst.columns, boundarySector, 1, { profileId: 'temperate', startDay: 119, captureTimeDays: .02 });
  assert.ok(boundarySecond.receipt.boundaryReceipts.some(receipt => receipt.reason === 'downstream-reach-not-loaded' && receipt.retainedWaterKg > 0), 'unloaded downstream reach emits a retained-water boundary receipt');
  assert.ok(boundaryEngine.status('temperate').storedWaterKg > 0 && Math.abs(boundarySecond.receipt.conservation.waterResidualKg) < .1, 'unloaded handoff keeps its water in persistent river storage');

  let transportDomain = [];
  for (let latitudeOffset = -1; latitudeOffset <= 1; latitudeOffset++) {
    for (let longitudeOffset = -1; longitudeOffset <= 1; longitudeOffset++) {
      const latitude = 25.375 + latitudeOffset * .25;
      const longitude = -140.875 + longitudeOffset * .25;
      const sample = model.sampleLatLon(latitude, longitude, { profile: 'temperate' });
      const weather = seasonalWeather.buildSeasonalWeather(latitude, longitude, sample, { dayOfYear: 156, profile: 'temperate' });
      const column = earthSystem.createEarthSystemColumn(latitude, longitude, sample, weather, { day: 156, profile: 'temperate' });
      const index = transportDomain.length;
      column.atmosphere.precipitableWaterMm = 7 + index * 6;
      column.atmosphere.cloudWaterMm = (index % 3) * 1.5;
      column.atmosphere.airTemperatureC = -4 + index * 4;
      setAtmospherePressure(column, 960 + index * 12);
      if (column.land) {
        column.land.groundwaterStorageMm = column.substrate.aquiferCapacityMm * (.12 + index * .075);
        column.land.waterTableDepthM = column.substrate.aquiferDepthM * (1 - (.12 + index * .075));
      }
      transportDomain.push(column);
    }
  }
  assert.equal(new Set(transportDomain.map(column => Math.round(earthTransport.earthCellAreaM2(column)))).size, 3, 'north-south transport rows retain distinct spherical cell areas');
  for (let transportStep = 0; transportStep < 16; transportStep++) {
    const result = earthTransport.transportEarthSystemColumns(transportDomain, .25);
    assert.equal(result.receipt.activeEdgeCount, 12, 'three-by-three canonical domain owns twelve unique cardinal edges');
    assert.equal(result.receipt.boundaryReceipts.length, 12, 'three-by-three canonical domain exposes twelve perimeter boundaries');
    assert.ok(Math.abs(result.receipt.conservation.atmosphereWaterResidualKg) < .1, 'multi-edge atmospheric water remains conservative');
    assert.ok(Math.abs(result.receipt.conservation.atmosphereCloudWaterResidualKg) < .1, 'multi-edge cloud liquid remains conservative');
    assert.ok(Math.abs(result.receipt.conservation.atmosphereDryAirResidualKg) < .1, 'multi-edge dry-air column mass remains conservative');
    assert.ok(Math.abs(result.receipt.conservation.atmosphereEastwardMomentumResidualKgMps) < 1e5, 'multi-edge eastward momentum closes after declared pressure forcing');
    assert.ok(Math.abs(result.receipt.conservation.atmosphereNorthwardMomentumResidualKgMps) < 1e5, 'multi-edge northward momentum closes after declared pressure forcing');
    assert.equal(result.receipt.atmosphereCoriolisReceipts.length, 9, 'multi-edge rotation emits one Coriolis receipt per loaded atmospheric column');
    assert.ok(result.receipt.transfers.momentumMixingDissipationJ >= -1e4, 'multi-edge carried-momentum mixing cannot hide material kinetic-energy creation');
    assert.ok(Math.abs(result.receipt.transfers.coriolisWorkJ) < 1e7, 'multi-edge Coriolis deflection remains materially energy-neutral');
    assert.ok(Math.abs(result.receipt.conservation.atmosphereKineticEnergyResidualJ) < 1e9, 'multi-edge kinetic energy closes after explicit mixing, pressure and rotation terms');
    assert.ok(Math.abs(result.receipt.conservation.groundwaterResidualKg) < .1, 'multi-edge aquifer exchange remains conservative');
    assert.ok(Math.abs(result.receipt.conservation.atmosphereHeatResidualJ) < 1e6, 'multi-edge atmospheric energy remains conservative');
    assert.ok(Math.abs(result.receipt.conservation.atmosphereMoistEnthalpyResidualJ) < 1e7, 'multi-edge moist enthalpy remains conservative');
    assert.ok(result.columns.every(column => column.atmosphere.precipitableWaterMm >= .2 && column.atmosphere.precipitableWaterMm <= 75 && column.atmosphere.cloudWaterMm >= 0 && column.atmosphere.cloudWaterMm <= 12), 'multi-edge vapor and cloud-liquid reservoirs remain bounded');
    assert.ok(result.columns.every(column => column.atmosphere.surfacePressureHpa >= 850 && column.atmosphere.surfacePressureHpa <= 1085 && column.atmosphere.windSpeedMps <= 90), 'multi-edge pressure mass and vector wind remain bounded');
    assert.ok(result.columns.filter(column => column.land).every(column => column.land.groundwaterStorageMm >= 0 && column.land.groundwaterStorageMm <= column.substrate.aquiferCapacityMm), 'multi-edge aquifers remain inside pore capacity');
    transportDomain = result.columns;
  }
  assert.throws(() => earthTransport.transportEarthSystemColumns([
    transportLandColumns[0], { ...transportLandColumns[1], profileId: 'arid' }
  ], .25), /cannot mix condition profiles/, 'transport graph refuses mixed condition histories');
  const staleTransport = earthTransport.transportEarthSystemColumns([
    transportLandColumns[0], { ...transportLandColumns[1], lastDay: 155 }
  ], .25);
  assert.equal(staleTransport.receipt.activeEdgeCount, 0, 'time-misaligned cells never exchange hidden future state');
  assert.equal(staleTransport.receipt.skippedEdges[0].reason, 'column-time-mismatch', 'time-misaligned edge emits an explicit refusal receipt');
  const transportEngine = new earthSystem.EarthSystemEngine({ seed: model.PLANET_DEFAULTS.seed, profileId: 'temperate', maximumColumns: 4 });
  transportLandCoordinates.forEach(([latitude, longitude], index) => {
    const sample = model.sampleLatLon(latitude, longitude, { profile: 'temperate' });
    const weather = seasonalWeather.buildSeasonalWeather(latitude, longitude, sample, { dayOfYear: 156, profile: 'temperate' });
    transportEngine.advanceAt(latitude, longitude, sample, weather, 156, { profile: 'temperate' });
  });
  transportEngine.commitTransport('temperate', 156, transportedLand.columns, transportedLand.receipt);
  const transportSave = transportEngine.snapshot();
  const restoredTransportEngine = new earthSystem.EarthSystemEngine({ seed: model.PLANET_DEFAULTS.seed, profileId: 'temperate', maximumColumns: 4, state: transportSave });
  assert.deepEqual(restoredTransportEngine.snapshot(), transportSave, 'transport clock, receipt and exchanged reservoirs survive save/restore exactly');
  assert.throws(() => restoredTransportEngine.commitTransport('temperate', 155, transportedLand.columns, transportedLand.receipt), /transport clock cannot run backward/, 'transport commit refuses replay into an earlier planet day');
  const isolatedProfileEngine = new earthSystem.EarthSystemEngine({ seed: model.PLANET_DEFAULTS.seed, profileId: 'temperate', maximumColumns: 4 });
  const temperateOceanForcing = seasonalWeather.buildSeasonalWeather(-30, -160, oceanSample, { dayOfYear: 121, profile: 'temperate' });
  const glacialOceanSample = model.sampleLatLon(-30, -160, { profile: 'glacial' });
  const glacialOceanForcing = seasonalWeather.buildSeasonalWeather(-30, -160, glacialOceanSample, { dayOfYear: 121, profile: 'glacial' });
  const isolatedTemperateOcean = isolatedProfileEngine.advanceAt(-30, -160, oceanSample, temperateOceanForcing, 121, { profile: 'temperate' });
  const isolatedGlacialOcean = isolatedProfileEngine.advanceAt(-30, -160, glacialOceanSample, glacialOceanForcing, 121, { profile: 'glacial' });
  assert.notEqual(isolatedTemperateOcean.id + isolatedTemperateOcean.profileId, isolatedGlacialOcean.id + isolatedGlacialOcean.profileId, 'condition profiles retain isolated surface-history keys over the same canonical cell');
  assert.ok(isolatedGlacialOcean.surface.temperatureC < isolatedTemperateOcean.surface.temperatureC - 15, 'new glacial cell initializes from glacial water rather than stale temperate heat');
  let conservativeLandSteps = 0, conservativeOceanSteps = 0;
  const profileIds = Object.keys(model.CONDITION_PROFILES);
  for (let index = 0; index < 36; index++) {
    const latitude = -78 + index / 35 * 156;
    const longitude = ((index * 137.507764 + 23) % 360) - 180;
    const profileId = profileIds[index % profileIds.length];
    const sample = model.sampleLatLon(latitude, longitude, { profile: profileId, seed: model.PLANET_DEFAULTS.seed });
    let forcing = seasonalWeather.buildSeasonalWeather(latitude, longitude, sample, { dayOfYear: index * 9.75, profile: profileId });
    let column = earthSystem.createEarthSystemColumn(latitude, longitude, sample, forcing, { day: index * 9.75, profile: profileId });
    for (let step = 1; step <= 12; step++) {
      forcing = seasonalWeather.buildSeasonalWeather(latitude, longitude, sample, { dayOfYear: index * 9.75 + step, profile: profileId });
      column = earthSystem.advanceEarthSystemColumn(column, forcing, sample, 1, {
        livingEnabled: step % 4 !== 0,
        lifeAbundance: model.CONDITION_PROFILES[profileId].lifeAbundance
      });
      assert.ok(Math.abs(column.budget.water.residualMm) < 1e-5, 'adversarial global column closes water budget');
      assert.ok(Math.abs(column.budget.energy.residualJm2) < 1, 'adversarial global column closes energy budget');
      assert.ok(Number.isFinite(column.surface.temperatureC) && column.surface.albedo >= 0 && column.surface.albedo <= 1, 'adversarial global surface stays finite and bounded');
      assert.ok(column.cryosphere.snowWaterEquivalentMm >= 0 && column.cryosphere.seaIceFraction >= 0 && column.cryosphere.seaIceFraction <= 1, 'adversarial cryosphere reservoirs stay bounded');
      if (column.land) {
        conservativeLandSteps++;
        assert.ok(column.land.rootZoneWaterMm >= 0 && column.land.rootZoneWaterMm <= column.substrate.rootCapacityMm + 1e-5, 'global root-zone reservoir stays within pore capacity');
        assert.ok(column.land.deepSoilWaterMm >= 0 && column.land.deepSoilWaterMm <= column.substrate.deepCapacityMm + 1e-5, 'global deep-soil reservoir stays within pore capacity');
        assert.ok(column.land.groundwaterStorageMm >= 0 && column.land.groundwaterStorageMm <= column.substrate.aquiferCapacityMm + 1e-5, 'global aquifer storage stays within capacity');
      } else {
        conservativeOceanSteps++;
        assert.ok(column.ocean.salinityPsu >= 2 && column.ocean.salinityPsu <= 43, 'global ocean salinity stays bounded');
      }
    }
  }
  assert.ok(conservativeLandSteps > 100 && conservativeOceanSteps > 100, 'global conservation sweep covers substantial land and ocean histories');

  const initialDynamics = ecosystemDynamics.initializeDynamics('test-sector', regional, 0);
  const steppedDynamics = ecosystemDynamics.stepDynamics(initialDynamics, summerWeather, 30, { regionalCommunity: regional });
  assert.ok(steppedDynamics.summary.births > 0, 'population stepping records births');
  assert.ok(steppedDynamics.summary.deaths > 0, 'population stepping records mortality');
  assert.equal(Object.values(steppedDynamics.summary.ageCohorts).reduce((sum, value) => sum + value, 0), steppedDynamics.summary.animalPopulationEstimate, 'age cohorts reconcile to regional population');
  assert.notEqual(steppedDynamics.summary.animalPopulationEstimate, ecosystemDynamics.dynamicsSummary(initialDynamics).animalPopulationEstimate, 'population changes over time');
  const emptyHabitat = { ...regional, animalPopulations: [], producerBiomassTons: 0 };
  const displacedDynamics = ecosystemDynamics.stepDynamics(initialDynamics, winterWeather, 10, { regionalCommunity: emptyHabitat });
  assert.ok(displacedDynamics.summary.migrationNet < 0 && displacedDynamics.summary.animalPopulationEstimate > 0, 'habitat loss drives gradual emigration without instant deletion');
  const emptyDynamics = ecosystemDynamics.initializeDynamics('colonization-sector', emptyHabitat, 0);
  const colonizedDynamics = ecosystemDynamics.stepDynamics(emptyDynamics, summerWeather, 30, { regionalCommunity: regional });
  assert.ok(colonizedDynamics.summary.migrationNet > 0 && colonizedDynamics.summary.animalPopulationEstimate > 0, 'newly suitable habitat receives colonists');
  const intervention = ecosystemDynamics.applyIntervention(steppedDynamics.state, { id: 'test-restoration', type: 'restore-habitat', severity: .5, actor: 'selftest' });
  assert.equal(intervention.record.governed, true, 'intervention carries governed boundary');
  assert.equal(intervention.summary.interventionCount, 1, 'intervention persists in dynamics state');
  assert.ok(intervention.state.producerBiomassTons > steppedDynamics.state.producerBiomassTons, 'habitat restoration alters producer state');

  const persistentLiving = new livingModule.LivingSystem({ seed: model.PLANET_DEFAULTS.seed, profileId: 'temperate' });
  const persistentSector = persistentLiving.buildSector(25.46855, -140.963, { dayOfYear: 118 });
  persistentLiving.advance(1);
  persistentLiving.updateSector(persistentSector, seasonalWeather.buildSeasonalWeather(25.46855, -140.963, grasslandSample, { dayOfYear: 119 }), 1);
  persistentLiving.recordIntervention(persistentSector.key, { id: 'test-native', type: 'plant-native', severity: .2, actor: 'selftest' });
  const livingSave = persistentLiving.snapshot();
  const restoredLiving = new livingModule.LivingSystem({ state: livingSave });
  assert.deepEqual(restoredLiving.snapshot(), livingSave, 'visited sector dynamics and interventions survive save restore');

  const plates = geophysics.platesForSeed(model.PLANET_DEFAULTS.seed);
  assert.equal(plates.length, 14, 'fourteen plate provinces');
  assert.equal(new Set(plates.map(plate => plate.id)).size, 14, 'plate ids unique');
  const boundaryTypes = new Set();
  for (let i = 0; i < 200; i++) {
    const y = 1 - i / 199 * 2, radius = Math.sqrt(Math.max(0, 1 - y * y)), angle = Math.PI * (3 - Math.sqrt(5)) * i;
    boundaryTypes.add(geophysics.tectonicSample({ x: Math.cos(angle) * radius, y, z: Math.sin(angle) * radius }).boundaryType);
  }
  ['convergent', 'divergent', 'transform'].forEach(type => assert.ok(boundaryTypes.has(type), `plate catalog includes ${type} boundaries`));

  const drainageA = hydrology.buildHydrologySector(25.536, -140.963, { profile: 'temperate' });
  const drainageB = hydrology.buildHydrologySector(25.536, -140.963, { profile: 'temperate' });
  assert.deepEqual(drainageA, drainageB, 'local hydrology is deterministic');
  assert.ok(drainageA.rivers.length > 20 && drainageA.rivers.length < 800, 'default sector resolves a bounded river network');
  assert.ok(drainageA.rivers.every(river => river.to.elevationM < river.from.elevationM), 'every river reach flows downhill');
  assert.ok(drainageA.rivers.every(river => river.contributingAreaKm2 >= drainageA.riverThresholdKm2), 'river reaches meet catchment threshold');
  assert.equal(drainageA.truth.planetAnchoredGrid, true, 'hydrology is anchored to a canonical planet grid');
  assert.ok(drainageA.rivers.every(river => /^hydro-reach:v2:\d+:\d+$/.test(river.id)), 'river reaches carry stable canonical ids');
  assert.ok(drainageA.rivers.every(river => river.canonicalFrom && river.canonicalTo), 'river reaches retain canonical endpoints');
  assert.ok(drainageA.summary.boundaryHandoffs > 0 && drainageA.handoffs.length === drainageA.summary.boundaryHandoffs, 'sector exposes explicit river-edge handoffs');
  const realBasinColumns = transportDomain.map(column => JSON.parse(JSON.stringify(column)));
  for (const column of realBasinColumns.filter(column => column.kind === 'land')) {
    column.routing.runoffQueueMm = 1;
    column.routing.cumulativeGeneratedRunoffMm = Math.max(1, column.routing.cumulativeGeneratedRunoffMm);
  }
  const realBasinEngine = new basinRouting.BasinRoutingEngine({ maximumReachStates: 512 });
  const realBasinStep = realBasinEngine.advance(realBasinColumns, drainageA, .25, {
    profileId: 'temperate', startDay: 156, captureTimeDays: .2
  });
  const actualReachIds = new Set(drainageA.rivers.map(reach => reach.id));
  assert.ok(realBasinStep.receipt.inletReceipts.length > 0, 'generated 310-reach sector accepts runoff from at least one overlapping loaded Earth cell');
  assert.ok(realBasinStep.receipt.inletReceipts.every(receipt => actualReachIds.has(receipt.receiver.reachId)), 'every real-sector inlet receipt resolves to a generated canonical reach ID');
  assert.ok(Math.abs(realBasinStep.receipt.conservation.waterResidualKg) < .1, 'real generated sector closes its cross-scale inlet ledger');
  let realBasinSweepColumns = realBasinStep.columns;
  for (let basinSweepStep = 1; basinSweepStep <= 12; basinSweepStep++) {
    const swept = realBasinEngine.advance(realBasinSweepColumns, drainageA, .25, {
      profileId: 'temperate', startDay: 156 + basinSweepStep * .25, captureTimeDays: .2
    });
    assert.ok(Math.abs(swept.receipt.conservation.waterResidualKg) < .1, 'repeated real-sector reach routing preserves the combined water ledger');
    assert.ok(swept.columns.every(column => column.routing.runoffQueueMm >= 0), 'repeated real-sector routing keeps every Earth runoff queue non-negative');
    assert.ok(swept.columns.filter(column => column.ocean).every(column => column.ocean.salinityPsu >= 2 && column.ocean.salinityPsu <= 43), 'repeated real-sector mouth updates keep salinity bounded');
    assert.ok(realBasinEngine.snapshot().profiles.every(profile => profile.reaches.every(reach => reach.storageKg >= 0)), 'repeated real-sector routing keeps persistent reach storage non-negative');
    realBasinSweepColumns = swept.columns;
  }
  const realDecoratedBasin = realBasinEngine.decorateSector(drainageA, 'temperate');
  assert.equal(realDecoratedBasin.rivers.length, drainageA.rivers.length, 'state decoration preserves the complete real canonical reach topology');
  assert.ok(realDecoratedBasin.summary.activeChannelReachStates > 0, 'real generated sector exposes its active persistent channel states');
  const adjacentDrainage = hydrology.buildHydrologySector(25.716, -140.963, { profile: 'temperate' });
  const sharedReaches = hydrology.compareSharedReaches(drainageA, adjacentDrainage);
  assert.ok(sharedReaches.length > 100, 'overlapping sectors share substantial canonical river coverage');
  assert.ok(sharedReaches.every(reach => reach.identicalCanonicalEndpoints && reach.identicalRouting && reach.identicalDischarge), 'same cross-sector reaches preserve endpoints, routing and discharge');
  const wetDrainage = hydrology.buildHydrologySector(25.536, -140.963, { profile: 'verdant' });
  const dryDrainage = hydrology.buildHydrologySector(25.536, -140.963, { profile: 'arid' });
  assert.ok(wetDrainage.summary.meanRunoffMm > dryDrainage.summary.meanRunoffMm, 'condition profiles alter runoff');
  const coupledDrainage = hydrology.coupleHydrologyToEarthSystem(drainageA, wetEarthStep);
  assert.equal(coupledDrainage.truth.statefulSurfaceGroundwaterCoupling, true, 'river sector consumes stateful runoff, recharge and baseflow');
  assert.equal(coupledDrainage.rivers.length, drainageA.rivers.length, 'Earth coupling preserves canonical river topology');
  assert.ok(coupledDrainage.rivers.every((reach, index) => reach.id === drainageA.rivers[index].id && reach.dischargeM3s === drainageA.rivers[index].dischargeM3s), 'coupling never rewrites canonical reach identity or annual discharge');
  assert.ok(coupledDrainage.rivers.every(reach => Number.isFinite(reach.currentDischargeM3s) && reach.currentDischargeM3s >= 0), 'every loaded reach receives bounded current discharge');
  assert.equal(coupledDrainage.earthSystem.cellId, wetEarthStep.id, 'hydrology records the exact Earth-system source cell');
  assert.equal(coupledDrainage.summary.currentGroundwaterTableDepthM, wetEarthStep.land.waterTableDepthM, 'river diagnostics expose the coupled water table');

  const frame = physicsContract.createSectorFrame(25.536, -140.963, grasslandSample.elevationM);
  const offset = model.offsetLatLon(25.536, -140.963, 12.5, -7.25);
  const localCoordinate = physicsContract.canonicalToLocal(frame, {
    latitudeDeg: offset.lat, longitudeDeg: offset.lon, elevationM: grasslandSample.elevationM + 340
  });
  const roundTrip = physicsContract.localToCanonical(frame, localCoordinate);
  assert.ok(Math.abs(roundTrip.latitudeDeg - offset.lat) < 1e-9 && Math.abs(roundTrip.longitudeDeg - offset.lon) < 1e-9, 'floating-origin frame round-trips canonical latitude/longitude');
  assert.ok(Math.abs(roundTrip.elevationM - (grasslandSample.elevationM + 340)) < 1e-6, 'floating-origin frame round-trips elevation');
  assert.ok(physicsContract.gravityMagnitude(75, 0) > physicsContract.gravityMagnitude(0, 0), 'radial gravity includes latitude variation');
  assert.ok(physicsContract.gravityMagnitude(25, 10_000) < physicsContract.gravityMagnitude(25, 0), 'gravity weakens with altitude');
  const physicsSector = physicsContract.createPhysicsSectorDescriptor(25.536, -140.963, { sample: grasslandSample, hydrology: drainageA });
  assert.equal(physicsSector.truth.coordinateFrameReady, true, 'loaded sector exposes a usable physics coordinate frame');
  assert.equal(physicsSector.truth.generalRigidBodyEngine, false, 'physics contract does not overclaim a rigid-body engine');
  assert.equal(physicsSector.colliders.rivers.reaches, drainageA.summary.riverSegments, 'physics descriptor receives streamed hydrology');

  const stateStorage = {
    values: new Map(),
    getItem(key) { return this.values.has(key) ? this.values.get(key) : null; },
    setItem(key, value) { this.values.set(key, value); }
  };
  const stateStore = new worldStateModule.WorldStateStore({ storage: stateStorage, key: 'test-v2', legacyKey: 'test-v1' });
  assert.equal(stateStore.load(), null, 'new world lineage begins without invented persisted state');
  const revisionOne = stateStore.commit({ profileId: 'temperate', day: 118 }, { kind: 'selftest-create', actor: 'selftest' }, { expectedRevision: 0 });
  assert.equal(revisionOne.revision, 1, 'first world-state commit creates revision one');
  assert.equal(worldStateModule.validateSaveEnvelope(revisionOne).valid, true, 'revisioned save checksum validates');
  const restoredStore = new worldStateModule.WorldStateStore({ storage: stateStorage, key: 'test-v2', legacyKey: 'test-v1' });
  assert.equal(restoredStore.load().revision, 1, 'revisioned save restores from storage');
  assert.deepEqual(restoredStore.payload(), { day: 118, profileId: 'temperate' }, 'world-state payload survives canonical serialization');
  assert.throws(() => restoredStore.commit({ day: 119 }, { kind: 'stale-write' }, { expectedRevision: 0 }), error => error.code === 'REVISION_CONFLICT', 'stale shared-state proposal is rejected');
  const revisionTwo = restoredStore.commit({ profileId: 'temperate', day: 119 }, { kind: 'advance-clock', actor: 'selftest' }, { expectedRevision: 1 });
  assert.equal(revisionTwo.parentRevision, 1, 'world-state revisions retain parent revision');
  assert.equal(revisionTwo.journal.length, 2, 'world-state keeps a compact event journal');
  assert.notEqual(revisionOne.integrity.checksum, revisionTwo.integrity.checksum, 'world-state checksum changes with revision and payload');

  const hostLocalState = {
    schema: worldStateModule.WORLD_STATE_SCHEMA,
    lineageId: `${model.PLANET_DEFAULTS.id}:${model.PLANET_DEFAULTS.seed}:root`,
    revision: 7,
    payload: {
      profileId: 'temperate', mode: 'surface', day: 119.25, year: 1, livingAgeDays: 42,
      location: { lat: 25.46855, lon: -140.963 },
      layers: { layers: { terrain: true, hydrology: true, atmosphere: true, vegetation: true, fauna: true, decomposers: true } }
    }
  };
  const bootstrap = hostProtocol.createHostBootstrap(hostLocalState);
  assert.equal(bootstrap.schema, 'axm.living-world.create/v1', 'Foundation host bootstrap uses the named-world creation contract');
  assert.equal(bootstrap.worldId, model.PLANET_DEFAULTS.id, 'host bootstrap preserves canonical world identity');
  assert.equal(bootstrap.seed, model.PLANET_DEFAULTS.seed, 'host bootstrap preserves planet seed');
  assert.equal(bootstrap.facts['simulation-anchor'].coordinate.latitudeDeg, 25.46855, 'host bootstrap stores canonical position rather than render coordinates');
  assert.equal(bootstrap.metadata.rulesetsOwnWorld, false, 'host bootstrap refuses ruleset ownership');
  const nearParticipant = hostProtocol.createParticipantEntity({ participantId: 'mike-explorer', seatId: 'seat-1', actorType: 'human', coordinate: { lat: 25.47, lon: -140.96, elevationM: 100 } });
  const farParticipant = hostProtocol.createParticipantEntity({ participantId: 'far-explorer', seatId: 'seat-2', actorType: 'ai', coordinate: { lat: -30, lon: 20, elevationM: 0 } });
  const hostedWorld = {
    schema: 'axm.living-world-state/v1', worldId: model.PLANET_DEFAULTS.id,
    owner: 'living-world-state-server', lineageId: bootstrap.lineageId, seed: bootstrap.seed,
    coordinateReference: bootstrap.coordinateReference, metadata: bootstrap.metadata,
    revision: 3, facts: bootstrap.facts, entities: [nearParticipant, farParticipant], journal: [],
    digest: 'a'.repeat(64)
  };
  assert.equal(hostProtocol.validateHostWorld(hostedWorld).valid, true, 'host validation accepts an identity-bound Caelus world');
  assert.equal(hostProtocol.validateHostWorld({ ...hostedWorld, seed: 1 }).valid, false, 'host validation refuses a different planet seed');
  const hostProjection = hostProtocol.hostWorldToProjection(hostedWorld);
  assert.equal(hostProjection.authoritative, true, 'host projection labels server-owned state authoritative');
  assert.equal(hostProjection.localStateReplacement, false, 'host projection does not silently replace local state');
  const hostPatch = hostProtocol.createHostPatch(hostLocalState, 3, { participantId: 'mike-explorer', seatId: 'seat-1' });
  assert.equal(hostPatch.expectedRevision, 3, 'host proposal carries its exact expected revision');
  assert.equal(hostPatch.applyAuthority, false, 'browser host proposal cannot apply itself');
  assert.equal(hostPatch.operations.filter(operation => operation.type === 'upsert-entity').length, 1, 'host proposal publishes one canonical participant entity');
  assert.ok(!/(?:password|secret|token)/i.test(JSON.stringify(hostPatch)), 'host proposal contains no credential-like fields');
  const subscription = hostProtocol.createSectorSubscription({ subscriberId: 'mike-explorer', lineageId: bootstrap.lineageId, center: { lat: 25.46855, lon: -140.963 }, radiusKm: 120 });
  const selectedEntities = hostProtocol.selectSectorEntities(hostedWorld, subscription);
  assert.equal(selectedEntities.entities.length, 1, 'sector subscription includes nearby canonical entities and excludes distant ones');
  assert.equal(selectedEntities.entities[0].id, nearParticipant.id, 'sector subscription retains stable participant identity');

  let transportWorld = JSON.parse(JSON.stringify(hostedWorld));
  const hostClient = new hostProtocol.FoundationHostClient({
    lineageId: bootstrap.lineageId,
    transport: {
      async getWorld() { return { ok: true, result: transportWorld }; },
      async getChanges(_worldId, since) { return { ok: true, result: { schema: 'axm.living-world-changes/v1', worldId: transportWorld.worldId, lineageId: transportWorld.lineageId, fromRevision: since, toRevision: transportWorld.revision, changes: [], resyncRequired: false } }; },
      async patchWorld(proposal) {
        transportWorld = { ...transportWorld, revision: transportWorld.revision + 1, facts: { ...transportWorld.facts }, entities: [...transportWorld.entities], digest: 'b'.repeat(64) };
        for (const operation of proposal.operations) {
          if (operation.type === 'set-fact') transportWorld.facts[operation.key] = operation.value;
          if (operation.type === 'upsert-entity') {
            const index = transportWorld.entities.findIndex(entity => entity.id === operation.entity.id);
            if (index >= 0) transportWorld.entities[index] = operation.entity; else transportWorld.entities.push(operation.entity);
          }
        }
        return { ok: true, result: { world: transportWorld, event: { revision: transportWorld.revision } } };
      }
    }
  });
  assert.equal((await hostClient.pull()).hostRevision, 3, 'host client pulls the authoritative starting revision');
  assert.equal((await hostClient.pullChanges()).toRevision, 3, 'host client consumes a same-lineage bounded change packet');
  const proposed = await hostClient.propose(hostLocalState, { participantId: 'mike-explorer', seatId: 'seat-1' });
  assert.equal(proposed.projection.hostRevision, 4, 'successful host proposal advances the client revision');
  assert.equal(hostClient.descriptor().authoritative, true, 'attached host client reports authoritative server state');

  const authorityA = new worldAuthority.FoundationAuthorityKernel({ lineageId: bootstrap.lineageId, profileId: 'temperate' });
  const authorityB = new worldAuthority.FoundationAuthorityKernel({ lineageId: bootstrap.lineageId, profileId: 'temperate' });
  const join = { participantId: 'traveler-one', seatId: 'seat-1', actorType: 'human', coordinate: { lat: 25.46855, lon: -140.963 } };
  authorityA.join(join); authorityB.join(join);
  const controllerPacket = { schema: 'axm.controller-input/v1', sessionId: 'session-one', seatId: 'seat-1', seq: 0, axes: [.25, -1, .1, 0], buttons: { sprint: true }, at: 1 };
  authorityA.acceptControllerInput(controllerPacket); authorityB.acceptControllerInput(controllerPacket);
  for (let index = 0; index < 30; index++) { authorityA.step(1 / 30); authorityB.step(1 / 30); }
  assert.deepEqual(authorityA.participant('traveler-one'), authorityB.participant('traveler-one'), 'authoritative fixed-step movement is deterministic');
  const authoritativeTraveler = authorityA.participant('traveler-one');
  assert.notEqual(authoritativeTraveler.coordinate.latitudeDeg, join.coordinate.lat, 'controller intent advances canonical latitude on the host');
  assert.ok(Math.hypot(authoritativeTraveler.velocityEastMps, authoritativeTraveler.velocityNorthMps) <= 8.61, 'authoritative movement remains speed bounded');
  assert.throws(() => authorityA.acceptControllerInput(controllerPacket), /stale or replayed/, 'authority kernel rejects a replayed seat sequence');
  assert.throws(() => authorityA.acceptControllerInput({ ...controllerPacket, seatId: 'seat-9', seq: 1 }), /not bound/, 'authority kernel rejects input from an unbound seat');
  const authorityPatch = authorityA.createPatch(4);
  assert.equal(authorityPatch.operations.filter(operation => operation.type === 'upsert-entity').length, 1, 'authority kernel emits bounded participant upserts');
  assert.equal(authorityPatch.applyAuthority, false, 'authority kernel emits a proposal for the state owner rather than mutating persistence');
  assert.ok(!/(?:password|secret|token)/i.test(JSON.stringify(authorityPatch)), 'authority patch never serializes controller credentials');
  const capacityKernel = new worldAuthority.FoundationAuthorityKernel({ maximumParticipants: 1 });
  capacityKernel.join({ participantId: 'one', seatId: 'seat-1', coordinate: { lat: 0, lon: 0 } });
  assert.throws(() => capacityKernel.join({ participantId: 'two', seatId: 'seat-2', coordinate: { lat: 1, lon: 1 } }), /limit/, 'authority kernel enforces its participant cap');

  console.log(`foundation planet selftest: PASS (2,500+ assertions, ${biomes.size} biomes, ${plates.length} plates, ${drainageA.rivers.length} canonical river reaches, ${sharedReaches.length} shared across adjacent sectors, ${catalog.entryCount} species archetypes)`);
}

run().catch(error => { console.error(error); process.exitCode = 1; });
