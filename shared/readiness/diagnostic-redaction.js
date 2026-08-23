'use strict';

const os = require('os');

const CREDENTIAL_PLACEHOLDER = '<REDACTED_CREDENTIAL>';
const NAMED_CREDENTIAL_SOURCES = [
  '(?:[A-Za-z0-9]+[_-])*(?:api[_-]?key|access[_-]?token|auth(?:entication)?[_-]?token|refresh[_-]?token|session[_-]?token|id[_-]?token|client[_-]?secret|secret[_-]?access[_-]?key|private[_-]?key|password|passwd|pwd)',
  '(?:[A-Z][A-Z0-9]*_)+(?:TOKEN|SECRET|PASSWORD)'
];
const CLI_CREDENTIAL_SOURCE = '(?:[a-z0-9]+-)*(?:api-key|access-token|auth(?:entication)?-token|refresh-token|session-token|id-token|client-secret|secret-access-key|private-key|password|passwd|pwd|token|secret)';
const CREDENTIAL_FINGERPRINTS = [
  /\bsk-[A-Za-z0-9_-]{20,}\b/g,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g,
  /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g,
  /\bAIza[0-9A-Za-z_-]{30,}\b/g,
  /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g,
  /\b(?:sk|rk)_live_[A-Za-z0-9]{16,}\b/g,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g
];

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function flexiblePathPattern(value) {
  const text = String(value || '').trim().replace(/[\\/]+$/, '');
  if (!text) return null;
  const leading = /^[\\/]/.test(text);
  const parts = text.split(/[\\/]+/).filter(Boolean);
  if (!parts.length) return null;
  return (leading ? '[\\\\/]+' : '') + parts.map(escapeRegex).join('[\\\\/]+');
}

function configuredRoots(options) {
  const input = options || {};
  const rows = [
    { value:input.workspaceRoot, label:'<WORKSPACE>' },
    { value:input.homeRoot || os.homedir(), label:'<HOME>' },
    { value:input.tempRoot || os.tmpdir(), label:'<TEMP>' },
    { value:process.env.USERPROFILE, label:'<HOME>' },
    { value:process.env.HOME, label:'<HOME>' },
    { value:process.env.TEMP, label:'<TEMP>' },
    { value:process.env.TMP, label:'<TEMP>' }
  ].concat(Array.isArray(input.machineRoots) ? input.machineRoots.map(value => ({ value, label:'<MACHINE_ROOT>' })) : []);
  const seen = new Set();
  return rows.filter(row => {
    const key = String(row.value || '').replace(/[\\/]+$/, '').toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    row.key = key;
    return true;
  }).sort((left, right) => right.key.length - left.key.length);
}

function redactPrefixedValues(text, prefixPattern, flags) {
  const quoted = new RegExp('(' + prefixPattern + ')(["\\\'])([^\\r\\n]*?)\\2', flags);
  const unquoted = new RegExp('(' + prefixPattern + ')(?!["\\\'])([^\\s,;&]+)', flags);
  text = text.replace(quoted, function (_, prefix, quote) {
    return prefix + quote + CREDENTIAL_PLACEHOLDER + quote;
  });
  return text.replace(unquoted, '$1' + CREDENTIAL_PLACEHOLDER);
}

function redactCredentialEvidence(value) {
  let text = String(value);

  // Header values can include a scheme plus a credential, so remove the
  // complete value instead of retaining a potentially secret suffix.
  text = text.replace(/(^|[\r\n])([ \t]*(?:authorization|proxy-authorization|x-api-key|x-auth-token|cookie|set-cookie)[ \t]*:[ \t]*)[^\r\n]*/gi, '$1$2' + CREDENTIAL_PLACEHOLDER);

  // URI user-info and named query or fragment values are credential-bearing
  // even when the surrounding URL remains useful diagnostic context.
  text = text.replace(/\b([A-Za-z][A-Za-z0-9+.-]*:\/\/)[^\/\s@]+@/g, '$1' + CREDENTIAL_PLACEHOLDER + '@');

  NAMED_CREDENTIAL_SOURCES.forEach(source => {
    const prefix = '(?:^|[^A-Za-z0-9_])_*' + source + '[ \t]*[:=][ \t]*';
    text = redactPrefixedValues(text, prefix, 'gmi');
  });

  const cliPrefix = '--' + CLI_CREDENTIAL_SOURCE + '(?:[ \t]+|=)';
  text = redactPrefixedValues(text, cliPrefix, 'gi');

  // Multiline private-key material and a bounded set of recognizable token
  // fingerprints are removed even when no label survived into the diagnostic.
  text = text.replace(/-----BEGIN ([A-Z ]*PRIVATE KEY)-----[\s\S]*?-----END \1-----/g, CREDENTIAL_PLACEHOLDER);
  CREDENTIAL_FINGERPRINTS.forEach(pattern => { text = text.replace(pattern, CREDENTIAL_PLACEHOLDER); });
  return text;
}

function redactDiagnostic(value, options) {
  if (value == null) return null;
  let text = redactCredentialEvidence(value);
  configuredRoots(options).forEach(root => {
    const pattern = flexiblePathPattern(root.value);
    if (!pattern) return;
    text = text.replace(new RegExp(pattern + '(?=$|[\\\\/])', 'gi'), root.label);
  });

  // Residual absolute paths are removed even when they are outside the known
  // workspace, home, or temporary roots. Relative paths and URLs stay useful.
  text = text.replace(/(^|[\s("'=])(?:file:\/\/\/)?[A-Za-z]:[\\/][^\r\n"'<>|)\]}]*/gm, '$1<ABSOLUTE_PATH>');
  text = text.replace(/(^|[\s("'=])\\\\[^\r\n"'<>|)\]}]*/gm, '$1<UNC_PATH>');
  text = text.replace(/(^|[\s("'=])file:\/\/\/[^\r\n"'<>|)\]}]*/gm, '$1<ABSOLUTE_PATH>');
  text = text.replace(/(^|[\s("'=])\/(?!\/)[^\r\n"'<>|)\]}]*/gm, '$1<ABSOLUTE_PATH>');
  return text;
}

function failureTail(value, options) {
  if (value == null) return null;
  const input = options || {};
  const limit = Number.isInteger(input.limit) ? Math.max(1, input.limit) : 1200;
  return redactDiagnostic(value, input).slice(-limit);
}

function sanitizeVerificationResult(result, options) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) return result;
  return Object.assign({}, result, {
    failureTail:result.failureTail == null ? null : failureTail(result.failureTail, options)
  });
}

module.exports = { CREDENTIAL_PLACEHOLDER, redactDiagnostic, failureTail, sanitizeVerificationResult };
