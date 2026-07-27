#!/usr/bin/env node
'use strict';

const { createLedger } = require('./module-evolution-ledger');

function result(value) {
  process.stdout.write(JSON.stringify(value));
}

try {
  const [mode, workshopRoot, token, digest] = process.argv.slice(2);
  const ledger = createLedger({ workshopRoot, lockTimeoutMs: 10000 });
  if (mode === 'record-race') {
    const written = ledger.recordVersion({
      expectedRevision: 0,
      recordId: `version-${token}`,
      moduleId: 'concurrent-module',
      semanticVersion: '1.0.0',
      contentDigest: digest,
      parentRecordId: null,
      recordKind: 'baseline',
      createdBy: `worker-${token}`
    });
    result({ ok: true, token, revision: written.revision, recordId: written.record.recordId });
  } else if (mode === 'inspect-interrupted') {
    result({ ok: true, inspection: ledger.inspectInterruptedActivations() });
  } else {
    result({ ok: false, code: 'UNKNOWN_WORKER_MODE' });
  }
} catch (error) {
  result({ ok: false, code: error.code || error.name, message: error.message });
}
