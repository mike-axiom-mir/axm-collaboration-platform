'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'game.manifest.json'), 'utf8'));

test('manifest required paths exist and remain inside the package', () => {
  for (const relative of manifest.package.required_paths) {
    const absolute = path.resolve(root, relative);
    assert.ok(absolute.startsWith(root + path.sep), `path escaped: ${relative}`);
    assert.ok(fs.existsSync(absolute), `missing required path: ${relative}`);
  }
});

test('all runtime JavaScript files pass the parser', () => {
  for (const filename of fs.readdirSync(path.join(root, 'runtime')).filter(file => /\.(?:c?js)$/.test(file))) {
    const result = childProcess.spawnSync(process.execPath, ['--check', path.join(root, 'runtime', filename)], { encoding:'utf8' });
    assert.equal(result.status, 0, `${filename}: ${result.stderr}`);
  }
});

test('package exposes visible controls, save, receipts, and blocking-overlay escape', () => {
  const html = fs.readFileSync(path.join(root, 'runtime/index.html'), 'utf8');
  const app = fs.readFileSync(path.join(root, 'runtime/app.js'), 'utf8');
  assert.match(html, /BEGIN WITH NOTHING/);
  assert.match(html, /FIXED ODDS · NO ADAPTIVE LUCK/);
  assert.match(html, /id="panelCloseButton"/);
  assert.match(html, /name="viewport"/);
  assert.match(html, /aria-label="Open Business"/);
  assert.match(app, /localStorage/);
  assert.match(app, /event\.key === 'Escape'/);
  assert.match(app, /data-export-save/);
  assert.match(app, /Inspect the honest probability receipt|probability receipt/i);
});

