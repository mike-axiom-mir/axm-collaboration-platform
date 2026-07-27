'use strict';

const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { strFromU8, strToU8, unzipSync, zipSync } = require('fflate');
const Manufacturing = require('../upgrade-program/manufacturing');
const Pack = require('./pack-core');

const RECEIPT_SCHEMA = 'axm.three-mf-capability-receipt/v1';
const RECIPE = Object.freeze({ schema: 'axm.three-mf-capability-recipe/v1', format: '3MF Core', unit: 'millimeter', geometry: 'closed tetrahedron', vertices: 4, triangles: 4, materials: 1, official_validator: '3MF Editor 1.0.0 beta CLI', schema_commit: 'fd223ea781f8d593f92a6c1256c89da095a79fb9', negative_mutation: 'invalid-unit-enum' });

function files(root) {
  const out = [];
  function visit(current) { for (const entry of fs.readdirSync(current, { withFileTypes: true })) { const target = path.join(current, entry.name); if (entry.isDirectory()) visit(target); else if (entry.isFile()) out.push(target); } }
  visit(root); return out;
}

function capture(command, args, cwd, label) {
  const stdoutFile = path.join(cwd, label + '-stdout.txt'); const stderrFile = path.join(cwd, label + '-stderr.txt');
  const out = fs.openSync(stdoutFile, 'wx'); const err = fs.openSync(stderrFile, 'wx'); let result;
  try { result = childProcess.spawnSync(command, args, { cwd, windowsHide: true, shell: false, timeout: 90000, stdio: ['ignore', out, err] }); }
  finally { fs.closeSync(out); fs.closeSync(err); }
  const stdout = fs.readFileSync(stdoutFile); const stderr = fs.readFileSync(stderrFile);
  if (stdout.length > 16 * 1024 * 1024 || stderr.length > 16 * 1024 * 1024) throw new Error('3MF validator output exceeds bounds');
  return { status: result.status, error: result.error && (result.error.code || 'PROCESS_ERROR'), stdout, stderr, process: { status: result.status, error: result.error && (result.error.code || 'PROCESS_ERROR') || null, stdout_digest: Pack.sha256(stdout), stderr_digest: Pack.sha256(stderr) } };
}

function configuration(caseRoot, schemaRoot) {
  const portable = (value) => String(value).replace(/\\/g, '/');
  const properties = [
    'pcurrentDir = "' + portable(caseRoot) + '"',
    'pschemaLoc = "' + portable(schemaRoot) + '"',
    'ppindent = "4"',
    'iErrMaxStructure = "100"',
    'iErrMaxValidataion = "100"',
    'bStructureChkWerrors = "true"',
    'pticketLoc = ""', 'pprinterUrl = ""', 'hVersion = "1.0"', 'alignOrigin = "origin"', 'bedBuffer = "0.1"', 'align_out_of_bounds_only = "false"', 'username = "none"', 'password = "none"', '',
  ].join('\r\n');
  const ini = ['psclWid = "0.45"', 'psclHgt = "0.66"', 'pscrLocX = "50"', 'pscrLocY = "50"', 'pscrSzHgt = "600"', 'pscrSzWid = "800"', 'pbSchemaChk = "true"', 'pbwire = "false"', 'bdoScroll = "true"', 'bdoWarn = "true"', 'lastFile = ""', 'thumbDir = ""', 'pbnumb = "false"', 'pNoUUIDchk = "true"', ''].join('\r\n');
  fs.writeFileSync(path.join(caseRoot, '3MF.txt'), properties, { flag: 'wx' });
  fs.writeFileSync(path.join(caseRoot, '3MF.ini'), ini, { flag: 'wx' });
}

function redact(value, roots) { let text = String(value || ''); for (const root of roots) text = text.split(root).join('<LOCAL>'); return Pack.cleanText(text, 12000); }

