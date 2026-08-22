'use strict';

const path = require('path');
const { clone, now, readJson, atomicWriteJson, ensureDir } = require('../core/utils');

function blankState() {
  const at = now();
  return {
    schema: 'axm.mirror.state/v1',
    revision: 0,
    authority_revision: 0,
    created_at: at,
    updated_at: at,
    actors: {},
    entities: {},
    relations: {},
    evidence: {},
    capabilities: {},
    mappings: {},
    proposals: {},
    consents: {},
    adapters: {},
    applications: {}
  };
}

class JsonStore {
  constructor(runtimeDir) {
    this.runtimeDir = path.resolve(runtimeDir);
    this.file = path.join(this.runtimeDir, 'state.json');
    ensureDir(this.runtimeDir);
    if (!require('fs').existsSync(this.file)) atomicWriteJson(this.file, blankState());
    this.state = readJson(this.file, blankState());
  }

  read() {
    return clone(this.state);
  }

  reload() {
    this.state = readJson(this.file, blankState());
    return this.read();
  }

  mutate(mutator, options) {
    const next = clone(this.state);
    const result = mutator(next);
    next.revision = Number(next.revision || 0) + 1;
    if (options && options.authority) next.authority_revision = Number(next.authority_revision || 0) + 1;
    next.updated_at = now();
    atomicWriteJson(this.file, next);
    this.state = next;
    return result === undefined ? undefined : clone(result);
  }

  reset(seed) {
    const next = Object.assign(blankState(), clone(seed || {}));
    next.schema = 'axm.mirror.state/v1';
    next.updated_at = now();
    atomicWriteJson(this.file, next);
    this.state = next;
    return this.read();
  }
}

module.exports = { JsonStore, blankState };
