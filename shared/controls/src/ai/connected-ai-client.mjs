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

function resolveEndpoint(endpoint, baseUrl) {
  const fallbackBase = baseUrl || globalThis.location?.href;
  if (!fallbackBase) return new URL(endpoint);
  return new URL(endpoint, fallbackBase);
}

async function readJson(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    const error = new Error(data.reason || data.error || `HTTP ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

export class ConnectedAiSeatClient {
  constructor(options = {}) {
    if (typeof options.policy !== 'function') throw new TypeError('policy(observation) is required.');
    this.identity = requireIdentity(options.identity);
    this.baseUrl = options.baseUrl || null;
    this.observationUrl = options.observationUrl || '/api/adapter-observation';
    this.inputUrl = options.inputUrl || '/api/input';
    this.fetchImpl = options.fetchImpl || globalThis.fetch;
    if (typeof this.fetchImpl !== 'function') throw new TypeError('A fetch implementation is required.');
    this.policy = options.policy;
    this.onStatus = options.onStatus || (() => {});
    this.intervalMs = Math.max(50, Number(options.intervalMs) || 100);
    this.viewport = {
      width: Math.max(320, Math.min(3840, Number(options.viewport?.width) || 1280)),
      height: Math.max(240, Math.min(2160, Number(options.viewport?.height) || 720)),
    };
    this.sequence = Number.isSafeInteger(options.initialSequence) ? options.initialSequence : -1;
    this.timer = null;
    this.running = false;
    this.inFlight = false;
  }

  async observe() {
    const url = resolveEndpoint(this.observationUrl, this.baseUrl);
    url.searchParams.set('room', this.identity.roomCode);
    url.searchParams.set('session', this.identity.sessionId);
    url.searchParams.set('seat', this.identity.seatId);
    url.searchParams.set('width', String(this.viewport.width));
    url.searchParams.set('height', String(this.viewport.height));
    const response = await this.fetchImpl(url, {
      headers: { 'X-AXM-Seat-Token': this.identity.token },
      credentials: 'same-origin',
    });
    const observation = await readJson(response);
    const minimum = observation.controls?.nextSequenceMinimum;
    if (Number.isSafeInteger(minimum)) this.sequence = Math.max(this.sequence, minimum - 1);
    return observation;
  }

  async submit(input) {
    const packet = {
      ...this.identity,
      seq: this.sequence + 1,
      input: input && typeof input === 'object' && !Array.isArray(input) ? input : {},
    };
    const response = await this.fetchImpl(resolveEndpoint(this.inputUrl, this.baseUrl), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(packet),
      credentials: 'same-origin',
    });
    try {
      const result = await readJson(response);
      this.sequence = Number.isSafeInteger(result.acceptedSeq) ? result.acceptedSeq : packet.seq;
      return result;
    } catch (error) {
      if (Number.isSafeInteger(error.data?.acceptedSeq)) {
        this.sequence = Math.max(this.sequence, error.data.acceptedSeq);
      }
      throw error;
    }
  }

  async step() {
    if (this.inFlight) return null;
    this.inFlight = true;
    try {
      const observation = await this.observe();
      const input = await this.policy(observation);
      const result = await this.submit(input);
      this.onStatus({ state: 'connected', observation, result });
      return { observation, result };
    } catch (error) {
      this.onStatus({ state: 'error', error });
      return null;
    } finally {
      this.inFlight = false;
    }
  }

  schedule() {
    if (!this.running) return;
    this.timer = setTimeout(async () => {
      await this.step();
      this.schedule();
    }, this.intervalMs);
  }

  start() {
    if (this.running) return;
    this.running = true;
    void this.step();
    this.schedule();
  }

  stop() {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}
