'use strict';

const crypto = require('crypto');

const CELL_ID = 'axm.mirror.cell/provider-implementation-evidence-v1';
const SCHEMA = 'axm.mirror.provider-implementation-evidence-assessment/v1';

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((output, key) => { output[key] = stable(value[key]); return output; }, {});
}
function digest(value) { return crypto.createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(stable(value))).digest('hex'); }
function clean(value, maximum = 500) { return String(value == null ? '' : value).replace(/[\u0000-\u001f]/g, '').trim().slice(0, maximum); }
function unique(values) { return Array.from(new Set((Array.isArray(values) ? values : []).filter(value => typeof value === 'string' && value.trim()).map(value => value.trim()))).sort(); }

function scanLexicalSource(bytes) {
  const source = bytes.toString('utf8');
  const masked = source.split('');
  const literals = [];
  const errors = [];
  let index = 0;
  while (index < source.length) {
    const char = source[index];
    const next = source[index + 1];
    if (char === '/' && next === '/') {
      masked[index] = masked[index + 1] = ' ';
      index += 2;
      while (index < source.length && source[index] !== '\n') masked[index++] = ' ';
      continue;
    }
    if (char === '/' && next === '*') {
      const start = index;
      masked[index] = masked[index + 1] = ' ';
      index += 2;
      let closed = false;
      while (index < source.length) {
        if (source[index] === '*' && source[index + 1] === '/') {
          masked[index] = masked[index + 1] = ' ';
          index += 2;
          closed = true;
          break;
        }
        if (source[index] !== '\n' && source[index] !== '\r') masked[index] = ' ';
        index += 1;
      }
      if (!closed) errors.push(`unterminated block comment at ${start}`);
      continue;
    }
    if (char === '\'' || char === '"' || char === '`') {
      const quote = char;
      const start = index;
      masked[index++] = ' ';
      let value = '';
      let escaped = false;
      let dynamicTemplate = false;
      let closed = false;
      while (index < source.length) {
        const current = source[index];
        if (current !== '\n' && current !== '\r') masked[index] = ' ';
        if (escaped) {
          const simple = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', v: '\v', '0': '\0' };
          value += Object.prototype.hasOwnProperty.call(simple, current) ? simple[current] : current;
          escaped = false;
          index += 1;
          continue;
        }
        if (current === '\\') {
          escaped = true;
          index += 1;
          continue;
        }
        if (quote === '`' && current === '$' && source[index + 1] === '{') dynamicTemplate = true;
        if (current === quote) {
          index += 1;
          closed = true;
          break;
        }
        if ((quote === '\'' || quote === '"') && (current === '\n' || current === '\r')) break;
        value += current;
        index += 1;
      }
      if (!closed) errors.push(`unterminated string literal at ${start}`);
      else literals.push({ value, quote, dynamicTemplate });
      continue;
    }
    index += 1;
  }
  return { source, masked: masked.join(''), literals, errors };
}

function closedAuthority() {
  return {
    providerIdentityInference: false,
    outerRequirementBinding: false,
    implementationSelection: false,
    architectureSelection: false,
    architectureEvaluation: false,
    sourceExecution: false,
    providerCandidateBuild: false,
    providerContractWrite: false,
    declarationWrite: false,
    workshopWrite: false,
    readinessClaim: false,
    availabilityClaim: false,
    install: false,
    automaticStart: false,
    automaticRepair: false,
    permissionGrant: false,
    liveExecution: false,
    trainingAdmission: false,
    toolUse: false,
    networkUse: false,
    worldAction: false,
    semanticTruthWrite: false,
    runtimePromotion: false,
    canonChange: false,
    identityChange: false
  };
}

