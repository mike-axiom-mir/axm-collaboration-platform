'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const foundation = fs.readFileSync(path.join(ROOT, 'launcher', 'axm-foundation.js'), 'utf8');
const aiCore = fs.readFileSync(path.join(ROOT, 'tools', 'ai-team', 'ai-team-core.js'), 'utf8');
const aiTeam = fs.readFileSync(path.join(ROOT, 'tools', 'ai-team', 'ai-team.js'), 'utf8');

assert.ok(server.includes('path.join(MIRROR_NATIVE_HOME') && server.includes('runtime-token.txt'), 'runtime token remains in the private Mirror body');
assert.ok(server.includes('authorization:') && server.includes('Bearer ') && server.includes('+ token'), 'Workshop injects the token server-side');
assert.ok(server.includes('rawUrl.startsWith') && server.includes('/services/mirror-native/'), 'bounded same-origin route exists');
assert.equal(foundation.includes('runtime-token.txt'), false, 'browser foundation never knows the token path');
assert.ok(foundation.includes("id: 'mirror-kernel'"), 'Mirror is a selectable provider');
assert.ok(foundation.indexOf('api.register(mirror)') > foundation.indexOf('api.register(cloud)'), 'Seed-0 is registered last and cannot silently become the default language route');
assert.ok(aiCore.includes("{id:'mirror',name:'Mirror'"), 'AI Team declares a visible Mirror service card');
assert.ok(aiTeam.includes('loadMirror()'), 'AI Team checks live Mirror status');

const canonicalHash = crypto.createHash('sha256').update(foundation).digest('hex');
const copies = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'exports') continue;
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(target);
    else if (entry.name === 'axm-foundation.js') copies.push(target);
  }
}
walk(ROOT);
for (const file of copies) {
  const hash = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  assert.equal(hash, canonicalHash, `foundation copy drifted: ${path.relative(ROOT, file)}`);
}

console.log(`PASS Mirror Native connector: private token proxy, opt-in route, visible status, ${copies.length} synchronized foundation copies`);
