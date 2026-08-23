(function (root, factory) {
  'use strict';
  var Fabric = typeof module !== 'undefined' && module.exports
    ? require('../../shared/capability-fabric/core.js')
    : root.AXMCapabilityFabric;
  var Verification = typeof module !== 'undefined' && module.exports
    ? require('../hand-verification-lab/hand-verification-core.js')
    : root.AXMHandVerificationCore;
  var api = factory(Fabric, Verification);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AXMCapabilityRecipeFoundry = api;
})(typeof self !== 'undefined' ? self : this, function (Fabric, Verification) {
  'use strict';

  if (!Fabric || typeof Fabric.importRecipeProposal !== 'function') {
    throw new Error('Capability Fabric core is required');
  }
  if (!Verification || typeof Verification.parseSpecification !== 'function') {
    throw new Error('Hand Verification core is required');
  }

  var VERSION = '1.0.0';
  var INTENT_SCHEMA = 'axm.capability-recipe-authoring-intent/v1';
  var PLAN_SCHEMA = 'axm.capability-recipe-foundry-plan/v1';
  var PACKET_SCHEMA = 'axm.capability-recipe-review-packet/v1';
  var RECEIPT_SCHEMA = 'axm.capability-recipe-foundry-receipt/v1';
  var CHECKLIST_SCHEMA = 'axm.capability-recipe-source-review-checklist/v1';
  var SOURCE_KINDS = Object.freeze(['HUMAN', 'CODEX', 'MIRROR', 'CODE_FABRIC']);
  var MAX_SOURCE_BYTES = 98304;
  var MAX_PACKET_FILES = 12;
  var MAX_PACKET_BYTES = 524288;
  var AUTHORITY = Object.freeze({
    installed: false,
    registered: false,
    staged: false,
    promoted: false,
    canonChanged: false,
    permissionsChanged: false,
    recipeActivated: false,
    foundationChanged: false
  });
  var FILES = Object.freeze({
    proposal: 'recipe-proposal.json',
    specification: 'capability-specification.json',
    verification: 'verification-plan.json',
    builder: 'builder-contribution.js',
    builderSelftest: 'builder-contribution.selftest.js',
    checklist: 'review-checklist.json',
    readme: 'README.md'
  });

  function clone(value) { return JSON.parse(Fabric.canonicalJson(value)); }
  function own(value, key) { return Object.prototype.hasOwnProperty.call(Object(value), key); }
  function plain(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
  function pretty(value) { return JSON.stringify(JSON.parse(Fabric.canonicalJson(value)), null, 2) + '\n'; }
  function bytes(value) {
    var text = typeof value === 'string' ? value : Fabric.canonicalJson(value);
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text).length;
    return Buffer.byteLength(text, 'utf8');
  }
  function safeId(value) { return /^[a-z][a-z0-9-]{2,79}$/.test(String(value || '')); }
  function safeVersion(value) { return /^[0-9]+\.[0-9]+\.[0-9]+$/.test(String(value || '')); }
  function safeDigest(value) { return /^sha256:[a-f0-9]{64}$/.test(String(value || '')); }
  function safePath(value) {
    return typeof value === 'string' && value.length > 0 && value.length <= 120 &&
      !/^(?:[A-Za-z]:|[\\/])/.test(value) &&
      value.replace(/\\/g, '/').split('/').every(function (part) { return part && part !== '.' && part !== '..'; });
  }
  function issue(code, path, message, details) {
    var row = { code: code, path: path, message: message };
    if (details !== undefined) row.details = details;
    return row;
  }
  function exactKeys(value, keys, path, errors) {
    if (!plain(value)) { errors.push(issue('OBJECT_REQUIRED', path, 'Expected a plain object.')); return false; }
    Object.keys(value).forEach(function (key) {
      if (keys.indexOf(key) < 0) errors.push(issue('UNKNOWN_FIELD', path + '.' + key, 'Unknown fields are refused.'));
    });
    keys.forEach(function (key) {
      if (!own(value, key)) errors.push(issue('FIELD_REQUIRED', path + '.' + key, 'Required field is missing.'));
    });
    return true;
  }
  function without(value, key) { var copy = clone(value); delete copy[key]; return copy; }
  function normalizedSource(value) {
    var text = String(value == null ? '' : value).replace(/\r\n?/g, '\n');
    if (text && !text.endsWith('\n')) text += '\n';
    return text;
  }
  function falseAuthority(value, path, errors) {
    if (!exactKeys(value, Object.keys(AUTHORITY), path, errors)) return;
    Object.keys(AUTHORITY).forEach(function (key) {
      if (value[key] !== false) errors.push(issue('AUTHORITY_CONFLICT', path + '.' + key, 'Foundry authority must remain false.'));
    });
  }
  function cloneAuthority() { return clone(AUTHORITY); }

  function recipeFromIntent(intent) {
    var authored = intent.recipe;
    return {
      schema: Fabric.PROPOSAL_RECIPE_SCHEMA,
      id: authored.id,
      version: authored.version,
      title: authored.title,
      summary: authored.summary,
      family: authored.family,
      builderId: authored.builderId,
      activation: 'INACTIVE_PROPOSAL',
      reviewPolicy: {
        activation: 'source-review-and-merge',
        sharedUseRequires: 'MIKE_TOBI_MERGE',
        canonAuthority: 'NONE'
      },
      candidatePolicy: clone(authored.candidatePolicy),
      parameterSpec: clone(authored.parameterSpec),
      exampleRequest: clone(authored.exampleRequest),
      boundaries: clone(authored.boundaries),
      verifiers: clone(authored.verifiers)
    };
  }

  function proposalFromIntent(intent) {
    var recipe = recipeFromIntent(intent);
    return {
      schema: Fabric.PROPOSAL_SCHEMA,
      sourceKind: intent.sourceKind,
      recipe: recipe,
      proposalDigest: Fabric.digest(recipe)
    };
  }

  function sealIntent(draft) {
    draft = plain(draft) ? draft : {};
    var contribution = plain(draft.contribution) ? draft.contribution : {};
    var intent = {
      schema: INTENT_SCHEMA,
      id: String(draft.id || ''),
      sourceKind: String(draft.sourceKind || ''),
      specification: clone(draft.specification || {}),
      verificationPlan: clone(draft.verificationPlan || {}),
      recipe: clone(draft.recipe || {}),
      contribution: {
        schema: 'axm.capability-builder-contribution/v1',
        builderId: String(contribution.builderId || ''),
        moduleFormat: 'COMMONJS_BUILDER_CONTRIBUTION_V1',
        builderSource: normalizedSource(contribution.builderSource),
        builderSelftestSource: normalizedSource(contribution.builderSelftestSource)
      },
      status: 'EXPERIMENTAL',
      authority: 'NONE',
      intentDigest: ''
    };
    intent.intentDigest = Fabric.digest(without(intent, 'intentDigest'));
    return intent;
  }

  function validateIntent(intent) {
    var errors = [];
    var topKeys = ['schema', 'id', 'sourceKind', 'specification', 'verificationPlan', 'recipe', 'contribution', 'status', 'authority', 'intentDigest'];
    if (!exactKeys(intent, topKeys, '$', errors)) return { ok: false, errors: errors };
    if (intent.schema !== INTENT_SCHEMA) errors.push(issue('SCHEMA_MISMATCH', '$.schema', 'Expected ' + INTENT_SCHEMA + '.'));
    if (!safeId(intent.id)) errors.push(issue('INTENT_ID_INVALID', '$.id', 'Intent id must be lowercase and hyphenated.'));
    if (SOURCE_KINDS.indexOf(intent.sourceKind) < 0) errors.push(issue('SOURCE_KIND_INVALID', '$.sourceKind', 'Source kind must preserve the exact author class.'));
    if (intent.status !== 'EXPERIMENTAL' || intent.authority !== 'NONE') errors.push(issue('INTENT_AUTHORITY_CONFLICT', '$', 'Authoring intent remains EXPERIMENTAL with authority NONE.'));

    var specification = null;
    try { specification = Verification.parseSpecification(intent.specification); }
    catch (error) { errors.push(issue('SPECIFICATION_INVALID', '$.specification', error.message)); }
    var planCheck = Verification.validatePlan(intent.verificationPlan);
    if (!planCheck.pass) errors.push(issue('VERIFICATION_PLAN_INVALID', '$.verificationPlan', 'Verification plan failed validation.', planCheck.errors));
    if (specification && planCheck.pass) {
      if (!intent.verificationPlan.target || intent.verificationPlan.target.capabilityId !== specification.capabilityId) {
        errors.push(issue('VERIFICATION_TARGET_MISMATCH', '$.verificationPlan.target.capabilityId', 'Verification plan targets another capability.'));
      }
      var expectedFingerprint = Verification.fingerprint(specification);
      if (!intent.verificationPlan.target || intent.verificationPlan.target.specificationFingerprint !== expectedFingerprint) {
        errors.push(issue('VERIFICATION_SOURCE_MISMATCH', '$.verificationPlan.target.specificationFingerprint', 'Verification plan is not bound to this exact specification.', { expected: expectedFingerprint }));
      }
    }

    var recipeKeys = ['id', 'version', 'title', 'summary', 'family', 'builderId', 'candidatePolicy', 'parameterSpec', 'exampleRequest', 'boundaries', 'verifiers'];
    if (exactKeys(intent.recipe, recipeKeys, '$.recipe', errors)) {
      var recipeDraft = recipeFromIntent(intent);
      Fabric.validateRecipeProposalDraft(recipeDraft).errors.forEach(function (row) { errors.push(row); });
    }

    var contributionKeys = ['schema', 'builderId', 'moduleFormat', 'builderSource', 'builderSelftestSource'];
    if (exactKeys(intent.contribution, contributionKeys, '$.contribution', errors)) {
      if (intent.contribution.schema !== 'axm.capability-builder-contribution/v1') errors.push(issue('CONTRIBUTION_SCHEMA_MISMATCH', '$.contribution.schema', 'Builder contribution schema mismatch.'));
      if (intent.contribution.builderId !== (intent.recipe && intent.recipe.builderId)) errors.push(issue('BUILDER_ID_MISMATCH', '$.contribution.builderId', 'Contribution must name the proposed recipe builder.'));
      if (intent.contribution.moduleFormat !== 'COMMONJS_BUILDER_CONTRIBUTION_V1') errors.push(issue('MODULE_FORMAT_UNSUPPORTED', '$.contribution.moduleFormat', 'Only the reviewable CommonJS builder contribution contract is supported.'));
      ['builderSource', 'builderSelftestSource'].forEach(function (field) {
        var source = intent.contribution[field];
        if (typeof source !== 'string' || !source.trim()) errors.push(issue('SOURCE_REQUIRED', '$.contribution.' + field, 'Exact source text is required.'));
        else {
          if (source.indexOf('\0') >= 0) errors.push(issue('SOURCE_NUL_REFUSED', '$.contribution.' + field, 'NUL bytes are refused.'));
          if (source !== normalizedSource(source)) errors.push(issue('SOURCE_NOT_CANONICAL', '$.contribution.' + field, 'Use LF line endings and one final newline.'));
          if (bytes(source) > MAX_SOURCE_BYTES) errors.push(issue('SOURCE_BYTES_EXCEEDED', '$.contribution.' + field, 'Source exceeds the 96 KiB review ceiling.'));
        }
      });
    }

    var expectedDigest = Fabric.digest(without(intent, 'intentDigest'));
    if (!safeDigest(intent.intentDigest) || intent.intentDigest !== expectedDigest) {
      errors.push(issue('INTENT_DIGEST_MISMATCH', '$.intentDigest', 'Intent digest does not match canonical content.', { expected: expectedDigest, actual: intent.intentDigest }));
    }
    if (!errors.length) {
      var proposal = proposalFromIntent(intent);
      var inspection = Fabric.importRecipeProposal(proposal);
      if (!inspection.ok || inspection.active !== false) errors.push(issue('PROPOSAL_IMPORT_REFUSED', '$.recipe', 'Capability Fabric refused the derived inactive proposal.', inspection.errors || []));
    }
    return { ok: errors.length === 0, errors: errors };
  }

  function hold(code, message, details) {
    var row = { code: code, message: message };
    if (details !== undefined) row.details = details;
    return row;
  }

  function plan(intent) {
    var validation = validateIntent(intent);
    var result = {
      schema: PLAN_SCHEMA,
      foundryVersion: VERSION,
      status: validation.ok ? 'READY' : 'HELD',
      intentDigest: intent && intent.intentDigest || null,
      targetRecipeId: intent && intent.recipe && intent.recipe.id || null,
      builderId: intent && intent.contribution && intent.contribution.builderId || null,
      outputStatus: 'INACTIVE_PROPOSAL',
      outputFileCount: validation.ok ? 7 : 0,
      executesBuilderSource: false,
      executesGeneratedCode: false,
      holds: validation.ok ? [] : [hold('AUTHORING_CONTRACT_HOLD', 'Recipe authoring intent failed its closed contract.', validation.errors)],
      authority: cloneAuthority(),
      planDigest: ''
    };
    result.planDigest = Fabric.digest(without(result, 'planDigest'));
    return result;
  }

  function buildChecklist(intent, proposal) {
    var rows = [
      ['source-review', 'Builder contribution receives line-by-line source review.', 'reviewed diff and named reviewer'],
      ['contract-binding', 'Builder output contract matches the exact capability specification.', 'specification-to-source mapping'],
      ['verification-binding', 'Every required verification-plan case is mapped to executable or observational evidence.', 'ten-case evidence route'],
      ['deterministic-parity', 'Two builds from identical parameters produce byte-identical artifacts.', 'independent rebuild transcript'],
      ['generated-syntax', 'Every emitted executable file parses in the declared runtime.', 'syntax-check transcript'],
      ['generated-behavior', 'Generated selftests and independent adversarial tests pass in an authorized host.', 'test transcript and fixtures'],
      ['resource-boundary', 'Input and output ceilings are enforced with typed refusal.', 'boundary and over-budget evidence'],
      ['authority-ceiling', 'No install, registration, permission, promotion, Foundation, or CANON mutation path exists.', 'before-and-after authority observation'],
      ['inactive-ingress', 'Capability Fabric imports the proposal only as INACTIVE_PROPOSAL.', 'proposal inspection receipt'],
      ['merge-gate', 'Mike reviews the source, evidence, compatibility, and catalog diff before any activation.', 'explicit merge decision']
    ].map(function (row, index) {
      return { id: 'review-' + String(index + 1).padStart(2, '0'), family: row[0].toUpperCase().replace(/-/g, '_'), claim: row[1], evidenceRequired: row[2], verdict: 'NOT_RUN' };
    });
    return {
      schema: CHECKLIST_SCHEMA,
      status: 'SOURCE_REVIEW_REQUIRED',
      target: {
        capabilityId: intent.specification.capabilityId,
        recipeId: proposal.recipe.id,
        builderId: proposal.recipe.builderId,
        intentDigest: intent.intentDigest,
        proposalDigest: proposal.proposalDigest
      },
      cases: rows,
      truth: { testsExecuted: false, evidenceRecorded: false, sourceReviewed: false, recipeActivated: false, promoted: false, canon: false }
    };
  }

  function buildReadme(intent, proposal) {
    return [
      '# ' + proposal.recipe.title + ' — inactive recipe review packet',
      '',
      'Status: `EXPERIMENTAL` · activation: `INACTIVE_PROPOSAL`',
      '',
      intent.specification.purpose,
      '',
      'This packet binds one exact capability specification and verification plan to one authored builder contribution and one Capability Fabric recipe draft.',
      '',
      '## Review route',
      '',
      '1. Inspect `capability-specification.json` and `verification-plan.json`.',
      '2. Review `builder-contribution.js` line by line.',
      '3. In an explicitly authorized test host, run `node builder-contribution.selftest.js`.',
      '4. Record independent evidence against `review-checklist.json`.',
      '5. If evidence is sufficient, prepare a separate reviewed Capability Fabric source/catalog diff.',
      '6. Mike remains the merge and CANON gate.',
      '',
      'The Foundry did not execute the builder or generated code. This packet does not install, register, stage, promote, activate, mutate Foundation, grant permission, or change CANON.',
      ''
    ].join('\n');
  }

  function makeFiles(intent, proposal) {
    var checklist = buildChecklist(intent, proposal);
    var files = {};
    files[FILES.proposal] = pretty(proposal);
    files[FILES.specification] = pretty(intent.specification);
    files[FILES.verification] = pretty(intent.verificationPlan);
    files[FILES.builder] = intent.contribution.builderSource;
    files[FILES.builderSelftest] = intent.contribution.builderSelftestSource;
    files[FILES.checklist] = pretty(checklist);
    files[FILES.readme] = buildReadme(intent, proposal);
    return files;
  }

  function fileRows(files) {
    return Object.keys(files).sort().map(function (path) {
      return { path: path, bytes: bytes(files[path]), digest: Fabric.digest(files[path]) };
    });
  }

  function makePacket(intent, proposal, files) {
    var rows = fileRows(files);
    var total = rows.reduce(function (sum, row) { return sum + row.bytes; }, 0);
    if (rows.length > MAX_PACKET_FILES || total > MAX_PACKET_BYTES) throw new Error('Review packet exceeds its file or byte ceiling.');
    var packet = {
      schema: PACKET_SCHEMA,
      version: VERSION,
      id: intent.id,
      status: 'EXPERIMENTAL_REVIEW_PACKET',
      intentRef: { schema: INTENT_SCHEMA, id: intent.id, digest: intent.intentDigest },
      target: { capabilityId: intent.specification.capabilityId, recipeId: proposal.recipe.id, builderId: proposal.recipe.builderId },
      source: { kind: intent.sourceKind, specificationFingerprint: Verification.fingerprint(intent.specification), verificationPlanFingerprint: Verification.fingerprint(intent.verificationPlan) },
      proposalRef: { schema: Fabric.PROPOSAL_SCHEMA, digest: proposal.proposalDigest, activation: 'INACTIVE_PROPOSAL' },
      files: rows,
      totalBytes: total,
      truth: {
        specificationBound: true,
        verificationPlanBound: true,
        proposalInspectedInactive: true,
        builderSourceExecuted: false,
        generatedCodeExecuted: false,
        testsExecuted: false,
        sourceReviewed: false,
        runtimeProven: false
      },
      authority: cloneAuthority(),
      packetDigest: ''
    };
    packet.packetDigest = Fabric.digest(without(packet, 'packetDigest'));
    return packet;
  }

  function makeReceipt(intent, planValue, packet) {
    var receipt = {
      schema: RECEIPT_SCHEMA,
      version: VERSION,
      status: 'INACTIVE_REVIEW_PACKET_COMPLETE',
      intentRef: clone(packet.intentRef),
      planRef: { schema: PLAN_SCHEMA, digest: planValue.planDigest },
      packetRef: { schema: PACKET_SCHEMA, id: packet.id, digest: packet.packetDigest },
      output: { recipeId: packet.target.recipeId, builderId: packet.target.builderId, fileCount: packet.files.length, totalBytes: packet.totalBytes },
      truth: {
        deterministicAssemblyCompleted: true,
        proposalActive: false,
        providerCalled: false,
        builderSourceExecuted: false,
        generatedCodeExecuted: false,
        testsExecuted: false,
        sourceReviewed: false,
        installed: false,
        registered: false,
        staged: false,
        promoted: false,
        canon: false
      },
      authority: cloneAuthority(),
      receiptDigest: ''
    };
    receipt.receiptDigest = Fabric.digest(without(receipt, 'receiptDigest'));
    return receipt;
  }

  function forge(intent) {
    var planValue = plan(intent);
    if (planValue.status !== 'READY') {
      return { schema: RECEIPT_SCHEMA, version: VERSION, status: 'HELD', plan: planValue, packet: null, files: {}, receipt: null, authority: cloneAuthority() };
    }
    var proposal = proposalFromIntent(intent);
    var inspection = Fabric.importRecipeProposal(proposal);
    if (!inspection.ok || inspection.active !== false) throw new Error('Capability Fabric inactive proposal inspection failed.');
    var files = makeFiles(intent, proposal);
    var packet = makePacket(intent, proposal, files);
    var receipt = makeReceipt(intent, planValue, packet);
    var result = { schema: RECEIPT_SCHEMA, version: VERSION, status: 'COMPLETE', plan: planValue, packet: packet, files: files, receipt: receipt, authority: cloneAuthority() };
    var checked = verify(result);
    if (!checked.ok) throw new Error('Foundry internal verification failed: ' + checked.errors.map(function (row) { return row.code; }).join(', '));
    return result;
  }

  function verify(result) {
    var errors = [];
    var resultKeys = ['schema', 'version', 'status', 'plan', 'packet', 'files', 'receipt', 'authority'];
    if (!exactKeys(result, resultKeys, '$', errors)) return { ok: false, errors: errors };
    if (result.schema !== RECEIPT_SCHEMA || result.version !== VERSION || result.status !== 'COMPLETE') errors.push(issue('RESULT_INVALID', '$', 'Expected a complete Foundry result.'));
    var packet = result.packet;
    var receipt = result.receipt;
    var files = result.files;
    var planValue = result.plan;
    var planKeys = ['schema', 'foundryVersion', 'status', 'intentDigest', 'targetRecipeId', 'builderId', 'outputStatus', 'outputFileCount', 'executesBuilderSource', 'executesGeneratedCode', 'holds', 'authority', 'planDigest'];
    if (exactKeys(planValue, planKeys, '$.plan', errors)) {
      if (planValue.schema !== PLAN_SCHEMA || planValue.foundryVersion !== VERSION || planValue.status !== 'READY' || planValue.outputStatus !== 'INACTIVE_PROPOSAL' || planValue.outputFileCount !== 7 || planValue.executesBuilderSource !== false || planValue.executesGeneratedCode !== false || !Array.isArray(planValue.holds) || planValue.holds.length !== 0) errors.push(issue('PLAN_INVALID', '$.plan', 'Complete results require an exact READY plan.'));
      falseAuthority(planValue.authority, '$.plan.authority', errors);
      var expectedPlanDigest = Fabric.digest(without(planValue, 'planDigest'));
      if (planValue.planDigest !== expectedPlanDigest) errors.push(issue('PLAN_DIGEST_MISMATCH', '$.plan.planDigest', 'Plan digest mismatch.'));
    }
    var packetKeys = ['schema', 'version', 'id', 'status', 'intentRef', 'target', 'source', 'proposalRef', 'files', 'totalBytes', 'truth', 'authority', 'packetDigest'];
    if (!exactKeys(packet, packetKeys, '$.packet', errors) || packet.schema !== PACKET_SCHEMA || packet.version !== VERSION || packet.status !== 'EXPERIMENTAL_REVIEW_PACKET') errors.push(issue('PACKET_IDENTITY_INVALID', '$.packet', 'Review packet identity mismatch.'));
    if (!plain(files)) errors.push(issue('FILES_INVALID', '$.files', 'Packet files must be a plain map.'));
    if (plain(packet)) {
      falseAuthority(packet.authority, '$.packet.authority', errors);
      exactKeys(packet.intentRef, ['schema', 'id', 'digest'], '$.packet.intentRef', errors);
      exactKeys(packet.target, ['capabilityId', 'recipeId', 'builderId'], '$.packet.target', errors);
      exactKeys(packet.source, ['kind', 'specificationFingerprint', 'verificationPlanFingerprint'], '$.packet.source', errors);
      exactKeys(packet.proposalRef, ['schema', 'digest', 'activation'], '$.packet.proposalRef', errors);
      if (!safeId(packet.id) || !packet.intentRef || packet.intentRef.schema !== INTENT_SCHEMA || packet.intentRef.id !== packet.id || !safeDigest(packet.intentRef.digest)) errors.push(issue('PACKET_INTENT_REF_INVALID', '$.packet.intentRef', 'Intent reference is malformed.'));
      if (!packet.target || !safeId(packet.target.recipeId) || !safeId(packet.target.builderId)) errors.push(issue('PACKET_TARGET_INVALID', '$.packet.target', 'Packet target is malformed.'));
      if (!packet.source || SOURCE_KINDS.indexOf(packet.source.kind) < 0) errors.push(issue('PACKET_SOURCE_INVALID', '$.packet.source.kind', 'Packet source kind is unsupported.'));
      if (!packet.proposalRef || packet.proposalRef.schema !== Fabric.PROPOSAL_SCHEMA || packet.proposalRef.activation !== 'INACTIVE_PROPOSAL' || !safeDigest(packet.proposalRef.digest)) errors.push(issue('PACKET_PROPOSAL_REF_INVALID', '$.packet.proposalRef', 'Packet proposal reference is malformed or active.'));
      var expectedPacketDigest = Fabric.digest(without(packet, 'packetDigest'));
      if (!safeDigest(packet.packetDigest) || packet.packetDigest !== expectedPacketDigest) errors.push(issue('PACKET_DIGEST_MISMATCH', '$.packet.packetDigest', 'Packet digest mismatch.'));
      if (plain(planValue) && (planValue.intentDigest !== packet.intentRef.digest || planValue.targetRecipeId !== packet.target.recipeId || planValue.builderId !== packet.target.builderId)) errors.push(issue('PLAN_PACKET_MISMATCH', '$.plan', 'READY plan does not bind this packet target.'));
      var expectedPaths = Array.isArray(packet.files) ? packet.files.map(function (row) { return row.path; }).sort() : [];
      var actualPaths = plain(files) ? Object.keys(files).sort() : [];
      if (Fabric.canonicalJson(expectedPaths) !== Fabric.canonicalJson(actualPaths)) errors.push(issue('FILE_SET_MISMATCH', '$.files', 'File map differs from the authority-bearing packet list.'));
      var requiredPaths = Object.keys(FILES).map(function (key) { return FILES[key]; }).sort();
      if (Fabric.canonicalJson(expectedPaths) !== Fabric.canonicalJson(requiredPaths)) errors.push(issue('FILE_CONTRACT_MISMATCH', '$.packet.files', 'Review packet must contain the exact seven review files.'));
      var total = 0;
      (Array.isArray(packet.files) ? packet.files : []).forEach(function (row, index) {
        var at = '$.packet.files[' + index + ']';
        if (!plain(row)) { errors.push(issue('FILE_ROW_INVALID', at, 'File row is malformed.')); return; }
        if (!exactKeys(row, ['path', 'bytes', 'digest'], at, errors) || !safePath(row.path) || !Number.isInteger(row.bytes) || row.bytes < 1 || !safeDigest(row.digest)) { errors.push(issue('FILE_ROW_INVALID', at, 'File row is malformed.')); return; }
        if (!own(files, row.path)) { errors.push(issue('FILE_MISSING', '$.files.' + row.path, 'Declared packet file is missing.')); return; }
        var observedBytes = bytes(files[row.path]);
        total += observedBytes;
        if (row.bytes !== observedBytes || row.digest !== Fabric.digest(files[row.path])) errors.push(issue('FILE_DIGEST_MISMATCH', at, 'File bytes or digest mismatch.'));
      });
      if (packet.totalBytes !== total || packet.files.length > MAX_PACKET_FILES || total > MAX_PACKET_BYTES) errors.push(issue('PACKET_RESOURCE_MISMATCH', '$.packet.totalBytes', 'Packet resource observation mismatch.'));
      var truth = packet.truth || {};
      exactKeys(truth, ['specificationBound', 'verificationPlanBound', 'proposalInspectedInactive', 'builderSourceExecuted', 'generatedCodeExecuted', 'testsExecuted', 'sourceReviewed', 'runtimeProven'], '$.packet.truth', errors);
      if (truth.specificationBound !== true || truth.verificationPlanBound !== true || truth.proposalInspectedInactive !== true) errors.push(issue('PACKET_TRUTH_MISSING', '$.packet.truth', 'Required binding truth is absent.'));
      ['builderSourceExecuted', 'generatedCodeExecuted', 'testsExecuted', 'sourceReviewed', 'runtimeProven'].forEach(function (key) {
        if (truth[key] !== false) errors.push(issue('PACKET_TRUTH_OVERCLAIM', '$.packet.truth.' + key, 'Foundry cannot claim this outcome.'));
      });
    }
    if (plain(files) && own(files, FILES.proposal)) {
      try {
        var proposal = JSON.parse(files[FILES.proposal]);
        var inspection = Fabric.importRecipeProposal(proposal);
        if (!inspection.ok || inspection.active !== false || inspection.requiresMikeMerge !== true) errors.push(issue('PROPOSAL_NOT_INACTIVE', '$.files.' + FILES.proposal, 'Proposal inspection did not preserve the inactive merge gate.'));
        if (plain(packet) && proposal.proposalDigest !== packet.proposalRef.digest) errors.push(issue('PROPOSAL_REF_MISMATCH', '$.packet.proposalRef.digest', 'Proposal reference mismatch.'));
      } catch (error) { errors.push(issue('PROPOSAL_FILE_INVALID', '$.files.' + FILES.proposal, error.message)); }
    }
    if (plain(files) && own(files, FILES.specification) && own(files, FILES.verification)) {
      try {
        var specification = Verification.parseSpecification(JSON.parse(files[FILES.specification]));
        var verificationPlan = JSON.parse(files[FILES.verification]);
        var verificationCheck = Verification.validatePlan(verificationPlan);
        if (!verificationCheck.pass || verificationPlan.target.capabilityId !== specification.capabilityId || verificationPlan.target.specificationFingerprint !== Verification.fingerprint(specification)) errors.push(issue('SOURCE_BINDING_INVALID', '$.files', 'Specification and verification plan are not exactly bound.'));
        if (plain(packet) && (!plain(packet.target) || !plain(packet.source) || packet.target.capabilityId !== specification.capabilityId || packet.source.specificationFingerprint !== Verification.fingerprint(specification) || packet.source.verificationPlanFingerprint !== Verification.fingerprint(verificationPlan))) errors.push(issue('PACKET_SOURCE_REF_MISMATCH', '$.packet.source', 'Packet source references differ from the review files.'));
      } catch (error) { errors.push(issue('SOURCE_FILE_INVALID', '$.files', error.message)); }
    }
    if (plain(files) && own(files, FILES.checklist)) {
      try {
        var checklist = JSON.parse(files[FILES.checklist]);
        exactKeys(checklist, ['schema', 'status', 'target', 'cases', 'truth'], '$.files.' + FILES.checklist, errors);
        if (checklist.schema !== CHECKLIST_SCHEMA || checklist.status !== 'SOURCE_REVIEW_REQUIRED' || !Array.isArray(checklist.cases) || checklist.cases.length !== 10 || checklist.cases.some(function (row) { return !row || row.verdict !== 'NOT_RUN'; })) errors.push(issue('CHECKLIST_INVALID', '$.files.' + FILES.checklist, 'Review checklist must retain ten NOT_RUN gates.'));
        if (plain(packet) && (!checklist.target || checklist.target.recipeId !== packet.target.recipeId || checklist.target.builderId !== packet.target.builderId || checklist.target.intentDigest !== packet.intentRef.digest || checklist.target.proposalDigest !== packet.proposalRef.digest)) errors.push(issue('CHECKLIST_TARGET_MISMATCH', '$.files.' + FILES.checklist, 'Checklist target differs from the packet.'));
        var checklistTruth = checklist.truth || {};
        ['testsExecuted', 'evidenceRecorded', 'sourceReviewed', 'recipeActivated', 'promoted', 'canon'].forEach(function (key) { if (checklistTruth[key] !== false) errors.push(issue('CHECKLIST_TRUTH_OVERCLAIM', '$.files.' + FILES.checklist + '.truth.' + key, 'Checklist cannot claim review evidence.')); });
      } catch (error) { errors.push(issue('CHECKLIST_FILE_INVALID', '$.files.' + FILES.checklist, error.message)); }
    }
    var receiptKeys = ['schema', 'version', 'status', 'intentRef', 'planRef', 'packetRef', 'output', 'truth', 'authority', 'receiptDigest'];
    if (!exactKeys(receipt, receiptKeys, '$.receipt', errors) || receipt.schema !== RECEIPT_SCHEMA || receipt.version !== VERSION || receipt.status !== 'INACTIVE_REVIEW_PACKET_COMPLETE') errors.push(issue('RECEIPT_IDENTITY_INVALID', '$.receipt', 'Foundry receipt identity mismatch.'));
    else {
      falseAuthority(receipt.authority, '$.receipt.authority', errors);
      exactKeys(receipt.intentRef, ['schema', 'id', 'digest'], '$.receipt.intentRef', errors);
      exactKeys(receipt.planRef, ['schema', 'digest'], '$.receipt.planRef', errors);
      exactKeys(receipt.packetRef, ['schema', 'id', 'digest'], '$.receipt.packetRef', errors);
      exactKeys(receipt.output, ['recipeId', 'builderId', 'fileCount', 'totalBytes'], '$.receipt.output', errors);
      if (receipt.planRef.schema !== PLAN_SCHEMA || receipt.planRef.digest !== (planValue && planValue.planDigest)) errors.push(issue('RECEIPT_PLAN_MISMATCH', '$.receipt.planRef', 'Receipt does not bind the exact plan.'));
      if (!plain(packet) || !plain(packet.target) || !Array.isArray(packet.files) || Fabric.canonicalJson(receipt.intentRef) !== Fabric.canonicalJson(packet.intentRef) || receipt.packetRef.schema !== PACKET_SCHEMA || receipt.packetRef.id !== packet.id || receipt.output.recipeId !== packet.target.recipeId || receipt.output.builderId !== packet.target.builderId || receipt.output.fileCount !== packet.files.length || receipt.output.totalBytes !== packet.totalBytes) errors.push(issue('RECEIPT_OUTPUT_MISMATCH', '$.receipt', 'Receipt output does not bind the exact packet.'));
      var expectedReceiptDigest = Fabric.digest(without(receipt, 'receiptDigest'));
      if (!safeDigest(receipt.receiptDigest) || receipt.receiptDigest !== expectedReceiptDigest) errors.push(issue('RECEIPT_DIGEST_MISMATCH', '$.receipt.receiptDigest', 'Foundry receipt digest mismatch.'));
      if (!plain(packet) || receipt.packetRef.digest !== packet.packetDigest) errors.push(issue('RECEIPT_PACKET_MISMATCH', '$.receipt.packetRef', 'Receipt does not bind this packet.'));
      var receiptTruth = receipt.truth || {};
      exactKeys(receiptTruth, ['deterministicAssemblyCompleted', 'proposalActive', 'providerCalled', 'builderSourceExecuted', 'generatedCodeExecuted', 'testsExecuted', 'sourceReviewed', 'installed', 'registered', 'staged', 'promoted', 'canon'], '$.receipt.truth', errors);
      ['proposalActive', 'providerCalled', 'builderSourceExecuted', 'generatedCodeExecuted', 'testsExecuted', 'sourceReviewed', 'installed', 'registered', 'staged', 'promoted', 'canon'].forEach(function (key) {
        if (receiptTruth[key] !== false) errors.push(issue('RECEIPT_TRUTH_OVERCLAIM', '$.receipt.truth.' + key, 'Receipt cannot claim this outcome.'));
      });
      if (receiptTruth.deterministicAssemblyCompleted !== true) errors.push(issue('RECEIPT_ASSEMBLY_TRUTH_MISSING', '$.receipt.truth.deterministicAssemblyCompleted', 'Deterministic assembly truth is required.'));
    }
    falseAuthority(result.authority, '$.authority', errors);
    return { ok: errors.length === 0, errors: errors, packetDigest: packet && packet.packetDigest || null };
  }

  function pilotBuilderSource() {
    return normalizedSource(`'use strict';
const BUILDER_ID = 'closed-json-schema-validator-v1';
const MAX_SCHEMA_BYTES = 16384;
function stable(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  return '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + stable(value[key])).join(',') + '}';
}
function byteLength(value) { return Buffer.byteLength(typeof value === 'string' ? value : stable(value), 'utf8'); }
function exactKeys(value, allowed, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(label + ' must be an object');
  Object.keys(value).forEach((key) => { if (!allowed.includes(key)) throw new Error(label + ' contains unsupported key ' + key); });
}
function inspectSchema(schema, path) {
  exactKeys(schema, ['type','properties','required','additionalProperties','items','enum','pattern','minLength','maxLength','minimum','maximum','minItems','maxItems','description'], path);
  const types = ['object','array','string','number','integer','boolean'];
  if (!types.includes(schema.type)) throw new Error(path + '.type is unsupported');
  if (schema.enum !== undefined && (!Array.isArray(schema.enum) || !schema.enum.length)) throw new Error(path + '.enum must be non-empty');
  if (schema.pattern !== undefined) { if (schema.type !== 'string' || typeof schema.pattern !== 'string') throw new Error(path + '.pattern is invalid'); new RegExp(schema.pattern); }
  if (schema.type === 'object') {
    exactKeys(schema.properties || {}, Object.keys(schema.properties || {}), path + '.properties');
    if (schema.additionalProperties !== false) throw new Error(path + '.additionalProperties must be false');
    const required = schema.required || [];
    if (!Array.isArray(required) || new Set(required).size !== required.length) throw new Error(path + '.required must be a unique array');
    required.forEach((key) => { if (!Object.prototype.hasOwnProperty.call(schema.properties || {}, key)) throw new Error(path + '.required names an unknown property'); });
    Object.keys(schema.properties || {}).sort().forEach((key) => inspectSchema(schema.properties[key], path + '.properties.' + key));
  }
  if (schema.type === 'array') {
    if (!schema.items) throw new Error(path + '.items is required');
    inspectSchema(schema.items, path + '.items');
  }
}
function validatorSource(config) {
  return \'\\'use strict\\';\\nconst CONFIG=Object.freeze(\' + JSON.stringify(config) + \');\\n\' +
    \"function bytes(v){try{return Buffer.byteLength(JSON.stringify(v),'utf8');}catch(e){return Infinity;}}\\n\" +
    \"function typeOk(v,t){if(t==='object')return v!==null&&typeof v==='object'&&!Array.isArray(v);if(t==='array')return Array.isArray(v);if(t==='integer')return Number.isInteger(v);if(t==='number')return typeof v==='number'&&Number.isFinite(v);return typeof v===t;}\\n\" +
    \"function walk(v,s,p,e){if(!typeOk(v,s.type)){e.push({path:p,code:'TYPE_MISMATCH',expected:s.type});return;}if(s.enum&&!s.enum.some(x=>JSON.stringify(x)===JSON.stringify(v)))e.push({path:p,code:'ENUM_MISMATCH'});if(s.type==='string'){if(s.minLength!==undefined&&v.length<s.minLength)e.push({path:p,code:'MIN_LENGTH'});if(s.maxLength!==undefined&&v.length>s.maxLength)e.push({path:p,code:'MAX_LENGTH'});if(s.pattern!==undefined&&!new RegExp(s.pattern).test(v))e.push({path:p,code:'PATTERN_MISMATCH'});}if(s.type==='number'||s.type==='integer'){if(s.minimum!==undefined&&v<s.minimum)e.push({path:p,code:'MINIMUM'});if(s.maximum!==undefined&&v>s.maximum)e.push({path:p,code:'MAXIMUM'});}if(s.type==='array'){if(s.minItems!==undefined&&v.length<s.minItems)e.push({path:p,code:'MIN_ITEMS'});if(s.maxItems!==undefined&&v.length>s.maxItems)e.push({path:p,code:'MAX_ITEMS'});v.forEach((x,i)=>walk(x,s.items,p+'['+i+']',e));}if(s.type==='object'){const props=s.properties||{},req=s.required||[];req.forEach(k=>{if(!Object.prototype.hasOwnProperty.call(v,k))e.push({path:p+'.'+k,code:'REQUIRED'});});Object.keys(v).sort().forEach(k=>{if(!Object.prototype.hasOwnProperty.call(props,k)){if(s.additionalProperties===false)e.push({path:p+'.'+k,code:'ADDITIONAL_PROPERTY'});}else walk(v[k],props[k],p+'.'+k,e);});}}\\n\" +
    \"function validate(input){if(bytes(input)>CONFIG.maxInputBytes)return {schema:CONFIG.resultSchemaId,ok:false,errors:[{path:'$',code:'INPUT_BYTES_EXCEEDED'}]};const errors=[];walk(input,CONFIG.schema,'$',errors);return {schema:CONFIG.resultSchemaId,ok:errors.length===0,errors:errors};}\\nmodule.exports={CONFIG,validate};\\n\";
}
function validatorSelftest(config) {
  return \'\\'use strict\\';\\nconst assert=require(\\'assert\\');const subject=require(\\'./capability.js\\');const good=\' + JSON.stringify(config.exampleValid) + \';const pass=subject.validate(good);assert(pass.ok&&pass.schema===\' + JSON.stringify(config.resultSchemaId) + \');const bad=JSON.parse(JSON.stringify(good));delete bad[\' + JSON.stringify(config.firstRequired) + \'];assert(!subject.validate(bad).ok);const extra=Object.assign({},good,{undeclared:true});assert(!subject.validate(extra).ok);process.stdout.write(\\'closed JSON schema validator candidate selftest PASS\\\\n\\');\\n\';
}
function exampleFor(schema) {
  if (schema.type === 'string') return schema.enum ? schema.enum[0] : 'value';
  if (schema.type === 'integer' || schema.type === 'number') return schema.enum ? schema.enum[0] : (schema.minimum === undefined ? 0 : schema.minimum);
  if (schema.type === 'boolean') return schema.enum ? schema.enum[0] : true;
  if (schema.type === 'array') return [exampleFor(schema.items)];
  const value = {}; Object.keys(schema.properties || {}).sort().forEach((key) => { if ((schema.required || []).includes(key)) value[key] = exampleFor(schema.properties[key]); }); return value;
}
function build(parameters) {
  exactKeys(parameters, ['inputSchemaId','resultSchemaId','schema','maxInputBytes'], 'parameters');
  if (!/^[A-Za-z0-9][A-Za-z0-9._:/+-]{2,179}$/.test(parameters.inputSchemaId || '')) throw new Error('inputSchemaId is invalid');
  if (!/^[A-Za-z0-9][A-Za-z0-9._:/+-]{2,179}$/.test(parameters.resultSchemaId || '')) throw new Error('resultSchemaId is invalid');
  if (!Number.isInteger(parameters.maxInputBytes) || parameters.maxInputBytes < 64 || parameters.maxInputBytes > 65536) throw new Error('maxInputBytes is outside the bounded range');
  if (byteLength(parameters.schema) > MAX_SCHEMA_BYTES) throw new Error('schema exceeds 16 KiB');
  inspectSchema(parameters.schema, '$.schema');
  const firstRequired = (parameters.schema.required || [])[0];
  if (!firstRequired) throw new Error('pilot schema needs one required property for its generated refusal proof');
  const config = { inputSchemaId: parameters.inputSchemaId, resultSchemaId: parameters.resultSchemaId, schema: parameters.schema, maxInputBytes: parameters.maxInputBytes, firstRequired, exampleValid: exampleFor(parameters.schema) };
  return { source: validatorSource(config), selftest: validatorSelftest(config), provides: [parameters.resultSchemaId], consumes: [parameters.inputSchemaId], summary: 'Closed deterministic JSON Schema subset validator.' };
}
module.exports = { id: BUILDER_ID, build, inspectSchema };
`);
  }

  function pilotBuilderSelftestSource() {
    return normalizedSource(`'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const childProcess = require('child_process');
const builder = require('./builder-contribution.js');
const parameters = {
  inputSchemaId: 'axm.example.schema-validation-subject/v1',
  resultSchemaId: 'axm.schema-validation-result/v1',
  maxInputBytes: 4096,
  schema: { type: 'object', additionalProperties: false, required: ['name','attempts','enabled'], properties: { name: { type: 'string', minLength: 1, maxLength: 80 }, attempts: { type: 'integer', minimum: 0, maximum: 10 }, enabled: { type: 'boolean' } } }
};
const first = builder.build(parameters);
const second = builder.build(parameters);
assert.strictEqual(builder.id, 'closed-json-schema-validator-v1');
assert.deepStrictEqual(first, second);
assert.deepStrictEqual(first.provides, [parameters.resultSchemaId]);
assert.deepStrictEqual(first.consumes, [parameters.inputSchemaId]);
new Function(first.source);
new Function(first.selftest);
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-schema-validator-builder-test-'));
try {
  fs.writeFileSync(path.join(root, 'capability.js'), first.source, { flag: 'wx' });
  fs.writeFileSync(path.join(root, 'selftest.js'), first.selftest, { flag: 'wx' });
  const run = childProcess.spawnSync(process.execPath, [path.join(root, 'selftest.js')], { encoding: 'utf8', timeout: 5000 });
  assert.strictEqual(run.status, 0, run.stderr);
  assert.match(run.stdout, /PASS/);
} finally {
  const resolved = path.resolve(root);
  if (path.dirname(resolved) !== path.resolve(os.tmpdir()) || !path.basename(resolved).startsWith('axm-schema-validator-builder-test-')) throw new Error('temporary cleanup boundary refused');
  fs.rmSync(resolved, { recursive: true, force: true });
}
process.stdout.write('closed JSON schema validator builder contribution selftest PASS\\n');
`);
  }

  function example() {
    var specification = {
      schema: 'axm.missing-hand-specification/v1',
      capability: 'capability.specify.missing-hand/v1',
      capabilityId: 'data.validate.closed-json-schema/v1',
      gapType: 'HAND',
      status: 'DRAFT',
      purpose: 'Build a bounded deterministic validator for an explicitly supplied closed JSON Schema subset without network access or repeated model compute.',
      inputsAndSchemas: ['one JSON-compatible value', 'one source-reviewed closed JSON Schema subset compiled into the candidate'],
      outputsAndSchemas: ['axm.schema-validation-result/v1 with ordered typed validation errors'],
      sideEffects: ['none; validation is a pure in-memory operation'],
      permissionsAndConsent: ['no permissions; callers explicitly supply the value being validated'],
      resourceBudget: 'Schema source is at most 16 KiB, one input is at most 64 KiB, recursion is bounded by the reviewed schema, and no network or child process is used by the candidate.',
      failureAndRecovery: 'Malformed, oversized, cyclic, wrong-type, or undeclared-property input returns a typed failure result without mutation or retry.',
      compatibilityVersionContract: 'The candidate accepts only the source-reviewed schema subset and emits axm.schema-validation-result/v1; unsupported schema keywords are refused during builder review tests.',
      verificationContract: 'Prove valid input, required-field refusal, type refusal, additional-property refusal, range refusal, size refusal, deterministic rebuild parity, and zero side effects.',
      promotionGate: 'Mike reviews the builder source, generated source, independent test evidence, catalog diff, and authority boundary before any recipe activation or merge.',
      provenance: { sourceSchema: 'axm.capability-gap-report/v1', sourceRequirementIds: ['capability-recipe-foundry-pilot'], foundry: 'hand-specification-foundry/v0.1', generatedAt: '2026-08-23T10:00:00.000Z' },
      truth: { implementationNeutral: true, installed: false, executed: false, authorityGranted: false, promoted: false, canon: false, prototypeOrMockClosesGap: false }
    };
    var verificationPlan = Verification.buildPlan(specification, '2026-08-23T10:01:00.000Z');
    var schema = { type: 'object', additionalProperties: false, required: ['name', 'attempts', 'enabled'], properties: { name: { type: 'string', minLength: 1, maxLength: 80 }, attempts: { type: 'integer', minimum: 0, maximum: 10 }, enabled: { type: 'boolean' } } };
    return sealIntent({
      id: 'closed-json-schema-validator-recipe-pilot',
      sourceKind: 'CODEX',
      specification: specification,
      verificationPlan: verificationPlan,
      recipe: {
        id: 'closed-json-schema-validator',
        version: '0.1.0',
        title: 'Closed JSON Schema Validator',
        summary: 'Compiles one source-reviewed closed JSON Schema subset into a bounded deterministic validation capability.',
        family: 'schema-validation',
        builderId: 'closed-json-schema-validator-v1',
        candidatePolicy: { defaultCount: 1, defaultVariantId: 'bounded-default', variants: [{ id: 'bounded-default', title: 'Bounded default validator', parameterOverrides: {} }] },
        parameterSpec: {
          inputSchemaId: { type: 'string', required: true, pattern: '^[A-Za-z0-9][A-Za-z0-9._:/+-]{2,179}$', maxLength: 180, description: 'Exact schema contract consumed by the generated validator.' },
          resultSchemaId: { type: 'string', required: true, pattern: '^[A-Za-z0-9][A-Za-z0-9._:/+-]{2,179}$', maxLength: 180, description: 'Exact validation result contract emitted by the generated validator.' },
          schema: { type: 'object', required: true, maxBytes: 16384, description: 'Source-reviewed closed JSON Schema subset embedded into the generated validator.' },
          maxInputBytes: { type: 'integer', required: true, minimum: 64, maximum: 65536, description: 'Maximum JSON input bytes accepted before typed refusal.' }
        },
        exampleRequest: { id: 'closed-json-schema-validator-example', family: 'schema-validation', purpose: 'Build the first bounded validator capability pilot.', recipeId: 'closed-json-schema-validator', variantId: null, parameters: { inputSchemaId: 'axm.example.schema-validation-subject/v1', resultSchemaId: 'axm.schema-validation-result/v1', schema: schema, maxInputBytes: 4096 }, source: { kind: 'HUMAN', ref: 'capability-recipe-foundry-pilot' } },
        boundaries: ['pure deterministic generation only', 'closed reviewed schema subset only', 'generated code is emitted but never executed by Capability Fabric or Recipe Foundry', 'no network, install, registration, promotion, permission, Foundation, or CANON authority'],
        verifiers: ['Capability Fabric inactive proposal inspection', 'independent builder contribution source review', 'trusted-host builder contribution selftest', 'deterministic rebuild parity', 'adversarial generated-validator fixtures']
      },
      contribution: { builderId: 'closed-json-schema-validator-v1', builderSource: pilotBuilderSource(), builderSelftestSource: pilotBuilderSelftestSource() }
    });
  }

  return {
    VERSION: VERSION,
    INTENT_SCHEMA: INTENT_SCHEMA,
    PLAN_SCHEMA: PLAN_SCHEMA,
    PACKET_SCHEMA: PACKET_SCHEMA,
    RECEIPT_SCHEMA: RECEIPT_SCHEMA,
    CHECKLIST_SCHEMA: CHECKLIST_SCHEMA,
    SOURCE_KINDS: SOURCE_KINDS,
    MAX_SOURCE_BYTES: MAX_SOURCE_BYTES,
    MAX_PACKET_FILES: MAX_PACKET_FILES,
    MAX_PACKET_BYTES: MAX_PACKET_BYTES,
    AUTHORITY: AUTHORITY,
    FILES: FILES,
    sealIntent: sealIntent,
    validateIntent: validateIntent,
    recipeFromIntent: recipeFromIntent,
    proposalFromIntent: proposalFromIntent,
    plan: plan,
    forge: forge,
    verify: verify,
    example: example,
    clone: clone,
    digest: Fabric.digest,
    canonicalJson: Fabric.canonicalJson
  };
});
