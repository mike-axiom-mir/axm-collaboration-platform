(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AXMTycoonRng = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var SCHEMA = 'axm.tycoon-steward.prng/xorshift32-v1';

  function seedToUint32(seed) {
    var text = String(seed == null ? 'axm-steward-seed' : seed);
    var hash = 2166136261;
    for (var i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    hash >>>= 0;
    return hash || 0x6d2b79f5;
  }

  function create(seedOrPacket) {
    var initial = seedOrPacket && typeof seedOrPacket === 'object' ? seedOrPacket.state : seedToUint32(seedOrPacket);
    var state = (Number(initial) >>> 0) || 0x6d2b79f5;
    var draws = seedOrPacket && typeof seedOrPacket === 'object' ? Number(seedOrPacket.draws || 0) : 0;
    function nextUint32() {
      var value = state;
      value ^= value << 13;
      value ^= value >>> 17;
      value ^= value << 5;
      state = value >>> 0;
      draws += 1;
      return state;
    }
    function next() { return nextUint32() / 4294967296; }
    function int(min, max) {
      var lo = Math.ceil(Number(min));
      var hi = Math.floor(Number(max));
      if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi < lo) throw new Error('valid integer range required');
      return lo + (nextUint32() % (hi - lo + 1));
    }
    function pick(items) {
      if (!Array.isArray(items) || !items.length) return null;
      return items[int(0, items.length - 1)];
    }
    function snapshot() { return { schema: SCHEMA, state: state >>> 0, draws: draws }; }
    return { nextUint32: nextUint32, next: next, int: int, pick: pick, snapshot: snapshot };
  }

  return { SCHEMA: SCHEMA, seedToUint32: seedToUint32, create: create };
});
