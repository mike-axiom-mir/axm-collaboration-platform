'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const exportRoot = path.join(root, 'exports', 'tilburg-authored-city-alpha-raster');
const manifestPath = path.join(exportRoot, 'raster-manifest.json');
const receiptPath = path.join(exportRoot, 'export-verification.json');

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function pngDimensions(buffer, label) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (buffer.length < 24 || !buffer.subarray(0, 8).equals(signature) || buffer.toString('ascii', 12, 16) !== 'IHDR') {
    throw new Error(`${label} is not a valid PNG with an IHDR header.`);
  }
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function verifyFile(record, expectedDimensions) {
  const absolutePath = path.join(exportRoot, record.file);
  const buffer = fs.readFileSync(absolutePath);
  const dimensions = pngDimensions(buffer, record.file);
  if (dimensions.width !== expectedDimensions.width || dimensions.height !== expectedDimensions.height) {
    throw new Error(`${record.file} is ${dimensions.width}x${dimensions.height}; expected ${expectedDimensions.width}x${expectedDimensions.height}.`);
  }
  const digest = sha256(buffer);
  if (digest !== record.sha256) throw new Error(`${record.file} SHA-256 does not match the manifest.`);
  if (Number(record.bytes) !== buffer.length) throw new Error(`${record.file} byte count does not match the manifest.`);
  return { ...dimensions, bytes: buffer.length, sha256: digest };
}

function verifySourceMapHash(manifest) {
  const mapRoot = path.join(root, 'data', 'maps', 'tilburg-authored-city-alpha');
  const files = [
    path.join(mapRoot, 'map.json'),
    ...fs.readdirSync(path.join(mapRoot, 'map-chunks')).sort().map((name) => path.join(mapRoot, 'map-chunks', name)),
  ];
  const digest = crypto.createHash('sha256');
  for (const file of files) digest.update(fs.readFileSync(file));
  const actual = digest.digest('hex');
  if (actual !== manifest.sourceMapAndChunksSha256) throw new Error('The clean raster source map hash no longer matches the authored map package.');
  return actual;
}

function main() {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.world?.width !== 12288 || manifest.world?.height !== 8192) throw new Error('Manifest world size is not 12,288x8,192.');
  if (manifest.master?.width !== 12288 || manifest.master?.height !== 8192) throw new Error('Master raster declaration is not 12,288x8,192.');
  if (manifest.tiling?.columns !== 12 || manifest.tiling?.rows !== 8 || manifest.tiling?.count !== 96) throw new Error('Tile grid must be exactly 12x8 (96 tiles).');
  if (!Array.isArray(manifest.tiles) || manifest.tiles.length !== 96) throw new Error('Tile manifest must contain exactly 96 entries.');

  const master = verifyFile(manifest.master, { width: 12288, height: 8192 });
  const occupied = new Set();
  let tileBytes = 0;
  for (const tile of manifest.tiles) {
    if (!Number.isInteger(tile.column) || !Number.isInteger(tile.row) || tile.column < 0 || tile.column >= 12 || tile.row < 0 || tile.row >= 8) {
      throw new Error(`${tile.file} has invalid grid coordinates.`);
    }
    const key = `${tile.column}:${tile.row}`;
    if (occupied.has(key)) throw new Error(`Duplicate tile grid position ${key}.`);
    occupied.add(key);
    if (tile.x !== tile.column * 1024 || tile.y !== tile.row * 1024 || tile.width !== 1024 || tile.height !== 1024) {
      throw new Error(`${tile.file} does not align to the exact 1024-pixel seam grid.`);
    }
    tileBytes += verifyFile(tile, { width: 1024, height: 1024 }).bytes;
  }
  for (let row = 0; row < 8; row += 1) {
    for (let column = 0; column < 12; column += 1) {
      if (!occupied.has(`${column}:${row}`)) throw new Error(`Missing tile at ${column}:${row}.`);
    }
  }

  const sourceMapAndChunksSha256 = verifySourceMapHash(manifest);
  const receipt = {
    schema: 'axm-clean-raster-verification/v1',
    verifiedAt: new Date().toISOString(),
    result: 'PASS',
    master: { file: manifest.master.file, ...master },
    tileGrid: {
      columns: 12,
      rows: 8,
      count: occupied.size,
      tileWidth: 1024,
      tileHeight: 1024,
      exactCoverage: '0,0 through 12288,8192 with no missing or duplicate grid cells',
      manifestHashesVerified: true,
      totalBytes: tileBytes,
    },
    sourceMapAndChunksSha256,
    cleanDefinition: manifest.cleanDefinition,
    approval: 'Technical export verification passed. Human visual approval remains pending.',
  };
  fs.writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
  process.stdout.write(`AUTHORED_CITY_EXPORT_VERIFY: PASS (${master.width}x${master.height}, ${occupied.size} exact-grid tiles, SHA-256 ${master.sha256})\n`);
}

try { main(); }
catch (error) {
  process.stderr.write(`AUTHORED_CITY_EXPORT_VERIFY: FAIL\n${error.stack || error.message}\n`);
  process.exitCode = 1;
}
