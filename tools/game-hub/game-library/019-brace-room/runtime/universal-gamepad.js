(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AXMBraceRoomGamepad = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var PROFILE_ID = 'axm-universal-xbox-brawl-v0.2.1';
  var DEFAULT_DEAD_ZONE = 0.22;

  function buttonValue(pad, index) {
    var button = pad && pad.buttons && pad.buttons[index];
    if (!button) return 0;
    return Math.max(button.pressed ? 1 : 0, Number(button.value) || 0);
  }

  function clampAxis(value) {
    var number = Number(value);
    if (!Number.isFinite(number)) return 0;
    return Math.max(-1, Math.min(1, number));
  }

  function deadZoneAxis(value, deadZone) {
    var axis = clampAxis(value);
    return Math.abs(axis) >= deadZone ? axis : 0;
  }

  function strongestAxis() {
    var result = 0;
    for (var i = 0; i < arguments.length; i += 1) {
      var value = clampAxis(arguments[i]);
      if (Math.abs(value) > Math.abs(result)) result = value;
    }
    return result;
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
      pause: false,
      pauseEdge: false
    };
  }

  function sampleStandardGamepad(pad, previous, deadZone) {
    if (!pad) return emptySample(false, false, '');
    if (pad.mapping !== 'standard') return emptySample(true, false, pad.id || '');

    var threshold = Number.isFinite(deadZone) ? deadZone : DEFAULT_DEAD_ZONE;
    var dpadX = buttonValue(pad, 15) - buttonValue(pad, 14);
    var dpadY = buttonValue(pad, 13) - buttonValue(pad, 12);
    var action = buttonValue(pad, 0) >= 0.5 || buttonValue(pad, 7) >= 0.5;
    var pause = buttonValue(pad, 9) >= 0.5;

    return {
      connected: true,
      supported: true,
      id: pad.id || '',
      moveX: dpadX || deadZoneAxis(pad.axes && pad.axes[0], threshold),
      moveY: dpadY || deadZoneAxis(pad.axes && pad.axes[1], threshold),
      action: action,
      actionEdge: action && !(previous && previous.action),
      pause: pause,
      pauseEdge: pause && !(previous && previous.pause)
    };
  }

  return {
    DEFAULT_DEAD_ZONE: DEFAULT_DEAD_ZONE,
    PROFILE_ID: PROFILE_ID,
    sampleStandardGamepad: sampleStandardGamepad,
    strongestAxis: strongestAxis
  };
});
