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
console.log(out);

process.exit(effectiveCoreFail || userFail ? 1 : 0);
