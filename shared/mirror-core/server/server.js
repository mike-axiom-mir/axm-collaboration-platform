#!/usr/bin/env node
'use strict';

const http = require('http');
const path = require('path');
const { MirrorCore } = require('../core/mirror-core');
const { createRouter, sendJson } = require('./routes');

function createMirrorServer(options) {
  options = options || {};
  const rootDir = path.resolve(options.rootDir || path.join(__dirname, '..'));
  const host = options.host || process.env.AXM_MIRROR_HOST || '127.0.0.1';
  if (!['127.0.0.1', '::1', 'localhost'].includes(host)) throw new Error('Mirror Core refuses non-loopback binding');
  const port = Number(options.port == null ? (process.env.AXM_MIRROR_PORT || 8799) : options.port);
  const runtimeDir = options.runtimeDir || process.env.AXM_MIRROR_RUNTIME_DIR;
  const core = options.core || new MirrorCore({ rootDir, runtimeDir });
  const route = createRouter(core, rootDir);
  const server = http.createServer(function (req, res) {
    route(req, res).catch(function (error) {
      if (res.headersSent) return res.end();
      const status = Number(error.statusCode || (/not found/.test(error.message) ? 404 : 400));
      sendJson(res, status, { ok: false, error: error.message });
    });
  });
  return {
    core,
    server,
    host,
    port,
    start: function () {
      return new Promise(function (resolve, reject) {
        server.once('error', reject);
        server.listen(port, host, function () {
          server.removeListener('error', reject);
          const address = server.address();
          resolve({ host, port: address.port, url: 'http://' + (host === '::1' ? '[::1]' : host) + ':' + address.port });
        });
      });
    },
    stop: function () {
      return new Promise(function (resolve, reject) {
        if (!server.listening) return resolve();
        server.close(function (error) { return error ? reject(error) : resolve(); });
      });
    }
  };
}

if (require.main === module) {
  let app;
  try {
    app = createMirrorServer();
    app.start().then(function (info) {
      process.stdout.write('\nAXM MIRROR CORE · WORKING TEST\n');
      process.stdout.write('Local dashboard: ' + info.url + '\n');
      process.stdout.write('Stop: Ctrl+C\n\n');
    }).catch(function (error) {
      process.stderr.write('Mirror Core failed to start: ' + error.message + '\n');
      process.exitCode = 1;
    });
  } catch (error) {
    process.stderr.write('Mirror Core refused startup: ' + error.message + '\n');
    process.exitCode = 1;
  }
  process.on('SIGINT', function () {
    if (!app) return process.exit(0);
    app.stop().finally(function () { process.exit(0); });
  });
}

module.exports = { createMirrorServer };
