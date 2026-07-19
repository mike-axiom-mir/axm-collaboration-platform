'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { placeGameplay } = require('./tilburg-gameplay-placement');

const root = path.join(__dirname, '..');
const read = (relative) => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
const write = (relative, value, compact = false) => fs.writeFileSync(path.join(root, relative), `${JSON.stringify(value, null, compact ? 0 : 2)}\n`);

function main() {
  const map = read('data/map.json');
  const territory = read('data/territory-zones.json');
  const missions = read('data/missions.json');
  const routes = read('data/npc-routes.json');
  const vehicles = read('data/vehicle-spawns.json');
  const chunks = new Map();
  for (const entry of map.chunking.chunks) {
    const relative = entry.path.replace(/^\//, '');
    const chunk = read(relative);
    chunks.set(`${chunk.column}:${chunk.row}`, chunk);
  }
  const placement = placeGameplay({
    chunks,
    layers: map.layers,
    territory,
    missions,
    routes,
    vehicles,
    world: { ...map.world, tileSize: map.tileSize },
    fixedClearings: [
      { id: 'party-house-clearing', x: 6380, y: 5960, w: 820, h: 560 },
      { id: 'courier-depot-clearing', x: 5760, y: 4970, w: 900, h: 620 },
      { id: 'command-a-clearing', x: 10720, y: 3690, w: 1000, h: 820 },
      { id: 'command-b-clearing', x: 560, y: 3690, w: 1000, h: 820 },
      { id: 'small-venue-clearing', x: 5840, y: 4176, w: 464, h: 400 },
      { id: 'large-venue-clearing', x: 6448, y: 4192, w: 976, h: 720 },
    ],
  });
  const chunkFiles = [];
  const runtimeRectangles = {};
  for (const chunk of chunks.values()) {
    const relative = `data/map-chunks/chunk-${String(chunk.column).padStart(2, '0')}-${String(chunk.row).padStart(2, '0')}.json`;
    write(relative, chunk, true);
    chunkFiles.push(path.join(root, relative));
    const entry = map.chunking.chunks.find((candidate) => candidate.column === chunk.column && candidate.row === chunk.row);
    entry.featureCount = Object.values(chunk.layers).reduce((sum, items) => sum + items.length, 0);
    for (const [layer, items] of Object.entries(chunk.layers)) runtimeRectangles[layer] = (runtimeRectangles[layer] || 0) + items.length;
  }
  map.statistics.gameplayPlacement = placement;
  map.statistics.runtimeRectangles = runtimeRectangles;
  write('data/map.json', map);
  write('data/territory-zones.json', territory);
  write('data/missions.json', missions);
  write('data/npc-routes.json', routes);
  write('data/vehicle-spawns.json', vehicles);
  const source = read('data/tilburg-source-index.json');
  source.transform.gameplayPlacement = placement;
  source.output.runtimeRectangles = runtimeRectangles;
  const hash = crypto.createHash('sha256');
  [path.join(root, 'data/map.json'), ...chunkFiles].forEach((file) => hash.update(fs.readFileSync(file)));
  source.output.sha256MapAndChunks = hash.digest('hex');
  write('data/tilburg-source-index.json', source);
  process.stdout.write(`[Tilburg map] gameplay placement complete: ${JSON.stringify(placement.snapped)}\n`);
}

if (require.main === module) main();
