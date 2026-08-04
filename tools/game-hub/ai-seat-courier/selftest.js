#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  CourierCore, REQUEST_SCHEMA, RESPONSE_SCHEMA, assertLocalUrl, ensureInside, keyDescriptor
} = require('./lib/courier-core');

let checks = 0;
function check(condition, message) { assert.ok(condition, message); checks += 1; }
function throws(fn, pattern) { assert.throws(fn, pattern); checks += 1; }

check(REQUEST_SCHEMA === 'axm.ai-seat-courier.request/v1', 'request schema is stable');
check(RESPONSE_SCHEMA === 'axm.ai-seat-courier.response/v1', 'response schema is stable');
check(assertLocalUrl('http://127.0.0.1:8819/').port === '8819', 'loopback URL is allowed');
check(assertLocalUrl('http://localhost:8819/').hostname === 'localhost', 'localhost URL is allowed');
throws(() => assertLocalUrl('https://127.0.0.1:8819/'), /only local http/);
throws(() => assertLocalUrl('http://example.com/'), /only local http/);
throws(() => assertLocalUrl('http://127.0.0.1:8787/', 'http://127.0.0.1:8819'), /does not match/);

const root = path.resolve(__dirname);
check(ensureInside(root, path.join(root, 'lib', 'courier-core.js')).startsWith(root), 'child path is accepted');
throws(() => ensureInside(root, path.resolve(root, '..', 'outside.txt')), /escapes/);
check(keyDescriptor('KeyD').code === 'KeyD', 'letter key is supported');
check(keyDescriptor('ArrowUp').windowsVirtualKeyCode === 38, 'arrow key is supported');
check(keyDescriptor('Numpad0').windowsVirtualKeyCode === 96, 'numpad key is supported');
throws(() => keyDescriptor('F12'), /unsupported/);

for (const file of ['manifest.json', 'module.contract.json', 'schemas/request.schema.json', 'schemas/response.schema.json']) {
  JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
  checks += 1;
}

const core = new CourierCore({ moduleRoot: root });
const braceRoom = core.findGame('019-brace-room');
check(braceRoom.manifest.slot === '019', 'Brace Room resolves by game id');
check(core.findGame('019').manifest.game_id === '019-brace-room', 'Brace Room resolves by slot');
check(core.status().sessionActive === false, 'fresh courier has no session');

core.handle({ schema: REQUEST_SCHEMA, action: 'unknown' })
  .then(() => { throw new Error('unknown action should fail'); })
  .catch(error => {
    check(/unsupported action/.test(error.message), 'unknown actions are rejected');
    console.log(`PASS ai-seat-courier selftest (${checks} checks)`);
  });
