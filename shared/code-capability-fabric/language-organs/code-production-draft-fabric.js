'use strict';

const crypto = require('crypto');
const keyboard = require('./machine-code-keyboard-router.js');

const MAX_DRAFTS = 16;
const ACTORS = new Set(['MACHINE', 'AI', 'HUMAN', 'UNKNOWN']);
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

function canon(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canon).join(',')}]`;
  return `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}`;
}

function hash(v) {
  return crypto.createHash('sha256').update(typeof v === 'string' ? v : canon(v)).digest('hex');
}

function clean(v, fallback = '') {
  const s = String(v == null ? '' : v).trim();
  return s || fallback;
}

function cleanId(v, fallback = '') {
  const s = clean(v, fallback).replace(/[^a-zA-Z0-9._:-]+/g, '-').replace(/^-+|-+$/g, '');
  return s || fallback;
}

function actor(v) {
  const a = String(v || 'UNKNOWN').toUpperCase();
  return ACTORS.has(a) ? a : 'UNKNOWN';
}

function strings(v, max = 64) {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.map(x => clean(x)).filter(Boolean))].slice(0, max);
}

function normalizeAxis(raw, index) {
  if (typeof raw === 'string') {
    return Object.freeze({ axis: cleanId(raw, `axis-${index + 1}`), instruction: null, tags: [] });
  }
  const axis = cleanId(raw && raw.axis, `axis-${index + 1}`);
  return Object.freeze({
    axis,
    instruction: raw && raw.instruction != null ? String(raw.instruction) : null,
    tags: strings(raw && raw.tags, 16).sort()
  });
}

function normalizeArtifact(raw) {
  if (!raw) return null;
  if (raw.sourceCode != null || raw.body != null || raw.bytes != null) {
    throw new Error('PRODUCTION_DRAFT_RAW_ARTIFACT_BODY_REFUSED');
  }
  return Object.freeze({
    artifactId: raw.artifactId == null ? null : cleanId(raw.artifactId),
    digest: raw.digest == null ? null : String(raw.digest),
    kind: raw.kind == null ? null : String(raw.kind),
    mime: raw.mime == null ? null : String(raw.mime),
    visualState: raw.visualState == null ? null : String(raw.visualState),
    byteLength: Number.isFinite(Number(raw.byteLength)) ? Math.max(0, Number(raw.byteLength)) : null
  });
}

function normalizeAdmission(raw) {
  if (!raw) return null;
  return Object.freeze({
    result: raw.result == null ? null : String(raw.result),
    candidateDigest: raw.candidateDigest == null ? null : String(raw.candidateDigest),
    reportDigest: raw.reportDigest || raw.reportSha256 || null,
    policyDigest: raw.policyDigest || null,
    requiredFailureIds: Array.isArray(raw.requiredFailureIds) ? raw.requiredFailureIds.map(String) : [],
    requiredUnknownIds: Array.isArray(raw.requiredUnknownIds) ? raw.requiredUnknownIds.map(String) : []
  });
}

function normalizeBuildWindow(raw) {
  if (!raw) return null;
  const artifactDigest = raw.artifactDigest || raw.artifact && (raw.artifact.digest || raw.artifact.sha256) || null;
  return Object.freeze({
    stateSha256: raw.stateSha256 || null,
    stage: raw.stage || null,
    artifactDigest: artifactDigest == null ? null : String(artifactDigest),
    admission: raw.status && raw.status.admission || null,
    quickTest: raw.status && raw.status.quickTest || null
  });
}

function validateProgram(raw) {
  if (!raw) return null;
  if (raw.schema !== 'axm.code.machine-key-program.v1') throw new Error('PRODUCTION_DRAFT_KEY_PROGRAM_INVALID');
  if (raw.sourceCode != null) throw new Error('PRODUCTION_DRAFT_RAW_SOURCE_REFUSED');
  return raw;
}

function programDigest(program) {
  return program && program.programSha256 || null;
}

function createBatch({
  projectId,
  direction,
  draftCount = 4,
  languageId,
  prebuildPlan = null,
  role = null,
  intent = 'build',
  signals = [],
  variantAxes = []
} = {}) {
  const pid = cleanId(projectId || direction && direction.projectId);
  if (!pid) return Object.freeze({ schema: 'axm.code.production-batch.v1', result: 'PROJECT_ID_REQUIRED', authority: 'NONE' });
  if (!Number.isInteger(draftCount) || draftCount < 1 || draftCount > MAX_DRAFTS) {
    return Object.freeze({
      schema: 'axm.code.production-batch.v1',
      result: 'DRAFT_COUNT_OUT_OF_RANGE',
      requestedDraftCount: draftCount,
      minDraftCount: 1,
      maxDraftCount: MAX_DRAFTS,
      authority: 'NONE'
    });
  }
  if (!direction || direction.schema !== 'axm.code.work-direction.v1' || direction.projectId !== pid) {
    return Object.freeze({ schema: 'axm.code.production-batch.v1', result: 'DIRECTION_REQUIRED_OR_PROJECT_MISMATCH', projectId: pid, authority: 'NONE' });
  }
  if (!direction.validation || !direction.validation.usable) {
    return Object.freeze({ schema: 'axm.code.production-batch.v1', result: 'DIRECTION_HELD', projectId: pid, directionSha256: direction.directionSha256 || null, authority: 'NONE' });
  }
  const layout = keyboard.layout({ languageId, prebuildPlan, role, intent, signals });
  if (!layout || layout.result !== 'MACHINE_KEYBOARD_READY') {
    return Object.freeze({ schema: 'axm.code.production-batch.v1', result: 'KEYBOARD_LAYOUT_HELD', projectId: pid, languageId: languageId || null, layout, authority: 'NONE' });
  }
  const axes = (Array.isArray(variantAxes) ? variantAxes : []).map(normalizeAxis);
  const slots = Array.from({ length: draftCount }, (_, i) => {
    const axis = axes.length ? axes[i % axes.length] : null;
    return Object.freeze({
      draftId: `draft-${String(i + 1).padStart(2, '0')}`,
      slot: i + 1,
      variant: axis ? {
        axis: axis.axis,
        instruction: axis.instruction,
        tags: axis.tags,
        source: 'CALLER_DECLARED',
        branchIndex: Math.floor(i / axes.length) + 1
      } : null
    });
  });
  const core = {
    schema: 'axm.code.production-batch.v1',
    version: '1.0.0',
    result: 'PRODUCTION_BATCH_READY',
    projectId: pid,
    directionSha256: direction.directionSha256,
    languageId: String(languageId || ''),
    role: role == null ? null : String(role),
    intent: String(intent || 'build'),
    requestedDraftCount: draftCount,
    draftCount,
    maxDraftCount: MAX_DRAFTS,
    keyboardLayoutSha256: layout.layoutSha256,
    keyboardSha256: layout.keyboardSha256,
    prebuildPlanDigest: prebuildPlan && (prebuildPlan.planDigest || prebuildPlan.planSha256 || prebuildPlan.snapshotSha256) || null,
    variantMode: axes.length ? 'CALLER_DECLARED_DIRECTED_VARIANTS' : 'EDITABLE_SLOTS_NO_INVENTED_VARIATION',
    variantAxes: axes,
    slots,
    truth: {
      draftsAreCandidates: true,
      draftCountIsNotConfidence: true,
      noVariationInventedWithoutCallerAxes: true,
      noDraftAutoSelected: true,
      noRankingPerformed: true,
      batchBoundToDirectionDigest: true,
      compileOrRenderExecuted: false,
      workspaceMutation: false,
      promotion: false
    },
    authority: AUTHORITY
  };
  return Object.freeze({ ...core, batchSha256: hash(core), layout });
}

function assessBatchDirection({ batch, direction } = {}) {
  if (!batch || batch.schema !== 'axm.code.production-batch.v1') {
    return Object.freeze({ schema: 'axm.code.production-batch-direction-status.v1', result: 'INVALID_BATCH', authority: 'NONE' });
  }
  if (!direction || direction.schema !== 'axm.code.work-direction.v1') {
    return Object.freeze({ schema: 'axm.code.production-batch-direction-status.v1', result: 'CURRENT_DIRECTION_NOT_SUPPLIED', batchSha256: batch.batchSha256, directionSha256: batch.directionSha256, authority: 'NONE' });
  }
  if (direction.projectId !== batch.projectId) {
    return Object.freeze({ schema: 'axm.code.production-batch-direction-status.v1', result: 'PROJECT_MISMATCH', batchSha256: batch.batchSha256, authority: 'NONE' });
  }
  const current = direction.directionSha256 === batch.directionSha256;
  return Object.freeze({
    schema: 'axm.code.production-batch-direction-status.v1',
    result: current ? 'PRODUCTION_BATCH_DIRECTION_CURRENT' : 'PRODUCTION_BATCH_DIRECTION_STALE',
    batchSha256: batch.batchSha256,
    batchDirectionSha256: batch.directionSha256,
    currentDirectionSha256: direction.directionSha256,
    truth: { staleDoesNotDeleteBatch: true, staleDoesNotMeanDraftIncorrect: true, explicitRebaseOrNewBatchRequiredForCurrentDirection: !current },
    authority: 'NONE'
  });
}

function initialDraft(batch, slot) {
  const core = {
    schema: 'axm.code.production-draft-revision.v1',
    version: '1.0.0',
    result: 'EDITABLE_DRAFT_READY',
    projectId: batch.projectId,
    batchSha256: batch.batchSha256,
    directionSha256: batch.directionSha256,
    draftId: slot.draftId,
    revision: 1,
    parentRevisionSha256: null,
    actorClass: 'UNKNOWN',
    languageId: batch.languageId,
    role: batch.role,
    variant: slot.variant,
    editSummary: null,
    changeClass: 'INITIAL_EMPTY_DRAFT',
    keyProgram: null,
    artifact: null,
    admission: null,
    buildWindow: null,
    evidenceFreshness: {
      structuralProgram: 'NONE',
      artifact: 'NONE',
      admission: 'NONE',
      buildWindow: 'NONE',
      invalidatedBy: []
    },
    scratchNoteRefs: [],
    compileState: 'EDITABLE_DRAFT_NO_PROGRAM',
    selectionState: 'UNSELECTED',
    truth: {
      immutableRevision: true,
      editableByNewRevision: true,
      rawSourceRetained: false,
      priorRevisionPreserved: true,
      selected: false,
      promoted: false,
      workspaceMutation: false,
      toolExecution: false
    },
    authority: AUTHORITY
  };
  return Object.freeze({ ...core, draftRevisionSha256: hash(core) });
}

function spawnDrafts(batch) {
  if (!batch || batch.schema !== 'axm.code.production-batch.v1' || batch.result !== 'PRODUCTION_BATCH_READY') {
    return Object.freeze({ schema: 'axm.code.production-draft-set.v1', result: 'INVALID_BATCH', drafts: [], authority: 'NONE' });
  }
  const drafts = batch.slots.map(slot => initialDraft(batch, slot));
  return Object.freeze({
    schema: 'axm.code.production-draft-set.v1',
    version: '1.0.0',
    result: 'PRODUCTION_DRAFTS_READY',
    projectId: batch.projectId,
    batchSha256: batch.batchSha256,
    draftCount: drafts.length,
    drafts,
    truth: { allDraftsEditableByRevision: true, noWinnerSelected: true, sourceCodeProduced: false },
    authority: 'NONE',
    draftSetSha256: hash({ batchSha256: batch.batchSha256, drafts: drafts.map(d => d.draftRevisionSha256) })
  });
}

function deriveCompileState(program, artifact, admission) {
  if (admission && admission.result === 'REJECTED_CANDIDATE') return 'CANDIDATE_REJECTED';
  if (admission && admission.result === 'ADMISSIBLE_CANDIDATE_NOT_PROMOTED') return 'ADMISSIBLE_DRAFT_NOT_SELECTED';
  if (admission && admission.result === 'HELD_IN_QUARANTINE') return 'DRAFT_HELD_IN_QUARANTINE';
  if (artifact && artifact.digest) return 'RENDERED_OR_COMPILED_ARTIFACT_VISIBLE';
  if (program && program.result === 'EDIT_PROGRAM_READY') return 'STRUCTURAL_PROGRAM_READY_RENDER_COMPILE_EXTERNAL';
  return 'EDITABLE_DRAFT_NO_PROGRAM';
}

function reviseDraft({
  batch,
  draft,
  actorClass = 'UNKNOWN',
  editSummary = null,
  keyProgram = undefined,
  artifact = undefined,
  admissionReport = undefined,
  buildWindowState = undefined,
  scratchNoteRefs = undefined
} = {}) {
  if (!batch || batch.schema !== 'axm.code.production-batch.v1' || batch.result !== 'PRODUCTION_BATCH_READY') {
    return Object.freeze({ schema: 'axm.code.production-draft-revision.v1', result: 'INVALID_BATCH', authority: 'NONE' });
  }
  if (!draft || draft.schema !== 'axm.code.production-draft-revision.v1' || draft.batchSha256 !== batch.batchSha256) {
    return Object.freeze({ schema: 'axm.code.production-draft-revision.v1', result: 'INVALID_OR_FOREIGN_DRAFT', authority: 'NONE' });
  }

  const program = keyProgram === undefined ? draft.keyProgram : validateProgram(keyProgram);
  const programChanged = keyProgram !== undefined && programDigest(program) !== programDigest(draft.keyProgram);
  const invalidatedBy = [];
  if (programChanged) invalidatedBy.push('STRUCTURAL_PROGRAM_CHANGED');

  let artifactMeta;
  let artifactFreshness;
  if (artifact !== undefined) {
    artifactMeta = normalizeArtifact(artifact);
    artifactFreshness = artifactMeta ? 'CURRENT_EXPLICIT_BINDING' : 'NONE_EXPLICITLY_CLEARED';
  } else if (programChanged) {
    artifactMeta = null;
    artifactFreshness = 'STALE_CLEARED_PROGRAM_CHANGED';
  } else {
    artifactMeta = draft.artifact;
    artifactFreshness = artifactMeta ? 'INHERITED_UNCHANGED_PROGRAM' : 'NONE';
  }
  const oldArtifactDigest = draft.artifact && draft.artifact.digest || null;
  const newArtifactDigest = artifactMeta && artifactMeta.digest || null;
  const artifactChanged = artifact !== undefined && oldArtifactDigest !== newArtifactDigest;
  if (artifactChanged) invalidatedBy.push('ARTIFACT_DIGEST_CHANGED');

  let admission;
  let admissionFreshness;
  if (admissionReport !== undefined) {
    admission = normalizeAdmission(admissionReport);
    if (admission && admission.candidateDigest && newArtifactDigest && admission.candidateDigest !== newArtifactDigest) {
      throw new Error('PRODUCTION_DRAFT_ADMISSION_ARTIFACT_DIGEST_MISMATCH');
    }
    admissionFreshness = admission ? (admission.candidateDigest && newArtifactDigest ? 'CURRENT_DIGEST_BOUND' : 'CURRENT_EXPLICIT_UNBOUND') : 'NONE_EXPLICITLY_CLEARED';
  } else if (!artifactMeta) {
    admission = null;
    admissionFreshness = programChanged || artifactChanged ? 'STALE_CLEARED_NO_CURRENT_ARTIFACT' : 'NONE';
  } else if (draft.admission && draft.admission.candidateDigest && draft.admission.candidateDigest === newArtifactDigest) {
    admission = draft.admission;
    admissionFreshness = programChanged || artifactChanged ? 'REUSED_IDENTICAL_ARTIFACT_DIGEST' : 'INHERITED_UNCHANGED_ARTIFACT';
  } else if (programChanged || artifactChanged) {
    admission = null;
    admissionFreshness = 'STALE_CLEARED_CANDIDATE_CHANGED';
  } else {
    admission = draft.admission;
    admissionFreshness = admission ? 'INHERITED_UNCHANGED_CANDIDATE' : 'NONE';
  }
  const admissionChanged = admissionReport !== undefined && (admission && admission.reportDigest || null) !== (draft.admission && draft.admission.reportDigest || null);
  if (admissionChanged) invalidatedBy.push('ADMISSION_REPORT_CHANGED');

  let buildWindow;
  let buildWindowFreshness;
  if (buildWindowState !== undefined) {
    buildWindow = normalizeBuildWindow(buildWindowState);
    if (buildWindow && buildWindow.artifactDigest && newArtifactDigest && buildWindow.artifactDigest !== newArtifactDigest) {
      throw new Error('PRODUCTION_DRAFT_BUILD_WINDOW_ARTIFACT_DIGEST_MISMATCH');
    }
    buildWindowFreshness = buildWindow ? (buildWindow.artifactDigest && newArtifactDigest ? 'CURRENT_DIGEST_BOUND' : 'CURRENT_EXPLICIT_UNBOUND') : 'NONE_EXPLICITLY_CLEARED';
  } else if (programChanged || artifactChanged || admissionChanged) {
    buildWindow = null;
    buildWindowFreshness = 'STALE_CLEARED_UPSTREAM_EVIDENCE_CHANGED';
  } else {
    buildWindow = draft.buildWindow;
    buildWindowFreshness = buildWindow ? 'INHERITED_UNCHANGED_CANDIDATE' : 'NONE';
  }

  const refs = scratchNoteRefs === undefined ? draft.scratchNoteRefs : strings(scratchNoteRefs, 64).sort();
  const changeClass = programChanged
    ? 'STRUCTURAL_PROGRAM_CHANGED'
    : artifactChanged
      ? 'ARTIFACT_REBOUND_WITHOUT_PROGRAM_CHANGE'
      : admissionChanged
        ? 'EVIDENCE_REBOUND_WITHOUT_PROGRAM_CHANGE'
        : 'METADATA_ONLY_NO_PROGRAM_CHANGE';
  const core = {
    schema: 'axm.code.production-draft-revision.v1',
    version: '1.1.0',
    result: 'EDITABLE_DRAFT_READY',
    projectId: draft.projectId,
    batchSha256: draft.batchSha256,
    directionSha256: draft.directionSha256,
    draftId: draft.draftId,
    revision: draft.revision + 1,
    parentRevisionSha256: draft.draftRevisionSha256,
    actorClass: actor(actorClass),
    languageId: draft.languageId,
    role: draft.role,
    variant: draft.variant,
    editSummary: editSummary == null ? null : String(editSummary),
    changeClass,
    keyProgram: program,
    artifact: artifactMeta,
    admission,
    buildWindow,
    evidenceFreshness: {
      structuralProgram: program ? (programChanged ? 'CURRENT_CHANGED_PROGRAM' : 'INHERITED_UNCHANGED_PROGRAM') : 'NONE',
      artifact: artifactFreshness,
      admission: admissionFreshness,
      buildWindow: buildWindowFreshness,
      invalidatedBy
    },
    scratchNoteRefs: refs,
    compileState: deriveCompileState(program, artifactMeta, admission),
    selectionState: 'UNSELECTED',
    truth: {
      immutableRevision: true,
      editableByNewRevision: true,
      rawSourceRetained: false,
      priorRevisionPreserved: true,
      parentRevisionRequiredForEdit: true,
      downstreamEvidenceInvalidatedWhenCandidateChanges: true,
      editSummaryDoesNotProveSourceChange: true,
      selected: false,
      promoted: false,
      workspaceMutation: false,
      toolExecution: false
    },
    authority: AUTHORITY
  };
  return Object.freeze({ ...core, draftRevisionSha256: hash(core) });
}

function compareDrafts({ batch, drafts = [] } = {}) {
  if (!batch || batch.schema !== 'axm.code.production-batch.v1') {
    return Object.freeze({ schema: 'axm.code.production-draft-comparison.v1', result: 'INVALID_BATCH', authority: 'NONE' });
  }
  const accepted = (Array.isArray(drafts) ? drafts : []).filter(d => d && d.schema === 'axm.code.production-draft-revision.v1' && d.batchSha256 === batch.batchSha256);
  const latest = new Map();
  for (const draft of accepted) {
    const current = latest.get(draft.draftId);
    if (!current || draft.revision > current.revision || (draft.revision === current.revision && draft.draftRevisionSha256 > current.draftRevisionSha256)) latest.set(draft.draftId, draft);
  }
  const rows = [...latest.values()].sort((a, b) => a.draftId.localeCompare(b.draftId)).map(d => ({
    draftId: d.draftId,
    revision: d.revision,
    draftRevisionSha256: d.draftRevisionSha256,
    variant: d.variant,
    changeClass: d.changeClass || null,
    compileState: d.compileState,
    programSha256: d.keyProgram && d.keyProgram.programSha256 || null,
    invalidates: d.keyProgram && Array.isArray(d.keyProgram.invalidates) ? [...d.keyProgram.invalidates] : [],
    verifierHints: d.keyProgram && Array.isArray(d.keyProgram.verificationHints) ? [...d.keyProgram.verificationHints] : [],
    artifactDigest: d.artifact && d.artifact.digest || null,
    admissionResult: d.admission && d.admission.result || null,
    quickTest: d.buildWindow && d.buildWindow.quickTest || null,
    evidenceFreshness: d.evidenceFreshness || null
  }));
  const programGroups = new Map();
  for (const row of rows) {
    if (!row.programSha256) continue;
    if (!programGroups.has(row.programSha256)) programGroups.set(row.programSha256, []);
    programGroups.get(row.programSha256).push(row.draftId);
  }
  const duplicateProgramCandidates = [...programGroups.entries()]
    .filter(([, draftIds]) => draftIds.length > 1)
    .map(([programSha256, draftIds]) => ({ programSha256, draftIds: [...draftIds].sort(), state: 'EXACT_PROGRAM_DUPLICATE_CANDIDATE' }))
    .sort((a, b) => a.programSha256.localeCompare(b.programSha256));
  const core = {
    schema: 'axm.code.production-draft-comparison.v1',
    version: '1.1.0',
    result: rows.length ? 'DRAFT_COMPARISON_READY' : 'NO_DRAFTS_TO_COMPARE',
    projectId: batch.projectId,
    batchSha256: batch.batchSha256,
    rows,
    duplicateProgramCandidates,
    truth: {
      rankingPerformed: false,
      winnerSelected: false,
      metricDifferenceIsNotCorrectness: true,
      admittedDraftIsNotAutomaticallyPreferred: true,
      exactProgramDuplicateIsNotAutomaticDeletion: true,
      duplicateDetectionMayReduceUnnecessaryHeavyChecks: true
    },
    authority: 'NONE'
  };
  return Object.freeze({ ...core, comparisonSha256: hash(core) });
}

function summarizeProduction({ batch, drafts = [], selection = null, direction = null } = {}) {
  if (!batch || batch.schema !== 'axm.code.production-batch.v1') {
    return Object.freeze({ schema: 'axm.code.production-context-summary.v1', result: 'INVALID_BATCH', authority: 'NONE' });
  }
  const comparison = compareDrafts({ batch, drafts });
  const directionStatus = assessBatchDirection({ batch, direction });
  const selected = selection && selection.schema === 'axm.code.production-draft-selection.v1' && selection.batchSha256 === batch.batchSha256
    ? { draftId: selection.draftId, revision: selection.revision || null, draftRevisionSha256: selection.draftRevisionSha256, selectionSha256: selection.selectionSha256 || null }
    : null;
  const rows = comparison.rows || [];
  const core = {
    schema: 'axm.code.production-context-summary.v1',
    version: '1.0.0',
    result: 'PRODUCTION_CONTEXT_READY',
    projectId: batch.projectId,
    batchSha256: batch.batchSha256,
    batchDirectionSha256: batch.directionSha256,
    directionStatus: directionStatus.result,
    draftCount: batch.draftCount,
    latestDrafts: rows.map(row => ({
      draftId: row.draftId,
      revision: row.revision,
      draftRevisionSha256: row.draftRevisionSha256,
      compileState: row.compileState,
      admissionResult: row.admissionResult,
      quickTest: row.quickTest,
      evidenceFreshness: row.evidenceFreshness
    })),
    selected,
    duplicateProgramCandidates: comparison.duplicateProgramCandidates,
    truth: {
      summaryIsDerived: true,
      summaryIsNotRanking: true,
      staleDirectionDoesNotDeleteDrafts: true,
      selectionIsNotPromotion: true
    },
    authority: 'NONE'
  };
  return Object.freeze({ ...core, productionContextSha256: hash(core) });
}

function selectDraft({ batch, draft, actorClass = 'UNKNOWN', reason = null, currentDirection = null } = {}) {
  if (!batch || batch.schema !== 'axm.code.production-batch.v1' || !draft || draft.schema !== 'axm.code.production-draft-revision.v1' || draft.batchSha256 !== batch.batchSha256) {
    return Object.freeze({ schema: 'axm.code.production-draft-selection.v1', result: 'INVALID_SELECTION_INPUT', authority: 'NONE' });
  }
  if (currentDirection) {
    const status = assessBatchDirection({ batch, direction: currentDirection });
    if (status.result !== 'PRODUCTION_BATCH_DIRECTION_CURRENT') {
      return Object.freeze({
        schema: 'axm.code.production-draft-selection.v1',
        result: 'DRAFT_SELECTION_HELD_STALE_DIRECTION',
        projectId: batch.projectId,
        batchSha256: batch.batchSha256,
        draftId: draft.draftId,
        draftRevisionSha256: draft.draftRevisionSha256,
        directionStatus: status,
        truth: { staleBatchPreserved: true, noSelectionPerformed: true },
        authority: 'NONE'
      });
    }
  }
  const core = {
    schema: 'axm.code.production-draft-selection.v1',
    version: '1.1.0',
    result: 'DRAFT_SELECTED_NOT_PROMOTED',
    projectId: batch.projectId,
    batchSha256: batch.batchSha256,
    draftId: draft.draftId,
    revision: draft.revision,
    draftRevisionSha256: draft.draftRevisionSha256,
    selectedBy: actor(actorClass),
    reason: reason == null ? null : String(reason),
    truth: {
      explicitSelectionReceiptOnly: true,
      selectionIsNotCorrectnessProof: true,
      selectionIsNotAdmission: true,
      selectionIsNotMerge: true,
      selectionIsNotPromotion: true,
      currentDirectionCheckedWhenSupplied: !!currentDirection,
      otherDraftsRemainAvailable: true
    },
    authority: 'NONE'
  };
  return Object.freeze({ ...core, selectionSha256: hash(core) });
}

function esc(v) {
  return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&apos;' }[c]));
}

function renderComparisonSvg({ batch, drafts = [], title = 'Production Drafts' } = {}) {
  const comparison = compareDrafts({ batch, drafts });
  const rows = comparison.rows || [];
  const cardW = 250, cardH = 144, gap = 18, cols = Math.min(3, Math.max(1, rows.length));
  const width = 40 + cols * cardW + (cols - 1) * gap + 40;
  const rowCount = Math.max(1, Math.ceil(rows.length / cols));
  const height = 100 + rowCount * cardH + (rowCount - 1) * gap + 55;
  const cards = rows.map((r, i) => {
    const x = 40 + (i % cols) * (cardW + gap);
    const y = 92 + Math.floor(i / cols) * (cardH + gap);
    const variant = r.variant ? `${r.variant.axis}${r.variant.branchIndex ? ` #${r.variant.branchIndex}` : ''}` : 'editable slot';
    const freshness = r.evidenceFreshness && r.evidenceFreshness.artifact || 'NONE';
    return `<g><rect x="${x}" y="${y}" width="${cardW}" height="${cardH}" rx="10" fill="white" stroke="currentColor"/><text x="${x+12}" y="${y+24}" font-size="14" font-weight="700">${esc(r.draftId)} · rev ${r.revision}</text><text x="${x+12}" y="${y+45}" font-size="11">${esc(variant)}</text><text x="${x+12}" y="${y+66}" font-size="11">${esc(r.compileState)}</text><text x="${x+12}" y="${y+87}" font-size="11">admission: ${esc(r.admissionResult || 'UNKNOWN')}</text><text x="${x+12}" y="${y+108}" font-size="10">artifact: ${esc((r.artifactDigest || 'none').slice(0, 22))}</text><text x="${x+12}" y="${y+127}" font-size="10">evidence: ${esc(freshness)}</text></g>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(title)}"><rect width="100%" height="100%" fill="white"/><text x="40" y="36" font-size="22" font-weight="700">${esc(title)}</text><text x="40" y="60" font-size="12">${esc(batch && batch.draftCount || 0)} editable candidates · no automatic winner</text>${cards}<text x="40" y="${height-22}" font-size="11">Candidate comparison only. Selection, admission, merge and promotion remain separate.</text></svg>`;
}

function snapshot() {
  const core = {
    schema: 'axm.code.production-draft-fabric-snapshot.v1',
    version: '1.1.0',
    maxDraftsPerBatch: MAX_DRAFTS,
    schemas: [
      'axm.code.production-batch.v1',
      'axm.code.production-batch-direction-status.v1',
      'axm.code.production-draft-set.v1',
      'axm.code.production-draft-revision.v1',
      'axm.code.production-draft-comparison.v1',
      'axm.code.production-context-summary.v1',
      'axm.code.production-draft-selection.v1'
    ],
    evidenceFreshness: 'DOWNSTREAM_EVIDENCE_CLEARED_OR_REBOUND_WHEN_CANDIDATE_CHANGES',
    authority: 'NONE'
  };
  return Object.freeze({ ...core, snapshotSha256: hash(core) });
}

module.exports = {
  MAX_DRAFTS,
  createBatch,
  assessBatchDirection,
  spawnDrafts,
  reviseDraft,
  compareDrafts,
  summarizeProduction,
  selectDraft,
  renderComparisonSvg,
  snapshot
};
