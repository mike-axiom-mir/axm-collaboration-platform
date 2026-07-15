#!/usr/bin/env node
"use strict";

var assert = require("assert");
var http = require("http");
var path = require("path");
var ledgerTools = require("./ledger.js");
var sessionTools = require("./session.js");
var serverTools = require("./server.js");
var luxRoot = path.resolve(__dirname, "../../slots/lux-5");
var canonicalRng = require(path.join(luxRoot, "lux5-rng.js"));
var canonicalBookTools = require(path.join(luxRoot, "lux5-outcome-book.js"));

function requestJson(port, method, route, body, contentType) {
  return new Promise(function (resolve, reject) {
    var encoded = body === undefined ? null : Buffer.from(JSON.stringify(body), "utf8");
    var request = http.request(
      {
        hostname: "127.0.0.1",
        port: port,
        path: route,
        method: method,
        headers: encoded
          ? {
              "Content-Type": contentType || "application/json",
              "Content-Length": encoded.length
            }
          : {}
      },
      function (response) {
        var chunks = [];
        response.on("data", function (chunk) {
          chunks.push(chunk);
        });
        response.on("end", function () {
          var parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
          resolve({ statusCode: response.statusCode, body: parsed });
        });
      }
    );
    request.on("error", reject);
    if (encoded) {
      request.write(encoded);
    }
    request.end();
  });
}

