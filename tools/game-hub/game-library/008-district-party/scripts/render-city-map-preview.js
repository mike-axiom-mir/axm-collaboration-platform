'use strict';

const fs = require('node:fs');
const path = require('node:path');
let canvasApi;
try { canvasApi = require('@napi-rs/canvas'); }
catch {
  process.stdout.write('CITY_MAP_PREVIEWS: UNRUN\nReason: optional @napi-rs/canvas build dependency is unavailable; gameplay does not require it.\n');
  process.exit(0);
}

const { createCanvas } = canvasApi;
const root = path.join(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const json = (relative) => JSON.parse(read(relative));
const cityMapSource = read('client/game/ui/city-map.js').replace(/^export /gm, '');
const { drawCityMap } = Function(`${cityMapSource}\nreturn { drawCityMap };`)();
const outputDirectory = path.join(root, 'docs', 'previews');

const map = json('data/map.json');
const cityArt = json('data/city-art.json');
if (cityArt.palette) map.palette = { ...map.palette, ...cityArt.palette };
const viewport = { width: 1440, height: 900, dpr: 1 };
const camera = {
  visibleBounds: () => ({ left: 5860, right: 6720, top: 3650, bottom: 4450 }),
};
const world = {
  actors: [
    { id: 'actor-seat-1', slot: 1, partyId: 'party_a', displayName: 'MIKE', alive: true, position: { x: 6264, y: 4024 } },
    { id: 'actor-seat-2', slot: 2, partyId: 'party_a', displayName: 'P2', alive: true, position: { x: 6064, y: 4392 } },
    { id: 'actor-seat-3', slot: 3, partyId: 'party_a', displayName: 'P3', alive: true, position: { x: 6912, y: 4460 } },
    { id: 'actor-seat-5', slot: 5, partyId: 'party_b', displayName: 'P5', alive: true, position: { x: 2056, y: 4184 } },
  ],
  vehicles: [
    { id: 'vehicle-centre', position: { x: 6410, y: 4160 } },
    { id: 'vehicle-west', position: { x: 4184, y: 4184 } },
  ],
  territory: {
    zones: (json('data/territory-zones.json').zones || []).map((zone, index) => ({
      ...zone,
      ownerPartyId: index % 3 === 0 ? 'party_a' : index % 3 === 1 ? 'party_b' : null,
      contested: index === 5,
    })),
  },
};

function backdrop(ctx) {
  const gradient = ctx.createLinearGradient(0, 0, viewport.width, viewport.height);
  gradient.addColorStop(0, '#142a24'); gradient.addColorStop(1, '#07110e');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, viewport.width, viewport.height);
  ctx.strokeStyle = '#59e0b810'; ctx.lineWidth = 1;
  for (let x = 0; x < viewport.width; x += 48) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, viewport.height); ctx.stroke(); }
  for (let y = 0; y < viewport.height; y += 48) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(viewport.width, y); ctx.stroke(); }
}

function savePreview(filename, mode) {
  const canvas = createCanvas(viewport.width, viewport.height);
  const ctx = canvas.getContext('2d');
  backdrop(ctx);
  drawCityMap(ctx, viewport, map, world, camera, 'party_a', mode, cityArt);
  fs.writeFileSync(path.join(outputDirectory, filename), canvas.toBuffer('image/png'));
}

fs.mkdirSync(outputDirectory, { recursive: true });
savePreview('city-minimap-ui.png', 'minimap');
savePreview('city-full-map-ui.png', 'full');
process.stdout.write('CITY_MAP_PREVIEWS: PASS (2 PNG files)\n');
