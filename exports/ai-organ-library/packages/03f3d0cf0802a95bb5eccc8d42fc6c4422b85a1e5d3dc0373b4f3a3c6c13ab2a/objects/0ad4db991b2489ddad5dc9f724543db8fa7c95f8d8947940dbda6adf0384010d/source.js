'use strict';

const crypto = require('crypto');
const English = require('./english-lesson-stewardship-organ');
const TraceLanguage = require('./typed-trace-language-organ');

const ORGAN_ID = 'axm.mirror.english-interpreter-bridge-organ/experimental-v2';
const REQUEST_SCHEMA = 'axm.mirror.english-interpreter-bridge-request/v1';
const RESPONSE_SCHEMA = 'axm.mirror.english-interpreter-bridge-response/v1';
const DIRECTIONS = new Set(['ENGLISH_TO_TYPED_GROUNDING', 'TYPED_TRACE_TO_ENGLISH']);
const FORBIDDEN_REASONING_KEYS = /^(chain[-_ ]?of[-_ ]?thought|hidden[-_ ]?reasoning|private[-_ ]?reasoning|scratchpad|internal[-_ ]?monologue)$/i;

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
}
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function sha256(value) { return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex'); }
function exactKeys(value, expected, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || JSON.stringify(Object.keys(value).sort()) !== JSON.stringify(expected.slice().sort())) throw new Error(`${label} shape is closed`);
}
function clean(value, maximum, label) {
  const output = String(value == null ? '' : value).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!output || output.length > maximum) throw new Error(`${label} must contain 1 through ${maximum} characters`);
  return output;
}
function boundedId(value, label, maximum = 160) {
  const output = clean(value, maximum, label);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._:/-]*$/.test(output)) throw new Error(`${label} must be a bounded machine identifier`);
  return output;
}
function digest64(value, label) {
  const output = String(value || '');
  if (!/^[a-f0-9]{64}$/.test(output)) throw new Error(`${label} must be a sha256 digest`);
  return output;
}
function scanForbiddenReasoning(value, trail = ['request']) {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_REASONING_KEYS.test(key)) throw new Error(`private hidden reasoning field refused at ${trail.concat(key).join('.')}`);
    scanForbiddenReasoning(child, trail.concat(key));
  }
}

function normalizeRequest(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('one English interpreter bridge request is required');
  scanForbiddenReasoning(input);
  exactKeys(input, ['schema', 'requestId', 'specialistId', 'direction', 'modelBinding', 'payload', 'usePermission', 'permissionBasis', 'boundary'], 'English interpreter bridge request');
  if (input.schema !== REQUEST_SCHEMA) throw new Error('English interpreter bridge request schema is unsupported');
  if (input.specialistId !== English.SPECIALIST_ID) throw new Error(`English interpreter bridge is isolated to ${English.SPECIALIST_ID}`);
  if (!DIRECTIONS.has(input.direction)) throw new Error('English interpreter bridge direction is unsupported');
  if (input.usePermission !== 'allowed') throw new Error('English interpreter bridge requires usePermission: allowed');
  exactKeys(input.modelBinding, ['kind', 'modelDigest'], 'English interpreter bridge model binding');
  const expectedKind = input.direction === 'ENGLISH_TO_TYPED_GROUNDING' ? 'ENGLISH_ASSOCIATION_MODEL' : 'TYPED_TRACE_LANGUAGE_MODEL';
  if (input.modelBinding.kind !== expectedKind) throw new Error('English interpreter bridge model kind does not match direction');
  let payload;
  if (input.direction === 'ENGLISH_TO_TYPED_GROUNDING') {
    exactKeys(input.payload, ['locale', 'text'], 'English interpreter input');
    if (input.payload.locale !== 'en') throw new Error('English interpreter bridge accepts locale en only');
    payload = { locale: 'en', text: clean(input.payload.text, 500, 'payload.text').normalize('NFKC').replace(/\s+/g, ' ').trim() };
  } else {
    exactKeys(input.payload, ['trace'], 'typed trace interpreter input');
    if (!input.payload.trace || input.payload.trace.schema !== 'axm.mirror.trace/v1') throw new Error('typed trace interpreter input requires axm.mirror.trace/v1');
    payload = { trace: clone(input.payload.trace) };
  }
  return stable({
    schema: REQUEST_SCHEMA,
    requestId: boundedId(input.requestId, 'requestId'),
    specialistId: English.SPECIALIST_ID,
    direction: input.direction,
    modelBinding: { kind: expectedKind, modelDigest: digest64(input.modelBinding.modelDigest, 'modelBinding.modelDigest') },
    payload,
    usePermission: 'allowed',
    permissionBasis: clean(input.permissionBasis, 1000, 'permissionBasis'),
    boundary: clean(input.boundary, 1200, 'boundary')
  });
}

function responseDigestBasis(response) {
  const basis = clone(response);
  basis.responseDigest = null;
  return basis;
}

