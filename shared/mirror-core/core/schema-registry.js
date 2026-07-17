'use strict';

const fs = require('fs');
const path = require('path');
const Validation = require('./validation');

class SchemaRegistry {
  constructor(schemaDir) {
    this.schemaDir = path.resolve(schemaDir);
    this.schemas = new Map();
    this.loadDirectory(this.schemaDir);
  }

  loadDirectory(dir) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) return this.loadDirectory(file);
      if (!entry.name.endsWith('.json')) return;
      const schema = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (!schema.$id) throw new Error('schema missing $id: ' + file);
      if (this.schemas.has(schema.$id)) throw new Error('duplicate schema id: ' + schema.$id);
      this.schemas.set(schema.$id, { schema, file });
    });
  }

  has(schemaId) {
    return this.schemas.has(schemaId);
  }

  get(schemaId) {
    const entry = this.schemas.get(schemaId);
    return entry ? entry.schema : null;
  }

  list() {
    return Array.from(this.schemas.entries()).map(function (pair) {
      return { schema_id: pair[0], file: pair[1].file };
    });
  }

  validate(schemaId, value) {
    if (!this.has(schemaId)) return { ok: false, errors: ['unknown schema version: ' + schemaId] };
    if (schemaId === 'axm.mirror.entity/v1') return Validation.validateEntity(value);
    if (schemaId === 'axm.mirror.relation/v1') return Validation.validateRelation(value);
    if (schemaId === 'axm.mirror.actor/v1') return Validation.validateActor(value);
    if (schemaId === 'axm.mirror.evidence/v1') return Validation.validateEvidence(value);
    if (schemaId === 'axm.mirror.capability/v1') return Validation.validateCapability(value);
    if (schemaId === 'axm.mirror.mapping/v1') return Validation.validateMapping(value);
    if (schemaId === 'axm.mirror.change-packet/v1') return Validation.validateProposal(value);
    if (schemaId === 'axm.mirror.consent/v1') return Validation.validateConsent(value);
    if (schemaId === 'axm.mirror.adapter/v1') return Validation.validateAdapterDescriptor(value);
    if (schemaId.startsWith('axm.party.') || schemaId.startsWith('axm.controls.')) return Validation.validateInteraction(schemaId, value);
    return { ok: true, errors: [], note: 'schema document loaded; type extension validated through its parent entity' };
  }
}

module.exports = { SchemaRegistry };
