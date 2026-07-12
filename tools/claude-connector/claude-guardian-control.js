'use strict';

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const WORKSHOP = path.resolve(__dirname, '..', '..');
const STATE_DIR = path.join(WORKSHOP, 'state', 'claude-guardian');
const STATUS_FILE = path.join(STATE_DIR, 'status.json');

function readStatus() {
  try { return JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8')); }
  catch (_) { return { schema: 'axm.claude-guardian-status/v1', connectorId: 'claude', tripped: false, tripCount: 0, resetCount: 0 }; }
}

function reset(resetBy) {
  const status = readStatus();
  const at = new Date().toISOString();
  status.schema = 'axm.claude-guardian-status/v1';
  status.connectorId = 'claude';
  status.tripped = false;
  status.reason = null;
  status.connectionAction = null;
  status.resetAt = at;
  status.updatedAt = at;
  status.resetCount = Number(status.resetCount || 0) + 1;
  status.resetBy = resetBy || 'unspecified';
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2) + '\n');
  return status;
}

function ask(question) {
  return new Promise(resolve => {
    const ui = readline.createInterface({ input: process.stdin, output: process.stdout });
    ui.question(question, answer => { ui.close(); resolve(answer); });
  });
}

async function main() {
  const action = String(process.argv[2] || 'status').toLowerCase();
  if (action === 'status') { process.stdout.write(JSON.stringify(readStatus(), null, 2) + '\n'); return; }
  if (action === 'reset') {
    if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error('Claude Guardian reset requires an interactive local console.');
    const answer = await ask('Type RESET CLAUDE to clear the trip while preserving audit history: ');
    if (String(answer).trim() !== 'RESET CLAUDE') throw new Error('Reset phrase did not match; circuit remains tripped.');
    reset('local-human-console');
    process.stdout.write('AXM Claude Guardian reset. Audit history preserved.\n');
    return;
  }
  throw new Error('Usage: node claude-guardian-control.js status|reset');
}

module.exports = { readStatus, reset, main, STATUS_FILE };
if (require.main === module) main().catch(error => { process.stderr.write(error.message + '\n'); process.exit(2); });
