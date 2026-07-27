'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

let canvasApi;
try { canvasApi = require('@napi-rs/canvas'); }
catch {
  process.stdout.write('AUTHORED_CITY_RASTER: UNRUN\nReason: optional @napi-rs/canvas build dependency is unavailable.\n');
  process.exit(0);
}

const { Canvas, createCanvas } = canvasApi;
global.OffscreenCanvas = Canvas;

const root = path.join(__dirname, '..');
const mapRoot = path.join(root, 'data', 'maps', 'tilburg-authored-city-alpha');
const previewRoot = path.join(root, 'docs', 'previews');
const exportRoot = path.join(root, 'exports', 'tilburg-authored-city-alpha-raster');
const tileRoot = path.join(exportRoot, 'tiles');
const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));

function rendererClass() {
  const source = fs.readFileSync(path.join(root, 'client', 'game', 'rendering', 'entity-renderer.js'), 'utf8')
    .replace('export class EntityRenderer', 'class EntityRenderer');
  return Function(`${source}\nreturn EntityRenderer;`)();
}

function digest(buffer) { return crypto.createHash('sha256').update(buffer).digest('hex'); }

function viewCanvas({ file, width, height, centre, zoom, title, subtitle }) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#08100e'; ctx.fillRect(0, 0, width, height);
  ctx.save(); ctx.translate(width / 2, height / 2); ctx.scale(zoom, zoom); ctx.translate(-centre.x, -centre.y);
  return { file, width, height, title, subtitle, canvas, ctx, zoom, centre };
}

function finishView(view, renderer, cityArt) {
  const { ctx, width, canvas } = view;
  renderer.drawCityArt(ctx, cityArt);
  ctx.restore();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const gradient = ctx.createLinearGradient(0, 0, 0, 96); gradient.addColorStop(0, '#07110ef5'); gradient.addColorStop(1, '#07110e18');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, 96);
  ctx.fillStyle = '#59e0b8'; ctx.font = '900 17px system-ui'; ctx.textAlign = 'left'; ctx.fillText(view.title, 24, 34);
  ctx.fillStyle = '#e7f2ed'; ctx.font = '700 11px system-ui'; ctx.fillText(view.subtitle, 24, 57);
  ctx.fillStyle = '#ffcd70'; ctx.font = '800 9px system-ui'; ctx.fillText('ACTUAL DETERMINISTIC MAP RENDERER · ART ALPHA · HUMAN VISUAL APPROVAL PENDING', 24, 78);
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(path.join(previewRoot, view.file), buffer);
  return { file: view.file, width: view.width, height: view.height, sha256: digest(buffer) };
}

function cleanTile(chunk, renderer, map) {
  const width = Number(chunk.bounds.width) || 1024, height = Number(chunk.bounds.height) || 1024;
  const canvas = createCanvas(width, height), ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.save(); ctx.translate(-chunk.bounds.x, -chunk.bounds.y);
  renderer.drawMapBackground(ctx, map);
  renderer.drawMapChunk(ctx, chunk, map.palette, false);
  renderer.drawGameplayMapLayers(ctx, map, false, true);
  ctx.restore();
  delete chunk.__axmSurface;
  return canvas;
}

function safeCleanTileDirectory() {
  fs.mkdirSync(tileRoot, { recursive: true });
  for (const name of fs.readdirSync(tileRoot)) {
    if (/^tile-\d{2}-\d{2}\.png$/.test(name)) fs.unlinkSync(path.join(tileRoot, name));
  }
}

