'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const H = require('./asset-handoff');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-asset-handoff-'));
const libraryDir = path.join(root, 'library'), inboxDir = path.join(root, 'inbox'), gameDir = path.join(libraryDir, '002-test');
fs.mkdirSync(gameDir, { recursive: true });
fs.writeFileSync(path.join(gameDir, 'game.manifest.json'), JSON.stringify({ game_id: '002-test' }));
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADElEQVR42mNk+M/wHwAF/gL+XwL7WQAAAABJRU5ErkJggg==';
let pass = 0;
function ok(value, label) { if (!value) throw new Error('FAIL: ' + label); pass++; }
try {
  const packet = { schema: H.SCHEMA, source_module: 'studio', target_game_id: '002-test', name: 'Test Skin', kind: 'skin', status: 'proposal', data_url: png };
  ok(H.validatePacket(packet, libraryDir).pass, 'valid Studio packet accepted');
  ok(!H.validatePacket(Object.assign({}, packet, { target_game_id: 'ghost' }), libraryDir).pass, 'unknown target game refused');
  ok(!H.validatePacket(Object.assign({}, packet, { data_url: 'not-png' }), libraryDir).pass, 'non-PNG refused');
  const created = H.createHandoff({ packet, libraryDir, inboxDir });
  ok(created.status === 'proposal' && H.listHandoffs(inboxDir).length === 1, 'proposal staged in inbox');
  const accepted = H.acceptHandoff({ id: created.id, libraryDir, inboxDir });
  ok(accepted.status === 'accepted' && fs.existsSync(path.join(gameDir, accepted.acceptance.package_path)), 'explicit acceptance copies into game folder');
  console.log('PASS asset handoff: ' + pass + ' assertions');
} finally {
  const resolved = path.resolve(root), tempPrefix = path.resolve(os.tmpdir()) + path.sep;
  if (resolved.startsWith(tempPrefix)) fs.rmSync(resolved, { recursive: true, force: true });
}