function englishToGrounding(request, models) {
  const model = models && models.englishAssociationModel;
  English.assertModel(model);
  if (model.modelDigest !== request.modelBinding.modelDigest) throw new Error('English interpreter association model digest does not match request binding');
  const recalled = English.recall(model, request.payload.text);
  return {
    state: recalled.state === 'PROPOSED_PRIVATE_SHADOW_GROUNDING' ? 'PROPOSED_SHADOW_ENGLISH_GROUNDING' : 'HOLD_ENGLISH_INPUT_UNSEEN',
    proposal: recalled.proposal ? {
      schema: 'axm.mirror.english-interpreter-grounding-proposal/v1',
      conceptId: recalled.proposal.conceptId,
      groundingKind: recalled.proposal.groundingKind,
      machineFacts: clone(recalled.proposal.machineFacts),
      sourceLessonDigests: recalled.proposal.sourceLessonDigests.slice()
    } : null,
    sourceResponseDigest: sha256(recalled),
    sourceState: recalled.state,
    factsPromoted: 0,
    decisionChanged: false,
    sourceHumanRenderingRead: false
  };
}

function traceToEnglish(request, models) {
  const model = models && models.typedTraceLanguageModel;
  if (!model || model.modelDigest !== request.modelBinding.modelDigest) throw new Error('English interpreter trace-language model digest does not match request binding');
  const rendered = TraceLanguage.render(request.payload.trace, model);
  return {
    state: rendered.state === 'PROPOSED_SHADOW_TRACE_FAITHFUL_RENDERING' ? 'PROPOSED_SHADOW_TRACE_RENDERING' : 'HOLD_TRACE_RENDERING',
    proposal: rendered.proposal ? {
      schema: 'axm.mirror.english-interpreter-rendering-proposal/v1',
      planId: rendered.prediction.planId,
      sections: clone(rendered.proposal.sections),
      text: rendered.proposal.text
    } : null,
    sourceResponseDigest: rendered.responseDigest,
    sourceState: rendered.state,
    factsPromoted: rendered.fidelity.factsPromotedByLanguage,
    decisionChanged: rendered.authority.decisionChange,
    sourceHumanRenderingRead: rendered.fidelity.sourceHumanRenderingRead
  };
}

function route(input, models = {}) {
  const request = normalizeRequest(input);
  const result = request.direction === 'ENGLISH_TO_TYPED_GROUNDING' ? englishToGrounding(request, models) : traceToEnglish(request, models);
  const response = stable({
    schema: RESPONSE_SCHEMA,
    responseDigest: null,
    organId: ORGAN_ID,
    specialistId: English.SPECIALIST_ID,
    requestId: request.requestId,
    requestDigest: sha256(request),
    direction: request.direction,
    state: result.state,
    modelBinding: clone(request.modelBinding),
    proposal: result.proposal,
    source: {
      responseDigest: result.sourceResponseDigest,
      state: result.sourceState,
      modelBytesCopied: false
    },
    fidelity: {
      machineStatePreserved: true,
      factsPromoted: result.factsPromoted,
      decisionChanged: result.decisionChanged,
      sourceHumanRenderingRead: result.sourceHumanRenderingRead,
      freeGeneratedFactSlots: 0,
      humanProseDecisionAuthority: false
    },
    authority: {
      activeRuntime: false,
      factPromotion: false,
      decisionChange: false,
      permissionGrant: false,
      toolUse: false,
      memoryWrite: false,
      trainingAdmission: false,
      modelChange: false,
      parentMirrorWrite: false,
      runtimePromotion: false,
      canonChange: false,
      worldAction: false
    },
    boundary: 'This bridge routes one explicitly supplied model and input in private shadow mode. It cannot turn English into truth or authority, change the source trace, load state, train, write Mirror, start a runtime, promote behavior, change CANON, or act.'
  });
  response.responseDigest = sha256(responseDigestBasis(response));
  return stable(response);
}

function verifyResponse(response) {
  if (!response || response.schema !== RESPONSE_SCHEMA || response.organId !== ORGAN_ID || response.specialistId !== English.SPECIALIST_ID) throw new Error('English interpreter bridge response identity is invalid');
  if (response.responseDigest !== sha256(responseDigestBasis(response))) throw new Error('English interpreter bridge response digest changed');
  if (!response.authority || Object.values(response.authority).some(Boolean)) throw new Error('English interpreter bridge authority changed');
  if (!response.fidelity || response.fidelity.factsPromoted !== 0 || response.fidelity.decisionChanged !== false || response.fidelity.humanProseDecisionAuthority !== false || response.fidelity.freeGeneratedFactSlots !== 0) throw new Error('English interpreter bridge fidelity boundary changed');
  return true;
}

module.exports = { ORGAN_ID, REQUEST_SCHEMA, RESPONSE_SCHEMA, DIRECTIONS, normalizeRequest, route, verifyResponse };
