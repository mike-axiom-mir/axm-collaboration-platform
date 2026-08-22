#!/usr/bin/env node
"use strict";

var http = require("http");
var fs = require("fs");
var path = require("path");
var Core = require("./casino-core.js");
var Adapter = require("./game-hub-adapter.js");
var SeatInterface = require("./seat-interface.js");

var HOST = process.env.CASINO_ALPHA_HOST || "0.0.0.0";
var PORT = Number(process.env.PORT || process.env.CASINO_ALPHA_PORT || 8797);
var ROOT = path.resolve(__dirname, "..");
var CLIENT_ROOT = path.join(ROOT, "client");
var THREE_VENDOR = path.resolve(ROOT, "../../../../../shared/vendor/three-r160/three.module.js");

function defaultStatePath() {
  var workshopRoot = path.resolve(ROOT, "../../../../..");
  var isWorkshopTree = fs.existsSync(path.join(workshopRoot, "server.js")) && fs.existsSync(path.join(workshopRoot, "tools", "game-hub"));
  if (isWorkshopTree) return path.join(workshopRoot, "state", "game-hub", "007-casino", "local-state.json");
  return path.join(ROOT, "data", "local-state.json");
}

var STATE_PATH = process.env.CASINO_ALPHA_STATE_PATH || defaultStatePath();
var SESSION_ID = String(process.env.AXM_GAME_SESSION_ID || "").trim();
var TICK_MS = 250;
var session = null;
var launchError = null;
var persistedState = null;
var persistenceError = null;
var lastSavedToken = null;
var lastSaveAt = 0;

var STATIC_FILES = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/index.html", ["index.html", "text/html; charset=utf-8"]],
  ["/app.js", ["app.js", "text/javascript; charset=utf-8"]],
  ["/casino-three.js", ["casino-three.js", "text/javascript; charset=utf-8"]],
  ["/styles.css", ["styles.css", "text/css; charset=utf-8"]]
]);

function headers(type) {
  var output = {
    "content-type": type,
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    "permissions-policy": "camera=(), microphone=(), geolocation=(), display-capture=()"
  };
  if (type.indexOf("text/html") === 0) {
    output["content-security-policy"] = "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-src 'none'; frame-ancestors 'self'";
  }
  return output;
}

function sendJson(response, statusCode, value) {
  response.writeHead(statusCode, headers("application/json; charset=utf-8"));
  response.end(JSON.stringify(value));
}

function sendFile(response, filePath, type) {
  response.writeHead(200, headers(type));
  fs.createReadStream(filePath).on("error", function () {
    if (!response.headersSent) sendJson(response, 500, { ok: false, error: "local client asset unavailable" });
    else response.end();
  }).pipe(response);
}

function readJson(request) {
  return new Promise(function (resolve, reject) {
    var body = "";
    request.on("data", function (chunk) {
      body += chunk;
      if (body.length > 524288) request.destroy(new Error("request body too large"));
    });
    request.on("end", function () {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch (_) { reject(new Error("invalid JSON body")); }
    });
    request.on("error", reject);
  });
}

function isLoopback(request) {
  var address = String(request.socket && request.socket.remoteAddress || "");
  return address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1";
}

function loadState() {
  if (!fs.existsSync(STATE_PATH)) return null;
  try {
    var parsed = JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));
    if (!parsed || parsed.schema !== "axm.casino-local-state/v1" || !Number.isSafeInteger(parsed.jackpotUnits)) {
      throw new Error("unsupported or malformed local state document");
    }
    return parsed;
  } catch (error) {
    persistenceError = "Local state was not loaded or overwritten: " + error.message;
    return null;
  }
}

function mergePersistent(next) {
  var merged = JSON.parse(JSON.stringify(next));
  if (!merged.story && persistedState && persistedState.story) merged.story = JSON.parse(JSON.stringify(persistedState.story));
  return merged;
}

function saveState(force) {
  if (!session || persistenceError) return false;
  var next = mergePersistent(session.exportPersistentState());
  var token = JSON.stringify(next);
  if (!force && (token === lastSavedToken || Date.now() - lastSaveAt < 2000)) return false;
  var directory = path.dirname(STATE_PATH);
  var temporary = STATE_PATH + ".tmp";
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(temporary, token + "\n", { encoding: "utf8", mode: 0o600 });
  fs.renameSync(temporary, STATE_PATH);
  persistedState = next;
  lastSavedToken = token;
  lastSaveAt = Date.now();
  return true;
}

