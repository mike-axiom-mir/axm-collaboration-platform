'use strict';

const fs = require('node:fs');
const path = require('node:path');
let canvasApi;
try { canvasApi = require('@napi-rs/canvas'); }
catch {
  process.stdout.write('CITY_ART_PREVIEWS: UNRUN\nReason: optional @napi-rs/canvas build dependency is unavailable; gameplay does not require it.\n');
  process.exit(0);
}
const { Canvas, createCanvas, loadImage } = canvasApi;

global.OffscreenCanvas = Canvas;

const root = path.join(__dirname, '..');
const outputDirectory = path.join(root, 'docs', 'previews');
const readJson = (relative) => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));

function rendererClass() {
  const source = fs.readFileSync(path.join(root, 'client/game/rendering/entity-renderer.js'), 'utf8')
    .replace('export class EntityRenderer', 'class EntityRenderer');
  return Function(`${source}\nreturn EntityRenderer;`)();
}

async function assets() {
  const files = {
    player1: 'assets/selected/characters/player_01_urban.png',
    player2: 'assets/selected/characters/player_02_urban.png',
    player3: 'assets/selected/characters/player_03_urban.png',
    player4: 'assets/selected/characters/player_04_urban.png',
    modernPlayer1: 'assets/selected/characters/axm_generated/player_01_axm.png',
    modernPlayer2: 'assets/selected/characters/axm_generated/player_02_axm.png',
    modernPlayer3: 'assets/selected/characters/axm_generated/player_03_axm.png',
    modernPlayer4: 'assets/selected/characters/axm_generated/player_04_axm.png',
    resident1: 'assets/selected/characters/axm_generated/resident_old_man.png',
    resident2: 'assets/selected/characters/axm_generated/resident_man_backpack.png',
    resident3: 'assets/selected/characters/axm_generated/resident_woman_backpack-v2.png',
    resident4: 'assets/selected/characters/axm_generated/resident_woman_tote.png',
    vehicleTeal: 'assets/selected/vehicles/urban_car_green_wide_a.png',
    vehicleAmber: 'assets/selected/vehicles/urban_car_yellow_wide_a.png',
    sportRed: 'assets/selected/vehicles/axm_generated/sport_red.png',
    sedanSilver: 'assets/selected/vehicles/axm_generated/sedan_silver.png',
    shopkeeperNeutral: 'assets/selected/shopkeepers/axm_generated/shopkeeper_neutral.png',
    shopkeeperAxm: 'assets/selected/shopkeepers/axm_generated/shopkeeper_axm.png',
    buildingCafe: 'assets/selected/buildings/axm_generated/corner_cafe.png',
    buildingCornerShop: 'assets/selected/buildings/axm_generated/corner_shop_house.png',
    buildingApartment: 'assets/selected/buildings/axm_generated/apartment_blue_doors.png',
    buildingRow: 'assets/selected/buildings/axm_generated/row_houses.png',
    package: 'assets/selected/props/package_box.png',
    packageDuffel: 'assets/selected/interactables/axm_generated/parcel_duffel_black.png',
    packageBriefcase: 'assets/selected/interactables/axm_generated/parcel_briefcase_black.png',
    packageBox: 'assets/selected/interactables/axm_generated/parcel_box_taped.png',
    packageCrateWood: 'assets/selected/interactables/axm_generated/parcel_crate_wood.png',
    packageCratePlastic: 'assets/selected/interactables/axm_generated/parcel_crate_plastic.png',
    propSafe: 'assets/selected/interactables/axm_generated/safe_floor_black.png',
    propVending: 'assets/selected/interactables/axm_generated/vending_red.png',
    propAtm: 'assets/selected/interactables/axm_generated/atm_black.png',
    propBarrel: 'assets/selected/interactables/axm_generated/barrel_rust.png',
    propPallet: 'assets/selected/interactables/axm_generated/pallet_wood.png',
    propDumpster: 'assets/selected/interactables/axm_generated/dumpster_green.png',
    propBench: 'assets/selected/interactables/axm_generated/bench_wood.png',
    propBollard: 'assets/selected/interactables/axm_generated/bollard_black.png',
    propTrashCan: 'assets/selected/interactables/axm_generated/trash_can_green.png',
    tree: 'assets/selected/props/tree_green_small.png',
  };
  return Object.fromEntries(await Promise.all(Object.entries(files).map(async ([key, file]) => [key, await loadImage(path.join(root, file))])));
}