test('runtime is local-only and declares no remote asset URLs', () => {
  const sources = ['index.html','styles.css','app.js','renderer.js','audio.js'].map(file => fs.readFileSync(path.join(root,'runtime',file),'utf8')).join('\n');
  assert.doesNotMatch(sources, /https?:\/\//i);
  assert.equal(manifest.launch.local_only_default, true);
  assert.equal(manifest.rules.runtime_internet_required, false);
});

test('million-to-one destination is wired through visible controls and transparent contracts', () => {
  const html = fs.readFileSync(path.join(root, 'runtime/index.html'), 'utf8');
  const app = fs.readFileSync(path.join(root, 'runtime/app.js'), 'utf8');
  const systems = fs.readFileSync(path.join(root, 'runtime/systems.js'), 'utf8');
  const data = fs.readFileSync(path.join(root, 'runtime/game-data.js'), 'utf8');
  assert.match(html, /data-travel="starspite"/);
  assert.match(app, /data-redeem-ticket/);
  assert.match(app, /HOUSE EDGE/);
  assert.match(systems, /insuranceChangesOutcome:false/);
  assert.match(systems, /small-odds\.authored-lot\/v1/);
  assert.match(data, /Truth Coin/);
});

test('loss aftermath stays visible, receipt-gated, exactly accounted, and outside RNG', () => {
  const app = fs.readFileSync(path.join(root, 'runtime/app.js'), 'utf8');
  const systems = fs.readFileSync(path.join(root, 'runtime/systems.js'), 'utf8');
  const data = fs.readFileSync(path.join(root, 'runtime/game-data.js'), 'utf8');
  assert.match(app,/STARSPITE DEBT AFTERMATH/);
  assert.match(app,/data-debt-aftermath-route/);
  assert.match(app,/storefront service income/i);
  assert.match(systems,/replayValidCasinoLoss/);
  assert.match(systems,/small-odds\.debt-aftermath-start\/v1/);
  assert.match(systems,/small-odds\.debt-aftermath-return\/v1/);
  assert.match(systems,/storefrontDailyIncomeExcluded:true/);
  assert.match(systems,/casinoOddsChanged:false/);
  assert.match(data,/STARSPITE_DEBT_ROUTES/);
});

test('life situations are visibly non-quest, object-reactive, delayed, and unattended-capable', () => {
  const app = fs.readFileSync(path.join(root, 'runtime/app.js'), 'utf8');
  const systems = fs.readFileSync(path.join(root, 'runtime/systems.js'), 'utf8');
  const data = fs.readFileSync(path.join(root, 'runtime/game-data.js'), 'utf8');
  assert.match(app, /NOT A QUEST/);
  assert.match(app, /data-life-choice/);
  assert.match(app, /No acceptance button\. No checklist\. No XP\./);
  assert.match(systems, /small-odds\.life-choice\/v1/);
  assert.match(systems, /continuing without Pip/);
  assert.match(data, /Five smaller machine-shells are following Shellby/);
  assert.match(data, /itemTags/);
  assert.doesNotMatch(app, /â—Œ|â€¦|LIFE â†—|NOT A QUEST Â· A LIFE IN MOTION/);
});

test('alien-web storefront exposes escrow, counter ceilings, pet shifts, callbacks, and non-random receipts', () => {
  const app = fs.readFileSync(path.join(root, 'runtime/app.js'), 'utf8');
  const systems = fs.readFileSync(path.join(root, 'runtime/systems.js'), 'utf8');
  const renderer = fs.readFileSync(path.join(root, 'runtime/renderer.js'), 'utf8');
  assert.match(app, /LIST ON ALIEN WEB/);
  assert.match(app, /DISCLOSED CEILING/);
  assert.match(app, /Pet shipping shift/);
  assert.match(app, /Buyer messages still travelling/);
  assert.match(systems, /small-odds\.storefront-offer\/v1/);
  assert.match(systems, /small-odds\.storefront-counter\/v1/);
  assert.match(systems, /small-odds\.business-callback\/v1/);
  assert.match(systems, /moneyIgnored:true/);
  assert.match(renderer, /PIP:\/\/LOCAL-WEB/);
});

test('living district exposes schedules, item-state reactions, deliveries, and parent echoes', () => {
  const html = fs.readFileSync(path.join(root, 'runtime/index.html'), 'utf8');
  const app = fs.readFileSync(path.join(root, 'runtime/app.js'), 'utf8');
  const systems = fs.readFileSync(path.join(root, 'runtime/systems.js'), 'utf8');
  const renderer = fs.readFileSync(path.join(root, 'runtime/renderer.js'), 'utf8');
  assert.match(html, /data-travel="district"/);
  assert.match(html, /Lopsided Lane neighborhood/);
  assert.match(app, /SCHEDULED, RELATED, NOT RANDOM/);
  assert.match(app, /data-district-talk/);
  assert.match(systems, /small-odds\.district-observation\/v1/);
  assert.match(systems, /small-odds\.district-gift\/v1/);
  assert.match(systems, /small-odds\.district-delivery\/v1/);
  assert.match(systems, /portalOddsChanged:false/);
  assert.match(renderer, /drawDistrict\(/);
  assert.match(renderer, /parcel-periscope/);
});

test('neighborhood dependency web exposes repeatable arcs, supplier effects, and relationship routes', () => {
  const app = fs.readFileSync(path.join(root, 'runtime/app.js'), 'utf8');
  const systems = fs.readFileSync(path.join(root, 'runtime/systems.js'), 'utf8');
  const data = fs.readFileSync(path.join(root, 'runtime/game-data.js'), 'utf8');
  const renderer = fs.readFileSync(path.join(root, 'runtime/renderer.js'), 'utf8');
  assert.match(app, /PERSISTENT SUPPLIER HOUSEHOLD/);
  assert.match(app, /data-district-arc-resident/);
  assert.match(app, /NEIGHBOR ROUTE · RELATIONSHIP UNLOCK/);
  assert.match(systems, /small-odds\.district-arc-choice\/v1/);
  assert.match(systems, /small-odds\.district-arc-return\/v1/);
  assert.match(systems, /neighborhood supplier/);
  assert.match(data, /Crooked Kettle Cooperative/);
  assert.match(data, /neighborChoice/);
  assert.match(renderer, /DISTRICT_SUPPLIER/);
  assert.match(renderer, /kettle-crate/);
});

test('paid production exposes public work rotation, literal pet labor, pressure, and non-random returns', () => {
  const app = fs.readFileSync(path.join(root, 'runtime/app.js'), 'utf8');
  const systems = fs.readFileSync(path.join(root, 'runtime/systems.js'), 'utf8');
  const data = fs.readFileSync(path.join(root, 'runtime/game-data.js'), 'utf8');
  const renderer = fs.readFileSync(path.join(root, 'runtime/renderer.js'), 'utf8');
  assert.match(app, /PAID NEIGHBORHOOD PRODUCTION/);
  assert.match(app, /data-work-start/);
  assert.match(app, /receipt\.wage \?\? receipt\.arithmetic\?\.wage/);
  assert.match(app, /EMPLOYMENT ROUTE · WORK STANDING UNLOCK/);
  assert.match(systems, /small-odds\.work-order-start\/v1/);
  assert.match(systems, /small-odds\.work-order-return\/v1/);
  assert.match(systems, /literal pet labor points/);
  assert.match(data, /The Long Table Works/);
  assert.match(data, /workChoice/);
  assert.match(renderer, /workbench-stamp/);
  assert.match(renderer, /workPressureBand/);
});

test('Hushglass commons exposes a second household, routed heat hearing, and exact non-random return', () => {
  const app = fs.readFileSync(path.join(root, 'runtime/app.js'), 'utf8');
  const systems = fs.readFileSync(path.join(root, 'runtime/systems.js'), 'utf8');
  const data = fs.readFileSync(path.join(root, 'runtime/game-data.js'), 'utf8');
  const renderer = fs.readFileSync(path.join(root, 'runtime/renderer.js'), 'utf8');
  assert.match(app, /SECOND PERSISTENT HOUSEHOLD/);
  assert.match(app, /PET ROUTE · LITERAL TRAIT UNLOCK/);
  assert.match(app, /HOUSEHOLD COMMONS CAUSALITY · NO RANDOM CLAIM/);
  assert.match(systems, /small-odds\.household-accord-return\/v1/);
  assert.match(systems, /householdPetProfile/);
  assert.match(systems, /household-state:/);
  assert.match(data, /Hushglass House has one night of heat and two contracts for it/);
  assert.match(data, /pet-audit-heat-share/);
  assert.match(renderer, /heat-share-mobile/);
  assert.match(renderer, /districtHouseholdBand/);
});

test('recurring Hushglass service exposes history-gated routes, a real work override, and exact receipts', () => {
  const app = fs.readFileSync(path.join(root, 'runtime/app.js'), 'utf8');
  const systems = fs.readFileSync(path.join(root, 'runtime/systems.js'), 'utf8');
  const data = fs.readFileSync(path.join(root, 'runtime/game-data.js'), 'utf8');
  const renderer = fs.readFileSync(path.join(root, 'runtime/renderer.js'), 'utf8');
  const styles = fs.readFileSync(path.join(root, 'runtime/styles.css'), 'utf8');
  assert.match(app, /RECURRING HEAT-LOOP SERVICE/);
  assert.match(app, /data-commons-maintenance-route/);
  assert.match(app, /HUSHGLASS \/ LONG TABLE CONFLICT ORDER/);
  assert.match(app, /RECURRING COMMONS CAUSALITY/);
  assert.match(systems, /small-odds\.commons-maintenance-start\/v1/);
  assert.match(systems, /small-odds\.commons-maintenance-return\/v1/);
  assert.match(systems, /small-odds\.commons-maintenance-overdue\/v1/);
  assert.match(systems, /ownershipRetained:true/);
  assert.match(systems, /previouslyParticipated/);
  assert.match(data, /hushglass-night-valve-jig/);
  assert.match(data, /returning-pet/);
  assert.match(renderer, /districtMaintenanceProfile/);
  assert.match(renderer, /shop-relay-window/);
  assert.match(app, /data-commons-governance-choice/);
  assert.match(app, /DETERMINISTIC FAULT/);
  assert.match(app, /CIVIC OWNERSHIP/);
  assert.match(systems, /small-odds\.commons-governance-choice\/v1/);
  assert.match(systems, /small-odds\.commons-maintenance-fault\/v1/);
  assert.match(systems, /selectionRule:'retained relay > returning named pet > Long Table route or pressure 2\+ > public date-fog fallback'/);
  assert.match(data, /communal-charter/);
  assert.match(data, /household-trust/);
  assert.match(data, /service-cooperative/);
  assert.match(data, /signature-drift/);
  assert.match(data, /relay-backfeed/);
  assert.match(data, /bid-hammer/);
  assert.match(renderer, /governanceModel/);
  assert.match(renderer, /common-valve-charter/);
  assert.match(styles, /governance-grid/);
  assert.match(styles, /maintenance-fault/);
});

test('AXM package verifier accepts the isolated game contract', () => {
  const verifier = require(path.resolve(root, '..', '..', 'game-package-verifier.js'));
  const report = verifier.verifyGameDir(root);
  assert.deepEqual(report.errors, []);
});