async function main() {
  var ledger = new ledgerTools.Ledger({ wallet: 10, house: 20, jackpot: 5 });
  var initial = ledger.totalUnits();
  ledger.transferUnits("test", "wallet", "house", ledgerTools.creditsToUnits(2, "test"));
  assert.strictEqual(ledger.totalUnits(), initial);
  assert.strictEqual(ledger.balances().wallet, 8);
  assert.strictEqual(ledger.assertConserved(), true);

  var first = new sessionTools.Lux5Session({
    seed: "runtime-selftest-seed",
    testOnlyBookLength: 500,
    wallet: 250,
    house: 5000,
    jackpot: 100
  });
  var second = new sessionTools.Lux5Session({
    seed: "runtime-selftest-seed",
    testOnlyBookLength: 500,
    wallet: 250,
    house: 5000,
    jackpot: 100
  });
  var canonicalBook = canonicalRng.buildBook("runtime-selftest-seed", 500);
  assert.ok(
    first._book.equals(canonicalBook),
    "runtime book must be byte-identical to the canonical workbench generator"
  );
  assert.deepStrictEqual(
    first.spin(2, "same-first-spin").sourceRow,
    {
      stops: canonicalBookTools.rowAt(canonicalBook, 0).stops,
      wheelIndex: canonicalBookTools.rowAt(canonicalBook, 0).wheelIndex,
      jackpotTicket: canonicalBookTools.rowAt(canonicalBook, 0).jackpotTicket
    },
    "runtime first source row must equal the canonical workbench row"
  );
  var one = first.state().lastSpin;
  var two = second.spin(2, "same-first-spin");
  assert.deepStrictEqual(one.grid, two.grid, "same seed/cursor must replay the same grid");
  assert.strictEqual(one.jackpot.ticket, two.jackpot.ticket);
  assert.strictEqual(one.index, 0);
  assert.strictEqual(first.state().cursor, 1);
  assert.throws(
    function () {
      first.spin(2, "same-first-spin");
    },
    function (error) {
      return error.code === "DUPLICATE_SPIN";
    }
  );
  assert.strictEqual(first.state().cursor, 1, "duplicate request must not consume a row");
  assert.strictEqual(
    first.state().balances.wallet +
      first.state().balances.house +
      first.state().balances.jackpot,
    5350,
    "all settlement must stay inside the three-account ledger"
  );
  assert.strictEqual(one.jackpotContribution, 0.1, "paid spin contributes exactly 5%");

  var lowWagerSession = new sessionTools.Lux5Session({
    seed: "wager-neutrality",
    testOnlyBookLength: 4
  });
  var highWagerSession = new sessionTools.Lux5Session({
    seed: "wager-neutrality",
    testOnlyBookLength: 4
  });
  var lowWagerSpin = lowWagerSession.spin(1);
  var highWagerSpin = highWagerSession.spin(10);
  assert.deepStrictEqual(lowWagerSpin.grid, highWagerSpin.grid);
  assert.deepStrictEqual(lowWagerSpin.wheel, highWagerSpin.wheel);
  assert.strictEqual(lowWagerSpin.jackpot.ticket, highWagerSpin.jackpot.ticket);
  assert.notStrictEqual(
    lowWagerSpin.jackpot.cap,
    highWagerSpin.jackpot.cap,
    "wager may scale money but never the source outcome"
  );

  var debtSession = new sessionTools.Lux5Session({
    seed: "debt-seed-2",
    testOnlyBookLength: 2,
    wallet: 10,
    house: 0.01,
    jackpot: 0
  });
  var debtWin = debtSession.spin(1);
  assert.strictEqual(debtWin.slotPayout, 2.25);
  assert.ok(debtSession.state().balances.house < 0, "resolved win must be honored as debt");
  assert.strictEqual(debtSession.state().blockReason, "HOUSE_BANKRUPT");
  assert.throws(
    function () {
      debtSession.spin(1);
    },
    function (error) {
      return error.code === "HOUSE_BANKRUPT";
    }
  );
  assert.strictEqual(debtSession.state().cursor, 1);

  // Find a scatter deterministically and prove the queued spin keeps its bet,
  // costs nothing, and still consumes exactly one global outcome.
  while (first.state().freeSpins.remaining === 0 && first.state().cursor < 500) {
    first.spin(5);
  }
  assert.ok(first.state().freeSpins.remaining > 0, "test seed must reach a free-spin award");
  var beforeFree = first.state();
  var free = first.spin();
  var afterFree = first.state();
  assert.strictEqual(free.mode, "free");
  assert.strictEqual(free.wager, 5);
  assert.strictEqual(free.jackpotContribution, 0);
  assert.strictEqual(afterFree.cursor, beforeFree.cursor + 1);

  var apiSession = new sessionTools.Lux5Session({
    seed: "runtime-http-selftest",
    testOnlyBookLength: 100
  });
  var server = serverTools.createPrototypeServer({
    session: apiSession,
    sessionFactory: function () {
      return new sessionTools.Lux5Session({
        seed: "runtime-http-reset",
        testOnlyBookLength: 100
      });
    }
  });
  await new Promise(function (resolve, reject) {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  try {
    var port = server.address().port;
    var stateResult = await requestJson(port, "GET", "/api/state");
    assert.strictEqual(stateResult.statusCode, 200);
    assert.strictEqual(stateResult.body.state.cursor, 0);
    var plainTextSpin = await requestJson(
      port,
      "POST",
      "/api/spin",
      { wager: 1 },
      "text/plain"
    );
    assert.strictEqual(plainTextSpin.statusCode, 415);
    assert.strictEqual(plainTextSpin.body.error.code, "UNSUPPORTED_MEDIA_TYPE");
    assert.strictEqual(plainTextSpin.body.state.cursor, 0);
    assert.strictEqual(plainTextSpin.body.state.sessionId, stateResult.body.state.sessionId);
    var badSpin = await requestJson(port, "POST", "/api/spin", { wager: 3 });
    assert.strictEqual(badSpin.statusCode, 400);
    assert.strictEqual(badSpin.body.error.code, "INVALID_WAGER");
    var goodSpin = await requestJson(port, "POST", "/api/spin", {
      wager: 1,
      requestId: "http-spin-1"
    });
    assert.strictEqual(goodSpin.statusCode, 200);
    assert.strictEqual(goodSpin.body.spin.index, 0);
    assert.strictEqual(goodSpin.body.state.cursor, 1);
    var duplicateSpin = await requestJson(port, "POST", "/api/spin", {
      wager: 1,
      requestId: "http-spin-1"
    });
    assert.strictEqual(duplicateSpin.statusCode, 409);
    assert.strictEqual(duplicateSpin.body.error.code, "DUPLICATE_SPIN");
    assert.strictEqual(duplicateSpin.body.state.cursor, 1);
    var concurrent = await Promise.all([
      requestJson(port, "POST", "/api/spin", { wager: 1, requestId: "parallel-a" }),
      requestJson(port, "POST", "/api/spin", { wager: 10, requestId: "parallel-b" })
    ]);
    assert.deepStrictEqual(
      concurrent.map(function (result) {
        return result.body.spin.index;
      }).sort(function (left, right) {
        return left - right;
      }),
      [1, 2],
      "concurrent requests must consume distinct sequential rows"
    );

    var deniedReset = await requestJson(port, "POST", "/api/reset", {});
    assert.strictEqual(deniedReset.statusCode, 400);
    assert.strictEqual(deniedReset.body.error.code, "RESET_CONFIRMATION_REQUIRED");
    assert.strictEqual(deniedReset.body.state.cursor, 3);
    var acceptedReset = await requestJson(port, "POST", "/api/reset", { confirm: true });
    assert.strictEqual(acceptedReset.statusCode, 200);
    assert.strictEqual(acceptedReset.body.state.cursor, 0);
    assert.notStrictEqual(acceptedReset.body.state.sessionId, apiSession.state().sessionId);

    var traversal = await requestJson(port, "GET", "/..%2Fruntime%2Fserver.js");
    assert.strictEqual(traversal.statusCode, 403);
    var missing = await requestJson(port, "GET", "/definitely-missing.asset");
    assert.strictEqual(missing.statusCode, 404);

    var headResult = await new Promise(function (resolve, reject) {
      var headRequest = http.request(
        {
          hostname: "127.0.0.1",
          port: port,
          path: "/vendor/three.module.js",
          method: "HEAD"
        },
        function (response) {
          var bytes = 0;
          response.on("data", function (chunk) {
            bytes += chunk.length;
          });
          response.on("end", function () {
            resolve({ statusCode: response.statusCode, bytes: bytes });
          });
        }
      );
      headRequest.on("error", reject);
      headRequest.end();
    });
    assert.strictEqual(headResult.statusCode, 200);
    assert.strictEqual(headResult.bytes, 0);
  } finally {
    await new Promise(function (resolve) {
      server.close(resolve);
    });
  }

  console.log("LUX-5 runtime self-test passed.");
}

main().catch(function (error) {
  console.error(error.stack || error);
  process.exitCode = 1;
});
