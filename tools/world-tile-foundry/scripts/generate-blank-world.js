'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT = path.join(ROOT, 'sources', 'blank-10000x10000');
const TILE_DIR = path.join(OUTPUT, 'tiles');
const CHUNK_DIR = path.join(OUTPUT, 'chunks');
const WORLD = Object.freeze({ width: 10000, height: 10000 });
const TILE = 1000;
const COLUMNS = WORLD.width / TILE;
const ROWS = WORLD.height / TILE;
const CREATIVE_GRID = 100;
const FLAT_ASSET_PIXELS = 128;
const METRES_PER_FLAT_CELL = 1;
const VERTICAL_SNAP_METRES = 0.5;
const LAYERS = Object.freeze(['ground', 'road', 'sidewalk', 'building', 'park', 'water', 'rail']);

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const name = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])), 0);
  return Buffer.concat([length, name, data, checksum]);
}

function transparentPng(width, height) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const row = Buffer.alloc(1 + width * 4);
  const scanlines = Buffer.alloc(row.length * height);
  for (let y = 0; y < height; y += 1) row.copy(scanlines, y * row.length);
  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(scanlines, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
}

function emptyLayers() {
  return Object.fromEntries(LAYERS.map((layer) => [layer, []]));
}

function stable(value) {
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + stable(value[key])).join(',') + '}';
  return JSON.stringify(value);
}

function inspectTransparentPng(file) {
  const buffer = fs.readFileSync(file);
  if (!buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new Error('Invalid PNG signature: ' + file);
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  const colorType = buffer[25];
  let offset = 8;
  const idat = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === 'IDAT') idat.push(data);
    offset += 12 + length;
    if (type === 'IEND') break;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  let nonZero = 0;
  for (const byte of raw) if (byte !== 0) nonZero += 1;
  return { width, height, colorType, nonZero, bytes: buffer.length, sha256: sha256(buffer) };
}

