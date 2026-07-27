'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const zlib = require('node:zlib');

const root = path.join(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative));
const readText = (relative) => read(relative).toString('utf8');
const json = (relative) => JSON.parse(readText(relative));
const sha256 = (relative) => crypto.createHash('sha256').update(read(relative)).digest('hex');

function paeth(left, up, upLeft) {
  const guess = left + up - upLeft;
  const leftDistance = Math.abs(guess - left), upDistance = Math.abs(guess - up), upLeftDistance = Math.abs(guess - upLeft);
  if (leftDistance <= upDistance && leftDistance <= upLeftDistance) return left;
  return upDistance <= upLeftDistance ? up : upLeft;
}

function rgbaPngInfo(relative) {
  const bytes = read(relative);
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `${relative} has a PNG signature`);
  let cursor = 8, width = 0, height = 0, bitDepth = 0, colourType = 0, interlace = 0;
  const imageData = [];
  while (cursor + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(cursor);
    const type = bytes.subarray(cursor + 4, cursor + 8).toString('ascii');
    const data = bytes.subarray(cursor + 8, cursor + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4); bitDepth = data[8]; colourType = data[9]; interlace = data[12];
    }
    if (type === 'IDAT') imageData.push(data);
    cursor += length + 12;
    if (type === 'IEND') break;
  }
  assert.equal(bitDepth, 8, `${relative} uses 8-bit channels`);
  assert.equal(colourType, 6, `${relative} is true RGBA`);
  assert.equal(interlace, 0, `${relative} uses the bounded non-interlaced runtime format`);
  const scanlines = zlib.inflateSync(Buffer.concat(imageData));
  const bytesPerPixel = 4, stride = width * bytesPerPixel;
  let sourceOffset = 0, previous = Buffer.alloc(stride), minimumAlpha = 255, maximumAlpha = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = scanlines[sourceOffset++];
    const current = Buffer.alloc(stride);
    for (let x = 0; x < stride; x += 1) {
      const encoded = scanlines[sourceOffset++];
      const left = x >= bytesPerPixel ? current[x - bytesPerPixel] : 0;
      const up = previous[x] || 0;
      const upLeft = x >= bytesPerPixel ? previous[x - bytesPerPixel] : 0;
      if (filter === 0) current[x] = encoded;
      else if (filter === 1) current[x] = (encoded + left) & 255;
      else if (filter === 2) current[x] = (encoded + up) & 255;
      else if (filter === 3) current[x] = (encoded + Math.floor((left + up) / 2)) & 255;
      else if (filter === 4) current[x] = (encoded + paeth(left, up, upLeft)) & 255;
      else assert.fail(`${relative} has unsupported PNG filter ${filter}`);
    }
    for (let x = 3; x < stride; x += 4) {
      minimumAlpha = Math.min(minimumAlpha, current[x]);
      maximumAlpha = Math.max(maximumAlpha, current[x]);
    }
    previous = current;
  }
  return { width, height, minimumAlpha, maximumAlpha };
}

test('interactable intake archive is preserved exactly with an honest curation boundary', () => {
  const manifest = json('assets/INTERACTABLE_ASSET_MANIFEST.json');
  assert.equal(manifest.source.individualPngCount, 158);
  assert.equal(manifest.source.categoryCount, 7);
  assert.equal(fs.statSync(path.join(root, manifest.source.archive)).size, manifest.source.archiveBytes);
  assert.equal(sha256(manifest.source.archive), manifest.source.archiveSha256);
  assert.equal(manifest.intakeAudit.zipIntegrity, 'PASS');
  assert.match(manifest.intakeAudit.fullAlphaRange, /^PARTIAL/);
  assert.equal(manifest.license.publicOpenSourceLicense, false);
  assert.equal(manifest.license.cc0, false);
});

