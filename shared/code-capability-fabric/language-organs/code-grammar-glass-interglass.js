'use strict';

const core = require('./code-grammar-glass-interglass-core.js');
const receipts = require('./code-grammar-glass-interglass-receipts.js');

module.exports = Object.freeze({
  INTERGLASS_EVENT_TYPES: core.INTERGLASS_EVENT_TYPES,
  INTERGLASS_STATES: core.INTERGLASS_STATES,
  DEFAULT_CSP: core.DEFAULT_CSP,
  DEFAULT_POLICY: core.DEFAULT_POLICY,
  createInterglassPolicy: core.createInterglassPolicy,
  createInterglassCandidateModel: core.createInterglassCandidateModel,
  expectedResultFromModel: core.expectedResultFromModel,
  createBrowserSandboxExecutorProfile: core.createBrowserSandboxExecutorProfile,
  sandboxContractBinding: core.sandboxContractBinding,
  createInterglassRunRequest: core.createInterglassRunRequest,
  sealBrowserExecutionReceipt: receipts.sealBrowserExecutionReceipt,
  createExecutionReturnPacket: receipts.createExecutionReturnPacket,
  visualState: receipts.visualState,
  augmentVisualSnapshot: receipts.augmentVisualSnapshot,
  snapshot: receipts.snapshot
});