function runCase(label, bytes, job, java, jar, schemaRoot) {
  const caseRoot = path.join(job, label); fs.mkdirSync(caseRoot, { recursive: false });
  configuration(caseRoot, schemaRoot);
  const input = path.join(caseRoot, label + '.3mf'); fs.writeFileSync(input, bytes, { flag: 'wx' });
  const execution = capture(java, ['-jar', jar, '-C', '-F', input, '-I', '-W'], caseRoot, 'validator');
  const resultFiles = files(caseRoot).filter((file) => ![input, path.join(caseRoot, '3MF.txt'), path.join(caseRoot, '3MF.ini')].includes(file) && !/-stdout\.txt$|-stderr\.txt$/.test(file));
  const reports = resultFiles.map((file) => {
    const content = fs.readFileSync(file); const text = content.toString('utf8');
    return { name: path.relative(caseRoot, file).replace(/\\/g, '/'), bytes: content.length, digest: Pack.sha256(content), text };
  });
  const xml = reports.find((report) => /\.xml$/i.test(report.name));
  const xmlText = xml ? xml.text : '';
  const headline = /<TestResult\b[^>]*\bresult="([^"]+)"/i.exec(xmlText);
  const issueExpression = /<(PrimaryIssue|Issue)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
  const issues = []; let match;
  while ((match = issueExpression.exec(xmlText))) {
    const attribute = (name) => { const found = new RegExp('\\b' + name + '="([^"]*)"', 'i').exec(match[2]); return found ? found[1] : null; };
    issues.push({ kind: match[1], issue_id: attribute('issueID'), severity: attribute('severity'), type: attribute('type'), message_digest: Pack.sha256(Buffer.from(match[3].replace(/\s+/g, ' ').trim())) });
  }
  const headlineResult = headline ? headline[1].toUpperCase() : null;
  const wrapperDecision = execution.status !== 0 || execution.error || !xml ? 'ERROR' : issues.length ? 'FAIL' : headlineResult === 'PASS' ? 'PASS' : 'FAIL';
  const publicReports = reports.map((report) => ({ name: report.name, bytes: report.bytes, digest: report.digest }));
  return { label, process: execution.process, process_pass: execution.status === 0 && !execution.error, report_summary: { headline_result: headlineResult, issue_count: issues.length, critical_issue_count: issues.filter((issue) => String(issue.severity).toLowerCase() === 'critical').length, issue_ids: Array.from(new Set(issues.map((issue) => issue.issue_id).filter(Boolean))).sort(), issues, semantic_digest: Pack.digest({ headline_result: headlineResult, issues }), wrapper_decision: wrapperDecision }, reports: publicReports, diagnostic: execution.status === 0 && !execution.error ? null : redact(execution.stderr.toString('utf8') + '\n' + execution.stdout.toString('utf8'), [job, schemaRoot, jar, java]).slice(0, 3000) };
}

