'use strict';

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);
const ALWAYS_SENSITIVE = new Set([
  'GH_TOKEN', 'GITHUB_TOKEN', 'AWS_PROFILE', 'GOOGLE_APPLICATION_CREDENTIALS',
  'VERTEX_CREDENTIALS_PATH', 'CLAUDE_CODE_OAUTH_TOKEN', 'COPILOT_GITHUB_TOKEN'
]);
const LOCAL_PROVIDER_PAIRS = [
  ['LM_BASE_URL', 'LM_API_KEY'],
  ['OPENAI_BASE_URL', 'OPENAI_API_KEY'],
  ['ACTUAL_BASE_URL', 'ACTUAL_API_KEY'],
  ['NVIDIA_BASE_URL', 'NVIDIA_API_KEY'],
  ['OLLAMA_BASE_URL', 'OLLAMA_API_KEY']
];

function isSecretKey(name) {
  const key = String(name || '').toUpperCase();
  return ALWAYS_SENSITIVE.has(key) || /(API[_-]?KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|AUTH_COOKIE|SESSION_COOKIE)/i.test(key);
}
function isLoopbackUrl(value) {
  try {
    const parsed = new URL(String(value));
    return ['http:', 'https:'].includes(parsed.protocol) && LOOPBACK_HOSTS.has(parsed.hostname.toLowerCase());
  } catch (_) { return false; }
}
function validatePolicy(policy) {
  const errors = [];
  if (!policy || typeof policy !== 'object' || Array.isArray(policy)) errors.push('policy must be an object');
  if (policy && policy.schema !== 'axm.hermes-policy/v1') errors.push('unsupported policy schema');
  if (policy && !['research', 'operator'].includes(policy.posture)) errors.push('posture must be research or operator');
  if (policy && (!policy.mode || (policy.mode.hub_sandbox === true) === (policy.mode.external_mode === true))) errors.push('exactly one of mode.hub_sandbox or mode.external_mode must be true');
  if (policy && (!policy.consent || typeof policy.consent.enabled !== 'boolean')) errors.push('consent.enabled must be boolean');
  if (policy && (!policy.provider_egress || !['local_only', 'explicit_remote'].includes(policy.provider_egress.mode))) errors.push('provider_egress.mode must be local_only or explicit_remote');
  if (policy && policy.provider_egress && policy.provider_egress.allowed_secret_env !== undefined && !Array.isArray(policy.provider_egress.allowed_secret_env)) errors.push('provider_egress.allowed_secret_env must be an array');
  if (policy && policy.allowed_tools !== undefined && !Array.isArray(policy.allowed_tools)) errors.push('allowed_tools must be an array');
  if (policy && policy.research_tools !== undefined && !Array.isArray(policy.research_tools)) errors.push('research_tools must be an array');
  const caps = policy && policy.capabilities;
  if (!caps || typeof caps !== 'object' || Array.isArray(caps)) errors.push('capabilities must be an object');
  else Object.entries(caps).forEach(([key, value]) => { if (typeof value !== 'boolean') errors.push(`capabilities.${key} must be boolean`); });
  return { ok: errors.length === 0, errors };
}

function sanitizeEnvironment(baseEnv, policy) {
  const checked = validatePolicy(policy);
  if (!checked.ok) throw new Error('invalid AXM Hermes policy: ' + checked.errors.join('; '));
  const source = Object.assign({}, baseEnv || {});
  const env = {};
  const stripped = [];
  const allowedSecrets = new Set((policy.provider_egress.allowed_secret_env || []).map(String));

  for (const [key, value] of Object.entries(source)) {
    if (isSecretKey(key)) { stripped.push(key); continue; }
    env[key] = value;
  }

  if (policy.provider_egress.mode === 'local_only') {
    delete env.HTTP_PROXY; delete env.http_proxy;
    delete env.HTTPS_PROXY; delete env.https_proxy;
    delete env.ALL_PROXY; delete env.all_proxy;
    const priorNoProxy = String(source.NO_PROXY || source.no_proxy || '').split(',').map(x => x.trim()).filter(Boolean);
    env.NO_PROXY = Array.from(new Set(priorNoProxy.concat(['127.0.0.1', 'localhost', '::1']))).join(',');
    for (const [baseKey, secretKey] of LOCAL_PROVIDER_PAIRS) {
      const baseUrl = source[baseKey];
      if (baseUrl && isLoopbackUrl(baseUrl)) {
        env[baseKey] = baseUrl;
        if (source[secretKey]) env[secretKey] = source[secretKey];
      } else if (baseUrl) delete env[baseKey];
    }
  } else {
    for (const key of allowedSecrets) {
      if (Object.prototype.hasOwnProperty.call(source, key) && isSecretKey(key)) env[key] = source[key];
    }
  }

  const restoredCount = Object.keys(env).filter(isSecretKey).length;
  return {
    env,
    report: {
      mode: policy.provider_egress.mode,
      inherited_secret_count: stripped.length,
      explicitly_restored_secret_count: restoredCount,
      secret_variable_names_stored: false,
      network_isolation_claimed: false
    }
  };
}

module.exports = { LOOPBACK_HOSTS, isSecretKey, isLoopbackUrl, validatePolicy, sanitizeEnvironment };
