'use strict';

const fs = require('node:fs');
const { createDistrictPartyServer } = require('../server/server');

function unrun(reason) {
  console.log(`AUTOMATED_BROWSER_TEST: UNRUN\nReason: ${reason}`);
  process.exitCode = 0;
}

async function main() {
  let chromium;
  try {
    ({ chromium } = require('playwright'));
  } catch {
    unrun('The optional Playwright package is not available in this environment.');
    return;
  }
  const executable = chromium.executablePath();
  try { fs.accessSync(executable, fs.constants.X_OK); }
  catch { unrun(`Playwright is present but its Chromium executable is not installed at ${executable}. No large browser download was attempted.`); return; }

  const runtime = createDistrictPartyServer({ host: '127.0.0.1', port: 0, logger: { error() {} } });
  let browser;
  try {
    const address = await runtime.listen();
    const origin = `http://127.0.0.1:${address.port}`;
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const consoleErrors = [];
    const externalRequests = [];
    context.on('page', (page) => page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); }));
    context.on('request', (request) => { if (!request.url().startsWith(origin) && !request.url().startsWith('data:') && !request.url().startsWith('blob:')) externalRequests.push(request.url()); });

    const launcher = await context.newPage();
    await launcher.goto(`${origin}/`, { waitUntil: 'networkidle' });
    const groupSaves = await launcher.evaluate(() => fetch('/api/group-saves').then((response) => response.json()));
    if (groupSaves.slotCount !== 9 || groupSaves.slots?.length !== 9) throw new Error('Host did not expose nine local group save slots.');
    if (await launcher.locator('.seat-card').count() !== 8) throw new Error('Launcher did not reserve all eight seat cards.');
    if (await launcher.locator('#party-b-setup:not(.hidden)').count() !== 0) throw new Error('Party B should stay folded away in the co-op default.');
    await launcher.locator('#game-mode').selectOption('district_dominion');
    await launcher.locator('#party-b-setup:not(.hidden)').waitFor({ timeout: 2000 });
    if (await launcher.locator('.seat-enabled:checked').count() !== 2) throw new Error('District Dominion should default to one ready human per party.');
    if (await launcher.locator('#host-ai-fill').isChecked()) throw new Error('Host AI substitution must be OFF by default.');
    await launcher.locator('#start-session').click();
    await launcher.locator('#running-view:not(.hidden)').waitFor({ timeout: 5000 });
    if (await launcher.locator('.join-card').count() !== 2) throw new Error('Join board should render only the two ready actors.');
    await launcher.locator('#party-b-screen-card:not(.hidden)').waitFor({ timeout: 2000 });
    const health = await launcher.evaluate(() => fetch('/health').then((response) => response.json()));
    const detectedLan = Array.isArray(health.lanAddresses) && health.lanAddresses.length > 0;
    const qrImages = await launcher.locator('.join-card.human .qr img').count();
    if (detectedLan && qrImages !== 2) throw new Error('Private LAN was detected but two human QR images were not rendered.');
    if (!detectedLan && qrImages !== 0) throw new Error('No private LAN was detected, but the launcher claimed phone-ready QR images.');
    const qrLibraryWorks = await launcher.evaluate(() => { const qr = window.qrcode(0, 'M'); qr.addData('http://192.168.1.10:8795/controller.html?seat=seat_1'); qr.make(); return qr.getModuleCount() > 20; });
    if (!qrLibraryWorks) throw new Error('Local QR generator did not produce a matrix.');
    if (await launcher.locator('.join-card.ai').count() !== 0) throw new Error('Default match silently created Host AI substitutes.');

    const party = await context.newPage();
    await party.goto(`${origin}/party-screen.html?party=party_a`);
    const frameElement = party.locator('#game-frame:not(.hidden)');
    await frameElement.waitFor({ timeout: 5000 });
    const gameFrame = party.frames().find((frame) => frame.url().includes('/game/'));
    if (!gameFrame) throw new Error('Persistent receiver did not load the party game frame.');
    await gameFrame.locator('#city-canvas').waitFor({ state: 'visible', timeout: 5000 });
    const visualAssetProbe = await gameFrame.evaluate(async () => {
      const routes = [
        '/assets/selected/characters/axm_generated/player_01_axm.png',
        '/assets/selected/characters/axm_generated/resident_woman_backpack-v2.png',
        '/assets/selected/vehicles/axm_generated/sport_red.png',
        '/assets/selected/shopkeepers/axm_generated/shopkeeper_axm.png',
        '/assets/selected/buildings/axm_generated/corner_cafe.png',
        '/assets/selected/interactables/axm_generated/parcel_box_taped.png',
        '/assets/selected/interactables/axm_generated/vending_red.png',
        '/assets/selected/interactables/axm_generated/bench_wood.png',
      ];
      return Promise.all(routes.map(async (src) => {
        const image = new Image(); image.src = src; await image.decode();
        return { src, width: image.naturalWidth, height: image.naturalHeight };
      }));
    });
    if (visualAssetProbe.length !== 8 || visualAssetProbe.some((asset) => asset.width < 128 || asset.height < 128)) throw new Error('User-art runtime images did not decode locally.');
    if (await gameFrame.locator('#save-computer').count() !== 1 || await gameFrame.locator('#save-slot-grid').count() !== 1) throw new Error('Shared game screen is missing the group-save overlay contract.');
    const canvasSize = await gameFrame.locator('#city-canvas').evaluate((canvas) => ({ width: canvas.width, height: canvas.height }));
    if (canvasSize.width < 100 || canvasSize.height < 100) throw new Error('City canvas did not size itself.');
    const mapButton = gameFrame.locator('#map-toggle');
    await mapButton.waitFor({ state: 'visible', timeout: 2000 });
    await mapButton.click();
    if (await gameFrame.locator('body.map-open').count() !== 1) throw new Error('Full city map did not open from the visible screen button.');
    if (await mapButton.getAttribute('aria-expanded') !== 'true') throw new Error('Full-map accessibility state was not updated.');
    await gameFrame.locator('body').press('Escape');
    if (await gameFrame.locator('body.map-open').count() !== 0) throw new Error('Escape did not return the shared screen to its minimap.');
    await gameFrame.locator('#player-card-1 .player-card:not(.unassigned)').waitFor({ timeout: 5000 });
    if (await gameFrame.locator('#territory-zones .territory-chip').count() !== 13) throw new Error('Party A screen did not render thirteen district ownership chips.');
    if (await gameFrame.locator('.player-corner').count() !== 4) throw new Error('Shared screen does not define four player corners.');
    if (await gameFrame.locator('.player-corner > .player-card:not(.unassigned)').count() !== 1) throw new Error('Party A should render only its one ready status card.');
    const cornerHud = await gameFrame.evaluate(() => {
      const viewport = { width: window.innerWidth, height: window.innerHeight };
      const corners = [1, 2, 3, 4].map((quarter) => {
        const element = document.querySelector(`#player-card-${quarter}`);
        const bounds = element.getBoundingClientRect();
        return {
          quarter,
          left: bounds.left,
          top: bounds.top,
          right: viewport.width - bounds.right,
          bottom: viewport.height - bounds.bottom,
          hp: element.querySelector('.health-value')?.textContent,
          shield: element.querySelector('.shield-value')?.textContent,
          ammo: element.querySelector('.ammo-value')?.textContent,
          money: element.querySelector('.money-value')?.textContent,
        };
      });
      const mission = document.querySelector('#mission-hud').getBoundingClientRect();
      return { viewport, corners, missionCenter: mission.left + mission.width / 2 };
    });
    const [q1, q2, q3, q4] = cornerHud.corners;
    if (!(q1.left < q1.right && q1.top < q1.bottom)) throw new Error('P1 status card is not in the top-left corner.');
    if (!(q2.right < q2.left && q2.top < q2.bottom)) throw new Error('P2 status card is not in the top-right corner.');
    if (!(q3.left < q3.right && q3.bottom < q3.top)) throw new Error('P3 status card is not in the bottom-left corner.');
    if (!(q4.right < q4.left && q4.bottom < q4.top)) throw new Error('P4 status card is not in the bottom-right corner.');
    if (Math.abs(cornerHud.missionCenter - cornerHud.viewport.width / 2) > 2) throw new Error('Mission HUD is not centered.');
    if (!/^\d+\/100$/.test(q1.hp || '')) throw new Error('P1 HP was not shown on the shared screen.');
    if (!/^\d+\/1$/.test(q1.shield || '')) throw new Error('P1 shield was not shown on the shared screen.');
    if (q1.ammo !== '∞') throw new Error('P1 provisional total ammo was not shown as unlimited.');
    if (q1.money !== 'DC 100,00') throw new Error('P1 starting District Credits were not shown.');
    if (!/^DC \d{1,3}(?:\.\d{3})*,\d{2}$/.test(await gameFrame.locator('#party-fund').textContent())) throw new Error('Party A reinforcement fund was not shown.');

    const partyB = await context.newPage();
    await partyB.goto(`${origin}/party-screen.html?party=party_b`);
    await partyB.locator('#game-frame:not(.hidden)').waitFor({ timeout: 5000 });
    const gameFrameB = partyB.frames().find((frame) => frame.url().includes('/game/'));
    if (!gameFrameB) throw new Error('Party B receiver did not load its party game frame.');
    await gameFrameB.locator('#player-card-1 .player-card:not(.unassigned)').waitFor({ timeout: 5000 });
    const partyBLabels = await gameFrameB.locator('.player-number').allTextContents();
    if (partyBLabels.join(',') !== 'P5') throw new Error(`Party B ready corner was not P5 only: ${partyBLabels.join(',')}`);
    if (await gameFrameB.locator('#territory-zones .territory-chip').count() !== 13) throw new Error('Party B screen did not render territory state.');

    const firstControllerUrl = await launcher.locator('.join-card.human .url').first().evaluate((element) => element.dataset.localUrl);
    const controller = await context.newPage();
    await controller.goto(firstControllerUrl);
    await controller.locator('#connection.live').waitFor({ timeout: 5000 });
    for (const id of ['stick','aim-stick','action','attack','sprint','brake','shield','money','party-money','inventory-toggle','inventory-prev','inventory-next','inventory-activate']) if (await controller.locator(`#${id}`).count() !== 1) throw new Error(`Controller control missing: ${id}`);
    if (!/^DC \d{1,3}(?:\.\d{3})*,\d{2}$/.test(await controller.locator('#party-money').textContent())) throw new Error('Controller did not show its Party A reinforcement fund.');

    await launcher.locator('#restart-session').click();
    await launcher.locator('#session-status').filter({ hasText: 'Restarted' }).waitFor({ timeout: 3000 });
    await launcher.locator('#end-session').click();
    await party.locator('#waiting:not(.hidden)').waitFor({ timeout: 5000 });
    await partyB.locator('#waiting:not(.hidden)').waitFor({ timeout: 5000 });

    if (externalRequests.length) throw new Error(`External runtime request(s): ${externalRequests.join(', ')}`);
    if (consoleErrors.length) throw new Error(`Browser console error(s): ${consoleErrors.join(' | ')}`);
    console.log(JSON.stringify({ status: 'PASS', launcher: true, groupSaveSlots: 9, sparseOneVsOneDefault: true, phoneQrCards: qrImages, privateLanDetected: detectedLan, localQrGenerator: true, defaultHostAiCards: 0, partyAScreen: true, partyBScreen: true, canvas: true, userArtImagesDecoded: visualAssetProbe.length, minimapAndFullMap: true, groupSaveOverlayContract: true, partyRelativeFourCornerHud: true, territoryChips: 13, controller: true, restart: true, returnToWaiting: true, externalRequests: 0 }, null, 2));
  } finally {
    await browser?.close();
    await runtime.close();
  }
}

main().catch((error) => { console.error(`AUTOMATED_BROWSER_TEST: FAIL\n${error.stack || error.message}`); process.exitCode = 1; });
