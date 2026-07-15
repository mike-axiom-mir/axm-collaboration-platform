'use strict';

const AdapterContract = require('./adapter-contract');
const { clone, now } = require('../core/utils');

const SERVICE_ACTOR_ID = 'actor:local_service:mirror-core';

class BridgeManager {
  constructor(store, gate, journal) {
    this.store = store;
    this.gate = gate;
    this.journal = journal;
    this.adapters = new Map();
  }

  register(adapter) {
    const checked = AdapterContract.validateAdapter(adapter);
    if (!checked.ok) throw new Error(checked.errors.join('; '));
    if (this.adapters.has(adapter.descriptor.adapter_id)) throw new Error('adapter already registered');
    this.adapters.set(adapter.descriptor.adapter_id, adapter);
    this.store.mutate(function (state) {
      state.adapters[adapter.descriptor.adapter_id] = {
        descriptor: clone(adapter.descriptor),
        connection: clone(adapter.connection),
        registered_at: now()
      };
    });
    this.journal.append('adapter_registered', { system: adapter.descriptor.source_system_id, payload: { adapter_id: adapter.descriptor.adapter_id, limitations: adapter.descriptor.limitations } });
    return clone(adapter.descriptor);
  }

  refreshRegistrationState() {
    const adapters = Array.from(this.adapters.values());
    this.store.mutate(function (state) {
      state.adapters = {};
      adapters.forEach(function (adapter) {
        state.adapters[adapter.descriptor.adapter_id] = {
          descriptor: clone(adapter.descriptor),
          connection: clone(adapter.connection),
          registered_at: now()
        };
      });
    });
  }

  get(adapterId) {
    return this.adapters.get(adapterId) || null;
  }

  findBySystem(systemId) {
    return Array.from(this.adapters.values()).find(function (adapter) {
      return adapter.descriptor.source_system_id === systemId;
    }) || null;
  }

  list() {
    return Array.from(this.adapters.values()).map(function (adapter) {
      return { descriptor: clone(adapter.descriptor), connection: clone(adapter.connection), health: adapter.healthCheck() };
    });
  }

  connect(adapterId, mode, actor, consentId) {
    const adapter = this.get(adapterId);
    if (!adapter) throw new Error('adapter not registered');
    const verdict = this.gate.require({
      actor_id: actor.actor_id,
      actor,
      permission: 'connect_adapter',
      context: { system_id: adapter.descriptor.source_system_id, adapter_id: adapterId },
      consent: {
        adapter_id: adapterId,
        system_id: adapter.descriptor.source_system_id,
        granted_to: SERVICE_ACTOR_ID,
        connection_mode: mode,
        operation: 'connect_adapter',
        scope: { type: 'adapter', adapter_id: adapterId }
      }
    });
    if (!verdict.consent || verdict.consent.receipt.consent_id !== consentId) throw new Error('selected consent receipt does not match the active gate receipt');
    const connection = adapter.connect(mode, consentId, actor.actor_id);
    this.store.mutate(function (state) {
      state.adapters[adapterId].connection = clone(connection);
    });
    this.journal.append('adapter_connected', { actor, system: adapter.descriptor.source_system_id, payload: { adapter_id: adapterId, mode, consent_id: consentId } });
    return clone(connection);
  }

  disconnect(adapterId, actor) {
    const adapter = this.get(adapterId);
    if (!adapter) throw new Error('adapter not registered');
    this.gate.require({
      actor_id: actor.actor_id,
      actor,
      permission: 'disconnect_adapter',
      context: { system_id: adapter.descriptor.source_system_id, adapter_id: adapterId }
    });
    const connection = adapter.disconnect();
    this.store.mutate(function (state) {
      state.adapters[adapterId].connection = clone(connection);
    });
    this.journal.append('adapter_disconnected', { actor, system: adapter.descriptor.source_system_id, payload: { adapter_id: adapterId } });
    return clone(connection);
  }
}

module.exports = { BridgeManager, SERVICE_ACTOR_ID };