function intersecting(entry, bounds) {
  return entry.x < bounds.right && entry.x + entry.width > bounds.left && entry.y < bounds.bottom && entry.y + entry.height > bounds.top;
}

function labelPreview(ctx, width, title, subtitle) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const gradient = ctx.createLinearGradient(0, 0, 0, 92); gradient.addColorStop(0, '#06100df5'); gradient.addColorStop(1, '#06100d20');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, 92);
  ctx.fillStyle = '#59e0b8'; ctx.font = '900 16px system-ui'; ctx.textAlign = 'left'; ctx.fillText(title, 24, 32);
  ctx.fillStyle = '#e6f3ee'; ctx.font = '700 11px system-ui'; ctx.fillText(subtitle, 24, 53);
  ctx.fillStyle = '#ffcd70'; ctx.font = '800 9px system-ui'; ctx.fillText('GENERATED FROM THE ACTUAL LOCAL CANVAS RENDERER', 24, 72);
}

async function writePreview(file, buffer) {
  const target = path.join(outputDirectory, file);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try { fs.writeFileSync(target, buffer); return; }
    catch (error) {
      if (!['UNKNOWN', 'EBUSY', 'EPERM'].includes(error?.code) || attempt === 7) throw error;
      await new Promise((resolve) => setTimeout(resolve, 75 * (attempt + 1)));
    }
  }
}

