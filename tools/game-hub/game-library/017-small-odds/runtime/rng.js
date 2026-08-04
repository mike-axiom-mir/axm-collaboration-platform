export const LEGACY_RNG_ALGORITHM = 'xoshiro128ss-v1';
export const RNG_ALGORITHM = 'xoshiro128ss-v2-full-seed-mix';
export const ENTROPY_MODE = 'web-crypto-256-bit';
export const UINT32_RANGE = 0x100000000;

function assertHexSeed(hex) {
  if (!/^[0-9a-f]{64}$/i.test(String(hex || ''))) {
    throw new TypeError('A 256-bit seed encoded as 64 hexadecimal characters is required.');
  }
}

export function secureSeedHex(cryptoSource = globalThis.crypto) {
  if (!cryptoSource || typeof cryptoSource.getRandomValues !== 'function') {
    throw new Error('Web Crypto entropy is unavailable; SMALL ODDS refuses to fake a random draw.');
  }
  const bytes = new Uint8Array(32);
  cryptoSource.getRandomValues(bytes);
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

const rotl = (value, shift) => ((value << shift) | (value >>> (32 - shift))) >>> 0;

function legacySeedState(words) {
  return [
    (words[0] ^ words[4] ^ 0x9e3779b9) >>> 0,
    (words[1] ^ words[5] ^ 0x243f6a88) >>> 0,
    (words[2] ^ words[6] ^ 0xb7e15162) >>> 0,
    (words[3] ^ words[7] ^ 0xdeadbeef) >>> 0
  ];
}

function avalanche32(value) {
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d) >>> 0;
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b) >>> 0;
  value ^= value >>> 16;
  return value >>> 0;
}

function fullSeedState(words) {
  const state = [0x9e3779b9, 0x243f6a88, 0xb7e15162, 0xdeadbeef];
  for (let wordIndex = 0; wordIndex < words.length; wordIndex += 1) {
    for (let lane = 0; lane < state.length; lane += 1) {
      const shiftedWord = rotl(words[wordIndex], (wordIndex * 7 + lane * 11) % 32);
      const round = Math.imul(wordIndex + 1, 0x9e3779b9) >>> 0;
      const laneSalt = Math.imul(lane + 1, 0x85ebca6b) >>> 0;
      state[lane] = avalanche32((state[lane] ^ shiftedWord ^ round ^ laneSalt) >>> 0);
    }
  }
  return state;
}

export function createRng(seedHex, algorithm = RNG_ALGORITHM) {
  assertHexSeed(seedHex);
  const words = new Uint32Array(8);
  for (let index = 0; index < 8; index += 1) {
    words[index] = Number.parseInt(seedHex.slice(index * 8, index * 8 + 8), 16) >>> 0;
  }

  if (![RNG_ALGORITHM, LEGACY_RNG_ALGORITHM].includes(algorithm)) {
    throw new RangeError(`Unsupported RNG algorithm: ${algorithm}`);
  }
  const [initial0, initial1, initial2, initial3] = algorithm === LEGACY_RNG_ALGORITHM
    ? legacySeedState(words)
    : fullSeedState(words);
  let s0 = initial0;
  let s1 = initial1;
  let s2 = initial2;
  let s3 = initial3;
  if ((s0 | s1 | s2 | s3) === 0) s3 = 1;

  return {
    seedHex: seedHex.toLowerCase(),
    algorithm,
    nextUint32() {
      const result = Math.imul(rotl(Math.imul(s1, 5) >>> 0, 7), 9) >>> 0;
      const t = (s1 << 9) >>> 0;
      s2 ^= s0;
      s3 ^= s1;
      s1 ^= s2;
      s0 ^= s3;
      s2 ^= t;
      s3 = rotl(s3, 11);
      return result >>> 0;
    }
  };
}

export function uniformInt(rng, exclusiveMax) {
  if (!Number.isSafeInteger(exclusiveMax) || exclusiveMax < 1 || exclusiveMax > UINT32_RANGE) {
    throw new RangeError('exclusiveMax must be an integer from 1 through 2^32.');
  }
  if (exclusiveMax === UINT32_RANGE) return rng.nextUint32();
  const acceptedRange = Math.floor(UINT32_RANGE / exclusiveMax) * exclusiveMax;
  let value;
  do value = rng.nextUint32();
  while (value >= acceptedRange);
  return value % exclusiveMax;
}

export function pickOne(rng, values) {
  if (!Array.isArray(values) || values.length === 0) throw new RangeError('Cannot pick from an empty catalog.');
  return values[uniformInt(rng, values.length)];
}

export function pickWeighted(rng, entries, totalWeight = null) {
  if (!Array.isArray(entries) || entries.length === 0) throw new RangeError('Weighted catalog is empty.');
  const total = totalWeight ?? entries.reduce((sum, entry) => sum + entry.weight, 0);
  if (!Number.isSafeInteger(total) || total < 1) throw new RangeError('Weighted catalog total must be positive.');
  const roll = uniformInt(rng, total) + 1;
  let cursor = 0;
  for (const entry of entries) {
    cursor += entry.weight;
    if (roll <= cursor) return { entry, roll, total };
  }
  throw new Error('Weighted catalog does not cover its declared total.');
}

export function probabilityReceipt(seedHex, fields = {}) {
  return Object.freeze({
    schema: 'small-odds.random-receipt/v1',
    entropyMode: ENTROPY_MODE,
    algorithm: RNG_ALGORITHM,
    uniformMapping: 'uint32-rejection-sampling',
    adaptiveLuck: false,
    pitySystem: false,
    seedHex: seedHex.toLowerCase(),
    ...fields
  });
}
