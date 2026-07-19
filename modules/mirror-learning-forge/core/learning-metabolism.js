'use strict';

const crypto = require('crypto');
const os = require('os');

const DEFAULT_POLICY = Object.freeze({
  schema: 'axm.mirror.learning-metabolism-policy/v1',
  maxConcurrentSessions: 1,
  maxOperationMs: 30000,
  cooldownAfterOverrunMs: 120000,
  minFreeMemoryBytes: 3 * 1024 * 1024 * 1024,
  maxSystemMemoryUsedRatio: 0.82,
  maxForgeRssBytes: 768 * 1024 * 1024,
  bodyPulseRedHoldsManualWork: true,
  automaticRequiresBodyPulseLease: true
});

function finite(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizePolicy(input = {}) {
  const policy = Object.assign({}, DEFAULT_POLICY, input || {});
  policy.maxConcurrentSessions = 1;
  policy.maxOperationMs = Math.max(1000, Math.min(15 * 60 * 1000, finite(policy.maxOperationMs, DEFAULT_POLICY.maxOperationMs)));
  policy.cooldownAfterOverrunMs = Math.max(0, Math.min(60 * 60 * 1000, finite(policy.cooldownAfterOverrunMs, DEFAULT_POLICY.cooldownAfterOverrunMs)));
  policy.minFreeMemoryBytes = Math.max(256 * 1024 * 1024, finite(policy.minFreeMemoryBytes, DEFAULT_POLICY.minFreeMemoryBytes));
  policy.maxSystemMemoryUsedRatio = Math.max(0.5, Math.min(0.98, finite(policy.maxSystemMemoryUsedRatio, DEFAULT_POLICY.maxSystemMemoryUsedRatio)));
  policy.maxForgeRssBytes = Math.max(128 * 1024 * 1024, finite(policy.maxForgeRssBytes, DEFAULT_POLICY.maxForgeRssBytes));
  policy.bodyPulseRedHoldsManualWork = policy.bodyPulseRedHoldsManualWork !== false;
  policy.automaticRequiresBodyPulseLease = policy.automaticRequiresBodyPulseLease !== false;
  return policy;
}

function systemSample() {
  const totalMemoryBytes = os.totalmem();
  const freeMemoryBytes = os.freemem();
  const memory = process.memoryUsage();
  return {
    sampledAt: new Date().toISOString(),
    totalMemoryBytes,
    freeMemoryBytes,
    systemMemoryUsedRatio: totalMemoryBytes > 0 ? 1 - freeMemoryBytes / totalMemoryBytes : null,
    forgeRssBytes: memory.rss,
    forgeHeapUsedBytes: memory.heapUsed
  };
}

function activePulseLease(status, leaseId) {
  if (!status || !Array.isArray(status.leases) || !leaseId) return null;
  return status.leases.find(lease => lease && lease.status === 'ACTIVE' && lease.leaseId === leaseId && lease.moduleId === 'mirror-learning-forge') || null;
}

class LearningMetabolism {
  constructor(options = {}) {
    this.policy = normalizePolicy(options.policy);
    this.sample = typeof options.sample === 'function' ? options.sample : systemSample;
    this.now = typeof options.now === 'function' ? options.now : () => Date.now();
    this.active = null;
    this.cooldownUntil = 0;
    this.lastReceipt = null;
    this.lastHold = null;
  }

  inspect({ bodyPulseStatus = null, mode = 'manual', leaseId = null } = {}) {
    const body = this.sample();
    const reasons = [];
    const used = finite(body.systemMemoryUsedRatio, 0);
    const free = finite(body.freeMemoryBytes, Number.MAX_SAFE_INTEGER);
    const rss = finite(body.forgeRssBytes, 0);
    const pulsePressure = bodyPulseStatus && bodyPulseStatus.body && bodyPulseStatus.body.pressure || null;
    if (this.active) reasons.push('learning-session-already-active');
    if (this.now() < this.cooldownUntil) reasons.push('learning-cooldown-active');
    if (used >= this.policy.maxSystemMemoryUsedRatio) reasons.push('system-memory-pressure');
    if (free < this.policy.minFreeMemoryBytes) reasons.push('free-memory-reserve-low');
    if (rss >= this.policy.maxForgeRssBytes) reasons.push('forge-memory-ceiling');
    if (pulsePressure === 'RED' && (mode === 'automatic' || this.policy.bodyPulseRedHoldsManualWork)) reasons.push('body-pulse-red');
    if (mode === 'automatic' && this.policy.automaticRequiresBodyPulseLease) {
      if (!bodyPulseStatus) reasons.push('body-pulse-unavailable');
      else if (!activePulseLease(bodyPulseStatus, leaseId)) reasons.push('body-pulse-lease-missing');
    }
    return {
      allowed: reasons.length === 0,
      reasons,
      body,
      bodyPulse: bodyPulseStatus ? {
        mode: bodyPulseStatus.mode,
        pressure: pulsePressure,
        sampledAt: bodyPulseStatus.body && bodyPulseStatus.body.sampledAt || null,
        leaseVerified: !!activePulseLease(bodyPulseStatus, leaseId)
      } : { mode: null, pressure: null, sampledAt: null, leaseVerified: false }
    };
  }

  begin(operation, context = {}) {
    const inspection = this.inspect(context);
    if (!inspection.allowed) {
      this.lastHold = { at: new Date(this.now()).toISOString(), operation, reasons: inspection.reasons, body: inspection.body };
      return Object.assign({ granted: false }, inspection);
    }
    const session = {
      sessionId: 'learning-session:' + crypto.randomUUID(),
      operation: String(operation || 'unknown').slice(0, 200),
      mode: context.mode === 'automatic' ? 'automatic' : 'manual',
      leaseId: context.leaseId || null,
      startedAtMs: this.now(),
      startedAt: new Date(this.now()).toISOString(),
      bodyBefore: inspection.body
    };
    this.active = session;
    return { granted: true, session: Object.assign({}, session), body: inspection.body, bodyPulse: inspection.bodyPulse };
  }

  finish(sessionId, outcome = 'COMPLETED', detail = '') {
    if (!this.active || this.active.sessionId !== sessionId) throw new Error('learning metabolism session mismatch');
    const finishedAtMs = this.now();
    const durationMs = Math.max(0, finishedAtMs - this.active.startedAtMs);
    const withinTimeBudget = durationMs <= this.policy.maxOperationMs;
    if (!withinTimeBudget) this.cooldownUntil = finishedAtMs + this.policy.cooldownAfterOverrunMs;
    const receipt = {
      schema: 'axm.mirror.learning-metabolism-receipt/v1',
      sessionId,
      operation: this.active.operation,
      mode: this.active.mode,
      bodyPulseLeaseId: this.active.leaseId,
      outcome: outcome === 'FAILED' ? 'FAILED' : 'COMPLETED',
      detail: String(detail || '').slice(0, 500),
      startedAt: this.active.startedAt,
      completedAt: new Date(finishedAtMs).toISOString(),
      durationMs,
      withinTimeBudget,
      bodyBefore: this.active.bodyBefore,
      bodyAfter: this.sample(),
      cooldownUntil: this.cooldownUntil ? new Date(this.cooldownUntil).toISOString() : null,
      truth: 'Resource use is a body cost, not evidence that learning improved.'
    };
    this.active = null;
    this.lastReceipt = receipt;
    return receipt;
  }

  status(bodyPulseStatus = null) {
    const preview = this.inspect({ bodyPulseStatus, mode: 'manual' });
    return {
      schema: 'axm.mirror.learning-metabolism-status/v1',
      state: this.active ? 'ACTIVE' : preview.allowed ? 'READY' : 'HELD',
      policy: Object.assign({}, this.policy),
      currentBody: preview.body,
      bodyPulse: preview.bodyPulse,
      activeSession: this.active ? Object.assign({}, this.active) : null,
      cooldownUntil: this.cooldownUntil ? new Date(this.cooldownUntil).toISOString() : null,
      holdReasons: preview.reasons,
      lastHold: this.lastHold,
      lastReceipt: this.lastReceipt,
      truth: 'One bounded session at a time. A hot, memory-starved or unleased automatic body holds without changing learned state.'
    };
  }
}

module.exports = { LearningMetabolism, DEFAULT_POLICY, normalizePolicy, systemSample };
