'use strict';

function seedFromText(value) {
  let hash = 2166136261 >>> 0;
  for (const char of String(value || 'circuitseed')) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash || 0x9e3779b9;
}

function createRng(seed) {
  let state = Number.isInteger(seed) ? seed >>> 0 : seedFromText(seed);
  return {
    next() {
      state ^= state << 13; state >>>= 0;
      state ^= state >>> 17; state >>>= 0;
      state ^= state << 5; state >>>= 0;
      return state / 4294967296;
    },
    int(min, max) { return min + Math.floor(this.next() * (max - min + 1)); },
    pick(values) { return values[Math.floor(this.next() * values.length)]; },
    snapshot() { return state >>> 0; }
  };
}

function deterministicPick(seed, key, values) {
  return createRng(seedFromText(String(seed) + ':' + String(key))).pick(values);
}

module.exports = { createRng, deterministicPick, seedFromText };
