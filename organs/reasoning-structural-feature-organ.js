'use strict';

const fs = require('fs');
const path = require('path');
const Projection = require('../kernel/schema-structural-feature-projection-cell');
const State = require('../kernel/state-language');

const ORGAN_ID = 'axm.mirror.organ/reasoning-structural-feature-projection-v1';
const SCHEMA = 'axm.mirror.reasoning-structural-feature-projection/v1';
const SOURCE_SCHEMA = 'axm.mirror.reasoning-feature-source/v1';
const DEFAULT_SELECTOR = path.resolve(__dirname, '..', 'training', 'reasoning-structural-feature-selector.json');

function digest(value) { return State.digest(value, 64); }

function sourceView(context = {}) {
  if (!context || typeof context !== 'object' || Array.isArray(context)) throw new Error('reasoning structural feature context must be an object');
  return {
    schema: SOURCE_SCHEMA,
    problemState: context.problemState || {},
    pathSet: context.pathSet || (Array.isArray(context.profiles) ? { profiles: context.profiles } : {}),
    principleTrace: context.principleTrace || {}
  };
}

function loadSelector(file = DEFAULT_SELECTOR) {
  file = path.resolve(file);
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 1024 * 1024) throw new Error('reasoning structural selector must be one bounded real file');
  const first = fs.readFileSync(file);
  const second = fs.readFileSync(file);
  if (!first.equals(second)) throw new Error('reasoning structural selector changed while read');
  return Projection.normalizeSelector(JSON.parse(first.toString('utf8')));
}

function create(context, options = {}) {
  const source = sourceView(context);
  const selector = options.selector ? Projection.normalizeSelector(options.selector) : loadSelector(options.selectorFile);
  const projected = Projection.project(source, selector);
  const basis = {
    selectorId: projected.selector.selectorId,
    selectorDigest: projected.selector.selectorDigest,
    sourceSelectionDigest: projected.sourceSelectionDigest,
    observations: projected.observations,
    features: projected.features,
    negativeFeatures: projected.negativeFeatures,
    unknowns: projected.unknowns
  };
  const output = {
    schema: SCHEMA,
    projectionId: `reasoning-structural-features-${digest(basis).slice(0, 24)}`,
    projectionDigest: null,
    organ: { id: ORGAN_ID, status: 'TEST_SCHEMA_SELECTED_MACHINE_FEATURES', learnedWeights: false },
    selector: {
      schema: projected.selector.schema,
      selectorId: projected.selector.selectorId,
      selectorDigest: projected.selector.selectorDigest,
      sourceSchema: projected.selector.sourceSchema,
      rules: projected.selector.rules.length
    },
    source: {
      schema: SOURCE_SCHEMA,
      selectionDigest: projected.sourceSelectionDigest,
      fullSourcePersisted: false,
      proseFieldsRead: 0,
      idsRead: 0
    },
    observations: projected.observations,
    features: projected.features,
    negativeFeatures: projected.negativeFeatures,
    unknowns: projected.unknowns,
    summary: projected.summary,
    policy: {
      schemaSelectedPathsOnly: true,
      finiteMachineValuesOnly: true,
      unselectedFieldsIgnored: true,
      proseCanBecomeFeature: false,
      identifiersCanBecomeFeature: false,
      selectorChangeRequiresNewDigest: true
    },
    authority: {
      activeRuntime: false,
      sourceRead: true,
      semanticTruthWrite: false,
      evidenceAdmission: false,
      decisionAuthority: false,
      permissionGrant: false,
      trainingAdmission: false,
      toolUse: false,
      runtimePromotion: false,
      canonChange: false,
      worldAction: false
    },
    boundary: 'This TEST organ projects only selector-declared finite machine values. The projection may supply exact private applicability features, but it cannot interpret prose, establish truth or causality, admit evidence or training, grant permission, decide, promote, or act.'
  };
  output.projectionDigest = digest(Object.assign({}, output, { projectionDigest: null }));
  return output;
}

function verify(value, context = null, options = {}) {
  if (!value || value.schema !== SCHEMA || !/^reasoning-structural-features-[a-f0-9]{24}$/.test(String(value.projectionId || '')) || value.projectionDigest !== digest(Object.assign({}, value, { projectionDigest: null }))) throw new Error('reasoning structural feature projection digest changed');
  if (!value.organ || value.organ.id !== ORGAN_ID || value.organ.learnedWeights !== false) throw new Error('reasoning structural feature organ lineage changed');
  if (!value.policy || value.policy.schemaSelectedPathsOnly !== true || value.policy.finiteMachineValuesOnly !== true || value.policy.unselectedFieldsIgnored !== true || value.policy.proseCanBecomeFeature !== false || value.policy.identifiersCanBecomeFeature !== false || value.policy.selectorChangeRequiresNewDigest !== true) throw new Error('reasoning structural feature projection policy changed');
  if (!value.authority || Object.entries(value.authority).some(([key, item]) => key === 'sourceRead' ? item !== true : item !== false)) throw new Error('reasoning structural feature projection authority changed');
  if (!value.source || value.source.schema !== SOURCE_SCHEMA || value.source.fullSourcePersisted !== false || value.source.proseFieldsRead !== 0 || value.source.idsRead !== 0 || value.summary.proseFieldsRead !== 0 || value.summary.idsRead !== 0 || value.summary.decisionsMade !== 0 || value.summary.permissionsGranted !== 0 || value.summary.trainingAdmissions !== 0 || value.summary.worldActions !== 0) throw new Error('reasoning structural feature source boundary changed');
  if ((value.features || []).some(item => !String(item).startsWith('structural-fact:')) || (value.negativeFeatures || []).some(item => !String(item).startsWith('structural-negative:'))) throw new Error('reasoning structural feature polarity changed');
  if (context) {
    const reconstructed = create(context, options);
    if (digest(reconstructed) !== digest(value)) throw new Error(`reasoning structural feature reconstruction changed: ${value.projectionId || 'missing'} -> ${reconstructed.projectionId}`);
  }
  return true;
}

module.exports = { ORGAN_ID, SCHEMA, SOURCE_SCHEMA, DEFAULT_SELECTOR, sourceView, loadSelector, create, verify };
