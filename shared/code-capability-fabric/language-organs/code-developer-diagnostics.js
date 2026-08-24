'use strict';

const crypto = require('crypto');

const AUTHORITY = Object.freeze({
  workspaceRead: false,
  workspaceMutation: false,
  toolExecution: false,
  network: false,
  install: false,
  promotion: false,
  canon: false
});

function canon(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canon).join(',')}]`;
  return `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}`;
}

function hash(v) {
  return crypto.createHash('sha256').update(typeof v === 'string' ? v : canon(v)).digest('hex');
}

function boundedText(v, max = 800) {
  const s = String(v == null ? '' : v);
  return s.length <= max ? s : `${s.slice(0, max)}…`;
}

function lspSeverity(v) {
  return ({ 1: 'ERROR', 2: 'WARNING', 3: 'INFO', 4: 'HINT' })[Number(v)] || 'UNKNOWN';
}

function sarifSeverity(v) {
  const n = String(v || '').toLowerCase();
  if (n === 'error') return 'ERROR';
  if (n === 'warning') return 'WARNING';
  if (n === 'note') return 'INFO';
  if (n === 'none') return 'HINT';
  return 'UNKNOWN';
}

function makeFinding(input) {
  const core = {
    schema: 'axm.code.diagnostic-finding.v1',
    version: '1.0.0',
    sourceClass: String(input.sourceClass || 'UNKNOWN'),
    toolId: String(input.toolId || 'unknown-tool'),
    toolVersion: input.toolVersion == null ? null : String(input.toolVersion),
    ruleId: input.ruleId == null ? null : String(input.ruleId),
    severity: String(input.severity || 'UNKNOWN').toUpperCase(),
    message: boundedText(input.message, 800),
    messageDigest: hash(String(input.message || '')),
    primaryLocation: input.primaryLocation || null,
    relatedLocations: Array.isArray(input.relatedLocations) ? input.relatedLocations.slice(0, 100) : [],
    flowPath: Array.isArray(input.flowPath) ? input.flowPath.slice(0, 1000) : [],
    suppliedFingerprint: input.suppliedFingerprint == null ? null : String(input.suppliedFingerprint),
    truth: {
      findingIsNotCorrectnessProof: true,
      findingMayBeFalsePositive: true,
      absenceOfFindingIsNotBugFreeProof: true,
      sourceCodeRetained: false
    },
    authority: AUTHORITY
  };
  const identityMaterial = {
    sourceClass: core.sourceClass,
    toolId: core.toolId,
    toolVersion: core.toolVersion,
    ruleId: core.ruleId,
    severity: core.severity,
    messageDigest: core.messageDigest,
    primaryLocation: core.primaryLocation,
    suppliedFingerprint: core.suppliedFingerprint
  };
  return Object.freeze({ ...core, findingSha256: hash(identityMaterial) });
}

function fromLsp({ uri, diagnostics = [], serverId = 'lsp-server', serverVersion = null } = {}) {
  const findings = (diagnostics || []).map(d => {
    const start = d?.range?.start || {};
    const end = d?.range?.end || {};
    return makeFinding({
      sourceClass: 'LSP',
      toolId: d.source || serverId,
      toolVersion: serverVersion,
      ruleId: d.code == null ? null : String(typeof d.code === 'object' ? d.code.value || JSON.stringify(d.code) : d.code),
      severity: lspSeverity(d.severity),
      message: d.message,
      primaryLocation: {
        uri: String(uri || ''),
        lineBase: 0,
        startLine: Number.isInteger(start.line) ? start.line : null,
        startCharacter: Number.isInteger(start.character) ? start.character : null,
        endLine: Number.isInteger(end.line) ? end.line : null,
        endCharacter: Number.isInteger(end.character) ? end.character : null
      },
      relatedLocations: (d.relatedInformation || []).map(r => ({
        uri: String(r?.location?.uri || ''),
        lineBase: 0,
        startLine: Number.isInteger(r?.location?.range?.start?.line) ? r.location.range.start.line : null,
        startCharacter: Number.isInteger(r?.location?.range?.start?.character) ? r.location.range.start.character : null,
        message: boundedText(r?.message, 300)
      }))
    });
  });
  return batch('LSP', findings, { uri: uri || null, serverId, serverVersion });
}

function sarifLocation(location) {
  const physical = location?.physicalLocation || {};
  const region = physical.region || {};
  return {
    uri: physical.artifactLocation?.uri == null ? null : String(physical.artifactLocation.uri),
    lineBase: 1,
    startLine: Number.isInteger(region.startLine) ? region.startLine : null,
    startColumn: Number.isInteger(region.startColumn) ? region.startColumn : null,
    endLine: Number.isInteger(region.endLine) ? region.endLine : null,
    endColumn: Number.isInteger(region.endColumn) ? region.endColumn : null
  };
}

function flowLocations(result) {
  const out = [];
  for (const codeFlow of result?.codeFlows || []) {
    for (const thread of codeFlow?.threadFlows || []) {
      for (const loc of thread?.locations || []) {
        out.push({
          location: sarifLocation(loc?.location || loc),
          message: boundedText(loc?.location?.message?.text || loc?.message?.text || '', 300)
        });
      }
    }
  }
  return out;
}

function fromSarif({ sarif } = {}) {
  let document = sarif;
  if (typeof document === 'string') document = JSON.parse(document);
  if (!document || document.version !== '2.1.0' || !Array.isArray(document.runs)) {
    return Object.freeze({ schema: 'axm.code.diagnostic-batch.v1', result: 'SARIF_UNSUPPORTED_OR_INVALID', findings: [], authority: 'NONE' });
  }
  const findings = [];
  const tools = [];
  for (const run of document.runs) {
    const driver = run?.tool?.driver || {};
    const toolId = String(driver.name || 'sarif-tool');
    const toolVersion = driver.semanticVersion || driver.version || null;
    tools.push(`${toolId}@${toolVersion || 'unknown'}`);
    for (const result of run.results || []) {
      const location = result.locations?.[0] ? sarifLocation(result.locations[0]) : null;
      const fingerprint = result.partialFingerprints?.primaryLocationLineHash || result.partialFingerprints?.['primaryLocationLineHash'] || null;
      findings.push(makeFinding({
        sourceClass: 'SARIF',
        toolId,
        toolVersion,
        ruleId: result.ruleId || null,
        severity: sarifSeverity(result.level),
        message: result.message?.text || result.message?.markdown || '',
        primaryLocation: location,
        relatedLocations: (result.relatedLocations || []).map(r => ({ ...sarifLocation(r), message: boundedText(r?.message?.text || '', 300) })),
        flowPath: flowLocations(result),
        suppliedFingerprint: fingerprint
      }));
    }
  }
  return batch('SARIF', findings, { tools: [...new Set(tools)].sort() });
}

function batch(sourceClass, findings, metadata = {}) {
  const sorted = [...(findings || [])].sort((a, b) => a.findingSha256.localeCompare(b.findingSha256));
  const core = {
    schema: 'axm.code.diagnostic-batch.v1',
    version: '1.0.0',
    result: sorted.length ? 'DIAGNOSTICS_NORMALIZED' : 'NO_DIAGNOSTICS_OBSERVED',
    sourceClass,
    findings: sorted,
    metadata: JSON.parse(JSON.stringify(metadata || {})),
    summary: summarizeFindings(sorted),
    truth: {
      diagnosticsAreEvidenceNotAuthority: true,
      noDiagnosticsIsNotBugFreeProof: true,
      sourceCodeRetained: false
    },
    authority: AUTHORITY
  };
  return Object.freeze({ ...core, batchSha256: hash(core) });
}

function summarizeFindings(findings) {
  const counts = { ERROR: 0, WARNING: 0, INFO: 0, HINT: 0, UNKNOWN: 0 };
  const toolIds = new Set(), rules = new Set(), files = new Set();
  for (const f of findings || []) {
    counts[f.severity] = (counts[f.severity] || 0) + 1;
    toolIds.add(f.toolId);
    if (f.ruleId) rules.add(f.ruleId);
    if (f.primaryLocation?.uri) files.add(f.primaryLocation.uri);
  }
  return { counts, toolIds: [...toolIds].sort(), ruleIds: [...rules].sort(), files: [...files].sort() };
}

function mergeBatches(batches = []) {
  const findingMap = new Map(), sources = [];
  for (const b of batches || []) {
    if (!b || b.schema !== 'axm.code.diagnostic-batch.v1') continue;
    sources.push(b.sourceClass);
    for (const finding of b.findings || []) if (!findingMap.has(finding.findingSha256)) findingMap.set(finding.findingSha256, finding);
  }
  const findings = [...findingMap.values()].sort((a, b) => a.findingSha256.localeCompare(b.findingSha256));
  const core = {
    schema: 'axm.code.diagnostic-batch.v1',
    version: '1.0.0',
    result: findings.length ? 'DIAGNOSTICS_MERGED' : 'NO_DIAGNOSTICS_OBSERVED',
    sourceClass: 'MULTI_SOURCE',
    findings,
    metadata: { sourceClasses: [...new Set(sources)].sort() },
    summary: summarizeFindings(findings),
    truth: { diagnosticsAreEvidenceNotAuthority: true, sourceCodeRetained: false },
    authority: AUTHORITY
  };
  return Object.freeze({ ...core, batchSha256: hash(core) });
}

module.exports = { fromLsp, fromSarif, mergeBatches, summarizeFindings, makeFinding };