test('fourteen curated runtime PNGs retain real transparent and opaque pixels', () => {
  const manifest = json('assets/INTERACTABLE_ASSET_MANIFEST.json');
  assert.equal(manifest.runtimeAssets.length, 14);
  for (const asset of manifest.runtimeAssets) {
    assert.equal(sha256(asset.runtimeFile), asset.sha256, `${asset.runtimeFile} hash matches its intake record`);
    const info = rgbaPngInfo(asset.runtimeFile);
    assert.equal(info.width, asset.width);
    assert.equal(info.height, asset.height);
    assert.equal(info.minimumAlpha, 0, `${asset.runtimeFile} contains transparent pixels`);
    assert.equal(info.maximumAlpha, 255, `${asset.runtimeFile} contains opaque pixels`);
  }
});

test('known damaged fragments remain quarantined and are never loaded by the party screen', () => {
  const manifest = json('assets/INTERACTABLE_ASSET_MANIFEST.json');
  const scene = readText('client/game/scenes/CityScene.js');
  const rejected = manifest.heldBack.filter((entry) => entry.status === 'REJECTED');
  assert.ok(rejected.length >= 2);
  for (const entry of rejected) {
    assert.doesNotMatch(scene, new RegExp(path.basename(entry.sourceEntry).replaceAll('.', '\\.')));
    assert.ok(!manifest.runtimeAssets.some((asset) => asset.sourceEntry === entry.sourceEntry));
  }
});

test('city prop overlays stay visual-only or explicitly reserved and remain inside Tilburg bounds', () => {
  const art = json('data/city-art.json');
  const map = json('data/map.json');
  const manifest = json('assets/INTERACTABLE_ASSET_MANIFEST.json');
  const keys = new Set(manifest.runtimeAssets.map((asset) => asset.key));
  assert.equal(art.propOverlays.length, 28);
  assert.equal(new Set(art.propOverlays.map((entry) => entry.id)).size, art.propOverlays.length);
  assert.equal(art.propOverlays.filter((entry) => entry.interaction === 'reserved').length, 3);
  for (const prop of art.propOverlays) {
    assert.ok(keys.has(prop.asset), `${prop.id} uses a curated runtime key`);
    assert.ok(['visual-only', 'reserved'].includes(prop.interaction), `${prop.id} does not claim an unimplemented mechanic`);
    assert.ok(prop.x >= 0 && prop.x <= map.world.width);
    assert.ok(prop.y >= 0 && prop.y <= map.world.height);
  }
});

test('package art is selected stably from authoritative package identity without changing mission state', () => {
  const source = readText('client/game/rendering/entity-renderer.js').replace('export class EntityRenderer', 'class EntityRenderer');
  const EntityRenderer = Function(`${source}\nreturn EntityRenderer;`)();
  const renderer = new EntityRenderer();
  const courier = [{ id: 'box' }, { id: 'duffel' }, { id: 'briefcase' }, { id: 'wood' }, { id: 'plastic' }];
  renderer.setAssets({
    packageBox: courier[0], packageDuffel: courier[1], packageBriefcase: courier[2], packageCrateWood: courier[3], packageCratePlastic: courier[4],
  });
  const first = renderer.packageSprite({ id: 'package-01', kind: 'courier' });
  assert.ok(courier.includes(first));
  assert.equal(renderer.packageSprite({ id: 'package-01', kind: 'courier' }), first);
  assert.ok([courier[0], courier[3], courier[4]].includes(renderer.packageSprite({ id: 'supply-01', kind: 'supply' })));
  assert.match(source, /hashString\(pkg\?\.id\)/);
  assert.match(source, /drawPropOverlay\(ctx, prop\)/);
  assert.doesNotMatch(source, /pkg\.(?:ownerActorId|status|delivered)\s*=/, 'the renderer never mutates authoritative package state');
});

test('party screen loads every curated runtime asset from local relative routes', () => {
  const manifest = json('assets/INTERACTABLE_ASSET_MANIFEST.json');
  const scene = readText('client/game/scenes/CityScene.js');
  for (const asset of manifest.runtimeAssets) {
    const route = `/${asset.runtimeFile}`;
    assert.match(scene, new RegExp(route.replaceAll('/', '\\/').replaceAll('.', '\\.')), `${asset.key} has a local load route`);
  }
  assert.doesNotMatch(scene, /https?:\/\//, 'interactable runtime art never requires an external host');
});
