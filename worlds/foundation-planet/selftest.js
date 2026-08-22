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
  const pressureColumn = await import(pathToFileURL(path.join(root, 'core', 'pressure-column.mjs')).href);
  const pressureDynamics = await import(pathToFileURL(path.join(root, 'core', 'pressure-dynamics.mjs')).href);
  const phaseThermalEnvelope = await import(pathToFileURL(path.join(root, 'core', 'phase-thermal-envelope.mjs')).href);
  const atmosphereBoundaryEnergy = await import(pathToFileURL(path.join(root, 'core', 'atmosphere-boundary-energy.mjs')).href);
  const surfaceRadiation = await import(pathToFileURL(path.join(root, 'core', 'surface-radiation.mjs')).href);
  const atmosphereCo2Radiation = await import(pathToFileURL(path.join(root, 'core', 'atmosphere-co2-radiation.mjs')).href);
  const landEcology = await import(pathToFileURL(path.join(root, 'core', 'land-ecology.mjs')).href);
  const oceanEcology = await import(pathToFileURL(path.join(root, 'core', 'ocean-ecology.mjs')).href);
  const carbonateSystem = await import(pathToFileURL(path.join(root, 'core', 'carbonate-system.mjs')).href);
  const airSeaCarbonExchange = await import(pathToFileURL(path.join(root, 'core', 'air-sea-carbon-exchange.mjs')).href);
  const deepOcean = await import(pathToFileURL(path.join(root, 'core', 'deep-ocean.mjs')).href);
  const atmosphereBiogeochemistry = await import(pathToFileURL(path.join(root, 'core', 'atmosphere-biogeochemistry.mjs')).href);
  const atmosphereBiogeochemistryVertical = await import(pathToFileURL(path.join(root, 'core', 'atmosphere-biogeochemistry-vertical.mjs')).href);
  const atmosphereBiogeochemistryTransport = await import(pathToFileURL(path.join(root, 'core', 'atmosphere-biogeochemistry-transport.mjs')).href);
  const riverChemistry = await import(pathToFileURL(path.join(root, 'core', 'river-chemistry.mjs')).href);
  const soilBiogeochemistry = await import(pathToFileURL(path.join(root, 'core', 'soil-biogeochemistry.mjs')).href);
  const geomorphicSediment = await import(pathToFileURL(path.join(root, 'core', 'geomorphic-sediment.mjs')).href);
  const floodplain = await import(pathToFileURL(path.join(root, 'core', 'floodplain.mjs')).href);
  const floodplainHabitat = await import(pathToFileURL(path.join(root, 'core', 'floodplain-habitat.mjs')).href);
  const floodEventHistory = await import(pathToFileURL(path.join(root, 'core', 'flood-event-history.mjs')).href);
  const floodplainSuccession = await import(pathToFileURL(path.join(root, 'core', 'floodplain-succession.mjs')).href);
  const floodplainPlantMatter = await import(pathToFileURL(path.join(root, 'core', 'floodplain-plant-matter.mjs')).href);
  const floodplainPlantResources = await import(pathToFileURL(path.join(root, 'core', 'floodplain-plant-resources.mjs')).href);
  const floodplainDecomposition = await import(pathToFileURL(path.join(root, 'core', 'floodplain-decomposition.mjs')).href);
  const floodplainRespiration = await import(pathToFileURL(path.join(root, 'core', 'floodplain-respiration.mjs')).href);
  const floodplainDenitrification = await import(pathToFileURL(path.join(root, 'core', 'floodplain-denitrification.mjs')).href);
  const floodplainNitrification = await import(pathToFileURL(path.join(root, 'core', 'floodplain-nitrification.mjs')).href);
  const floodplainGasExchange = await import(pathToFileURL(path.join(root, 'core', 'floodplain-gas-exchange.mjs')).href);
  const estuaryReactor = await import(pathToFileURL(path.join(root, 'core', 'estuary-reactor.mjs')).href);
  const earthSystem = await import(pathToFileURL(path.join(root, 'core', 'earth-system.mjs')).href);
  const earthTransport = await import(pathToFileURL(path.join(root, 'core', 'earth-transport.mjs')).href);
  const basinRouting = await import(pathToFileURL(path.join(root, 'core', 'basin-routing.mjs')).href);
  const systemAudit = await import(pathToFileURL(path.join(root, 'core', 'system-audit.mjs')).href);
  const experienceProtocol = await import(pathToFileURL(path.join(root, 'core', 'experience-protocol.mjs')).href);
  const ecosystemDynamics = await import(pathToFileURL(path.join(root, 'core', 'ecosystem-dynamics.mjs')).href);
  const physicsContract = await import(pathToFileURL(path.join(root, 'core', 'physics-contract.mjs')).href);
  const worldStateModule = await import(pathToFileURL(path.join(root, 'core', 'world-state.mjs')).href);
  const hostProtocol = await import(pathToFileURL(path.join(root, 'core', 'host-protocol.mjs')).href);
  const worldAuthority = await import(pathToFileURL(path.join(root, 'core', 'world-authority.mjs')).href);
  const surfaceControls = await import(pathToFileURL(path.join(root, 'core', 'surface-controls.mjs')).href);
  const setAtmospherePressure = (column, surfacePressureHpa) => {
    column.atmosphere.surfacePressureHpa = surfacePressureHpa;
    column.atmosphere.boundaryLayerPressureHpa = surfacePressureHpa * .25;
    column.atmosphere.freeTroposphere.pressureThicknessHpa = surfacePressureHpa * .75;
  };
  const seedNativePressureColumnFromCompatibilityBands = column =>
    pressureColumn.reconcilePressureColumnWithLegacy(column, {
      reason: 'selftest-compatibility-band-forcing'
    });
  const pressureBandTemperatureAnomalies = (column, start, end) => {
    const layers = column.atmosphere.pressureColumn.layers.slice(start, end);
    const pressure = layers.reduce((sum, layer) => sum + layer.pressureThicknessHpa, 0);
    const mean = layers.reduce((sum, layer) =>
      sum + layer.airTemperatureC * layer.pressureThicknessHpa, 0) / pressure;
    return layers.map(layer => layer.airTemperatureC - mean);
  };
  const html = read('index.html'), app = read('app.mjs'), styles = read('styles.css');
  const server = fs.readFileSync(path.join(root, '..', '..', 'server.js'), 'utf8');
  const operationsApi = fs.readFileSync(path.join(root, '..', '..', 'shared', 'operations', 'operations-api.js'), 'utf8');
  const multiworldService = fs.readFileSync(path.join(root, '..', '..', 'shared', 'operations', 'multiworld-state-service.js'), 'utf8');

  assert.equal(surfaceControls.surfaceControlsDescription().schema, 'axm.foundation-planet.surface-controls/v1');
  const mouseLookRight = surfaceControls.applySurfaceLook({ yaw: 0, pitch: 0 }, { mouseX: 100 });
  assert.ok(mouseLookRight.yaw > 0, 'moving the mouse right turns the surface camera right');
  const mouseLookUp = surfaceControls.applySurfaceLook({ yaw: 0, pitch: 0 }, { mouseY: -100 });
  assert.ok(mouseLookUp.pitch > 0, 'moving the mouse up looks upward without vertical inversion');
  const keyboardLook = surfaceControls.applySurfaceLook({ yaw: 0, pitch: 0 }, {
    deltaSeconds: 0.1, keys: { ArrowRight: true, ArrowUp: true }
  });
  assert.ok(keyboardLook.yaw > 0 && keyboardLook.pitch > 0, 'arrow keys provide conventional keyboard look');
  const forwardNorth = surfaceControls.surfaceMovementIntent(0, { KeyW: true });
  assert.ok(Math.abs(forwardNorth.x) < 1e-12 && forwardNorth.z < 0, 'W moves along the current camera heading');
  const forwardEast = surfaceControls.surfaceMovementIntent(Math.PI / 2, { KeyW: true });
  assert.ok(forwardEast.x > 0 && Math.abs(forwardEast.z) < 1e-12, 'W follows a right-facing camera');
  const diagonal = surfaceControls.surfaceMovementIntent(0, { KeyW: true, KeyD: true });
  assert.ok(Math.abs(Math.hypot(diagonal.x, diagonal.z) - 1) < 1e-12, 'diagonal movement is normalized');
  const arrowsDoNotWalk = surfaceControls.surfaceMovementIntent(0, { ArrowUp: true, ArrowRight: true });
  assert.deepEqual(arrowsDoNotWalk, { forward: 0, strafe: 0, x: 0, z: 0 }, 'arrow look never also moves the player');
  assert.equal(surfaceControls.isSurfaceControlKey('ArrowLeft'), true, 'surface look keys are captured from browser scrolling');
  assert.equal(surfaceControls.isSurfaceLookKey('ArrowLeft'), true, 'arrow keys receive an initial deterministic look step');
  assert.equal(surfaceControls.isSurfaceLookKey('KeyW'), false, 'movement keys never receive a look step');
  assert.equal(surfaceControls.isSurfaceControlKey('KeyQ'), false, 'unrelated keys remain available to the page');
  assert.match(app, /applySurfaceLook\(surface, \{\s*mouseX: event\.movementX,\s*mouseY: event\.movementY/s, 'runtime mouse look uses the tested standard-direction controller');
  assert.match(app, /surface\.dragging && document\.pointerLockElement !== canvas/, 'runtime retains drag-look when pointer lock is unavailable');
  assert.match(app, /lockRequest\?\.catch\?\.\(\(\) => \{\}\)/, 'pointer-lock refusal is handled because drag-look remains available');
  assert.match(app, /!event\.repeat && isSurfaceLookKey\(event\.code\)/, 'runtime preserves short keyboard-look taps between render frames');
  assert.match(app, /addEventListener\('blur'.+keys\[code\] = false/s, 'runtime clears held controls when window focus is lost');
  assert.match(app, /Profile change failed: \$\{error\.message\}/,
    'condition-profile failures report the error and release the loading curtain instead of remaining stuck');

  assert.equal(manifest.id, 'world.axm.foundation-planet');
  assert.equal(manifest.version, '0.62.0');
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
  assert.equal(manifest.systems.deterministic_renderer_independent_experience_sector_capsule, true);
  assert.equal(manifest.systems.digest_bound_experience_component_provenance, true);
  assert.equal(manifest.systems.observer_player_and_sandbox_experience_leases, true);
  assert.equal(manifest.systems.observer_world_action_proposal_refusal, true);
  assert.equal(manifest.systems.player_world_action_proposals_without_apply_authority, true);
  assert.equal(manifest.systems.detached_sandbox_forks_without_writeback, true);
  assert.equal(manifest.systems.experience_intent_sequence_replay_protection, true);
  assert.equal(manifest.systems.read_only_experience_protocol_integrity_audit, true);
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
  assert.equal(manifest.systems.free_troposphere_horizontal_atmosphere_transport, true);
  assert.equal(manifest.systems.independent_boundary_and_free_troposphere_vector_momentum, true);
  assert.equal(manifest.systems.dry_air_carried_layer_tracer_and_sensible_enthalpy_advection, true);
  assert.equal(manifest.systems.variable_hydrostatic_layer_pressure_partition, true);
  assert.equal(manifest.systems.receipted_terrain_following_geopotential_adjustment_work, true);
  assert.equal(manifest.systems.explicit_updraft_and_compensating_downdraft, true);
  assert.equal(manifest.systems.convective_kinetic_energy_reservoir, true);
  assert.equal(manifest.systems.virtual_temperature_buoyancy_conversion, true);
  assert.equal(manifest.systems.vertical_resolved_energy_conservation, true);
  assert.equal(manifest.systems.persisted_eight_level_pressure_coordinate_atmosphere, true);
  assert.equal(manifest.systems.per_pressure_layer_dry_air_water_heat_and_momentum_state, true);
  assert.equal(manifest.systems.hypsometric_hydrostatic_pressure_interface_heights, true);
  assert.equal(manifest.systems.conservative_two_band_pressure_column_reconciliation, true);
  assert.equal(manifest.systems.persistent_vertical_temperature_substructure, true);
  assert.equal(manifest.systems.v10_to_v11_pressure_column_migration, true);
  assert.equal(manifest.systems.native_pressure_layer_saturation_and_phase_change, true);
  assert.equal(manifest.systems.native_pressure_layer_cloud_liquid_reservoirs, true);
  assert.equal(manifest.systems.native_pressure_layer_cloud_ice_reservoirs, true);
  assert.equal(manifest.systems.native_mixed_phase_cloud_conversion, true);
  assert.equal(manifest.systems.latent_fusion_energy_coupled, true);
  assert.equal(manifest.systems.typed_rain_and_snow_descent_across_native_interfaces, true);
  assert.equal(manifest.systems.receipted_native_precipitation_descent_across_interfaces, true);
  assert.equal(manifest.systems.receipted_adjacent_native_pressure_layer_exchange, true);
  assert.equal(manifest.systems.equal_gross_adjacent_native_dry_air_exchange, true);
  assert.equal(manifest.systems.native_tangent_momentum_mixing_dissipation_to_sensible_heat, true);
  assert.equal(manifest.systems.native_pressure_level_water_moist_enthalpy_momentum_and_energy_closure, true);
  assert.equal(manifest.systems.v11_to_v12_native_pressure_dynamics_migration, true);
  assert.equal(manifest.systems.native_pressure_level_horizontal_transport, true);
  assert.equal(manifest.systems.receipted_native_pressure_layer_dry_air_advection, true);
  assert.equal(manifest.systems.receipted_native_pressure_layer_vapor_cloud_and_sensible_enthalpy_transport, true);
  assert.equal(manifest.systems.receipted_native_pressure_layer_pressure_gradient_forcing, true);
  assert.equal(manifest.systems.receipted_native_pressure_layer_coriolis_deflection, true);
  assert.equal(manifest.systems.native_pressure_layer_horizontal_conservation_ledgers, true);
  assert.equal(manifest.systems.compatibility_band_kinetic_and_geopotential_projection_variance_receipted, true);
  assert.equal(manifest.systems.v12_to_v13_native_horizontal_transport_migration, true);
  assert.equal(manifest.systems.persistent_seven_pressure_interface_vertical_motion_state, true);
  assert.equal(manifest.systems.native_pressure_interface_virtual_temperature_buoyancy, true);
  assert.equal(manifest.systems.native_pressure_interface_pressure_geopotential_conversion, true);
  assert.equal(manifest.systems.native_pressure_interface_vertical_momentum, true);
  assert.equal(manifest.systems.native_pressure_interface_convective_kinetic_energy, true);
  assert.equal(manifest.systems.native_pressure_interface_bulk_entrainment_and_detrainment, true);
  assert.equal(manifest.systems.v13_to_v14_native_pressure_interface_convection_migration, true);
  assert.equal(manifest.systems.v14_to_v15_native_mixed_phase_cloud_migration, true);
  assert.equal(manifest.systems.v15_to_v16_radiative_cryosphere_migration, true);
  assert.equal(manifest.systems.v16_to_v17_land_ecology_migration, true);
  assert.equal(manifest.systems.v17_to_v18_ocean_ecology_migration, true);
  assert.equal(manifest.systems.v18_to_v19_deep_ocean_migration, true);
  assert.equal(manifest.systems
    .v26_to_v27_deep_ocean_alkalinity_migration, true);
  assert.equal(manifest.systems
    .v27_to_v28_mixed_layer_carbonate_diagnostic_migration, true);
  assert.equal(manifest.systems
    .v28_to_v29_carbonate_informed_air_sea_carbon_exchange_migration, true);
  assert.equal(manifest.systems.v19_to_v20_atmosphere_biogeochemistry_migration, true);
  assert.equal(manifest.systems.v20_to_v21_atmosphere_biogeochemistry_transport_migration, true);
  assert.equal(manifest.systems.v21_to_v22_native_layer_atmosphere_biogeochemistry_migration, true);
  assert.equal(manifest.systems.v22_to_v23_native_layer_co2_radiation_migration, true);
  assert.equal(manifest.systems.v23_to_v24_soil_runoff_biogeochemistry_migration, true);
  assert.equal(manifest.systems.v24_to_v25_geomorphic_sediment_migration, true);
  assert.equal(manifest.systems.persistent_eight_level_atmospheric_carbon_oxygen_and_nitrogen, true);
  assert.equal(manifest.systems.surface_biosphere_and_estuary_gas_exchange_to_lowest_native_layer, true);
  assert.equal(manifest.systems.seven_interface_native_atmospheric_gas_mixing, true);
  assert.equal(manifest.systems.native_layer_specific_atmospheric_gas_advection, true);
  assert.equal(manifest.systems.native_layer_atmospheric_gas_conservation_ledgers, true);
  assert.equal(manifest.systems.loaded_atmospheric_carbon_oxygen_and_nitrogen_gas_transport, true);
  assert.equal(manifest.systems.native_dry_air_route_backed_gas_advection, true);
  assert.equal(manifest.systems.simultaneous_order_invariant_atmospheric_gas_transport, true);
  assert.equal(manifest.systems.area_weighted_atmospheric_gas_domain_conservation, true);
  assert.equal(manifest.systems.native_eight_level_co2_radiative_coupling, true);
  assert.equal(manifest.systems.reference_neutral_bounded_grey_gas_co2_feedback, true);
  assert.equal(manifest.systems.co2_surface_longwave_adjustment_in_energy_ledger, true);
  assert.equal(manifest.systems.deterministic_read_only_system_integrity_audit, true);
  assert.equal(manifest.systems
    .mixed_deep_ocean_alkalinity_integrity_audited, true);
  assert.equal(manifest.systems
    .mixed_layer_carbonate_diagnostic_integrity_audited, true);
  assert.equal(manifest.systems
    .carbonate_informed_air_sea_carbon_exchange_integrity_audited, true);
  assert.equal(manifest.systems.audit_detects_corrupted_required_evidence, true);
  assert.equal(manifest.systems.audit_distinguishes_unobserved_optional_seams, true);
  assert.equal(manifest.systems.persistent_local_atmospheric_carbon_oxygen_and_nitrogen_gas, true);
  assert.equal(manifest.systems.authoritative_atmosphere_biosphere_gas_accounting, true);
  assert.equal(manifest.systems.ecology_gas_fields_are_compatibility_mirrors, true);
  assert.equal(manifest.systems.persistent_mixed_layer_carbon_oxygen_nitrogen_and_phosphorus, true);
  assert.equal(manifest.systems.read_only_mixed_layer_carbonate_equilibrium_diagnostic, true);
  assert.equal(manifest.systems.mixed_layer_total_scale_ph_within_declared_open_ocean_envelope, true);
  assert.equal(manifest.systems.mixed_layer_carbonate_species_mass_closure_checked, true);
  assert.equal(manifest.systems.mixed_layer_carbonate_alkalinity_residual_checked, true);
  assert.equal(manifest.systems.mixed_layer_carbonate_out_of_envelope_typed_refusal, true);
  assert.equal(manifest.systems.mixed_layer_carbonate_phosphate_alkalinity_included, true);
  assert.equal(manifest.systems
    .weiss_1974_co2_solubility_and_virial_fugacity_correction, true);
  assert.equal(manifest.systems
    .weiss_price_1980_seawater_vapor_pressure_correction, true);
  assert.equal(manifest.systems
    .carbonate_informed_air_sea_co2_equilibrium_proposal, true);
  assert.equal(manifest.systems
    .paired_atmosphere_to_mixed_layer_dic_owner_move, true);
  assert.equal(manifest.systems.air_sea_carbon_typed_zero_flux_refusal, true);
  assert.equal(manifest.systems.air_sea_carbon_sender_bounds_checked, true);
  assert.equal(manifest.systems.persistent_phytoplankton_zooplankton_and_detritus, true);
  assert.equal(manifest.systems.light_temperature_ice_nitrogen_and_phosphorus_limited_marine_primary_production, true);
  assert.equal(manifest.systems.oxygen_limited_marine_respiration_and_remineralization, true);
  assert.equal(manifest.systems.local_air_sea_carbon_and_oxygen_exchange, true);
  assert.equal(manifest.systems.physical_ocean_chemistry_continues_when_life_disabled, true);
  assert.equal(manifest.systems.conservative_loaded_ocean_biogeochemical_tracer_mixing, true);
  assert.equal(manifest.systems.persistent_deep_ocean_carbon_nitrogen_phosphorus_and_oxygen, true);
  assert.equal(manifest.systems.persistent_deep_ocean_alkalinity, true);
  assert.equal(manifest.systems.conservative_mixed_to_deep_alkalinity_exchange,
    true);
  assert.equal(manifest.systems.conservative_mixed_to_deep_dissolved_exchange, true);
  assert.equal(manifest.systems.sinking_detrital_carbon_nitrogen_and_phosphorus_export, true);
  assert.equal(manifest.systems.oxygen_limited_deep_ocean_remineralization, true);
  assert.equal(manifest.systems.persistent_seafloor_organic_carbon_nitrogen_and_phosphorus_burial, true);
  assert.equal(manifest.systems.persistent_canonical_river_carbon_nitrogen_phosphorus_and_oxygen, true);
  assert.equal(manifest.systems.persistent_dissolved_soil_water_carbon_nitrogen_phosphorus_and_oxygen, true);
  assert.equal(manifest.systems.persistent_runoff_carbon_nitrogen_phosphorus_and_oxygen_queue, true);
  assert.equal(manifest.systems.water_fraction_coupled_runoff_biogeochemistry_mobilization, true);
  assert.equal(manifest.systems.exact_soil_to_runoff_queue_sender_debits_and_receiver_credits, true);
  assert.equal(manifest.systems.exact_runoff_queue_to_land_river_and_ocean_sender_debits_and_receiver_credits, true);
  assert.equal(manifest.systems.exact_reach_to_reach_chemistry_sender_debits_and_receiver_credits, true);
  assert.equal(manifest.systems.exact_river_to_estuary_chemistry_sender_debits_and_partitioned_receiver_credits, true);
  assert.equal(manifest.systems.finite_clay_silt_sand_and_gravel_surface_ownership, true);
  assert.equal(manifest.systems.water_coupled_parameterized_surface_erosion, true);
  assert.equal(manifest.systems.persistent_runoff_mineral_sediment_queue, true);
  assert.equal(manifest.systems.runoff_sediment_moves_with_same_water_fraction, true);
  assert.equal(manifest.systems.exact_runoff_sediment_queue_to_land_river_and_coast_receipts, true);
  assert.equal(manifest.systems.persistent_river_suspended_and_bed_mineral_sediment, true);
  assert.equal(manifest.systems.grain_selective_river_bed_deposition, true);
  assert.equal(manifest.systems.grain_selective_coastal_mineral_deposition, true);
  assert.equal(manifest.systems.coupled_land_river_coast_sediment_conservation_checked, true);
  assert.equal(manifest.systems.unloaded_river_handoff_sediment_is_retained, true);
  assert.equal(manifest.systems.basin_v5_to_v6_geomorphic_sediment_migration, true);
  assert.equal(manifest.systems.persistent_reach_floodplain_water_chemistry_and_mineral_sediment, true);
  assert.equal(manifest.systems.geometry_derived_bankfull_overbank_exchange, true);
  assert.equal(manifest.systems.finite_floodplain_recession_return_flow, true);
  assert.equal(manifest.systems.grain_selective_floodplain_deposition, true);
  assert.equal(manifest.systems.coupled_channel_floodplain_conservation_checked, true);
  assert.equal(manifest.systems.unloaded_reach_floodplain_state_is_retained, true);
  assert.equal(manifest.systems.basin_v6_to_v7_floodplain_migration, true);
  assert.equal(manifest.systems.persistent_floodplain_wet_dry_hydroperiod_and_pulse_memory, true);
  assert.equal(manifest.systems.normalized_floodplain_habitat_potential_mosaic, true);
  assert.equal(manifest.systems.floodplain_habitat_reads_material_without_mutation, true);
  assert.equal(manifest.systems.floodplain_habitat_integrity_audited, true);
  assert.equal(manifest.systems.unloaded_reach_floodplain_habitat_memory_is_retained, true);
  assert.equal(manifest.systems.basin_v7_to_v8_floodplain_habitat_migration, true);
  assert.equal(manifest.systems.persistent_bounded_flood_event_chronicle, true);
  assert.equal(manifest.systems.flood_event_magnitude_duration_and_material_payload, true);
  assert.equal(manifest.systems.flood_event_history_reads_material_without_mutation, true);
  assert.equal(manifest.systems.bounded_recent_flood_event_archive, true);
  assert.equal(manifest.systems.flood_event_duration_and_recurrence_statistics, true);
  assert.equal(manifest.systems.flood_event_history_integrity_audited, true);
  assert.equal(manifest.systems.unloaded_reach_flood_event_history_is_retained, true);
  assert.equal(manifest.systems.basin_v8_to_v9_flood_event_history_migration, true);
  assert.equal(manifest.systems.persistent_floodplain_functional_guild_succession, true);
  assert.equal(manifest.systems.finite_floodplain_seed_bank_juvenile_and_mature_cover, true);
  assert.equal(manifest.systems.floodplain_succession_binds_habitat_and_event_receipts, true);
  assert.equal(manifest.systems.floodplain_seed_and_cover_transition_ledgers, true);
  assert.equal(manifest.systems.floodplain_living_cover_competition_bounded, true);
  assert.equal(manifest.systems.flood_tolerance_mortality_and_post_flood_recovery, true);
  assert.equal(manifest.systems.floodplain_succession_life_off_dormancy, true);
  assert.equal(manifest.systems.floodplain_succession_integrity_audited, true);
  assert.equal(manifest.systems.unloaded_reach_floodplain_succession_is_retained, true);
  assert.equal(manifest.systems.basin_v9_to_v10_floodplain_succession_migration, true);
  assert.equal(manifest.systems.persistent_floodplain_plant_carbon_and_nitrogen, true);
  assert.equal(manifest.systems.paired_land_ecology_subgrid_biomass_debit, true);
  assert.equal(manifest.systems.material_backed_new_floodplain_succession_cover, true);
  assert.equal(manifest.systems.floodplain_plant_live_standing_dead_and_litter_pools, true);
  assert.equal(manifest.systems.loaded_land_and_floodplain_plant_cn_conservation_checked, true);
  assert.equal(manifest.systems.basin_v10_to_v11_floodplain_plant_matter_migration, true);
  assert.equal(manifest.systems
    .scale_aware_floodplain_plant_matter_mass_closure, true);
  assert.equal(manifest.systems
    .floodplain_plant_matter_per_material_channel_numeric_bounds, true);
  assert.equal(manifest.systems
    .floodplain_plant_matter_measured_residuals_preserved, true);
  assert.equal(manifest.systems.v24_to_v25_basin_receipt_migration, true);
  assert.equal(manifest.systems
    .scale_aware_floodplain_detrital_return_receiver_mass_closure, true);
  assert.equal(manifest.systems
    .floodplain_detrital_return_receiver_per_material_channel_numeric_bounds,
  true);
  assert.equal(manifest.systems
    .floodplain_detrital_return_receiver_measured_residuals_preserved, true);
  assert.equal(manifest.systems.v25_to_v26_basin_receipt_migration, true);
  assert.equal(manifest.systems
    .scale_aware_floodplain_reaction_receipt_mass_closure, true);
  assert.equal(manifest.systems
    .floodplain_reaction_receipt_per_identity_numeric_bounds, true);
  assert.equal(manifest.systems
    .floodplain_reaction_receipt_measured_residuals_preserved, true);
  assert.equal(manifest.systems.v26_to_v27_basin_receipt_migration, true);
  assert.equal(manifest.systems
    .scale_aware_atmosphere_floodplain_gas_exchange_receipt_mass_closure,
  true);
  assert.equal(manifest.systems
    .atmosphere_floodplain_gas_exchange_receipt_per_identity_numeric_bounds,
  true);
  assert.equal(manifest.systems
    .atmosphere_floodplain_gas_exchange_receipt_measured_residuals_preserved,
  true);
  assert.equal(manifest.systems.v27_to_v28_basin_receipt_migration, true);
  assert.equal(manifest.truth
    .floodplain_plant_matter_scale_aware_numeric_closure, true);
  assert.equal(manifest.truth
    .floodplain_plant_matter_per_material_channel_numeric_bounds, true);
  assert.equal(manifest.truth
    .floodplain_plant_matter_measured_residuals_preserved, true);
  assert.equal(manifest.truth
    .floodplain_plant_matter_fixed_absolute_tolerance_only, false);
  assert.equal(manifest.systems.persistent_floodplain_plant_phosphorus_and_tissue_water, true);
  assert.equal(manifest.systems.paired_floodplain_plant_water_phosphorus_uptake, true);
  assert.equal(manifest.systems.paired_plant_mortality_water_return_to_floodplain, true);
  assert.equal(manifest.systems.floodplain_plant_live_standing_dead_litter_phosphorus, true);
  assert.equal(manifest.systems.floodplain_plant_growth_jointly_carbon_nitrogen_phosphorus_water_limited, true);
  assert.equal(manifest.systems.floodplain_plus_plant_water_conservation_checked, true);
  assert.equal(manifest.systems.river_floodplain_plus_plant_phosphorus_conservation_checked, true);
  assert.equal(manifest.systems.floodplain_plant_resources_integrity_audited, true);
  assert.equal(manifest.systems.basin_v11_to_v12_floodplain_plant_resources_migration, true);
  assert.equal(manifest.systems
    .scale_aware_floodplain_plant_resource_mass_closure, true);
  assert.equal(manifest.systems
    .floodplain_plant_resource_per_material_channel_numeric_bounds, true);
  assert.equal(manifest.systems
    .floodplain_plant_resource_measured_residuals_preserved, true);
  assert.equal(manifest.systems.v23_to_v24_basin_receipt_migration, true);
  assert.equal(manifest.truth
    .floodplain_plant_resources_scale_aware_numeric_closure, true);
  assert.equal(manifest.truth
    .floodplain_plant_resources_per_material_channel_numeric_bounds, true);
  assert.equal(manifest.truth
    .floodplain_plant_resources_measured_residuals_preserved, true);
  assert.equal(manifest.truth
    .floodplain_plant_resources_fixed_absolute_tolerance_only, false);
  assert.equal(manifest.systems.persistent_floodplain_detrital_decomposition, true);
  assert.equal(manifest.systems.paired_floodplain_plant_detritus_matter_debit, true);
  assert.equal(manifest.systems.paired_floodplain_plant_detritus_resource_debit, true);
  assert.equal(manifest.systems.paired_local_floodplain_detrital_return_credit, true);
  assert.equal(manifest.systems.only_resource_backed_floodplain_detritus_decomposes, true);
  assert.equal(manifest.systems.floodplain_detrital_carbon_nitrogen_phosphorus_conservation_checked, true);
  assert.equal(manifest.systems.floodplain_decomposition_integrity_audited, true);
  assert.equal(manifest.systems.floodplain_decomposition_life_off_freeze, true);
  assert.equal(manifest.systems.unloaded_reach_floodplain_decomposition_is_retained, true);
  assert.equal(manifest.systems.basin_v12_to_v13_floodplain_decomposition_migration, true);
  assert.equal(manifest.systems.persistent_floodplain_aerobic_respiration, true);
  assert.equal(manifest.systems.paired_local_floodplain_doc_debit_dic_credit, true);
  assert.equal(manifest.systems.floodplain_dissolved_oxygen_consumption, true);
  assert.equal(manifest.systems.oxygen_limited_floodplain_doc_mineralization, true);
  assert.equal(manifest.systems.floodplain_respiration_carbon_and_oxygen_conservation_checked, true);
  assert.equal(manifest.systems.floodplain_respiration_integrity_audited, true);
  assert.equal(manifest.systems.floodplain_respiration_life_off_freeze, true);
  assert.equal(manifest.systems.unloaded_reach_floodplain_respiration_is_retained, true);
  assert.equal(manifest.systems.basin_v13_to_v14_floodplain_respiration_migration, true);
  assert.equal(manifest.systems.persistent_floodplain_denitrification, true);
  assert.equal(manifest.systems.paired_floodplain_doc_din_debit_and_dic_credit, true);
  assert.equal(manifest.systems.paired_native_surface_atmosphere_nitrogen_gas_credit, true);
  assert.equal(manifest.systems.exact_floodplain_denitrification_transfer_identity, true);
  assert.equal(manifest.systems.oxygen_gated_floodplain_denitrification, true);
  assert.equal(manifest.systems.nitrogen_limited_floodplain_denitrification, true);
  assert.equal(manifest.systems.parameterized_reactive_nitrate_equivalent_fraction, false);
  assert.equal(manifest.systems.persistent_river_and_floodplain_nitrate_ammonium, true);
  assert.equal(manifest.systems.dissolved_inorganic_nitrogen_compatibility_sum, true);
  assert.equal(manifest.systems.parameterized_runoff_din_speciation, true);
  assert.equal(manifest.systems.exact_nitrate_ammonium_reach_and_floodplain_transport, true);
  assert.equal(manifest.systems.detrital_nitrogen_credits_floodplain_ammonium, true);
  assert.equal(manifest.systems.nitrate_only_floodplain_denitrification, true);
  assert.equal(manifest.systems.nitrate_ammonium_conservation_checked, true);
  assert.equal(manifest.systems.nitrate_ammonium_integrity_audited, true);
  assert.equal(manifest.systems.floodplain_denitrification_carbon_and_nitrogen_conservation_checked, true);
  assert.equal(manifest.systems.floodplain_denitrification_integrity_audited, true);
  assert.equal(manifest.systems.floodplain_denitrification_life_off_freeze, true);
  assert.equal(manifest.systems.unloaded_reach_floodplain_denitrification_is_retained, true);
  assert.equal(manifest.systems.unloaded_atmosphere_prevents_floodplain_denitrification, true);
  assert.equal(manifest.systems.basin_v16_to_v17_floodplain_denitrification_migration, true);
  assert.equal(manifest.systems.surface_temperature_proxy_responsive_floodplain_denitrification, true);
  assert.equal(manifest.systems.bounded_q10_floodplain_denitrification_response, true);
  assert.equal(manifest.systems.floodplain_denitrification_temperature_response_integrity_audited, true);
  assert.equal(manifest.systems.basin_v17_to_v18_temperature_responsive_denitrification_migration, true);
  assert.equal(manifest.systems.basin_v18_to_v19_nitrate_ammonium_migration, true);
  assert.equal(manifest.systems.persistent_floodplain_nitrification, true);
  assert.equal(manifest.systems.paired_local_floodplain_ammonium_debit_nitrate_credit, true);
  assert.equal(manifest.systems.floodplain_nitrification_dissolved_oxygen_consumption, true);
  assert.equal(manifest.systems.floodplain_nitrification_minimum_oxygen_reserve_honored, true);
  assert.equal(manifest.systems.oxygen_gated_floodplain_nitrification, true);
  assert.equal(manifest.systems.oxygen_limited_floodplain_nitrification, true);
  assert.equal(manifest.systems.surface_temperature_proxy_responsive_floodplain_nitrification, true);
  assert.equal(manifest.systems.bounded_q10_floodplain_nitrification_response, true);
  assert.equal(manifest.systems.exact_floodplain_nitrification_transfer_identity, true);
  assert.equal(manifest.systems.floodplain_nitrification_nitrogen_and_oxygen_conservation_checked, true);
  assert.equal(manifest.systems.floodplain_nitrification_integrity_audited, true);
  assert.equal(manifest.systems.floodplain_nitrification_life_off_freeze, true);
  assert.equal(manifest.systems.unloaded_reach_floodplain_nitrification_is_retained, true);
  assert.equal(manifest.systems.basin_v19_to_v20_floodplain_nitrification_migration, true);
  assert.equal(manifest.systems.persistent_floodplain_alkalinity, true);
  assert.equal(manifest.systems.floodplain_nitrification_alkalinity_demand_diagnostic, false);
  assert.equal(manifest.systems.floodplain_nitrification_alkalinity_material_owner_debited, true);
  assert.equal(manifest.systems.alkalinity_limited_floodplain_nitrification, true);
  assert.equal(manifest.systems.floodplain_denitrification_alkalinity_material_owner_credited, true);
  assert.equal(manifest.systems.estuary_alkalinity_flux_and_cumulative_generation, true);
  assert.equal(manifest.systems.estuary_denitrification_alkalinity_generation, true);
  assert.equal(manifest.systems.end_to_end_alkalinity_conservation_checked, true);
  assert.equal(manifest.systems.end_to_end_alkalinity_integrity_audited, true);
  assert.equal(manifest.systems.basin_v20_to_v21_alkalinity_migration, true);
  assert.equal(manifest.systems
    .basin_v21_to_v22_restored_clock_alignment_checkpoint, true);
  assert.equal(manifest.systems
    .restored_basin_clock_alignment_preserves_material, true);
  assert.equal(manifest.systems
    .restored_basin_clock_alignment_invalidates_stale_receipt, true);
  assert.equal(manifest.systems.restored_basin_clock_alignment_one_shot, true);
  assert.equal(manifest.systems.transactional_browser_local_state_commit, true);
  assert.equal(manifest.systems
    .lossless_compressed_browser_local_state_fallback, true);
  assert.equal(manifest.systems.visible_browser_local_save_failure, true);
  assert.equal(manifest.systems.persistent_floodplain_atmosphere_gas_exchange, true);
  assert.equal(manifest.systems.paired_floodplain_dic_debit_and_dissolved_oxygen_credit, true);
  assert.equal(manifest.systems.paired_native_surface_atmosphere_carbon_credit_and_oxygen_debit, true);
  assert.equal(manifest.systems.paired_floodplain_dic_credit_for_carbon_invasion, true);
  assert.equal(manifest.systems.paired_native_surface_atmosphere_carbon_debit_for_invasion, true);
  assert.equal(manifest.systems.exclusive_floodplain_carbon_exchange_direction_per_transition, true);
  assert.equal(manifest.systems.exact_floodplain_atmosphere_gas_exchange_identity, true);
  assert.equal(manifest.systems.bounded_floodplain_carbon_dioxide_evasion, true);
  assert.equal(manifest.systems.bounded_floodplain_carbon_dioxide_invasion, true);
  assert.equal(manifest.systems.temperature_aware_bidirectional_floodplain_carbon_gradient_exchange, true);
  assert.equal(manifest.systems.bounded_floodplain_oxygen_reaeration, true);
  assert.equal(manifest.systems.floodplain_atmosphere_carbon_and_oxygen_conservation_checked, true);
  assert.equal(manifest.systems.floodplain_atmosphere_gas_exchange_integrity_audited, true);
  assert.equal(manifest.systems.physical_floodplain_gas_exchange_continues_with_life_off, true);
  assert.equal(manifest.systems.unloaded_reach_floodplain_gas_exchange_memory_is_retained, true);
  assert.equal(manifest.systems.basin_v14_to_v15_floodplain_gas_exchange_migration, true);
  assert.equal(manifest.systems.basin_v15_to_v16_bidirectional_floodplain_gas_exchange_migration, true);
  assert.equal(manifest.systems.parameterized_land_runoff_chemistry_boundary, false);
  assert.equal(manifest.systems.persistent_estuary_carbon_nitrogen_and_phosphorus_sediment, true);
  assert.equal(manifest.systems.oxygen_limited_estuary_organic_carbon_respiration, true);
  assert.equal(manifest.systems.estuary_nutrient_retention_and_denitrification, true);
  assert.equal(manifest.systems.estuary_denitrification_to_persistent_atmospheric_nitrogen, true);
  assert.equal(manifest.systems.basin_v2_to_v3_estuary_state_migration, true);
  assert.equal(manifest.truth.upstream_river_chemistry_reservoirs, true);
  assert.equal(manifest.truth.land_biogeochemical_sender_debits_for_runoff_chemistry, true);
  assert.equal(manifest.systems.persistent_snow_age_and_snow_on_sea_ice, true);
  assert.equal(manifest.systems.native_mixed_phase_cloud_optical_depth, true);
  assert.equal(manifest.systems.broadband_cloud_shortwave_and_longwave_feedback, true);
  assert.equal(manifest.systems.dynamic_snow_and_sea_ice_albedo, true);
  assert.equal(manifest.systems.salinity_aware_sea_ice_freezing_point, true);
  assert.equal(manifest.systems.receipted_surface_snow_and_sea_ice_fusion_energy, true);
  assert.equal(manifest.systems.persistent_canopy_root_litter_and_soil_ecology, true);
  assert.equal(manifest.systems.locally_conservative_land_carbon_budget, true);
  assert.equal(manifest.systems.locally_conservative_land_nitrogen_budget, true);
  assert.equal(manifest.systems.physiological_root_zone_transpiration, true);
  assert.equal(manifest.systems.dynamic_canopy_albedo_and_aerodynamic_roughness, true);
  assert.equal(manifest.truth.native_pressure_level_phase_change, true);
  assert.equal(manifest.truth.native_pressure_level_precipitation_descent, true);
  assert.equal(manifest.truth.native_pressure_level_vertical_transport, true);
  assert.equal(manifest.truth.native_pressure_level_adjacent_exchange, true);
  assert.equal(manifest.truth.native_pressure_level_horizontal_transport, true);
  assert.equal(manifest.truth.pressure_level_dynamics_resolved, true);
  assert.equal(manifest.truth.native_pressure_interface_count, 7);
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
  assert.equal(manifest.runtime.earth_system,
    'EIGHT_LEVEL_BOUNDARY_ENERGY_RECEIPTED_THERMAL_HEADROOM_BOUNDED_NATIVE_MIXED_PHASE_CO2_RADIATIVE_CRYOSPHERE_ATMOSPHERE_SOIL_RUNOFF_RIVER_FLOOD_EVENT_HABITAT_SUCCESSION_PLANT_MATTER_RESOURCES_SCALE_AWARE_DETRITAL_RETURN_AND_REACTION_RECEIVER_DECOMPOSITION_RESPIRATION_NITRATE_AMMONIUM_OXYGEN_AND_ALKALINITY_LEDGERED_NITRIFICATION_TEMPERATURE_RESPONSIVE_DENITRIFICATION_ESTUARY_MIXED_DEEP_OCEAN_CARBONATE_INFORMED_AIR_SEA_CARBON_BIOGEOCHEMISTRY_AND_FINITE_GEOMORPHIC_SEDIMENT_V41');
  assert.equal(manifest.seams.earth_system,
    'PERSISTED_BOUNDARY_ENERGY_RECEIPTED_THERMAL_HEADROOM_BOUNDED_NATIVE_MIXED_PHASE_CO2_RADIATIVE_CRYOSPHERE_ATMOSPHERE_SOIL_RUNOFF_RIVER_FLOOD_EVENT_HABITAT_SUCCESSION_PLANT_MATTER_RESOURCES_SCALE_AWARE_DETRITAL_RETURN_AND_REACTION_RECEIVER_DECOMPOSITION_RESPIRATION_NITRATE_AMMONIUM_NITRIFICATION_DENITRIFICATION_AND_ALKALINITY_LEDGER_ESTUARY_MIXED_DEEP_OCEAN_CARBONATE_INFORMED_AIR_SEA_CARBON_BIOGEOCHEMISTRY_AND_FINITE_SEDIMENT_V38');
  assert.equal(manifest.seams.atmosphere_boundary_energy,
    'REQUESTED_APPLIED_AND_NATIVE_ENVELOPE_RECONCILIATION_RECEIPT_V1');
  assert.equal(manifest.seams.atmosphere_phase_thermal_envelope,
    'NEGATIVE_120_TO_70_C_PRE_MATERIAL_MOVE_LATENT_HEADROOM_BOUND_V1');
  assert.deepEqual(manifest.systems.native_layer_temperature_envelope_c,
    [-120, 70]);
  assert.equal(manifest.systems
    .native_phase_changes_temperature_headroom_bounded, true);
  assert.equal(manifest.systems.post_material_temperature_clip_required,
    false);
  assert.equal(manifest.seams.surface_radiation,
    'NATIVE_LIQUID_ICE_AND_LAYER_CO2_BROADBAND_SHORTWAVE_LONGWAVE_RECEIPT_V2');
  assert.equal(manifest.seams.atmosphere_co2_radiation,
    'EIGHT_LEVEL_TEMPERATURE_PATH_REFERENCE_NEUTRAL_BOUNDED_GREY_GAS_RECEIPT_V1');
  assert.equal(manifest.seams.earth_transport,
    'CONSERVATIVE_MIXED_PHASE_EIGHT_LEVEL_ATMOSPHERIC_GAS_OCEAN_RUNOFF_BIOGEOCHEMICAL_AND_SEDIMENT_TRANSPORT_V11');
  assert.equal(manifest.seams.ocean_ecology,
    'PERSISTENT_MIXED_AND_DEEP_OCEAN_CARBON_NITROGEN_PHOSPHORUS_OXYGEN_ALKALINITY_CARBONATE_AIR_SEA_EXCHANGE_AND_PLANKTON_RECEIPT_V6');
  assert.equal(manifest.seams.carbonate_system,
    'READ_ONLY_TOTAL_SCALE_SURFACE_PRESSURE_DIC_ALKALINITY_PHOSPHATE_EQUILIBRIUM_DIAGNOSTIC_V1');
  assert.equal(manifest.seams.air_sea_carbon_exchange,
    'WEISS_1974_WET_AIR_FUGACITY_CARBONATE_CO2_STAR_BOUNDED_PAIRED_OWNER_PROPOSAL_V1');
  assert.equal(manifest.seams.deep_ocean,
    'PERSISTENT_DISSOLVED_ALKALINITY_PARTICLE_REMINERALIZATION_AND_SEAFLOOR_BURIAL_RECEIPT_V2');
  assert.equal(manifest.seams.atmosphere_biogeochemistry,
    'PERSISTENT_EIGHT_LEVEL_CARBON_OXYGEN_NITROGEN_SCALE_AWARE_FLOODPLAIN_GAS_OWNER_SURFACE_VERTICAL_AND_HORIZONTAL_LINEAGE_V4');
  assert.equal(manifest.seams.atmosphere_biogeochemistry_vertical,
    'SEVEN_NATIVE_ADJACENT_INTERFACE_CARBON_OXYGEN_NITROGEN_RECEIPTS_V1');
  assert.equal(manifest.seams.atmosphere_biogeochemistry_transport,
    'PAIRED_NATIVE_LAYER_DRY_AIR_ROUTE_CARBON_OXYGEN_NITROGEN_RECEIPTS_V2');
  assert.equal(manifest.seams.system_audit,
    'READ_ONLY_SCHEMA_CONSERVATION_PHASE_THERMAL_ENVELOPE_SCALE_AWARE_LAND_FLOODPLAIN_PLANT_MATTER_RESOURCE_DETRITAL_RETURN_REACTION_AND_ATMOSPHERE_GAS_RECEIVER_MASS_CARBONATE_AIR_SEA_CARBON_OWNERSHIP_AND_TRUTH_BOUNDARY_AUDIT_V12');
  assert.equal(manifest.seams.land_ecology,
    'PERSISTENT_LOCAL_CARBON_NITROGEN_CANOPY_ROOT_TRANSPIRATION_AND_SCALE_AWARE_SUBGRID_MASS_CLOSURE_RECEIPT_V2');
  assert.equal(manifest.seams.river_chemistry,
    'PERSISTENT_LAND_SENDER_BACKED_DISSOLVED_CARBON_NITRATE_AMMONIUM_PHOSPHORUS_OXYGEN_AND_ALKALINITY_STATE_V4');
  assert.equal(manifest.seams.soil_biogeochemistry,
    'FINITE_DISSOLVED_SOIL_WATER_AND_RUNOFF_QUEUE_CARBON_NITROGEN_PHOSPHORUS_OXYGEN_ALKALINITY_RECEIPTS_V2');
  assert.equal(manifest.seams.geomorphic_sediment,
    'FINITE_GRAIN_SURFACE_RUNOFF_RIVER_BED_AND_COASTAL_SEDIMENT_RECEIPTS_V1');
  assert.equal(manifest.seams.floodplain,
    'PERSISTENT_BANKFULL_OVERBANK_RETURN_GRAIN_DEPOSITION_NITRATE_AMMONIUM_ALKALINITY_TRANSPORT_DENITRIFICATION_GENERATION_AND_NITRIFICATION_DEBIT_RECEIPT_V4');
  assert.equal(manifest.seams.floodplain_habitat,
    'READ_ONLY_WET_DRY_PULSE_HYDROPERIOD_DEPOSIT_AND_NORMALIZED_POTENTIAL_HABITAT_RECEIPT_V1');
  assert.equal(manifest.seams.flood_event_history,
    'BOUNDED_START_CONTINUE_COMPLETE_MAGNITUDE_DURATION_PAYLOAD_AND_RECURRENCE_RECEIPT_V1');
  assert.equal(manifest.seams.floodplain_plant_matter,
    'PAIRED_LAND_ECOLOGY_SUBGRID_LIVE_STANDING_DEAD_LITTER_CARBON_NITROGEN_SCALE_AWARE_PER_CHANNEL_MASS_CLOSURE_RECEIPT_V2');
  assert.equal(manifest.seams.floodplain_plant_resources,
    'PAIRED_FLOODPLAIN_LIVE_WATER_AND_LIVE_STANDING_DEAD_LITTER_PHOSPHORUS_SCALE_AWARE_PER_CHANNEL_MASS_CLOSURE_RECEIPT_V2');
  assert.equal(manifest.seams.floodplain_decomposition,
    'PAIRED_RESOURCE_BACKED_PLANT_DETRITUS_DEBIT_AND_SCALE_AWARE_PER_CHANNEL_LOCAL_FLOODPLAIN_CARBON_NITROGEN_PHOSPHORUS_RETURN_RECEIVER_V2');
  assert.equal(manifest.seams.floodplain_respiration,
    'OXYGEN_LIMITED_LOCAL_FLOODPLAIN_DOC_TO_DIC_AND_DISSOLVED_OXYGEN_DEBIT_RECEIPT_V1');
  assert.equal(manifest.seams.floodplain_denitrification,
    'PAIRED_SURFACE_TEMPERATURE_RESPONSIVE_OXYGEN_GATED_NITRATE_ONLY_FLOODPLAIN_DOC_NITRATE_TO_DIC_ALKALINITY_AND_NATIVE_SURFACE_ATMOSPHERE_NITROGEN_GAS_RECEIPTS_V4');
  assert.equal(manifest.seams.floodplain_nitrification,
    'PAIRED_SURFACE_TEMPERATURE_RESPONSIVE_OXYGEN_AND_ALKALINITY_GATED_LOCAL_FLOODPLAIN_AMMONIUM_TO_NITRATE_RECEIPTS_V2');
  assert.equal(manifest.seams.floodplain_gas_exchange,
    'PAIRED_BIDIRECTIONAL_SCALE_AWARE_FLOODPLAIN_AND_NATIVE_SURFACE_ATMOSPHERE_CARBON_GRADIENT_AND_OXYGEN_EXCHANGE_RECEIPTS_V3');
  assert.equal(manifest.seams.basin_routing,
    'PERSISTENT_CANONICAL_WATER_CHEMISTRY_NITRATE_AMMONIUM_ALKALINITY_FLOODPLAIN_EVENT_HISTORY_HABITAT_SUCCESSION_SCALE_AWARE_PLANT_MATTER_RESOURCE_DETRITAL_RETURN_REACTION_AND_ATMOSPHERE_GAS_RECEIVER_CLOSURE_DECOMPOSITION_RESPIRATION_NITRIFICATION_DENITRIFICATION_GAS_EXCHANGE_ESTUARY_ATMOSPHERE_AND_GRAIN_SEDIMENT_ROUTING_V27');
  assert.equal(manifest.seams.estuary_reactor,
    'PERSISTENT_SEDIMENT_OXYGEN_LIMITED_CNP_AND_ALKALINITY_REACTION_RECEIPT_V2');
  assert.equal(manifest.truth.persistent_estuary_sediment_reservoirs, true);
  assert.equal(manifest.truth.estuary_carbon_nitrogen_phosphorus_conservation_checked, true);
  assert.equal(manifest.truth.explicit_estuary_atmospheric_gas_receiver, true);
  assert.equal(manifest.truth.finite_surface_mineral_sediment_ownership, true);
  assert.equal(manifest.truth.persistent_runoff_mineral_sediment_queue, true);
  assert.equal(manifest.truth.runoff_sediment_same_water_fraction, true);
  assert.equal(manifest.truth.persistent_river_suspended_and_bed_sediment, true);
  assert.equal(manifest.truth.persistent_coastal_mineral_sediment, true);
  assert.equal(manifest.truth.geomorphic_sediment_conservation_checked, true);
  assert.equal(manifest.truth.persistent_floodplain_water_chemistry_and_mineral_sediment, true);
  assert.equal(manifest.truth.channel_floodplain_conservation_checked, true);
  assert.equal(manifest.truth.persistent_floodplain_habitat_memory, true);
  assert.equal(manifest.truth.floodplain_habitat_potential_only, true);
  assert.equal(manifest.truth.floodplain_habitat_material_observer_read_only, true);
  assert.equal(manifest.truth.floodplain_habitat_fractions_normalized, true);
  assert.equal(manifest.truth.floodplain_habitat_ecological_population_state, false);
  assert.equal(manifest.truth.floodplain_habitat_plant_biomass_state, false);
  assert.equal(manifest.truth.floodplain_habitat_species_occupancy_state, false);
  assert.equal(manifest.truth.persistent_bounded_flood_event_history, true);
  assert.equal(manifest.truth.flood_event_history_material_observer_read_only, true);
  assert.equal(manifest.truth.flood_event_history_exchange_evidence_bound, true);
  assert.equal(manifest.truth.flood_event_history_archive_limit, 32);
  assert.equal(manifest.truth.scientific_flood_frequency_model, false);
  assert.equal(manifest.truth.persistent_floodplain_vegetation_succession, true);
  assert.equal(manifest.truth.floodplain_succession_functional_guild_demography, true);
  assert.equal(manifest.truth.floodplain_succession_seed_bank_and_cover_ledgers, true);
  assert.equal(manifest.truth.floodplain_succession_habitat_and_event_evidence_bound, true);
  assert.equal(manifest.truth.floodplain_succession_competition_bounded, true);
  assert.equal(manifest.truth.floodplain_succession_parameterized_external_seed_rain, true);
  assert.equal(manifest.truth.floodplain_succession_material_authority, false);
  assert.equal(manifest.truth.floodplain_succession_plant_biomass_material_ownership, false);
  assert.equal(manifest.truth.persistent_floodplain_plant_carbon_and_nitrogen, true);
  assert.equal(manifest.truth.floodplain_plant_matter_paired_land_ecology_subgrid_partition, true);
  assert.equal(manifest.truth.floodplain_plant_matter_phosphorus_ownership, false);
  assert.equal(manifest.truth.floodplain_plant_matter_water_ownership, false);
  assert.equal(manifest.truth.floodplain_plant_matter_decomposition_and_respiration_coupling, true);
  assert.equal(manifest.truth.persistent_floodplain_detrital_decomposition, true);
  assert.equal(manifest.truth.floodplain_decomposition_exact_sender_receiver_transfer_ids, true);
  assert.equal(manifest.truth.floodplain_decomposition_only_resource_backed_detritus_eligible, true);
  assert.equal(manifest.truth.floodplain_decomposition_local_chemistry_receiver, true);
  assert.equal(manifest.truth
    .floodplain_detrital_return_receiver_scale_aware_numeric_closure, true);
  assert.equal(manifest.truth
    .floodplain_detrital_return_receiver_per_material_channel_numeric_bounds,
  true);
  assert.equal(manifest.truth
    .floodplain_detrital_return_receiver_measured_residuals_preserved, true);
  assert.equal(manifest.truth
    .floodplain_detrital_return_receiver_fixed_absolute_tolerance_only,
  false);
  assert.equal(manifest.truth
    .floodplain_reaction_receipts_scale_aware_numeric_closure, true);
  assert.equal(manifest.truth
    .floodplain_reaction_receipts_per_identity_numeric_bounds, true);
  assert.equal(manifest.truth
    .floodplain_reaction_receipts_measured_residuals_preserved, true);
  assert.equal(manifest.truth
    .floodplain_reaction_receipts_fixed_absolute_tolerance_only, false);
  assert.equal(manifest.truth
    .atmosphere_floodplain_gas_exchange_scale_aware_numeric_closure, true);
  assert.equal(manifest.truth
    .atmosphere_floodplain_gas_exchange_per_identity_numeric_bounds, true);
  assert.equal(manifest.truth
    .atmosphere_floodplain_gas_exchange_measured_residuals_preserved, true);
  assert.equal(manifest.truth
    .atmosphere_floodplain_gas_exchange_fixed_absolute_tolerance_only, false);
  assert.equal(manifest.truth.floodplain_decomposition_independent_material_creation, false);
  assert.equal(manifest.truth.floodplain_decomposition_atmospheric_respiration, false);
  assert.equal(manifest.truth.floodplain_decomposition_oxygen_consumption, false);
  assert.equal(manifest.truth.floodplain_decomposition_soil_receiver, false);
  assert.equal(manifest.truth.floodplain_decomposition_microbe_population_state, false);
  assert.equal(manifest.truth.scientific_floodplain_decomposition_model, false);
  assert.equal(manifest.truth.persistent_floodplain_aerobic_respiration, true);
  assert.equal(manifest.truth.floodplain_decomposition_respiration_coupled_via_owned_doc_pool, true);
  assert.equal(manifest.truth.floodplain_respiration_exact_local_doc_dic_and_oxygen_transfer_ids, true);
  assert.equal(manifest.truth.floodplain_respiration_local_doc_to_dic_carbon_conservation_checked, true);
  assert.equal(manifest.truth.floodplain_respiration_local_oxygen_stoichiometry_checked, true);
  assert.equal(manifest.truth
    .floodplain_respiration_scale_aware_numeric_closure, true);
  assert.equal(manifest.truth
    .floodplain_respiration_per_identity_numeric_bounds, true);
  assert.equal(manifest.truth
    .floodplain_respiration_measured_residuals_preserved, true);
  assert.equal(manifest.truth.floodplain_respiration_oxygen_limited, true);
  assert.equal(manifest.truth.floodplain_respiration_atmosphere_exchange, false);
  assert.equal(manifest.truth.floodplain_respiration_anaerobic_pathway, false);
  assert.equal(manifest.truth.floodplain_respiration_microbe_population_state, false);
  assert.equal(manifest.truth.scientific_floodplain_respiration_model, false);
  assert.equal(manifest.truth.persistent_floodplain_denitrification, true);
  assert.equal(manifest.truth.floodplain_denitrification_exact_owner_transfer_ids, true);
  assert.equal(manifest.truth.floodplain_denitrification_carbon_nitrogen_conservation_checked, true);
  assert.equal(manifest.truth
    .floodplain_denitrification_scale_aware_numeric_closure, true);
  assert.equal(manifest.truth
    .floodplain_denitrification_per_identity_numeric_bounds, true);
  assert.equal(manifest.truth
    .floodplain_denitrification_measured_residuals_preserved, true);
  assert.equal(manifest.truth.floodplain_denitrification_native_atmosphere_surface_layer, true);
  assert.equal(manifest.truth.floodplain_denitrification_oxygen_gated, true);
  assert.equal(manifest.truth.floodplain_denitrification_nitrogen_limited, true);
  assert.equal(manifest.truth.floodplain_denitrification_reactive_nitrate_equivalent_parameterized, false);
  assert.equal(manifest.truth.floodplain_denitrification_surface_temperature_proxy_responsive, true);
  assert.equal(manifest.truth.floodplain_denitrification_q10_temperature_response_parameterized, true);
  assert.equal(manifest.truth.persistent_floodplain_water_temperature_state, false);
  assert.equal(manifest.truth.resolved_floodplain_freeze_thaw_state, false);
  assert.equal(manifest.truth.arrhenius_floodplain_denitrification_kinetics_resolved, false);
  assert.equal(manifest.truth.floodplain_dissolved_inorganic_nitrogen_treated_as_fully_nitrate, false);
  assert.equal(manifest.truth.floodplain_denitrification_nitrate_speciation_resolved, true);
  assert.equal(manifest.truth.persistent_river_and_floodplain_nitrate_ammonium_pools, true);
  assert.equal(manifest.truth.dissolved_inorganic_nitrogen_is_nitrate_plus_ammonium, true);
  assert.equal(manifest.truth.runoff_din_speciation_parameterized_at_receiver, true);
  assert.equal(manifest.truth.runoff_din_speciation_measured, false);
  assert.equal(manifest.truth.exact_nitrate_ammonium_water_fraction_transport, true);
  assert.equal(manifest.truth.detrital_nitrogen_returns_to_ammonium, true);
  assert.equal(manifest.truth.nitrate_ammonium_conservation_checked, true);
  assert.equal(manifest.truth.floodplain_denitrification_nitrate_only, true);
  assert.equal(manifest.truth.floodplain_denitrification_consumes_ammonium, false);
  assert.equal(manifest.truth.floodplain_nitrite_pool_resolved, false);
  assert.equal(manifest.truth.persistent_floodplain_nitrification, true);
  assert.equal(manifest.truth.floodplain_nitrification_reaction_modeled, true);
  assert.equal(manifest.truth.floodplain_nitrification_ammonium_to_nitrate, true);
  assert.equal(manifest.truth.floodplain_nitrification_one_step_approximation, true);
  assert.equal(manifest.truth.floodplain_nitrification_exact_owner_transfer_ids, true);
  assert.equal(manifest.truth.floodplain_nitrification_dissolved_oxygen_debited, true);
  assert.equal(manifest.truth.floodplain_nitrification_minimum_oxygen_reserve_honored, true);
  assert.equal(manifest.truth.floodplain_nitrification_nitrogen_and_oxygen_conservation_checked, true);
  assert.equal(manifest.truth
    .floodplain_nitrification_scale_aware_numeric_closure, true);
  assert.equal(manifest.truth
    .floodplain_nitrification_per_identity_numeric_bounds, true);
  assert.equal(manifest.truth
    .floodplain_nitrification_measured_residuals_preserved, true);
  assert.equal(manifest.truth.floodplain_nitrification_surface_temperature_proxy_responsive, true);
  assert.equal(manifest.truth.floodplain_nitrification_q10_temperature_response_parameterized, true);
  assert.equal(manifest.truth.floodplain_nitrification_alkalinity_demand_diagnostic, false);
  assert.equal(manifest.truth.floodplain_nitrification_alkalinity_material_owner_debited, true);
  assert.equal(manifest.truth.floodplain_nitrification_alkalinity_limited, true);
  assert.equal(manifest.truth.floodplain_denitrification_alkalinity_material_owner_credited, true);
  assert.equal(manifest.truth.estuary_denitrification_alkalinity_generated, true);
  assert.equal(manifest.truth.end_to_end_alkalinity_ledger_audited, true);
  assert.equal(manifest.truth
    .persistent_soil_runoff_river_floodplain_and_ocean_alkalinity_with_estuary_flux,
  true);
  assert.equal(manifest.truth.measured_alkalinity_claimed, false);
  assert.equal(manifest.truth.carbonate_speciation_resolved, true);
  assert.equal(manifest.truth.ph_resolved, true);
  assert.equal(manifest.truth.carbonate_speciation_scope,
    'mixed-layer-surface-pressure-within-lueker-2000-open-ocean-envelope');
  assert.equal(manifest.truth.carbonate_diagnostic_mutates_material, false);
  assert.equal(manifest.truth.carbonate_ph_scale, 'total-hydrogen-ion');
  assert.equal(manifest.truth.carbonate_phosphate_alkalinity_included, true);
  assert.equal(manifest.truth.carbonate_silicate_alkalinity_included, false);
  assert.equal(manifest.truth.carbonate_fluoride_alkalinity_included, false);
  assert.equal(manifest.truth.carbonate_pressure_corrections_included, false);
  assert.equal(manifest.truth.carbonate_informed_air_sea_co2_exchange, true);
  assert.equal(manifest.truth
    .air_sea_co2_wet_air_partial_pressure_included, true);
  assert.equal(manifest.truth.air_sea_co2_fugacity_nonideality_included, true);
  assert.equal(manifest.truth
    .air_sea_carbon_combined_owner_conservation_checked, true);
  assert.equal(manifest.truth.scientific_air_sea_gas_transfer_velocity, false);
  assert.equal(manifest.truth.measured_air_sea_pco2, false);
  assert.equal(manifest.truth.measured_ocean_skin_temperature, false);
  assert.equal(manifest.truth.species_resolved_marine_ph_response, false);
  assert.equal(manifest.truth.deep_ocean_ph_resolved, false);
  assert.equal(manifest.truth.carbonate_ph_feedback_modeled, false);
  assert.equal(manifest.truth.deep_ocean_alkalinity_exchange, true);
  assert.equal(manifest.truth.deep_ocean_alkalinity_explicit_zero_migration,
    true);
  assert.equal(manifest.truth.persistent_deep_ocean_alkalinity, true);
  assert.equal(manifest.truth.mixed_to_deep_alkalinity_conservation_checked,
    true);
  assert.equal(manifest.truth.floodplain_nitrification_ph_feedback_modeled, false);
  assert.equal(manifest.truth.floodplain_nitrification_microbe_population_state, false);
  assert.equal(manifest.truth.scientific_floodplain_nitrification_model, false);
  assert.equal(manifest.truth.floodplain_denitrification_microbe_population_state, false);
  assert.equal(manifest.truth.mechanistic_floodplain_redox_model, false);
  assert.equal(manifest.truth.scientific_floodplain_denitrification_model, false);
  assert.equal(manifest.truth.persistent_floodplain_atmosphere_gas_exchange, true);
  assert.equal(manifest.truth.floodplain_gas_exchange_exact_owner_transfer_ids, true);
  assert.equal(manifest.truth.floodplain_gas_exchange_carbon_oxygen_conservation_checked, true);
  assert.equal(manifest.truth
    .floodplain_gas_exchange_scale_aware_numeric_closure, true);
  assert.equal(manifest.truth
    .floodplain_gas_exchange_per_identity_numeric_bounds, true);
  assert.equal(manifest.truth
    .floodplain_gas_exchange_measured_residuals_preserved, true);
  assert.equal(manifest.truth.floodplain_gas_exchange_native_atmosphere_surface_layer, true);
  assert.equal(manifest.truth.floodplain_gas_exchange_physical_with_life_off, true);
  assert.equal(manifest.truth.floodplain_gas_exchange_bidirectional_carbon_gradient_parameterized, true);
  assert.equal(manifest.truth.floodplain_gas_exchange_bidirectional_henry_law, false);
  assert.equal(manifest.truth.resolved_floodplain_air_water_turbulence, false);
  assert.equal(manifest.truth.scientific_floodplain_gas_exchange_model, false);
  assert.equal(manifest.truth.floodplain_succession_species_occupancy_state, false);
  assert.equal(manifest.truth.scientific_floodplain_succession_model, false);
  assert.equal(manifest.truth.resolved_floodplain_inundation_hydraulics, false);
  assert.equal(manifest.truth.scientific_flood_forecast, false);
  assert.equal(manifest.truth.scientific_erosion_model, false);
  assert.equal(manifest.truth.mechanistic_soil_formation, false);
  assert.equal(manifest.truth.resolved_channel_morphodynamics, false);
  assert.equal(manifest.truth.resolved_coastal_morphodynamics, false);
  assert.equal(manifest.truth.global_sediment_network, false);
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
  assert.equal(manifest.truth.two_layer_cloud_phase_change_model, false);
  assert.equal(manifest.truth.two_band_phase_change_compatibility_projection, true);
  assert.equal(manifest.truth.atmospheric_moist_enthalpy_conservation_checked, true);
  assert.equal(manifest.truth.resolved_cloud_microphysics, false);
  assert.equal(manifest.truth.native_mixed_phase_cloud_radiation, true);
  assert.equal(manifest.truth.dynamic_cryosphere_albedo, true);
  assert.equal(manifest.truth.cryosphere_fusion_energy_conservation_checked, true);
  assert.equal(manifest.truth.snow_age_and_snow_on_sea_ice_persisted, true);
  assert.equal(manifest.truth.persistent_land_ecology_pools, true);
  assert.equal(manifest.truth.local_land_carbon_conservation_checked, true);
  assert.equal(manifest.truth.local_land_nitrogen_conservation_checked, true);
  assert.equal(manifest.truth.physiological_transpiration_coupled, true);
  assert.equal(manifest.truth.dynamic_vegetation_albedo_and_roughness, true);
  assert.equal(manifest.truth.persistent_local_atmospheric_biogeochemistry, true);
  assert.equal(manifest.truth.runtime_integrity_audit_exposed, true);
  assert.equal(manifest.truth.runtime_integrity_audit_mutates_world, false);
  assert.equal(manifest.truth.local_atmosphere_biosphere_gas_conservation_checked, true);
  assert.equal(manifest.truth.ecology_atmospheric_gas_fields_are_compatibility_mirrors, true);
  assert.equal(manifest.truth.native_pressure_layer_atmospheric_biogeochemistry, true);
  assert.equal(manifest.truth.surface_atmospheric_gas_exchange_targets_lowest_native_layer, true);
  assert.equal(manifest.truth.atmospheric_biogeochemistry_vertical_transport, true);
  assert.equal(manifest.truth.atmospheric_biogeochemistry_vertical_conservation_checked, true);
  assert.equal(manifest.truth.atmospheric_biogeochemistry_horizontal_transport, true);
  assert.equal(manifest.truth.atmospheric_biogeochemistry_horizontal_layer_conservation_checked, true);
  assert.equal(manifest.truth.whole_column_average_atmospheric_gas_advection, false);
  assert.equal(manifest.truth.atmospheric_biogeochemistry_transport_loaded_domain_only, true);
  assert.equal(manifest.truth.atmospheric_biogeochemistry_transport_conservation_checked, true);
  assert.equal(manifest.truth.globally_mixed_atmospheric_biogeochemistry, false);
  assert.equal(manifest.truth.globally_mixed_atmospheric_co2, false);
  assert.equal(manifest.truth.native_layer_co2_radiative_coupling, true);
  assert.equal(manifest.truth.co2_surface_longwave_feedback, true);
  assert.equal(manifest.truth.broadband_grey_gas_co2_parameterization, true);
  assert.equal(manifest.truth.line_by_line_co2_absorption, false);
  assert.equal(manifest.truth.scientific_atmospheric_radiative_transfer, false);
  assert.equal(manifest.truth.persistent_ocean_ecology_pools, true);
  assert.equal(manifest.truth.persistent_deep_ocean_reservoirs, true);
  assert.equal(manifest.truth.mixed_to_deep_material_conservation_checked, true);
  assert.equal(manifest.truth.local_ocean_carbon_conservation_checked, true);
  assert.equal(manifest.truth.local_ocean_nitrogen_conservation_checked, true);
  assert.equal(manifest.truth.local_ocean_phosphorus_conservation_checked, true);
  assert.equal(manifest.truth.local_ocean_oxygen_flux_ledger_checked, true);
  assert.equal(manifest.truth.loaded_ocean_biogeochemical_transport, true);
  assert.equal(manifest.truth.local_air_sea_gas_exchange, true);
  assert.equal(manifest.truth.physical_ocean_chemistry_with_life_off, true);
  assert.equal(manifest.truth.globally_mixed_atmospheric_oxygen, false);
  assert.equal(manifest.truth.upstream_river_chemistry_reservoirs, true);
  assert.equal(manifest.truth.three_dimensional_ocean_circulation, false);
  assert.equal(manifest.truth.mechanistic_plankton_biochemistry, false);
  assert.equal(manifest.truth.mechanistic_plant_biochemistry, false);
  assert.equal(manifest.truth.resolved_plant_individuals, false);
  assert.equal(manifest.truth.spectral_radiative_transfer, false);
  assert.equal(manifest.truth.dynamic_sea_ice_motion, false);
  assert.equal(manifest.truth.vertical_convection_model, true);
  assert.equal(manifest.truth.bounded_two_layer_vertical_exchange, false);
  assert.equal(manifest.truth.bounded_two_layer_convective_overturning_model, false);
  assert.equal(manifest.truth.bounded_two_layer_buoyancy_conversion_resolved, false);
  assert.equal(manifest.truth.convective_kinetic_energy_persisted, true);
  assert.equal(manifest.truth.vertical_resolved_energy_conservation_checked, true);
  assert.equal(manifest.truth.persisted_pressure_coordinate_column, true);
  assert.equal(manifest.truth.pressure_coordinate_layer_count, 8);
  assert.equal(manifest.truth.pressure_column_hydrostatic_interfaces_checked, true);
  assert.equal(manifest.truth.pressure_column_conservative_projection_checked, true);
  assert.equal(manifest.truth.vertical_temperature_substructure_persisted, true);
  assert.equal(manifest.truth.pressure_level_dynamics_resolved, true);
  assert.equal(manifest.truth.native_pressure_level_phase_change, true);
  assert.equal(manifest.truth.native_pressure_level_vertical_transport, true);
  assert.equal(manifest.truth.independent_layer_atmospheric_momentum, true);
  assert.equal(manifest.truth.variable_hydrostatic_layer_pressure_partition, true);
  assert.equal(manifest.truth.vertical_momentum_exchange_conservation_checked, true);
  assert.equal(manifest.truth.terrain_following_geopotential_adjustment_receipted, true);
  assert.equal(manifest.truth.resolved_three_dimensional_convection, false);
  assert.equal(manifest.truth.buoyancy_and_gravitational_work_resolved, true);
  assert.equal(manifest.truth.full_atmospheric_buoyancy_and_gravitational_work_resolved, false);
  assert.equal(manifest.truth.upper_air_horizontal_transport, true);
  assert.equal(manifest.truth.global_angular_momentum_model, false);
  assert.equal(manifest.truth.atmospheric_transport_coupled_to_local_precipitation_budget, true);
  assert.equal(manifest.truth.runoff_discarded_at_sparse_boundary, false);
  assert.equal(manifest.truth.global_river_to_ocean_network, false);
  assert.equal(manifest.truth.loaded_canonical_basin_routing, true);
  assert.equal(manifest.truth.river_water_discarded_at_unloaded_handoff, false);
  assert.equal(manifest.truth.experience_capsule_renderer_independent, true);
  assert.equal(manifest.truth.experience_capsule_is_canonical_world_state, false);
  assert.equal(manifest.truth
    .restored_basin_clock_alignment_reconstructs_history, false);
  assert.equal(manifest.truth.runtime_basin_clock_mismatch_masked, false);
  assert.equal(manifest.truth
    .browser_save_revision_advances_before_storage_success, false);
  assert.equal(manifest.truth.browser_save_failures_silenced, false);
  assert.equal(manifest.truth.experience_capsule_has_world_mutation_authority, false);
  assert.equal(manifest.truth.observer_can_propose_world_actions, false);
  assert.equal(manifest.truth.player_can_propose_world_actions, true);
  assert.equal(manifest.truth.player_can_apply_world_actions, false);
  assert.equal(manifest.truth.detached_sandbox_can_write_back, false);
  assert.equal(manifest.truth.detached_sandbox_can_promote_itself, false);
  assert.equal(manifest.truth.mirror_experience_connection_active, false);
  assert.equal(manifest.truth.holodeck_experience_connection_active, false);
  assert.equal(manifest.truth.experiment_world_connection_active, false);
  assert.equal(registry.worlds.filter(world => world.id === manifest.id).length, 1, 'foundation planet registered exactly once');
  assert.equal(registry.worlds.filter(world => world.id === 'world.grafthold.globe').length, 1, 'original living globe remains registered');

  assert.ok(html.includes('id="lifeMaster"'), 'living master UI');
  assert.ok(html.includes('./app.mjs?v=0.62.0-r62.1'),
    'the browser entry requests the coherent R62 atmosphere-owner closure graph');
  assert.ok(html.includes('id="profileSelect"'), 'replaceable condition UI');
  assert.ok(html.includes('id="riverHandoffs"') && html.includes('id="physicsFrame"') && html.includes('id="persistenceRevision"') && html.includes('id="hostAuthority"'), 'continuity, physics, persistence and host diagnostics');
  assert.ok(html.includes('id="earthCell"') && html.includes('id="waterBudget"') && html.includes('id="energyBudget"') && html.includes('id="radiationBudget"') && html.includes('id="co2RadiativeFeedback"') && html.includes('id="cryospherePhase"') && html.includes('id="seaIce"'), 'Earth-system reservoirs, cloud and CO2 radiation, frozen-phase energy and conservation are visible');
  assert.ok(html.includes('id="marineProductivity"') && html.includes('id="marineCarbon"') && html.includes('id="marineNutrients"') && html.includes('id="marineCarbonate"') && html.includes('id="marineAirSeaCarbon"') && html.includes('id="marineOxygen"'), 'marine productivity, C/N/P/O2, bounded carbonate and air-sea equilibrium evidence are visible');
  assert.ok(html.includes('id="transportDomain"') && html.includes('id="transportWater"') && html.includes('id="transportClosure"'), 'neighbor transport graph and conservation are visible');
  assert.ok(html.includes('id="atmosphereWater"') && html.includes('id="atmosphereBiogeochemistry"') && html.includes('id="atmosphereGasProfile"') && html.includes('id="atmosphereGasTransport"') && html.includes('id="integrityAudit"') && html.includes('id="runoffQueue"') && html.includes('id="mineralSediment"') && html.includes('id="runoffDestination"'), 'closed atmospheric water, eight-level atmospheric gases, runtime integrity, runoff routing, and finite sediment are visible');
  assert.ok(html.includes('id="experienceSeam"'), 'renderer-independent observer/player/sandbox experience membrane is visible');
  assert.ok(html.includes('id="channelStorage"') && html.includes('id="floodplainStorage"') && html.includes('id="floodplainHabitat"') && html.includes('id="floodEvents"') && html.includes('id="floodplainSuccession"') && html.includes('id="floodplainPlantMatter"') && html.includes('id="floodplainPlantResources"') && html.includes('id="floodplainDecomposition"') && html.includes('id="floodplainRespiration"') && html.includes('id="floodplainDenitrification"') && html.includes('id="floodplainGasExchange"') && html.includes('id="channelChemistry"') && html.includes('id="estuaryStorage"') && html.includes('id="channelClosure"') && html.includes('id="riverMouth"') && html.includes('id="marineDeepOcean"'), 'persistent channel, floodplain material, event, habitat, living succession, plant C/N/P/water, decomposition, aerobic respiration, denitrification and paired gas exchange state are visible');
  assert.ok(html.includes('id="airMassRoute"') && html.includes('id="momentumClosure"'), 'dry-air transport and tangent-momentum closure are visible');
  assert.ok(html.includes('id="rotationDeflection"') && html.includes('id="kineticClosure"'), 'Coriolis deflection and atmospheric kinetic-energy closure are visible');
  assert.ok(html.includes('id="cloudPhaseChange"') && html.includes('id="verticalAtmosphere"') && html.includes('id="pressureColumn"') && html.includes('id="convectiveExchange"') && html.includes('id="buoyancyConversion"') && html.includes('id="upperAirTransport"') && html.includes('id="layerWindShear"') && html.includes('id="geopotentialClosure"') && html.includes('id="moistEnthalpyClosure"'), 'pressure-column, phase, overturning, buoyancy conversion, upper transport, wind shear, geopotential and moist-enthalpy closure are visible');
  assert.ok(app.includes('lastPressureColumnDynamicsReceipt') && app.includes('adjacentExchangeReceipts'),
    'live diagnostics consume the native phase/descent/adjacent-exchange receipt');
  assert.ok(app.includes("from '/shared/vendor/three-r160/three.module.js'"), 'local Three.js renderer');
  assert.ok(app.includes('window.AXMFoundationPlanet'), 'read-only world API');
  assert.ok(app.includes('options.commit !== false') &&
    app.includes('{ allowMarine: true }') &&
    app.includes('{ commit: false }'),
  'orbital hover previews do not commit world coordinates and view toggles preserve marine expeditions');
  assert.ok(app.includes('SURFACE_SIZE_KM = 120'), 'bounded local surface stream');
  assert.ok(app.includes('buildHydrologySector'), 'hydrology is integrated into surface streaming');
  assert.ok(app.includes('EarthSystemEngine') && app.includes('coupleHydrologyToEarthSystem') && app.includes('earthSystemColumn'), 'stateful Earth system is integrated into runtime, rivers and read API');
  assert.ok(app.includes('transportEarthSystemColumns') && app.includes('synchronizeEarthTransportDomain') && app.includes('earthTransportDescription'), 'canonical neighbor transport is integrated into runtime and read API');
  assert.ok(app.includes('reconcileRestoredClock') &&
    app.includes('basinRoutingStatus') &&
    app.includes('persistenceEncoding') &&
    app.includes('SAVE FAILED'),
  'the live API exposes the restored-clock checkpoint and honest browser-save status read-only');
  assert.ok(app.includes("AXMFoundationPlanet/v58") && app.includes('plantMatterMaximumResidualKg') && app.includes('plantMatterMaximumToleranceKg') && app.includes('floodplainPlantMatterMassClosurePolicy') && app.includes('plantSenderMaximumResidualKg') && app.includes('plantSenderMaximumToleranceKg') && app.includes('floodplainPlantResourceMaximumResidualKg') && app.includes('floodplainPlantResourceMaximumToleranceKg') && app.includes('floodplainPlantResourceMassClosurePolicy') && app.includes('landEcologyMassClosurePolicy') && app.includes('boundaryNativeEnvelopeReconciliationJm2') && app.includes('lastBoundaryEnergyReceipt') && app.includes('thermalEnvelopeLimitCount') && app.includes('maximumThermallyRejectedRequestMm') && app.includes('auditFoundationSystem') && app.includes('currentSystemAudit') && app.includes('atmosphereGasProfile') && app.includes('atmosphereGasTransport') && app.includes('lastPressureColumnDynamicsReceipt') && app.includes('verticalInterfaces') && app.includes('adjacentExchangeReceipts') && app.includes('surfaceRainfallMm') && app.includes('surfaceSnowfallMm') && app.includes('cloudIceMm') && app.includes('lastPressureColumnHorizontalTransportReceipt') && app.includes('nativePressureTransportReceipt') && app.includes('lastPressureColumnSyncReceipt') && app.includes('modelTopHeightM') && app.includes('lastVerticalExchangeReceipt') && app.includes('buoyancyWorkJm2') && app.includes('atmosphereGeopotentialEnergyResidualJ') && app.includes('lastBasinRoutingReceipt') && app.includes('basinRoutingDescription') && app.includes('floodplainDescription') && app.includes('floodplainHabitatDescription') && app.includes('floodEventHistoryDescription') && app.includes('floodplainSuccessionDescription') && app.includes('floodplainPlantMatterDescription') && app.includes('floodplainPlantResourcesDescription') && app.includes('floodplainDecompositionDescription') && app.includes('floodplainRespirationDescription') && app.includes('floodplainDenitrificationDescription') && app.includes('floodplainNitrificationDescription') && app.includes('floodplainGasExchangeDescription') && app.includes('floodplainStorage') && app.includes('floodplainHabitat') && app.includes('floodEvents') && app.includes('floodplainSuccession') && app.includes('floodplainPlantMatter') && app.includes('floodplainPlantResources') && app.includes('floodplainDecomposition') && app.includes('floodplainRespiration') && app.includes('floodplainDenitrification') && app.includes('floodplainNitrification') && app.includes('floodplainGasExchange') && app.includes('activeProfileStoredNitrogenSpecies') && app.includes('riverFloodplainNitrateAmmonium') && app.includes('alkalinityKgCaCO3Eq') && app.includes('alkalinityGeneratedKgCaCO3Eq') && app.includes('alkalinityLimitedReachCount') && app.includes('radiationBudget') && app.includes('co2RadiativeFeedback') && app.includes('atmosphereCo2RadiativeCoupling') && app.includes('cryospherePhase') && app.includes('atmosphereBiogeochemistry') && app.includes('canopyPhysiology') && app.includes('carbonFlux') && app.includes('carbonPools') && app.includes('nitrogenCycle') && app.includes('marineProductivity') && app.includes('marineCarbon') && app.includes('marineNutrients') && app.includes('marineCarbonate') && app.includes('marineAirSeaCarbon') && app.includes('mixedLayerCarbonate') && app.includes('airSeaCarbonExchange') && app.includes('marineOxygen') && app.includes('marineDeepOcean') && app.includes('alkalinitySurfaceToDeepKgCaCO3Eqm2') && app.includes('channelChemistry') && app.includes('estuaryStorage') && app.includes('runoffBiogeochemistry') && app.includes('mineralSediment') && app.includes('effectiveSoilDepthM') && app.includes('geomorphicSedimentDescription') && app.includes('createExperienceSectorCapsule') && app.includes('openExperienceLease') && app.includes('dispatchExperienceIntent') && app.includes('auditExperienceProtocol'), 'established systems remain exposed through the current API');
  assert.ok(app.includes("AXMFoundationPlanet/v58") &&
    app.includes('detritalReturnMaximumResidualKg') &&
    app.includes('detritalReturnMaximumToleranceKg') &&
    app.includes('floodplainDetritalReturnMassClosurePolicy'),
  'Rung 60 exposes measured receiver residuals, derived bounds and the typed detrital-return policy');
  assert.ok(app.includes("AXMFoundationPlanet/v57") &&
    app.includes('reactionOwnerNumeric') &&
    app.includes('floodplainReactionMaximumResidualKg') &&
    app.includes('floodplainReactionMaximumToleranceKg') &&
    app.includes('floodplainReactionMassClosurePolicy'),
  'Rung 61 exposes measured reaction-receiver residuals, derived bounds and the shared typed policy');
  assert.ok(app.includes("AXMFoundationPlanet/v58") &&
    app.includes('atmosphereGasExchangeNumeric') &&
    app.includes('atmosphereFloodplainGasExchangeMaximumResidualKg') &&
    app.includes('atmosphereFloodplainGasExchangeMaximumToleranceKg') &&
    app.includes('atmosphereFloodplainGasExchangeMassClosurePolicy'),
  'Rung 62 exposes measured atmosphere-owner residuals, derived bounds and its typed policy');
  assert.ok(app.includes('conditionTransitioning') && app.includes('if (conditionTransitioning && !force) return'), 'condition replacement cannot mix a new profile ID with the previous surface sample');
  assert.ok(app.includes('probeFoundationHost') && app.includes('proposeHostBootstrap') && app.includes('createSectorSubscription'), 'read-only API exposes explicit named-host proposals and sector subscriptions');
  assert.ok(operationsApi.includes("'/api/living-worlds'") && operationsApi.includes("'/api/living-world/create'"), 'Workshop exposes named-world catalog and explicit creation endpoints');
  assert.ok(multiworldService.includes("const CREATE_SCHEMA = 'axm.living-world.create/v1'") && multiworldService.includes("if (worldId === 'living-globe')"), 'multiworld service preserves the Living Globe compatibility slot');
  assert.ok(!/https?:\/\//.test(html + app + styles), 'no remote runtime dependency');
  assert.ok(!/Math\.random\(/.test(app + read('core/planet-model.mjs') + read('core/living-system.mjs')), 'world generation avoids unseeded randomness');
  assert.ok(/["']\.mjs["']\s*:\s*["']text\/javascript; charset=utf-8["']/.test(server), 'Workshop serves planet modules with JavaScript MIME');

  ['app.mjs', 'core/planet-model.mjs', 'core/layer-system.mjs', 'core/living-system.mjs', 'core/geophysics.mjs', 'core/hydrology-model.mjs', 'core/species-catalog.mjs', 'core/community-model.mjs', 'core/seasonal-weather.mjs', 'core/pressure-column.mjs', 'core/phase-thermal-envelope.mjs', 'core/atmosphere-boundary-energy.mjs', 'core/pressure-transport.mjs', 'core/surface-radiation.mjs', 'core/atmosphere-co2-radiation.mjs', 'core/atmosphere-biogeochemistry.mjs', 'core/atmosphere-biogeochemistry-vertical.mjs', 'core/atmosphere-biogeochemistry-transport.mjs', 'core/land-ecology.mjs', 'core/ocean-ecology.mjs', 'core/carbonate-system.mjs', 'core/air-sea-carbon-exchange.mjs', 'core/deep-ocean.mjs', 'core/river-chemistry.mjs', 'core/soil-biogeochemistry.mjs', 'core/geomorphic-sediment.mjs', 'core/floodplain.mjs', 'core/floodplain-habitat.mjs', 'core/flood-event-history.mjs', 'core/floodplain-succession.mjs', 'core/floodplain-plant-matter.mjs', 'core/floodplain-plant-resources.mjs', 'core/floodplain-decomposition.mjs', 'core/floodplain-respiration.mjs', 'core/floodplain-denitrification.mjs', 'core/floodplain-nitrification.mjs', 'core/floodplain-gas-exchange.mjs', 'core/estuary-reactor.mjs', 'core/earth-system.mjs', 'core/earth-transport.mjs', 'core/basin-routing.mjs', 'core/system-audit.mjs', 'core/experience-protocol.mjs', 'core/ecosystem-dynamics.mjs', 'core/physics-contract.mjs', 'core/world-state.mjs', 'core/host-protocol.mjs', 'core/world-authority.mjs'].forEach(file => {
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
  assert.equal(earthColumnA.land.soilBiogeochemistry.schema,
    soilBiogeochemistry.SOIL_BIOGEOCHEMISTRY_STATE_SCHEMA);
  assert.equal(earthColumnA.routing.runoffBiogeochemistryQueue.schema,
    soilBiogeochemistry.RUNOFF_BIOGEOCHEMISTRY_QUEUE_SCHEMA);
  assert.ok(Object.values(earthColumnA.land.soilBiogeochemistry.pools)
    .every(value => value > 0),
  'new land starts with a finite canonical dissolved soil-water C/N/P/O2/alkalinity inventory');
  const limestoneSoil = soilBiogeochemistry.createSoilBiogeochemistry({
    ...grasslandSample, geology: { bedrock: 'sedimentary shale/limestone' }
  }, earthColumnA.substrate, earthColumnA.land.ecology,
  { accessibleWaterMm: 200, temperatureC: 15 });
  const graniteSoil = soilBiogeochemistry.createSoilBiogeochemistry({
    ...grasslandSample, geology: { bedrock: 'exposed granite' }
  }, earthColumnA.substrate, earthColumnA.land.ecology,
  { accessibleWaterMm: 200, temperatureC: 15 });
  assert.ok(limestoneSoil.pools.alkalinityKgCaCO3Eqm2 >
      graniteSoil.pools.alkalinityKgCaCO3Eqm2 &&
    limestoneSoil.truth.measuredAlkalinityClaimed === false &&
    limestoneSoil.truth.pHResolved === false,
  'canonical alkalinity is a deterministic lithology-responsive initial condition, not a measured pH claim');
  const legacySoilV1 = JSON.parse(JSON.stringify(
    earthColumnA.land.soilBiogeochemistry));
  legacySoilV1.schema =
    soilBiogeochemistry.PREVIOUS_SOIL_BIOGEOCHEMISTRY_STATE_SCHEMA;
  delete legacySoilV1.pools.alkalinityKgCaCO3Eqm2;
  const migratedSoilV1 = soilBiogeochemistry.normalizeSoilBiogeochemistry(
    legacySoilV1);
  assert.ok(migratedSoilV1.pools.dissolvedInorganicCarbonKgCm2 ===
      legacySoilV1.pools.dissolvedInorganicCarbonKgCm2 &&
    migratedSoilV1.pools.alkalinityKgCaCO3Eqm2 === 0 &&
    migratedSoilV1.alkalinityMigrationCheckpoint === true,
  'v1 soil migration preserves prior constituents and adds explicit zero alkalinity without invented history');
  const legacyQueueV1 = soilBiogeochemistry
    .emptyRunoffBiogeochemistryQueue();
  legacyQueueV1.schema = soilBiogeochemistry
    .PREVIOUS_RUNOFF_BIOGEOCHEMISTRY_QUEUE_SCHEMA;
  delete legacyQueueV1.pools.alkalinityKgCaCO3Eqm2;
  const migratedQueueV1 = soilBiogeochemistry
    .normalizeRunoffBiogeochemistryQueue(legacyQueueV1);
  assert.equal(migratedQueueV1.pools.alkalinityKgCaCO3Eqm2, 0,
    'v1 runoff-queue migration adds zero alkalinity');
  const standaloneWetMobilization = soilBiogeochemistry
    .mobilizeSoilBiogeochemistry(
      earthColumnA.land.soilBiogeochemistry,
      earthColumnA.routing.runoffBiogeochemistryQueue,
      25,
      { accessibleWaterMm: 220 }
    );
  assert.ok(Object.values(standaloneWetMobilization.receipt.mobilizedPools)
    .every(value => value > 0));
  assert.ok(Object.values(standaloneWetMobilization.receipt.conservation)
    .every(value => Math.abs(value) < 1e-12),
  'wet soil mobilization exactly debits soil and credits the persistent runoff queue');
  const standaloneDryMobilization = soilBiogeochemistry
    .mobilizeSoilBiogeochemistry(
      standaloneWetMobilization.state,
      standaloneWetMobilization.queue,
      0,
      { accessibleWaterMm: 200 }
    );
  assert.equal(standaloneDryMobilization.receipt.status,
    'no-runoff-no-export');
  assert.ok(Object.values(standaloneDryMobilization.receipt.mobilizedPools)
    .every(value => value === 0),
  'dry steps export no dissolved material');
  const standaloneQueueDebit = soilBiogeochemistry
    .debitRunoffBiogeochemistryQueue(
      standaloneWetMobilization.queue, .4, 1000,
      { transferId: 'selftest-runoff-transfer', sourceCellId: 'source',
        destinationId: 'receiver', destinationKind: 'land' }
    );
  const standaloneQueueCredit = soilBiogeochemistry
    .creditRunoffBiogeochemistryQueue(
      soilBiogeochemistry.emptyRunoffBiogeochemistryQueue(),
      standaloneQueueDebit.poolsKg, 250,
      { transferId: 'selftest-runoff-transfer', sourceCellId: 'source',
        destinationId: 'receiver', waterFraction: .4 }
    );
  assert.equal(standaloneQueueDebit.receipt.transferId,
    standaloneQueueCredit.receipt.transferId);
  assert.ok(Object.values(standaloneQueueDebit.receipt.conservation)
    .every(value => Math.abs(value) < 1e-9) &&
    Object.values(standaloneQueueCredit.receipt.conservation)
      .every(value => Math.abs(value) < 1e-9),
  'area-weighted runoff queue transfer has exact sender and receiver closure');
  const migratedSoilInitialization = soilBiogeochemistry
    .mobilizeSoilBiogeochemistry(
      soilBiogeochemistry.emptyMigratedSoilBiogeochemistry(),
      soilBiogeochemistry.emptyRunoffBiogeochemistryQueue(),
      30,
      {
        sample: grasslandSample,
        substrate: earthColumnA.substrate,
        ecology: earthColumnA.land.ecology,
        accessibleWaterMm: 200,
        temperatureC: earthColumnA.surface.temperatureC
      }
    );
  assert.equal(migratedSoilInitialization.receipt.status,
    'initialized-after-migration-no-export');
  assert.ok(Object.values(migratedSoilInitialization.queue.pools)
    .every(value => value === 0),
  'migration initializes a declared finite soil boundary but fabricates no historical runoff export');

  assert.equal(geomorphicSediment.SURFACE_SEDIMENT_STATE_SCHEMA,
    'axm.foundation-planet.surface-sediment-state/v1');
  assert.equal(geomorphicSediment.RUNOFF_SEDIMENT_QUEUE_SCHEMA,
    'axm.foundation-planet.runoff-sediment-queue/v1');
  assert.equal(geomorphicSediment.RIVER_SEDIMENT_STATE_SCHEMA,
    'axm.foundation-planet.river-sediment-state/v1');
  const freshSurfaceSediment = geomorphicSediment.createSurfaceSediment(
    grasslandSample, earthColumnA.substrate);
  const freshSurfaceTotal = Object.values(
    freshSurfaceSediment.availableKgM2).reduce((sum, value) => sum + value, 0);
  assert.ok(freshSurfaceTotal > 100 &&
    Object.values(freshSurfaceSediment.availableKgM2)
      .every(value => value > 0),
  'new land owns a finite clay/silt/sand/gravel inventory rather than an erosion-rate fiction');
  const wetSedimentErosion = geomorphicSediment.erodeSurfaceSediment(
    freshSurfaceSediment,
    geomorphicSediment.emptyRunoffSedimentQueue(),
    28,
    {
      sample: grasslandSample,
      substrate: earthColumnA.substrate,
      ecology: earthColumnA.land.ecology,
      rainfallMm: 34,
      soilFrozenFraction: 0,
      durationDays: 1
    }
  );
  assert.ok(wetSedimentErosion.receipt.totalMobilizedKgM2 > 0,
    'wet surface runoff mobilizes finite mineral grains');
  assert.ok(Object.values(wetSedimentErosion.receipt.surfaceResidualKgM2)
    .every(value => Math.abs(value) < 1e-8) &&
    Object.values(wetSedimentErosion.receipt.queueResidualKgM2)
      .every(value => Math.abs(value) < 1e-8),
  'surface erosion exactly pairs finite donor debit with runoff-queue credit');
  assert.ok(Object.keys(wetSedimentErosion.receipt.mobilizedKgM2)
    .every(grain => wetSedimentErosion.receipt.mobilizedKgM2[grain] <=
      freshSurfaceSediment.availableKgM2[grain] + 1e-12),
  'erosion cannot export more of any grain than the finite surface donor owns');
  const drySedimentErosion = geomorphicSediment.erodeSurfaceSediment(
    wetSedimentErosion.state, wetSedimentErosion.queue, 0,
    { sample: grasslandSample, substrate: earthColumnA.substrate,
      ecology: earthColumnA.land.ecology, rainfallMm: 0, durationDays: 1 }
  );
  assert.equal(drySedimentErosion.receipt.status,
    'no-surface-runoff-no-export');
  assert.equal(drySedimentErosion.receipt.totalMobilizedKgM2, 0);
  assert.ok(Object.values(drySedimentErosion.receipt.mobilizedKgM2)
    .every(value => value === 0), 'dry steps export no mineral sediment');
  const migratedSedimentInitialization = geomorphicSediment
    .erodeSurfaceSediment(
      geomorphicSediment.emptyMigratedSurfaceSediment(),
      geomorphicSediment.emptyRunoffSedimentQueue(),
      40,
      { sample: grasslandSample, substrate: earthColumnA.substrate,
        ecology: earthColumnA.land.ecology, rainfallMm: 45,
        durationDays: 1 }
    );
  assert.equal(migratedSedimentInitialization.receipt.status,
    'initialized-after-migration-no-export');
  assert.equal(Object.values(migratedSedimentInitialization.queue
    .suspendedKgM2).reduce((sum, value) => sum + value, 0), 0,
  'v24 migration initializes current sediment ownership without inventing historical erosion');
  const sedimentDebit = geomorphicSediment.debitRunoffSedimentQueue(
    wetSedimentErosion.queue, .4, 1000,
    { transferId: 'selftest-sediment-transfer', sourceCellId: 'source',
      destinationId: 'receiver', destinationKind: 'land' }
  );
  const sedimentCredit = geomorphicSediment.creditRunoffSedimentQueue(
    geomorphicSediment.emptyRunoffSedimentQueue(),
    sedimentDebit.grainsKg, 250,
    { transferId: 'selftest-sediment-transfer', sourceCellId: 'source',
      destinationId: 'receiver', waterFraction: .4 }
  );
  assert.equal(sedimentDebit.receipt.transferId,
    sedimentCredit.receipt.transferId);
  assert.ok(Object.values(sedimentDebit.receipt.residualKg)
    .every(value => Math.abs(value) < 1e-7) &&
    Object.values(sedimentCredit.receipt.residualKg)
      .every(value => Math.abs(value) < 1e-7),
  'area-weighted runoff sediment transfer closes both typed ends');
  const coastalSedimentCredit = geomorphicSediment.creditCoastalSediment(
    geomorphicSediment.emptyCoastalSediment(),
    { clay: 100, silt: 100, sand: 100, gravel: 100 }, 1000,
    { transferId: 'selftest-coast', sourceId: 'river',
      destinationCellId: 'ocean' }
  );
  assert.ok(coastalSedimentCredit.receipt.depositedKg.gravel >
    coastalSedimentCredit.receipt.depositedKg.clay,
  'coastal deposition is grain selective instead of one bulk percentage');
  assert.ok(Object.values(coastalSedimentCredit.receipt.residualKg)
    .every(value => Math.abs(value) < 1e-7),
  'coastal suspended plus deposited mineral mass equals its exact input');
  const riverSedimentInput = geomorphicSediment.applyRunoffSedimentInput(
    geomorphicSediment.emptyRiverSediment(),
    { clay: 100, silt: 80, sand: 60, gravel: 40 },
    { transferId: 'selftest-river-inlet', sourceCellId: 'land',
      reachId: 'reach-a' }
  );
  const riverSedimentRoute = geomorphicSediment.routeRiverSedimentLoad(
    riverSedimentInput.state,
    geomorphicSediment.riverSedimentTransportLoad(
      riverSedimentInput.state, .5),
    { transferId: 'selftest-river-route', sourceReachId: 'reach-a',
      destinationId: 'reach-b', destinationKind: 'river-reach',
      residenceDays: 1.2, slope: .001, dischargeM3s: 8 }
  );
  assert.ok(geomorphicSediment.sedimentGrainTotal(
    riverSedimentRoute.depositedKg) > 0 &&
    geomorphicSediment.sedimentGrainTotal(
      riverSedimentRoute.exportedKg) > 0,
  'river routing partitions an exact requested load into persistent bed deposit and export');
  assert.ok(Object.values(riverSedimentRoute.receipt.residualKg)
    .every(value => Math.abs(value) < 1e-7),
  'river sediment sender debit, bed deposition and exported load close by grain');
  assert.equal(riverChemistry.RIVER_CHEMISTRY_STATE_SCHEMA,
    'axm.foundation-planet.river-chemistry-state/v4');
  assert.equal(riverChemistry.PREVIOUS_RIVER_CHEMISTRY_STATE_SCHEMA,
    'axm.foundation-planet.river-chemistry-state/v3');
  assert.equal(riverChemistry.RIVER_CHEMISTRY_INPUT_SCHEMA,
    'axm.foundation-planet.river-chemistry-input-receipt/v4');
  const legacyAlkalinityRiver = riverChemistry.emptyRiverChemistry();
  legacyAlkalinityRiver.schema =
    riverChemistry.PREVIOUS_RIVER_CHEMISTRY_STATE_SCHEMA;
  legacyAlkalinityRiver.dissolvedInorganicCarbonKgC = 4;
  legacyAlkalinityRiver.dissolvedNitrateNitrogenKgN = 2;
  legacyAlkalinityRiver.dissolvedAmmoniumNitrogenKgN = 1;
  legacyAlkalinityRiver.dissolvedInorganicNitrogenKgN = 3;
  delete legacyAlkalinityRiver.alkalinityKgCaCO3Eq;
  const migratedAlkalinityRiver = riverChemistry.normalizeRiverChemistry(
    legacyAlkalinityRiver);
  assert.ok(migratedAlkalinityRiver.dissolvedInorganicCarbonKgC === 4 &&
    migratedAlkalinityRiver.dissolvedNitrateNitrogenKgN === 2 &&
    migratedAlkalinityRiver.dissolvedAmmoniumNitrogenKgN === 1 &&
    migratedAlkalinityRiver.alkalinityKgCaCO3Eq === 0 &&
    migratedAlkalinityRiver.migrationCheckpoint === true,
  'v3 river migration preserves existing chemistry and adds zero alkalinity without invented history');
  const legacyDinChemistry = riverChemistry.emptyRiverChemistry();
  legacyDinChemistry.schema =
    riverChemistry.LEGACY_RIVER_CHEMISTRY_STATE_SCHEMA;
  legacyDinChemistry.dissolvedInorganicNitrogenKgN = 8;
  delete legacyDinChemistry.dissolvedNitrateNitrogenKgN;
  delete legacyDinChemistry.dissolvedAmmoniumNitrogenKgN;
  delete legacyDinChemistry.truth;
  const migratedDinChemistry = riverChemistry.normalizeRiverChemistry(
    legacyDinChemistry);
  assert.ok(migratedDinChemistry.migrationCheckpoint === true &&
    migratedDinChemistry.dissolvedNitrateNitrogenKgN === 4 &&
    migratedDinChemistry.dissolvedAmmoniumNitrogenKgN === 4 &&
    migratedDinChemistry.dissolvedInorganicNitrogenKgN === 8,
  'v2 aggregate DIN migrates into an explicit conservative 50/50 nitrate-ammonium model initialization');
  const speciatedRiverInput = riverChemistry
    .applyRunoffBiogeochemistryInput(
      riverChemistry.emptyRiverChemistry(),
      { dissolvedInorganicNitrogenKgN: 10 }, 1000,
      { transferId: 'test:runoff-speciation', nitrateFraction: .7 });
  assert.ok(speciatedRiverInput.state.dissolvedNitrateNitrogenKgN === 7 &&
    Math.abs(speciatedRiverInput.state
      .dissolvedAmmoniumNitrogenKgN - 3) < 1e-12 &&
    speciatedRiverInput.state.dissolvedInorganicNitrogenKgN === 10 &&
    speciatedRiverInput.receipt.truth
      .nitrateAndAmmoniumReceiverPoolsCredited === true &&
    speciatedRiverInput.receipt.truth.measuredInputSpeciationClaimed ===
      false &&
    Object.values(speciatedRiverInput.receipt.conservation)
      .every(value => Math.abs(value) < 1e-9),
  'generic runoff DIN is explicitly partitioned at the receiver while nitrate plus ammonium and the total-N ledger close');
  const speciatedFraction = riverChemistry.riverChemistryFraction(
    speciatedRiverInput.state, .25);
  const speciatedRemainder = riverChemistry.subtractRiverChemistry(
    speciatedRiverInput.state, speciatedFraction);
  assert.ok(Math.abs(speciatedFraction
      .dissolvedNitrateNitrogenKgN - 1.75) < 1e-12 &&
    Math.abs(speciatedFraction
      .dissolvedAmmoniumNitrogenKgN - .75) < 1e-12 &&
    Math.abs(speciatedRemainder
      .dissolvedNitrateNitrogenKgN - 5.25) < 1e-12 &&
    Math.abs(speciatedRemainder
      .dissolvedAmmoniumNitrogenKgN - 2.25) < 1e-12,
  'water-fraction routing debits nitrate and ammonium proportionally without collapsing their identities');
  assert.equal(floodplain.FLOODPLAIN_STATE_SCHEMA,
    'axm.foundation-planet.floodplain-state/v5');
  assert.equal(floodplain.PREVIOUS_FLOODPLAIN_STATE_SCHEMA,
    'axm.foundation-planet.floodplain-state/v4');
  assert.equal(floodplain.LEGACY_FLOODPLAIN_STATE_SCHEMA,
    'axm.foundation-planet.floodplain-state/v3');
  assert.equal(floodplain.OLDEST_FLOODPLAIN_STATE_SCHEMA,
    'axm.foundation-planet.floodplain-state/v2');
  assert.equal(floodplain.EARLIEST_FLOODPLAIN_STATE_SCHEMA,
    'axm.foundation-planet.floodplain-state/v1');
  assert.equal(floodplain.FLOODPLAIN_REACTION_MASS_CLOSURE_POLICY_SCHEMA,
    'axm.foundation-planet.floodplain-reaction-mass-closure-policy/v1');
  assert.deepEqual(
    floodplain.FLOODPLAIN_REACTION_MASS_CLOSURE_ABSOLUTE_FLOORS_KG, {
      carbonKgC: 1e-7,
      nitrogenKgN: 1e-7,
      ammoniumNitrogenKgN: 1e-9,
      oxygenKgO2: 1e-7,
      alkalinityKgCaCO3Eq: 1e-7
    });
  assert.equal(floodplain.FLOODPLAIN_REACTION_MASS_CLOSURE_ULP_FACTOR, 8);
  assert.ok(floodplain.floodplainReactionMassClosureToleranceKg(
    'oxygenKgO2', 5e11, 4e11) > 1e-7,
  'reaction closure bounds increase deterministically with recorded operand scale');
  const legacyAlkalinityFloodplain = floodplain.emptyFloodplainState();
  legacyAlkalinityFloodplain.schema = floodplain
    .PREVIOUS_FLOODPLAIN_STATE_SCHEMA;
  legacyAlkalinityFloodplain.waterKg = 500;
  legacyAlkalinityFloodplain.chemistry = JSON.parse(JSON.stringify(
    legacyAlkalinityRiver));
  legacyAlkalinityFloodplain.lastAerobicMineralizationReceipt = {
    schema: floodplain
      .PREVIOUS_FLOODPLAIN_AEROBIC_MINERALIZATION_RECEIPT_SCHEMA
  };
  legacyAlkalinityFloodplain.lastDenitrificationReactionReceipt = {
    schema: floodplain
      .PREVIOUS_FLOODPLAIN_DENITRIFICATION_REACTION_RECEIPT_SCHEMA
  };
  legacyAlkalinityFloodplain.lastNitrificationReactionReceipt = {
    schema: floodplain
      .PREVIOUS_FLOODPLAIN_NITRIFICATION_REACTION_RECEIPT_SCHEMA
  };
  legacyAlkalinityFloodplain.lastGasExchangeReceipt = {
    schema: floodplain.PREVIOUS_FLOODPLAIN_GAS_EXCHANGE_RECEIPT_SCHEMA
  };
  const migratedAlkalinityFloodplain = floodplain.normalizeFloodplainState(
    legacyAlkalinityFloodplain);
  assert.ok(migratedAlkalinityFloodplain.waterKg === 500 &&
    migratedAlkalinityFloodplain.chemistry.dissolvedInorganicCarbonKgC === 4 &&
    migratedAlkalinityFloodplain.chemistry.alkalinityKgCaCO3Eq === 0 &&
    migratedAlkalinityFloodplain.lastAerobicMineralizationReceipt === null &&
    migratedAlkalinityFloodplain.lastDenitrificationReactionReceipt ===
      null &&
    migratedAlkalinityFloodplain.lastNitrificationReactionReceipt === null &&
    migratedAlkalinityFloodplain.lastGasExchangeReceipt === null &&
    migratedAlkalinityFloodplain.migrationCheckpoint === true,
  'v4-to-v5 floodplain migration preserves water and chemistry while dropping obsolete fixed-threshold reaction receipts');
  const floodChannelChemistry = riverChemistry.emptyRiverChemistry();
  floodChannelChemistry.dissolvedInorganicCarbonKgC = 12;
  floodChannelChemistry.dissolvedOrganicCarbonKgC = 4;
  floodChannelChemistry.dissolvedNitrateNitrogenKgN = 1;
  floodChannelChemistry.dissolvedAmmoniumNitrogenKgN = 1;
  floodChannelChemistry.dissolvedInorganicNitrogenKgN = 2;
  floodChannelChemistry.dissolvedInorganicPhosphorusKgP = .5;
  floodChannelChemistry.dissolvedOxygenKgO2 = 6;
  floodChannelChemistry.alkalinityKgCaCO3Eq = 20;
  const floodChannelSediment = geomorphicSediment.emptyRiverSediment();
  floodChannelSediment.suspendedKg = {
    clay: 100, silt: 100, sand: 100, gravel: 100
  };
  const floodReach = {
    id: 'flood-reach', widthM: 2, depthM: .5
  };
  const overbankStep = floodplain.advanceFloodplainExchange(
    floodplain.emptyFloodplainState(),
    { waterKg: 200_000, chemistry: floodChannelChemistry,
      sediment: floodChannelSediment },
    floodReach, .5,
    { reachLengthM: 100, startDay: 10 }
  );
  assert.equal(overbankStep.receipt.schema,
    floodplain.FLOODPLAIN_EXCHANGE_RECEIPT_SCHEMA);
  assert.ok(overbankStep.receipt.water.overbankKg > 0 &&
    overbankStep.state.waterKg > 0,
  'channel water above geometry-derived bankfull capacity enters persistent floodplain storage');
  assert.ok(['clay', 'silt', 'sand', 'gravel'].every(grain =>
    overbankStep.receipt.sediment.overbankKg[grain] >= 0 &&
    Math.abs(overbankStep.receipt.sediment.residualKg[grain]) < 1e-6),
  'overbank sediment debits the channel and credits floodplain ownership without losing a grain class');
  assert.ok(
    overbankStep.receipt.sediment.depositedKg.gravel /
      Math.max(1e-12, overbankStep.receipt.sediment.overbankKg.gravel) >
    overbankStep.receipt.sediment.depositedKg.clay /
      Math.max(1e-12, overbankStep.receipt.sediment.overbankKg.clay),
  'floodplain settling is grain selective rather than a bulk percentage');
  assert.equal(overbankStep.receipt.truth.conservationClosed, true,
    'overbank water, chemistry and sediment exchange closes its combined ledger');
  assert.ok(overbankStep.receipt.truth
      .nitrateAndAmmoniumConservationClosed === true &&
    overbankStep.receipt.chemistry.overbank.nitrateNitrogenKgN > 0 &&
    overbankStep.receipt.chemistry.overbank.ammoniumNitrogenKgN > 0,
  'overbank water carries both owned inorganic nitrogen species through a closed paired transfer');
  const returnStep = floodplain.advanceFloodplainExchange(
    overbankStep.state,
    { waterKg: 0, chemistry: riverChemistry.emptyRiverChemistry(),
      sediment: geomorphicSediment.emptyRiverSediment() },
    floodReach, 1,
    { reachLengthM: 100, startDay: 10.5 }
  );
  assert.ok(returnStep.receipt.water.returnKg > 0 &&
    returnStep.receipt.water.returnKg <=
      overbankStep.state.waterKg + 1e-6,
  'floodplain recession returns only water owned by its finite donor');
  assert.equal(returnStep.receipt.truth.conservationClosed, true,
    'floodplain return flow preserves water, chemistry and mineral mass');
  assert.ok(returnStep.receipt.chemistry.returned.nitrateNitrogenKgN > 0 &&
    returnStep.receipt.chemistry.returned.ammoniumNitrogenKgN > 0 &&
    returnStep.receipt.truth.nitrateAndAmmoniumConservationClosed === true,
  'recession return preserves nitrate and ammonium identity in the reverse transfer');
  const migratedFloodplainStep = floodplain.advanceFloodplainExchange(
    floodplain.emptyFloodplainState({ migrationCheckpoint: true }),
    { waterKg: 200_000, chemistry: floodChannelChemistry,
      sediment: floodChannelSediment },
    floodReach, .5,
    { reachLengthM: 100, startDay: 11 }
  );
  assert.equal(migratedFloodplainStep.receipt.status,
    'initialized-after-migration-no-transfer');
  assert.equal(migratedFloodplainStep.receipt.water.overbankKg, 0,
    'legacy migration does not invent historical floodplain exchange');
  assert.equal(floodplainHabitat.FLOODPLAIN_HABITAT_STATE_SCHEMA,
    'axm.foundation-planet.floodplain-habitat-state/v1');
  const floodplainMaterialBeforeHabitat = JSON.stringify(
    overbankStep.state);
  const firstHabitatStep = floodplainHabitat.advanceFloodplainHabitat(
    floodplainHabitat.emptyFloodplainHabitatState(),
    overbankStep.state,
    .5,
    {
      reachId: floodReach.id,
      startDay: 10,
      floodplainExchangeReceipt: overbankStep.receipt
    }
  );
  assert.equal(firstHabitatStep.receipt.schema,
    floodplainHabitat.FLOODPLAIN_HABITAT_RECEIPT_SCHEMA);
  assert.equal(JSON.stringify(overbankStep.state),
    floodplainMaterialBeforeHabitat,
  'habitat observation leaves owned floodplain water, chemistry and sediment byte-identical');
  assert.equal(firstHabitatStep.receipt.truth
    .floodplainMaterialMutated, false);
  assert.equal(firstHabitatStep.state.floodPulseCount, 1,
    'the first genuinely observed wet transition records one flood pulse');
  assert.equal(firstHabitatStep.state.wetDays, .5);
  assert.ok(firstHabitatStep.state.rollingHydroperiod30d > 0 &&
    firstHabitatStep.state.fertilityIndex > 0 &&
    firstHabitatStep.state.cumulativeNewDepositKg > 0,
  'owned water, dissolved chemistry and new deposits create bounded persistent habitat signals');
  assert.ok(Math.abs(Object.values(firstHabitatStep.state.fractions)
    .reduce((sum, value) => sum + value, 0) - 1) < 1e-12,
  'open water, mudflat, reed/sedge, wet meadow and riparian woodland potential normalize to one');
  assert.equal(firstHabitatStep.state.truth.potentialHabitatOnly, true);
  assert.equal(firstHabitatStep.state.truth.ecologicalPopulationState, false);
  assert.equal(firstHabitatStep.state.truth.plantBiomassState, false,
    'habitat potential is not relabelled as plant biomass or population state');
  const dryHabitatStep = floodplainHabitat.advanceFloodplainHabitat(
    firstHabitatStep.state,
    floodplain.emptyFloodplainState(),
    1,
    { reachId: floodReach.id, startDay: 10.5 }
  );
  assert.equal(dryHabitatStep.state.dryDays, 1);
  assert.equal(dryHabitatStep.state.currentDrySpellDays, 1);
  assert.equal(dryHabitatStep.state.currentWetSpellDays, 0,
    'dry observations advance a dry spell without erasing earlier wet memory');
  const secondPulseHabitatStep = floodplainHabitat
    .advanceFloodplainHabitat(dryHabitatStep.state, overbankStep.state, 1,
      { reachId: floodReach.id, startDay: 11.5,
        floodplainExchangeReceipt: overbankStep.receipt });
  assert.equal(secondPulseHabitatStep.state.floodPulseCount, 2,
    'a new wet transition after a dry spell records a distinct flood pulse');
  const migratedHabitatStep = floodplainHabitat
    .advanceFloodplainHabitat(
      floodplainHabitat.emptyFloodplainHabitatState({
        migrationCheckpoint: true
      }),
      overbankStep.state,
      1,
      { reachId: floodReach.id, startDay: 12,
        floodplainExchangeReceipt: overbankStep.receipt }
    );
  assert.equal(migratedHabitatStep.receipt.status,
    'initialized-after-migration-no-history');
  assert.equal(migratedHabitatStep.state.observedDays, 0);
  assert.equal(migratedHabitatStep.state.floodPulseCount, 0);
  assert.equal(migratedHabitatStep.receipt.truth
    .migrationInventedHistory, false,
  'v7 migration records present material baselines without fabricating earlier wet days or flood pulses');
  assert.equal(floodEventHistory.FLOOD_EVENT_HISTORY_STATE_SCHEMA,
    'axm.foundation-planet.flood-event-history-state/v1');
  const dryFloodplainStep = floodplain.advanceFloodplainExchange(
    floodplain.emptyFloodplainState(),
    { waterKg: 0, chemistry: riverChemistry.emptyRiverChemistry(),
      sediment: geomorphicSediment.emptyRiverSediment() },
    floodReach, 1,
    { reachLengthM: 100, startDay: 20 }
  );
  const eventMaterialBefore = JSON.stringify(overbankStep.state);
  const eventStarted = floodEventHistory.advanceFloodEventHistory(
    floodEventHistory.emptyFloodEventHistoryState(),
    overbankStep.state,
    overbankStep.receipt,
    .5,
    { reachId: floodReach.id, startDay: 20 }
  );
  assert.equal(eventStarted.receipt.status, 'flood-event-started');
  assert.equal(eventStarted.receipt.schema,
    floodEventHistory.FLOOD_EVENT_TRANSITION_RECEIPT_SCHEMA);
  assert.equal(eventStarted.receipt.floodplainExchangeDigest,
    overbankStep.receipt.digest);
  assert.equal(JSON.stringify(overbankStep.state), eventMaterialBefore,
  'the event chronicle observes floodplain matter without mutating it');
  assert.ok(eventStarted.state.currentEvent.peakWaterKg > 0 &&
    eventStarted.state.currentEvent.peakInundatedFraction > 0,
  'event start preserves observed flood magnitude');
  assert.equal(eventStarted.state.currentEvent.cumulativeOverbankWaterKg,
    overbankStep.receipt.water.overbankKg);
  assert.equal(eventStarted.state.currentEvent.cumulativeReturnWaterKg,
    overbankStep.receipt.water.returnKg);
  assert.deepEqual(eventStarted.state.currentEvent.overbankChemistry,
    Object.fromEntries(['carbonKgC', 'nitrogenKgN', 'phosphorusKgP',
      'oxygenKgO2'].map(key =>
      [key, overbankStep.receipt.chemistry.overbank[key]])));
  assert.deepEqual(eventStarted.state.currentEvent.overbankSedimentKg,
    overbankStep.receipt.sediment.overbankKg);
  assert.deepEqual(eventStarted.state.currentEvent.depositedSedimentKg,
    overbankStep.receipt.sediment.depositedKg,
  'event start preserves exact water, aggregate chemistry and typed-grain observation payloads without claiming archived species speciation');
  const eventContinued = floodEventHistory.advanceFloodEventHistory(
    eventStarted.state, overbankStep.state, overbankStep.receipt, 1,
    { reachId: floodReach.id, startDay: 20.5 }
  );
  assert.equal(eventContinued.receipt.status, 'flood-event-continued');
  assert.equal(eventContinued.state.currentEvent.durationDays, 1.5);
  assert.equal(eventContinued.state.currentEvent.observationCount, 2);
  assert.ok(eventContinued.state.currentEvent.cumulativeOverbankWaterKg >
    eventStarted.state.currentEvent.cumulativeOverbankWaterKg,
  'continuing wet observations extend duration and accumulate event payload');
  const eventCompleted = floodEventHistory.advanceFloodEventHistory(
    eventContinued.state, dryFloodplainStep.state,
    dryFloodplainStep.receipt, 1,
    { reachId: floodReach.id, startDay: 21.5 }
  );
  assert.equal(eventCompleted.receipt.status, 'flood-event-completed');
  assert.equal(eventCompleted.state.currentEvent, null);
  assert.equal(eventCompleted.state.completedEventCount, 1);
  assert.equal(eventCompleted.state.recentEvents.length, 1);
  assert.equal(eventCompleted.state.recentEvents[0].durationDays, 1.5,
  'the first dry observation completes and archives the exact wet duration');
  const migratedFloodEvents = floodEventHistory.advanceFloodEventHistory(
    floodEventHistory.emptyFloodEventHistoryState({
      migrationCheckpoint: true
    }),
    overbankStep.state,
    overbankStep.receipt,
    1,
    { reachId: floodReach.id, startDay: 30 }
  );
  assert.equal(migratedFloodEvents.receipt.status,
    'initialized-after-migration-no-history');
  assert.equal(migratedFloodEvents.state.completedEventCount, 0);
  assert.equal(migratedFloodEvents.state.currentEvent, null);
  assert.equal(migratedFloodEvents.state.awaitingDryBoundary, true,
  'migration inside an existing wet spell waits for a dry boundary instead of inventing its beginning');
  const migratedWetBoundary = floodEventHistory.advanceFloodEventHistory(
    migratedFloodEvents.state, overbankStep.state,
    overbankStep.receipt, 1,
    { reachId: floodReach.id, startDay: 31 }
  );
  assert.equal(migratedWetBoundary.receipt.status,
    'migration-wet-boundary-awaiting-dry');
  assert.equal(migratedWetBoundary.state.currentEvent, null);
  const migratedDryBoundary = floodEventHistory.advanceFloodEventHistory(
    migratedWetBoundary.state, dryFloodplainStep.state,
    dryFloodplainStep.receipt, 1,
    { reachId: floodReach.id, startDay: 32 }
  );
  assert.equal(migratedDryBoundary.receipt.status,
    'migration-dry-boundary-established');
  const firstPostMigrationEvent = floodEventHistory
    .advanceFloodEventHistory(migratedDryBoundary.state,
      overbankStep.state, overbankStep.receipt, 1,
      { reachId: floodReach.id, startDay: 33 });
  assert.equal(firstPostMigrationEvent.receipt.status,
    'flood-event-started',
  'only a genuinely observed dry-to-wet transition starts a post-migration event');
  let boundedEventHistory = floodEventHistory
    .emptyFloodEventHistoryState();
  for (let eventIndex = 0; eventIndex < 34; eventIndex++) {
    const wetEvent = floodEventHistory.advanceFloodEventHistory(
      boundedEventHistory, overbankStep.state, overbankStep.receipt, 1,
      { reachId: floodReach.id, startDay: 100 + eventIndex * 2 });
    const dryEvent = floodEventHistory.advanceFloodEventHistory(
      wetEvent.state, dryFloodplainStep.state,
      dryFloodplainStep.receipt, 1,
      { reachId: floodReach.id,
        startDay: 101 + eventIndex * 2 });
    boundedEventHistory = dryEvent.state;
  }
  assert.equal(boundedEventHistory.completedEventCount, 34);
  assert.equal(boundedEventHistory.recentEvents.length,
    floodEventHistory.FLOOD_EVENT_ARCHIVE_LIMIT);
  assert.equal(boundedEventHistory.evictedEventCount, 2,
  'the chronicle retains exactly 32 recent events and counts older evictions instead of growing without bound');
  assert.equal(boundedEventHistory.recurrenceIntervalCount, 33);
  assert.equal(floodEventHistory.floodEventHistorySummary(
    boundedEventHistory).meanCompletedDurationDays, 1,
  'completed duration and recurrence statistics survive bounded archival');
  assert.equal(floodplainSuccession.FLOODPLAIN_SUCCESSION_STATE_SCHEMA,
    'axm.foundation-planet.floodplain-succession-state/v1');
  assert.equal(floodplainSuccession.FLOODPLAIN_SUCCESSION_RECEIPT_SCHEMA,
    'axm.foundation-planet.floodplain-succession-receipt/v1');
  const migratedSuccession = floodplainSuccession
    .advanceFloodplainSuccession(
      floodplainSuccession.emptyFloodplainSuccessionState({
        migrationCheckpoint: true
      }),
      secondPulseHabitatStep.state,
      1,
      {
        reachId: floodReach.id,
        startDay: 40,
        floodplainHabitatReceipt: secondPulseHabitatStep.receipt,
        floodEventReceipt: eventStarted.receipt,
        livingEnabled: true,
        lifeAbundance: 1
      }
    );
  assert.equal(migratedSuccession.receipt.status,
    'initialized-after-migration-no-history');
  assert.equal(migratedSuccession.receipt
    .floodplainHabitatReceiptDigest, secondPulseHabitatStep.receipt.digest);
  assert.equal(migratedSuccession.receipt
    .floodEventTransitionReceiptDigest, eventStarted.receipt.digest);
  assert.equal(floodplainSuccession.floodplainSuccessionSummary(
    migratedSuccession.state).totalCoverFraction, 0);
  assert.equal(floodplainSuccession.floodplainSuccessionSummary(
    migratedSuccession.state).totalSeedBankSeedsM2, 0,
  'v9 migration binds present habitat and event evidence without inventing earlier seed banks or living cover');
  const firstSuccession = floodplainSuccession
    .advanceFloodplainSuccession(migratedSuccession.state,
      secondPulseHabitatStep.state, 1, {
        reachId: floodReach.id,
        startDay: 41,
        floodplainHabitatReceipt: secondPulseHabitatStep.receipt,
        floodEventReceipt: eventStarted.receipt,
        livingEnabled: true,
        lifeAbundance: 1
      });
  const firstSuccessionSummary = floodplainSuccession
    .floodplainSuccessionSummary(firstSuccession.state);
  assert.equal(firstSuccession.receipt.status,
    'flood-disturbance-observed');
  assert.ok(firstSuccessionSummary.totalCoverFraction > 0 &&
    firstSuccessionSummary.totalSeedBankSeedsM2 > 0,
  'explicit external seed rain, germination and recruitment establish the first finite living cover');
  assert.equal(firstSuccession.receipt.guildFlows.length, 5);
  assert.ok(firstSuccession.receipt.guildFlows.every(flow =>
    Math.abs(flow.seed.residualSeedsM2) < 1e-8 &&
    Math.abs(flow.cover.juvenileResidual) < 1e-10 &&
    Math.abs(flow.cover.matureResidual) < 1e-10));
  assert.equal(firstSuccession.receipt.truth.ledgersClosed, true,
  'every guild closes local production plus explicit seed rain against germination, decay, stages, mortality and competition');
  const dryBetweenEvent = floodEventHistory.advanceFloodEventHistory(
    eventCompleted.state, dryFloodplainStep.state,
    dryFloodplainStep.receipt, 1,
    { reachId: floodReach.id, startDay: 22.5 });
  assert.equal(dryBetweenEvent.receipt.status, 'dry-between-events');
  let establishedSuccession = firstSuccession.state;
  for (let successionDay = 0; successionDay < 420; successionDay++) {
    establishedSuccession = floodplainSuccession
      .advanceFloodplainSuccession(establishedSuccession,
        secondPulseHabitatStep.state, 1, {
          reachId: floodReach.id,
          startDay: 42 + successionDay,
          floodplainHabitatReceipt: secondPulseHabitatStep.receipt,
          floodEventReceipt: dryBetweenEvent.receipt,
          livingEnabled: true,
          lifeAbundance: 1
        }).state;
  }
  const establishedSummary = floodplainSuccession
    .floodplainSuccessionSummary(establishedSuccession);
  assert.ok(establishedSummary.matureCoverFraction > 0 &&
    establishedSummary.totalCoverFraction <=
      floodplainSuccession.FLOODPLAIN_SUCCESSION_MAX_TOTAL_COVER &&
    establishedSummary.successionIndex > 0 &&
    establishedSummary.diversityIndex > 0,
  'persistent recruitment matures into a bounded diverse functional-guild community');
  const dormantSuccession = floodplainSuccession
    .advanceFloodplainSuccession(establishedSuccession,
      secondPulseHabitatStep.state, 1, {
        reachId: floodReach.id,
        startDay: 500,
        floodplainHabitatReceipt: secondPulseHabitatStep.receipt,
        floodEventReceipt: dryBetweenEvent.receipt,
        livingEnabled: false,
        lifeAbundance: 1
      });
  assert.equal(dormantSuccession.receipt.status,
    'life-disabled-dormant');
  assert.equal(dormantSuccession.receipt.truth.demographicStateFrozen,
    true);
  assert.deepEqual({
    cover: floodplainSuccession.floodplainSuccessionSummary(
      dormantSuccession.state).totalCoverFraction,
    seeds: floodplainSuccession.floodplainSuccessionSummary(
      dormantSuccession.state).totalSeedBankSeedsM2
  }, {
    cover: establishedSummary.totalCoverFraction,
    seeds: establishedSummary.totalSeedBankSeedsM2
  }, 'Life-off freezes living cover and seed banks without deleting their history');
  const equalHabitat = floodplainHabitat.normalizeFloodplainHabitatState({
    ...floodplainHabitat.emptyFloodplainHabitatState(),
    fractions: {
      openWater: .2, mudflat: .2, reedSedge: .2,
      wetMeadow: .2, riparianWoodland: .2
    },
    fertilityIndex: .5,
    anaerobicStress: .5
  });
  const severeFloodReceipt = JSON.parse(JSON.stringify(
    eventContinued.receipt));
  severeFloodReceipt.digest = 'fnv1a32:severe-flood';
  severeFloodReceipt.observation.inundatedFraction = 1;
  severeFloodReceipt.event.after.peakInundatedFraction = 1;
  severeFloodReceipt.event.after.durationDays = 30;
  const equalMatureState = floodplainSuccession
    .emptyFloodplainSuccessionState();
  for (const id of floodplainSuccession.FLOODPLAIN_SUCCESSION_GUILDS) {
    equalMatureState.guilds[id].matureCoverFraction = .1;
  }
  const severeFloodSuccession = floodplainSuccession
    .advanceFloodplainSuccession(equalMatureState, equalHabitat, 1, {
      reachId: floodReach.id,
      startDay: 510,
      floodplainHabitatReceipt: secondPulseHabitatStep.receipt,
      floodEventReceipt: severeFloodReceipt,
      livingEnabled: true,
      lifeAbundance: 1
    });
  const severeFlows = Object.fromEntries(severeFloodSuccession.receipt
    .guildFlows.map(flow => [flow.guildId, flow]));
  assert.ok(severeFlows.riparianWoodland.floodMortalityPressure >
    severeFlows.reedSedge.floodMortalityPressure &&
    severeFlows.riparianWoodland.cover.matureMortality >
      severeFlows.reedSedge.cover.matureMortality,
  'equal-cover guilds respond differently to severe flooding according to explicit tolerance traits');
  const completedRecoveryReceipt = JSON.parse(JSON.stringify(
    eventCompleted.receipt));
  completedRecoveryReceipt.digest = 'fnv1a32:recovery-event';
  completedRecoveryReceipt.event.completed.peakInundatedFraction = 1;
  completedRecoveryReceipt.event.completed.durationDays = 30;
  const recoverySuccession = floodplainSuccession
    .advanceFloodplainSuccession(
      floodplainSuccession.emptyFloodplainSuccessionState(),
      equalHabitat, 1, {
        reachId: floodReach.id,
        startDay: 511,
        floodplainHabitatReceipt: secondPulseHabitatStep.receipt,
        floodEventReceipt: completedRecoveryReceipt,
        livingEnabled: true,
        lifeAbundance: 1
      });
  const quietSuccession = floodplainSuccession.advanceFloodplainSuccession(
    floodplainSuccession.emptyFloodplainSuccessionState(),
    equalHabitat, 1, {
      reachId: floodReach.id,
      startDay: 511,
      floodplainHabitatReceipt: secondPulseHabitatStep.receipt,
      floodEventReceipt: dryBetweenEvent.receipt,
      livingEnabled: true,
      lifeAbundance: 1
    });
  const recoveryMudflat = recoverySuccession.receipt.guildFlows.find(
    flow => flow.guildId === 'mudflatAnnuals');
  const quietMudflat = quietSuccession.receipt.guildFlows.find(
    flow => flow.guildId === 'mudflatAnnuals');
  assert.equal(recoverySuccession.receipt.status, 'post-flood-recovery');
  assert.ok(recoveryMudflat.seed.externalSeedRainSeedsM2 >
    quietMudflat.seed.externalSeedRainSeedsM2,
  'a completed event exposes an explicit bounded pioneer recovery pulse rather than silently rewriting habitat');
  const crowdedState = floodplainSuccession.emptyFloodplainSuccessionState();
  for (const id of floodplainSuccession.FLOODPLAIN_SUCCESSION_GUILDS) {
    crowdedState.guilds[id].matureCoverFraction = .3;
  }
  const competedSuccession = floodplainSuccession
    .advanceFloodplainSuccession(crowdedState, equalHabitat, 1, {
      reachId: floodReach.id,
      startDay: 512,
      floodplainHabitatReceipt: secondPulseHabitatStep.receipt,
      floodEventReceipt: dryBetweenEvent.receipt,
      livingEnabled: true,
      lifeAbundance: 1
    });
  assert.ok(Math.abs(floodplainSuccession.floodplainSuccessionSummary(
    competedSuccession.state).totalCoverFraction -
      floodplainSuccession.FLOODPLAIN_SUCCESSION_MAX_TOTAL_COVER) < 1e-10);
  assert.equal(competedSuccession.receipt.community.competitionApplied,
    true);
  assert.equal(competedSuccession.receipt.truth
    .competitionCapacityHonored, true,
  'explicit competition losses constrain over-capacity living cover to the declared reach-scale ceiling');
  assert.throws(() => floodplainSuccession.advanceFloodplainSuccession(
    firstSuccession.state, equalHabitat, 1, {}),
  /requires the current habitat transition receipt/,
  'succession refuses to advance without exact current habitat and event evidence');
  assert.equal(floodplainPlantMatter.FLOODPLAIN_PLANT_MATTER_STATE_SCHEMA,
    'axm.foundation-planet.floodplain-plant-matter-state/v1');
  assert.equal(floodplainPlantMatter.FLOODPLAIN_PLANT_MATTER_RECEIPT_SCHEMA,
    'axm.foundation-planet.floodplain-plant-matter-receipt/v2');
  assert.equal(floodplainPlantMatter
    .PREVIOUS_FLOODPLAIN_PLANT_MATTER_RECEIPT_SCHEMA,
  'axm.foundation-planet.floodplain-plant-matter-receipt/v1');
  assert.equal(floodplainPlantMatter
    .FLOODPLAIN_PLANT_MATTER_MASS_CLOSURE_POLICY_SCHEMA,
  'axm.foundation-planet.floodplain-plant-matter-mass-closure-policy/v1');
  assert.equal(floodplainPlantMatter
    .FLOODPLAIN_PLANT_MATTER_MASS_CLOSURE_ABSOLUTE_FLOOR_KG, 1e-7);
  assert.equal(floodplainPlantMatter
    .FLOODPLAIN_PLANT_MATTER_MASS_CLOSURE_ULP_FACTOR, 8);
  assert.equal(landEcology.LAND_ECOLOGY_SUBGRID_BIOMASS_DEBIT_SCHEMA,
    'axm.foundation-planet.land-ecology-subgrid-biomass-debit/v2');
  assert.equal(
    landEcology.PREVIOUS_LAND_ECOLOGY_SUBGRID_BIOMASS_DEBIT_SCHEMA,
    'axm.foundation-planet.land-ecology-subgrid-biomass-debit/v1');
  assert.equal(landEcology.LAND_ECOLOGY_MASS_CLOSURE_POLICY_SCHEMA,
    'axm.foundation-planet.land-ecology-mass-closure-policy/v1');
  const scaleAwareMatterState = floodplainPlantMatter
    .emptyFloodplainPlantMatterState();
  const scaleAwareMatterCarbonKgC = 5e8;
  scaleAwareMatterState.guilds.aquaticPioneers.live = {
    carbonKgC: scaleAwareMatterCarbonKgC,
    nitrogenKgN: scaleAwareMatterCarbonKgC / 22
  };
  scaleAwareMatterState.guilds.aquaticPioneers.standingDead = {
    carbonKgC: scaleAwareMatterCarbonKgC * .41,
    nitrogenKgN: scaleAwareMatterCarbonKgC * .41 / 22
  };
  scaleAwareMatterState.guilds.aquaticPioneers.litter = {
    carbonKgC: scaleAwareMatterCarbonKgC / 3,
    nitrogenKgN: scaleAwareMatterCarbonKgC / 3 / 22
  };
  const scaleAwareMatterSuccession = {
    schema: floodplainSuccession.FLOODPLAIN_SUCCESSION_RECEIPT_SCHEMA,
    status: 'succession-transitioned',
    digest: 'fnv1a32:r59-held-succession',
    community: {
      after: {
        guilds: Object.fromEntries(
          floodplainSuccession.FLOODPLAIN_SUCCESSION_GUILDS.map(id =>
            [id, {
              juvenileCoverFraction: 0,
              matureCoverFraction: id === 'aquaticPioneers' ? 1 : 0
            }]))
      }
    }
  };
  const scaleAwareMatterAreaM2 = scaleAwareMatterCarbonKgC / .24;
  const scaleAwareMatterDemand = floodplainPlantMatter
    .floodplainPlantMatterDemand(scaleAwareMatterState,
      scaleAwareMatterSuccession, scaleAwareMatterAreaM2);
  const scaleAwareMatterTransition = floodplainPlantMatter
    .advanceFloodplainPlantMatter(scaleAwareMatterState,
      scaleAwareMatterSuccession, {
        totals: scaleAwareMatterDemand.totals,
        perGuild: Object.fromEntries(
          floodplainSuccession.FLOODPLAIN_SUCCESSION_GUILDS.map(id =>
            [id, scaleAwareMatterDemand.perGuild[id].demand])),
        transferIds: {}
      }, {
        reachId: floodReach.id, startDay: 519.5,
        durationDays: 1, areaM2: scaleAwareMatterAreaM2
      });
  const scaleAwareMatterFlow = scaleAwareMatterTransition.receipt.guildFlows
    .find(entry => entry.guildId === 'aquaticPioneers');
  assert.ok(Math.abs(scaleAwareMatterFlow.closure.carbonResidualKgC) >
      floodplainPlantMatter
        .FLOODPLAIN_PLANT_MATTER_MASS_CLOSURE_ABSOLUTE_FLOOR_KG &&
    Math.abs(scaleAwareMatterFlow.closure.carbonResidualKgC) <=
      scaleAwareMatterFlow.closure.numericToleranceKg.carbonKgC &&
    scaleAwareMatterTransition.receipt.truth.carbonAndNitrogenClosed === true &&
    scaleAwareMatterTransition.receipt.truth
      .scaleAwareFloatingPointClosure === true &&
    scaleAwareMatterTransition.receipt.truth
      .perMaterialChannelNumericBounds === true &&
    scaleAwareMatterTransition.receipt.truth.measuredResidualsPreserved === true &&
    scaleAwareMatterTransition.receipt.truth.fixedAbsoluteToleranceOnly === false,
  'a held large standing-dead/litter transition preserves its measured residual and closes inside the recorded scale-aware channel bound');
  const baselineSuccession = floodplainSuccession
    .advanceFloodplainSuccession(establishedSuccession,
      secondPulseHabitatStep.state, 1, {
        reachId: floodReach.id,
        startDay: 520,
        floodplainHabitatReceipt: secondPulseHabitatStep.receipt,
        floodEventReceipt: dryBetweenEvent.receipt,
        livingEnabled: true,
        lifeAbundance: 1
      });
  const migratedPlantMatter = floodplainPlantMatter
    .advanceFloodplainPlantMatter(
      floodplainPlantMatter.emptyFloodplainPlantMatterState({
        migrationCheckpoint: true
      }), baselineSuccession.receipt, {}, {
        reachId: floodReach.id, startDay: 520,
        durationDays: 1, areaM2: 1000
      });
  const migratedPlantSummary = floodplainPlantMatter
    .floodplainPlantMatterSummary(migratedPlantMatter.state);
  assert.equal(migratedPlantMatter.receipt.status,
    'initialized-after-migration-no-invented-material');
  assert.equal(migratedPlantSummary.total.carbonKgC, 0);
  assert.equal(migratedPlantSummary.total.nitrogenKgN, 0);
  assert.ok(migratedPlantSummary.legacyUnmaterializedCoverFraction > 0,
  'v10 cover becomes an explicit unmaterialized baseline without inventing historical C/N');
  const growingSuccession = floodplainSuccession
    .advanceFloodplainSuccession(baselineSuccession.state,
      secondPulseHabitatStep.state, 1, {
        reachId: floodReach.id,
        startDay: 521,
        floodplainHabitatReceipt: secondPulseHabitatStep.receipt,
        floodEventReceipt: dryBetweenEvent.receipt,
        livingEnabled: true,
        lifeAbundance: 1
      });
  const plantDemand = floodplainPlantMatter.floodplainPlantMatterDemand(
    migratedPlantMatter.state, growingSuccession.receipt, 1000);
  assert.ok(plantDemand.totals.carbonKgC > 0 &&
    plantDemand.totals.nitrogenKgN > 0,
  'new post-migration cover produces a finite C/N material demand');
  const plantTransferIds = {};
  const plantAllocations = [];
  for (const id of floodplainSuccession.FLOODPLAIN_SUCCESSION_GUILDS) {
    const material = plantDemand.perGuild[id].demand;
    if (material.carbonKgC <= 1e-12 &&
      material.nitrogenKgN <= 1e-12) continue;
    const transferId = `selftest-land-plant:${id}`;
    plantTransferIds[id] = transferId;
    plantAllocations.push({
      transferId, reachId: floodReach.id,
      carbonKgC: material.carbonKgC,
      nitrogenKgN: material.nitrogenKgN
    });
  }
  const donorAreaM2 = 1e9;
  const donorEcology = JSON.parse(JSON.stringify(earthColumnA.land.ecology));
  const donorBefore = landEcology.landEcologyLiveBiomassMass(
    donorEcology, donorAreaM2);
  const plantSenderDebit = landEcology
    .applyLandEcologySubgridBiomassDebit(donorEcology, donorAreaM2,
      plantAllocations, {
        donorCellId: earthColumnA.id,
        startDay: 521, durationDays: 1,
        maximumDailyFraction: .05
      });
  assert.ok(Math.abs(donorBefore.carbonKgC -
      plantSenderDebit.receipt.after.carbonKgC -
      plantDemand.totals.carbonKgC) < 1e-6 &&
    Math.abs(donorBefore.nitrogenKgN -
      plantSenderDebit.receipt.after.nitrogenKgN -
      plantDemand.totals.nitrogenKgN) < 1e-6,
  'the land-cell sender persistently debits the exact plant C/N credit');
  const largeScaleSenderState = landEcology.createLandEcology({
    land: true,
    biome: 'rainforest',
    habitability: .79,
    moisture: .78,
    temperatureC: 24,
    ecology: { productivity: .79 },
    geology: { soilDepthM: 1.74 }
  }, { soilDepthM: 1.74, texture: 'loam' }, { lifeAbundance: 1 });
  const largeScaleSenderAreaM2 = 3e9;
  const largeScaleSenderCapacity = landEcology
    .landEcologySubgridDebitCapacity(largeScaleSenderState,
      largeScaleSenderAreaM2, 1, { maximumDailyFraction: .0025 });
  const largeScaleSenderDebit = landEcology
    .applyLandEcologySubgridBiomassDebit(largeScaleSenderState,
      largeScaleSenderAreaM2, [{
        transferId: 'r57-large-scale-closure',
        reachId: floodReach.id,
        carbonKgC: largeScaleSenderCapacity.carbonKgC * .1,
        nitrogenKgN: largeScaleSenderCapacity.nitrogenKgN * .1
      }], {
        donorCellId: earthColumnA.id,
        startDay: 521,
        durationDays: 1,
        maximumDailyFraction: .0025
      });
  assert.ok(Math.abs(largeScaleSenderDebit.receipt.closure
      .carbonResidualKgC) > 1e-6 &&
    Math.abs(largeScaleSenderDebit.receipt.closure.carbonResidualKgC) <=
      largeScaleSenderDebit.receipt.closure.numericToleranceKg.carbonKgC &&
    largeScaleSenderDebit.receipt.truth.carbonAndNitrogenClosed === true &&
    largeScaleSenderDebit.receipt.truth.measuredResidualsPreserved === true,
  'the held Earth-cell-scale sender keeps its representational residual while closing under a receipt-derived IEEE-754 bound');
  const materializedPlantMatter = floodplainPlantMatter
    .advanceFloodplainPlantMatter(migratedPlantMatter.state,
      growingSuccession.receipt, {
        donorCellId: earthColumnA.id,
        senderReceiptDigest: plantSenderDebit.receipt.digest,
        totals: plantDemand.totals,
        perGuild: Object.fromEntries(Object.entries(plantDemand.perGuild)
          .map(([id, value]) => [id, value.demand])),
        transferIds: plantTransferIds
      }, {
        reachId: floodReach.id, startDay: 521,
        durationDays: 1, areaM2: 1000
      });
  const materializedPlantSummary = floodplainPlantMatter
    .floodplainPlantMatterSummary(materializedPlantMatter.state);
  assert.equal(materializedPlantMatter.receipt.status,
    'land-biomass-partition-credited');
  assert.ok(materializedPlantSummary.live.carbonKgC > 0 &&
    materializedPlantSummary.live.nitrogenKgN > 0 &&
    materializedPlantMatter.receipt.transferIds.length ===
      plantAllocations.length &&
    materializedPlantMatter.receipt.truth.carbonAndNitrogenClosed === true,
  'new living cover becomes persistent matter only under exact sender-backed transfer IDs');
  assert.throws(() => floodplainPlantMatter.advanceFloodplainPlantMatter(
    migratedPlantMatter.state, growingSuccession.receipt,
    { totals: { carbonKgC: 0, nitrogenKgN: 0 }, perGuild: {} },
    { reachId: floodReach.id, startDay: 521,
      durationDays: 1, areaM2: 1000 }),
  /credit does not match material demand/,
  'plant matter refuses unmatched material credit');
  const senderCapacity = landEcology.landEcologySubgridDebitCapacity(
    donorEcology, donorAreaM2, 1, { maximumDailyFraction: .0025 });
  assert.throws(() => landEcology.applyLandEcologySubgridBiomassDebit(
    donorEcology, donorAreaM2, [{
      transferId: 'overdraw', reachId: floodReach.id,
      carbonKgC: senderCapacity.carbonKgC * 2,
      nitrogenKgN: senderCapacity.nitrogenKgN * 2
    }], { donorCellId: earthColumnA.id,
      startDay: 522, durationDays: 1 }),
  /exceeds bounded capacity/,
  'the sender refuses a subgrid biomass debit beyond its daily finite capacity');
  const dormantPlantMatter = floodplainPlantMatter
    .advanceFloodplainPlantMatter(materializedPlantMatter.state,
      dormantSuccession.receipt, {}, {
        reachId: floodReach.id, startDay: 522,
        durationDays: 1, areaM2: 1000
      });
  assert.equal(dormantPlantMatter.receipt.status,
    'life-disabled-dormant');
  assert.deepEqual({
    live: dormantPlantMatter.receipt.after.live,
    standingDead: dormantPlantMatter.receipt.after.standingDead,
    litter: dormantPlantMatter.receipt.after.litter,
    total: dormantPlantMatter.receipt.after.total
  }, {
    live: dormantPlantMatter.receipt.before.live,
    standingDead: dormantPlantMatter.receipt.before.standingDead,
    litter: dormantPlantMatter.receipt.before.litter,
    total: dormantPlantMatter.receipt.before.total
  }, 'Life-off freezes all floodplain plant matter pools');
  const mortalitySuccession = floodplainSuccession
    .advanceFloodplainSuccession(growingSuccession.state,
      equalHabitat, 1, {
        reachId: floodReach.id,
        startDay: 523,
        floodplainHabitatReceipt: secondPulseHabitatStep.receipt,
        floodEventReceipt: severeFloodReceipt,
        livingEnabled: true,
        lifeAbundance: 1,
        materialGrowthScale: 0
      });
  const mortalityDemand = floodplainPlantMatter
    .floodplainPlantMatterDemand(materializedPlantMatter.state,
      mortalitySuccession.receipt, 1000);
  assert.equal(mortalityDemand.totals.carbonKgC, 0);
  assert.equal(mortalityDemand.totals.nitrogenKgN, 0);
  const deadPlantMatter = floodplainPlantMatter
    .advanceFloodplainPlantMatter(materializedPlantMatter.state,
      mortalitySuccession.receipt, {
        totals: mortalityDemand.totals,
        perGuild: Object.fromEntries(Object.entries(mortalityDemand.perGuild)
          .map(([id, value]) => [id, value.demand])),
        transferIds: {}
      }, {
        reachId: floodReach.id, startDay: 523,
        durationDays: 1, areaM2: 1000
      });
  assert.ok(deadPlantMatter.receipt.after.standingDead.carbonKgC >
    deadPlantMatter.receipt.before.standingDead.carbonKgC &&
    Math.abs(deadPlantMatter.receipt.after.total.carbonKgC -
      deadPlantMatter.receipt.before.total.carbonKgC) < 1e-7,
  'flood mortality transfers live C/N into standing dead without deleting matter');
  const fallSuccession = floodplainSuccession
    .advanceFloodplainSuccession(mortalitySuccession.state,
      equalHabitat, 1, {
        reachId: floodReach.id,
        startDay: 524,
        floodplainHabitatReceipt: secondPulseHabitatStep.receipt,
        floodEventReceipt: severeFloodReceipt,
        livingEnabled: true,
        lifeAbundance: 1,
        materialGrowthScale: 0
      });
  const fallDemand = floodplainPlantMatter.floodplainPlantMatterDemand(
    deadPlantMatter.state, fallSuccession.receipt, 1000);
  const litterPlantMatter = floodplainPlantMatter
    .advanceFloodplainPlantMatter(deadPlantMatter.state,
      fallSuccession.receipt, {
        totals: fallDemand.totals,
        perGuild: Object.fromEntries(Object.entries(fallDemand.perGuild)
          .map(([id, value]) => [id, value.demand])),
        transferIds: {}
      }, {
        reachId: floodReach.id, startDay: 524,
        durationDays: 1, areaM2: 1000
      });
  assert.ok(litterPlantMatter.receipt.after.litter.carbonKgC >
      litterPlantMatter.receipt.before.litter.carbonKgC &&
    Math.abs(litterPlantMatter.receipt.after.total.carbonKgC -
      litterPlantMatter.receipt.before.total.carbonKgC) < 1e-7,
  'standing dead falls into persistent litter while the C/N total remains closed');
  assert.equal(
    floodplainPlantResources.FLOODPLAIN_PLANT_RESOURCES_STATE_SCHEMA,
    'axm.foundation-planet.floodplain-plant-resources-state/v1');
  assert.equal(
    floodplainPlantResources.FLOODPLAIN_PLANT_RESOURCES_RECEIPT_SCHEMA,
    'axm.foundation-planet.floodplain-plant-resources-receipt/v2');
  assert.equal(floodplainPlantResources
    .PREVIOUS_FLOODPLAIN_PLANT_RESOURCES_RECEIPT_SCHEMA,
  'axm.foundation-planet.floodplain-plant-resources-receipt/v1');
  assert.equal(floodplainPlantResources
    .FLOODPLAIN_PLANT_RESOURCE_MASS_CLOSURE_POLICY_SCHEMA,
  'axm.foundation-planet.floodplain-plant-resource-mass-closure-policy/v1');
  assert.equal(floodplainPlantResources
    .FLOODPLAIN_PLANT_RESOURCE_MASS_CLOSURE_ABSOLUTE_FLOOR_KG, 1e-7);
  assert.equal(floodplainPlantResources
    .FLOODPLAIN_PLANT_RESOURCE_MASS_CLOSURE_ULP_FACTOR, 8);
  assert.equal(floodplain.FLOODPLAIN_PLANT_RESOURCE_DEBIT_SCHEMA,
    'axm.foundation-planet.floodplain-plant-resource-debit/v1');
  assert.equal(floodplain.FLOODPLAIN_PLANT_WATER_RETURN_SCHEMA,
    'axm.foundation-planet.floodplain-plant-water-return/v1');
  const scaleAwareResourceState = floodplainPlantResources
    .emptyFloodplainPlantResourcesState();
  scaleAwareResourceState.guilds.wetMeadow.live = {
    supportedCarbonKgC: 3, phosphorusKgP: 0, waterKg: 1e10
  };
  const scaleAwareMatterReceipt = {
    schema: floodplainPlantMatter.FLOODPLAIN_PLANT_MATTER_RECEIPT_SCHEMA,
    status: 'plant-matter-transitioned', digest: 'fnv1a32:r58-held-matter',
    reachId: floodReach.id,
    guildFlows: floodplainSuccession.FLOODPLAIN_SUCCESSION_GUILDS.map(id => ({
      guildId: id,
      landEcologyCredit: { carbonKgC: 0 },
      liveToStandingDead: { carbonKgC: id === 'wetMeadow' ? 1 : 0 },
      standingDeadToLitter: { carbonKgC: 0 },
      before: {
        live: { carbonKgC: id === 'wetMeadow' ? 3 : 0 },
        standingDead: { carbonKgC: 0 }
      }
    }))
  };
  const scaleAwareResourcePlan = floodplainPlantResources
    .floodplainPlantResourcePlan(scaleAwareResourceState,
      scaleAwareMatterReceipt);
  const scaleAwareResourceTransition = floodplainPlantResources
    .advanceFloodplainPlantResources(scaleAwareResourceState,
      scaleAwareMatterReceipt, {
        totals: scaleAwareResourcePlan.uptakeTotals,
        waterReturnKg: scaleAwareResourcePlan.waterReturnKg,
        perGuild: Object.fromEntries(Object.entries(
          scaleAwareResourcePlan.perGuild).map(([id, value]) =>
          [id, value.uptake])),
        uptakeTransferIds: {},
        waterReturnTransferIds: {
          wetMeadow: 'selftest-r58-scale-aware-water-return'
        },
        returnReceiptDigest: 'fnv1a32:r58-held-return'
      }, { reachId: floodReach.id, startDay: 520.5, durationDays: 1 });
  const scaleAwareWetMeadowFlow = scaleAwareResourceTransition.receipt
    .guildFlows.find(flow => flow.guildId === 'wetMeadow');
  assert.ok(Math.abs(scaleAwareWetMeadowFlow.closure
      .liveWaterResidualKg) > 1e-7 &&
    Math.abs(scaleAwareWetMeadowFlow.closure.liveWaterResidualKg) <=
      scaleAwareWetMeadowFlow.closure.numericToleranceKg.liveWaterKg &&
    scaleAwareResourceTransition.receipt.truth
      .scaleAwareFloatingPointClosure === true &&
    scaleAwareResourceTransition.receipt.truth
      .perMaterialChannelNumericBounds === true &&
    scaleAwareResourceTransition.receipt.truth
      .measuredResidualsPreserved === true &&
    scaleAwareResourceTransition.receipt.truth
      .fixedAbsoluteToleranceOnly === false &&
    scaleAwareResourceTransition.receipt.truth.resourceLedgersClosed === true,
  'an Earth-cell-scale tissue-water transfer preserves its measured residual and closes against the recorded per-channel operand scale');
  const migratedPlantResources = floodplainPlantResources
    .advanceFloodplainPlantResources(
      floodplainPlantResources.emptyFloodplainPlantResourcesState({
        migrationCheckpoint: true
      }), materializedPlantMatter.receipt, {}, {
        reachId: floodReach.id, startDay: 521, durationDays: 1
      });
  assert.equal(migratedPlantResources.receipt.status,
    'initialized-after-v11-migration-no-invented-resources');
  assert.equal(migratedPlantResources.receipt.after.total.phosphorusKgP, 0);
  assert.equal(migratedPlantResources.receipt.after.total.liveWaterKg, 0);
  assert.ok(migratedPlantResources.receipt.after
    .migrationLegacyUnsupportedCarbonKgC > 0,
  'v11 plant C/N becomes an explicit unresourced migration baseline without retroactive P or water');
  const plantResourceState =
    floodplainPlantResources.emptyFloodplainPlantResourcesState();
  const plantResourcePlan = floodplainPlantResources
    .floodplainPlantResourcePlan(plantResourceState,
      materializedPlantMatter.receipt);
  assert.ok(plantResourcePlan.uptakeTotals.phosphorusKgP > 0 &&
    plantResourcePlan.uptakeTotals.waterKg > 0,
  'new C/N-backed plant growth derives finite P and tissue-water demand');
  const resourceFloodplain = floodplain.emptyFloodplainState();
  resourceFloodplain.waterKg = 1e9;
  resourceFloodplain.chemistry.dissolvedInorganicPhosphorusKgP = 1;
  const resourceUptakeIds = {};
  const resourceUptakeAllocations = [];
  const resourcePerGuild = {};
  for (const [id, planned] of Object.entries(
    plantResourcePlan.perGuild)) {
    resourcePerGuild[id] = planned.uptake;
    if (planned.uptake.phosphorusKgP <= 1e-15 &&
      planned.uptake.waterKg <= 1e-12) continue;
    const transferId = `selftest-floodplain-resource:${id}`;
    resourceUptakeIds[id] = transferId;
    resourceUptakeAllocations.push({ transferId, guildId: id,
      phosphorusKgP: planned.uptake.phosphorusKgP,
      waterKg: planned.uptake.waterKg });
  }
  const floodplainResourceDebit = floodplain
    .applyFloodplainPlantResourceExchange(resourceFloodplain,
      resourceUptakeAllocations, [], {
        reachId: floodReach.id, startDay: 521, durationDays: 1,
        maximumDailyWaterFraction: .25,
        maximumDailyPhosphorusFraction: .25
      });
  const resourcedPlants = floodplainPlantResources
    .advanceFloodplainPlantResources(plantResourceState,
      materializedPlantMatter.receipt, {
        totals: plantResourcePlan.uptakeTotals,
        waterReturnKg: 0,
        perGuild: resourcePerGuild,
        uptakeTransferIds: resourceUptakeIds,
        waterReturnTransferIds: {},
        debitReceiptDigest:
          floodplainResourceDebit.debitReceipt.digest,
        returnReceiptDigest:
          floodplainResourceDebit.returnReceipt.digest
      }, { reachId: floodReach.id, startDay: 521, durationDays: 1 });
  assert.equal(resourcedPlants.receipt.status,
    'floodplain-phosphorus-water-uptake-credited');
  assert.ok(resourcedPlants.receipt.after.total.phosphorusKgP > 0 &&
    resourcedPlants.receipt.after.total.liveWaterKg > 0 &&
    floodplainResourceDebit.state.waterKg < resourceFloodplain.waterKg &&
    floodplainResourceDebit.state.chemistry
      .dissolvedInorganicPhosphorusKgP < 1 &&
    resourcedPlants.receipt.truth.resourceLedgersClosed === true,
  'the local floodplain sender exactly backs persistent plant P and tissue water');
  assert.throws(() => floodplainPlantResources
    .advanceFloodplainPlantResources(plantResourceState,
      materializedPlantMatter.receipt, {
        totals: { phosphorusKgP: 0, waterKg: 0 }, waterReturnKg: 0,
        perGuild: {}
      }, { reachId: floodReach.id, startDay: 521, durationDays: 1 }),
  /does not match transition plan/,
  'plant resources refuse an unmatched floodplain uptake credit');
  const resourceCapacity = floodplain.floodplainPlantResourceCapacity(
    resourceFloodplain, 1);
  assert.throws(() => floodplain.applyFloodplainPlantResourceExchange(
    resourceFloodplain, [{
      transferId: 'resource-overdraw', guildId: 'wetMeadow',
      phosphorusKgP: resourceCapacity.phosphorusKgP * 2,
      waterKg: resourceCapacity.waterKg * 2
    }], [], { reachId: floodReach.id, startDay: 522,
      durationDays: 1 }),
  /exceeds bounded local capacity/,
  'the floodplain refuses plant uptake beyond its finite daily water/P capacity');
  const dormantPlantResources = floodplainPlantResources
    .advanceFloodplainPlantResources(resourcedPlants.state,
      dormantPlantMatter.receipt, {}, {
        reachId: floodReach.id, startDay: 522, durationDays: 1
      });
  assert.equal(dormantPlantResources.receipt.status,
    'life-disabled-dormant');
  assert.deepEqual(dormantPlantResources.receipt.after.total,
    dormantPlantResources.receipt.before.total,
  'Life-off freezes plant P and tissue-water pools');
  const mortalityResourcePlan = floodplainPlantResources
    .floodplainPlantResourcePlan(resourcedPlants.state,
      deadPlantMatter.receipt);
  assert.ok(mortalityResourcePlan.waterReturnKg > 0,
  'mortality derives a finite tissue-water return from the supported live pool');
  const mortalityWaterReturnIds = {};
  const mortalityWaterReturns = [];
  const mortalityResourcePerGuild = {};
  for (const [id, planned] of Object.entries(
    mortalityResourcePlan.perGuild)) {
    mortalityResourcePerGuild[id] = planned.uptake;
    if (planned.returnedWaterKg <= 1e-12) continue;
    const transferId = `selftest-plant-water-return:${id}`;
    mortalityWaterReturnIds[id] = transferId;
    mortalityWaterReturns.push({ transferId, guildId: id,
      waterKg: planned.returnedWaterKg });
  }
  const mortalityFloodplainExchange = floodplain
    .applyFloodplainPlantResourceExchange(
      floodplainResourceDebit.state, [], mortalityWaterReturns, {
        reachId: floodReach.id, startDay: 523, durationDays: 1
      });
  const deadPlantResources = floodplainPlantResources
    .advanceFloodplainPlantResources(resourcedPlants.state,
      deadPlantMatter.receipt, {
        totals: mortalityResourcePlan.uptakeTotals,
        waterReturnKg: mortalityResourcePlan.waterReturnKg,
        perGuild: mortalityResourcePerGuild,
        uptakeTransferIds: {},
        waterReturnTransferIds: mortalityWaterReturnIds,
        debitReceiptDigest:
          mortalityFloodplainExchange.debitReceipt.digest,
        returnReceiptDigest:
          mortalityFloodplainExchange.returnReceipt.digest
      }, { reachId: floodReach.id, startDay: 523, durationDays: 1 });
  assert.ok(deadPlantResources.receipt.after.standingDead.phosphorusKgP >
      deadPlantResources.receipt.before.standingDead.phosphorusKgP &&
    deadPlantResources.receipt.after.total.liveWaterKg <
      deadPlantResources.receipt.before.total.liveWaterKg &&
    mortalityFloodplainExchange.state.waterKg >
      floodplainResourceDebit.state.waterKg,
  'mortality retains P in standing dead and credits lost tissue water back to the local floodplain');
  const litterResourcePlan = floodplainPlantResources
    .floodplainPlantResourcePlan(deadPlantResources.state,
      litterPlantMatter.receipt);
  const litterWaterReturnIds = {};
  const litterWaterReturns = [];
  for (const [id, planned] of Object.entries(
    litterResourcePlan.perGuild)) {
    if (planned.returnedWaterKg <= 1e-12) continue;
    const transferId = `selftest-litter-water-return:${id}`;
    litterWaterReturnIds[id] = transferId;
    litterWaterReturns.push({ transferId, guildId: id,
      waterKg: planned.returnedWaterKg });
  }
  const litterResourceExchange = floodplain
    .applyFloodplainPlantResourceExchange(
      mortalityFloodplainExchange.state, [], litterWaterReturns, {
        reachId: floodReach.id, startDay: 524, durationDays: 1
      });
  const litterPlantResources = floodplainPlantResources
    .advanceFloodplainPlantResources(deadPlantResources.state,
      litterPlantMatter.receipt, {
        totals: litterResourcePlan.uptakeTotals,
        waterReturnKg: litterResourcePlan.waterReturnKg,
        perGuild: Object.fromEntries(Object.entries(
          litterResourcePlan.perGuild).map(([id, planned]) =>
          [id, planned.uptake])),
        uptakeTransferIds: {},
        waterReturnTransferIds: litterWaterReturnIds,
        debitReceiptDigest: litterResourceExchange.debitReceipt.digest,
        returnReceiptDigest: litterResourceExchange.returnReceipt.digest
      }, { reachId: floodReach.id, startDay: 524, durationDays: 1 });
  assert.ok(litterPlantResources.receipt.after.litter.phosphorusKgP >
      litterPlantResources.receipt.before.litter.phosphorusKgP &&
    Math.abs(litterPlantResources.receipt.after.total.phosphorusKgP -
      litterPlantResources.receipt.before.total.phosphorusKgP) < 1e-7,
  'standing-dead P falls into persistent litter without loss');
  assert.equal(
    floodplainDecomposition.FLOODPLAIN_DECOMPOSITION_STATE_SCHEMA,
    'axm.foundation-planet.floodplain-decomposition-state/v1');
  assert.equal(
    floodplainDecomposition.FLOODPLAIN_DECOMPOSITION_RECEIPT_SCHEMA,
    'axm.foundation-planet.floodplain-decomposition-receipt/v1');
  assert.equal(
    floodplainPlantMatter.FLOODPLAIN_PLANT_DETRITUS_MATTER_DEBIT_SCHEMA,
    'axm.foundation-planet.floodplain-plant-detritus-matter-debit/v1');
  assert.equal(
    floodplainPlantResources.FLOODPLAIN_PLANT_DETRITUS_RESOURCE_DEBIT_SCHEMA,
    'axm.foundation-planet.floodplain-plant-detritus-resource-debit/v1');
  assert.equal(floodplain.FLOODPLAIN_DETRITAL_RETURN_CREDIT_SCHEMA,
    'axm.foundation-planet.floodplain-detrital-return-credit/v3');
  assert.equal(
    floodplain.PREVIOUS_FLOODPLAIN_DETRITAL_RETURN_CREDIT_SCHEMA,
    'axm.foundation-planet.floodplain-detrital-return-credit/v2');
  assert.equal(
    floodplain.FLOODPLAIN_DETRITAL_RETURN_MASS_CLOSURE_POLICY_SCHEMA,
    'axm.foundation-planet.floodplain-detrital-return-mass-closure-policy/v1');
  assert.equal(
    floodplain.FLOODPLAIN_DETRITAL_RETURN_MASS_CLOSURE_ULP_FACTOR, 8);
  assert.equal(floodplain
    .FLOODPLAIN_DETRITAL_RETURN_MASS_CLOSURE_ABSOLUTE_FLOORS_KG
    .phosphorusKgP, 1e-9);
  assert.ok(floodplain.floodplainDetritalReturnMassClosureToleranceKg(
    'carbonKgC', 5_000_000_000) > 1e-7,
  'detrital-return receiver tolerance grows only when recorded Number scale requires more than the fixed carbon floor');
  const largeDetritalReturnFloodplain = floodplain.emptyFloodplainState();
  const largeDetritalReturnScaleKg = 500_000_000;
  largeDetritalReturnFloodplain.chemistry.dissolvedOrganicCarbonKgC =
    largeDetritalReturnScaleKg * 10;
  largeDetritalReturnFloodplain.chemistry.dissolvedInorganicCarbonKgC =
    largeDetritalReturnScaleKg * 3;
  largeDetritalReturnFloodplain.chemistry.dissolvedNitrateNitrogenKgN =
    largeDetritalReturnScaleKg * 2;
  largeDetritalReturnFloodplain.chemistry.dissolvedAmmoniumNitrogenKgN =
    largeDetritalReturnScaleKg * 4;
  largeDetritalReturnFloodplain.chemistry.dissolvedInorganicNitrogenKgN =
    largeDetritalReturnScaleKg * 6;
  largeDetritalReturnFloodplain.chemistry
    .dissolvedInorganicPhosphorusKgP = largeDetritalReturnScaleKg * .5;
  const largeDetritalReturn = floodplain.applyFloodplainDetritalReturn(
    largeDetritalReturnFloodplain, [{
      transferId: 'r60-held-receiver-counterexample',
      guildId: 'aquaticPioneers', pool: 'litter',
      carbonKgC: largeDetritalReturnScaleKg / 3,
      nitrogenKgN: largeDetritalReturnScaleKg / 30,
      phosphorusKgP: largeDetritalReturnScaleKg / 300
    }], { reachId: 'r60-held-receiver', startDay: 600,
      durationDays: 1, livingEnabled: true });
  assert.ok(Math.abs(largeDetritalReturn.receipt.closure
      .carbonResidualKgC) > 1e-7 &&
    Math.abs(largeDetritalReturn.receipt.closure
      .phosphorusResidualKgP) > 1e-9,
  'the held large-state receiver case preserves residuals that the former fixed thresholds falsely rejected');
  assert.ok(largeDetritalReturn.receipt.truth
      .carbonNitrogenPhosphorusClosed === true &&
    largeDetritalReturn.receipt.truth.scaleAwareFloatingPointClosure ===
      true &&
    largeDetritalReturn.receipt.truth.measuredResidualsPreserved === true &&
    largeDetritalReturn.receipt.closure.maximumResidualKg > 0 &&
    largeDetritalReturn.receipt.closure.maximumToleranceUtilization < 1,
  'recorded-operand per-channel bounds accept the valid receiver identity without erasing its measured residual');
  const decompositionMatter =
    floodplainPlantMatter.emptyFloodplainPlantMatterState();
  decompositionMatter.guilds.wetMeadow.standingDead = {
    carbonKgC: 80, nitrogenKgN: 8
  };
  decompositionMatter.guilds.wetMeadow.litter = {
    carbonKgC: 100, nitrogenKgN: 10
  };
  const decompositionResources =
    floodplainPlantResources.emptyFloodplainPlantResourcesState();
  decompositionResources.guilds.wetMeadow.standingDead = {
    supportedCarbonKgC: 50, phosphorusKgP: .5
  };
  decompositionResources.guilds.wetMeadow.litter = {
    supportedCarbonKgC: 40, phosphorusKgP: .4
  };
  const decompositionFloodplain = floodplain.emptyFloodplainState();
  decompositionFloodplain.waterKg = 50_000;
  decompositionFloodplain.inundatedFraction = .64;
  const decompositionState =
    floodplainDecomposition.emptyFloodplainDecompositionState();
  const decompositionPlan = floodplainDecomposition
    .floodplainDecompositionPlan(decompositionState,
      decompositionMatter, decompositionResources,
      decompositionFloodplain, {
        durationDays: 1, livingEnabled: true, lifeAbundance: 1
      });
  assert.equal(decompositionPlan.perGuild.wetMeadow.litter
    .eligibleCarbonKgC, 40,
  'only the 40 kgC with a paired plant-resource reference is eligible; 60 kgC of legacy unsupported litter remains untouched');
  assert.ok(decompositionPlan.perGuild.wetMeadow.litter.returned
      .carbonKgC >
    decompositionPlan.perGuild.wetMeadow.standingDead.returned.carbonKgC,
  'bounded litter turnover is faster than standing-dead turnover for the same guild');
  const decompositionMatterAllocations = [];
  const decompositionResourceAllocations = [];
  const decompositionReceiverAllocations = [];
  for (const [guildId, pools] of Object.entries(
    decompositionPlan.perGuild)) {
    for (const pool of ['standingDead', 'litter']) {
      const returned = pools[pool].returned;
      if (returned.carbonKgC <= 1e-12 &&
        returned.nitrogenKgN <= 1e-12 &&
        returned.phosphorusKgP <= 1e-15) continue;
      const transferId = `selftest-decomposition:${guildId}:${pool}`;
      decompositionMatterAllocations.push({ transferId, guildId, pool,
        carbonKgC: returned.carbonKgC,
        nitrogenKgN: returned.nitrogenKgN });
      decompositionResourceAllocations.push({ transferId, guildId, pool,
        supportedCarbonKgC: returned.carbonKgC,
        phosphorusKgP: returned.phosphorusKgP });
      decompositionReceiverAllocations.push({ transferId, guildId, pool,
        carbonKgC: returned.carbonKgC,
        nitrogenKgN: returned.nitrogenKgN,
        phosphorusKgP: returned.phosphorusKgP });
    }
  }
  const decompositionContext = {
    reachId: floodReach.id, startDay: 525, durationDays: 1,
    livingEnabled: true
  };
  const decompositionMatterDebit = floodplainPlantMatter
    .applyFloodplainPlantDetritusMatterDebit(decompositionMatter,
      decompositionMatterAllocations, decompositionContext);
  const decompositionResourceDebit = floodplainPlantResources
    .applyFloodplainPlantDetritusResourceDebit(decompositionResources,
      decompositionResourceAllocations, decompositionContext);
  const decompositionCredit = floodplain.applyFloodplainDetritalReturn(
    decompositionFloodplain, decompositionReceiverAllocations,
    decompositionContext);
  const decomposed = floodplainDecomposition
    .advanceFloodplainDecomposition(decompositionState,
      decompositionPlan, decompositionMatterDebit.receipt,
      decompositionResourceDebit.receipt, decompositionCredit.receipt,
      decompositionContext);
  assert.equal(decomposed.receipt.status,
    'detritus-returned-to-local-floodplain-chemistry');
  assert.ok(decomposed.receipt.truth.exactSenderReceiverTransferIds === true &&
    decomposed.receipt.truth.carbonNitrogenPhosphorusClosed === true &&
    decomposed.receipt.truth.plantMatterSenderDebited === true &&
    decomposed.receipt.truth.plantResourceSenderDebited === true &&
    decomposed.receipt.truth.floodplainChemistryReceiverCredited === true &&
    decompositionMatterDebit.state.guilds.wetMeadow.litter.carbonKgC > 59 &&
    decompositionCredit.state.chemistry.dissolvedOrganicCarbonKgC > 0 &&
    decompositionCredit.state.chemistry.dissolvedInorganicNitrogenKgN > 0 &&
    decompositionCredit.state.chemistry
      .dissolvedAmmoniumNitrogenKgN > 0 &&
    decompositionCredit.state.chemistry
      .dissolvedNitrateNitrogenKgN === 0 &&
    decompositionCredit.receipt.truth
      .detritalNitrogenCreditedToAmmoniumPool === true &&
    decompositionCredit.state.chemistry.dissolvedInorganicPhosphorusKgP > 0,
  'exact paired debits conserve C/N/P while returning detrital nitrogen specifically to the local ammonium owner pool');
  assert.throws(() => floodplainPlantMatter
    .applyFloodplainPlantDetritusMatterDebit(decompositionMatter, [{
      transferId: 'selftest-decomposition-overdraw',
      guildId: 'wetMeadow', pool: 'litter', carbonKgC: 101,
      nitrogenKgN: 0
    }], decompositionContext), /donor exhausted/,
  'decomposition cannot overdraw the persistent plant-matter sender');
  const mismatchedDecompositionResourceReceipt = JSON.parse(JSON.stringify(
    decompositionResourceDebit.receipt));
  mismatchedDecompositionResourceReceipt.allocations[0].transferId += ':wrong';
  assert.throws(() => floodplainDecomposition.advanceFloodplainDecomposition(
    decompositionState, decompositionPlan, decompositionMatterDebit.receipt,
    mismatchedDecompositionResourceReceipt, decompositionCredit.receipt,
    decompositionContext), /transfer IDs differ/,
  'decomposition refuses sender and receiver receipts with different transfer IDs');
  const mismatchedDecompositionCreditReceipt = JSON.parse(JSON.stringify(
    decompositionCredit.receipt));
  mismatchedDecompositionCreditReceipt.allocations[0].carbonKgC += .001;
  assert.throws(() => floodplainDecomposition.advanceFloodplainDecomposition(
    decompositionState, decompositionPlan, decompositionMatterDebit.receipt,
    decompositionResourceDebit.receipt, mismatchedDecompositionCreditReceipt,
    decompositionContext), /quantities differ/,
  'decomposition refuses a receiver quantity that differs from its paired senders');
  const migrationDecompositionState =
    floodplainDecomposition.emptyFloodplainDecompositionState({
      migrationCheckpoint: true
    });
  const migrationDecompositionPlan = floodplainDecomposition
    .floodplainDecompositionPlan(migrationDecompositionState,
      decompositionMatter, decompositionResources,
      decompositionFloodplain, {
        durationDays: 1, livingEnabled: true, lifeAbundance: 1
      });
  const migrationMatterDebit = floodplainPlantMatter
    .applyFloodplainPlantDetritusMatterDebit(decompositionMatter, [],
      decompositionContext);
  const migrationResourceDebit = floodplainPlantResources
    .applyFloodplainPlantDetritusResourceDebit(decompositionResources, [],
      decompositionContext);
  const migrationCredit = floodplain.applyFloodplainDetritalReturn(
    decompositionFloodplain, [], decompositionContext);
  const migratedDecomposition = floodplainDecomposition
    .advanceFloodplainDecomposition(migrationDecompositionState,
      migrationDecompositionPlan, migrationMatterDebit.receipt,
      migrationResourceDebit.receipt, migrationCredit.receipt,
      decompositionContext);
  assert.equal(migratedDecomposition.receipt.status,
    'initialized-after-v12-migration-no-invented-history');
  assert.equal(migratedDecomposition.receipt.transferIds.length, 0);
  assert.deepEqual(migratedDecomposition.receipt.after
    .cumulativeFloodplainReturn,
  { carbonKgC: 0, nitrogenKgN: 0, phosphorusKgP: 0 },
  'v12 migration initializes process memory without inventing material or historical decomposition');
  const lifeOffPlan = floodplainDecomposition.floodplainDecompositionPlan(
    decompositionState, decompositionMatter, decompositionResources,
    decompositionFloodplain, {
      durationDays: 1, livingEnabled: false, lifeAbundance: 1
    });
  const lifeOffContext = { ...decompositionContext, startDay: 526,
    livingEnabled: false };
  const lifeOffMatterDebit = floodplainPlantMatter
    .applyFloodplainPlantDetritusMatterDebit(decompositionMatter, [],
      lifeOffContext);
  const lifeOffResourceDebit = floodplainPlantResources
    .applyFloodplainPlantDetritusResourceDebit(decompositionResources, [],
      lifeOffContext);
  const lifeOffCredit = floodplain.applyFloodplainDetritalReturn(
    decompositionFloodplain, [], lifeOffContext);
  const lifeOffDecomposition = floodplainDecomposition
    .advanceFloodplainDecomposition(decompositionState, lifeOffPlan,
      lifeOffMatterDebit.receipt, lifeOffResourceDebit.receipt,
      lifeOffCredit.receipt, lifeOffContext);
  assert.ok(lifeOffDecomposition.receipt.status ===
      'life-disabled-dormant' &&
    lifeOffDecomposition.receipt.truth.decompositionPoolsFrozen === true &&
    lifeOffDecomposition.receipt.transferIds.length === 0,
  'Life-off freezes decomposition and all three transfer ledgers');
  assert.equal(
    floodplainRespiration.FLOODPLAIN_RESPIRATION_STATE_SCHEMA,
    'axm.foundation-planet.floodplain-respiration-state/v1');
  assert.equal(
    floodplainRespiration.FLOODPLAIN_RESPIRATION_RECEIPT_SCHEMA,
    'axm.foundation-planet.floodplain-respiration-receipt/v1');
  assert.equal(floodplain.FLOODPLAIN_AEROBIC_MINERALIZATION_RECEIPT_SCHEMA,
    'axm.foundation-planet.floodplain-aerobic-mineralization-receipt/v2');
  assert.equal(floodplain
    .PREVIOUS_FLOODPLAIN_AEROBIC_MINERALIZATION_RECEIPT_SCHEMA,
  'axm.foundation-planet.floodplain-aerobic-mineralization-receipt/v1');
  const respirationFloodplain = JSON.parse(JSON.stringify(
    decompositionCredit.state));
  respirationFloodplain.chemistry.dissolvedOrganicCarbonKgC = 12;
  respirationFloodplain.chemistry.dissolvedInorganicCarbonKgC = 3;
  respirationFloodplain.chemistry.dissolvedOxygenKgO2 = 64;
  const respirationState = floodplainRespiration
    .emptyFloodplainRespirationState();
  const respirationPlan = floodplainRespiration.floodplainRespirationPlan(
    respirationState, respirationFloodplain, {
      durationDays: 1, livingEnabled: true, lifeAbundance: 1,
      maximumDailyDocFraction: .25
    });
  const respirationContext = {
    reachId: floodReach.id, startDay: 527, durationDays: 1,
    livingEnabled: true
  };
  const respirationReaction = floodplain.applyFloodplainAerobicMineralization(
    respirationFloodplain, respirationPlan.reaction, respirationContext);
  const respired = floodplainRespiration.advanceFloodplainRespiration(
    respirationState, respirationPlan, respirationReaction.receipt,
    respirationContext);
  assert.equal(respired.receipt.status, 'aerobic-doc-mineralization');
  assert.ok(respirationReaction.receipt.truth.localDocToDicCarbonClosed ===
      true &&
    respirationReaction.receipt.truth.dissolvedOxygenConsumptionClosed ===
      true &&
    Math.abs(respirationReaction.receipt.reaction
      .dissolvedOrganicCarbonConsumedKgC -
      respirationReaction.receipt.reaction
        .dissolvedInorganicCarbonProducedKgC) < 1e-9 &&
    respirationReaction.state.chemistry.dissolvedOrganicCarbonKgC < 12 &&
    respirationReaction.state.chemistry.dissolvedInorganicCarbonKgC > 3 &&
    respirationReaction.state.chemistry.dissolvedOxygenKgO2 < 64,
  'aerobic respiration moves only local DOC to equal local DIC while debiting stoichiometric dissolved oxygen');
  const oxygenLimitedFloodplain = JSON.parse(JSON.stringify(
    respirationFloodplain));
  oxygenLimitedFloodplain.chemistry.dissolvedOrganicCarbonKgC = 10;
  oxygenLimitedFloodplain.chemistry.dissolvedInorganicCarbonKgC = 0;
  oxygenLimitedFloodplain.chemistry.dissolvedOxygenKgO2 = .8;
  const oxygenLimitedPlan = floodplainRespiration
    .floodplainRespirationPlan(respirationState,
      oxygenLimitedFloodplain, {
        durationDays: 1, livingEnabled: true, lifeAbundance: 1,
        maximumDailyDocFraction: .25
      });
  const oxygenLimitedReaction = floodplain
    .applyFloodplainAerobicMineralization(oxygenLimitedFloodplain,
      oxygenLimitedPlan.reaction, { ...respirationContext, startDay: 528 });
  const oxygenLimitedRespiration = floodplainRespiration
    .advanceFloodplainRespiration(respirationState, oxygenLimitedPlan,
      oxygenLimitedReaction.receipt, {
        ...respirationContext, startDay: 528
      });
  assert.ok(oxygenLimitedPlan.activity.oxygenLimited === true &&
    oxygenLimitedRespiration.receipt.status ===
      'oxygen-limited-aerobic-doc-mineralization' &&
    Math.abs(oxygenLimitedReaction.state.chemistry
      .dissolvedOxygenKgO2) < 1e-8 &&
    Math.abs(oxygenLimitedPlan.reaction
      .dissolvedOrganicCarbonConsumedKgC -
      .8 / floodplainRespiration.AEROBIC_OXYGEN_KG_O2_PER_KG_C) < 1e-8,
  'finite local dissolved oxygen caps aerobic DOC mineralization without inventing anaerobic activity');
  assert.throws(() => floodplain.applyFloodplainAerobicMineralization(
    respirationFloodplain, {
      dissolvedOrganicCarbonConsumedKgC: 1,
      dissolvedInorganicCarbonProducedKgC: .9,
      dissolvedOxygenConsumedKgO2:
        floodplainRespiration.AEROBIC_OXYGEN_KG_O2_PER_KG_C
    }, respirationContext), /stoichiometrically closed/,
  'a malformed DOC/DIC reaction is refused before chemistry mutation');
  assert.throws(() => floodplain.applyFloodplainAerobicMineralization(
    respirationFloodplain, {
      dissolvedOrganicCarbonConsumedKgC: 13,
      dissolvedInorganicCarbonProducedKgC: 13,
      dissolvedOxygenConsumedKgO2:
        13 * floodplainRespiration.AEROBIC_OXYGEN_KG_O2_PER_KG_C
    }, respirationContext), /exhausted/,
  'respiration cannot overdraw local DOC or dissolved oxygen ownership');
  const migrationRespirationState = floodplainRespiration
    .emptyFloodplainRespirationState({ migrationCheckpoint: true });
  const migrationRespirationPlan = floodplainRespiration
    .floodplainRespirationPlan(migrationRespirationState,
      respirationFloodplain, {
        durationDays: 1, livingEnabled: true, lifeAbundance: 1
      });
  const migrationRespirationReaction = floodplain
    .applyFloodplainAerobicMineralization(respirationFloodplain,
      migrationRespirationPlan.reaction, {
        ...respirationContext, startDay: 529
      });
  const migratedRespiration = floodplainRespiration
    .advanceFloodplainRespiration(migrationRespirationState,
      migrationRespirationPlan, migrationRespirationReaction.receipt,
      { ...respirationContext, startDay: 529 });
  assert.equal(migratedRespiration.receipt.status,
    'initialized-after-v13-migration-no-invented-history');
  assert.deepEqual(migratedRespiration.receipt.after
    .cumulativeMineralization, {
      dissolvedOrganicCarbonConsumedKgC: 0,
      dissolvedInorganicCarbonProducedKgC: 0,
      dissolvedOxygenConsumedKgO2: 0
    }, 'v13 migration initializes respiration memory without material or invented history');
  const lifeOffRespirationPlan = floodplainRespiration
    .floodplainRespirationPlan(respirationState, respirationFloodplain, {
      durationDays: 1, livingEnabled: false, lifeAbundance: 1
    });
  const lifeOffRespirationReaction = floodplain
    .applyFloodplainAerobicMineralization(respirationFloodplain,
      lifeOffRespirationPlan.reaction, {
        ...respirationContext, startDay: 530, livingEnabled: false
      });
  const lifeOffRespiration = floodplainRespiration
    .advanceFloodplainRespiration(respirationState,
      lifeOffRespirationPlan, lifeOffRespirationReaction.receipt, {
        ...respirationContext, startDay: 530, livingEnabled: false
      });
  assert.ok(lifeOffRespiration.receipt.status ===
      'life-disabled-dormant' &&
    lifeOffRespiration.receipt.truth.respirationPoolsFrozen === true &&
    lifeOffRespiration.receipt.reaction
      .dissolvedOrganicCarbonConsumedKgC === 0,
  'Life-off freezes respiration and all local chemistry transfers');
  assert.equal(
    floodplainDenitrification.FLOODPLAIN_DENITRIFICATION_STATE_SCHEMA,
    'axm.foundation-planet.floodplain-denitrification-state/v4');
  assert.equal(floodplainDenitrification
    .PREVIOUS_FLOODPLAIN_DENITRIFICATION_STATE_SCHEMA,
  'axm.foundation-planet.floodplain-denitrification-state/v3');
  assert.equal(floodplainDenitrification
    .LEGACY_FLOODPLAIN_DENITRIFICATION_STATE_SCHEMA,
  'axm.foundation-planet.floodplain-denitrification-state/v2');
  assert.equal(
    floodplainDenitrification.FLOODPLAIN_DENITRIFICATION_RECEIPT_SCHEMA,
    'axm.foundation-planet.floodplain-denitrification-receipt/v4');
  assert.equal(
    floodplain.FLOODPLAIN_DENITRIFICATION_REACTION_RECEIPT_SCHEMA,
    'axm.foundation-planet.floodplain-denitrification-reaction-receipt/v4');
  assert.equal(floodplain
    .PREVIOUS_FLOODPLAIN_DENITRIFICATION_REACTION_RECEIPT_SCHEMA,
  'axm.foundation-planet.floodplain-denitrification-reaction-receipt/v3');
  const denitrificationFloodplain = floodplain.emptyFloodplainState();
  denitrificationFloodplain.waterKg = 1e6;
  denitrificationFloodplain.inundatedFraction = .81;
  denitrificationFloodplain.chemistry.dissolvedOrganicCarbonKgC = 12;
  denitrificationFloodplain.chemistry.dissolvedInorganicCarbonKgC = 3;
  denitrificationFloodplain.chemistry
    .dissolvedNitrateNitrogenKgN = 3;
  denitrificationFloodplain.chemistry
    .dissolvedAmmoniumNitrogenKgN = 3;
  denitrificationFloodplain.chemistry
    .dissolvedInorganicNitrogenKgN = 6;
  denitrificationFloodplain.chemistry.dissolvedOxygenKgO2 = .5;
  const denitrificationState = floodplainDenitrification
    .emptyFloodplainDenitrificationState();
  const denitrificationPlan = floodplainDenitrification
    .floodplainDenitrificationPlan(denitrificationState,
      denitrificationFloodplain, {
        durationDays: 1, livingEnabled: true, lifeAbundance: 1,
        atmosphereAvailable: true, anoxicThresholdMgL: 2,
        maximumDailyDocFraction: .25
      });
  assert.ok(denitrificationPlan.activity.dissolvedOxygenMgL === .5 &&
    denitrificationPlan.activity.anoxiaFactor === .75 &&
    denitrificationPlan.activity.waterTemperatureC === 20 &&
    denitrificationPlan.activity.temperatureQ10 === 2 &&
    denitrificationPlan.activity.temperatureResponseFactor === 1 &&
    denitrificationPlan.reaction
      .dissolvedOrganicCarbonConsumedKgC > 0 &&
    denitrificationPlan.reaction
      .dissolvedNitrateNitrogenConsumedKgN > 0 &&
    denitrificationPlan.activity.availableDissolvedNitrateNitrogenKgN ===
      3 &&
    denitrificationPlan.activity.availableDissolvedAmmoniumNitrogenKgN ===
      3,
  'sub-threshold oxygen opens a bounded, DOC- and nitrate-backed denitrification plan while exposing ammonium separately');
  const coldDenitrificationPlan = floodplainDenitrification
    .floodplainDenitrificationPlan(denitrificationState,
      denitrificationFloodplain, {
        durationDays: 1, livingEnabled: true, lifeAbundance: 1,
        atmosphereAvailable: true, anoxicThresholdMgL: 2,
        maximumDailyDocFraction: .25,
        waterTemperatureC: 5, referenceTemperatureC: 20,
        temperatureQ10: 2
      });
  const warmDenitrificationPlan = floodplainDenitrification
    .floodplainDenitrificationPlan(denitrificationState,
      denitrificationFloodplain, {
        durationDays: 1, livingEnabled: true, lifeAbundance: 1,
        atmosphereAvailable: true, anoxicThresholdMgL: 2,
        maximumDailyDocFraction: .25,
        waterTemperatureC: 25, referenceTemperatureC: 20,
        temperatureQ10: 2
      });
  assert.ok(coldDenitrificationPlan.activity.temperatureResponseFactor < 1 &&
    coldDenitrificationPlan.activity.temperatureConstrained === true &&
    warmDenitrificationPlan.activity.temperatureResponseFactor > 1 &&
    warmDenitrificationPlan.reaction
      .dissolvedOrganicCarbonConsumedKgC >
      coldDenitrificationPlan.reaction
        .dissolvedOrganicCarbonConsumedKgC &&
    warmDenitrificationPlan.truth
      .surfaceTemperatureForcingUsedAsWaterTemperatureProxy === true &&
    warmDenitrificationPlan.truth
      .persistentFloodplainWaterTemperatureState === false &&
    warmDenitrificationPlan.truth.arrheniusKineticsResolved === false,
  'the declared Q10-style surface-temperature proxy changes activity without claiming persistent floodplain temperature or mechanistic kinetics');
  const extremeColdDenitrificationPlan = floodplainDenitrification
    .floodplainDenitrificationPlan(denitrificationState,
      denitrificationFloodplain, {
        durationDays: 1, atmosphereAvailable: true,
        waterTemperatureC: -80, referenceTemperatureC: 20,
        temperatureQ10: 4
      });
  const extremeWarmDenitrificationPlan = floodplainDenitrification
    .floodplainDenitrificationPlan(denitrificationState,
      denitrificationFloodplain, {
        durationDays: 1, atmosphereAvailable: true,
        waterTemperatureC: 80, referenceTemperatureC: 20,
        temperatureQ10: 4
      });
  assert.ok(extremeColdDenitrificationPlan.activity
      .temperatureResponseFactor === .05 &&
    extremeWarmDenitrificationPlan.activity
      .temperatureResponseFactor === 4,
  'temperature response remains explicitly bounded under extreme forcing');
  const denitrificationContext = {
    transferId: 'test:floodplain-denitrification:1',
    reachId: 'test:reach:denitrification',
    atmosphereCellId: 'test:earth-cell:denitrification',
    startDay: 531, durationDays: 1, livingEnabled: true
  };
  const denitrificationReaction = floodplain
    .applyFloodplainDenitrificationReaction(denitrificationFloodplain,
      denitrificationPlan.reaction, denitrificationContext);
  const denitrificationAtmosphereBefore = atmosphereBiogeochemistry
    .createAtmosphereBiogeochemistry();
  const denitrificationAtmosphere = atmosphereBiogeochemistry
    .applyAtmosphereGasBoundaryInput(denitrificationAtmosphereBefore, {
      nitrogenKgN:
        denitrificationPlan.reaction.nitrogenGasProducedKgN
    }, 1e6, {
      sourceKind: 'floodplain-denitrification',
      transferId: denitrificationContext.transferId,
      sourceReachId: denitrificationContext.reachId,
      sourceReceiptDigest: denitrificationReaction.receipt.digest
    });
  const denitrified = floodplainDenitrification
    .advanceFloodplainDenitrification(denitrificationState,
      denitrificationPlan, denitrificationReaction.receipt,
      denitrificationAtmosphere.receipt, denitrificationContext);
  assert.ok(denitrified.receipt.status ===
      'anoxic-doc-denitrification' &&
    denitrificationReaction.receipt.truth.localDocToDicCarbonClosed ===
      true &&
    denitrificationReaction.receipt.truth.nitrogenGasBoundaryClosed ===
      true &&
    denitrificationReaction.receipt.truth.denitrificationAlkalinityClosed ===
      true &&
    denitrificationReaction.receipt.truth.alkalinityReceiverCredited ===
      true &&
    Math.abs(denitrificationReaction.receipt.reaction
      .alkalinityGeneratedKgCaCO3Eq -
      denitrificationReaction.receipt.reaction
        .nitrogenGasProducedKgN * 3.57) < 1e-7 &&
    denitrificationAtmosphere.receipt.receiverCredits.nativeLayerIndex ===
      0 &&
    denitrificationAtmosphere.receipt.inputs.carbonKgC === 0 &&
    denitrificationAtmosphere.receipt.inputs.oxygenKgO2 === 0 &&
    denitrificationAtmosphere.receipt.inputs.nitrogenKgN ===
      denitrificationReaction.receipt.reaction.nitrogenGasProducedKgN &&
    denitrified.receipt.reactionReceiptDigest ===
      denitrificationReaction.receipt.digest &&
    denitrified.receipt.atmosphereReceiptDigest ===
      denitrificationAtmosphere.receipt.digest &&
    denitrified.receipt.truth.ownerLedgersClosed === true &&
    denitrificationReaction.state.chemistry
      .dissolvedOrganicCarbonKgC < 12 &&
    denitrificationReaction.state.chemistry
      .dissolvedInorganicCarbonKgC > 3 &&
    denitrificationReaction.state.chemistry
      .dissolvedInorganicNitrogenKgN < 6 &&
    denitrificationReaction.state.chemistry
      .dissolvedNitrateNitrogenKgN < 3 &&
    denitrificationReaction.state.chemistry
      .dissolvedAmmoniumNitrogenKgN === 3 &&
    denitrificationReaction.state.chemistry
      .alkalinityKgCaCO3Eq >
        denitrificationFloodplain.chemistry.alkalinityKgCaCO3Eq &&
    denitrificationAtmosphere.state.layers[0].nitrogenGasKgNm2 >
      denitrificationAtmosphereBefore.layers[0].nitrogenGasKgNm2 &&
    denitrificationAtmosphere.state.cumulative
      .floodplainDenitrificationNitrogenGasInputKgNm2 > 0,
  'paired owners close DOC-to-DIC carbon, nitrate-N-to-native-layer-0 N2 and the 3.57 kg CaCO3-equivalent denitrification alkalinity credit under one exact transfer identity without consuming ammonium');
  const oxicFloodplain = JSON.parse(JSON.stringify(
    denitrificationFloodplain));
  oxicFloodplain.chemistry.dissolvedOxygenKgO2 = 3;
  const oxicDenitrificationPlan = floodplainDenitrification
    .floodplainDenitrificationPlan(denitrificationState,
      oxicFloodplain, {
        durationDays: 1, atmosphereAvailable: true,
        livingEnabled: true, anoxicThresholdMgL: 2
      });
  assert.ok(oxicDenitrificationPlan.activity.anoxiaFactor === 0 &&
    Object.values(oxicDenitrificationPlan.reaction)
      .every(value => value === 0),
  'oxygen at or above the declared threshold closes the denitrification gate');
  const nitrogenLimitedFloodplain = JSON.parse(JSON.stringify(
    denitrificationFloodplain));
  nitrogenLimitedFloodplain.chemistry
    .dissolvedNitrateNitrogenKgN = .0001;
  nitrogenLimitedFloodplain.chemistry
    .dissolvedInorganicNitrogenKgN = 3.0001;
  const nitrogenLimitedDenitrificationPlan = floodplainDenitrification
    .floodplainDenitrificationPlan(denitrificationState,
      nitrogenLimitedFloodplain, {
        durationDays: 1, atmosphereAvailable: true,
        livingEnabled: true, maximumDailyDocFraction: .25
      });
  assert.ok(nitrogenLimitedDenitrificationPlan.activity.nitrogenLimited ===
      true &&
    Math.abs(nitrogenLimitedDenitrificationPlan.reaction
      .dissolvedNitrateNitrogenConsumedKgN - .0001) < 1e-9,
  'the actual owned nitrate pool caps nitrogen loss while ammonium remains unavailable to denitrification');
  const ammoniumOnlyFloodplain = JSON.parse(JSON.stringify(
    denitrificationFloodplain));
  ammoniumOnlyFloodplain.chemistry.dissolvedNitrateNitrogenKgN = 0;
  ammoniumOnlyFloodplain.chemistry.dissolvedAmmoniumNitrogenKgN = 6;
  ammoniumOnlyFloodplain.chemistry.dissolvedInorganicNitrogenKgN = 6;
  const ammoniumOnlyDenitrificationPlan = floodplainDenitrification
    .floodplainDenitrificationPlan(denitrificationState,
      ammoniumOnlyFloodplain, {
        durationDays: 1, atmosphereAvailable: true,
        livingEnabled: true, maximumDailyDocFraction: .25
      });
  assert.ok(ammoniumOnlyDenitrificationPlan.activity
      .availableDissolvedAmmoniumNitrogenKgN === 6 &&
    ammoniumOnlyDenitrificationPlan.activity
      .availableDissolvedNitrateNitrogenKgN === 0 &&
    Object.values(ammoniumOnlyDenitrificationPlan.reaction)
      .every(value => value === 0),
  'ammonium cannot be silently relabeled or consumed as nitrate by denitrification');
  const unavailableDenitrificationPlan = floodplainDenitrification
    .floodplainDenitrificationPlan(denitrificationState,
      denitrificationFloodplain, {
        durationDays: .25, atmosphereAvailable: false,
        livingEnabled: true
      });
  const unavailableDenitrification = floodplainDenitrification
    .advanceFloodplainDenitrification(denitrificationState,
      unavailableDenitrificationPlan, null, null, {
        ...denitrificationContext,
        transferId: 'test:floodplain-denitrification:unloaded',
        atmosphereCellId: '', startDay: 532, durationDays: .25
      });
  assert.ok(unavailableDenitrification.receipt.status ===
      'atmosphere-unloaded-no-denitrification' &&
    unavailableDenitrification.receipt.atmosphereCellId === null &&
    Object.values(unavailableDenitrification.receipt.reaction)
      .every(value => value === 0) &&
    unavailableDenitrification.state.atmosphereUnavailableDays === .25,
  'an unloaded atmosphere records explicit zero-transfer memory and receives no fabricated nitrogen');
  const lifeOffDenitrificationPlan = floodplainDenitrification
    .floodplainDenitrificationPlan(denitrificationState,
      denitrificationFloodplain, {
        durationDays: 1, atmosphereAvailable: true,
        livingEnabled: false
      });
  const lifeOffDenitrificationContext = {
    ...denitrificationContext,
    transferId: 'test:floodplain-denitrification:life-off',
    startDay: 533, livingEnabled: false
  };
  const lifeOffDenitrificationReaction = floodplain
    .applyFloodplainDenitrificationReaction(denitrificationFloodplain,
      lifeOffDenitrificationPlan.reaction,
      lifeOffDenitrificationContext);
  const lifeOffDenitrificationAtmosphere = atmosphereBiogeochemistry
    .applyAtmosphereGasBoundaryInput(denitrificationAtmosphereBefore, {
      nitrogenKgN: 0
    }, 1e6, {
      sourceKind: 'floodplain-denitrification',
      transferId: lifeOffDenitrificationContext.transferId,
      sourceReachId: lifeOffDenitrificationContext.reachId,
      sourceReceiptDigest: lifeOffDenitrificationReaction.receipt.digest
    });
  const lifeOffDenitrification = floodplainDenitrification
    .advanceFloodplainDenitrification(denitrificationState,
      lifeOffDenitrificationPlan,
      lifeOffDenitrificationReaction.receipt,
      lifeOffDenitrificationAtmosphere.receipt,
      lifeOffDenitrificationContext);
  assert.ok(lifeOffDenitrification.receipt.status ===
      'life-disabled-dormant' &&
    lifeOffDenitrification.receipt.truth.denitrificationPoolsFrozen ===
      true &&
    Object.values(lifeOffDenitrification.receipt.reaction)
      .every(value => value === 0),
  'Life-off freezes floodplain denitrification while retaining typed zero owner receipts');
  const migrationDenitrificationState = floodplainDenitrification
    .emptyFloodplainDenitrificationState({ migrationCheckpoint: true });
  const migrationDenitrificationPlan = floodplainDenitrification
    .floodplainDenitrificationPlan(migrationDenitrificationState,
      denitrificationFloodplain, {
        durationDays: 1, atmosphereAvailable: false,
        livingEnabled: true
      });
  const migratedDenitrification = floodplainDenitrification
    .advanceFloodplainDenitrification(migrationDenitrificationState,
      migrationDenitrificationPlan, null, null, {
        ...denitrificationContext,
        transferId: 'test:floodplain-denitrification:migration',
        atmosphereCellId: '', startDay: 534
      });
  assert.ok(migratedDenitrification.receipt.status ===
      'initialized-after-v18-migration-no-invented-history' &&
    migratedDenitrification.state.migrationCheckpoint === false &&
    Object.values(migratedDenitrification.state.cumulativeReaction)
      .every(value => value === 0),
  'v18 migration clears one zero-transfer checkpoint without inventing denitrification history');
  const legacyDenitrificationState = floodplainDenitrification
    .emptyFloodplainDenitrificationState();
  legacyDenitrificationState.schema = floodplainDenitrification
    .PREVIOUS_FLOODPLAIN_DENITRIFICATION_STATE_SCHEMA;
  legacyDenitrificationState.observedDenitrificationDays = 3;
  legacyDenitrificationState.cumulativeReaction = {
    dissolvedOrganicCarbonConsumedKgC: 2,
    dissolvedInorganicCarbonProducedKgC: 2,
    dissolvedInorganicNitrogenConsumedKgN: 1.866666667,
    nitrogenGasProducedKgN: 1.866666667
  };
  legacyDenitrificationState.temperatureConstrainedDays = 2;
  legacyDenitrificationState.lastActivity.reactiveNitrateEquivalentKgN = 3;
  legacyDenitrificationState.lastActivity
    .reactiveNitrateEquivalentFraction = .5;
  delete legacyDenitrificationState.lastActivity
    .availableDissolvedNitrateNitrogenKgN;
  delete legacyDenitrificationState.lastActivity
    .availableDissolvedAmmoniumNitrogenKgN;
  legacyDenitrificationState.lastTransitionReceipt = null;
  const normalizedLegacyDenitrification = floodplainDenitrification
    .normalizeFloodplainDenitrificationState(legacyDenitrificationState);
  assert.ok(normalizedLegacyDenitrification.schema ===
      floodplainDenitrification.FLOODPLAIN_DENITRIFICATION_STATE_SCHEMA &&
    normalizedLegacyDenitrification.migrationCheckpoint === true &&
    normalizedLegacyDenitrification.observedDenitrificationDays === 3 &&
    normalizedLegacyDenitrification.cumulativeReaction
      .dissolvedOrganicCarbonConsumedKgC === 2 &&
    normalizedLegacyDenitrification.cumulativeReaction
      .dissolvedNitrateNitrogenConsumedKgN === 1.866666667 &&
    normalizedLegacyDenitrification.cumulativeReaction
      .nitrogenGasProducedKgN === 1.866666667 &&
    normalizedLegacyDenitrification.temperatureConstrainedDays === 2 &&
    normalizedLegacyDenitrification.lastActivity
      .availableDissolvedNitrateNitrogenKgN === 3,
  'v2 denitrification memory migrates to v3 without erasing reaction, temperature or prior nitrate-equivalent history');
  const mismatchedDenitrificationAtmosphere = JSON.parse(JSON.stringify(
    denitrificationAtmosphere.receipt));
  mismatchedDenitrificationAtmosphere.sourceReceiptDigest =
    'fnv1a32:corrupt';
  assert.throws(() => floodplainDenitrification
    .advanceFloodplainDenitrification(denitrificationState,
      denitrificationPlan, denitrificationReaction.receipt,
      mismatchedDenitrificationAtmosphere, denitrificationContext),
  /do not match the plan lineage/,
  'the denitrification process refuses owner receipts with mismatched source evidence');
  assert.equal(
    floodplainNitrification.FLOODPLAIN_NITRIFICATION_STATE_SCHEMA,
    'axm.foundation-planet.floodplain-nitrification-state/v2');
  assert.equal(
    floodplainNitrification.FLOODPLAIN_NITRIFICATION_RECEIPT_SCHEMA,
    'axm.foundation-planet.floodplain-nitrification-receipt/v2');
  assert.equal(floodplain
    .FLOODPLAIN_NITRIFICATION_REACTION_RECEIPT_SCHEMA,
  'axm.foundation-planet.floodplain-nitrification-reaction-receipt/v3');
  assert.equal(floodplain
    .PREVIOUS_FLOODPLAIN_NITRIFICATION_REACTION_RECEIPT_SCHEMA,
  'axm.foundation-planet.floodplain-nitrification-reaction-receipt/v2');
  assert.equal(floodplainNitrification
    .NITRIFICATION_OXYGEN_KG_O2_PER_KG_N, 4.57);
  assert.equal(floodplainNitrification
    .NITRIFICATION_ALKALINITY_DEMAND_KG_CACO3_PER_KG_N, 7.14);
  const nitrificationFloodplain = floodplain.emptyFloodplainState();
  nitrificationFloodplain.waterKg = 1e6;
  nitrificationFloodplain.inundatedFraction = .81;
  nitrificationFloodplain.chemistry.dissolvedNitrateNitrogenKgN = 1;
  nitrificationFloodplain.chemistry.dissolvedAmmoniumNitrogenKgN = 2;
  nitrificationFloodplain.chemistry.dissolvedInorganicNitrogenKgN = 3;
  nitrificationFloodplain.chemistry.dissolvedOxygenKgO2 = 10;
  nitrificationFloodplain.chemistry.alkalinityKgCaCO3Eq = 10;
  const nitrificationState = floodplainNitrification
    .emptyFloodplainNitrificationState();
  const nitrificationPlan = floodplainNitrification
    .floodplainNitrificationPlan(nitrificationState,
      nitrificationFloodplain, {
        durationDays: 1, livingEnabled: true, lifeAbundance: 1,
        minimumDissolvedOxygenMgL: 2,
        optimalDissolvedOxygenMgL: 6,
        maximumDailyAmmoniumFraction: .1,
        waterTemperatureC: 20
      });
  assert.ok(nitrificationPlan.activity.dissolvedOxygenMgL === 10 &&
    nitrificationPlan.activity.oxygenResponseFactor === 1 &&
    nitrificationPlan.reaction
      .dissolvedAmmoniumNitrogenConsumedKgN > 0 &&
    nitrificationPlan.reaction.dissolvedNitrateNitrogenProducedKgN ===
      nitrificationPlan.reaction
        .dissolvedAmmoniumNitrogenConsumedKgN &&
    Math.abs(nitrificationPlan.reaction.dissolvedOxygenConsumedKgO2 -
      nitrificationPlan.reaction
        .dissolvedAmmoniumNitrogenConsumedKgN * 4.57) < 1e-7 &&
    Math.abs(nitrificationPlan.reaction.alkalinityDemandKgCaCO3 -
      nitrificationPlan.reaction
        .dissolvedAmmoniumNitrogenConsumedKgN * 7.14) < 1e-7,
  'oxic floodplain water opens a bounded ammonium-backed nitrification plan with explicit oxygen and alkalinity-demand stoichiometry');
  const nitrificationContext = {
    transferId: 'test:floodplain-nitrification:1',
    reachId: 'test:reach:nitrification',
    startDay: 535, durationDays: 1, livingEnabled: true
  };
  const nitrificationReaction = floodplain
    .applyFloodplainNitrificationReaction(nitrificationFloodplain,
      nitrificationPlan.reaction, nitrificationContext);
  const nitrified = floodplainNitrification
    .advanceFloodplainNitrification(nitrificationState,
      nitrificationPlan, nitrificationReaction.receipt,
      nitrificationContext);
  assert.ok(nitrified.receipt.status ===
      'aerobic-ammonium-nitrification' &&
    nitrificationReaction.receipt.truth
      .ammoniumToNitrateNitrogenClosed === true &&
    nitrificationReaction.receipt.truth
      .dissolvedOxygenConsumptionClosed === true &&
    nitrificationReaction.receipt.truth
      .alkalinityConsumptionClosed === true &&
    nitrificationReaction.receipt.truth
      .alkalinityMaterialOwnerDebited === true &&
    nitrificationReaction.receipt.truth.pHFeedbackModeled === false &&
    nitrificationReaction.state.chemistry
      .dissolvedAmmoniumNitrogenKgN < 2 &&
    nitrificationReaction.state.chemistry
      .dissolvedNitrateNitrogenKgN > 1 &&
    Math.abs(nitrificationReaction.state.chemistry
      .dissolvedInorganicNitrogenKgN - 3) < 1e-9 &&
    nitrificationReaction.state.chemistry.dissolvedOxygenKgO2 < 10 &&
    nitrificationReaction.state.chemistry.alkalinityKgCaCO3Eq < 10 &&
    nitrified.receipt.reactionReceiptDigest ===
      nitrificationReaction.receipt.digest,
  'one exact local owner receipt conserves DIN while debiting ammonium and oxygen and crediting nitrate');
  const oxygenConstrainedNitrificationFloodplain = JSON.parse(
    JSON.stringify(nitrificationFloodplain));
  oxygenConstrainedNitrificationFloodplain.chemistry
    .dissolvedOxygenKgO2 = 1;
  const oxygenConstrainedNitrificationPlan = floodplainNitrification
    .floodplainNitrificationPlan(nitrificationState,
      oxygenConstrainedNitrificationFloodplain, {
        durationDays: 1, livingEnabled: true,
        minimumDissolvedOxygenMgL: 2,
        optimalDissolvedOxygenMgL: 6
      });
  assert.ok(oxygenConstrainedNitrificationPlan.activity
      .oxygenResponseFactor === 0 &&
    Object.values(oxygenConstrainedNitrificationPlan.reaction)
      .every(value => value === 0),
  'sub-threshold dissolved oxygen closes the nitrification gate');
  const oxygenLimitedNitrificationFloodplain = floodplain
    .emptyFloodplainState();
  oxygenLimitedNitrificationFloodplain.waterKg = 1;
  oxygenLimitedNitrificationFloodplain.inundatedFraction = 1;
  oxygenLimitedNitrificationFloodplain.chemistry
    .dissolvedNitrateNitrogenKgN = 0;
  oxygenLimitedNitrificationFloodplain.chemistry
    .dissolvedAmmoniumNitrogenKgN = 1;
  oxygenLimitedNitrificationFloodplain.chemistry
    .dissolvedInorganicNitrogenKgN = 1;
  oxygenLimitedNitrificationFloodplain.chemistry
    .dissolvedOxygenKgO2 = 3e-6;
  oxygenLimitedNitrificationFloodplain.chemistry
    .alkalinityKgCaCO3Eq = 10;
  const oxygenLimitedNitrificationPlan = floodplainNitrification
    .floodplainNitrificationPlan(nitrificationState,
      oxygenLimitedNitrificationFloodplain, {
        durationDays: 1, livingEnabled: true,
        minimumDissolvedOxygenMgL: 2,
        optimalDissolvedOxygenMgL: 6,
        maximumDailyAmmoniumFraction: .25
      });
  assert.ok(oxygenLimitedNitrificationPlan.activity.oxygenLimited ===
      true &&
    Math.abs(oxygenLimitedNitrificationPlan.activity
      .minimumOxygenReserveKgO2 - 2e-6) < 1e-9 &&
    Math.abs(oxygenLimitedNitrificationPlan.activity
      .reactiveDissolvedOxygenKgO2 - 1e-6) < 1e-9 &&
    Math.abs(oxygenLimitedNitrificationPlan.reaction
      .dissolvedOxygenConsumedKgO2 - 1e-6) < 1e-9 &&
    oxygenLimitedNitrificationPlan.truth
      .minimumDissolvedOxygenReserveHonored === true,
  'only oxygen above the configured aerobic minimum is reactive when dissolved oxygen limits nitrification');
  const alkalinityLimitedFloodplain = floodplain.emptyFloodplainState();
  alkalinityLimitedFloodplain.waterKg = 1000;
  alkalinityLimitedFloodplain.inundatedFraction = 1;
  alkalinityLimitedFloodplain.chemistry.dissolvedNitrateNitrogenKgN = 0;
  alkalinityLimitedFloodplain.chemistry.dissolvedAmmoniumNitrogenKgN = 1;
  alkalinityLimitedFloodplain.chemistry.dissolvedInorganicNitrogenKgN = 1;
  alkalinityLimitedFloodplain.chemistry.dissolvedOxygenKgO2 = 1;
  alkalinityLimitedFloodplain.chemistry.alkalinityKgCaCO3Eq = .00714;
  const alkalinityLimitedPlan = floodplainNitrification
    .floodplainNitrificationPlan(nitrificationState,
      alkalinityLimitedFloodplain, {
        durationDays: 1, livingEnabled: true,
        minimumDissolvedOxygenMgL: 0,
        optimalDissolvedOxygenMgL: 1,
        maximumDailyAmmoniumFraction: .25
      });
  const alkalinityLimitedReaction = floodplain
    .applyFloodplainNitrificationReaction(alkalinityLimitedFloodplain,
      alkalinityLimitedPlan.reaction, {
        ...nitrificationContext,
        transferId: 'test:floodplain-nitrification:alkalinity-limit'
      });
  assert.ok(alkalinityLimitedPlan.activity.alkalinityLimited === true &&
    Math.abs(alkalinityLimitedPlan.reaction
      .dissolvedAmmoniumNitrogenConsumedKgN - .001) < 1e-9 &&
    Math.abs(alkalinityLimitedReaction.state.chemistry
      .alkalinityKgCaCO3Eq) < 1e-12 &&
    alkalinityLimitedReaction.receipt.truth
      .alkalinityConsumptionClosed === true,
  'finite owned alkalinity caps nitrification and is debited without overdraft');
  const legacyNitrificationDiagnostic = floodplainNitrification
    .emptyFloodplainNitrificationState();
  legacyNitrificationDiagnostic.schema = floodplainNitrification
    .PREVIOUS_FLOODPLAIN_NITRIFICATION_STATE_SCHEMA;
  legacyNitrificationDiagnostic.cumulativeReaction = {
    dissolvedAmmoniumNitrogenConsumedKgN: 2,
    dissolvedNitrateNitrogenProducedKgN: 2,
    dissolvedOxygenConsumedKgO2: 9.14,
    alkalinityDemandKgCaCO3: 14.28
  };
  const migratedNitrificationDiagnostic = floodplainNitrification
    .normalizeFloodplainNitrificationState(legacyNitrificationDiagnostic);
  assert.ok(migratedNitrificationDiagnostic.cumulativeReaction
      .dissolvedAmmoniumNitrogenConsumedKgN === 2 &&
    migratedNitrificationDiagnostic.cumulativeReaction
      .dissolvedOxygenConsumedKgO2 === 9.14 &&
    migratedNitrificationDiagnostic.cumulativeReaction
      .alkalinityDemandKgCaCO3 === 0 &&
    migratedNitrificationDiagnostic
      .legacyCumulativeAlkalinityDemandDiagnosticKgCaCO3 === 14.28,
  'v1 nitrification migration preserves historical N/O2 reaction evidence but separates its non-material alkalinity diagnostic from v2 owner debits');
  const migrationNitrificationState = floodplainNitrification
    .emptyFloodplainNitrificationState({ migrationCheckpoint: true });
  const migrationNitrificationPlan = floodplainNitrification
    .floodplainNitrificationPlan(migrationNitrificationState,
      nitrificationFloodplain, { durationDays: 1, livingEnabled: true });
  const migrationNitrificationReaction = floodplain
    .applyFloodplainNitrificationReaction(nitrificationFloodplain,
      migrationNitrificationPlan.reaction, {
        ...nitrificationContext,
        transferId: 'test:floodplain-nitrification:migration'
      });
  const migratedNitrification = floodplainNitrification
    .advanceFloodplainNitrification(migrationNitrificationState,
      migrationNitrificationPlan,
      migrationNitrificationReaction.receipt, {
        ...nitrificationContext,
        transferId: 'test:floodplain-nitrification:migration'
      });
  assert.ok(migratedNitrification.receipt.status ===
      'initialized-after-schema-migration-no-invented-history' &&
    migratedNitrification.state.migrationCheckpoint === false &&
    Object.values(migratedNitrification.state.cumulativeReaction)
      .every(value => value === 0),
  'v19 migration clears one zero-transfer nitrification checkpoint without inventing material or history');
  const lifeOffNitrificationPlan = floodplainNitrification
    .floodplainNitrificationPlan(nitrificationState,
      nitrificationFloodplain, {
        durationDays: 1, livingEnabled: false
      });
  const lifeOffNitrificationReaction = floodplain
    .applyFloodplainNitrificationReaction(nitrificationFloodplain,
      lifeOffNitrificationPlan.reaction, {
        ...nitrificationContext,
        transferId: 'test:floodplain-nitrification:life-off',
        livingEnabled: false
      });
  const lifeOffNitrification = floodplainNitrification
    .advanceFloodplainNitrification(nitrificationState,
      lifeOffNitrificationPlan, lifeOffNitrificationReaction.receipt, {
        ...nitrificationContext,
        transferId: 'test:floodplain-nitrification:life-off',
        livingEnabled: false
      });
  assert.ok(lifeOffNitrification.receipt.status ===
      'life-disabled-dormant' &&
    lifeOffNitrification.receipt.truth.nitrificationPoolsFrozen === true &&
    Object.values(lifeOffNitrification.receipt.reaction)
      .every(value => value === 0),
  'Life-off freezes nitrification while retaining a typed zero owner receipt');
  assert.throws(() => floodplain.applyFloodplainNitrificationReaction(
    nitrificationFloodplain, {
      dissolvedAmmoniumNitrogenConsumedKgN: 1,
      dissolvedNitrateNitrogenProducedKgN: 1,
      dissolvedOxygenConsumedKgO2: 1,
      alkalinityDemandKgCaCO3: 7.14
    }, nitrificationContext), /stoichiometrically closed/,
  'a malformed nitrification oxygen ledger is refused before chemistry mutation');
  assert.equal(
    floodplainGasExchange.FLOODPLAIN_GAS_EXCHANGE_STATE_SCHEMA,
    'axm.foundation-planet.floodplain-gas-exchange-state/v3');
  assert.equal(
    floodplainGasExchange.PREVIOUS_FLOODPLAIN_GAS_EXCHANGE_STATE_SCHEMA,
    'axm.foundation-planet.floodplain-gas-exchange-state/v2');
  assert.equal(
    floodplainGasExchange.FLOODPLAIN_GAS_EXCHANGE_PROCESS_RECEIPT_SCHEMA,
    'axm.foundation-planet.floodplain-gas-exchange-process-receipt/v3');
  assert.equal(floodplainGasExchange
    .PREVIOUS_FLOODPLAIN_GAS_EXCHANGE_PROCESS_RECEIPT_SCHEMA,
  'axm.foundation-planet.floodplain-gas-exchange-process-receipt/v2');
  assert.equal(floodplain.FLOODPLAIN_GAS_EXCHANGE_RECEIPT_SCHEMA,
    'axm.foundation-planet.floodplain-gas-exchange-receipt/v3');
  assert.equal(floodplain.PREVIOUS_FLOODPLAIN_GAS_EXCHANGE_RECEIPT_SCHEMA,
    'axm.foundation-planet.floodplain-gas-exchange-receipt/v2');
  assert.equal(atmosphereBiogeochemistry
    .ATMOSPHERE_BIOGEOCHEMISTRY_STATE_SCHEMA,
  'axm.foundation-planet.atmosphere-biogeochemistry-state/v4');
  assert.equal(atmosphereBiogeochemistry
    .PREVIOUS_ATMOSPHERE_BIOGEOCHEMISTRY_STATE_SCHEMA,
  'axm.foundation-planet.atmosphere-biogeochemistry-state/v3');
  assert.equal(atmosphereBiogeochemistry
    .LEGACY_ATMOSPHERE_BIOGEOCHEMISTRY_STATE_SCHEMA,
  'axm.foundation-planet.atmosphere-biogeochemistry-state/v2');
  assert.equal(atmosphereBiogeochemistry
    .OLDEST_ATMOSPHERE_BIOGEOCHEMISTRY_STATE_SCHEMA,
  'axm.foundation-planet.atmosphere-biogeochemistry-state/v1');
  assert.equal(atmosphereBiogeochemistry
    .ATMOSPHERE_FLOODPLAIN_GAS_EXCHANGE_RECEIPT_SCHEMA,
  'axm.foundation-planet.atmosphere-floodplain-gas-exchange-receipt/v3');
  assert.equal(atmosphereBiogeochemistry
    .PREVIOUS_ATMOSPHERE_FLOODPLAIN_GAS_EXCHANGE_RECEIPT_SCHEMA,
  'axm.foundation-planet.atmosphere-floodplain-gas-exchange-receipt/v2');
  assert.deepEqual(atmosphereBiogeochemistry
    .atmosphereBiogeochemistryDescription()
    .floodplainGasExchangeMassClosureAbsoluteFloorsKg,
  { carbonKgC: 1e-3, oxygenKgO2: 1e-3 });
  assert.equal(atmosphereBiogeochemistry
    .atmosphereBiogeochemistryDescription()
    .floodplainGasExchangeMassClosureUlpFactor, 8,
  'native atmosphere gas exchange declares scale-aware owner-level floating-point bounds');
  const gasFloodplain = floodplain.emptyFloodplainState();
  gasFloodplain.waterKg = 1e6;
  gasFloodplain.inundatedFraction = .81;
  gasFloodplain.chemistry.dissolvedInorganicCarbonKgC = 20;
  gasFloodplain.chemistry.dissolvedOxygenKgO2 = .1;
  const gasAtmosphere = atmosphereBiogeochemistry
    .createAtmosphereBiogeochemistry();
  const gasProcessState = floodplainGasExchange
    .emptyFloodplainGasExchangeState();
  const gasFloodplainBefore = JSON.stringify(gasFloodplain);
  const gasAtmosphereBefore = JSON.stringify(gasAtmosphere);
  const gasPlan = floodplainGasExchange.floodplainGasExchangePlan(
    gasProcessState, gasFloodplain, gasAtmosphere, {
      durationDays: .5,
      receivingAreaM2: 1e6,
      waterTemperatureC: 20,
      livingEnabled: false
    });
  assert.ok(gasPlan.exchange.carbonToAtmosphereKgC > 0 &&
    gasPlan.exchange.oxygenToFloodplainKgO2 > 0 &&
    gasPlan.truth.atmosphereLoaded === true &&
    gasPlan.truth.physicalExchangeContinuesWithLifeOff === true,
  'parameterized DIC evasion and oxygen reaeration remain physical while Life is off');
  const gasContext = {
    exchangeId: 'test:floodplain-atmosphere:1',
    reachId: 'test:reach:gas',
    atmosphereCellId: 'test:earth-cell:gas',
    startDay: 530,
    durationDays: .5
  };
  const gasFloodplainOwner = floodplain.applyFloodplainGasExchange(
    gasFloodplain, gasPlan.exchange, gasContext);
  const gasAtmosphereOwner = atmosphereBiogeochemistry
    .applyAtmosphereFloodplainGasExchange(
      gasAtmosphere, gasPlan.exchange, 1e6, gasContext);
  assert.ok(gasAtmosphereOwner.receipt.conservation.policy.schema ===
      atmosphereBiogeochemistry
        .ATMOSPHERE_FLOODPLAIN_GAS_EXCHANGE_MASS_CLOSURE_POLICY_SCHEMA &&
    gasAtmosphereOwner.receipt.truth.scaleAwareFloatingPointClosure ===
      true &&
    gasAtmosphereOwner.receipt.truth.perIdentityNumericBounds === true &&
    gasAtmosphereOwner.receipt.truth.measuredResidualsPreserved === true &&
    gasAtmosphereOwner.receipt.truth.fixedAbsoluteToleranceOnly === false,
  'the atmosphere owner records its operands, measured residuals and derived per-identity bounds');
  const gasTransition = floodplainGasExchange
    .advanceFloodplainGasExchange(gasProcessState, gasPlan,
      gasFloodplainOwner.receipt, gasAtmosphereOwner.receipt, gasContext);
  assert.ok(gasTransition.receipt.status ===
      'bounded-co2-evasion-and-oxygen-reaeration' &&
    gasTransition.receipt.floodplainReceiptDigest ===
      gasFloodplainOwner.receipt.digest &&
    gasTransition.receipt.atmosphereReceiptDigest ===
      gasAtmosphereOwner.receipt.digest &&
    gasTransition.receipt.truth.exactExchangeIdentity === true &&
    gasTransition.receipt.truth.ownerLedgersClosed === true &&
    gasFloodplainOwner.state.chemistry.dissolvedInorganicCarbonKgC < 20 &&
    gasFloodplainOwner.state.chemistry.dissolvedOxygenKgO2 > .1 &&
    gasAtmosphereOwner.state.carbonDioxideCarbonKgCm2 >
      gasAtmosphere.carbonDioxideCarbonKgCm2 &&
    gasAtmosphereOwner.state.oxygenKgO2m2 < gasAtmosphere.oxygenKgO2m2,
  'both material owners mutate under one exact exchange identity and the non-owning process retains their evidence digests');
  const invasionFloodplain = floodplain.emptyFloodplainState();
  invasionFloodplain.waterKg = 1e6;
  invasionFloodplain.inundatedFraction = .81;
  invasionFloodplain.chemistry.dissolvedInorganicCarbonKgC = 0;
  invasionFloodplain.chemistry.dissolvedOxygenKgO2 = .1;
  const invasionPlan = floodplainGasExchange.floodplainGasExchangePlan(
    floodplainGasExchange.emptyFloodplainGasExchangeState(),
    invasionFloodplain, gasAtmosphere, {
      durationDays: .5,
      receivingAreaM2: 1e6,
      waterTemperatureC: 20,
      livingEnabled: false
    });
  assert.ok(invasionPlan.exchange.carbonToFloodplainKgC > 0 &&
    invasionPlan.exchange.carbonToAtmosphereKgC === 0 &&
    invasionPlan.truth.carbonExchangeDirectionExclusive === true &&
    invasionPlan.truth.atmosphereSurfaceCarbonBoundsCarbonInvasion === true,
  'an undersaturated floodplain plans bounded atmosphere-to-water CO2-carbon invasion');
  const invasionContext = {
    ...gasContext,
    exchangeId: 'test:floodplain-atmosphere:invasion',
    startDay: 530.5
  };
  const invasionFloodplainOwner = floodplain.applyFloodplainGasExchange(
    invasionFloodplain, invasionPlan.exchange, invasionContext);
  const invasionAtmosphereOwner = atmosphereBiogeochemistry
    .applyAtmosphereFloodplainGasExchange(
      gasAtmosphere, invasionPlan.exchange, 1e6, invasionContext);
  const invasionTransition = floodplainGasExchange
    .advanceFloodplainGasExchange(
      floodplainGasExchange.emptyFloodplainGasExchangeState(),
      invasionPlan, invasionFloodplainOwner.receipt,
      invasionAtmosphereOwner.receipt, invasionContext);
  assert.ok(invasionTransition.receipt.status ===
      'bounded-co2-invasion-and-oxygen-reaeration' &&
    invasionFloodplainOwner.state.chemistry
      .dissolvedInorganicCarbonKgC > 0 &&
    invasionAtmosphereOwner.state.carbonDioxideCarbonKgCm2 <
      gasAtmosphere.carbonDioxideCarbonKgCm2 &&
    invasionTransition.receipt.truth.ownerLedgersClosed === true,
  'paired owner hands close the reverse carbon direction without changing authority');
  assert.equal(JSON.stringify(gasFloodplain), gasFloodplainBefore,
    'floodplain gas exchange does not mutate its source object');
  assert.equal(JSON.stringify(gasAtmosphere), gasAtmosphereBefore,
    'atmosphere gas exchange does not mutate its source object');
  assert.throws(() => floodplain.applyFloodplainGasExchange(
    gasFloodplain, {
      carbonToAtmosphereKgC: 21,
      oxygenToFloodplainKgO2: 0
    }, gasContext), /cannot overdraw dissolved inorganic carbon/,
  'the floodplain owner refuses a DIC overdraw');
  assert.throws(() => atmosphereBiogeochemistry
    .applyAtmosphereFloodplainGasExchange(gasAtmosphere, {
      carbonToAtmosphereKgC: 0,
      oxygenToFloodplainKgO2:
        gasAtmosphere.layers[0].oxygenKgO2m2 * 1e6 + 1
    }, 1e6, gasContext), /cannot overdraw surface-layer oxygen/,
  'the native atmosphere owner refuses a surface-layer oxygen overdraw');
  assert.throws(() => atmosphereBiogeochemistry
    .applyAtmosphereFloodplainGasExchange(gasAtmosphere, {
      carbonToAtmosphereKgC: 0,
      carbonToFloodplainKgC:
        gasAtmosphere.layers[0].carbonDioxideCarbonKgCm2 * 1e6 + 1,
      oxygenToFloodplainKgO2: 0
    }, 1e6, gasContext), /cannot overdraw surface-layer carbon dioxide/,
  'the native atmosphere owner refuses a surface-layer CO2-carbon overdraw');
  const mismatchedAtmosphereReceipt = JSON.parse(JSON.stringify(
    gasAtmosphereOwner.receipt));
  mismatchedAtmosphereReceipt.exchangeId = 'test:wrong-exchange';
  assert.throws(() => floodplainGasExchange.advanceFloodplainGasExchange(
    gasProcessState, gasPlan, gasFloodplainOwner.receipt,
    mismatchedAtmosphereReceipt, gasContext), /do not match/,
  'the process organ refuses owner receipts from different exchange lineage');
  assert.throws(() => floodplainGasExchange.floodplainGasExchangePlan(
    gasProcessState, gasFloodplain, gasAtmosphere,
    { durationDays: 1.01 }), /no longer than one day/,
  'gas exchange refuses an unbounded multi-day step');
  const unavailablePlan = floodplainGasExchange.floodplainGasExchangePlan(
    gasProcessState, gasFloodplain, null, {
      durationDays: .25,
      atmosphereAvailable: false
    });
  const unavailableTransition = floodplainGasExchange
    .advanceFloodplainGasExchange(gasProcessState, unavailablePlan,
      null, null, {
        exchangeId: 'test:floodplain-atmosphere:unloaded',
        reachId: 'test:reach:gas',
        startDay: 531,
        durationDays: .25
      });
  assert.ok(unavailableTransition.receipt.status ===
      'atmosphere-unloaded-no-exchange' &&
    unavailableTransition.receipt.atmosphereCellId === null &&
    unavailableTransition.receipt.exchange.carbonToAtmosphereKgC === 0 &&
    unavailableTransition.receipt.exchange.carbonToFloodplainKgC === 0 &&
    unavailableTransition.receipt.exchange.oxygenToFloodplainKgO2 === 0 &&
    unavailableTransition.state.atmosphereUnavailableDays === .25,
  'an unloaded atmosphere retains explicit process memory but moves no material and emits no owner receipt');
  const legacyGasState = floodplainGasExchange.emptyFloodplainGasExchangeState();
  legacyGasState.schema = floodplainGasExchange
    .LEGACY_FLOODPLAIN_GAS_EXCHANGE_STATE_SCHEMA;
  legacyGasState.observedExchangeDays = 2;
  legacyGasState.cumulativeExchange = {
    carbonToAtmosphereKgC: 3,
    oxygenToFloodplainKgO2: 4
  };
  const normalizedLegacyGasState = floodplainGasExchange
    .normalizeFloodplainGasExchangeState(legacyGasState);
  assert.ok(normalizedLegacyGasState.migrationCheckpoint === true &&
    normalizedLegacyGasState.observedExchangeDays === 2 &&
    normalizedLegacyGasState.cumulativeExchange.carbonToAtmosphereKgC ===
      3 &&
    normalizedLegacyGasState.cumulativeExchange.carbonToFloodplainKgC ===
      0 &&
    normalizedLegacyGasState.cumulativeExchange.oxygenToFloodplainKgO2 ===
      4,
  'v1 gas-exchange memory migrates without erasing observed history or inventing reverse carbon transfer');
  const previousGasState = JSON.parse(JSON.stringify(gasTransition.state));
  previousGasState.schema = floodplainGasExchange
    .PREVIOUS_FLOODPLAIN_GAS_EXCHANGE_STATE_SCHEMA;
  previousGasState.lastTransitionReceipt.schema = floodplainGasExchange
    .PREVIOUS_FLOODPLAIN_GAS_EXCHANGE_PROCESS_RECEIPT_SCHEMA;
  const previousGasMaterial = {
    observedExchangeDays: previousGasState.observedExchangeDays,
    inactiveDays: previousGasState.inactiveDays,
    atmosphereUnavailableDays: previousGasState.atmosphereUnavailableDays,
    cumulativeExchange: JSON.parse(JSON.stringify(
      previousGasState.cumulativeExchange)),
    lastFloodplainReceiptDigest: previousGasState.lastFloodplainReceiptDigest,
    lastAtmosphereReceiptDigest: previousGasState.lastAtmosphereReceiptDigest
  };
  const migratedPreviousGasState = floodplainGasExchange
    .normalizeFloodplainGasExchangeState(previousGasState);
  assert.deepEqual({
    observedExchangeDays: migratedPreviousGasState.observedExchangeDays,
    inactiveDays: migratedPreviousGasState.inactiveDays,
    atmosphereUnavailableDays:
      migratedPreviousGasState.atmosphereUnavailableDays,
    cumulativeExchange: migratedPreviousGasState.cumulativeExchange,
    lastFloodplainReceiptDigest:
      migratedPreviousGasState.lastFloodplainReceiptDigest,
    lastAtmosphereReceiptDigest:
      migratedPreviousGasState.lastAtmosphereReceiptDigest
  }, previousGasMaterial,
  'v2-to-v3 gas-process migration preserves clocks, cumulative exchange and owner digests');
  assert.ok(migratedPreviousGasState.migrationCheckpoint === true &&
    migratedPreviousGasState.lastTransitionReceipt === null,
  'v2-to-v3 gas-process migration drops the old receipt instead of relabeling R62 evidence');
  const migratedGasState = floodplainGasExchange
    .emptyFloodplainGasExchangeState({ migrationCheckpoint: true });
  const migratedGasPlan = floodplainGasExchange.floodplainGasExchangePlan(
    migratedGasState, gasFloodplain, gasAtmosphere, {
      durationDays: 1, receivingAreaM2: 1e6
    });
  const migratedFloodplainOwner = floodplain.applyFloodplainGasExchange(
    gasFloodplain, migratedGasPlan.exchange, {
      ...gasContext, exchangeId: 'test:floodplain-atmosphere:migration',
      startDay: 532, durationDays: 1
    });
  const migratedAtmosphereOwner = atmosphereBiogeochemistry
    .applyAtmosphereFloodplainGasExchange(gasAtmosphere,
      migratedGasPlan.exchange, 1e6, {
        ...gasContext,
        exchangeId: 'test:floodplain-atmosphere:migration',
        startDay: 532,
        durationDays: 1
      });
  const migratedGas = floodplainGasExchange.advanceFloodplainGasExchange(
    migratedGasState, migratedGasPlan, migratedFloodplainOwner.receipt,
    migratedAtmosphereOwner.receipt, {
      ...gasContext,
      exchangeId: 'test:floodplain-atmosphere:migration',
      startDay: 532,
      durationDays: 1
    });
  assert.ok(migratedGas.receipt.status ===
      'initialized-after-v15-migration-no-invented-history' &&
    migratedGas.receipt.exchange.carbonToAtmosphereKgC === 0 &&
    migratedGas.receipt.exchange.carbonToFloodplainKgC === 0 &&
    migratedGas.receipt.exchange.oxygenToFloodplainKgO2 === 0 &&
    migratedGas.state.migrationCheckpoint === false &&
    Object.values(migratedGas.state.cumulativeExchange)
      .every(value => value === 0),
  'v15 migration clears its checkpoint without inventing exchange history or moving C/O2');
  const previousAtmosphereGasState = JSON.parse(JSON.stringify(
    gasAtmosphereOwner.state));
  previousAtmosphereGasState.schema = atmosphereBiogeochemistry
    .PREVIOUS_ATMOSPHERE_BIOGEOCHEMISTRY_STATE_SCHEMA;
  previousAtmosphereGasState.lastFloodplainGasExchangeReceipt.schema =
    atmosphereBiogeochemistry
      .PREVIOUS_ATMOSPHERE_FLOODPLAIN_GAS_EXCHANGE_RECEIPT_SCHEMA;
  const previousAtmosphereLayers = JSON.parse(JSON.stringify(
    previousAtmosphereGasState.layers));
  const previousAtmosphereCumulative = JSON.parse(JSON.stringify(
    previousAtmosphereGasState.cumulative));
  const migratedAtmosphereGasState = atmosphereBiogeochemistry
    .normalizeAtmosphereBiogeochemistry(previousAtmosphereGasState);
  assert.ok(migratedAtmosphereGasState.schema ===
      atmosphereBiogeochemistry.ATMOSPHERE_BIOGEOCHEMISTRY_STATE_SCHEMA &&
    migratedAtmosphereGasState.migrationCheckpoint === true &&
    migratedAtmosphereGasState.migrationSourceSchema ===
      atmosphereBiogeochemistry
        .PREVIOUS_ATMOSPHERE_BIOGEOCHEMISTRY_STATE_SCHEMA &&
    migratedAtmosphereGasState.lastFloodplainGasExchangeReceipt === null,
  'v3-to-v4 atmosphere migration drops old gas-exchange evidence instead of relabeling it');
  assert.deepEqual(migratedAtmosphereGasState.layers,
    previousAtmosphereLayers,
  'v3-to-v4 atmosphere migration preserves all eight material layers');
  assert.deepEqual(migratedAtmosphereGasState.cumulative,
    previousAtmosphereCumulative,
  'v3-to-v4 atmosphere migration preserves cumulative gas movement');
  const reactionScalesKg = [1e5, 1e6, 1e7, 1e8, 5e8, 1e9,
    5e9, 1e10, 5e10, 1e11, 5e11, 1e12];
  const reactionFractions = [.1, 1 / 3, .5, .9, .999999];
  const reactionContext = {
    reachId: 'test:reaction-scale-aware',
    transferId: 'test:reaction-scale-aware:transfer',
    atmosphereCellId: 'test:reaction-scale-aware:air',
    exchangeId: 'test:reaction-scale-aware:exchange',
    durationDays: 1,
    livingEnabled: true
  };
  const reactionState = fields => {
    const state = floodplain.emptyFloodplainState();
    state.chemistry = {
      ...riverChemistry.emptyRiverChemistry(),
      ...fields
    };
    state.chemistry.dissolvedInorganicNitrogenKgN =
      state.chemistry.dissolvedNitrateNitrogenKgN +
      state.chemistry.dissolvedAmmoniumNitrogenKgN;
    return state;
  };
  const reactionCases = {
    aerobic(scale, fraction) {
      const carbonKgC = scale * fraction;
      return floodplain.applyFloodplainAerobicMineralization(
        reactionState({
          dissolvedOrganicCarbonKgC: scale,
          dissolvedInorganicCarbonKgC: scale * 1.7,
          dissolvedOxygenKgO2: scale * 4
        }), {
          dissolvedOrganicCarbonConsumedKgC: carbonKgC,
          dissolvedInorganicCarbonProducedKgC: carbonKgC,
          dissolvedOxygenConsumedKgO2: carbonKgC *
            floodplainRespiration.AEROBIC_OXYGEN_KG_O2_PER_KG_C
        }, reactionContext).receipt;
    },
    denitrification(scale, fraction) {
      const carbonKgC = scale * fraction;
      const nitrogenKgN = carbonKgC * floodplainDenitrification
        .DENITRIFICATION_KG_N_PER_KG_C;
      return floodplain.applyFloodplainDenitrificationReaction(
        reactionState({
          dissolvedOrganicCarbonKgC: scale,
          dissolvedInorganicCarbonKgC: scale * 1.7,
          dissolvedNitrateNitrogenKgN: scale * 1.2,
          dissolvedAmmoniumNitrogenKgN: scale * .4,
          alkalinityKgCaCO3Eq: scale * 5
        }), {
          dissolvedOrganicCarbonConsumedKgC: carbonKgC,
          dissolvedInorganicCarbonProducedKgC: carbonKgC,
          dissolvedNitrateNitrogenConsumedKgN: nitrogenKgN,
          nitrogenGasProducedKgN: nitrogenKgN,
          alkalinityGeneratedKgCaCO3Eq: nitrogenKgN *
            floodplainDenitrification
              .DENITRIFICATION_ALKALINITY_KG_CACO3_EQ_PER_KG_N
        }, reactionContext).receipt;
    },
    nitrification(scale, fraction) {
      const nitrogenKgN = scale * fraction;
      return floodplain.applyFloodplainNitrificationReaction(
        reactionState({
          dissolvedNitrateNitrogenKgN: scale * 1.2,
          dissolvedAmmoniumNitrogenKgN: scale,
          dissolvedOxygenKgO2: scale * 6,
          alkalinityKgCaCO3Eq: scale * 9
        }), {
          dissolvedAmmoniumNitrogenConsumedKgN: nitrogenKgN,
          dissolvedNitrateNitrogenProducedKgN: nitrogenKgN,
          dissolvedOxygenConsumedKgO2: nitrogenKgN *
            floodplainNitrification.NITRIFICATION_OXYGEN_KG_O2_PER_KG_N,
          alkalinityDemandKgCaCO3: nitrogenKgN * floodplainNitrification
            .NITRIFICATION_ALKALINITY_DEMAND_KG_CACO3_PER_KG_N
        }, reactionContext).receipt;
    },
    gasExchange(scale, fraction) {
      const carbonKgC = scale * fraction;
      return floodplain.applyFloodplainGasExchange(reactionState({
        dissolvedInorganicCarbonKgC: scale,
        dissolvedOxygenKgO2: scale * 2
      }), {
        carbonToAtmosphereKgC: carbonKgC,
        carbonToFloodplainKgC: 0,
        oxygenToFloodplainKgO2: carbonKgC * .73
      }, reactionContext).receipt;
    }
  };
  const oldFixedFailureCounts = Object.fromEntries(
    Object.keys(reactionCases).map(key => [key, 0]));
  let reactionCaseCount = 0;
  let reactionMaximumResidualKg = 0;
  let reactionMaximumToleranceUtilization = 0;
  let heldAerobicCounterexample = null;
  for (const [kind, createReceipt] of Object.entries(reactionCases)) {
    for (const scale of reactionScalesKg) {
      for (const fraction of reactionFractions) {
        const receipt = createReceipt(scale, fraction);
        reactionCaseCount += 1;
        const numericKeys = Object.keys(
          receipt.closure.numericToleranceKg);
        const oldFixedFailure = numericKeys.some(key =>
          Math.abs(receipt.closure[key]) >= 1e-7);
        if (oldFixedFailure) oldFixedFailureCounts[kind] += 1;
        assert.ok(numericKeys.length > 0 && numericKeys.every(key =>
          Math.abs(receipt.closure[key]) <=
            receipt.closure.numericToleranceKg[key]) &&
          receipt.closure.policy.schema ===
            floodplain.FLOODPLAIN_REACTION_MASS_CLOSURE_POLICY_SCHEMA &&
          receipt.closure.policy.arbitraryToleranceAuthority === false &&
          receipt.truth.scaleAwareFloatingPointClosure === true &&
          receipt.truth.perIdentityNumericBounds === true &&
          receipt.truth.measuredResidualsPreserved === true &&
          receipt.truth.fixedAbsoluteToleranceOnly === false,
        `${kind} scale-aware receiver receipt closes at ${scale} kg and fraction ${fraction}`);
        reactionMaximumResidualKg = Math.max(reactionMaximumResidualKg,
          receipt.closure.maximumResidualKg);
        reactionMaximumToleranceUtilization = Math.max(
          reactionMaximumToleranceUtilization,
          receipt.closure.maximumToleranceUtilization);
        if (kind === 'aerobic' && scale === 5e8 && fraction === .5) {
          heldAerobicCounterexample = receipt;
        }
      }
    }
  }
  assert.deepEqual(oldFixedFailureCounts, {
    aerobic: 19,
    denitrification: 20,
    nitrification: 8,
    gasExchange: 7
  }, 'the held reaction family preserves all 54 former fixed-floor false failures as counterevidence');
  assert.ok(reactionCaseCount === 240 &&
    reactionMaximumResidualKg === .00048828125 &&
    reactionMaximumToleranceUtilization > 0 &&
    reactionMaximumToleranceUtilization < .11,
  'all 240 reaction receiver cases close with retained residual extrema and bounded tolerance utilization');
  assert.ok(Math.abs(heldAerobicCounterexample.closure
      .dissolvedOxygenDebitResidualKgO2) > 1e-7 &&
    Math.abs(heldAerobicCounterexample.closure
      .dissolvedOxygenDebitResidualKgO2) <=
      heldAerobicCounterexample.closure.numericToleranceKg
        .dissolvedOxygenDebitResidualKgO2,
  'the held 500-million-kilogram aerobic counterexample retains its nonzero oxygen residue instead of rounding it away');
  const atmosphereOwnerAreasM2 = [1e6, 1e8, 1e10, 1e12, 1e14,
    1e16, 1e18];
  const atmosphereOwnerFractions = [.1, 1 / 3, .5, .9, .999999];
  const atmosphereOwnerKinds = [
    'carbonToAtmosphereKgC',
    'carbonToFloodplainKgC',
    'oxygenToFloodplainKgO2'
  ];
  const atmosphereOldFixedFailureCounts = Object.fromEntries(
    atmosphereOwnerKinds.map(kind => [kind, 0]));
  let atmosphereOwnerCaseCount = 0;
  let atmosphereOwnerMaximumResidualKg = 0;
  let atmosphereOwnerMaximumToleranceUtilization = 0;
  let heldAtmosphereOwnerCounterexample = null;
  for (const areaM2 of atmosphereOwnerAreasM2) {
    for (const fraction of atmosphereOwnerFractions) {
      for (const kind of atmosphereOwnerKinds) {
        const atmosphereState = atmosphereBiogeochemistry
          .createAtmosphereBiogeochemistry();
        const perAreaMaterial = kind === 'carbonToAtmosphereKgC'
          ? atmosphereState.carbonDioxideCarbonKgCm2
          : kind === 'carbonToFloodplainKgC'
            ? atmosphereState.layers[0].carbonDioxideCarbonKgCm2
            : atmosphereState.layers[0].oxygenKgO2m2;
        const exchange = {
          carbonToAtmosphereKgC: 0,
          carbonToFloodplainKgC: 0,
          oxygenToFloodplainKgO2: 0,
          [kind]: perAreaMaterial * areaM2 * fraction
        };
        const receipt = atmosphereBiogeochemistry
          .applyAtmosphereFloodplainGasExchange(atmosphereState, exchange,
            areaM2, {
              exchangeId: `test:r62:${kind}:${areaM2}:${fraction}`,
              reachId: 'test:r62:reach',
              atmosphereCellId: 'test:r62:air'
            }).receipt;
        const numericKeys = Object.keys(
          receipt.conservation.numericToleranceKg);
        const oldFixedFailure = numericKeys.some(key =>
          Math.abs(receipt.conservation[key]) >= 1e-3);
        if (oldFixedFailure) {
          atmosphereOldFixedFailureCounts[kind] += 1;
          heldAtmosphereOwnerCounterexample ||= receipt;
        }
        atmosphereOwnerCaseCount += 1;
        assert.ok(numericKeys.length === 2 && numericKeys.every(key =>
          Math.abs(receipt.conservation[key]) <=
            receipt.conservation.numericToleranceKg[key]) &&
          receipt.conservation.policy.schema ===
            atmosphereBiogeochemistry
              .ATMOSPHERE_FLOODPLAIN_GAS_EXCHANGE_MASS_CLOSURE_POLICY_SCHEMA &&
          receipt.conservation.policy.arbitraryToleranceAuthority === false &&
          receipt.truth.scaleAwareFloatingPointClosure === true &&
          receipt.truth.perIdentityNumericBounds === true &&
          receipt.truth.measuredResidualsPreserved === true &&
          receipt.truth.fixedAbsoluteToleranceOnly === false,
        `${kind} atmosphere-owner receipt closes at ${areaM2} m2 and fraction ${fraction}`);
        atmosphereOwnerMaximumResidualKg = Math.max(
          atmosphereOwnerMaximumResidualKg,
          receipt.conservation.maximumResidualKg);
        atmosphereOwnerMaximumToleranceUtilization = Math.max(
          atmosphereOwnerMaximumToleranceUtilization,
          receipt.conservation.maximumToleranceUtilization);
      }
    }
  }
  assert.deepEqual(atmosphereOldFixedFailureCounts, {
    carbonToAtmosphereKgC: 11,
    carbonToFloodplainKgC: 8,
    oxygenToFloodplainKgO2: 4
  }, 'the held atmosphere-owner sweep preserves 23 former fixed-floor false failures as counterevidence');
  assert.ok(atmosphereOwnerCaseCount === 105 &&
    atmosphereOwnerMaximumResidualKg === 262144 &&
    atmosphereOwnerMaximumToleranceUtilization > 0 &&
    atmosphereOwnerMaximumToleranceUtilization < .13,
  'all 105 atmosphere-owner cases close with retained residual extrema and bounded tolerance utilization');
  assert.ok(Object.keys(heldAtmosphereOwnerCounterexample.conservation
      .numericToleranceKg).some(key =>
        Math.abs(heldAtmosphereOwnerCounterexample.conservation[key]) >=
          1e-3 &&
        Math.abs(heldAtmosphereOwnerCounterexample.conservation[key]) <=
          heldAtmosphereOwnerCounterexample.conservation
            .numericToleranceKg[key]),
  'the held atmosphere-owner counterexample retains its nonzero residual inside the derived operand-scale bound');
  assert.equal(earthSystem.EARTH_SYSTEM_ENGINE_SCHEMA, 'axm.foundation-planet.earth-system-engine/v31', 'engine schema records boundary-energy-aware native atmosphere lineage');
  assert.equal(earthSystem.EARTH_SYSTEM_FLUX_SCHEMA,
    'axm.foundation-planet.earth-system-flux/v4');
  assert.equal(earthSystem.EARTH_SURFACE_RADIATION_SCHEMA,
    'axm.foundation-planet.surface-radiation-receipt/v2');
  assert.equal(surfaceRadiation.PREVIOUS_EARTH_SURFACE_RADIATION_SCHEMA,
    'axm.foundation-planet.surface-radiation-receipt/v1');
  assert.equal(earthSystem.ATMOSPHERE_CO2_RADIATIVE_COUPLING_SCHEMA,
    'axm.foundation-planet.atmosphere-co2-radiative-coupling-receipt/v1');
  assert.equal(earthSystem.EARTH_CLOUD_OPTICS_SCHEMA,
    'axm.foundation-planet.native-cloud-optics/v1');
  assert.equal(earthSystem.EARTH_CRYOSPHERE_PHASE_SCHEMA,
    'axm.foundation-planet.cryosphere-phase-receipt/v1');
  assert.equal(earthSystem.EARTH_LAND_ECOLOGY_SCHEMA,
    'axm.foundation-planet.land-ecology-state/v1');
  assert.equal(earthSystem.EARTH_LAND_ECOLOGY_FLUX_SCHEMA,
    'axm.foundation-planet.land-ecology-flux-receipt/v1');
  assert.equal(earthSystem.earthSystemDescription().landEcology.stateSchema,
    landEcology.EARTH_LAND_ECOLOGY_SCHEMA);
  assert.equal(earthSystem.EARTH_OCEAN_ECOLOGY_SCHEMA,
    'axm.foundation-planet.ocean-ecology-state/v6');
  assert.equal(earthSystem.EARTH_OCEAN_ECOLOGY_FLUX_SCHEMA,
    'axm.foundation-planet.ocean-ecology-flux-receipt/v6');
  assert.equal(earthSystem.earthSystemDescription().oceanEcology.stateSchema,
    oceanEcology.EARTH_OCEAN_ECOLOGY_SCHEMA);
  assert.equal(earthSystem.earthSystemDescription().oceanEcology.deepOcean.stateSchema,
    deepOcean.DEEP_OCEAN_STATE_SCHEMA);
  assert.equal(earthSystem.earthSystemDescription().atmosphereBiogeochemistry.stateSchema,
    atmosphereBiogeochemistry.ATMOSPHERE_BIOGEOCHEMISTRY_STATE_SCHEMA);
  assert.equal(earthSystem.earthSystemDescription().atmosphereBiogeochemistry.layerCount, 8);
  assert.equal(earthSystem.earthSystemDescription().atmosphereBiogeochemistryVertical.receiptSchema,
    atmosphereBiogeochemistry.ATMOSPHERE_BIOGEOCHEMISTRY_VERTICAL_TRANSPORT_SCHEMA);
  assert.equal(atmosphereBiogeochemistryVertical.atmosphereBiogeochemistryVerticalDescription().interfaceCount, 7);
  assert.equal(earthTransport.earthTransportDescription()
    .atmosphereBiogeochemistryTransport.domainReceiptSchema,
  atmosphereBiogeochemistryTransport.ATMOSPHERE_BIOGEOCHEMISTRY_TRANSPORT_SCHEMA);
  assert.equal(systemAudit.foundationSystemAuditDescription().schema,
    systemAudit.FOUNDATION_SYSTEM_AUDIT_SCHEMA);
  assert.equal(systemAudit.foundationSystemAuditDescription().mutatesWorld,
    false, 'the integrity organ is explicitly read-only');
  assert.ok(systemAudit.foundationSystemAuditDescription().checks.includes(
    'atmosphere-co2-radiative-coupling'),
  'the integrity organ declares its native-layer CO2 radiation route');
  assert.ok(systemAudit.foundationSystemAuditDescription().checks.includes(
    'mixed-layer-carbonate-diagnostic'),
  'the integrity organ declares its bounded mixed-layer carbonate route');
  assert.ok(systemAudit.foundationSystemAuditDescription().checks.includes(
    'carbonate-informed-air-sea-carbon-exchange'),
  'the integrity organ declares its carbonate-informed air-sea owner-move route');

  const heldForestSample = JSON.parse(JSON.stringify(grasslandSample));
  heldForestSample.biome = 'temperate_forest';
  heldForestSample.habitability = .82;
  heldForestSample.moisture = .72;
  heldForestSample.temperatureC = 19;
  heldForestSample.ecology.productivity = .82;
  heldForestSample.geology.soilDepthM = Math.max(1.8,
    heldForestSample.geology.soilDepthM);
  const heldDesertSample = JSON.parse(JSON.stringify(heldForestSample));
  heldDesertSample.biome = 'desert';
  heldDesertSample.habitability = .08;
  heldDesertSample.moisture = .12;
  heldDesertSample.temperatureC = 31;
  heldDesertSample.ecology.productivity = .08;
  const heldForestSubstrate = earthSystem.deriveSubstrate(heldForestSample);
  const heldDesertSubstrate = earthSystem.deriveSubstrate(heldDesertSample);
  const heldForestEcology = landEcology.createLandEcology(
    heldForestSample, heldForestSubstrate, { lifeAbundance: 1 });
  const heldDesertEcology = landEcology.createLandEcology(
    heldDesertSample, heldDesertSubstrate, { lifeAbundance: 1 });
  assert.ok(heldForestEcology.canopyCover > heldDesertEcology.canopyCover + .3 &&
    heldForestEcology.leafAreaIndex > heldDesertEcology.leafAreaIndex + 2 &&
    heldForestEcology.carbon.soilOrganicKgCm2 >
      heldDesertEcology.carbon.soilOrganicKgCm2,
  'functional type, productivity, moisture and soil depth create materially distinct forest and desert ecology states');
  const heldForestDemand = landEcology.landEcologyWaterDemand(
    heldForestEcology,
    { potentialEvapotranspirationMm: 3, rootZonePlantAvailableFraction: .88,
      soilFrozenFraction: 0 },
    { enabled: true, lifeAbundance: 1, sample: heldForestSample,
      substrate: heldForestSubstrate }
  );
  assert.ok(heldForestDemand.potentialTranspirationMm > 1 &&
    heldForestDemand.bareSoilExposure < .5,
  'developed canopy turns potential evapotranspiration into physiological demand and shields soil');
  const productiveEcology = landEcology.advanceLandEcology(
    heldForestEcology,
    { absorbedShortwaveWm2: 230, temperatureC: 21,
      rootZonePlantAvailableFraction: .9, soilFrozenFraction: 0,
      potentialTranspirationMm: heldForestDemand.potentialTranspirationMm,
      actualTranspirationMm: heldForestDemand.potentialTranspirationMm * .9,
      droughtStress: .05 },
    1,
    { enabled: true, lifeAbundance: 1, sample: heldForestSample,
      substrate: heldForestSubstrate }
  );
  assert.equal(productiveEcology.receipt.schema,
    landEcology.EARTH_LAND_ECOLOGY_FLUX_SCHEMA);
  assert.ok(productiveEcology.receipt.carbon.grossPrimaryProductionKgCm2 > 0 &&
    productiveEcology.receipt.nitrogen.plantUptakeKgNm2 > 0,
  'light, water and mineral nitrogen produce carbon fixation and nitrogen uptake');
  assert.ok(Math.abs(productiveEcology.receipt.carbon.residualKgCm2) < 1e-9 &&
    Math.abs(productiveEcology.receipt.nitrogen.residualKgNm2) < 1e-9,
  'land-ecology carbon and nitrogen pools close locally');
  const nitrogenStarvedSource = JSON.parse(JSON.stringify(heldForestEcology));
  nitrogenStarvedSource.nitrogen.mineralKgNm2 = 0;
  nitrogenStarvedSource.nitrogen.totalKgNm2 =
    nitrogenStarvedSource.nitrogen.liveBiomassKgNm2 +
    nitrogenStarvedSource.nitrogen.litterKgNm2 +
    nitrogenStarvedSource.nitrogen.soilOrganicKgNm2;
  const nitrogenStarvedEcology = landEcology.advanceLandEcology(
    nitrogenStarvedSource,
    { absorbedShortwaveWm2: 230, temperatureC: 21,
      rootZonePlantAvailableFraction: .9, soilFrozenFraction: 0,
      potentialTranspirationMm: 2, actualTranspirationMm: 1.8 },
    1,
    { enabled: true, lifeAbundance: 1, sample: heldForestSample,
      substrate: heldForestSubstrate }
  );
  assert.equal(nitrogenStarvedEcology.receipt.nitrogen.plantUptakeKgNm2, 0,
    'zero mineral nitrogen blocks retained growth instead of inventing nutrients');
  assert.ok(nitrogenStarvedEcology.receipt.stresses.nitrogen < .01 &&
    nitrogenStarvedEcology.receipt.carbon.autotrophicRespirationKgCm2 >
      productiveEcology.receipt.carbon.autotrophicRespirationKgCm2,
  'nitrogen-limited photosynthate returns through overflow respiration');
  const dormantEcology = landEcology.advanceLandEcology(
    productiveEcology.state,
    { absorbedShortwaveWm2: 230, temperatureC: 21,
      rootZonePlantAvailableFraction: .9, soilFrozenFraction: 0,
      potentialTranspirationMm: 2, actualTranspirationMm: 0 },
    1,
    { enabled: false, lifeAbundance: 1, sample: heldForestSample,
      substrate: heldForestSubstrate }
  );
  assert.deepEqual(dormantEcology.state.carbon, productiveEcology.state.carbon,
    'life-off freezes every persistent carbon reservoir');
  assert.deepEqual(dormantEcology.state.nitrogen, productiveEcology.state.nitrogen,
    'life-off freezes every persistent nitrogen reservoir');
  assert.equal(dormantEcology.receipt.truth.reservoirsFrozen, true);

  const carbonateReferenceDepthM = 50;
  const carbonateReferenceWaterKgM2 = carbonateReferenceDepthM * 1000;
  const carbonateReferenceInput = {
    dissolvedInorganicCarbonKgCm2: .002 * carbonateReferenceWaterKgM2 *
      .0120107,
    alkalinityKgCaCO3Eqm2: .0023 * carbonateReferenceWaterKgM2 *
      .05004345,
    dissolvedInorganicPhosphorusKgPm2: 2e-6 *
      carbonateReferenceWaterKgM2 * .030973761998,
    mixedLayerDepthM: carbonateReferenceDepthM,
    temperatureC: 25,
    salinityPsu: 35
  };
  const carbonateReferenceInputBefore = JSON.parse(JSON.stringify(
    carbonateReferenceInput));
  const carbonateReference = carbonateSystem.solveMixedLayerCarbonateSystem(
    carbonateReferenceInput);
  assert.deepEqual(carbonateReferenceInput, carbonateReferenceInputBefore,
    'the carbonate solver is a pure observer of its material-owner inputs');
  assert.equal(carbonateReference.schema,
    carbonateSystem.MIXED_LAYER_CARBONATE_DIAGNOSTIC_SCHEMA);
  assert.ok(carbonateReference.waterMassConversion.referenceDensityKgM3 ===
      1000 &&
    carbonateReference.waterMassConversion.waterMassKgM2 === 50000 &&
    carbonateReference.waterMassConversion.measuredDensityClaimed === false,
  'mixed-layer depth uses the explicit unmeasured 1000 kg/m3 reference-density conversion');
  assert.ok(carbonateReference.status === 'SOLVED' &&
    carbonateReference.solution.pHTotal > 8 &&
    carbonateReference.solution.pHTotal < 8.1 &&
    Math.abs(carbonateReference.solution.dicUmolKg - 2000) < 1e-6 &&
    Math.abs(carbonateReference.solution.totalAlkalinityUmolKg - 2300) < 1e-6,
  'the 25 C, salinity-35 held reference solves a plausible total-scale pH from 2000 DIC and 2300 alkalinity micromole/kg');
  const heldConstants = carbonateReference.solution.equilibriumConstants;
  assert.ok(Math.abs(Math.log10(heldConstants.k1MolKg) + 5.8472) < 1e-4 &&
    Math.abs(Math.log10(heldConstants.k2MolKg) + 8.9660) < 1e-4 &&
    Math.abs(Math.log(heldConstants.kBmolKg) + 19.7964) < 1e-4 &&
    Math.abs(Math.log(heldConstants.kWmol2Kg2) + 30.434) < 1e-3 &&
    Math.abs(heldConstants.totalBoronUmolKg - 432.6) < 1e-6,
  '25 C, salinity-35 constants reproduce the best-practices reference values and the Lee total-boron relationship');
  assert.ok(carbonateReference.truth.carbonateMassClosed === true &&
    carbonateReference.truth.phosphateMassClosed === true &&
    carbonateReference.truth.alkalinityResidualClosed === true &&
    Math.abs(carbonateReference.closure.dicResidualMolKg) <= 1e-12 &&
    Math.abs(carbonateReference.closure.phosphateResidualMolKg) <= 1e-12 &&
    Math.abs(carbonateReference.closure.alkalinityResidualMolKg) <= 1e-12,
  'held carbonate, phosphate and alkalinity identities close within their declared tolerances');
  assert.ok(Math.abs(
    carbonateReference.solution.speciesUmolKg.co2Star +
    carbonateReference.solution.speciesUmolKg.bicarbonate +
    carbonateReference.solution.speciesUmolKg.carbonate - 2000) < 2e-6,
  'published rounded carbonate species reconstruct the held DIC input');
  const heldCo2Solubility = airSeaCarbonExchange
    .weiss1974Co2Solubility(25, 35);
  const heldSeawaterVaporPressure = airSeaCarbonExchange
    .weissPrice1980SeawaterVaporPressureAtm(25, 35);
  const heldCo2Fugacity = airSeaCarbonExchange
    .weiss1974Co2FugacityFactor(25, 1013.25);
  assert.ok(Math.abs(heldCo2Solubility.lnK0 - (-3.5617)) < 5e-5 &&
    Math.abs(heldCo2Solubility.k0MolKgAtm - .028391881804016) < 1e-15,
  'Weiss 1974 CO2 solubility reproduces the Dickson-guide 25 C salinity-35 held value');
  assert.ok(Math.abs(heldSeawaterVaporPressure - .03065529996318) < 1e-15 &&
    Math.abs(heldCo2Fugacity.fugacityFactor - .996810440544798) < 1e-15,
  'wet-air pressure and Weiss virial nonideality reproduce held surface reference values');
  const heldAirSeaProposalInput = {
    carbonateSystem: carbonateReference,
    atmosphericCo2PpmProxy: 420,
    atmosphericCarbonKgCm2: 10,
    ...carbonateReferenceInput,
    surfacePressureHpa: 1013.25,
    relaxationFraction: .1
  };
  const heldAirSeaProposalInputBefore = JSON.parse(JSON.stringify(
    heldAirSeaProposalInput));
  const heldAirSeaProposal = airSeaCarbonExchange
    .proposeAirSeaCarbonExchange(heldAirSeaProposalInput);
  assert.deepEqual(heldAirSeaProposalInput, heldAirSeaProposalInputBefore,
    'air-sea carbon exchange is a pure proposal over diagnostic and owner inputs');
  assert.ok(heldAirSeaProposal.schema === airSeaCarbonExchange
      .AIR_SEA_CARBON_EXCHANGE_PROPOSAL_SCHEMA &&
    heldAirSeaProposal.status === 'SOLVED_UPTAKE' &&
    heldAirSeaProposal.transfer.direction === 'atmosphere-to-ocean' &&
    Math.abs(heldAirSeaProposal.equilibrium.actualCo2StarMicromolKg -
      11.501166) < 1e-9 &&
    Math.abs(heldAirSeaProposal.equilibrium
      .equilibriumCo2StarMicromolKg - 11.522170223) < 1e-9 &&
    heldAirSeaProposal.signedCarbonToOceanKgCm2 > 0,
  '420 ppm dry-air proxy produces a bounded carbonate-informed uptake proposal from actual versus equilibrium CO2-star');
  assert.ok(heldAirSeaProposal.truth.sourceDiagnosticSolved === true &&
    heldAirSeaProposal.truth.sourceOwnerBinding === true &&
    heldAirSeaProposal.truth.wetAirPartialPressureIncluded === true &&
    heldAirSeaProposal.truth.fugacityNonidealityIncluded === true &&
    heldAirSeaProposal.truth.scientificGasTransferVelocity === false &&
    heldAirSeaProposal.truth.carbonClosureClaimedByProposal === false,
  'the proposal names its validated chemistry, fugacity correction and uncalibrated bulk-transfer boundary');
  const heldOutgassingProposal = airSeaCarbonExchange
    .proposeAirSeaCarbonExchange({
      ...heldAirSeaProposalInput,
      atmosphericCo2PpmProxy: 300
    });
  assert.ok(heldOutgassingProposal.status === 'SOLVED_OUTGASSING' &&
    heldOutgassingProposal.transfer.direction === 'ocean-to-atmosphere' &&
    heldOutgassingProposal.signedCarbonToOceanKgCm2 < 0,
  'lower atmospheric CO2 reverses the same owner-neutral proposal toward ocean outgassing');
  const atmosphereBoundProposal = airSeaCarbonExchange
    .proposeAirSeaCarbonExchange({
      ...heldAirSeaProposalInput,
      atmosphericCo2PpmProxy: 1000,
      atmosphericCarbonKgCm2: 1e-12,
      relaxationFraction: 1
    });
  assert.ok(atmosphereBoundProposal.status === 'SOLVED_UPTAKE' &&
    atmosphereBoundProposal.signedCarbonToOceanKgCm2 === 1e-12 &&
    atmosphereBoundProposal.transfer.boundedBySourceMaterial === true,
  'uptake is sender-bounded by the atmosphere-owned carbon pool');
  const mismatchedCarbonateProposal = airSeaCarbonExchange
    .proposeAirSeaCarbonExchange({
      ...heldAirSeaProposalInput,
      dissolvedInorganicCarbonKgCm2:
        heldAirSeaProposalInput.dissolvedInorganicCarbonKgCm2 + .01
    });
  assert.ok(mismatchedCarbonateProposal.status ===
      'CARBONATE_SOURCE_MISMATCH' &&
    mismatchedCarbonateProposal.signedCarbonToOceanKgCm2 === 0,
  'a stale carbonate diagnostic produces a typed zero-flux refusal');
  const brackishCarbonate = carbonateSystem.solveMixedLayerCarbonateSystem({
    ...carbonateReferenceInput,
    salinityPsu: 10
  });
  assert.ok(brackishCarbonate.status === 'OUTSIDE_CONSTANT_VALIDITY' &&
    brackishCarbonate.solution === null &&
    brackishCarbonate.truth.constantsWithinPublishedEnvelope === false,
  'the Lueker open-ocean diagnostic refuses brackish water instead of clamping it into the published envelope');
  const brackishExchange = airSeaCarbonExchange.proposeAirSeaCarbonExchange({
    ...heldAirSeaProposalInput,
    carbonateSystem: brackishCarbonate,
    salinityPsu: 10
  });
  assert.ok(brackishExchange.status === 'CARBONATE_DIAGNOSTIC_UNAVAILABLE' &&
    brackishExchange.signedCarbonToOceanKgCm2 === 0,
  'air-sea carbon exchange inherits the carbonate validity boundary as typed zero flux');

  const heldOceanPhysical = {
    mixedLayerDepthM: 62,
    mixedLayerTemperatureC: 18,
    salinityPsu: 35
  };
  const heldOceanEcology = oceanEcology.createOceanEcology(
    oceanSample, heldOceanPhysical, { lifeAbundance: 1 });
  assert.equal(heldOceanEcology.schema,
    oceanEcology.EARTH_OCEAN_ECOLOGY_SCHEMA);
  assert.ok(heldOceanEcology.carbon.dissolvedInorganicKgCm2 > 0 &&
    heldOceanEcology.carbon.phytoplanktonKgCm2 > 0 &&
    heldOceanEcology.nitrogen.dissolvedInorganicKgNm2 > 0 &&
    heldOceanEcology.phosphorus.dissolvedInorganicKgPm2 > 0 &&
    heldOceanEcology.oxygen.dissolvedKgO2m2 > 0 &&
    heldOceanEcology.alkalinity.dissolvedKgCaCO3Eqm2 > 0,
  'marine initialization creates explicit persistent C/N/P/O2/alkalinity and plankton reservoirs');
  assert.ok(heldOceanEcology.carbonateSystem.schema ===
      carbonateSystem.MIXED_LAYER_CARBONATE_DIAGNOSTIC_SCHEMA &&
    heldOceanEcology.carbonateSystem.status === 'SOLVED' &&
    heldOceanEcology.carbonateSystem.truth.diagnosticOnly === true &&
    heldOceanEcology.carbonateSystem.truth.mutatesMaterial === false &&
    heldOceanEcology.carbonateSystem.truth.silicateAlkalinityIncluded === false &&
    heldOceanEcology.truth.carbonateSpeciationResolved === true &&
    heldOceanEcology.truth.pHResolved === true,
  'open-ocean initialization exposes a solved read-only carbonate diagnostic with explicit omissions');
  const rungFiftyTwoOcean = JSON.parse(JSON.stringify(heldOceanEcology));
  const rungFiftyTwoTotals = oceanEcology.oceanEcologyElementTotals(
    rungFiftyTwoOcean);
  rungFiftyTwoOcean.schema = oceanEcology
    .PREVIOUS_EARTH_OCEAN_ECOLOGY_SCHEMA;
  rungFiftyTwoOcean.lastFluxReceipt = {
    schema: oceanEcology.PREVIOUS_EARTH_OCEAN_ECOLOGY_FLUX_SCHEMA,
    reason: 'pre-r54-empirical-air-sea-carbon-receipt'
  };
  delete rungFiftyTwoOcean.carbonateSystem;
  rungFiftyTwoOcean.truth.carbonateSpeciationResolved = false;
  rungFiftyTwoOcean.truth.pHResolved = false;
  const migratedRungFiftyTwoOcean = oceanEcology.normalizeOceanEcology(
    rungFiftyTwoOcean, { sample: oceanSample, ocean: heldOceanPhysical });
  assert.deepEqual(oceanEcology.oceanEcologyElementTotals(
    migratedRungFiftyTwoOcean), rungFiftyTwoTotals,
  'R53-to-R54 ocean migration preserves every C/N/P/O2/alkalinity material owner');
  assert.ok(migratedRungFiftyTwoOcean.schema ===
      oceanEcology.EARTH_OCEAN_ECOLOGY_SCHEMA &&
    migratedRungFiftyTwoOcean.carbonateSystem.status === 'SOLVED' &&
    migratedRungFiftyTwoOcean.lastFluxReceipt === null,
  'R53-to-R54 migration recomputes the present diagnostic and discards the empirical carbon receipt instead of relabelling it');
  const legacyAlkalinityOcean = JSON.parse(JSON.stringify(
    heldOceanEcology));
  legacyAlkalinityOcean.schema =
    'axm.foundation-planet.ocean-ecology-state/v2';
  delete legacyAlkalinityOcean.alkalinity;
  const migratedAlkalinityOcean = oceanEcology.normalizeOceanEcology(
    legacyAlkalinityOcean, { sample: oceanSample, ocean: heldOceanPhysical });
  assert.ok(migratedAlkalinityOcean.carbon.dissolvedInorganicKgCm2 ===
      heldOceanEcology.carbon.dissolvedInorganicKgCm2 &&
    migratedAlkalinityOcean.alkalinity.dissolvedKgCaCO3Eqm2 === 0 &&
    migratedAlkalinityOcean.alkalinityMigrationCheckpoint === true,
  'v2 ocean migration preserves previous marine pools and adds explicit zero mixed-layer alkalinity');
  assert.equal(heldOceanEcology.deepOcean.schema,
    deepOcean.DEEP_OCEAN_STATE_SCHEMA);
  assert.ok(heldOceanEcology.deepOcean.carbon.dissolvedInorganicKgCm2 >
    heldOceanEcology.carbon.dissolvedInorganicKgCm2 &&
    heldOceanEcology.deepOcean.oxygen.dissolvedKgO2m2 > 0 &&
    heldOceanEcology.deepOcean.alkalinity.dissolvedKgCaCO3Eqm2 > 0,
  'new ocean columns initialize a persistent deep-water carbon, nutrient, oxygen and alkalinity interior');
  const rungFiftyOneDeep = JSON.parse(JSON.stringify(
    heldOceanEcology.deepOcean));
  const rungFiftyOneDeepTotals = deepOcean.deepOceanElementTotals(
    rungFiftyOneDeep);
  rungFiftyOneDeep.schema = deepOcean.PREVIOUS_DEEP_OCEAN_STATE_SCHEMA;
  delete rungFiftyOneDeep.alkalinity;
  rungFiftyOneDeep.lastExchangeReceipt = {
    schema: deepOcean.PREVIOUS_DEEP_OCEAN_EXCHANGE_RECEIPT_SCHEMA
  };
  const migratedRungFiftyOneDeep = deepOcean.normalizeDeepOceanState(
    rungFiftyOneDeep);
  assert.ok(migratedRungFiftyOneDeep.schema ===
      deepOcean.DEEP_OCEAN_STATE_SCHEMA &&
    migratedRungFiftyOneDeep.migrationCheckpoint === true &&
    migratedRungFiftyOneDeep.alkalinity.dissolvedKgCaCO3Eqm2 === 0 &&
    migratedRungFiftyOneDeep.alkalinity.initialization ===
      'explicit-zero-migration' &&
    migratedRungFiftyOneDeep.lastExchangeReceipt === null,
  'R51 deep-ocean state gains an explicit empty alkalinity owner and no relabelled receipt');
  const migratedRungFiftyOneTotals = deepOcean.deepOceanElementTotals(
    migratedRungFiftyOneDeep);
  assert.ok(['carbonKgCm2', 'nitrogenKgNm2', 'phosphorusKgPm2',
    'oxygenKgO2m2'].every(key => migratedRungFiftyOneTotals[key] ===
      rungFiftyOneDeepTotals[key]),
  'R51 deep-ocean migration preserves every prior material owner exactly');
  const heldOceanEnvironment = {
    absorbedShortwaveWm2: 225,
    temperatureC: 18,
    salinityPsu: 35,
    mixedLayerDepthM: 62,
    surfacePressureHpa: 1008,
    seaIceFraction: 0,
    windSpeedMps: 8
  };
  const productiveOceanEcology = oceanEcology.advanceOceanEcology(
    heldOceanEcology, heldOceanEnvironment, 1,
    { enabled: true, lifeAbundance: 1, sample: oceanSample,
      ocean: heldOceanPhysical }
  );
  assert.equal(productiveOceanEcology.receipt.schema,
    oceanEcology.EARTH_OCEAN_ECOLOGY_FLUX_SCHEMA);
  assert.ok(productiveOceanEcology.receipt.carbon.grossPrimaryProductionKgCm2 > 0 &&
    productiveOceanEcology.receipt.carbon.retainedPrimaryProductionKgCm2 > 0 &&
    productiveOceanEcology.receipt.nitrogen.phytoplanktonUptakeKgNm2 > 0 &&
    productiveOceanEcology.receipt.phosphorus.phytoplanktonUptakeKgPm2 > 0 &&
    productiveOceanEcology.receipt.oxygen.photosyntheticProductionKgO2m2 > 0,
  'light, open water, temperature, nitrogen and phosphorus drive marine production and oxygen release');
  assert.ok(Math.abs(productiveOceanEcology.receipt.carbon.residualKgCm2) < 1e-9 &&
    Math.abs(productiveOceanEcology.receipt.nitrogen.residualKgNm2) < 1e-9 &&
    Math.abs(productiveOceanEcology.receipt.phosphorus.residualKgPm2) < 1e-9 &&
    Math.abs(productiveOceanEcology.receipt.oxygen.residualKgO2m2) < 1e-9 &&
    Math.abs(productiveOceanEcology.receipt.alkalinity
      .residualKgCaCO3Eqm2) < 1e-9,
  'ocean-ecology carbon, nitrogen, phosphorus, oxygen and alkalinity flux ledgers close locally');
  const productiveAirSeaExchange = productiveOceanEcology.receipt.carbon
    .airSeaCarbonExchange;
  assert.ok(productiveAirSeaExchange.schema === airSeaCarbonExchange
      .AIR_SEA_CARBON_EXCHANGE_PROPOSAL_SCHEMA &&
    productiveAirSeaExchange.status.startsWith('SOLVED_') &&
    productiveAirSeaExchange.sourceOwners.surfacePressureHpa === 1008 &&
    productiveAirSeaExchange.truth.sourceDiagnosticSolved === true &&
    productiveAirSeaExchange.truth.sourceOwnerBinding === true &&
    productiveAirSeaExchange.truth.wetAirPartialPressureIncluded === true &&
    productiveAirSeaExchange.truth.fugacityNonidealityIncluded === true,
  'the coupled ocean step consumes the current carbonate diagnostic, wet-air pressure and Weiss fugacity correction');
  assert.ok(Math.abs(productiveAirSeaExchange.application
      .appliedSignedCarbonToOceanKgCm2 -
    productiveOceanEcology.receipt.carbon
      .airSeaCo2FluxToOceanKgCm2) < 1e-9 &&
    productiveAirSeaExchange.application.proposalMatched === true &&
    productiveAirSeaExchange.application
      .combinedAtmosphereAndOceanCarbonClosed === true &&
    productiveOceanEcology.receipt.truth
      .carbonateInformedAirSeaCo2Exchange === true &&
    productiveOceanEcology.receipt.truth
      .airSeaCarbonOwnerMoveMatchedProposal === true &&
    productiveOceanEcology.receipt.truth
      .scientificAirSeaGasTransferVelocity === false,
  'one signed proposal drives the paired atmosphere-DIC move while retaining the named bulk-relaxation limit');
  const outsideCarbonateExchange = oceanEcology.advanceOceanEcology(
    heldOceanEcology, { ...heldOceanEnvironment, salinityPsu: 10 }, 1,
    { enabled: false, lifeAbundance: 1, sample: oceanSample,
      ocean: heldOceanPhysical });
  assert.ok(outsideCarbonateExchange.receipt.carbon.airSeaCarbonExchange
      .status === 'CARBONATE_DIAGNOSTIC_UNAVAILABLE' &&
    outsideCarbonateExchange.receipt.carbon
      .airSeaCo2FluxToOceanKgCm2 === 0 &&
    outsideCarbonateExchange.receipt.truth
      .carbonateInformedAirSeaCo2Exchange === false &&
    outsideCarbonateExchange.receipt.truth
      .airSeaCarbonExchangeTypedRefusal === true &&
    outsideCarbonateExchange.receipt.truth.physicalGasExchangeActive === true,
  'an out-of-envelope carbonate diagnostic yields typed zero carbon exchange while the separate oxygen path remains active');
  assert.equal(productiveOceanEcology.receipt.deepOcean.schema,
    deepOcean.DEEP_OCEAN_EXCHANGE_RECEIPT_SCHEMA);
  assert.ok(productiveOceanEcology.receipt.deepOcean.particleExport
    .sinkingCarbonKgCm2 > 0 &&
    productiveOceanEcology.receipt.deepOcean.deepRemineralization
      .carbonKgCm2 > 0 &&
    productiveOceanEcology.receipt.deepOcean.seafloorBurial
      .carbonKgCm2 > 0,
  'productive mixed layers export particles into persistent depth, remineralize and bury carbon');
  assert.ok(Object.values(productiveOceanEcology.receipt.deepOcean.conservation)
    .every(value => Math.abs(value) < 1e-9),
  'mixed-layer plus deep-ocean C/N/P/O2/alkalinity transfers close exactly');
  const alkalinityRichSurface = JSON.parse(JSON.stringify(heldOceanEcology));
  alkalinityRichSurface.alkalinity.dissolvedKgCaCO3Eqm2 += 2;
  const richMixedBefore = alkalinityRichSurface.alkalinity
    .dissolvedKgCaCO3Eqm2;
  const richDeepBefore = alkalinityRichSurface.deepOcean.alkalinity
    .dissolvedKgCaCO3Eqm2;
  const alkalinityDownward = oceanEcology.advanceOceanEcology(
    alkalinityRichSurface, heldOceanEnvironment, 1,
    { enabled: false, lifeAbundance: 1, sample: oceanSample,
      ocean: heldOceanPhysical });
  const downwardAlkalinity = alkalinityDownward.receipt.deepOcean
    .dissolvedExchange.alkalinitySurfaceToDeepKgCaCO3Eqm2;
  assert.ok(downwardAlkalinity > 0 &&
    Math.abs((richMixedBefore - alkalinityDownward.state.alkalinity
      .dissolvedKgCaCO3Eqm2) - downwardAlkalinity) < 1e-9 &&
    Math.abs((alkalinityDownward.state.deepOcean.alkalinity
      .dissolvedKgCaCO3Eqm2 - richDeepBefore) - downwardAlkalinity) < 1e-9,
  'a high mixed-layer concentration debits the surface owner and credits the deep owner by one signed amount');
  const alkalinityRichDeep = JSON.parse(JSON.stringify(heldOceanEcology));
  alkalinityRichDeep.alkalinity.dissolvedKgCaCO3Eqm2 = 0;
  const alkalinityUpward = oceanEcology.advanceOceanEcology(
    alkalinityRichDeep, heldOceanEnvironment, 1,
    { enabled: false, lifeAbundance: 1, sample: oceanSample,
      ocean: heldOceanPhysical });
  assert.ok(alkalinityUpward.receipt.deepOcean.dissolvedExchange
      .alkalinitySurfaceToDeepKgCaCO3Eqm2 < 0 &&
    Math.abs(alkalinityUpward.receipt.deepOcean.conservation
      .alkalinityResidualKgCaCO3Eqm2) < 1e-9 &&
    alkalinityUpward.receipt.truth.mixedToDeepAlkalinityClosed === true,
  'a high deep-ocean concentration reverses the signed exchange without losing alkalinity');
  const nutrientStarvedOceanSource = JSON.parse(JSON.stringify(heldOceanEcology));
  nutrientStarvedOceanSource.nitrogen.dissolvedInorganicKgNm2 = 0;
  nutrientStarvedOceanSource.phosphorus.dissolvedInorganicKgPm2 = 0;
  const nutrientStarvedOcean = oceanEcology.advanceOceanEcology(
    nutrientStarvedOceanSource, heldOceanEnvironment, 1,
    { enabled: true, lifeAbundance: 1, sample: oceanSample,
      ocean: heldOceanPhysical }
  );
  assert.equal(nutrientStarvedOcean.receipt.carbon.retainedPrimaryProductionKgCm2, 0,
    'zero dissolved nitrogen and phosphorus block retained plankton growth instead of inventing nutrients');
  assert.equal(nutrientStarvedOcean.receipt.nitrogen.phytoplanktonUptakeKgNm2, 0);
  assert.equal(nutrientStarvedOcean.receipt.phosphorus.phytoplanktonUptakeKgPm2, 0);
  assert.ok(Math.abs(nutrientStarvedOcean.receipt.carbon.residualKgCm2) < 1e-9 &&
    Math.abs(nutrientStarvedOcean.receipt.nitrogen.residualKgNm2) < 1e-9 &&
    Math.abs(nutrientStarvedOcean.receipt.phosphorus.residualKgPm2) < 1e-9,
  'nutrient starvation remains element-conservative');
  const dormantOceanSource = JSON.parse(JSON.stringify(productiveOceanEcology.state));
  dormantOceanSource.carbon.atmosphericExchangeableKgCm2 *= 1.25;
  dormantOceanSource.oxygen.atmosphericExchangeableKgO2m2 *= .82;
  const dormantOceanBiologyBefore = {
    carbon: {
      phytoplanktonKgCm2: dormantOceanSource.carbon.phytoplanktonKgCm2,
      zooplanktonKgCm2: dormantOceanSource.carbon.zooplanktonKgCm2,
      detritusKgCm2: dormantOceanSource.carbon.detritusKgCm2
    },
    nitrogen: {
      phytoplanktonKgNm2: dormantOceanSource.nitrogen.phytoplanktonKgNm2,
      zooplanktonKgNm2: dormantOceanSource.nitrogen.zooplanktonKgNm2,
      detritusKgNm2: dormantOceanSource.nitrogen.detritusKgNm2
    },
    phosphorus: {
      phytoplanktonKgPm2: dormantOceanSource.phosphorus.phytoplanktonKgPm2,
      zooplanktonKgPm2: dormantOceanSource.phosphorus.zooplanktonKgPm2,
      detritusKgPm2: dormantOceanSource.phosphorus.detritusKgPm2
    }
  };
  const dormantOcean = oceanEcology.advanceOceanEcology(
    dormantOceanSource, heldOceanEnvironment, 1,
    { enabled: false, lifeAbundance: 1, sample: oceanSample,
      ocean: heldOceanPhysical }
  );
  assert.equal(dormantOcean.receipt.status, 'physical-only');
  assert.equal(dormantOcean.receipt.carbon.grossPrimaryProductionKgCm2, 0);
  assert.deepEqual({
    carbon: {
      phytoplanktonKgCm2: dormantOcean.state.carbon.phytoplanktonKgCm2,
      zooplanktonKgCm2: dormantOcean.state.carbon.zooplanktonKgCm2,
      detritusKgCm2: dormantOcean.state.carbon.detritusKgCm2
    },
    nitrogen: {
      phytoplanktonKgNm2: dormantOcean.state.nitrogen.phytoplanktonKgNm2,
      zooplanktonKgNm2: dormantOcean.state.nitrogen.zooplanktonKgNm2,
      detritusKgNm2: dormantOcean.state.nitrogen.detritusKgNm2
    },
    phosphorus: {
      phytoplanktonKgPm2: dormantOcean.state.phosphorus.phytoplanktonKgPm2,
      zooplanktonKgPm2: dormantOcean.state.phosphorus.zooplanktonKgPm2,
      detritusKgPm2: dormantOcean.state.phosphorus.detritusKgPm2
    }
  }, dormantOceanBiologyBefore,
  'life-off freezes plankton, organic carbon and nutrient reservoirs');
  assert.equal(dormantOcean.receipt.deepOcean.status, 'physical-only');
  assert.equal(dormantOcean.receipt.deepOcean.particleExport.sinkingCarbonKgCm2, 0);
  assert.ok(Object.values(dormantOcean.receipt.deepOcean.dissolvedExchange)
    .some(value => value !== 0),
  'life-off freezes biological export and remineralization while dissolved vertical exchange continues');
  assert.ok(dormantOcean.receipt.truth.biologicalReservoirsFrozen &&
    dormantOcean.receipt.truth.physicalGasExchangeActive &&
    (dormantOcean.receipt.carbon.airSeaCo2FluxToOceanKgCm2 !== 0 ||
      dormantOcean.receipt.oxygen.airSeaFluxToOceanKgO2m2 !== 0),
  'life-off keeps physical air-sea gas exchange active and explicitly receipted');
  const riverOceanInput = oceanEcology.applyRiverBiogeochemistryInput(
    productiveOceanEcology.state, 1e9, 1e8,
    { sample: oceanSample, ocean: heldOceanPhysical }
  );
  assert.equal(riverOceanInput.receipt.schema,
    oceanEcology.EARTH_OCEAN_ECOLOGY_RIVER_INPUT_SCHEMA);
  assert.ok(riverOceanInput.receipt.inputs.carbonKgC > 0 &&
    riverOceanInput.receipt.inputs.nitrogenKgN > 0 &&
    riverOceanInput.receipt.inputs.phosphorusKgP > 0 &&
    riverOceanInput.receipt.inputs.oxygenKgO2 > 0,
  'river mouth applies an explicit concentration boundary to the receiving mixed layer');
  assert.ok(Math.abs(riverOceanInput.receipt.conservation.carbonResidualKgC) < 1e-5 &&
    Math.abs(riverOceanInput.receipt.conservation.nitrogenResidualKgN) < 1e-5 &&
    Math.abs(riverOceanInput.receipt.conservation.phosphorusResidualKgP) < 1e-5 &&
    Math.abs(riverOceanInput.receipt.conservation.oxygenResidualKgO2) < 1e-5,
  'parameterized river C/N/P/O2 inputs close against the credited ocean reservoirs');
  assert.equal(riverOceanInput.receipt.truth.upstreamRiverChemistryReservoirs, false);
  assert.equal(riverOceanInput.receipt.truth.senderNutrientsDebited, false);
  const heldForestWeather = seasonalWeather.buildSeasonalWeather(
    25.46855, -140.963, heldForestSample,
    { dayOfYear: 156, profile: 'temperate' }
  );
  const heldForestColumn = earthSystem.createEarthSystemColumn(
    25.46855, -140.963, heldForestSample, heldForestWeather,
    { day: 156, profile: 'temperate', livingEnabled: true, lifeAbundance: 1 }
  );
  const heldBareForestColumn = JSON.parse(JSON.stringify(heldForestColumn));
  heldBareForestColumn.land.ecology.physiology.active = false;
  assert.ok(surfaceRadiation.surfaceAlbedo(heldForestColumn) <
    surfaceRadiation.surfaceAlbedo(heldBareForestColumn) - .01,
  'active forest canopy darkens the held snow-free substrate albedo');
  assert.ok(heldForestColumn.land.ecology.aerodynamicRoughnessM > .1,
    'developed canopy exposes aerodynamic roughness for surface heat exchange');
  const clearRadiationColumn = JSON.parse(JSON.stringify(earthColumnA));
  clearRadiationColumn.atmosphere.pressureColumn.layers.forEach(layer => {
    layer.cloudWaterMm = 0;
    layer.cloudIceMm = 0;
  });
  clearRadiationColumn.atmosphere.cloudFraction = 0;
  clearRadiationColumn.atmosphere.freeTroposphere.cloudFraction = 0;
  clearRadiationColumn.surface.albedo = surfaceRadiation.surfaceAlbedo(clearRadiationColumn);
  const clearRadiation = surfaceRadiation.computeSurfaceRadiation(
    clearRadiationColumn,
    wetStorm
  );
  const cloudyRadiationColumn = JSON.parse(JSON.stringify(clearRadiationColumn));
  cloudyRadiationColumn.atmosphere.pressureColumn.layers[0].cloudWaterMm = .42;
  cloudyRadiationColumn.atmosphere.pressureColumn.layers[5].cloudIceMm = .36;
  cloudyRadiationColumn.atmosphere.cloudFraction = .86;
  cloudyRadiationColumn.atmosphere.freeTroposphere.cloudFraction = .78;
  const cloudyRadiation = surfaceRadiation.computeSurfaceRadiation(
    cloudyRadiationColumn,
    wetStorm
  );
  assert.equal(cloudyRadiation.schema, earthSystem.EARTH_SURFACE_RADIATION_SCHEMA);
  assert.equal(cloudyRadiation.cloudOptics.schema, earthSystem.EARTH_CLOUD_OPTICS_SCHEMA);
  assert.equal(cloudyRadiation.cloudOptics.nativeLayerCount, 8);
  assert.ok(cloudyRadiation.cloudOptics.liquidWaterPathMm > 0 &&
    cloudyRadiation.cloudOptics.iceWaterPathMm > 0 &&
    cloudyRadiation.cloudOptics.shortwaveOpticalDepth >
      clearRadiation.cloudOptics.shortwaveOpticalDepth,
  'native liquid and ice paths independently build broadband cloud optical depth');
  assert.ok(cloudyRadiation.absorbedShortwaveWm2 < clearRadiation.absorbedShortwaveWm2 &&
    cloudyRadiation.cloudShortwaveForcingWm2 < 0,
  'native mixed-phase clouds reduce absorbed surface shortwave relative to the held clear column');
  assert.ok(cloudyRadiation.baselineDownwardLongwaveWm2 >=
      clearRadiation.baselineDownwardLongwaveWm2 &&
    cloudyRadiation.cloudLongwaveForcingWm2 >= 0,
  'bulk cloud emissivity never invents a negative baseline longwave greenhouse forcing in the held fixture');
  const referenceCo2Column = JSON.parse(JSON.stringify(clearRadiationColumn));
  referenceCo2Column.atmosphere.biogeochemistry.layers.forEach((layer, index) => {
    layer.carbonDioxideCarbonKgCm2 = 3.45 * referenceCo2Column
      .atmosphere.pressureColumn.layers[index].pressureThicknessHpa / 1013.25;
  });
  referenceCo2Column.atmosphere.biogeochemistry
    .carbonDioxideCarbonKgCm2 = referenceCo2Column.atmosphere
      .biogeochemistry.layers.reduce((sum, layer) =>
        sum + layer.carbonDioxideCarbonKgCm2, 0);
  const referenceCo2 = atmosphereCo2Radiation
    .computeAtmosphereCo2RadiativeCoupling(referenceCo2Column);
  assert.equal(referenceCo2.schema,
    atmosphereCo2Radiation.ATMOSPHERE_CO2_RADIATIVE_COUPLING_SCHEMA);
  assert.equal(referenceCo2.layerCount, 8);
  assert.equal(referenceCo2.truth.referenceStateDetected, true);
  assert.ok(Math.abs(referenceCo2.pressureWeightedCo2Ppm - 420) < 1e-6 &&
    Math.abs(referenceCo2.appliedSurfaceAdjustmentWm2) < 1e-9,
  'a true native 420 ppm column is exactly neutral against the declared reference');
  const scaleReferenceCo2 = multiplier => {
    const scaled = JSON.parse(JSON.stringify(referenceCo2Column));
    scaled.atmosphere.biogeochemistry.layers.forEach(layer => {
      layer.carbonDioxideCarbonKgCm2 *= multiplier;
    });
    scaled.atmosphere.biogeochemistry.carbonDioxideCarbonKgCm2 =
      scaled.atmosphere.biogeochemistry.layers.reduce((sum, layer) =>
        sum + layer.carbonDioxideCarbonKgCm2, 0);
    return scaled;
  };
  const lowCo2 = atmosphereCo2Radiation
    .computeAtmosphereCo2RadiativeCoupling(scaleReferenceCo2(.5));
  const highCo2 = atmosphereCo2Radiation
    .computeAtmosphereCo2RadiativeCoupling(scaleReferenceCo2(2));
  assert.ok(lowCo2.appliedSurfaceAdjustmentWm2 < -1 &&
    highCo2.appliedSurfaceAdjustmentWm2 > 1 &&
    lowCo2.appliedSurfaceAdjustmentWm2 <
      referenceCo2.appliedSurfaceAdjustmentWm2 &&
    referenceCo2.appliedSurfaceAdjustmentWm2 <
      highCo2.appliedSurfaceAdjustmentWm2,
  'the bounded grey-gas response is monotonic below and above the 420 ppm reference');
  const lowLayerCo2Column = JSON.parse(JSON.stringify(referenceCo2Column));
  const highLayerCo2Column = JSON.parse(JSON.stringify(referenceCo2Column));
  const heldCo2CarbonKgCm2 = referenceCo2Column.atmosphere
    .biogeochemistry.carbonDioxideCarbonKgCm2;
  lowLayerCo2Column.atmosphere.biogeochemistry.layers.forEach((layer, index) => {
    layer.carbonDioxideCarbonKgCm2 = index === 0 ? heldCo2CarbonKgCm2 : 0;
  });
  highLayerCo2Column.atmosphere.biogeochemistry.layers.forEach((layer, index) => {
    layer.carbonDioxideCarbonKgCm2 = index === 7 ? heldCo2CarbonKgCm2 : 0;
  });
  const lowLayerCo2 = atmosphereCo2Radiation
    .computeAtmosphereCo2RadiativeCoupling(lowLayerCo2Column);
  const highLayerCo2 = atmosphereCo2Radiation
    .computeAtmosphereCo2RadiativeCoupling(highLayerCo2Column);
  assert.equal(lowLayerCo2.clippedLayerCount + highLayerCo2.clippedLayerCount, 0);
  assert.ok(Math.abs(lowLayerCo2Column.atmosphere.biogeochemistry.layers
    .reduce((sum, layer) => sum + layer.carbonDioxideCarbonKgCm2, 0) -
    highLayerCo2Column.atmosphere.biogeochemistry.layers
      .reduce((sum, layer) => sum + layer.carbonDioxideCarbonKgCm2, 0)) < 1e-12);
  assert.ok(Math.abs(lowLayerCo2.appliedSurfaceAdjustmentWm2 -
    highLayerCo2.appliedSurfaceAdjustmentWm2) > 2,
  'equal total carbon in the warm lowest versus cold highest native layer follows distinct temperature and transmission paths');
  assert.deepEqual(atmosphereCo2Radiation
    .computeAtmosphereCo2RadiativeCoupling(referenceCo2Column), referenceCo2,
  'native-layer CO2 radiation is deterministic');
  const referenceSurfaceRadiation = surfaceRadiation.computeSurfaceRadiation(
    referenceCo2Column, wetStorm);
  const doubledSurfaceRadiation = surfaceRadiation.computeSurfaceRadiation(
    scaleReferenceCo2(2), wetStorm);
  assert.equal(referenceSurfaceRadiation.atmosphereCo2RadiativeCoupling.schema,
    atmosphereCo2Radiation.ATMOSPHERE_CO2_RADIATIVE_COUPLING_SCHEMA);
  assert.ok(Math.abs(referenceSurfaceRadiation.downwardLongwaveWm2 -
    referenceSurfaceRadiation.baselineDownwardLongwaveWm2 -
    referenceSurfaceRadiation.co2LongwaveAdjustmentWm2) < 2e-6 &&
    doubledSurfaceRadiation.downwardLongwaveWm2 >
      referenceSurfaceRadiation.downwardLongwaveWm2 + 1,
  'the nested CO2 adjustment enters the receipted surface longwave ledger');
  assert.ok(cloudyRadiation.atmosphereCo2RadiativeCoupling.cloudOverlap
    .transmission < clearRadiation.atmosphereCo2RadiativeCoupling
      .cloudOverlap.transmission,
  'native mixed-phase clouds apply the declared bounded overlap mask to CO2 feedback');
  const malformedCo2Column = JSON.parse(JSON.stringify(referenceCo2Column));
  malformedCo2Column.atmosphere.biogeochemistry.layers.pop();
  assert.throws(() => atmosphereCo2Radiation
    .computeAtmosphereCo2RadiativeCoupling(malformedCo2Column),
  /eight typed native atmospheric gas layers/,
  'CO2 radiation fails closed instead of silently falling back from malformed native composition');
  const freshSnowAlbedoColumn = JSON.parse(JSON.stringify(earthColumnA));
  freshSnowAlbedoColumn.cryosphere.snowWaterEquivalentMm = 120;
  freshSnowAlbedoColumn.cryosphere.snowAgeDays = 0;
  const agedSnowAlbedoColumn = JSON.parse(JSON.stringify(freshSnowAlbedoColumn));
  agedSnowAlbedoColumn.cryosphere.snowAgeDays = 90;
  assert.ok(surfaceRadiation.surfaceAlbedo(freshSnowAlbedoColumn) >
    surfaceRadiation.surfaceAlbedo(agedSnowAlbedoColumn) + .1,
  'fresh snow is materially brighter than persisted aged snow over the same substrate');
  const radiativeFeedbackWeather = {
    ...wetStorm,
    precipitation: { type: 'none', mmHour: 0, potential: 0 },
    evapotranspirationMmDay: 0
  };
  const clearFeedbackColumn = JSON.parse(JSON.stringify(earthColumnA));
  clearFeedbackColumn.atmosphere.cloudWaterMm = 0;
  clearFeedbackColumn.atmosphere.cloudIceMm = 0;
  clearFeedbackColumn.atmosphere.freeTroposphere.cloudWaterMm = 0;
  clearFeedbackColumn.atmosphere.freeTroposphere.cloudIceMm = 0;
  clearFeedbackColumn.atmosphere.pressureColumn.layers.forEach(layer => {
    layer.cloudWaterMm = 0;
    layer.cloudIceMm = 0;
  });
  const cloudyFeedbackColumn = JSON.parse(JSON.stringify(clearFeedbackColumn));
  cloudyFeedbackColumn.atmosphere.cloudWaterMm = .42;
  cloudyFeedbackColumn.atmosphere.freeTroposphere.cloudIceMm = .36;
  pressureColumn.reconcilePressureColumnWithLegacy(cloudyFeedbackColumn, {
    reason: 'selftest-native-cloud-radiative-feedback'
  });
  const clearFeedbackStep = earthSystem.advanceEarthSystemColumn(
    clearFeedbackColumn,
    radiativeFeedbackWeather,
    grasslandSample,
    .01,
    { livingEnabled: true }
  );
  const cloudyFeedbackStep = earthSystem.advanceEarthSystemColumn(
    cloudyFeedbackColumn,
    radiativeFeedbackWeather,
    grasslandSample,
    .01,
    { livingEnabled: true }
  );
  assert.ok(cloudyFeedbackStep.budget.energy.radiation.absorbedShortwaveWm2 <
    clearFeedbackStep.budget.energy.radiation.absorbedShortwaveWm2 - 100 &&
    cloudyFeedbackStep.surface.temperatureC < clearFeedbackStep.surface.temperatureC,
  'native mixed-phase cloud optical depth causally changes surface heat storage under held forcing');
  assert.equal(earthSystem.EARTH_ATMOSPHERE_PHASE_CHANGE_SCHEMA, 'axm.foundation-planet.atmosphere-phase-change-receipt/v3', 'phase change uses a temperature-envelope-aware typed receipt');
  assert.equal(earthSystem.EARTH_FREE_TROPOSPHERE_SCHEMA, 'axm.foundation-planet.free-troposphere/v2', 'the upper atmospheric reservoir has a transported vector-momentum schema');
  assert.equal(earthSystem.EARTH_FREE_TROPOSPHERE_PHASE_SCHEMA, 'axm.foundation-planet.free-troposphere-phase-receipt/v3', 'upper phase change uses a temperature-envelope-aware typed receipt');
  assert.equal(earthSystem.EARTH_ATMOSPHERE_VERTICAL_EXCHANGE_SCHEMA, 'axm.foundation-planet.atmosphere-vertical-exchange-receipt/v3', 'vertical overturning uses the native pressure-interface receipt lineage');
  assert.equal(earthSystem.ATMOSPHERE_PRESSURE_COLUMN_DYNAMICS_SCHEMA,
    'axm.foundation-planet.atmosphere-pressure-column-dynamics-receipt/v4',
    'native eight-level thermodynamics use a typed composite receipt');
  assert.equal(earthSystem.ATMOSPHERE_PRESSURE_LAYER_PHASE_SCHEMA,
    'axm.foundation-planet.atmosphere-pressure-layer-phase-receipt/v3',
    'each native pressure layer has an independently typed phase receipt');
  assert.equal(earthSystem.ATMOSPHERE_ADJACENT_LAYER_EXCHANGE_SCHEMA,
    'axm.foundation-planet.atmosphere-adjacent-layer-exchange-receipt/v3',
    'every native vertical interface uses a typed exchange receipt');
  assert.equal(earthSystem.ATMOSPHERE_PRECIPITATION_DESCENT_SCHEMA,
    'axm.foundation-planet.atmosphere-precipitation-descent-receipt/v3',
    'native precipitation descent has a typed sender/receiver receipt');
  assert.equal(earthSystem.ATMOSPHERE_BOUNDARY_ENERGY_RECEIPT_SCHEMA,
    atmosphereBoundaryEnergy.ATMOSPHERE_BOUNDARY_ENERGY_RECEIPT_SCHEMA,
    'Earth-system and boundary-energy modules expose one exact receipt schema');
  assert.deepEqual(earthSystem.earthSystemDescription().atmosphereBoundaryEnergy,
    atmosphereBoundaryEnergy.atmosphereBoundaryEnergyDescription(),
    'Earth-system contract exposes requested, applied and envelope-reconciled boundary energy');
  const heldWarmEnvelopeInput = {
    requestedMm: 2,
    airTemperatureC: 69.5,
    heatCapacityJm2K: 1000,
    latentHeatJkg: 1000,
    direction: 'warming'
  };
  const heldWarmEnvelopeBefore = JSON.parse(JSON.stringify(
    heldWarmEnvelopeInput));
  const heldWarmEnvelope = phaseThermalEnvelope
    .boundPhaseChangeByThermalHeadroom(heldWarmEnvelopeInput);
  const heldColdEnvelope = phaseThermalEnvelope
    .boundPhaseChangeByThermalHeadroom({
      requestedMm: 1,
      airTemperatureC: -119.75,
      heatCapacityJm2K: 2000,
      latentHeatJkg: 1000,
      direction: 'cooling'
    });
  assert.deepEqual(heldWarmEnvelopeInput, heldWarmEnvelopeBefore,
    'phase thermal envelope is a pure proposal over the requested material move');
  assert.ok(heldWarmEnvelope.schema === phaseThermalEnvelope
      .ATMOSPHERE_PHASE_THERMAL_ENVELOPE_SCHEMA &&
    heldWarmEnvelope.appliedMm === .5 &&
    heldWarmEnvelope.limitedMm === 1.5 &&
    heldWarmEnvelope.finalAirTemperatureC === 70 &&
    heldWarmEnvelope.truth.appliedWithinThermalHeadroom === true,
  'warming phase change moves only the mass whose latent heat fits the 70 C headroom');
  assert.ok(heldColdEnvelope.appliedMm === .5 &&
    heldColdEnvelope.limitedMm === .5 &&
    heldColdEnvelope.finalAirTemperatureC === -120,
  'cooling phase change moves only the mass whose latent heat fits the -120 C headroom');
  assert.throws(() => phaseThermalEnvelope
    .boundPhaseChangeByThermalHeadroom({
      ...heldWarmEnvelopeInput,
      direction: 'sideways'
    }), /warming or cooling/,
  'phase thermal envelope refuses an untyped energy direction');
  assert.equal(earthSystem.ATMOSPHERE_PRESSURE_COLUMN_SCHEMA,
    pressureColumn.ATMOSPHERE_PRESSURE_COLUMN_SCHEMA,
    'Earth-system and pressure-column modules expose one exact vertical-state schema');
  assert.equal(earthSystem.ATMOSPHERE_PRESSURE_COLUMN_SYNC_SCHEMA,
    pressureColumn.ATMOSPHERE_PRESSURE_COLUMN_SYNC_SCHEMA,
    'Earth-system and pressure-column modules expose one exact reconciliation receipt');
  assert.equal(earthSystem.earthSystemDescription().phaseChangeReceiptSchema, earthSystem.EARTH_ATMOSPHERE_PHASE_CHANGE_SCHEMA, 'Earth-system contract exposes the phase-change receipt schema');
  assert.equal(earthSystem.earthSystemDescription().verticalExchangeReceiptSchema, earthSystem.EARTH_ATMOSPHERE_VERTICAL_EXCHANGE_SCHEMA, 'Earth-system contract exposes the vertical-exchange receipt schema');
  assert.equal(earthSystem.earthSystemDescription().pressureColumn.schema,
    pressureColumn.ATMOSPHERE_PRESSURE_COLUMN_SCHEMA,
    'Earth-system contract exposes the native pressure-column schema');
  assert.equal(earthSystem.earthSystemDescription().pressureColumn.layerCount, 8,
    'Earth-system contract declares the exact native vertical resolution');
  assert.deepEqual(
    earthSystem.earthSystemDescription().pressureColumn.phaseThermalEnvelope,
    phaseThermalEnvelope.phaseThermalEnvelopeDescription(),
    'pressure state and phase dynamics reuse one declared native temperature envelope');
  assert.equal(earthSystem.earthSystemDescription().pressureDynamics.layerCount, 8,
    'Earth-system contract exposes eight-level thermodynamics instead of hiding them behind the compatibility projection');
  assert.equal(earthSystem.earthSystemDescription().nativePressureLevelPhaseChangeReceipted, true);
  assert.equal(earthSystem.earthSystemDescription().nativePrecipitationDescentReceipted, true);
  assert.equal(earthSystem.earthSystemDescription().nativeAdjacentLevelExchangeReceipted, true);
  assert.equal(earthSystem.earthSystemDescription().nativePressureLevelHorizontalTransport, true,
    'Earth-system contract exposes native horizontal advection across all eight pressure levels');
  assert.equal(earthSystem.earthSystemDescription().pressureHorizontalTransport.layerCount, 8,
    'Earth-system contract exposes the native horizontal transport resolution');
  assert.equal(earthSystem.earthSystemDescription().pressureLevelDynamicsResolved, true,
    'Earth-system contract exposes native local dynamics across all seven pressure interfaces');
  assert.equal(earthTransport.earthTransportDescription().runoffRouteReceiptSchema, 'axm.foundation-planet.runoff-route-receipt/v1', 'transport contract exposes typed runoff receipts');
  assert.equal(earthTransport.earthTransportDescription().atmosphereMassRouteReceiptSchema, earthTransport.ATMOSPHERE_PRESSURE_LAYER_MASS_ROUTE_SCHEMA, 'transport contract exposes typed native pressure-layer dry-air mass receipts');
  assert.equal(earthTransport.earthTransportDescription().atmosphereTracerRouteReceiptSchema, earthTransport.ATMOSPHERE_PRESSURE_LAYER_TRACER_ROUTE_SCHEMA, 'transport contract exposes typed native pressure-layer tracer receipts');
  assert.equal(earthTransport.earthTransportDescription().atmospherePressureImpulseReceiptSchema, earthTransport.ATMOSPHERE_PRESSURE_LAYER_IMPULSE_SCHEMA, 'transport contract exposes typed native pressure-layer pressure-gradient impulse receipts');
  assert.equal(earthTransport.earthTransportDescription().atmosphereCoriolisReceiptSchema, earthTransport.ATMOSPHERE_PRESSURE_LAYER_CORIOLIS_SCHEMA, 'transport contract exposes typed native pressure-layer rotation-aware Coriolis receipts');
  assert.equal(earthTransport.earthTransportDescription().atmosphereGeopotentialRouteReceiptSchema, earthTransport.ATMOSPHERE_PRESSURE_LAYER_GEOPOTENTIAL_ROUTE_SCHEMA, 'transport contract exposes typed native pressure-layer terrain-following geopotential work receipts');
  assert.equal(basinRouting.basinRoutingDescription().oceanMouthReceiptSchema, 'axm.foundation-planet.ocean-mouth-receipt/v7', 'basin contract exposes typed nitrate/ammonium/alkalinity-bearing estuary, sediment, atmosphere and ocean delivery');
  assert.equal(basinRouting.basinRoutingDescription().riverChemistry.stateSchema,
    riverChemistry.RIVER_CHEMISTRY_STATE_SCHEMA,
    'basin contract exposes persistent river chemistry reservoirs');
  assert.equal(basinRouting.basinRoutingDescription().estuaryReactor.stateSchema,
    estuaryReactor.ESTUARY_STATE_SCHEMA,
    'basin contract exposes persistent estuary sediment reservoirs');
  const legacyAlkalinityEstuary = estuaryReactor.emptyEstuaryState();
  legacyAlkalinityEstuary.schema = estuaryReactor
    .PREVIOUS_ESTUARY_STATE_SCHEMA;
  legacyAlkalinityEstuary.sedimentOrganicCarbonKgC = 4;
  legacyAlkalinityEstuary.cumulativeDenitrifiedNitrogenKgN = 2;
  delete legacyAlkalinityEstuary.cumulativeAlkalinityGeneratedKgCaCO3Eq;
  const migratedAlkalinityEstuary = estuaryReactor.normalizeEstuaryState(
    legacyAlkalinityEstuary);
  assert.ok(migratedAlkalinityEstuary.sedimentOrganicCarbonKgC === 4 &&
    migratedAlkalinityEstuary.cumulativeDenitrifiedNitrogenKgN === 2 &&
    migratedAlkalinityEstuary.cumulativeAlkalinityGeneratedKgCaCO3Eq === 0 &&
    migratedAlkalinityEstuary.migrationCheckpoint === true,
  'v1 estuary migration preserves sediment and denitrification history while adding zero generated-alkalinity history');
  assert.equal(earthColumnA.kind, 'land', 'land sample creates a terrestrial water-energy column');
  assert.equal(earthColumnA.atmosphere.freeTroposphere.schema, earthSystem.EARTH_FREE_TROPOSPHERE_SCHEMA, 'new columns persist a typed free-troposphere reservoir');
  assert.ok(Math.abs(earthColumnA.atmosphere.boundaryLayerPressureHpa + earthColumnA.atmosphere.freeTroposphere.pressureThicknessHpa - earthColumnA.atmosphere.surfacePressureHpa) < 1e-8, 'boundary and free-troposphere pressure partitions close to surface pressure');
  assert.ok(Math.abs(Object.values(earthSystem.atmosphereLayerHeatCapacitiesJm2K(earthColumnA)).reduce((sum, value) => sum + value, 0) -
    1.02e7 * earthColumnA.atmosphere.surfacePressureHpa / 1013.25) < 1e-6, 'layer heat capacities scale with dry-air pressure mass and partition the declared reference capacity');
  assert.ok(Number.isFinite(earthColumnA.atmosphere.freeTroposphere.eastwardWindMps) &&
    Number.isFinite(earthColumnA.atmosphere.freeTroposphere.northwardWindMps), 'new upper reservoirs own an independent tangent-wind vector');
  assert.equal(earthColumnA.atmosphere.convectiveKineticEnergyJm2, 0, 'new columns begin with an explicit empty convective kinetic-energy reservoir');
  assert.equal(earthColumnA.atmosphere.lastPressureColumnDynamicsReceipt, null,
    'an unstepped column does not invent a native dynamics receipt');
  assert.equal(earthColumnA.truth.nativePressureLevelThermodynamics, true);
  assert.equal(earthColumnA.truth.nativePressureLevelPhaseChangeReceipted, false);
  assert.equal(earthColumnA.atmosphere.pressureColumn.schema,
    pressureColumn.ATMOSPHERE_PRESSURE_COLUMN_SCHEMA,
    'new columns persist a typed pressure-coordinate atmosphere');
  assert.equal(earthColumnA.atmosphere.pressureColumn.layers.length, 8,
    'the first native pressure coordinate has eight finite bottom-to-top levels');
  assert.equal(pressureColumn.validatePressureColumn(earthColumnA.atmosphere.pressureColumn), true,
    'new pressure columns pass structural, hydrostatic and state validation');
  assert.ok(earthColumnA.atmosphere.pressureColumn.modelTopHeightM > 30_000 &&
    earthColumnA.atmosphere.pressureColumn.modelTopHeightM < 120_000,
  'hypsometric interfaces place the bounded model top above the weather column without an infinite vacuum height');
  assert.ok(earthColumnA.atmosphere.pressureColumn.layers.every((layer, index, layers) =>
    layer.bottomPressureHpa > layer.topPressureHpa &&
    layer.bottomHeightM <= layer.centerHeightM &&
    layer.centerHeightM <= layer.topHeightM &&
    (index === 0 || Math.abs(layer.bottomPressureHpa - layers[index - 1].topPressureHpa) < 1e-7)),
  'every native layer has contiguous descending pressure and ascending hydrostatic height interfaces');
  const initialPressureProjection = pressureColumn.pressureColumnProjection(
    earthColumnA.atmosphere.pressureColumn
  );
  assert.ok(Math.abs(initialPressureProjection.boundaryLayer.pressureThicknessHpa -
    earthColumnA.atmosphere.boundaryLayerPressureHpa) < 1e-9 &&
    Math.abs(initialPressureProjection.freeTroposphere.pressureThicknessHpa -
      earthColumnA.atmosphere.freeTroposphere.pressureThicknessHpa) < 1e-9,
  'eight native layers aggregate exactly into the two compatibility pressure bands');
  const initialPressureTotals = pressureColumn.pressureColumnTotals(
    earthColumnA.atmosphere.pressureColumn
  );
  assert.ok(Math.abs(initialPressureTotals.vaporWaterMm -
    (earthColumnA.atmosphere.precipitableWaterMm +
      earthColumnA.atmosphere.freeTroposphere.precipitableWaterMm)) < 1e-9 &&
    Math.abs(initialPressureTotals.cloudWaterMm -
      (earthColumnA.atmosphere.cloudWaterMm +
        earthColumnA.atmosphere.freeTroposphere.cloudWaterMm)) < 1e-9,
  'native pressure layers preserve the exact compatibility-projection atmospheric water');
  assert.ok(new Set(earthColumnA.atmosphere.pressureColumn.layers.map(layer =>
    layer.airTemperatureC.toFixed(6))).size >= 6,
  'pressure levels persist a real vertical temperature structure instead of eight duplicated boxes');
  assert.equal(earthColumnA.atmosphere.lastPressureColumnSyncReceipt.truth.dryAirMassClosed, true);
  assert.equal(earthColumnA.atmosphere.lastPressureColumnSyncReceipt.truth.waterClosed, true);
  assert.equal(earthColumnA.atmosphere.lastPressureColumnSyncReceipt.truth.momentumClosed, true);
  assert.equal(earthColumnA.atmosphere.lastPressureColumnSyncReceipt.truth.moistEnthalpyClosed, true);

  const pressureNoOpColumn = JSON.parse(JSON.stringify(earthColumnA));
  const pressureNoOpDigest = pressureNoOpColumn.atmosphere.pressureColumn.digest;
  const pressureNoOpReceipt = pressureColumn.reconcilePressureColumnWithLegacy(
    pressureNoOpColumn,
    { reason: 'deterministic-no-op-fixture' }
  );
  assert.equal(pressureNoOpColumn.atmosphere.pressureColumn.digest, pressureNoOpDigest,
    'no-op aggregate reconciliation retains the exact native vertical-state digest');
  assert.ok(Math.abs(pressureNoOpReceipt.residuals.moistEnthalpyJm2) < 1 &&
    Math.abs(pressureNoOpReceipt.residuals.dryAirMassKgM2) < 1e-6,
  'no-op reconciliation closes dry air and moist enthalpy without representation drift');

  const pressureRemapColumn = JSON.parse(JSON.stringify(earthColumnA));
  const lowerTemperatureAnomalies = pressureBandTemperatureAnomalies(pressureRemapColumn, 0, 2);
  const upperTemperatureAnomalies = pressureBandTemperatureAnomalies(pressureRemapColumn, 2, 8);
  pressureRemapColumn.atmosphere.surfacePressureHpa = 1008;
  pressureRemapColumn.atmosphere.boundaryLayerPressureHpa = 322.56;
  pressureRemapColumn.atmosphere.freeTroposphere.pressureThicknessHpa = 685.44;
  pressureRemapColumn.atmosphere.airTemperatureC = 17;
  pressureRemapColumn.atmosphere.precipitableWaterMm = 21.25;
  pressureRemapColumn.atmosphere.cloudWaterMm = 1.2;
  pressureRemapColumn.atmosphere.eastwardWindMps = 8;
  pressureRemapColumn.atmosphere.northwardWindMps = -3;
  pressureRemapColumn.atmosphere.freeTroposphere.airTemperatureC = -28;
  pressureRemapColumn.atmosphere.freeTroposphere.precipitableWaterMm = 7.75;
  pressureRemapColumn.atmosphere.freeTroposphere.cloudWaterMm = .8;
  pressureRemapColumn.atmosphere.freeTroposphere.eastwardWindMps = 22;
  pressureRemapColumn.atmosphere.freeTroposphere.northwardWindMps = 4;
  const pressureRemapReceipt = pressureColumn.reconcilePressureColumnWithLegacy(
    pressureRemapColumn,
    { reason: 'known-aggregate-forcing-fixture' }
  );
  const pressureRemapProjection = pressureColumn.pressureColumnProjection(
    pressureRemapColumn.atmosphere.pressureColumn
  );
  assert.ok(Math.abs(pressureRemapProjection.surfacePressureHpa - 1008) < 1e-9 &&
    Math.abs(pressureRemapProjection.boundaryLayer.pressureThicknessHpa - 322.56) < 1e-9 &&
    Math.abs(pressureRemapProjection.freeTroposphere.pressureThicknessHpa - 685.44) < 1e-9,
  'aggregate forcing remaps finite native layer masses onto the changed pressure partition');
  assert.ok(Math.abs(pressureRemapProjection.boundaryLayer.vaporWaterMm - 21.25) < 1e-9 &&
    Math.abs(pressureRemapProjection.freeTroposphere.vaporWaterMm - 7.75) < 1e-9 &&
    Math.abs(pressureRemapProjection.boundaryLayer.cloudWaterMm - 1.2) < 1e-9 &&
    Math.abs(pressureRemapProjection.freeTroposphere.cloudWaterMm - .8) < 1e-9,
  'pressure remapping debits and credits the exact target vapor and cloud reservoirs');
  assert.ok(Math.abs(pressureRemapProjection.boundaryLayer.eastwardWindMps - 8) < 1e-9 &&
    Math.abs(pressureRemapProjection.boundaryLayer.northwardWindMps + 3) < 1e-9 &&
    Math.abs(pressureRemapProjection.freeTroposphere.eastwardWindMps - 22) < 1e-9 &&
    Math.abs(pressureRemapProjection.freeTroposphere.northwardWindMps - 4) < 1e-9,
  'pressure remapping matches both compatibility-band momentum targets');
  assert.deepEqual(
    pressureBandTemperatureAnomalies(pressureRemapColumn, 0, 2).map(value =>
      Number(value.toFixed(9))),
    lowerTemperatureAnomalies.map(value => Number(value.toFixed(9))),
    'boundary-layer remapping preserves native vertical temperature anomalies'
  );
  assert.deepEqual(
    pressureBandTemperatureAnomalies(pressureRemapColumn, 2, 8).map(value =>
      Number(value.toFixed(9))),
    upperTemperatureAnomalies.map(value => Number(value.toFixed(9))),
    'free-troposphere remapping preserves native vertical temperature anomalies'
  );
  assert.ok(Object.values(pressureRemapReceipt.residuals).every(value =>
    Math.abs(value) < 1),
  'known aggregate forcing closes every declared pressure-column remap residual');
  assert.equal(pressureRemapReceipt.truth.hydrostaticInterfacesMonotonic, true,
    'remapped native layers rebuild a monotonic hydrostatic interface geometry');
  const pressureWindLimitColumn = JSON.parse(JSON.stringify(earthColumnA));
  pressureWindLimitColumn.atmosphere.pressureColumn.layers.forEach((layer, index) => {
    layer.eastwardWindMps += index % 2 === 0 ? 18 : -18;
    layer.northwardWindMps += index % 3 === 0 ? 7 : -3.5;
  });
  pressureWindLimitColumn.atmosphere.eastwardWindMps = 89;
  pressureWindLimitColumn.atmosphere.northwardWindMps = 0;
  pressureWindLimitColumn.atmosphere.freeTroposphere.eastwardWindMps = 89;
  pressureWindLimitColumn.atmosphere.freeTroposphere.northwardWindMps = 0;
  const pressureWindLimitReceipt = pressureColumn.reconcilePressureColumnWithLegacy(
    pressureWindLimitColumn,
    { reason: 'bounded-native-shear-fixture' }
  );
  assert.ok(pressureWindLimitColumn.atmosphere.pressureColumn.layers.every(layer =>
    Math.hypot(layer.eastwardWindMps, layer.northwardWindMps) <= 90.000000001),
  'native shear is reduced coherently when required so no pressure level violates the wind contract');
  assert.ok(Math.abs(pressureWindLimitReceipt.residuals.eastwardMomentumKgMpsM2) < 1e-6 &&
    Math.abs(pressureWindLimitReceipt.residuals.northwardMomentumKgMpsM2) < 1e-6,
  'coherent native-shear limiting preserves the requested aggregate tangent momentum');
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
  assert.ok(Math.abs(wetVerticalReceipt.eastwardMomentumResidualKgMpsM2) < 1e-7 &&
    Math.abs(wetVerticalReceipt.northwardMomentumResidualKgMpsM2) < 1e-7 &&
    Math.abs(wetVerticalReceipt.kineticEnergyResidualJm2) < 1, 'equal gross vertical parcels conserve horizontal momentum and receipt their mixing dissipation');
  assert.equal(wetVerticalReceipt.grossUpwardGeopotentialEnergyJm2,
    wetVerticalReceipt.grossDownwardGeopotentialEnergyJm2,
    'equal gross upward and downward parcels exchange the same geopotential energy');
  assert.equal(wetVerticalReceipt.grossUpwardPressureExpansionWorkJm2,
    wetVerticalReceipt.grossDownwardPressureCompressionWorkJm2,
    'closed overturning receipts equal gross pressure expansion and compression work');
  assert.ok(Math.abs(wetVerticalReceipt.resolvedEnergyResidualJm2) < 1 &&
    Math.abs(wetVerticalReceipt.convectiveKineticEnergyResidualJm2) < 1,
  'vertical moist, horizontal kinetic, convective kinetic and geopotential energy close together');
  assert.equal(wetVerticalReceipt.truth.buoyancyWorkResolved, true, 'the v2 receipt resolves bounded two-layer buoyancy conversion without claiming 3D convection');
  assert.equal(wetVerticalReceipt.truth.threeDimensionalConvection, false, 'bounded overturning keeps the resolved-3D refusal explicit');
  assert.equal(wetEarthStep.atmosphere.lastPressureColumnSyncReceipt.schema,
    pressureColumn.ATMOSPHERE_PRESSURE_COLUMN_SYNC_SCHEMA,
    'each local Earth step emits a pressure-column reconciliation receipt');
  assert.equal(wetEarthStep.atmosphere.lastPressureColumnSyncReceipt.reason,
    'local-earth-system-step',
    'the native column identifies local two-band forcing as its compatibility source');
  assert.equal(pressureColumn.validatePressureColumn(wetEarthStep.atmosphere.pressureColumn), true,
    'the stepped pressure column retains finite reservoirs and hydrostatic interfaces');
  const wetPressureDynamics = wetEarthStep.atmosphere.lastPressureColumnDynamicsReceipt;
  assert.equal(wetPressureDynamics.schema,
    earthSystem.ATMOSPHERE_PRESSURE_COLUMN_DYNAMICS_SCHEMA,
    'the coupled Earth step persists its native pressure-dynamics receipt');
  assert.equal(wetPressureDynamics.layerPhaseReceipts.length, 8,
    'every native pressure level emits a phase-change receipt on each local step');
  assert.deepEqual(wetPressureDynamics.layerPhaseReceipts.map(entry => entry.layerIndex),
    [0, 1, 2, 3, 4, 5, 6, 7],
    'native phase receipts cover every level exactly once in bottom-to-top order');
  assert.equal(wetPressureDynamics.adjacentExchangeReceipts.length, 7,
    'all seven native interfaces emit an equal-gross exchange receipt');
  assert.deepEqual(wetPressureDynamics.adjacentExchangeReceipts.map(entry => entry.interfaceIndex),
    [0, 1, 2, 3, 4, 5, 6],
    'native exchange receipts cover every adjacent interface exactly once');
  assert.ok(wetPressureDynamics.adjacentExchangeReceipts.every(entry =>
    entry.schema === earthSystem.ATMOSPHERE_ADJACENT_LAYER_EXCHANGE_SCHEMA &&
    entry.grossUpwardDryAirKgM2 === entry.grossCompensatingDownwardDryAirKgM2 &&
    Math.abs(entry.waterResidualMm) < 1e-8 &&
    Math.abs(entry.eastwardMomentumResidualKgMpsM2) < 1e-6 &&
    Math.abs(entry.northwardMomentumResidualKgMpsM2) < 1e-6 &&
    Math.abs(entry.kineticEnergyResidualJm2) < 1 &&
    Math.abs(entry.sensibleHeatResidualJm2) < 1 &&
    Math.abs(entry.convectiveKineticEnergyResidualJm2) < 1 &&
    Math.abs(entry.resolvedEnergyResidualJm2) < 1 &&
    entry.truth.resolvedVerticalMomentum === true &&
    entry.entrainedDryAirKgM2 === entry.detrainedDryAirKgM2),
  'every native interface closes dry parcels, water, tangent and vertical momentum, entrainment, kinetic conversion and sensible heating');
  assert.equal(wetEarthStep.atmosphere.pressureColumn.verticalInterfaces.length, 7,
    'the pressure column persists one vertical-motion state at every native interface');
  assert.ok(wetEarthStep.atmosphere.pressureColumn.verticalInterfaces.every((entry, index) =>
    entry.schema === earthSystem.ATMOSPHERE_PRESSURE_VERTICAL_INTERFACE_SCHEMA &&
    entry.index === index &&
    entry.updraftVelocityMps >= 0 && entry.updraftVelocityMps <= 90 &&
    Math.abs(entry.updraftVerticalMomentumKgMpsM2 +
      entry.compensatingDowndraftVerticalMomentumKgMpsM2) < 1e-7),
  'persisted native interfaces carry bounded vertical speed and exactly compensating column momentum');
  assert.ok(wetPressureDynamics.precipitationDescentRoutes.some(route =>
    route.sourceLayerIndex >= 2 && route.interfacesCrossed.length >= 2),
  'upper-level condensate visibly crosses each native interface on its path to the surface');
  assert.ok(wetPressureDynamics.precipitationDescentRoutes.every(route =>
    route.schema === earthSystem.ATMOSPHERE_PRECIPITATION_DESCENT_SCHEMA &&
    route.destination === 'surface-precipitation-boundary' &&
    route.senderDebitMm === route.receiverCreditMm && route.residualMm === 0),
  'every precipitation descent route has an exact native sender debit and surface receiver credit');
  const recomputedInterfaceFalloutMm = Array.from({ length: 7 }, (_, interfaceIndex) =>
    wetPressureDynamics.precipitationDescentRoutes.reduce((sum, route) =>
      sum + (route.interfacesCrossed.includes(interfaceIndex) ? route.amountMm : 0), 0));
  assert.ok(recomputedInterfaceFalloutMm.every((amount, interfaceIndex) =>
    Math.abs(amount - wetPressureDynamics.interfaceFalloutMm[interfaceIndex]) < 1e-9),
  'per-interface fallout totals exactly match the individual descent routes');
  assert.ok(Math.abs(wetPressureDynamics.residuals.waterMm) < 1e-8 &&
    Math.abs(wetPressureDynamics.residuals.moistEnthalpyJm2) < 1 &&
    Math.abs(wetPressureDynamics.residuals.eastwardMomentumKgMpsM2) < 1e-6 &&
    Math.abs(wetPressureDynamics.residuals.northwardMomentumKgMpsM2) < 1e-6 &&
    Math.abs(wetPressureDynamics.residuals.resolvedEnergyJm2) < 1,
  'the composite native receipt closes water, moist enthalpy, tangent momentum and resolved energy');
  assert.equal(wetEarthStep.truth.pressureCoordinateColumnPersisted, true);
  assert.equal(wetEarthStep.truth.pressureColumnConservativeProjection, true);
  assert.equal(wetEarthStep.truth.pressureColumnHydrostaticInterfaces, true);
  assert.equal(wetEarthStep.truth.nativePressureLevelPhaseChangeReceipted, true);
  assert.equal(wetEarthStep.truth.nativePrecipitationDescentReceipted, true);
  assert.equal(wetEarthStep.truth.nativeAdjacentLevelExchangeReceipted, true);
  assert.equal(wetEarthStep.truth.nativePressureLevelWaterClosed, true);
  assert.equal(wetEarthStep.truth.nativePressureLevelMoistEnthalpyClosed, true);
  assert.equal(wetEarthStep.truth.nativePressureLevelMomentumClosed, true);
  assert.equal(wetEarthStep.truth.nativePressureLevelResolvedEnergyClosed, true);
  assert.equal(wetEarthStep.truth.nativePressureLevelHorizontalTransport, false);
  assert.equal(wetEarthStep.truth.pressureLevelDynamicsResolved, true,
    'all seven native interfaces now drive local buoyancy, vertical momentum and bulk exchange');
  assert.equal(wetEarthStep.truth.nativePressureInterfaceBuoyancyReceipted, true);
  assert.equal(wetEarthStep.truth.nativePressureInterfaceVerticalMomentum, true);
  assert.equal(wetEarthStep.truth.nativePressureInterfaceConvectiveKineticEnergy, true);
  assert.equal(wetEarthStep.truth.nativePressureInterfaceEntrainmentDetrainment, true);
  assert.ok(wetEarthStep.atmosphere.lastPhaseChangeReceipt.condensationMm > 0 && wetEarthStep.atmosphere.lastPhaseChangeReceipt.precipitationMm > 0, 'wet weather condenses vapor into cloud liquid before it precipitates');
  assert.ok(wetEarthStep.atmosphere.lastPhaseChangeReceipt.precipitationMm > 12 && wetEarthStep.atmosphere.lastPhaseChangeReceipt.finalCloudWaterMm <= 12, 'bounded condensation-to-precipitation subcycles can deliver a long storm without exceeding instantaneous cloud capacity');
  assert.ok(wetEarthStep.atmosphere.lastPhaseChangeReceipt.finalAirTemperatureC > wetEarthStep.atmosphere.lastPhaseChangeReceipt.initialAirTemperatureC, 'condensation releases latent heat into atmospheric sensible heat');
  assert.ok(Math.abs(wetEarthStep.atmosphere.lastPhaseChangeReceipt.waterResidualMm) < 1e-7, 'phase-change receipt closes vapor, cloud liquid and precipitation water');
  assert.ok(Math.abs(wetEarthStep.atmosphere.lastPhaseChangeReceipt.moistEnthalpyResidualJm2) < 1, 'phase change conserves moist enthalpy while exchanging latent and sensible forms');
  assert.ok(Math.abs(wetEarthStep.budget.atmosphereEnergy.residualJm2) < 1, 'boundary forcing, phase change and surface evaporation close the atmospheric moist-enthalpy budget');
  assert.equal(wetEarthStep.budget.atmosphereEnergy.nativeMomentumMixingConversionJm2,
    wetPressureDynamics.momentumMixingDissipationJm2,
    'native tangent-momentum mixing loss is explicitly thermalized into the complete atmospheric energy ledger');
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
  assert.equal(wetEarthStep.budget.energy.radiation.schema,
    earthSystem.EARTH_SURFACE_RADIATION_SCHEMA,
  'each local step persists its broadband surface-radiation receipt');
  assert.equal(wetEarthStep.budget.energy.radiation.cloudOptics.nativeLayerCount, 8,
    'surface radiation consumes all eight native mixed-phase pressure levels');
  assert.equal(wetEarthStep.budget.energy.radiation.truth.nativeMixedPhaseCloudOptics, true);
  assert.equal(wetEarthStep.budget.energy.radiation
    .atmosphereCo2RadiativeCoupling.schema,
  atmosphereCo2Radiation.ATMOSPHERE_CO2_RADIATIVE_COUPLING_SCHEMA);
  assert.equal(wetEarthStep.budget.energy.radiation
    .atmosphereCo2RadiativeCoupling.layerCount, 8);
  assert.equal(wetEarthStep.budget.energy.radiation.truth
    .nativeLayerCo2RadiativeCoupling, true);
  assert.equal(wetEarthStep.truth.nativeLayerCo2RadiativeCoupling, true);
  assert.equal(wetEarthStep.truth.co2SurfaceLongwaveFeedbackApplied, true);
  assert.equal(wetEarthStep.truth.spectralAtmosphericRadiativeTransfer, false);
  assert.ok(Math.abs(wetEarthStep.budget.energy.radiation
    .downwardLongwaveWm2 - wetEarthStep.budget.energy.radiation
      .baselineDownwardLongwaveWm2 - wetEarthStep.budget.energy.radiation
        .co2LongwaveAdjustmentWm2) < 2e-6,
  'the live Earth step carries native-layer CO2 forcing inside its closed surface-energy ledger');
  assert.equal(wetEarthStep.cryosphere.lastPhaseChangeReceipt.schema,
    earthSystem.EARTH_CRYOSPHERE_PHASE_SCHEMA);
  assert.ok(Math.abs(wetEarthStep.cryosphere.lastPhaseChangeReceipt.residualJm2) < 1,
    'the land snow phase receipt closes frozen-water phase enthalpy');
  assert.equal(wetEarthStep.truth.nativeMixedPhaseCloudRadiation, true);
  assert.equal(wetEarthStep.truth.dynamicCryosphereAlbedo, true);
  assert.equal(wetEarthStep.truth.cryosphereFusionEnergyReceipted, true);
  assert.equal(wetEarthStep.land.ecology.schema,
    earthSystem.EARTH_LAND_ECOLOGY_SCHEMA);
  assert.equal(wetEarthStep.land.ecology.lastFluxReceipt.schema,
    earthSystem.EARTH_LAND_ECOLOGY_FLUX_SCHEMA);
  assert.equal(wetEarthStep.budget.landEcology.schema,
    earthSystem.EARTH_LAND_ECOLOGY_FLUX_SCHEMA);
  assert.ok(Math.abs(wetEarthStep.budget.landEcology.carbon.residualKgCm2) < 1e-8 &&
    Math.abs(wetEarthStep.budget.landEcology.nitrogen.residualKgNm2) < 1e-8,
  'the coupled Earth step closes carbon and nitrogen alongside water and energy');
  assert.equal(wetEarthStep.truth.persistentLandEcology, true);
  assert.equal(wetEarthStep.truth.localCarbonBudgetClosed, true);
  assert.equal(wetEarthStep.truth.localNitrogenBudgetClosed, true);
  assert.equal(wetEarthStep.truth.vegetationAlbedoCoupled, true);
  assert.equal(wetEarthStep.truth.physiologicalTranspirationCoupled, true);
  assert.equal(wetEarthStep.atmosphere.biogeochemistry.schema,
    atmosphereBiogeochemistry.ATMOSPHERE_BIOGEOCHEMISTRY_STATE_SCHEMA);
  assert.equal(wetEarthStep.budget.atmosphereBiogeochemistry.schema,
    atmosphereBiogeochemistry.ATMOSPHERE_BIOSPHERE_GAS_FLUX_RECEIPT_SCHEMA);
  assert.equal(wetEarthStep.atmosphere.biogeochemistry
    .carbonDioxideCarbonKgCm2,
  wetEarthStep.land.ecology.carbon.atmosphericExchangeableKgCm2,
  'land ecology carbon proxy is an exact compatibility mirror of the atmosphere-owned reservoir');
  assert.ok(Math.abs(wetEarthStep.budget.atmosphereBiogeochemistry.exchanges
    .ecologyCarbonToAtmosphereKgCm2 -
  wetEarthStep.land.ecology.lastFluxReceipt.carbon.netAtmosphereExchangeKgCm2) < 1e-9,
  'the atmosphere gas receipt records the exact land carbon counterpart flux');
  assert.ok(Object.values(wetEarthStep.budget.atmosphereBiogeochemistry
    .conservation).every(value => Math.abs(value) < 1e-9),
  'land-atmosphere carbon accounting closes at the new authoritative gas owner');
  assert.equal(wetEarthStep.atmosphere.biogeochemistry.layers.length, 8,
    'the atmosphere-owned carbon, oxygen and nitrogen reservoirs persist at all eight native pressure levels');
  assert.ok(wetEarthStep.atmosphere.biogeochemistry.layers.every((layer, index) =>
    layer.schema === atmosphereBiogeochemistry.ATMOSPHERE_BIOGEOCHEMISTRY_LAYER_SCHEMA &&
    layer.index === index &&
    layer.carbonDioxideCarbonKgCm2 >= 0 && layer.oxygenKgO2m2 >= 0 &&
    layer.nitrogenGasKgNm2 >= 0),
  'every native gas layer is typed, ordered and non-negative');
  const wetGasVertical = wetEarthStep.budget.atmosphereBiogeochemistryVertical;
  assert.equal(wetGasVertical.schema,
    atmosphereBiogeochemistry.ATMOSPHERE_BIOGEOCHEMISTRY_VERTICAL_TRANSPORT_SCHEMA);
  assert.equal(wetGasVertical.interfaceCount, 7,
    'the gas organ consumes all seven native adjacent-interface exchange receipts');
  assert.ok(wetGasVertical.routes.every((route, index) =>
    route.schema === atmosphereBiogeochemistry
      .ATMOSPHERE_BIOGEOCHEMISTRY_VERTICAL_INTERFACE_SCHEMA &&
    route.interfaceIndex === index && route.lowerLayerIndex === index &&
    route.upperLayerIndex === index + 1),
  'vertical gas lineage names every ordered lower/upper native-layer pair');
  assert.ok(Object.values(wetGasVertical.conservation).every(value =>
    Math.abs(value) < 1e-9) &&
    wetGasVertical.truth.carbonOxygenNitrogenConservative === true,
  'native vertical gas exchange conserves carbon, oxygen and nitrogen exactly');
  assert.equal(wetEarthStep.budget.atmosphereBiogeochemistry
    .nativeLayerReceiver.primaryLayerIndex, 0,
  'land and ocean gas fluxes enter through the native surface pressure layer');
  assert.equal(wetEarthStep.truth.nativePressureLayerAtmosphericBiogeochemistry,
    true);
  assert.equal(wetEarthStep.truth.atmosphericBiogeochemistryVerticalTransport,
    true);
  assert.equal(wetEarthStep.truth
    .atmosphericBiogeochemistryVerticalConservationClosed, true);
  const landIntegrityAudit = systemAudit.auditFoundationSystem({
    column: wetEarthStep
  });
  assert.equal(landIntegrityAudit.schema,
    systemAudit.FOUNDATION_SYSTEM_AUDIT_SCHEMA);
  assert.equal(landIntegrityAudit.verdict,
    'PASS_WITH_UNOBSERVED_OPTIONAL_SEAMS',
  'a healthy local column passes while absent transport and basin receipts remain honestly unobserved');
  assert.equal(landIntegrityAudit.counts.fail, 0);
  assert.equal(landIntegrityAudit.checks.find(item =>
    item.id === 'atmosphere-co2-radiative-coupling').status, 'PASS',
  'the integrity organ accepts a complete current CO2 radiation receipt');
  const legacyRadiationColumn = JSON.parse(JSON.stringify(wetEarthStep));
  legacyRadiationColumn.surface.lastRadiationReceipt.schema =
    surfaceRadiation.PREVIOUS_EARTH_SURFACE_RADIATION_SCHEMA;
  delete legacyRadiationColumn.surface.lastRadiationReceipt
    .atmosphereCo2RadiativeCoupling;
  const legacyRadiationAudit = systemAudit.auditFoundationSystem({
    column: legacyRadiationColumn
  });
  assert.equal(legacyRadiationAudit.checks.find(item =>
    item.id === 'atmosphere-co2-radiative-coupling').status,
  'NOT_APPLICABLE',
  'a genuine legacy v1 radiation receipt remains unobserved rather than masquerading as CO2 evidence');
  const malformedCurrentRadiationColumn = JSON.parse(JSON.stringify(wetEarthStep));
  delete malformedCurrentRadiationColumn.surface.lastRadiationReceipt
    .atmosphereCo2RadiativeCoupling;
  const malformedCurrentRadiationAudit = systemAudit.auditFoundationSystem({
    column: malformedCurrentRadiationColumn
  });
  assert.equal(malformedCurrentRadiationAudit.checks.find(item =>
    item.id === 'atmosphere-co2-radiative-coupling').status, 'FAIL',
  'a current v2 radiation receipt cannot omit its required native-layer CO2 evidence');
  const corruptedGasMirror = JSON.parse(JSON.stringify(wetEarthStep));
  corruptedGasMirror.land.ecology.carbon.atmosphericExchangeableKgCm2 += .1;
  const corruptedIntegrityAudit = systemAudit.auditFoundationSystem({
    column: corruptedGasMirror
  });
  assert.equal(corruptedIntegrityAudit.verdict, 'FAIL',
    'the audit refuses a corrupted required ownership claim');
  assert.equal(corruptedIntegrityAudit.checks.find(item =>
    item.id === 'ecology-gas-compatibility-mirror').status, 'FAIL',
  'the audit locates the exact broken gas mirror instead of returning a generic failure');
  assert.equal(wetEarthStep.truth.waterBudgetClosed, true, 'closed land water budget is explicit truth');
  assert.ok(wetEarthStep.fluxes.infiltrationMmDay > 0, 'rain infiltrates the physical root zone');
  assert.ok(wetEarthStep.land.rootZoneWaterMm >= 0 && wetEarthStep.land.deepSoilWaterMm >= 0 && wetEarthStep.land.groundwaterStorageMm >= 0, 'all terrestrial reservoirs stay non-negative');
  const noLifeWetStep = earthSystem.advanceEarthSystemColumn(earthColumnA, wetStorm, grasslandSample, 1, { livingEnabled: false, lifeAbundance: 1 });
  assert.equal(noLifeWetStep.fluxes.transpirationMmDay, 0, 'life-off state removes biological transpiration without deleting physical evaporation');
  assert.ok(noLifeWetStep.fluxes.evaporationMmDay > 0, 'abiotic evaporation continues when living layers are off');
  assert.deepEqual(noLifeWetStep.land.ecology.carbon,
    earthColumnA.land.ecology.carbon,
  'life-off Earth step freezes persistent carbon pools');
  assert.deepEqual(noLifeWetStep.land.ecology.nitrogen,
    earthColumnA.land.ecology.nitrogen,
  'life-off Earth step freezes persistent nitrogen pools');
  assert.equal(noLifeWetStep.land.ecology.lastFluxReceipt.truth.reservoirsFrozen, true);
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
  assert.ok(upperSaturatedStep.atmosphere.lastFreeTropospherePhaseReceipt.depositionMm > 0 &&
    upperSaturatedStep.atmosphere.lastFreeTropospherePhaseReceipt.finalCloudIceMm > 0,
  'supersaturated cold upper air deposits into its own cloud-ice reservoir');
  assert.ok(upperSaturatedStep.atmosphere.lastFreeTropospherePhaseReceipt.finalAirTemperatureC > upperSaturatedStep.atmosphere.lastFreeTropospherePhaseReceipt.initialAirTemperatureC, 'upper deposition returns vaporization and fusion latent heat to upper-air sensible heat');
  assert.equal(upperSaturatedStep.atmosphere.lastFreeTropospherePhaseReceipt.truth.directPrecipitation, false, 'free-troposphere condensate does not bypass the boundary precipitation path');

  const meltingDescentColumn = JSON.parse(JSON.stringify(upperSaturatedStep));
  meltingDescentColumn.atmosphere.pressureColumn.layers.forEach((layer, index) => {
    layer.airTemperatureC = [8, 5, 2, -2, -8, -15, -22, -30][index];
    layer.vaporWaterMm = index < 2 ? .1 : .01;
    layer.cloudWaterMm = 0;
    layer.cloudIceMm = index === 6 ? 1.5 : 0;
  });
  meltingDescentColumn.atmosphere.pressureColumn = pressureColumn.normalizePressureColumn(
    meltingDescentColumn.atmosphere.pressureColumn,
    meltingDescentColumn.surface.elevationM
  );
  const meltingDescent = pressureDynamics.advancePressureColumnDynamics(
    meltingDescentColumn,
    { durationDays: .05, desiredPrecipitationMm: .8, reason: 'mixed-phase-melting-selftest' }
  );
  assert.ok(meltingDescent.snowfallMm < meltingDescent.precipitationMm &&
    meltingDescent.rainfallMm > 0,
  'snow sourced aloft melts while descending through native warm layers');
  assert.ok(meltingDescent.receipt.precipitationDescentRoutes.some(route =>
    route.sourceSnowMm > 0 && route.surfaceRainMm > 0 &&
    route.phaseTransitions.some(transition => transition.meltingMm > 0)),
  'typed descent receipts name every snow-to-rain transition and the receiving layer');
  assert.ok(Math.abs(meltingDescent.receipt.residuals.waterMm) < 1e-8 &&
    Math.abs(meltingDescent.receipt.residuals.moistEnthalpyJm2) < 1,
  'melting precipitation closes native water and moist enthalpy including fusion energy');

  const freezingDescentColumn = JSON.parse(JSON.stringify(upperSaturatedStep));
  freezingDescentColumn.atmosphere.pressureColumn.layers.forEach((layer, index) => {
    layer.airTemperatureC = index === 1 ? 5 : -15;
    layer.vaporWaterMm = index < 2 ? .1 : .01;
    layer.cloudWaterMm = index === 1 ? 1 : 0;
    layer.cloudIceMm = 0;
  });
  freezingDescentColumn.atmosphere.pressureColumn = pressureColumn.normalizePressureColumn(
    freezingDescentColumn.atmosphere.pressureColumn,
    freezingDescentColumn.surface.elevationM
  );
  const freezingDescent = pressureDynamics.advancePressureColumnDynamics(
    freezingDescentColumn,
    { durationDays: .05, desiredPrecipitationMm: .5, reason: 'mixed-phase-freezing-selftest' }
  );
  assert.ok(freezingDescent.snowfallMm > 0 &&
    freezingDescent.receipt.precipitationDescentRoutes.some(route =>
      route.sourceRainMm > 0 && route.surfaceSnowMm > 0 &&
      route.phaseTransitions.some(transition => transition.freezingMm > 0)),
  'rain refreezes through a cold native layer and reaches the surface as typed snow');
  assert.ok(Math.abs(freezingDescent.receipt.residuals.waterMm) < 1e-8 &&
    Math.abs(freezingDescent.receipt.residuals.moistEnthalpyJm2) < 1 &&
    Math.abs(freezingDescent.receipt.residuals.resolvedEnergyJm2) < 1,
  'refreezing precipitation closes native water and resolved energy after outgoing snow enthalpy');

  const snowyEarthColumn = JSON.parse(JSON.stringify(earthColumnA));
  snowyEarthColumn.surface.temperatureC = -12;
  snowyEarthColumn.atmosphere.airTemperatureC = -12;
  snowyEarthColumn.atmosphere.freeTroposphere.airTemperatureC = -34;
  snowyEarthColumn.atmosphere.cloudWaterMm = 0;
  snowyEarthColumn.atmosphere.cloudIceMm = 2;
  snowyEarthColumn.atmosphere.freeTroposphere.cloudWaterMm = 0;
  snowyEarthColumn.atmosphere.freeTroposphere.cloudIceMm = 3;
  seedNativePressureColumnFromCompatibilityBands(snowyEarthColumn);
  const snowyEarthStep = earthSystem.advanceEarthSystemColumn(
    snowyEarthColumn,
    { ...wetStorm, seasonalTemperatureC: -12,
      precipitation: { type: 'snow', mmHour: 2, potential: .9 },
      evapotranspirationMmDay: 0 },
    grasslandSample,
    .25,
    { livingEnabled: true }
  );
  assert.ok(snowyEarthStep.fluxes.snowfallMmDay > 0 &&
    snowyEarthStep.budget.atmosphereEnergy.surfacePrecipitationPhaseEnthalpyJm2 < 0,
  'the Earth-system surface and atmospheric ledger consume native snowfall phase and its outgoing phase enthalpy');
  assert.ok(Math.abs(snowyEarthStep.budget.water.residualMm) < 1e-5 &&
    Math.abs(snowyEarthStep.budget.atmosphereEnergy.residualJm2) < 1 &&
    Math.abs(snowyEarthStep.atmosphere.lastPressureColumnDynamicsReceipt
      .residuals.resolvedEnergyJm2) < 1,
  'a full snowy land step closes water and fusion-aware atmospheric energy');

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
  assert.ok(unstableExchange.buoyancyAccelerationMps2 > 0 && unstableExchange.buoyancyWorkJm2 > 0,
    'a positively buoyant lifted parcel converts bounded available thermal energy into convective kinetic energy');
  assert.ok(unstableExchange.finalConvectiveKineticEnergyJm2 > unstableExchange.initialConvectiveKineticEnergyJm2 &&
    unstableExchange.verticalVelocityProxyMps > 0,
  'unstable overturning persists generated convective kinetic energy and a bounded vertical-velocity proxy');
  assert.ok(Math.abs(unstableExchange.resolvedEnergyResidualJm2) < 1,
    'unstable buoyancy conversion closes the complete declared vertical energy ledger');

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
  assert.equal(stableStep.atmosphere.lastVerticalExchangeReceipt.buoyancyWorkJm2, 0,
    'a non-buoyant lifted parcel cannot manufacture convective kinetic energy');
  const dissipatingColumn = JSON.parse(JSON.stringify(unstableStep));
  dissipatingColumn.atmosphere.airTemperatureC = 10;
  dissipatingColumn.atmosphere.freeTroposphere.airTemperatureC = -14;
  const dissipatingStep = earthSystem.advanceEarthSystemColumn(
    dissipatingColumn,
    { ...wetStorm, seasonalTemperatureC: 10, precipitation: { type: 'none', mmHour: 0, potential: 0 }, evapotranspirationMmDay: 0 },
    grasslandSample,
    .1,
    { livingEnabled: true }
  );
  const dissipatingExchange = dissipatingStep.atmosphere.lastVerticalExchangeReceipt;
  assert.ok(dissipatingExchange.initialConvectiveKineticEnergyJm2 > 0 &&
    dissipatingExchange.convectiveDissipationJm2 > 0 &&
    dissipatingExchange.finalConvectiveKineticEnergyJm2 <
      dissipatingExchange.initialConvectiveKineticEnergyJm2,
  'stored convective kinetic energy decays into receipted sensible heat under stable conditions');
  assert.ok(Math.abs(dissipatingExchange.resolvedEnergyResidualJm2) < 1,
    'convective dissipation closes rather than deleting stored kinetic energy');
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
    const recomputedMoistResidualJm2 = earthSystem.atmosphereMoistEnthalpyJm2(phaseSweepColumn) +
      phaseSweepColumn.budget.atmosphereEnergy.surfacePrecipitationPhaseEnthalpyJm2 -
      phaseSweepColumn.budget.atmosphereEnergy.initialMoistEnthalpyJm2 -
      phaseSweepColumn.budget.atmosphereEnergy.boundaryMoistEnthalpyJm2 -
      phaseSweepColumn.budget.atmosphereEnergy.surfaceLatentInputJm2 -
      phaseSweepColumn.budget.atmosphereEnergy.verticalMechanicalConversionJm2 -
      phaseSweepColumn.budget.atmosphereEnergy.nativeMomentumMixingConversionJm2;
    assert.ok(Math.abs(recomputedMoistResidualJm2 - phaseSweepColumn.budget.atmosphereEnergy.residualJm2) < 1e-4, 'published moist-enthalpy residual matches the quantized state that persists');
    assert.ok(Math.abs(phaseSweepColumn.atmosphere.lastPhaseChangeReceipt.waterResidualMm) < 1e-7 && Math.abs(phaseSweepColumn.atmosphere.lastPhaseChangeReceipt.moistEnthalpyResidualJm2) < 1, 'every repeated phase receipt closes water and moist enthalpy');
    assert.ok(Math.abs(phaseSweepColumn.atmosphere.lastVerticalExchangeReceipt.resolvedEnergyResidualJm2) < 1 &&
      phaseSweepColumn.atmosphere.convectiveKineticEnergyJm2 >= 0 &&
      phaseSweepColumn.atmosphere.convectiveKineticEnergyJm2 <= 5e6 &&
      phaseSweepColumn.atmosphere.verticalVelocityProxyMps >= 0 &&
      phaseSweepColumn.atmosphere.verticalVelocityProxyMps <= 90,
    'every repeated vertical step closes resolved energy and keeps convective kinetic state bounded');
    assert.ok(phaseSweepColumn.atmosphere.precipitableWaterMm >= .2 && phaseSweepColumn.atmosphere.precipitableWaterMm <= 75 && phaseSweepColumn.atmosphere.cloudWaterMm >= 0 && phaseSweepColumn.atmosphere.cloudIceMm >= 0 && phaseSweepColumn.atmosphere.cloudWaterMm + phaseSweepColumn.atmosphere.cloudIceMm <= 12, 'repeated wet/dry phase steps keep vapor and lower mixed-phase cloud water bounded');
    assert.ok(phaseSweepColumn.atmosphere.freeTroposphere.precipitableWaterMm >= 0 && phaseSweepColumn.atmosphere.freeTroposphere.precipitableWaterMm <= 20 && phaseSweepColumn.atmosphere.freeTroposphere.cloudWaterMm >= 0 && phaseSweepColumn.atmosphere.freeTroposphere.cloudIceMm >= 0 && phaseSweepColumn.atmosphere.freeTroposphere.cloudWaterMm + phaseSweepColumn.atmosphere.freeTroposphere.cloudIceMm <= 8, 'repeated wet/dry steps keep upper vapor and mixed-phase condensate bounded');
    assert.ok(Math.abs(phaseSweepColumn.atmosphere.boundaryLayerPressureHpa + phaseSweepColumn.atmosphere.freeTroposphere.pressureThicknessHpa - phaseSweepColumn.atmosphere.surfacePressureHpa) < 1e-8, 'every persisted step closes its two-layer pressure partition');
    assert.ok(Math.abs(phaseSweepColumn.atmosphere.lastFreeTropospherePhaseReceipt.waterResidualMm) < 1e-7 && Math.abs(phaseSweepColumn.atmosphere.lastVerticalExchangeReceipt.waterResidualMm) < 1e-7, 'upper phase and vertical receipts close on every repeated step');
    assert.equal(phaseSweepColumn.atmosphere.lastPressureColumnDynamicsReceipt.schema,
      earthSystem.ATMOSPHERE_PRESSURE_COLUMN_DYNAMICS_SCHEMA,
      'every repeated wet/dry step persists the typed native pressure receipt');
    assert.ok(phaseSweepColumn.atmosphere.lastPressureColumnDynamicsReceipt.layerPhaseReceipts.length === 8 &&
      phaseSweepColumn.atmosphere.lastPressureColumnDynamicsReceipt.adjacentExchangeReceipts.length === 7 &&
      phaseSweepColumn.atmosphere.lastPressureColumnDynamicsReceipt.truth.nativeWaterClosed &&
      phaseSweepColumn.atmosphere.lastPressureColumnDynamicsReceipt.truth.nativeMoistEnthalpyClosed &&
      phaseSweepColumn.atmosphere.lastPressureColumnDynamicsReceipt.truth.nativeTangentMomentumClosed &&
      phaseSweepColumn.atmosphere.lastPressureColumnDynamicsReceipt.truth.nativeResolvedEnergyClosed,
    'every repeated wet/dry step covers all native levels and interfaces with closed composite ledgers');
    assert.equal(pressureColumn.validatePressureColumn(
      phaseSweepColumn.atmosphere.pressureColumn
    ), true, 'every repeated phase step retains a valid eight-level pressure column');
    assert.ok(Math.abs(phaseSweepColumn.atmosphere.lastPressureColumnSyncReceipt.residuals.dryAirMassKgM2) < 1e-6 &&
      Math.abs(phaseSweepColumn.atmosphere.lastPressureColumnSyncReceipt.residuals.vaporWaterMm) < 1e-8 &&
      Math.abs(phaseSweepColumn.atmosphere.lastPressureColumnSyncReceipt.residuals.cloudWaterMm) < 1e-8 &&
      Math.abs(phaseSweepColumn.atmosphere.lastPressureColumnSyncReceipt.residuals.moistEnthalpyJm2) < 1,
    'every repeated phase step conservatively reconciles the native pressure levels');
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
  moistureLimitedColumn.atmosphere.cloudWaterMm = 0;
  moistureLimitedColumn.atmosphere.freeTroposphere.precipitableWaterMm = .01;
  moistureLimitedColumn.atmosphere.freeTroposphere.cloudWaterMm = 0;
  moistureLimitedColumn.atmosphere.freeTroposphere.relativeHumidity = .01;
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
  assert.ok(snowEarthStep.cryosphere.lastPhaseChangeReceipt.snowfallMm > 0 &&
    snowEarthStep.cryosphere.lastPhaseChangeReceipt.precipitationPhaseInputJm2 < 0 &&
    Math.abs(snowEarthStep.cryosphere.lastPhaseChangeReceipt.residualJm2) < 1,
  'surface snowfall arrives with explicit ice-phase enthalpy and a closed fusion receipt');
  const forcedMelt = { ...summerWeather, seasonalTemperatureC: 18, precipitation: { type: 'none', mmHour: 0, potential: 0 } };
  const meltEarthStep = earthSystem.advanceEarthSystemColumn(snowEarthStep, forcedMelt, grasslandSample, 1, { livingEnabled: true });
  assert.ok(meltEarthStep.cryosphere.snowWaterEquivalentMm < snowEarthStep.cryosphere.snowWaterEquivalentMm, 'warm energy forcing melts stored snow into the land water path');
  assert.ok(meltEarthStep.cryosphere.lastPhaseChangeReceipt.snowmeltMm > 0 &&
    meltEarthStep.cryosphere.lastPhaseChangeReceipt.sensibleToFusionJm2 > 0,
  'snowmelt consumes receipted sensible/radiative energy rather than changing phase for free');
  assert.ok(Math.abs(meltEarthStep.budget.water.residualMm) < 1e-5, 'snowmelt transfer remains water-conservative');

  const oceanColumn = earthSystem.createEarthSystemColumn(-30, -160, oceanSample, oceanWeather, { day: 118, profile: 'temperate' });
  assert.equal(oceanColumn.kind, 'ocean', 'ocean sample creates a mixed-layer column');
  assert.ok(oceanColumn.ocean.mixedLayerDepthM >= 12 && oceanColumn.ocean.mixedLayerDepthM <= 180, 'ocean mixed layer stays physically bounded');
  const oceanStep = earthSystem.advanceEarthSystemColumn(
    oceanColumn, oceanWeather, oceanSample, 1,
    { livingEnabled: true, lifeAbundance: 1 });
  assert.ok(Math.abs(oceanStep.budget.water.residualMm) < 1e-5, 'ocean precipitation, evaporation and sea ice close their freshwater budget');
  assert.ok(Math.abs(
    oceanStep.budget.water.atmosphere.afterBoundaryWaterMm - oceanStep.budget.water.precipitationMm +
    oceanStep.budget.water.evaporationMm - oceanStep.budget.water.atmosphere.finalWaterMm
  ) < 1e-5, 'ocean precipitation and evaporation exchange water with the same atmospheric reservoir');
  assert.ok(Math.abs(oceanStep.budget.energy.residualJm2) < 1, 'ocean mixed-layer heat closes its prescribed energy budget');
  assert.ok(oceanStep.ocean.salinityPsu >= 2 && oceanStep.ocean.salinityPsu <= 43, 'mixed-layer salinity stays bounded');
  assert.ok(oceanStep.cryosphere.seaIceFraction >= 0 && oceanStep.cryosphere.seaIceFraction <= 1, 'thermodynamic sea-ice fraction stays bounded');
  assert.equal(oceanStep.ocean.ecology.schema,
    earthSystem.EARTH_OCEAN_ECOLOGY_SCHEMA);
  assert.equal(oceanStep.ocean.ecology.lastFluxReceipt.schema,
    earthSystem.EARTH_OCEAN_ECOLOGY_FLUX_SCHEMA);
  assert.equal(oceanStep.budget.oceanEcology.schema,
    earthSystem.EARTH_OCEAN_ECOLOGY_FLUX_SCHEMA);
  assert.equal(oceanStep.atmosphere.biogeochemistry
    .carbonDioxideCarbonKgCm2,
  oceanStep.ocean.ecology.carbon.atmosphericExchangeableKgCm2);
  assert.equal(oceanStep.atmosphere.biogeochemistry.oxygenKgO2m2,
    oceanStep.ocean.ecology.oxygen.atmosphericExchangeableKgO2m2,
  'ocean carbon and oxygen compatibility mirrors exactly follow the atmosphere-owned gas state');
  assert.ok(Object.values(oceanStep.budget.atmosphereBiogeochemistry
    .conservation).every(value => Math.abs(value) < 1e-9) &&
    oceanStep.truth.atmosphereBiosphereGasLedgerClosed,
  'ocean-atmosphere carbon and oxygen accounting closes explicitly');
  assert.ok(Math.abs(oceanStep.budget.oceanEcology.carbon.residualKgCm2) < 1e-9 &&
    Math.abs(oceanStep.budget.oceanEcology.nitrogen.residualKgNm2) < 1e-9 &&
    Math.abs(oceanStep.budget.oceanEcology.phosphorus.residualKgPm2) < 1e-9 &&
    Math.abs(oceanStep.budget.oceanEcology.oxygen.residualKgO2m2) < 1e-9 &&
    Math.abs(oceanStep.budget.oceanEcology.alkalinity
      .residualKgCaCO3Eqm2) < 1e-9,
  'mixed/deep ocean ecology closes C/N/P/O2/alkalinity inside the full Earth-system step');
  assert.ok(oceanStep.truth.persistentOceanEcology &&
    oceanStep.truth.localOceanCarbonBudgetClosed &&
    oceanStep.truth.localOceanNitrogenBudgetClosed &&
    oceanStep.truth.localOceanPhosphorusBudgetClosed &&
    oceanStep.truth.localOceanOxygenFluxClosed &&
    oceanStep.truth.localOceanAlkalinityBudgetClosed &&
    oceanStep.truth.persistentDeepOceanAlkalinity &&
    oceanStep.truth.mixedToDeepAlkalinityClosure,
  'Earth-system truth exposes the proved ocean-ecology closures');
  const oceanAlkalinityAuditInput = JSON.parse(JSON.stringify(oceanStep));
  const oceanAlkalinityAudit = systemAudit.auditFoundationSystem({
    column: oceanAlkalinityAuditInput
  });
  assert.equal(oceanAlkalinityAudit.checks.find(item =>
    item.id === 'mixed-deep-ocean-alkalinity-ledger').status, 'PASS',
  'the read-only integrity organ proves the current mixed/deep owner receipt');
  assert.equal(oceanAlkalinityAudit.checks.find(item =>
    item.id === 'mixed-layer-carbonate-diagnostic').status, 'PASS',
  'the read-only integrity organ proves the current carbonate source binding and closure');
  assert.equal(oceanAlkalinityAudit.checks.find(item =>
    item.id === 'carbonate-informed-air-sea-carbon-exchange').status, 'PASS',
  'the read-only integrity organ recomputes wet-air fugacity, direction, bounds and paired owner application');
  assert.ok(oceanStep.truth.carbonateInformedAirSeaCo2Exchange === true &&
    oceanStep.truth.airSeaCo2FugacityCorrection === true &&
    oceanStep.truth.airSeaCarbonOwnerMoveMatchedProposal === true &&
    oceanStep.truth.scientificAirSeaGasTransferVelocity === false &&
    oceanStep.truth.measuredAirSeaPco2 === false &&
    oceanStep.truth.measuredOceanSkinTemperature === false,
  'Earth-column truth propagates the proved R54 exchange and preserves its observation and transfer boundaries');
  assert.deepEqual(oceanAlkalinityAuditInput, oceanStep,
    'the mixed/deep audit does not mutate the inspected column');
  const corruptedDeepAlkalinityReceipt = JSON.parse(JSON.stringify(oceanStep));
  corruptedDeepAlkalinityReceipt.ocean.ecology.deepOcean.lastExchangeReceipt
    .conservation.alkalinityResidualKgCaCO3Eqm2 = .25;
  const corruptedDeepAlkalinityAudit = systemAudit.auditFoundationSystem({
    column: corruptedDeepAlkalinityReceipt
  });
  assert.equal(corruptedDeepAlkalinityAudit.checks.find(item =>
    item.id === 'mixed-deep-ocean-alkalinity-ledger').status, 'FAIL',
  'the audit rejects a current deep alkalinity receipt with a nonzero residual');
  const corruptedCarbonateDiagnostic = JSON.parse(JSON.stringify(oceanStep));
  corruptedCarbonateDiagnostic.ocean.ecology.carbonateSystem.closure
    .alkalinityResidualMolKg = .25;
  const corruptedCarbonateAudit = systemAudit.auditFoundationSystem({
    column: corruptedCarbonateDiagnostic
  });
  assert.equal(corruptedCarbonateAudit.checks.find(item =>
    item.id === 'mixed-layer-carbonate-diagnostic').status, 'FAIL',
  'the audit rejects a carbonate diagnostic whose alkalinity residual is corrupted');
  const corruptedAirSeaExchange = JSON.parse(JSON.stringify(oceanStep));
  corruptedAirSeaExchange.ocean.ecology.lastFluxReceipt.carbon
    .airSeaCarbonExchange.equilibrium.co2FugacityFactor *= 1.01;
  const corruptedAirSeaAudit = systemAudit.auditFoundationSystem({
    column: corruptedAirSeaExchange
  });
  assert.equal(corruptedAirSeaAudit.checks.find(item =>
    item.id === 'carbonate-informed-air-sea-carbon-exchange').status, 'FAIL',
  'the audit rejects a carbon receipt whose claimed Weiss fugacity factor is corrupted');
  const oceanBiologyBeforeDormancy = {
    carbon: {
      phytoplanktonKgCm2: oceanStep.ocean.ecology.carbon.phytoplanktonKgCm2,
      zooplanktonKgCm2: oceanStep.ocean.ecology.carbon.zooplanktonKgCm2,
      detritusKgCm2: oceanStep.ocean.ecology.carbon.detritusKgCm2
    },
    nitrogen: {
      phytoplanktonKgNm2: oceanStep.ocean.ecology.nitrogen.phytoplanktonKgNm2,
      zooplanktonKgNm2: oceanStep.ocean.ecology.nitrogen.zooplanktonKgNm2,
      detritusKgNm2: oceanStep.ocean.ecology.nitrogen.detritusKgNm2
    },
    phosphorus: {
      phytoplanktonKgPm2: oceanStep.ocean.ecology.phosphorus.phytoplanktonKgPm2,
      zooplanktonKgPm2: oceanStep.ocean.ecology.phosphorus.zooplanktonKgPm2,
      detritusKgPm2: oceanStep.ocean.ecology.phosphorus.detritusKgPm2
    }
  };
  const dormantOceanStep = earthSystem.advanceEarthSystemColumn(
    oceanStep, oceanWeather, oceanSample, 1,
    { livingEnabled: false, lifeAbundance: 1 });
  assert.equal(dormantOceanStep.ocean.ecology.lastFluxReceipt.status,
    'physical-only');
  assert.equal(dormantOceanStep.fluxes.marineGrossPrimaryProductionKgCm2Day, 0);
  assert.deepEqual({
    carbon: {
      phytoplanktonKgCm2:
        dormantOceanStep.ocean.ecology.carbon.phytoplanktonKgCm2,
      zooplanktonKgCm2:
        dormantOceanStep.ocean.ecology.carbon.zooplanktonKgCm2,
      detritusKgCm2: dormantOceanStep.ocean.ecology.carbon.detritusKgCm2
    },
    nitrogen: {
      phytoplanktonKgNm2: dormantOceanStep.ocean.ecology.nitrogen.phytoplanktonKgNm2,
      zooplanktonKgNm2: dormantOceanStep.ocean.ecology.nitrogen.zooplanktonKgNm2,
      detritusKgNm2: dormantOceanStep.ocean.ecology.nitrogen.detritusKgNm2
    },
    phosphorus: {
      phytoplanktonKgPm2: dormantOceanStep.ocean.ecology.phosphorus.phytoplanktonKgPm2,
      zooplanktonKgPm2: dormantOceanStep.ocean.ecology.phosphorus.zooplanktonKgPm2,
      detritusKgPm2: dormantOceanStep.ocean.ecology.phosphorus.detritusKgPm2
    }
  }, oceanBiologyBeforeDormancy,
  'the master Life switch freezes ocean biology while Earth-system physics continues');
  assert.equal(dormantOceanStep.truth.physicalOceanChemistryWithLifeOff, true);
  const coupledOceanWeather = seasonalWeather.buildSeasonalWeather(
    -30, -160, oceanSample,
    { dayOfYear: 119, profile: 'temperate', earthSystem: oceanStep });
  assert.equal(coupledOceanWeather.coupling.oceanEcology.schema,
    earthSystem.EARTH_OCEAN_ECOLOGY_SCHEMA);
  assert.equal(coupledOceanWeather.coupling.oceanEcology.fluxReceiptSchema,
    earthSystem.EARTH_OCEAN_ECOLOGY_FLUX_SCHEMA);
  assert.equal(coupledOceanWeather.coupling.oceanEcology.carbonResidualKgCm2,
    oceanStep.ocean.ecology.lastFluxReceipt.carbon.residualKgCm2);
  assert.equal(coupledOceanWeather.truth
    .coupledOceanEcologyCarbonNutrientsOxygen, true);
  assert.equal(coupledOceanWeather.coupling
    .statefulOceanEcologyCarbonNutrientsOxygen, true);
  const polarOceanSample = model.sampleLatLon(-70, -160, { profile: 'temperate' });
  assert.equal(polarOceanSample.land, false, 'the held polar cryosphere fixture is ocean');
  const polarSnowWeather = {
    ...seasonalWeather.buildSeasonalWeather(-70, -160, polarOceanSample, {
      dayOfYear: 180,
      profile: 'temperate'
    }),
    seasonalTemperatureC: -12,
    precipitation: { type: 'snow', mmHour: 3, potential: .8 },
    evapotranspirationMmDay: 0
  };
  const polarOceanColumn = earthSystem.createEarthSystemColumn(
    -70,
    -160,
    polarOceanSample,
    polarSnowWeather,
    { day: 180, profile: 'temperate' }
  );
  const polarOceanStep = earthSystem.advanceEarthSystemColumn(
    polarOceanColumn,
    polarSnowWeather,
    polarOceanSample,
    1
  );
  assert.ok(polarOceanStep.cryosphere.snowWaterEquivalentMm > 0,
    'native snowfall persists as a distinct snow-on-sea-ice reservoir');
  assert.ok(polarOceanStep.cryosphere.lastPhaseChangeReceipt.freezingPointC < 0 &&
    Math.abs(polarOceanStep.cryosphere.lastPhaseChangeReceipt.residualJm2) < 1,
  'sea-ice thermodynamics use salinity-aware freezing and close phase enthalpy');
  assert.ok(Math.abs(polarOceanStep.budget.water.residualMm) < 1e-5 &&
    Math.abs(polarOceanStep.budget.energy.residualJm2) < 1,
  'snow-on-ice, seawater, sea ice and mixed-layer heat close together');
  const coupledWeather = seasonalWeather.buildSeasonalWeather(25.46855, -140.963, grasslandSample, { dayOfYear: 157, profile: 'temperate', earthSystem: wetEarthStep });
  assert.equal(coupledWeather.truth.coupledWaterEnergyColumn, true, 'weather consumes the stateful surface column');
  assert.equal(coupledWeather.truth.coupledPressureAndVectorWind, true, 'weather exposes carried pressure and vector wind rather than a disconnected scalar diagnostic');
  assert.equal(coupledWeather.truth.coupledCloudLiquidAndLatentHeat, true, 'weather exposes the stored cloud-liquid and latent-heat column rather than a disconnected cloud diagnostic');
  assert.equal(coupledWeather.truth.coupledMixedPhaseCloudsAndFusionHeat, true,
    'weather exposes stored cloud ice and fusion energy rather than reclassifying a liquid-only diagnostic');
  assert.equal(coupledWeather.truth.coupledMixedPhaseCloudRadiation, true,
    'weather exposes native mixed-phase cloud radiative feedback');
  assert.equal(coupledWeather.truth.coupledCryosphereAlbedoAndFusion, true,
    'weather exposes dynamic frozen-surface albedo and fusion receipts');
  assert.equal(coupledWeather.truth.coupledTypedRainSnowDescent, true,
    'weather exposes the typed native surface precipitation lineage');
  assert.equal(coupledWeather.truth.coupledTwoLayerAtmosphere, true, 'weather exposes the stateful boundary/free-troposphere column rather than collapsing it back to one layer');
  assert.equal(coupledWeather.truth.coupledIndependentLayerMomentum, true, 'weather exposes independent upper tangent momentum rather than reusing the boundary wind');
  assert.equal(coupledWeather.truth.coupledBoundedBuoyancyConversion, true,
    'weather exposes the receipted bounded buoyancy conversion without upgrading it to a forecast');
  assert.equal(coupledWeather.truth.coupledPressureCoordinateColumn, true,
    'weather exposes the persisted eight-level pressure coordinate');
  assert.equal(coupledWeather.truth.coupledNativePressureThermodynamics, true,
    'weather exposes receipted native phase change rather than only the compatibility bands');
  assert.equal(coupledWeather.truth.coupledNativePrecipitationDescent, true,
    'weather exposes native precipitation descent across pressure interfaces');
  assert.equal(coupledWeather.truth.coupledNativeAdjacentLevelExchange, true,
    'weather exposes all adjacent native pressure-level exchanges');
  assert.equal(coupledWeather.truth.pressureLevelDynamicsResolved, true,
    'weather exposes the completed native local pressure-interface dynamics claim');
  assert.equal(coupledWeather.pressureHpa, wetEarthStep.atmosphere.surfacePressureHpa, 'visible coupled pressure comes from the transported Earth column');
  assert.equal(coupledWeather.windSpeedMps, wetEarthStep.atmosphere.windSpeedMps, 'visible coupled wind speed is derived from carried tangent momentum');
  assert.ok(Number.isFinite(coupledWeather.boundaryForcing.pressureHpa) && Number.isFinite(coupledWeather.boundaryForcing.windSpeedMps), 'procedural synoptic targets remain explicit local boundary forcing');
  assert.equal(coupledWeather.coupling.cloudWaterMm, wetEarthStep.atmosphere.cloudWaterMm, 'weather coupling names the exact stored cloud-liquid reservoir');
  assert.equal(coupledWeather.coupling.cloudIceMm, wetEarthStep.atmosphere.cloudIceMm,
    'weather coupling names the exact stored cloud-ice reservoir');
  assert.equal(coupledWeather.coupling.freeTroposphere.schema, earthSystem.EARTH_FREE_TROPOSPHERE_SCHEMA, 'weather coupling carries the exact typed free-troposphere reservoir');
  assert.equal(coupledWeather.coupling.freeTroposphere.verticalExchangeReceiptSchema, earthSystem.EARTH_ATMOSPHERE_VERTICAL_EXCHANGE_SCHEMA, 'weather coupling exposes the vertical-exchange receipt lineage');
  assert.equal(coupledWeather.coupling.freeTroposphere.eastwardWindMps,
    wetEarthStep.atmosphere.freeTroposphere.eastwardWindMps,
    'weather coupling carries the exact stored upper eastward wind');
  assert.equal(coupledWeather.coupling.convectiveKineticEnergyJm2,
    wetEarthStep.atmosphere.convectiveKineticEnergyJm2,
    'weather coupling carries the exact stored convective kinetic-energy reservoir');
  assert.equal(coupledWeather.coupling.verticalResolvedEnergyResidualJm2,
    wetEarthStep.atmosphere.lastVerticalExchangeReceipt.resolvedEnergyResidualJm2,
    'weather coupling exposes the exact complete vertical energy residual');
  assert.equal(coupledWeather.coupling.pressureColumn.schema,
    pressureColumn.ATMOSPHERE_PRESSURE_COLUMN_SCHEMA,
    'weather coupling carries the exact typed pressure-column state');
  assert.equal(coupledWeather.coupling.pressureColumn.layerCount, 8,
    'weather coupling reports all eight native pressure levels');
  assert.equal(coupledWeather.coupling.pressureColumn.syncReceiptSchema,
    pressureColumn.ATMOSPHERE_PRESSURE_COLUMN_SYNC_SCHEMA,
    'weather coupling exposes the exact aggregate-reconciliation receipt lineage');
  assert.equal(coupledWeather.coupling.pressureColumn.dynamicsReceiptSchema,
    earthSystem.ATMOSPHERE_PRESSURE_COLUMN_DYNAMICS_SCHEMA,
    'weather coupling exposes the exact native pressure-dynamics receipt lineage');
  assert.equal(coupledWeather.coupling.pressureColumn.nativeLayerPhaseReceiptCount, 8);
  assert.equal(coupledWeather.coupling.pressureColumn.adjacentExchangeReceiptCount, 7);
  assert.equal(coupledWeather.coupling.pressureColumn.nativeWaterResidualMm,
    wetPressureDynamics.residuals.waterMm);
  assert.equal(coupledWeather.coupling.pressureColumn.cloudIceMm,
    wetEarthStep.atmosphere.pressureColumn.totals.cloudIceMm);
  assert.equal(coupledWeather.coupling.pressureColumn.surfaceRainfallMm,
    wetPressureDynamics.surfaceRainfallMm);
  assert.equal(coupledWeather.coupling.pressureColumn.surfaceSnowfallMm,
    wetPressureDynamics.surfaceSnowfallMm);
  assert.equal(coupledWeather.coupling.moistEnthalpyResidualJm2, wetEarthStep.budget.atmosphereEnergy.residualJm2, 'weather coupling exposes the atmospheric moist-enthalpy residual');
  assert.equal(coupledWeather.coupling.radiation.schema,
    earthSystem.EARTH_SURFACE_RADIATION_SCHEMA);
  assert.equal(coupledWeather.coupling.radiation.shortwaveOpticalDepth,
    wetEarthStep.budget.energy.radiation.cloudOptics.shortwaveOpticalDepth);
  assert.equal(coupledWeather.coupling.cryosphere.phaseReceiptSchema,
    earthSystem.EARTH_CRYOSPHERE_PHASE_SCHEMA);
  assert.equal(coupledWeather.coupling.landEcology.schema,
    earthSystem.EARTH_LAND_ECOLOGY_SCHEMA);
  assert.equal(coupledWeather.coupling.landEcology.fluxReceiptSchema,
    earthSystem.EARTH_LAND_ECOLOGY_FLUX_SCHEMA);
  assert.equal(coupledWeather.coupling.landEcology.carbonResidualKgCm2,
    wetEarthStep.land.ecology.lastFluxReceipt.carbon.residualKgCm2);
  assert.equal(coupledWeather.truth.coupledLandEcologyCarbonNitrogen, true);
  assert.equal(coupledWeather.truth.coupledPhysiologicalTranspiration, true);
  assert.equal(coupledWeather.snowpackMm, Math.round(wetEarthStep.cryosphere.snowWaterEquivalentMm), 'weather reads stored snow rather than inventing a second snowpack');
  assert.equal(coupledWeather.coupling.cellId, wetEarthStep.id, 'weather exposes exact canonical Earth-cell coupling');

  const earthEngineA = new earthSystem.EarthSystemEngine({ seed: model.PLANET_DEFAULTS.seed, profileId: 'temperate', maximumColumns: 4 });
  const engineFirst = earthEngineA.advanceAt(25.46855, -140.963, grasslandSample, wetStorm, 156, { livingEnabled: true });
  const initialOnlySave = earthEngineA.snapshot();
  const initialOnlyRestore = new earthSystem.EarthSystemEngine({ seed: model.PLANET_DEFAULTS.seed, profileId: 'temperate', maximumColumns: 4, state: initialOnlySave });
  assert.deepEqual(initialOnlyRestore.snapshot(), initialOnlySave, 'unstepped v23 native-layer-CO2-radiation-ready land, mixed-layer and deep-ocean columns survive exact restore without inventing a receipt');
  const rungThirtySixSave = JSON.parse(JSON.stringify(initialOnlySave));
  rungThirtySixSave.schema = earthSystem.PREVIOUS_EARTH_SYSTEM_ENGINE_SCHEMA;
  rungThirtySixSave.transportReceipts = [{
    profileId: 'temperate',
    receipt: { schema: earthTransport.PREVIOUS_EARTH_TRANSPORT_STEP_SCHEMA }
  }];
  for (const entry of rungThirtySixSave.columns) {
    delete entry.column.surface.baseElevationM;
    delete entry.column.surface.geomorphicElevationAdjustmentM;
    delete entry.column.land.surfaceSediment;
    delete entry.column.routing.runoffSedimentQueue;
    delete entry.column.budget.geomorphicSediment;
    delete entry.column.truth.finiteSurfaceSedimentOwnership;
    delete entry.column.truth.persistentRunoffSedimentQueue;
    delete entry.column.truth.geomorphicSedimentConservationClosed;
  }
  const rungThirtySixRestore = new earthSystem.EarthSystemEngine({
    seed: model.PLANET_DEFAULTS.seed,
    profileId: 'temperate',
    maximumColumns: 4,
    state: rungThirtySixSave
  });
  const migratedSedimentColumn = rungThirtySixRestore
    .columnsForProfile('temperate')[0];
  assert.equal(migratedSedimentColumn.land.surfaceSediment
    .migrationCheckpoint, true);
  assert.ok(Object.values(migratedSedimentColumn.land.surfaceSediment
    .availableKgM2).every(value => value === 0) &&
    Object.values(migratedSedimentColumn.routing.runoffSedimentQueue
      .suspendedKgM2).every(value => value === 0),
  'v24 land migrates with an explicit empty sediment checkpoint and no invented historical runoff load');
  assert.equal(rungThirtySixRestore.transportStatus('temperate').receipt,
    null, 'v9 transport evidence is invalidated instead of relabeled as sediment closure');
  const firstMigratedSedimentStep = rungThirtySixRestore.advanceAt(
    25.46855, -140.963, grasslandSample, wetStorm, 157,
    { livingEnabled: true });
  assert.equal(firstMigratedSedimentStep.land.surfaceSediment
    .lastErosionReceipt.status, 'initialized-after-migration-no-export');
  assert.ok(Object.values(firstMigratedSedimentStep.routing
    .runoffSedimentQueue.suspendedKgM2).every(value => value === 0),
  'the migration initialization step owns finite material but exports none');
  const secondMigratedSedimentStep = rungThirtySixRestore.advanceAt(
    25.46855, -140.963, grasslandSample, wetStorm, 158,
    { livingEnabled: true });
  assert.equal(secondMigratedSedimentStep.land.surfaceSediment
    .migrationCheckpoint, false);
  assert.notEqual(secondMigratedSedimentStep.land.surfaceSediment
    .lastErosionReceipt.status, 'initialized-after-migration-no-export',
  'only a genuine post-initialization step can mobilize migrated surface sediment');
  const rungThirtyThreeSave = JSON.parse(JSON.stringify(initialOnlySave));
  rungThirtyThreeSave.schema = 'axm.foundation-planet.earth-system-engine/v23';
  rungThirtyThreeSave.transportReceipts = [{
    profileId: 'temperate',
    receipt: { schema: earthTransport.LEGACY_EARTH_TRANSPORT_STEP_SCHEMA }
  }];
  for (const entry of rungThirtyThreeSave.columns) {
    delete entry.column.land.soilBiogeochemistry;
    delete entry.column.routing.runoffBiogeochemistryQueue;
    delete entry.column.budget.soilBiogeochemistry;
    delete entry.column.truth.persistentSoilWaterBiogeochemistry;
    delete entry.column.truth.persistentRunoffBiogeochemistryQueue;
    delete entry.column.truth.soilRunoffBiogeochemistryClosed;
    delete entry.column.truth.parameterizedLandRunoffChemistryBoundary;
  }
  const rungThirtyThreeRestore = new earthSystem.EarthSystemEngine({
    seed: model.PLANET_DEFAULTS.seed,
    profileId: 'temperate',
    maximumColumns: 4,
    state: rungThirtyThreeSave
  });
  const migratedSoilColumn = rungThirtyThreeRestore
    .columnsForProfile('temperate')[0];
  assert.equal(migratedSoilColumn.land.soilBiogeochemistry
    .migrationCheckpoint, true);
  assert.ok(Object.values(migratedSoilColumn.land.soilBiogeochemistry.pools)
    .every(value => value === 0) &&
    Object.values(migratedSoilColumn.routing.runoffBiogeochemistryQueue.pools)
      .every(value => value === 0),
  'v23 land migrates to explicit empty soil/runoff checkpoints without invented matter');
  assert.equal(rungThirtyThreeRestore.transportStatus('temperate').receipt,
    null, 'v23 transport evidence is invalidated instead of relabeled as current closure');
  const firstMigratedSoilStep = rungThirtyThreeRestore.advanceAt(
    25.46855, -140.963, grasslandSample, wetStorm, 157,
    { livingEnabled: true });
  assert.equal(firstMigratedSoilStep.land.soilBiogeochemistry
    .lastMobilizationReceipt.status,
  'initialized-after-migration-no-export');
  assert.ok(Object.values(firstMigratedSoilStep.routing
    .runoffBiogeochemistryQueue.pools).every(value => value === 0));
  const secondMigratedSoilStep = rungThirtyThreeRestore.advanceAt(
    25.46855, -140.963, grasslandSample, wetStorm, 158,
    { livingEnabled: true });
  assert.equal(secondMigratedSoilStep.land.soilBiogeochemistry
    .migrationCheckpoint, false);
  assert.equal(secondMigratedSoilStep.land.soilBiogeochemistry
    .lastMobilizationReceipt.truth.initializationBoundary, false,
  'only a genuine post-initialization step may export migrated soil chemistry');
  const rungThirtyTwoEngine = new earthSystem.EarthSystemEngine({
    seed: model.PLANET_DEFAULTS.seed,
    profileId: 'temperate',
    maximumColumns: 4
  });
  rungThirtyTwoEngine.advanceAt(25.46855, -140.963, grasslandSample,
    wetStorm, 156, { livingEnabled: true });
  rungThirtyTwoEngine.advanceAt(25.46855, -140.963, grasslandSample,
    wetStorm, 157, { livingEnabled: true });
  const rungThirtyTwoSave = rungThirtyTwoEngine.snapshot();
  assert.ok(rungThirtyTwoSave.columns[0].column.surface
    .lastRadiationReceipt?.schema === earthSystem.EARTH_SURFACE_RADIATION_SCHEMA,
  'current fixture contains genuine v2 native-layer CO2 radiation evidence');
  rungThirtyTwoSave.schema = 'axm.foundation-planet.earth-system-engine/v22';
  for (const entry of rungThirtyTwoSave.columns) {
    const radiation = entry.column.surface.lastRadiationReceipt;
    if (!radiation) continue;
    radiation.schema = surfaceRadiation.PREVIOUS_EARTH_SURFACE_RADIATION_SCHEMA;
    delete radiation.baselineDownwardLongwaveWm2;
    delete radiation.co2LongwaveAdjustmentWm2;
    delete radiation.atmosphereCo2RadiativeCoupling;
    delete radiation.truth.nativeLayerCo2RadiativeCoupling;
    delete radiation.truth.co2SurfaceLongwaveFeedbackApplied;
    delete radiation.truth.broadbandGreyGasCo2Parameterization;
    delete entry.column.truth.nativeLayerCo2RadiativeCoupling;
    delete entry.column.truth.co2SurfaceLongwaveFeedbackApplied;
    delete entry.column.truth.spectralAtmosphericRadiativeTransfer;
  }
  const rungThirtyTwoRestore = new earthSystem.EarthSystemEngine({
    seed: model.PLANET_DEFAULTS.seed,
    profileId: 'temperate',
    maximumColumns: 4,
    state: rungThirtyTwoSave
  });
  const migratedCo2RadiationColumn = rungThirtyTwoRestore
    .columnsForProfile('temperate')[0];
  assert.equal(rungThirtyTwoRestore.snapshot().schema,
    'axm.foundation-planet.earth-system-engine/v31');
  assert.equal(migratedCo2RadiationColumn.surface.lastRadiationReceipt, null,
    'v22 migration invalidates legacy surface radiation instead of fabricating native-layer CO2 evidence');
  assert.equal(migratedCo2RadiationColumn.truth
    .nativeLayerCo2RadiativeCoupling, false);
  const postMigrationCo2Radiation = rungThirtyTwoRestore.advanceAt(
    25.46855, -140.963, grasslandSample, wetStorm, 158,
    { livingEnabled: true });
  assert.equal(postMigrationCo2Radiation.surface.lastRadiationReceipt.schema,
    earthSystem.EARTH_SURFACE_RADIATION_SCHEMA,
  'the first genuine post-migration step earns a current CO2 radiation receipt');
  assert.equal(postMigrationCo2Radiation.truth.nativeLayerCo2RadiativeCoupling,
    true);
  const rungThirtyOneSave = JSON.parse(JSON.stringify(initialOnlySave));
  rungThirtyOneSave.schema = 'axm.foundation-planet.earth-system-engine/v21';
  for (const entry of rungThirtyOneSave.columns) {
    const gas = entry.column.atmosphere.biogeochemistry;
    gas.schema = atmosphereBiogeochemistry
      .PREVIOUS_ATMOSPHERE_BIOGEOCHEMISTRY_STATE_SCHEMA;
    delete gas.layers;
    delete gas.lastVerticalTransportReceipt;
    delete gas.cumulative.verticalCarbonThroughputKgCm2;
    delete gas.cumulative.verticalOxygenThroughputKgO2m2;
    delete gas.cumulative.verticalNitrogenThroughputKgNm2;
    delete gas.truth.nativePressureLayerComposition;
    delete gas.truth.layerCount;
    delete gas.truth.surfaceExchangeLayerIndex;
    delete gas.truth.verticalTransportEnabled;
    delete gas.truth.verticallyTransported;
  }
  const rungThirtyOneRestore = new earthSystem.EarthSystemEngine({
    seed: model.PLANET_DEFAULTS.seed,
    profileId: 'temperate',
    maximumColumns: 4,
    state: rungThirtyOneSave
  });
  const migratedNativeLayerGas = rungThirtyOneRestore
    .columnsForProfile('temperate')[0].atmosphere.biogeochemistry;
  assert.equal(rungThirtyOneRestore.snapshot().schema,
    'axm.foundation-planet.earth-system-engine/v31');
  assert.equal(migratedNativeLayerGas.schema,
    atmosphereBiogeochemistry.ATMOSPHERE_BIOGEOCHEMISTRY_STATE_SCHEMA);
  assert.equal(migratedNativeLayerGas.layers.length, 8,
    'v21 bulk gas state migrates into all eight native pressure levels');
  assert.ok(migratedNativeLayerGas.layers.every((layer, index) =>
    layer.schema === atmosphereBiogeochemistry
      .ATMOSPHERE_BIOGEOCHEMISTRY_LAYER_SCHEMA && layer.index === index));
  assert.equal(migratedNativeLayerGas.lastVerticalTransportReceipt, null,
    'v21 bulk gas migration invents no vertical transport evidence');
  assert.ok(Math.abs(migratedNativeLayerGas.layers.reduce((sum, layer) =>
    sum + layer.carbonDioxideCarbonKgCm2, 0) -
    initialOnlySave.columns[0].column.atmosphere.biogeochemistry
      .carbonDioxideCarbonKgCm2) < 1e-12,
  'v21-to-v23 migration preserves exact atmosphere-owned carbon across all levels');
  const rungThirtySave = JSON.parse(JSON.stringify(initialOnlySave));
  rungThirtySave.schema = 'axm.foundation-planet.earth-system-engine/v20';
  for (const entry of rungThirtySave.columns) {
    entry.column.atmosphere.biogeochemistry.schema =
      atmosphereBiogeochemistry.LEGACY_ATMOSPHERE_BIOGEOCHEMISTRY_STATE_SCHEMA;
    delete entry.column.atmosphere.biogeochemistry
      .lastHorizontalTransportReceipt;
    delete entry.column.atmosphere.biogeochemistry.cumulative
      .horizontalCarbonThroughputKgCm2;
    delete entry.column.atmosphere.biogeochemistry.cumulative
      .horizontalOxygenThroughputKgO2m2;
    delete entry.column.atmosphere.biogeochemistry.cumulative
      .horizontalNitrogenThroughputKgNm2;
    delete entry.column.atmosphere.biogeochemistry.truth
      .horizontalTransportEnabled;
  }
  const rungThirtyRestore = new earthSystem.EarthSystemEngine({
    seed: model.PLANET_DEFAULTS.seed,
    profileId: 'temperate',
    maximumColumns: 4,
    state: rungThirtySave
  });
  const migratedTransportReadyGas = rungThirtyRestore
    .columnsForProfile('temperate')[0].atmosphere.biogeochemistry;
  assert.equal(rungThirtyRestore.snapshot().schema,
    'axm.foundation-planet.earth-system-engine/v31');
  assert.equal(migratedTransportReadyGas.schema,
    atmosphereBiogeochemistry.ATMOSPHERE_BIOGEOCHEMISTRY_STATE_SCHEMA);
  assert.equal(migratedTransportReadyGas.migrationCheckpoint, true);
  assert.equal(migratedTransportReadyGas.lastHorizontalTransportReceipt,
    null, 'v20 gas state gains no fabricated horizontal transport evidence');
  assert.equal(migratedTransportReadyGas.carbonDioxideCarbonKgCm2,
    initialOnlySave.columns[0].column.atmosphere.biogeochemistry
      .carbonDioxideCarbonKgCm2,
  'v20-to-v23 migration preserves exact atmosphere-owned carbon');
  const rungTwentyEightSave = JSON.parse(JSON.stringify({
    ...initialOnlySave,
    schema: 'axm.foundation-planet.earth-system-engine/v19'
  }));
  rungTwentyEightSave.columns.forEach(entry => {
    delete entry.column.atmosphere.biogeochemistry;
    delete entry.column.budget.atmosphereBiogeochemistry;
    delete entry.column.truth.persistentAtmosphereBiogeochemistry;
    delete entry.column.truth.atmosphereBiosphereGasLedgerClosed;
    delete entry.column.truth.ecologyGasFieldsAreCompatibilityMirrors;
    delete entry.column.truth.atmosphericBiogeochemistryHorizontalTransport;
  });
  const rungTwentyEightRestore = new earthSystem.EarthSystemEngine({
    seed: model.PLANET_DEFAULTS.seed,
    profileId: 'temperate',
    maximumColumns: 4,
    state: rungTwentyEightSave
  });
  const migratedAtmosphereGas = rungTwentyEightRestore
    .columnsForProfile('temperate')[0];
  assert.equal(rungTwentyEightRestore.snapshot().schema,
    'axm.foundation-planet.earth-system-engine/v31');
  assert.equal(migratedAtmosphereGas.atmosphere.biogeochemistry.schema,
    atmosphereBiogeochemistry.ATMOSPHERE_BIOGEOCHEMISTRY_STATE_SCHEMA);
  assert.equal(migratedAtmosphereGas.atmosphere.biogeochemistry
    .migrationCheckpoint, true);
  assert.equal(migratedAtmosphereGas.atmosphere.biogeochemistry
    .carbonDioxideCarbonKgCm2,
  migratedAtmosphereGas.land.ecology.carbon.atmosphericExchangeableKgCm2,
  'v19 migration adopts the exact ecology proxy as atmosphere-owned carbon rather than duplicating matter');
  const rungTwentyThreeSave = JSON.parse(JSON.stringify({
    ...initialOnlySave,
    schema: 'axm.foundation-planet.earth-system-engine/v16'
  }));
  rungTwentyThreeSave.columns.forEach(entry => {
    delete entry.column.land.ecology;
    delete entry.column.budget.landEcology;
    delete entry.column.truth.persistentLandEcology;
    delete entry.column.truth.localCarbonBudgetClosed;
    delete entry.column.truth.localNitrogenBudgetClosed;
    delete entry.column.truth.vegetationAlbedoCoupled;
    delete entry.column.truth.physiologicalTranspirationCoupled;
    delete entry.column.truth.globallyMixedAtmosphericCo2;
    entry.column.fluxes.schema = 'axm.foundation-planet.earth-system-flux/v2';
    delete entry.column.fluxes.grossPrimaryProductionKgCm2Day;
    delete entry.column.fluxes.autotrophicRespirationKgCm2Day;
    delete entry.column.fluxes.heterotrophicRespirationKgCm2Day;
    delete entry.column.fluxes.netAtmosphereCarbonExchangeKgCm2Day;
    delete entry.column.fluxes.litterfallKgCm2Day;
    delete entry.column.fluxes.nitrogenUptakeKgNm2Day;
  });
  const rungTwentyThreeRestore = new earthSystem.EarthSystemEngine({
    seed: model.PLANET_DEFAULTS.seed,
    profileId: 'temperate',
    maximumColumns: 4,
    state: rungTwentyThreeSave
  });
  assert.equal(rungTwentyThreeRestore.snapshot().schema,
    'axm.foundation-planet.earth-system-engine/v31',
  'v16 cache migrates into the persistent land-and-ocean-ecology engine envelope');
  assert.ok(rungTwentyThreeRestore.columnsForProfile('temperate').every(column =>
    column.land.ecology.schema === earthSystem.EARTH_LAND_ECOLOGY_SCHEMA &&
    column.land.ecology.migrationCheckpoint === true &&
    column.land.ecology.lastFluxReceipt === null &&
    column.land.ecology.carbon.liveBiomassKgCm2 === 0 &&
    column.land.ecology.carbon.litterKgCm2 === 0 &&
    column.land.ecology.carbon.soilOrganicKgCm2 === 0 &&
    column.land.ecology.nitrogen.totalKgNm2 === 0 &&
    column.budget.landEcology === null &&
    column.fluxes.schema === earthSystem.EARTH_SYSTEM_FLUX_SCHEMA
  ), 'v16 columns gain an explicit empty ecology checkpoint without fabricated biological history');
  const oceanMigrationEngine = new earthSystem.EarthSystemEngine({
    seed: model.PLANET_DEFAULTS.seed,
    profileId: 'temperate',
    maximumColumns: 4
  });
  oceanMigrationEngine.advanceAt(
    -30, -160, oceanSample, oceanWeather, 118,
    { profile: 'temperate', livingEnabled: true, lifeAbundance: 1 });
  const currentOceanSave = oceanMigrationEngine.snapshot();
  const currentOceanRestore = new earthSystem.EarthSystemEngine({
    seed: model.PLANET_DEFAULTS.seed,
    profileId: 'temperate',
    maximumColumns: 4,
    state: currentOceanSave
  });
  assert.deepEqual(currentOceanRestore.snapshot(), currentOceanSave,
    'unstepped v23 ocean ecology survives exact restore without inventing a receipt');
  const rungFiftyThreeOceanSave = JSON.parse(JSON.stringify(
    currentOceanSave));
  rungFiftyThreeOceanSave.schema =
    earthSystem.PREVIOUS_EARTH_SYSTEM_ENGINE_SCHEMA;
  const rungFiftyThreeOceanTotals = rungFiftyThreeOceanSave.columns.map(
    entry => oceanEcology.oceanEcologyElementTotals(
      entry.column.ocean.ecology));
  for (const entry of rungFiftyThreeOceanSave.columns) {
    entry.column.ocean.ecology.schema =
      oceanEcology.PREVIOUS_EARTH_OCEAN_ECOLOGY_SCHEMA;
    entry.column.ocean.ecology.lastFluxReceipt = {
      schema: oceanEcology.PREVIOUS_EARTH_OCEAN_ECOLOGY_FLUX_SCHEMA,
      reason: 'pre-r54-empirical-air-sea-carbon-receipt'
    };
    delete entry.column.truth.carbonateInformedAirSeaCo2Exchange;
    delete entry.column.truth.airSeaCo2FugacityCorrection;
    delete entry.column.truth.airSeaCarbonExchangeTypedRefusal;
    delete entry.column.truth.airSeaCarbonOwnerMoveMatchedProposal;
  }
  const rungFiftyThreeOceanRestore = new earthSystem.EarthSystemEngine({
    seed: model.PLANET_DEFAULTS.seed,
    profileId: 'temperate',
    maximumColumns: 4,
    state: rungFiftyThreeOceanSave
  });
  const rungFiftyThreeMigratedColumns = rungFiftyThreeOceanRestore
    .columnsForProfile('temperate');
  assert.ok(rungFiftyThreeMigratedColumns.every((column, index) =>
    JSON.stringify(oceanEcology.oceanEcologyElementTotals(
      column.ocean.ecology)) === JSON.stringify(rungFiftyThreeOceanTotals[index]) &&
    column.ocean.ecology.lastFluxReceipt === null &&
    column.truth.carbonateInformedAirSeaCo2Exchange === false &&
    column.truth.airSeaCo2FugacityCorrection === false),
  'R53 engine migration preserves all ocean material and invents no R54 exchange evidence');
  assert.equal(rungFiftyThreeOceanRestore.snapshot().schema,
    earthSystem.EARTH_SYSTEM_ENGINE_SCHEMA);
  const rungFiftyOneOceanSave = JSON.parse(JSON.stringify(currentOceanSave));
  rungFiftyOneOceanSave.schema =
    'axm.foundation-planet.earth-system-engine/v26';
  const rungFiftyOneOceanBefore = deepOcean.deepOceanElementTotals(
    rungFiftyOneOceanSave.columns[0].column.ocean.ecology.deepOcean);
  const rungFiftyOneMixedAlkalinity = rungFiftyOneOceanSave.columns[0]
    .column.ocean.ecology.alkalinity.dissolvedKgCaCO3Eqm2;
  for (const entry of rungFiftyOneOceanSave.columns) {
    entry.column.ocean.ecology.schema =
      oceanEcology.PREVIOUS_EARTH_OCEAN_ECOLOGY_SCHEMA;
    entry.column.ocean.ecology.deepOcean.schema =
      deepOcean.PREVIOUS_DEEP_OCEAN_STATE_SCHEMA;
    delete entry.column.ocean.ecology.deepOcean.alkalinity;
    delete entry.column.truth.localOceanAlkalinityBudgetClosed;
    delete entry.column.truth.persistentDeepOceanAlkalinity;
    delete entry.column.truth.mixedToDeepAlkalinityClosure;
  }
  const rungFiftyOneOceanRestore = new earthSystem.EarthSystemEngine({
    seed: model.PLANET_DEFAULTS.seed,
    profileId: 'temperate',
    maximumColumns: 4,
    state: rungFiftyOneOceanSave
  });
  const rungFiftyOneMigratedColumn = rungFiftyOneOceanRestore
    .columnsForProfile('temperate')[0];
  const rungFiftyOneOceanAfter = deepOcean.deepOceanElementTotals(
    rungFiftyOneMigratedColumn.ocean.ecology.deepOcean);
  assert.equal(rungFiftyOneOceanRestore.snapshot().schema,
    earthSystem.EARTH_SYSTEM_ENGINE_SCHEMA);
  assert.equal(rungFiftyOneMigratedColumn.ocean.ecology.alkalinity
    .dissolvedKgCaCO3Eqm2, rungFiftyOneMixedAlkalinity,
  'R51 migration preserves its already-owned mixed-layer alkalinity');
  assert.ok(rungFiftyOneMigratedColumn.ocean.ecology.deepOcean
      .alkalinity.dissolvedKgCaCO3Eqm2 === 0 &&
    rungFiftyOneMigratedColumn.ocean.ecology.deepOcean
      .migrationCheckpoint === true &&
    ['carbonKgCm2', 'nitrogenKgNm2', 'phosphorusKgPm2', 'oxygenKgO2m2']
      .every(key => rungFiftyOneOceanAfter[key] ===
        rungFiftyOneOceanBefore[key]),
  'R51 engine migration adds zero deep alkalinity while preserving prior deep material exactly');
  const rungThirtySixOceanSave = JSON.parse(JSON.stringify(currentOceanSave));
  rungThirtySixOceanSave.schema = earthSystem.PREVIOUS_EARTH_SYSTEM_ENGINE_SCHEMA;
  for (const entry of rungThirtySixOceanSave.columns) {
    delete entry.column.ocean.coastalSediment;
    delete entry.column.truth.persistentCoastalSediment;
  }
  const rungThirtySixOceanRestore = new earthSystem.EarthSystemEngine({
    seed: model.PLANET_DEFAULTS.seed,
    profileId: 'temperate',
    maximumColumns: 4,
    state: rungThirtySixOceanSave
  });
  const migratedCoastalSediment = rungThirtySixOceanRestore
    .columnsForProfile('temperate')[0].ocean.coastalSediment;
  assert.equal(migratedCoastalSediment.schema,
    geomorphicSediment.COASTAL_SEDIMENT_STATE_SCHEMA);
  assert.equal(geomorphicSediment.sedimentGrainTotal(
    migratedCoastalSediment.suspendedKgM2) +
    geomorphicSediment.sedimentGrainTotal(
      migratedCoastalSediment.depositedKgM2), 0,
  'v24 ocean columns migrate with an explicit empty coastal sediment reservoir');
  const rungTwentyFiveOceanSave = JSON.parse(JSON.stringify({
    ...currentOceanSave,
    schema: 'axm.foundation-planet.earth-system-engine/v18'
  }));
  rungTwentyFiveOceanSave.columns.forEach(entry => {
    entry.column.ocean.ecology.schema =
      'axm.foundation-planet.ocean-ecology-state/v1';
    delete entry.column.ocean.ecology.deepOcean;
  });
  const rungTwentyFiveOceanRestore = new earthSystem.EarthSystemEngine({
    seed: model.PLANET_DEFAULTS.seed,
    profileId: 'temperate',
    maximumColumns: 4,
    state: rungTwentyFiveOceanSave
  });
  const migratedDeepCheckpoint = rungTwentyFiveOceanRestore
    .columnsForProfile('temperate')[0].ocean.ecology;
  assert.equal(rungTwentyFiveOceanRestore.snapshot().schema,
    'axm.foundation-planet.earth-system-engine/v31');
  assert.equal(migratedDeepCheckpoint.schema,
    oceanEcology.EARTH_OCEAN_ECOLOGY_SCHEMA);
  assert.equal(migratedDeepCheckpoint.deepOcean.schema,
    deepOcean.DEEP_OCEAN_STATE_SCHEMA);
  assert.equal(migratedDeepCheckpoint.deepOcean.migrationCheckpoint, true);
  assert.ok(Object.values(deepOcean.deepOceanElementTotals(
    migratedDeepCheckpoint.deepOcean)).every(value => value === 0),
  'v18 mixed-layer snapshots migrate with an explicit empty deep ocean rather than invented interior matter');
  const rungTwentyFourOceanSave = JSON.parse(JSON.stringify({
    ...currentOceanSave,
    schema: 'axm.foundation-planet.earth-system-engine/v17'
  }));
  rungTwentyFourOceanSave.columns.forEach(entry => {
    delete entry.column.ocean.ecology;
    delete entry.column.budget.oceanEcology;
    delete entry.column.truth.persistentOceanEcology;
    delete entry.column.truth.localOceanCarbonBudgetClosed;
    delete entry.column.truth.localOceanNitrogenBudgetClosed;
    delete entry.column.truth.localOceanPhosphorusBudgetClosed;
    delete entry.column.truth.localOceanOxygenFluxClosed;
    delete entry.column.truth.physicalOceanChemistryWithLifeOff;
    delete entry.column.truth.loadedOceanBiogeochemicalTransport;
    entry.column.fluxes.schema = 'axm.foundation-planet.earth-system-flux/v3';
    delete entry.column.fluxes.marineGrossPrimaryProductionKgCm2Day;
    delete entry.column.fluxes.marineCommunityRespirationKgCm2Day;
    delete entry.column.fluxes.airSeaCo2FluxToOceanKgCm2Day;
    delete entry.column.fluxes.marinePhotosyntheticOxygenKgO2m2Day;
    delete entry.column.fluxes.marineRespirationOxygenKgO2m2Day;
    delete entry.column.fluxes.marineNitrogenUptakeKgNm2Day;
    delete entry.column.fluxes.marinePhosphorusUptakeKgPm2Day;
  });
  const rungTwentyFourOceanRestore = new earthSystem.EarthSystemEngine({
    seed: model.PLANET_DEFAULTS.seed,
    profileId: 'temperate',
    maximumColumns: 4,
    state: rungTwentyFourOceanSave
  });
  const migratedOceanCheckpoint = rungTwentyFourOceanRestore
    .columnsForProfile('temperate')[0];
  assert.equal(rungTwentyFourOceanRestore.snapshot().schema,
    'axm.foundation-planet.earth-system-engine/v31');
  assert.equal(migratedOceanCheckpoint.ocean.ecology.schema,
    earthSystem.EARTH_OCEAN_ECOLOGY_SCHEMA);
  assert.equal(migratedOceanCheckpoint.ocean.ecology.migrationCheckpoint, true);
  assert.equal(migratedOceanCheckpoint.ocean.ecology.lastFluxReceipt, null);
  assert.equal(migratedOceanCheckpoint.ocean.ecology.carbon.dissolvedInorganicKgCm2, 0);
  assert.equal(migratedOceanCheckpoint.ocean.ecology.carbon.dissolvedOrganicKgCm2, 0);
  assert.equal(migratedOceanCheckpoint.ocean.ecology.carbon.phytoplanktonKgCm2, 0);
  assert.equal(migratedOceanCheckpoint.ocean.ecology.carbon.zooplanktonKgCm2, 0);
  assert.equal(migratedOceanCheckpoint.ocean.ecology.carbon.detritusKgCm2, 0);
  assert.equal(migratedOceanCheckpoint.ocean.ecology.nitrogen.totalKgNm2, 0);
  assert.equal(migratedOceanCheckpoint.ocean.ecology.phosphorus.totalKgPm2, 0);
  assert.equal(migratedOceanCheckpoint.ocean.ecology.oxygen.dissolvedKgO2m2, 0);
  assert.equal(migratedOceanCheckpoint.budget.oceanEcology, null);
  assert.equal(migratedOceanCheckpoint.fluxes.schema,
    earthSystem.EARTH_SYSTEM_FLUX_SCHEMA);
  const activatedMigratedOcean = rungTwentyFourOceanRestore.advanceAt(
    -30, -160, oceanSample, oceanWeather, 119,
    { profile: 'temperate', livingEnabled: true, lifeAbundance: 1 });
  assert.equal(activatedMigratedOcean.ocean.ecology.migrationCheckpoint, false);
  assert.equal(activatedMigratedOcean.ocean.ecology.lastFluxReceipt.schema,
    earthSystem.EARTH_OCEAN_ECOLOGY_FLUX_SCHEMA);
  assert.ok(activatedMigratedOcean.ocean.ecology.carbon.totalKgCm2 > 0 &&
    activatedMigratedOcean.ocean.ecology.nitrogen.totalKgNm2 > 0 &&
    activatedMigratedOcean.ocean.ecology.phosphorus.totalKgPm2 > 0 &&
    activatedMigratedOcean.ocean.ecology.oxygen.totalKgO2m2 > 0,
  'the first post-v17 ocean step initializes live pools explicitly and advances them once');
  const rungTwentyTwoSave = JSON.parse(JSON.stringify({
    ...initialOnlySave,
    schema: 'axm.foundation-planet.earth-system-engine/v15'
  }));
  rungTwentyTwoSave.columns.forEach(entry => {
    delete entry.column.surface.lastRadiationReceipt;
    delete entry.column.cryosphere.snowAgeDays;
    delete entry.column.cryosphere.lastPhaseChangeReceipt;
    delete entry.column.land.ecology;
    delete entry.column.budget.landEcology;
    delete entry.column.truth.nativeMixedPhaseCloudRadiation;
    delete entry.column.truth.dynamicCryosphereAlbedo;
    delete entry.column.truth.cryosphereFusionEnergyReceipted;
    delete entry.column.truth.snowAgePersisted;
    delete entry.column.truth.snowOnSeaIcePersisted;
    delete entry.column.truth.persistentLandEcology;
    delete entry.column.truth.localCarbonBudgetClosed;
    delete entry.column.truth.localNitrogenBudgetClosed;
    delete entry.column.truth.vegetationAlbedoCoupled;
    delete entry.column.truth.physiologicalTranspirationCoupled;
    delete entry.column.truth.globallyMixedAtmosphericCo2;
    entry.column.fluxes.schema = 'axm.foundation-planet.earth-system-flux/v1';
  });
  const rungTwentyTwoRestore = new earthSystem.EarthSystemEngine({
    seed: model.PLANET_DEFAULTS.seed,
    profileId: 'temperate',
    maximumColumns: 4,
    state: rungTwentyTwoSave
  });
  assert.equal(rungTwentyTwoRestore.snapshot().schema,
    'axm.foundation-planet.earth-system-engine/v31',
  'v15 cache migrates into the radiative cryosphere engine envelope');
  assert.ok(rungTwentyTwoRestore.columnsForProfile('temperate').every(column =>
    column.surface.lastRadiationReceipt === null &&
    column.cryosphere.lastPhaseChangeReceipt === null &&
    column.cryosphere.snowAgeDays === 0 &&
    column.truth.nativeMixedPhaseCloudRadiation === false &&
    column.truth.cryosphereFusionEnergyReceipted === false &&
    column.fluxes.schema === earthSystem.EARTH_SYSTEM_FLUX_SCHEMA
  ), 'v15 columns gain bounded frozen-surface fields without fabricated radiation or fusion history');
  const rungTwentyOneSave = JSON.parse(JSON.stringify({
    ...initialOnlySave,
    schema: 'axm.foundation-planet.earth-system-engine/v14'
  }));
  rungTwentyOneSave.columns.forEach(entry => {
    delete entry.column.atmosphere.cloudIceMm;
    delete entry.column.atmosphere.freeTroposphere.cloudIceMm;
    entry.column.atmosphere.pressureColumn.schema =
      'axm.foundation-planet.atmosphere-pressure-column/v1';
    entry.column.atmosphere.pressureColumn.layers.forEach(layer => {
      delete layer.cloudIceMm;
      layer.schema = 'axm.foundation-planet.atmosphere-pressure-layer/v1';
    });
    entry.column.atmosphere.lastPressureColumnSyncReceipt.schema =
      'axm.foundation-planet.atmosphere-pressure-column-sync-receipt/v1';
    delete entry.column.truth.cloudIceWaterReservoir;
    delete entry.column.truth.nativeMixedPhaseClouds;
    delete entry.column.truth.typedRainSnowDescent;
  });
  const rungTwentyOneRestore = new earthSystem.EarthSystemEngine({
    seed: model.PLANET_DEFAULTS.seed,
    profileId: 'temperate',
    maximumColumns: 4,
    state: rungTwentyOneSave
  });
  assert.equal(rungTwentyOneRestore.snapshot().schema,
    'axm.foundation-planet.earth-system-engine/v31',
  'v14 cache migrates into the native mixed-phase engine envelope');
  assert.ok(rungTwentyOneRestore.columnsForProfile('temperate').every(column =>
    column.atmosphere.cloudIceMm === 0 &&
    column.atmosphere.freeTroposphere.cloudIceMm === 0 &&
    column.atmosphere.pressureColumn.layers.every(layer => layer.cloudIceMm === 0) &&
    pressureColumn.validatePressureColumn(column.atmosphere.pressureColumn) &&
    column.truth.cloudIceWaterReservoir === true &&
    column.truth.typedRainSnowDescent === false
  ), 'v14 liquid-only columns gain explicit zero-valued ice reservoirs without invented mixed-phase dynamics evidence');
  const engineSecond = earthEngineA.advanceAt(25.46855, -140.963, grasslandSample, wetStorm, 157, { livingEnabled: true });
  assert.equal(engineFirst.stepCount, 0, 'new sparse Earth cell begins at its observed planet day without fake catch-up');
  assert.equal(engineSecond.stepCount, 1, 'revisited sparse Earth cell advances state by bounded daily steps');
  assert.equal(earthEngineA.advanceAt(25.46855, -140.963, grasslandSample, wetStorm, 156.9999995).stepCount, 1, 'sub-second checkpoint serialization skew does not prevent restore');
  assert.throws(() => earthEngineA.advanceAt(25.46855, -140.963, grasslandSample, wetStorm, 156.5), /cannot run backward/, 'Earth-system engine refuses clock reversal');
  const earthSave = earthEngineA.snapshot();
  const earthEngineB = new earthSystem.EarthSystemEngine({ seed: model.PLANET_DEFAULTS.seed, profileId: 'temperate', maximumColumns: 4, state: earthSave });
  assert.deepEqual(earthEngineB.snapshot(), earthSave, 'sparse reservoir state survives save and restore exactly');
  const rungTwentySave = JSON.parse(JSON.stringify({
    ...earthSave,
    schema: 'axm.foundation-planet.earth-system-engine/v13'
  }));
  rungTwentySave.columns.forEach(entry => {
    entry.column.atmosphere.convectiveKineticEnergyJm2 = 123456;
    delete entry.column.atmosphere.pressureColumn.verticalInterfaces;
    entry.column.atmosphere.lastPressureColumnDynamicsReceipt.schema =
      'axm.foundation-planet.atmosphere-pressure-column-dynamics-receipt/v1';
    entry.column.atmosphere.lastVerticalExchangeReceipt.schema =
      'axm.foundation-planet.atmosphere-vertical-exchange-receipt/v2';
    delete entry.column.truth.nativePressureInterfaceBuoyancyReceipted;
    delete entry.column.truth.nativePressureInterfaceVerticalMomentum;
    delete entry.column.truth.nativePressureInterfaceConvectiveKineticEnergy;
    delete entry.column.truth.nativePressureInterfaceEntrainmentDetrainment;
  });
  const rungTwentyEarthEngine = new earthSystem.EarthSystemEngine({
    seed: model.PLANET_DEFAULTS.seed,
    profileId: 'temperate',
    maximumColumns: 4,
    state: rungTwentySave
  });
  assert.ok(rungTwentyEarthEngine.columnsForProfile('temperate').every(column =>
    pressureColumn.validatePressureColumn(column.atmosphere.pressureColumn) &&
    column.atmosphere.pressureColumn.verticalInterfaces.length === 7 &&
    Math.abs(column.atmosphere.pressureColumn.verticalInterfaces[1]
      .convectiveKineticEnergyJm2 - 123456) < 1e-6 &&
    Math.abs(column.atmosphere.pressureColumn.totals
      .convectiveKineticEnergyJm2 - 123456) < 1e-6 &&
    column.atmosphere.lastPressureColumnDynamicsReceipt === null &&
    column.atmosphere.lastVerticalExchangeReceipt === null &&
    column.truth.pressureLevelDynamicsResolved === false),
  'R20 v13 columns migrate the legacy convection reservoir onto its exact boundary/free interface without inventing native receipts');
  const rungEighteenSave = JSON.parse(JSON.stringify({
    ...earthSave,
    schema: 'axm.foundation-planet.earth-system-engine/v11'
  }));
  rungEighteenSave.columns.forEach(entry => {
    delete entry.column.atmosphere.lastPressureColumnDynamicsReceipt;
    delete entry.column.budget.atmosphereEnergy.nativeMomentumMixingConversionJm2;
    delete entry.column.truth.nativePressureLevelThermodynamics;
    delete entry.column.truth.nativePressureLevelPhaseChangeReceipted;
    delete entry.column.truth.nativePrecipitationDescentReceipted;
    delete entry.column.truth.nativeAdjacentLevelExchangeReceipted;
    delete entry.column.truth.nativePressureLevelWaterClosed;
    delete entry.column.truth.nativePressureLevelMoistEnthalpyClosed;
    delete entry.column.truth.nativePressureLevelMomentumClosed;
    delete entry.column.truth.nativePressureLevelResolvedEnergyClosed;
    delete entry.column.truth.nativePressureLevelHorizontalTransport;
  });
  const rungEighteenEarthEngine = new earthSystem.EarthSystemEngine({
    seed: model.PLANET_DEFAULTS.seed,
    profileId: 'temperate',
    maximumColumns: 4,
    state: rungEighteenSave
  });
  assert.ok(rungEighteenEarthEngine.columnsForProfile('temperate').every(column =>
    pressureColumn.validatePressureColumn(column.atmosphere.pressureColumn) &&
    column.atmosphere.lastPressureColumnDynamicsReceipt === null &&
    column.budget.atmosphereEnergy.nativeMomentumMixingConversionJm2 === 0 &&
    column.truth.nativePressureLevelThermodynamics === true &&
    column.truth.nativePressureLevelPhaseChangeReceipted === false &&
    column.truth.nativePressureLevelHorizontalTransport === false),
  'R18 v11 pressure columns migrate safely without inventing native phase, descent or exchange evidence');
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
  const rungFifteenSave = JSON.parse(JSON.stringify({
    ...earthSave,
    schema: 'axm.foundation-planet.earth-system-engine/v8'
  }));
  const rungFifteenWater = new Map();
  rungFifteenSave.columns.forEach(entry => {
    const atmosphere = entry.column.atmosphere;
    rungFifteenWater.set(entry.column.id, earthSystem.atmosphereWaterStorageMm(entry.column));
    atmosphere.freeTroposphere.schema = 'axm.foundation-planet.free-troposphere/v1';
    delete atmosphere.freeTroposphere.windSpeedMps;
    delete atmosphere.freeTroposphere.windDirectionDeg;
    delete atmosphere.freeTroposphere.eastwardWindMps;
    delete atmosphere.freeTroposphere.northwardWindMps;
  });
  const rungFifteenEarthEngine = new earthSystem.EarthSystemEngine({
    seed: model.PLANET_DEFAULTS.seed,
    profileId: 'temperate',
    maximumColumns: 4,
    state: rungFifteenSave
  });
  assert.ok(rungFifteenEarthEngine.columnsForProfile('temperate').every(column =>
    column.atmosphere.freeTroposphere.schema === earthSystem.EARTH_FREE_TROPOSPHERE_SCHEMA &&
    column.atmosphere.freeTroposphere.eastwardWindMps === column.atmosphere.eastwardWindMps &&
    column.atmosphere.freeTroposphere.northwardWindMps === column.atmosphere.northwardWindMps &&
    Math.abs(earthSystem.atmosphereWaterStorageMm(column) - rungFifteenWater.get(column.id)) < 1e-8
  ), 'Rung 15 v8 columns migrate to independent upper momentum without changing water or inventing wind shear');
  const rungSixteenSave = JSON.parse(JSON.stringify({
    ...earthSave,
    schema: 'axm.foundation-planet.earth-system-engine/v9'
  }));
  const rungSixteenWater = new Map();
  rungSixteenSave.columns.forEach(entry => {
    rungSixteenWater.set(entry.column.id, earthSystem.atmosphereWaterStorageMm(entry.column));
    delete entry.column.atmosphere.pressureColumn;
    delete entry.column.atmosphere.lastPressureColumnSyncReceipt;
    delete entry.column.atmosphere.convectiveKineticEnergyJm2;
    delete entry.column.atmosphere.verticalVelocityProxyMps;
    if (entry.column.atmosphere.lastVerticalExchangeReceipt) {
      entry.column.atmosphere.lastVerticalExchangeReceipt.schema =
        'axm.foundation-planet.atmosphere-vertical-exchange-receipt/v1';
    }
    delete entry.column.budget.atmosphereEnergy.verticalMechanicalConversionJm2;
  });
  const rungSixteenEarthEngine = new earthSystem.EarthSystemEngine({
    seed: model.PLANET_DEFAULTS.seed,
    profileId: 'temperate',
    maximumColumns: 4,
    state: rungSixteenSave
  });
  assert.ok(rungSixteenEarthEngine.columnsForProfile('temperate').every(column =>
    column.atmosphere.convectiveKineticEnergyJm2 === 0 &&
    column.atmosphere.verticalVelocityProxyMps === 0 &&
    column.atmosphere.lastVerticalExchangeReceipt === null &&
    column.budget.atmosphereEnergy.verticalMechanicalConversionJm2 === 0 &&
    Math.abs(earthSystem.atmosphereWaterStorageMm(column) - rungSixteenWater.get(column.id)) < 1e-8
  ), 'Rung 16 v9 columns migrate with an empty convective-energy reservoir, preserve water and invalidate the mis-versioned v1 vertical receipt');

  const rungSeventeenSave = JSON.parse(JSON.stringify({
    ...earthSave,
    schema: 'axm.foundation-planet.earth-system-engine/v10'
  }));
  const rungSeventeenState = new Map();
  rungSeventeenSave.columns.forEach(entry => {
    rungSeventeenState.set(entry.column.id, {
      waterMm: earthSystem.atmosphereWaterStorageMm(entry.column),
      moistEnthalpyJm2: earthSystem.atmosphereMoistEnthalpyJm2(entry.column),
      surfacePressureHpa: entry.column.atmosphere.surfacePressureHpa,
      eastwardMomentumKgMpsM2:
        earthSystem.atmosphereLayerDryAirMassesKgM2(entry.column).boundaryLayerKgM2 *
          entry.column.atmosphere.eastwardWindMps +
        earthSystem.atmosphereLayerDryAirMassesKgM2(entry.column).freeTroposphereKgM2 *
          entry.column.atmosphere.freeTroposphere.eastwardWindMps
    });
    delete entry.column.atmosphere.pressureColumn;
    delete entry.column.atmosphere.lastPressureColumnSyncReceipt;
    delete entry.column.truth.pressureCoordinateColumnPersisted;
    delete entry.column.truth.pressureColumnConservativeProjection;
    delete entry.column.truth.pressureColumnHydrostaticInterfaces;
    delete entry.column.truth.pressureLevelDynamicsResolved;
  });
  const rungSeventeenEarthEngine = new earthSystem.EarthSystemEngine({
    seed: model.PLANET_DEFAULTS.seed,
    profileId: 'temperate',
    maximumColumns: 4,
    state: rungSeventeenSave
  });
  assert.ok(rungSeventeenEarthEngine.columnsForProfile('temperate').every(column => {
    const prior = rungSeventeenState.get(column.id);
    const masses = earthSystem.atmosphereLayerDryAirMassesKgM2(column);
    const eastwardMomentumKgMpsM2 = masses.boundaryLayerKgM2 *
      column.atmosphere.eastwardWindMps + masses.freeTroposphereKgM2 *
      column.atmosphere.freeTroposphere.eastwardWindMps;
    return column.atmosphere.pressureColumn.schema ===
        pressureColumn.ATMOSPHERE_PRESSURE_COLUMN_SCHEMA &&
      column.atmosphere.pressureColumn.layers.length === 8 &&
      column.atmosphere.lastPressureColumnSyncReceipt.reason ===
        'legacy-v10-pressure-column-migration' &&
      pressureColumn.validatePressureColumn(column.atmosphere.pressureColumn) &&
      Math.abs(earthSystem.atmosphereWaterStorageMm(column) - prior.waterMm) < 1e-8 &&
      Math.abs(earthSystem.atmosphereMoistEnthalpyJm2(column) - prior.moistEnthalpyJm2) < 1e-3 &&
      Math.abs(column.atmosphere.surfacePressureHpa - prior.surfacePressureHpa) < 1e-9 &&
      Math.abs(eastwardMomentumKgMpsM2 - prior.eastwardMomentumKgMpsM2) < 1e-5;
  }), 'Rung 17 v10 columns migrate into eight pressure levels without changing water, moist enthalpy, pressure or eastward momentum');

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
  transportLandColumns[0].atmosphere.cloudIceMm = 1.5;
  transportLandColumns[0].atmosphere.airTemperatureC = 28;
  setAtmospherePressure(transportLandColumns[0], 1040);
  transportLandColumns[0].atmosphere.windSpeedMps = 0;
  transportLandColumns[0].atmosphere.eastwardWindMps = 0;
  transportLandColumns[0].atmosphere.northwardWindMps = 0;
  transportLandColumns[0].atmosphere.boundaryLayerPressureHpa = 300;
  transportLandColumns[0].atmosphere.freeTroposphere.pressureThicknessHpa = 740;
  transportLandColumns[0].atmosphere.freeTroposphere.precipitableWaterMm = 12;
  transportLandColumns[0].atmosphere.freeTroposphere.cloudWaterMm = 4;
  transportLandColumns[0].atmosphere.freeTroposphere.cloudIceMm = 2;
  transportLandColumns[0].atmosphere.freeTroposphere.airTemperatureC = -10;
  transportLandColumns[0].atmosphere.freeTroposphere.windSpeedMps = 0;
  transportLandColumns[0].atmosphere.freeTroposphere.eastwardWindMps = 0;
  transportLandColumns[0].atmosphere.freeTroposphere.northwardWindMps = 0;
  transportLandColumns[1].land.groundwaterStorageMm = transportLandColumns[1].substrate.aquiferCapacityMm * .1;
  transportLandColumns[1].land.waterTableDepthM = transportLandColumns[1].substrate.aquiferDepthM * .9;
  transportLandColumns[1].surface.elevationM = 900;
  transportLandColumns[1].atmosphere.precipitableWaterMm = 5;
  transportLandColumns[1].atmosphere.cloudWaterMm = 0;
  transportLandColumns[1].atmosphere.cloudIceMm = 0;
  transportLandColumns[1].atmosphere.airTemperatureC = 2;
  setAtmospherePressure(transportLandColumns[1], 980);
  transportLandColumns[1].atmosphere.windSpeedMps = 0;
  transportLandColumns[1].atmosphere.eastwardWindMps = 0;
  transportLandColumns[1].atmosphere.northwardWindMps = 0;
  transportLandColumns[1].atmosphere.boundaryLayerPressureHpa = 200;
  transportLandColumns[1].atmosphere.freeTroposphere.pressureThicknessHpa = 780;
  transportLandColumns[1].atmosphere.freeTroposphere.precipitableWaterMm = 1;
  transportLandColumns[1].atmosphere.freeTroposphere.cloudWaterMm = 0;
  transportLandColumns[1].atmosphere.freeTroposphere.cloudIceMm = 0;
  transportLandColumns[1].atmosphere.freeTroposphere.airTemperatureC = -35;
  transportLandColumns[1].atmosphere.freeTroposphere.windSpeedMps = 0;
  transportLandColumns[1].atmosphere.freeTroposphere.eastwardWindMps = 0;
  transportLandColumns[1].atmosphere.freeTroposphere.northwardWindMps = 0;
  transportLandColumns[0].routing.runoffQueueMm = 10;
  transportLandColumns[0].routing.cumulativeGeneratedRunoffMm = 10;
  const transportLandRunoffChemistry = soilBiogeochemistry
    .mobilizeSoilBiogeochemistry(
      transportLandColumns[0].land.soilBiogeochemistry,
      transportLandColumns[0].routing.runoffBiogeochemistryQueue,
      10,
      {
        accessibleWaterMm: transportLandColumns[0].land.rootZoneWaterMm +
          transportLandColumns[0].land.deepSoilWaterMm +
          transportLandColumns[0].land.groundwaterStorageMm
      }
    );
  transportLandColumns[0].land.soilBiogeochemistry =
    transportLandRunoffChemistry.state;
  transportLandColumns[0].routing.runoffBiogeochemistryQueue =
    transportLandRunoffChemistry.queue;
  transportLandColumns.forEach(seedNativePressureColumnFromCompatibilityBands);
  const seedNativeGasProfile = (column, totals, concentrationShape) => {
    const pressureTotal = column.atmosphere.pressureColumn.layers.reduce(
      (sum, layer) => sum + layer.pressureThicknessHpa, 0);
    const weights = column.atmosphere.pressureColumn.layers.map((layer, index) =>
      layer.pressureThicknessHpa / pressureTotal * concentrationShape[index]);
    const weightTotal = weights.reduce((sum, value) => sum + value, 0);
    const layers = weights.map(weight => ({
      carbonDioxideCarbonKgCm2: totals.carbonDioxideCarbonKgCm2 *
        weight / weightTotal,
      oxygenKgO2m2: totals.oxygenKgO2m2 * weight / weightTotal,
      nitrogenGasKgNm2: totals.nitrogenGasKgNm2 * weight / weightTotal
    }));
    column.atmosphere.biogeochemistry =
      atmosphereBiogeochemistry.synchronizeAtmosphereCompatibilityMirrors(
        atmosphereBiogeochemistry.createAtmosphereBiogeochemistry({
          ...totals,
          layers,
          pressureColumn: column.atmosphere.pressureColumn
        }),
        column.land.ecology,
        null,
        { pressureColumn: column.atmosphere.pressureColumn }
      );
  };
  seedNativeGasProfile(transportLandColumns[0], {
    carbonDioxideCarbonKgCm2: 4.5,
    oxygenKgO2m2: 2500,
    nitrogenGasKgNm2: 8000
  }, [2.2, 1.8, 1.45, 1.15, .9, .65, .42, .25]);
  seedNativeGasProfile(transportLandColumns[1], {
    carbonDioxideCarbonKgCm2: 2.5,
    oxygenKgO2m2: 2100,
    nitrogenGasKgNm2: 7400
  }, [.35, .5, .7, .9, 1.1, 1.35, 1.65, 2]);
  const initialTransportGasById = new Map(transportLandColumns.map(column =>
    [column.id, JSON.parse(JSON.stringify(
      column.atmosphere.biogeochemistry))]));
  transportLandColumns.forEach((column, columnIndex) => {
    column.atmosphere.pressureColumn.verticalInterfaces[1]
      .convectiveKineticEnergyJm2 = 80000 + columnIndex * 20000;
    column.atmosphere.pressureColumn = pressureColumn.normalizePressureColumn(
      column.atmosphere.pressureColumn,
      column.surface.elevationM
    );
    column.atmosphere.convectiveKineticEnergyJm2 =
      column.atmosphere.pressureColumn.totals.convectiveKineticEnergyJm2;
  });
  const initialTransportConvectiveEnergyJm2 = transportLandColumns.reduce((sum, column) =>
    sum + column.atmosphere.pressureColumn.totals.convectiveKineticEnergyJm2, 0);
  const transportedLand = earthTransport.transportEarthSystemColumns(transportLandColumns, .25);
  const transportedLandReverse = earthTransport.transportEarthSystemColumns([...transportLandColumns].reverse(), .25);
  assert.equal(transportedLand.receipt.activeEdgeCount, 1, 'two adjacent canonical land cells form one transport edge');
  assert.equal(transportedLand.receipt.boundaryReceipts.length, 6, 'sparse two-cell domain exposes every unloaded cardinal boundary');
  assert.equal(transportedLand.receipt.digest, transportedLandReverse.receipt.digest, 'transport receipt is invariant to caller cell ordering');
  assert.deepEqual(transportedLand.columns, transportedLandReverse.columns, 'simultaneous transport result is invariant to caller cell ordering');
  const transportedGas = transportedLand.receipt
    .atmosphereBiogeochemistryTransportReceipt;
  assert.equal(transportedGas.schema,
    atmosphereBiogeochemistryTransport.ATMOSPHERE_BIOGEOCHEMISTRY_TRANSPORT_SCHEMA);
  assert.equal(transportedGas.routeCount,
    transportedLand.receipt.atmosphereMassReceipts.length,
  'each native dry-air mass route carries C/O2/N2 from its own pressure level');
  assert.ok(transportedGas.routes.every(route =>
    route.schema === atmosphereBiogeochemistryTransport
      .ATMOSPHERE_BIOGEOCHEMISTRY_ROUTE_SCHEMA &&
    route.gases.carbonKgC > 0 && route.gases.oxygenKgO2 > 0 &&
    route.gases.nitrogenKgN > 0 && route.simultaneous === true &&
    route.truth.senderNativeLayerComposition === true &&
    route.truth.wholeColumnAverageUsed === false),
  'every gas route exposes typed positive native-layer material without a whole-column shortcut');
  assert.equal(transportedGas.layerSummaries.length, 8);
  assert.deepEqual(transportedGas.layerSummaries.map(layer => layer.layerIndex),
    [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.ok(transportedGas.layerSummaries.every(layer =>
    layer.routeCount > 0 && Object.values(layer.conservation).every(value =>
      Math.abs(value) < 1)),
  'horizontal atmospheric biogeochemistry closes a separate domain ledger at every native pressure level');
  const routedCarbonConcentrations = transportedGas.routes.map(route =>
    route.gases.carbonKgC / route.dryAirMassKg);
  assert.ok(transportedGas.routes.length >= 8 &&
    Math.max(...routedCarbonConcentrations) /
      Math.min(...routedCarbonConcentrations) > 2,
  'deliberately stratified columns advect distinct level concentrations rather than repeating either bulk mean');
  assert.equal(transportedGas.truth.nativePressureLayerComposition, true);
  assert.equal(transportedGas.truth.wholeColumnAverageUsed, false);
  assert.equal(transportedLand.receipt.truth
    .nativePressureLayerAtmosphericBiogeochemistryTransport, true);
  assert.equal(transportedLand.receipt.truth
    .wholeColumnAverageAtmosphericGasTransport, false);
  assert.ok(Object.values(transportedGas.conservation)
    .every(value => Math.abs(value) < 1),
  'loaded atmosphere C/O2/N2 closes across unequal spherical cell areas');
  assert.ok(Math.abs(transportedLand.receipt.conservation
    .atmosphereCarbonDioxideCarbonResidualKg) < 1 &&
    Math.abs(transportedLand.receipt.conservation
      .atmosphereOxygenResidualKg) < 1 &&
    Math.abs(transportedLand.receipt.conservation
      .atmosphereNitrogenGasResidualKg) < 1,
  'the composite Earth-transport ledger includes conservative atmospheric gases');
  const transportedGasById = new Map(transportedLand.columns.map(column =>
    [column.id, column.atmosphere.biogeochemistry]));
  assert.ok(transportedGasById.get(transportLandColumns[0].id)
    .carbonDioxideCarbonKgCm2 < initialTransportGasById
      .get(transportLandColumns[0].id).carbonDioxideCarbonKgCm2 &&
    transportedGasById.get(transportLandColumns[1].id)
      .carbonDioxideCarbonKgCm2 > initialTransportGasById
        .get(transportLandColumns[1].id).carbonDioxideCarbonKgCm2,
  'native dry-air advection debits the high-pressure gas sender and credits the loaded receiver');
  assert.ok(transportedLand.columns.every(column =>
    column.atmosphere.biogeochemistry.lastHorizontalTransportReceipt
      .domainDigest === transportedGas.digest &&
    column.land.ecology.carbon.atmosphericExchangeableKgCm2 ===
      column.atmosphere.biogeochemistry.carbonDioxideCarbonKgCm2 &&
    column.land.ecology.carbon.co2PpmProxy ===
      column.atmosphere.biogeochemistry.co2Ppm),
  'each transported column persists local lineage and exact ecology compatibility mirrors');
  assert.equal(transportedLand.receipt.truth
    .globalAtmosphericBiogeochemistryMixing, false,
  'loaded gas advection does not claim a globally mixed atmosphere');
  const transportedIntegrityAudit = systemAudit.auditFoundationSystem({
    column: transportedLand.columns[0],
    earthTransportReceipt: transportedLand.receipt
  });
  assert.equal(transportedIntegrityAudit.counts.fail, 0,
    'the runtime integrity organ accepts the new transported gas evidence');
  assert.equal(transportedIntegrityAudit.checks.find(item =>
    item.id === 'loaded-transport-receipt').status, 'PASS');
  const previousTransportAudit = systemAudit.auditFoundationSystem({
    column: transportedLand.columns[0],
    earthTransportReceipt: {
      ...transportedLand.receipt,
      schema: earthTransport.PREVIOUS_EARTH_TRANSPORT_STEP_SCHEMA,
      atmosphereBiogeochemistryTransportReceipt: undefined
    }
  });
  assert.equal(previousTransportAudit.checks.find(item =>
    item.id === 'loaded-transport-receipt').status, 'NOT_APPLICABLE',
  'a persisted v9 pre-sediment receipt remains honest unobserved evidence until a real v10 route runs');
  const legacyTransportAudit = systemAudit.auditFoundationSystem({
    column: transportedLand.columns[0],
    earthTransportReceipt: {
      ...transportedLand.receipt,
      schema: earthTransport.LEGACY_EARTH_TRANSPORT_STEP_SCHEMA,
      atmosphereBiogeochemistryTransportReceipt: undefined
    }
  });
  assert.equal(legacyTransportAudit.checks.find(item =>
    item.id === 'loaded-transport-receipt').status, 'NOT_APPLICABLE',
  'a persisted v8 pre-runoff-queue receipt remains honest unobserved evidence until a current route runs');
  const corruptedCurrentTransport = JSON.parse(JSON.stringify(transportedLand.receipt));
  delete corruptedCurrentTransport.atmosphereBiogeochemistryTransportReceipt;
  const corruptedCurrentTransportAudit = systemAudit.auditFoundationSystem({
    column: transportedLand.columns[0],
    earthTransportReceipt: corruptedCurrentTransport
  });
  assert.equal(corruptedCurrentTransportAudit.checks.find(item =>
    item.id === 'loaded-transport-receipt').status, 'FAIL',
  'a current v8 receipt cannot omit its required atmospheric gas evidence');
  const corruptedRunoffTransport = JSON.parse(JSON.stringify(
    transportedLand.receipt));
  delete corruptedRunoffTransport.runoffReceipts[0]
    .runoffBiogeochemistryTransfer.senderDebit;
  const corruptedRunoffTransportAudit = systemAudit.auditFoundationSystem({
    column: transportedLand.columns[0],
    earthTransportReceipt: corruptedRunoffTransport
  });
  assert.equal(corruptedRunoffTransportAudit.checks.find(item =>
    item.id === 'loaded-transport-receipt').status, 'FAIL',
  'a current v10 runoff route cannot omit its persistent chemistry queue sender debit');
  const nativeLandTransport = transportedLand.receipt.nativePressureTransportReceipt;
  assert.equal(nativeLandTransport.schema,
    earthTransport.ATMOSPHERE_PRESSURE_HORIZONTAL_TRANSPORT_SCHEMA,
    'loaded atmospheric transport embeds the typed native pressure-level domain receipt');
  assert.equal(nativeLandTransport.layerCount, 8,
    'native horizontal transport declares all eight persisted pressure levels');
  assert.deepEqual(nativeLandTransport.levelSummaries.map(level => level.layerIndex),
    [0, 1, 2, 3, 4, 5, 6, 7],
    'native horizontal transport exposes one ordered conservation ledger per pressure level');
  assert.ok(nativeLandTransport.levelSummaries.every(level => level.routeCount > 0),
    'the deliberately forced loaded edge transports dry air at every native pressure level');
  assert.deepEqual([...new Set(nativeLandTransport.massRouteReceipts.map(receipt =>
    receipt.layerIndex))].sort((a, b) => a - b), [0, 1, 2, 3, 4, 5, 6, 7],
  'native mass routes cannot silently collapse back to the two compatibility bands');
  assert.ok(nativeLandTransport.massRouteReceipts.every(receipt =>
    receipt.senderDebitKg === receipt.receiverCreditKg && receipt.residualKg === 0),
  'every native dry-air transfer has an exact paired sender/receiver receipt');
  assert.ok(nativeLandTransport.tracerRouteReceipts.every(receipt =>
    receipt.senderDebit === receipt.receiverCredit && receipt.residual === 0),
  'every native vapor, cloud-liquid, cloud-ice and sensible-enthalpy transfer has an exact paired receipt');
  assert.ok(nativeLandTransport.tracerRouteReceipts.some(receipt =>
    receipt.quantity === 'cloud-ice-water' && receipt.amount > 0),
  'native horizontal transport emits explicit cloud-ice tracer routes');
  assert.ok(Math.abs(nativeLandTransport.residuals.waterKg) < 1 &&
    Math.abs(nativeLandTransport.residuals.moistEnthalpyJ) < 1e5 &&
    Math.abs(nativeLandTransport.residuals.eastwardMomentumKgMps) < 1e3 &&
    Math.abs(nativeLandTransport.residuals.northwardMomentumKgMps) < 1e3 &&
    Math.abs(nativeLandTransport.residuals.horizontalKineticEnergyJ) < 1e5 &&
    Math.abs(nativeLandTransport.residuals.resolvedEnergyJ) < 1e5,
  'native eight-level water, moist enthalpy, tangent momentum, kinetic and resolved-energy ledgers close');
  assert.ok(nativeLandTransport.truth.allEightNativeLevelsParticipate &&
    nativeLandTransport.truth.nativeWaterClosed &&
    nativeLandTransport.truth.nativeMoistEnthalpyClosed &&
    nativeLandTransport.truth.nativeTangentMomentumClosed &&
    nativeLandTransport.truth.nativeKineticEnergyClosed &&
    nativeLandTransport.truth.nativeResolvedEnergyClosed,
  'native transport truth flags are derived from the eight-level closure receipts');
  assert.ok(Math.abs(transportedLand.columns.reduce((sum, column) =>
    sum + column.atmosphere.pressureColumn.totals.convectiveKineticEnergyJm2, 0) -
      initialTransportConvectiveEnergyJm2) < 1e-6,
  'horizontal pressure transport preserves existing native interface convective energy');
  assert.ok(transportedLand.columns[0].atmosphere.surfacePressureHpa < 1040 && transportedLand.columns[1].atmosphere.surfacePressureHpa > 980, 'surface-pressure dry-air mass moves from the loaded high toward the loaded low');
  assert.ok(transportedLand.columns.every(column => column.atmosphere.windSpeedMps > 0), 'loaded pressure gradient produces explicit vector wind momentum');
  assert.equal(transportedLand.receipt.atmosphereMassReceipts.length, 8, 'one loaded edge emits an independently receipted dry-air route for every native pressure level');
  assert.ok(transportedLand.receipt.atmosphereMassReceipts.every(receipt =>
    receipt.schema === earthTransport.ATMOSPHERE_PRESSURE_LAYER_MASS_ROUTE_SCHEMA &&
    receipt.carriedVaporWaterKg > 0 && receipt.carriedSensibleEnthalpyJ > 0 &&
    receipt.geopotential.schema === earthTransport.ATMOSPHERE_PRESSURE_LAYER_GEOPOTENTIAL_ROUTE_SCHEMA &&
    receipt.senderDebitKg === receipt.receiverCreditKg && receipt.residualKg === 0
  ), 'each native pressure-layer receipt pairs sender and receiver while carrying momentum, tracers, sensible enthalpy and terrain-following geopotential work');
  assert.ok(transportedLand.receipt.atmosphereImpulseReceipts.every(receipt =>
    receipt.schema === earthTransport.ATMOSPHERE_PRESSURE_LAYER_IMPULSE_SCHEMA), 'pressure forcing has typed native pressure-layer impulse receipts');
  assert.equal(transportedLand.receipt.atmosphereCoriolisReceipts.length, 16, 'every loaded native pressure level emits one rotation receipt');
  assert.ok(transportedLand.receipt.atmosphereCoriolisReceipts.every(receipt => receipt.schema === earthTransport.ATMOSPHERE_PRESSURE_LAYER_CORIOLIS_SCHEMA && receipt.rotationRadians > 0), 'northern loaded pressure levels use positive latitude-dependent Coriolis rotation');
  assert.ok(transportedLand.columns.every(column => column.atmosphere.northwardWindMps < 0), 'northern Coriolis deflects an eastward pressure response toward the right without changing its speed bound');
  assert.ok(transportedLand.columns[0].atmosphere.precipitableWaterMm < 60 && transportedLand.columns[1].atmosphere.precipitableWaterMm > 5, 'atmospheric moisture crosses the shared edge down-gradient');
  assert.ok(transportedLand.columns[0].atmosphere.cloudWaterMm < 4 && transportedLand.columns[1].atmosphere.cloudWaterMm > 0, 'cloud liquid crosses the shared edge without being collapsed into vapor');
  assert.ok(transportedLand.columns[0].atmosphere.cloudIceMm < 1.5 &&
    transportedLand.columns[1].atmosphere.cloudIceMm > 0,
  'cloud ice crosses the shared edge without being collapsed into liquid or vapor');
  assert.ok(transportedLand.columns[0].atmosphere.airTemperatureC < 28 && transportedLand.columns[1].atmosphere.airTemperatureC > 2, 'atmospheric sensible heat crosses the shared edge down-gradient');
  assert.ok(transportedLand.columns[0].atmosphere.freeTroposphere.precipitableWaterMm < 12 &&
    transportedLand.columns[1].atmosphere.freeTroposphere.precipitableWaterMm > 1,
  'free-troposphere vapor crosses the shared edge through explicit advection and mixing');
  assert.ok(transportedLand.columns[0].atmosphere.freeTroposphere.cloudWaterMm < 4 &&
    transportedLand.columns[1].atmosphere.freeTroposphere.cloudWaterMm > 0,
  'free-troposphere cloud liquid crosses without being collapsed into vapor');
  assert.ok(transportedLand.columns[0].atmosphere.freeTroposphere.cloudIceMm < 2 &&
    transportedLand.columns[1].atmosphere.freeTroposphere.cloudIceMm > 0,
  'free-troposphere cloud ice crosses as an independent native tracer');
  assert.ok(transportedLand.columns[0].atmosphere.freeTroposphere.airTemperatureC < -10 &&
    transportedLand.columns[1].atmosphere.freeTroposphere.airTemperatureC > -35,
  'free-troposphere sensible heat crosses down-gradient while dry-air advection carries its own enthalpy');
  assert.ok(transportedLand.columns.every(column =>
    column.atmosphere.freeTroposphere.windSpeedMps > 0), 'upper pressure gradients create independent free-troposphere vector momentum');
  assert.ok(transportedLand.columns.every(column => Math.abs(
    column.atmosphere.boundaryLayerPressureHpa +
    column.atmosphere.freeTroposphere.pressureThicknessHpa -
    column.atmosphere.surfacePressureHpa
  ) < 1e-8), 'horizontal dry-air transport preserves the two-layer hydrostatic pressure partition');
  assert.equal(transportedLand.receipt.truth.upperAirHorizontalTransport, true, 'transport receipt exposes the implemented upper-air horizontal path');
  assert.equal(transportedLand.receipt.truth.buoyancyConversionResolved, false, 'geopotential routing does not launder unresolved buoyancy conversion into a solved claim');
  assert.ok(transportedLand.columns.every(column =>
    pressureColumn.validatePressureColumn(column.atmosphere.pressureColumn) &&
    column.atmosphere.lastPressureColumnSyncReceipt.reason === 'loaded-native-pressure-horizontal-transport' &&
    column.truth.pressureCoordinateColumnPersisted &&
    column.truth.pressureColumnConservativeProjection &&
    column.truth.pressureColumnHydrostaticInterfaces
  ), 'loaded horizontal transport projects every changed native pressure column into valid compatibility bands');
  assert.ok(transportedLand.columns.every(column =>
    column.atmosphere.lastPressureColumnHorizontalTransportReceipt.schema ===
      earthTransport.ATMOSPHERE_PRESSURE_COLUMN_HORIZONTAL_LOCAL_SCHEMA &&
    column.atmosphere.lastPressureColumnHorizontalTransportReceipt.transportDigest ===
      nativeLandTransport.digest &&
    column.truth.nativePressureLevelHorizontalTransport === true &&
    column.truth.nativePressureLevelHorizontalWaterClosed === true &&
    column.truth.nativePressureLevelHorizontalMoistEnthalpyClosed === true &&
    column.truth.nativePressureLevelHorizontalMomentumClosed === true &&
    column.truth.nativePressureLevelHorizontalResolvedEnergyClosed === true &&
    column.truth.pressureLevelDynamicsResolved === false
  ), 'horizontal-only destinations do not invent an unrun native vertical-dynamics lineage');
  assert.ok(transportedLand.columns.every(column =>
    Math.abs(column.atmosphere.lastPressureColumnSyncReceipt.residuals.dryAirMassKgM2) < 1e-6 &&
    Math.abs(column.atmosphere.lastPressureColumnSyncReceipt.residuals.vaporWaterMm) < 1e-8 &&
    Math.abs(column.atmosphere.lastPressureColumnSyncReceipt.residuals.cloudWaterMm) < 1e-8 &&
    Math.abs(column.atmosphere.lastPressureColumnSyncReceipt.residuals.cloudIceMm) < 1e-8 &&
    Math.abs(column.atmosphere.lastPressureColumnSyncReceipt.residuals.moistEnthalpyJm2) < 1
  ), 'transport-to-pressure-column reconciliation closes dry air, water and moist enthalpy per destination column');
  assert.ok(transportedLand.columns[0].land.groundwaterStorageMm < transportLandColumns[0].land.groundwaterStorageMm, 'groundwater follows hydraulic head into the neighboring aquifer');
  assert.ok(transportedLand.columns[0].routing.runoffQueueMm < 10 && transportedLand.columns[1].routing.runoffQueueMm > 0, 'queued runoff advances to the lower loaded land neighbor');
  assert.equal(transportedLand.receipt.runoffReceipts[0].status, 'routed', 'land-to-land runoff emits a typed routing receipt');
  const landRunoffChemistryReceipt = transportedLand.receipt
    .runoffReceipts[0].runoffBiogeochemistryTransfer;
  assert.equal(landRunoffChemistryReceipt.senderDebit.schema,
    soilBiogeochemistry.RUNOFF_BIOGEOCHEMISTRY_TRANSFER_SCHEMA);
  assert.equal(landRunoffChemistryReceipt.receiverCredit.schema,
    soilBiogeochemistry.RUNOFF_BIOGEOCHEMISTRY_TRANSFER_SCHEMA);
  assert.equal(landRunoffChemistryReceipt.senderDebit.transferId,
    landRunoffChemistryReceipt.receiverCredit.transferId,
  'land-to-land runoff chemistry uses one paired transfer identity');
  assert.ok(Object.values(landRunoffChemistryReceipt.senderDebit
    .debitedElementsKg).filter(value => typeof value === 'number')
    .every(value => value > 0),
  'land-to-land runoff moves non-zero C/N/P/O2/alkalinity from the persistent sender queue');
  assert.ok(['Carbon', 'Nitrogen', 'Phosphorus', 'Oxygen', 'Alkalinity'].every(element =>
    Math.abs(transportedLand.receipt.conservation[
      `runoffBiogeochemistry${element}ResidualKg`]) < 1),
  'area-weighted runoff C/N/P/O2/alkalinity stays closed across loaded land cells');
  assert.ok(Math.abs(transportedLand.receipt.conservation.runoffQueueResidualKg) < .1, 'land-to-land runoff routing conserves area-weighted mass');
  assert.ok(Math.abs(transportedLand.receipt.conservation.atmosphereWaterResidualKg) < .1, 'area-weighted atmospheric moisture exchange conserves mass');
  assert.ok(Math.abs(transportedLand.receipt.conservation.atmosphereCloudWaterResidualKg) < .1, 'area-weighted cloud-liquid transport conserves mass');
  assert.ok(Math.abs(transportedLand.receipt.conservation.atmosphereCloudIceResidualKg) < .1,
    'area-weighted cloud-ice transport conserves mass');
  assert.ok(Math.abs(transportedLand.receipt.conservation.atmosphereDryAirResidualKg) < .1, 'surface-pressure dry-air exchange conserves loaded-domain mass');
  assert.ok(Math.abs(transportedLand.receipt.conservation.atmosphereBoundaryDryAirResidualKg) < .1 &&
    Math.abs(transportedLand.receipt.conservation.atmosphereFreeDryAirResidualKg) < .1,
  'boundary and free dry-air masses close independently');
  assert.ok(Math.abs(transportedLand.receipt.conservation.atmosphereFreeVaporWaterResidualKg) < .1 &&
    Math.abs(transportedLand.receipt.conservation.atmosphereFreeCloudWaterResidualKg) < .1,
  'free-troposphere vapor and cloud liquid close independently');
  assert.ok(Math.abs(transportedLand.receipt.conservation.atmosphereFreeCloudIceResidualKg) < .1,
    'free-troposphere cloud ice closes independently');
  assert.ok(Math.abs(transportedLand.receipt.conservation.atmosphereEastwardMomentumResidualKgMps) < 1e4, 'eastward momentum closes after the declared pressure impulse');
  assert.ok(Math.abs(transportedLand.receipt.conservation.atmosphereNorthwardMomentumResidualKgMps) < 1e4, 'northward momentum closes after the declared pressure impulse');
  assert.ok(Math.abs(transportedLand.receipt.conservation.atmosphereKineticEnergyResidualJ) < 1e7,
    `atmospheric kinetic energy closes after mixing, pressure work and Coriolis terms (${transportedLand.receipt.conservation.atmosphereKineticEnergyResidualJ} J; native ${transportedLand.receipt.nativePressureTransportReceipt.residuals.horizontalKineticEnergyJ} J)`);
  assert.ok(Math.abs(transportedLand.receipt.conservation.atmosphereFreeKineticEnergyResidualJ) < 1e7,
    'free-troposphere kinetic energy closes against its own mixing, pressure and Coriolis terms');
  assert.ok(Math.abs(transportedLand.receipt.conservation.atmosphereGeopotentialEnergyResidualJ) < 1e4,
    `terrain-following layer mass closes against the declared geopotential adjustment work (${transportedLand.receipt.conservation.atmosphereGeopotentialEnergyResidualJ} J; native ${transportedLand.receipt.nativePressureTransportReceipt.residuals.geopotentialEnergyJ} J)`);
  assert.ok(Math.abs(transportedLand.receipt.transfers.coriolisWorkJ) < 1e4, 'exact Coriolis vector rotation performs no material kinetic-energy work');
  assert.ok(Math.abs(transportedLand.receipt.conservation.groundwaterResidualKg) < .1, 'area-weighted groundwater exchange conserves mass');
  assert.ok(Math.abs(transportedLand.receipt.conservation.atmosphereHeatResidualJ) < 1e5, `area-weighted atmospheric heat exchange conserves energy (${transportedLand.receipt.conservation.atmosphereHeatResidualJ} J)`);
  assert.ok(Math.abs(transportedLand.receipt.conservation.atmosphereMoistEnthalpyResidualJ) < 1e6, 'vapor latent energy and sensible heat close the loaded moist-enthalpy ledger');
  assert.ok(Math.abs(transportedLand.receipt.conservation.atmosphereFreeMoistEnthalpyResidualJ) < 1e6,
    'free-troposphere sensible and vapor latent energy close independently');
  const invalidVerticalPartition = JSON.parse(JSON.stringify(transportLandColumns[0]));
  invalidVerticalPartition.atmosphere.freeTroposphere.pressureThicknessHpa -= 1;
  assert.throws(() => earthTransport.transportEarthSystemColumns([invalidVerticalPartition], .25), /invalid vertical pressure partition/, 'horizontal transport refuses a malformed hydrostatic layer partition instead of silently repairing it');
  const invalidNativePressureColumn = JSON.parse(JSON.stringify(transportLandColumns[0]));
  invalidNativePressureColumn.atmosphere.pressureColumn.layers[3].pressureThicknessHpa = -1;
  assert.throws(() => earthTransport.transportEarthSystemColumns(
    [invalidNativePressureColumn],
    .25
  ), /valid pressure column/, 'horizontal transport refuses a malformed native pressure level instead of falling back to compatibility bands');
  const limitedWindColumns = JSON.parse(JSON.stringify(transportLandColumns));
  setAtmospherePressure(limitedWindColumns[0], 1085);
  setAtmospherePressure(limitedWindColumns[1], 850);
  limitedWindColumns.forEach(column => {
    column.atmosphere.windSpeedMps = 89.99;
    column.atmosphere.windDirectionDeg = 90;
    column.atmosphere.eastwardWindMps = 89.99;
    column.atmosphere.northwardWindMps = 0;
    column.atmosphere.freeTroposphere.windSpeedMps = 89.99;
    column.atmosphere.freeTroposphere.windDirectionDeg = 90;
    column.atmosphere.freeTroposphere.eastwardWindMps = 89.99;
    column.atmosphere.freeTroposphere.northwardWindMps = 0;
    seedNativePressureColumnFromCompatibilityBands(column);
  });
  const limitedWindResult = earthTransport.transportEarthSystemColumns(limitedWindColumns, 1);
  assert.ok(limitedWindResult.receipt.transfers.pressureImpulseLimiterScale > 0 && limitedWindResult.receipt.transfers.pressureImpulseLimiterScale < 1,
    `one shared pressure-impulse limiter activates before any cell exceeds the wind contract (scale ${limitedWindResult.receipt.transfers.pressureImpulseLimiterScale})`);
  assert.ok(limitedWindResult.columns.every(column => column.atmosphere.windSpeedMps <= 90.000000001 &&
    column.atmosphere.freeTroposphere.windSpeedMps <= 90.000000001), 'layer impulse limiting keeps every vector wind bounded without per-cell clipping');
  assert.ok(Math.abs(limitedWindResult.receipt.conservation.atmosphereEastwardMomentumResidualKgMps) < 1e4, 'limited pressure forcing remains exactly included in the eastward momentum ledger');
  const southernCoriolisSample = model.sampleLatLon(-25.375, -140.875, { profile: 'temperate' });
  const southernCoriolisWeather = seasonalWeather.buildSeasonalWeather(-25.375, -140.875, southernCoriolisSample, { dayOfYear: 156, profile: 'temperate' });
  const southernCoriolisColumn = earthSystem.createEarthSystemColumn(-25.375, -140.875, southernCoriolisSample, southernCoriolisWeather, { day: 156, profile: 'temperate' });
  southernCoriolisColumn.atmosphere.windSpeedMps = 20;
  southernCoriolisColumn.atmosphere.windDirectionDeg = 90;
  southernCoriolisColumn.atmosphere.eastwardWindMps = 20;
  southernCoriolisColumn.atmosphere.northwardWindMps = 0;
  seedNativePressureColumnFromCompatibilityBands(southernCoriolisColumn);
  const southernCoriolisResult = earthTransport.transportEarthSystemColumns([southernCoriolisColumn], .125);
  assert.ok(southernCoriolisResult.columns[0].atmosphere.northwardWindMps > 0, 'southern Coriolis deflects the same eastward wind toward the opposite hemisphere-aware side');
  assert.ok(Math.abs(southernCoriolisResult.columns[0].atmosphere.windSpeedMps - 20) < 1e-8, 'Coriolis changes direction without changing single-column wind speed');
  assert.equal(southernCoriolisResult.receipt.atmosphereCoriolisReceipts.length, 8,
    'single-column transport rotates all eight native pressure-level momenta independently');
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
  mixingColumns.forEach(seedNativePressureColumnFromCompatibilityBands);
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
  for (const pool of oceanEcology.OCEAN_ECOLOGY_TRANSPORT_POOLS) {
    const firstValue = oceanEcology.oceanEcologyTransportValue(
      transportOceanColumns[0].ocean.ecology, pool.id);
    const secondValue = oceanEcology.oceanEcologyTransportValue(
      transportOceanColumns[1].ocean.ecology, pool.id);
    oceanEcology.setOceanEcologyTransportValue(
      transportOceanColumns[0].ocean.ecology, pool.id,
      Math.max(1e-10, firstValue * 1.8));
    oceanEcology.setOceanEcologyTransportValue(
      transportOceanColumns[1].ocean.ecology, pool.id,
      Math.max(1e-10, secondValue * .4));
  }
  const oceanDicBeforeTransport = transportOceanColumns.map(column =>
    column.ocean.ecology.carbon.dissolvedInorganicKgCm2);
  const transportOceanForwardInput = JSON.parse(JSON.stringify(
    transportOceanColumns));
  const transportedOcean = earthTransport.transportEarthSystemColumns(transportOceanColumns, .5);
  assert.ok(transportedOcean.columns[0].ocean.freshwaterAnomalyMm < 120 && transportedOcean.columns[1].ocean.freshwaterAnomalyMm > -80, 'ocean freshwater anomaly mixes across the shared edge');
  assert.ok(transportedOcean.columns[0].ocean.mixedLayerTemperatureC < 24 && transportedOcean.columns[1].ocean.mixedLayerTemperatureC > 4, 'ocean mixed-layer heat crosses the shared edge');
  assert.ok(Math.abs(transportedOcean.receipt.conservation.oceanFreshwaterResidualKg) < .1, 'ocean freshwater exchange conserves area-weighted mass');
  assert.ok(Math.abs(transportedOcean.receipt.conservation.oceanHeatResidualJ) < 1e6, 'ocean heat exchange conserves area-weighted energy');
  assert.equal(transportedOcean.receipt.schema,
    earthTransport.EARTH_TRANSPORT_STEP_SCHEMA);
  assert.equal(earthTransport.earthTransportDescription()
    .oceanEcologyTransportReceiptSchema,
    earthTransport.OCEAN_ECOLOGY_TRANSPORT_RECEIPT_SCHEMA);
  assert.ok(transportedOcean.receipt.oceanEcologyReceipts.length >=
    oceanEcology.OCEAN_ECOLOGY_TRANSPORT_POOLS.length,
  'every differing marine C/N/P/O2 or plankton pool emits a typed loaded-edge receipt');
  assert.ok(transportedOcean.receipt.oceanEcologyReceipts.every(receipt =>
    receipt.schema === earthTransport.OCEAN_ECOLOGY_TRANSPORT_RECEIPT_SCHEMA &&
    receipt.amountKg > 0 && receipt.simultaneous === true),
  'marine tracer receipts identify donor, receiver, pool and simultaneous application');
  const transportedOceanById = new Map(transportedOcean.columns.map(column =>
    [column.id, column]));
  assert.ok(transportedOceanById.get(transportOceanColumns[0].id)
    .ocean.ecology.carbon.dissolvedInorganicKgCm2 < oceanDicBeforeTransport[0] &&
    transportedOceanById.get(transportOceanColumns[1].id)
      .ocean.ecology.carbon.dissolvedInorganicKgCm2 > oceanDicBeforeTransport[1],
  'dissolved inorganic carbon moves down-gradient across the loaded ocean edge');
  assert.ok(transportedOcean.receipt.transfers.oceanEcologyCarbonKg > 0 &&
    transportedOcean.receipt.transfers.oceanEcologyNitrogenKg > 0 &&
    transportedOcean.receipt.transfers.oceanEcologyPhosphorusKg > 0 &&
    transportedOcean.receipt.transfers.oceanEcologyOxygenKg > 0,
  'transport totals expose non-zero carbon, nitrogen, phosphorus and oxygen movement');
  assert.ok(Math.abs(transportedOcean.receipt.conservation
    .oceanEcologyCarbonResidualKg) < 1 &&
    Math.abs(transportedOcean.receipt.conservation
      .oceanEcologyNitrogenResidualKg) < 1 &&
    Math.abs(transportedOcean.receipt.conservation
      .oceanEcologyPhosphorusResidualKg) < 1 &&
    Math.abs(transportedOcean.receipt.conservation
      .oceanEcologyOxygenResidualKg) < 1,
  'loaded marine transport conserves area-weighted C/N/P/O2 across the domain');
  assert.ok(transportedOcean.columns.every(column =>
    column.truth.loadedOceanBiogeochemicalTransport === true));
  const transportedOceanReverse = earthTransport.transportEarthSystemColumns(
    [...transportOceanForwardInput].reverse(), .5);
  assert.equal(transportedOceanReverse.receipt.digest,
    transportedOcean.receipt.digest,
  'marine biogeochemical transport receipt is invariant to caller ordering');
  assert.deepEqual(transportedOceanReverse.columns, transportedOcean.columns,
    'marine tracer state applies simultaneously and order-invariantly');
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
  const coastRunoffChemistry = soilBiogeochemistry
    .mobilizeSoilBiogeochemistry(
      coastColumns[0].land.soilBiogeochemistry,
      coastColumns[0].routing.runoffBiogeochemistryQueue,
      20,
      {
        accessibleWaterMm: coastColumns[0].land.rootZoneWaterMm +
          coastColumns[0].land.deepSoilWaterMm +
          coastColumns[0].land.groundwaterStorageMm
      }
    );
  coastColumns[0].land.soilBiogeochemistry = coastRunoffChemistry.state;
  coastColumns[0].routing.runoffBiogeochemistryQueue =
    coastRunoffChemistry.queue;
  const coastSedimentErosion = geomorphicSediment.erodeSurfaceSediment(
    coastColumns[0].land.surfaceSediment,
    coastColumns[0].routing.runoffSedimentQueue,
    20,
    {
      sample: model.sampleLatLon(-49.875, -136.875,
        { profile: 'temperate' }),
      substrate: coastColumns[0].substrate,
      ecology: coastColumns[0].land.ecology,
      rainfallMm: 32,
      durationDays: 1
    }
  );
  coastColumns[0].land.surfaceSediment = coastSedimentErosion.state;
  coastColumns[0].routing.runoffSedimentQueue = coastSedimentErosion.queue;
  coastColumns[1].ocean.freshwaterAnomalyMm = 0;
  const coastRouting = earthTransport.transportEarthSystemColumns(coastColumns, .25);
  assert.ok(coastRouting.columns[0].routing.runoffQueueMm < 20, 'coastal land queue releases runoff toward lower ocean');
  assert.ok(coastRouting.columns[1].ocean.freshwaterAnomalyMm > 0, 'routed runoff freshens the receiving ocean mixed layer');
  assert.ok(coastRouting.receipt.transfers.runoffDeliveredToOceanKg > 0, 'coastal receipt reports delivered freshwater mass');
  assert.ok(Math.abs(coastRouting.receipt.conservation.runoffQueueResidualKg) < .1, 'coastal runoff queue closes after ocean delivery');
  assert.ok(Math.abs(coastRouting.receipt.conservation.oceanFreshwaterResidualKg) < .1, 'receiving ocean anomaly closes against delivered runoff');
  const coastalChemistryReceipt = coastRouting.receipt.runoffReceipts
    .find(receipt => receipt.status === 'routed')
    .runoffBiogeochemistryTransfer;
  assert.equal(coastalChemistryReceipt.receiverCredit.schema,
    oceanEcology.EARTH_OCEAN_ECOLOGY_RUNOFF_INPUT_SCHEMA);
  assert.equal(coastalChemistryReceipt.senderDebit.transferId,
    coastalChemistryReceipt.receiverCredit.transferId,
  'direct coastal runoff carries one exact soil-queue-to-ocean transfer identity');
  assert.equal(coastalChemistryReceipt.receiverCredit.truth
    .landRunoffQueueSenderDebited, true);
  assert.ok(['Carbon', 'Nitrogen', 'Phosphorus', 'Oxygen', 'Alkalinity'].every(element =>
    Math.abs(coastRouting.receipt.conservation[
      `runoffBiogeochemistry${element}ResidualKg`]) < 1 &&
    Math.abs(coastRouting.receipt.conservation[
      `runoffReceivingOcean${element}ResidualKg`]) < 1),
  'direct coastal runoff closes paired queue and ocean C/N/P/O2/alkalinity ledgers');
  const coastalSedimentTransfer = coastRouting.receipt.runoffReceipts
    .find(receipt => receipt.status === 'routed')
    .runoffSedimentTransfer;
  assert.equal(coastalSedimentTransfer.senderDebit.transferId,
    coastalSedimentTransfer.receiverCredit.transferId);
  assert.equal(coastalSedimentTransfer.receiverCredit.schema,
    geomorphicSediment.COASTAL_SEDIMENT_INPUT_SCHEMA);
  assert.ok(coastalSedimentTransfer.senderDebit.totalKg > 0 &&
    geomorphicSediment.sedimentGrainTotal(
      coastalSedimentTransfer.receiverCredit.inputKg) > 0,
  'direct coastal runoff debits a finite land queue and credits the exact loaded coast');
  assert.ok(coastRouting.receipt.transfers
    .runoffSedimentDeliveredToOceanKg > 0 &&
    geomorphicSediment.sedimentGrainTotal(
      coastRouting.columns[1].ocean.coastalSediment.depositedKgM2) > 0,
  'grain-selective deposition persists on the receiving ocean cell');
  assert.ok(['Clay', 'Silt', 'Sand', 'Gravel'].every(grain =>
    Math.abs(coastRouting.receipt.conservation[
      `runoffSediment${grain}ResidualKg`]) < 1 &&
    Math.abs(coastRouting.receipt.conservation[
      `coastalSediment${grain}ResidualKg`]) < 1),
  'direct coastal runoff closes paired land-queue and coast ledgers for all four grains');
  const corruptedSedimentTransport = JSON.parse(JSON.stringify(
    coastRouting.receipt));
  delete corruptedSedimentTransport.runoffReceipts.find(receipt =>
    receipt.status === 'routed').runoffSedimentTransfer.senderDebit;
  const corruptedSedimentTransportAudit = systemAudit.auditFoundationSystem({
    column: coastRouting.columns[0],
    earthTransportReceipt: corruptedSedimentTransport
  });
  assert.equal(corruptedSedimentTransportAudit.checks.find(item =>
    item.id === 'loaded-transport-receipt').status, 'FAIL',
  'a current v10 route cannot omit its finite sediment sender debit');

  const basinCoordinates = [[-49.875, -137.125], [-49.875, -136.875], [-49.875, -136.625]];
  const basinColumns = basinCoordinates.map(([latitude, longitude]) => {
    const sample = model.sampleLatLon(latitude, longitude, { profile: 'temperate' });
    const weather = seasonalWeather.buildSeasonalWeather(latitude, longitude, sample, { dayOfYear: 118, profile: 'temperate' });
    return earthSystem.createEarthSystemColumn(latitude, longitude, sample, weather, { day: 118, profile: 'temperate' });
  });
  assert.deepEqual(basinColumns.map(column => column.kind), ['land', 'land', 'ocean'], 'basin fixture crosses two canonical land cells into a loaded ocean mouth');
  basinColumns[0].routing.runoffQueueMm = 10;
  basinColumns[0].routing.cumulativeGeneratedRunoffMm = 10;
  const basinRunoffChemistry = soilBiogeochemistry
    .mobilizeSoilBiogeochemistry(
      basinColumns[0].land.soilBiogeochemistry,
      basinColumns[0].routing.runoffBiogeochemistryQueue,
      10,
      {
        accessibleWaterMm: basinColumns[0].land.rootZoneWaterMm +
          basinColumns[0].land.deepSoilWaterMm +
          basinColumns[0].land.groundwaterStorageMm
      }
    );
  basinColumns[0].land.soilBiogeochemistry = basinRunoffChemistry.state;
  basinColumns[0].routing.runoffBiogeochemistryQueue =
    basinRunoffChemistry.queue;
  const basinSedimentErosion = geomorphicSediment.erodeSurfaceSediment(
    basinColumns[0].land.surfaceSediment,
    basinColumns[0].routing.runoffSedimentQueue,
    10,
    {
      sample: model.sampleLatLon(-49.875, -137.125,
        { profile: 'temperate' }),
      substrate: basinColumns[0].substrate,
      ecology: basinColumns[0].land.ecology,
      rainfallMm: 28,
      durationDays: 1
    }
  );
  basinColumns[0].land.surfaceSediment = basinSedimentErosion.state;
  basinColumns[0].routing.runoffSedimentQueue = basinSedimentErosion.queue;
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
  assert.equal(basinRouting.BASIN_ROUTING_ENGINE_SCHEMA,
    'axm.foundation-planet.basin-routing-engine/v28');
  assert.equal(basinRouting.BASIN_ROUTING_STEP_SCHEMA,
    'axm.foundation-planet.basin-routing-step/v27');
  assert.equal(basinRouting.PREVIOUS_BASIN_ROUTING_ENGINE_SCHEMA,
    'axm.foundation-planet.basin-routing-engine/v27');
  assert.equal(basinRouting.PREVIOUS_BASIN_ROUTING_STEP_SCHEMA,
    'axm.foundation-planet.basin-routing-step/v26');
  assert.equal(basinRouting.BASIN_CLOCK_ALIGNMENT_CHECKPOINT_SCHEMA,
    'axm.foundation-planet.basin-clock-alignment-checkpoint/v1');
  const emptyBasinDescriptor = basinEngine.descriptor('temperate');
  assert.equal(emptyBasinDescriptor.activeProfileStoredChemistry
    .alkalinityKgCaCO3Eq, 0,
  'a fresh browser receives a complete zero-valued river chemistry descriptor before the first basin step');
  assert.equal(emptyBasinDescriptor.activeProfileEstuaryStorage
    .cumulativeAlkalinityGeneratedKgCaCO3Eq, 0,
  'a fresh browser receives a complete zero-valued estuary descriptor before the first basin step');
  const basinStepOne = basinEngine.advance(basinColumns, basinSector, 1, {
    profileId: 'temperate', startDay: 118, captureTimeDays: .02
  });
  assert.equal(basinStepOne.receipt.inletReceipts.length, 1, 'one land Earth cell enters its canonical main reach');
  assert.equal(basinStepOne.receipt.inletReceipts[0].sender.debitedKg, basinStepOne.receipt.inletReceipts[0].receiver.creditedKg, 'paired sender and receiver inlet receipts carry identical mass');
  assert.equal(basinStepOne.receipt.inletReceipts[0].riverChemistryInput.schema,
    riverChemistry.RIVER_CHEMISTRY_INPUT_SCHEMA);
  assert.ok(Object.values(basinStepOne.receipt.inletReceipts[0]
    .riverChemistryInput.inputs).every(value => value > 0),
  'land runoff debits persistent queued C/N/P/O2/alkalinity and credits persistent reach storage');
  assert.equal(basinStepOne.receipt.inletReceipts[0]
    .runoffBiogeochemistrySenderDebit.transferId,
  basinStepOne.receipt.inletReceipts[0].riverChemistryInput.transferId,
  'basin intake pairs the land sender debit with the exact river receiver credit');
  const inletNitrogen = basinStepOne.receipt.inletReceipts[0]
    .riverChemistryInput;
  assert.ok(inletNitrogen.truth.nitrateAndAmmoniumReceiverPoolsCredited ===
      true &&
    inletNitrogen.truth.nitratePlusAmmoniumEqualsDin === true &&
    inletNitrogen.truth.inputSpeciationParameterized === true &&
    inletNitrogen.truth.measuredInputSpeciationClaimed === false &&
    Math.abs(inletNitrogen.nitrogenSpeciation.nitrateNitrogenKgN +
      inletNitrogen.nitrogenSpeciation.ammoniumNitrogenKgN -
      inletNitrogen.inputs.nitrogenKgN) < 1e-7,
  'generic runoff DIN is explicitly parameterized into persistent nitrate and ammonium receiver pools without a measured-speciation claim');
  assert.equal(basinStepOne.receipt.truth
    .parameterizedLandRunoffChemistryBoundary, false);
  assert.equal(basinStepOne.receipt.truth
    .landRunoffBiogeochemistrySenderDebited, true);
  assert.equal(basinStepOne.receipt.inletReceipts[0]
    .runoffSedimentSenderDebit.transferId,
  basinStepOne.receipt.inletReceipts[0].riverSedimentInput.transferId,
  'basin intake pairs the finite land sediment debit with the exact river receiver credit');
  assert.ok(basinStepOne.receipt.inletReceipts[0]
    .riverSedimentInput.totalInputKg > 0);
  assert.ok(['Carbon', 'Nitrogen', 'Phosphorus', 'Oxygen'].every(element =>
    Math.abs(basinStepOne.receipt.conservation[
      `runoff${element}ResidualKg${element === 'Carbon' ? 'C' :
        element === 'Nitrogen' ? 'N' : element === 'Phosphorus' ? 'P' : 'O2'}`]) < 1e-6),
  'basin intake closes each persistent land runoff queue ledger');
  assert.ok(Math.abs(basinStepOne.receipt.conservation
    .runoffAlkalinityResidualKgCaCO3Eq) < 1e-6,
  'basin intake closes the persistent land runoff alkalinity queue ledger');
  assert.ok(['Clay', 'Silt', 'Sand', 'Gravel'].every(grain =>
    Math.abs(basinStepOne.receipt.conservation[
      `runoff${grain}ResidualKg`]) < 1),
  'basin intake closes every persistent land runoff sediment queue ledger');
  assert.ok(basinStepOne.columns[0].routing.runoffQueueMm < 10 && basinEngine.status('temperate').storedWaterKg > 0, 'Earth-cell runoff becomes persistent river storage');
  assert.equal(basinStepOne.columns[0].routing.lastDownstreamReachId, 'hydro-reach:v2:basin-a', 'source column retains exact canonical inlet lineage');
  assert.ok(Math.abs(basinStepOne.receipt.conservation.waterResidualKg) < .1, 'Earth-cell to reach capture closes the cross-scale water ledger');
  const basinStepTwo = basinEngine.advance(basinStepOne.columns, basinSector, 1, {
    profileId: 'temperate', startDay: 119, captureTimeDays: .02
  });
  assert.ok(basinStepTwo.receipt.routeReceipts.some(receipt => receipt.schema === basinRouting.RIVER_REACH_TRANSFER_SCHEMA && receipt.destinationReachId === 'hydro-reach:v2:basin-b'), 'stored water advances through the downstream canonical reach');
  const reachChemistryTransfer = basinStepTwo.receipt.routeReceipts.find(receipt =>
    receipt.schema === basinRouting.RIVER_REACH_TRANSFER_SCHEMA).chemistryTransfer;
  assert.ok(reachChemistryTransfer.senderDebited && reachChemistryTransfer.receiverCredited &&
    Object.values(reachChemistryTransfer.elements).every(value => value > 0) &&
    reachChemistryTransfer.pools.dissolvedNitrateNitrogenKgN > 0 &&
    reachChemistryTransfer.pools.dissolvedAmmoniumNitrogenKgN > 0 &&
    Math.abs(reachChemistryTransfer.pools
      .dissolvedInorganicNitrogenKgN -
      reachChemistryTransfer.pools.dissolvedNitrateNitrogenKgN -
      reachChemistryTransfer.pools.dissolvedAmmoniumNitrogenKgN) < 1e-7,
  'reach-to-reach routing moves nitrate and ammonium beside C/P/O2 with equal sender debit and receiver credit');
  const reachSedimentTransfer = basinStepTwo.receipt.routeReceipts.find(
    receipt => receipt.schema === basinRouting.RIVER_REACH_TRANSFER_SCHEMA)
    .sedimentTransfer;
  assert.ok(reachSedimentTransfer.senderDebited &&
    reachSedimentTransfer.receiverCredited &&
    geomorphicSediment.sedimentGrainTotal(
      reachSedimentTransfer.exportedKg) > 0 &&
    geomorphicSediment.sedimentGrainTotal(
      reachSedimentTransfer.senderDebitAndDeposition
        .depositedToBedKg) > 0,
  'reach-to-reach routing partitions suspended grains into persistent bed deposit and exact downstream credit');
  assert.ok(Math.abs(basinStepTwo.receipt.conservation.waterResidualKg) < .1, 'reach-to-reach transfer conserves the combined ledger');
  const oceanSalinityBeforeMouth = basinStepTwo.columns[2].ocean.salinityPsu;
  const oceanFreshwaterBeforeMouth = basinStepTwo.columns[2].ocean.freshwaterAnomalyMm;
  const oceanEcologyBeforeMouth = JSON.parse(JSON.stringify(
    basinStepTwo.columns[2].ocean.ecology));
  const coastalSedimentBeforeMouth = geomorphicSediment.sedimentGrainTotal(
    basinStepTwo.columns[2].ocean.coastalSediment.suspendedKgM2) +
    geomorphicSediment.sedimentGrainTotal(
      basinStepTwo.columns[2].ocean.coastalSediment.depositedKgM2);
  const basinStepThree = basinEngine.advance(basinStepTwo.columns, basinSector, 1, {
    profileId: 'temperate', startDay: 120, captureTimeDays: .02
  });
  const mouthReceipt = basinStepThree.receipt.routeReceipts.find(receipt => receipt.schema === basinRouting.OCEAN_MOUTH_RECEIPT_SCHEMA);
  assert.ok(mouthReceipt && mouthReceipt.deliveredFreshwaterKg > 0, 'loaded ocean mouth emits a typed freshwater delivery receipt');
  assert.equal(mouthReceipt.estuaryTransformation.schema,
    estuaryReactor.ESTUARY_FLUX_RECEIPT_SCHEMA,
  'loaded river water passes through a typed estuary reactor before reaching the ocean');
  assert.ok(mouthReceipt.estuaryTransformation.transformations
    .respiredOrganicCarbonKgC > 0 &&
    mouthReceipt.estuaryTransformation.transformations
      .oxygenConsumedKgO2 > 0 &&
    mouthReceipt.estuaryTransformation.transformations
      .buriedOrganicCarbonKgC > 0 &&
    mouthReceipt.estuaryTransformation.transformations
      .buriedNitrogenKgN > 0 &&
    mouthReceipt.estuaryTransformation.transformations
      .buriedPhosphorusKgP > 0,
  'the estuary respires organic carbon and retains C/N/P in persistent sediment');
  assert.ok(Object.values(mouthReceipt.estuaryTransformation.conservation)
    .every(value => Math.abs(value) < 1e-7),
  'the standalone estuary C/N/P/O2 receipt closes every declared transformation');
  assert.equal(mouthReceipt.atmosphereNitrogenBoundaryInput.schema,
    atmosphereBiogeochemistry.ATMOSPHERE_GAS_BOUNDARY_INPUT_RECEIPT_SCHEMA);
  assert.equal(mouthReceipt.atmosphereNitrogenBoundaryInput.inputs.nitrogenKgN,
    mouthReceipt.estuaryTransformation.transformations.denitrifiedNitrogenKgN,
  'estuary denitrification now credits the exact persistent local atmospheric nitrogen receiver');
  assert.equal(mouthReceipt.oceanEcologyBoundaryInput.schema,
    oceanEcology.EARTH_OCEAN_ECOLOGY_RIVER_INPUT_SCHEMA);
  assert.ok(mouthReceipt.oceanEcologyBoundaryInput.inputs.carbonKgC > 0 &&
    mouthReceipt.oceanEcologyBoundaryInput.inputs.nitrogenKgN > 0 &&
    mouthReceipt.oceanEcologyBoundaryInput.inputs.phosphorusKgP > 0 &&
    mouthReceipt.oceanEcologyBoundaryInput.inputs.oxygenKgO2 > 0,
  'loaded ocean mouth carries a nested, typed persistent-river C/N/P/O2 receipt');
  assert.equal(mouthReceipt.riverSedimentSenderDebitAndDeposition.transferId,
    mouthReceipt.coastalSedimentReceiverCredit.transferId);
  assert.ok(mouthReceipt.riverSedimentSenderDebitAndDeposition
    .totalExportedKg > 0 &&
    geomorphicSediment.sedimentGrainTotal(
      mouthReceipt.coastalSedimentReceiverCredit.depositedKg) > 0,
  'the river mouth debits its suspended load and grain-selectively credits the loaded coast');
  const estuaryFlux = mouthReceipt.estuaryTransformation.transformations;
  const riverDebit = mouthReceipt.riverChemistrySenderDebit.elements;
  const oceanCredit = mouthReceipt.oceanEcologyBoundaryInput.inputs;
  assert.ok(Math.abs(riverDebit.carbonKgC - oceanCredit.carbonKgC -
      estuaryFlux.buriedOrganicCarbonKgC) < 1e-5 &&
    Math.abs(riverDebit.nitrogenKgN - oceanCredit.nitrogenKgN -
      estuaryFlux.buriedNitrogenKgN - estuaryFlux.denitrifiedNitrogenKgN) < 1e-5 &&
    Math.abs(riverDebit.phosphorusKgP - oceanCredit.phosphorusKgP -
      estuaryFlux.buriedPhosphorusKgP) < 1e-5 &&
    Math.abs(riverDebit.oxygenKgO2 - oceanCredit.oxygenKgO2 -
      estuaryFlux.oxygenConsumedKgO2) < 1e-5,
  'the exact river debit partitions into ocean credit, estuary sediment, nitrogen gas and respiration');
  assert.ok(basinStepThree.columns[2].ocean.freshwaterAnomalyMm > oceanFreshwaterBeforeMouth, 'receipted river water enters the loaded ocean freshwater reservoir');
  assert.ok(basinStepThree.columns[2].ocean.salinityPsu < oceanSalinityBeforeMouth, 'river-mouth delivery freshens the receiving mixed layer');
  assert.ok(basinStepThree.columns[2].ocean.ecology.carbon.dissolvedInorganicKgCm2 >
    oceanEcologyBeforeMouth.carbon.dissolvedInorganicKgCm2 &&
    basinStepThree.columns[2].ocean.ecology.nitrogen.dissolvedInorganicKgNm2 >
      oceanEcologyBeforeMouth.nitrogen.dissolvedInorganicKgNm2 &&
    basinStepThree.columns[2].ocean.ecology.phosphorus.dissolvedInorganicKgPm2 >
      oceanEcologyBeforeMouth.phosphorus.dissolvedInorganicKgPm2 &&
    basinStepThree.columns[2].ocean.ecology.oxygen.dissolvedKgO2m2 >
      oceanEcologyBeforeMouth.oxygen.dissolvedKgO2m2,
  'river delivery credits receiving dissolved carbon, nutrients and oxygen alongside freshwater');
  assert.ok(geomorphicSediment.sedimentGrainTotal(
    basinStepThree.columns[2].ocean.coastalSediment.suspendedKgM2) +
    geomorphicSediment.sedimentGrainTotal(
      basinStepThree.columns[2].ocean.coastalSediment.depositedKgM2) >
      coastalSedimentBeforeMouth,
  'river delivery persists mineral sediment in the receiving coastal cell');
  assert.ok(Math.abs(basinStepThree.receipt.conservation.waterResidualKg) < .1, 'river-to-ocean delivery closes river storage and ocean freshwater together');
  assert.ok(['riverNitrateNitrogenResidualKgN',
    'riverAmmoniumNitrogenResidualKgN',
    'riverDinCompatibilityResidualKgN'].every(key =>
    Math.abs(basinStepThree.receipt.conservation[key]) < 1) &&
    basinStepThree.receipt.truth
      .persistentRiverAndFloodplainNitrateAmmoniumPools === true &&
    basinStepThree.receipt.truth
      .exactNitrateAmmoniumWaterFractionTransport === true &&
    basinStepThree.receipt.truth.nitrateAmmoniumConservationClosed ===
      true,
  'basin routing closes independent nitrate and ammonium ledgers while retaining aggregate DIN as an exact compatibility sum');
  assert.ok(basinStepThree.receipt.transfers.oceanEcologyBoundaryInputs.carbonKgC > 0 &&
    basinStepThree.receipt.transfers.oceanEcologyBoundaryInputs.nitrogenKgN > 0 &&
    basinStepThree.receipt.transfers.oceanEcologyBoundaryInputs.phosphorusKgP > 0 &&
    basinStepThree.receipt.transfers.oceanEcologyBoundaryInputs.oxygenKgO2 > 0,
  'basin receipt aggregates every delivered ocean biogeochemistry boundary input');
  assert.ok(basinStepThree.receipt.storage.finalEstuaryStorage.carbonKgC > 0 &&
    basinStepThree.receipt.storage.finalEstuaryStorage.nitrogenKgN > 0 &&
    basinStepThree.receipt.storage.finalEstuaryStorage.phosphorusKgP > 0,
  'estuary sediment C/N/P survives as persistent basin state');
  const basinIntegrityAudit = systemAudit.auditFoundationSystem({
    column: basinStepThree.columns[2],
    basinRoutingReceipt: basinStepThree.receipt
  });
  assert.equal(basinIntegrityAudit.counts.fail, 0,
    `the read-only audit accepts the loaded river/estuary/ocean/atmosphere/plant closure: ${JSON.stringify({ failures: basinIntegrityAudit.checks.filter(item => item.status === 'FAIL'), truth: basinStepThree.receipt.truth, plants: basinStepThree.receipt.floodplainPlantMatterReceipts.map(entry => ({ reachId: entry.reachId, donorCellId: entry.donorCellId, sender: entry.landEcologySenderReceiptDigest, transferIds: entry.transferIds })), senders: basinStepThree.receipt.landEcologySubgridDebitReceipts.map(entry => ({ donorCellId: entry.donorCellId, digest: entry.digest, allocations: entry.allocations })) })}`);
  assert.equal(basinIntegrityAudit.checks.find(item =>
    item.id === 'basin-routing-receipt').status, 'PASS');
  assert.equal(basinIntegrityAudit.checks.find(item =>
    item.id === 'end-to-end-alkalinity-ledger').status, 'PASS',
  'current basin evidence independently passes the end-to-end alkalinity owner, route, reaction and residual audit');
  assert.equal(basinIntegrityAudit.checks.find(item =>
    item.id === 'floodplain-exchange-receipts').status, 'PASS',
  'current basin evidence includes audited floodplain exchange receipts');
  assert.equal(basinIntegrityAudit.checks.find(item =>
    item.id === 'floodplain-habitat-receipts').status, 'PASS',
  'current basin evidence includes audited read-only floodplain habitat memory');
  assert.equal(basinIntegrityAudit.checks.find(item =>
    item.id === 'flood-event-history-receipts').status, 'PASS',
  'current basin evidence includes audited bounded flood-event chronology');
  assert.equal(basinIntegrityAudit.checks.find(item =>
    item.id === 'floodplain-succession-receipts').status, 'PASS',
  'current basin evidence includes audited, habitat- and event-bound floodplain succession');
  assert.equal(basinIntegrityAudit.checks.find(item =>
    item.id === 'floodplain-plant-matter-receipts').status, 'PASS',
  'current basin evidence includes audited sender-backed floodplain plant C/N matter');
  const inflatedPlantSenderToleranceReceipt = JSON.parse(JSON.stringify(
    basinStepThree.receipt));
  inflatedPlantSenderToleranceReceipt.landEcologySubgridDebitReceipts[0]
    .closure.numericToleranceKg.carbonKgC *= 10;
  const inflatedPlantSenderToleranceAudit = systemAudit.auditFoundationSystem({
    column: basinStepThree.columns[0],
    basinRoutingReceipt: inflatedPlantSenderToleranceReceipt
  });
  assert.equal(inflatedPlantSenderToleranceAudit.checks.find(item =>
    item.id === 'floodplain-plant-matter-receipts').status, 'FAIL',
  'the audit rejects an inflated sender tolerance even when the measured residual and green truth flags are left untouched');
  assert.equal(basinIntegrityAudit.checks.find(item =>
    item.id === 'floodplain-plant-resources-receipts').status, 'PASS',
  'current basin evidence includes audited floodplain-backed plant P/tissue-water ownership');
  assert.equal(basinIntegrityAudit.checks.find(item =>
    item.id === 'floodplain-decomposition-receipts').status, 'PASS',
  'current basin evidence includes audited resource-backed detrital C/N/P return');
  const inflatedDetritalReturnToleranceReceipt = JSON.parse(JSON.stringify(
    basinStepThree.receipt));
  assert.ok(inflatedDetritalReturnToleranceReceipt
    .floodplainDetritalReturnCreditReceipts.length > 0,
  'the basin fixture contains a detrital-return receiver receipt to audit');
  inflatedDetritalReturnToleranceReceipt
    .floodplainDetritalReturnCreditReceipts[0].closure
    .numericToleranceKg.carbonKgC *= 10;
  const inflatedDetritalReturnToleranceAudit = systemAudit
    .auditFoundationSystem({
      column: basinStepThree.columns[0],
      basinRoutingReceipt: inflatedDetritalReturnToleranceReceipt
    });
  assert.equal(inflatedDetritalReturnToleranceAudit.checks.find(item =>
    item.id === 'floodplain-decomposition-receipts').status, 'FAIL',
  'the independent audit rejects an inflated receiver tolerance while its residual and green truth flags remain untouched');
  assert.equal(basinIntegrityAudit.checks.find(item =>
    item.id === 'floodplain-respiration-receipts').status, 'PASS',
  'current basin evidence includes audited local oxygen-limited DOC respiration');
  assert.equal(basinIntegrityAudit.checks.find(item =>
    item.id === 'floodplain-denitrification-receipts').status, 'PASS',
  'current basin evidence includes audited oxygen-gated floodplain denitrification and paired atmosphere ownership');
  const reactionToleranceTamperCases = [
    {
      collection: 'floodplainAerobicMineralizationReceipts',
      auditId: 'floodplain-respiration-receipts',
      label: 'aerobic mineralization'
    },
    {
      collection: 'floodplainDenitrificationReactionReceipts',
      auditId: 'floodplain-denitrification-receipts',
      label: 'denitrification'
    },
    {
      collection: 'floodplainNitrificationReactionReceipts',
      auditId: 'floodplain-nitrification-receipts',
      label: 'nitrification'
    },
    {
      collection: 'floodplainGasExchangeReceipts',
      auditId: 'floodplain-atmosphere-gas-exchange-receipts',
      label: 'floodplain gas exchange'
    }
  ];
  for (const tamperCase of reactionToleranceTamperCases) {
    const tamperedReceipt = JSON.parse(JSON.stringify(
      basinStepThree.receipt));
    assert.ok(tamperedReceipt[tamperCase.collection].length > 0,
      `the basin fixture contains a ${tamperCase.label} owner receipt to audit`);
    const ownerReceipt = tamperedReceipt[tamperCase.collection][0];
    const toleranceKey = Object.keys(
      ownerReceipt.closure.numericToleranceKg)[0];
    ownerReceipt.closure.numericToleranceKg[toleranceKey] *= 10;
    const tamperedAudit = systemAudit.auditFoundationSystem({
      column: basinStepThree.columns[0],
      basinRoutingReceipt: tamperedReceipt
    });
    assert.equal(tamperedAudit.checks.find(item =>
      item.id === tamperCase.auditId).status, 'FAIL',
    `the independent audit rejects an inflated ${tamperCase.label} owner tolerance while the measured residual and green truth flags remain untouched`);
  }
  assert.ok(basinStepThree.receipt.floodplainReceipts.length > 0 &&
    basinStepThree.receipt.floodplainReceipts.every(entry =>
      entry.truth.conservationClosed === true),
  'loaded persistent reach states publish conservative floodplain observations');
  assert.ok(basinStepThree.receipt.floodplainHabitatReceipts.length > 0 &&
    basinStepThree.receipt.floodplainHabitatReceipts.every(entry =>
      entry.truth.floodplainMaterialMutated === false &&
      entry.truth.fractionsNormalized === true &&
      entry.truth.potentialHabitatOnly === true),
  'loaded reaches publish normalized potential habitat without mutating floodplain material');
  assert.ok(basinStepThree.receipt.floodEventReceipts.length > 0 &&
    basinStepThree.receipt.floodEventReceipts.every(entry =>
      entry.truth.floodplainMaterialMutated === false &&
      entry.truth.archiveBounded === true &&
      entry.floodplainExchangeDigest),
  'loaded reaches bind bounded event transitions to exact floodplain exchange evidence without mutating matter');
  assert.ok(basinStepThree.receipt.floodplainSuccessionReceipts.length > 0 &&
    basinStepThree.receipt.floodplainSuccessionReceipts.every(entry =>
      entry.truth.ledgersClosed === true &&
      entry.truth.competitionCapacityHonored === true &&
      entry.truth.materialAuthority === false &&
      entry.floodplainHabitatReceiptDigest &&
      entry.floodEventTransitionReceiptDigest &&
      entry.guildFlows.length === floodplainSuccession.FLOODPLAIN_SUCCESSION_GUILDS.length),
  'loaded reaches publish finite guild demography bound to the exact habitat and disturbance observations');
  assert.ok(basinStepThree.receipt.floodplainPlantMatterReceipts.length > 0 &&
    basinStepThree.receipt.floodplainPlantMatterReceipts.every(entry =>
      entry.truth.carbonAndNitrogenClosed === true &&
      entry.truth.scaleAwareFloatingPointClosure === true &&
      entry.truth.perMaterialChannelNumericBounds === true &&
      entry.truth.measuredResidualsPreserved === true &&
      entry.truth.fixedAbsoluteToleranceOnly === false &&
      entry.truth.plantPhosphorusOwnership === false &&
      entry.guildFlows.length ===
        floodplainSuccession.FLOODPLAIN_SUCCESSION_GUILDS.length) &&
    basinStepThree.receipt.landEcologySubgridDebitReceipts.every(entry =>
      entry.truth.persistentLandEcologySenderDebited === true &&
      entry.truth.carbonAndNitrogenClosed === true &&
      entry.truth.phosphorusTransferred === false) &&
    basinStepThree.receipt.truth
      .exactLandEcologyFloodplainPlantTransferIds === true,
  'each materialized reach credit is paired to the exact persistent land-cell debit');
  assert.ok(basinStepThree.receipt.floodplainPlantResourcesReceipts.length > 0 &&
    basinStepThree.receipt.floodplainPlantResourcesReceipts.every(entry =>
      entry.truth.resourceLedgersClosed === true &&
      entry.truth.scaleAwareFloatingPointClosure === true &&
      entry.truth.perMaterialChannelNumericBounds === true &&
      entry.truth.measuredResidualsPreserved === true &&
      entry.truth.fixedAbsoluteToleranceOnly === false &&
      entry.truth.independentBoundaryCreation === false &&
      entry.guildFlows.length ===
        floodplainSuccession.FLOODPLAIN_SUCCESSION_GUILDS.length) &&
    basinStepThree.receipt.floodplainPlantResourceDebitReceipts.every(entry =>
      entry.truth.waterAndPhosphorusClosed === true &&
      entry.truth.plantUptakeCreatesResources === false) &&
    basinStepThree.receipt.floodplainPlantWaterReturnReceipts.every(entry =>
      entry.truth.waterClosed === true &&
      entry.truth.mortalityWaterCreatesWater === false) &&
    basinStepThree.receipt.truth
      .exactFloodplainPlantResourceTransferIds === true &&
    basinStepThree.receipt.truth
      .jointCarbonNitrogenPhosphorusWaterLimitedPlantGrowth === true,
  'each plant P/water credit is paired to exact local floodplain uptake and mortality-water return receipts');
  assert.ok(basinStepThree.receipt.floodplainDecompositionReceipts.length > 0 &&
    basinStepThree.receipt.floodplainDecompositionReceipts.length ===
      basinStepThree.receipt
        .floodplainPlantDetritusMatterDebitReceipts.length &&
    basinStepThree.receipt.floodplainDecompositionReceipts.length ===
      basinStepThree.receipt
        .floodplainPlantDetritusResourceDebitReceipts.length &&
    basinStepThree.receipt.floodplainDecompositionReceipts.length ===
      basinStepThree.receipt.floodplainDetritalReturnCreditReceipts.length &&
    basinStepThree.receipt.floodplainDecompositionReceipts.every(entry =>
      entry.truth.exactSenderReceiverTransferIds === true &&
      entry.truth.carbonNitrogenPhosphorusClosed === true &&
      entry.truth.onlyResourceBackedDetritusEligible === true &&
      entry.truth.atmosphericRespirationModeled === false &&
      entry.truth.oxygenConsumptionModeled === false) &&
    basinStepThree.receipt.floodplainDetritalReturnCreditReceipts.every(
      entry => entry.closure.policy.schema === floodplain
        .FLOODPLAIN_DETRITAL_RETURN_MASS_CLOSURE_POLICY_SCHEMA &&
        entry.truth.scaleAwareFloatingPointClosure === true &&
        entry.truth.perMaterialChannelNumericBounds === true &&
        entry.truth.measuredResidualsPreserved === true &&
        entry.truth.fixedAbsoluteToleranceOnly === false) &&
    basinStepThree.receipt.truth.persistentFloodplainDecomposition === true &&
    basinStepThree.receipt.truth
      .floodplainDetritalReturnScaleAwareNumericClosure === true &&
    basinStepThree.receipt.truth
      .floodplainDetritalReturnPerMaterialChannelNumericBounds === true &&
    basinStepThree.receipt.truth
      .floodplainDetritalReturnMeasuredResidualsPreserved === true &&
    basinStepThree.receipt.truth
      .exactFloodplainDecompositionTransferIds === true &&
    basinStepThree.receipt.truth
      .floodplainDecompositionLedgersClosed === true &&
    basinStepThree.receipt.truth
      .onlyResourceBackedFloodplainDetritusDecomposes === true,
  'every loaded reach exposes exact paired detritus sender and local floodplain receiver evidence without inventing respiration or oxygen demand');
  assert.ok(basinStepThree.receipt.floodplainRespirationReceipts.length > 0 &&
    basinStepThree.receipt.floodplainRespirationReceipts.length ===
      basinStepThree.receipt
        .floodplainAerobicMineralizationReceipts.length &&
    basinStepThree.receipt.floodplainRespirationReceipts.every(entry => {
      const reaction = basinStepThree.receipt
        .floodplainAerobicMineralizationReceipts.find(candidate =>
          candidate.reachId === entry.reachId);
      return reaction?.digest === entry.mineralizationReceiptDigest &&
        reaction.truth.localDocToDicCarbonClosed === true &&
        reaction.truth.dissolvedOxygenConsumptionClosed === true &&
        entry.truth.atmosphericGasExchangeModeled === false &&
        entry.truth.anaerobicPathwayModeled === false;
    }) &&
    basinStepThree.receipt.truth
      .persistentFloodplainAerobicRespiration === true &&
    basinStepThree.receipt.truth
      .floodplainRespirationEvidenceBound === true &&
    basinStepThree.receipt.truth
      .floodplainRespirationChemistryReceiptsClosed === true &&
    basinStepThree.receipt.truth
      .floodplainRespirationCarbonAndOxygenLedgersClosed === true,
  'every loaded reach binds persistent respiration memory to an exact closed local DOC/DIC/O2 chemistry receipt');
  assert.ok(basinStepThree.receipt
    .floodplainDenitrificationProcessReceipts.length > 0 &&
    basinStepThree.receipt.floodplainDenitrificationReactionReceipts
      .every(entry =>
        entry.truth.dissolvedNitrateNitrogenSenderDebited === true &&
        entry.truth.dissolvedAmmoniumNitrogenUntouched === true &&
        entry.truth.alkalinityReceiverCredited === true &&
        entry.truth.denitrificationAlkalinityClosed === true &&
        entry.truth.nitrateSpeciationResolved === true &&
        entry.truth.nitrogenGasBoundaryClosed === true) &&
    basinStepThree.receipt.truth
      .floodplainDenitrificationNitrateSpeciationResolved === true &&
    basinStepThree.receipt.truth
      .floodplainDenitrificationNitrateOnly === true &&
    basinStepThree.receipt.truth
      .floodplainDenitrificationAmmoniumConsumption === false &&
    basinStepThree.receipt.truth
      .floodplainNitrificationReactionModeled === true,
  'every loaded denitrification reaction debits nitrate only and leaves ammonium unchanged beside the independent nitrification organ');
  assert.ok(basinStepThree.receipt
    .floodplainNitrificationProcessReceipts.length > 0 &&
    basinStepThree.receipt.floodplainNitrificationProcessReceipts.length ===
      basinStepThree.receipt
        .floodplainNitrificationReactionReceipts.length &&
    basinStepThree.receipt.floodplainNitrificationProcessReceipts
      .every(entry => {
        const owner = basinStepThree.receipt
          .floodplainNitrificationReactionReceipts.find(candidate =>
            candidate.transferId === entry.transferId);
        return owner?.digest === entry.reactionReceiptDigest &&
          owner.reachId === entry.reachId &&
          entry.truth.ammoniumToNitrateNitrogenClosed === true &&
          entry.truth.dissolvedOxygenConsumptionClosed === true &&
          entry.truth.minimumDissolvedOxygenReserveRequired === true &&
          entry.truth.alkalinityConsumptionClosed === true &&
          entry.truth.alkalinityMaterialOwnerDebited === true &&
          entry.truth.pHFeedbackModeled === false &&
          entry.truth.nitriteIntermediateResolved === false;
      }) &&
    basinStepThree.receipt.truth.persistentFloodplainNitrification ===
      true &&
    basinStepThree.receipt.truth
      .floodplainNitrificationEvidenceBound === true &&
    basinStepThree.receipt.truth
      .floodplainNitrificationNitrogenOxygenAndAlkalinityLedgersClosed ===
      true &&
    basinStepThree.receipt.truth
      .floodplainNitrificationMinimumOxygenReserveHonored === true &&
    [
      basinStepThree.receipt.conservation
        .floodplainNitrificationNitrogenResidualKgN,
      basinStepThree.receipt.conservation
        .floodplainNitrificationOxygenResidualKgO2,
      basinStepThree.receipt.conservation
        .floodplainNitrificationOxygenStoichiometryResidualKgO2,
      basinStepThree.receipt.conservation
        .floodplainNitrificationAlkalinityOwnerResidualKgCaCO3Eq,
      basinStepThree.receipt.conservation
        .floodplainNitrificationAlkalinityStoichiometryResidualKgCaCO3Eq
    ].every(value => Math.abs(value) < 1),
  'every loaded reach binds nitrification memory to an exact local ammonium/nitrate/O2/alkalinity reaction');
  assert.ok(basinStepThree.receipt
    .floodplainGasExchangeProcessReceipts.length ===
      basinStepThree.receipt.floodplainRespirationReceipts.length &&
    basinStepThree.receipt.floodplainGasExchangeReceipts.length ===
      basinStepThree.receipt
        .atmosphereFloodplainGasExchangeReceipts.length &&
    basinStepThree.receipt.floodplainGasExchangeProcessReceipts
      .every(entry => {
        if (entry.atmosphereCellId === null) {
          return entry.exchange.carbonToAtmosphereKgC === 0 &&
            entry.exchange.oxygenToFloodplainKgO2 === 0;
        }
        const floodplainOwner = basinStepThree.receipt
          .floodplainGasExchangeReceipts.find(candidate =>
            candidate.exchangeId === entry.exchangeId);
        const atmosphereOwner = basinStepThree.receipt
          .atmosphereFloodplainGasExchangeReceipts.find(candidate =>
            candidate.exchangeId === entry.exchangeId);
        return floodplainOwner?.digest ===
            entry.floodplainReceiptDigest &&
          atmosphereOwner?.digest === entry.atmosphereReceiptDigest &&
          floodplainOwner?.reachId === entry.reachId &&
          atmosphereOwner?.atmosphereCellId === entry.atmosphereCellId &&
          entry.truth.ownerLedgersClosed === true;
      }) &&
    basinStepThree.receipt.truth
      .persistentFloodplainAtmosphereGasExchange === true &&
    basinStepThree.receipt.truth
      .exactFloodplainAtmosphereGasExchangeIds === true &&
    basinStepThree.receipt.truth
      .floodplainGasExchangeUsesNativeAtmosphereSurfaceLayer === true,
  'each loaded floodplain and its native surface atmosphere cross C/O2 only through exact paired owner receipts while unloaded reaches remain explicit zero-flux observations');
  const previousBasinAuditReceipt = JSON.parse(JSON.stringify(
    basinStepThree.receipt));
  previousBasinAuditReceipt.schema =
    basinRouting.PREVIOUS_BASIN_ROUTING_STEP_SCHEMA;
  const previousBasinAudit = systemAudit.auditFoundationSystem({
    column: basinStepThree.columns[2],
    basinRoutingReceipt: previousBasinAuditReceipt
  });
  assert.equal(previousBasinAudit.checks.find(item =>
    item.id === 'basin-routing-receipt').status, 'NOT_APPLICABLE',
  'v10 pre-plant-matter basin evidence remains legacy rather than being relabeled as current closure');
  assert.equal(previousBasinAudit.checks.find(item =>
    item.id === 'end-to-end-alkalinity-ledger').status, 'NOT_APPLICABLE',
  'v20 basin evidence remains pre-alkalinity rather than being relabelled as R51 evidence');
  assert.equal(previousBasinAudit.checks.find(item =>
    item.id === 'floodplain-exchange-receipts').status, 'NOT_APPLICABLE',
  'v9 evidence cannot be relabeled as a current succession-bound floodplain exchange');
  assert.equal(previousBasinAudit.checks.find(item =>
    item.id === 'floodplain-habitat-receipts').status, 'NOT_APPLICABLE',
  'v9 evidence cannot be relabeled as current succession-bound floodplain habitat memory');
  assert.equal(previousBasinAudit.checks.find(item =>
    item.id === 'flood-event-history-receipts').status, 'NOT_APPLICABLE',
  'v9 evidence cannot be relabeled as succession-bound flood-event chronology');
  assert.equal(previousBasinAudit.checks.find(item =>
    item.id === 'floodplain-succession-receipts').status, 'NOT_APPLICABLE',
  'v10 evidence cannot be relabeled as current material-backed succession');
  assert.equal(previousBasinAudit.checks.find(item =>
    item.id === 'floodplain-plant-matter-receipts').status,
  'NOT_APPLICABLE',
  'v10 evidence cannot be relabeled as observed plant material ownership');
  assert.equal(previousBasinAudit.checks.find(item =>
    item.id === 'floodplain-plant-resources-receipts').status,
  'NOT_APPLICABLE',
  'v11 evidence cannot be relabeled as observed plant P/water ownership');
  assert.equal(previousBasinAudit.checks.find(item =>
    item.id === 'floodplain-decomposition-receipts').status,
  'NOT_APPLICABLE',
  'v13 evidence cannot be relabeled as current respiration-coupled decomposition');
  assert.equal(previousBasinAudit.checks.find(item =>
    item.id === 'floodplain-respiration-receipts').status,
  'NOT_APPLICABLE',
  'v13 evidence cannot be relabeled as observed aerobic respiration');
  assert.equal(previousBasinAudit.checks.find(item =>
    item.id === 'floodplain-denitrification-receipts').status,
  'NOT_APPLICABLE',
  'v17 evidence cannot be relabeled as current temperature-responsive floodplain denitrification');
  assert.equal(previousBasinAudit.checks.find(item =>
    item.id === 'floodplain-nitrification-receipts').status,
  'NOT_APPLICABLE',
  'v19 evidence cannot be relabeled as current floodplain nitrification');
  assert.equal(previousBasinAudit.checks.find(item =>
    item.id === 'floodplain-atmosphere-gas-exchange-receipts').status,
  'NOT_APPLICABLE',
  'v15 evidence cannot be relabeled as bidirectional floodplain-atmosphere gas exchange');
  const malformedCurrentBasinReceipt = JSON.parse(JSON.stringify(
    basinStepOne.receipt));
  delete malformedCurrentBasinReceipt.inletReceipts[0]
    .runoffBiogeochemistrySenderDebit;
  const malformedCurrentBasinAudit = systemAudit.auditFoundationSystem({
    column: basinStepOne.columns[0],
    basinRoutingReceipt: malformedCurrentBasinReceipt
  });
  assert.equal(malformedCurrentBasinAudit.checks.find(item =>
    item.id === 'basin-routing-receipt').status, 'FAIL',
  'a current basin receipt without the land queue sender debit fails audit');
  const malformedAlkalinityBasinReceipt = JSON.parse(JSON.stringify(
    basinStepOne.receipt));
  malformedAlkalinityBasinReceipt.conservation
    .coupledAlkalinityResidualKgCaCO3Eq = 2;
  const malformedAlkalinityBasinAudit = systemAudit.auditFoundationSystem({
    column: basinStepOne.columns[0],
    basinRoutingReceipt: malformedAlkalinityBasinReceipt
  });
  assert.equal(malformedAlkalinityBasinAudit.checks.find(item =>
    item.id === 'end-to-end-alkalinity-ledger').status, 'FAIL',
  'a current basin receipt with a corrupted coupled alkalinity residual fails the dedicated audit');
  const malformedSedimentBasinReceipt = JSON.parse(JSON.stringify(
    basinStepOne.receipt));
  delete malformedSedimentBasinReceipt.inletReceipts[0]
    .runoffSedimentSenderDebit;
  const malformedSedimentBasinAudit = systemAudit.auditFoundationSystem({
    column: basinStepOne.columns[0],
    basinRoutingReceipt: malformedSedimentBasinReceipt
  });
  assert.equal(malformedSedimentBasinAudit.checks.find(item =>
    item.id === 'basin-routing-receipt').status, 'FAIL',
  'a current basin receipt without its finite sediment sender debit fails audit');
  const malformedFloodplainReceipt = JSON.parse(JSON.stringify(
    basinStepThree.receipt));
  malformedFloodplainReceipt.floodplainReceipts[0]
    .truth.conservationClosed = false;
  const malformedFloodplainAudit = systemAudit.auditFoundationSystem({
    column: basinStepThree.columns[0],
    basinRoutingReceipt: malformedFloodplainReceipt
  });
  assert.equal(malformedFloodplainAudit.checks.find(item =>
    item.id === 'floodplain-exchange-receipts').status, 'FAIL',
  'a malformed floodplain conservation claim fails the read-only audit');
  const malformedHabitatReceipt = JSON.parse(JSON.stringify(
    basinStepThree.receipt));
  malformedHabitatReceipt.floodplainHabitatReceipts[0]
    .habitat.fractionsAfter.openWater += .2;
  malformedHabitatReceipt.floodplainHabitatReceipts[0]
    .truth.fractionsNormalized = false;
  const malformedHabitatAudit = systemAudit.auditFoundationSystem({
    column: basinStepThree.columns[0],
    basinRoutingReceipt: malformedHabitatReceipt
  });
  assert.equal(malformedHabitatAudit.checks.find(item =>
    item.id === 'floodplain-habitat-receipts').status, 'FAIL',
  'a malformed habitat mosaic fails the independent read-only audit');
  const roundedHabitatReceipt = JSON.parse(JSON.stringify(
    basinStepThree.receipt));
  roundedHabitatReceipt.floodplainHabitatReceipts[0].status =
    'dry-exposure-observed';
  roundedHabitatReceipt.floodplainHabitatReceipts[0].durationDays =
    .05399375;
  roundedHabitatReceipt.floodplainHabitatReceipts[0].memory
    .observedDaysBefore = .74997083;
  roundedHabitatReceipt.floodplainHabitatReceipts[0].memory
    .observedDaysAfter = .80396459;
  assert.equal(systemAudit.auditFoundationSystem({
    column: basinStepThree.columns[0],
    basinRoutingReceipt: roundedHabitatReceipt
  }).checks.find(item => item.id ===
    'floodplain-habitat-receipts').status, 'PASS',
  'eight-decimal persisted habitat clocks tolerate the exact two-rounding-unit accumulation bound');
  const malformedEventReceipt = JSON.parse(JSON.stringify(
    basinStepThree.receipt));
  malformedEventReceipt.floodEventReceipts[0]
    .observation.materialAfterDigest = 'fnv1a32:corrupt';
  malformedEventReceipt.floodEventReceipts[0]
    .history.archiveCountAfter = 33;
  const malformedEventAudit = systemAudit.auditFoundationSystem({
    column: basinStepThree.columns[0],
    basinRoutingReceipt: malformedEventReceipt
  });
  assert.equal(malformedEventAudit.checks.find(item =>
    item.id === 'flood-event-history-receipts').status, 'FAIL',
  'a material-mutating or over-capacity event claim fails the independent audit');
  const roundedEventReceipt = JSON.parse(JSON.stringify(
    basinStepThree.receipt));
  roundedEventReceipt.floodEventReceipts[0].status =
    'dry-between-events';
  roundedEventReceipt.floodEventReceipts[0].durationDays = .05399375;
  roundedEventReceipt.floodEventReceipts[0].history.observedDaysBefore =
    .74997083;
  roundedEventReceipt.floodEventReceipts[0].history.observedDaysAfter =
    .80396459;
  roundedEventReceipt.floodEventReceipts[0].truth
    .lifecycleTransitionValid = true;
  assert.equal(systemAudit.auditFoundationSystem({
    column: basinStepThree.columns[0],
    basinRoutingReceipt: roundedEventReceipt
  }).checks.find(item => item.id ===
    'flood-event-history-receipts').status, 'PASS',
  'eight-decimal persisted event clocks tolerate the exact two-rounding-unit accumulation bound');
  const malformedSuccessionReceipt = JSON.parse(JSON.stringify(
    basinStepThree.receipt));
  malformedSuccessionReceipt.floodplainSuccessionReceipts[0]
    .guildFlows[0].seed.residualSeedsM2 = 1;
  malformedSuccessionReceipt.floodplainSuccessionReceipts[0]
    .community.after.totalCoverFraction = 1.2;
  malformedSuccessionReceipt.floodplainSuccessionReceipts[0]
    .truth.ledgersClosed = false;
  const malformedSuccessionAudit = systemAudit.auditFoundationSystem({
    column: basinStepThree.columns[0],
    basinRoutingReceipt: malformedSuccessionReceipt
  });
  assert.equal(malformedSuccessionAudit.checks.find(item =>
    item.id === 'floodplain-succession-receipts').status, 'FAIL',
  'an open seed ledger or over-capacity community fails the independent succession audit');
  const malformedPlantMatterReceipt = JSON.parse(JSON.stringify(
    basinStepThree.receipt));
  const plantReceiptWithTransfer = malformedPlantMatterReceipt
    .floodplainPlantMatterReceipts.find(entry =>
      entry.transferIds.length > 0);
  assert.ok(plantReceiptWithTransfer,
    'fixture contains a material-backed receiver transfer to corrupt');
  plantReceiptWithTransfer.landEcologySenderReceiptDigest =
    'fnv1a32:corrupt';
  plantReceiptWithTransfer.guildFlows[0].closure.carbonResidualKgC = 1;
  const malformedPlantMatterAudit = systemAudit.auditFoundationSystem({
    column: basinStepThree.columns[0],
    basinRoutingReceipt: malformedPlantMatterReceipt
  });
  assert.equal(malformedPlantMatterAudit.checks.find(item =>
    item.id === 'floodplain-plant-matter-receipts').status, 'FAIL',
  'a wrong sender digest or open plant ledger fails the independent material audit');
  const inflatedPlantMatterToleranceReceipt = JSON.parse(JSON.stringify(
    basinStepThree.receipt));
  inflatedPlantMatterToleranceReceipt.floodplainPlantMatterReceipts[0]
    .guildFlows[0].closure.numericToleranceKg.carbonKgC *= 10;
  const inflatedPlantMatterToleranceAudit = systemAudit.auditFoundationSystem({
    column: basinStepThree.columns[0],
    basinRoutingReceipt: inflatedPlantMatterToleranceReceipt
  });
  assert.equal(inflatedPlantMatterToleranceAudit.checks.find(item =>
    item.id === 'floodplain-plant-matter-receipts').status, 'FAIL',
  'a self-authored inflated plant-matter tolerance fails independent policy recomputation');
  const emptyBoundPlantMatterReceipt = JSON.parse(JSON.stringify(
    basinStepThree.receipt));
  const emptyBoundPlantEntry = emptyBoundPlantMatterReceipt
    .floodplainPlantMatterReceipts[0];
  const emptyBoundPlantSender = emptyBoundPlantMatterReceipt
    .landEcologySubgridDebitReceipts.find(entry =>
      entry.donorCellId === emptyBoundPlantEntry.donorCellId);
  assert.ok(emptyBoundPlantSender,
    'plant-matter audit fixture resolves the reach donor cell');
  emptyBoundPlantSender.allocations = emptyBoundPlantSender.allocations
    .filter(allocation => allocation.reachId !== emptyBoundPlantEntry.reachId);
  emptyBoundPlantEntry.transferIds = [];
  emptyBoundPlantEntry.landEcologySenderReceiptDigest =
    emptyBoundPlantSender.digest;
  emptyBoundPlantEntry.transfers.landEcologyCredits = {
    carbonKgC: 0, nitrogenKgN: 0
  };
  emptyBoundPlantEntry.status = 'plant-matter-maintained';
  assert.equal(systemAudit.auditFoundationSystem({
    column: basinStepThree.columns[0],
    basinRoutingReceipt: emptyBoundPlantMatterReceipt
  }).checks.find(item => item.id ===
    'floodplain-plant-matter-receipts').status, 'PASS',
  'a zero-allocation reach may honestly bind its shared batched donor receipt when that donor contains no allocation for the reach');
  const malformedPlantResourcesReceipt = JSON.parse(JSON.stringify(
    basinStepThree.receipt));
  const plantResourcesWithUptake = malformedPlantResourcesReceipt
    .floodplainPlantResourcesReceipts.find(entry =>
      entry.uptakeTransferIds.length > 0);
  assert.ok(plantResourcesWithUptake,
    'fixture contains a floodplain-backed plant resource transfer to corrupt');
  plantResourcesWithUptake.floodplainResourceDebitReceiptDigest =
    'fnv1a32:corrupt';
  plantResourcesWithUptake.guildFlows[0].closure
    .phosphorusResidualKgP = 1;
  const malformedPlantResourcesAudit = systemAudit.auditFoundationSystem({
    column: basinStepThree.columns[0],
    basinRoutingReceipt: malformedPlantResourcesReceipt
  });
  assert.equal(malformedPlantResourcesAudit.checks.find(item =>
    item.id === 'floodplain-plant-resources-receipts').status, 'FAIL',
  'a wrong floodplain sender digest or open P ledger fails the independent plant-resource audit');
  const inflatedPlantResourceToleranceReceipt = JSON.parse(JSON.stringify(
    basinStepThree.receipt));
  inflatedPlantResourceToleranceReceipt.floodplainPlantResourcesReceipts[0]
    .guildFlows[0].closure.numericToleranceKg.liveWaterKg *= 10;
  const inflatedPlantResourceToleranceAudit = systemAudit
    .auditFoundationSystem({
      column: basinStepThree.columns[0],
      basinRoutingReceipt: inflatedPlantResourceToleranceReceipt
    });
  assert.equal(inflatedPlantResourceToleranceAudit.checks.find(item =>
    item.id === 'floodplain-plant-resources-receipts').status, 'FAIL',
  'the independent audit rejects a receipt that inflates a per-channel numeric tolerance');
  const malformedDecompositionReceipt = JSON.parse(JSON.stringify(
    basinStepThree.receipt));
  malformedDecompositionReceipt.floodplainDecompositionReceipts[0]
    .matterDebitReceiptDigest = 'fnv1a32:corrupt';
  malformedDecompositionReceipt.floodplainDecompositionReceipts[0]
    .truth.carbonNitrogenPhosphorusClosed = false;
  const malformedDecompositionAudit = systemAudit.auditFoundationSystem({
    column: basinStepThree.columns[0],
    basinRoutingReceipt: malformedDecompositionReceipt
  });
  assert.equal(malformedDecompositionAudit.checks.find(item =>
    item.id === 'floodplain-decomposition-receipts').status, 'FAIL',
  'a wrong sender digest or open detrital ledger fails the independent decomposition audit');
  const malformedRespirationReceipt = JSON.parse(JSON.stringify(
    basinStepThree.receipt));
  malformedRespirationReceipt.floodplainRespirationReceipts[0]
    .mineralizationReceiptDigest = 'fnv1a32:corrupt';
  malformedRespirationReceipt.floodplainAerobicMineralizationReceipts[0]
    .truth.localDocToDicCarbonClosed = false;
  const malformedRespirationAudit = systemAudit.auditFoundationSystem({
    column: basinStepThree.columns[0],
    basinRoutingReceipt: malformedRespirationReceipt
  });
  assert.equal(malformedRespirationAudit.checks.find(item =>
    item.id === 'floodplain-respiration-receipts').status, 'FAIL',
  'a wrong reaction digest or open local DOC/DIC ledger fails the independent respiration audit');
  const malformedDenitrificationReceipt = JSON.parse(JSON.stringify(
    basinStepThree.receipt));
  const malformedDenitrificationProcess = malformedDenitrificationReceipt
    .floodplainDenitrificationProcessReceipts.find(entry =>
      entry.atmosphereCellId !== null);
  assert.ok(malformedDenitrificationProcess,
    'fixture contains loaded paired floodplain denitrification evidence to corrupt');
  malformedDenitrificationProcess.atmosphereReceiptDigest =
    'fnv1a32:corrupt';
  malformedDenitrificationReceipt
    .atmosphereFloodplainDenitrificationReceipts.find(entry =>
      entry.transferId === malformedDenitrificationProcess.transferId)
    .truth.exactTransferIdentity = false;
  const malformedDenitrificationAudit = systemAudit.auditFoundationSystem({
    column: basinStepThree.columns[0],
    basinRoutingReceipt: malformedDenitrificationReceipt
  });
  assert.equal(malformedDenitrificationAudit.checks.find(item =>
    item.id === 'floodplain-denitrification-receipts').status, 'FAIL',
  'a wrong atmosphere digest or false exact identity fails the independent denitrification audit');
  const malformedNitrificationReceipt = JSON.parse(JSON.stringify(
    basinStepThree.receipt));
  malformedNitrificationReceipt.floodplainNitrificationProcessReceipts[0]
    .reactionReceiptDigest = 'fnv1a32:corrupt';
  malformedNitrificationReceipt.floodplainNitrificationReactionReceipts[0]
    .closure.stoichiometricOxygenResidualKgO2 = 1;
  const malformedNitrificationAudit = systemAudit.auditFoundationSystem({
    column: basinStepThree.columns[0],
    basinRoutingReceipt: malformedNitrificationReceipt
  });
  assert.equal(malformedNitrificationAudit.checks.find(item =>
    item.id === 'floodplain-nitrification-receipts').status, 'FAIL',
  'a wrong reaction digest or open oxygen stoichiometry fails the independent nitrification audit');
  const malformedGasExchangeReceipt = JSON.parse(JSON.stringify(
    basinStepThree.receipt));
  assert.ok(malformedGasExchangeReceipt
    .floodplainGasExchangeProcessReceipts.some(entry =>
      entry.atmosphereCellId !== null),
  'fixture contains a loaded paired floodplain-atmosphere exchange to corrupt');
  const malformedGasProcess = malformedGasExchangeReceipt
    .floodplainGasExchangeProcessReceipts.find(entry =>
      entry.atmosphereCellId !== null);
  malformedGasProcess.atmosphereReceiptDigest = 'fnv1a32:corrupt';
  malformedGasExchangeReceipt.atmosphereFloodplainGasExchangeReceipts
    .find(entry => entry.exchangeId === malformedGasProcess.exchangeId)
    .truth.oxygenSenderDebited = false;
  const malformedGasExchangeAudit = systemAudit.auditFoundationSystem({
    column: basinStepThree.columns[0],
    basinRoutingReceipt: malformedGasExchangeReceipt
  });
  assert.equal(malformedGasExchangeAudit.checks.find(item =>
    item.id === 'floodplain-atmosphere-gas-exchange-receipts').status,
  'FAIL',
  'a wrong owner digest or false surface-oxygen debit fails the independent gas-exchange audit');
  const inflatedAtmosphereGasToleranceReceipt = JSON.parse(JSON.stringify(
    basinStepThree.receipt));
  inflatedAtmosphereGasToleranceReceipt
    .atmosphereFloodplainGasExchangeReceipts[0].conservation
    .numericToleranceKg.carbonResidualKgC *= 10;
  const inflatedAtmosphereGasToleranceAudit = systemAudit
    .auditFoundationSystem({
      column: basinStepThree.columns[0],
      basinRoutingReceipt: inflatedAtmosphereGasToleranceReceipt
    });
  const inflatedAtmosphereGasToleranceCheck =
    inflatedAtmosphereGasToleranceAudit.checks.find(item =>
      item.id === 'floodplain-atmosphere-gas-exchange-receipts');
  assert.ok(inflatedAtmosphereGasToleranceCheck.status === 'FAIL' &&
    inflatedAtmosphereGasToleranceCheck.evidence.criteria
      .atmosphereOwnerNumericFailures.length > 0,
  'the independent audit rejects an atmosphere-owner receipt that inflates a per-identity numeric tolerance');
  const floatingPointBasinReceipt = JSON.parse(JSON.stringify(
    basinStepThree.receipt));
  floatingPointBasinReceipt.conservation.coupledOxygenResidualKgO2 =
    .003906;
  assert.equal(systemAudit.auditFoundationSystem({
    column: basinStepThree.columns[0],
    basinRoutingReceipt: floatingPointBasinReceipt
  }).checks.find(item => item.id === 'basin-routing-receipt').status, 'PASS',
  'sub-kilogram floating-point residue remains inside the declared basin tolerance at planetary mass scale');
  floatingPointBasinReceipt.conservation.coupledOxygenResidualKgO2 = 1.01;
  assert.equal(systemAudit.auditFoundationSystem({
    column: basinStepThree.columns[0],
    basinRoutingReceipt: floatingPointBasinReceipt
  }).checks.find(item => item.id === 'basin-routing-receipt').status, 'FAIL',
  'a basin residual outside the declared one-kilogram tolerance still fails audit');
  assert.ok(basinStepThree.receipt.transfers.estuaryBoundaryFluxes
    .oxygenConsumptionKgO2 > 0,
  'oxygen consumption is explicit instead of disappearing from the coupled ledger');
  assert.ok(Math.abs(basinStepThree.receipt.conservation.carbonResidualKgC) < 1 &&
    Math.abs(basinStepThree.receipt.conservation.nitrogenResidualKgN) < 1 &&
    Math.abs(basinStepThree.receipt.conservation.phosphorusResidualKgP) < 1 &&
    Math.abs(basinStepThree.receipt.conservation.oxygenResidualKgO2) < 1,
  'river-mouth ocean C/N/P/O2 credits close against basin boundary inputs');
  assert.ok(Math.abs(basinStepThree.receipt.conservation.coupledCarbonResidualKgC) < 1 &&
    Math.abs(basinStepThree.receipt.conservation.coupledNitrogenResidualKgN) < .01 &&
    Math.abs(basinStepThree.receipt.conservation.coupledPhosphorusResidualKgP) < 1 &&
    Math.abs(basinStepThree.receipt.conservation.coupledOxygenResidualKgO2) < 1,
  'river, ocean and both atmospheric denitrification-source nitrogen ledgers close without hiding a missing source inside the kilogram tolerance');
  assert.ok(Math.abs(basinStepThree.receipt.conservation
      .loadedLandFloodplainPlantCarbonResidualKgC) < 1 &&
    Math.abs(basinStepThree.receipt.conservation
      .loadedLandFloodplainPlantNitrogenResidualKgN) < 1,
  'loaded land live biomass plus persistent floodplain plant C/N closes without double counting');
  assert.ok(Math.abs(basinStepThree.receipt.conservation
      .plantResourceWaterResidualKg) < 1 &&
    Math.abs(basinStepThree.receipt.conservation
      .plantResourcePhosphorusResidualKgP) < 1,
  'free plus live-tissue water and aquatic plus plant phosphorus close across the loaded basin');
  assert.ok(Math.abs(basinStepThree.receipt.conservation
      .detritalReturnCarbonResidualKgC) < 1 &&
    Math.abs(basinStepThree.receipt.conservation
      .detritalReturnNitrogenResidualKgN) < 1 &&
    Math.abs(basinStepThree.receipt.conservation
      .detritalReturnPhosphorusResidualKgP) < 1 &&
    Math.abs(basinStepThree.receipt.conservation
      .detritalSupportedCarbonReferenceResidualKgC) < 1,
  'plant detritus sender debits, local floodplain C/N/P credits, and non-owning supported-carbon references close across the loaded basin');
  assert.ok(Math.abs(basinStepThree.receipt.conservation
      .floodplainDocToDicCarbonResidualKgC) < 1 &&
    Math.abs(basinStepThree.receipt.conservation
      .floodplainOxygenConsumptionResidualKgO2) < 1 &&
    Math.abs(basinStepThree.receipt.conservation
      .floodplainOxygenStoichiometryResidualKgO2) < 1,
  'local floodplain DOC debit, DIC credit and dissolved-oxygen consumption close their coupled respiration ledgers');
  assert.ok(Math.abs(basinStepThree.receipt.conservation
      .floodplainDenitrificationCarbonResidualKgC) < 1 &&
    Math.abs(basinStepThree.receipt.conservation
      .floodplainDenitrificationNitrogenReactionResidualKgN) < 1 &&
    Math.abs(basinStepThree.receipt.conservation
      .floodplainAtmosphereDenitrificationTransferResidualKgN) < 1 &&
    Math.abs(basinStepThree.receipt.conservation
      .floodplainDenitrificationOwnerResidualKgN) < 1 &&
    Math.abs(basinStepThree.receipt.conservation
      .atmosphereDenitrificationOwnerResidualKgN) < 1,
  'floodplain DOC/DIC, DIN/N2 reaction, cross-owner transfer and both nitrogen owner ledgers close');
  assert.ok(['Clay', 'Silt', 'Sand', 'Gravel'].every(grain =>
    Math.abs(basinStepThree.receipt.conservation[
      `runoff${grain}ResidualKg`]) < 1 &&
    Math.abs(basinStepThree.receipt.conservation[
      `river${grain}ResidualKg`]) < 1 &&
    Math.abs(basinStepThree.receipt.conservation[
      `coastal${grain}ResidualKg`]) < 1 &&
    Math.abs(basinStepThree.receipt.conservation[
      `coupled${grain}ResidualKg`]) < 1),
  'land runoff, river suspended/bed storage and coastal sediment close a coupled ledger by grain');
  assert.equal(basinStepThree.receipt.truth
    .parameterizedRiverBiogeochemistryBoundary, false);
  assert.equal(basinStepThree.receipt.truth
    .upstreamRiverChemistryReservoirs, true);
  assert.equal(basinStepThree.receipt.truth.reachChemistrySenderDebits, true);
  assert.equal(basinStepThree.receipt.truth.persistentEstuarySedimentReservoirs,
    true);
  assert.equal(basinStepThree.receipt.truth
    .explicitEstuaryAtmosphericGasReceiver, true);
  assert.equal(mouthReceipt.oceanEcologyBoundaryInput.truth.senderNutrientsDebited,
    true);
  const decoratedBasin = basinEngine.decorateSector(basinSector, 'temperate');
  assert.equal(decoratedBasin.truth.statefulBasinRouting, true, 'streamed hydrology exposes persistent basin state without replacing canonical reaches');
  assert.ok(decoratedBasin.rivers.every(reach => Number.isFinite(reach.channelStorageKg) &&
    Number.isFinite(reach.routedDischargeM3s) &&
    Object.values(reach.channelChemistry).every(Number.isFinite) &&
    Number.isFinite(reach.floodplain.waterKg) &&
    Number.isFinite(reach.floodplain.totalSedimentKg) &&
    reach.floodEvents.archiveLimit === 32 &&
    Array.isArray(reach.floodEvents.recentEvents) &&
    reach.floodEvents.recentEvents.length <= reach.floodEvents.archiveLimit &&
    Number.isFinite(reach.floodplainHabitat.rollingHydroperiod30d) &&
    Math.abs(Object.values(reach.floodplainHabitat.fractions)
      .reduce((sum, value) => sum + value, 0) - 1) < 1e-9 &&
    reach.floodplainSuccession.maximumTotalCoverFraction === .98 &&
    Object.keys(reach.floodplainSuccession.guilds).length ===
      floodplainSuccession.FLOODPLAIN_SUCCESSION_GUILDS.length &&
    reach.floodplainSuccession.totalCoverFraction <= .98 &&
    reach.floodplainSuccession.truth.materialAuthority === false &&
    reach.floodplainSuccession.truth.speciesOccupancyState === false &&
    Object.keys(reach.floodplainPlantMatter.guilds).length ===
      floodplainSuccession.FLOODPLAIN_SUCCESSION_GUILDS.length &&
    Object.values(reach.floodplainPlantMatter.total)
      .every(Number.isFinite) &&
    reach.floodplainPlantMatter.truth
      .pairedLandEcologySubgridPartitionRequired === true &&
    reach.floodplainPlantMatter.truth.plantPhosphorusOwnership === false &&
    Object.keys(reach.floodplainPlantResources.guilds).length ===
      floodplainSuccession.FLOODPLAIN_SUCCESSION_GUILDS.length &&
    Object.values(reach.floodplainPlantResources.total)
      .every(Number.isFinite) &&
    reach.floodplainPlantResources.truth
      .persistentPlantPhosphorusAndTissueWater === true &&
    reach.floodplainPlantResources.truth
      .resourceBackedCarbonReferenceOwnsCarbon === false &&
    Number.isFinite(reach.floodplainDecomposition
      .observedDecompositionDays) &&
    Number.isFinite(reach.floodplainDecomposition
      .cumulativeFloodplainReturn.carbonKgC) &&
    Number.isFinite(reach.floodplainDecomposition
      .cumulativeFloodplainReturn.nitrogenKgN) &&
    Number.isFinite(reach.floodplainDecomposition
      .cumulativeFloodplainReturn.phosphorusKgP) &&
    reach.floodplainDecomposition.truth.materialOwnership === false &&
    reach.floodplainDecomposition.truth
      .onlyResourceBackedDetritusEligible === true &&
    Number.isFinite(reach.floodplainRespiration
      .observedRespirationDays) &&
    Number.isFinite(reach.floodplainRespiration
      .oxygenLimitedDays) &&
    Object.values(reach.floodplainRespiration
      .cumulativeMineralization).every(Number.isFinite) &&
    reach.floodplainRespiration.truth.chemistryOwnership === false &&
    reach.floodplainRespiration.truth.oxygenLimited === true &&
    reach.floodplainRespiration.truth
      .atmosphericGasExchangeModeled === false &&
    Number.isFinite(reach.floodplainDenitrification
      .observedDenitrificationDays) &&
    Number.isFinite(reach.floodplainDenitrification
      .atmosphereUnavailableDays) &&
    Number.isFinite(reach.floodplainDenitrification
      .temperatureConstrainedDays) &&
    Object.values(reach.floodplainDenitrification.cumulativeReaction)
      .every(Number.isFinite) &&
    Number.isFinite(reach.floodplainDenitrification.lastActivity
      .waterTemperatureC) &&
    Number.isFinite(reach.floodplainDenitrification.lastActivity
      .temperatureResponseFactor) &&
    reach.floodplainDenitrification.truth
      .floodplainChemistryOwnership === false &&
    reach.floodplainDenitrification.truth.oxygenGated === true &&
    reach.floodplainDenitrification.truth
      .surfaceTemperatureProxyResponsive === true &&
    reach.floodplainDenitrification.truth
      .persistentFloodplainWaterTemperatureState === false &&
    reach.floodplainDenitrification.truth
      .nitrateSpeciationResolved === true &&
    reach.floodplainDenitrification.truth
      .nitrateOnlyDenitrification === true &&
    reach.floodplainDenitrification.truth
      .ammoniumConsumedByDenitrification === false &&
    reach.channelNitrogenSpecies &&
    Math.abs(reach.channelNitrogenSpecies.dissolvedInorganicNitrogenKgN -
      reach.channelNitrogenSpecies.nitrateNitrogenKgN -
      reach.channelNitrogenSpecies.ammoniumNitrogenKgN) < 1e-7 &&
    reach.floodplain.nitrogenSpecies &&
    Math.abs(reach.floodplain.nitrogenSpecies
      .dissolvedInorganicNitrogenKgN -
      reach.floodplain.nitrogenSpecies.nitrateNitrogenKgN -
      reach.floodplain.nitrogenSpecies.ammoniumNitrogenKgN) < 1e-7 &&
    Number.isFinite(reach.floodplainGasExchange
      .observedExchangeDays) &&
    Number.isFinite(reach.floodplainGasExchange
      .atmosphereUnavailableDays) &&
    Object.values(reach.floodplainGasExchange.cumulativeExchange)
      .every(Number.isFinite) &&
    reach.floodplainGasExchange.truth
      .floodplainChemistryOwnership === false &&
    reach.floodplainGasExchange.truth
      .atmosphereGasOwnership === false &&
    Object.values(reach.estuaryStorage).every(Number.isFinite)),
  'every loaded reach exposes bounded channel, floodplain material, event history, habitat potential, living succession, plant C/N/P/water, decomposition, respiration, denitrification, gas exchange and estuary diagnostics');
  const basinSave = basinEngine.snapshot();
  const restoredBasin = new basinRouting.BasinRoutingEngine({ maximumReachStates: 64, state: basinSave });
  assert.deepEqual(restoredBasin.snapshot(), basinSave, 'river reach storage, clocks and latest receipts survive exact restore');

  const previousNumericReceiptSave = JSON.parse(JSON.stringify(basinSave));
  previousNumericReceiptSave.schema =
    basinRouting.PREVIOUS_BASIN_ROUTING_ENGINE_SCHEMA;
  for (const entry of previousNumericReceiptSave.receipts) {
    entry.receipt.schema = basinRouting.PREVIOUS_BASIN_ROUTING_STEP_SCHEMA;
  }
  const previousNumericReceiptProfiles = JSON.parse(JSON.stringify(
    previousNumericReceiptSave.profiles));
  const migratedNumericReceiptBasin = new basinRouting.BasinRoutingEngine({
    maximumReachStates: 64,
    state: previousNumericReceiptSave
  });
  assert.deepEqual(migratedNumericReceiptBasin.snapshot().profiles,
    previousNumericReceiptProfiles,
  'v27-to-v28 migration preserves every reach owner and clock');
  assert.equal(migratedNumericReceiptBasin.status('temperate').receipt, null,
    'v27-to-v28 migration discards v26 receipts rather than inventing the R62 atmosphere-owner closure policy');

  const mismatchedRestoredClockSave = JSON.parse(JSON.stringify(basinSave));
  mismatchedRestoredClockSave.schema =
    basinRouting.PREVIOUS_BASIN_ROUTING_ENGINE_SCHEMA;
  for (const profile of mismatchedRestoredClockSave.profiles) {
    delete profile.clockAlignmentCheckpoint;
  }
  const mismatchedRestoredClockEngine = new basinRouting.BasinRoutingEngine({
    maximumReachStates: 64,
    state: mismatchedRestoredClockSave
  });
  const clockMaterialBefore = JSON.parse(JSON.stringify(
    mismatchedRestoredClockEngine.snapshot().profiles[0].reaches));
  const basinDayBeforeAlignment = mismatchedRestoredClockEngine
    .status('temperate').lastDay;
  const committedEarthTransportDay = basinDayBeforeAlignment + .5;
  assert.ok(mismatchedRestoredClockEngine.status('temperate').receipt,
    'a current v27 routing receipt is preserved across a state-only v27-to-v28 engine migration');
  const restoredClockAlignment = mismatchedRestoredClockEngine
    .reconcileRestoredClock('temperate', committedEarthTransportDay);
  assert.equal(restoredClockAlignment.status, 'REBASED');
  assert.equal(restoredClockAlignment.checkpoint.schema,
    basinRouting.BASIN_CLOCK_ALIGNMENT_CHECKPOINT_SCHEMA);
  assert.equal(restoredClockAlignment.checkpoint.previousBasinDay,
    basinDayBeforeAlignment);
  assert.equal(restoredClockAlignment.checkpoint.committedTransportDay,
    committedEarthTransportDay);
  assert.equal(restoredClockAlignment.checkpoint.materialStatePreserved, true);
  assert.equal(restoredClockAlignment.checkpoint
    .historicalRoutingReconstructed, false);
  assert.deepEqual(
    mismatchedRestoredClockEngine.snapshot().profiles[0].reaches,
    clockMaterialBefore,
    'restored clock alignment preserves every reach-owned material state');
  assert.equal(mismatchedRestoredClockEngine.status('temperate').lastDay,
    committedEarthTransportDay);
  assert.equal(mismatchedRestoredClockEngine.status('temperate').receipt,
    null,
  'restored clock alignment invalidates the stale latest routing receipt');
  assert.deepEqual(
    mismatchedRestoredClockEngine.status('temperate')
      .clockAlignmentCheckpoint,
    restoredClockAlignment.checkpoint,
  'the typed restored-clock checkpoint survives in read-only status');
  assert.equal(mismatchedRestoredClockEngine.reconcileRestoredClock(
    'temperate', committedEarthTransportDay + 1).status, 'NOT_ELIGIBLE',
  'a restored profile receives at most one continuity alignment');
  assert.throws(() => mismatchedRestoredClockEngine.advance(
    basinStepThree.columns, basinSector, .25,
    { profileId: 'temperate', startDay: committedEarthTransportDay + 1 }
  ), /clock does not match/,
  'one-shot restore alignment does not mask a later runtime clock mismatch');

  const alignedRestoredClockEngine = new basinRouting.BasinRoutingEngine({
    maximumReachStates: 64,
    state: mismatchedRestoredClockSave
  });
  const alignedReceiptBefore = alignedRestoredClockEngine
    .status('temperate').receipt;
  assert.equal(alignedRestoredClockEngine.reconcileRestoredClock(
    'temperate', basinDayBeforeAlignment).status, 'ALREADY_ALIGNED');
  assert.deepEqual(alignedRestoredClockEngine.status('temperate').receipt,
    alignedReceiptBefore,
  'an already aligned restore retains its valid latest routing receipt');
  assert.equal(new basinRouting.BasinRoutingEngine({ maximumReachStates: 64 })
    .reconcileRestoredClock('temperate', 120).status, 'NOT_ELIGIBLE',
  'fresh runtime state cannot invoke the restore-only clock authority');

  const basinV15Save = JSON.parse(JSON.stringify(basinSave));
  basinV15Save.schema = 'axm.foundation-planet.basin-routing-engine/v15';
  const basinV15GasMemory = new Map();
  for (const profile of basinV15Save.profiles) {
    for (const reach of profile.reaches) {
      const gas = reach.floodplainGasExchange;
      basinV15GasMemory.set(`${profile.profileId}|${reach.reachId}`, {
        observedExchangeDays: gas.observedExchangeDays,
        carbonToAtmosphereKgC:
          gas.cumulativeExchange.carbonToAtmosphereKgC,
        oxygenToFloodplainKgO2:
          gas.cumulativeExchange.oxygenToFloodplainKgO2
      });
      gas.schema = floodplainGasExchange
        .PREVIOUS_FLOODPLAIN_GAS_EXCHANGE_STATE_SCHEMA;
      delete gas.cumulativeExchange.carbonToFloodplainKgC;
      gas.lastTransitionReceipt = null;
      delete reach.floodplainDenitrification;
    }
  }
  for (const receipt of basinV15Save.receipts) {
    receipt.receipt.schema =
      'axm.foundation-planet.basin-routing-step/v15';
  }
  const migratedBasinV15 = new basinRouting.BasinRoutingEngine({
    maximumReachStates: 64, state: basinV15Save
  });
  assert.equal(migratedBasinV15.status('temperate').receipt, null,
    'v15 basin receipts are dropped instead of relabeled as bidirectional gas-exchange evidence');
  assert.ok(migratedBasinV15.snapshot().profiles.every(profile =>
    profile.reaches.every(reach => {
      const prior = basinV15GasMemory.get(
        `${profile.profileId}|${reach.reachId}`);
      return reach.floodplainGasExchange.schema ===
        floodplainGasExchange.FLOODPLAIN_GAS_EXCHANGE_STATE_SCHEMA &&
      reach.floodplainGasExchange.migrationCheckpoint === true &&
      reach.floodplainGasExchange.observedExchangeDays ===
        prior.observedExchangeDays &&
      reach.floodplainGasExchange.cumulativeExchange
        .carbonToAtmosphereKgC === prior.carbonToAtmosphereKgC &&
      reach.floodplainGasExchange.cumulativeExchange
        .oxygenToFloodplainKgO2 === prior.oxygenToFloodplainKgO2 &&
      reach.floodplainGasExchange.cumulativeExchange
        .carbonToFloodplainKgC === 0;
    })),
  'v15 reaches preserve prior evasion and reaeration memory, initialize reverse carbon to zero and require a v2 checkpoint');
  const firstMigratedGasExchangeBasinStep = migratedBasinV15.advance(
    basinStepThree.columns, basinSector, .25,
    { profileId: 'temperate', startDay: 121 }
  );
  assert.ok(firstMigratedGasExchangeBasinStep.receipt
    .floodplainGasExchangeProcessReceipts.every(receipt =>
      receipt.status ===
        'initialized-after-v15-migration-no-invented-history' &&
      receipt.exchange.carbonToAtmosphereKgC === 0 &&
      receipt.exchange.carbonToFloodplainKgC === 0 &&
      receipt.exchange.oxygenToFloodplainKgO2 === 0 &&
      receipt.truth.migrationInventedHistory === false) &&
    firstMigratedGasExchangeBasinStep.receipt
      .floodplainGasExchangeReceipts.every(receipt =>
        receipt.exchange.carbonToAtmosphereKgC === 0 &&
        receipt.exchange.carbonToFloodplainKgC === 0 &&
        receipt.exchange.oxygenToFloodplainKgO2 === 0) &&
    firstMigratedGasExchangeBasinStep.receipt
      .atmosphereFloodplainGasExchangeReceipts.every(receipt =>
        receipt.exchange.carbonToAtmosphereKgC === 0 &&
        receipt.exchange.carbonToFloodplainKgC === 0 &&
        receipt.exchange.oxygenToFloodplainKgO2 === 0),
  'the first v15 migration step moves no C/O2 across either owner and records no historical exchange');

  const basinV16Save = JSON.parse(JSON.stringify(basinSave));
  basinV16Save.schema = 'axm.foundation-planet.basin-routing-engine/v16';
  for (const profile of basinV16Save.profiles) {
    for (const reach of profile.reaches) {
      delete reach.floodplainDenitrification;
    }
  }
  for (const receipt of basinV16Save.receipts) {
    receipt.receipt.schema = 'axm.foundation-planet.basin-routing-step/v16';
  }
  const migratedBasinV16 = new basinRouting.BasinRoutingEngine({
    maximumReachStates: 64, state: basinV16Save
  });
  assert.equal(migratedBasinV16.status('temperate').receipt, null,
    'v16 basin receipts are dropped instead of relabeled as denitrification evidence');
  assert.ok(migratedBasinV16.snapshot().profiles.every(profile =>
    profile.reaches.every(reach =>
      reach.floodplainDenitrification.schema ===
        floodplainDenitrification
          .FLOODPLAIN_DENITRIFICATION_STATE_SCHEMA &&
      reach.floodplainDenitrification.migrationCheckpoint === true &&
      reach.floodplainDenitrification.observedDenitrificationDays === 0 &&
      Object.values(reach.floodplainDenitrification.cumulativeReaction)
        .every(value => value === 0))),
  'v16 reaches retain all prior material and gain empty denitrification memory without invented history');
  const firstMigratedDenitrificationBasinStep = migratedBasinV16.advance(
    basinStepThree.columns, basinSector, .25,
    { profileId: 'temperate', startDay: 121 }
  );
  assert.ok(firstMigratedDenitrificationBasinStep.receipt
    .floodplainDenitrificationProcessReceipts.every(receipt =>
      receipt.status ===
        'initialized-after-v18-migration-no-invented-history' &&
      Object.values(receipt.reaction).every(value => value === 0) &&
      receipt.truth.migrationInventedHistory === false) &&
    firstMigratedDenitrificationBasinStep.receipt
      .floodplainDenitrificationReactionReceipts.every(receipt =>
        Object.values(receipt.reaction).every(value => value === 0)) &&
    firstMigratedDenitrificationBasinStep.receipt
      .atmosphereFloodplainDenitrificationReceipts.every(receipt =>
        receipt.inputs.carbonKgC === 0 &&
        receipt.inputs.oxygenKgO2 === 0 &&
        receipt.inputs.nitrogenKgN === 0),
  'the first v16 migration step moves no C/N across either owner and records no historical denitrification');

  const basinV18Save = JSON.parse(JSON.stringify(basinSave));
  basinV18Save.schema =
    'axm.foundation-planet.basin-routing-engine/v18';
  const basinV18NitrogenMemory = new Map();
  for (const profile of basinV18Save.profiles) {
    for (const reach of profile.reaches) {
      const channelNitrogen = riverChemistry.riverNitrogenSpecies(
        reach.chemistry);
      const floodplainNitrogen = riverChemistry.riverNitrogenSpecies(
        reach.floodplain.chemistry);
      const denitrification = reach.floodplainDenitrification;
      basinV18NitrogenMemory.set(
        `${profile.profileId}|${reach.reachId}`,
        {
          channelDinKgN: channelNitrogen.dissolvedInorganicNitrogenKgN,
          floodplainDinKgN:
            floodplainNitrogen.dissolvedInorganicNitrogenKgN,
          observedDenitrificationDays:
            denitrification.observedDenitrificationDays,
          temperatureConstrainedDays:
            denitrification.temperatureConstrainedDays,
          cumulativeReaction: {
            ...denitrification.cumulativeReaction
          }
        });
      reach.chemistry.schema =
        riverChemistry.PREVIOUS_RIVER_CHEMISTRY_STATE_SCHEMA;
      delete reach.chemistry.dissolvedNitrateNitrogenKgN;
      delete reach.chemistry.dissolvedAmmoniumNitrogenKgN;
      delete reach.chemistry.truth;
      reach.floodplain.schema = floodplain.LEGACY_FLOODPLAIN_STATE_SCHEMA;
      reach.floodplain.chemistry.schema =
        riverChemistry.PREVIOUS_RIVER_CHEMISTRY_STATE_SCHEMA;
      delete reach.floodplain.chemistry.dissolvedNitrateNitrogenKgN;
      delete reach.floodplain.chemistry.dissolvedAmmoniumNitrogenKgN;
      delete reach.floodplain.chemistry.truth;
      reach.floodplain.lastExchangeReceipt = null;
      reach.floodplain.lastDetritalReturnReceipt = null;
      reach.floodplain.lastDenitrificationReactionReceipt = null;
      delete reach.floodplain.lastNitrificationReactionReceipt;
      delete reach.floodplainNitrification;
      denitrification.schema = floodplainDenitrification
        .PREVIOUS_FLOODPLAIN_DENITRIFICATION_STATE_SCHEMA;
      denitrification.cumulativeReaction
        .dissolvedInorganicNitrogenConsumedKgN = denitrification
          .cumulativeReaction.dissolvedNitrateNitrogenConsumedKgN;
      delete denitrification.cumulativeReaction
        .dissolvedNitrateNitrogenConsumedKgN;
      denitrification.lastActivity.reactiveNitrateEquivalentKgN =
        denitrification.lastActivity.availableDissolvedNitrateNitrogenKgN;
      denitrification.lastActivity.reactiveNitrateEquivalentFraction = .5;
      delete denitrification.lastActivity
        .availableDissolvedNitrateNitrogenKgN;
      delete denitrification.lastActivity
        .availableDissolvedAmmoniumNitrogenKgN;
      denitrification.lastTransitionReceipt = null;
    }
  }
  for (const receipt of basinV18Save.receipts) {
    receipt.receipt.schema =
      'axm.foundation-planet.basin-routing-step/v18';
  }
  const migratedBasinV18 = new basinRouting.BasinRoutingEngine({
    maximumReachStates: 64, state: basinV18Save
  });
  assert.equal(migratedBasinV18.status('temperate').receipt, null,
    'v18 basin receipts are dropped instead of relabeled as nitrate/ammonium transport evidence');
  assert.ok(migratedBasinV18.snapshot().profiles.every(profile =>
    profile.reaches.every(reach => {
      const prior = basinV18NitrogenMemory.get(
        `${profile.profileId}|${reach.reachId}`);
      const channelNitrogen = riverChemistry.riverNitrogenSpecies(
        reach.chemistry);
      const floodplainNitrogen = riverChemistry.riverNitrogenSpecies(
        reach.floodplain.chemistry);
      return reach.chemistry.schema ===
          riverChemistry.RIVER_CHEMISTRY_STATE_SCHEMA &&
        reach.chemistry.migrationCheckpoint === true &&
        Math.abs(channelNitrogen.dissolvedInorganicNitrogenKgN -
          prior.channelDinKgN) < 1e-7 &&
        Math.abs(channelNitrogen.dissolvedNitrateNitrogenKgN -
          prior.channelDinKgN * .5) < 1e-7 &&
        Math.abs(channelNitrogen.dissolvedAmmoniumNitrogenKgN -
          prior.channelDinKgN * .5) < 1e-7 &&
        reach.floodplain.schema === floodplain.FLOODPLAIN_STATE_SCHEMA &&
        reach.floodplain.migrationCheckpoint === true &&
        Math.abs(floodplainNitrogen.dissolvedInorganicNitrogenKgN -
          prior.floodplainDinKgN) < 1e-7 &&
        Math.abs(floodplainNitrogen.dissolvedNitrateNitrogenKgN -
          prior.floodplainDinKgN * .5) < 1e-7 &&
        Math.abs(floodplainNitrogen.dissolvedAmmoniumNitrogenKgN -
          prior.floodplainDinKgN * .5) < 1e-7 &&
        reach.floodplainDenitrification.schema ===
          floodplainDenitrification
            .FLOODPLAIN_DENITRIFICATION_STATE_SCHEMA &&
        reach.floodplainDenitrification.migrationCheckpoint === true &&
        reach.floodplainDenitrification.observedDenitrificationDays ===
          prior.observedDenitrificationDays &&
        Object.entries(prior.cumulativeReaction).every(([key, value]) =>
          reach.floodplainDenitrification.cumulativeReaction[key] ===
            value) &&
        reach.floodplainDenitrification.temperatureConstrainedDays ===
          prior.temperatureConstrainedDays &&
        reach.floodplainNitrification.schema ===
          floodplainNitrification.FLOODPLAIN_NITRIFICATION_STATE_SCHEMA &&
        reach.floodplainNitrification.migrationCheckpoint === true &&
        reach.floodplainNitrification.observedNitrificationDays === 0 &&
        Object.values(reach.floodplainNitrification.cumulativeReaction)
          .every(value => value === 0);
    })),
  'v18 reaches preserve aggregate DIN and denitrification history, initialize explicit nitrate/ammonium 50/50 and require a v19 checkpoint');
  const firstNitrateAmmoniumMigratedDenitrificationStep =
    migratedBasinV18.advance(
      basinStepThree.columns, basinSector, .25,
      { profileId: 'temperate', startDay: 121 }
    );
  assert.ok(firstNitrateAmmoniumMigratedDenitrificationStep.receipt
    .floodplainDenitrificationProcessReceipts.every(receipt =>
      receipt.status ===
        'initialized-after-v18-migration-no-invented-history' &&
      Object.values(receipt.reaction).every(value => value === 0) &&
      receipt.truth.migrationInventedHistory === false) &&
    firstNitrateAmmoniumMigratedDenitrificationStep.receipt
      .floodplainDenitrificationReactionReceipts.every(receipt =>
        Object.values(receipt.reaction).every(value => value === 0)) &&
    firstNitrateAmmoniumMigratedDenitrificationStep.receipt
      .atmosphereFloodplainDenitrificationReceipts.every(receipt =>
        receipt.inputs.carbonKgC === 0 &&
        receipt.inputs.oxygenKgO2 === 0 &&
        receipt.inputs.nitrogenKgN === 0) &&
    firstNitrateAmmoniumMigratedDenitrificationStep.receipt
      .floodplainNitrificationProcessReceipts.every(receipt =>
        receipt.status ===
          'initialized-after-schema-migration-no-invented-history' &&
        Object.values(receipt.reaction).every(value => value === 0) &&
        receipt.truth.migrationInventedHistory === false) &&
    firstNitrateAmmoniumMigratedDenitrificationStep.receipt
      .floodplainNitrificationReactionReceipts.every(receipt =>
        Object.values(receipt.reaction).every(value => value === 0)),
  'the first v18 migration step moves no C/N across either owner and records no invented nitrate/ammonium process history');

  const basinV19Save = JSON.parse(JSON.stringify(basinSave));
  basinV19Save.schema = 'axm.foundation-planet.basin-routing-engine/v20';
  const basinV19NitrificationBoundary = new Map();
  for (const profile of basinV19Save.profiles) {
    for (const reach of profile.reaches) {
      basinV19NitrificationBoundary.set(
        `${profile.profileId}|${reach.reachId}`,
        {
          floodplainWaterKg: reach.floodplain.waterKg,
          floodplainChemistry: JSON.parse(JSON.stringify(
            reach.floodplain.chemistry)),
          denitrification: JSON.parse(JSON.stringify(
            reach.floodplainDenitrification))
        });
      reach.floodplain.schema =
        floodplain.PREVIOUS_FLOODPLAIN_STATE_SCHEMA;
      delete reach.floodplain.lastNitrificationReactionReceipt;
      delete reach.floodplainNitrification;
    }
  }
  for (const receipt of basinV19Save.receipts) {
    receipt.receipt.schema = basinRouting.PREVIOUS_BASIN_ROUTING_STEP_SCHEMA;
  }
  const migratedBasinV19 = new basinRouting.BasinRoutingEngine({
    maximumReachStates: 64, state: basinV19Save
  });
  assert.equal(migratedBasinV19.status('temperate').receipt, null,
    'v19 basin receipts are dropped instead of relabeled as nitrification evidence');
  assert.ok(migratedBasinV19.snapshot().profiles.every(profile =>
    profile.reaches.every(reach => {
      const prior = basinV19NitrificationBoundary.get(
        `${profile.profileId}|${reach.reachId}`);
      return reach.floodplain.schema === floodplain.FLOODPLAIN_STATE_SCHEMA &&
        reach.floodplain.migrationCheckpoint === true &&
        reach.floodplain.waterKg === prior.floodplainWaterKg &&
        JSON.stringify(reach.floodplain.chemistry) ===
          JSON.stringify(prior.floodplainChemistry) &&
        JSON.stringify(reach.floodplainDenitrification) ===
          JSON.stringify(prior.denitrification) &&
        reach.floodplain.lastNitrificationReactionReceipt === null &&
        reach.floodplainNitrification.schema ===
          floodplainNitrification.FLOODPLAIN_NITRIFICATION_STATE_SCHEMA &&
        reach.floodplainNitrification.migrationCheckpoint === true &&
        reach.floodplainNitrification.observedNitrificationDays === 0 &&
        reach.floodplainNitrification.oxygenConstrainedDays === 0 &&
        reach.floodplainNitrification.oxygenLimitedDays === 0 &&
        reach.floodplainNitrification.temperatureConstrainedDays === 0 &&
        Object.values(reach.floodplainNitrification.cumulativeReaction)
          .every(value => value === 0);
    })),
  'v19 reaches preserve prior material and process state while adding an empty explicit nitrification organ');
  const firstNitrificationMigratedBasinStep = migratedBasinV19.advance(
    basinStepThree.columns, basinSector, .25,
    { profileId: 'temperate', startDay: 121 }
  );
  assert.ok(firstNitrificationMigratedBasinStep.receipt
    .floodplainNitrificationProcessReceipts.every(receipt =>
      receipt.status ===
        'initialized-after-schema-migration-no-invented-history' &&
      Object.values(receipt.reaction).every(value => value === 0) &&
      receipt.truth.migrationInventedHistory === false) &&
    firstNitrificationMigratedBasinStep.receipt
      .floodplainNitrificationReactionReceipts.every(receipt =>
        receipt.schema ===
          floodplain.FLOODPLAIN_NITRIFICATION_REACTION_RECEIPT_SCHEMA &&
        Object.values(receipt.reaction).every(value => value === 0) &&
        receipt.truth.independentNitrogenCreation === false &&
        receipt.truth.independentOxygenCreation === false),
  'the first v19 migration step emits typed zero nitrification evidence and invents no reaction history');

  const basinV13Save = JSON.parse(JSON.stringify(basinSave));
  basinV13Save.schema = 'axm.foundation-planet.basin-routing-engine/v13';
  for (const profile of basinV13Save.profiles) {
    for (const reach of profile.reaches) {
      delete reach.floodplainRespiration;
      delete reach.floodplainGasExchange;
    }
  }
  for (const receipt of basinV13Save.receipts) {
    receipt.receipt.schema = 'axm.foundation-planet.basin-routing-step/v13';
  }
  const migratedBasinV13 = new basinRouting.BasinRoutingEngine({
    maximumReachStates: 64, state: basinV13Save
  });
  assert.equal(migratedBasinV13.status('temperate').receipt, null,
    'v13 basin receipts are dropped instead of fabricated into respiration evidence');
  assert.ok(migratedBasinV13.snapshot().profiles.every(profile =>
    profile.reaches.every(reach =>
      reach.floodplainRespiration.schema ===
        floodplainRespiration.FLOODPLAIN_RESPIRATION_STATE_SCHEMA &&
      reach.floodplainRespiration.migrationCheckpoint === true &&
      reach.floodplainRespiration.observedRespirationDays === 0 &&
      Object.values(reach.floodplainRespiration
        .cumulativeMineralization).every(value => value === 0) &&
      reach.floodplainGasExchange.migrationCheckpoint === true &&
      Object.values(reach.floodplainGasExchange.cumulativeExchange)
        .every(value => value === 0))),
  'v13 reaches preserve floodplain chemistry but gain empty respiration and gas-exchange memory without invented history');
  const firstMigratedRespirationBasinStep = migratedBasinV13.advance(
    basinStepThree.columns, basinSector, .25,
    { profileId: 'temperate', startDay: 121 }
  );
  assert.ok(firstMigratedRespirationBasinStep.receipt
    .floodplainRespirationReceipts.every(receipt =>
      receipt.status ===
        'initialized-after-v13-migration-no-invented-history' &&
      receipt.reaction.dissolvedOrganicCarbonConsumedKgC === 0 &&
      receipt.reaction.dissolvedInorganicCarbonProducedKgC === 0 &&
      receipt.reaction.dissolvedOxygenConsumedKgO2 === 0 &&
      receipt.truth.migrationInventedHistory === false) &&
    firstMigratedRespirationBasinStep.receipt
      .floodplainAerobicMineralizationReceipts.every(receipt =>
        receipt.reaction.dissolvedOrganicCarbonConsumedKgC === 0 &&
      receipt.reaction.dissolvedInorganicCarbonProducedKgC === 0 &&
      receipt.reaction.dissolvedOxygenConsumedKgO2 === 0),
    firstMigratedRespirationBasinStep.receipt
      .floodplainGasExchangeProcessReceipts.every(receipt =>
        receipt.status ===
          'initialized-after-v15-migration-no-invented-history' &&
        receipt.exchange.carbonToAtmosphereKgC === 0 &&
        receipt.exchange.carbonToFloodplainKgC === 0 &&
        receipt.exchange.oxygenToFloodplainKgO2 === 0),
  'the first v13 migration step moves no local or cross-owner C/O2 and records no historical respiration or gas exchange');

  const basinV12Save = JSON.parse(JSON.stringify(basinSave));
  basinV12Save.schema = 'axm.foundation-planet.basin-routing-engine/v12';
  for (const profile of basinV12Save.profiles) {
    for (const reach of profile.reaches) {
      delete reach.floodplainDecomposition;
      delete reach.floodplainRespiration;
    }
  }
  for (const receipt of basinV12Save.receipts) {
    receipt.receipt.schema = 'axm.foundation-planet.basin-routing-step/v12';
  }
  const migratedBasinV12 = new basinRouting.BasinRoutingEngine({
    maximumReachStates: 64, state: basinV12Save
  });
  assert.equal(migratedBasinV12.status('temperate').receipt, null,
    'v12 basin receipts are dropped instead of fabricated into decomposition evidence');
  assert.ok(migratedBasinV12.snapshot().profiles.every(profile =>
    profile.reaches.every(reach =>
      reach.floodplainDecomposition.schema ===
        floodplainDecomposition.FLOODPLAIN_DECOMPOSITION_STATE_SCHEMA &&
      reach.floodplainDecomposition.migrationCheckpoint === true &&
      reach.floodplainDecomposition.observedDecompositionDays === 0 &&
      Object.values(reach.floodplainDecomposition
        .cumulativeFloodplainReturn).every(value => value === 0))),
  'v12 reaches preserve plant detritus but gain empty decomposition process memory without invented return history');
  const firstMigratedDecompositionBasinStep = migratedBasinV12.advance(
    basinStepThree.columns, basinSector, .25,
    { profileId: 'temperate', startDay: 121 }
  );
  assert.ok(firstMigratedDecompositionBasinStep.receipt
    .floodplainDecompositionReceipts.every(receipt =>
      receipt.status ===
        'initialized-after-v12-migration-no-invented-history' &&
      receipt.transferIds.length === 0 &&
      receipt.transfers.carbonKgC === 0 &&
      receipt.transfers.nitrogenKgN === 0 &&
      receipt.transfers.phosphorusKgP === 0 &&
      receipt.truth.migrationInventedHistory === false) &&
    firstMigratedDecompositionBasinStep.receipt
      .floodplainPlantDetritusMatterDebitReceipts.every(receipt =>
        receipt.allocations.length === 0) &&
    firstMigratedDecompositionBasinStep.receipt
      .floodplainPlantDetritusResourceDebitReceipts.every(receipt =>
        receipt.allocations.length === 0) &&
    firstMigratedDecompositionBasinStep.receipt
      .floodplainDetritalReturnCreditReceipts.every(receipt =>
        receipt.allocations.length === 0),
  'the first v12 migration step moves no C/N/P and records no historical decomposition');

  const basinV11Save = JSON.parse(JSON.stringify(basinSave));
  basinV11Save.schema = 'axm.foundation-planet.basin-routing-engine/v11';
  for (const profile of basinV11Save.profiles) {
    for (const reach of profile.reaches) {
      delete reach.floodplainPlantResources;
      delete reach.floodplainDecomposition;
    }
  }
  for (const receipt of basinV11Save.receipts) {
    receipt.receipt.schema = 'axm.foundation-planet.basin-routing-step/v11';
  }
  const migratedBasinV11 = new basinRouting.BasinRoutingEngine({
    maximumReachStates: 64, state: basinV11Save
  });
  assert.equal(migratedBasinV11.status('temperate').receipt, null,
    'v11 basin receipts are dropped instead of fabricated into plant-resource evidence');
  assert.ok(migratedBasinV11.snapshot().profiles.every(profile =>
    profile.reaches.every(reach =>
      reach.floodplainPlantMatter.schema ===
        floodplainPlantMatter.FLOODPLAIN_PLANT_MATTER_STATE_SCHEMA &&
      reach.floodplainPlantResources.schema ===
        floodplainPlantResources.FLOODPLAIN_PLANT_RESOURCES_STATE_SCHEMA &&
      reach.floodplainPlantResources.migrationCheckpoint === true &&
      floodplainPlantResources.floodplainPlantResourcesSummary(
        reach.floodplainPlantResources).total.phosphorusKgP === 0 &&
      floodplainPlantResources.floodplainPlantResourcesSummary(
        reach.floodplainPlantResources).total.liveWaterKg === 0)),
  'v11 reaches retain exact C/N matter and migrate with empty P/water checkpoints');
  const firstMigratedResourceBasinStep = migratedBasinV11.advance(
    basinStepThree.columns, basinSector, .25,
    { profileId: 'temperate', startDay: 121 }
  );
  assert.ok(firstMigratedResourceBasinStep.receipt
    .floodplainPlantResourcesReceipts.every(receipt =>
      receipt.status ===
        'initialized-after-v11-migration-no-invented-resources' &&
      receipt.after.total.phosphorusKgP === 0 &&
      receipt.after.total.liveWaterKg === 0 &&
      receipt.truth.migrationInventedResources === false) &&
    firstMigratedResourceBasinStep.receipt
      .floodplainPlantResourceDebitReceipts.every(receipt =>
        receipt.debited.phosphorusKgP === 0 &&
        receipt.debited.waterKg === 0),
  'the first v11 migration step records unsupported legacy matter without retroactive P/water uptake');

  const basinV10Save = JSON.parse(JSON.stringify(basinSave));
  basinV10Save.schema = 'axm.foundation-planet.basin-routing-engine/v10';
  for (const profile of basinV10Save.profiles) {
    for (const reach of profile.reaches) {
      delete reach.floodplainPlantMatter;
      delete reach.floodplainPlantResources;
    }
  }
  for (const receipt of basinV10Save.receipts) {
    receipt.receipt.schema = 'axm.foundation-planet.basin-routing-step/v10';
  }
  const migratedBasinV10 = new basinRouting.BasinRoutingEngine({
    maximumReachStates: 64, state: basinV10Save
  });
  assert.equal(migratedBasinV10.status('temperate').receipt, null,
    'v10 basin receipts are dropped instead of fabricated into plant-matter evidence');
  assert.ok(migratedBasinV10.snapshot().profiles.every(profile =>
    profile.reaches.every(reach =>
      reach.floodplainPlantMatter.schema ===
        floodplainPlantMatter.FLOODPLAIN_PLANT_MATTER_STATE_SCHEMA &&
      reach.floodplainPlantMatter.migrationCheckpoint === true &&
      floodplainPlantMatter.floodplainPlantMatterSummary(
        reach.floodplainPlantMatter).total.carbonKgC === 0 &&
      floodplainPlantMatter.floodplainPlantMatterSummary(
        reach.floodplainPlantMatter).total.nitrogenKgN === 0)),
  'v10 reaches migrate with explicit empty plant-matter checkpoints while preserving succession');
  const firstMigratedPlantBasinStep = migratedBasinV10.advance(
    basinStepThree.columns, basinSector, .25,
    { profileId: 'temperate', startDay: 121 }
  );
  assert.ok(firstMigratedPlantBasinStep.receipt
    .floodplainPlantMatterReceipts.every(receipt =>
      receipt.status ===
        'initialized-after-migration-no-invented-material' &&
      receipt.after.total.carbonKgC === 0 &&
      receipt.after.total.nitrogenKgN === 0 &&
      receipt.truth.migrationInventedMaterial === false) &&
    firstMigratedPlantBasinStep.receipt.transfers
      .landEcologySubgridBiomassDebits.carbonKgC === 0 &&
    firstMigratedPlantBasinStep.receipt.transfers
      .landEcologySubgridBiomassDebits.nitrogenKgN === 0,
  'the first v10 migration step records legacy cover but debits no land biomass and invents no C/N');

  const basinV9Save = JSON.parse(JSON.stringify(basinSave));
  basinV9Save.schema = 'axm.foundation-planet.basin-routing-engine/v9';
  for (const profile of basinV9Save.profiles) {
    for (const reach of profile.reaches) {
      delete reach.floodplainSuccession;
      delete reach.floodplainPlantMatter;
    }
  }
  for (const receipt of basinV9Save.receipts) {
    receipt.receipt.schema = 'axm.foundation-planet.basin-routing-step/v9';
  }
  const migratedBasinV9 = new basinRouting.BasinRoutingEngine({
    maximumReachStates: 64, state: basinV9Save
  });
  assert.equal(migratedBasinV9.status('temperate').receipt, null,
    'v9 basin receipts are dropped instead of fabricated into living succession evidence');
  assert.ok(migratedBasinV9.snapshot().profiles.every(profile =>
    profile.reaches.every(reach => {
      const summary = floodplainSuccession.floodplainSuccessionSummary(
        reach.floodplainSuccession);
      return reach.floodplainSuccession.schema ===
          floodplainSuccession.FLOODPLAIN_SUCCESSION_STATE_SCHEMA &&
        reach.floodplainSuccession.migrationCheckpoint === true &&
        reach.floodplainSuccession.observedLivingDays === 0 &&
        summary.totalCoverFraction === 0 &&
        summary.totalSeedBankSeedsM2 === 0;
    })),
  'v9 reaches migrate with explicit empty living checkpoints rather than invented vegetation history');
  const firstMigratedSuccessionBasinStep = migratedBasinV9.advance(
    basinStepThree.columns, basinSector, .25,
    { profileId: 'temperate', startDay: 121 }
  );
  assert.ok(firstMigratedSuccessionBasinStep.receipt
    .floodplainSuccessionReceipts.every(receipt =>
      receipt.status === 'initialized-after-migration-no-history' &&
      receipt.community.before.totalCoverFraction === 0 &&
      receipt.community.after.totalCoverFraction === 0 &&
      receipt.community.after.totalSeedBankSeedsM2 === 0 &&
      receipt.truth.migrationInventedLivingHistory === false),
  'the first v9 migration step baselines present habitat and events without fabricating a community');
  assert.ok(firstMigratedSuccessionBasinStep.receipt
    .floodplainPlantMatterReceipts.every(receipt =>
      receipt.status ===
        'initialized-after-migration-no-invented-material' &&
      receipt.after.total.carbonKgC === 0 &&
      receipt.after.total.nitrogenKgN === 0),
  'a v9 migration also creates no historical plant matter');

  const basinV8Save = JSON.parse(JSON.stringify(basinSave));
  basinV8Save.schema = 'axm.foundation-planet.basin-routing-engine/v8';
  for (const profile of basinV8Save.profiles) {
    for (const reach of profile.reaches) {
      delete reach.floodEvents;
      delete reach.floodplainSuccession;
    }
  }
  for (const receipt of basinV8Save.receipts) {
    receipt.receipt.schema = 'axm.foundation-planet.basin-routing-step/v8';
  }
  const migratedBasinV8 = new basinRouting.BasinRoutingEngine({
    maximumReachStates: 64, state: basinV8Save
  });
  assert.equal(migratedBasinV8.status('temperate').receipt, null,
    'v8 basin receipts are dropped instead of fabricated into flood-event or living evidence');
  assert.ok(migratedBasinV8.snapshot().profiles.every(profile =>
    profile.reaches.every(reach =>
      reach.floodEvents.schema ===
        floodEventHistory.FLOOD_EVENT_HISTORY_STATE_SCHEMA &&
      reach.floodEvents.migrationCheckpoint === true &&
      reach.floodEvents.observedDays === 0 &&
      reach.floodEvents.currentEvent === null &&
      reach.floodEvents.recentEvents.length === 0 &&
      reach.floodEvents.completedEventCount === 0 &&
      reach.floodplainSuccession.migrationCheckpoint === true &&
      floodplainSuccession.floodplainSuccessionSummary(
        reach.floodplainSuccession).totalCoverFraction === 0)),
  'v8 reaches migrate with explicit empty event and succession checkpoints rather than invented history');
  const firstMigratedEventBasinStep = migratedBasinV8.advance(
    basinStepThree.columns, basinSector, .25,
    { profileId: 'temperate', startDay: 121 }
  );
  assert.ok(firstMigratedEventBasinStep.receipt.floodEventReceipts
    .every(receipt =>
      receipt.status === 'initialized-after-migration-no-history' &&
      receipt.history.observedDaysAfter === 0 &&
      receipt.history.completedEventCountAfter === 0 &&
      receipt.history.archiveCountAfter === 0 &&
      receipt.truth.historicalEventsInvented === false) &&
    firstMigratedEventBasinStep.receipt.floodplainSuccessionReceipts
      .every(receipt =>
        receipt.status === 'initialized-after-migration-no-history' &&
        receipt.community.after.totalCoverFraction === 0),
  'the first v8 migration step baselines present floodplain material without fabricating event or living history');

  const basinV7Save = JSON.parse(JSON.stringify(basinSave));
  basinV7Save.schema = 'axm.foundation-planet.basin-routing-engine/v7';
  for (const profile of basinV7Save.profiles) {
    for (const reach of profile.reaches) {
      delete reach.floodplainHabitat;
      delete reach.floodEvents;
      delete reach.floodplainSuccession;
    }
  }
  for (const receipt of basinV7Save.receipts) {
    receipt.receipt.schema = 'axm.foundation-planet.basin-routing-step/v7';
  }
  const migratedBasinV7 = new basinRouting.BasinRoutingEngine({
    maximumReachStates: 64, state: basinV7Save
  });
  assert.equal(migratedBasinV7.status('temperate').receipt, null,
    'v7 basin receipts are dropped instead of fabricated into habitat-memory evidence');
  assert.ok(migratedBasinV7.snapshot().profiles.every(profile =>
    profile.reaches.every(reach =>
      reach.floodplainHabitat.schema ===
        floodplainHabitat.FLOODPLAIN_HABITAT_STATE_SCHEMA &&
      reach.floodplainHabitat.migrationCheckpoint === true &&
      reach.floodplainHabitat.observedDays === 0 &&
      reach.floodplainHabitat.floodPulseCount === 0 &&
      reach.floodEvents.migrationCheckpoint === true &&
      reach.floodEvents.completedEventCount === 0 &&
      reach.floodplainSuccession.migrationCheckpoint === true)),
  'v7 reaches migrate with explicit habitat, event and succession checkpoints rather than invented history');
  const firstMigratedHabitatBasinStep = migratedBasinV7.advance(
    basinStepThree.columns, basinSector, .25,
    { profileId: 'temperate', startDay: 121 }
  );
  assert.ok(firstMigratedHabitatBasinStep.receipt
    .floodplainHabitatReceipts.every(receipt =>
      receipt.status === 'initialized-after-migration-no-history' &&
      receipt.memory.observedDaysAfter === 0 &&
      receipt.memory.floodPulseCountAfter === 0),
  'the first basin v7 migration step baselines present floodplain material without fabricating historical habitat observations');
  const basinV6Save = JSON.parse(JSON.stringify(basinSave));
  basinV6Save.schema = 'axm.foundation-planet.basin-routing-engine/v6';
  for (const profile of basinV6Save.profiles) {
    for (const reach of profile.reaches) {
      delete reach.floodplain;
      delete reach.floodplainHabitat;
      delete reach.floodEvents;
      delete reach.floodplainSuccession;
    }
  }
  const migratedBasinV6 = new basinRouting.BasinRoutingEngine({
    maximumReachStates: 64, state: basinV6Save
  });
  assert.ok(migratedBasinV6.snapshot().profiles.every(profile =>
    profile.reaches.every(reach =>
      reach.floodplain.schema === floodplain.FLOODPLAIN_STATE_SCHEMA &&
      reach.floodplain.migrationCheckpoint === true &&
      floodplain.floodplainTotals(reach.floodplain).waterKg === 0 &&
      floodplain.floodplainTotals(reach.floodplain).totalSedimentKg === 0 &&
      reach.floodplainHabitat.migrationCheckpoint === true &&
      reach.floodEvents.migrationCheckpoint === true &&
      reach.floodplainSuccession.migrationCheckpoint === true)),
  'v6 reaches retain honest empty floodplain, habitat, event and succession checkpoints');
  const basinV5Save = JSON.parse(JSON.stringify(basinSave));
  basinV5Save.schema = 'axm.foundation-planet.basin-routing-engine/v5';
  for (const profile of basinV5Save.profiles) {
    for (const reach of profile.reaches) {
      delete reach.sediment;
      delete reach.floodplain;
      delete reach.floodplainHabitat;
      delete reach.floodEvents;
      delete reach.floodplainSuccession;
    }
  }
  const migratedBasinV5 = new basinRouting.BasinRoutingEngine({
    maximumReachStates: 64, state: basinV5Save
  });
  assert.ok(migratedBasinV5.snapshot().profiles.every(profile =>
    profile.reaches.every(reach =>
      reach.sediment.schema === geomorphicSediment.RIVER_SEDIMENT_STATE_SCHEMA &&
      reach.sediment.migrationCheckpoint === true &&
      geomorphicSediment.riverSedimentTotals(reach.sediment).totalKg === 0)),
  'v5 reaches migrate with explicit empty suspended/bed sediment checkpoints rather than invented material');
  const basinV4Save = JSON.parse(JSON.stringify(basinSave));
  basinV4Save.schema = 'axm.foundation-planet.basin-routing-engine/v4';
  for (const profile of basinV4Save.profiles) {
    for (const reach of profile.reaches) {
      reach.chemistry.schema =
        riverChemistry.PREVIOUS_RIVER_CHEMISTRY_STATE_SCHEMA;
      reach.chemistry.cumulativeBoundaryInputs =
        reach.chemistry.cumulativeLandRunoffInputs;
      delete reach.chemistry.cumulativeLandRunoffInputs;
      delete reach.chemistry.legacyParameterizedBoundaryInputs;
      delete reach.floodplainSuccession;
    }
  }
  for (const receipt of basinV4Save.receipts) {
    receipt.receipt.schema = 'axm.foundation-planet.basin-routing-step/v4';
  }
  const migratedBasinV4 = new basinRouting.BasinRoutingEngine({
    maximumReachStates: 64, state: basinV4Save
  });
  assert.equal(migratedBasinV4.status('temperate').receipt, null,
    'v4 basin receipts are dropped instead of fabricated into sender-debit evidence');
  assert.deepEqual(migratedBasinV4.status('temperate').storedChemistry,
    basinEngine.status('temperate').storedChemistry,
  'v4-to-v5 migration preserves exact persistent reach chemistry pools');
  const basinV3Save = JSON.parse(JSON.stringify(basinSave));
  basinV3Save.schema = 'axm.foundation-planet.basin-routing-engine/v3';
  for (const profile of basinV3Save.profiles) {
    for (const reach of profile.reaches) delete reach.floodplainSuccession;
  }
  for (const receipt of basinV3Save.receipts) {
    receipt.receipt.schema = 'axm.foundation-planet.basin-routing-step/v3';
  }
  const migratedBasinV3 = new basinRouting.BasinRoutingEngine({
    maximumReachStates: 64, state: basinV3Save
  });
  assert.equal(migratedBasinV3.status('temperate').receipt, null,
    'v3 migration retains state but drops a pre-atmosphere receipt instead of presenting obsolete evidence as current closure');
  assert.equal(migratedBasinV3.status('temperate').storedWaterKg,
    basinEngine.status('temperate').storedWaterKg,
    'dropping obsolete v3 evidence does not discard persistent river water');
  const basinV2Save = JSON.parse(JSON.stringify(basinSave));
  basinV2Save.schema = 'axm.foundation-planet.basin-routing-engine/v2';
  for (const profile of basinV2Save.profiles) {
    for (const reach of profile.reaches) {
      delete reach.estuary;
      delete reach.floodplainSuccession;
    }
  }
  const migratedBasinV2 = new basinRouting.BasinRoutingEngine({ maximumReachStates: 64, state: basinV2Save });
  assert.ok(migratedBasinV2.snapshot().profiles.every(profile => profile.reaches.every(reach =>
    reach.estuary.schema === estuaryReactor.ESTUARY_STATE_SCHEMA &&
    reach.estuary.migrationCheckpoint === true &&
    Object.values(estuaryReactor.estuaryStorageTotals(reach.estuary)).every(value => value === 0))),
  'v2 basin snapshots migrate with explicit empty estuary storage rather than invented sediment');
  const basinV1Save = JSON.parse(JSON.stringify(basinSave));
  basinV1Save.schema = 'axm.foundation-planet.basin-routing-engine/v1';
  for (const profile of basinV1Save.profiles) {
    for (const reach of profile.reaches) {
      delete reach.chemistry;
      delete reach.estuary;
      delete reach.floodplainSuccession;
    }
  }
  const migratedBasinV1 = new basinRouting.BasinRoutingEngine({ maximumReachStates: 64, state: basinV1Save });
  assert.ok(migratedBasinV1.snapshot().profiles.every(profile => profile.reaches.every(reach =>
    reach.chemistry.schema === riverChemistry.RIVER_CHEMISTRY_STATE_SCHEMA &&
    reach.chemistry.migrationCheckpoint === true &&
    Object.values(riverChemistry.riverChemistryTotals(reach.chemistry)).every(value => value === 0))),
  'v1 basin snapshots migrate with explicit empty chemistry rather than invented historical solutes');
  assert.throws(() => basinEngine.advance(basinStepThree.columns, basinSector, .25, { profileId: 'glacial', startDay: 121 }), /profile does not match/, 'basin routing refuses mixed condition history');
  assert.throws(() => basinEngine.advance(basinStepThree.columns, basinSector, .25, { profileId: 'temperate', startDay: 120 }), /clock does not match/, 'basin routing refuses a rewound transport clock');

  const basinForwardEngine = new basinRouting.BasinRoutingEngine({ maximumReachStates: 64 });
  const basinReverseEngine = new basinRouting.BasinRoutingEngine({ maximumReachStates: 64 });
  const basinForward = basinForwardEngine.advance(basinColumns, basinSector, .5, { profileId: 'temperate', startDay: 118 });
  const basinReverse = basinReverseEngine.advance([...basinColumns].reverse(), { ...basinSector, rivers: [...basinSector.rivers].reverse() }, .5, { profileId: 'temperate', startDay: 118 });
  assert.equal(basinForward.receipt.digest, basinReverse.receipt.digest, 'cross-scale basin receipt is invariant to caller column and reach ordering');
  assert.deepEqual(basinForward.columns, basinReverse.columns, 'cross-scale basin state applies simultaneously and order-invariantly');
  const basinForwardFloodplain = basinForwardEngine.advance(
    basinForward.columns, basinSector, .5,
    { profileId: 'temperate', startDay: 118.5 });
  const basinReverseFloodplain = basinReverseEngine.advance(
    [...basinReverse.columns].reverse(),
    { ...basinSector, rivers: [...basinSector.rivers].reverse() }, .5,
    { profileId: 'temperate', startDay: 118.5 });
  assert.equal(basinForwardFloodplain.receipt.digest,
    basinReverseFloodplain.receipt.digest,
  'floodplain exchange, event-history, habitat-memory, living-succession and plant-matter receipts remain invariant to caller column and reach ordering after persistent states exist');
  assert.deepEqual(basinForwardFloodplain.receipt.floodEventReceipts,
    basinReverseFloodplain.receipt.floodEventReceipts,
  'each material-bound flood-event transition is independently order-invariant');
  assert.deepEqual(basinForwardFloodplain.receipt.floodplainSuccessionReceipts,
    basinReverseFloodplain.receipt.floodplainSuccessionReceipts,
  'each habitat- and event-bound guild transition is independently order-invariant');
  assert.deepEqual(basinForwardFloodplain.receipt
    .floodplainPlantMatterReceipts,
  basinReverseFloodplain.receipt.floodplainPlantMatterReceipts,
  'each succession- and sender-bound plant C/N transition is independently order-invariant');
  assert.deepEqual(basinForwardFloodplain.receipt
    .landEcologySubgridDebitReceipts,
  basinReverseFloodplain.receipt.landEcologySubgridDebitReceipts,
  'batched land-cell subgrid sender debits are independently order-invariant');
  assert.deepEqual(basinForwardFloodplain.receipt
    .floodplainPlantResourcesReceipts,
  basinReverseFloodplain.receipt.floodplainPlantResourcesReceipts,
  'each matter-bound plant P/water transition is independently order-invariant');
  assert.deepEqual(basinForwardFloodplain.receipt
    .floodplainPlantResourceDebitReceipts,
  basinReverseFloodplain.receipt.floodplainPlantResourceDebitReceipts,
  'floodplain water/P sender debits are independently order-invariant');
  assert.deepEqual(basinForwardFloodplain.receipt
    .floodplainPlantWaterReturnReceipts,
  basinReverseFloodplain.receipt.floodplainPlantWaterReturnReceipts,
  'mortality tissue-water receiver credits are independently order-invariant');
  assert.deepEqual(basinForwardFloodplain.receipt
    .floodplainPlantDetritusMatterDebitReceipts,
  basinReverseFloodplain.receipt
    .floodplainPlantDetritusMatterDebitReceipts,
  'plant detritus C/N sender debits are independently order-invariant');
  assert.deepEqual(basinForwardFloodplain.receipt
    .floodplainPlantDetritusResourceDebitReceipts,
  basinReverseFloodplain.receipt
    .floodplainPlantDetritusResourceDebitReceipts,
  'plant detritus supported-C/P sender debits are independently order-invariant');
  assert.deepEqual(basinForwardFloodplain.receipt
    .floodplainDetritalReturnCreditReceipts,
  basinReverseFloodplain.receipt.floodplainDetritalReturnCreditReceipts,
  'local floodplain C/N/P receiver credits are independently order-invariant');
  assert.deepEqual(basinForwardFloodplain.receipt
    .floodplainDecompositionReceipts,
  basinReverseFloodplain.receipt.floodplainDecompositionReceipts,
  'resource-backed decomposition process receipts are independently order-invariant');
  assert.deepEqual(basinForwardFloodplain.receipt
    .floodplainAerobicMineralizationReceipts,
  basinReverseFloodplain.receipt
    .floodplainAerobicMineralizationReceipts,
  'local floodplain DOC/DIC/O2 chemistry reactions are independently order-invariant');
  assert.deepEqual(basinForwardFloodplain.receipt
    .floodplainRespirationReceipts,
  basinReverseFloodplain.receipt.floodplainRespirationReceipts,
  'persistent oxygen-limited respiration process receipts are independently order-invariant');
  assert.deepEqual(basinForwardFloodplain.receipt
    .floodplainDenitrificationReactionReceipts,
  basinReverseFloodplain.receipt
    .floodplainDenitrificationReactionReceipts,
  'local floodplain DOC/DIN/DIC denitrification reactions are independently order-invariant');
  assert.deepEqual(basinForwardFloodplain.receipt
    .atmosphereFloodplainDenitrificationReceipts,
  basinReverseFloodplain.receipt
    .atmosphereFloodplainDenitrificationReceipts,
  'native-surface atmosphere nitrogen receiver receipts are independently order-invariant');
  assert.deepEqual(basinForwardFloodplain.receipt
    .floodplainDenitrificationProcessReceipts,
  basinReverseFloodplain.receipt
    .floodplainDenitrificationProcessReceipts,
  'persistent oxygen-gated denitrification process receipts are independently order-invariant');
  assert.deepEqual(basinForwardFloodplain.receipt
    .floodplainNitrificationReactionReceipts,
  basinReverseFloodplain.receipt
    .floodplainNitrificationReactionReceipts,
  'local floodplain ammonium/nitrate/O2 nitrification reactions are independently order-invariant');
  assert.deepEqual(basinForwardFloodplain.receipt
    .floodplainNitrificationProcessReceipts,
  basinReverseFloodplain.receipt
    .floodplainNitrificationProcessReceipts,
  'persistent oxygen-ledgered nitrification process receipts are independently order-invariant');
  assert.deepEqual(basinForwardEngine.snapshot(),
    basinReverseEngine.snapshot(),
  'persistent floodplain event, habitat, succession, plant matter, resources, decomposition, respiration, denitrification and nitrification state is order-invariant, not only its public receipt');

  const boundaryEngine = new basinRouting.BasinRoutingEngine({ maximumReachStates: 64 });
  const boundarySector = {
    ...basinSector,
    rivers: [{ ...basinSector.rivers[0], downstreamReachId: 'hydro-reach:v2:not-loaded' }],
    summary: { riverSegments: 1 }
  };
  const boundaryFirst = boundaryEngine.advance(basinColumns, boundarySector, 1, { profileId: 'temperate', startDay: 118, captureTimeDays: .02 });
  const boundarySecond = boundaryEngine.advance(boundaryFirst.columns, boundarySector, 1, { profileId: 'temperate', startDay: 119, captureTimeDays: .02 });
  assert.ok(boundarySecond.receipt.boundaryReceipts.some(receipt => receipt.reason === 'downstream-reach-not-loaded' && receipt.retainedWaterKg > 0), 'unloaded downstream reach emits a retained-water boundary receipt');
  assert.ok(boundarySecond.receipt.boundaryReceipts.some(receipt =>
    receipt.reason === 'downstream-reach-not-loaded' &&
    receipt.retainedSedimentKg > 0),
  'an unloaded downstream reach explicitly retains its suspended and bed sediment');
  assert.ok(boundaryEngine.status('temperate').storedWaterKg > 0 && Math.abs(boundarySecond.receipt.conservation.waterResidualKg) < .1, 'unloaded handoff keeps its water in persistent river storage');
  const retainedFloodplainSave = boundaryEngine.snapshot();
  const retainedFloodplainReach = retainedFloodplainSave.profiles[0].reaches[0];
  retainedFloodplainReach.floodplain.waterKg = 12_345;
  retainedFloodplainReach.floodplain.depositedSedimentKg.clay = 123;
  retainedFloodplainReach.floodplainPlantMatter.guilds.wetMeadow
    .live.carbonKgC = 42;
  retainedFloodplainReach.floodplainPlantMatter.guilds.wetMeadow
    .live.nitrogenKgN = 1.3125;
  retainedFloodplainReach.floodplainPlantResources.guilds.wetMeadow
    .live.supportedCarbonKgC = 42;
  retainedFloodplainReach.floodplainPlantResources.guilds.wetMeadow
    .live.phosphorusKgP = .14;
  retainedFloodplainReach.floodplainPlantResources.guilds.wetMeadow
    .live.waterKg = 180;
  retainedFloodplainReach.floodplainDecomposition
    .observedDecompositionDays = 12;
  retainedFloodplainReach.floodplainDecomposition
    .cumulativeFloodplainReturn = {
      carbonKgC: 7, nitrogenKgN: .7, phosphorusKgP: .07
    };
  retainedFloodplainReach.floodplainRespiration
    .observedRespirationDays = 9;
  retainedFloodplainReach.floodplainRespiration
    .oxygenLimitedDays = 2;
  retainedFloodplainReach.floodplainRespiration
    .cumulativeMineralization = {
      dissolvedOrganicCarbonConsumedKgC: 3,
      dissolvedInorganicCarbonProducedKgC: 3,
      dissolvedOxygenConsumedKgO2: 8
    };
  retainedFloodplainReach.floodplainDenitrification
    .observedDenitrificationDays = 5;
  retainedFloodplainReach.floodplainDenitrification
    .cumulativeReaction = {
      dissolvedOrganicCarbonConsumedKgC: 2,
      dissolvedInorganicCarbonProducedKgC: 2,
      dissolvedNitrateNitrogenConsumedKgN: 1.866666667,
      nitrogenGasProducedKgN: 1.866666667
    };
  retainedFloodplainReach.floodplainNitrification
    .observedNitrificationDays = 6;
  retainedFloodplainReach.floodplainNitrification
    .oxygenLimitedDays = 1;
  retainedFloodplainReach.floodplainNitrification
    .cumulativeReaction = {
      dissolvedAmmoniumNitrogenConsumedKgN: 1.25,
      dissolvedNitrateNitrogenProducedKgN: 1.25,
      dissolvedOxygenConsumedKgO2: 5.7125,
      alkalinityDemandKgCaCO3: 8.925
    };
  const retainedFloodplainEngine = new basinRouting.BasinRoutingEngine({
    maximumReachStates: 64, state: retainedFloodplainSave
  });
  const retainedFloodplainStep = retainedFloodplainEngine.advance(
    boundarySecond.columns,
    { ...boundarySector, rivers: [], summary: { riverSegments: 0 } }, .25,
    { profileId: 'temperate', startDay: 120 }
  );
  assert.ok(retainedFloodplainStep.receipt.boundaryReceipts.some(entry =>
    entry.reason === 'reach-not-in-loaded-sector' &&
    entry.retainedFloodplainWaterKg >= 12_345 &&
    entry.retainedSedimentKg >= 123 &&
    entry.retainedFloodplainPlantCarbonKgC >= 42 &&
    entry.retainedFloodplainPlantNitrogenKgN >= 1.3125 &&
    entry.retainedFloodplainPlantMatterDominantGuild === 'wetMeadow' &&
    entry.retainedFloodplainPlantPhosphorusKgP >= .14 &&
    entry.retainedFloodplainPlantWaterKg >= 180 &&
    entry.retainedFloodplainPlantResourcesDominantGuild === 'wetMeadow' &&
    entry.retainedFloodplainDecompositionCarbonReturnedKgC >= 7 &&
    entry.retainedFloodplainDecompositionNitrogenReturnedKgN >= .7 &&
    entry.retainedFloodplainDecompositionPhosphorusReturnedKgP >= .07 &&
    entry.retainedFloodplainRespirationObservedDays >= 9 &&
    entry.retainedFloodplainRespirationOxygenLimitedDays >= 2 &&
    entry.retainedFloodplainRespirationDocConsumedKgC >= 3 &&
    entry.retainedFloodplainRespirationDicProducedKgC >= 3 &&
    entry.retainedFloodplainRespirationOxygenConsumedKgO2 >= 8 &&
    entry.retainedFloodplainDenitrificationObservedDays >= 5 &&
    entry.retainedFloodplainDenitrificationCarbonKgC >= 2 &&
    entry.retainedFloodplainDenitrificationNitrogenGasKgN >=
      1.866666667 &&
    entry.retainedFloodplainNitrificationObservedDays >= 6 &&
    entry.retainedFloodplainNitrificationAmmoniumConsumedKgN >= 1.25 &&
    entry.retainedFloodplainNitrificationNitrateProducedKgN >= 1.25 &&
    entry.retainedFloodplainNitrificationOxygenConsumedKgO2 >= 5.7125 &&
    entry.retainedFloodplainNitrificationAlkalinityDemandKgCaCO3 >= 8.925),
  `unloaded reaches retain and explicitly receipt persistent floodplain water, deposits, plant C/N/P/tissue-water, decomposition, respiration, denitrification and nitrification memory: ${JSON.stringify(retainedFloodplainStep.receipt.boundaryReceipts)}`);

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
      const boundaryFraction = .18 + (index % 3) * .08;
      column.atmosphere.boundaryLayerPressureHpa = column.atmosphere.surfacePressureHpa *
        boundaryFraction;
      column.atmosphere.freeTroposphere.pressureThicknessHpa =
        column.atmosphere.surfacePressureHpa - column.atmosphere.boundaryLayerPressureHpa;
      column.atmosphere.freeTroposphere.precipitableWaterMm = 1 + index * 1.5;
      column.atmosphere.freeTroposphere.cloudWaterMm = (index % 4) * .7;
      column.atmosphere.freeTroposphere.airTemperatureC = -38 + index * 3;
      if (column.land) {
        column.land.groundwaterStorageMm = column.substrate.aquiferCapacityMm * (.12 + index * .075);
        column.land.waterTableDepthM = column.substrate.aquiferDepthM * (1 - (.12 + index * .075));
      }
      seedNativePressureColumnFromCompatibilityBands(column);
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
    assert.ok(Math.abs(result.receipt.conservation.atmosphereFreeDryAirResidualKg) < .1 &&
      Math.abs(result.receipt.conservation.atmosphereFreeVaporWaterResidualKg) < .1 &&
      Math.abs(result.receipt.conservation.atmosphereFreeCloudWaterResidualKg) < .1,
    'multi-edge free-troposphere dry air, vapor and cloud liquid remain conservative');
    assert.ok(Math.abs(result.receipt.conservation.atmosphereEastwardMomentumResidualKgMps) < 1e5, 'multi-edge eastward momentum closes after declared pressure forcing');
    assert.ok(Math.abs(result.receipt.conservation.atmosphereNorthwardMomentumResidualKgMps) < 1e5, 'multi-edge northward momentum closes after declared pressure forcing');
    assert.equal(result.receipt.atmosphereCoriolisReceipts.length, 72, 'multi-edge rotation emits one Coriolis receipt per loaded native pressure level');
    assert.ok(result.receipt.transfers.momentumMixingDissipationJ >= -1e4, 'multi-edge carried-momentum mixing cannot hide material kinetic-energy creation');
    assert.ok(Math.abs(result.receipt.transfers.coriolisWorkJ) < 1e7, 'multi-edge Coriolis deflection remains materially energy-neutral');
    assert.ok(Math.abs(result.receipt.conservation.atmosphereKineticEnergyResidualJ) < 1e9, 'multi-edge kinetic energy closes after explicit mixing, pressure and rotation terms');
    assert.ok(Math.abs(result.receipt.conservation.atmosphereFreeKineticEnergyResidualJ) < 1e9,
      'multi-edge upper kinetic energy closes independently');
    assert.ok(Math.abs(result.receipt.conservation.atmosphereGeopotentialEnergyResidualJ) < 1e6,
      'multi-edge terrain-following geopotential adjustment closes');
    assert.ok(Math.abs(result.receipt.conservation.groundwaterResidualKg) < .1, 'multi-edge aquifer exchange remains conservative');
    assert.ok(Math.abs(result.receipt.conservation.atmosphereHeatResidualJ) < 1e6, 'multi-edge atmospheric energy remains conservative');
    assert.ok(Math.abs(result.receipt.conservation.atmosphereMoistEnthalpyResidualJ) < 1e7, 'multi-edge moist enthalpy remains conservative');
    assert.ok(Math.abs(result.receipt.conservation.atmosphereFreeMoistEnthalpyResidualJ) < 1e7,
      'multi-edge free-troposphere moist enthalpy remains conservative');
    assert.ok(Math.abs(result.receipt.conservation.oceanEcologyCarbonResidualKg) < 1 &&
      Math.abs(result.receipt.conservation.oceanEcologyNitrogenResidualKg) < 1 &&
      Math.abs(result.receipt.conservation.oceanEcologyPhosphorusResidualKg) < 1 &&
      Math.abs(result.receipt.conservation.oceanEcologyOxygenResidualKg) < 1,
    'repeated multi-edge loaded transport preserves ocean C/N/P/O2 ledgers');
    assert.ok(result.columns.every(column => column.atmosphere.precipitableWaterMm >= .2 && column.atmosphere.precipitableWaterMm <= 75 && column.atmosphere.cloudWaterMm >= 0 && column.atmosphere.cloudWaterMm <= 12), 'multi-edge vapor and cloud-liquid reservoirs remain bounded');
    assert.ok(result.columns.every(column =>
      column.atmosphere.freeTroposphere.precipitableWaterMm >= 0 &&
      column.atmosphere.freeTroposphere.precipitableWaterMm <= 20 &&
      column.atmosphere.freeTroposphere.cloudWaterMm >= 0 &&
      column.atmosphere.freeTroposphere.cloudWaterMm <= 8),
    'multi-edge upper vapor and cloud-liquid reservoirs remain bounded');
    assert.ok(result.columns.every(column => column.atmosphere.surfacePressureHpa >= 849.999999999 &&
      column.atmosphere.surfacePressureHpa <= 1085.000000001 && column.atmosphere.windSpeedMps <= 90 &&
       column.atmosphere.freeTroposphere.windSpeedMps <= 90 &&
       pressureColumn.validatePressureColumn(column.atmosphere.pressureColumn) &&
       column.atmosphere.pressureColumn.layers.every(layer =>
         Math.hypot(layer.eastwardWindMps, layer.northwardWindMps) <= 90.000000001) &&
       column.atmosphere.boundaryLayerPressureHpa / column.atmosphere.surfacePressureHpa >= .08 &&
       column.atmosphere.boundaryLayerPressureHpa / column.atmosphere.surfacePressureHpa <= .5 &&
      Math.abs(column.atmosphere.boundaryLayerPressureHpa +
        column.atmosphere.freeTroposphere.pressureThicknessHpa -
        column.atmosphere.surfacePressureHpa) < 1e-8),
    `multi-edge native pressure mass, hydrostatic sum and vector winds remain bounded (${JSON.stringify(result.columns.map(column => ({
      pressure: column.atmosphere.surfacePressureHpa,
      boundaryFraction: column.atmosphere.boundaryLayerPressureHpa / column.atmosphere.surfacePressureHpa,
      boundaryWind: column.atmosphere.windSpeedMps,
      freeWind: column.atmosphere.freeTroposphere.windSpeedMps
    })))})`);
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
  const rungFiftyTwoTransportSave = JSON.parse(JSON.stringify(transportSave));
  rungFiftyTwoTransportSave.schema =
    earthSystem.PREVIOUS_EARTH_SYSTEM_ENGINE_SCHEMA;
  const rungFiftyTwoTransportRestore = new earthSystem.EarthSystemEngine({
    seed: model.PLANET_DEFAULTS.seed,
    profileId: 'temperate',
    maximumColumns: 4,
    state: rungFiftyTwoTransportSave
  });
  assert.deepEqual(rungFiftyTwoTransportRestore
    .transportStatus('temperate'), transportEngine.transportStatus('temperate'),
  'R53 engine migration preserves a compatible current transport clock and receipt');
  assert.equal(rungFiftyTwoTransportRestore.snapshot().schema,
    earthSystem.EARTH_SYSTEM_ENGINE_SCHEMA);
  assert.ok(restoredTransportEngine.columnsForProfile('temperate').every(column =>
    column.atmosphere.lastPressureColumnHorizontalTransportReceipt?.schema ===
      earthTransport.ATMOSPHERE_PRESSURE_COLUMN_HORIZONTAL_LOCAL_SCHEMA &&
    column.truth.nativePressureLevelHorizontalTransport === true &&
    column.truth.nativePressureLevelHorizontalResolvedEnergyClosed === true),
  'v13 restore preserves each column native horizontal receipt and closure truth');
  const rungNineteenTransportSave = JSON.parse(JSON.stringify(transportSave));
  rungNineteenTransportSave.schema = 'axm.foundation-planet.earth-system-engine/v12';
  rungNineteenTransportSave.columns.forEach(entry => {
    delete entry.column.atmosphere.lastPressureColumnHorizontalTransportReceipt;
    delete entry.column.truth.nativePressureLevelHorizontalTransport;
    delete entry.column.truth.nativePressureLevelHorizontalWaterClosed;
    delete entry.column.truth.nativePressureLevelHorizontalMoistEnthalpyClosed;
    delete entry.column.truth.nativePressureLevelHorizontalMomentumClosed;
    delete entry.column.truth.nativePressureLevelHorizontalResolvedEnergyClosed;
  });
  const migratedRungNineteenTransportEngine = new earthSystem.EarthSystemEngine({
    seed: model.PLANET_DEFAULTS.seed,
    profileId: 'temperate',
    maximumColumns: 4,
    state: rungNineteenTransportSave
  });
  assert.ok(migratedRungNineteenTransportEngine.columnsForProfile('temperate').every(column =>
    column.atmosphere.lastPressureColumnHorizontalTransportReceipt === null &&
    column.truth.nativePressureLevelHorizontalTransport === false &&
    column.truth.nativePressureLevelHorizontalResolvedEnergyClosed === false),
  'v12 columns migrate without inventing native horizontal lineage or closure evidence');
  assert.equal(migratedRungNineteenTransportEngine.snapshot().schema,
    'axm.foundation-planet.earth-system-engine/v31',
    'the first post-migration snapshot records the current land, mixed-layer and deep-ocean lineage');
  assert.throws(() => restoredTransportEngine.commitTransport('temperate', 155, transportedLand.columns, transportedLand.receipt), /transport clock cannot run backward/, 'transport commit refuses replay into an earlier planet day');
  const isolatedProfileEngine = new earthSystem.EarthSystemEngine({ seed: model.PLANET_DEFAULTS.seed, profileId: 'temperate', maximumColumns: 4 });
  const temperateOceanForcing = seasonalWeather.buildSeasonalWeather(-30, -160, oceanSample, { dayOfYear: 121, profile: 'temperate' });
  const glacialOceanSample = model.sampleLatLon(-30, -160, { profile: 'glacial' });
  const glacialOceanForcing = seasonalWeather.buildSeasonalWeather(-30, -160, glacialOceanSample, { dayOfYear: 121, profile: 'glacial' });
  const isolatedTemperateOcean = isolatedProfileEngine.advanceAt(-30, -160, oceanSample, temperateOceanForcing, 121, { profile: 'temperate' });
  const isolatedGlacialOcean = isolatedProfileEngine.advanceAt(-30, -160, glacialOceanSample, glacialOceanForcing, 121, { profile: 'glacial' });
  assert.notEqual(isolatedTemperateOcean.id + isolatedTemperateOcean.profileId, isolatedGlacialOcean.id + isolatedGlacialOcean.profileId, 'condition profiles retain isolated surface-history keys over the same canonical cell');
  assert.ok(isolatedGlacialOcean.surface.temperatureC < isolatedTemperateOcean.surface.temperatureC - 15, 'new glacial cell initializes from glacial water rather than stale temperate heat');

  const thermalEnvelopeLongRunForcing = seasonalWeather
    .buildSeasonalWeather(-30, -160, oceanSample, {
      dayOfYear: 118,
      profile: 'temperate'
    });
  let thermalEnvelopeLongRunColumn = earthSystem.createEarthSystemColumn(
    -30, -160, oceanSample, thermalEnvelopeLongRunForcing, {
      day: 118,
      profile: 'temperate'
    });
  let thermalEnvelopeFirstLimitDay = null;
  let thermalEnvelopeMaximumAtmosphereResidualJm2 = 0;
  let thermalEnvelopeMaximumNativeResidualJm2 = 0;
  let thermalEnvelopeMaximumResolvedResidualJm2 = 0;
  let thermalEnvelopeMaximumRejectedRequestMm = 0;
  for (let day = 1; day <= 365; day++) {
    thermalEnvelopeLongRunColumn = earthSystem.advanceEarthSystemColumn(
      thermalEnvelopeLongRunColumn,
      thermalEnvelopeLongRunForcing,
      oceanSample,
      1,
      {
        livingEnabled: true,
        lifeAbundance: model.CONDITION_PROFILES.temperate.lifeAbundance
      }
    );
    const receipt = thermalEnvelopeLongRunColumn.atmosphere
      .lastPressureColumnDynamicsReceipt;
    if (thermalEnvelopeFirstLimitDay === null &&
        receipt.thermalEnvelopeLimitCount > 0) {
      thermalEnvelopeFirstLimitDay = day;
    }
    thermalEnvelopeMaximumAtmosphereResidualJm2 = Math.max(
      thermalEnvelopeMaximumAtmosphereResidualJm2,
      Math.abs(thermalEnvelopeLongRunColumn.budget.atmosphereEnergy
        .residualJm2)
    );
    thermalEnvelopeMaximumNativeResidualJm2 = Math.max(
      thermalEnvelopeMaximumNativeResidualJm2,
      Math.abs(receipt.residuals.moistEnthalpyJm2)
    );
    thermalEnvelopeMaximumResolvedResidualJm2 = Math.max(
      thermalEnvelopeMaximumResolvedResidualJm2,
      Math.abs(receipt.residuals.resolvedEnergyJm2)
    );
    thermalEnvelopeMaximumRejectedRequestMm = Math.max(
      thermalEnvelopeMaximumRejectedRequestMm,
      receipt.maximumThermallyRejectedRequestMm
    );
    assert.ok(thermalEnvelopeLongRunColumn.atmosphere.pressureColumn.layers
      .every(layer => layer.airTemperatureC >=
          phaseThermalEnvelope.MIN_NATIVE_LAYER_AIR_TEMPERATURE_C - 1e-9 &&
        layer.airTemperatureC <=
          phaseThermalEnvelope.MAX_NATIVE_LAYER_AIR_TEMPERATURE_C + 1e-9),
    '365-day atmosphere history keeps every native layer inside the declared thermal envelope');
  }
  assert.equal(thermalEnvelopeFirstLimitDay, 343,
    'held 365-day ocean history reaches the preserved R54 day-343 thermal-headroom failure trigger');
  assert.ok(thermalEnvelopeMaximumRejectedRequestMm > 0 &&
    thermalEnvelopeMaximumAtmosphereResidualJm2 < 1 &&
    thermalEnvelopeMaximumNativeResidualJm2 < 1 &&
    thermalEnvelopeMaximumResolvedResidualJm2 < 1,
  `temperature-headroom refusal preserves the long-run atmospheric ledger: ${JSON.stringify({
    thermalEnvelopeMaximumRejectedRequestMm,
    thermalEnvelopeMaximumAtmosphereResidualJm2,
    thermalEnvelopeMaximumNativeResidualJm2,
    thermalEnvelopeMaximumResolvedResidualJm2
  })}`);
  const thermalEnvelopeLongRunAudit = systemAudit.auditFoundationSystem({
    column: thermalEnvelopeLongRunColumn
  });
  assert.equal(thermalEnvelopeLongRunAudit.checks.find(check =>
    check.id === 'native-phase-thermal-envelope').status, 'PASS',
  'the system audit independently accepts the final receipted thermal-envelope state');
  const thermallyCorruptedColumn = JSON.parse(JSON.stringify(
    thermalEnvelopeLongRunColumn));
  thermallyCorruptedColumn.atmosphere.pressureColumn.layers[7]
    .airTemperatureC =
      phaseThermalEnvelope.MAX_NATIVE_LAYER_AIR_TEMPERATURE_C + .1;
  assert.equal(systemAudit.auditFoundationSystem({
    column: thermallyCorruptedColumn
  }).checks.find(check => check.id === 'native-phase-thermal-envelope')
    .status, 'FAIL',
  'the thermal-envelope audit rejects an out-of-range persisted native layer');
  const ledgerCorruptedColumn = JSON.parse(JSON.stringify(
    thermalEnvelopeLongRunColumn));
  ledgerCorruptedColumn.atmosphere.lastPressureColumnDynamicsReceipt
    .layerPhaseReceipts[0].moistEnthalpyResidualJm2 = 2;
  assert.equal(systemAudit.auditFoundationSystem({
    column: ledgerCorruptedColumn
  }).checks.find(check => check.id === 'native-phase-thermal-envelope')
    .status, 'FAIL',
  'the thermal-envelope audit rejects a phase receipt whose native moist-enthalpy ledger does not close');

  const boundaryLedgerLatitudeDeg = 25.46855;
  const boundaryLedgerLongitudeDeg = -140.963;
  const boundaryLedgerSample = model.sampleLatLon(
    boundaryLedgerLatitudeDeg,
    boundaryLedgerLongitudeDeg,
    { profile: 'temperate' }
  );
  const boundaryLedgerForcing = seasonalWeather.buildSeasonalWeather(
    boundaryLedgerLatitudeDeg,
    boundaryLedgerLongitudeDeg,
    boundaryLedgerSample,
    { dayOfYear: 156, profile: 'temperate' }
  );
  let boundaryLedgerColumn = earthSystem.createEarthSystemColumn(
    boundaryLedgerLatitudeDeg,
    boundaryLedgerLongitudeDeg,
    boundaryLedgerSample,
    boundaryLedgerForcing,
    { day: 156, profile: 'temperate' }
  );
  let firstBoundaryEnvelopeReconciliationDay = null;
  let maximumBoundaryEnvelopeReconciliationJm2 = 0;
  let maximumBoundaryLedgerResidualJm2 = 0;
  for (let day = 1; day <= 365; day++) {
    boundaryLedgerColumn = earthSystem.advanceEarthSystemColumn(
      boundaryLedgerColumn,
      boundaryLedgerForcing,
      boundaryLedgerSample,
      1,
      {
        livingEnabled: true,
        lifeAbundance: model.CONDITION_PROFILES.temperate.lifeAbundance
      }
    );
    const budget = boundaryLedgerColumn.budget.atmosphereEnergy;
    const receipt = boundaryLedgerColumn.atmosphere
      .lastBoundaryEnergyReceipt;
    const reconciliationJm2 = Math.abs(
      receipt.nativeEnvelopeReconciliationJm2
    );
    if (firstBoundaryEnvelopeReconciliationDay === null &&
        reconciliationJm2 >= 1) {
      firstBoundaryEnvelopeReconciliationDay = day;
    }
    maximumBoundaryEnvelopeReconciliationJm2 = Math.max(
      maximumBoundaryEnvelopeReconciliationJm2,
      reconciliationJm2
    );
    maximumBoundaryLedgerResidualJm2 = Math.max(
      maximumBoundaryLedgerResidualJm2,
      Math.abs(budget.residualJm2)
    );
    assert.ok(receipt.schema === atmosphereBoundaryEnergy
        .ATMOSPHERE_BOUNDARY_ENERGY_RECEIPT_SCHEMA &&
      receipt.truth.requestedAndAppliedBoundaryForcingDistinguished === true &&
      receipt.truth.nativeEnvelopeReconciliationReceipted === true &&
      Math.abs(receipt.ledgerResidualJm2) < 1 &&
      Math.abs(budget.boundaryMoistEnthalpyJm2 -
        receipt.appliedBoundaryMoistEnthalpyJm2) < 1e-3,
    'every held wet-land step preserves the typed requested-versus-applied boundary energy identity');
  }
  assert.equal(firstBoundaryEnvelopeReconciliationDay, 215,
    'the preserved wet-land counterexample reaches its first native-envelope boundary reconciliation on day 215');
  assert.ok(maximumBoundaryEnvelopeReconciliationJm2 > 200_000 &&
    maximumBoundaryLedgerResidualJm2 < 1 &&
    boundaryLedgerColumn.atmosphere.lastBoundaryEnergyReceipt
      .nativeEnvelope.limitedLayerIds.includes('pressure-layer-07'),
  `wet-land native envelope reconciliation closes the whole-atmosphere ledger: ${JSON.stringify({
    maximumBoundaryEnvelopeReconciliationJm2,
    maximumBoundaryLedgerResidualJm2
  })}`);
  const boundaryLedgerAudit = systemAudit.auditFoundationSystem({
    column: boundaryLedgerColumn
  });
  assert.equal(boundaryLedgerAudit.checks.find(check =>
    check.id === 'atmosphere-boundary-forcing-energy-ledger').status,
  'PASS', 'the system audit independently accepts the final boundary-energy receipt');
  const boundaryLedgerCorruptedColumn = JSON.parse(JSON.stringify(
    boundaryLedgerColumn));
  boundaryLedgerCorruptedColumn.atmosphere.lastBoundaryEnergyReceipt
    .nativeEnvelopeReconciliationJm2 += 2;
  assert.equal(systemAudit.auditFoundationSystem({
    column: boundaryLedgerCorruptedColumn
  }).checks.find(check =>
    check.id === 'atmosphere-boundary-forcing-energy-ledger').status,
  'FAIL', 'the audit rejects a tampered boundary-envelope energy reconciliation');

  const thermalEnvelopeMigrationEngine = new earthSystem.EarthSystemEngine({
    seed: model.PLANET_DEFAULTS.seed,
    profileId: 'temperate',
    maximumColumns: 4
  });
  thermalEnvelopeMigrationEngine.advanceAt(-30, -160, oceanSample,
    thermalEnvelopeLongRunForcing, 118, { livingEnabled: true });
  thermalEnvelopeMigrationEngine.advanceAt(-30, -160, oceanSample,
    thermalEnvelopeLongRunForcing, 119, { livingEnabled: true });
  const thermalEnvelopeMigrationSave = thermalEnvelopeMigrationEngine
    .snapshot();
  const thermalEnvelopeMigrationOwnerDigest = column => ({
    surfaceTemperatureC: column.surface.temperatureC,
    ocean: column.ocean,
    cryosphere: column.cryosphere,
    pressureLayers: column.atmosphere.pressureColumn.layers.map(layer => ({
      pressureThicknessHpa: layer.pressureThicknessHpa,
      airTemperatureC: layer.airTemperatureC,
      vaporWaterMm: layer.vaporWaterMm,
      cloudWaterMm: layer.cloudWaterMm,
      cloudIceMm: layer.cloudIceMm,
      eastwardWindMps: layer.eastwardWindMps,
      northwardWindMps: layer.northwardWindMps
    }))
  });
  const thermalEnvelopeCurrentRestore = new earthSystem.EarthSystemEngine({
    seed: model.PLANET_DEFAULTS.seed,
    profileId: 'temperate',
    maximumColumns: 4,
    state: JSON.parse(JSON.stringify(thermalEnvelopeMigrationSave))
  });
  const thermalEnvelopePreMigrationOwners =
    thermalEnvelopeMigrationOwnerDigest(thermalEnvelopeCurrentRestore
      .columnsForProfile('temperate')[0]);
  const boundaryEnergyMigrationSave = JSON.parse(JSON.stringify(
    thermalEnvelopeMigrationSave));
  boundaryEnergyMigrationSave.schema =
    earthSystem.PREVIOUS_EARTH_SYSTEM_ENGINE_SCHEMA;
  const boundaryEnergyLegacyColumn = boundaryEnergyMigrationSave.columns[0]
    .column;
  boundaryEnergyLegacyColumn.atmosphere.lastBoundaryEnergyReceipt
    .nativeEnvelopeReconciliationJm2 += 50_000;
  boundaryEnergyLegacyColumn.budget.atmosphereEnergy.residualJm2 = 50_000;
  const boundaryEnergyMigratedEngine = new earthSystem.EarthSystemEngine({
    seed: model.PLANET_DEFAULTS.seed,
    profileId: 'temperate',
    maximumColumns: 4,
    state: boundaryEnergyMigrationSave
  });
  const boundaryEnergyMigratedColumn = boundaryEnergyMigratedEngine
    .columnsForProfile('temperate')[0];
  assert.deepEqual(thermalEnvelopeMigrationOwnerDigest(
    boundaryEnergyMigratedColumn), thermalEnvelopePreMigrationOwners,
  'v30 migration preserves material, thermal and momentum owners exactly');
  assert.ok(boundaryEnergyMigratedColumn.atmosphere
      .lastBoundaryEnergyReceipt === null &&
    boundaryEnergyMigratedColumn.atmosphere
      .lastPressureColumnDynamicsReceipt !== null &&
    boundaryEnergyMigratedColumn.budget.atmosphereEnergy.residualJm2 === 0 &&
    boundaryEnergyMigratedColumn.budget.atmosphereEnergy
      .migrationCheckpoint === true &&
    boundaryEnergyMigratedColumn.budget.atmosphereEnergy
      .legacyBoundaryEnergyReceiptDiscarded === true &&
    boundaryEnergyMigratedColumn.budget.atmosphereEnergy
      .legacyPhaseReceiptDiscarded === false,
  'v30 migration discards unsupported boundary-energy evidence without discarding valid R55 native phase evidence');
  const boundaryEnergyMigrationAudit = systemAudit.auditFoundationSystem({
    column: boundaryEnergyMigratedColumn
  });
  assert.equal(boundaryEnergyMigrationAudit.checks.find(check =>
    check.id === 'atmosphere-boundary-forcing-energy-ledger').status,
  'NOT_APPLICABLE', 'the v30 checkpoint does not invent an R56 boundary-energy receipt');
  assert.equal(boundaryEnergyMigrationAudit.checks.find(check =>
    check.id === 'native-phase-thermal-envelope').status,
  'PASS', 'the v30 checkpoint retains independently valid R55 phase evidence');
  thermalEnvelopeMigrationSave.schema =
    'axm.foundation-planet.earth-system-engine/v29';
  const thermalEnvelopeLegacyColumn = thermalEnvelopeMigrationSave.columns[0]
    .column;
  thermalEnvelopeLegacyColumn.atmosphere.lastPressureColumnDynamicsReceipt
    .schema = 'axm.foundation-planet.atmosphere-pressure-column-dynamics/v3';
  thermalEnvelopeLegacyColumn.atmosphere.lastPressureColumnDynamicsReceipt
    .layerPhaseReceipts.forEach(receipt => {
      receipt.schema =
        'axm.foundation-planet.atmosphere-pressure-layer-phase/v2';
    });
  thermalEnvelopeLegacyColumn.atmosphere.lastPhaseChangeReceipt.schema =
    'axm.foundation-planet.atmosphere-phase-change-receipt/v2';
  thermalEnvelopeLegacyColumn.atmosphere.lastFreeTropospherePhaseReceipt
    .schema = 'axm.foundation-planet.free-troposphere-phase-receipt/v2';
  thermalEnvelopeLegacyColumn.budget.atmosphereEnergy.residualJm2 =
    -21_595.976412;
  const thermalEnvelopeMigratedEngine = new earthSystem.EarthSystemEngine({
    seed: model.PLANET_DEFAULTS.seed,
    profileId: 'temperate',
    maximumColumns: 4,
    state: thermalEnvelopeMigrationSave
  });
  const thermalEnvelopeMigratedColumn = thermalEnvelopeMigratedEngine
    .columnsForProfile('temperate')[0];
  assert.equal(thermalEnvelopeMigratedEngine.snapshot().schema,
    earthSystem.EARTH_SYSTEM_ENGINE_SCHEMA);
  assert.deepEqual(thermalEnvelopeMigrationOwnerDigest(
    thermalEnvelopeMigratedColumn), thermalEnvelopePreMigrationOwners,
  'v29 migration preserves material, thermal and momentum owners exactly');
  assert.ok(thermalEnvelopeMigratedColumn.atmosphere
      .lastPressureColumnDynamicsReceipt === null &&
    thermalEnvelopeMigratedColumn.atmosphere.lastPhaseChangeReceipt === null &&
    thermalEnvelopeMigratedColumn.atmosphere
      .lastFreeTropospherePhaseReceipt === null &&
    thermalEnvelopeMigratedColumn.budget.atmosphereEnergy.residualJm2 === 0 &&
    thermalEnvelopeMigratedColumn.budget.atmosphereEnergy
      .migrationCheckpoint === true &&
    thermalEnvelopeMigratedColumn.budget.atmosphereEnergy
      .legacyPhaseReceiptDiscarded === true &&
    thermalEnvelopeMigratedColumn.budget.atmosphereEnergy
      .legacyBoundaryEnergyReceiptDiscarded === true &&
    thermalEnvelopeMigratedColumn.truth
      .nativePhaseChangesBoundedByThermalHeadroom === false,
  'v29 migration discards unsupported phase evidence and installs a neutral current-state energy checkpoint without inventing R55 truth');
  const thermalEnvelopeMigrationAudit = systemAudit.auditFoundationSystem({
    column: thermalEnvelopeMigratedColumn
  });
  assert.equal(thermalEnvelopeMigrationAudit.checks.find(check =>
    check.id === 'native-phase-thermal-envelope').status, 'NOT_APPLICABLE');
  assert.notEqual(thermalEnvelopeMigrationAudit.checks.find(check =>
    check.id === 'local-water-and-energy-ledgers').status, 'FAIL',
  'the migrated current-state checkpoint remains auditable without relabeling legacy evidence');

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
      const oceanBiologyBeforeStep = column.ocean ? {
        carbon: {
          phytoplanktonKgCm2: column.ocean.ecology.carbon.phytoplanktonKgCm2,
          zooplanktonKgCm2: column.ocean.ecology.carbon.zooplanktonKgCm2,
          detritusKgCm2: column.ocean.ecology.carbon.detritusKgCm2
        },
        nitrogen: {
          phytoplanktonKgNm2: column.ocean.ecology.nitrogen.phytoplanktonKgNm2,
          zooplanktonKgNm2: column.ocean.ecology.nitrogen.zooplanktonKgNm2,
          detritusKgNm2: column.ocean.ecology.nitrogen.detritusKgNm2
        },
        phosphorus: {
          phytoplanktonKgPm2: column.ocean.ecology.phosphorus.phytoplanktonKgPm2,
          zooplanktonKgPm2: column.ocean.ecology.phosphorus.zooplanktonKgPm2,
          detritusKgPm2: column.ocean.ecology.phosphorus.detritusKgPm2
        }
      } : null;
      forcing = seasonalWeather.buildSeasonalWeather(latitude, longitude, sample, { dayOfYear: index * 9.75 + step, profile: profileId });
      column = earthSystem.advanceEarthSystemColumn(column, forcing, sample, 1, {
        livingEnabled: step % 4 !== 0,
        lifeAbundance: model.CONDITION_PROFILES[profileId].lifeAbundance
      });
      assert.ok(Math.abs(column.budget.water.residualMm) < 1e-5, 'adversarial global column closes water budget');
      assert.ok(Math.abs(column.budget.energy.residualJm2) < 1, 'adversarial global column closes energy budget');
      assert.ok(Math.abs(column.budget.atmosphereEnergy.residualJm2) < 1 &&
        column.atmosphere.lastBoundaryEnergyReceipt.schema ===
          atmosphereBoundaryEnergy.ATMOSPHERE_BOUNDARY_ENERGY_RECEIPT_SCHEMA &&
        Math.abs(column.atmosphere.lastBoundaryEnergyReceipt
          .ledgerResidualJm2) < 1 &&
        Math.abs(column.atmosphere.lastPressureColumnDynamicsReceipt
          .residuals.moistEnthalpyJm2) < 1 &&
        Math.abs(column.atmosphere.lastPressureColumnDynamicsReceipt
          .residuals.resolvedEnergyJm2) < 1,
      'adversarial global column closes boundary, whole-atmosphere and native resolved-energy ledgers');
      assert.ok(column.truth.nativePhaseChangesBoundedByThermalHeadroom ===
          true &&
        column.truth.nativeLayerTemperaturesWithinDeclaredEnvelope === true &&
        column.truth.postMaterialTemperatureClipRequired === false,
      'adversarial global phase changes are source-bounded before movement and require no post-material temperature clip');
      assert.ok(Number.isFinite(column.surface.temperatureC) && column.surface.albedo >= 0 && column.surface.albedo <= 1, 'adversarial global surface stays finite and bounded');
      assert.ok(column.cryosphere.snowWaterEquivalentMm >= 0 && column.cryosphere.seaIceFraction >= 0 && column.cryosphere.seaIceFraction <= 1, 'adversarial cryosphere reservoirs stay bounded');
      assert.ok(column.cryosphere.snowAgeDays >= 0 && column.cryosphere.snowAgeDays <= 3650 &&
        column.budget.energy.radiation.cloudOptics.nativeLayerCount === 8 &&
        Math.abs(column.cryosphere.lastPhaseChangeReceipt.residualJm2) < 1,
      'global histories retain bounded snow age, native cloud optics and closed frozen-phase enthalpy');
      if (column.land) {
        conservativeLandSteps++;
        assert.ok(column.land.rootZoneWaterMm >= 0 && column.land.rootZoneWaterMm <= column.substrate.rootCapacityMm + 1e-5, 'global root-zone reservoir stays within pore capacity');
        assert.ok(column.land.deepSoilWaterMm >= 0 && column.land.deepSoilWaterMm <= column.substrate.deepCapacityMm + 1e-5, 'global deep-soil reservoir stays within pore capacity');
        assert.ok(column.land.groundwaterStorageMm >= 0 && column.land.groundwaterStorageMm <= column.substrate.aquiferCapacityMm + 1e-5, 'global aquifer storage stays within capacity');
        assert.equal(column.land.ecology.schema,
          earthSystem.EARTH_LAND_ECOLOGY_SCHEMA,
        'global land histories retain the typed persistent ecology state');
        assert.equal(column.land.ecology.lastFluxReceipt.schema,
          earthSystem.EARTH_LAND_ECOLOGY_FLUX_SCHEMA);
        assert.ok(Math.abs(column.land.ecology.lastFluxReceipt.carbon.residualKgCm2) < 1e-8 &&
          Math.abs(column.land.ecology.lastFluxReceipt.nitrogen.residualKgNm2) < 1e-8,
        'global land histories close carbon and nitrogen in active and dormant steps');
        assert.ok(column.land.ecology.canopyCover >= 0 &&
          column.land.ecology.canopyCover <= 1 &&
          column.land.ecology.leafAreaIndex >= 0 &&
          column.land.ecology.carbon.liveBiomassKgCm2 >= 0 &&
          column.land.ecology.carbon.litterKgCm2 >= 0 &&
          column.land.ecology.carbon.soilOrganicKgCm2 >= 0 &&
          column.land.ecology.nitrogen.mineralKgNm2 >= 0,
        'global ecology structure and every carbon/nitrogen reservoir stay finite and non-negative');
        if (step % 4 === 0) {
          assert.equal(column.land.ecology.lastFluxReceipt.truth.reservoirsFrozen,
            true, 'global life-off steps freeze ecology reservoirs');
        }
      } else {
        conservativeOceanSteps++;
        assert.ok(column.ocean.salinityPsu >= 2 && column.ocean.salinityPsu <= 43, 'global ocean salinity stays bounded');
        assert.equal(column.ocean.ecology.schema,
          earthSystem.EARTH_OCEAN_ECOLOGY_SCHEMA);
        assert.equal(column.ocean.ecology.lastFluxReceipt.schema,
          earthSystem.EARTH_OCEAN_ECOLOGY_FLUX_SCHEMA);
        assert.ok(Math.abs(column.ocean.ecology.lastFluxReceipt.carbon.residualKgCm2) < 1e-8 &&
          Math.abs(column.ocean.ecology.lastFluxReceipt.nitrogen.residualKgNm2) < 1e-8 &&
          Math.abs(column.ocean.ecology.lastFluxReceipt.phosphorus.residualKgPm2) < 1e-8 &&
          Math.abs(column.ocean.ecology.lastFluxReceipt.oxygen.residualKgO2m2) < 1e-8 &&
          Math.abs(column.ocean.ecology.lastFluxReceipt.alkalinity
            .residualKgCaCO3Eqm2) < 1e-8 &&
          Math.abs(column.ocean.ecology.lastFluxReceipt.deepOcean.conservation
            .alkalinityResidualKgCaCO3Eqm2) < 1e-8,
        'global ocean histories close carbon, nitrogen, phosphorus, oxygen and mixed/deep alkalinity ledgers');
        assert.ok(column.ocean.ecology.carbon.dissolvedInorganicKgCm2 >= 0 &&
          column.ocean.ecology.carbon.dissolvedOrganicKgCm2 >= 0 &&
          column.ocean.ecology.carbon.phytoplanktonKgCm2 >= 0 &&
          column.ocean.ecology.carbon.zooplanktonKgCm2 >= 0 &&
          column.ocean.ecology.carbon.detritusKgCm2 >= 0 &&
          column.ocean.ecology.nitrogen.dissolvedInorganicKgNm2 >= 0 &&
          column.ocean.ecology.phosphorus.dissolvedInorganicKgPm2 >= 0 &&
          column.ocean.ecology.oxygen.dissolvedKgO2m2 >= 0 &&
          column.ocean.ecology.alkalinity.dissolvedKgCaCO3Eqm2 >= 0 &&
          column.ocean.ecology.deepOcean.carbon.dissolvedInorganicKgCm2 >= 0 &&
          column.ocean.ecology.deepOcean.carbon.detritusKgCm2 >= 0 &&
          column.ocean.ecology.deepOcean.carbon.seafloorBuriedOrganicKgCm2 >= 0 &&
          column.ocean.ecology.deepOcean.oxygen.dissolvedKgO2m2 >= 0 &&
          column.ocean.ecology.deepOcean.alkalinity
            .dissolvedKgCaCO3Eqm2 >= 0 &&
          column.ocean.ecology.waterColumn.oxygenSaturationFraction >= 0 &&
          column.ocean.ecology.waterColumn.oxygenSaturationFraction <= 2.5 &&
          column.ocean.ecology.waterColumn.hypoxiaRisk >= 0 &&
          column.ocean.ecology.waterColumn.hypoxiaRisk <= 1,
        'global ocean C/N/P/O2/alkalinity, plankton and diagnostic reservoirs stay finite and bounded');
        if (step % 4 === 0) {
          assert.equal(column.ocean.ecology.lastFluxReceipt.status,
            'physical-only');
          assert.equal(column.ocean.ecology.lastFluxReceipt.truth
            .biologicalReservoirsFrozen, true);
          assert.deepEqual({
            carbon: {
              phytoplanktonKgCm2:
                column.ocean.ecology.carbon.phytoplanktonKgCm2,
              zooplanktonKgCm2:
                column.ocean.ecology.carbon.zooplanktonKgCm2,
              detritusKgCm2: column.ocean.ecology.carbon.detritusKgCm2
            },
            nitrogen: {
              phytoplanktonKgNm2: column.ocean.ecology.nitrogen.phytoplanktonKgNm2,
              zooplanktonKgNm2: column.ocean.ecology.nitrogen.zooplanktonKgNm2,
              detritusKgNm2: column.ocean.ecology.nitrogen.detritusKgNm2
            },
            phosphorus: {
              phytoplanktonKgPm2: column.ocean.ecology.phosphorus.phytoplanktonKgPm2,
              zooplanktonKgPm2: column.ocean.ecology.phosphorus.zooplanktonKgPm2,
              detritusKgPm2: column.ocean.ecology.phosphorus.detritusKgPm2
            }
          }, oceanBiologyBeforeStep,
          'global Life-off steps freeze ocean biology while physical chemistry remains active');
        }
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
    const sedimentPulse = geomorphicSediment.erodeSurfaceSediment(
      column.land.surfaceSediment,
      column.routing.runoffSedimentQueue,
      1,
      {
        sample: model.sampleLatLon(column.coordinate.latitudeDeg,
          column.coordinate.longitudeDeg, { profile: 'temperate' }),
        substrate: column.substrate,
        ecology: column.land.ecology,
        rainfallMm: 18,
        durationDays: 1
      }
    );
    column.land.surfaceSediment = sedimentPulse.state;
    column.routing.runoffSedimentQueue = sedimentPulse.queue;
  }
  const realBasinEngine = new basinRouting.BasinRoutingEngine({ maximumReachStates: 512 });
  const realBasinStep = realBasinEngine.advance(realBasinColumns, drainageA, .25, {
    profileId: 'temperate', startDay: 156, captureTimeDays: .2
  });
  const actualReachIds = new Set(drainageA.rivers.map(reach => reach.id));
  assert.ok(realBasinStep.receipt.inletReceipts.length > 0, 'generated 310-reach sector accepts runoff from at least one overlapping loaded Earth cell');
  assert.ok(realBasinStep.receipt.inletReceipts.every(receipt => actualReachIds.has(receipt.receiver.reachId)), 'every real-sector inlet receipt resolves to a generated canonical reach ID');
  assert.ok(Math.abs(realBasinStep.receipt.conservation.waterResidualKg) < .1, 'real generated sector closes its cross-scale inlet ledger');
  assert.equal(systemAudit.auditFoundationSystem({
    column: realBasinStep.columns[0],
    basinRoutingReceipt: realBasinStep.receipt
  }).checks.find(check => check.id === 'basin-routing-receipt').status,
  'PASS', 'the first real generated-sector basin receipt satisfies the current audit contract');
  assert.equal(systemAudit.auditFoundationSystem({
    column: realBasinStep.columns[0],
    basinRoutingReceipt: realBasinStep.receipt
  }).checks.find(check => check.id === 'floodplain-exchange-receipts').status,
  'PASS', 'the first real generated-sector receipt satisfies the floodplain audit contract');
  assert.equal(systemAudit.auditFoundationSystem({
    column: realBasinStep.columns[0],
    basinRoutingReceipt: realBasinStep.receipt
  }).checks.find(check => check.id === 'floodplain-habitat-receipts').status,
  'PASS', 'the first real generated-sector receipt satisfies the habitat-memory audit contract');
  assert.equal(systemAudit.auditFoundationSystem({
    column: realBasinStep.columns[0],
    basinRoutingReceipt: realBasinStep.receipt
  }).checks.find(check => check.id === 'flood-event-history-receipts').status,
  'PASS', 'the first real generated-sector receipt satisfies the flood-event chronology audit contract');
  assert.equal(systemAudit.auditFoundationSystem({
    column: realBasinStep.columns[0],
    basinRoutingReceipt: realBasinStep.receipt
  }).checks.find(check => check.id === 'floodplain-succession-receipts').status,
  'PASS', 'the first real generated-sector receipt satisfies the finite succession audit contract');
  assert.equal(systemAudit.auditFoundationSystem({
    column: realBasinStep.columns[0],
    basinRoutingReceipt: realBasinStep.receipt
  }).checks.find(check => check.id ===
    'floodplain-plant-matter-receipts').status,
  'PASS', 'the first real generated-sector receipt satisfies the paired plant-matter audit contract');
  let realBasinSweepColumns = realBasinStep.columns;
  for (let basinSweepStep = 1; basinSweepStep <= 64; basinSweepStep++) {
    const swept = realBasinEngine.advance(realBasinSweepColumns, drainageA, .25, {
      profileId: 'temperate', startDay: 156 + basinSweepStep * .25, captureTimeDays: .2
    });
    assert.ok(Math.abs(swept.receipt.conservation.waterResidualKg) < .1, 'repeated real-sector reach routing preserves the combined water ledger');
    assert.ok(swept.columns.every(column => column.routing.runoffQueueMm >= 0), 'repeated real-sector routing keeps every Earth runoff queue non-negative');
    assert.ok(swept.columns.filter(column => column.ocean).every(column => column.ocean.salinityPsu >= 2 && column.ocean.salinityPsu <= 43), 'repeated real-sector mouth updates keep salinity bounded');
    assert.ok(realBasinEngine.snapshot().profiles.every(profile => profile.reaches.every(reach => reach.storageKg >= 0)), 'repeated real-sector routing keeps persistent reach storage non-negative');
    const sweptBasinAudit = systemAudit.auditFoundationSystem({
      column: swept.columns[0], basinRoutingReceipt: swept.receipt
    }).checks.find(check => check.id === 'basin-routing-receipt');
    assert.equal(sweptBasinAudit.status, 'PASS',
      `real generated-sector basin audit stays current at sweep ${basinSweepStep}: ${JSON.stringify(sweptBasinAudit.evidence)}`);
    const sweptFloodplainAudit = systemAudit.auditFoundationSystem({
      column: swept.columns[0], basinRoutingReceipt: swept.receipt
    }).checks.find(check => check.id === 'floodplain-exchange-receipts');
    assert.equal(sweptFloodplainAudit.status, 'PASS',
      `real generated-sector floodplain audit stays current at sweep ${basinSweepStep}: ${JSON.stringify(sweptFloodplainAudit.evidence)}`);
    const sweptHabitatAudit = systemAudit.auditFoundationSystem({
      column: swept.columns[0], basinRoutingReceipt: swept.receipt
    }).checks.find(check => check.id === 'floodplain-habitat-receipts');
    assert.equal(sweptHabitatAudit.status, 'PASS',
      `real generated-sector habitat-memory audit stays current at sweep ${basinSweepStep}: ${JSON.stringify(sweptHabitatAudit.evidence)}`);
    const sweptEventAudit = systemAudit.auditFoundationSystem({
      column: swept.columns[0], basinRoutingReceipt: swept.receipt
    }).checks.find(check => check.id === 'flood-event-history-receipts');
    assert.equal(sweptEventAudit.status, 'PASS',
      `real generated-sector flood-event audit stays current at sweep ${basinSweepStep}: ${JSON.stringify(sweptEventAudit.evidence)}`);
    const sweptSuccessionAudit = systemAudit.auditFoundationSystem({
      column: swept.columns[0], basinRoutingReceipt: swept.receipt
    }).checks.find(check => check.id === 'floodplain-succession-receipts');
    assert.equal(sweptSuccessionAudit.status, 'PASS',
      `real generated-sector floodplain-succession audit stays current at sweep ${basinSweepStep}: ${JSON.stringify(sweptSuccessionAudit.evidence)}`);
    const sweptPlantMatterAudit = systemAudit.auditFoundationSystem({
      column: swept.columns[0], basinRoutingReceipt: swept.receipt
    }).checks.find(check => check.id ===
      'floodplain-plant-matter-receipts');
    assert.equal(sweptPlantMatterAudit.status, 'PASS',
      `real generated-sector floodplain-plant-matter audit stays current at sweep ${basinSweepStep}: ${JSON.stringify(sweptPlantMatterAudit.evidence)}`);
    const sweptPlantResourcesAudit = systemAudit.auditFoundationSystem({
      column: swept.columns[0], basinRoutingReceipt: swept.receipt
    }).checks.find(check => check.id ===
      'floodplain-plant-resources-receipts');
    assert.equal(sweptPlantResourcesAudit.status, 'PASS',
      `real generated-sector floodplain-plant-resources audit stays current at sweep ${basinSweepStep}: ${JSON.stringify(sweptPlantResourcesAudit.evidence)}`);
    const sweptDecompositionAudit = systemAudit.auditFoundationSystem({
      column: swept.columns[0], basinRoutingReceipt: swept.receipt
    }).checks.find(check => check.id ===
      'floodplain-decomposition-receipts');
    assert.equal(sweptDecompositionAudit.status, 'PASS',
      `real generated-sector floodplain-decomposition audit stays current at sweep ${basinSweepStep}: ${JSON.stringify(sweptDecompositionAudit.evidence)}`);
    const sweptRespirationAudit = systemAudit.auditFoundationSystem({
      column: swept.columns[0], basinRoutingReceipt: swept.receipt
    }).checks.find(check => check.id ===
      'floodplain-respiration-receipts');
    assert.equal(sweptRespirationAudit.status, 'PASS',
      `real generated-sector floodplain-respiration audit stays current at sweep ${basinSweepStep}: ${JSON.stringify(sweptRespirationAudit.evidence)}`);
    const sweptDenitrificationAudit = systemAudit.auditFoundationSystem({
      column: swept.columns[0], basinRoutingReceipt: swept.receipt
    }).checks.find(check => check.id ===
      'floodplain-denitrification-receipts');
    assert.equal(sweptDenitrificationAudit.status, 'PASS',
      `real generated-sector floodplain-denitrification audit stays current at sweep ${basinSweepStep}: ${JSON.stringify(sweptDenitrificationAudit.evidence)}`);
    const sweptNitrificationAudit = systemAudit.auditFoundationSystem({
      column: swept.columns[0], basinRoutingReceipt: swept.receipt
    }).checks.find(check => check.id ===
      'floodplain-nitrification-receipts');
    assert.equal(sweptNitrificationAudit.status, 'PASS',
      `real generated-sector floodplain-nitrification audit stays current at sweep ${basinSweepStep}: ${JSON.stringify(sweptNitrificationAudit.evidence)}`);
    assert.ok(Math.abs(swept.receipt.conservation
        .loadedLandFloodplainPlantCarbonResidualKgC) < 1 &&
      Math.abs(swept.receipt.conservation
        .loadedLandFloodplainPlantNitrogenResidualKgN) < 1 &&
      Math.abs(swept.receipt.conservation
        .plantResourceWaterResidualKg) < 1 &&
      Math.abs(swept.receipt.conservation
        .plantResourcePhosphorusResidualKgP) < 1 &&
      Math.abs(swept.receipt.conservation
        .detritalReturnCarbonResidualKgC) < 1 &&
      Math.abs(swept.receipt.conservation
        .detritalReturnNitrogenResidualKgN) < 1 &&
      Math.abs(swept.receipt.conservation
        .detritalReturnPhosphorusResidualKgP) < 1 &&
      Math.abs(swept.receipt.conservation
        .detritalSupportedCarbonReferenceResidualKgC) < 1 &&
      Math.abs(swept.receipt.conservation
        .floodplainDocToDicCarbonResidualKgC) < 1 &&
      Math.abs(swept.receipt.conservation
        .floodplainOxygenConsumptionResidualKgO2) < 1 &&
      Math.abs(swept.receipt.conservation
        .floodplainOxygenStoichiometryResidualKgO2) < 1 &&
      Math.abs(swept.receipt.conservation
        .floodplainDenitrificationCarbonResidualKgC) < 1 &&
      Math.abs(swept.receipt.conservation
        .floodplainDenitrificationNitrogenReactionResidualKgN) < 1 &&
      Math.abs(swept.receipt.conservation
        .floodplainAtmosphereDenitrificationTransferResidualKgN) < 1 &&
      Math.abs(swept.receipt.conservation
        .floodplainNitrificationNitrogenResidualKgN) < 1 &&
      Math.abs(swept.receipt.conservation
        .floodplainNitrificationOxygenResidualKgO2) < 1 &&
      Math.abs(swept.receipt.conservation
        .floodplainNitrificationOxygenStoichiometryResidualKgO2) < 1 &&
      Math.abs(swept.receipt.conservation
        .floodplainNitrificationAlkalinityOwnerResidualKgCaCO3Eq) < 1 &&
      Math.abs(swept.receipt.conservation
        .floodplainNitrificationAlkalinityStoichiometryResidualKgCaCO3Eq) <
        1 &&
      Math.abs(swept.receipt.conservation
        .floodplainDenitrificationAlkalinityOwnerResidualKgCaCO3Eq) < 1 &&
      Math.abs(swept.receipt.conservation
        .coupledAlkalinityResidualKgCaCO3Eq) < 1,
    'repeated real-sector transfers close plant C/N, plant water/P, resource-backed detrital return, local respiration, paired denitrification and oxygen/alkalinity-ledgered nitrification');
    realBasinSweepColumns = swept.columns;
  }
  const realDecoratedBasin = realBasinEngine.decorateSector(drainageA, 'temperate');
  assert.equal(realDecoratedBasin.rivers.length, drainageA.rivers.length, 'state decoration preserves the complete real canonical reach topology');
  assert.ok(realDecoratedBasin.summary.activeChannelReachStates > 0, 'real generated sector exposes its active persistent channel states');
  assert.ok(realDecoratedBasin.rivers.every(reach =>
    reach.floodplainPlantMatter &&
    Object.keys(reach.floodplainPlantMatter.guilds).length ===
      floodplainSuccession.FLOODPLAIN_SUCCESSION_GUILDS.length &&
    Object.values(reach.floodplainPlantMatter.total).every(Number.isFinite)),
  'all 310 canonical reaches expose bounded semantic plant-matter state, including empty unloaded states');
  assert.ok(realDecoratedBasin.rivers.every(reach =>
    reach.floodplainPlantResources &&
    Object.keys(reach.floodplainPlantResources.guilds).length ===
      floodplainSuccession.FLOODPLAIN_SUCCESSION_GUILDS.length &&
    Object.values(reach.floodplainPlantResources.total)
      .every(Number.isFinite)),
  'all 310 canonical reaches expose bounded semantic plant phosphorus and tissue-water state, including empty unloaded states');
  assert.ok(realDecoratedBasin.rivers.every(reach =>
    reach.floodplainDecomposition &&
    Number.isFinite(reach.floodplainDecomposition
      .observedDecompositionDays) &&
    Object.values(reach.floodplainDecomposition
      .cumulativeFloodplainReturn).every(Number.isFinite) &&
    reach.floodplainDecomposition.truth.materialOwnership === false &&
    reach.floodplainDecomposition.truth
      .onlyResourceBackedDetritusEligible === true),
  'all 310 canonical reaches expose bounded semantic decomposition memory, including empty unloaded states');
  assert.ok(realDecoratedBasin.rivers.every(reach =>
    reach.floodplainRespiration &&
    Number.isFinite(reach.floodplainRespiration
      .observedRespirationDays) &&
    Number.isFinite(reach.floodplainRespiration.oxygenLimitedDays) &&
    Object.values(reach.floodplainRespiration
      .cumulativeMineralization).every(Number.isFinite) &&
    reach.floodplainRespiration.truth.chemistryOwnership === false &&
    reach.floodplainRespiration.truth.oxygenLimited === true),
  'all 310 canonical reaches expose bounded semantic aerobic-respiration memory, including empty unloaded states');
  assert.ok(realDecoratedBasin.rivers.every(reach =>
    reach.floodplainDenitrification &&
    Number.isFinite(reach.floodplainDenitrification
      .observedDenitrificationDays) &&
    Number.isFinite(reach.floodplainDenitrification
      .atmosphereUnavailableDays) &&
    Number.isFinite(reach.floodplainDenitrification
      .temperatureConstrainedDays) &&
    Object.values(reach.floodplainDenitrification.cumulativeReaction)
      .every(Number.isFinite) &&
    Number.isFinite(reach.floodplainDenitrification.lastActivity
      .waterTemperatureC) &&
    Number.isFinite(reach.floodplainDenitrification.lastActivity
      .temperatureResponseFactor) &&
    reach.floodplainDenitrification.truth
      .floodplainChemistryOwnership === false &&
    reach.floodplainDenitrification.truth.oxygenGated === true &&
    reach.floodplainDenitrification.truth
      .surfaceTemperatureProxyResponsive === true &&
    reach.floodplainDenitrification.truth
      .persistentFloodplainWaterTemperatureState === false &&
    reach.floodplainDenitrification.truth
      .nitrateSpeciationResolved === true &&
    reach.floodplainDenitrification.truth
      .nitrateOnlyDenitrification === true &&
    reach.channelNitrogenSpecies &&
    Math.abs(reach.channelNitrogenSpecies.dissolvedInorganicNitrogenKgN -
      reach.channelNitrogenSpecies.nitrateNitrogenKgN -
      reach.channelNitrogenSpecies.ammoniumNitrogenKgN) < 1e-7 &&
    reach.floodplain.nitrogenSpecies &&
    Math.abs(reach.floodplain.nitrogenSpecies
      .dissolvedInorganicNitrogenKgN -
      reach.floodplain.nitrogenSpecies.nitrateNitrogenKgN -
      reach.floodplain.nitrogenSpecies.ammoniumNitrogenKgN) < 1e-7),
  'all 310 canonical reaches expose bounded nitrate/ammonium ownership and nitrate-only temperature-responsive denitrification memory, including empty unloaded states');
  assert.ok(realDecoratedBasin.rivers.every(reach =>
    reach.floodplainNitrification &&
    Number.isFinite(reach.floodplainNitrification
      .observedNitrificationDays) &&
    Number.isFinite(reach.floodplainNitrification.oxygenConstrainedDays) &&
    Number.isFinite(reach.floodplainNitrification.oxygenLimitedDays) &&
    Number.isFinite(reach.floodplainNitrification.alkalinityLimitedDays) &&
    Number.isFinite(reach.floodplainNitrification.alkalinityLimitedDays) &&
    Number.isFinite(reach.floodplainNitrification
      .temperatureConstrainedDays) &&
    Object.values(reach.floodplainNitrification.cumulativeReaction)
      .every(Number.isFinite) &&
    Number.isFinite(reach.floodplainNitrification.lastActivity
      .dissolvedOxygenMgL) &&
    Number.isFinite(reach.floodplainNitrification.lastActivity
      .temperatureResponseFactor) &&
    Number.isFinite(reach.floodplainNitrification.lastActivity
      .availableAlkalinityKgCaCO3Eq) &&
    reach.floodplainNitrification.truth
      .persistentNitrificationProcessMemory === true &&
    reach.floodplainNitrification.truth
      .ammoniumToNitrateOneStepApproximation === true &&
    reach.floodplainNitrification.truth.nitriteIntermediateResolved ===
      false &&
    reach.floodplainNitrification.truth.alkalinityDemandDiagnostic ===
      false &&
    reach.floodplainNitrification.truth
      .alkalinityMaterialOwnerDebited === true),
  'all 310 canonical reaches expose bounded oxygen/alkalinity-ledgered nitrification memory, including empty unloaded states');
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

  const experienceSource = {
    schema: experienceProtocol.EXPERIENCE_SOURCE_SCHEMA,
    worldId: model.PLANET_DEFAULTS.id,
    lineageId: `${model.PLANET_DEFAULTS.id}:${model.PLANET_DEFAULTS.seed}:root`,
    revision: 7,
    stateChecksum: 'fnv1a32:1234abcd',
    host: { attached: false, authoritative: false, revision: null, digest: null },
    profileId: 'temperate',
    clock: { day: 119.25, year: 1 },
    location: { lat: 25.536, lon: -140.963, elevationM: grasslandSample.elevationM },
    sectorSizeKm: 120,
    sample: grasslandSample,
    weather: seasonalWeather.buildSeasonalWeather(25.536, -140.963, grasslandSample, { dayOfYear: 119.25 }),
    layers: { layers: { terrain: true, hydrology: true, atmosphere: true, vegetation: true, fauna: true, decomposers: true } },
    hydrology: realDecoratedBasin,
    earthSystem: wetEarthStep,
    physics: physicsSector,
    observedSpecies: ['wolf', 'oak', 'trout', 'oak'],
    regionalCommunity: { population: 314159, realms: ['terrestrial', 'freshwater'] },
    ecosystemDynamics: { status: 'stable', revision: 4 }
  };
  const experienceCapsule = experienceProtocol.createExperienceSectorCapsule(experienceSource);
  assert.equal(experienceCapsule.schema, 'axm.foundation-planet.experience-sector-capsule/v1', 'sector experience uses its typed capsule schema');
  assert.equal(experienceProtocol.validateExperienceSectorCapsule(experienceCapsule).valid, true, 'fresh sector capsule validates against all component digests');
  assert.equal(experienceCapsule.truth.rendererIndependent, true, 'experience capsule is renderer independent');
  assert.equal(experienceCapsule.truth.rendererObjectsIncluded, false, 'experience capsule excludes live renderer objects');
  assert.equal(experienceCapsule.truth.worldMutationAuthority, false, 'experience capsule carries no world mutation authority');
  assert.equal(experienceCapsule.truth.floodplainPlantMatterProjected,
    true, 'experience capsule declares the semantic plant-matter projection');
  assert.equal(experienceCapsule.truth.floodplainPlantResourcesProjected,
    true, 'experience capsule declares the semantic plant-resource projection');
  assert.equal(experienceCapsule.truth.floodplainDecompositionProjected,
    true, 'experience capsule declares the semantic decomposition projection');
  assert.equal(experienceCapsule.truth.floodplainRespirationProjected,
    true, 'experience capsule declares the semantic respiration projection');
  assert.equal(experienceCapsule.truth.floodplainDenitrificationProjected,
    true, 'experience capsule declares the semantic denitrification projection');
  assert.equal(experienceCapsule.truth.floodplainNitrificationProjected,
    true, 'experience capsule declares the semantic nitrification projection');
  assert.equal(experienceCapsule.truth
    .riverFloodplainNitrateAmmoniumProjected,
  true, 'experience capsule declares its compact river/floodplain nitrate and ammonium projection');
  assert.equal(experienceCapsule.truth
    .floodplainDenitrificationTemperatureResponseProjected,
  true, 'experience capsule declares the semantic denitrification temperature-response projection');
  assert.equal(experienceCapsule.authority.capsuleAuthoritative, false, 'projection never relabels itself as canonical state');
  assert.equal(experienceCapsule.access.automaticMirrorConnection, false, 'capsule does not pretend Mirror is connected');
  assert.equal(experienceCapsule.access.automaticHolodeckConnection, false, 'capsule does not pretend Holodeck is connected');
  assert.equal(experienceCapsule.access.automaticExperimentWorldIntake, false, 'capsule does not silently enter the experimental shoebox');
  assert.ok(experienceCapsule.components.hydrology.rivers.length > 20, 'capsule carries bounded stable canonical river features');
  assert.ok(experienceCapsule.components.hydrology.rivers.some(reach =>
    reach.floodplain && Number.isFinite(reach.floodplain.waterKg) &&
    Number.isFinite(reach.floodplain.totalSedimentKg)),
  'renderer-independent experience capsules carry compact semantic floodplain ownership');
  assert.ok(experienceCapsule.components.hydrology.rivers.some(reach =>
    reach.floodplainHabitat &&
    Number.isFinite(reach.floodplainHabitat.rollingHydroperiod30d) &&
    Number.isFinite(reach.floodplainHabitat.floodPulseCount) &&
    Math.abs(Object.values(reach.floodplainHabitat.fractions)
      .reduce((sum, value) => sum + value, 0) - 1) < 1e-9 &&
    reach.floodplainHabitat.truth.potentialHabitatOnly === true &&
    reach.floodplainHabitat.truth.ecologicalPopulationState === false),
  'renderer-independent experience capsules carry normalized habitat potential without inventing populations');
  assert.ok(experienceCapsule.components.hydrology.rivers.some(reach =>
    reach.floodEvents &&
    Array.isArray(reach.floodEvents.recentEvents) &&
    reach.floodEvents.recentEvents.length <= 8 &&
    reach.floodEvents.archiveLimit === 32 &&
    reach.floodEvents.truth.readOnlyFloodplainMaterialObserver === true &&
    reach.floodEvents.truth.scientificFloodFrequencyModel === false),
  'renderer-independent experience capsules carry a compact, read-only event chronicle without claiming a scientific frequency model');
  assert.ok(experienceCapsule.components.hydrology.rivers.some(reach =>
    reach.floodplainSuccession &&
    reach.floodplainSuccession.totalCoverFraction <= .98 &&
    Object.keys(reach.floodplainSuccession.guilds).length ===
      floodplainSuccession.FLOODPLAIN_SUCCESSION_GUILDS.length &&
    reach.floodplainSuccession.truth.materialAuthority === false &&
    reach.floodplainSuccession.truth.speciesOccupancyState === false &&
    reach.floodplainSuccession.truth.scientificSuccessionModel === false),
  'renderer-independent experience capsules carry compact living guild state without inventing biomass, species occupancy or scientific authority');
  assert.ok(experienceCapsule.components.hydrology.rivers.some(reach =>
    reach.floodplainPlantMatter &&
    Object.keys(reach.floodplainPlantMatter.guilds).length ===
      floodplainSuccession.FLOODPLAIN_SUCCESSION_GUILDS.length &&
    Object.values(reach.floodplainPlantMatter.live)
      .every(Number.isFinite) &&
    Object.values(reach.floodplainPlantMatter.standingDead)
      .every(Number.isFinite) &&
    Object.values(reach.floodplainPlantMatter.litter)
      .every(Number.isFinite) &&
    reach.floodplainPlantMatter.truth
      .pairedLandEcologySubgridPartitionRequired === true &&
    reach.floodplainPlantMatter.truth.plantPhosphorusOwnership === false),
  'renderer-independent experience capsules carry bounded plant C/N matter ownership separate from the P/water organ');
  assert.ok(experienceCapsule.components.hydrology.rivers.some(reach =>
    reach.floodplainPlantResources &&
    Object.keys(reach.floodplainPlantResources.guilds).length ===
      floodplainSuccession.FLOODPLAIN_SUCCESSION_GUILDS.length &&
    Object.values(reach.floodplainPlantResources.live)
      .every(Number.isFinite) &&
    Object.values(reach.floodplainPlantResources.standingDead)
      .every(Number.isFinite) &&
    Object.values(reach.floodplainPlantResources.litter)
      .every(Number.isFinite) &&
    reach.floodplainPlantResources.truth
      .persistentPlantPhosphorusAndTissueWater === true &&
    reach.floodplainPlantResources.truth
      .resourceBackedCarbonReferenceOwnsCarbon === false),
  'renderer-independent experience capsules carry persistent plant P/water ownership with non-owning C references');
  assert.ok(experienceCapsule.components.hydrology.rivers.some(reach =>
    reach.floodplainDecomposition &&
    Number.isFinite(reach.floodplainDecomposition
      .observedDecompositionDays) &&
    Object.values(reach.floodplainDecomposition
      .cumulativeFloodplainReturn).every(Number.isFinite) &&
    reach.floodplainDecomposition.truth.materialOwnership === false &&
    reach.floodplainDecomposition.truth
      .onlyResourceBackedDetritusEligible === true &&
    reach.floodplainDecomposition.truth.atmosphericRespirationModeled ===
      false),
  'renderer-independent experience capsules carry bounded decomposition memory without inventing material ownership or atmospheric respiration');
  assert.ok(experienceCapsule.components.hydrology.rivers.some(reach =>
    reach.floodplainRespiration &&
    Number.isFinite(reach.floodplainRespiration
      .observedRespirationDays) &&
    Number.isFinite(reach.floodplainRespiration.oxygenLimitedDays) &&
    Object.values(reach.floodplainRespiration
      .cumulativeMineralization).every(Number.isFinite) &&
    reach.floodplainRespiration.truth.chemistryOwnership === false &&
    reach.floodplainRespiration.truth.oxygenLimited === true &&
    reach.floodplainRespiration.truth.atmosphericGasExchangeModeled ===
      false &&
    reach.floodplainRespiration.truth.anaerobicPathwayModeled === false),
  'renderer-independent experience capsules carry bounded aerobic-respiration memory without inventing chemistry ownership, atmosphere exchange or an anaerobic path');
  assert.ok(experienceCapsule.components.hydrology.rivers.some(reach =>
    reach.floodplainDenitrification &&
    Number.isFinite(reach.floodplainDenitrification
      .observedDenitrificationDays) &&
    Number.isFinite(reach.floodplainDenitrification
      .atmosphereUnavailableDays) &&
    Number.isFinite(reach.floodplainDenitrification
      .temperatureConstrainedDays) &&
    Object.values(reach.floodplainDenitrification.cumulativeReaction)
      .every(Number.isFinite) &&
    Number.isFinite(reach.floodplainDenitrification.lastActivity
      .waterTemperatureC) &&
    Number.isFinite(reach.floodplainDenitrification.lastActivity
      .temperatureResponseFactor) &&
    reach.floodplainDenitrification.truth
      .floodplainChemistryOwnership === false &&
    reach.floodplainDenitrification.truth.oxygenGated === true &&
    reach.floodplainDenitrification.truth
      .surfaceTemperatureProxyResponsive === true &&
    reach.floodplainDenitrification.truth
      .persistentFloodplainWaterTemperatureState === false &&
    reach.floodplainDenitrification.truth
      .dissolvedInorganicNitrogenTreatedAsFullyNitrate === false &&
    reach.floodplainDenitrification.truth
      .nitrateSpeciationResolved === true &&
    reach.floodplainDenitrification.truth
      .nitrateOnlyDenitrification === true &&
    reach.floodplainDenitrification.truth
      .ammoniumConsumedByDenitrification === false &&
    reach.channelNitrogenSpecies &&
    reach.floodplain?.nitrogenSpecies),
  'renderer-independent experience capsules carry nitrate/ammonium ownership and bounded nitrate-only temperature-responsive denitrification memory without inventing chemistry or water-temperature ownership');
  assert.ok(experienceCapsule.components.hydrology.rivers.some(reach =>
    reach.floodplainNitrification &&
    Number.isFinite(reach.floodplainNitrification
      .observedNitrificationDays) &&
    Number.isFinite(reach.floodplainNitrification.oxygenConstrainedDays) &&
    Number.isFinite(reach.floodplainNitrification.oxygenLimitedDays) &&
    Number.isFinite(reach.floodplainNitrification
      .temperatureConstrainedDays) &&
    Object.values(reach.floodplainNitrification.cumulativeReaction)
      .every(Number.isFinite) &&
    Number.isFinite(reach.floodplainNitrification.lastActivity
      .dissolvedOxygenMgL) &&
    Number.isFinite(reach.floodplainNitrification.lastActivity
      .temperatureResponseFactor) &&
    reach.floodplainNitrification.truth
      .persistentNitrificationProcessMemory === true &&
    reach.floodplainNitrification.truth
      .ammoniumToNitrateOneStepApproximation === true &&
    reach.floodplainNitrification.truth.nitriteIntermediateResolved ===
      false &&
    reach.floodplainNitrification.truth.alkalinityDemandDiagnostic ===
      false &&
    reach.floodplainNitrification.truth
      .alkalinityMaterialOwnerDebited === true &&
    reach.floodplainNitrification.truth.pHFeedbackModeled === false),
  'renderer-independent experience capsules carry bounded oxygen/alkalinity-ledgered nitrification memory without inventing pH or nitrite state');
  assert.equal(experienceCapsule.components.earthSystem.land.surfaceSediment
    .schema, geomorphicSediment.SURFACE_SEDIMENT_STATE_SCHEMA,
  'renderer-independent experience capsules preserve finite mineral surface ownership');
  assert.equal(experienceCapsule.components.earthSystem.routing
    .runoffSedimentQueue.schema,
  geomorphicSediment.RUNOFF_SEDIMENT_QUEUE_SCHEMA,
  'future game layers receive the same persistent runoff sediment state without renderer coupling');
  assert.deepEqual(experienceCapsule.components.ecology.observedSpecies, ['oak', 'trout', 'wolf'], 'set-like species observations are unique and canonical');
  assert.ok(!/(?:WebGLRenderer|THREE\.Scene|PerspectiveCamera|"scene"\s*:|"camera"\s*:|"mesh"\s*:)/i.test(JSON.stringify(experienceCapsule)), 'capsule contains no live renderer-owned objects');

  const reorderedExperienceSource = JSON.parse(JSON.stringify(experienceSource));
  reorderedExperienceSource.hydrology.rivers.reverse();
  reorderedExperienceSource.hydrology.lakes.reverse();
  reorderedExperienceSource.hydrology.handoffs.reverse();
  reorderedExperienceSource.observedSpecies.reverse();
  const reorderedExperienceCapsule = experienceProtocol.createExperienceSectorCapsule(reorderedExperienceSource);
  assert.deepEqual(reorderedExperienceCapsule, experienceCapsule, 'set-like sector feature order cannot change capsule state or digest');
  const changedExperienceSource = JSON.parse(JSON.stringify(experienceSource));
  changedExperienceSource.sample.elevationM += 1;
  assert.notEqual(experienceProtocol.createExperienceSectorCapsule(changedExperienceSource).capsuleDigest, experienceCapsule.capsuleDigest, 'a semantic sector change alters the capsule digest');
  const tamperedExperienceCapsule = JSON.parse(JSON.stringify(experienceCapsule));
  tamperedExperienceCapsule.components.environment.sample.temperatureC += 1;
  const tamperedExperienceValidation = experienceProtocol.validateExperienceSectorCapsule(tamperedExperienceCapsule);
  assert.equal(tamperedExperienceValidation.valid, false, 'component tampering under an old capsule digest is refused');
  assert.ok(tamperedExperienceValidation.errors.includes('component-digest:environment') && tamperedExperienceValidation.errors.includes('capsule-digest'), 'tamper refusal identifies both component and capsule lineage failures');

  const observerLease = experienceProtocol.openExperienceLease(experienceCapsule, {
    mode: 'observer', actor: { id: 'mirror-observer', kind: 'machine' }, maximumIntents: 4
  });
  const playerLease = experienceProtocol.openExperienceLease(experienceCapsule, {
    mode: 'player', actor: { id: 'mike-player', kind: 'human' }, maximumIntents: 4
  });
  const sandboxLease = experienceProtocol.openExperienceLease(experienceCapsule, {
    mode: 'sandbox', actor: { id: 'mirror-experiment', kind: 'machine' }, maximumIntents: 4
  });
  assert.deepEqual(observerLease.capabilities, ['observe-structured-sector'], 'observer lease has sight without action authority');
  assert.ok(playerLease.capabilities.includes('propose-governed-world-action'), 'player lease may create governed proposals');
  assert.ok(sandboxLease.capabilities.includes('mutate-detached-candidate'), 'sandbox lease grants creativity only inside the detached candidate');
  assert.equal([observerLease, playerLease, sandboxLease].every(lease => experienceProtocol.validateExperienceLease(lease, experienceCapsule).valid), true, 'all three lease modes validate against the exact capsule lineage');

  const sourceBeforeExperienceDispatch = JSON.stringify(experienceCapsule);
  const observerMutation = experienceProtocol.dispatchExperienceIntent(experienceCapsule, observerLease, {
    schema: experienceProtocol.EXPERIENCE_INTENT_SCHEMA,
    id: 'observer-build-attempt', sequence: 0, kind: 'WORLD_ACTION_PROPOSE',
    actor: { id: 'mirror-observer', kind: 'machine' },
    action: { kind: 'build-city' }, payload: { name: 'Should not exist' }
  });
  assert.equal(observerMutation.receipt.status, 'REFUSED', 'observer world-action attempt is refused');
  assert.equal(observerMutation.receipt.code, 'MODE_HAS_NO_WORLD_ACTION_PROPOSAL_AUTHORITY', 'observer refusal names the exact missing authority');
  assert.equal(observerMutation.proposal, null, 'observer refusal creates no world-action proposal');
  assert.equal(observerMutation.receipt.truth.canonicalWorldMutated, false, 'observer refusal applies no world mutation');

  const observerRead = experienceProtocol.dispatchExperienceIntent(experienceCapsule, observerMutation.lease, {
    schema: experienceProtocol.EXPERIENCE_INTENT_SCHEMA,
    id: 'observer-read', sequence: 1, kind: 'OBSERVE',
    actor: { id: 'mirror-observer', kind: 'machine' }
  });
  assert.equal(observerRead.observation.schema, 'axm.foundation-planet.experience-observation/v1', 'observer receives a typed structured observation');
  assert.equal(observerRead.observation.truth.cameraVision, false, 'structured observation does not pretend to be camera vision');

  const playerProposalResult = experienceProtocol.dispatchExperienceIntent(experienceCapsule, playerLease, {
    schema: experienceProtocol.EXPERIENCE_INTENT_SCHEMA,
    id: 'player-plant-tree', sequence: 0, kind: 'WORLD_ACTION_PROPOSE',
    actor: { id: 'mike-player', kind: 'human' },
    action: { kind: 'plant-native', targetId: 'sector-center' },
    payload: { speciesId: 'oak', count: 1 }
  });
  assert.equal(playerProposalResult.receipt.code, 'WORLD_ACTION_PROPOSAL_CREATED_NOT_APPLIED', 'player action becomes an unapplied proposal');
  assert.equal(playerProposalResult.proposal.schema, 'axm.foundation-planet.world-action-proposal/v1', 'player proposal carries the typed world-action contract');
  assert.equal(playerProposalResult.proposal.expectedRevision, experienceSource.revision, 'proposal binds to the exact source revision');
  assert.equal(playerProposalResult.proposal.authority.applyAuthority, false, 'player proposal cannot apply itself');
  assert.equal(playerProposalResult.proposal.authority.humanGovernedReviewRequired, true, 'player proposal preserves the human integration checkpoint');
  assert.equal(playerProposalResult.proposal.truth.canonicalWorldMutated, false, 'proposal creation changes no canonical world state');
  assert.equal(JSON.stringify(experienceCapsule), sourceBeforeExperienceDispatch, 'observer and player dispatch leave the source capsule byte-identical');
  const replayedPlayerProposal = experienceProtocol.dispatchExperienceIntent(experienceCapsule, playerProposalResult.lease, {
    schema: experienceProtocol.EXPERIENCE_INTENT_SCHEMA,
    id: 'player-replay', sequence: 0, kind: 'WORLD_ACTION_PROPOSE',
    actor: { id: 'mike-player', kind: 'human' }, action: { kind: 'plant-native' }
  });
  assert.equal(replayedPlayerProposal.receipt.code, 'STALE_OR_REPLAYED_SEQUENCE', 'advanced player lease refuses a replayed sequence');
  assert.deepEqual(replayedPlayerProposal.lease, playerProposalResult.lease, 'replay refusal does not advance or mutate the lease');

  const oversizedProposalLease = experienceProtocol.openExperienceLease(experienceCapsule, {
    mode: 'player', actor: { id: 'budget-probe', kind: 'service' }, maximumIntents: 2
  });
  const oversizedProposalResult = experienceProtocol.dispatchExperienceIntent(experienceCapsule, oversizedProposalLease, {
    schema: experienceProtocol.EXPERIENCE_INTENT_SCHEMA,
    id: 'oversized-player-proposal', sequence: 0, kind: 'WORLD_ACTION_PROPOSE',
    actor: { id: 'budget-probe', kind: 'service' }, action: { kind: 'attach-large-payload' },
    payload: { chunks: Array.from({ length: 32 }, (_, index) => `${index}:${'界'.repeat(2048)}`) }
  });
  assert.equal(oversizedProposalResult.receipt.status, 'REFUSED', 'oversized player payload is refused without throwing');
  assert.equal(oversizedProposalResult.receipt.code, 'PROPOSAL_PAYLOAD_INVALID_OR_OVER_BUDGET', 'oversized proposal refusal names the bounded payload contract');
  assert.equal(oversizedProposalResult.proposal, null, 'oversized payload creates no proposal');
  assert.equal(oversizedProposalResult.receipt.truth.canonicalWorldMutated, false, 'oversized payload refusal cannot mutate canonical state');

  const sandboxForkResult = experienceProtocol.dispatchExperienceIntent(experienceCapsule, sandboxLease, {
    schema: experienceProtocol.EXPERIENCE_INTENT_SCHEMA,
    id: 'mirror-wild-fork', sequence: 0, kind: 'SANDBOX_FORK',
    actor: { id: 'mirror-experiment', kind: 'machine' },
    payload: { branch: 'mirror-unbounded-lab', budgets: { maximumArtifacts: 2048, maximumEvents: 8192 } }
  });
  assert.equal(sandboxForkResult.sandboxFork.schema, 'axm.foundation-planet.detached-sandbox-fork/v1', 'sandbox lease emits a typed detached candidate');
  assert.equal(sandboxForkResult.sandboxFork.truth.creativeMutationInsideCandidateAllowed, true, 'detached sandbox explicitly permits creative mutation inside itself');
  assert.equal(sandboxForkResult.sandboxFork.truth.canonicalWriteback, false, 'detached sandbox has no canonical writeback');
  assert.equal(sandboxForkResult.sandboxFork.truth.automaticPromotion, false, 'detached sandbox cannot promote itself');
  assert.deepEqual(sandboxForkResult.sandboxFork.capsule, experienceCapsule, 'sandbox fork preserves the exact immutable source capsule');
  assert.equal(JSON.stringify(experienceCapsule), sourceBeforeExperienceDispatch, 'sandbox creation leaves its source capsule byte-identical');

  const boundedSandboxLease = experienceProtocol.openExperienceLease(experienceCapsule, {
    mode: 'sandbox', actor: { id: 'sandbox-budget-probe', kind: 'service' }, maximumIntents: 2
  });
  const boundedSandboxResult = experienceProtocol.dispatchExperienceIntent(experienceCapsule, boundedSandboxLease, {
    schema: experienceProtocol.EXPERIENCE_INTENT_SCHEMA,
    id: 'bounded-sandbox-fork', sequence: 0, kind: 'SANDBOX_FORK',
    actor: { id: 'sandbox-budget-probe', kind: 'service' },
    payload: { branch: 'resource-clamp-probe', budgets: {
      maximumArtifacts: 1_000_000,
      maximumEvents: 1_000_000,
      maximumSerializedBytes: 9_000_000_000
    } }
  });
  assert.deepEqual(boundedSandboxResult.sandboxFork.budgets, {
    maximumArtifacts: 10_000,
    maximumEvents: 100_000,
    maximumSerializedBytes: 536_870_912
  }, 'detached sandbox requests are clamped to the protocol resource ceiling');
  assert.equal(boundedSandboxResult.sandboxFork.truth.canonicalWriteback, false, 'resource ceiling cannot grant sandbox writeback');

  const experienceAudit = experienceProtocol.auditExperienceProtocol({
    capsule: experienceCapsule,
    leases: [observerRead.lease, playerProposalResult.lease, sandboxForkResult.lease],
    receipts: [observerMutation.receipt, observerRead.receipt, playerProposalResult.receipt, replayedPlayerProposal.receipt, sandboxForkResult.receipt],
    proposals: [playerProposalResult.proposal],
    sandboxForks: [sandboxForkResult.sandboxFork]
  });
  assert.equal(experienceAudit.verdict, 'PASS', 'complete observer/player/sandbox evidence passes the read-only experience audit');
  assert.deepEqual(experienceAudit.counts, { pass: 6, fail: 0, notApplicable: 0 }, 'experience audit covers capsule, authority, leases, receipts, proposal and sandbox detachment');
  assert.equal(experienceAudit.truth.worldMutation, false, 'experience audit itself cannot mutate the world');
  assert.equal(experienceAudit.truth.mirrorConnectionClaimed, false, 'experience audit refuses a premature Mirror connection claim');
  const malformedPlayerLease = JSON.parse(JSON.stringify(playerProposalResult.lease));
  malformedPlayerLease.truth.applyAuthority = true;
  assert.equal(experienceProtocol.validateExperienceLease(malformedPlayerLease, experienceCapsule).valid, false, 'tampered lease authority and digest are refused');
  assert.throws(() => experienceProtocol.dispatchExperienceIntent(tamperedExperienceCapsule, observerLease, {}), /capsule refused/, 'dispatch refuses a tampered source capsule before reading an intent');
  const protocolDescription = experienceProtocol.experienceProtocolDescription();
  assert.equal(protocolDescription.compatibility.externalBrokerRequired, true, 'external Mirror/Holodeck/shoebox attachment requires a future broker');
  assert.equal(protocolDescription.compatibility.mirrorConnected, false, 'protocol description does not claim active Mirror integration');
  assert.equal(protocolDescription.permissions.sandboxCanonicalWriteback, false, 'protocol description preserves sandbox no-writeback authority');

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
  assert.equal(restoredStore.descriptor().storageEncoding, 'json',
    'ordinary browser-local state remains readable JSON when it fits');

  const quotaStorage = {
    values: new Map(), maximumCharacters: 8000,
    getItem(key) { return this.values.has(key) ? this.values.get(key) : null; },
    setItem(key, value) {
      if (value.length > this.maximumCharacters) {
        const error = new Error('storage quota exceeded');
        error.name = 'QuotaExceededError';
        throw error;
      }
      this.values.set(key, value);
    }
  };
  const quotaStore = new worldStateModule.WorldStateStore({
    storage: quotaStorage, key: 'quota-v2', legacyKey: 'quota-v1'
  });
  const repetitivePayload = {
    profileId: 'temperate',
    rows: Array.from({ length: 1200 }, () =>
      'persistent-canonical-earth-system-column')
  };
  quotaStore.commit(repetitivePayload,
    { kind: 'compressed-save-proof', actor: 'selftest' },
    { expectedRevision: 0 });
  assert.equal(quotaStore.descriptor().storageEncoding,
    worldStateModule.COMPRESSED_WORLD_STATE_ENCODING,
  'a quota-limited backend falls back to lossless compressed storage');
  assert.equal(JSON.parse(quotaStorage.values.get('quota-v2')).schema,
    worldStateModule.COMPRESSED_WORLD_STATE_STORAGE_SCHEMA,
  'the compressed fallback is explicit rather than disguised as a normal envelope');
  const restoredQuotaStore = new worldStateModule.WorldStateStore({
    storage: quotaStorage, key: 'quota-v2', legacyKey: 'quota-v1'
  });
  assert.ok(restoredQuotaStore.load());
  assert.deepEqual(restoredQuotaStore.payload(), repetitivePayload,
    'compressed browser-local state restores without losing payload material');
  assert.equal(restoredQuotaStore.descriptor().loadStatus,
    'restored-v2-compressed');

  const revisionBeforeFailedWrite = restoredStore.descriptor().revision;
  const payloadBeforeFailedWrite = JSON.parse(JSON.stringify(
    restoredStore.payload()));
  const workingSetItem = stateStorage.setItem;
  stateStorage.setItem = () => {
    const error = new Error('storage unavailable');
    error.name = 'QuotaExceededError';
    throw error;
  };
  assert.throws(() => restoredStore.commit(
    { profileId: 'temperate', day: 120 },
    { kind: 'must-not-appear' },
    { expectedRevision: revisionBeforeFailedWrite }
  ), /storage unavailable/);
  assert.equal(restoredStore.descriptor().revision,
    revisionBeforeFailedWrite,
  'a failed raw and compressed write does not advance the in-memory revision');
  assert.deepEqual(restoredStore.payload(), payloadBeforeFailedWrite,
    'a failed raw and compressed write leaves the prior in-memory payload intact');
  stateStorage.setItem = workingSetItem;

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