function createExecutor(options) {
  options = options || {}; const root = Pack.assertSafeRoot(options.root || Pack.defaultRoot()); const lock = options.lock || Pack.loadLock(options.lockPath);
  const identity = Object.freeze({ kind: 'official-validator-wrapper', fresh_process: true, id: 'axm-three-mf-editor-validator', version: '1.0.0', host: '3MF Editor', network: false, beta_cli: true, trusts_headline_pass: false, retains_package: false });
  function resolve() { return Pack.resolveRequest({ id: 'three-mf-editor' }, { root, lock, inventory: options.inventory }); }
  function run() {
    const resolution = resolve(); if (resolution.status !== 'READY') return { schema: RECEIPT_SCHEMA, version: '1.0.0', status: 'MISSING_SUBSTRATE', missing: resolution.missing || ['three-mf-editor'], identity, private_location_retained: false };
    const jobRoot = path.resolve(root, '.jobs'); fs.mkdirSync(jobRoot, { recursive: true }); const job = path.join(jobRoot, 'three-mf-' + process.pid + '-' + crypto.randomBytes(8).toString('hex'));
    if (!job.startsWith(jobRoot + path.sep)) throw new Error('3MF capability job escaped root'); fs.mkdirSync(job, { recursive: false });
    try {
      const source = Manufacturing.create3mf({ id: 'axm-tetra', title: 'AXM Tetrahedron', unit: 'millimeter', vertices: [[0,0,0],[10,0,0],[0,10,0],[0,0,10]], triangles: [[0,2,1],[0,1,3],[1,2,3],[2,0,3]], materials: [{ name: 'Red', displaycolor: '#ff0000ff' }], external_conformance_receipt: { status: 'MISSING_SUBSTRATE', digest: Pack.sha256(Buffer.from('official-validation-pending')) } });
      const valid = Buffer.from(source.package_base64, 'base64'); const archive = unzipSync(valid); const model = strFromU8(archive['3D/3dmodel.model']); archive['3D/3dmodel.model'] = strToU8(model.replace('unit="millimeter"', 'unit="parsec"')); const invalid = Buffer.from(zipSync(archive, { level: 6 }));
      const java = Pack.entrypointPath(root, Pack.entryById(lock, 'java-temurin-jre'), 'java'); const jar = Pack.entrypointPath(root, Pack.entryById(lock, 'three-mf-editor'), 'jar'); const schemaRoot = Pack.runtimePath(root, Pack.entryById(lock, 'three-mf-editor-schema'));
      const positive = runCase('valid', valid, job, java, jar, schemaRoot); const negative = runCase('invalid', invalid, job, java, jar, schemaRoot);
      const knownBug = negative.report_summary.headline_result === 'PASS' && negative.report_summary.issue_count > 0 && negative.report_summary.wrapper_decision === 'FAIL';
      const checks = [
        { name: 'source-is-real-axm-3mf-package', pass: source.status === 'TECHNICAL_PASS_MISSING_OFFICIAL_CONFORMANCE' && Pack.sha256(valid) === source.package_digest },
        { name: 'two-fresh-official-validator-processes', pass: positive.process_pass && negative.process_pass },
        { name: 'valid-package-has-zero-reported-issues', pass: positive.report_summary.wrapper_decision === 'PASS' && positive.report_summary.issue_count === 0 },
        { name: 'invalid-unit-counterexample-has-critical-schema-issues', pass: negative.report_summary.wrapper_decision === 'FAIL' && negative.report_summary.critical_issue_count >= 1 && negative.report_summary.issue_ids.includes('SC_000') },
        { name: 'known-upstream-headline-bug-overridden', pass: knownBug },
        { name: 'machine-readable-reports-created', pass: positive.reports.some((report) => /\.xml$/i.test(report.name)) && negative.reports.some((report) => /\.xml$/i.test(report.name)) },
      ];
      const receipt = { schema: RECEIPT_SCHEMA, version: '1.0.0', status: checks.every((check) => check.pass) ? 'PASS' : 'FAIL', identity, runtime: resolution.selected, recipe: RECIPE, recipe_digest: Pack.digest(RECIPE), source: { package_digest: source.package_digest, bytes: source.bytes, unit: source.unit, objects: source.objects, vertices: source.vertices, triangles: source.triangles }, known_upstream_headline_bug_observed: knownBug, checks, cases: [positive, negative], provides_substrates: ['official-3mf-validator'], private_location_retained: false, generated_package_retained: false, automatic_package_retention: false };
      receipt.digest = Pack.digest(receipt); return receipt;
    } finally { const resolved = path.resolve(job); if (!resolved.startsWith(jobRoot + path.sep)) throw new Error('refused unsafe 3MF cleanup'); fs.rmSync(resolved, { recursive: true, force: true }); }
  }
  return Object.freeze({ identity, resolve, run });
}

module.exports = Object.freeze({ RECEIPT_SCHEMA, RECIPE, createExecutor });
