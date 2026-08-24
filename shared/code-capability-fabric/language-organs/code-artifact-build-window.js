'use strict';

const crypto = require('crypto');

const AUTHORITY = Object.freeze({
  workspaceRead: false,
  workspaceMutation: false,
  toolExecution: false,
  network: false,
  install: false,
  deployment: false,
  promotion: false,
  canon: false
});

const ACTORS = new Set(['MACHINE', 'AI', 'HUMAN', 'UNKNOWN']);
const PREVIEW_CLASSES = new Set([
  'STRUCTURAL_TWIN',
  'STATIC_BROWSER_ARTIFACT',
  'BROWSER_RUNTIME_ARTIFACT',
  'IMAGE_ARTIFACT',
  'TEXT_ARTIFACT',
  'GENERIC_ARTIFACT'
]);

function canon(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canon).join(',')}]`;
  return `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}`;
}

function hash(v) {
  return crypto.createHash('sha256').update(typeof v === 'string' ? v : canon(v)).digest('hex');
}

function clampInt(v, min, max, fallback) {
  const n = Number(v);
  return Number.isInteger(n) ? Math.max(min, Math.min(max, n)) : fallback;
}

function cleanId(v, fallback) {
  const s = String(v || '').trim().replace(/[^a-zA-Z0-9._:-]+/g, '-').replace(/^-+|-+$/g, '');
  return s || fallback;
}

function inferStage({ prebuildPlan, keyProgram, admissionReport, sandboxObservation, artifact }) {
  if (sandboxObservation?.result === 'QUICK_TEST_OBSERVED') return 'QUICK_TEST_OBSERVED';
  if (admissionReport?.result === 'REJECTED_CANDIDATE') return 'CANDIDATE_REJECTED';
  if (admissionReport?.result === 'ADMISSIBLE_CANDIDATE_NOT_PROMOTED') return 'CANDIDATE_ADMISSIBLE_NOT_PROMOTED';
  if (admissionReport?.result === 'HELD_IN_QUARANTINE') return 'CANDIDATE_QUARANTINED';
  if (artifact?.digest) return 'RENDERED_CANDIDATE_VISIBLE';
  if (keyProgram?.result === 'EDIT_PROGRAM_READY') return 'STRUCTURAL_EDIT_PROGRAM';
  if (prebuildPlan?.result === 'PREBUILD_TWIN_READY') return prebuildPlan.sourceGenerationState || 'PREBUILD_TWIN_READY';
  return 'PLANNING';
}

function artifactEnvelope(artifact = {}) {
  const previewClass = PREVIEW_CLASSES.has(artifact.previewClass) ? artifact.previewClass : 'GENERIC_ARTIFACT';
  return Object.freeze({
    artifactId: cleanId(artifact.artifactId, 'candidate-artifact'),
    languageId: artifact.languageId ? String(artifact.languageId) : null,
    kind: artifact.kind ? String(artifact.kind) : 'unknown',
    mime: artifact.mime ? String(artifact.mime) : 'application/octet-stream',
    digest: artifact.digest ? String(artifact.digest) : null,
    byteLength: Number.isFinite(Number(artifact.byteLength)) ? Math.max(0, Number(artifact.byteLength)) : null,
    previewClass,
    visualState: artifact.visualState ? String(artifact.visualState) : 'UNKNOWN',
    transientBodyRetained: false,
    durableRawSourceRetained: false
  });
}

function buildState({
  sessionId,
  revision = 1,
  actor = 'UNKNOWN',
  goal = null,
  prebuildPlan = null,
  keyboardLayout = null,
  keyProgram = null,
  admissionReport = null,
  artifact = {},
  sandboxObservation = null,
  notes = []
} = {}) {
  const actorClass = ACTORS.has(String(actor).toUpperCase()) ? String(actor).toUpperCase() : 'UNKNOWN';
  const artifactMeta = artifactEnvelope(artifact);
  const core = {
    schema: 'axm.code.build-window-state.v1',
    version: '1.0.0',
    sessionId: cleanId(sessionId, `build-window-${hash(String(goal || 'untitled')).slice(0, 12)}`),
    revision: clampInt(revision, 1, 1000000, 1),
    actorClass,
    goal: goal == null ? null : String(goal),
    stage: inferStage({ prebuildPlan, keyProgram, admissionReport, sandboxObservation, artifact: artifactMeta }),
    bindings: {
      prebuildPlanDigest: prebuildPlan?.planSha256 || prebuildPlan?.snapshotSha256 || null,
      keyboardLayoutDigest: keyboardLayout?.layoutSha256 || null,
      keyProgramDigest: keyProgram?.programSha256 || null,
      admissionDigest: admissionReport?.reportSha256 || admissionReport?.snapshotSha256 || null,
      sandboxObservationDigest: sandboxObservation?.observationSha256 || null
    },
    artifact: artifactMeta,
    status: {
      plan: prebuildPlan?.result || 'UNKNOWN',
      sourceGeneration: prebuildPlan?.sourceGenerationState || null,
      editProgram: keyProgram?.result || null,
      admission: admissionReport?.result || null,
      quickTest: sandboxObservation?.result || null
    },
    notes: Array.isArray(notes) ? notes.slice(0, 32).map(String) : [],
    truth: {
      stateContainsRawSource: false,
      previewIsVerification: false,
      quickTestIsPromotion: false,
      visualStateMayBePartial: true,
      runtimeCorrectnessClaimed: false,
      workspaceMutated: false,
      toolExecuted: false
    },
    authority: AUTHORITY
  };
  return Object.freeze({ ...core, stateSha256: hash(core) });
}

function advanceState(previous, nextInput = {}) {
  if (!previous || previous.schema !== 'axm.code.build-window-state.v1') {
    return Object.freeze({ schema: 'axm.code.build-window-transition.v1', result: 'INVALID_PREVIOUS_STATE', authority: 'NONE' });
  }
  const next = buildState({ ...nextInput, sessionId: previous.sessionId, revision: previous.revision + 1 });
  const transition = {
    schema: 'axm.code.build-window-transition.v1',
    result: 'STATE_ADVANCED',
    sessionId: previous.sessionId,
    fromRevision: previous.revision,
    toRevision: next.revision,
    fromStateSha256: previous.stateSha256,
    toStateSha256: next.stateSha256,
    priorArtifactDigest: previous.artifact?.digest || null,
    nextArtifactDigest: next.artifact?.digest || null,
    rawSourceCopiedIntoHistory: false,
    authority: 'NONE'
  };
  return Object.freeze({ ...transition, transitionSha256: hash(transition), state: next });
}

function csp({ scripts = false } = {}) {
  const script = scripts ? "script-src 'unsafe-inline' 'wasm-unsafe-eval'" : "script-src 'none'";
  return [
    "default-src 'none'",
    script,
    "style-src 'unsafe-inline'",
    "img-src data: blob:",
    "font-src data:",
    "media-src data: blob:",
    "connect-src 'none'",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'"
  ].join('; ');
}

function wrapHtmlCandidate(body, { scripts = false } = {}) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp({ scripts }).replace(/"/g, '&quot;')}"><meta name="referrer" content="no-referrer"><style>html,body{margin:0;min-height:100%;background:transparent}</style></head><body>${String(body || '')}</body></html>`;
}

