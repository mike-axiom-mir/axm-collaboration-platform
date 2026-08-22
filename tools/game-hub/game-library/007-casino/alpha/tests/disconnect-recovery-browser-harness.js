#!/usr/bin/env node
"use strict";

var childProcess = require("node:child_process");
var fs = require("node:fs");
var http = require("node:http");
var os = require("node:os");
var path = require("node:path");
var readline = require("node:readline");

var ROOT = path.resolve(__dirname, "..");
var SERVER = path.join(ROOT, "runtime", "casino-server.cjs");
var wait = function (milliseconds) { return new Promise(function (resolve) { setTimeout(resolve, milliseconds); }); };

function evidenceRoster() {
  return [{ seat_id: "seat_1", slot: 1, display_name: "Mike", type: "human" }];
}

function reservePort() {
  return new Promise(function (resolve, reject) {
    var server = http.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", function () {
      var port = server.address().port;
      server.close(function (error) { if (error) reject(error); else resolve(port); });
    });
  });
}

async function startOrigin(statePath) {
  var port = await reservePort();
  var child = childProcess.spawn(process.execPath, [SERVER], {
    cwd: ROOT,
    env: Object.assign({}, process.env, {
      PORT: String(port),
      CASINO_ALPHA_HOST: "127.0.0.1",
      CASINO_ALPHA_STATE_PATH: statePath,
      AXM_GAME_SESSION_ID: "casino-disconnect-evidence-session",
      AXM_GAME_PLAY_MODE: "backroom_story",
      AXM_PLAYERS_JSON: JSON.stringify(evidenceRoster())
    }),
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });
  var output = "";
  child.stdout.on("data", function (chunk) { output += chunk; });
  child.stderr.on("data", function (chunk) { output += chunk; });
  var origin = "http://127.0.0.1:" + port;
  for (var attempt = 0; attempt < 100; attempt += 1) {
    if (child.exitCode != null) throw new Error("Casino Alpha origin exited early: " + output.trim());
    try {
      var response = await fetch(origin + "/state");
      var state = await response.json();
      if (response.ok && state.phase === "running") return { child: child, origin: origin };
    } catch (_) {}
    await wait(50);
  }
  child.kill("SIGTERM");
  throw new Error("Casino Alpha origin did not become ready: " + output.trim());
}

async function stopOrigin(child) {
  if (!child || child.exitCode != null) return;
  child.kill("SIGTERM");
  await Promise.race([
    new Promise(function (resolve) { child.once("exit", resolve); }),
    wait(1500).then(function () { if (child.exitCode == null) child.kill("SIGKILL"); })
  ]);
}

function createFaultProxy(origin) {
  var offline = false;
  var active = new Set();
  var target = new URL(origin);
  var server = http.createServer(function (request, response) {
    if (offline) {
      request.socket.destroy();
      return;
    }
    var upstream = http.request({
      hostname: target.hostname,
      port: target.port,
      path: request.url,
      method: request.method,
      headers: Object.assign({}, request.headers, { host: target.host })
    });
    var tunnel = { response: response, upstream: upstream, upstreamResponse: null };
    active.add(tunnel);
    var forget = function () { active.delete(tunnel); };
    upstream.on("response", function (upstreamResponse) {
      tunnel.upstreamResponse = upstreamResponse;
      response.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.headers);
      upstreamResponse.pipe(response);
      upstreamResponse.on("close", forget);
      upstreamResponse.on("end", forget);
    });
    upstream.on("error", function () { response.destroy(); forget(); });
    response.on("close", forget);
    request.on("aborted", function () { upstream.destroy(); });
    request.pipe(upstream);
  });

  async function listen() {
    if (!server.listening) await new Promise(function (resolve, reject) {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    return server.address();
  }

  function drop() {
    offline = true;
    active.forEach(function (tunnel) {
      tunnel.upstream.destroy();
      if (tunnel.upstreamResponse) tunnel.upstreamResponse.destroy();
      tunnel.response.destroy();
    });
    active.clear();
  }

  function restore() { offline = false; }

  async function close() {
    drop();
    if (server.closeAllConnections) server.closeAllConnections();
    if (server.listening) await new Promise(function (resolve, reject) {
      server.close(function (error) { if (error) reject(error); else resolve(); });
    });
  }

  return { close: close, drop: drop, isOffline: function () { return offline; }, listen: listen, restore: restore };
}

async function createEvidenceHarness() {
  var tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "axm-casino-disconnect-"));
  var statePath = path.join(tempRoot, "local-state.json");
  var originRuntime = null;
  var proxy = null;
  try {
    originRuntime = await startOrigin(statePath);
    proxy = createFaultProxy(originRuntime.origin);
    var address = await proxy.listen();
    var url = "http://127.0.0.1:" + address.port;
    var bootstrapResponse = await fetch(url + "/api/host/bootstrap");
    var bootstrap = await bootstrapResponse.json();
    if (!bootstrapResponse.ok || !bootstrap.launch || !bootstrap.launch.controllers || !bootstrap.launch.controllers[0]) {
      throw new Error("Casino Alpha bootstrap did not issue a controller link: " + JSON.stringify(bootstrap));
    }
    var controllerUrl = new URL(bootstrap.launch.controllers[0].url, url + "/").href;
    var closed = false;
    return {
      controllerUrl: controllerUrl,
      drop: proxy.drop,
      isOffline: proxy.isOffline,
      origin: originRuntime.origin,
      restore: proxy.restore,
      statePath: statePath,
      url: url,
      async close() {
        if (closed) return;
        closed = true;
        await proxy.close();
        await stopOrigin(originRuntime.child);
        fs.rmSync(tempRoot, { recursive: true, force: true });
      }
    };
  } catch (error) {
    if (proxy) await proxy.close().catch(function () {});
    if (originRuntime) await stopOrigin(originRuntime.child);
    fs.rmSync(tempRoot, { recursive: true, force: true });
    throw error;
  }
}

async function runCli() {
  var harness = await createEvidenceHarness();
  process.stdout.write(JSON.stringify({ event: "ready", url: harness.url, origin: harness.origin, controllerUrl: harness.controllerUrl }) + "\n");
  var input = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
  var shuttingDown = false;
  async function shutdown(code) {
    if (shuttingDown) return;
    shuttingDown = true;
    input.close();
    try { await harness.close(); }
    catch (error) { process.stderr.write(error.stack + "\n"); code = 1; }
    process.exit(code || 0);
  }
  input.on("line", function (line) {
    var command = String(line).trim().toLowerCase();
    if (!command) return;
    if (command === "shutdown") return void shutdown(0);
    if (command === "offline") harness.drop();
    else if (command === "online") harness.restore();
    else {
      process.stdout.write(JSON.stringify({ event: "error", command: command, error: "unknown-command" }) + "\n");
      return;
    }
    process.stdout.write(JSON.stringify({ event: "transport", command: command, offline: harness.isOffline() }) + "\n");
  });
  input.on("close", function () { if (!shuttingDown) void shutdown(0); });
  process.on("SIGINT", function () { void shutdown(0); });
  process.on("SIGTERM", function () { void shutdown(0); });
}

if (require.main === module) runCli().catch(function (error) {
  process.stderr.write(error.stack + "\n");
  process.exit(1);
});

module.exports = { createEvidenceHarness: createEvidenceHarness, createFaultProxy: createFaultProxy, evidenceRoster: evidenceRoster };
