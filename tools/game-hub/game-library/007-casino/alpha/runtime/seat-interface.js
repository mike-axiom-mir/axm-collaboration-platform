"use strict";

var INPUT_PROTOCOL = "axm-semantic-input-v1";
var OBSERVATION_PROTOCOL = "axm-seat-screen-semantics-v1";
var OBSERVATION_PROFILE = "axm.casino-alpha-adapter-observation/v1";
var AUTHORITY_GATE = "casino-alpha-seat-authority-v1";
var COMMAND_TYPES = new Set(["travel", "select_machine", "set_wager", "spin", "fund_house", "withdraw_house"]);
var OUTCOME_FIELDS = new Set([
  "wallet", "walletUnits", "house", "houseUnits", "jackpot", "jackpotUnits",
  "payout", "totalPayout", "drawIndex", "drawTicket", "drawSpine", "styleRowIndex",
  "result", "receipt", "freeSpinsRemaining", "selectedWagerUnits", "state", "events"
]);
var ENVELOPE_FIELDS = new Set(["sessionId", "seatId", "token", "sequence", "requestId", "intent", "command"]);
var rateLedgers = new WeakMap();

function fault(code, message, statusCode, extra) {
  var error = new Error(message);
  error.code = code;
  error.statusCode = statusCode || 400;
  if (extra) Object.assign(error, extra);
  return error;
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function finiteNumber(value, field) {
  if (typeof value !== "number" || !Number.isFinite(value)) throw fault("INVALID_INTENT", field + " must be a finite number", 400);
  return value;
}

function boundedText(value, field) {
  if (typeof value !== "string" || !value.trim() || value.length > 80) throw fault("INVALID_INTENT", field + " must be a bounded string", 400);
  return value.trim();
}

function rejectUnknownFields(value, allowed) {
  Object.keys(value).forEach(function (field) {
    if (OUTCOME_FIELDS.has(field)) throw fault("OUTCOME_FIELD_REJECTED", "client-authored outcome field rejected: " + field, 400, { field: field });
    if (!allowed.has(field)) throw fault("UNKNOWN_INTENT_FIELD", "unknown intention field: " + field, 400, { field: field });
  });
}

function sanitizeIntent(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw fault("INTENT_OBJECT_REQUIRED", "intent must be an object", 400);
  var type = value.type;
  if (typeof type !== "string" || !COMMAND_TYPES.has(type)) throw fault("UNKNOWN_INTENT", "unsupported casino intention: " + String(type || ""), 400);
  var output = { type: type };

  if (type === "travel") {
    rejectUnknownFields(value, new Set(["type", "location", "targetId"]));
    output.location = boundedText(value.location || value.targetId, "location");
    return output;
  }
  if (type === "select_machine") {
    rejectUnknownFields(value, new Set(["type", "styleId"]));
    output.styleId = boundedText(value.styleId, "styleId");
    return output;
  }
  if (type === "set_wager") {
    rejectUnknownFields(value, new Set(["type", "wager"]));
    output.wager = finiteNumber(value.wager, "wager");
    if ([1, 2, 5, 10].indexOf(output.wager) === -1) throw fault("INVALID_WAGER", "wager must be 1, 2, 5, or 10 simulated credits", 400);
    return output;
  }
  if (type === "spin") {
    rejectUnknownFields(value, new Set(["type", "wager"]));
    if (value.wager !== undefined) {
      output.wager = finiteNumber(value.wager, "wager");
      if ([1, 2, 5, 10].indexOf(output.wager) === -1) throw fault("INVALID_WAGER", "wager must be 1, 2, 5, or 10 simulated credits", 400);
    }
    return output;
  }
  rejectUnknownFields(value, new Set(["type", "amount"]));
  output.amount = finiteNumber(value.amount, "amount");
  if (output.amount <= 0 || output.amount > 100000) throw fault("INVALID_AMOUNT", "amount must be greater than 0 and no more than 100000 simulated credits", 400);
  return output;
}

function authenticate(session, packet, requireAdapter, requireSessionId) {
  var seatId = String(packet && packet.seatId || "");
  var actor = session.players[seatId];
  if (!actor) throw fault("SEAT_NOT_ACTIVE", "that seat is not active", 404);
  if (!session.tokensEqual(packet.token, actor.token)) throw fault("SEAT_TOKEN_REJECTED", "seat token rejected", 403);
  if (requireAdapter && actor.controllerType !== "adapter") throw fault("ADAPTER_SEAT_REQUIRED", "an explicitly assigned adapter seat is required", 403);
  if (requireSessionId && String(packet.sessionId || "") !== session.sessionId) throw fault("SESSION_BINDING_REJECTED", "adapter packet is bound to another session", 409);
  return actor;
}

function checkRate(session, seatId, now) {
  var bySeat = rateLedgers.get(session);
  if (!bySeat) {
    bySeat = new Map();
    rateLedgers.set(session, bySeat);
  }
  var ledger = (bySeat.get(seatId) || []).filter(function (at) { return now - at < 1000; });
  if (ledger.length >= 40) throw fault("SEAT_RATE_LIMIT", "seat command rate exceeded", 429);
  ledger.push(now);
  bySeat.set(seatId, ledger);
}

function routeIntent(session, packet, options) {
  var resolved = options || {};
  var value = packet || {};
  var actor = authenticate(session, value, resolved.requireAdapter === true, resolved.requireSessionId === true);
  rejectUnknownFields(value, ENVELOPE_FIELDS);
  if (value.intent !== undefined && value.command !== undefined) throw fault("AMBIGUOUS_INTENT", "send intent or command, not both", 400);
  var sanitized = sanitizeIntent(value.intent !== undefined ? value.intent : value.command);
  checkRate(session, actor.seatId, Date.now());
  var receipt = session.command({
    seatId: actor.seatId,
    token: value.token,
    sequence: value.sequence,
    requestId: value.requestId,
    command: sanitized
  });
  return Object.assign({}, receipt, {
    gate: AUTHORITY_GATE,
    protocol: INPUT_PROTOCOL,
    seatId: actor.seatId,
    sanitized: clone(sanitized)
  });
}

function publicAdapterBindings(session) {
  return Object.keys(session.players).map(function (seatId) { return session.players[seatId]; })
    .filter(function (player) { return player.controllerType === "adapter"; })
    .map(function (player) {
      return {
        sessionId: session.sessionId,
        seatId: player.seatId,
        slot: player.slot,
        displayName: player.displayName,
        partyId: player.partyId,
        controllerType: "adapter",
        adapterId: player.adapterId,
        token: player.token,
        protocol: INPUT_PROTOCOL,
        observation: OBSERVATION_PROTOCOL,
        observationProfile: OBSERVATION_PROFILE,
        inputEndpoint: "/api/adapter/intent",
        observationEndpoint: "/api/adapter/state"
      };
    });
}

function buildAdapterObservation(session, request) {
  var value = request || {};
  var actor = authenticate(session, value, true, true);
  var state = session.observePlayer(actor.seatId, value.token);
  var own = Object.assign({ controllerType: "adapter" }, state.ownPlayer);
  return {
    ok: true,
    schema: OBSERVATION_PROTOCOL,
    profile: OBSERVATION_PROFILE,
    scope: "seat-and-shared-screen-visible-only",
    gameId: state.gameId,
    version: state.version,
    sessionId: state.sessionId,
    mode: state.mode,
    status: state.status,
    nowMs: state.nowMs,
    self: own,
    hud: {
      startedAtMs: state.startedAtMs,
      endsAtMs: state.endsAtMs,
      remainingMs: state.remainingMs,
      jackpot: state.jackpot,
      jackpotHeat: state.jackpotHeat,
      machineOpen: state.machineOpen,
      drawSpine: state.drawSpine,
      contest: state.contest,
      result: state.result
    },
    visible: {
      styles: state.styles,
      parties: state.parties,
      players: state.players,
      spots: state.spots,
      activeNpcCounts: state.activeNpcCounts,
      abilitySlots: state.abilitySlots,
      events: state.events
    },
    controls: {
      gate: AUTHORITY_GATE,
      protocol: INPUT_PROTOCOL,
      inputEndpoint: "/api/adapter/intent",
      allowedIntent: {
        travel: "location",
        select_machine: "styleId",
        set_wager: "wager 1|2|5|10 simulated credits",
        spin: "optional wager 1|2|5|10 simulated credits",
        fund_house: "positive simulated-credit amount",
        withdraw_house: "positive simulated-credit amount"
      },
      nextSequenceMinimum: Number(own.acceptedSequence || 0) + 1
    },
    limits: [
      "No seat, party, or host tokens",
      "No session seed, draw permutation, future outcome row, or random state",
      "No request cache or rate ledger",
      "No client-authored wallet, house, jackpot, payout, draw, free-spin, or result state",
      "All credits are simulated local game values with no purchase or cash-out path"
    ]
  };
}

module.exports = Object.freeze({
  AUTHORITY_GATE: AUTHORITY_GATE,
  INPUT_PROTOCOL: INPUT_PROTOCOL,
  OBSERVATION_PROFILE: OBSERVATION_PROFILE,
  OBSERVATION_PROTOCOL: OBSERVATION_PROTOCOL,
  buildAdapterObservation: buildAdapterObservation,
  publicAdapterBindings: publicAdapterBindings,
  routeIntent: routeIntent,
  sanitizeIntent: sanitizeIntent
});
