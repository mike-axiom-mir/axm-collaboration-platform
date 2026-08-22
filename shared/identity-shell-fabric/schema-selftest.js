'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, 'schemas');
const files = fs.readdirSync(ROOT).filter(name => name.endsWith('.json')).sort();
const schemas = new Map(files.map(name => [name, JSON.parse(fs.readFileSync(path.join(ROOT, name), 'utf8'))]));
let assertions = 0;

function ok(condition, label) {
  assert.ok(condition, label);
  assertions += 1;
}

function equal(actual, expected, label) {
  assert.deepStrictEqual(actual, expected, label);
  assertions += 1;
}

function visit(value, visitor, trail = '$') {
  if (!value || typeof value !== 'object') return;
  visitor(value, trail);
  if (Array.isArray(value)) value.forEach((item, index) => visit(item, visitor, trail + '[' + index + ']'));
  else Object.keys(value).forEach(key => visit(value[key], visitor, trail + '.' + key));
}

const ids = [];
schemas.forEach((schema, name) => {
  equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema', name + ' uses the declared JSON Schema dialect');
  ok(typeof schema.$id === 'string' && schema.$id.startsWith('axm.identity-shell.'), name + ' has a fabric schema id');
  ids.push(schema.$id);
  if (name !== 'common.schema.json') {
    equal(schema.type, 'object', name + ' validates an object');
    equal(schema.additionalProperties, false, name + ' rejects unknown top-level fields');
  }
  visit(schema, (node, trail) => {
    if (typeof node.$ref !== 'string' || node.$ref.startsWith('#')) return;
    const target = node.$ref.split('#')[0];
    ok(schemas.has(target), name + ' ' + trail + ' resolves local schema ' + target);
  });
});
equal(new Set(ids).size, ids.length, 'schema ids are unique');

const common = schemas.get('common.schema.json');
equal(common.$defs.digests.uniqueItems, true, 'digest collections reject duplicates');

const policy = schemas.get('continuity-policy.schema.json');
equal(policy.properties.retention.properties.maxAcceptedReceipts.maximum, 256, 'accepted retention has a finite schema ceiling');
equal(policy.properties.retention.properties.maxCandidateReceipts.maximum, 256, 'candidate retention has a finite schema ceiling');

const manifest = schemas.get('compiled-shell-manifest.schema.json');
const componentKinds = manifest.properties.components.allOf.map(rule => rule.contains.properties.kind.const).sort();
equal(componentKinds, ['ADAPTER', 'BODY'], 'manifest schema requires adapter and body component classes');
const continuityCases = manifest.properties.continuity.allOf.map(rule => rule.if.properties.state.const).sort();
equal(continuityCases, ['EMPTY', 'RECONSTRUCTED'], 'manifest schema distinguishes empty and reconstructed continuity');
const lifecycleCases = manifest.allOf.map(rule => rule.if.properties.lifecycleState.const).sort();
equal(lifecycleCases, ['ACTIVE_PROPOSAL', 'RETIREMENT_PROPOSED', 'SUCCESSION_PROPOSED'], 'manifest schema couples every lifecycle class to lineage');

const lineage = schemas.get('lineage-receipt.schema.json');
const lineageCases = lineage.allOf.map(rule => rule.if.properties.eventKind.const).sort();
equal(lineageCases, ['FORK', 'MIGRATION', 'ORIGIN', 'RECONSTRUCTION', 'RETIREMENT_PROPOSAL', 'SUCCESSION_PROPOSAL'], 'lineage schema covers every event kind');
lineage.allOf.forEach(rule => {
  const eventKind = rule.if.properties.eventKind.const;
  ok(rule.then.properties.state && rule.then.properties.state.const, eventKind + ' fixes a lineage state');
});

const buildGap = schemas.get('build-gap-receipt.schema.json');
const buildStatuses = buildGap.allOf.map(rule => rule.if.properties.status.const).sort();
equal(buildStatuses, ['COMPILED', 'HOLD'], 'build/gap schema couples both statuses to gaps and outputs');

const continuityEvent = schemas.get('continuity-event.schema.json');
const continuityEventCases = continuityEvent.allOf.map(rule => rule.if.properties.eventType.const).sort();
equal(continuityEventCases, ['MEMORY_ACCEPTANCE', 'MEMORY_CANDIDATE', 'MODEL_OR_CONNECTOR_SWAP', 'ROLLBACK'], 'continuity event schema publishes all conditional receipt boundaries');
const candidateRule = continuityEvent.allOf.find(rule => rule.if.properties.eventType.const === 'MEMORY_CANDIDATE');
equal(candidateRule.else.properties.acceptanceReceiptRef.properties.schema.const, 'axm.human-acceptance/v1', 'accepted continuity events require the external human-acceptance contract');

const humanDecision = schemas.get('human-decision-receipt.schema.json');
const decisionCases = humanDecision.allOf.map(rule => rule.if.properties.decision.const).sort();
equal(decisionCases, ['AUTHORIZE_RETIREMENT_PROPOSAL', 'AUTHORIZE_SUCCESSION_PROPOSAL', 'HOLD', 'REJECT'], 'human decision schema couples every decision to its confirmation and evidence boundary');

process.stdout.write('PASS identity-shell-fabric schemas: ' + assertions + ' contract-topology assertions across ' + files.length + ' schemas\n');