function wrapJsCandidate(js) {
  const escapedClose = String(js || '').replace(/<\/script/gi, '<\\/script');
  return wrapHtmlCandidate(`<div id="axm-runtime-root"></div><script>"use strict";${escapedClose}\n</script>`, { scripts: true });
}

function previewSpec({ state, transientArtifact = null, mode = 'STATIC' } = {}) {
  if (!state || state.schema !== 'axm.code.build-window-state.v1') {
    return Object.freeze({ schema: 'axm.code.artifact-preview-spec.v1', result: 'INVALID_BUILD_WINDOW_STATE', authority: 'NONE' });
  }
  const requestedMode = String(mode || 'STATIC').toUpperCase();
  const transient = transientArtifact && typeof transientArtifact === 'object' ? transientArtifact : {};
  const suppliedBody = transient.body == null ? null : String(transient.body);
  const suppliedDigest = suppliedBody == null ? null : hash(suppliedBody);
  if (state.artifact.digest && suppliedDigest && state.artifact.digest !== suppliedDigest) {
    return Object.freeze({ schema: 'axm.code.artifact-preview-spec.v1', result: 'TRANSIENT_ARTIFACT_DIGEST_MISMATCH', expected: state.artifact.digest, observed: suppliedDigest, authority: 'NONE' });
  }
  const isBrowser = ['text/html', 'application/xhtml+xml', 'text/css', 'text/javascript', 'application/javascript'].includes(state.artifact.mime);
  let srcdoc = null;
  let sandboxTokens = [];
  let result = 'STRUCTURAL_ONLY';
  let isolation = 'NO_CANDIDATE_EXECUTION';
  if (suppliedBody != null && isBrowser && requestedMode === 'STATIC') {
    if (state.artifact.mime === 'text/css') srcdoc = wrapHtmlCandidate(`<style>${suppliedBody}</style><div class="axm-preview-root">Preview surface</div>`, { scripts: false });
    else if (['text/javascript', 'application/javascript'].includes(state.artifact.mime)) srcdoc = wrapHtmlCandidate(`<pre>${suppliedBody.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</pre>`, { scripts: false });
    else srcdoc = wrapHtmlCandidate(suppliedBody, { scripts: false });
    result = 'STATIC_BROWSER_PREVIEW_READY';
    isolation = 'IFRAME_ALL_SANDBOX_FLAGS_ENABLED';
  } else if (suppliedBody != null && isBrowser && requestedMode === 'BROWSER_QUICK_RUN') {
    if (state.artifact.mime === 'text/css') srcdoc = wrapHtmlCandidate(`<style>${suppliedBody}</style><div class="axm-preview-root">Runtime visual surface</div>`, { scripts: true });
    else if (['text/javascript', 'application/javascript'].includes(state.artifact.mime)) srcdoc = wrapJsCandidate(suppliedBody);
    else srcdoc = wrapHtmlCandidate(suppliedBody, { scripts: true });
    sandboxTokens = ['allow-scripts'];
    result = 'BROWSER_QUICK_RUN_READY_EXPLICIT_ONLY';
    isolation = 'OPAQUE_ORIGIN_CAPABILITY_SANDBOX_NOT_RESOURCE_ISOLATION';
  }
  const core = {
    schema: 'axm.code.artifact-preview-spec.v1',
    version: '1.0.0',
    result,
    sessionId: state.sessionId,
    revision: state.revision,
    stateSha256: state.stateSha256,
    artifactId: state.artifact.artifactId,
    artifactDigest: state.artifact.digest,
    mode: requestedMode,
    sandboxTokens,
    csp: csp({ scripts: sandboxTokens.includes('allow-scripts') }),
    srcdoc,
    structuralPreview: transient.structuralSvg ? String(transient.structuralSvg) : null,
    isolation,
    durability: 'EPHEMERAL_DOM_ONLY',
    truth: {
      previewIsVerification: false,
      browserSandboxIsCpuIsolation: false,
      browserSandboxIsMemoryIsolation: false,
      allowSameOrigin: false,
      networkAllowedByCsp: false,
      hostStorageAccessGranted: false,
      rawSourcePersistedByCore: false
    },
    authority: AUTHORITY
  };
  return Object.freeze({ ...core, previewSha256: hash({ ...core, srcdocDigest: srcdoc ? hash(srcdoc) : null, srcdoc: null }) });
}

