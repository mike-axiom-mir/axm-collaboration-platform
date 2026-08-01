(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AXMMirrorStudioBridge = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var PACKET_SCHEMA = 'axm.drawpacket/v1';
  var RECEIPT_SCHEMA = 'axm.studio.mirror-receipt/v1';
  var PERMISSION = 'studio.draw.bounded';
  var MAX_COMMANDS = 14;
  var ALLOWED_OPERATIONS = ['dot', 'line', 'rect', 'circle', 'polygon', 'stroke', 'newlayer'];

  function finite(value) { return typeof value === 'number' && Number.isFinite(value); }
  function inside(value) { return finite(value) && value >= 0 && value <= 600; }
  function cleanText(value, limit) { return String(value == null ? '' : value).trim().slice(0, limit); }
  function hash(value) {
    var text = JSON.stringify(value), out = 2166136261;
    for (var i = 0; i < text.length; i++) { out ^= text.charCodeAt(i); out = Math.imul(out, 16777619); }
    return (out >>> 0).toString(16).padStart(8, '0');
  }
  function commandError(command, index) {
    if (!command || typeof command !== 'object' || Array.isArray(command)) return 'command ' + index + ' is not an object';
    if (ALLOWED_OPERATIONS.indexOf(command.op) < 0) return 'command ' + index + ' operation is outside the first Studio boundary';
    if (command.op === 'newlayer') return cleanText(command.name, 40) ? null : 'command ' + index + ' needs a layer name';
    if (command.op === 'stroke') {
      if (!Array.isArray(command.points) || command.points.length < 1 || command.points.length > 64) return 'command ' + index + ' has an invalid point list';
      if (!command.points.every(function (point) { return Array.isArray(point) && point.length === 2 && inside(point[0]) && inside(point[1]); })) return 'command ' + index + ' has an out-of-canvas point';
    }
    var coordinateKeys = command.op === 'line' ? ['x1', 'y1', 'x2', 'y2'] : command.op === 'rect' ? ['x', 'y', 'w', 'h'] : ['x', 'y'];
    if (command.op !== 'stroke' && coordinateKeys.some(function (key) { return !inside(command[key]); })) return 'command ' + index + ' has an invalid coordinate';
    if ((command.op === 'circle' || command.op === 'polygon' || command.op === 'dot') && (!finite(command.r) || command.r < 1 || command.r > 300)) return 'command ' + index + ' has an invalid radius';
    if (command.width != null && (!finite(command.width) || command.width < 1 || command.width > 64)) return 'command ' + index + ' has an invalid width';
    return null;
  }
  function validatePacket(packet) {
    var errors = [];
    if (!packet || typeof packet !== 'object' || Array.isArray(packet)) return { ok: false, errors: ['packet must be an object'] };
    if (packet.schema !== PACKET_SCHEMA) errors.push('expected schema ' + PACKET_SCHEMA);
    if (packet.identityId !== 'mirror') errors.push('identityId must be mirror');
    if (packet.owner !== 'mirror') errors.push('owner must be mirror');
    if (!Array.isArray(packet.draw) || !packet.draw.length) errors.push('draw commands required');
    else if (packet.draw.length > MAX_COMMANDS) errors.push('packet exceeds the ' + MAX_COMMANDS + '-command first boundary');
    else packet.draw.forEach(function (command, index) { var error = commandError(command, index); if (error) errors.push(error); });
    return { ok: !errors.length, errors: errors };
  }
  function packetCandidate(packet) {
    var checked = validatePacket(packet);
    if (!checked.ok) throw new Error(checked.errors.join('; '));
    var id = 'studio-packet-' + hash(packet);
    return {
      id: id,
      packet: JSON.parse(JSON.stringify(packet)),
      action: {
        id: id,
        kind: 'studio-draw',
        label: 'Apply Mirror-authored bounded Studio packet ' + cleanText(packet.name || id, 80),
        requiredPermissions: [PERMISSION],
        supportingEvidence: ['studio-boundary-observed', 'canvas-state-observed'],
        preconditionEvidence: ['studio-boundary-observed', 'canvas-state-observed'],
        expectedEffects: ['Only Mirror-owned Studio layers may gain visible pixels.'],
        possibleSideEffects: ['The proposed mark may not be useful or visually successful.'],
        reversible: true,
        recovery: 'Undo the Mirror-owned Studio layer or remove the reviewed packet checkpoint.',
        risk: 'low'
      }
    };
  }
  function createRequest(input) {
    input = input || {};
    var candidates = (input.packets || []).map(packetCandidate);
    return {
      candidates: candidates,
      request: {
        schema: 'axm.mirror.reason/v1',
        sessionId: cleanText(input.sessionId, 120),
        actor: { id: 'mirror', kind: 'machine-native-seed', displayName: 'Mirror' },
        goal: {
          id: 'studio-undirected-creative-session',
          statement: 'Decide whether to permit one small visual contribution inside the bounded Studio surface. No human visual brief or human-authored candidate is supplied.'
        },
        evidence: [
          { id: 'studio-boundary-observed', kind: 'tool-result', status: 'observed', statement: 'Studio exposes only reversible Mirror-owned drawing operations: ' + ALLOWED_OPERATIONS.join(', ') + '.', source: { kind: 'tool-result', id: 'studio-mirror-bridge', who: 'AXM Workshop' } },
          { id: 'canvas-state-observed', kind: 'observation', status: 'observed', statement: cleanText(input.canvasObservation || 'The current canvas state was observed without a creative interpretation.', 1000), source: { kind: 'observation', id: cleanText(input.canvasReceipt || 'studio-canvas-local', 120), who: 'AXM Studio' } }
        ],
        unknowns: candidates.length ? [] : [{ id: 'creative-candidate-absent', question: 'What original visual action, if any, should Mirror propose?', blocking: true }],
        constraints: [
          { id: 'studio-only', type: 'require-permission', statement: 'No action outside the bounded Studio surface.', permission: PERMISSION, hard: true },
          { id: 'low-risk-only', type: 'max-risk', statement: 'This first creative rung accepts only low-risk reversible actions.', maxRisk: 'low', hard: true }
        ],
        permissions: [PERMISSION],
        actions: candidates.map(function (candidate) { return candidate.action; }),
        budget: { maxCandidates: MAX_COMMANDS, deadlineMs: 1000 }
      }
    };
  }
  function selectedPacket(trace, candidates) {
    if (!trace || !trace.decision || trace.decision.value !== 1) return null;
    var selected = (candidates || []).find(function (candidate) { return candidate.id === trace.decision.selectedActionId; });
    return selected ? JSON.parse(JSON.stringify(selected.packet)) : null;
  }
  function receipt(trace, beforeSignature, afterSignature, packet) {
    var changed = String(beforeSignature) !== String(afterSignature);
    return {
      schema: RECEIPT_SCHEMA,
      identityId: 'mirror',
      nativeIdentityId: 'axm.machine.mirror/seed-0',
      traceId: trace && trace.traceId || null,
      decision: trace && trace.decision || null,
      selectedPacketHash: packet ? hash(packet) : null,
      beforeSignature: String(beforeSignature || ''),
      afterSignature: String(afterSignature || ''),
      changedPixels: changed,
      observedAt: new Date().toISOString(),
      truth: changed ? 'Mirror-authorized Studio packet changed its own visible layer.' : 'No visible Studio pixels changed.'
    };
  }

  return {
    PACKET_SCHEMA: PACKET_SCHEMA,
    RECEIPT_SCHEMA: RECEIPT_SCHEMA,
    PERMISSION: PERMISSION,
    MAX_COMMANDS: MAX_COMMANDS,
    ALLOWED_OPERATIONS: ALLOWED_OPERATIONS.slice(),
    validatePacket: validatePacket,
    packetCandidate: packetCandidate,
    createRequest: createRequest,
    selectedPacket: selectedPacket,
    receipt: receipt
  };
});