function main() {
  fs.mkdirSync(previewRoot, { recursive: true });
  fs.mkdirSync(exportRoot, { recursive: true });
  safeCleanTileDirectory();
  const map = readJson(path.join(mapRoot, 'map.json'));
  const cityArt = readJson(path.join(mapRoot, 'city-art.json'));
  map.palette = { ...map.palette, ...cityArt.palette };
  const EntityRenderer = rendererClass();
  const renderer = new EntityRenderer(); renderer.setCityArt(cityArt); renderer.setPresentationClock(() => 0);
  const master = createCanvas(map.world.width, map.world.height), masterContext = master.getContext('2d');
  masterContext.imageSmoothingEnabled = false;
  const views = [
    viewCanvas({ file: 'authored-city-overview.png', width: 1800, height: 1200, centre: { x: 6144, y: 4096 }, zoom: 1800 / 12288, title: 'TILBURG AUTHORED CITY · COMPLETE WORLD', subtitle: '12,288 × 8,192 · independent street plan · 96 streamable chunks' }),
    viewCanvas({ file: 'authored-city-centre-gameplay-scale.png', width: 1440, height: 900, centre: { x: 6144, y: 4096 }, zoom: .85, title: 'AUTHORED CITY CENTRE · GAMEPLAY SCALE', subtitle: 'civic spine · crossings · varied roofs · Party House court · market district' }),
    viewCanvas({ file: 'authored-city-harbour-gameplay-scale.png', width: 1440, height: 900, centre: { x: 9300, y: 5750 }, zoom: .72, title: 'HARBOUR WORKS · GAMEPLAY SCALE', subtitle: 'working quays · bridge choices · warehouses · canal collision truth' }),
    viewCanvas({ file: 'authored-city-rail-quarter-gameplay-scale.png', width: 1440, height: 900, centre: { x: 6144, y: 2500 }, zoom: .72, title: 'RAIL QUARTER · GAMEPLAY SCALE', subtitle: 'station mass · platforms · mainline · connected urban blocks' }),
  ];

  const tiles = [];
  for (const entry of [...map.chunking.chunks].sort((a, b) => (a.row - b.row) || (a.column - b.column))) {
    const chunkPath = path.join(root, entry.path.replace(/^\/+/, ''));
    const chunk = readJson(chunkPath);
    const tile = cleanTile(chunk, renderer, map);
    const name = `tile-${String(entry.column).padStart(2, '0')}-${String(entry.row).padStart(2, '0')}.png`;
    const buffer = tile.toBuffer('image/png');
    fs.writeFileSync(path.join(tileRoot, name), buffer);
    masterContext.drawImage(tile, entry.x, entry.y);
    for (const view of views) view.ctx.drawImage(tile, entry.x, entry.y);
    tiles.push({ file: `tiles/${name}`, column: entry.column, row: entry.row, x: entry.x, y: entry.y, width: entry.width, height: entry.height, sha256: digest(buffer), bytes: buffer.length });
  }

  const masterBuffer = master.toBuffer('image/png');
  const masterName = 'tilburg-authored-city-clean-12288x8192.png';
  fs.writeFileSync(path.join(exportRoot, masterName), masterBuffer);
  const previews = views.map((view) => finishView(view, renderer, cityArt));
  const mapIndex = readJson(path.join(mapRoot, 'build-index.json'));
  const manifest = {
    schema: 'axm-clean-city-raster/v1',
    id: 'tilburg-authored-city-alpha-clean-raster',
    generatedAt: new Date().toISOString(),
    sourceMapId: map.id,
    sourceMapAndChunksSha256: mapIndex.mapAndChunksSha256,
    cleanDefinition: 'Environment only: no actors, vehicles, HUD, mission zones, debug collision, session state, or district labels.',
    world: { width: map.world.width, height: map.world.height, unitsPerPixel: 1 },
    master: { file: masterName, width: map.world.width, height: map.world.height, sha256: digest(masterBuffer), bytes: masterBuffer.length },
    tiling: { tileWidth: 1024, tileHeight: 1024, columns: 12, rows: 8, count: tiles.length },
    tiles,
    previews,
    assetPolicy: 'No new external assets were imported for this raster. Any later asset additions require per-asset provenance and license verification.',
    approval: 'Human visual approval pending.',
  };
  fs.writeFileSync(path.join(exportRoot, 'raster-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  process.stdout.write(`AUTHORED_CITY_RASTER: PASS (${masterName}, ${tiles.length} tiles, ${masterBuffer.length} bytes)\n`);
}

main();
