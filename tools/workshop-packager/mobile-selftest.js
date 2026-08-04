#!/usr/bin/env node
'use strict';
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Planner = require('./package-planner');
const Packager = require('./packager-service');

const root = path.resolve(__dirname, '..', '..');
const html = fs.readFileSync(path.join(root, 'hub', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'hub', 'mobile-device.css'), 'utf8');
const adapter = fs.readFileSync(path.join(root, 'hub', 'mobile-device.js'), 'utf8');
const launcher = fs.readFileSync(path.join(root, 'mobile', 'start-axm-phone.sh'), 'utf8');
const builder = fs.readFileSync(path.join(__dirname, 'build-mobile-self-extracting.ps1'), 'utf8');
const publicPackager = fs.readFileSync(path.join(__dirname, 'package-workshop.ps1'), 'utf8');
const restoreTest = fs.readFileSync(path.join(__dirname, 'restore-test.ps1'), 'utf8');
const packagerUi = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const failures = [];
function check(value, message) { if (!value) failures.push(message); }

check(/mobile-device\.css/.test(html) && /mobile-device\.js/.test(html), 'Hub links the phone adapter');
check(/device=phone/.test(adapter) && /sidebar-collapsed/.test(adapter), 'phone detection and initial navigation collapse');
check(/@media \(max-width:720px\)/.test(css) && /min-height:44px/.test(css), 'responsive phone layout and touch targets');
check(/AXM_HOST/.test(server), 'main server supports an explicit device binding');
check(/AXM_GAME_HUB_HOST=0\.0\.0\.0/.test(launcher), 'Game Hub remains available for trusted LAN joining');
check(/127\.0\.0\.1:8788/.test(launcher) && /start_one hub/.test(launcher), 'phone starts its own local Hub server');
check(/full_active_workshop = \$true/.test(builder) && !/node_modules'\)/.test(builder.split('$excludedDirs')[1].split(')')[0]), 'builder preserves the full active dependency tree');
check(/PAYLOAD_SHA256/.test(builder) && /embedded payload hash does not match/.test(builder), 'self-extracting payload is hash gated');
check(/bridge-token\.txt/.test(builder) && /latest-screen\.jpg/.test(builder), 'transfer excludes live keys and screen captures');

