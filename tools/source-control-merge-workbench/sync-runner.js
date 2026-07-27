#!/usr/bin/env node
'use strict';

const path = require('path');
const Sync = require('../../shared/operations/github-sync-service');

const root = path.resolve(__dirname, '..', '..');
const service = Sync.create({ root, stateRoot:path.join(root, 'state') });

function valueAfter(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 && index + 1 < process.argv.length ? process.argv[index + 1] : null;
}

const manual = process.argv.includes('--manual-reviewed-push');
const verify = process.argv.includes('--verify-plan');
const mode = manual ? 'manual-reviewed-push' : verify ? 'verify-plan' : 'dry-run';

try {
  let result;
  if (manual) result = service.executeManual({
    planDigest:valueAfter('--plan-digest'),
    confirmation:valueAfter('--confirmation'),
    actor:valueAfter('--actor') || 'local-user'
  });
  else if (verify) result = service.verifyPlan(valueAfter('--plan-digest'));
  else result = service.buildPlan();
  process.stdout.write(JSON.stringify({ ok:true, mode, result }, null, 2) + '\n');
} catch (error) {
  process.stderr.write(JSON.stringify({ ok:false, mode, error:String(error.message || error), receipt:error.receipt || null }, null, 2) + '\n');
  process.exitCode = 1;
}
