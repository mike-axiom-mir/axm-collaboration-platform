'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const ROOT = __dirname;
const PACK_ROOT = path.join(ROOT, 'packs');
const ENGINE_VERSION = '0.1.0';
const PACK_SCHEMA = 'axm.pocket-adventure.pack/1.0';
let passed = 0;

function pass(label) {
  passed += 1;
  console.log(`PASS ${label}`);
}

function check(condition, label) {
  assert.ok(condition, label);
  pass(label);
}

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function safeArchivePath(name) {
  const normalized = name.replaceAll('\\', '/');
  const parts = normalized.split('/');
  return Boolean(normalized)
    && !normalized.startsWith('/')
    && !/^[A-Za-z]:/.test(normalized)
    && !parts.includes('..')
    && !parts.includes('');
}

function readZip(filePath) {
  const bytes = fs.readFileSync(filePath);
  const min = Math.max(0, bytes.length - 65557);
  let eocd = -1;
  for (let cursor = bytes.length - 22; cursor >= min; cursor -= 1) {
    if (bytes.readUInt32LE(cursor) === 0x06054b50) { eocd = cursor; break; }
  }
  assert.notEqual(eocd, -1, 'ZIP end record exists');
  const disk = bytes.readUInt16LE(eocd + 4);
  const centralDisk = bytes.readUInt16LE(eocd + 6);
  const diskEntries = bytes.readUInt16LE(eocd + 8);
  const entryCount = bytes.readUInt16LE(eocd + 10);
  const centralSize = bytes.readUInt32LE(eocd + 12);
  const centralOffset = bytes.readUInt32LE(eocd + 16);
  assert.equal(disk, 0, 'ZIP is single-disk');
  assert.equal(centralDisk, 0, 'ZIP central directory is local');
  assert.equal(diskEntries, entryCount, 'ZIP entry counts agree');
  assert.notEqual(entryCount, 0xffff, 'ZIP64 entry sentinel absent');
  assert.notEqual(centralOffset, 0xffffffff, 'ZIP64 offset sentinel absent');
  assert.ok(centralOffset + centralSize <= eocd, 'ZIP central directory is bounded');

  const entries = new Map();
  const foldedNames = new Set();
  let cursor = centralOffset;
  for (let index = 0; index < entryCount; index += 1) {
    assert.equal(bytes.readUInt32LE(cursor), 0x02014b50, `central entry ${index} signature`);
    const flags = bytes.readUInt16LE(cursor + 8);
    const method = bytes.readUInt16LE(cursor + 10);
    const expectedCrc = bytes.readUInt32LE(cursor + 16);
    const compressedSize = bytes.readUInt32LE(cursor + 20);
    const uncompressedSize = bytes.readUInt32LE(cursor + 24);
    const nameLength = bytes.readUInt16LE(cursor + 28);
    const extraLength = bytes.readUInt16LE(cursor + 30);
    const commentLength = bytes.readUInt16LE(cursor + 32);
    const localOffset = bytes.readUInt32LE(cursor + 42);
    const name = bytes.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8');
    assert.equal(flags & 1, 0, `${name} is not encrypted`);
    assert.ok(method === 0 || method === 8, `${name} compression method is bounded`);
    assert.ok(safeArchivePath(name), `${name} path is safe`);
    assert.ok(uncompressedSize <= 32 * 1024 * 1024, `${name} is below 32 MB`);
    const folded = name.toLowerCase();
    assert.ok(!foldedNames.has(folded), `${name} is not a case-folded duplicate`);
    foldedNames.add(folded);
    entries.set(name, { name, flags, method, expectedCrc, compressedSize, uncompressedSize, localOffset });
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  assert.equal(cursor, centralOffset + centralSize, 'ZIP central directory size matches');

  function read(name) {
    const entry = entries.get(name);
    assert.ok(entry, `ZIP contains ${name}`);
    assert.equal(bytes.readUInt32LE(entry.localOffset), 0x04034b50, `${name} local signature`);
    const localNameLength = bytes.readUInt16LE(entry.localOffset + 26);
    const localExtraLength = bytes.readUInt16LE(entry.localOffset + 28);
    const start = entry.localOffset + 30 + localNameLength + localExtraLength;
    const end = start + entry.compressedSize;
    assert.ok(end <= bytes.length, `${name} payload is bounded`);
    const compressed = bytes.subarray(start, end);
    const output = entry.method === 0 ? Buffer.from(compressed) : zlib.inflateRawSync(compressed);
    assert.equal(output.length, entry.uncompressedSize, `${name} uncompressed size matches`);
    assert.equal(crc32(output), entry.expectedCrc, `${name} CRC-32 matches`);
    return output;
  }

  return { bytes, entries, read };
}

function ids(records, domain) {
  const result = new Map();
  for (const record of records) {
    assert.ok(record && typeof record.id === 'string' && record.id, `${domain} record has ID`);
    assert.ok(!result.has(record.id), `${domain} ID ${record.id} is unique`);
    result.set(record.id, record);
  }
  return result;
}

function auditPack(fileName, expected) {
  const filePath = path.join(PACK_ROOT, fileName);
  const zip = readZip(filePath);
  const manifest = JSON.parse(zip.read('manifest.json').toString('utf8'));
  assert.equal(manifest.schema, PACK_SCHEMA, `${fileName} schema`);
  assert.equal(manifest.packId, expected.packId, `${fileName} pack ID`);
  assert.equal(manifest.type, 'world', `${fileName} is a base world`);
  assert.deepEqual(manifest.dependencies, [], `${fileName} has explicit empty dependencies`);
  assert.equal(manifest.builtFromStateHash, null, `${fileName} has null base hash`);
  assert.equal(manifest.generation.sequence, 0, `${fileName} has generation zero`);
  assert.deepEqual(manifest.installPolicy, { mode: 'append-only', allowStale: false }, `${fileName} install policy`);
  assert.equal(manifest.engine.min, ENGINE_VERSION, `${fileName} minimum engine`);
  assert.equal(manifest.engine.max, '0.1.x', `${fileName} maximum engine line`);
  assert.ok([...zip.entries.values()].every((entry) => entry.method === 0), `${fileName} uses STORE only`);

  const contentBytes = zip.read(manifest.content.path);
  assert.equal(sha256(contentBytes), manifest.content.sha256, `${fileName} content SHA-256`);
  const assetById = ids(manifest.assets || [], 'asset');
  for (const asset of assetById.values()) {
    assert.equal(sha256(zip.read(asset.path)), asset.sha256, `${fileName} asset hash ${asset.id}`);
  }

  const content = JSON.parse(contentBytes.toString('utf8'));
  const world = content.world;
  const additions = content.additions || {};
  const locations = ids(additions.locations || [], 'location');
  const items = ids(additions.items || [], 'item');
  const hooks = ids(additions.hooks || [], 'hook');
  const scenes = ids(additions.scenes || [], 'scene');
  assert.equal(world.id, manifest.worldId, `${fileName} world ID agrees`);
  assert.ok(scenes.has(world.startSceneId), `${fileName} start scene resolves`);
  assert.ok(locations.has(world.startLocationId), `${fileName} start location resolves`);
  if (world.mapAssetId) assert.ok(assetById.has(world.mapAssetId), `${fileName} map asset resolves`);
  assert.equal(locations.size, expected.locations, `${fileName} location count`);
  assert.equal(items.size, expected.items, `${fileName} item count`);
  assert.equal(hooks.size, expected.hooks, `${fileName} hook count`);
  assert.equal(scenes.size, expected.scenes, `${fileName} scene count`);

  for (const location of locations.values()) {
    for (const neighbor of location.neighbors || []) assert.ok(locations.has(neighbor), `${location.id} neighbor resolves`);
  }
  for (const hook of hooks.values()) {
    if (hook.startLocationId) assert.ok(locations.has(hook.startLocationId), `${hook.id} location resolves`);
  }

  const choiceIds = new Set();
  let choices = 0;
  let itemResponses = 0;
  for (const scene of scenes.values()) {
    assert.ok(locations.has(scene.locationId), `${scene.id} location resolves`);
    const visual = scene.visual || {};
    if (visual.backgroundAssetId) assert.ok(assetById.has(visual.backgroundAssetId), `${scene.id} background resolves`);
    for (const layer of visual.layers || []) assert.ok(assetById.has(layer.assetId), `${scene.id} layer resolves`);
    assert.ok(scene.choices.length >= 2 && scene.choices.length <= 4, `${scene.id} has 2-4 choices`);
    for (const choice of scene.choices) {
      choices += 1;
      assert.ok(choice.id && !choiceIds.has(choice.id), `${choice.id} choice ID is unique`);
      choiceIds.add(choice.id);
      if (choice.to !== null) assert.ok(scenes.has(choice.to), `${choice.id} target resolves`);
      if (choice.onUnchosen?.hookId) assert.ok(hooks.has(choice.onUnchosen.hookId), `${choice.id} unchosen hook resolves`);
      if (choice.onUnchosen?.locationId) assert.ok(locations.has(choice.onUnchosen.locationId), `${choice.id} unchosen location resolves`);
      for (const response of choice.itemResponses || []) {
        itemResponses += 1;
        for (const itemId of response.match?.itemIds || []) assert.ok(items.has(itemId), `${response.id} item resolves`);
        if (response.to !== null && response.to !== undefined) assert.ok(scenes.has(response.to), `${response.id} target resolves`);
      }
    }
  }
  assert.equal(choices, expected.choices, `${fileName} choice count`);
  assert.equal(itemResponses, expected.itemResponses, `${fileName} item response count`);
  assert.deepEqual(content.operations || [], [], `${fileName} base world has no patch operations`);
  pass(`${fileName} full independent audit`);
}

const engine = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
check((engine.match(/<script\b/gi) || []).length === 1, 'engine has one script');
check(!/<script[^>]+src\s*=/i.test(engine), 'engine has no external script');
check(!/https?:\/\//i.test(engine), 'engine has no external URL');
check(!/\bfetch\s*\(|XMLHttpRequest|WebSocket/i.test(engine), 'engine has no network API call');
check(!/\blocalStorage\b|serviceWorker/i.test(engine), 'engine has no localStorage or service worker');
check(!/\beval\s*\(|new\s+Function/i.test(engine), 'engine has no dynamic code execution');
check(/indexedDB\.open/.test(engine), 'engine uses IndexedDB');
check(/accept="\.zip,application\/zip"/.test(engine), 'engine exposes bounded ZIP intake');
check(/builtFromStateHash/.test(engine) && /expectedRevision/.test(engine), 'engine declares continuation and revision gates');

const expectedPacks = {
  'AXM_Adventure_Engine_Compatibility_Cartridge_v1_0_0.zip': { packId: 'axm.test.world.core', locations: 2, items: 1, hooks: 1, scenes: 2, choices: 4, itemResponses: 3 },
  'AXM_The_Roads_Between_Adventure_Pack_001_v1.0.0.zip': { packId: 'axm.ap001.multiverse', locations: 10, items: 7, hooks: 4, scenes: 60, choices: 151, itemResponses: 28 },
  'AXM_The_Roads_Between_Adventure_Pack_002_Casual_v1.0.0.zip': { packId: 'axm.ap002.multiverse', locations: 5, items: 7, hooks: 4, scenes: 60, choices: 142, itemResponses: 5 },
  'AXM_The_Roads_Between_Adventure_Pack_003_Strange_Routes_v1.0.0.zip': { packId: 'axm.ap003.multiverse', locations: 5, items: 7, hooks: 4, scenes: 60, choices: 145, itemResponses: 15 },
  'AXM_Route_Zero_Adventure_Pack_003_Fresh_v1.0.0.zip': { packId: 'axm.ap003.route_zero', locations: 7, items: 8, hooks: 5, scenes: 60, choices: 194, itemResponses: 33 }
};

const actualPacks = fs.readdirSync(PACK_ROOT).filter((name) => name.endsWith('.zip')).sort();
assert.deepEqual(actualPacks, Object.keys(expectedPacks).sort(), 'exact pack inventory');
pass('exact pack inventory');
for (const fileName of actualPacks) auditPack(fileName, expectedPacks[fileName]);

console.log(`\nAXM Pocket Adventure focused self-test: ${passed} PASS`);

