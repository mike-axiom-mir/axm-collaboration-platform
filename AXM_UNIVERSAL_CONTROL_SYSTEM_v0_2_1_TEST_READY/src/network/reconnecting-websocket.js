export class ReconnectingJsonSocket extends EventTarget {
  constructor(urlFactory, options = {}) {
    super();
    this.urlFactory = urlFactory;
    this.WebSocketImpl = options.WebSocketImpl || globalThis.WebSocket;
    this.minDelay = options.minDelay ?? 300;
    this.maxDelay = options.maxDelay ?? 5000;
    this.openTimeoutMs = options.openTimeoutMs ?? 6000;
    this.heartbeatIntervalMs = options.heartbeatIntervalMs ?? 1000;
    this.heartbeatTimeoutMs = options.heartbeatTimeoutMs ?? 4500;
    this.maxQueue = options.maxQueue ?? 8;
    this.jitter = options.jitter ?? 0.2;
    this.random = options.random || Math.random;
    this.metrics = options.metrics || null;

    this.socket = null;
    this.closedByUser = false;
    this.attempt = 0;
    this.queue = [];
    this.reconnectTimer = null;
    this.openTimer = null;
    this.heartbeatTimer = null;
    this.silenceTimer = null;
    this.generation = 0;
    this.connectedAt = null;
    this.lastMessageAt = null;
    this.lastPongAt = null;
    this.lastDisconnect = null;
    this.silenceUntil = 0;
  }

  connect() {
    this.closedByUser = false;
    if (this.#isConnectingOrOpen()) return;
    this.#clearReconnectTimer();
    this.#open();
  }

  close(code = 1000, reason = 'closed by user') {
    this.closedByUser = true;
    this.#clearTimers();
    this.socket?.close(code, reason);
    this.socket = null;
    this.#emitStatus('closed', { reason });
  }

  forceReconnect(reason = 'manual reconnect') {
    if (this.closedByUser) return;
    this.lastDisconnect = { at: Date.now(), code: 4002, reason };
    const current = this.socket;
    if (current && current.readyState < this.WebSocketImpl.CLOSING) current.close(4002, reason);
    else this.#scheduleReconnect(0, reason);
  }

  wake(reason = 'wake') {
    if (this.closedByUser) return;
    const now = Date.now();
    if (!this.#isConnectingOrOpen()) {
      this.#scheduleReconnect(0, reason);
      return;
    }
    if (this.socket?.readyState === this.WebSocketImpl.OPEN) {
      this.#flushQueue(this.socket);
      if (this.lastPongAt && now - this.lastPongAt > this.heartbeatTimeoutMs) this.forceReconnect(`${reason}: heartbeat stale`);
      else this.#sendHeartbeat();
    }
  }

  suspendOutbound(milliseconds = 5000) {
    const duration = Math.max(0, Number(milliseconds) || 0);
    this.silenceUntil = Date.now() + duration;
    clearTimeout(this.silenceTimer);
    this.#emitStatus('simulated-silence', { durationMs: duration });
    this.silenceTimer = setTimeout(() => {
      this.silenceUntil = 0;
      this.wake('simulated silence ended');
    }, duration);
  }

  send(message) {
    if (!message || typeof message !== 'object') return false;
    if (Date.now() < this.silenceUntil) {
      this.#enqueue(message);
      return false;
    }
    if (this.socket?.readyState === this.WebSocketImpl.OPEN) {
      try {
        this.socket.send(JSON.stringify(message));
        return true;
      } catch {
        this.#enqueue(message);
        this.forceReconnect('send failed');
        return false;
      }
    }
    this.#enqueue(message);
    return false;
  }

  statusSnapshot(now = Date.now()) {
    const readyState = this.socket?.readyState ?? this.WebSocketImpl.CLOSED;
    return {
      state: readyStateName(readyState, this.WebSocketImpl),
      connectedAt: this.connectedAt,
      connectedForMs: this.connectedAt ? Math.max(0, now - this.connectedAt) : 0,
      lastMessageAt: this.lastMessageAt,
      lastPongAt: this.lastPongAt,
      lastPongAgeMs: this.lastPongAt ? Math.max(0, now - this.lastPongAt) : null,
      reconnectAttempt: this.attempt,
      queueSize: this.queue.length,
      silenceRemainingMs: Math.max(0, this.silenceUntil - now),
      lastDisconnect: this.lastDisconnect
    };
  }

  #enqueue(message) {
    if (message.type === 'ping' || message.type === 'pong') return;
    const key = message.type === 'input_frame' ? 'input_frame' : message.type === 'host_state' ? 'host_state' : null;
    if (key) this.queue = this.queue.filter(entry => entry.key !== key);
    this.queue.push({ key, message: structuredClone(message), enqueuedAt: Date.now() });
    while (this.queue.length > this.maxQueue) this.queue.shift();
  }

  #flushQueue(socket) {
    if (Date.now() < this.silenceUntil) return;
    for (const entry of this.queue.splice(0)) {
      try { socket.send(JSON.stringify(entry.message)); }
      catch {
        this.#enqueue(entry.message);
        break;
      }
    }
  }

  #open() {
    if (this.closedByUser || this.#isConnectingOrOpen()) return;
    if (!this.WebSocketImpl) throw new Error('WebSocket is unavailable in this environment');

    const generation = ++this.generation;
    let socket;
    try { socket = new this.WebSocketImpl(this.urlFactory()); }
    catch (error) {
      this.#scheduleReconnect(undefined, error?.message || 'open failed');
      return;
    }
    this.socket = socket;
    this.#emitStatus('connecting', { attempt: this.attempt + 1 });

    this.openTimer = setTimeout(() => {
      if (this.socket === socket && socket.readyState === this.WebSocketImpl.CONNECTING) socket.close(4003, 'connection timeout');
    }, this.openTimeoutMs);

    socket.addEventListener('open', () => {
      if (generation !== this.generation || socket !== this.socket) return;
      clearTimeout(this.openTimer);
      this.openTimer = null;
      const reconnected = this.attempt > 0 || Boolean(this.lastDisconnect);
      this.attempt = 0;
      this.connectedAt = Date.now();
      this.lastMessageAt = this.connectedAt;
      this.lastPongAt = this.connectedAt;
      if (reconnected) this.metrics?.recordReconnect();
      this.#startHeartbeat();
      this.#emitStatus('connected', { reconnected });
      this.#flushQueue(socket);
      this.#sendHeartbeat();
    });

    socket.addEventListener('message', event => {
      if (generation !== this.generation || socket !== this.socket) return;
      this.lastMessageAt = Date.now();
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'pong' && Number.isFinite(data.clientSentAt)) {
          this.lastPongAt = Date.now();
          this.metrics?.recordRtt(this.lastPongAt - data.clientSentAt);
        }
        this.dispatchEvent(new CustomEvent('message-object', { detail: data }));
      } catch (error) {
        this.dispatchEvent(new CustomEvent('protocol-error', { detail: { error: error?.message || 'invalid JSON' } }));
      }
    });

    socket.addEventListener('close', event => {
      if (generation !== this.generation || socket !== this.socket) return;
      clearTimeout(this.openTimer);
      this.openTimer = null;
      this.#stopHeartbeat();
      this.socket = null;
      this.connectedAt = null;
      this.lastDisconnect = { at: Date.now(), code: Number(event.code) || 0, reason: event.reason || 'connection closed' };
      if (this.closedByUser) return;
      const baseDelay = Math.min(this.maxDelay, this.minDelay * 2 ** this.attempt++);
      const remainingSilence = Math.max(0, this.silenceUntil - Date.now());
      const retryInMs = Math.max(this.#withJitter(baseDelay), remainingSilence);
      this.#emitStatus('reconnecting', { retryInMs, ...this.lastDisconnect });
      this.#scheduleReconnect(retryInMs, this.lastDisconnect.reason);
    });

    socket.addEventListener('error', () => {
      if (generation === this.generation && socket === this.socket && socket.readyState < this.WebSocketImpl.CLOSING) socket.close(4004, 'socket error');
    });
  }

  #startHeartbeat() {
    this.#stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (Date.now() < this.silenceUntil) return;
      if (this.socket?.readyState !== this.WebSocketImpl.OPEN) return;
      const now = Date.now();
      if (this.lastPongAt && now - this.lastPongAt > this.heartbeatTimeoutMs) {
        this.forceReconnect('heartbeat timeout');
        return;
      }
      this.#sendHeartbeat();
    }, this.heartbeatIntervalMs);
  }

  #stopHeartbeat() {
    clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }

  #sendHeartbeat() {
    if (Date.now() < this.silenceUntil || this.socket?.readyState !== this.WebSocketImpl.OPEN) return false;
    try {
      this.socket.send(JSON.stringify({ type: 'ping', clientSentAt: Date.now() }));
      return true;
    } catch {
      this.forceReconnect('heartbeat send failed');
      return false;
    }
  }

  #scheduleReconnect(delay, reason = 'reconnect') {
    if (this.closedByUser) return;
    this.#clearReconnectTimer();
    const wait = Math.max(0, Number.isFinite(delay) ? delay : this.minDelay);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.#open();
    }, wait);
    this.#emitStatus('reconnecting', { retryInMs: wait, reason });
  }

  #withJitter(delay) {
    if (!this.jitter) return Math.round(delay);
    const factor = 1 + (this.random() * 2 - 1) * this.jitter;
    return Math.max(0, Math.round(delay * factor));
  }

  #isConnectingOrOpen() {
    return Boolean(this.socket && (this.socket.readyState === this.WebSocketImpl.CONNECTING || this.socket.readyState === this.WebSocketImpl.OPEN));
  }

  #emitStatus(state, detail = {}) {
    this.dispatchEvent(new CustomEvent('status', { detail: { state, ...detail, snapshot: this.statusSnapshot() } }));
  }

  #clearReconnectTimer() {
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  #clearTimers() {
    this.#clearReconnectTimer();
    clearTimeout(this.openTimer);
    clearTimeout(this.silenceTimer);
    this.openTimer = null;
    this.silenceTimer = null;
    this.#stopHeartbeat();
  }
}

function readyStateName(value, WebSocketImpl) {
  if (value === WebSocketImpl.CONNECTING) return 'connecting';
  if (value === WebSocketImpl.OPEN) return 'connected';
  if (value === WebSocketImpl.CLOSING) return 'closing';
  return 'disconnected';
}
