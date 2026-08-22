export class InputMetrics {
  constructor(windowSize = 240) {
    this.windowSize = windowSize;
    this.rttSamples = [];
    this.serverTransitSamples = [];
    this.sampleTimes = [];
    this.sequenceGaps = 0;
    this.lastSequenceBySource = new Map();
    this.reconnects = 0;
    this.droppedFrames = 0;
  }

  recordFrame(sourceId, frame, receivedAt = Date.now()) {
    if (Number.isFinite(frame.sequence)) {
      const previous = this.lastSequenceBySource.get(sourceId);
      if (Number.isFinite(previous) && frame.sequence > previous + 1) this.sequenceGaps += frame.sequence - previous - 1;
      if (!Number.isFinite(previous) || frame.sequence > previous) this.lastSequenceBySource.set(sourceId, frame.sequence);
    }
    if (Number.isFinite(frame.serverReceivedAt) && Number.isFinite(frame.serverSentAt)) {
      this.#push(this.serverTransitSamples, Math.max(0, frame.serverSentAt - frame.serverReceivedAt));
    }
    this.#push(this.sampleTimes, receivedAt);
  }

  recordRtt(milliseconds) {
    if (Number.isFinite(milliseconds) && milliseconds >= 0) this.#push(this.rttSamples, milliseconds);
  }

  recordReconnect() { this.reconnects += 1; }
  recordDrop(count = 1) { this.droppedFrames += Math.max(1, count); }

  summary(now = Date.now()) {
    const recent = this.sampleTimes.filter(time => now - time <= 1000);
    return {
      rttMs: summarize(this.rttSamples),
      serverTransitMs: summarize(this.serverTransitSamples),
      samplesPerSecond: recent.length,
      sequenceGaps: this.sequenceGaps,
      reconnects: this.reconnects,
      droppedFrames: this.droppedFrames,
      limitation: 'RTT is measured. One-way phone-to-PC latency is not claimed without clock synchronization.'
    };
  }

  #push(array, value) {
    array.push(value);
    while (array.length > this.windowSize) array.shift();
  }
}

function summarize(values) {
  if (!values.length) return { latest: null, average: null, p95: null, max: null };
  const sorted = [...values].sort((a,b) => a-b);
  const average = values.reduce((sum,value) => sum + value, 0) / values.length;
  return {
    latest: round(values.at(-1)),
    average: round(average),
    p95: round(sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))]),
    max: round(sorted.at(-1))
  };
}
function round(value) { return Math.round(value * 10) / 10; }
