const DEFAULT_PROFILE = Object.freeze({
  profileId: 'axm-top-down-twin-stick-v1',
  sendIntervalMs: 50,
  vectors: Object.freeze({
    left: Object.freeze({ xField: 'moveX', yField: 'moveY', activeField: null }),
    right: Object.freeze({ xField: 'aimX', yField: 'aimY', activeField: 'aimActive', retainOnInactive: true }),
  }),
  buttons: Object.freeze({
    action: 'action', primary: 'fire', secondary: 'attack', sprint: 'sprint', brake: 'brake',
  }),
  releaseActions: Object.freeze({ right: 'fire' }),
  intent: Object.freeze({
    booleanFields: Object.freeze(['aimActive', 'action', 'attack', 'fire', 'sprint', 'brake']),
    pulseFields: Object.freeze(['action', 'fire']),
  }),
});

function unitVector(xValue, yValue) {
  const x = Math.max(-1, Math.min(1, Number(xValue) || 0));
  const y = Math.max(-1, Math.min(1, Number(yValue) || 0));
  const magnitude = Math.hypot(x, y);
  return magnitude > 1 ? { x: x / magnitude, y: y / magnitude } : { x, y };
}

function normalizeProfile(profile = DEFAULT_PROFILE) {
  const merged = {
    ...DEFAULT_PROFILE,
    ...profile,
    vectors: { ...DEFAULT_PROFILE.vectors, ...(profile.vectors || {}) },
    buttons: { ...DEFAULT_PROFILE.buttons, ...(profile.buttons || {}) },
    releaseActions: profile.releaseActions === undefined
      ? { ...DEFAULT_PROFILE.releaseActions }
      : { ...profile.releaseActions },
    intent: { ...DEFAULT_PROFILE.intent, ...(profile.intent || {}) },
  };
  merged.intent.booleanFields = [...new Set(merged.intent.booleanFields || [])];
  merged.intent.pulseFields = [...new Set(merged.intent.pulseFields || [])];
  return merged;
}

function requireIdentity(identity = {}) {
  for (const field of ['roomCode', 'sessionId', 'seatId', 'token']) {
    if (typeof identity[field] !== 'string' || !identity[field]) {
      throw new TypeError(`identity.${field} is required.`);
    }
  }
  return {
    roomCode: identity.roomCode,
    sessionId: identity.sessionId,
    seatId: identity.seatId,
    token: identity.token,
  };
}

export class AxmTransportError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'AxmTransportError';
    this.status = options.status ?? null;
    this.data = options.data || null;
  }
}

export function createHttpJsonTransport(options = {}) {
  const inputUrl = options.inputUrl || '/api/input';
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') throw new TypeError('A fetch implementation is required.');
  return async (packet) => {
    const response = await fetchImpl(inputUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      body: JSON.stringify(packet),
      credentials: options.credentials || 'same-origin',
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) {
      throw new AxmTransportError(
        data.reason || data.error || `Input request failed with HTTP ${response.status}.`,
        { status: response.status, data },
      );
    }
    return data;
  };
}

export class AxmControllerRuntime {
  constructor(options = {}) {
    if (typeof options.transport !== 'function') throw new TypeError('transport(packet) is required.');
    this.identity = requireIdentity(options.identity);
    this.profile = normalizeProfile(options.profile);
    this.transport = options.transport;
    this.onStatus = options.onStatus || (() => {});
    this.sequence = Number.isSafeInteger(options.initialSequence) ? options.initialSequence : -1;
    this.vectorState = Object.fromEntries(
      Object.keys(this.profile.vectors).map((channel) => [channel, { x: 0, y: 0, active: false }]),
    );
    this.buttonState = Object.fromEntries(this.profile.intent.booleanFields.map((field) => [field, false]));
    this.pulseGeneration = Object.fromEntries(this.profile.intent.pulseFields.map((field) => [field, 0]));
    this.pendingPulses = Object.fromEntries(this.profile.intent.pulseFields.map((field) => [field, false]));
    this.interval = null;
    this.inFlight = false;
    this.flushQueued = false;
  }

  semanticButton(controlOrField) {
    return this.profile.buttons[controlOrField] || controlOrField;
  }

