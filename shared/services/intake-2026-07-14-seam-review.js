#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Boundary = require('./static-boundary');
const Foundation = require('./axm-foundation-services');

const ROOT = path.resolve(__dirname, '..', '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const json = rel => JSON.parse(read(rel));
const exists = rel => fs.existsSync(path.join(ROOT, rel));
const sha256 = rel => crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, rel))).digest('hex');

const mirror = json('shared/mirror-core/AXM_INTEGRATION.json');
const globe = json('worlds/living-globe/world.manifest.json');
const globeMirror = json('worlds/living-globe/mirror-adapter.descriptor.json');
const museum = json('museum/catalog.json');
const controls = json('shared/controls/AXM_INTEGRATION.json');
const lux = json('tools/game-hub/game-library/007-casino/game.manifest.json');
const district = json('tools/game-hub/game-library/008-district-party/game.manifest.json');
const profileContract = json('shared/profile/profile-service.contract.json');
const server = read('server.js');
const globeHtml = read('worlds/living-globe/index.html');
const luxServer = read('tools/game-hub/game-library/007-casino/lux-5-prototype/runtime/server.js');
const profileCore = read('shared/profile/axm-profile-core.js');

const checks = [
  ['Mirror is explicit-start, loopback-only and port-isolated', () => mirror.runtime.start_mode === 'EXPLICIT_ONLY' && mirror.runtime.host === '127.0.0.1' && mirror.runtime.port === 8799],
  ['Mirror has no live Workshop or world apply authority', () => mirror.authority.live_workshop_apply === false && mirror.authority.live_world_apply === false && mirror.authority.proposal_first === true && mirror.authority.default_deny === true],
  ['Mirror is permanently visible as a foundation service', () => Foundation.definitions.some(item => item.id === 'mirror')],
  ['Mirror lifecycle requires explicit action headers', () => server.includes('x-axm-mirror-action') && server.includes('explicit-start') && server.includes('explicit-stop')],
  ['New managed ports do not collide', () => new Set([mirror.runtime.port, lux.launch.port, district.launch.port]).size === 3],
  ['Living Globe owns world state and games only attach rulesets', () => globe.ownership.state_owner === 'living-world' && globe.ownership.games_attach_as_rulesets === true && globe.ownership.games_may_reset_world === false && globe.ownership.games_may_own_world === false],
  ['Living Globe runtime has no remote dependency', () => globe.runtime.remote_dependencies === false && !/from\s*['"]https?:\/\//i.test(globeHtml)],
  ['Living Globe uses the locally licensed Three.js build', () => exists('shared/vendor/three-r160/three.module.js') && exists('shared/vendor/three-r160/LICENSE') && globeHtml.includes('/shared/vendor/three-r160/three.module.js')],
  ['Living Globe persists seed and random continuation state', () => globeHtml.includes('worldSeed, randomState') && globeHtml.includes('AXM_LIVING_GLOBE_SAVE_V1') && globeHtml.includes('randomState=(d.randomState')],
  ['Living Globe exposes a read-only machine-readable seam', () => globeHtml.includes('window.AXMLivingWorld=Object.freeze') && globe.seams.read_api === 'window.AXMLivingWorld'],
  ['Living Globe Mirror adapter is disconnected and non-applying', () => globeMirror.status === 'DESCRIPTOR_ONLY' && globeMirror.default_mode === 'disconnected' && globeMirror.live_apply_supported === false && globeMirror.supported_operations.length === 0],
  ['Museum is off by default and never activates its records', () => museum.visibility === 'OFF_BY_DEFAULT' && museum.artifacts.every(item => item.active_module === false)],
  ['First Mirror original bytes still match catalog provenance', () => sha256('museum/first-mirror/original/mirror.html') === museum.artifacts.find(item => item.id === 'museum.first-mirror').sha256],
  ['Accidental Symmetry record bytes still match catalog provenance', () => sha256('museum/records/2026-07-14-accidental-symmetry.txt') === museum.artifacts.find(item => item.id === 'record.accidental-symmetry').sha256],
  ['LUX-5 remains honestly labeled public test and single-player', () => lux.status === 'PUBLIC TEST' && lux.max_players === 1 && lux.allowed_seat_types.join(',') === 'human'],
  ['LUX-5 serves only its client root, not its outcome book', () => lux.rules.audit_fixture_is_not_served === true && luxServer.includes('CLIENT_ROOT') && !luxServer.includes('slots/lux-5')],
  ['LUX-5 vendored Three.js now has exact license provenance', () => exists('tools/game-hub/game-library/007-casino/lux-5-prototype/client/vendor/LICENSE') && sha256('tools/game-hub/game-library/007-casino/lux-5-prototype/client/vendor/LICENSE') === '852e0e8699169bf9f6fdc6bda3e682d078dcbc738b5d33e74df594721bff271d'],
  ['District Party remains honestly labeled public test', () => district.status === 'PUBLIC TEST' && district.known_limits.some(item => /UNTESTED|untested/i.test(item))],
  ['District Party human and adapter seats use the same input gate', () => district.rules.human_and_adapter_same_input_gate === true && district.rules.adapter_observation_is_seat_visible_only === true],
  ['Shared Controls preserves intention-only host authority', () => controls.authority.clientsSendIntentionsOnly === true && controls.authority.hostOwnsResults === true && controls.authority.humanAndAdapterSameGate === true],
  ['Static server boundary hides state, logs, bridge and project internals', () => ['state/x.json', 'logs/x.log', 'bridge/bridge-token.txt', 'projects/x/state.json'].every(Boundary.isPrivateStaticPath)],
  ['Public runtime routes remain outside the private boundary', () => ['hub/index.html', 'worlds/living-globe/index.html', 'museum/catalog.json', 'shared/vendor/three-r160/three.module.js'].every(item => !Boundary.isPrivateStaticPath(item))],
  ['Profile infrastructure remains optional and receipt-based', () => profileContract.lifecycle === 'OPTIONAL_OPT_IN' && profileCore.includes('enabled:false') && profileCore.includes('code character receipt requires evidence')],
  ['No intake package embeds the local user path or a Bridge token path', () => !/C:\\Users\\miket|bridge[\\/]bridge-token\.txt/i.test([read('shared/mirror-core/AXM_INTEGRATION.json'), read('shared/controls/AXM_INTEGRATION.json'), globeHtml, read('tools/game-hub/game-library/007-casino/game.manifest.json'), read('tools/game-hub/game-library/008-district-party/game.manifest.json')].join('\n'))],
  ['Imported game READMEs distinguish managed and standalone launch modes', () => read('tools/game-hub/game-library/007-casino/README.md').includes('managed port') && read('tools/game-hub/game-library/008-district-party/README_FIRST.md').includes('managed port')]
];

const report = {
  schema: 'axm.discovery-stance-intake-review/v1',
  subject: 'AXM intake 2026-07-14',
  method: 'Discovery Engine × Stance Forge bounded internal review',
  stanceReview: {
    stanceIntegrity: 'PARTIAL',
    uniqueContributions: [
      'Boundary/adversarial stance found the generic static-server privacy leak.',
      'Ownership stance separated a living world from games that attach rule sets.',
      'Portability stance removed the Globe runtime CDN and completed LUX-5 license provenance.',
      'Governance stance kept Mirror installed, visible, explicit-start and non-applying by default.',
      'Human/machine usability stance clarified managed Game Hub ports versus standalone development ports.'
    ],
    duplicates: [
      'Three.js r160 exists byte-identically in the shared vendor and LUX-5 standalone package; duplication is retained intentionally so the game package remains portable, with matching provenance.'
    ],
    boundaryViolationsRepaired: [
      'Private Workshop files were reachable through the generic static file fallback.',
      'Mirror originally overlapped District Party port 8798 before assignment to 8799.',
      'Living Globe depended on a runtime CDN.',
      'Living Globe randomness could not resume exactly before persisted randomState was added.',
      'LUX-5 vendored Three.js lacked an adjacent license/source record.',
      'Imported game documentation did not distinguish managed Hub ports from standalone defaults.'
    ],
    orderEffects: [
      'Game packages arriving before Mirror exposed a port collision that would not appear when each package was tested alone.'
    ],
    externalReviewNeeded: true,
    externalReviewScope: [
      'Physical phone and private-Wi-Fi joining',
      'Two-display District Party play',
      'Human visual/audio feel',
      'Future live-world persistence and any future applying Mirror adapter'
    ]
  },
  futureBranches: [
    'Authoritative shared Living World persistence',
    'Explicit game-ruleset adapter for the Living Globe',
    'Read-only Mirror world adapter with consent, revisions and receipts',
    'Physical phone/LAN and visual human proof',
    'Public-safe package and GitHub test PR',
    'True-alpha shooter asset derivatives',
    'More truthful profile receipt producers'
  ],
  truth: {
    independentExternalReview: false,
    productionCertified: false,
    noPossibleFutureImprovement: false,
    safeRepairsApplied: true,
    liveMirrorApply: false,
    sharedPersistentWorld: false
  },
  checks: []
};

let passed = 0;
for (const [name, check] of checks) {
  try {
    assert.ok(check(), name);
    report.checks.push({ name, status: 'PASS' });
    passed++;
  } catch (error) {
    report.checks.push({ name, status: 'FAIL', detail: error.message });
  }
}
report.summary = { total: checks.length, passed, failed: checks.length - passed };

if (require.main === module) {
  report.checks.forEach(item => console.log(item.status + ' ' + item.name + (item.detail ? ' · ' + item.detail : '')));
  console.log('\nAXM intake seam/stance review: ' + passed + '/' + checks.length + ' PASS');
  console.log('Stance integrity: ' + report.stanceReview.stanceIntegrity + ' · external review still required');
  if (passed !== checks.length) process.exitCode = 1;
}

module.exports = { run: () => report };
