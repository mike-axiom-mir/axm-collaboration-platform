(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BonkMotion = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const BASE_POSE = Object.freeze({
    rootX: 1, rootY: 1, rootZ: 1, rootLift: 0,
    bodyRX: 0, headRX: 0, headRZ: 0, leftArmRX: 0, rightArmRX: 0,
    weaponRX: .1, weaponRY: 0, weaponRZ: -.35,
    weaponPX: .65, weaponPY: 1.2, weaponPZ: .28,
    cueOpacity: 0, cueScale: .5, cueRotation: 0
  });

  const ACTION_TIMING = Object.freeze({
    attack: Object.freeze({ duration: .52, anticipation: .32, impact: .54 }),
    special: Object.freeze({ duration: .82, anticipation: .28, impact: .61 }),
    dodge: Object.freeze({ duration: .44, anticipation: .18, impact: .54 })
  });

  const MOTION_PROFILES = Object.freeze({
    panzer: Object.freeze({
      accent: 0xffbd4a, signature: 'heavy-pan-slam',
      attack: Object.freeze({ wind: { rootX: 1.08, rootY: .78, rootZ: 1.08, rootLift: -.04, bodyRX: -.18, headRX: .12, leftArmRX: -.45, rightArmRX: -.7, weaponRX: -1.65, weaponRY: -.12, weaponRZ: -.65, weaponPX: .55, weaponPY: 1.65, weaponPZ: .05, cueOpacity: .42, cueScale: .75, cueRotation: -.55 }, strike: { rootX: .92, rootY: 1.15, rootZ: .92, rootLift: .12, bodyRX: .2, headRX: -.13, leftArmRX: .85, rightArmRX: 1.15, weaponRX: 1.02, weaponRY: .08, weaponRZ: -.12, weaponPX: .7, weaponPY: .86, weaponPZ: 1.08, cueOpacity: 1, cueScale: 1.45, cueRotation: .55 } }),
      special: Object.freeze({ wind: { rootX: 1.13, rootY: .72, rootZ: 1.13, rootLift: -.08, bodyRX: -.12, headRX: .1, leftArmRX: -.9, rightArmRX: -.9, weaponRX: -1.3, weaponRY: -.4, weaponRZ: -.8, weaponPX: .48, weaponPY: 1.72, weaponPZ: .02, cueOpacity: .52, cueScale: .7, cueRotation: -.7 }, strike: { rootX: .86, rootY: 1.24, rootZ: .86, rootLift: .18, bodyRX: .22, headRX: -.16, leftArmRX: 1.15, rightArmRX: 1.35, weaponRX: 1.28, weaponRY: .25, weaponRZ: .08, weaponPX: .68, weaponPY: .72, weaponPZ: 1.18, cueOpacity: 1, cueScale: 2.05, cueRotation: .72 } }),
      dodge: Object.freeze({ wind: { rootX: 1.12, rootY: .76, rootZ: 1.12, rootLift: -.04, bodyRX: -.22, headRX: .1, leftArmRX: -.5, rightArmRX: -.5, weaponRX: -.35, weaponRY: -.15, weaponRZ: -.7, weaponPX: .48, weaponPY: 1.08, weaponPZ: .05, cueOpacity: .7, cueScale: .75, cueRotation: 0 }, strike: { rootX: .82, rootY: 1.08, rootZ: 1.18, rootLift: .15, bodyRX: .42, headRX: -.2, leftArmRX: .7, rightArmRX: .7, weaponRX: .55, weaponRY: .1, weaponRZ: -.08, weaponPX: .74, weaponPY: 1.12, weaponPZ: .85, cueOpacity: .95, cueScale: 1.62, cueRotation: .25 } })
    }),
    'pun-slinger': Object.freeze({
      accent: 0x55d6be, signature: 'bread-recoil-fan',
      attack: Object.freeze({ wind: { rootX: .94, rootY: 1.05, rootZ: 1.06, rootLift: .04, bodyRX: -.28, headRZ: -.12, leftArmRX: .35, rightArmRX: -.85, weaponRX: -.55, weaponRY: -.9, weaponRZ: -.72, weaponPX: .42, weaponPY: 1.38, weaponPZ: -.05, cueOpacity: .48, cueScale: .72, cueRotation: -.85 }, strike: { rootX: 1.12, rootY: .9, rootZ: .96, rootLift: .08, bodyRX: .32, headRZ: .16, leftArmRX: -.55, rightArmRX: 1.25, weaponRX: .5, weaponRY: 1.15, weaponRZ: .2, weaponPX: .88, weaponPY: 1.18, weaponPZ: 1.05, cueOpacity: 1, cueScale: 1.65, cueRotation: 1.2 } }),
      special: Object.freeze({ wind: { rootX: .9, rootY: 1.08, rootZ: 1.08, rootLift: .06, bodyRX: -.18, headRZ: -.18, leftArmRX: -.7, rightArmRX: -.7, weaponRX: -.8, weaponRY: -1.4, weaponRZ: -.55, weaponPX: .35, weaponPY: 1.48, weaponPZ: .08, cueOpacity: .58, cueScale: .78, cueRotation: -1.2 }, strike: { rootX: 1.16, rootY: .86, rootZ: .92, rootLift: .16, bodyRX: .18, headRZ: .22, leftArmRX: .95, rightArmRX: 1.2, weaponRX: .42, weaponRY: 2.65, weaponRZ: .35, weaponPX: .72, weaponPY: 1.34, weaponPZ: .9, cueOpacity: 1, cueScale: 2.25, cueRotation: 2.6 } }),
      dodge: Object.freeze({ wind: { rootX: 1.08, rootY: .82, rootZ: 1.12, rootLift: -.03, bodyRX: -.32, headRZ: -.12, leftArmRX: -.4, rightArmRX: -.5, weaponRX: -.25, weaponRY: -.45, weaponRZ: -.65, weaponPX: .48, weaponPY: 1.05, weaponPZ: .02, cueOpacity: .72, cueScale: .72, cueRotation: -.25 }, strike: { rootX: .78, rootY: 1.12, rootZ: 1.2, rootLift: .18, bodyRX: .46, headRZ: .2, leftArmRX: .68, rightArmRX: .82, weaponRX: .48, weaponRY: .62, weaponRZ: .1, weaponPX: .82, weaponPY: 1.18, weaponPZ: .92, cueOpacity: .95, cueScale: 1.7, cueRotation: .45 } })
    }),
    'gear-shepherd': Object.freeze({
      accent: 0x9b7bff, signature: 'conductor-command-sweep',
      attack: Object.freeze({ wind: { rootX: .96, rootY: .9, rootZ: 1.08, rootLift: .02, bodyRX: -.12, headRZ: .16, leftArmRX: -.9, rightArmRX: -.4, weaponRX: -.72, weaponRY: .72, weaponRZ: -.95, weaponPX: .35, weaponPY: 1.55, weaponPZ: .18, cueOpacity: .48, cueScale: .78, cueRotation: .75 }, strike: { rootX: 1.05, rootY: 1.08, rootZ: .93, rootLift: .1, bodyRX: .15, headRZ: -.18, leftArmRX: .95, rightArmRX: .78, weaponRX: .38, weaponRY: -1.25, weaponRZ: .35, weaponPX: .82, weaponPY: 1.25, weaponPZ: .98, cueOpacity: 1, cueScale: 1.72, cueRotation: -1.25 } }),
      special: Object.freeze({ wind: { rootX: .94, rootY: .88, rootZ: 1.12, rootLift: .02, bodyRX: -.08, headRZ: .22, leftArmRX: -1.15, rightArmRX: -.85, weaponRX: -.55, weaponRY: 1.35, weaponRZ: -1.05, weaponPX: .28, weaponPY: 1.68, weaponPZ: .12, cueOpacity: .62, cueScale: .82, cueRotation: 1.3 }, strike: { rootX: 1.08, rootY: 1.12, rootZ: .9, rootLift: .2, bodyRX: .12, headRZ: -.25, leftArmRX: 1.25, rightArmRX: 1.05, weaponRX: .28, weaponRY: -2.85, weaponRZ: .48, weaponPX: .86, weaponPY: 1.36, weaponPZ: .88, cueOpacity: 1, cueScale: 2.35, cueRotation: -2.8 } }),
      dodge: Object.freeze({ wind: { rootX: 1.06, rootY: .8, rootZ: 1.14, rootLift: -.03, bodyRX: -.3, headRZ: .1, leftArmRX: -.55, rightArmRX: -.55, weaponRX: -.35, weaponRY: .4, weaponRZ: -.72, weaponPX: .46, weaponPY: 1.04, weaponPZ: .04, cueOpacity: .72, cueScale: .74, cueRotation: .22 }, strike: { rootX: .8, rootY: 1.1, rootZ: 1.2, rootLift: .17, bodyRX: .44, headRZ: -.16, leftArmRX: .75, rightArmRX: .75, weaponRX: .5, weaponRY: -.6, weaponRZ: .12, weaponPX: .8, weaponPY: 1.18, weaponPZ: .9, cueOpacity: .95, cueScale: 1.68, cueRotation: -.38 } })
    })
  });

  const clamp = value => Math.max(0, Math.min(1, value));
  const smooth = value => { const x = clamp(value); return x * x * (3 - 2 * x); };
  const lerp = (a, b, amount) => a + (b - a) * amount;
  const interpolatePose = (from, to, amount) => {
    const pose = {};
    for (const key of Object.keys(BASE_POSE)) pose[key] = lerp(from[key] ?? BASE_POSE[key], to[key] ?? BASE_POSE[key], amount);
    return pose;
  };

  function profile(classId) { return MOTION_PROFILES[classId] || MOTION_PROFILES.panzer; }

  function sample(classId, kind, elapsed, reducedMotion) {
    const selected = profile(classId);
    const action = selected[kind] || selected.attack;
    const timing = ACTION_TIMING[kind] || ACTION_TIMING.attack;
    const safeElapsed = Math.max(0, Number(elapsed) || 0);
    const done = safeElapsed >= timing.duration;
    const progress = clamp(safeElapsed / timing.duration);
    if (done) return { ...BASE_POSE, classId: MOTION_PROFILES[classId] ? classId : 'panzer', kind: ACTION_TIMING[kind] ? kind : 'attack', phase: 'settled', progress: 1, duration: timing.duration, done: true, signature: selected.signature, accent: selected.accent };
    if (reducedMotion) {
      const cuePulse = progress < .62 ? smooth(progress / .18) * (1 - Math.max(0, progress - .4) / .22) : 0;
      return { ...BASE_POSE, cueOpacity: Math.max(.72, cuePulse), cueScale: 1, classId: MOTION_PROFILES[classId] ? classId : 'panzer', kind: ACTION_TIMING[kind] ? kind : 'attack', phase: 'reduced-cue', progress, duration: timing.duration, done: false, signature: selected.signature, accent: selected.accent };
    }
    let phase, pose;
    if (progress < timing.anticipation) {
      phase = 'anticipation';
      pose = interpolatePose(BASE_POSE, action.wind, smooth(progress / timing.anticipation));
    } else if (progress < timing.impact) {
      phase = 'impact';
      pose = interpolatePose(action.wind, action.strike, smooth((progress - timing.anticipation) / (timing.impact - timing.anticipation)));
    } else {
      phase = 'recovery';
      pose = interpolatePose(action.strike, BASE_POSE, smooth((progress - timing.impact) / (1 - timing.impact)));
    }
    return { ...pose, classId: MOTION_PROFILES[classId] ? classId : 'panzer', kind: ACTION_TIMING[kind] ? kind : 'attack', phase, progress, duration: timing.duration, done: false, signature: selected.signature, accent: selected.accent };
  }

  return Object.freeze({ BASE_POSE, ACTION_TIMING, MOTION_PROFILES, profile, sample });
});
