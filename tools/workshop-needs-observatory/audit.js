'use strict';

const path = require('path');
const factory = require('../../shared/modular-intake/needs-observatory-service');

const root = path.resolve(__dirname, '..', '..');
const intake = { status() { return { promoted: [], candidates: [], backup: { configured: false, truth: 'not inspected by declaration audit' } }; } };
const service = factory.create({ root, stateRoot: path.join(root, 'state'), modularIntakeService: intake });
const audit = service.declarationAudit();

if (process.argv.includes('--json')) process.stdout.write(JSON.stringify(audit, null, 2) + '\n');
else {
  console.log('AXM declaration drift audit');
  console.log('scanned ' + audit.scanned + ' modules · ' + audit.summary.blocking + ' blocking · ' + audit.summary.review + ' review · ' + audit.summary.legacy + ' legacy');
  audit.findings.forEach(item => console.log('[' + item.severity + '] ' + item.folder + ' · ' + item.code + ' · ' + item.truth));
}

if (audit.summary.blocking > 0) process.exitCode = 1;
