#!/usr/bin/env node
"use strict";

var fs = require("fs");
var http = require("http");
var path = require("path");
var sessionTools = require("./session.js");

var DEFAULT_HOST = "127.0.0.1";
var DEFAULT_PORT = 4175;
var MAX_BODY_BYTES = 16384;
var CLIENT_ROOT = path.resolve(__dirname, "../client");
var SECURITY_HEADERS = Object.freeze({
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()"
});

var MIME_TYPES = Object.freeze({
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".webp": "image/webp"
});

function writeJson(response, statusCode, value) {
  var body = Buffer.from(JSON.stringify(value), "utf8");
  response.writeHead(statusCode, Object.assign({}, SECURITY_HEADERS, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": body.length,
    "Cache-Control": "no-store"
  }));
  response.end(body);
}

function readJson(request) {
  var contentType = String(request.headers["content-type"] || "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (contentType !== "application/json") {
    return Promise.reject(
      new sessionTools.SessionError(
        "UNSUPPORTED_MEDIA_TYPE",
        "Prototype POST routes require Content-Type: application/json.",
        415
      )
    );
  }

  return new Promise(function (resolve, reject) {
    var chunks = [];
    var size = 0;

    request.on("data", function (chunk) {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new sessionTools.SessionError("BODY_TOO_LARGE", "JSON body is too large.", 413));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", function () {
      if (chunks.length === 0) {
        resolve({});
        return;
      }
      try {
        var parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          throw new Error("body must be a JSON object");
        }
        resolve(parsed);
      } catch (error) {
        reject(new sessionTools.SessionError("INVALID_JSON", error.message, 400));
      }
    });
    request.on("error", reject);
  });
}

function safeClientPath(urlPath) {
  var decoded;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch (error) {
    return null;
  }
  if (decoded === "/") {
    decoded = "/index.html";
  }
  var resolved = path.resolve(CLIENT_ROOT, "." + decoded);
  if (resolved !== CLIENT_ROOT && resolved.indexOf(CLIENT_ROOT + path.sep) !== 0) {
    return null;
  }
  return resolved;
}

function serveStatic(request, response, urlPath) {
  var filePath = safeClientPath(urlPath);
  if (!filePath) {
    writeJson(response, 403, {
      ok: false,
      error: { code: "FORBIDDEN_PATH", message: "Static path is outside the client root." }
    });
    return;
  }

  fs.stat(filePath, function (statError, stat) {
    if (statError || !stat.isFile()) {
      writeJson(response, 404, {
        ok: false,
        error: { code: "NOT_FOUND", message: "No file exists at this path." }
      });
      return;
    }

    var headers = Object.assign({}, SECURITY_HEADERS, {
      "Content-Type": MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      "Content-Length": stat.size,
      "Cache-Control": "no-cache"
    });
    response.writeHead(200, headers);
    if (request.method === "HEAD") {
      response.end();
      return;
    }
    fs.createReadStream(filePath).pipe(response);
  });
}

function createPrototypeServer(options) {
  var resolved = options || {};
  var sessionFactory = resolved.sessionFactory || function () {
    return new sessionTools.Lux5Session();
  };
  var currentSession = resolved.session || sessionFactory();
  var spinBusy = false;

  var server = http.createServer(async function (request, response) {
    var requestUrl;
    try {
      requestUrl = new URL(request.url, "http://localhost");

      if (request.method === "GET" && requestUrl.pathname === "/api/state") {
        writeJson(response, 200, { ok: true, state: currentSession.state() });
        return;
      }

      if (request.method === "GET" && requestUrl.pathname === "/api/health") {
        writeJson(response, 200, {
          ok: true,
          service: "lux5-prototype",
          sessionId: currentSession.state().sessionId
        });
        return;
      }

      if (request.method === "POST" && requestUrl.pathname === "/api/spin") {
        var spinBody = await readJson(request);
        if (spinBusy) {
          throw new sessionTools.SessionError(
            "SPIN_BUSY",
            "Another spin is being settled; the cursor was not advanced.",
            409
          );
        }
        spinBusy = true;
        try {
          var spin = currentSession.spin(spinBody.wager, spinBody.requestId);
          writeJson(response, 200, {
            ok: true,
            spin: spin,
            state: currentSession.state()
          });
        } finally {
          spinBusy = false;
        }
        return;
      }

      if (request.method === "POST" && requestUrl.pathname === "/api/reset") {
        var resetBody = await readJson(request);
        if (resetBody.confirm !== true) {
          throw new sessionTools.SessionError(
            "RESET_CONFIRMATION_REQUIRED",
            "Reset requires the explicit JSON body {\"confirm\":true}.",
            400
          );
        }
        currentSession = sessionFactory();
        writeJson(response, 200, { ok: true, state: currentSession.state() });
        return;
      }

      if (requestUrl.pathname.indexOf("/api/") === 0) {
        writeJson(response, 404, {
          ok: false,
          error: { code: "API_NOT_FOUND", message: "Unknown prototype API route." }
        });
        return;
      }

      if (request.method === "GET" || request.method === "HEAD") {
        serveStatic(request, response, requestUrl.pathname);
        return;
      }

      writeJson(response, 405, {
        ok: false,
        error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed for this route." }
      });
    } catch (error) {
      var statusCode = error.statusCode || 500;
      var code = error.code || "INTERNAL_ERROR";
      var message = statusCode >= 500 ? "The prototype server hit an internal error." : error.message;
      writeJson(response, statusCode, {
        ok: false,
        error: { code: code, message: message },
        state: currentSession.state()
      });
      if (statusCode >= 500) {
        console.error(error.stack || error);
      }
    }
  });

  server.prototypeSession = function () {
    return currentSession;
  };
  return server;
}

function start() {
  var host = process.env.HOST || DEFAULT_HOST;
  var port = process.env.PORT ? Number(process.env.PORT) : DEFAULT_PORT;
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error("PORT must be an integer from 0 through 65535");
  }

  console.log("Generating a fresh 50,000-outcome LUX-5 session book...");
  var server = createPrototypeServer();
  server.listen(port, host, function () {
    var address = server.address();
    console.log("LUX-5 prototype: http://" + host + ":" + address.port + "/");
    console.log("Loopback-only by default. Nothing is uploaded or published.");
  });
}

if (require.main === module) {
  start();
}

module.exports = Object.freeze({
  createPrototypeServer: createPrototypeServer,
  defaultHost: DEFAULT_HOST,
  defaultPort: DEFAULT_PORT,
  clientRoot: CLIENT_ROOT
});
