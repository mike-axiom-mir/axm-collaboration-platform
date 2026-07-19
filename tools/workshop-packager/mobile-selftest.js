#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(__dirname, '..', '..');
const html = fs.readFileSync(path.join(root, 'hub', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'hub', 'mobile-device.css'), 'utf8');
const adapter = fs.readFileSync(path.join(root, 'hub', 'mobile-device.js'), 'utf8');
const launcher = fs.readFileSync(path.join(root, 'mobile', 'start-axm-phone.sh'), 'utf8');
const builder = fs.readFileSync(path.join(__dirname, 'build-mobile-self-extracting.ps1'), 'utf8');
const publicPackager = fs.readFileSync(path.join(__dirname, 'package-workshop.ps1'), 'utf8');
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
check(!/(?:^|[,'"\s])runtime(?:[,'"\s]|$)/i.test(nestedPrivateNames), 'public packager preserves declared game runtimes');
check(/Join-Path \$Root 'runtime'/.test(publicPackager), 'public packager still excludes private top-level runtime state');

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
  console.error('mobile workshop selftest: FAIL');
  failures.forEach(item => console.error('  - ' + item));
  process.exit(1);
}
console.log('mobile workshop selftest: PASS' + (bundle ? ' (source + embedded bundle)' : ' (source)'));