async function renderView({ file, width, height, centre, zoom, title, subtitle, actors = [], vehicles = [], npcs = [], mission = null, cityLife = null }, renderer, map, cityArt) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#06100d'; ctx.fillRect(0, 0, width, height);
  const worldWidth = width / zoom, worldHeight = height / zoom;
  const bounds = { left: centre.x - worldWidth / 2, right: centre.x + worldWidth / 2, top: centre.y - worldHeight / 2, bottom: centre.y + worldHeight / 2 };
  ctx.save(); ctx.translate(width / 2, height / 2); ctx.scale(zoom, zoom); ctx.translate(-centre.x, -centre.y);
  renderer.drawMapBackground(ctx, map);
  for (const entry of map.chunking.chunks.filter((candidate) => intersecting(candidate, bounds))) {
    const chunk = readJson(entry.path.replace(/^\//, ''));
    renderer.drawMapChunk(ctx, chunk, map.palette, false);
    delete chunk.__axmSurface;
  }
  renderer.drawGameplayMapLayers(ctx, map, false, false);
  renderer.drawCityArt(ctx, cityArt);
  if (cityLife) renderer.drawCityAtmosphere(ctx, map, cityLife, cityArt);
  if (mission) renderer.drawPackages(ctx, mission);
  if (cityLife) renderer.drawCityLife(ctx, cityLife, actors);
  renderer.drawVehicles(ctx, vehicles);
  renderer.drawNpcs(ctx, npcs);
  renderer.drawPlayers(ctx, actors);
  ctx.restore();
  labelPreview(ctx, width, title, subtitle);
  await writePreview(file, canvas.toBuffer('image/png'));
}

async function main() {
  fs.mkdirSync(outputDirectory, { recursive: true });
  const map = readJson('data/map.json');
  const cityArt = readJson('data/city-art.json');
  if (cityArt.palette) map.palette = { ...map.palette, ...cityArt.palette };
  const EntityRenderer = rendererClass();
  const renderer = new EntityRenderer(); renderer.setAssets(await assets()); renderer.setCityArt(cityArt); renderer.setPresentationClock(() => 0);
  await renderView({
    file: 'tilburg-city-overview.png', width: 1800, height: 1200, centre: { x: 6144, y: 4096 }, zoom: 1800 / 12288,
    title: 'AXM DISTRICT PARTY · TILBURG STREETSCAPE FOUNDATION', subtitle: 'Complete 12,288 × 8,192 world · 96 chunk overview · v0.3.0',
  }, renderer, map, cityArt);
  await renderView({
    file: 'tilburg-centre-art-pass.png', width: 1440, height: 900, centre: { x: 6264, y: 4024 }, zoom: .95,
    title: 'CITY CENTRE STREETSCAPE', subtitle: 'Source-aligned roads · connected roofs · central plaza · district wayfinding',
    actors: [
      { slot: 1, partyId: 'party_a', displayName: 'P1', alive: true, position: { x: 6180, y: 4080 }, facing: { x: 1, y: 0 }, velocity: { x: 0, y: 0 } },
      { slot: 2, partyId: 'party_a', displayName: 'P2', alive: true, position: { x: 6250, y: 4120 }, facing: { x: 0, y: -1 }, velocity: { x: 0, y: 0 } },
      { slot: 3, partyId: 'party_a', displayName: 'P3', alive: true, position: { x: 6320, y: 4085 }, facing: { x: -1, y: 0 }, velocity: { x: 0, y: 0 } },
      { slot: 4, partyId: 'party_a', displayName: 'P4', alive: true, position: { x: 6280, y: 4170 }, facing: { x: 0, y: 1 }, velocity: { x: 0, y: 0 } }
    ],
    npcs: [
      { id: 'preview-resident-1', health: 38, maxHealth: 38, alive: true, position: { x: 6115, y: 4140 }, facing: { x: 1, y: 0 }, velocity: { x: 0, y: 0 } },
      { id: 'preview-resident-2', health: 45, maxHealth: 45, alive: true, position: { x: 6375, y: 4140 }, facing: { x: -1, y: 0 }, velocity: { x: 0, y: 0 } },
      { id: 'preview-resident-3', health: 26, maxHealth: 26, alive: true, position: { x: 6150, y: 4210 }, facing: { x: 0, y: -1 }, velocity: { x: 0, y: 0 } },
      { id: 'preview-resident-4', health: 31, maxHealth: 31, alive: true, position: { x: 6390, y: 4210 }, facing: { x: 0, y: 1 }, velocity: { x: 0, y: 0 } }
    ]
  }, renderer, map, cityArt);
  const adventureActors = [
    { slot: 1, partyId: 'party_a', displayName: 'P1', alive: true, position: { x: 6180, y: 4320 }, facing: { x: 1, y: 0 }, velocity: { x: 0, y: 0 } },
    { slot: 2, partyId: 'party_a', displayName: 'P2', alive: true, position: { x: 6230, y: 4350 }, facing: { x: 1, y: 0 }, velocity: { x: 0, y: 0 } },
  ];
  await renderView({
    file: 'city-visual-adventure-v0.8.0.png', width: 1440, height: 900, centre: { x: 6700, y: 4300 }, zoom: 1.05,
    title: 'CITY VISUAL ADVENTURE', subtitle: 'Layered facades - animated storefronts - evening lights - activity breadcrumbs',
    actors: adventureActors,
    cityLife: {
      enabled: true,
      clock: { hour: 18 },
      venues: [
        { id: 'garage', kind: 'garage', label: 'PARTY CREW GARAGE', position: { x: 6045, y: 4680 }, accent: '#59e0b8' },
        { id: 'armory', kind: 'armory', label: 'IRON LANTERN ARMORY', position: { x: 6240, y: 4190 }, accent: '#ffbd62' },
        { id: 'casino', kind: 'casino', label: 'NEON CROWN CASINO', position: { x: 6600, y: 4190 }, accent: '#db86ff' },
        { id: 'jobs', kind: 'jobs', label: 'METRO DISPATCH', position: { x: 7040, y: 4680 }, accent: '#75efff' },
        { id: 'shop', kind: 'chop-shop', label: 'UNDERCROFT CHOP SHOP', position: { x: 7460, y: 4680 }, accent: '#ff766f' },
      ],
      activity: { id: 'cache', label: 'CENTRE STREET CACHE', position: { x: 6500, y: 4470 }, available: true },
      contracts: {},
    },
  }, renderer, map, cityArt);
  await renderView({
    file: 'open-venue-shells.png', width: 1440, height: 900, centre: { x: 6600, y: 4520 }, zoom: .9,
    title: 'OPEN VENUE SHELLS', subtitle: 'Small unit · large future hall · physical doors · empty floor contract',
    actors: [
      { slot: 1, partyId: 'party_a', displayName: 'P1', alive: true, position: { x: 6064, y: 4392 }, facing: { x: 0, y: -1 }, velocity: { x: 0, y: 0 } },
      { slot: 2, partyId: 'party_a', displayName: 'P2', alive: true, position: { x: 6912, y: 4460 }, facing: { x: 0, y: 1 }, velocity: { x: 0, y: 0 } },
      { slot: 3, partyId: 'party_a', displayName: 'P3', alive: true, position: { x: 6740, y: 4660 }, facing: { x: 1, y: 0 }, velocity: { x: 0, y: 0 } },
      { slot: 4, partyId: 'party_a', displayName: 'P4', alive: true, position: { x: 7080, y: 4660 }, facing: { x: -1, y: 0 }, velocity: { x: 0, y: 0 } }
    ]
  }, renderer, map, cityArt);
  await renderView({
    file: 'party-house-art-pass.png', width: 1440, height: 900, centre: { x: 6740, y: 6210 }, zoom: 1.25,
    title: 'PARTY HOUSE DISTRICT', subtitle: 'Walkable base · courtyard · mission board · local city dressing',
    actors: [
      { slot: 1, partyId: 'party_a', displayName: 'P1', alive: true, position: { x: 6590, y: 6215 }, facing: { x: 0, y: 1 }, velocity: { x: 0, y: 0 } },
      { slot: 2, partyId: 'party_a', displayName: 'P2', alive: true, position: { x: 6700, y: 6215 }, facing: { x: 0, y: 1 }, velocity: { x: 0, y: 0 } },
      { slot: 3, partyId: 'party_a', displayName: 'P3', alive: true, position: { x: 6810, y: 6215 }, facing: { x: 0, y: 1 }, velocity: { x: 0, y: 0 } },
      { slot: 4, partyId: 'party_a', displayName: 'P4', alive: true, position: { x: 6920, y: 6215 }, facing: { x: 0, y: 1 }, velocity: { x: 0, y: 0 } }
    ],
    vehicles: [
      { id: 'preview-car-a', kind: 'district-runner', position: { x: 6380, y: 6535 }, rotation: 0, health: 50, maxHealth: 50, style: 'teal', passengerActorIds: [] },
      { id: 'preview-car-b', kind: 'courier-van', position: { x: 6500, y: 6535 }, rotation: 0, health: 50, maxHealth: 50, style: 'amber', passengerActorIds: [] }
    ]
  }, renderer, map, cityArt);
  await renderView({
    file: 'courier-interactable-art-pass.png', width: 1200, height: 760, centre: { x: 6296, y: 5544 }, zoom: 1.6,
    title: 'COURIER YARD · CURATED INTERACTABLE ART', subtitle: 'Stable package variants · local alpha PNGs · visual-only yard dressing',
    actors: [
      { slot: 1, partyId: 'party_a', displayName: 'P1', alive: true, carryingPackageId: 'package-05', position: { x: 6296, y: 5618 }, facing: { x: 0, y: -1 }, velocity: { x: 0, y: 0 } },
    ],
    mission: {
      packages: [
        { id: 'package-01', kind: 'courier', position: { x: 6240, y: 5532 } },
        { id: 'package-02', kind: 'courier', position: { x: 6270, y: 5532 } },
        { id: 'package-03', kind: 'courier', position: { x: 6300, y: 5532 } },
        { id: 'package-04', kind: 'courier', position: { x: 6330, y: 5532 } },
        { id: 'package-05', kind: 'courier', position: { x: 6360, y: 5532 }, carrierActorId: 'actor-seat-1' }
      ]
    }
  }, renderer, map, cityArt);
  for (const view of [
    { file: 'user-landmark-reeshof.png', centre: { x: 2388, y: 4452 }, title: 'REESHOF CORNER CAFE', subtitle: 'User-supplied art · existing host collision · open approach' },
    { file: 'user-landmark-north-ring.png', centre: { x: 6772, y: 1716 }, title: 'NORTH RING SHOP HOUSE', subtitle: 'User-supplied art · existing host collision · open approach' },
    { file: 'user-landmark-east-ring.png', centre: { x: 9252, y: 5028 }, title: 'MOERENBURG APARTMENTS', subtitle: 'User-supplied art · existing host collision · open approach' },
    { file: 'user-landmark-south-gate.png', centre: { x: 8420, y: 7204 }, title: 'SOUTH GATE ROW HOUSES', subtitle: 'User-supplied art · existing host collision · open approach' },
  ]) await renderView({ ...view, width: 960, height: 640, zoom: 1.5 }, renderer, map, cityArt);
  process.stdout.write('CITY_ART_PREVIEWS: PASS (10 PNG files)\n');
}

main().catch((error) => { console.error('CITY_ART_PREVIEWS: FAIL'); console.error(error.stack || error.message); process.exitCode = 1; });
