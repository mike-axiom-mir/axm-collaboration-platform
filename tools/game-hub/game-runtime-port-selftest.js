'use strict';

const assert = require('node:assert');
const net = require('node:net');
const hub = require('./game-hub-server');

async function listen(server, port = 0) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '0.0.0.0', resolve);
  });
  return server.address().port;
}

async function close(server) {
  if (!server.listening) return;
  await new Promise(resolve => server.close(resolve));
}

(async () => {
  const occupied = net.createServer();
  const occupiedPort = await listen(occupied);
  try {
    await assert.rejects(
      hub.selectRuntimePort({ port: occupiedPort }),
      new RegExp('runtime port ' + occupiedPort + ' is already in use')
    );

    const fallback = await hub.selectRuntimePort({ port: occupiedPort, allow_port_fallback: true });
    assert.equal(fallback.preferredPort, occupiedPort);
    assert.equal(fallback.fallback, true);
    assert.ok(Number.isInteger(fallback.port) && fallback.port > 0);
    assert.notEqual(fallback.port, occupiedPort);
  } finally {
    await close(occupied);
  }

  const preferred = net.createServer();
  const preferredPort = await listen(preferred);
  await close(preferred);
  const unchanged = await hub.selectRuntimePort({ port: preferredPort, allow_port_fallback: true });
  assert.deepStrictEqual(unchanged, { port: preferredPort, preferredPort, fallback: false });

  console.log('game runtime port selftest: PASS');
})().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
