'use strict';

const assert = require('assert');
const Touch = require('../touch-environment-probe');
const Runtime = require('../runtime-route');

function adapter() { return { os: function () { return 'win32'; }, separator: function () { return '\\'; }, pathExists: function (target) { return target === 'C:\\exact'; }, toolVersion: function (name) { return name === 'node' ? '22.0.0' : null; } }; }
async function run() {
  const touch = Touch.create({ adapter: adapter() });
  const match = touch.probe({ os: 'win32', separator: '\\', paths: [{ path: 'C:\\exact', exists: true }], tools: [{ name: 'node', version: '22.0.0' }] });
  const mismatch = touch.probe({ os: 'linux', paths: [{ path: 'C:\\missing', exists: true }] });
  const unknown = touch.probe({ tools: [{ name: 'mystery', version: '1' }] });
  let wildcardRefused = false; try { touch.probe({ paths: ['C:\\*'] }); } catch (error) { wildcardRefused = /wildcards/.test(error.message); }
  assert.equal(match.safe_to_proceed_as_contracted, true); assert.ok(mismatch.mismatches.length >= 2); assert.equal(unknown.safe_to_proceed_as_contracted, false); assert.equal(wildcardRefused, true); assert.equal(touch.status().rawRetainedItems, 0);
  async function use(n) { return Runtime.invoke('touch-environment-probe', { os: 'win32', paths: [{ path: 'C:\\exact', exists: true }] }, { claimId: 'claim-touch-' + n, seatId: 'seat-test', targetId: 'environment', adapters: { environment: adapter() } }); }
  const first = await use(1), second = await use(2);
  return { senseId: 'touch-environment-probe', verdict: 'PASS', positive: match, negative: [mismatch, unknown, { wildcardRefused }], envelopes: [first.envelope, second.envelope], uses: [0, 0], rawRetainedBytes: 0, rawRetainedItems: 0 };
}

module.exports = { run };
