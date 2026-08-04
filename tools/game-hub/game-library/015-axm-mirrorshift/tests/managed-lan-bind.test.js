#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const http = require('node:http');
const os = require('node:os');
const { createRuntime, resolveHost } = require('../runtime/server');

function request(host, port, pathname) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host, port, path: pathname, timeout: 3000 }, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => resolve({ status: response.statusCode, body }));
    });
    req.on('timeout', () => req.destroy(new Error('managed LAN self-probe timed out')));
    req.on('error', reject);
  });
}

function privateIpv4() {
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.family !== 'IPv4' || entry.internal) continue;
      if (/^(?:10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(entry.address)) return entry.address;
    }
  }
  return null;
}

(async function () {
  assert.equal(resolveHost({}), '127.0.0.1');
  assert.equal(resolveHost({ AXM_MANAGED_BY_GAME_HUB: '1' }), '0.0.0.0');
  assert.equal(resolveHost({ AXM_MANAGED_BY_GAME_HUB: '1', HOST: '127.0.0.1' }), '127.0.0.1');
  assert.equal(resolveHost({ HOST: '192.168.50.20' }), '192.168.50.20');

  const runtime = createRuntime({
    manualTick: true,
    roster: [
      { id: 'p1', seatId: 'seat_1', displayName: 'Mike', type: 'human' },
      { id: 'p2', seatId: 'seat_2', displayName: 'Axiom/Mir', type: 'human' },
      { id: 'p3', seatId: 'seat_3', displayName: 'Codex', type: 'human' },
      { id: 'p4', seatId: 'seat_4', displayName: 'Mirror', type: 'human' }
    ]
  });
  await new Promise((resolve, reject) => {
    runtime.server.once('error', reject);
    runtime.server.listen(0, resolveHost({ AXM_MANAGED_BY_GAME_HUB: '1' }), resolve);
  });

  const address = runtime.server.address();
  const port = address.port;
  let privateProbe = 'UNAVAILABLE';
  try {
    assert.equal(address.address, '0.0.0.0');
    const loopback = await request('127.0.0.1', port, '/health');
    assert.equal(loopback.status, 200);
    assert.match(JSON.parse(loopback.body).status, /V23 · LIVING CIRCUITS/);

    const lanAddress = privateIpv4();
    if (lanAddress) {
      const lan = await request(lanAddress, port, '/health');
      assert.equal(lan.status, 200);
      assert.equal(JSON.parse(lan.body).gameId, '015-axm-mirrorshift');
      privateProbe = 'PASS';
    }
  } finally {
    await new Promise(resolve => runtime.server.close(resolve));
  }

  console.log('MIRRORSHIFT MANAGED LAN BIND PASS · managed 0.0.0.0 · standalone 127.0.0.1 · private-interface self-probe ' + privateProbe + ' · physical phone/router gate OPEN');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
