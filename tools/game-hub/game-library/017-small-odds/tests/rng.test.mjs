import test from 'node:test';
import assert from 'node:assert/strict';
import { createRng, secureSeedHex, uniformInt, probabilityReceipt, RNG_ALGORITHM, LEGACY_RNG_ALGORITHM } from '../runtime/rng.js';

const SEED = '0123456789abcdef'.repeat(4);

test('xoshiro stream is deterministic for an inspectable seed', () => {
  const first = createRng(SEED);
  const second = createRng(SEED);
  const sequenceA = Array.from({ length: 20 }, () => first.nextUint32());
  const sequenceB = Array.from({ length: 20 }, () => second.nextUint32());
  assert.deepEqual(sequenceA, sequenceB);
  assert.equal(new Set(sequenceA).size, sequenceA.length);
});

test('current seed mixer lets every 32-bit seed word influence the first outcome', () => {
  const zeroSeed = '0'.repeat(64);
  const baseline = createRng(zeroSeed).nextUint32();
  for (let word = 0; word < 8; word += 1) {
    const changed = zeroSeed.split('');
    changed[word * 8 + 7] = '1';
    assert.notEqual(createRng(changed.join('')).nextUint32(), baseline, `word ${word} did not reach the first outcome`);
  }
});

test('legacy algorithm remains replayable after the full-seed mixer upgrade', () => {
  const legacy = createRng(SEED, LEGACY_RNG_ALGORITHM);
  assert.deepEqual(Array.from({ length: 6 }, () => legacy.nextUint32()), [2463954730,5524658,74256371,1905451993,3123413897,314453775]);
  assert.equal(createRng(SEED).algorithm, RNG_ALGORITHM);
  assert.throws(() => createRng(SEED, 'invented-rng'), /Unsupported RNG algorithm/);
});

test('uniformInt rejects the incomplete uint32 tail instead of using biased modulo mapping', () => {
  const values = [4_294_000_000, 4_294_967_295, 1_234_567];
  const fake = { nextUint32: () => values.shift() };
  assert.equal(uniformInt(fake, 1_000_000), 234_567);
  assert.deepEqual(values, []);
});

test('secure seed requests all 256 bits through getRandomValues', () => {
  let requested = 0;
  const cryptoSource = { getRandomValues(bytes) { requested = bytes.byteLength; bytes.forEach((_, index) => { bytes[index] = index; }); return bytes; } };
  const seed = secureSeedHex(cryptoSource);
  assert.equal(requested, 32);
  assert.equal(seed.length, 64);
  assert.equal(seed, '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f');
});

test('receipt declares the algorithm and refuses adaptive-luck claims', () => {
  const receipt = probabilityReceipt(SEED, { rarityRoll: 42 });
  assert.equal(receipt.algorithm, RNG_ALGORITHM);
  assert.equal(receipt.adaptiveLuck, false);
  assert.equal(receipt.pitySystem, false);
  assert.equal(receipt.rarityRoll, 42);
  assert.ok(Object.isFrozen(receipt));
});

test('seed validation fails closed', () => {
  assert.throws(() => createRng('almost-random'), /256-bit seed/);
});
