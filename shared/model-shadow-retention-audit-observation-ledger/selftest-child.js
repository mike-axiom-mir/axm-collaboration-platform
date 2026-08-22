'use strict';

const fs = require('fs');
const Ledger = require('./model-shadow-retention-audit-observation-ledger');

try {
  const input = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const service = Ledger.createService(input.serviceOptions);
  let result;
  if (input.action === 'inspect') result = service.inspect();
  else if (input.action === 'read') result = service.read(input.sequence);
  else if (input.action === 'verify') result = service.verifyPersisted(input.receipt);
  else if (input.action === 'capture') result = service.capture(input.input);
  else throw new Error('unknown child action');
  process.stdout.write(JSON.stringify({ ok: true, result }));
} catch (error) {
  process.stdout.write(JSON.stringify({ ok: false, code: error.code || null, error: error.message }));
  process.exitCode = 1;
}
