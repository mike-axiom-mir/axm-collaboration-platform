'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const CONTRACT = 'axm.buddyfarm-blank-world-adapter/v1';
const SOURCE_TILE_SIZE = 32;
const VIEW_REACH_CHUNKS = 1;
const DEFAULT_SOURCE_ROOT = path.resolve(__dirname, 'world');
const EXPECTED_COVERAGE_DIGEST = 'efd36ade32109fd715a6d23264ec3e434e073697dad54d3ac7c2828c9627a4e6';

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function clamp(value, low, high) {
  return Math.max(low, Math.min(high, value));
}

function chunkKey(column, row) {
  return String(column) + ',' + String(row);
}

function createWorldAdapter(options) {
  const settings = options || {};
  const sourceRoot = path.resolve(settings.sourceRoot || DEFAULT_SOURCE_ROOT);
  const sourceFile = path.join(sourceRoot, 'blank-world-source.json');
  const receiptFile = path.join(sourceRoot, 'blank-world-verification.json');
  if (!fs.existsSync(sourceFile) || !fs.existsSync(receiptFile)) {
    throw new Error('BuddyFarm blank world source is unavailable. Run scripts/generate-blank-world.js.');
  }
  const source = readJson(sourceFile);
  const receipt = readJson(receiptFile);
  if (source.schema !== 'axm.buddyfarm-blank-world-source/v1') throw new Error('Unsupported BuddyFarm blank world schema');
  if (
    receipt.result !== 'PASS'
    || receipt.pixels.everyTileFullyTransparent !== true
    || receipt.chunks.exactNoGapNoOverlapCoverage !== true
  ) {
    throw new Error('BuddyFarm blank world verification receipt is not a transparent coverage PASS');
  }
  if (
    source.world.width !== 12288
    || source.world.height !== 8192
    || source.chunking.tileWidth !== 1024
    || source.chunking.tileHeight !== 1024
    || source.chunking.columns !== 12
    || source.chunking.rows !== 8
    || source.chunking.count !== 96
    || source.tiles.length !== 96
  ) {
    throw new Error('BuddyFarm blank world dimensions or chunk grid drifted');
  }
  if (
    source.contentPolicy.authoredCityRasterImported !== false
    || source.contentPolicy.authoredCitySemanticLayersImported !== false
    || source.contentPolicy.transparentSubstrateOnly !== true
  ) {
    throw new Error('BuddyFarm blank world content policy permits authored city material');
  }
  if (source.coverageSha256 !== EXPECTED_COVERAGE_DIGEST || receipt.digests.coverageSha256 !== EXPECTED_COVERAGE_DIGEST) {
    throw new Error('BuddyFarm blank world coverage digest does not match the sealed build receipt');
  }

  const chunkWidth = source.chunking.tileWidth / SOURCE_TILE_SIZE;
  const chunkHeight = source.chunking.tileHeight / SOURCE_TILE_SIZE;
  const grid = Object.freeze({
    width: source.world.width / SOURCE_TILE_SIZE,
    height: source.world.height / SOURCE_TILE_SIZE,
    chunkWidth,
    chunkHeight,
    columns: source.chunking.columns,
    rows: source.chunking.rows
  });
  const metadataByKey = new Map(source.tiles.map(meta => [chunkKey(meta.column, meta.row), meta]));
  const verifiedTiles = new Set();

  function chunkForCell(x, y) {
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= grid.width || y >= grid.height) return null;
    return { column: Math.floor(x / grid.chunkWidth), row: Math.floor(y / grid.chunkHeight) };
  }

  function verifyTile(meta) {
    const key = chunkKey(meta.column, meta.row);
    if (verifiedTiles.has(key)) return;
    const file = path.resolve(sourceRoot, meta.file);
    if (!file.startsWith(sourceRoot + path.sep)) throw new Error('Blank tile escaped its source root');
    const bytes = fs.readFileSync(file);
    if (sha256(bytes) !== meta.sha256 || meta.sha256 !== source.tileSha256) {
      throw new Error('Blank tile digest mismatch: ' + meta.id);
    }
    verifiedTiles.add(key);
  }

  function chunkDescriptor(column, row, explored) {
    const meta = metadataByKey.get(chunkKey(column, row));
    if (!meta) return null;
    verifyTile(meta);
    return {
      id: meta.id,
      column,
      row,
      bounds: {
        x: meta.bounds.x / SOURCE_TILE_SIZE,
        y: meta.bounds.y / SOURCE_TILE_SIZE,
        width: meta.bounds.width / SOURCE_TILE_SIZE,
        height: meta.bounds.height / SOURCE_TILE_SIZE
      },
      explored,
      substrate: {
        schema: 'axm.buddyfarm-transparent-tile/v1',
        url: 'world/' + meta.file.replace(/\\/g, '/'),
        sha256: meta.sha256,
        alpha: meta.alpha,
        sourcePixels: Object.assign({}, meta.bounds)
      },
      gameLayers: [{
        id: meta.id + '-meadow-foundation',
        layer: 'meadow-foundation',
        material: 'buddyfarm-soft-grass',
        provenance: 'BuddyFarm procedural game layer; not inherited city content',
        walkable: true,
        collidable: false,
        rect: {
          x: meta.bounds.x / SOURCE_TILE_SIZE,
          y: meta.bounds.y / SOURCE_TILE_SIZE,
          width: meta.bounds.width / SOURCE_TILE_SIZE,
          height: meta.bounds.height / SOURCE_TILE_SIZE
        }
      }]
    };
  }

  function isWalkableCell(x, y) {
    return chunkForCell(x, y) !== null;
  }

  function ensureExploration(state) {
    if (!state.exploration || state.exploration.schema !== 'axm.buddyfarm-fog/v1') {
      state.exploration = { schema: 'axm.buddyfarm-fog/v1', exploredChunks: [] };
    }
    if (!Array.isArray(state.exploration.exploredChunks)) state.exploration.exploredChunks = [];
    return state.exploration;
  }

  function revealForActors(state) {
    const exploration = ensureExploration(state);
    const explored = new Set(exploration.exploredChunks);
    Object.values(state.actors || {}).forEach(actor => {
      if (actor.scene !== 'farm') return;
      const coordinate = chunkForCell(actor.x, actor.y);
      if (coordinate) explored.add(chunkKey(coordinate.column, coordinate.row));
    });
    exploration.exploredChunks = Array.from(explored).sort((a, b) => {
      const aa = a.split(',').map(Number), bb = b.split(',').map(Number);
      return aa[1] - bb[1] || aa[0] - bb[0];
    });
    return exploration.exploredChunks;
  }

  function activeCoordinates(actors, reach) {
    const radius = Number.isInteger(reach) ? clamp(reach, 0, 2) : VIEW_REACH_CHUNKS;
    const coordinates = new Map();
    Object.values(actors || {}).forEach(actor => {
      if (actor.scene !== 'farm') return;
      const center = chunkForCell(actor.x, actor.y);
      if (!center) return;
      for (let row = center.row - radius; row <= center.row + radius; row += 1) {
        for (let column = center.column - radius; column <= center.column + radius; column += 1) {
          if (column < 0 || row < 0 || column >= grid.columns || row >= grid.rows) continue;
          coordinates.set(chunkKey(column, row), { column, row });
        }
      }
    });
    if (!coordinates.size) coordinates.set('0,0', { column: 0, row: 0 });
    return Array.from(coordinates.values()).sort((a, b) => a.row - b.row || a.column - b.column);
  }

  function viewForState(state, reach) {
    const explored = new Set(revealForActors(state));
    const coordinates = activeCoordinates(state.actors, reach);
    return {
      schema: 'axm.buddyfarm-world-view/v1',
      adapter: CONTRACT,
      source: {
        id: source.id,
        schema: source.schema,
        coverageSha256: source.coverageSha256,
        width: source.world.width,
        height: source.world.height,
        sourceUnitsPerCell: SOURCE_TILE_SIZE,
        transparentSubstrateOnly: true,
        authoredCityContentImported: false
      },
      grid,
      reachChunks: Number.isInteger(reach) ? reach : VIEW_REACH_CHUNKS,
      activeChunkCount: coordinates.length,
      chunks: coordinates.map(coordinate => (
        chunkDescriptor(coordinate.column, coordinate.row, explored.has(chunkKey(coordinate.column, coordinate.row)))
      )),
      overview: source.tiles.map(meta => ({
        id: meta.id,
        column: meta.column,
        row: meta.row,
        alpha: meta.alpha,
        explored: explored.has(chunkKey(meta.column, meta.row))
      }))
    };
  }

  function receiptSummary() {
    return {
      adapter: CONTRACT,
      sourceRoot,
      sourceSchema: source.schema,
      sourceId: source.id,
      world: Object.assign({}, source.world),
      grid,
      chunks: source.chunking.count,
      tileSha256: source.tileSha256,
      coverageSha256: source.coverageSha256,
      expectedCoverageDigestAtBuild: EXPECTED_COVERAGE_DIGEST,
      verificationResult: receipt.result,
      fullyTransparent: receipt.pixels.everyTileFullyTransparent,
      noGapNoOverlapCoverage: receipt.chunks.exactNoGapNoOverlapCoverage,
      authoredCityContentImported: false,
      sourceTileSize: SOURCE_TILE_SIZE,
      viewReachChunks: VIEW_REACH_CHUNKS
    };
  }

  return {
    CONTRACT,
    SOURCE_TILE_SIZE,
    VIEW_REACH_CHUNKS,
    activeCoordinates,
    chunkForCell,
    grid,
    isWalkableCell,
    receiptSummary,
    revealForActors,
    sourceRoot,
    viewForState
  };
}

module.exports = {
  CONTRACT,
  DEFAULT_SOURCE_ROOT,
  SOURCE_TILE_SIZE,
  VIEW_REACH_CHUNKS,
  chunkKey,
  createWorldAdapter
};
