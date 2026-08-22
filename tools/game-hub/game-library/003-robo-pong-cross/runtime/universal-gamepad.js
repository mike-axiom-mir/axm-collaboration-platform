(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AXMPongCrossGamepad = api;
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

  function emptySample(connected, supported, id) {
    return {
      connected: Boolean(connected),
      supported: Boolean(supported),
      id: id || '',
      axis: 0,
      negative: false,
      positive: false,
      primary: false,
      primaryEdge: false,
      pause: false,
      pauseEdge: false
    };
  }

  function sampleCrossGamepad(pad, seatIndex, previous, deadZone) {
    if (!pad) return emptySample(false, false, '');
    if (pad.mapping !== 'standard') return emptySample(true, false, pad.id || '');

    var index = Math.max(0, Math.min(3, Number(seatIndex) || 0));
    var verticalSeat = index >= 2;
    var threshold = Number.isFinite(deadZone) ? deadZone : DEFAULT_DEAD_ZONE;
    var dpadAxis = verticalSeat
      ? buttonValue(pad, 13) - buttonValue(pad, 12)
      : buttonValue(pad, 15) - buttonValue(pad, 14);
    var stickAxis = deadZoneAxis(pad.axes && pad.axes[verticalSeat ? 1 : 0], threshold);
    var axis = dpadAxis || stickAxis;
    var primary = buttonValue(pad, 0) >= 0.5 || buttonValue(pad, 7) >= 0.5;
    var pause = buttonValue(pad, 9) >= 0.5;

    return {
      connected: true,
      supported: true,
      id: pad.id || '',
      axis: axis,
      negative: axis < -threshold,
      positive: axis > threshold,
      primary: primary,
      primaryEdge: primary && !(previous && previous.primary),
      pause: pause,
      pauseEdge: pause && !(previous && previous.pause)
    };
  }

  return {
    DEFAULT_DEAD_ZONE: DEFAULT_DEAD_ZONE,
    PROFILE_ID: PROFILE_ID,
    sampleCrossGamepad: sampleCrossGamepad
  };
});
