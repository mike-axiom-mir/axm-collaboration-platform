(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AXMErrolCoreReturnLab = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var CLAIM_TYPES = ['observation', 'inference', 'hypothesis', 'decision', 'expression'];
  var CLAIM_LABELS = {
    observation: 'Observed evidence',
    inference: 'Model-derived inference',
    hypothesis: 'Testable hypothesis',
    decision: 'Authorized decision',
    expression: 'Current expression projection'
  };
  var VISIBILITY = { public: 0, internal: 1, restricted: 2, private: 3 };
  var DEFAULT_TRIAD_POLICY = Object.freeze({
    version: 'axm-triad-policy/0.1.0-local-adapter',
    minimum_relation_score: 2 / 3,
    minimum_role_distinctness_score: 1,
    minimum_synergy_gain: 0.05,
    minimum_compression_gain: 0.05,
    minimum_stability_score: 0.7,
    minimum_sample_count: 3,
    minimum_pair_sample_count: 3,
    minimum_confidence: 0.6,
    minimum_evidence_coverage: 0.8,
    maximum_replicate_mean_delta: 0.1,
    require_pair_evidence: true,
    require_replicates: true,
    require_counterevidence_search: true,
    require_alternative_explanation: true,
    require_falsification_test: true,
    require_provenance: true
  });

  function isPlainObject(value) {
    if (!value || Object.prototype.toString.call(value) !== '[object Object]') return false;
    var proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
  }

  function canonicalValue(value) {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) throw new Error('canonical JSON rejects non-finite numbers');
      return value;
    }
    if (Array.isArray(value)) return value.map(canonicalValue);
    if (!isPlainObject(value)) throw new Error('canonical JSON accepts plain JSON values only');
    var out = {};
    Object.keys(value).sort().forEach(function (key) {
      if (typeof value[key] === 'undefined') throw new Error('canonical JSON rejects undefined values');
      out[key] = canonicalValue(value[key]);
    });
    return out;
  }

  function canonicalJson(value) { return JSON.stringify(canonicalValue(value)); }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }

  async function sha256Text(text) {
    if (typeof require === 'function') {
      try {
        return require('crypto').createHash('sha256').update(String(text), 'utf8').digest('hex');
      } catch (_) {}
    }
    var cryptoApi = typeof globalThis !== 'undefined' ? globalThis.crypto : null;
    if (!cryptoApi || !cryptoApi.subtle || typeof TextEncoder === 'undefined') {
      throw new Error('SHA-256 is unavailable in this runtime');
    }
    var digest = await cryptoApi.subtle.digest('SHA-256', new TextEncoder().encode(String(text)));
    return Array.from(new Uint8Array(digest)).map(function (value) {
      return value.toString(16).padStart(2, '0');
    }).join('');
  }

  async function stableDigest(value) { return sha256Text(canonicalJson(value)); }
  async function stableId(prefix, value) { return prefix + ':' + (await stableDigest(value)).slice(0, 24); }

  function requiredText(name, value) {
    var result = String(value == null ? '' : value).trim();
    if (!result) throw new Error(name + ' is required');
    return result;
  }

  function score(name, value) {
    var result = Number(value);
    if (!Number.isFinite(result) || result < 0 || result > 1) throw new Error(name + ' must be between 0 and 1');
    return result;
  }

  function positiveNumber(name, value, allowZero) {
    var result = Number(value);
    if (!Number.isFinite(result) || (allowZero ? result < 0 : result <= 0)) {
      throw new Error(name + (allowZero ? ' must be zero or greater' : ' must be greater than zero'));
    }
    return result;
  }

  function positiveInteger(name, value) {
    if (typeof value === 'boolean') throw new Error(name + ' must be a positive integer');
    var result = Number(value);
    if (!Number.isSafeInteger(result) || result < 1) throw new Error(name + ' must be a positive integer');
    return result;
  }

  function stringSet(name, values, options) {
    options = options || {};
    if (values == null) values = [];
    if (!Array.isArray(values)) throw new Error(name + ' must be an array');
    var seen = new Set();
    var result = [];
    values.forEach(function (value) {
      var item = requiredText(name + ' item', value);
      if (!seen.has(item)) { seen.add(item); result.push(item); }
    });
    if (options.sort) result.sort();
    return result;
  }

  function timestamp(name, value, fallback) {
    var raw = value || fallback;
    var date = new Date(raw);
    if (!raw || !Number.isFinite(date.getTime())) throw new Error(name + ' must be a valid timestamp');
    return date.toISOString();
  }

  function visibility(value) {
    var result = requiredText('visibility', value || 'internal').toLowerCase();
    if (!Object.prototype.hasOwnProperty.call(VISIBILITY, result)) throw new Error('visibility is invalid');
    return result;
  }

  async function createObservation(input) {
    input = input || {};
    var payload = Object.prototype.hasOwnProperty.call(input, 'payload') ? input.payload : null;
    var core = {
      schema: 'axm.epistemic-observation/v1',
      source_ref: requiredText('source_ref', input.source_ref),
      source_type: requiredText('source_type', input.source_type || 'bounded_external_source'),
      capture_method: requiredText('capture_method', input.capture_method || 'declared-local-input'),
      captured_at: timestamp('captured_at', input.captured_at, new Date().toISOString()),
      summary: requiredText('summary', input.summary),
      payload_digest: await stableDigest(payload),
      evidence_refs: stringSet('evidence_refs', input.evidence_refs, { sort: true }),
      uncertainty: score('uncertainty', input.uncertainty == null ? 0.5 : input.uncertainty),
      consent_scope: requiredText('consent_scope', input.consent_scope || 'private-local-evaluation'),
      privacy_tags: stringSet('privacy_tags', input.privacy_tags, { sort: true }),
      visibility: visibility(input.visibility),
      raw_payload_stored: false
    };
    var recordDigest = await stableDigest(core);
    return Object.assign({
      observation_id: await stableId('obs', recordDigest),
      record_digest: recordDigest
    }, core, {
      raw_payload: null,
      epistemic_notice: 'Content-bound observation commitment; registration does not prove truth or completeness.',
      automatic_learning: false,
      automatic_canon: false
    });
  }

  function claimIdentity(claim) {
    return {
      schema: claim.schema,
      claim_type: claim.claim_type,
      statement: claim.statement,
      source_refs: claim.source_refs,
      derived_from_claim_ids: claim.derived_from_claim_ids,
      model_ref: claim.model_ref,
      model_version: claim.model_version,
      confidence: claim.confidence,
      counterevidence_refs: claim.counterevidence_refs,
      counterevidence_search_performed: claim.counterevidence_search_performed,
      creator_ref: claim.creator_ref,
      authority_ref: claim.authority_ref,
      visibility: claim.visibility,
      created_at: claim.created_at,
      epistemic_label: claim.epistemic_label
    };
  }

  async function createClaim(input) {
    input = input || {};
    var kind = requiredText('claim_type', input.claim_type).toLowerCase();
    if (CLAIM_TYPES.indexOf(kind) < 0) throw new Error('claim_type is unknown');
    var version = input.model_version == null ? null : Number(input.model_version);
    if (version !== null && (!Number.isSafeInteger(version) || version < 0)) throw new Error('model_version must be a non-negative integer or null');
    var claim = {
      schema: 'axm.epistemic-claim/v1',
      claim_type: kind,
      statement: requiredText('statement', input.statement),
      source_refs: stringSet('source_refs', input.source_refs, { sort: true }),
      derived_from_claim_ids: stringSet('derived_from_claim_ids', input.derived_from_claim_ids, { sort: true }),
      model_ref: input.model_ref == null ? null : requiredText('model_ref', input.model_ref),
      model_version: version,
      confidence: score('confidence', input.confidence == null ? 0.5 : input.confidence),
      counterevidence_refs: stringSet('counterevidence_refs', input.counterevidence_refs, { sort: true }),
      counterevidence_search_performed: input.counterevidence_search_performed === true,
      creator_ref: requiredText('creator_ref', input.creator_ref),
      authority_ref: input.authority_ref == null ? null : requiredText('authority_ref', input.authority_ref),
      visibility: visibility(input.visibility),
      created_at: timestamp('created_at', input.created_at, new Date().toISOString()),
      epistemic_label: CLAIM_LABELS[kind]
    };
    claim.claim_id = await stableId('claim', claimIdentity(claim));
    claim.uncertainty = 1 - claim.confidence;
    claim.epistemic_notice = 'Typed claim with explicit lineage; it cannot promote itself into fact, canon, execution, or permanent memory.';
    return claim;
  }

  function reaches(startId, targetId, claimsById, active) {
    if (startId === targetId) return true;
    if (active.has(startId)) return false;
    active.add(startId);
    var current = claimsById.get(startId);
    if (!current) return false;
    return (current.derived_from_claim_ids || []).some(function (parentId) {
      return reaches(parentId, targetId, claimsById, active);
    });
  }

  async function assessClaim(claim, context) {
    context = context || {};
    var violations = [];
    var warnings = [];
    var kind = CLAIM_TYPES.indexOf(claim && claim.claim_type) >= 0 ? claim.claim_type : null;
    var known = Array.isArray(context.known_claims) ? context.known_claims.slice() : [];
    var claimsById = new Map(known.map(function (item) { return [item.claim_id, item]; }));
    if (claim && claim.claim_id) claimsById.set(claim.claim_id, claim);
    var retracted = new Set(context.retracted_claim_ids || []);
    var parents = claim && Array.isArray(claim.derived_from_claim_ids) ? claim.derived_from_claim_ids : [];

    if (!claim || claim.schema !== 'axm.epistemic-claim/v1') violations.push('unsupported_schema');
    if (!kind) violations.push('unknown_claim_type');
    if (kind && claim.epistemic_label !== CLAIM_LABELS[kind]) violations.push('label_mismatch');
    if (claim && claim.claim_id !== await stableId('claim', claimIdentity(claim))) violations.push('claim_id_content_mismatch');

    var missing = parents.filter(function (id) { return !claimsById.has(id); });
    if (missing.length) violations.push('unknown_parents:' + missing.join(','));
    var retractedParents = parents.filter(function (id) { return retracted.has(id); });
    if (retractedParents.length) violations.push('retracted_parents:' + retractedParents.join(','));
    if (claim && parents.some(function (id) { return reaches(id, claim.claim_id, claimsById, new Set()); })) violations.push('lineage_cycle');

    var parentVisibility = parents.filter(function (id) { return claimsById.has(id); }).map(function (id) {
      return VISIBILITY[claimsById.get(id).visibility];
    }).filter(Number.isFinite);
    if (claim && parentVisibility.length && VISIBILITY[claim.visibility] < Math.max.apply(null, parentVisibility)) {
      violations.push('visibility_escalation_from_parent');
    }

    if (kind === 'observation') {
      if (!claim.source_refs.length) violations.push('observation_source_missing');
      if (parents.length) violations.push('observation_has_derivation');
    } else if (kind === 'inference') {
      if (!parents.length) violations.push('inference_derivation_missing');
      if (!claim.model_ref || claim.model_version == null) violations.push('inference_model_lineage_missing');
    } else if (kind === 'hypothesis') {
      if (!parents.length) violations.push('hypothesis_derivation_missing');
      if (!claim.model_ref || claim.model_version == null) violations.push('hypothesis_model_lineage_missing');
      if (!claim.counterevidence_search_performed) violations.push('hypothesis_counterevidence_search_missing');
    } else if (kind === 'decision') {
      if (!claim.authority_ref) violations.push('decision_authority_missing');
      if (!claim.source_refs.length && !parents.length) violations.push('decision_basis_missing');
    } else if (kind === 'expression') {
      if (!claim.model_ref || claim.model_version == null || !parents.length) violations.push('expression_lineage_missing');
    }
    if (claim && claim.confidence === 1 && kind !== 'observation') warnings.push('derived_total_confidence');
    if (claim && ['private', 'restricted'].indexOf(claim.visibility) >= 0 && claim.source_refs.length) warnings.push('redact_sources_before_export');

    var assessedAt = timestamp('assessed_at', context.assessed_at, new Date().toISOString());
    var assessmentCore = {
      schema: 'axm.epistemic-claim-assessment/v1',
      claim_id: claim && claim.claim_id || null,
      policy_version: 'axm-epistemic-claim-policy/0.1.0-local-adapter',
      valid: violations.length === 0,
      violations: violations,
      warnings: warnings,
      assessed_at: assessedAt,
      automatic_promotion: false,
      automatic_canon: false
    };
    assessmentCore.assessment_id = await stableId('claim_assessment', assessmentCore);
    return assessmentCore;
  }

  async function createAttentionFrame(input) {
    input = input || {};
    var createdAt = timestamp('created_at', input.created_at, new Date().toISOString());
    var expiresAt = input.expires_at == null || input.expires_at === '' ? null : timestamp('expires_at', input.expires_at);
    if (expiresAt && Date.parse(expiresAt) <= Date.parse(createdAt)) throw new Error('expires_at must be later than created_at');
    var missingPolicy = requiredText('missing_key_policy', input.missing_key_policy || 'report').toLowerCase();
    if (['report', 'error'].indexOf(missingPolicy) < 0) throw new Error('missing_key_policy must be report or error');
    var frame = {
      schema: 'axm.attention-frame/v1',
      label: requiredText('label', input.label),
      focus_keys: stringSet('focus_keys', input.focus_keys),
      rationale: requiredText('rationale', input.rationale),
      parent_frame_id: input.parent_frame_id == null ? null : requiredText('parent_frame_id', input.parent_frame_id),
      created_at: createdAt,
      expires_at: expiresAt,
      missing_key_policy: missingPolicy,
      reversible: true,
      mutates_model: false
    };
    frame.frame_id = await stableId('attn', frame);
    return frame;
  }

  function attentionIdentity(frame) {
    var identity = Object.assign({}, frame);
    delete identity.frame_id;
    return identity;
  }

  async function projectModel(input) {
    input = input || {};
    var model = input.model || {};
    var state = model.state;
    if (!isPlainObject(state)) throw new Error('model.state must be a plain object');
    var projectionAt = timestamp('created_at', input.created_at, new Date().toISOString());
    var modelCreatedAt = timestamp('model.created_at', model.created_at, projectionAt);
    if (Date.parse(projectionAt) < Date.parse(modelCreatedAt)) throw new Error('projection cannot predate model snapshot');
    var frame = input.attention_frame || null;
    if (frame && frame.expires_at && Date.parse(frame.expires_at) <= Date.parse(projectionAt)) throw new Error('attention frame expired');
    if (frame && (frame.reversible !== true || frame.mutates_model !== false)) throw new Error('attention frame violates reversibility invariants');
    if (frame && frame.frame_id !== await stableId('attn', attentionIdentity(frame))) throw new Error('attention frame content does not match frame_id');
    var requested = frame ? stringSet('focus_keys', frame.focus_keys) : [];
    var missing = requested.filter(function (key) { return !Object.prototype.hasOwnProperty.call(state, key); });
    if (missing.length && frame && frame.missing_key_policy === 'error') throw new Error('missing focus keys: ' + missing.join(', '));
    var content = {};
    (requested.length ? requested.filter(function (key) { return Object.prototype.hasOwnProperty.call(state, key); }) : Object.keys(state)).forEach(function (key) {
      content[key] = clone(state[key]);
    });
    var stateDigest = await stableDigest(state);
    var snapshotCore = {
      model_id: requiredText('model.model_id', model.model_id),
      model_version: Number(model.version),
      model_state_digest: stateDigest,
      source_evidence_refs: stringSet('model.evidence_refs', model.evidence_refs, { sort: true }),
      created_at: modelCreatedAt
    };
    if (!Number.isSafeInteger(snapshotCore.model_version) || snapshotCore.model_version < 0) throw new Error('model.version must be a non-negative integer');
    var core = {
      schema: 'axm.expression-projection/v1',
      model_id: snapshotCore.model_id,
      model_version: snapshotCore.model_version,
      model_state_digest: stateDigest,
      model_snapshot_digest: await stableDigest(snapshotCore),
      attention_frame_id: frame ? requiredText('attention_frame.frame_id', frame.frame_id) : null,
      requested_focus_keys: requested,
      missing_focus_keys: missing,
      focus_complete: missing.length === 0,
      content: content,
      source_evidence_refs: snapshotCore.source_evidence_refs,
      created_at: projectionAt
    };
    var projectionDigest = await stableDigest(core);
    return Object.assign({
      projection_id: await stableId('projection', projectionDigest),
      projection_digest: projectionDigest
    }, core, {
      epistemic_notice: 'Current projection from a model; not landscape, target, or total identity.',
      model_mutated: false,
      automatic_learning: false,
      automatic_canon: false
    });
  }

  function pairKey(left, right) { return JSON.stringify([String(left), String(right)].sort()); }

  function connected(ids, edges) {
    if (ids.size !== 3) return false;
    var adjacency = {};
    Array.from(ids).forEach(function (id) { adjacency[id] = []; });
    edges.forEach(function (key) {
      var parts = JSON.parse(key);
      if (adjacency[parts[0]] && adjacency[parts[1]]) {
        adjacency[parts[0]].push(parts[1]);
        adjacency[parts[1]].push(parts[0]);
      }
    });
    var start = Array.from(ids).sort()[0];
    var stack = [start];
    var seen = new Set();
    while (stack.length) {
      var current = stack.pop();
      if (seen.has(current)) continue;
      seen.add(current);
      adjacency[current].forEach(function (next) { if (!seen.has(next)) stack.push(next); });
    }
    return seen.size === ids.size;
  }

  function roleDistinctness(entities) {
    var roles = entities.map(function (entity) { return new Set(entity.roles); });
    var uniqueContributors = 0;
    roles.forEach(function (roleSet, index) {
      var otherRoles = new Set();
      roles.forEach(function (candidate, otherIndex) {
        if (index !== otherIndex) candidate.forEach(function (role) { otherRoles.add(role); });
      });
      if (roleSet.size && Array.from(roleSet).some(function (role) { return !otherRoles.has(role); })) uniqueContributors += 1;
    });
    return uniqueContributors / 3;
  }

  function placeholder(value) {
    var text = String(value || '').toLowerCase();
    return !text || text.indexOf('unspecified') >= 0 || ['unknown', 'none', 'n/a'].indexOf(text) >= 0;
  }

  function normalizedPolicy(input) {
    var policy = Object.assign({}, DEFAULT_TRIAD_POLICY, input || {});
    ['minimum_relation_score', 'minimum_role_distinctness_score', 'minimum_stability_score', 'minimum_confidence', 'minimum_evidence_coverage', 'maximum_replicate_mean_delta'].forEach(function (name) {
      policy[name] = score(name, policy[name]);
    });
    ['minimum_synergy_gain', 'minimum_compression_gain'].forEach(function (name) {
      policy[name] = Number(policy[name]);
      if (!Number.isFinite(policy[name]) || policy[name] < -1 || policy[name] > 1) throw new Error(name + ' must be between -1 and 1');
    });
    policy.minimum_sample_count = positiveInteger('minimum_sample_count', policy.minimum_sample_count);
    policy.minimum_pair_sample_count = positiveInteger('minimum_pair_sample_count', policy.minimum_pair_sample_count);
    policy.version = requiredText('policy.version', policy.version);
    return policy;
  }

  async function evaluateTriad(input) {
    input = input || {};
    if (!Array.isArray(input.entities) || input.entities.length !== 3) throw new Error('exactly three entities are required');
    var entities = input.entities.map(function (entity) {
      return {
        entity_id: requiredText('entity_id', entity.entity_id),
        label: requiredText('entity label', entity.label),
        roles: stringSet('roles', entity.roles, { sort: true })
      };
    });
    var relationships = (input.relationships || []).map(function (relationship) {
      var left = requiredText('relationship.left_id', relationship.left_id);
      var right = requiredText('relationship.right_id', relationship.right_id);
      if (left === right) throw new Error('self relationships are invalid');
      return {
        left_id: left,
        right_id: right,
        relation_type: requiredText('relationship.relation_type', relationship.relation_type),
        evidence_refs: stringSet('relationship.evidence_refs', relationship.evidence_refs, { sort: true })
      };
    });
    var raw = input.measurement || {};
    var measurement = {
      proposed_center_label: requiredText('measurement.proposed_center_label', raw.proposed_center_label),
      role_pattern: requiredText('measurement.role_pattern', raw.role_pattern),
      joint_score: score('measurement.joint_score', raw.joint_score),
      pair_scores: (raw.pair_scores || []).map(function (pair) {
        var left = requiredText('pair.left_id', pair.left_id);
        var right = requiredText('pair.right_id', pair.right_id);
        if (left === right) throw new Error('pair scores require two entities');
        return {
          left_id: left,
          right_id: right,
          score: score('pair.score', pair.score),
          evidence_refs: stringSet('pair.evidence_refs', pair.evidence_refs, { sort: true }),
          sample_count: positiveInteger('pair.sample_count', pair.sample_count)
        };
      }),
      separate_description_cost: positiveNumber('measurement.separate_description_cost', raw.separate_description_cost, false),
      unified_description_cost: positiveNumber('measurement.unified_description_cost', raw.unified_description_cost, true),
      stability_score: score('measurement.stability_score', raw.stability_score),
      sample_count: positiveInteger('measurement.sample_count', raw.sample_count),
      measurement_confidence: score('measurement.measurement_confidence', raw.measurement_confidence),
      evidence_refs: stringSet('measurement.evidence_refs', raw.evidence_refs, { sort: true }),
      counterevidence_refs: stringSet('measurement.counterevidence_refs', raw.counterevidence_refs, { sort: true }),
      counterevidence_search_performed: raw.counterevidence_search_performed === true,
      counterevidence_search_summary: String(raw.counterevidence_search_summary || '').trim(),
      alternative_explanations: stringSet('measurement.alternative_explanations', raw.alternative_explanations, { sort: true }),
      falsification_tests: stringSet('measurement.falsification_tests', raw.falsification_tests, { sort: true }),
      measurement_method: requiredText('measurement.measurement_method', raw.measurement_method),
      task_ref: requiredText('measurement.task_ref', raw.task_ref),
      benchmark_ref: requiredText('measurement.benchmark_ref', raw.benchmark_ref),
      metric_name: requiredText('measurement.metric_name', raw.metric_name),
      scorer_version: requiredText('measurement.scorer_version', raw.scorer_version),
      replicate_scores: (raw.replicate_scores || []).map(function (value) { return score('replicate score', value); })
    };
    if (measurement.counterevidence_search_performed && !measurement.counterevidence_search_summary) {
      throw new Error('counterevidence_search_summary is required when a search was performed');
    }

    var policy = normalizedPolicy(input.policy);
    var reasons = [];
    var support = [];
    var ids = entities.map(function (entity) { return entity.entity_id; });
    var idSet = new Set(ids);
    var members = ids.slice().sort();
    if (idSet.size !== 3) reasons.push('distinctness_failed');
    var roleScore = roleDistinctness(entities);
    if (roleScore < policy.minimum_role_distinctness_score) reasons.push('role_distinctness_below_threshold');
    else support.push('three exclusive role contributions');

    var evidencedEdges = new Set();
    var seenEdges = new Set();
    var duplicateEdges = new Set();
    relationships.forEach(function (relationship) {
      var key = pairKey(relationship.left_id, relationship.right_id);
      if (!idSet.has(relationship.left_id) || !idSet.has(relationship.right_id)) {
        reasons.push('relationship_outside_triad:' + key);
        return;
      }
      if (seenEdges.has(key)) duplicateEdges.add(key);
      seenEdges.add(key);
      if (relationship.evidence_refs.length) evidencedEdges.add(key);
    });
    if (duplicateEdges.size) reasons.push('duplicate_relationships:' + Array.from(duplicateEdges).sort().join(','));
    var relationScore = evidencedEdges.size / 3;
    if (!connected(idSet, evidencedEdges)) reasons.push('relationship_failed');
    if (relationScore < policy.minimum_relation_score) reasons.push('relation_score_below_threshold');

    var expectedPairs = new Set();
    if (ids.length === 3) {
      expectedPairs.add(pairKey(ids[0], ids[1]));
      expectedPairs.add(pairKey(ids[0], ids[2]));
      expectedPairs.add(pairKey(ids[1], ids[2]));
    }
    var pairMap = new Map();
    var duplicatePairs = new Set();
    measurement.pair_scores.forEach(function (pair) {
      var key = pairKey(pair.left_id, pair.right_id);
      if (!idSet.has(pair.left_id) || !idSet.has(pair.right_id)) {
        reasons.push('pair_outside_triad:' + key);
        return;
      }
      if (pairMap.has(key)) duplicatePairs.add(key);
      pairMap.set(key, pair);
    });
    if (duplicatePairs.size) reasons.push('duplicate_pair_measurements:' + Array.from(duplicatePairs).sort().join(','));
    var missingPairs = Array.from(expectedPairs).filter(function (key) { return !pairMap.has(key); });
    if (missingPairs.length) reasons.push('pair_measurements_missing:' + missingPairs.join(','));
    var pairEvidenceCount = Array.from(expectedPairs).filter(function (key) { return pairMap.has(key) && pairMap.get(key).evidence_refs.length; }).length;
    var pairSampleCount = Array.from(expectedPairs).filter(function (key) { return pairMap.has(key) && pairMap.get(key).sample_count >= policy.minimum_pair_sample_count; }).length;
    if (policy.require_pair_evidence && pairEvidenceCount < 3) reasons.push('pair_evidence_incomplete:' + pairEvidenceCount + '/3');
    if (pairSampleCount < 3) reasons.push('pair_samples_incomplete:' + pairSampleCount + '/3');

    var validPairScores = Array.from(pairMap.values()).map(function (pair) { return pair.score; });
    var bestPairScore = validPairScores.length ? Math.max.apply(null, validPairScores) : 0;
    var synergyGain = measurement.joint_score - bestPairScore;
    if (synergyGain < policy.minimum_synergy_gain) reasons.push('synergy_below_threshold');
    var compressionGain = (measurement.separate_description_cost - measurement.unified_description_cost) / measurement.separate_description_cost;
    if (compressionGain < policy.minimum_compression_gain) reasons.push('compression_below_threshold');

    var replicateMean = null;
    var replicateSpread = null;
    var empiricalStability = 0;
    if (measurement.replicate_scores.length) {
      replicateMean = measurement.replicate_scores.reduce(function (sum, value) { return sum + value; }, 0) / measurement.replicate_scores.length;
      replicateSpread = Math.max.apply(null, measurement.replicate_scores) - Math.min.apply(null, measurement.replicate_scores);
      empiricalStability = Math.max(0, 1 - replicateSpread);
      if (measurement.replicate_scores.length !== measurement.sample_count) reasons.push('replicate_count_mismatch');
      if (Math.abs(replicateMean - measurement.joint_score) > policy.maximum_replicate_mean_delta) reasons.push('replicate_mean_mismatch');
      if (measurement.stability_score > empiricalStability + 0.1) reasons.push('declared_stability_not_supported');
    } else if (policy.require_replicates) reasons.push('replicate_scores_missing');
    var stability = measurement.replicate_scores.length ? Math.min(measurement.stability_score, empiricalStability) : (policy.require_replicates ? 0 : measurement.stability_score);
    if (stability < policy.minimum_stability_score) reasons.push('stability_below_threshold');
    if (measurement.sample_count < policy.minimum_sample_count) reasons.push('sample_count_below_threshold');
    if (!measurement.evidence_refs.length) reasons.push('joint_evidence_missing');
    if (policy.require_counterevidence_search && !measurement.counterevidence_search_performed) reasons.push('counterevidence_search_missing');
    if (policy.require_alternative_explanation && !measurement.alternative_explanations.length) reasons.push('alternative_explanation_missing');
    if (policy.require_falsification_test && !measurement.falsification_tests.length) reasons.push('falsification_test_missing');
    var provenance = [measurement.measurement_method, measurement.task_ref, measurement.benchmark_ref, measurement.metric_name, measurement.scorer_version];
    var provenanceComplete = !provenance.some(placeholder);
    if (policy.require_provenance && !provenanceComplete) reasons.push('measurement_provenance_incomplete');

    var coverage = (
      Math.min(1, relationScore) + pairEvidenceCount / 3 + pairSampleCount / 3 +
      (measurement.evidence_refs.length ? 1 : 0) + (measurement.counterevidence_search_performed ? 1 : 0) +
      roleScore + (measurement.alternative_explanations.length ? 1 : 0) +
      (measurement.falsification_tests.length ? 1 : 0) +
      (measurement.replicate_scores.length === measurement.sample_count ? 1 : 0) +
      (provenanceComplete ? 1 : 0)
    ) / 10;
    if (coverage < policy.minimum_evidence_coverage) reasons.push('evidence_coverage_below_threshold');
    var confidence = Math.min(measurement.measurement_confidence, stability, coverage);
    if (confidence < policy.minimum_confidence) reasons.push('confidence_below_threshold');

    reasons = Array.from(new Set(reasons));
    var policyDigest = await stableDigest(policy);
    var measurementDigest = await stableDigest(measurement);
    var structureId = await stableId('triad_structure', { members: members, namespace: 'axm-triad-structure/v1' });
    var candidateId = await stableId('triad_candidate', {
      structure_id: structureId,
      task_ref: measurement.task_ref,
      benchmark_ref: measurement.benchmark_ref,
      metric_name: measurement.metric_name
    });
    var evaluationId = await stableId('triad_eval', {
      candidate_id: candidateId,
      measurement_digest: measurementDigest,
      policy_digest: policyDigest,
      detector_version: 'errol-core-return-lab/0.1.0'
    });
    var passed = reasons.length === 0;
    return {
      schema: 'axm.emergence-hypothesis/v1',
      candidate_id: candidateId,
      structure_id: structureId,
      evaluation_id: evaluationId,
      members: members,
      proposed_center_label: measurement.proposed_center_label,
      role_pattern: measurement.role_pattern,
      role_distinctness_score: roleScore,
      relation_score: relationScore,
      best_pair_score: bestPairScore,
      joint_score: measurement.joint_score,
      synergy_gain: synergyGain,
      compression_gain: compressionGain,
      declared_stability_score: measurement.stability_score,
      empirical_stability_score: empiricalStability,
      stability_score: stability,
      replicate_mean: replicateMean,
      replicate_spread: replicateSpread,
      sample_count: measurement.sample_count,
      measurement_confidence: measurement.measurement_confidence,
      evidence_coverage_score: coverage,
      confidence: confidence,
      evidence_refs: measurement.evidence_refs,
      counterevidence_refs: measurement.counterevidence_refs,
      counterevidence_search_performed: measurement.counterevidence_search_performed,
      counterevidence_search_summary: measurement.counterevidence_search_summary,
      alternative_explanations: measurement.alternative_explanations,
      falsification_tests: measurement.falsification_tests,
      measurement_method: measurement.measurement_method,
      task_ref: measurement.task_ref,
      benchmark_ref: measurement.benchmark_ref,
      metric_name: measurement.metric_name,
      detector_version: 'errol-core-return-lab/0.1.0',
      scorer_version: measurement.scorer_version,
      policy_version: policy.version,
      policy_digest: policyDigest,
      measurement_digest: measurementDigest,
      passes_minimum_gate: passed,
      gate_outcome: passed ? 'pass_for_trial_review' : 'insufficient_evidence',
      supporting_reasons: support,
      gate_reasons: reasons,
      status: passed ? 'hypothesis' : 'insufficient_evidence',
      requested_action: passed ? 'bounded_trial_review_only' : 'retain_candidate_for_learning',
      auto_canon_allowed: false,
      promotion_eligible: false,
      permanent_merge_allowed: false,
      root_change_allowed: false,
      execution_allowed: false,
      requires_merge_gate: true,
      epistemic_notice: 'The proposed center is an externally supplied hypothesis. This evaluator does not create evidence or grant authority.'
    };
  }

  return {
    VERSION: '0.1.0',
    STATUS: 'EXPERIMENTAL',
    CLAIM_TYPES: CLAIM_TYPES.slice(),
    CLAIM_LABELS: Object.assign({}, CLAIM_LABELS),
    DEFAULT_TRIAD_POLICY: Object.assign({}, DEFAULT_TRIAD_POLICY),
    canonicalJson: canonicalJson,
    stableDigest: stableDigest,
    stableId: stableId,
    createObservation: createObservation,
    createClaim: createClaim,
    assessClaim: assessClaim,
    createAttentionFrame: createAttentionFrame,
    projectModel: projectModel,
    evaluateTriad: evaluateTriad
  };
});
