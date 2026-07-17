'use strict';

const Validation = require('../core/validation');

const METHODS = [
  'healthCheck', 'exportSnapshot', 'readEntities', 'resolveNativeId',
  'createProposal', 'previewApply', 'applyApprovedPacket',
  'verifyApplication', 'rollbackApplication', 'disconnect',
  'currentRevision', 'getEntity'
];

function validateAdapter(adapter) {
  const errors = [];
  if (!adapter || typeof adapter !== 'object') return { ok: false, errors: ['adapter object required'] };
  const descriptor = Validation.validateAdapterDescriptor(adapter.descriptor);
  errors.push.apply(errors, descriptor.errors);
  METHODS.forEach(function (method) {
    if (typeof adapter[method] !== 'function') errors.push('adapter method missing: ' + method);
  });
  return { ok: errors.length === 0, errors };
}

module.exports = { validateAdapter, METHODS };
