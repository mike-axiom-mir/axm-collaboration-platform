(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AXMBuddyFarmGamepad = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var PROFILE_ID = 'axm-universal-xbox-brawl-v0.2.1';
  var DEFAULT_DEAD_ZONE = 0.22;

  function buttonValue(pad, index) {
    var button = pad && pad.buttons && pad.buttons[index];
    if (!button) return 0;
    return Math.max(button.pressed ? 1 : 0, Number(button.value) || 0);
  }

  function deadZoneAxis(value, deadZone) {
    var number = Number(value);
    if (!Number.isFinite(number)) number = 0;
    number = Math.max(-1, Math.min(1, number));
    return Math.abs(number) >= deadZone ? number : 0;
  }

  function edge(pressed, previous, name) {
    return pressed && !(previous && previous[name]);
  }

  function emptySample(connected, supported, id) {
    return {
      connected: Boolean(connected),
      supported: Boolean(supported),
      id: id || '',
      moveX: 0,
      moveY: 0,
      action: false,
      actionEdge: false,
      work: false,
      workEdge: false,
      map: false,
      mapEdge: false,
      menu: false,
      menuEdge: false
    };
  }

  function sampleStandardGamepad(pad, previous, deadZone) {
    if (!pad) return emptySample(false, false, '');
    if (pad.mapping !== 'standard') return emptySample(true, false, pad.id || '');

    var threshold = Number.isFinite(deadZone) ? deadZone : DEFAULT_DEAD_ZONE;
    var dpadX = buttonValue(pad, 15) - buttonValue(pad, 14);
    var dpadY = buttonValue(pad, 13) - buttonValue(pad, 12);
    var action = buttonValue(pad, 0) >= 0.5 || buttonValue(pad, 7) >= 0.5;
    var work = buttonValue(pad, 2) >= 0.5;
    var map = buttonValue(pad, 8) >= 0.5;
    var menu = buttonValue(pad, 9) >= 0.5;

    return {
      connected: true,
      supported: true,
      id: pad.id || '',
      moveX: dpadX || deadZoneAxis(pad.axes && pad.axes[0], threshold),
      moveY: dpadY || deadZoneAxis(pad.axes && pad.axes[1], threshold),
      action: action,
      actionEdge: edge(action, previous, 'action'),
      work: work,
      workEdge: edge(work, previous, 'work'),
      map: map,
      mapEdge: edge(map, previous, 'map'),
      menu: menu,
      menuEdge: edge(menu, previous, 'menu')
    };
  }

  return {
    DEFAULT_DEAD_ZONE: DEFAULT_DEAD_ZONE,
    PROFILE_ID: PROFILE_ID,
    emptySample: emptySample,
    sampleStandardGamepad: sampleStandardGamepad
  };
});
