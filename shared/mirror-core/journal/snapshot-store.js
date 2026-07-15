'use strict';

const fs = require('fs');
const path = require('path');
const { clone, now, makeId, sha256, ensureDir, atomicWriteJson, readJson } = require('../core/utils');

class SnapshotStore {
  constructor(runtimeDir, journal) {
    this.dir = path.join(path.resolve(runtimeDir), 'snapshots');
    this.journal = journal;
    ensureDir(this.dir);
  }

  capture(adapter, actor, purpose, relatedPacket) {
    const exported = adapter.exportSnapshot();
    const snapshot = {
      snapshot_id: makeId('snapshot'),
      schema_version: 'axm.mirror.snapshot/v1',
      system_id: adapter.descriptor.source_system_id,
      adapter_id: adapter.descriptor.adapter_id,
      revision: Number(exported.revision || 0),
      created_at: now(),
      created_by: clone(actor),
      state_hash: sha256(exported),
      state: clone(exported),
      purpose: String(purpose || 'manual'),
      related_packet: relatedPacket || null
    };
    atomicWriteJson(path.join(this.dir, snapshot.snapshot_id.replace(/:/g, '_') + '.json'), snapshot);
    this.journal.append('snapshot_created', {
      actor,
      system: snapshot.system_id,
      related_packet: relatedPacket || null,
      payload: { snapshot_id: snapshot.snapshot_id, revision: snapshot.revision, purpose: snapshot.purpose }
    });
    return snapshot;
  }

  get(snapshotId) {
    const file = path.join(this.dir, String(snapshotId).replace(/:/g, '_') + '.json');
    if (!fs.existsSync(file)) return null;
    return readJson(file);
  }

  list() {
    return fs.readdirSync(this.dir).filter(function (name) { return name.endsWith('.json'); }).map((name) => readJson(path.join(this.dir, name))).sort(function (a, b) {
      return a.created_at.localeCompare(b.created_at);
    });
  }

  reset() {
    fs.readdirSync(this.dir).forEach((name) => {
      if (name.endsWith('.json')) fs.unlinkSync(path.join(this.dir, name));
    });
  }
}

module.exports = { SnapshotStore };
