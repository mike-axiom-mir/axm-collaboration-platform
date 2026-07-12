'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Core = require('./connector-core.js');

const prompt = Core.buildPrompt({
  name: 'Blue ship skin',
  targetGame: 'Test game',
  brief: 'A compact blue rescue ship viewed from above',
  width: 512,
  height: 256,
  style: 'crisp pixel art',
  transparent: true,
  hardEdges: true
});
assert.match(prompt, /512 × 256/);
assert.match(prompt, /transparent background/);
assert.match(prompt, /one final image only/i);
assert.throws(() => Core.buildPrompt({ name: '', targetGame: 'x', brief: 'y' }), /required/);
assert.equal(Core.dimension(99999), 4096);
assert.equal(Core.dimension(1), 16);

const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);
assert.equal(Core.isPngBytes(png), true);
assert.equal(Core.isPngBytes(Buffer.from('not png')), false);

assert.equal(Core.tunnelProven({ chatgpt: { mcpTunnel: { connected: true, proven: true } } }), true);
assert.equal(Core.tunnelProven({ platformMcp: { state: 'connected', connected: true, safeTunnel: true } }), true);
const endpointFixture = {
  schema: 'axm.chatgpt-connector-status/v1',
  codingSeat: { state: 'ready', cliInstalled: true, cliAccessible: true, loginVerified: true },
  chatApp: { appOpen: true },
  platformMcp: { state: 'manual', connected: false, safeTunnel: false }
};
assert.equal(Core.tunnelProven(endpointFixture), false);
assert.equal(Core.tunnelProven({ chatgpt: { desktopRunning: true, authenticated: true } }), false);
assert.equal(Core.codingSeat({ codex: { installed: true, accessible: true, authenticated: true, desktopRunning: true } }).label, 'READY');
assert.deepEqual(Core.codingSeat(endpointFixture), { installed: true, accessible: true, authenticated: true, running: false, version: '', authMode: '', label: 'READY' });

const packet = Core.buildPacket({
  name: 'Blue ship skin', targetGameId: '002-test', fileName: 'ship.png', prompt,
  dataUrl: 'data:image/png;base64,iVBORw0KGgo=', tunnelProven: false,
  requestedDimensions: '512x256', actualDimensions: '512x256'
});
assert.equal(packet.schema, 'axm.game-asset/v1');
assert.equal(packet.source_module, 'chatgpt-connector');
assert.equal(packet.status, 'proposal');
assert.equal(packet.provenance.automatic_accept, false);
assert.equal(packet.provenance.platform_connection, 'manual-handoff');
assert.equal(packet.provenance.requested_dimensions, '512x256');
assert.equal(packet.provenance.actual_dimensions, '512x256');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
assert.match(html, /<select id="targetGame" required disabled>/);
assert.doesNotMatch(html, /<input id="targetGame"/);
assert.match(html, /Review in Game Hub/);
assert.match(app, /browser could not decode the PNG structure/);
assert.match(app, /actualDimensions/);
assert.match(app, /Game Hub offline/);

console.log('ChatGPT Connector selftest: PASS (prompt, status truth, PNG gate, proposal packet)');
