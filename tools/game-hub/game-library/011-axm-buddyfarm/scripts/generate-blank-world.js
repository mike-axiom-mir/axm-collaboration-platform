#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const WIDTH = 12288;
const HEIGHT = 8192;
const TILE_SIZE = 1024;
const COLUMNS = 12;
const ROWS = 8;
const TILE_COUNT = COLUMNS * ROWS;
const OUTPUT_ROOT = path.resolve(__dirname, '..', 'runtime', 'world');
const CONTRACT_RECEIPT = path.resolve(
  __dirname,
  '..',
  '..',
  '008-district-party',
  'exports',
  'tilburg-authored-city-world-tile-source',
  'world-source-verification.json'
);

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let value = 0xffffffff;
  for (const byte of buffer) value = CRC_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const output = Buffer.alloc(12 + data.length);
  output.writeUInt32BE(data.length, 0);
  typeBytes.copy(output, 4);
  data.copy(output, 8);
  output.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 8 + data.length);
  return output;
}

function makeTransparentPng(width, height) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const scanlines = Buffer.alloc((width * 4 + 1) * height);
  const compressed = zlib.deflateSync(scanlines, { level: 9 });
  return Buffer.concat([
    signature,
    pngChunk('IHDR', header),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
}

function inspectTransparentPng(buffer) {
  const expectedSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!buffer.subarray(0, 8).equals(expectedSignature)) throw new Error('invalid PNG signature');
  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = -1;
  const dataParts = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    const storedCrc = buffer.readUInt32BE(offset + 8 + length);
    if (crc32(Buffer.concat([Buffer.from(type, 'ascii'), data])) !== storedCrc) throw new Error('PNG CRC mismatch for ' + type);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      colorType = data[9];
    } else if (type === 'IDAT') dataParts.push(data);
    offset += 12 + length;
    if (type === 'IEND') break;
  }
  if (colorType !== 6) throw new Error('blank tile must use RGBA color type');
  const raw = zlib.inflateSync(Buffer.concat(dataParts));
  const stride = width * 4 + 1;
  if (raw.length !== stride * height) throw new Error('blank tile scanline size mismatch');
  let alphaNonZero = 0;
  let rgbNonZero = 0;
  for (let y = 0; y < height; y += 1) {
    if (raw[y * stride] !== 0) throw new Error('blank tile must use deterministic filter type 0');
    const row = y * stride + 1;
    for (let x = 0; x < width; x += 1) {
      const pixel = row + x * 4;
      if (raw[pixel] || raw[pixel + 1] || raw[pixel + 2]) rgbNonZero += 1;
      if (raw[pixel + 3]) alphaNonZero += 1;
    }
  }
  return { width, height, colorType, alphaNonZero, rgbNonZero, fullyTransparent: alphaNonZero === 0 };
}

