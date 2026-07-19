"use strict";

var crypto = require("crypto");

function cleanText(value, fallback, maximum) {
  var text = String(value || "").replace(/[^a-z0-9 _.-]/gi, "").trim().slice(0, maximum || 40);
  return text || fallback;
}

function slotFromPlayer(player, index) {
  var direct = Number(player && (player.slot || player.seat_slot));
  var match;
  if (Number.isInteger(direct) && direct >= 1 && direct <= 8) return direct;
  match = String(player && player.seat_id || "").match(/(\d+)$/);
  if (match && Number(match[1]) >= 1 && Number(match[1]) <= 8) return Number(match[1]);
  return index + 1;
}

function normalizePlayers(players) {
  if (!Array.isArray(players)) throw new TypeError("players must be an array");
  var seen = new Set();
  var normalized = players.map(function (player, index) {
    var slot = slotFromPlayer(player, index);
    var seatId = "seat_" + slot;
    if (seen.has(seatId)) throw new Error("duplicate selected seat: " + seatId);
    seen.add(seatId);
    return {
      seatId: seatId,
      slot: slot,
      partyId: slot <= 4 ? "A" : "B",
      displayName: cleanText(player && player.display_name, "Player " + slot, 30),
      controllerType: ["human", "adapter", "ai"].indexOf(player && player.type) >= 0
        ? player.type
        : "human",
      adapterId: player && player.adapter_id ? cleanText(player.adapter_id, null, 60) : null
    };
  });
  normalized.sort(function (left, right) { return left.slot - right.slot; });
  return normalized;
}

function inferMode(players) {
  return players.some(function (player) { return player.partyId === "B"; })
    ? "house_war"
    : "backroom_story";
}

function validateRoster(players, requestedMode, allowUneven) {
  var mode = requestedMode || inferMode(players);
  var a = players.filter(function (player) { return player.partyId === "A"; });
  var b = players.filter(function (player) { return player.partyId === "B"; });
  var errors = [];
  if (players.length < 1 || players.length > 8) errors.push("one through eight ready seats are required");
  if (mode === "backroom_story") {
    if (b.length) errors.push("Backroom Story only accepts seats 1 through 4");
    if (a.length < 1 || a.length > 4) errors.push("Backroom Story needs one through four Party A seats");
  } else if (mode === "house_war") {
    if (!a.length || !b.length) errors.push("House War needs at least one ready seat in each party");
    if (!allowUneven && a.length !== b.length) errors.push("standard House War requires equal ready party sizes");
    if (a.length > 4 || b.length > 4) errors.push("a party may contain at most four seats");
  } else {
    errors.push("unsupported casino mode: " + mode);
  }
  return { ok: errors.length === 0, errors: errors, mode: mode, partyA: a, partyB: b };
}

function randomToken(bytes) {
  return crypto.randomBytes(bytes || 18).toString("base64url");
}

function createStandalonePlayers(mode, count, names) {
  var size = Math.max(1, Math.min(4, Number(count) || 1));
  var source = Array.isArray(names) ? names : [];
  var raw = [];
  var index;
  for (index = 1; index <= size; index += 1) {
    raw.push({ seat_id: "seat_" + index, slot: index, type: "human", display_name: source[index - 1] || "Player " + index });
  }
  if (mode === "house_war") {
    for (index = 1; index <= size; index += 1) {
      raw.push({ seat_id: "seat_" + (index + 4), slot: index + 4, type: "human", display_name: source[size + index - 1] || "Player " + (index + 4) });
    }
  }
  return normalizePlayers(raw);
}

module.exports = Object.freeze({
  cleanText: cleanText,
  createStandalonePlayers: createStandalonePlayers,
  inferMode: inferMode,
  normalizePlayers: normalizePlayers,
  randomToken: randomToken,
  validateRoster: validateRoster
});
