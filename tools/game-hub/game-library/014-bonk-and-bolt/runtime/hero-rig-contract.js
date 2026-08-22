(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BonkHeroRig = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const ASSETS = Object.freeze({
    'human-casual-a': Object.freeze({
      id: 'human-casual-a',
      race: 'human',
      relativePath: 'assets/characters/quaternius/animated-men/man-casual-a.glb',
      source: 'https://poly.pizza/bundle/Animated-Men-Pack-DAC9SDgMQT',
      creator: 'Quaternius',
      license: 'CC0-1.0',
      sha256: 'dad8fa3ca2bc7760892f9ff47f544941179e50acb2aa772cf9f035154a37fc58',
      expected: Object.freeze({ meshes: 1, skins: 1, joints: 31, clips: 11 }),
      targetHeight: 3
    })
  });

  const CLIP_SUFFIXES = Object.freeze({
    idle: 'Man_Idle',
    standing: 'Man_Standing',
    walk: 'Man_Walk',
    run: 'Man_Run',
    punch: 'Man_Punch',
    slash: 'Man_SwordSlash',
    jump: 'Man_Jump',
    clap: 'Man_Clapping'
  });

  const CLASS_ACTIONS = Object.freeze({
    panzer: Object.freeze({ attack: 'slash', special: 'punch', dodge: 'jump' }),
    'pun-slinger': Object.freeze({ attack: 'punch', special: 'clap', dodge: 'jump' }),
    'gear-shepherd': Object.freeze({ attack: 'slash', special: 'clap', dodge: 'jump' })
  });

  function assetFor(race) {
    return race === 'human' ? ASSETS['human-casual-a'] : null;
  }

  function validateAsset(asset) {
    if (!asset || asset.race !== 'human') return false;
    if (!/^[a-z0-9][a-z0-9./-]+\.glb$/i.test(asset.relativePath)) return false;
    if (asset.relativePath.startsWith('/') || asset.relativePath.includes('..') || /^[a-z]:/i.test(asset.relativePath)) return false;
    return asset.license === 'CC0-1.0' && /^[a-f0-9]{64}$/i.test(asset.sha256) && Number(asset.targetHeight) > 0;
  }

  function resolveClips(names) {
    const available = Array.isArray(names) ? names.filter(name => typeof name === 'string') : [];
    const resolved = {};
    for (const [role, suffix] of Object.entries(CLIP_SUFFIXES)) {
      resolved[role] = available.find(name => name === suffix || name.endsWith('|' + suffix)) || null;
    }
    return Object.freeze(resolved);
  }

  function roleFor(classId, kind) {
    const profile = CLASS_ACTIONS[classId] || CLASS_ACTIONS.panzer;
    return profile[kind] || 'idle';
  }

  function requiredRoles(classId) {
    const profile = CLASS_ACTIONS[classId] || CLASS_ACTIONS.panzer;
    return Object.freeze(['idle', 'walk', profile.attack, profile.special, profile.dodge]);
  }

  return Object.freeze({
    schema: 'bonk-bolt-hero-rig/v1',
    ASSETS,
    CLIP_SUFFIXES,
    CLASS_ACTIONS,
    assetFor,
    validateAsset,
    resolveClips,
    roleFor,
    requiredRoles
  });
});
