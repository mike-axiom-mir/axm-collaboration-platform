(function (root, factory) {
  'use strict';
  var api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AXMHandForgeBridgeCore = api;
})(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';

  var SPEC_SCHEMA = 'axm.missing-hand-specification/v1';
  var PLAN_SCHEMA = 'axm.hand-verification-plan/v1';
  var RESULT_SCHEMA = 'axm.hand-forge-bridge-result/v1';
  var RECEIPT_SCHEMA = 'axm.hand-forge-bridge-receipt/v1';
  var CAPABILITY = 'capability.adapt.hand-specification-to-forge/v1';
  var SUPPORTED_KINDS = ['hub-module', 'proposal-analyzer', 'machine-capability'];
  var RISKS = ['LOW', 'MEDIUM', 'HIGH'];

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function text(value) {
    return String(value == null ? '' : value).trim();
  }

  function boundedText(value, label, minimum, maximum) {
    var normalized = text(value);
    if (normalized.length < minimum) throw new Error(label + ' must contain at least ' + minimum + ' characters');
    if (normalized.length > maximum) throw new Error(label + ' exceeds ' + maximum + ' characters');
    return normalized;
  }

  function validDate(value) {
    var date = value ? new Date(value) : new Date();
    if (Number.isNaN(date.getTime())) throw new Error('generatedAt must be a valid date');
    return date.toISOString();
  }

  function dependencies(overrides) {
    var supplied = overrides || {};
    var verification = supplied.verification || (root && root.AXMHandVerificationCore);
    var forge = supplied.forge || (root && root.AXMForgeCore);
    if (typeof require === 'function') {
      if (!verification) verification = require('../hand-verification-lab/hand-verification-core');
      if (!forge) forge = require('../agent-tool-forge/forge-core');
    }
    if (!verification || typeof verification.parseSpecification !== 'function') {
      throw new Error('Hand Verification Core dependency is unavailable');
    }
    if (!forge || typeof forge.buildPackage !== 'function') {
      throw new Error('Agent Tool Forge Core dependency is unavailable');
    }
    return { verification: verification, forge: forge };
  }

  function safeId(value) {
    return text(value).toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64);
  }

  function humanName(capabilityId) {
    var base = text(capabilityId).replace(/\/v\d+(?:\.\d+)*$/i, '').replace(/[._/-]+/g, ' ');
    return base.replace(/\b\w/g, function (letter) { return letter.toUpperCase(); }) + ' Hand';
  }

  function suggestedRisk(specification) {
    var gap = text(specification && specification.gapType).toUpperCase();
    var effects = (specification && specification.sideEffects || []).map(text).filter(Boolean);
    var hasEffects = effects.some(function (entry) { return !/^(none|no side effects?)\.?$/i.test(entry); });
    if (gap === 'AUTHORITY' || gap === 'SUBSTRATE' || hasEffects) return 'HIGH';
    return 'MEDIUM';
  }

  function suggestedCapabilities(specification, forge) {
    var source = [
      specification.purpose,
      specification.primary_output,
      specification.resourceBudget,
      specification.failureAndRecovery
    ].concat(specification.inputsAndSchemas || [], specification.outputsAndSchemas || [], specification.sideEffects || [], specification.permissionsAndConsent || []).join(' ').toLowerCase();
    var rules = [
      ['storage', /\bstor(?:e|age|ed)|persist|archive|database|record\b/],
      ['files', /\bfile|folder|path|directory|archive|write\b/],
      ['network', /\bnetwork|https?|api\b|webhook|remote\b/],
      ['export', /\bexport|download|package\b/],
      ['identity', /\bidentity|actor|account|profile\b/],
      ['ai', /\bai\b|model|inference|prompt\b/],
      ['bridge', /\bbridge|connector|transport\b/],
      ['wisdom', /\bwisdom|knowledge|lesson\b/]
    ];
    var values = ['gate'];
    rules.forEach(function (rule) { if (rule[1].test(source)) values.push(rule[0]); });
    return values.filter(function (value, index) {
      return forge.CAPABILITIES.indexOf(value) >= 0 && values.indexOf(value) === index;
    });
  }

  function suggestConfig(specification, overrides) {
    var deps = dependencies(overrides && overrides.dependencies);
    var spec = deps.verification.parseSpecification(specification);
    return {
      id: safeId(spec.capabilityId),
      name: humanName(spec.capabilityId),
      kind: 'machine-capability',
      risk: suggestedRisk(spec),
      capabilities: suggestedCapabilities(spec, deps.forge),
      actor: { id: 'local-user', type: 'human' }
    };
  }

  function normalizeCapabilities(value, forge) {
    var rows = Array.isArray(value) ? value : text(value).split(/[\r\n,]+/);
    var unique = [];
    rows.map(text).filter(Boolean).forEach(function (entry) {
      if (forge.CAPABILITIES.indexOf(entry) < 0) throw new Error('unsupported Forge capability: ' + entry);
      if (unique.indexOf(entry) < 0) unique.push(entry);
    });
    if (!unique.length) throw new Error('at least one Forge capability is required');
    return unique;
  }

  function normalizeConfig(specification, config, forge) {
    var suggested = {
      id: safeId(specification.capabilityId),
      name: humanName(specification.capabilityId),
      kind: 'machine-capability',
      risk: suggestedRisk(specification),
      capabilities: suggestedCapabilities(specification, forge),
      actor: { id: 'local-user', type: 'human' }
    };
    var input = config || {};
    var kind = text(input.kind || suggested.kind);
    if (SUPPORTED_KINDS.indexOf(kind) < 0) {
      throw new Error('kind must be one of ' + SUPPORTED_KINDS.join(', ') + '; Foundation-bearing routes require an explicit separate source intake');
    }
    var risk = text(input.risk || suggested.risk).toUpperCase();
    if (RISKS.indexOf(risk) < 0) throw new Error('risk must be LOW, MEDIUM or HIGH');
    var actor = input.actor || suggested.actor;
    return {
      id: boundedText(safeId(input.id || suggested.id), 'id', 2, 64),
      name: boundedText(input.name || suggested.name, 'name', 2, 120),
      kind: kind,
      risk: risk,
      capabilities: normalizeCapabilities(input.capabilities || suggested.capabilities, forge),
      actor: {
        id: boundedText(actor.id || 'local-user', 'actor.id', 1, 80),
        type: boundedText(actor.type || 'human', 'actor.type', 1, 40)
      }
    };
  }

  function bindSources(specification, plan, verification) {
    var spec = verification.parseSpecification(specification);
    var checked = verification.validatePlan(plan);
    if (!checked.pass) throw new Error('invalid verification plan: ' + checked.errors.join('; '));
    if (plan.schema !== PLAN_SCHEMA) throw new Error('verification plan schema must be ' + PLAN_SCHEMA);
    if (!plan.target || plan.target.capabilityId !== spec.capabilityId) {
      throw new Error('verification plan target does not match the specification capabilityId');
    }
    var expected = verification.fingerprint(spec);
    if (plan.target.specificationFingerprint !== expected) {
      throw new Error('verification plan is not source-bound to this exact specification');
    }
    return { specification: spec, plan: clone(plan), specificationFingerprint: expected };
  }

  function buildBoundaries(specification) {
    var rows = [];
    (specification.sideEffects || []).forEach(function (entry) { rows.push('SIDE EFFECT: ' + entry); });
    (specification.permissionsAndConsent || []).forEach(function (entry) { rows.push('PERMISSION / CONSENT: ' + entry); });
    rows.push('RESOURCE BUDGET: ' + specification.resourceBudget);
    rows.push('FAILURE / RECOVERY: ' + specification.failureAndRecovery);
    rows.push('COMPATIBILITY: ' + specification.compatibilityVersionContract);
    rows.push('VERIFICATION: ' + specification.verificationContract);
    rows.push('PROMOTION GATE: ' + specification.promotionGate);
    rows.push('PACKAGE BOUNDARY: This is an EXPERIMENTAL review package; installation, execution, permission grant, promotion, release and CANON remain outside this package.');
    return rows;
  }

  function build(specification, plan, config, generatedAt, overrides) {
    var deps = dependencies(overrides);
    var bound = bindSources(specification, plan, deps.verification);
    var normalizedConfig = normalizeConfig(bound.specification, config, deps.forge);
    var spec = bound.specification;
    var draftInput = {
      id: normalizedConfig.id,
      name: normalizedConfig.name,
      version: 'v0.1',
      kind: normalizedConfig.kind,
      risk: normalizedConfig.risk,
      purpose: spec.purpose,
      primary_output: spec.outputsAndSchemas[0],
      capabilities: normalizedConfig.capabilities,
      tags: ['hand-specification', 'verification-plan', 'gap-' + text(spec.gapType).toLowerCase(), 'draft-only'],
      boundaries: buildBoundaries(spec),
      actor: normalizedConfig.actor
    };
    var validation = deps.forge.validateDraft(draftInput);
    if (!validation.ok) throw new Error('Forge draft validation failed: ' + validation.errors.join('; '));
    var pkg = deps.forge.buildPackage(validation.draft, {});
    if (!pkg.ok) throw new Error('Agent Tool Forge package build refused: ' + (pkg.errors || []).join('; '));
    var forgeOnlyFingerprint = pkg.packageFingerprint;
    pkg.files['hand-specification.json'] = JSON.stringify(spec, null, 2) + '\n';
    pkg.files['verification-plan.json'] = JSON.stringify(bound.plan, null, 2) + '\n';
    pkg.packageFingerprint = deps.forge.fingerprintFiles(pkg.files);
    pkg.bridge = {
      id: 'hand-forge-bridge/v0.1',
      specificationFingerprint: bound.specificationFingerprint,
      verificationPlanFingerprint: deps.forge.sha256(deps.forge.stable(bound.plan)),
      forgeOnlyPackageFingerprint: forgeOnlyFingerprint,
      sourceArtifactsIncluded: ['hand-specification.json', 'verification-plan.json']
    };
    pkg.install = { performed: false, target: 'tools/' + pkg.draft.id, statusRequested: 'EXPERIMENTAL' };

    var at = validDate(generatedAt);
    var receipt = {
      schema: RECEIPT_SCHEMA,
      capability: CAPABILITY,
      status: 'DRAFT_PACKAGE_PREPARED',
      source: {
        capabilityId: spec.capabilityId,
        specificationSchema: SPEC_SCHEMA,
        specificationFingerprint: bound.specificationFingerprint,
        verificationPlanSchema: PLAN_SCHEMA,
        verificationPlanFingerprint: pkg.bridge.verificationPlanFingerprint
      },
      mapping: {
        draftId: pkg.draft.id,
        draftKind: pkg.draft.kind,
        risk: pkg.draft.risk,
        capabilities: clone(pkg.draft.capabilities),
        actor: clone(pkg.draft.actor)
      },
      output: {
        forgeDraftSchema: pkg.draft.schema,
        forgeDraftFingerprint: pkg.draftFingerprint,
        forgePackageSchema: pkg.schema,
        forgePackageFingerprint: pkg.packageFingerprint,
        fileCount: Object.keys(pkg.files).length,
        statusRequested: pkg.install.statusRequested
      },
      provenance: {
        foundry: spec.provenance && spec.provenance.foundry || null,
        verificationLab: plan.provenance && plan.provenance.lab || null,
        forgeVersion: pkg.forgeVersion,
        bridge: 'hand-forge-bridge/v0.1',
        generatedAt: at
      },
      truth: {
        sourceBound: true,
        sourceArtifactsIncluded: true,
        packagePrepared: true,
        installed: false,
        executed: false,
        authorityGranted: false,
        promoted: false,
        released: false,
        canon: false
      }
    };
    return {
      schema: RESULT_SCHEMA,
      capability: CAPABILITY,
      status: 'EXPERIMENTAL_REVIEW_PACKAGE',
      package: pkg,
      receipt: receipt
    };
  }

  function downloadNames(result) {
    var id = result && result.package && result.package.draft && result.package.draft.id || 'hand-draft';
    return {
      review: id + '-forge-review.json',
      receipt: id + '-bridge-receipt.json',
      zip: id + '-EXPERIMENTAL.zip'
    };
  }

  return {
    SPEC_SCHEMA: SPEC_SCHEMA,
    PLAN_SCHEMA: PLAN_SCHEMA,
    RESULT_SCHEMA: RESULT_SCHEMA,
    RECEIPT_SCHEMA: RECEIPT_SCHEMA,
    CAPABILITY: CAPABILITY,
    SUPPORTED_KINDS: clone(SUPPORTED_KINDS),
    RISKS: clone(RISKS),
    descriptor: {
      id: 'hand-forge-bridge',
      capability: CAPABILITY,
      version: '1.0.0',
      status: 'TEST',
      accepts: [SPEC_SCHEMA, PLAN_SCHEMA],
      produces: [RESULT_SCHEMA, 'axm.forge-draft/v1', 'axm.forge-package/v1', RECEIPT_SCHEMA],
      sideEffects: []
    },
    safeId: safeId,
    humanName: humanName,
    suggestedRisk: suggestedRisk,
    suggestConfig: suggestConfig,
    bindSources: function (specification, plan, overrides) {
      var deps = dependencies(overrides);
      return bindSources(specification, plan, deps.verification);
    },
    build: build,
    downloadNames: downloadNames
  };
});
