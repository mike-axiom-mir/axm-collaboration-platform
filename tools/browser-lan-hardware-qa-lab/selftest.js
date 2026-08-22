#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const ContractVerifier = require('../../hub/module-contract-verifier');
const OperationsApi = require('../../shared/operations/operations-api');
const QaLabService = require('../../shared/operations/qa-lab-service');

const root = __dirname;
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const contract = JSON.parse(fs.readFileSync(path.join(root, 'module.contract.json'), 'utf8'));
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const source = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

let assertions = 0;
function check(message, test) {
  test();
  assertions += 1;
}
const settle = () => new Promise(resolve => setImmediate(resolve));

async function main() {
  check('manifest identity and entry are explicit', () => {
    assert.equal(manifest.id, 'browser-lan-hardware-qa-lab');
    assert.equal(manifest.status, 'TEST');
    assert.equal(manifest.entry, 'index.html');
    assert.equal(manifest.contract, 'module.contract.json');
  });
  check('contract validates against the manifest', () => {
    assert.deepEqual(ContractVerifier.validateContract(contract, manifest), { pass: true, errors: [] });
  });
  check('manifest and contract identity, version, permission, and handoffs align', () => {
    assert.equal(contract.id, manifest.id);
    assert.equal(contract.version, manifest.version);
    assert.deepEqual(contract.permissions, manifest.permissions);
    assert.deepEqual(contract.handoffs.accepts, manifest.accepts);
    assert.deepEqual(contract.handoffs.emits, manifest.produces);
    assert.deepEqual(manifest.accepts, ['axm.qa-evidence-request/v1']);
    assert.deepEqual(manifest.produces, ['axm.qa-journey-receipt/v1', 'axm.device-qa-evidence/v1']);
  });
  check('contract keeps the safety refusals explicit', () => {
    for (const refusal of ['arbitrary-url-testing', 'silent-hardware-access', 'whole-network-scan', 'unbounded-load-test', 'self-attested-physical-proof', 'manifest-warning-mutation']) {
      assert(contract.boundaries.refuses.includes(refusal), `missing refusal: ${refusal}`);
    }
  });
  check('browser surface contains the declared controls and local scripts', () => {
    for (const id of ['notice', 'profile', 'run', 'capture', 'game', 'phone-present', 'controller-joined', 'seat-matched', 'action-observed', 'disconnect-observed', 'recovery-observed', 'observation-notes', 'capture-phone', 'queue', 'refresh', 'facts', 'out']) {
      assert(html.includes(`id="${id}"`), `missing browser control: ${id}`);
    }
    assert(html.includes('../../shared/operations/operations-client.js'));
    assert(html.includes('href="style.css"'));
    assert(html.includes('src="app.js"'));
    assert(!/https?:\/\//i.test(html), 'tool surface must not load a remote resource');
  });
  check('client source is valid JavaScript', () => new vm.Script(source, { filename: 'app.js' }));
  check('client source uses only the fixed QA and loopback health routes', () => {
    const routes = Array.from(source.matchAll(/(?:get|post|fetch)\('([^']+)'/g), match => match[1]);
    assert.deepEqual(Array.from(new Set(routes)).sort(), ['/api/health', '/api/qa-lab', '/api/qa-lab/evidence', '/api/qa-lab/run', '/exports/game-night-seam-report.json']);
    assert(!/https?:\/\//i.test(source), 'client must not contain an arbitrary remote URL');
  });

  const elementIds = ['notice', 'profile', 'run', 'capture', 'game', 'phone-present', 'controller-joined', 'seat-matched', 'action-observed', 'disconnect-observed', 'recovery-observed', 'observation-notes', 'capture-phone', 'queue', 'refresh', 'facts', 'out'];
  const elements = Object.fromEntries(
    elementIds.map(id => [id, {
      id,
      value: id === 'profile' ? 'hub-smoke' : '',
      checked: false,
      disabled: false,
      innerHTML: '',
      textContent: '',
      onclick: null,
      options: id === 'game' ? [{ value: '', textContent: 'Choose a pending game' }] : [],
      attributes: {},
      appendChild(child) { this.options.push(child); },
      setAttribute(name, value) { this.attributes[name] = String(value); }
    }])
  );
  const requests = [];
  const fetches = [];
  const notices = [];
  const latencyTicks = [1, 3, 10, 14, 20, 25, 30, 32, 40, 44, 50, 55];
  const state = {
    profiles: ['hub-smoke', 'operations-smoke'],
    journeys: [{ id: 'journey-1' }],
    deviceEvidence: [],
    phoneObservationCandidates: 0,
    arbitraryUrlTesting: 'refused',
    latestJourney: { id: 'journey-1', pass: true },
    latestDeviceEvidence: null,
    latestPhoneObservation: null
  };
  const AXMOps = {
    get(route) {
      requests.push({ method: 'GET', route });
      return Promise.resolve(state);
    },
    post(route, body, headers) {
      requests.push({ method: 'POST', route, body, headers });
      return Promise.resolve(route === '/api/qa-lab/run' ? { pass: true } : { ok: true });
    },
    pretty(value) { return JSON.stringify(value, null, 2); },
    notice(element, message, tone) { notices.push({ element: element.id, message, tone }); }
  };
  const context = vm.createContext({
    AXMOps,
    document: {
      getElementById(id) { return elements[id]; },
      createElement(tagName) { return { tagName, value: '', textContent: '' }; }
    },
    performance: { now() { return latencyTicks.shift(); } },
    fetch(route, options) {
      fetches.push({ route, options });
      if (route === '/exports/game-night-seam-report.json') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json() {
            return Promise.resolve({
              games: [
                { game: '008-district-party', slot: '008', warnings: ['physical phone qa is pending'] },
                { game: '010-living-globe-tycoon', slot: '010', warnings: [] }
              ]
            });
          }
        });
      }
      return Promise.resolve({ ok: true, status: 200 });
    },
    navigator: {
      userAgent: 'AXM Selftest Browser',
      getGamepads() {
        return [null, { index: 1, id: 'Fixture Pad', mapping: 'standard', axes: [0, 0], buttons: [{ pressed: false }] }];
      }
    },
    matchMedia(query) { return { matches: query.includes('reduced-motion') }; },
    innerWidth: 1280,
    innerHeight: 720,
    devicePixelRatio: 2,
    Date,
    Promise,
    Array,
    Math
  });

  new vm.Script(source, { filename: 'app.js' }).runInContext(context);
  await settle();
  await settle();

  check('initial load reads the bounded QA status route', () => {
    assert.deepEqual(requests[0], { method: 'GET', route: '/api/qa-lab' });
    assert(elements.facts.innerHTML.includes('2 profiles'));
    assert(elements.facts.innerHTML.includes('1 journeys'));
    assert(elements.facts.innerHTML.includes('1 phone gaps'));
    assert(elements.facts.innerHTML.includes('arbitrary URL refused'));
    assert(elements.out.textContent.includes('journey-1'));
  });
  check('pending phone gaps come only from the fixed verifier report', () => {
    assert.equal(elements.game.options.length, 2);
    assert.equal(elements.game.options[1].value, '008-district-party');
    assert(elements.queue.textContent.includes('1 verifier-confirmed phone gap'));
  });
  check('all four explicit controls are wired', () => {
    assert.equal(typeof elements.run.onclick, 'function');
    assert.equal(typeof elements.capture.onclick, 'function');
    assert.equal(typeof elements['capture-phone'].onclick, 'function');
    assert.equal(typeof elements.refresh.onclick, 'function');
  });

  elements.run.onclick();
  await settle();
  await settle();
  const journey = requests.find(request => request.route === '/api/qa-lab/run');
  check('journey execution sends the selected fixed profile with explicit authority', () => {
    assert.deepEqual(journey, {
      method: 'POST',
      route: '/api/qa-lab/run',
      body: { profile: 'hub-smoke' },
      headers: { 'x-axm-qa': 'explicit-run' }
    });
    assert(notices.some(item => item.message === 'Journey passed.' && item.tone === 'ok'));
  });
  check('journey completion refreshes status', () => {
    assert(requests.filter(request => request.method === 'GET' && request.route === '/api/qa-lab').length >= 2);
  });

  await elements.capture.onclick();
  await settle();
  const evidence = requests.find(request => request.route === '/api/qa-lab/evidence');
  check('device capture performs exactly three loopback health samples', () => {
    const healthFetches = fetches.filter(item => item.route === '/api/health');
    assert.equal(healthFetches.length, 3);
    assert(healthFetches.every(item => item.options.cache === 'no-store'));
    assert.deepEqual(evidence.body.latencyMs, [2, 4, 5]);
  });
  check('device evidence records browser-exposed viewport and preference facts', () => {
    assert.deepEqual(evidence.body.viewport, { width: 1280, height: 720, devicePixelRatio: 2 });
    assert.equal(evidence.body.userAgent, 'AXM Selftest Browser');
    assert.equal(evidence.body.reducedMotion, true);
    assert.equal(evidence.body.highContrast, false);
    assert.equal(evidence.body.errors.length, 0);
    assert(evidence.body.sessionDurationMs >= 0);
  });
  check('gamepad evidence contains metadata but no silent control action', () => {
    assert.deepEqual(evidence.body.gamepads, [{ index: 1, id: 'Fixture Pad', mapping: 'standard', axes: 2, buttons: 1 }]);
  });
  check('device evidence uses its explicit bounded handoff header', () => {
    assert.equal(evidence.method, 'POST');
    assert.equal(evidence.headers['x-axm-qa'], 'device-evidence');
    assert(notices.some(item => item.message === 'Device evidence captured.' && item.tone === 'ok'));
  });

  elements.game.value = '008-district-party';
  for (const id of ['phone-present', 'controller-joined', 'seat-matched', 'action-observed', 'disconnect-observed', 'recovery-observed']) elements[id].checked = true;
  elements['observation-notes'].value = 'P2 joined by QR; shared-screen action and link recovery were visibly observed.';
  await elements['capture-phone'].onclick();
  await settle();
  const candidate = requests.filter(request => request.route === '/api/qa-lab/evidence').find(request => request.body.phoneObservation);
  check('phone capture binds all human declarations to one pending game', () => {
    assert.equal(candidate.body.phoneObservation.gameId, '008-district-party');
    assert.equal(candidate.body.phoneObservation.slot, '008');
    assert.equal(candidate.body.phoneObservation.physicalPhonePresent, true);
    assert.equal(candidate.body.phoneObservation.controllerJoined, true);
    assert.equal(candidate.body.phoneObservation.seatIdentityMatched, true);
    assert.equal(candidate.body.phoneObservation.actionObservedOnSharedScreen, true);
    assert.equal(candidate.body.phoneObservation.disconnectObserved, true);
    assert.equal(candidate.body.phoneObservation.recoveredAfterDisconnect, true);
    assert.equal(candidate.body.disconnectObserved, true);
    assert.equal(candidate.body.recoveredAfterDisconnect, true);
  });
  check('candidate capture keeps external review visible', () => {
    assert(notices.some(item => item.message.includes('External review is still required.') && item.tone === 'ok'));
  });

  const gameManifestFile = path.join(root, '..', 'game-hub', 'game-library', '008-district-party', 'game.manifest.json');
  const gameReportFile = path.join(root, '..', '..', 'exports', 'game-night-seam-report.json');
  const gameManifestBefore = fs.readFileSync(gameManifestFile);
  const tempStateRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-qa-phone-observation-'));
  try {
    const qa = QaLabService.create({ stateRoot: tempStateRoot });
    const receipt = qa.recordDeviceEvidence({
      viewport: { width: 390, height: 844, devicePixelRatio: 3 },
      latencyMs: [12, 18, 14],
      phoneObservation: candidate.body.phoneObservation
    });
    check('service seals a complete candidate without claiming physical proof', () => {
      assert.equal(receipt.phoneObservation.schema, 'axm.qa-phone-observation/v1');
      assert.equal(receipt.phoneObservation.gameId, '008-district-party');
      assert.equal(receipt.phoneObservation.complete, true);
      assert.equal(receipt.phoneObservation.reviewState, 'CANDIDATE_REQUIRES_HUMAN_REVIEW');
      assert.equal(receipt.truth.physicalHardwareProven, false);
      assert.equal(receipt.truth.manifestMutated, false);
      assert.equal(receipt.truth.externalReviewRequired, true);
      const receiptWithoutDigest = { ...receipt };
      delete receiptWithoutDigest.digest;
      assert.equal(receipt.digest, crypto.createHash('sha256').update(JSON.stringify(receiptWithoutDigest)).digest('hex'));
    });
    check('service exposes candidate count while refusing forged game identifiers', () => {
      assert.equal(qa.status().phoneObservationCandidates, 1);
      assert.throws(() => qa.recordDeviceEvidence({ viewport: { width: 390, height: 844 }, phoneObservation: { gameId: '../../008-district-party' } }), /bounded game id/);
      assert.throws(() => qa.recordDeviceEvidence({ viewport: { width: 390, height: 844 }, phoneObservation: { gameId: '008-district-party', slot: '007' } }), /slot must match/);
    });
    check('candidate capture leaves the game manifest and source warning unchanged', () => {
      assert(gameManifestBefore.equals(fs.readFileSync(gameManifestFile)));
      const report = JSON.parse(fs.readFileSync(gameReportFile, 'utf8'));
      const game = report.games.find(item => item.game === '008-district-party');
      assert(game && game.warnings.includes('physical phone qa is pending'));
    });
  } finally {
    fs.rmSync(tempStateRoot, { recursive: true, force: true });
  }

  const tempApiRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-qa-authority-'));
  let operationsApi = null;
  try {
    const stateRoot = path.join(tempApiRoot, 'state');
    const exportRoot = path.join(tempApiRoot, 'exports');
    const logRoot = path.join(tempApiRoot, 'logs');
    for (const directory of [stateRoot, exportRoot, logRoot]) fs.mkdirSync(directory, { recursive: true });
    operationsApi = OperationsApi.create({
      root: path.join(root, '..', '..'),
      stateRoot,
      exportRoot,
      logRoot,
      isProductionSession: false,
      port: 9999,
      getPort: () => 9999,
      readJsonBody(request, _maxBytes, callback) { callback(null, request.payload || {}); },
      send(response, status, payload) { response.resolve({ status, payload }); }
    });
    const callEvidenceApi = payload => new Promise((resolve, reject) => {
      const request = { method: 'POST', url: '/api/qa-lab/evidence', headers: { 'x-axm-qa': 'device-evidence' }, payload };
      const response = { resolve };
      if (!operationsApi.handle(request, response, { url: request.url, rawUrl: request.url })) reject(new Error('QA evidence route was not handled'));
    });
    const denied = await callEvidenceApi({ viewport: { width: 390, height: 844 } });
    check('default-deny permission blocks evidence before QA state mutation', () => {
      assert(denied.status >= 400);
      assert.equal(denied.payload.ok, false);
      assert.match(denied.payload.error, /explicit qa\.run grant/);
      assert.equal(fs.existsSync(operationsApi.services.qa.stateFile), false);
    });
    operationsApi.services.permissions.setGrant({
      moduleId: 'browser-lan-hardware-qa-lab',
      permission: 'qa.run',
      allowed: true,
      reason: 'bounded QA authority selftest',
      actor: 'selftest'
    });
    const allowed = await callEvidenceApi({ viewport: { width: 390, height: 844 } });
    check('explicit qa.run grant permits one bounded device evidence receipt', () => {
      assert.equal(allowed.status, 200);
      assert.equal(allowed.payload.ok, true);
      assert.equal(allowed.payload.result.schema, 'axm.device-qa-evidence/v1');
      assert.equal(fs.existsSync(operationsApi.services.qa.stateFile), true);
    });
  } finally {
    if (operationsApi) operationsApi.stop();
    fs.rmSync(tempApiRoot, { recursive: true, force: true });
  }

  const readsBeforeRefresh = requests.filter(request => request.method === 'GET').length;
  elements.refresh.onclick();
  await settle();
  check('manual refresh performs a read only', () => {
    assert.equal(requests.filter(request => request.method === 'GET').length, readsBeforeRefresh + 1);
  });

  console.log(`Browser, LAN & Hardware QA Lab selftest: PASS (${assertions} evidence groups)`);
}

main().catch(error => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
