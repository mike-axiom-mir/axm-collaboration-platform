(function (root, factory) {
  'use strict';
  var Core = typeof module !== 'undefined' && module.exports ? require('../../shared/holodeck/core') : root.AXMHolodeckCore;
  var api = factory(Core);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AXMHolodeckDraftModel = api;
})(typeof self !== 'undefined' ? self : globalThis, function (Core) {
  'use strict';

  var PRESETS = Object.freeze({
    echo: Object.freeze({
      label: 'Echo original', skyColor: '#06111f', groundColor: '#101827', beaconColor: '#7a8ea8',
      beaconActiveColor: '#d7fff6', accentColor: '#31f5cf', gateColor: '#17223a'
    }),
    ember: Object.freeze({
      label: 'Sun forge', skyColor: '#190b12', groundColor: '#2c1516', beaconColor: '#d77542',
      beaconActiveColor: '#fff1b8', accentColor: '#ff9b42', gateColor: '#4c2025'
    }),
    ocean: Object.freeze({
      label: 'Ocean glass', skyColor: '#031b2b', groundColor: '#073448', beaconColor: '#5aaad6',
      beaconActiveColor: '#e2fbff', accentColor: '#48d7ff', gateColor: '#0c3d5b'
    }),
    orchid: Object.freeze({
      label: 'Orchid dream', skyColor: '#160c2d', groundColor: '#241643', beaconColor: '#9b74d1',
      beaconActiveColor: '#fff0ff', accentColor: '#ec70ff', gateColor: '#352250'
    })
  });

  function entity(world, id) {
    var found = (world.entities || []).find(function (item) { return item.id === id; });
    Core.assert(found, 'Composer template is missing entity: ' + id);
    return found;
  }

  function variant(entityValue, key) {
    var found = (entityValue.appearance.variants || []).find(function (item) { return item.when && item.when.key === key; });
    Core.assert(found, 'Composer template is missing appearance variant: ' + entityValue.id + '.' + key);
    return found;
  }

  function number(value, minimum, maximum, fallback) {
    return Core.round(Core.clamp(Number(value), minimum, maximum, fallback), 4);
  }

  function read(world) {
    var beacon = entity(world, 'beacon-core');
    var gate = entity(world, 'north-gate');
    var active = variant(beacon, 'active');
    return {
      title: world.title,
      objective: world.narrative.objective,
      skyColor: world.environment.skyColor,
      groundColor: world.environment.groundColor,
      beaconColor: beacon.appearance.color,
      beaconActiveColor: active.set.color,
      accentColor: active.set.emissive,
      gateColor: gate.appearance.color,
      beaconScale: beacon.transform.scale[0],
      beaconX: beacon.transform.position[0],
      spawnDistance: world.spawnPoints[0].position[2],
      fogFar: world.environment.fogFar
    };
  }

  function apply(world, input) {
    var next = Core.clone(world);
    var original = read(world);
    var beacon = entity(next, 'beacon-core');
    var gate = entity(next, 'north-gate');
    var innerRing = entity(next, 'orbit-ring-inner');
    var outerRing = entity(next, 'orbit-ring-outer');
    var arrival = entity(next, 'arrival-mark');
    var active = variant(beacon, 'active');
    var gateOpen = variant(gate, 'open');
    var scale = number(input.beaconScale, 0.35, 1.5, 0.72);
    var beaconX = number(input.beaconX, -4, 4, 0);
    var spawnDistance = number(input.spawnDistance, 3.2, 10, 5);
    var fogFar = number(input.fogFar, 24, 90, 58);

    next.title = Core.text(input.title, 160) || world.title;
    next.narrative.objective = Core.text(input.objective, 1000) || world.narrative.objective;
    next.environment.skyColor = input.skyColor;
    next.environment.fogColor = input.skyColor;
    next.environment.groundColor = input.groundColor;
    next.environment.fogFar = fogFar;
    beacon.appearance.color = input.beaconColor;
    beacon.transform.position[0] = beaconX;
    beacon.transform.scale = [scale, scale, scale];
    active.set.color = input.beaconActiveColor;
    active.set.emissive = input.accentColor;
    gate.appearance.color = input.gateColor;
    if (input.beaconActiveColor !== original.beaconActiveColor) {
      gateOpen.set.color = input.beaconActiveColor;
      outerRing.appearance.color = input.beaconActiveColor;
    }
    if (input.accentColor !== original.accentColor) {
      gateOpen.set.emissive = input.accentColor;
      innerRing.appearance.color = input.accentColor;
      innerRing.appearance.emissive = input.accentColor;
      arrival.appearance.color = input.accentColor;
    }
    innerRing.transform.position[0] = beaconX;
    outerRing.transform.position[0] = beaconX;
    next.spawnPoints[0].position[2] = spawnDistance;
    var pointLight = next.environment.lights.find(function (light) { return light.id === 'beacon-glow'; });
    if (pointLight) {
      if (input.accentColor !== original.accentColor) pointLight.color = input.accentColor;
      pointLight.position[0] = beaconX;
    }
    return next;
  }

  function preset(controls, presetId) {
    Core.assert(PRESETS[presetId], 'Unknown Holodeck Composer preset: ' + presetId);
    var next = Core.clone(controls);
    Object.keys(PRESETS[presetId]).forEach(function (key) {
      if (key !== 'label') next[key] = PRESETS[presetId][key];
    });
    return next;
  }

  return { PRESETS: PRESETS, read: read, apply: apply, preset: preset };
});
