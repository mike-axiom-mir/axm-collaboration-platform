#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Core = require('../../../tools/deterministic-json-core');

const ROOT = path.resolve(__dirname, '../../..');
const BEFORE_OUTPUT = path.join(__dirname, 'BEFORE_WORKSHOP_JSON_AUDIT.json');
const CURRENT_OUTPUT = path.join(__dirname, 'CURRENT_WORKSHOP_JSON_AUDIT.json');
const BASE_COMMIT = 'ad79bf3e42c055dac0e408f4dfc12d4b0be08bf4';
const SOURCE_ROOTS = ['shared', 'tools', 'hub', 'worlds', 'site'];
const EXCLUDED_SEGMENTS = new Set(['.git', 'node_modules', 'vendor', 'dist', 'docs']);
const RUNTIME_MODULES = [
  'shared/baseline-simulation-lab/baseline-simulation-lab.js',
  'shared/cognitive-resource/cognitive-resource-core.js',
  'shared/holodeck/core.js',
  'shared/human-benefit-evidence/human-benefit-evidence.js',
  'shared/mirror-core/core/utils.js',
  'shared/portable-baseline-capsule/portable-baseline-capsule.js',
  'shared/research-contribution-intake/research-contribution-intake.js',
  'shared/sensorium/core.js',
  'shared/simulation-lab-extension-intake/simulation-lab-extension-intake.js',
  'shared/verification-snapshot-continuity/verification-snapshot-continuity.js',
  'shared/verification-source-evolution-review/verification-source-evolution-review.js',
  'shared/verified-capability-loop/verified-capability-loop.js',
  'shared/voluntary-phone-qa-campaign/voluntary-phone-qa-campaign.js'
];
const SELECTED_COHORT = [
  'baseline-simulation-lab',
  'human-benefit-evidence',
  'portable-baseline-capsule',
  'research-contribution-intake',
  'simulation-lab-extension-intake',
  'verified-capability-loop'
];
const DEFERRED_CANDIDATES = [{
  moduleId: 'voluntary-phone-qa-campaign',
  gapTypes: ['CONTRACT', 'EVIDENCE'],
  reason: 'the current QA Lab emits generic device and journey receipts but does not declare or implement the campaign-required game-specific physical-phone observation candidate route',
  requiredCapabilities: [
    'phone.qa.current-contract-compatible',
    'phone.qa.physical-observation-capture'
  ]
}];
const STATIC_PATTERNS = {
  jsonRoundTripClone: /JSON\.parse\s*\(\s*JSON\.stringify\s*\(/g,
  stableStringifyDefinition: /function\s+stableStringify\s*\(|(?:const|let|var)\s+stableStringify\s*=/g,
  rawJsonDigest: /(?:createHash|sha(?:256|512)?|digest)[^\n]{0,160}JSON\.stringify\s*\(/gi,
  sortedObjectKeys: /Object\.keys\s*\([^\n]{0,160}\)\.sort\s*\(/g,
  strictCoreReference: /deterministic-json-core/g
};

function rawSha256(value) {
  return 'sha256:' + crypto.createHash('sha256').update(value).digest('hex');
}

function portable(relativePath) {
  return relativePath.split(path.sep).join('/');
}

function excluded(relativePath, directory) {
  const normalized = portable(relativePath);
  const segments = normalized.split('/');
  if (segments.some((segment) => EXCLUDED_SEGMENTS.has(segment))) return true;
  if (normalized === 'site/guest/full' || normalized.startsWith('site/guest/full/')) return true;
  if (!directory) {
    if (!/\.(?:c?js|mjs)$/i.test(normalized) || /\.min\.js$/i.test(normalized)) return true;
    if (segments.some((segment) => /^(?:test|tests|fixtures?)$/i.test(segment))) return true;
    if (/(?:^|[-_.])(?:selftest|test|spec)(?:[-_.]|$)/i.test(path.basename(normalized))) return true;
  }
  return false;
}

function sourceFiles() {
  const files = [];
  function walk(absoluteDirectory, relativeDirectory) {
    for (const entry of fs.readdirSync(absoluteDirectory, { withFileTypes: true })) {
      const relativePath = path.join(relativeDirectory, entry.name);
      if (excluded(relativePath, entry.isDirectory())) continue;
      const absolutePath = path.join(absoluteDirectory, entry.name);
      if (entry.isDirectory()) walk(absolutePath, relativePath);
      else if (entry.isFile() && !excluded(relativePath, false)) files.push(portable(relativePath));
    }
  }
  for (const sourceRoot of SOURCE_ROOTS) {
    const absolute = path.join(ROOT, sourceRoot);
    if (fs.existsSync(absolute)) walk(absolute, sourceRoot);
  }
  return files.sort();
}

function staticAudit() {
  const files = sourceFiles();
  const findings = [];
  for (const relativePath of files) {
    const source = fs.readFileSync(path.join(ROOT, relativePath), 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
    const counts = {};
    for (const [id, expression] of Object.entries(STATIC_PATTERNS)) {
      expression.lastIndex = 0;
      counts[id] = Array.from(source.matchAll(expression)).length;
    }
    const risky = counts.jsonRoundTripClone + counts.stableStringifyDefinition + counts.rawJsonDigest;
    if (!risky && !counts.sortedObjectKeys && !counts.strictCoreReference) continue;
    findings.push({
      path: relativePath,
      sourceSha256: rawSha256(source),
      counts,
      classification: counts.strictCoreReference
        ? 'STRICT_CORE_REFERENCED'
        : risky
          ? 'POTENTIAL_REPRESENTATION_SEAM'
          : 'KEY_SORT_REVIEW_ONLY'
    });
  }
  return { filesScanned: files.length, findings };
}

function safeFixtures() {
  const shared = { x: 1 };
  return [
    ['sorted-object-keys', { z: 1, a: [true, null, 'x'] }],
    ['unicode-and-escaping', { 'line\nkey': 'snowman ☃ and quote "' }],
    ['negative-zero-normalization', { value: -0 }],
    ['nested-arrays-and-objects', [{ b: 2, a: 1 }, [], { deep: [false, 0, null] }]],
    ['finite-numbers', { negative: -12.5, positive: 42, small: 0.00025 }],
    ['repeated-non-cyclic-reference', { left: shared, right: shared }]
  ];
}

function unsafeFixtures() {
  return [
    ['root-undefined', () => undefined],
    ['object-property-undefined', () => ({ lost: undefined })],
    ['nested-undefined', () => ({ nested: { lost: undefined } })],
    ['array-undefined', () => [1, undefined]],
    ['sparse-array', () => { const value = []; value.length = 1; return value; }],
    ['nan', () => ({ number: NaN })],
    ['positive-infinity', () => ({ number: Infinity })],
    ['negative-infinity', () => ({ number: -Infinity })],
    ['bigint', () => ({ number: 1n })],
    ['symbol', () => ({ value: Symbol('x') })],
    ['function', () => ({ value: function fixture() {} })],
    ['date', () => ({ value: new Date('2020-01-01T00:00:00.000Z') })],
    ['cycle', () => { const value = {}; value.self = value; return value; }]
  ];
}

function unsafeResult(stableStringify, fixtureId, makeValue) {
  try {
    const canonical = stableStringify(makeValue());
    if (typeof canonical !== 'string') return { fixtureId, state: 'INVALID_CANONICAL_TEXT', detail: 'non-string result' };
    try {
      JSON.parse(canonical);
      return { fixtureId, state: 'ACCEPTED_OR_TRANSFORMED_UNSAFE_STATE' };
    } catch (error) {
      return { fixtureId, state: 'INVALID_CANONICAL_TEXT', detail: error.name + ': ' + error.message };
    }
  } catch (error) {
    return { fixtureId, state: 'REFUSED', detail: error.name + ': ' + error.message };
  }
}

function runtimeAudit() {
  return RUNTIME_MODULES.map((relativePath) => {
    const absolutePath = path.join(ROOT, relativePath);
    delete require.cache[require.resolve(absolutePath)];
    const api = require(absolutePath);
    if (typeof api.stableStringify !== 'function') throw new Error(relativePath + ' does not export stableStringify');
    const unsafe = unsafeFixtures().map(([fixtureId, makeValue]) => unsafeResult(api.stableStringify, fixtureId, makeValue));
    const safe = safeFixtures().map(([fixtureId, value]) => {
      const canonical = api.stableStringify(value);
      return {
        fixtureId,
        strictCoreExact: canonical === Core.canonicalJson(value),
        canonicalSha256: rawSha256(canonical)
      };
    });
    const refused = unsafe.filter((item) => item.state === 'REFUSED').length;
    const invalid = unsafe.filter((item) => item.state === 'INVALID_CANONICAL_TEXT').length;
    const accepted = unsafe.filter((item) => item.state === 'ACCEPTED_OR_TRANSFORMED_UNSAFE_STATE').length;
    return {
      path: relativePath,
      moduleId: relativePath.split('/').slice(0, -1).pop(),
      sourceSha256: rawSha256(fs.readFileSync(absolutePath, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')),
      usesStrictCore: fs.readFileSync(absolutePath, 'utf8').includes('deterministic-json-core'),
      unsafe,
      safe,
      counts: { refused, invalidCanonicalText: invalid, acceptedOrTransformed: accepted, safeExact: safe.filter((item) => item.strictCoreExact).length },
      classification: refused === unsafe.length
        ? 'REFUSES_ALL_UNSAFE_FIXTURES'
        : invalid
          ? 'INVALID_CANONICAL_TEXT'
          : 'SILENT_OR_TRANSFORMED_UNSAFE_STATE'
    };
  });
}

function build(generatedAt) {
  const staticResult = staticAudit();
  const runtime = runtimeAudit();
  const result = {
    schema: 'axm.workshop-deterministic-json-audit/v1',
    version: '0.1.0',
    generatedAt,
    status: 'TEST',
    baseCommit: BASE_COMMIT,
    scope: {
      sourceRoots: SOURCE_ROOTS,
      extensions: ['.js', '.cjs', '.mjs'],
      excluded: ['docs', 'node_modules', 'vendor', 'dist', 'site/guest/full', 'minified files', 'test/selftest/spec files and test/fixture directories'],
      staticPatternAuditOnly: true,
      htmlInlineScriptsAudited: false,
      nonJavaScriptAudited: false,
      semanticIntentAutomaticallyProved: false
    },
    static: {
      filesScanned: staticResult.filesScanned,
      findings: staticResult.findings,
      counts: {
        findings: staticResult.findings.length,
        strictCoreReferenced: staticResult.findings.filter((item) => item.classification === 'STRICT_CORE_REFERENCED').length,
        potentialRepresentationSeams: staticResult.findings.filter((item) => item.classification === 'POTENTIAL_REPRESENTATION_SEAM').length,
        keySortReviewOnly: staticResult.findings.filter((item) => item.classification === 'KEY_SORT_REVIEW_ONLY').length,
        jsonRoundTripCloneOccurrences: staticResult.findings.reduce((sum, item) => sum + item.counts.jsonRoundTripClone, 0),
        stableStringifyDefinitions: staticResult.findings.reduce((sum, item) => sum + item.counts.stableStringifyDefinition, 0),
        rawJsonDigestOccurrences: staticResult.findings.reduce((sum, item) => sum + item.counts.rawJsonDigest, 0)
      }
    },
    runtime: {
      modules: runtime,
      counts: {
        modules: runtime.length,
        refusesAllUnsafeFixtures: runtime.filter((item) => item.classification === 'REFUSES_ALL_UNSAFE_FIXTURES').length,
        invalidCanonicalText: runtime.filter((item) => item.classification === 'INVALID_CANONICAL_TEXT').length,
        silentOrTransformedUnsafeState: runtime.filter((item) => item.classification === 'SILENT_OR_TRANSFORMED_UNSAFE_STATE').length,
        unsafeFixturePairs: runtime.length * unsafeFixtures().length,
        refusedFixturePairs: runtime.reduce((sum, item) => sum + item.counts.refused, 0),
        safeFixturePairs: runtime.length * safeFixtures().length,
        safeStrictCoreExact: runtime.reduce((sum, item) => sum + item.counts.safeExact, 0)
      }
    },
    selectedCohort: {
      moduleIds: SELECTED_COHORT,
      reason: 'direct roots or direct input surfaces for Grounded Growth capability, human-evidence, baseline-simulation, research-intake, and extension-intake chains',
      automaticPromotion: false,
      migrationAuthority: 'REVIEW_BRANCH_ONLY'
    },
    deferredCandidates: DEFERRED_CANDIDATES,
    limits: {
      staticFindingIsConfirmedBug: false,
      runtimeProbeCoversNonExportedHelpers: false,
      browserBehaviorProved: false,
      humanBenefitEstablished: false,
      modelLearningImprovementEstablished: false,
      shadowCloneCandidateEvaluated: false
    },
    digest: null
  };
  const payload = JSON.parse(Core.canonicalJson(result));
  delete payload.digest;
  result.digest = rawSha256(Core.canonicalJson(payload));
  return result;
}

function write(output, generatedAt) {
  const result = build(generatedAt);
  fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n', 'utf8');
  return result;
}

function verifyRecorded(output) {
  const result = JSON.parse(fs.readFileSync(output, 'utf8'));
  const payload = JSON.parse(Core.canonicalJson(result));
  const digest = payload.digest;
  delete payload.digest;
  if (digest !== rawSha256(Core.canonicalJson(payload))) throw new Error(path.basename(output) + ' digest mismatch');
  return result;
}

if (require.main === module) {
  let output = CURRENT_OUTPUT;
  let generatedAt = '2026-08-20T05:55:00.000Z';
  if (process.argv.includes('--write-before')) {
    output = BEFORE_OUTPUT;
    generatedAt = '2026-08-20T05:50:00.000Z';
    write(output, generatedAt);
  } else if (process.argv.includes('--write-current')) {
    write(output, generatedAt);
  }
  const result = verifyRecorded(output);
  process.stdout.write(JSON.stringify({
    file: path.basename(output),
    static: result.static.counts,
    runtime: result.runtime.counts,
    digest: result.digest
  }) + '\n');
}

module.exports = {
  ROOT,
  BEFORE_OUTPUT,
  CURRENT_OUTPUT,
  BASE_COMMIT,
  SOURCE_ROOTS,
  RUNTIME_MODULES,
  SELECTED_COHORT,
  DEFERRED_CANDIDATES,
  build,
  write,
  verifyRecorded
};
