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
  merge: false,
  canon: false
});

const ACTORS = new Set(['MACHINE', 'AI', 'HUMAN', 'UNKNOWN']);
const STEP_STATES = new Set(['PENDING', 'ACTIVE', 'BLOCKED', 'DONE', 'SKIPPED', 'SUPERSEDED']);
const SCRATCH_KINDS = new Set([
  'OBSERVATION', 'HYPOTHESIS', 'REMINDER', 'FAILED_ATTEMPT', 'QUESTION',
  'TODO', 'DECISION_CANDIDATE', 'IDEA'
]);
const REVISIT_TRIGGERS = Object.freeze([
  'ON_REENTRY',
  'AFTER_CONTEXT_COMPACTION',
  'BEFORE_EDIT_PROGRAM',
  'BEFORE_TOOL_EXECUTION_REQUEST',
  'AFTER_FAILURE',
  'BEFORE_DIRECTION_SWITCH'
]);

function canon(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canon).join(',')}]`;
  return `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}`;
}

function hash(v) {
  return crypto.createHash('sha256').update(typeof v === 'string' ? v : canon(v)).digest('hex');
}

function actor(v) {
  const a = String(v || 'UNKNOWN').toUpperCase();
  return ACTORS.has(a) ? a : 'UNKNOWN';
}

function clean(v, fallback = '') {
  const s = String(v == null ? '' : v).trim();
  return s || fallback;
}

function cleanId(v, fallback = '') {
  const s = clean(v, fallback).replace(/[^a-zA-Z0-9._:-]+/g, '-').replace(/^-+|-+$/g, '');
  return s || fallback;
}

function strings(v, max = 128) {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.map(x => clean(x)).filter(Boolean))].slice(0, max);
}

function normalizeStep(raw, index) {
  const id = cleanId(raw && raw.id, `step-${index + 1}`);
  return Object.freeze({
    id,
    title: clean(raw && raw.title, id),
    intent: raw && raw.intent != null ? String(raw.intent) : null,
    dependsOn: strings(raw && raw.dependsOn, 32),
    expectedArtifacts: strings(raw && raw.expectedArtifacts, 32),
    checks: strings(raw && raw.checks, 32),
    notes: strings(raw && raw.notes, 16)
  });
}

function createDirection({
  projectId,
  actorClass = 'UNKNOWN',
  title = null,
  goal,
  directionalPrompt = null,
  roadmap = [],
  steps = [],
  constraints = [],
  sourceLinks = [],
  parentDirectionSha256 = null,
  planClass = 'WORKING_PLAN'
} = {}) {
  const pid = cleanId(projectId);
  if (!pid) throw new Error('WORK_CONTEXT_PROJECT_ID_REQUIRED');
  const normalizedSteps = (Array.isArray(steps) ? steps : []).map(normalizeStep);
  const ids = normalizedSteps.map(s => s.id);
  const duplicates = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))].sort();
  const idSet = new Set(ids);
  const unknownDependencies = normalizedSteps.flatMap(step => step.dependsOn
    .filter(dep => !idSet.has(dep))
    .map(dep => ({ stepId: step.id, dependencyStepId: dep })));
  const core = {
    schema: 'axm.code.work-direction.v1',
    version: '1.0.0',
    projectId: pid,
    actorClass: actor(actorClass),
    planClass: clean(planClass, 'WORKING_PLAN').toUpperCase(),
    title: title == null ? null : String(title),
    goal: clean(goal),
    directionalPrompt: directionalPrompt == null ? null : String(directionalPrompt),
    roadmap: strings(roadmap, 128),
    steps: normalizedSteps,
    constraints: strings(constraints, 128),
    sourceLinks: strings(sourceLinks, 128),
    parentDirectionSha256: parentDirectionSha256 == null ? null : String(parentDirectionSha256),
    validation: {
      duplicateStepIds: duplicates,
      unknownDependencies,
      usable: duplicates.length === 0 && unknownDependencies.length === 0 && !!clean(goal)
    },
    truth: {
      immutableRevision: true,
      activeSelectionPerformed: false,
      planIsNotCorrectnessProof: true,
      planIsNotUserApprovalUnlessExplicitlySuppliedAsSuch: true,
      workspaceMutation: false,
      toolExecution: false
    },
    authority: AUTHORITY
  };
  return Object.freeze({ ...core, directionSha256: hash(core) });
}

function createProgressEvent({
  projectId,
  directionSha256,
  actorClass = 'UNKNOWN',
  sequence,
  stepId,
  status,
  note = null,
  evidenceDigests = [],
  observedAt = null
} = {}) {
  if (!Number.isInteger(sequence) || sequence < 1) throw new Error('WORK_CONTEXT_PROGRESS_SEQUENCE_REQUIRED');
  const normalizedStatus = String(status || '').toUpperCase();
  if (!STEP_STATES.has(normalizedStatus)) throw new Error(`WORK_CONTEXT_PROGRESS_STATUS_INVALID:${normalizedStatus}`);
  const core = {
    schema: 'axm.code.work-progress-event.v1',
    version: '1.0.0',
    projectId: cleanId(projectId),
    directionSha256: clean(directionSha256),
    sequence,
    actorClass: actor(actorClass),
    stepId: cleanId(stepId),
    status: normalizedStatus,
    note: note == null ? null : String(note),
    evidenceDigests: strings(evidenceDigests, 64).sort(),
    observedAt: observedAt == null ? null : String(observedAt),
    truth: {
      appendOnlyEvent: true,
      eventDoesNotRewriteDirection: true,
      doneDoesNotProveCorrectness: true,
      workspaceMutation: false
    },
    authority: AUTHORITY
  };
  if (!core.projectId || !core.directionSha256 || !core.stepId) throw new Error('WORK_CONTEXT_PROGRESS_FIELDS_REQUIRED');
  return Object.freeze({ ...core, eventSha256: hash(core) });
}

function foldProgress(direction, events = []) {
  if (!direction || direction.schema !== 'axm.code.work-direction.v1') {
    return Object.freeze({ schema: 'axm.code.work-progress-snapshot.v1', result: 'INVALID_DIRECTION', authority: 'NONE' });
  }
  const stepIds = new Set(direction.steps.map(s => s.id));
  const relevant = [];
  const rejected = [];
  const seenSequence = new Set();
  for (const event of Array.isArray(events) ? events : []) {
    let reason = null;
    if (!event || event.schema !== 'axm.code.work-progress-event.v1') reason = 'INVALID_EVENT_SCHEMA';
    else if (event.projectId !== direction.projectId) reason = 'PROJECT_MISMATCH';
    else if (event.directionSha256 !== direction.directionSha256) reason = 'DIRECTION_MISMATCH';
    else if (!stepIds.has(event.stepId)) reason = 'UNKNOWN_STEP';
    else if (seenSequence.has(event.sequence)) reason = 'DUPLICATE_SEQUENCE';
    if (reason) rejected.push({ eventSha256: event && event.eventSha256 || null, reason });
    else { seenSequence.add(event.sequence); relevant.push(event); }
  }
  relevant.sort((a, b) => a.sequence - b.sequence || a.eventSha256.localeCompare(b.eventSha256));
  const latest = new Map(direction.steps.map(s => [s.id, 'PENDING']));
  for (const event of relevant) latest.set(event.stepId, event.status);
  const stepStates = direction.steps.map(step => ({ ...step, status: latest.get(step.id) }));
  const core = {
    schema: 'axm.code.work-progress-snapshot.v1',
    version: '1.0.0',
    result: rejected.length ? 'PROGRESS_READY_WITH_REJECTED_EVENTS' : 'PROGRESS_READY',
    projectId: direction.projectId,
    directionSha256: direction.directionSha256,
    stepStates,
    activeStepIds: stepStates.filter(s => s.status === 'ACTIVE').map(s => s.id),
    blockedStepIds: stepStates.filter(s => s.status === 'BLOCKED').map(s => s.id),
    doneStepIds: stepStates.filter(s => s.status === 'DONE').map(s => s.id),
    pendingStepIds: stepStates.filter(s => s.status === 'PENDING').map(s => s.id),
    appliedEventSha256s: relevant.map(e => e.eventSha256),
    rejectedEvents: rejected,
    truth: { derivedViewOnly: true, directionRewritten: false, doneIsNotCorrectnessProof: true },
    authority: 'NONE'
  };
  return Object.freeze({ ...core, progressSha256: hash(core) });
}

function createScratchNote({
  projectId,
  directionSha256 = null,
  actorClass = 'UNKNOWN',
  sequence,
  kind = 'OBSERVATION',
  text,
  tags = [],
  links = [],
  supersedes = [],
  handoffCandidate = false,
  sensitivity = 'LOCAL_WORK_CONTEXT',
  observedAt = null
} = {}) {
  if (!Number.isInteger(sequence) || sequence < 1) throw new Error('WORK_CONTEXT_SCRATCH_SEQUENCE_REQUIRED');
  const normalizedKind = String(kind || '').toUpperCase();
  if (!SCRATCH_KINDS.has(normalizedKind)) throw new Error(`WORK_CONTEXT_SCRATCH_KIND_INVALID:${normalizedKind}`);
  const core = {
    schema: 'axm.code.work-scratch-note.v1',
    version: '1.0.0',
    projectId: cleanId(projectId),
    directionSha256: directionSha256 == null ? null : String(directionSha256),
    sequence,
    actorClass: actor(actorClass),
    kind: normalizedKind,
    text: clean(text),
    tags: strings(tags, 32).sort(),
    links: strings(links, 32).sort(),
    supersedes: strings(supersedes, 32).sort(),
    handoffCandidate: !!handoffCandidate,
    sensitivity: clean(sensitivity, 'LOCAL_WORK_CONTEXT').toUpperCase(),
    observedAt: observedAt == null ? null : String(observedAt),
    truth: {
      appendOnlySelfNote: true,
      noteIsNotFact: true,
      noteIsNotPlanDecision: true,
      noteIsNotAdmissionEvidence: true,
      handoffCandidateIsNotAutomaticExport: true,
      userInspectable: true,
      workspaceMutation: false
    },
    authority: AUTHORITY
  };
  if (!core.projectId || !core.text) throw new Error('WORK_CONTEXT_SCRATCH_FIELDS_REQUIRED');
  return Object.freeze({ ...core, noteSha256: hash(core) });
}

function foldScratch({ projectId, directionSha256 = null, notes = [] } = {}) {
  const pid = cleanId(projectId);
  const accepted = [], rejected = [];
  const sequences = new Set();
  for (const note of Array.isArray(notes) ? notes : []) {
    let reason = null;
    if (!note || note.schema !== 'axm.code.work-scratch-note.v1') reason = 'INVALID_NOTE_SCHEMA';
    else if (note.projectId !== pid) reason = 'PROJECT_MISMATCH';
    else if (directionSha256 && note.directionSha256 && note.directionSha256 !== directionSha256) reason = 'DIRECTION_MISMATCH';
    else if (sequences.has(note.sequence)) reason = 'DUPLICATE_SEQUENCE';
    if (reason) rejected.push({ noteSha256: note && note.noteSha256 || null, reason });
    else { sequences.add(note.sequence); accepted.push(note); }
  }
  accepted.sort((a, b) => a.sequence - b.sequence || a.noteSha256.localeCompare(b.noteSha256));
  const superseded = new Set(accepted.flatMap(n => n.supersedes));
  const activeNotes = accepted.filter(n => !superseded.has(n.noteSha256));
  const core = {
    schema: 'axm.code.work-scratch-view.v1',
    version: '1.0.0',
    result: rejected.length ? 'SCRATCH_READY_WITH_REJECTED_NOTES' : 'SCRATCH_READY',
    projectId: pid,
    directionSha256,
    activeNotes,
    supersededNoteSha256s: [...superseded].sort(),
    handoffCandidates: activeNotes.filter(n => n.handoffCandidate).map(n => n.noteSha256),
    rejectedNotes: rejected,
    truth: { notesRemainNonAuthoritative: true, supersessionDoesNotEraseOriginal: true },
    authority: 'NONE'
  };
  return Object.freeze({ ...core, scratchSha256: hash(core) });
}

function buildContextCard({
  direction,
  progressEvents = [],
  scratchNotes = [],
  currentStepId = null,
  buildWindowState = null,
  relationshipImpact = null,
  maxScratch = 8
} = {}) {
  if (!direction || direction.schema !== 'axm.code.work-direction.v1') {
    return Object.freeze({ schema: 'axm.code.work-context-card.v1', result: 'INVALID_DIRECTION', authority: 'NONE' });
  }
  const progress = foldProgress(direction, progressEvents);
  const scratch = foldScratch({ projectId: direction.projectId, directionSha256: direction.directionSha256, notes: scratchNotes });
  const explicit = currentStepId && progress.stepStates.find(s => s.id === currentStepId) || null;
  const active = progress.stepStates.find(s => s.status === 'ACTIVE') || null;
  const pending = progress.stepStates.find(s => s.status === 'PENDING') || null;
  const focus = explicit || active || pending || null;
  const scratchLimit = Number.isInteger(maxScratch) ? Math.max(0, Math.min(32, maxScratch)) : 8;
  const selectedScratch = scratch.activeNotes.slice(-scratchLimit).map(n => ({
    noteSha256: n.noteSha256,
    sequence: n.sequence,
    actorClass: n.actorClass,
    kind: n.kind,
    text: n.text,
    tags: n.tags,
    handoffCandidate: n.handoffCandidate
  }));
  const core = {
    schema: 'axm.code.work-context-card.v1',
    version: '1.0.0',
    result: direction.validation.usable ? 'CONTEXT_CARD_READY' : 'CONTEXT_CARD_READY_DIRECTION_HELD',
    projectId: direction.projectId,
    directionSha256: direction.directionSha256,
    progressSha256: progress.progressSha256,
    scratchSha256: scratch.scratchSha256,
    title: direction.title,
    goal: direction.goal,
    directionalPrompt: direction.directionalPrompt,
    roadmap: direction.roadmap,
    constraints: direction.constraints,
    focusStep: focus,
    focusSelection: explicit ? 'CALLER_EXPLICIT' : active ? 'DERIVED_ACTIVE_STEP' : pending ? 'DERIVED_FIRST_PENDING_CANDIDATE' : 'NONE',
    activeStepIds: progress.activeStepIds,
    blockedStepIds: progress.blockedStepIds,
    doneStepIds: progress.doneStepIds,
    nextPendingStepIds: progress.pendingStepIds.slice(0, 8),
    recentScratch: selectedScratch,
    buildWindow: buildWindowState ? {
      stateSha256: buildWindowState.stateSha256 || null,
      stage: buildWindowState.stage || null,
      admission: buildWindowState.status && buildWindowState.status.admission || null,
      quickTest: buildWindowState.status && buildWindowState.status.quickTest || null
    } : null,
    impact: relationshipImpact ? {
      reportDigest: relationshipImpact.reportSha256 || relationshipImpact.impactSha256 || null,
      result: relationshipImpact.result || null,
      affectedCount: Array.isArray(relationshipImpact.affected) ? relationshipImpact.affected.length : null,
      affectedTests: Array.isArray(relationshipImpact.affectedTests) ? relationshipImpact.affectedTests.slice(0, 32) : [],
      affectedVerifiers: Array.isArray(relationshipImpact.affectedVerifiers) ? relationshipImpact.affectedVerifiers.slice(0, 32) : []
    } : null,
    revisitTriggers: [...REVISIT_TRIGGERS],
    truth: {
      cardIsDerivedCache: true,
      cardMayBeRebuiltFromDirectionProgressScratch: true,
      focusCandidateIsNotExecutionAuthority: true,
      scratchNotesAreNotFacts: true,
      staleDirectionCardMustBeRefused: true,
      workspaceMutation: false,
      toolExecution: false
    },
    authority: AUTHORITY
  };
  return Object.freeze({ ...core, cardSha256: hash(core) });
}

function verifyContextCard({ card, direction } = {}) {
  if (!card || card.schema !== 'axm.code.work-context-card.v1') return Object.freeze({ result: 'INVALID_CONTEXT_CARD', authority: 'NONE' });
  if (!direction || direction.schema !== 'axm.code.work-direction.v1') return Object.freeze({ result: 'INVALID_DIRECTION', authority: 'NONE' });
  if (card.projectId !== direction.projectId) return Object.freeze({ result: 'PROJECT_MISMATCH', authority: 'NONE' });
  if (card.directionSha256 !== direction.directionSha256) return Object.freeze({ result: 'STALE_CONTEXT_CARD_DIRECTION_CHANGED', authority: 'NONE' });
  return Object.freeze({ result: 'CONTEXT_CARD_DIRECTION_CURRENT', projectId: direction.projectId, directionSha256: direction.directionSha256, authority: 'NONE' });
}

function createStoreIntent({ projectId, operation, payloadDigest, actorClass = 'UNKNOWN' } = {}) {
  const allowed = new Set(['PUT_DIRECTION', 'SELECT_ACTIVE_DIRECTION', 'PUT_PROGRESS_EVENT', 'PUT_SCRATCH_NOTE', 'PUT_CONTEXT_CARD', 'READ_CONTEXT']);
  const op = String(operation || '').toUpperCase();
  if (!allowed.has(op)) throw new Error(`WORK_CONTEXT_STORE_OPERATION_INVALID:${op}`);
  const core = {
    schema: 'axm.code.work-context-store-intent.v1',
    version: '1.0.0',
    projectId: cleanId(projectId),
    operation: op,
    payloadDigest: payloadDigest == null ? null : String(payloadDigest),
    actorClass: actor(actorClass),
    targetClass: 'SCOPED_LOCAL_WORK_CONTEXT_STORE',
    truth: { intentOnly: true, storeWriteNotExecuted: true, sourceWorkspaceTargeted: false },
    authority: AUTHORITY
  };
  if (!core.projectId) throw new Error('WORK_CONTEXT_STORE_PROJECT_REQUIRED');
  return Object.freeze({ ...core, intentSha256: hash(core) });
}

function createHandoffCandidate({ direction, progressEvents = [], scratchNotes = [] } = {}) {
  if (!direction || direction.schema !== 'axm.code.work-direction.v1') return Object.freeze({ result: 'INVALID_DIRECTION', authority: 'NONE' });
  const progress = foldProgress(direction, progressEvents);
  const scratch = foldScratch({ projectId: direction.projectId, directionSha256: direction.directionSha256, notes: scratchNotes });
  const selectedNotes = scratch.activeNotes.filter(n => n.handoffCandidate).map(n => ({
    noteSha256: n.noteSha256,
    kind: n.kind,
    text: n.text,
    tags: n.tags,
    actorClass: n.actorClass
  }));
  const core = {
    schema: 'axm.code.work-context-handoff-candidate.v1',
    version: '1.0.0',
    projectId: direction.projectId,
    directionSha256: direction.directionSha256,
    activeGoal: direction.goal,
    boundaries: direction.constraints,
    openLoops: progress.stepStates.filter(s => !['DONE', 'SKIPPED', 'SUPERSEDED'].includes(s.status)).map(s => ({ id: s.id, title: s.title, status: s.status })),
    selectedScratchNotes: selectedNotes,
    sourceLinks: direction.sourceLinks,
    truth: {
      continuationCapsuleNotWritten: true,
      scratchSelectionExplicitByNoteFlag: true,
      nonSelectedScratchExcluded: true,
      candidateIsNotDurableMemory: true,
      automaticPromotion: false
    },
    nextAdapter: 'DETERMINISTIC_CONTINUATION_CAPSULE_OR_OTHER_EXPLICIT_HANDOFF_ADAPTER',
    authority: 'NONE'
  };
  return Object.freeze({ ...core, handoffSha256: hash(core) });
}

function snapshot() {
  const core = {
    schema: 'axm.code.work-context-dock-snapshot.v1',
    version: '1.0.0',
    stepStates: [...STEP_STATES].sort(),
    scratchKinds: [...SCRATCH_KINDS].sort(),
    revisitTriggers: [...REVISIT_TRIGGERS],
    directionLane: 'IMMUTABLE_REVISIONS',
    progressLane: 'APPEND_ONLY_EVENTS',
    scratchLane: 'APPEND_ONLY_NON_AUTHORITATIVE_NOTES',
    hotCard: 'DERIVED_REBUILDABLE_CACHE',
    authority: 'NONE'
  };
  return Object.freeze({ ...core, snapshotSha256: hash(core) });
}

module.exports = {
  createDirection,
  createProgressEvent,
  foldProgress,
  createScratchNote,
  foldScratch,
  buildContextCard,
  verifyContextCard,
  createStoreIntent,
  createHandoffCandidate,
  snapshot,
  REVISIT_TRIGGERS
};
