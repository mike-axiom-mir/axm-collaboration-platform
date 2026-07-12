'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const H = require('./asset-handoff');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-asset-handoff-'));
const libraryDir = path.join(root, 'library'), inboxDir = path.join(root, 'inbox'), gameDir = path.join(libraryDir, '002-test');
fs.mkdirSync(gameDir, { recursive: true });
fs.writeFileSync(path.join(gameDir, 'game.manifest.json'), JSON.stringify({ game_id: '002-test' }));
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEAQH/69QAswAAAABJRU5ErkJggg==';
const signature = Buffer.from('89504e470d0a1a0a', 'hex');
function chunk(type, data) {
  const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
  return Buffer.concat([length, Buffer.from(type, 'ascii'), data, Buffer.alloc(4)]);
}
function structuralPng(width, height, includeIend) {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 6;
  const bytes = [signature, chunk('IHDR', ihdr)];
  if (includeIend !== false) bytes.push(chunk('IEND', Buffer.alloc(0)));
  return 'data:image/png;base64,' + Buffer.concat(bytes).toString('base64');
}
let pass = 0;
function ok(value, label) { if (!value) throw new Error('FAIL: ' + label); pass++; }
try {
  const packet = { schema: H.SCHEMA, source_module: 'studio', target_game_id: '002-test', name: 'Test Skin', kind: 'skin', status: 'proposal', data_url: png, provenance: { brief: 'One-pixel test skin', generator: 'selftest' } };
  ok(H.validatePacket(packet, libraryDir).pass, 'valid Studio packet accepted');
  ok(!H.validatePacket(Object.assign({}, packet, { target_game_id: 'ghost' }), libraryDir).pass, 'unknown target game refused');
  ok(!H.validatePacket(Object.assign({}, packet, { data_url: 'not-png' }), libraryDir).pass, 'non-PNG refused');
  ok(!H.validatePacket(Object.assign({}, packet, { source_module: 'unknown-agent' }), libraryDir).pass, 'unknown source module refused');
  ok(!H.validatePacket(Object.assign({}, packet, { data_url: 'data:image/png;base64,' + Buffer.concat([signature, Buffer.from([0])]).toString('base64') }), libraryDir).pass, 'fake nine-byte PNG refused');
  const truncatedIhdr = 'data:image/png;base64,' + Buffer.concat([signature, Buffer.from('0000000d494844520001', 'hex')]).toString('base64');
  ok(!H.validatePacket(Object.assign({}, packet, { data_url: truncatedIhdr }), libraryDir).pass, 'truncated IHDR chunk refused');
  ok(!H.validatePacket(Object.assign({}, packet, { data_url: structuralPng(1, 1, false) }), libraryDir).pass, 'PNG missing IEND refused');
  ok(!H.validatePacket(Object.assign({}, packet, { data_url: structuralPng(0, 1, true) }), libraryDir).pass, 'zero-width PNG refused');
  ok(!H.validatePacket(Object.assign({}, packet, { data_url: structuralPng(H.MAX_DIMENSION + 1, 1, true) }), libraryDir).pass, 'oversized PNG dimension refused');
  const shortIhdr = 'data:image/png;base64,' + Buffer.concat([signature, chunk('IHDR', Buffer.alloc(12)), chunk('IEND', Buffer.alloc(0))]).toString('base64');
  ok(!H.validatePacket(Object.assign({}, packet, { data_url: shortIhdr }), libraryDir).pass, 'non-13-byte IHDR refused');
  const created = H.createHandoff({ packet, libraryDir, inboxDir });
  ok(created.status === 'proposal' && H.listHandoffs(inboxDir).length === 1, 'proposal staged in inbox');
  ok(created.dimensions.width === 1 && created.dimensions.height === 1, 'decoded PNG dimensions preserved in record');
  ok(created.provenance.brief === packet.provenance.brief && created.provenance.generator === 'selftest', 'proposal provenance preserved in record');
  const accepted = H.acceptHandoff({ id: created.id, libraryDir, inboxDir });
  ok(accepted.status === 'accepted' && fs.existsSync(path.join(gameDir, accepted.acceptance.package_path)), 'explicit acceptance copies into game folder');

  const chatgptPacket = Object.assign({}, packet, { source_module: 'chatgpt-connector', name: 'ChatGPT Proposed Skin' });
  ok(H.validatePacket(chatgptPacket, libraryDir).pass, 'valid ChatGPT connector packet accepted for staging');
  const chatgptCreated = H.createHandoff({ packet: chatgptPacket, libraryDir, inboxDir });
  ok(chatgptCreated.source_module === 'chatgpt-connector', 'ChatGPT source is preserved in the handoff record');
  ok(chatgptCreated.status === 'proposal' && !chatgptCreated.acceptance, 'ChatGPT handoff remains a proposal with no auto-accept');
  ok(!fs.existsSync(path.join(gameDir, 'assets', 'chatgpt-connector')), 'proposal gate writes nothing into the game package');
  const chatgptAccepted = H.acceptHandoff({ id: chatgptCreated.id, libraryDir, inboxDir });
  ok(chatgptAccepted.source_module === 'chatgpt-connector' && chatgptAccepted.acceptance.decision === 'explicit-user-accept', 'explicit acceptance preserves ChatGPT source and decision');
  ok(fs.existsSync(path.join(gameDir, chatgptAccepted.acceptance.package_path)), 'explicitly accepted ChatGPT asset is copied into the game folder');
  const ui = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  ok(ui.includes('/tools/game-hub/asset-inbox/') && ui.includes('/asset.png'), 'proposal inbox renders the stored PNG thumbnail route');
  ok(ui.includes('h.dimensions.width') && ui.includes('proposalBrief(h)'), 'proposal inbox renders decoded dimensions and provenance summary');
  ok(ui.includes('Accept into game package'), 'proposal inbox labels the explicit acceptance action');
  ok(ui.includes('Stored in proposal inbox · not activated'), 'proposal inbox states that staged assets are not activated');
  console.log('PASS asset handoff: ' + pass + ' assertions');
} finally {
  const resolved = path.resolve(root), tempPrefix = path.resolve(os.tmpdir()) + path.sep;
  if (resolved.startsWith(tempPrefix)) fs.rmSync(resolved, { recursive: true, force: true });
}
