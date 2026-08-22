import test from 'node:test';
import assert from 'node:assert/strict';
import { ReconnectingJsonSocket } from '../src/network/reconnecting-websocket.js';

if (typeof globalThis.CustomEvent === 'undefined') {
  globalThis.CustomEvent = class CustomEvent extends Event {
    constructor(type, options = {}) { super(type); this.detail = options.detail; }
  };
}

class FakeWebSocket extends EventTarget {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  static instances = [];

  constructor(url) {
    super();
    this.url = url;
    this.readyState = FakeWebSocket.CONNECTING;
    this.sent = [];
    FakeWebSocket.instances.push(this);
  }

  open() {
    this.readyState = FakeWebSocket.OPEN;
    this.dispatchEvent(new Event('open'));
  }

  send(payload) {
    if (this.readyState !== FakeWebSocket.OPEN) throw new Error('not open');
    this.sent.push(JSON.parse(payload));
  }

  close(code = 1000, reason = '') {
    if (this.readyState === FakeWebSocket.CLOSED) return;
    this.readyState = FakeWebSocket.CLOSED;
    const event = new Event('close');
    Object.defineProperties(event, { code: { value: code }, reason: { value: reason } });
    this.dispatchEvent(event);
  }

  receive(value) {
    const event = new Event('message');
    Object.defineProperty(event, 'data', { value: JSON.stringify(value) });
    this.dispatchEvent(event);
  }
}

function inputFrame(sequence, x) {
  return {
    protocol:'axm-input/0.1', type:'input_frame', deviceId:'phone', playerId:'p1', sequence,
    clientSentAt:sequence, fullState:true, context:'gameplay', actions:[{id:'MOVE',value:{x,y:0}}]
  };
}

test('reconnect queue coalesces semantic state and never replays stale held input', () => {
  FakeWebSocket.instances.length = 0;
  const socket = new ReconnectingJsonSocket(() => 'ws://fake', {
    WebSocketImpl: FakeWebSocket, heartbeatIntervalMs: 100000, heartbeatTimeoutMs: 200000, jitter: 0
  });
  socket.connect();
  const transport = FakeWebSocket.instances[0];
  socket.send(inputFrame(1, 1));
  socket.send({type:'ping',clientSentAt:1});
  socket.send(inputFrame(2, 0));
  assert.equal(socket.statusSnapshot().queueSize, 1);

  transport.open();
  const frames = transport.sent.filter(message => message.type === 'input_frame');
  assert.equal(frames.length, 1);
  assert.equal(frames[0].sequence, 2);
  assert.deepEqual(frames[0].actions[0].value, {x:0,y:0});
  socket.close();
});

test('simulated silence queues only the latest state and flushes it when the phone wakes', async () => {
  FakeWebSocket.instances.length = 0;
  const socket = new ReconnectingJsonSocket(() => 'ws://fake', {
    WebSocketImpl: FakeWebSocket, heartbeatIntervalMs: 100000, heartbeatTimeoutMs: 200000, jitter: 0
  });
  socket.connect();
  const transport = FakeWebSocket.instances[0];
  transport.open();
  transport.sent.length = 0;

  socket.suspendOutbound(25);
  socket.send(inputFrame(3, 1));
  socket.send(inputFrame(4, 0));
  assert.equal(transport.sent.length, 0);
  assert.equal(socket.statusSnapshot().queueSize, 1);
  await new Promise(resolve => setTimeout(resolve, 45));

  const frames = transport.sent.filter(message => message.type === 'input_frame');
  assert.equal(frames.length, 1);
  assert.equal(frames[0].sequence, 4);
  assert.equal(socket.statusSnapshot().queueSize, 0);
  socket.close();
});
