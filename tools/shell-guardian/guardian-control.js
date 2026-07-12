'use strict';

const fs = require('fs');
const path = require('path');
const core = require('./guardian-hook');
const command = String(process.argv[2] || 'status').toLowerCase();

function read() {
  try { return JSON.parse(fs.readFileSync(core.STATUS_FILE, 'utf8')); }
  catch (_) { return { schema: 'axm.shell-guardian-status/v1', tripped: false, tripCount: 0, resetCount: 0 }; }
}

if (command === 'status') {
  process.stdout.write(JSON.stringify(read(), null, 2) + '\n');
} else if (command === 'reset') {
  const status = read();
  status.tripped = false;
  status.reason = null;
  status.connectionAction = null;
  status.resetAt = new Date().toISOString();
  status.resetCount = Number(status.resetCount || 0) + 1;
  fs.mkdirSync(path.dirname(core.STATUS_FILE), { recursive: true });
  fs.writeFileSync(core.STATUS_FILE, JSON.stringify(status, null, 2) + '\n');
  process.stdout.write('AXM Shell Guardian reset. Audit history preserved.\n');
} else {
  process.stderr.write('Usage: node guardian-control.js status|reset\n');
  process.exitCode = 2;
}