function quickTestRequest({ state, explicitAction = false, runtimeClass = 'HOST_DISPOSABLE', sandboxCapability = null, timeoutMs = 5000 } = {}) {
  if (!state || state.schema !== 'axm.code.build-window-state.v1') {
    return Object.freeze({ schema: 'axm.code.quick-test-request.v1', result: 'INVALID_BUILD_WINDOW_STATE', authority: 'NONE' });
  }
  if (!explicitAction) {
    return Object.freeze({ schema: 'axm.code.quick-test-request.v1', result: 'EXPLICIT_QUICK_TEST_ACTION_REQUIRED', sessionId: state.sessionId, revision: state.revision, authority: 'NONE' });
  }
  const cls = String(runtimeClass || 'HOST_DISPOSABLE').toUpperCase();
  if (!['HOST_DISPOSABLE', 'BROWSER_CAPABILITY_SANDBOX'].includes(cls)) {
    return Object.freeze({ schema: 'axm.code.quick-test-request.v1', result: 'UNSUPPORTED_RUNTIME_CLASS', runtimeClass: cls, authority: 'NONE' });
  }
  if (cls === 'HOST_DISPOSABLE' && !sandboxCapability) {
    return Object.freeze({ schema: 'axm.code.quick-test-request.v1', result: 'DISPOSABLE_SANDBOX_CAPABILITY_REQUIRED', sessionId: state.sessionId, revision: state.revision, authority: 'NONE' });
  }
  const core = {
    schema: 'axm.code.quick-test-request.v1',
    version: '1.0.0',
    result: 'QUICK_TEST_REQUEST_READY_EXECUTION_EXTERNAL',
    sessionId: state.sessionId,
    revision: state.revision,
    stateSha256: state.stateSha256,
    artifactId: state.artifact.artifactId,
    artifactDigest: state.artifact.digest,
    languageId: state.artifact.languageId,
    runtimeClass: cls,
    timeoutMs: clampInt(timeoutMs, 250, 30000, 5000),
    sandboxCapability: sandboxCapability ? {
      id: String(sandboxCapability.id || ''),
      digest: String(sandboxCapability.digest || ''),
      handoff: String(sandboxCapability.handoff || 'axm.disposable-candidate-sandbox-session/v1')
    } : null,
    constraints: {
      candidateNetwork: false,
      hostCredentials: false,
      hostEnvironment: false,
      workspaceMutation: false,
      sourceIterationMutation: false,
      automaticInstall: false,
      automaticPromotion: false,
      durableRawSourceEvidence: false
    },
    truth: {
      requestDoesNotExecute: true,
      quickTestIsNotAdmissionProof: true,
      quickTestIsNotPromotion: true,
      browserCapabilitySandboxIsNotResourceIsolation: cls === 'BROWSER_CAPABILITY_SANDBOX'
    },
    authority: AUTHORITY
  };
  return Object.freeze({ ...core, requestSha256: hash(core) });
}