function selectedPlayersFromEnvironment() {
  var raw = [];
  try { raw = JSON.parse(process.env.AXM_PLAYERS_JSON || "[]"); }
  catch (error) { throw new Error("AXM_PLAYERS_JSON is invalid: " + error.message); }
  return Adapter.normalizePlayers(raw);
}

function startSession(options) {
  var resolved = options || {};
  var players = resolved.players;
  var mode = resolved.mode;
  if (!players) {
    players = Adapter.createStandalonePlayers(mode, resolved.playerCount || resolved.teamSize || 1, resolved.names || []);
  }
  var roster = Adapter.validateRoster(players, mode, resolved.allowUneven === true);
  if (!roster.ok) throw new Core.CasinoError("INVALID_ROSTER", roster.errors.join("; "));
  session = new Core.CasinoSession({
    sessionId: resolved.sessionId || SESSION_ID || undefined,
    mode: roster.mode,
    players: players,
    allowUneven: resolved.allowUneven === true,
    persistentState: persistedState,
    durationMs: resolved.durationMs,
    seed: resolved.seed,
    worldSeed: resolved.worldSeed
  });
  launchError = null;
  saveState(true);
  return session;
}

function bootManagedSession() {
  try {
    var players = selectedPlayersFromEnvironment();
    if (!players.length) return;
    var requestedMode = String(process.env.AXM_GAME_PLAY_MODE || "").trim();
    startSession({
      sessionId: SESSION_ID || undefined,
      players: players,
      mode: requestedMode || Adapter.inferMode(players),
      allowUneven: process.env.CASINO_ALPHA_ALLOW_UNEVEN === "1"
    });
  } catch (error) {
    launchError = error.message;
  }
}

function requireSession() {
  if (!session) throw new Core.CasinoError("SESSION_NOT_RUNNING", "no casino session is running", 404);
  return session;
}

function hostToken(request, url, body) {
  return String(request.headers["x-axm-host-token"] || url.searchParams.get("hostToken") || body && body.hostToken || "");
}

function playerToken(request, url, body) {
  return String(request.headers["x-axm-seat-token"] || url.searchParams.get("token") || body && body.token || "");
}

function launchInfo(active, baseUrl) {
  var launch = active.launchInfo(active.hostToken, baseUrl);
  launch.adapterBindings = SeatInterface.publicAdapterBindings(active);
  return launch;
}

function publicConfig() {
  return {
    ok: true,
    game_id: Core.GAME_ID,
    version: Core.VERSION,
    local_only: true,
    host_scope: HOST === "127.0.0.1" ? "loopback" : "local-lan",
    outside_network_required: false,
    phase: launchError ? "launch-error" : (session ? session.status : "waiting"),
    launch_error: launchError,
    persistence_error: persistenceError,
    session: session ? session.publicState() : null
  };
}

persistedState = loadState();
bootManagedSession();

