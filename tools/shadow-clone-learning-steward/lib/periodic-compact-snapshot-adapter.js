'use strict';

const Core = require('./shadow-clone-learning-core');

const PROVIDER_SCHEMA = 'axm.code-capability.compact-snapshot-provider/v1';
const SCHEDULE_SCHEMA = 'axm.shadow-clone.periodic-adapter-schedule/v1';
const SHA = /^[a-f0-9]{64}$/;

function typedError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function validateProvider(provider) {
  if (!provider || typeof provider.capability !== 'function' || typeof provider.collectCompactSnapshotSet !== 'function') return null;
  const receipt = provider.capability();
  if (!receipt || receipt.schema !== PROVIDER_SCHEMA || receipt.status !== 'AVAILABLE' || receipt.capabilityId !== 'codex.task.compact-snapshot.read' || !SHA.test(String(receipt.receiptDigest || '')) || receipt.compactSnapshotsOnly !== true || receipt.taskHistoryRead !== false || receipt.crossTaskMessaging !== false || receipt.credentialInspection !== false) return null;
  return receipt;
}

class PeriodicCompactSnapshotAdapter {
  constructor(options) {
    options = options || {};
    this.provider = options.provider || null;
    this.clock = options.clock || (() => new Date().toISOString());
    this.onCycle = typeof options.onCycle === 'function' ? options.onCycle : (() => {});
    this.timer = null;
    this.cycles = 0;
    this.schedule = null;
    this.previousLedger = options.previousLedger ? Core.validateLedgerDigest(JSON.parse(JSON.stringify(options.previousLedger))) : null;
  }

  capability() {
    const receipt = validateProvider(this.provider);
    return receipt || Core.providerCapabilityReceipt(this.clock());
  }

  async runOnce(request) {
    if (!request || request.explicitMikeAuthorization !== true || request.scope !== 'ACTIVE_AXM_CODEX_COMPACT_LEARNING') throw typedError('LEARNING_AUTHORITY', 'explicit Mike authorization is required for each adapter run');
    if (!SHA.test(String(request.authorizationReceiptDigest || ''))) throw typedError('LEARNING_AUTHORITY', 'adapter authorization must be digest-bound');
    const capability = validateProvider(this.provider);
    if (!capability) return Core.providerCapabilityReceipt(this.clock());
    const suppliedSnapshotSet = await this.provider.collectCompactSnapshotSet({
      scope: request.scope,
      authorizationReceiptDigest: request.authorizationReceiptDigest,
      compactSnapshotsOnly: true,
      taskHistoryRead: false,
      crossTaskMessaging: false,
      asOf: this.clock()
    });
    if (!suppliedSnapshotSet || !suppliedSnapshotSet.authorization || suppliedSnapshotSet.authorization.authorizationReceiptDigest !== request.authorizationReceiptDigest || !suppliedSnapshotSet.providerBoundary || suppliedSnapshotSet.providerBoundary.capabilityReceiptDigest !== capability.receiptDigest) throw typedError('PROVIDER_BINDING', 'provider output is not bound to this authorization and capability receipt');
    if (suppliedSnapshotSet.previousLedger !== null) throw typedError('PROVIDER_BINDING', 'periodic provider must not supply or replace adapter-owned ledger continuity');
    const snapshotSet = JSON.parse(JSON.stringify(suppliedSnapshotSet));
    snapshotSet.previousLedger = this.previousLedger ? JSON.parse(JSON.stringify(this.previousLedger)) : null;
    const ledger = Core.compileSnapshotSet(snapshotSet);
    const previousLedgerDigest = this.previousLedger ? this.previousLedger.ledgerDigest : null;
    this.previousLedger = ledger;
    this.cycles += 1;
    const result = { schema: 'axm.shadow-clone.periodic-adapter-cycle/v1', state: 'COMPACT_CYCLE_COMPILED', cycle: this.cycles, providerCapabilityDigest: capability.receiptDigest, previousLedgerDigest, ledger, automaticInheritance: false, automaticIntegration: false, canon: false };
    await this.onCycle(result);
    if (this.schedule && this.cycles >= this.schedule.maxCycles) this.stop('MAX_CYCLES_REACHED');
    return result;
  }

  start(request) {
    if (this.timer) throw typedError('SCHEDULE_ACTIVE', 'periodic adapter is already active');
    if (!request || request.explicitMikeAuthorization !== true || request.scope !== 'ACTIVE_AXM_CODEX_COMPACT_LEARNING') throw typedError('LEARNING_AUTHORITY', 'explicit Mike authorization is required to start the periodic adapter');
    if (!SHA.test(String(request.authorizationReceiptDigest || ''))) throw typedError('LEARNING_AUTHORITY', 'adapter authorization must be digest-bound');
    if (!Number.isInteger(request.intervalMinutes) || request.intervalMinutes < 15 || request.intervalMinutes > 1440 || !Number.isInteger(request.maxCycles) || request.maxCycles < 1 || request.maxCycles > 32) throw typedError('SCHEDULE_BOUNDS', 'periodic schedule must be 15-1440 minutes and 1-32 cycles');
    const capability = validateProvider(this.provider);
    if (!capability) return Core.providerCapabilityReceipt(this.clock());
    this.schedule = {
      schema: SCHEDULE_SCHEMA,
      state: 'EXPLICITLY_STARTED',
      startedAt: this.clock(),
      intervalMinutes: request.intervalMinutes,
      maxCycles: request.maxCycles,
      authorizationReceiptDigest: request.authorizationReceiptDigest,
      providerCapabilityDigest: capability.receiptDigest,
      rawTaskDataRetained: false,
      automaticPromptRewrite: false,
      automaticInheritance: false,
      automaticIntegration: false,
      canon: false
    };
    this.schedule.scheduleDigest = Core.digest(this.schedule);
    this.timer = setInterval(() => {
      this.runOnce(request).catch(error => {
        this.stop('CYCLE_ERROR');
        this.onCycle({ schema: 'axm.shadow-clone.periodic-adapter-cycle/v1', state: 'HOLD', errorCode: error.code || 'ERROR', automaticIntegration: false, canon: false });
      });
    }, request.intervalMinutes * 60000);
    if (this.timer && typeof this.timer.unref === 'function') this.timer.unref();
    return Object.assign({}, this.schedule);
  }

  stop(reason) {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    const receipt = { schema: SCHEDULE_SCHEMA, state: 'STOPPED', stoppedAt: this.clock(), reason: reason || 'EXPLICIT_STOP', cycles: this.cycles, automaticIntegration: false, canon: false };
    receipt.scheduleDigest = Core.digest(receipt);
    this.schedule = null;
    return receipt;
  }
}

module.exports = { PROVIDER_SCHEMA, SCHEDULE_SCHEMA, PeriodicCompactSnapshotAdapter, validateProvider };