function observeQuickTest({ request, session = null, evidence = null } = {}) {
  if (!request || request.schema !== 'axm.code.quick-test-request.v1' || request.result !== 'QUICK_TEST_REQUEST_READY_EXECUTION_EXTERNAL') {
    return Object.freeze({ schema: 'axm.code.quick-test-observation.v1', result: 'INVALID_QUICK_TEST_REQUEST', authority: 'NONE' });
  }
  if (!session || !session.id || !session.digest) {
    return Object.freeze({ schema: 'axm.code.quick-test-observation.v1', result: 'SANDBOX_SESSION_EVIDENCE_REQUIRED', requestSha256: request.requestSha256, authority: 'NONE' });
  }
  const status = ['PASS', 'FAIL', 'TIMEOUT', 'ERROR', 'UNKNOWN'].includes(String(evidence?.status || '').toUpperCase()) ? String(evidence.status).toUpperCase() : 'UNKNOWN';
  const core = {
    schema: 'axm.code.quick-test-observation.v1',
    version: '1.0.0',
    result: 'QUICK_TEST_OBSERVED',
    requestSha256: request.requestSha256,
    sessionId: request.sessionId,
    revision: request.revision,
    artifactDigest: request.artifactDigest,
    sandboxSession: { id: String(session.id), digest: String(session.digest) },
    status,
    evidenceDigest: evidence?.digest ? String(evidence.digest) : null,
    summary: evidence?.summary ? String(evidence.summary).slice(0, 2000) : null,
    rawStdoutRetained: false,
    rawStderrRetained: false,
    rawSourceRetained: false,
    truth: {
      observedStatusIsRuntimeEvidenceOnly: true,
      passIsNotUniversalCorrectness: true,
      failDoesNotMutateCandidate: true,
      promotionAuthority: false
    },
    authority: AUTHORITY
  };
  return Object.freeze({ ...core, observationSha256: hash(core) });
}

function snapshot() {
  const body = {
    schema: 'axm.code.build-window-snapshot.v1',
    version: '1.0.0',
    previewClasses: [...PREVIEW_CLASSES].sort(),
    actorClasses: [...ACTORS].sort(),
    previewModes: ['STATIC', 'BROWSER_QUICK_RUN'],
    quickRuntimeClasses: ['HOST_DISPOSABLE', 'BROWSER_CAPABILITY_SANDBOX'],
    browserRuntimeSandboxTokens: ['allow-scripts'],
    browserRuntimeForbidsAllowSameOrigin: true,
    browserRuntimeCsp: csp({ scripts: true }),
    visualDraftRoomSeam: 'ephemeral-live-preview',
    disposableSandboxSeam: 'axm.disposable-candidate-sandbox-session/v1',
    authority: 'NONE'
  };
  return Object.freeze({ ...body, snapshotSha256: hash(body) });
}

module.exports = {
  buildState,
  advanceState,
  previewSpec,
  quickTestRequest,
  observeQuickTest,
  snapshot,
  csp,
  wrapHtmlCandidate
};