var server = http.createServer(async function (request, response) {
  try {
    var url = new URL(request.url || "/", "http://casino-alpha.local");
    var item;
    var body;
    var active;

    if (request.method === "GET" && STATIC_FILES.has(url.pathname)) {
      item = STATIC_FILES.get(url.pathname);
      return sendFile(response, path.join(CLIENT_ROOT, item[0]), item[1]);
    }
    if (request.method === "GET" && url.pathname === "/vendor/three.module.js") {
      return sendFile(response, THREE_VENDOR, "text/javascript; charset=utf-8");
    }
    if (request.method === "GET" && (url.pathname === "/health" || url.pathname === "/state" || url.pathname === "/config")) {
      var status = launchError && url.pathname === "/state" ? 503 : 200;
      return sendJson(response, status, publicConfig());
    }
    if (request.method === "GET" && url.pathname === "/api/host/bootstrap") {
      if (!isLoopback(request)) return sendJson(response, 403, { ok: false, error: "host bootstrap is loopback-only" });
      if (!session) return sendJson(response, 200, { ok: true, phase: "waiting", launchError: launchError, persistenceError: persistenceError });
      return sendJson(response, 200, {
        ok: true,
        phase: session.status,
        launch: launchInfo(session, "."),
        state: session.observeHost(session.hostToken),
        persistenceError: persistenceError
      });
    }
    if (request.method === "POST" && url.pathname === "/api/host/start") {
      if (!isLoopback(request)) return sendJson(response, 403, { ok: false, error: "session creation is loopback-only" });
      if (persistenceError) return sendJson(response, 409, { ok: false, error: persistenceError });
      if (session && session.status === "running") return sendJson(response, 409, { ok: false, error: "a casino session is already running" });
      body = await readJson(request);
      active = startSession({
        mode: body.mode === "house_war" ? "house_war" : "backroom_story",
        playerCount: body.playerCount,
        teamSize: body.teamSize,
        names: body.names,
        allowUneven: false
      });
      return sendJson(response, 201, { ok: true, launch: launchInfo(active, "."), state: active.observeHost(active.hostToken) });
    }
    if (request.method === "GET" && url.pathname === "/api/host/state") {
      active = requireSession();
      return sendJson(response, 200, active.observeHost(hostToken(request, url)));
    }
    if (request.method === "GET" && url.pathname === "/api/party/state") {
      active = requireSession();
      return sendJson(response, 200, active.observeParty(
        String(url.searchParams.get("party") || "A").toUpperCase(),
        playerToken(request, url)
      ));
    }
    if (request.method === "GET" && url.pathname === "/api/player/state") {
      active = requireSession();
      return sendJson(response, 200, active.observePlayer(String(url.searchParams.get("seat") || ""), playerToken(request, url)));
    }
    if (request.method === "GET" && url.pathname === "/api/adapter/state") {
      active = requireSession();
      return sendJson(response, 200, SeatInterface.buildAdapterObservation(active, {
        sessionId: String(url.searchParams.get("session") || ""),
        seatId: String(url.searchParams.get("seat") || ""),
        token: playerToken(request, url)
      }));
    }
    if (request.method === "POST" && url.pathname === "/api/adapter/intent") {
      active = requireSession();
      body = await readJson(request);
      var adapterReceipt = SeatInterface.routeIntent(active, Object.assign({}, body, {
        token: playerToken(request, url, body)
      }), { requireAdapter: true, requireSessionId: true });
      saveState(false);
      return sendJson(response, 200, adapterReceipt);
    }
    if (request.method === "POST" && url.pathname === "/api/player/command") {
      active = requireSession();
      body = await readJson(request);
      var receipt = SeatInterface.routeIntent(active, Object.assign({}, body, {
        token: playerToken(request, url, body)
      }));
      saveState(false);
      return sendJson(response, 200, receipt);
    }
    if (request.method === "POST" && url.pathname === "/api/host/advance") {
      active = requireSession();
      body = await readJson(request);
      active.assertHost(hostToken(request, url, body));
      active.advance(Math.min(120000, Math.max(0, Number(body.milliseconds) || 0)));
      saveState(false);
      return sendJson(response, 200, active.observeHost(active.hostToken));
    }
    if (request.method === "POST" && url.pathname === "/api/host/end") {
      active = requireSession();
      body = await readJson(request);
      active.assertHost(hostToken(request, url, body));
      var result = active.end("host_ended", null);
      saveState(true);
      return sendJson(response, 200, { ok: true, result_summary: result });
    }
    if (request.method === "GET" && url.pathname === "/api/result") {
      active = requireSession();
      if (!active.result) return sendJson(response, 409, { ok: false, error: "session has no terminal result" });
      return sendJson(response, 200, { ok: true, result_summary: active.result });
    }
    if (url.pathname === "/favicon.ico") {
      response.writeHead(204, headers("image/x-icon"));
      return response.end();
    }
    return sendJson(response, 404, { ok: false, error: "not found" });
  } catch (error) {
    var code = error && error.statusCode || 400;
    return sendJson(response, code, { ok: false, code: error.code || "REQUEST_FAILED", error: error.message });
  }
});

var timer = setInterval(function () {
  try {
    if (session && session.status === "running") {
      session.advance(TICK_MS);
      saveState(false);
    }
  } catch (error) {
    launchError = "Runtime tick stopped safely: " + error.message;
    clearInterval(timer);
  }
}, TICK_MS);
timer.unref();

server.listen(PORT, HOST, function () {
  console.log("Casino Alpha " + Core.VERSION + " · WORKING local runtime");
  console.log("Local host: http://127.0.0.1:" + PORT + "/?role=host");
  console.log("Authority: server ledger + casino-wide 50K Draw Spine + ten immutable slot books");
  if (launchError) console.error("Launch error: " + launchError);
  if (persistenceError) console.error(persistenceError);
});

function shutdown() {
  clearInterval(timer);
  try { saveState(true); } catch (_) {}
  server.close(function () { process.exit(0); });
  setTimeout(function () { process.exit(0); }, 500).unref();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

module.exports = { server: server, publicConfig: publicConfig };
