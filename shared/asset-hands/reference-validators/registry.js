'use strict';

const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const RECEIPT_SCHEMA = 'axm.reference-validation-receipt/v1';
const ENVELOPE_SCHEMA = 'axm.asset-verification-envelope/v1';
const VERSION = '1.0.0';
const STATUSES = ['PASS', 'FAIL', 'MISSING_VALIDATOR', 'UNSUPPORTED_ARTIFACT', 'TOOL_ERROR'];
const ASSURANCE_SCOPES = ['structural-corroboration', 'schema-conformance', 'official-conformance-checker', 'native-open', 'unavailable'];
const PYTHON_ENTRYPOINT = path.join(__dirname, 'python', 'reference_validator.py');
const MAX_ARTIFACT_BYTES = 50 * 1000 * 1000;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(function (key) {
    return JSON.stringify(key) + ':' + canonical(value[key]);
  }).join(',') + '}';
  return JSON.stringify(value);
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function text(value, maximum) {
  const clean = String(value == null ? '' : value)
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .replace(/[A-Za-z]:[\\/][^\r\n\t"']+/g, '<path>')
    .replace(/file:\/\/\/[^\s"']+/gi, '<path>')
    .trim();
  return clean.slice(0, maximum || 2000);
}

function sanitize(value) {
  if (Array.isArray(value)) return value.slice(0, 200).map(sanitize);
  if (value && typeof value === 'object') {
    const output = {};
    Object.keys(value).slice(0, 200).forEach(function (key) { output[text(key, 100)] = sanitize(value[key]); });
    return output;
  }
  if (typeof value === 'string') return text(value, 2000);
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) return value;
  return String(value);
}

function artifactBytes(artifact) {
  if (!artifact || typeof artifact !== 'object') throw new Error('artifact is required');
  if (!artifact.dataUrl && typeof artifact.text === 'string') return Buffer.from(artifact.text, 'utf8');
  const match = /^data:([^;,]+);base64,([A-Za-z0-9+/=\r\n]+)$/.exec(String(artifact.dataUrl || ''));
  if (!match) throw new Error('artifact needs text or a base64 data URL');
  if (match[1].toLowerCase() !== String(artifact.mime || '').toLowerCase()) throw new Error('artifact data URL MIME does not match its descriptor');
  return Buffer.from(match[2], 'base64');
}

function targetCanvasIdentity(targetCanvas, declaredDigest) {
  return {
    digest: String(declaredDigest || sha256(Buffer.from(canonical(targetCanvas || {}), 'utf8'))),
    sha256: sha256(Buffer.from(canonical(targetCanvas || {}), 'utf8')),
  };
}

function normalizeProvider(raw) {
  const provider = Object.assign({}, raw || {});
  ['id', 'version', 'implementation', 'independence_basis', 'tool', 'assurance_scope'].forEach(function (key) {
    if (!String(provider[key] || '').trim()) throw new Error('reference validator provider requires ' + key);
  });
  if (!ASSURANCE_SCOPES.includes(provider.assurance_scope)) throw new Error('invalid assurance scope for ' + provider.id);
  ['claims', 'mimes', 'mediums', 'independent_from_writers'].forEach(function (key) {
    if (!Array.isArray(provider[key])) throw new Error(provider.id + ' requires ' + key + ' array');
  });
  if (typeof provider.probe !== 'function' || typeof provider.execute !== 'function') throw new Error(provider.id + ' requires probe and execute');
  provider.priority = Number(provider.priority) || 0;
  return Object.freeze(provider);
}

function run(command, args, options) {
  const result = (options.runner || childProcess.spawnSync)(command, args, {
    encoding: 'utf8',
    windowsHide: true,
    shell: false,
    timeout: options.timeout || 30000,
    maxBuffer: 4 * 1024 * 1024,
    env: Object.assign({}, process.env, options.env || {}),
  });
  if (result.error) return { ok: false, status: null, error: text(result.error.message, 500), stdout: '', stderr: '' };
  return {
    ok: result.status === 0,
    status: result.status,
    stdout: text(result.stdout, 200000),
    stderr: text(result.stderr, 4000),
  };
}

function parsedJson(output) {
  try { return JSON.parse(String(output || '').trim()); }
  catch (error) { return null; }
}

function pythonProbe(mode, runtime, options) {
  if (!runtime.python) return { available: false, version: null, reason: 'Python runtime is not configured' };
  const result = run(runtime.python, [PYTHON_ENTRYPOINT, '--mode', mode, '--probe'], options);
  const value = parsedJson(result.stdout);
  if (!result.ok || !value || value.ok !== true) return { available: false, version: value && value.implementation_version || null, reason: 'required Python validator package is unavailable' };
  return { available: true, version: value.implementation_version || 'unknown', details: value.facts || {} };
}

function pythonExecute(mode, staged, runtime, options, extraArgs) {
  const args = [PYTHON_ENTRYPOINT, '--mode', mode, '--input', staged].concat(extraArgs || []);
  const result = run(runtime.python, args, options);
  const value = parsedJson(result.stdout);
  if (!result.ok || !value || !Array.isArray(value.checks)) return {
    toolError: true,
    checks: [{ name: 'validator-process', pass: false, details: { exit_status: result.status } }],
    evidence: { message: 'validator did not emit a bounded JSON result' },
  };
  return { pass: value.ok === true, checks: value.checks, evidence: { implementation: value.implementation, implementation_version: value.implementation_version, facts: value.facts || {} } };
}

function commandProbe(command, args, options, label) {
  if (!command) return { available: false, version: null, reason: label + ' runtime is not configured' };
  const result = run(command, args, Object.assign({}, options, { timeout: 10000 }));
  if (!result.ok) return { available: false, version: null, reason: label + ' command is unavailable' };
  return { available: true, version: text((result.stdout || result.stderr).split(/\r?\n/)[0], 200) || 'installed' };
}

function defaultProviders() {
  return [
    {
      id: 'python-pypdf-structure', version: VERSION, priority: 90,
      implementation: 'Python pypdf strict parser', tool: 'pypdf', assurance_scope: 'structural-corroboration',
      independence_basis: 'A separately executed Python parser inspects the finished bytes; it does not call the AXM PDF writer or its parser.',
      independent_from_writers: ['pdfx-codec', 'accessible-document-codec'],
      claims: ['pdfx.bounded-structure', 'pdf.tagged-structure'], mimes: ['application/pdf'], mediums: ['print', 'paper', 'screen'],
      probe: function (runtime, options) { return pythonProbe('pdf-structure', runtime, options); },
      execute: function (input, runtime, options) {
        const result = pythonExecute('pdf-structure', input.staged, runtime, options);
        if (result.toolError) return result;
        const facts = result.evidence.facts || {};
        const extra = input.claim === 'pdfx.bounded-structure'
          ? [
              { name: 'parsed-pdfx-output-intent', pass: facts.output_intents > 0 && (facts.output_intent_subtypes || []).includes('/GTS_PDFX') && facts.destination_output_profile === true, details: { output_intents: facts.output_intents, subtypes: facts.output_intent_subtypes } },
              { name: 'parsed-pdfx-info-identifier', pass: /PDF\/X-4/.test(String(facts.pdfx_info || '')), details: facts.pdfx_info || null },
              { name: 'parsed-page-boxes', pass: Array.isArray(facts.media_box) && facts.media_box.length === 4 && Array.isArray(facts.trim_box) && facts.trim_box.length === 4 && Array.isArray(facts.bleed_box) && facts.bleed_box.length === 4 },
              { name: 'parsed-font-free-bounded-profile', pass: facts.font_resources === 0, details: { font_resources: facts.font_resources } },
            ]
          : [
              { name: 'parsed-structure-tree', pass: facts.structure_tree === true },
              { name: 'parsed-marked-document', pass: facts.marked === true },
              { name: 'parsed-document-language', pass: !!facts.language, details: facts.language || null },
            ];
        result.checks = result.checks.concat(extra);
        result.pass = result.checks.every(function (check) { return check.pass === true; });
        return result;
      },
    },
    {
      id: 'python-lxml-musicxml-structure', version: VERSION, priority: 80,
      implementation: 'Python lxml XML parser', tool: 'lxml', assurance_scope: 'structural-corroboration',
      independence_basis: 'A separately executed libxml2-backed parser checks the finished MusicXML without calling the JavaScript writer or inspector.',
      independent_from_writers: ['audio-notation-codec'],
      claims: ['musicxml.structure'], mimes: ['application/vnd.recordare.musicxml+xml'], mediums: ['audio-device'],
      probe: function (runtime, options) { return pythonProbe('musicxml-structure', runtime, options); },
      execute: function (input, runtime, options) { return pythonExecute('musicxml-structure', input.staged, runtime, options); },
    },
    {
      id: 'python-lxml-w3c-musicxml-xsd', version: VERSION, priority: 100,
      implementation: 'Python lxml XMLSchema with configured official W3C MusicXML 4.0 schemas', tool: 'lxml + MusicXML 4.0 XSD', assurance_scope: 'schema-conformance',
      independence_basis: 'The finished XML is checked by libxml2 against separately supplied official W3C schema documents.',
      independent_from_writers: ['audio-notation-codec'],
      claims: ['musicxml.w3c-xsd'], mimes: ['application/vnd.recordare.musicxml+xml'], mediums: ['audio-device'],
      probe: function (runtime, options) {
        const base = pythonProbe('musicxml-xsd', runtime, options);
        if (!base.available) return base;
        if (!runtime.musicXmlXsd || !fs.existsSync(runtime.musicXmlXsd)) return { available: false, version: base.version, reason: 'official MusicXML XSD root is not configured' };
        return { available: true, version: 'MusicXML 4.0 / lxml ' + base.version };
      },
      execute: function (input, runtime, options) { return pythonExecute('musicxml-xsd', input.staged, runtime, options, ['--xsd', runtime.musicXmlXsd]); },
    },
    {
      id: 'python-openusd-compliance-checker', version: VERSION, priority: 110,
      implementation: 'Official OpenUSD UsdUtils.ComplianceChecker', tool: 'usd-core / UsdUtils.ComplianceChecker', assurance_scope: 'official-conformance-checker',
      independence_basis: 'The official OpenUSD core library composes and checks the finished stage outside the JavaScript authoring codec.',
      independent_from_writers: ['openusd-codec'],
      claims: ['openusd.usdchecker'], mimes: ['model/vnd.usdz+zip', 'model/vnd.usd'], mediums: ['3d-surface', 'game-world'],
      probe: function (runtime, options) { return pythonProbe('openusd-compliance', runtime, options); },
      execute: function (input, runtime, options) { return pythonExecute('openusd-compliance', input.staged, runtime, options); },
    },
    {
      id: 'openusd-usdchecker', version: VERSION, priority: 100,
      implementation: 'Official OpenUSD usdchecker', tool: 'usdchecker', assurance_scope: 'official-conformance-checker',
      independence_basis: 'The official OpenUSD stage and USDZ checker opens the finished package outside the JavaScript authoring codec.',
      independent_from_writers: ['openusd-codec'],
      claims: ['openusd.usdchecker'], mimes: ['model/vnd.usdz+zip', 'model/vnd.usd'], mediums: ['3d-surface', 'game-world'],
      probe: function (runtime, options) { return commandProbe(runtime.usdchecker, ['--help'], options, 'usdchecker'); },
      execute: function (input, runtime, options) {
        const result = run(runtime.usdchecker, [input.staged], options);
        return {
          pass: result.ok,
          checks: [{ name: 'official-usdchecker', pass: result.ok, details: { exit_status: result.status } }],
          evidence: { summary: text(result.stdout || result.stderr, 2000) },
        };
      },
    },
    {
      id: 'w3c-epubcheck', version: VERSION, priority: 100,
      implementation: 'W3C EPUBCheck command-line validator', tool: 'epubcheck', assurance_scope: 'official-conformance-checker',
      independence_basis: 'The W3C-maintained EPUB conformance checker validates the completed publication outside the AXM ZIP/EPUB writer.',
      independent_from_writers: ['accessible-document-codec'],
      claims: ['epub.w3c-epubcheck'], mimes: ['application/epub+zip'], mediums: ['screen', 'print', 'paper'],
      probe: function (runtime, options) { return commandProbe(runtime.epubcheck, ['--version'], options, 'EPUBCheck'); },
      execute: function (input, runtime, options) {
        const result = run(runtime.epubcheck, ['--json', '-', input.staged], options);
        return {
          pass: result.ok,
          checks: [{ name: 'w3c-epubcheck', pass: result.ok, details: { exit_status: result.status } }],
          evidence: { report: text(result.stdout || result.stderr, 3000) },
        };
      },
    },
  ].map(normalizeProvider);
}

function receiptIdentity(input) {
  return 'reference-' + sha256(Buffer.from(canonical(input), 'utf8')).slice(0, 20);
}

function receiptBase(provider, input, status, runtime, checks, evidence) {
  const value = {
    schema: RECEIPT_SCHEMA,
    version: VERSION,
    id: '',
    status: status,
    claim: input.claim,
    assurance_scope: provider ? provider.assurance_scope : 'unavailable',
    artifact: {
      id: String(input.artifact.id || 'unknown-artifact'),
      role: String(input.artifact.role || ''),
      mime: String(input.artifact.mime || 'application/octet-stream'),
      format: String(input.artifact.format || ''),
      digest: String(input.artifact.digest || input.artifactSha256),
      sha256: input.artifactSha256,
      bytes: input.bytes,
    },
    target_canvas_digest: input.canvasIdentity.digest,
    target_canvas_sha256: input.canvasIdentity.sha256,
    validator: provider ? {
      id: provider.id,
      version: provider.version,
      implementation: provider.implementation,
      independence_basis: provider.independence_basis,
      independent_from_writers: provider.independent_from_writers.slice(),
    } : {
      id: 'reference-validator-registry', version: VERSION,
      implementation: 'exact claim matcher',
      independence_basis: 'No validator executed; the receipt records the missing capability.',
      independent_from_writers: [],
    },
    runtime: {
      available: !!(runtime && runtime.available),
      tool: provider ? provider.tool : 'unmatched reference validator',
      tool_version: runtime && runtime.version || null,
      network_used: false,
    },
    checks: sanitize(checks || []),
    evidence: sanitize(evidence || {}),
    createdAt: input.createdAt,
  };
  value.id = receiptIdentity({ claim: value.claim, artifact: value.artifact.sha256, canvas: value.target_canvas_sha256, validator: value.validator.id, status: value.status, createdAt: value.createdAt });
  return value;
}

function validateReceipt(value) {
  const errors = [];
  if (!value || value.schema !== RECEIPT_SCHEMA) errors.push('reference receipt schema mismatch');
  if (!STATUSES.includes(value && value.status)) errors.push('reference receipt status invalid');
  if (!ASSURANCE_SCOPES.includes(value && value.assurance_scope)) errors.push('reference receipt assurance scope invalid');
  if (!value || !value.artifact || !/^[a-f0-9]{64}$/.test(value.artifact.sha256 || '')) errors.push('artifact SHA-256 missing');
  if (!value || !/^[a-f0-9]{64}$/.test(value.target_canvas_sha256 || '')) errors.push('target canvas SHA-256 missing');
  if (!value || !value.validator || !value.validator.id) errors.push('validator identity missing');
  if (!value || !value.runtime || value.runtime.network_used !== false) errors.push('runtime network declaration missing');
  if (!value || !Array.isArray(value.checks)) errors.push('checks missing');
  return { pass: errors.length === 0, errors: errors };
}

function validateEnvelope(value) {
  const errors = [];
  if (!value || value.schema !== ENVELOPE_SCHEMA) errors.push('verification envelope schema mismatch');
  if (!value || !['CORROBORATED', 'PARTIAL', 'FAILED', 'MISSING_VALIDATOR'].includes(value.status)) errors.push('verification envelope status invalid');
  if (!value || !value.result_id || !value.result_digest) errors.push('verification envelope result binding missing');
  if (!value || !/^[a-f0-9]{64}$/.test(value.target_canvas_sha256 || '')) errors.push('verification envelope canvas SHA-256 missing');
  if (!value || !Array.isArray(value.requirements) || !Array.isArray(value.receipts)) errors.push('verification envelope requirements or receipts missing');
  const receiptIds = new Set();
  (value && value.receipts || []).forEach(function (receipt) {
    const checked = validateReceipt(receipt);
    if (!checked.pass) errors.push.apply(errors, checked.errors.map(function (error) { return receipt.id + ': ' + error; }));
    if (receiptIds.has(receipt.id)) errors.push('duplicate reference receipt id');
    receiptIds.add(receipt.id);
    if (receipt.target_canvas_sha256 !== value.target_canvas_sha256 || receipt.target_canvas_digest !== value.target_canvas_digest) errors.push('reference receipt canvas binding differs from envelope');
  });
  (value && value.requirements || []).forEach(function (requirement) {
    if (!receiptIds.has(requirement.receipt_id)) errors.push('requirement references a missing receipt');
  });
  return { pass: errors.length === 0, errors: errors };
}

class ReferenceValidatorRegistry {
  constructor(options) {
    options = options || {};
    this.providers = (options.providers || defaultProviders()).map(function (provider) {
      return Object.isFrozen(provider) ? provider : normalizeProvider(provider);
    }).sort(function (left, right) { return right.priority - left.priority || left.id.localeCompare(right.id); });
    this.runner = options.runner || childProcess.spawnSync;
    this.timeout = Math.max(1000, Math.min(120000, Number(options.timeout) || 30000));
    this.runtime = {
      python: options.python || process.env.AXM_REFERENCE_PYTHON || null,
      musicXmlXsd: options.musicXmlXsd || process.env.AXM_MUSICXML_XSD || null,
      usdchecker: options.usdchecker || process.env.AXM_USDCHECKER || null,
      epubcheck: options.epubcheck || process.env.AXM_EPUBCHECK || null,
    };
    this.env = Object.assign({
      PYTHONNOUSERSITE: '1',
      PYTHONPATH: options.pythonPath || process.env.AXM_REFERENCE_PYTHONPATH || process.env.PYTHONPATH || '',
    }, options.env || {});
    this.probes = new Map();
  }

  list() {
    return this.providers.map(function (provider) {
      return clone({ id: provider.id, version: provider.version, implementation: provider.implementation, tool: provider.tool, assurance_scope: provider.assurance_scope, independence_basis: provider.independence_basis, independent_from_writers: provider.independent_from_writers, claims: provider.claims, mimes: provider.mimes, mediums: provider.mediums, priority: provider.priority });
    });
  }

  probe(provider) {
    if (this.probes.has(provider.id)) return this.probes.get(provider.id);
    let result;
    try { result = provider.probe(this.runtime, { runner: this.runner, timeout: this.timeout, env: this.env }); }
    catch (error) { result = { available: false, version: null, reason: 'validator probe failed' }; }
    result = sanitize(result);
    this.probes.set(provider.id, result);
    return result;
  }

  inventory() {
    const self = this;
    return this.providers.map(function (provider) { return { provider: self.list().find(function (item) { return item.id === provider.id; }), runtime: clone(self.probe(provider)) }; });
  }

  verifyArtifact(request) {
    request = request || {};
    const artifact = request.artifact || {};
    const claim = String(request.claim || '');
    const targetCanvas = request.target_canvas || request.targetCanvas || {};
    const medium = String(targetCanvas.medium || '');
    const createdAt = String(request.createdAt || new Date().toISOString());
    let data;
    try { data = artifactBytes(artifact); }
    catch (error) {
      data = Buffer.alloc(0);
      const input = { artifact: artifact, claim: claim, bytes: 0, artifactSha256: sha256(data), canvasIdentity: targetCanvasIdentity(targetCanvas, request.target_canvas_digest), createdAt: createdAt };
      return receiptBase(null, input, 'UNSUPPORTED_ARTIFACT', { available: false }, [{ name: 'read-artifact-bytes', pass: false }], { reason: text(error.message, 300) });
    }
    const input = { artifact: artifact, claim: claim, bytes: data.length, artifactSha256: sha256(data), canvasIdentity: targetCanvasIdentity(targetCanvas, request.target_canvas_digest), createdAt: createdAt };
    if (data.length > MAX_ARTIFACT_BYTES) return receiptBase(null, input, 'UNSUPPORTED_ARTIFACT', { available: false }, [{ name: 'artifact-budget', pass: false, details: { actual: data.length, maximum: MAX_ARTIFACT_BYTES } }], { reason: 'artifact exceeds reference-validator staging budget' });
    const byClaim = this.providers.filter(function (provider) { return provider.claims.includes(claim); });
    const compatible = byClaim.filter(function (provider) { return provider.mimes.includes(String(artifact.mime || '')) && (!provider.mediums.length || provider.mediums.includes(medium)); });
    if (!byClaim.length) return receiptBase(null, input, 'MISSING_VALIDATOR', { available: false }, [{ name: 'exact-claim-provider', pass: false }], { missing_capability: claim });
    if (!compatible.length) return receiptBase(byClaim[0], input, 'UNSUPPORTED_ARTIFACT', { available: false }, [{ name: 'artifact-and-canvas-supported', pass: false, details: { mime: artifact.mime || null, medium: medium || null } }], { candidate_validators: byClaim.map(function (provider) { return provider.id; }) });
    const probes = compatible.map(function (provider) { return { provider: provider, runtime: this.probe(provider) }; }, this);
    const selected = probes.find(function (item) { return item.runtime.available === true; });
    if (!selected) return receiptBase(compatible[0], input, 'MISSING_VALIDATOR', probes[0].runtime, [{ name: 'validator-installed', pass: false }], { candidate_validators: probes.map(function (item) { return { id: item.provider.id, reason: item.runtime.reason || 'unavailable' }; }) });
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-reference-validator-'));
    const extension = path.extname(String(artifact.filename || '')) || '.bin';
    const staged = path.join(root, 'artifact' + extension.slice(0, 16));
    try {
      fs.writeFileSync(staged, data, { flag: 'wx' });
      let execution;
      try { execution = selected.provider.execute({ artifact: artifact, claim: claim, targetCanvas: targetCanvas, staged: staged }, this.runtime, { runner: this.runner, timeout: this.timeout, env: this.env }); }
      catch (error) { execution = { toolError: true, checks: [{ name: 'validator-execution', pass: false }], evidence: { message: 'validator execution failed' } }; }
      const status = execution.toolError ? 'TOOL_ERROR' : execution.pass === true ? 'PASS' : 'FAIL';
      const receipt = receiptBase(selected.provider, input, status, selected.runtime, execution.checks || [], execution.evidence || {});
      const validation = validateReceipt(receipt);
      if (!validation.pass) throw new Error('reference receipt construction failed: ' + validation.errors.join('; '));
      return receipt;
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }

  verifyResult(result, options) {
    options = options || {};
    if (!result || result.schema !== 'axm.asset-hand-result/v1' || !result.digest || !Array.isArray(result.artifacts)) throw new Error('complete Asset Hand result is required');
    const createdAt = String(options.createdAt || new Date().toISOString());
    const requirements = options.requirements || recommendedRequirements(result);
    const canvasDigest = String(result.validation_receipt && result.validation_receipt.target_canvas_digest || sha256(Buffer.from(canonical(result.target_canvas || {}), 'utf8')));
    const receipts = [];
    const routed = requirements.map(function (requirement) {
      const artifact = result.artifacts.find(function (item) {
        return requirement.artifact_id ? item.id === requirement.artifact_id : requirement.artifact_role ? item.role === requirement.artifact_role : requirement.mime ? item.mime === requirement.mime : false;
      });
      let receipt;
      if (!artifact) {
        const placeholder = { id: requirement.artifact_id || 'missing-artifact', role: requirement.artifact_role || '', mime: requirement.mime || 'application/octet-stream', format: '', digest: 'missing', text: '' };
        receipt = this.verifyArtifact({ artifact: placeholder, claim: requirement.claim, target_canvas: result.target_canvas, target_canvas_digest: canvasDigest, createdAt: createdAt });
        receipt.status = 'UNSUPPORTED_ARTIFACT';
        receipt.checks = [{ name: 'required-artifact-present', pass: false }];
      } else receipt = this.verifyArtifact({ artifact: artifact, claim: requirement.claim, target_canvas: result.target_canvas, target_canvas_digest: canvasDigest, createdAt: createdAt });
      receipts.push(receipt);
      return { claim: requirement.claim, artifact_id: artifact ? artifact.id : requirement.artifact_id || '', artifact_role: artifact ? artifact.role : requirement.artifact_role || '', required: requirement.required !== false, status: receipt.status, receipt_id: receipt.id };
    }, this);
    const requiredRows = routed.filter(function (row) { return row.required; });
    const hardFailure = requiredRows.some(function (row) { return ['FAIL', 'TOOL_ERROR', 'UNSUPPORTED_ARTIFACT'].includes(row.status); });
    const missingRequired = requiredRows.some(function (row) { return row.status === 'MISSING_VALIDATOR'; });
    const anyNonPass = routed.some(function (row) { return row.status !== 'PASS'; });
    const canvasIdentity = targetCanvasIdentity(result.target_canvas, canvasDigest);
    return {
      schema: ENVELOPE_SCHEMA,
      version: VERSION,
      status: hardFailure ? 'FAILED' : missingRequired ? 'MISSING_VALIDATOR' : anyNonPass ? 'PARTIAL' : 'CORROBORATED',
      result_id: result.id,
      result_digest: result.digest,
      target_canvas_digest: canvasIdentity.digest,
      target_canvas_sha256: canvasIdentity.sha256,
      requirements: routed,
      receipts: receipts,
      createdAt: createdAt,
    };
  }

  attachEnvelope(result, envelope) {
    const checked = validateEnvelope(envelope);
    if (!checked.pass) throw new Error('verification envelope is invalid: ' + checked.errors.join('; '));
    if (!result || envelope.result_digest !== result.digest || envelope.result_id !== result.id) throw new Error('verification envelope is not bound to this Asset Hand result');
    const copy = clone(result);
    copy.reference_validation = clone(envelope);
    return copy;
  }
}

function recommendedRequirements(result) {
  const requirements = [];
  const hand = result && result.hand && result.hand.id;
  function hasRole(role) { return result.artifacts.some(function (artifact) { return artifact.role === role; }); }
  if (hand === 'pdfx-press-production') {
    requirements.push({ claim: 'pdfx.bounded-structure', artifact_role: 'press-profiled-delivery', required: true });
    requirements.push({ claim: 'pdfx.external-conformance', artifact_role: 'press-profiled-delivery', required: false });
  }
  if (hand === 'accessible-document') {
    if (hasRole('tagged-pdf-delivery')) requirements.push({ claim: 'pdf.tagged-structure', artifact_role: 'tagged-pdf-delivery', required: true });
    if (hasRole('reflowable-epub-delivery')) requirements.push({ claim: 'epub.w3c-epubcheck', artifact_role: 'reflowable-epub-delivery', required: false });
  }
  if (hand === 'audio-notation-device' && hasRole('musicxml-score')) {
    requirements.push({ claim: 'musicxml.structure', artifact_role: 'musicxml-score', required: true });
    requirements.push({ claim: 'musicxml.w3c-xsd', artifact_role: 'musicxml-score', required: false });
  }
  if (hand === 'openusd-scene-composition') requirements.push({ claim: 'openusd.usdchecker', artifact_role: 'openusd-scene-package', required: true });
  return requirements;
}

module.exports = {
  VERSION,
  RECEIPT_SCHEMA,
  ENVELOPE_SCHEMA,
  STATUSES: STATUSES.slice(),
  ASSURANCE_SCOPES: ASSURANCE_SCOPES.slice(),
  ReferenceValidatorRegistry,
  defaultProviders,
  recommendedRequirements,
  normalizeProvider,
  validateReceipt,
  validateEnvelope,
  artifactBytes,
  canonical,
  sha256,
};
