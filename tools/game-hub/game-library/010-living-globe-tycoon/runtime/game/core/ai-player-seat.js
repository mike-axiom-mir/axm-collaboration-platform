(function (root, factory) {
  'use strict';
  var api = factory(root.AXMTycoonCanonical || (typeof require === 'function' ? require('./canonical-state') : null));
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AXMAIPlayerSeat = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Canonical) {
  'use strict';

  if (!Canonical) throw new Error('AXMTycoonCanonical is required before AXMAIPlayerSeat.');

  var VERSION = '0.4.0';
  var SEAT_SCHEMA = 'axm.living-world.player-seat/v0.1';
  var OBSERVATION_SCHEMA = 'axm.living-world.ai-player-observation/v0.1';
  var INTENT_SCHEMA = 'axm.living-world.player-intent/v0.1';
  var RECEIPT_SCHEMA = 'axm.living-world.player-intent-receipt/v0.1';
  var SEAT_ID = 'hub-seat-ai-steward';
  var MAX_RECEIPTS = 100;
  var MAX_INTENT_IDS = 100;
  var SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/;
  var ALLOWED_INTENTS = Object.freeze(['MOVE', 'LOOK', 'SET_TOOL', 'ACT', 'WAIT']);
  var ALLOWED_TOOLS = Object.freeze(['chop', 'plant', 'campfire', 'fish', 'coop']);

  function clone(value) { return Canonical.clone(value); }
  function clamp(value, minimum, maximum) { return Math.max(minimum, Math.min(maximum, value)); }
  function finite(value) { return typeof value === 'number' && Number.isFinite(value); }
  function vec3(value) {
    return Array.isArray(value) && value.length === 3 && value.every(finite);
  }
  function length(v) { return Math.hypot(v[0], v[1], v[2]); }
  function scale(v, amount) { return [v[0] * amount, v[1] * amount, v[2] * amount]; }
  function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
  function subtract(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross(a, b) {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  }
  function normalize(v, fallback) {
    var n = length(v);
    if (!finite(n) || n < 1e-10) return fallback ? fallback.slice() : [0, 1, 0];
    return scale(v, 1 / n);
  }
  function tangentize(v, position) {
    return normalize(subtract(v, scale(position, dot(v, position))), Math.abs(position[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]);
  }
  function rotateAroundAxis(v, axis, angle) {
    var c = Math.cos(angle), s = Math.sin(angle);
    return add(add(scale(v, c), scale(cross(axis, v), s)), scale(axis, dot(axis, v) * (1 - c)));
  }
  function defaultForward(position) {
    var preferred = Math.abs(dot(position, [0, 0, 1])) < 0.94 ? [0, 0, 1] : [1, 0, 0];
    return tangentize(preferred, position);
  }
  function safeText(value, minimum, maximum) {
    if (typeof value !== 'string') return null;
    var clean = value.trim();
    return clean.length >= minimum && clean.length <= maximum ? clean : null;
  }
  function safeId(value) { return typeof value === 'string' && SAFE_ID.test(value); }
  function compact(value) {
    if (value == null || typeof value === 'string' || typeof value === 'boolean') return value;
    if (finite(value)) return Canonical.round(value, 5);
    if (Array.isArray(value)) return value.slice(0, 24).map(compact);
    if (typeof value === 'object') {
      var out = {};
      Object.keys(value).sort().slice(0, 32).forEach(function (key) {
        if (key !== '__proto__' && key !== 'prototype' && key !== 'constructor') out[key] = compact(value[key]);
      });
      return out;
    }
    return String(value).slice(0, 160);
  }

  function seatFromHumanPosition(humanPosition) {
    var human = vec3(humanPosition) ? normalize(humanPosition) : [0, 1, 0];
    var position = scale(human, -1);
    return {
      schema: SEAT_SCHEMA,
      version: VERSION,
      id: SEAT_ID,
      role: 'AI_PLAYER',
      displayName: 'AI Steward',
      connection: {
        status: 'DISCONNECTED',
        connectorId: null,
        label: 'Unclaimed AI seat',
        connectedBy: null
      },
      transform: { position: position, forward: defaultForward(position), pitch: -0.02 },
      tool: 'chop',
      commandSequence: 0,
      receiptSequence: 0,
      receipts: [],
      receiptHead: null,
      processedIntentIds: [],
      lastIntent: null,
      lastResult: null,
      boundaries: {
        autonomousLoop: false,
        runtimeNetwork: false,
        humanTouchControls: false,
        strategicAuthority: false,
        commandAllowlistOnly: true
      }
    };
  }

  function createState(humanPosition) { return seatFromHumanPosition(humanPosition); }

  function verifyReceipts(receipts, expectedHead) {
    if (!Array.isArray(receipts)) return { ok: false, errors: ['receipts must be an array'] };
    var errors = [];
    for (var i = 0; i < receipts.length; i += 1) {
      var receipt = clone(receipts[i]);
      if (!receipt || typeof receipt !== 'object') { errors.push('receipt ' + i + ' must be an object'); continue; }
      var hash = receipt.hash; delete receipt.hash;
      if (hash !== Canonical.sha256(Canonical.stableStringify(receipt))) errors.push('receipt ' + i + ' hash mismatch');
      if (i > 0 && receipts[i].previousHash !== receipts[i - 1].hash) errors.push('receipt ' + i + ' chain link mismatch');
    }
    var head = receipts.length ? receipts[receipts.length - 1].hash : null;
    if (expectedHead !== head) errors.push('receipt head mismatch');
    return { ok: errors.length === 0, errors: errors, head: head };
  }

  function validate(state) {
    var errors = [];
    if (!state || typeof state !== 'object' || Array.isArray(state)) return { ok: false, errors: ['seat state must be an object'] };
    var unsafe = Canonical.findUnsafeKey(state);
    if (unsafe) errors.push('unsafe key refused at ' + unsafe);
    if (state.schema !== SEAT_SCHEMA) errors.push('unsupported seat schema');
    if (state.version !== VERSION) errors.push('unsupported seat version');
    if (state.id !== SEAT_ID) errors.push('wrong seat id');
    if (state.role !== 'AI_PLAYER') errors.push('wrong seat role');
    if (!state.connection || ['CONNECTED', 'DISCONNECTED'].indexOf(state.connection.status) < 0) errors.push('invalid connection status');
    else if (state.connection.status === 'CONNECTED' && !safeId(state.connection.connectorId)) errors.push('connected seat requires a valid connectorId');
    else if (state.connection.status === 'DISCONNECTED' && state.connection.connectorId !== null) errors.push('disconnected seat cannot retain a connectorId');
    if (!state.transform || !vec3(state.transform.position) || !vec3(state.transform.forward) || !finite(state.transform.pitch)) errors.push('invalid transform');
    if (state.transform && vec3(state.transform.position) && Math.abs(length(state.transform.position) - 1) > 0.001) errors.push('position must be a unit vector');
    if (state.transform && vec3(state.transform.forward) && Math.abs(length(state.transform.forward) - 1) > 0.001) errors.push('forward must be a unit vector');
    if (state.transform && vec3(state.transform.position) && vec3(state.transform.forward) && Math.abs(dot(state.transform.position, state.transform.forward)) > 0.001) errors.push('forward must be tangent');
    if (ALLOWED_TOOLS.indexOf(state.tool) < 0) errors.push('invalid tool');
    if (!Number.isSafeInteger(state.commandSequence) || state.commandSequence < 0) errors.push('invalid command sequence');
    if (!Number.isSafeInteger(state.receiptSequence) || state.receiptSequence < 0) errors.push('invalid receipt sequence');
    if (!Array.isArray(state.receipts) || state.receipts.length > MAX_RECEIPTS) errors.push('invalid receipt history');
    if (!Array.isArray(state.processedIntentIds) || state.processedIntentIds.length > MAX_INTENT_IDS) errors.push('invalid intent replay history');
    if (!state.boundaries || state.boundaries.autonomousLoop !== false || state.boundaries.runtimeNetwork !== false || state.boundaries.humanTouchControls !== false || state.boundaries.strategicAuthority !== false || state.boundaries.commandAllowlistOnly !== true) errors.push('AI seat boundaries were weakened');
    if (Array.isArray(state.receipts) && state.receipts.length <= MAX_RECEIPTS) errors = errors.concat(verifyReceipts(state.receipts, state.receiptHead).errors);
    Canonical.validateFinite(state, '$', errors);
    return { ok: errors.length === 0, errors: errors };
  }

  function migrate(input, humanPosition) {
    if (!input) return createState(humanPosition);
    var candidate = clone(input);
    var checked = validate(candidate);
    if (!checked.ok) return createState(humanPosition);
    candidate.transform.position = normalize(candidate.transform.position);
    candidate.transform.forward = tangentize(candidate.transform.forward, candidate.transform.position);
    if (candidate.connection.status === 'CONNECTED') {
      var priorConnector = candidate.connection.connectorId;
      candidate.connection = { status: 'DISCONNECTED', connectorId: null, label: 'Unclaimed AI seat', connectedBy: null };
      appendReceipt(candidate, 'AI_SEAT_RUNTIME_RELOAD', 'ACCEPTED', {
        connectorId: priorConnector,
        reason: 'Browser runtime reloaded; an AI connector must claim the seat again.',
        observedAtWorldAge: null
      });
    }
    return candidate;
  }

  function receiptBody(state, kind, status, fields) {
    return Object.assign({
      schema: RECEIPT_SCHEMA,
      seatId: SEAT_ID,
      receiptSequence: state.receiptSequence,
      kind: kind,
      status: status,
      commandSequence: state.commandSequence,
      previousHash: state.receiptHead,
      observedAtWorldAge: fields && finite(fields.observedAtWorldAge) ? Canonical.round(fields.observedAtWorldAge, 4) : null
    }, fields || {});
  }
  function appendReceipt(state, kind, status, fields) {
    var body = receiptBody(state, kind, status, compact(fields || {}));
    delete body.hash;
    body.hash = Canonical.sha256(Canonical.stableStringify(body));
    state.receiptSequence += 1;
    state.receiptHead = body.hash;
    state.receipts.push(body);
    if (state.receipts.length > MAX_RECEIPTS) state.receipts.splice(0, state.receipts.length - MAX_RECEIPTS);
    return body;
  }

  function connect(inputState, request, context) {
    var state = clone(inputState);
    var checked = validate(state);
    if (!checked.ok) return { ok: false, state: inputState, errors: checked.errors };
    request = request || {};
    if (state.connection.status === 'CONNECTED') return { ok: false, state: state, errors: ['AI seat is already connected'] };
    var connectorId = safeId(request.connectorId) ? request.connectorId : null;
    var label = safeText(request.label || '', 2, 80);
    var reason = safeText(request.reason || '', 4, 240);
    if (!connectorId || !label || !reason) return { ok: false, state: state, errors: ['connectorId, label and a reason of 4-240 characters are required'] };
    state.connection = { status: 'CONNECTED', connectorId: connectorId, label: label, connectedBy: safeId(request.actorId) ? request.actorId : connectorId };
    var receipt = appendReceipt(state, 'AI_SEAT_CONNECTED', 'ACCEPTED', {
      connectorId: connectorId,
      label: label,
      reason: reason,
      observedAtWorldAge: context && context.worldAge
    });
    return { ok: true, state: state, receipt: clone(receipt) };
  }

  function disconnect(inputState, request, context) {
    var state = clone(inputState);
    var checked = validate(state);
    if (!checked.ok) return { ok: false, state: inputState, errors: checked.errors };
    request = request || {};
    var reason = safeText(request.reason || '', 4, 240);
    if (!reason) return { ok: false, state: state, errors: ['a disconnect reason of 4-240 characters is required'] };
    if (state.connection.status !== 'CONNECTED') return { ok: false, state: state, errors: ['AI seat is already disconnected'] };
    if (request.connectorId !== state.connection.connectorId) return { ok: false, state: state, errors: ['disconnect connectorId does not own this AI seat connection'] };
    var prior = state.connection.connectorId;
    state.connection = { status: 'DISCONNECTED', connectorId: null, label: 'Unclaimed AI seat', connectedBy: null };
    var receipt = appendReceipt(state, 'AI_SEAT_DISCONNECTED', 'ACCEPTED', {
      connectorId: prior,
      reason: reason,
      observedAtWorldAge: context && context.worldAge
    });
    return { ok: true, state: state, receipt: clone(receipt) };
  }

  function validateIntent(state, intent) {
    var errors = [];
    if (!intent || typeof intent !== 'object' || Array.isArray(intent)) return ['intent must be an object'];
    var unsafe = Canonical.findUnsafeKey(intent);
    if (unsafe) errors.push('unsafe key refused at ' + unsafe);
    if (intent.schema !== INTENT_SCHEMA) errors.push('unsupported intent schema');
    if (intent.seatId !== SEAT_ID) errors.push('intent targets the wrong seat');
    if (intent.connectorId !== state.connection.connectorId) errors.push('intent connectorId does not own this AI seat connection');
    if (!safeId(intent.id)) errors.push('intent id is invalid');
    if (state.processedIntentIds.indexOf(intent.id) >= 0) errors.push('intent id was already processed');
    if (!Number.isSafeInteger(intent.expectedSequence) || intent.expectedSequence !== state.commandSequence) errors.push('stale or missing expectedSequence; expected ' + state.commandSequence);
    if (ALLOWED_INTENTS.indexOf(intent.type) < 0) errors.push('intent type is not allowlisted');
    if (!safeText(intent.reason || '', 4, 240)) errors.push('intent reason must contain 4-240 characters');
    if (intent.payload != null && (typeof intent.payload !== 'object' || Array.isArray(intent.payload))) errors.push('payload must be an object');
    Canonical.validateFinite(intent, '$intent', errors);
    return errors;
  }

  function moveTransform(transform, payload, radius) {
    var forwardAmount = Number(payload.forward || 0);
    var strafeAmount = Number(payload.strafe || 0);
    var distance = Number(payload.distance == null ? 1 : payload.distance);
    if (!finite(forwardAmount) || !finite(strafeAmount) || forwardAmount < -1 || forwardAmount > 1 || strafeAmount < -1 || strafeAmount > 1) throw new Error('MOVE forward and strafe must be within -1..1');
    if (!finite(distance) || distance <= 0 || distance > 2.5) throw new Error('MOVE distance must be greater than 0 and at most 2.5 surface units');
    var magnitude = Math.hypot(forwardAmount, strafeAmount);
    if (magnitude < 0.001) throw new Error('MOVE needs forward or strafe input');
    forwardAmount /= Math.max(1, magnitude); strafeAmount /= Math.max(1, magnitude);
    var p = transform.position.slice(), f = tangentize(transform.forward, p);
    var right = normalize(scale(cross(f, p), -1));
    var direction = normalize(add(scale(f, forwardAmount), scale(right, strafeAmount)), f);
    var arc = distance / radius;
    var nextP = normalize(add(scale(p, Math.cos(arc)), scale(direction, Math.sin(arc))));
    var nextF = tangentize(f, nextP);
    return { position: nextP, forward: nextF, pitch: transform.pitch };
  }

  function processIntent(state, intent, handlers, context) {
    var payload = intent.payload || {};
    if (intent.type === 'MOVE') {
      state.transform = moveTransform(state.transform, payload, finite(context.radius) && context.radius > 1 ? context.radius : 24);
      return { ok: true, summary: 'AI steward moved on the globe.', changes: { transform: clone(state.transform) } };
    }
    if (intent.type === 'LOOK') {
      var yaw = Number(payload.yaw || 0), pitchDelta = Number(payload.pitchDelta || 0);
      if (!finite(yaw) || yaw < -Math.PI / 2 || yaw > Math.PI / 2) throw new Error('LOOK yaw must be within +/- PI/2 radians');
      if (!finite(pitchDelta) || pitchDelta < -0.5 || pitchDelta > 0.5) throw new Error('LOOK pitchDelta must be within +/- 0.5 radians');
      state.transform.forward = tangentize(rotateAroundAxis(state.transform.forward, state.transform.position, yaw), state.transform.position);
      state.transform.pitch = clamp(state.transform.pitch + pitchDelta, -1.2, 0.7);
      return { ok: true, summary: 'AI steward changed view.', changes: { transform: clone(state.transform) } };
    }
    if (intent.type === 'SET_TOOL') {
      if (ALLOWED_TOOLS.indexOf(payload.tool) < 0) throw new Error('tool is not allowlisted');
      state.tool = payload.tool;
      return { ok: true, summary: 'AI steward selected ' + payload.tool + '.', changes: { tool: state.tool } };
    }
    if (intent.type === 'ACT') {
      if (!handlers || typeof handlers.act !== 'function') throw new Error('ACT handler is unavailable');
      var acted = handlers.act({ seatId: SEAT_ID, tool: state.tool, transform: clone(state.transform), intent: clone(intent) });
      if (!acted || acted.ok !== true) return { ok: false, summary: acted && acted.summary ? acted.summary : 'The world refused that action.', changes: acted && acted.changes ? acted.changes : {} };
      return { ok: true, summary: acted.summary || 'AI steward acted.', changes: acted.changes || {}, data: acted.data || null };
    }
    return { ok: true, summary: 'AI steward waited.', changes: {} };
  }

  function submitIntent(inputState, intent, handlers, context) {
    var state = clone(inputState);
    var checked = validate(state);
    if (!checked.ok) return { ok: false, state: inputState, errors: checked.errors };
    context = context || {};
    if (state.connection.status !== 'CONNECTED') return { ok: false, state: state, errors: ['AI seat is DISCONNECTED; connect it explicitly before submitting intents'] };
    var errors = validateIntent(state, intent);
    if (errors.length) return { ok: false, state: state, errors: errors };
    var before = { transform: clone(state.transform), tool: state.tool };
    var result;
    try { result = processIntent(state, intent, handlers, context); }
    catch (error) { result = { ok: false, summary: String(error.message || error), changes: {} }; }
    state.processedIntentIds.push(intent.id);
    if (state.processedIntentIds.length > MAX_INTENT_IDS) state.processedIntentIds.splice(0, state.processedIntentIds.length - MAX_INTENT_IDS);
    state.lastIntent = { id: intent.id, type: intent.type, reason: intent.reason };
    state.commandSequence += 1;
    state.lastResult = { ok: result.ok, summary: String(result.summary || '').slice(0, 240) };
    var receipt = appendReceipt(state, 'AI_PLAYER_INTENT', result.ok ? 'ACCEPTED' : 'REFUSED', {
      intentId: intent.id,
      intentType: intent.type,
      reason: intent.reason,
      before: before,
      after: { transform: clone(state.transform), tool: state.tool },
      summary: result.summary,
      changes: result.changes || {},
      observedAtWorldAge: context.worldAge
    });
    return { ok: result.ok, state: state, receipt: clone(receipt), result: clone(result), errors: result.ok ? [] : [result.summary] };
  }

  function observe(state, context) {
    var checked = validate(state);
    if (!checked.ok) throw new Error('Cannot observe invalid AI seat: ' + checked.errors.join('; '));
    context = context || {};
    return {
      schema: OBSERVATION_SCHEMA,
      seatId: SEAT_ID,
      role: state.role,
      displayName: state.displayName,
      connection: clone(state.connection),
      expectedSequence: state.commandSequence,
      transform: clone(state.transform),
      selectedTool: state.tool,
      screen: compact(context.screen || { mode: 'AI_CAMERA', available: true }),
      sharedInventory: compact(context.sharedInventory || {}),
      nearby: compact(context.nearby || {}),
      cooperativeProject: compact(context.cooperativeProject || null),
      mission: compact(context.mission || null),
      stewardMetrics: compact(context.stewardMetrics || null),
      world: compact(context.world || {}),
      receiptHead: state.receiptHead,
      receiptCount: state.receipts.length,
      limitations: [
        'Local player observation only; no hidden strategic state is exposed.',
        'No autonomous loop and no runtime network connection are included.',
        'Every mutating intent is allowlisted, sequenced and receipt-linked.',
        'Mission progress is earned only through ordinary allowlisted player actions.',
        'The shared steward metric brief is read-only and uses the same causal report as the human screen.',
        'The AI seat has no authority to advance strategic time or approve governance proposals.'
      ]
    };
  }

  return Object.freeze({
    VERSION: VERSION,
    SEAT_SCHEMA: SEAT_SCHEMA,
    OBSERVATION_SCHEMA: OBSERVATION_SCHEMA,
    INTENT_SCHEMA: INTENT_SCHEMA,
    RECEIPT_SCHEMA: RECEIPT_SCHEMA,
    SEAT_ID: SEAT_ID,
    MAX_RECEIPTS: MAX_RECEIPTS,
    ALLOWED_INTENTS: ALLOWED_INTENTS,
    ALLOWED_TOOLS: ALLOWED_TOOLS,
    createState: createState,
    migrate: migrate,
    validate: validate,
    verifyReceipts: verifyReceipts,
    connect: connect,
    disconnect: disconnect,
    submitIntent: submitIntent,
    observe: observe
  });
});
