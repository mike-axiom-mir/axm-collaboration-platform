#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ContractVerifier = require('../../hub/module-contract-verifier');

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
  });
  check('contract keeps the safety refusals explicit', () => {
    for (const refusal of ['arbitrary-url-testing', 'silent-hardware-access', 'whole-network-scan', 'unbounded-load-test']) {
      assert(contract.boundaries.refuses.includes(refusal), `missing refusal: ${refusal}`);
    }
  });
  check('browser surface contains the declared controls and local scripts', () => {
    for (const id of ['notice', 'profile', 'run', 'capture', 'refresh', 'facts', 'out']) {
      assert(html.includes(`id="${id}"`), `missing browser control: ${id}`);
    }
    assert(html.includes('../../shared/operations/operations-client.js'));
    assert(html.includes('src="app.js"'));
    assert(!/https?:\/\//i.test(html), 'tool surface must not load a remote resource');
  });
  check('client source is valid JavaScript', () => new vm.Script(source, { filename: 'app.js' }));
  check('client source uses only the fixed QA and loopback health routes', () => {
    const routes = Array.from(source.matchAll(/(?:get|post|fetch)\('([^']+)'/g), match => match[1]);
    assert.deepEqual(Array.from(new Set(routes)).sort(), ['/api/health', '/api/qa-lab', '/api/qa-lab/evidence', '/api/qa-lab/run']);
    assert(!/https?:\/\//i.test(source), 'client must not contain an arbitrary remote URL');
  });

  const elements = Object.fromEntries(
    ['notice', 'profile', 'run', 'capture', 'refresh', 'facts', 'out'].map(id => [id, {
      id,
      value: id === 'profile' ? 'hub-smoke' : '',
      innerHTML: '',
      textContent: '',
      onclick: null
    }])
  );
  const requests = [];
  const healthFetches = [];
  const notices = [];
  const latencyTicks = [1, 3, 10, 14, 20, 25];
  const state = {
    profiles: ['hub-smoke', 'operations-smoke'],
    journeys: [{ id: 'journey-1' }],
    deviceEvidence: [],
    arbitraryUrlTesting: 'refused',
    latestJourney: { id: 'journey-1', pass: true },
    latestDeviceEvidence: null
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
    document: { getElementById(id) { return elements[id]; } },
    performance: { now() { return latencyTicks.shift(); } },
    fetch(route, options) {
      healthFetches.push({ route, options });
      return Promise.resolve({ ok: true });
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

  check('initial load reads the bounded QA status route', () => {
    assert.deepEqual(requests[0], { method: 'GET', route: '/api/qa-lab' });
    assert(elements.facts.innerHTML.includes('2 profiles'));
    assert(elements.facts.innerHTML.includes('1 journeys'));
    assert(elements.facts.innerHTML.includes('arbitrary URL refused'));
    assert(elements.out.textContent.includes('journey-1'));
  });
  check('all three explicit controls are wired', () => {
    assert.equal(typeof elements.run.onclick, 'function');
    assert.equal(typeof elements.capture.onclick, 'function');
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
    assert.equal(healthFetches.length, 3);
    assert(healthFetches.every(item => item.route === '/api/health'));
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
