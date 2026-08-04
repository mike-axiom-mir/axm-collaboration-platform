'use strict';
const assert = require('assert');
const Bridge = require('./mirror-studio-bridge.js');

const empty = Bridge.createRequest({ sessionId: 'test-session', canvasObservation: 'Blank 600x600 canvas.', canvasReceipt: 'blank-hash' });
assert.equal(empty.request.actions.length, 0, 'undirected test supplies no hidden creative candidate');
assert.equal(empty.request.permissions[0], 'studio.draw.bounded', 'Studio permission is explicit and narrow');
assert.ok(empty.request.unknowns.some(item => item.id === 'creative-candidate-absent' && item.blocking), 'missing creative organ remains visible');

const packet = { schema: 'axm.drawpacket/v1', identityId: 'mirror', owner: 'mirror', name: 'future native mark', draw: [{ op: 'dot', x: 300, y: 300, r: 5, color: '#e8b54a' }] };
assert.equal(Bridge.validatePacket(packet).ok, true, 'a future bounded Mirror dot packet is valid');
assert.equal(Bridge.validatePacket({ ...packet, draw: [{ op: 'erase', points: [[1, 1], [2, 2]] }] }).ok, false, 'destructive operations are outside the first boundary');
assert.equal(Bridge.validatePacket({ ...packet, draw: [{ op: 'dot', x: 900, y: 300, r: 5 }] }).ok, false, 'out-of-canvas coordinates are rejected');

const withCandidate = Bridge.createRequest({ sessionId: 'test-session', packets: [packet] });
const trace = { traceId: 'trace-test', decision: { value: 1, selectedActionId: withCandidate.candidates[0].id } };
assert.deepEqual(Bridge.selectedPacket(trace, withCandidate.candidates), packet, 'only a positively selected supplied packet can cross into Studio');
assert.equal(Bridge.selectedPacket({ decision: { value: 0, selectedActionId: withCandidate.candidates[0].id } }, withCandidate.candidates), null, 'a hold never crosses into Studio');
assert.equal(Bridge.receipt(trace, 'same', 'same', packet).changedPixels, false, 'receipts report observed pixels instead of claiming success');

console.log('PASS Mirror Studio bridge: undirected hold route, bounded future packet, visible receipt');
