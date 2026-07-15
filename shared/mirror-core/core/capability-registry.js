'use strict';

const Validation = require('./validation');
const { clone } = require('./utils');

const TRANSITIONS = {
  declared: ['schema_valid', 'retired'],
  schema_valid: ['test_passed', 'suspended', 'retired'],
  test_passed: ['approved', 'suspended', 'retired'],
  approved: ['active', 'suspended', 'retired'],
  active: ['suspended', 'retired'],
  suspended: ['approved', 'active', 'retired'],
  retired: []
};

class CapabilityRegistry {
  constructor(store, journal) {
    this.store = store;
    this.journal = journal;
  }

  register(capability, actor, relatedPacket) {
    const checked = Validation.validateCapability(capability);
    if (!checked.ok) throw new Error(checked.errors.join('; '));
    const saved = this.store.mutate(function (state) {
      if (state.capabilities[capability.capability_id]) throw new Error('capability already registered');
      state.capabilities[capability.capability_id] = clone(capability);
      return capability;
    });
    this.journal.append('capability_registered', { actor, system: 'mirror-core', related_packet: relatedPacket || null, payload: { capability_id: saved.capability_id, status: saved.status } });
    return saved;
  }

  transition(capabilityId, status, actor) {
    const saved = this.store.mutate(function (state) {
      const capability = state.capabilities[capabilityId];
      if (!capability) throw new Error('capability not found');
      if (!(TRANSITIONS[capability.status] || []).includes(status)) throw new Error('illegal capability transition');
      capability.status = status;
      return capability;
    });
    this.journal.append('capability_status_changed', { actor, system: 'mirror-core', payload: { capability_id: capabilityId, status } });
    return saved;
  }
}

module.exports = { CapabilityRegistry, TRANSITIONS };
