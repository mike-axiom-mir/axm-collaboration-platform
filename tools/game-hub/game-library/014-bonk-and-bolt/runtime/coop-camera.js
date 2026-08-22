(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BonkCoopCamera = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const LIMITS = Object.freeze({
    comfort: 22,
    soft: 26,
    regroup: 31,
    hard: 36
  });

  const SOLO_OFFSET = Object.freeze({ x: 22, y: 28, z: 26 });
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const point = value => ({ x: Number(value?.x) || 0, z: Number(value?.z) || 0 });

  function stateForDistance(distance) {
    if (distance <= LIMITS.comfort) return 'together';
    if (distance < LIMITS.regroup) return 'wide';
    return 'regroup';
  }

  function frame(first, second) {
    const a = point(first);
    if (!second) {
      return Object.freeze({ midpoint: a, distance: 0, framedDistance: 0, state: 'solo', offset: SOLO_OFFSET });
    }
    const b = point(second);
    const distance = Math.hypot(b.x - a.x, b.z - a.z);
    const framedDistance = Math.min(distance, LIMITS.hard);
    return Object.freeze({
      midpoint: Object.freeze({ x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 }),
      distance,
      framedDistance,
      state: stateForDistance(distance),
      offset: Object.freeze({
        x: SOLO_OFFSET.x + framedDistance * .15,
        y: SOLO_OFFSET.y + framedDistance * .18,
        z: SOLO_OFFSET.z + framedDistance * .15
      })
    });
  }

  function constrainDelta(actor, partner, dx, dz) {
    const a = point(actor), b = point(partner);
    const rawX = Number(dx) || 0, rawZ = Number(dz) || 0;
    const separationX = a.x - b.x, separationZ = a.z - b.z;
    const distance = Math.hypot(separationX, separationZ);
    if (!distance || (!rawX && !rawZ)) return Object.freeze({ dx: rawX, dz: rawZ, outwardScale: 1, blocked: false, distance });

    const radialX = separationX / distance, radialZ = separationZ / distance;
    const outward = rawX * radialX + rawZ * radialZ;
    const outwardScale = outward > 0 && distance > LIMITS.soft
      ? clamp((LIMITS.hard - distance) / (LIMITS.hard - LIMITS.soft), 0, 1)
      : 1;
    let adjustedX = rawX + radialX * outward * (outwardScale - 1);
    let adjustedZ = rawZ + radialZ * outward * (outwardScale - 1);

    const candidateX = a.x + adjustedX - b.x, candidateZ = a.z + adjustedZ - b.z;
    const candidateDistance = Math.hypot(candidateX, candidateZ);
    if (candidateDistance > LIMITS.hard && distance <= LIMITS.hard) {
      const scale = LIMITS.hard / candidateDistance;
      adjustedX = b.x + candidateX * scale - a.x;
      adjustedZ = b.z + candidateZ * scale - a.z;
    }
    return Object.freeze({
      dx: adjustedX,
      dz: adjustedZ,
      outwardScale,
      blocked: Math.abs(adjustedX - rawX) > 1e-8 || Math.abs(adjustedZ - rawZ) > 1e-8,
      distance
    });
  }

  return Object.freeze({ LIMITS, SOLO_OFFSET, stateForDistance, frame, constrainDelta });
});
