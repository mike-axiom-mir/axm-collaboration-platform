'use strict';

const crypto = require('crypto');
const { EventEmitter } = require('events');

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const MAX_FRAME_BYTES = 64 * 1024;

class WebSocketLiteConnection extends EventEmitter {
  constructor(socket) {
    super();
    this.socket = socket;
    this.buffer = Buffer.alloc(0);
    this.closed = false;
    socket.on('data', chunk => {
      try { this.#consume(chunk); }
      catch (error) { this.close(1009, error.message || 'invalid websocket frame'); }
    });
    socket.on('close', () => this.#closed());
    socket.on('end', () => this.#closed());
    socket.on('error', error => this.emit('error', error));
  }

  sendText(text) {
    if (this.closed) return false;
    const payload = Buffer.from(String(text), 'utf8');
    const header = encodeHeader(0x1, payload.length);
    this.socket.write(Buffer.concat([header, payload]));
    return true;
  }

  sendJSON(value) { return this.sendText(JSON.stringify(value)); }

  close(code = 1000, reason = '') {
    if (this.closed) return;
    const reasonBuffer = Buffer.from(String(reason).slice(0, 120), 'utf8');
    const payload = Buffer.alloc(2 + reasonBuffer.length);
    payload.writeUInt16BE(code, 0);
    reasonBuffer.copy(payload, 2);
    this.socket.write(Buffer.concat([encodeHeader(0x8, payload.length), payload]));
    this.socket.end();
    this.#closed();
  }

  #consume(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (true) {
      const frame = decodeFrame(this.buffer);
      if (!frame) return;
      this.buffer = this.buffer.subarray(frame.bytesUsed);
      if (!frame.fin) { this.close(1003, 'fragmented frames unsupported'); return; }
      if (frame.opcode === 0x8) { this.close(); return; }
      if (frame.opcode === 0x9) {
        this.socket.write(Buffer.concat([encodeHeader(0xA, frame.payload.length), frame.payload]));
        continue;
      }
      if (frame.opcode === 0x1) this.emit('message', frame.payload.toString('utf8'));
    }
  }

  #closed() {
    if (this.closed) return;
    this.closed = true;
    this.emit('close');
  }
}

function acceptWebSocket(req, socket, head = Buffer.alloc(0)) {
  const key = req.headers['sec-websocket-key'];
  if (!key || req.headers.upgrade?.toLowerCase() !== 'websocket') {
    socket.write('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
    socket.destroy();
    return null;
  }
  const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
  socket.write([
    'HTTP/1.1 101 Switching Protocols',
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Accept: ${accept}`,
    '\r\n'
  ].join('\r\n'));
  const connection = new WebSocketLiteConnection(socket);
  if (head.length) socket.emit('data', head);
  return connection;
}

function encodeHeader(opcode, length) {
  if (length < 126) return Buffer.from([0x80 | opcode, length]);
  if (length <= 0xffff) {
    const header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(length, 2);
    return header;
  }
  const header = Buffer.alloc(10);
  header[0] = 0x80 | opcode;
  header[1] = 127;
  header.writeBigUInt64BE(BigInt(length), 2);
  return header;
}

function decodeFrame(buffer) {
  if (buffer.length < 2) return null;
  const first = buffer[0];
  const second = buffer[1];
  const fin = Boolean(first & 0x80);
  const opcode = first & 0x0f;
  const masked = Boolean(second & 0x80);
  let length = second & 0x7f;
  let offset = 2;

  if (length === 126) {
    if (buffer.length < 4) return null;
    length = buffer.readUInt16BE(2);
    offset = 4;
  } else if (length === 127) {
    if (buffer.length < 10) return null;
    const big = buffer.readBigUInt64BE(2);
    if (big > BigInt(MAX_FRAME_BYTES)) throw new Error('WebSocket frame too large');
    length = Number(big);
    offset = 10;
  }

  if (length > MAX_FRAME_BYTES) throw new Error('WebSocket frame too large');
  if (!masked) throw new Error('client WebSocket frames must be masked');

  let mask = null;
  if (masked) {
    if (buffer.length < offset + 4) return null;
    mask = buffer.subarray(offset, offset + 4);
    offset += 4;
  }
  if (buffer.length < offset + length) return null;
  const payload = Buffer.from(buffer.subarray(offset, offset + length));
  if (masked) for (let index = 0; index < payload.length; index++) payload[index] ^= mask[index % 4];
  return { fin, opcode, payload, bytesUsed: offset + length };
}

module.exports = { acceptWebSocket, WebSocketLiteConnection };
