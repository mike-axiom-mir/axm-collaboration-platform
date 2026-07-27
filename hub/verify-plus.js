#!/usr/bin/env node
/* ============================================================
   AXM Hub — verify-plus.js
   Runs your REAL core gate (verify.js, untouched) as a child, then
   your own checks from verify.config.json. Core failures and your
   check failures both fail the run. The core floor cannot be
   deleted from the config — only your own checks are read here.
   Run:  node hub/verify-plus.js      (from AXM_WORKSHOP)
   ============================================================ */
'use strict';
const { execSync } = require('child_process');
const fs = require('fs'), path = require('path');
const Checks = require('./verify-checks.js');
const VerificationRunner = require('../shared/verification-spine/workspace-runner.js');
const ROOT = path.join(__dirname, '..');

/* ---- 1. core gate: run the real verify.js, capture output + exit ---- */
let coreOut = '', coreFail = false;
try { coreOut = execSync('node verify.js', { cwd: ROOT, encoding: 'utf8' }); }
catch (e) { coreOut = (e.stdout || '') + (e.stderr || ''); coreFail = true; }

/* ---- 2. load the user's config (optional) ---- */
let config = { userChecks: [], acknowledgedWarnings: [] };
const cfgPath = path.join(ROOT, 'verify.config.json');
if (fs.existsSync(cfgPath)) {
  try { config = JSON.parse(fs.readFileSync(cfgPath, 'utf8')); }
  catch (e) { console.error('verify.config.json is not valid JSON — ignoring it. (' + e.message + ')'); }
}

/* ---- 3. run the user's own checks ---- */
const io = { read: p => { try { return fs.readFileSync(path.join(ROOT, p), 'utf8'); } catch (e) { return null; } } };
const results = Checks.runUserChecks(config, io);
const userFail = results.filter(r => !r.ok).length;

/* ---- 3b. apply retirements to the core output (non-hidden) ---- */
const ret = Checks.applyRetirements(coreOut, config.retirements);
const effectiveCoreFail = ret.effectiveFails > 0;

/* ---- 3c. normalize specialist results through the category spine ----
   The spine does not replace the core or category verifiers. It preserves
   their authority, names missing evidence and contradictions, and evaluates
   admitted failure-memory lessons with the same bounded check evaluator. */
const spineConfig = config.verificationSpine || {};
let spineReport = null, spineError = null;
try {
  spineReport = VerificationRunner.runCurrentWorkspace(ROOT, {
    coreText: ret.text,
    effectiveCoreFail: effectiveCoreFail,
    userResults: results,
    userChecks: config.userChecks || [],
    failureMemory: spineConfig.failureMemory || [],
    profileId: spineConfig.targetProfile || 'workshop-full',
    evaluateCheck: function (check) { return Checks.evalCheck(check, io); }
  });
} catch (error) {
  spineError = error;
}

/* append-only provenance: every active retirement is logged each run, so
   the record of what's been turned off never depends on the config alone */
if (ret.hits.length) {
  try {
    fs.mkdirSync(path.join(ROOT, 'exports'), { recursive: true });
    const stamp = new Date().toISOString();
    const lines = ret.hits.map(h => stamp + '  RETIRED "' + h.match + '" by ' + h.by + ' — ' + h.reason + ' — matched ' + h.lines.length + ' line(s)').join('\n') + '\n';
    fs.appendFileSync(path.join(ROOT, 'exports', 'verify-retirements.log'), lines);
  } catch (e) {}
}

/* ---- 4. combined report ---- */
let core = Checks.annotateWarns(ret.text, config.acknowledgedWarnings);
let out = '';
if (ret.hits.length) {
  out += '⚠ ' + ret.hits.length + ' CORE CHECK(S) RETIRED — still shown below, excluded from fail count:\n';
  ret.hits.forEach(h => out += '   · "' + h.match + '" — ' + h.reason + ' (by ' + h.by + (h.at ? ', ' + h.at : '') + ') — ' + h.lines.length + ' line(s)\n');
  out += '\n';
}
if (ret.ignored && ret.ignored.length) out += '(' + ret.ignored.length + ' retirement(s) IGNORED — no reason given; a retirement needs a reason)\n\n';
out += core.trimEnd() + '\n\n=== YOUR CHECKS (verify.config.json) ===\n';
if (!results.length) out += '  (none yet — add some in the Verifier module or edit verify.config.json)\n';
results.forEach(r => out += '  ' + (r.ok ? 'PASS' : 'FAIL') + '  ' + r.label + '  ·  ' + r.detail + '\n');
out += '\n' + (effectiveCoreFail ? 'CORE FAILED (' + ret.effectiveFails + ' unretired)' : 'core ok')
     + ' · ' + userFail + ' of ' + results.length + ' your-checks failed'
     + (ret.hits.length ? ' · ' + ret.hits.length + ' retired' : '') + '\n';
out += '\n=== VERIFICATION SPINE V2 ===\n';
if (spineError) {
  out += '  HELD  spine could not produce a trustworthy report - ' + spineError.message + '\n';
} else {
  out += '  ' + spineReport.verdict + '  profile ' + spineReport.profile.id
      + ' - ' + spineReport.receipt_count + ' receipts'
      + ' - ' + spineReport.claim_count + ' atomic claims\n';
  spineReport.categories.forEach(function (category) {
    const statuses = Object.keys(category.statuses).sort().map(function (status) {
      return status + '=' + category.statuses[status];
    }).join(', ');
    out += '  ' + category.id + ' - ' + category.claims + ' claims' + (statuses ? ' - ' + statuses : '') + '\n';
  });
  if (spineReport.missing_categories.length) out += '  missing required categories: ' + spineReport.missing_categories.join(', ') + '\n';
  spineReport.conflicts.forEach(function (conflict) { out += '  CONFLICT  ' + conflict.id + ' - ' + conflict.reason + '\n'; });
  const memory = spineReport.failure_memory;
  out += '  failure memory - ' + memory.total + ' lessons'
      + ' (candidate ' + memory.candidates + ', active ' + memory.active + ', monitor ' + memory.monitor
      + ', human ' + memory.manual_review + ', retired ' + memory.retired + ')\n';
  out += '  receipt: exports/verification-spine-report.json\n';
}
console.log(out);

/* HUMAN_REVIEW is deliberately not converted into a pass. A merge/release
   gate stops until the declared steward review is supplied. */
const spineBlocks = spineError || ['FAILED', 'HELD', 'HUMAN_REVIEW'].indexOf(spineReport && spineReport.verdict) >= 0;
process.exit(effectiveCoreFail || userFail || spineBlocks ? 1 : 0);
