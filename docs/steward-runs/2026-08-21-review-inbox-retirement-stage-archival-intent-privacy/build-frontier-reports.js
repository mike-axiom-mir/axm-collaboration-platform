#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Core = require('../../../tools/deterministic-json-core');

const DIR = __dirname;
const productCommit = '04294776eefdbb8a31604bf2be2725708bc6d3e0';
const productTree = '2722e79a578711819bbd492aa329e591d53c2bcb';
const requirements = JSON.parse(fs.readFileSync(path.join(DIR,'FRONTIER_REQUIREMENTS.json'),'utf8')).requirements;
function write(name,value) { fs.writeFileSync(path.join(DIR,name),JSON.stringify(value,null,2) + '\n','utf8'); }
function digest(value) { return 'sha256:' + crypto.createHash('sha256').update(Core.canonicalJson(value)).digest('hex'); }

const beforeMissing = new Set([
  'exact-raw-reason-commitment','raw-reason-state-minimization','raw-reason-result-minimization',
  'recognized-credential-redaction','machine-path-redaction','legacy-v1-compatibility',
  'privacy-status-disclosure','fail-closed-corruption'
]);
const optional = new Set(requirements.filter(item => !item.required).map(item => item.id));
function gap(phase) {
  const rows = requirements.map(item => {
    let status;
    if (phase === 'before') status = optional.has(item.id) ? 'MISSING_OPTIONAL' : (beforeMissing.has(item.id) ? 'MISSING_REQUIRED' : 'READY');
    else status = optional.has(item.id) ? 'MISSING_OPTIONAL' : 'READY';
    return Object.assign({},item,{ status });
  });
  return {
    schema:'axm.capability-gap-report/v1', status:'TEST', phase,
    sourceCommit:phase === 'before' ? 'b707aa08f0adf958f6344babf0839c37ab1b9dca' : productCommit,
    requirements:rows,
    summary:{
      total:rows.length,
      requiredReady:rows.filter(item => item.required && item.status === 'READY').length,
      requiredMissing:rows.filter(item => item.required && item.status === 'MISSING_REQUIRED').length,
      optionalMissing:rows.filter(item => !item.required && item.status === 'MISSING_OPTIONAL').length
    },
    overall:rows.some(item => item.status === 'MISSING_REQUIRED') ? 'BLOCKED' : (rows.some(item => item.status === 'MISSING_OPTIONAL') ? 'DEGRADED' : 'READY'),
    reportDigest:null
  };
}
for (const phase of ['before','after']) {
  const report = gap(phase);
  const body = JSON.parse(Core.canonicalJson(report)); delete body.reportDigest;
  report.reportDigest = digest(body);
  write('FRONTIER_GAP_' + phase.toUpperCase() + '.json',report);
}

const beforeCapabilities = {
  schema:'axm.frontier-capability-inventory/v1', status:'TEST', phase:'before', sourceCommit:'b707aa08f0adf958f6344babf0839c37ab1b9dca',
  available:[
    { id:'review.retirement.publication-stage.archival-intent.durable-record', constraints:['v1 intent stores the exact raw reason.'] },
    { id:'review.retirement.publication-stage.archival-intent.existing-convergence', constraints:['Six intent and nine archive process-crash checkpoints plus cooperating callers.'] },
    { id:'shared.diagnostic-redaction', constraints:['Recognized credential and machine-path patterns only; arbitrary secrets are not proven absent.'] }
  ],
  missing:[
    'review.retirement.publication-stage.archival-intent.reason.exact-digest-commitment',
    'review.retirement.publication-stage.archival-intent.reason.raw-value-absent-from-new-durable-state',
    'review.retirement.publication-stage.archival-intent.reason.raw-value-absent-from-result-and-cli',
    'review.retirement.publication-stage.archival-intent.reason.typed-privacy-status'
  ],
  inventoryDigest:null
};
{ const body = JSON.parse(JSON.stringify(beforeCapabilities)); delete body.inventoryDigest; beforeCapabilities.inventoryDigest = digest(body); }
write('FRONTIER_CAPABILITIES_BEFORE.json',beforeCapabilities);

const afterCapabilities = {
  schema:'axm.frontier-capability-inventory/v1', status:'TEST', phase:'after', sourceCommit:productCommit, productTree,
  available:[
    { id:'review.retirement.publication-stage.archival-intent.reason.exact-digest-commitment', constraints:['SHA-256 commitment to exact raw reason bytes; no protected-storage or authentication claim.'] },
    { id:'review.retirement.publication-stage.archival-intent.reason.raw-value-absent-from-new-durable-state', constraints:['v2 intent stores a changed redacted summary or fixed withheld marker, never the exact raw reason.'] },
    { id:'review.retirement.publication-stage.archival-intent.reason.raw-value-absent-from-result-and-cli', constraints:['v3 result and emitted CLI JSON omit the exact raw reason. CLI argv and shell history are outside this claim.'] },
    { id:'review.retirement.publication-stage.archival-intent.reason.recognized-credential-redaction', constraints:['Reuses the tested shared diagnostic redactor; arbitrary or encoded secrets remain unproven.'] },
    { id:'review.retirement.publication-stage.archival-intent.reason.machine-path-redaction', constraints:['Configured roots and residual absolute paths are minimized in reason summaries.'] },
    { id:'review.retirement.publication-stage.archival-intent.reason.legacy-v1-raw-record-compatibility', constraints:['Exact v1 record remains readable and retryable, is typed legacy, and is not rewritten.'] },
    { id:'review.retirement.publication-stage.archival-intent.reason.typed-privacy-status', constraints:['Status distinguishes v2 private intent, legacy v1 raw reason, and authorization-unknown legacy archive.'] },
    { id:'review.retirement.publication-stage.archival-intent.reason.digest-and-redaction-corruption-held', constraints:['Self-inconsistent digest and non-idempotent redaction summary hold before archive mutation.'] },
    { id:'review.retirement.publication-stage.archival-intent.reason.existing-convergence-preserved', constraints:['Fifteen matrix crash checkpoints, adversarial crash fixtures, reentrant caller and two cooperating processes.'] },
    { id:'review.retirement.publication-stage.archival-intent.reason.all-artifact-host-local-coverage', constraints:['Intent, decision, and result stages; no API or browser route.'] }
  ],
  missing:[
    'review.retirement.publication-stage.archival-intent.reason.arbitrary-or-encoded-secret-absence',
    'review.retirement.publication-stage.archival-intent.authenticated-actor-authorization',
    'review.retirement.publication-stage.storage-space-reclamation',
    'review.retirement.publication-stage.live-publisher-safety',
    'review.retirement.publication-stage.lossless-archive-without-hard-links',
    'storage.power-loss-durability.proven','storage.cross-file.atomicity'
  ],
  inventoryDigest:null
};
{ const body = JSON.parse(JSON.stringify(afterCapabilities)); delete body.inventoryDigest; afterCapabilities.inventoryDigest = digest(body); }
write('FRONTIER_CAPABILITIES_AFTER.json',afterCapabilities);
process.stdout.write('BUILT frontier capability and gap reports\n');
