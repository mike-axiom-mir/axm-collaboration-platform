'use strict';

class CdpClient {
  constructor(webSocketUrl, timeoutMs = 10000) {
    this.webSocketUrl = webSocketUrl;
    this.timeoutMs = timeoutMs;
    this.nextId = 1;
    this.pending = new Map();
    this.socket = null;
  }

  async connect() {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) return;
    this.socket = new WebSocket(this.webSocketUrl);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('CDP websocket connect timeout')), this.timeoutMs);
      this.socket.addEventListener('open', () => {
        clearTimeout(timer);
        resolve();
      }, { once: true });
      this.socket.addEventListener('error', () => {
        clearTimeout(timer);
        reject(new Error('CDP websocket connection failed'));
      }, { once: true });
    });
    this.socket.addEventListener('message', event => this._onMessage(event.data));
    this.socket.addEventListener('close', () => this._rejectPending(new Error('CDP websocket closed')));
  }

  _onMessage(raw) {
    let message;
    try { message = JSON.parse(String(raw)); } catch (_) { return; }
    if (!message.id || !this.pending.has(message.id)) return;
    const pending = this.pending.get(message.id);
    this.pending.delete(message.id);
    clearTimeout(pending.timer);
    if (message.error) pending.reject(new Error(`${pending.method}: ${message.error.message || 'CDP error'}`));
    else pending.resolve(message.result || {});
  }

  _rejectPending(error) {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }

  call(method, params = {}) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('CDP websocket is not connected'));
    }
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${method}: CDP command timeout`));
      }, this.timeoutMs);
      this.pending.set(id, { method, resolve, reject, timer });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    if (this.socket) {
      try { this.socket.close(); } catch (_) { /* already closed */ }
      this.socket = null;
    }
    this._rejectPending(new Error('CDP client closed'));
  }
}

module.exports = { CdpClient };