  setVector(channel, state = {}) {
    const mapping = this.profile.vectors[channel];
    if (!mapping) throw new RangeError(`Unknown vector channel: ${channel}`);
    const vector = unitVector(state.x, state.y);
    const retain = mapping.retainOnInactive === true
      && state.active !== true
      && Math.hypot(vector.x, vector.y) === 0;
    this.vectorState[channel] = {
      ...(retain ? this.vectorState[channel] : vector),
      active: state.active === true,
    };
    return this.vectorState[channel];
  }

  releaseVector(channel) {
    const field = this.profile.releaseActions[channel];
    if (field) this.pulse(field);
  }

  setButton(controlOrField, held) {
    const field = this.semanticButton(controlOrField);
    if (!this.profile.intent.booleanFields.includes(field)) {
      throw new RangeError(`Button is not allowed by this profile: ${field}`);
    }
    this.buttonState[field] = held === true;
  }

  pulse(controlOrField) {
    const field = this.semanticButton(controlOrField);
    if (!this.profile.intent.pulseFields.includes(field)) {
      throw new RangeError(`Field is not a pulse in this profile: ${field}`);
    }
    this.pulseGeneration[field] += 1;
    this.pendingPulses[field] = true;
    void this.flush();
  }

  buildIntent() {
    const intent = {};
    for (const [channel, mapping] of Object.entries(this.profile.vectors)) {
      const state = this.vectorState[channel] || { x: 0, y: 0, active: false };
      const vector = unitVector(state.x, state.y);
      intent[mapping.xField] = vector.x;
      intent[mapping.yField] = vector.y;
      if (mapping.activeField) intent[mapping.activeField] = state.active === true;
    }
    for (const field of this.profile.intent.booleanFields) {
      if (!(field in intent)) intent[field] = this.buttonState[field] === true;
    }
    for (const field of this.profile.intent.pulseFields) {
      if (this.pendingPulses[field]) intent[field] = true;
    }
    return intent;
  }

  packet(sequence = this.sequence + 1) {
    return { ...this.identity, seq: sequence, input: this.buildIntent() };
  }

  clearCapturedPulses(captured) {
    for (const [field, generation] of Object.entries(captured)) {
      if (this.pulseGeneration[field] === generation) this.pendingPulses[field] = false;
    }
  }

  async flush() {
    if (this.inFlight) {
      this.flushQueued = true;
      return null;
    }
    this.inFlight = true;
    this.flushQueued = false;
    const packet = this.packet();
    const captured = Object.fromEntries(
      Object.keys(this.pendingPulses)
        .filter((field) => this.pendingPulses[field])
        .map((field) => [field, this.pulseGeneration[field]]),
    );
    try {
      const result = await this.transport(packet);
      this.sequence = Number.isSafeInteger(result?.acceptedSeq) ? result.acceptedSeq : packet.seq;
      this.clearCapturedPulses(captured);
      this.onStatus({ state: 'connected', sequence: this.sequence, result });
      return result;
    } catch (error) {
      const acceptedSeq = error?.data?.acceptedSeq;
      if (Number.isSafeInteger(acceptedSeq) && acceptedSeq >= packet.seq) {
        this.sequence = acceptedSeq;
        this.clearCapturedPulses(captured);
        this.onStatus({ state: 'recovered', sequence: this.sequence, error });
      } else {
        this.onStatus({ state: 'disconnected', sequence: this.sequence, error });
      }
      return null;
    } finally {
      this.inFlight = false;
      if (this.flushQueued) queueMicrotask(() => void this.flush());
    }
  }

  start() {
    if (this.interval) return;
    void this.flush();
    const intervalMs = Math.max(20, Number(this.profile.sendIntervalMs) || 50);
    this.interval = setInterval(() => void this.flush(), intervalMs);
  }

  stop() {
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
  }

  reset() {
    for (const channel of Object.keys(this.vectorState)) this.setVector(channel, {});
    for (const field of Object.keys(this.buttonState)) this.buttonState[field] = false;
    for (const field of Object.keys(this.pendingPulses)) this.pendingPulses[field] = false;
  }
}

export { DEFAULT_PROFILE as AXM_DEFAULT_CONTROLLER_PROFILE };
