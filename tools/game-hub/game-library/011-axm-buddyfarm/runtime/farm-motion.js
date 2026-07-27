(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BuddyFarmMotion = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const CONTRACT = 'axm.buddyfarm-motion-adapter/v1';
  const TAU = Math.PI * 2;

  function clamp(value, low, high) {
    return Math.max(low, Math.min(high, value));
  }

  function windSway(time, options) {
    const settings = Object.assign({ amp: 6, freq: 0.6, gust: 0.35, phase: 0 }, options || {});
    const breeze = Math.sin(TAU * settings.freq * time + settings.phase);
    const gustEnvelope = 0.6 + 0.4 * Math.sin(TAU * 0.22 * time + settings.phase * 0.5);
    return settings.amp * breeze * gustEnvelope
      + settings.amp * settings.gust * Math.sin(TAU * settings.freq * 2.3 * time + settings.phase);
  }

  function idleBob(time, options) {
    const settings = Object.assign({ amp: 2.2, freq: 0.8, phase: 0 }, options || {});
    const wave = Math.sin(TAU * settings.freq * time + settings.phase);
    return {
      dy: Number((-Math.abs(wave) * settings.amp).toFixed(2)),
      squash: Number((1 + 0.04 * wave).toFixed(3))
    };
  }

  function growthStage(age, stages) {
    const count = Math.max(1, Number(stages || 4));
    const normalized = clamp(Number(age || 0), 0, 1);
    const stage = Math.min(count - 1, Math.floor(normalized * count));
    const local = (normalized * count) % 1;
    const pop = local < 0.18 ? 1 + 0.25 * Math.sin((local / 0.18) * Math.PI) : 1;
    return { stage, pop: Number(pop.toFixed(3)) };
  }

  function interpolateGridMove(from, to, elapsedMs, durationMs) {
    const duration = Math.max(1, Number(durationMs || 150));
    const progress = clamp(Number(elapsedMs || 0) / duration, 0, 1);
    const eased = progress * progress * (3 - 2 * progress);
    return {
      x: Number((Number(from.x) + (Number(to.x) - Number(from.x)) * eased).toFixed(4)),
      y: Number((Number(from.y) + (Number(to.y) - Number(from.y)) * eased).toFixed(4)),
      progress: Number(progress.toFixed(4)),
      moving: progress < 1
    };
  }

  function walkCycle(direction, progress) {
    const facing = ['up', 'down', 'left', 'right'].includes(direction) ? direction : 'down';
    const normalized = clamp(Number(progress || 0), 0, 1);
    const stride = Math.sin(normalized * Math.PI);
    return {
      direction: facing,
      frame: normalized < .34 ? 0 : normalized < .67 ? 1 : 2,
      stride: Number(stride.toFixed(3)),
      footstepContact: normalized >= .46 && normalized <= .58
    };
  }

  function crossedFootstep(previousProgress, progress) {
    return Number(previousProgress || 0) < .5 && Number(progress || 0) >= .5;
  }

  function workPulse(elapsedMs, durationMs) {
    const progress = clamp(Number(elapsedMs || 0) / Math.max(1, Number(durationMs || 460)), 0, 1);
    return {
      progress: Number(progress.toFixed(4)),
      scale: Number((1 + Math.sin(progress * Math.PI) * .22).toFixed(3)),
      alpha: Number((1 - progress).toFixed(3)),
      active: progress < 1
    };
  }

  return {
    CONTRACT,
    crossedFootstep,
    growthStage,
    idleBob,
    interpolateGridMove,
    walkCycle,
    windSway,
    workPulse
  };
});
