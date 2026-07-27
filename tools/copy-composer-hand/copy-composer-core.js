(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AXMCopyComposer = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var VERSION = '0.1.0';
  var REQUEST_SCHEMA = 'axm.copy.request/v1';
  var CANDIDATE_SCHEMA = 'axm.copy.candidate/v1';
  var RECEIPT_SCHEMA = 'axm.copy.receipt/v1';
  var MAX_PROMPT = 1000;

  var QUOTE_PATTERNS = [
    '{subject} grows when every honest limit becomes the next buildable hand.',
    '{subject} turns every honest limit into a visible path forward.',
    '{subject} does not hide what is missing; it makes the missing piece buildable.',
    '{subject} grows stronger each time truth becomes structure and structure becomes possibility.',
    '{subject} begins with an honest gap and grows by building the bridge.',
    '{subject} proves that progress is not knowing everything—it is making the next honest step possible.',
    '{subject} grows by keeping truth visible and turning each missing piece into shared capability.',
    '{subject} is what happens when honest limits become modular possibilities.'
  ];

  var SLOGAN_PATTERNS = [
    '{subject}: truth made buildable.',
    '{subject}: honest roots, growing capability.',
    '{subject}: see the gap, build the bridge.',
    '{subject}: one truth, many possible hands.'
  ];

  var STOP = {
    a:1, an:1, and:1, for:1, from:1, in:1, into:1, make:1, me:1, of:1,
    on:1, please:1, the:1, to:1, with:1, write:1, create:1, inspiring:1,
    inspirational:1, quote:1, slogan:1, motto:1, tagline:1, caption:1
  };

  function text(value, max) {
    return String(value == null ? '' : value).trim().slice(0, max || 300);
  }

  function clean(value) {
    return text(value, MAX_PROMPT).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  function hashNumber(value) {
    var result = 2166136261;
    var input = String(value || '');
    for (var i = 0; i < input.length; i += 1) {
      result ^= input.charCodeAt(i);
      result = Math.imul(result, 16777619);
    }
    return result >>> 0;
  }

  function fingerprint(value) {
    return 'fnv1a32-' + hashNumber(value).toString(16).padStart(8, '0');
  }

  function titleCase(value) {
    return String(value || '').split(/\s+/).filter(Boolean).map(function (part) {
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    }).join(' ');
  }

  function inferSubject(prompt, explicitSubject) {
    var provided = text(explicitSubject, 80);
    if (provided) return provided.toLowerCase() === 'axm' ? 'AXM' : titleCase(provided);
    if (/\baxm\b/i.test(prompt)) return 'AXM';
    var quoted = String(prompt).match(/["“]([^"”]{1,80})["”]/);
    if (quoted) return titleCase(quoted[1]);
    var parts = clean(prompt).split(/\s+/).filter(function (part) { return part && !STOP[part]; });
    return parts.length ? titleCase(parts.slice(0, 3).join(' ')) : 'This work';
  }

  function inferKind(prompt, explicitKind) {
    var kind = text(explicitKind, 20).toLowerCase();
    if (kind === 'slogan' || kind === 'motto' || kind === 'tagline') return 'slogan';
    if (/\b(slogan|motto|tagline)\b/i.test(prompt)) return 'slogan';
    return 'quote';
  }

  function normalize(input) {
    input = input || {};
    var prompt = text(input.prompt || input.description || input.goal, MAX_PROMPT);
    if (!prompt) throw new Error('copy prompt required');
    var normalizedPrompt = clean(prompt);
    return {
      schema: REQUEST_SCHEMA,
      prompt: prompt,
      normalizedPrompt: normalizedPrompt,
      subject: inferSubject(prompt, input.subject),
      kind: inferKind(prompt, input.kind),
      tone: /\b(inspiring|inspirational|hopeful|motivating)\b/i.test(prompt) ? 'inspiring' : text(input.tone || 'clear', 30).toLowerCase(),
      maxCharacters: Math.max(40, Math.min(280, Number(input.maxCharacters) || 220)),
      seed: text(input.seed || normalizedPrompt, 160)
    };
  }

  function fill(pattern, subject) {
    return pattern.replace(/\{subject\}/g, subject);
  }

  function compose(input) {
    var request = normalize(input);
    var patterns = request.kind === 'slogan' ? SLOGAN_PATTERNS : QUOTE_PATTERNS;
    var baseHash = hashNumber(request.seed + '|' + request.kind + '|' + request.subject + '|' + request.tone);
    var order = [];
    for (var i = 0; i < patterns.length; i += 1) order.push((baseHash + i * 5) % patterns.length);
    order = order.filter(function (value, index) { return order.indexOf(value) === index; });
    for (var missing = 0; missing < patterns.length; missing += 1) if (order.indexOf(missing) < 0) order.push(missing);
    var variants = order.slice(0, Math.min(3, patterns.length)).map(function (index) {
      return { text: fill(patterns[index], request.subject), patternIndex: index };
    }).filter(function (item) { return item.text.length <= request.maxCharacters; });
    if (!variants.length) throw new Error('no bounded copy candidate fits maxCharacters');
    var candidate = variants[0];
    var recipe = {
      engine: 'deterministic-phrase-grammar',
      engineVersion: VERSION,
      kind: request.kind,
      patternIndex: candidate.patternIndex,
      seedFingerprint: fingerprint(request.seed)
    };
    var proofInput = JSON.stringify({ request: request, candidate: candidate.text, recipe: recipe });
    var checks = [
      { id: 'requested-subject', status: candidate.text.indexOf(request.subject) >= 0 ? 'PASS' : 'FAIL' },
      { id: 'bounded-length', status: candidate.text.length <= request.maxCharacters ? 'PASS' : 'FAIL', actual: candidate.text.length, maximum: request.maxCharacters },
      { id: 'candidate-only-authority', status: 'PASS' },
      { id: 'network-and-model-calls', status: 'PASS', actual: 0 }
    ];
    return {
      schema: CANDIDATE_SCHEMA,
      version: VERSION,
      request: request,
      text: candidate.text,
      alternatives: variants.slice(1).map(function (item) { return item.text; }),
      recipe: recipe,
      receipt: {
        schema: RECEIPT_SCHEMA,
        outcome: checks.every(function (check) { return check.status === 'PASS'; }) ? 'PASS' : 'FAIL',
        checks: checks,
        replayFingerprint: fingerprint(proofInput),
        authority: 'candidate-text-only',
        writes: [],
        networkCalls: 0,
        modelCalls: 0,
        promotionAuthority: 'NONE'
      }
    };
  }

  return {
    VERSION: VERSION,
    REQUEST_SCHEMA: REQUEST_SCHEMA,
    CANDIDATE_SCHEMA: CANDIDATE_SCHEMA,
    RECEIPT_SCHEMA: RECEIPT_SCHEMA,
    normalize: normalize,
    compose: compose
  };
});