function evaluate(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('provider implementation evidence input is required');
  const allowed = ['relativePath', 'content', 'contentSha256', 'symbolic', 'insideRoot', 'demandedSelectors'];
  const unexpected = Object.keys(input).filter(key => !allowed.includes(key));
  if (unexpected.length) throw new Error(`unknown critical provider implementation evidence fields: ${unexpected.join(', ')}`);
  const relativePath = clean(input.relativePath, 500).replace(/\\/g, '/');
  const demandedSelectors = unique(input.demandedSelectors);
  if (!relativePath || !demandedSelectors.length) throw new Error('provider implementation evidence requires relativePath and demandedSelectors');
  const bytes = Buffer.isBuffer(input.content) ? input.content : Buffer.from(String(input.content == null ? '' : input.content), 'utf8');
  const contentSha256 = clean(input.contentSha256 || digest(bytes), 64).toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(contentSha256) || digest(bytes) !== contentSha256) throw new Error('provider implementation evidence content digest mismatch');
  const boundaryRefused = input.symbolic === true || input.insideRoot !== true;
  const lexical = boundaryRefused ? { source: '', masked: '', literals: [], errors: [] } : scanLexicalSource(bytes);
  const exactLiterals = boundaryRefused ? [] : lexical.literals.filter(item => !item.dynamicTemplate && demandedSelectors.includes(item.value));
  const exactSelectors = unique(exactLiterals.map(item => item.value));
  const counts = Object.fromEntries(exactSelectors.map(selector => [selector, exactLiterals.filter(item => item.value === selector).length]));
  const code = lexical.masked;
  const signals = {
    commonJsExportSyntax: /\bmodule\s*\.\s*exports\b/.test(code),
    namedRegisterFunctionSyntax: /\bfunction\s+register\s*\(/.test(code),
    registrationCallSyntax: /\.\s*register\s*\(/.test(code),
    assertionCallSyntax: /\bassert\s*\./.test(code),
    relativeRequireSyntax: /\brequire\s*\(/.test(code),
    selftestPath: /(^|\/)selftest\.js$/i.test(relativePath)
  };
  let classification = 'NO_DEMANDED_SELECTOR_LITERAL';
  let state = 'NOT_A_DEMANDED_SELECTOR_SOURCE';
  if (boundaryRefused) {
    classification = 'BOUNDARY_REFUSED_SOURCE';
    state = 'SOURCE_REFUSED';
  } else if (lexical.errors.length) {
    classification = 'MALFORMED_LEXICAL_SOURCE';
    state = 'SOURCE_REFUSED';
  } else if (exactSelectors.length) {
    state = 'SELECTOR_SOURCE_WITNESS_NOT_PROVIDER_BINDING';
    if (signals.commonJsExportSyntax && (signals.namedRegisterFunctionSyntax || signals.registrationCallSyntax)) classification = 'SELECTOR_BEARING_EXPORT_AND_REGISTRATION_SOURCE';
    else if (signals.assertionCallSyntax || signals.selftestPath) classification = 'SELECTOR_BEARING_TEST_SOURCE';
    else if (signals.commonJsExportSyntax) classification = 'SELECTOR_BEARING_EXPORT_SOURCE';
    else if (signals.namedRegisterFunctionSyntax || signals.registrationCallSyntax) classification = 'SELECTOR_BEARING_REGISTRATION_SOURCE';
    else classification = 'SELECTOR_BEARING_SOURCE';
  }
  const assessment = {
    schema: SCHEMA,
    cellId: CELL_ID,
    assessmentDigest: null,
    document: {
      relativePath,
      sha256: contentSha256,
      bytes: bytes.length,
      insideRoot: input.insideRoot === true,
      symbolic: input.symbolic === true,
      lexicalErrors: lexical.errors.slice(0, 10)
    },
    demandedSelectors,
    exactSelectorLiterals: exactSelectors,
    exactSelectorLiteralCounts: counts,
    sourceSignals: signals,
    classification,
    state,
    providerIdentityBound: false,
    outerRequirementBound: false,
    implementationSelected: false,
    sourceExecuted: false,
    authority: closedAuthority(),
    boundary: 'Static lexical evidence can show that a demanded selector literal occurs in a content-digested source with export, registration, or test syntax. It cannot prove which provider owns the source, bind the outer requirement, select an implementation or architecture, execute code, write Workshop, claim readiness, train, grant, install, or promote.'
  };
  assessment.assessmentDigest = digest(Object.assign({}, assessment, { assessmentDigest: null }));
  return assessment;
}

function verify(assessment, input) {
  const expected = evaluate(input);
  if (!assessment || assessment.assessmentDigest !== expected.assessmentDigest || JSON.stringify(stable(assessment)) !== JSON.stringify(stable(expected))) throw new Error('provider implementation evidence assessment mismatch');
  return true;
}

module.exports = { CELL_ID, SCHEMA, digest, scanLexicalSource, evaluate, verify };