const nestedPrivateNames = (publicPackager.match(/\$privateDirNames\s*=\s*@\(([\s\S]*?)\n\s*\)/) || [,''])[1];
check(!/(?:^|[,'"\s])runtime(?:[,'"\s]|$)/i.test(nestedPrivateNames), 'public packager preserves declared nested game runtimes');
check(/Join-Path \$Root 'runtime'/.test(publicPackager), 'public packager excludes private top-level runtime state');
check(/ValidateSet\('full','public','module','delta','offline-windows'\)/.test(publicPackager), 'packager exposes five typed modes including offline Windows');
check(/axm\.package-plan\/v1/.test(publicPackager) && /removed_paths/.test(publicPackager), 'packager consumes a typed plan and preserves the deletion ledger');
check(/not-applicable-partial-package/.test(restoreTest) && /Selected scope has no restored files/.test(restoreTest), 'restore test distinguishes partial packages from whole Workshop boots');
check(/Current build-on ZIP/.test(packagerUi) && /Create build-on ZIP/.test(packagerUi) && /Create changed\/new ZIP/.test(packagerUi) && /Create offline Windows ZIP/.test(packagerUi), 'human UI exposes build-on, delta and offline Windows flows');
check(/BUILD_ON_GUIDE\.md/.test(publicPackager) && /axm\.build-on-handoff\/v1/.test(publicPackager), 'modular sender includes a plain-language return guide and typed exact-base handoff');
check(/export_id=\$BaseName/.test(publicPackager) && /intended_return_schema='axm\.workshop-package-return\/v1'/.test(publicPackager), 'build-on handoff records its export identity and intended receiver schema');
check(/catalog: WorkshopPackager\.catalog\(\)/.test(server) && /github_repo: parsed\.github_repo/.test(server), 'server routes catalog and bounded delta inputs');

const catalog = Packager.catalog();
check(catalog.length > 20, 'catalog discovers packageable Workshop boundaries');
check(['module', 'parent-module', 'game', 'world', 'shared-system'].every(kind => catalog.some(item => item.kind === kind)), 'catalog includes modules, parents, games, worlds, and shared systems');
check(Packager.normalizeOptions({ mode: 'module', scopes: ['tools/workshop-packager'] }).scopes[0] === 'tools/workshop-packager', 'service accepts a safe modular scope');
check(Packager.normalizeOptions({ mode: 'offline-windows' }).mode === 'offline-windows', 'service accepts the offline Windows candidate mode');
check(typeof Packager.offlineReadiness().ready === 'boolean', 'service exposes runtime-bundle readiness without building');
check(Packager.deploymentCapabilities().summary.total === 100, 'service exposes the deduplicated 100-card deployment capability catalog');
try { Packager.normalizeOptions({ mode: 'module', scopes: ['../outside'] }); check(false, 'service refuses escaping scopes'); }
catch (_) { check(true, 'service refuses escaping scopes'); }

const plannerRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-package-plan-'));
try {
  fs.mkdirSync(path.join(plannerRoot, 'tools', 'demo', 'runtime'), { recursive: true });
  fs.mkdirSync(path.join(plannerRoot, 'tools', 'demo', 'rollback'), { recursive: true });
  fs.mkdirSync(path.join(plannerRoot, 'state'), { recursive: true });
  fs.mkdirSync(path.join(plannerRoot, 'intakes', 'ai-team-collaboration-runs-01-101-v1'), { recursive: true });
  fs.mkdirSync(path.join(plannerRoot, 'intakes', 'unreviewed-candidate'), { recursive: true });
  fs.mkdirSync(path.join(plannerRoot, 'distributions', 'demo', 'build'), { recursive: true });
  fs.mkdirSync(path.join(plannerRoot, 'AXM_EXAMPLE_v0_1_WORKING'), { recursive: true });
  fs.mkdirSync(path.join(plannerRoot, '_archive_review_example'), { recursive: true });
  fs.writeFileSync(path.join(plannerRoot, 'tools', 'demo', 'index.js'), 'hello\n');
  fs.writeFileSync(path.join(plannerRoot, 'tools', 'demo', 'index.js.bak-editor'), 'backup\n');
  fs.writeFileSync(path.join(plannerRoot, 'tools', 'demo', 'runtime', 'bridge_token.txt'), 'private relay token\n');
  fs.writeFileSync(path.join(plannerRoot, 'tools', 'demo', 'runtime', 'game.js'), 'game\n');
  fs.writeFileSync(path.join(plannerRoot, 'tools', 'demo', 'rollback', 'old.zip'), 'archive\n');
  fs.writeFileSync(path.join(plannerRoot, 'state', 'private.json'), '{}\n');
  fs.writeFileSync(path.join(plannerRoot, 'intakes', 'ai-team-collaboration-runs-01-101-v1', 'reviewed.json'), '{}\n');
  fs.writeFileSync(path.join(plannerRoot, 'intakes', 'unreviewed-candidate', 'private.json'), '{}\n');
  fs.writeFileSync(path.join(plannerRoot, 'distributions', 'demo', 'build', 'demo.zip'), 'derived\n');
  fs.writeFileSync(path.join(plannerRoot, 'AXM_EXAMPLE_v0_1_WORKING', 'candidate.js'), 'candidate\n');
  fs.writeFileSync(path.join(plannerRoot, '_archive_review_example', 'review.txt'), 'review\n');
  const planned = Planner.collectFiles(plannerRoot, ['tools/demo']);
  check(planned.files.has('tools/demo/index.js') && planned.files.has('tools/demo/runtime/game.js'), 'modular planner preserves nested game runtime content');
  check(!planned.files.has('tools/demo/rollback/old.zip'), 'modular planner excludes nested rollback archives');
  check(!planned.files.has('tools/demo/index.js.bak-editor'), 'modular planner excludes editor backup variants');
  check(!planned.files.has('tools/demo/runtime/bridge_token.txt'), 'modular planner excludes underscore-style runtime bridge tokens');
  check(!planned.files.has('state/private.json'), 'modular planner excludes body-level private state');
  const publicPlanned = Planner.collectFiles(plannerRoot, []);
  check(publicPlanned.files.has('tools/demo/runtime/game.js'), 'public planner preserves production game runtime content');
  check(!publicPlanned.files.has('distributions/demo/build/demo.zip'), 'public planner excludes generated distributions');
  check(!publicPlanned.files.has('AXM_EXAMPLE_v0_1_WORKING/candidate.js'), 'public planner excludes root working handoffs');
  check(!publicPlanned.files.has('_archive_review_example/review.txt'), 'public planner excludes archive-review workspaces');
  check(publicPlanned.files.has('intakes/ai-team-collaboration-runs-01-101-v1/reviewed.json'), 'public planner includes the exact reviewed AI Team Steward intake dependency');
  check(!publicPlanned.files.has('intakes/unreviewed-candidate/private.json'), 'public planner keeps every unreviewed intake private');
  check(Planner.gitBlobSha(path.join(plannerRoot, 'tools', 'demo', 'index.js')) === 'ce013625030ba8dba906f756967f9e9ca394464a', 'GitHub delta uses canonical Git blob hashing');
  const syntheticDelta = Planner.diffAgainstTree(planned.files, [
    { type: 'blob', path: 'tools/demo/index.js', sha: 'ce013625030ba8dba906f756967f9e9ca394464a' },
    { type: 'blob', path: 'tools/demo/removed.js', sha: '1111111111111111111111111111111111111111' },
    { type: 'blob', path: 'state/remote-private.json', sha: '2222222222222222222222222222222222222222' }
  ], ['tools/demo']);
  check(syntheticDelta.changed.length === 1 && syntheticDelta.changed[0] === 'tools/demo/runtime/game.js', 'delta includes only changed or new local files');
  check(syntheticDelta.removed.length === 1 && syntheticDelta.removed[0] === 'tools/demo/removed.js', 'delta records remote-only paths without deleting them');
} finally {
  fs.rmSync(plannerRoot, { recursive: true, force: true });
}

const bundle = process.env.AXM_MOBILE_BUNDLE;
if (bundle) {
  check(fs.existsSync(bundle), 'requested bundle exists');
  if (fs.existsSync(bundle)) {
    const data = fs.readFileSync(bundle);
    const marker = Buffer.from('__AXM_PAYLOAD_BELOW__\n');
    const markerAt = data.indexOf(marker);
    check(markerAt > 0, 'bundle contains one extraction marker');
    check(data.indexOf(marker, markerAt + marker.length) === -1, 'bundle contains only one extraction marker');
    if (markerAt > 0) {
      const header = data.subarray(0, markerAt).toString('utf8');
      const payload = data.subarray(markerAt + marker.length);
      const declared = (header.match(/PAYLOAD_SHA256="([a-f0-9]{64})"/) || [])[1];
      const actual = crypto.createHash('sha256').update(payload).digest('hex');
      check(payload.subarray(0, 4).equals(Buffer.from([0x50,0x4b,0x03,0x04])), 'embedded payload is a ZIP');
      check(declared === actual, 'embedded ZIP matches declared SHA-256');
      check(data.length > 50 * 1024 * 1024, 'bundle is a substantial Workshop, not a flattened demo');
    }
  }
}

if (failures.length) {
  console.error('workshop packager selftest: FAIL');
  failures.forEach(item => console.error('  - ' + item));
  process.exit(1);
}
console.log('workshop packager selftest: PASS' + (bundle ? ' (source + embedded bundle)' : ' (source)'));