function generate() {
  const contractReceipt = JSON.parse(fs.readFileSync(CONTRACT_RECEIPT, 'utf8'));
  if (
    contractReceipt.result !== 'PASS'
    || contractReceipt.world.width !== WIDTH
    || contractReceipt.world.height !== HEIGHT
    || contractReceipt.chunks.columns !== COLUMNS
    || contractReceipt.chunks.rows !== ROWS
    || contractReceipt.chunks.count !== TILE_COUNT
  ) {
    throw new Error('Verified neutral world coordinate contract no longer matches the blank BuddyFarm substrate');
  }

  const chunkRoot = path.join(OUTPUT_ROOT, 'chunks');
  fs.mkdirSync(chunkRoot, { recursive: true });
  const png = makeTransparentPng(TILE_SIZE, TILE_SIZE);
  const inspection = inspectTransparentPng(png);
  if (!inspection.fullyTransparent || inspection.rgbNonZero !== 0) throw new Error('generated blank tile contains visible pixels');
  const tileDigest = sha256(png);
  const tiles = [];
  for (let row = 0; row < ROWS; row += 1) {
    for (let column = 0; column < COLUMNS; column += 1) {
      const id = 'blank-' + String(column).padStart(2, '0') + '-' + String(row).padStart(2, '0');
      const file = 'chunks/tile-' + String(column).padStart(2, '0') + '-' + String(row).padStart(2, '0') + '.png';
      fs.writeFileSync(path.join(OUTPUT_ROOT, file), png);
      tiles.push({
        id,
        column,
        row,
        bounds: { x: column * TILE_SIZE, y: row * TILE_SIZE, width: TILE_SIZE, height: TILE_SIZE },
        file,
        bytes: png.length,
        sha256: tileDigest,
        alpha: 'fully-transparent'
      });
    }
  }

  const coverageKeys = new Set(tiles.map(tile => tile.column + ',' + tile.row));
  const coveragePass = coverageKeys.size === TILE_COUNT
    && tiles.every(tile => (
      tile.bounds.x === tile.column * TILE_SIZE
      && tile.bounds.y === tile.row * TILE_SIZE
      && tile.bounds.width === TILE_SIZE
      && tile.bounds.height === TILE_SIZE
    ));
  if (!coveragePass) throw new Error('blank tile coverage is incomplete or overlapping');

  const coverageDigest = sha256(Buffer.from(tiles.map(tile => [
    tile.id,
    tile.bounds.x,
    tile.bounds.y,
    tile.bounds.width,
    tile.bounds.height,
    tile.sha256
  ].join(':')).join('\n')));
  const manifest = {
    schema: 'axm.buddyfarm-blank-world-source/v1',
    id: 'buddyfarm-blank-transparent-world-12288x8192',
    purpose: 'A fully transparent visual substrate. BuddyFarm terrain and starter content are separate game-owned layers.',
    world: { width: WIDTH, height: HEIGHT, origin: 'north-west', xAxis: 'east', yAxis: 'south', unitsPerRasterPixel: 1 },
    chunking: { tileWidth: TILE_SIZE, tileHeight: TILE_SIZE, columns: COLUMNS, rows: ROWS, count: TILE_COUNT },
    contentPolicy: {
      transparentSubstrateOnly: true,
      authoredCityRasterImported: false,
      authoredCitySemanticLayersImported: false,
      buddyFarmLayersStoredSeparately: true
    },
    inheritedContractEvidence: {
      receipt: '008-district-party/exports/tilburg-authored-city-world-tile-source/world-source-verification.json',
      result: contractReceipt.result,
      coordinateContractOnly: true,
      semanticContentSelected: false
    },
    tileSha256: tileDigest,
    coverageSha256: coverageDigest,
    tiles
  };
  const verification = {
    schema: 'axm.buddyfarm-blank-world-verification/v1',
    result: 'PASS',
    world: manifest.world,
    chunks: {
      columns: COLUMNS,
      rows: ROWS,
      count: tiles.length,
      tileWidth: TILE_SIZE,
      tileHeight: TILE_SIZE,
      exactNoGapNoOverlapCoverage: coveragePass
    },
    pixels: {
      format: 'PNG RGBA 8-bit',
      width: inspection.width,
      height: inspection.height,
      alphaNonZeroPerTile: inspection.alphaNonZero,
      rgbNonZeroPerTile: inspection.rgbNonZero,
      everyTileFullyTransparent: inspection.fullyTransparent
    },
    digests: { tileSha256: tileDigest, coverageSha256: coverageDigest },
    exclusions: {
      authoredCityRasterPixels: true,
      authoredCityBuildingsRoadsSidewalksWaterRailParks: true
    },
    verdict: 'Blank transparent substrate only. All visible BuddyFarm content must come from separate game-owned layers.'
  };
  fs.writeFileSync(path.join(OUTPUT_ROOT, 'blank-world-source.json'), JSON.stringify(manifest, null, 2) + '\n');
  fs.writeFileSync(path.join(OUTPUT_ROOT, 'blank-world-verification.json'), JSON.stringify(verification, null, 2) + '\n');
  return { manifest, verification, outputRoot: OUTPUT_ROOT };
}

if (require.main === module) {
  const result = generate();
  console.log('BuddyFarm blank world generated: ' + result.manifest.tiles.length + ' transparent tiles');
  console.log('Coverage SHA-256: ' + result.manifest.coverageSha256);
}

module.exports = { COLUMNS, HEIGHT, ROWS, TILE_COUNT, TILE_SIZE, WIDTH, generate, inspectTransparentPng, makeTransparentPng };