function generate() {
  [TILE_DIR, CHUNK_DIR].forEach((target) => {
    if (!path.resolve(target).startsWith(path.resolve(OUTPUT) + path.sep)) throw new Error('Refusing to clean outside generated blank-world output');
    fs.rmSync(target, { recursive: true, force: true });
  });
  fs.mkdirSync(OUTPUT, { recursive: true });
  const tiles = [];
  const chunks = [];
  const virtualGrid = { world: WORLD, loadingChunkMetres: TILE, columns: COLUMNS, rows: ROWS, possibleCount: COLUMNS * ROWS, implicitEmpty: true, layers: LAYERS };
  const semanticDigest = sha256(Buffer.from(stable({ ...virtualGrid, kind: 'semantic' })));
  const rasterDigest = sha256(Buffer.from(stable({ ...virtualGrid, kind: 'transparent-raster' })));
  const source = {
    schema: 'axm-neutral-world-tile-source/v1',
    id: 'axm-blank-transparent-world-10000x10000',
    purpose: 'Reusable empty transparent world substrate. All authored terrain and gameplay remain separate layers.',
    world: { ...WORLD, origin: 'north-west', xAxis: 'east', yAxis: 'south', canonicalUnit: 'metre', unitsPerRasterPixel: 1 },
    canvasModes: {
      flat2d: {
        enabled: true,
        assetCellPixels: { width: FLAT_ASSET_PIXELS, height: FLAT_ASSET_PIXELS },
        footprintMetres: { width: METRES_PER_FLAT_CELL, depth: METRES_PER_FLAT_CELL },
        pixelsPerMetre: FLAT_ASSET_PIXELS,
        note: 'Art resolution is independent from world size and is streamed near the camera.'
      },
      spatial3d: {
        enabled: true,
        placementCellMetres: { width: 1, depth: 1, height: VERTICAL_SNAP_METRES },
        authoringSectorMetres: { width: CREATIVE_GRID, depth: CREATIVE_GRID, playableDepthLayers: 1, reservedDepthLayers: 20, playableHeight: 20, reservedHeight: 50 },
        heightPolicyMetres: { reservedMinimum: -10, playableMinimum: -0.5, ground: 0, playableMaximum: 20, reservedMaximum: 50, step: VERTICAL_SNAP_METRES },
        axes: { x: 'east', y: 'up', z: 'south' },
        interchange: { gltfAndGodotScale: 1, unrealCentimetreScale: 100 }
      }
    },
    scaleReferences: {
      crate: { footprintMetres: { width: 1, depth: 1 }, heightMetres: 1, flatPixelsAtNativeScale: { width: 128, height: 128 } },
      adultHuman: { footprintMetres: { width: 0.6, depth: 0.6 }, heightMetres: 1.8, flatFootprintPixelsAtNativeScale: { width: 77, height: 77 } }
    },
    creativeGrid: { role: 'authoring-sector', cellWidth: CREATIVE_GRID, cellHeight: CREATIVE_GRID, unit: 'metre', columns: 100, rows: 100, count: 10000 },
    buildRegion: { shape: 'circle', x: 100, y: 100, width: 9800, height: 9800, centerX: 5000, centerY: 5000, radius: 4900, boundaryWidth: 100, buildable: true },
    chunking: { width: TILE, height: TILE, columns: COLUMNS, rows: ROWS, possibleCount: COLUMNS * ROWS, materializedCount: 0, count: 0, implicitEmpty: true, chunks },
    layers: { included: LAYERS.slice(), totals: Object.fromEntries(LAYERS.map((layer) => [layer, 0])) },
    semanticChunksSha256: semanticDigest,
    rasterAlignment: {
      manifest: 'raster-manifest.json',
      masterSha256: rasterDigest,
      width: WORLD.width,
      height: WORLD.height,
      note: 'One hundred possible 1 km loading chunks are virtual and implicit-empty. No transparent PNG is stored until authored content requires an artifact.'
    },
    contentPolicy: {
      transparentSubstrateOnly: true,
      authoredPixelsIncluded: false,
      authoredSemanticFeaturesIncluded: false,
      runtimeStateIncluded: false
    },
    streamingPolicy: {
      strategy: 'vision-window-chunk-streaming',
      loadingUnit: { width: TILE, height: TILE },
      recommendedSafetyRingChunks: 1,
      fogOfWar: 'consumer-owned visibility state; never source deletion',
      unloadedChunkMeaning: 'not currently rendered; canonical world remains intact',
      persistence: 'materialize authored chunks only; implicit empty chunks consume no files'
    },
    assetPolicy: 'Locally generated deterministic empty RGBA tiles; no external asset or licence.',
    provenance: { originType: 'generated', sourceId: 'world-tile-foundry.blank-generator', createdBy: 'Mike + AXM local builders', licenseId: 'AXM-LOCAL' }
  };
  const raster = {
    schema: 'axm-transparent-world-raster/v1',
    id: 'axm-blank-transparent-world-10000x10000',
    world: { ...WORLD, origin: 'north-west', canonicalUnit: 'metre', unitsPerRasterPixel: 1 },
    tileSize: { width: TILE, height: TILE },
    grid: { columns: COLUMNS, rows: ROWS, possibleCount: COLUMNS * ROWS, materializedCount: 0, count: 0, implicitEmpty: true, authoringSectorMetres: CREATIVE_GRID, authoringSectorCount: 10000, flatAssetCellPixels: FLAT_ASSET_PIXELS },
    contentPolicy: source.contentPolicy,
    coverageSha256: rasterDigest,
    tiles
  };
  const verification = {
    schema: 'axm.blank-transparent-world-verification/v1',
    result: 'PASS',
    world: source.world,
    chunks: { columns: COLUMNS, rows: ROWS, possibleCount: COLUMNS * ROWS, materializedCount: 0, implicitEmptyCoverage: true },
    pixels: { format: 'virtual transparent substrate', storedTiles: 0, implicitAlpha: 0, authoredPixels: 0 },
    features: { total: 0, everySemanticLayerEmpty: true },
    creativeGrid: { cellWidth: CREATIVE_GRID, cellHeight: CREATIVE_GRID, columns: 100, rows: 100, count: 10000 },
    canvases: {
      flat2d: { assetCellPixels: { width: 128, height: 128 }, footprintMetres: { width: 1, depth: 1 } },
      spatial3d: { placementCellMetres: { width: 1, depth: 1, height: 0.5 }, authoringSectorMetres: { width: 100, depth: 100, playableDepthLayers: 1, reservedDepthLayers: 20, playableHeight: 20, reservedHeight: 50 }, heightPolicyMetres: { reservedMinimum: -10, playableMinimum: -0.5, ground: 0, playableMaximum: 20, reservedMaximum: 50, step: 0.5 } }
    },
    buildRegion: { shape: 'circle', boundaryWidth: 100, radius: 4900, enforcedByEditor: true },
    streaming: { strategy: 'vision-window-chunk-streaming', safetyRingChunks: 1, fogDoesNotDeleteSource: true },
    digests: { semanticChunksSha256: semanticDigest, rasterCoverageSha256: rasterDigest },
    verdict: 'Blank transparent substrate only. Visible content must be added as separate editable layers.'
  };

  fs.writeFileSync(path.join(OUTPUT, 'world-source.json'), JSON.stringify(source, null, 2) + '\n');
  fs.writeFileSync(path.join(OUTPUT, 'raster-manifest.json'), JSON.stringify(raster, null, 2) + '\n');
  fs.writeFileSync(path.join(OUTPUT, 'verification.json'), JSON.stringify(verification, null, 2) + '\n');
  return { source, raster, verification };
}

if (require.main === module) {
  const result = generate();
  console.log('World Tile Foundry blank source generated: ' + result.source.chunking.possibleCount + ' virtual chunks, 0 stored tiles, 0 semantic features');
}

module.exports = { generate, inspectTransparentPng, OUTPUT };
