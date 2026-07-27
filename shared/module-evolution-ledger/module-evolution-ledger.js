'use strict';

const crypto = require('crypto');
const {
  fail,
  canonicalStringify,
  clone,
  digestValue,
  requireDigest,
  requireId,
  requireModuleId,
  requireText,
  requireIsoTime,
  parseSemver,
  compareSemver,
  bumpKind,
  boundedJson
} = require('./util');
const { createLocalAppendAdapter } = require('./local-append-adapter');
const { preparePatch, evaluatePatch } = require('./patch-operations');

const SNAPSHOT_SCHEMA = 'axm.module-evolution-ledger.snapshot/v1';
const VERSION_SCHEMA = 'axm.module-evolution-ledger.version-record/v1';
const KNOWN_GOOD_SCHEMA = 'axm.module-evolution-ledger.known-good-pointer/v1';
const PROPOSAL_SCHEMA = 'axm.module-evolution-ledger.patch-proposal/v1';
const ACTIVATION_SCHEMA = 'axm.module-evolution-ledger.activation/v1';
const POLICY_SCHEMA = 'axm.module-evolution-ledger.pacing-policy/v1';

const DEFAULT_POLICY = Object.freeze({
  schema: POLICY_SCHEMA,
  autonomousEnabled: false,
  minHoursBetweenProposals: 24,
  maxOpenProposalsPerModule: 1,
  allowedAutonomousBumps: ['patch'],
  mikeApprovedHotfixBypass: true,
  configuredAt: null,
  approvalRef: null
});

function sourceRefs(values) {
  if (values === undefined) return [];
  if (!Array.isArray(values) || values.length > 16) fail('INVALID_SOURCE_REFS', 'sourceRefs must contain at most 16 entries');
  return values.map((value, index) => requireText(value, `sourceRefs[${index}]`, 512));
}

function actor(kind, id) {
  return { kind: requireId(kind || 'local-user', 'actor kind'), id: requireText(id || 'local-user', 'actor id', 120) };
}

function emptyModule(moduleId) {
  return { moduleId, headRecordId: null, recordIds: [], knownGoodRecordId: null, knownGoodSelections: [], proposalIds: [], activationIds: [] };
}

function reduceEvents(events) {
  const state = {
    schema: SNAPSHOT_SCHEMA,
    revision: 0,
    headEventDigest: null,
    modules: {},
    versions: {},
    proposals: {},
    activations: {},
    pacingPolicy: clone(DEFAULT_POLICY)
  };

  for (const event of events) {
    const payload = event.payload;
    if (event.type === 'version.recorded') {
      const record = payload.record;
      if (!record || record.schema !== VERSION_SCHEMA) fail('EVENT_SEMANTICS', `Revision ${event.revision} contains an invalid version record`);
      const body = { ...record }; delete body.recordDigest;
      if (record.recordDigest !== digestValue(body)) fail('EVENT_SEMANTICS', `Revision ${event.revision} contains a changed version record`);
      if (state.versions[record.recordId]) fail('EVENT_SEMANTICS', `Duplicate version record ${record.recordId}`);
      const module = state.modules[record.moduleId] || emptyModule(record.moduleId);
      const expectedParent = module.headRecordId;
      if ((record.parentRecordId || null) !== expectedParent) fail('EVENT_SEMANTICS', `Version ${record.recordId} does not extend the module head`);
      const expectedAncestry = expectedParent ? [...state.versions[expectedParent].ancestry, expectedParent] : [];
      if (canonicalStringify(record.ancestry) !== canonicalStringify(expectedAncestry)) fail('EVENT_SEMANTICS', `Version ${record.recordId} ancestry is invalid`);
      if (expectedParent && compareSemver(record.semanticVersion, state.versions[expectedParent].semanticVersion) <= 0) fail('EVENT_SEMANTICS', `Version ${record.recordId} is not forward-moving`);
      if (module.recordIds.some(id => state.versions[id].semanticVersion === record.semanticVersion)) fail('EVENT_SEMANTICS', `Duplicate semantic version ${record.semanticVersion}`);
      state.versions[record.recordId] = clone(record);
      module.recordIds.push(record.recordId);
      module.headRecordId = record.recordId;
      state.modules[record.moduleId] = module;
    } else if (event.type === 'known-good.selected') {
      const pointer = payload.pointer;
      const record = pointer && state.versions[pointer.recordId];
      if (!pointer || pointer.schema !== KNOWN_GOOD_SCHEMA || !record || record.moduleId !== pointer.moduleId || record.recordDigest !== pointer.versionRecordDigest) {
        fail('EVENT_SEMANTICS', `Revision ${event.revision} contains an invalid known-good selection`);
      }
      const module = state.modules[pointer.moduleId];
      module.knownGoodRecordId = pointer.recordId;
      module.knownGoodSelections.push(clone(pointer));
    } else if (event.type === 'pacing-policy.configured') {
      if (!payload.policy || payload.policy.schema !== POLICY_SCHEMA || payload.policy.mikeApprovedHotfixBypass !== true) {
        fail('EVENT_SEMANTICS', `Revision ${event.revision} contains an invalid pacing policy`);
      }
      state.pacingPolicy = clone(payload.policy);
    } else if (event.type === 'proposal.staged') {
      const proposal = payload.proposal;
      const base = proposal && state.versions[proposal.baseRecordId];
      if (!proposal || proposal.schema !== PROPOSAL_SCHEMA || state.proposals[proposal.proposalId] || !base || base.moduleId !== proposal.moduleId) {
        fail('EVENT_SEMANTICS', `Revision ${event.revision} contains an invalid proposal`);
      }
      state.proposals[proposal.proposalId] = clone(proposal);
      state.modules[proposal.moduleId].proposalIds.push(proposal.proposalId);
    } else if (event.type === 'proposal.disposition-recorded') {
      const proposal = state.proposals[payload.proposalId];
      if (!proposal || proposal.state !== 'STAGED') fail('EVENT_SEMANTICS', `Revision ${event.revision} changes a missing or closed proposal`);
      proposal.state = payload.state;
      proposal.dispositionAt = event.at;
      proposal.dispositionRef = payload.authorityRef;
    } else if (event.type === 'activation.prepared') {
      const activation = payload.activation;
      if (!activation || activation.schema !== ACTIVATION_SCHEMA || state.activations[activation.attemptId]) fail('EVENT_SEMANTICS', `Revision ${event.revision} contains an invalid activation`);
      state.activations[activation.attemptId] = clone(activation);
      state.modules[activation.moduleId].activationIds.push(activation.attemptId);
    } else if (event.type === 'activation.started') {
      const activation = state.activations[payload.attemptId];
      if (!activation || activation.state !== 'PREPARED') fail('EVENT_SEMANTICS', `Revision ${event.revision} starts an activation from an invalid state`);
      activation.state = 'ACTIVATING';
      activation.startedAt = event.at;
      activation.installerAttemptRef = payload.installerAttemptRef;
    } else if (event.type === 'activation.observed') {
      const activation = state.activations[payload.attemptId];
      if (!activation || !['PREPARED', 'ACTIVATING'].includes(activation.state)) fail('EVENT_SEMANTICS', `Revision ${event.revision} observes an activation from an invalid state`);
      activation.state = payload.state;
      activation.observation = clone(payload.observation);
    } else if (event.type === 'activation.verification-recorded') {
      const activation = state.activations[payload.attemptId];
      if (!activation || activation.state !== 'AWAITING_VERIFICATION') fail('EVENT_SEMANTICS', `Revision ${event.revision} verifies an activation from an invalid state`);
      activation.state = payload.state;
      activation.verification = clone(payload.verification);
    } else if (event.type === 'activation.accepted') {
      const activation = state.activations[payload.attemptId];
      if (!activation || activation.state !== 'AWAITING_MIKE_ACCEPTANCE') fail('EVENT_SEMANTICS', `Revision ${event.revision} accepts an activation from an invalid state`);
      activation.state = 'ACCEPTED_AS_OBSERVED';
      activation.acceptedAt = event.at;
      activation.mikeAcceptanceRef = payload.approvalRef;
    } else if (event.type === 'activation.recovery-handoff-recorded') {
      const activation = state.activations[payload.attemptId];
      if (!activation || !['RECOVERY_HOLD', 'VERIFICATION_HOLD'].includes(activation.state)) fail('EVENT_SEMANTICS', `Revision ${event.revision} records a recovery handoff from an invalid state`);
      activation.state = 'RECOVERY_HANDOFF_RECORDED';
      activation.recoveryHandoff = clone(payload.handoff);
    } else {
      fail('EVENT_SEMANTICS', `Unsupported ledger event type ${event.type}`);
    }
    state.revision = event.revision;
    state.headEventDigest = event.eventDigest;
  }
  return state;
}

function createLedger(options = {}) {
  const storage = options.storage || createLocalAppendAdapter(options);
  const clock = typeof options.clock === 'function' ? options.clock : () => new Date().toISOString();
  const idFactory = typeof options.idFactory === 'function' ? options.idFactory : kind => `${kind}-${crypto.randomUUID()}`;

  function now() {
    return requireIsoTime(clock(), 'clock result');
  }

  function nextId(kind) {
    return requireId(idFactory(kind), `${kind} id`);
  }

  function readSnapshot() {
    const inspected = storage.inspect();
    const snapshot = reduceEvents(inspected.events);
    snapshot.storage = {
      schema: inspected.schema,
      stateRoot: inspected.stateRoot,
      writerLock: inspected.writerLock,
      ignoredPendingFiles: inspected.ignoredPendingFiles,
      guarantees: inspected.guarantees,
      limits: inspected.limits
    };
    return clone(snapshot);
  }

  function requireRevision(snapshot, expectedRevision) {
    if (!Number.isInteger(expectedRevision) || expectedRevision < 0) fail('EXPECTED_REVISION_REQUIRED', 'Every ledger write requires expectedRevision');
    if (snapshot.revision !== expectedRevision) fail('STALE_REVISION', `Expected ledger revision ${expectedRevision}, found ${snapshot.revision}`, { expectedRevision, actualRevision: snapshot.revision, headEventDigest: snapshot.headEventDigest });
  }

  function append(snapshot, input, type, payload, eventActor, at) {
    const event = storage.append({ expectedRevision: input.expectedRevision, eventId: nextId('event'), type, at, actor: eventActor, payload });
    return { event, snapshot: readSnapshot() };
  }

  function recordVersion(input) {
    const snapshot = readSnapshot();
    requireRevision(snapshot, input.expectedRevision);
    const moduleId = requireModuleId(input.moduleId);
    const semanticVersion = parseSemver(input.semanticVersion).raw;
    const contentDigest = requireDigest(input.contentDigest, 'contentDigest');
    const module = snapshot.modules[moduleId] || emptyModule(moduleId);
    const parentRecordId = input.parentRecordId === null || input.parentRecordId === undefined ? null : requireId(input.parentRecordId, 'parentRecordId');
    if (parentRecordId !== module.headRecordId) {
      fail('STALE_BASE', `Version parent ${parentRecordId || '<root>'} is not the current head ${module.headRecordId || '<root>'}`, { expectedParentRecordId: module.headRecordId, suppliedParentRecordId: parentRecordId });
    }
    if (parentRecordId && compareSemver(semanticVersion, snapshot.versions[parentRecordId].semanticVersion) <= 0) fail('NON_FORWARD_VERSION', 'A child semantic version must be greater than its parent');
    if (module.recordIds.some(id => snapshot.versions[id].semanticVersion === semanticVersion)) fail('DUPLICATE_VERSION', `${moduleId} already records ${semanticVersion}`);
    const recordId = requireId(input.recordId || nextId('version'), 'recordId');
    if (snapshot.versions[recordId]) fail('DUPLICATE_RECORD', `Version record ${recordId} already exists`);
    const recordKind = String(input.recordKind || 'candidate');
    if (!['baseline', 'candidate', 'observed-installed'].includes(recordKind)) fail('INVALID_RECORD_KIND', 'Unsupported version record kind');
    const createdAt = now();
    const ancestry = parentRecordId ? [...snapshot.versions[parentRecordId].ancestry, parentRecordId] : [];
    const body = {
      schema: VERSION_SCHEMA,
      recordId,
      moduleId,
      semanticVersion,
      contentDigest,
      parentRecordId,
      ancestry,
      recordKind,
      createdAt,
      createdBy: requireText(input.createdBy || 'local-user', 'createdBy', 120),
      sourceRefs: sourceRefs(input.sourceRefs),
      metadata: boundedJson(input.metadata || {}, 'version metadata', 32 * 1024)
    };
    const record = { ...body, recordDigest: digestValue(body) };
    const written = append(snapshot, input, 'version.recorded', { record }, actor(input.actorKind || 'local-user', input.createdBy || 'local-user'), createdAt);
    return { record: clone(record), revision: written.snapshot.revision, eventDigest: written.event.eventDigest };
  }

  function selectKnownGood(input) {
    const snapshot = readSnapshot();
    requireRevision(snapshot, input.expectedRevision);
    if (input.confirmation !== 'MIKE SELECTS KNOWN GOOD') fail('MIKE_CONFIRMATION_REQUIRED', 'Exact Mike known-good confirmation is required');
    const moduleId = requireModuleId(input.moduleId);
    const recordId = requireId(input.recordId, 'recordId');
    const record = snapshot.versions[recordId];
    if (!record || record.moduleId !== moduleId) fail('UNKNOWN_VERSION', 'Known-good selection must reference a version in the same module');
    const selectedAt = now();
    const pointer = {
      schema: KNOWN_GOOD_SCHEMA,
      moduleId,
      recordId,
      semanticVersion: record.semanticVersion,
      versionRecordDigest: record.recordDigest,
      selectedAt,
      selectedBy: 'Mike',
      approvalRef: requireText(input.approvalRef, 'approvalRef', 512),
      evidenceRefs: sourceRefs(input.evidenceRefs)
    };
    const written = append(snapshot, input, 'known-good.selected', { pointer }, actor('mike-approved', 'Mike'), selectedAt);
    return { pointer: clone(pointer), revision: written.snapshot.revision, eventDigest: written.event.eventDigest };
  }

  function configurePacingPolicy(input) {
    const snapshot = readSnapshot();
    requireRevision(snapshot, input.expectedRevision);
    if (input.confirmation !== 'MIKE CONFIGURES UPGRADE PACING') fail('MIKE_CONFIRMATION_REQUIRED', 'Exact Mike pacing-policy confirmation is required');
    const policyInput = input.policy || {};
    const allowed = Array.isArray(policyInput.allowedAutonomousBumps) ? Array.from(new Set(policyInput.allowedAutonomousBumps.map(String))) : ['patch'];
    if (!allowed.length || allowed.some(value => !['patch', 'minor', 'major'].includes(value))) fail('INVALID_PACING_POLICY', 'allowedAutonomousBumps contains an unsupported bump');
    const minHours = Number(policyInput.minHoursBetweenProposals);
    const maxOpen = Number(policyInput.maxOpenProposalsPerModule);
    if (!Number.isFinite(minHours) || minHours < 0 || minHours > 24 * 365) fail('INVALID_PACING_POLICY', 'minHoursBetweenProposals must be between 0 and 8760');
    if (!Number.isInteger(maxOpen) || maxOpen < 0 || maxOpen > 20) fail('INVALID_PACING_POLICY', 'maxOpenProposalsPerModule must be between 0 and 20');
    const configuredAt = now();
    const policy = {
      schema: POLICY_SCHEMA,
      autonomousEnabled: policyInput.autonomousEnabled === true,
      minHoursBetweenProposals: minHours,
      maxOpenProposalsPerModule: maxOpen,
      allowedAutonomousBumps: allowed.sort(),
      mikeApprovedHotfixBypass: true,
      configuredAt,
      approvalRef: requireText(input.approvalRef, 'approvalRef', 512)
    };
    const written = append(snapshot, input, 'pacing-policy.configured', { policy }, actor('mike-approved', 'Mike'), configuredAt);
    return { policy: clone(policy), revision: written.snapshot.revision, eventDigest: written.event.eventDigest };
  }

  function pacingDecision(snapshot, input, evaluationAt) {
    const mode = String(input.actorMode || 'autonomous');
    if (!['autonomous', 'mike-approved', 'mike-approved-hotfix'].includes(mode)) fail('INVALID_ACTOR_MODE', 'Unsupported proposal actorMode');
    if (mode === 'mike-approved-hotfix') {
      if (input.confirmation !== 'MIKE APPROVES HOTFIX PROPOSAL' || !String(input.approvalRef || '').trim()) fail('MIKE_CONFIRMATION_REQUIRED', 'Exact Mike hotfix confirmation and approvalRef are required');
      return { allowed: true, state: 'ALLOWED', reason: 'MIKE_APPROVED_HOTFIX_BYPASS', policyApplied: false };
    }
    if (mode === 'mike-approved') {
      if (input.confirmation !== 'MIKE APPROVES EVOLUTION PROPOSAL' || !String(input.approvalRef || '').trim()) fail('MIKE_CONFIRMATION_REQUIRED', 'Exact Mike proposal confirmation and approvalRef are required');
      return { allowed: true, state: 'ALLOWED', reason: 'MIKE_APPROVED', policyApplied: false };
    }
    const policy = snapshot.pacingPolicy;
    if (!policy.autonomousEnabled) return { allowed: false, state: 'PACING_HOLD', reason: 'AUTONOMY_DISABLED', policyApplied: true };
    if (!policy.allowedAutonomousBumps.includes(input.bumpKind)) return { allowed: false, state: 'PACING_HOLD', reason: 'BUMP_NOT_ALLOWED', policyApplied: true };
    const module = snapshot.modules[input.moduleId];
    const proposals = module.proposalIds.map(id => snapshot.proposals[id]);
    const open = proposals.filter(proposal => proposal.state === 'STAGED');
    if (open.length >= policy.maxOpenProposalsPerModule) return { allowed: false, state: 'PACING_HOLD', reason: 'MAX_OPEN_PROPOSALS', policyApplied: true };
    const autonomous = proposals.filter(proposal => proposal.actorMode === 'autonomous').sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    if (autonomous.length) {
      const elapsedHours = (Date.parse(evaluationAt) - Date.parse(autonomous[0].createdAt)) / 3600000;
      if (elapsedHours < policy.minHoursBetweenProposals) return { allowed: false, state: 'PACING_HOLD', reason: 'MIN_INTERVAL', policyApplied: true, retryAfter: new Date(Date.parse(autonomous[0].createdAt) + policy.minHoursBetweenProposals * 3600000).toISOString() };
    }
    return { allowed: true, state: 'ALLOWED', reason: 'AUTONOMOUS_POLICY_PASS', policyApplied: true };
  }

  function evaluatePacing(input) {
    const snapshot = readSnapshot();
    const moduleId = requireModuleId(input.moduleId);
    const module = snapshot.modules[moduleId];
    if (!module || !module.headRecordId) fail('UNKNOWN_MODULE', 'Pacing requires a recorded module head');
    const target = parseSemver(input.targetSemanticVersion).raw;
    const bump = bumpKind(snapshot.versions[module.headRecordId].semanticVersion, target);
    const evaluatedAt = requireIsoTime(input.at || now(), 'pacing evaluation time');
    return { schema: `${POLICY_SCHEMA}#decision`, moduleId, targetSemanticVersion: target, bumpKind: bump, evaluatedAt, ...pacingDecision(snapshot, { ...input, moduleId, bumpKind: bump }, evaluatedAt) };
  }

  function stagePatchProposal(input) {
    const snapshot = readSnapshot();
    requireRevision(snapshot, input.expectedRevision);
    const moduleId = requireModuleId(input.moduleId);
    const module = snapshot.modules[moduleId];
    if (!module || !module.headRecordId) fail('UNKNOWN_MODULE', 'Patch proposals require a recorded module');
    const baseRecordId = requireId(input.baseRecordId, 'baseRecordId');
    const baseRecord = snapshot.versions[baseRecordId];
    if (!baseRecord || baseRecord.moduleId !== moduleId) fail('UNKNOWN_VERSION', 'Patch base must belong to the target module');
    const patchPlan = preparePatch(input.baseDocument, input.operations);
    if (patchPlan.baseDocumentDigest !== baseRecord.contentDigest) fail('PATCH_BASE_DIGEST_MISMATCH', 'Patch base document does not match its immutable version record');
    const targetSemanticVersion = parseSemver(input.targetSemanticVersion).raw;
    const bump = bumpKind(snapshot.versions[module.headRecordId].semanticVersion, targetSemanticVersion);
    const createdAt = now();
    const decision = pacingDecision(snapshot, { ...input, moduleId, bumpKind: bump }, createdAt);
    if (!decision.allowed) return { schema: `${PROPOSAL_SCHEMA}#pacing-hold`, writePerformed: false, moduleId, targetSemanticVersion, decision, revision: snapshot.revision };
    const proposalId = requireId(input.proposalId || nextId('proposal'), 'proposalId');
    if (snapshot.proposals[proposalId]) fail('DUPLICATE_PROPOSAL', `Proposal ${proposalId} already exists`);
    const proposalActorMode = String(input.actorMode || 'autonomous');
    const proposal = {
      schema: PROPOSAL_SCHEMA,
      proposalId,
      moduleId,
      baseRecordId,
      baseSemanticVersion: baseRecord.semanticVersion,
      targetSemanticVersion,
      bumpKind: bump,
      patchPlan,
      actorMode: proposalActorMode,
      pacingDecision: decision,
      state: 'STAGED',
      createdAt,
      createdBy: requireText(input.createdBy || (proposalActorMode === 'autonomous' ? 'bounded-autonomy' : 'Mike'), 'createdBy', 120),
      approvalRef: input.approvalRef ? requireText(input.approvalRef, 'approvalRef', 512) : null,
      sourceRefs: sourceRefs(input.sourceRefs)
    };
    const written = append(snapshot, input, 'proposal.staged', { proposal }, actor(proposal.actorMode, proposal.createdBy), createdAt);
    return { proposal: clone(proposal), writePerformed: true, revision: written.snapshot.revision, eventDigest: written.event.eventDigest };
  }

  function evaluateProposalAgainstCurrent(input) {
    const snapshot = readSnapshot();
    const proposal = snapshot.proposals[requireId(input.proposalId, 'proposalId')];
    if (!proposal) fail('UNKNOWN_PROPOSAL', 'Proposal was not found');
    return evaluatePatch(input.baseDocument, input.currentDocument, proposal.patchPlan);
  }

  function recordProposalDisposition(input) {
    const snapshot = readSnapshot();
    requireRevision(snapshot, input.expectedRevision);
    if (input.confirmation !== 'RECORD PROPOSAL DISPOSITION') fail('EXACT_CONFIRMATION_REQUIRED', 'Exact proposal disposition confirmation is required');
    const proposalId = requireId(input.proposalId, 'proposalId');
    const proposal = snapshot.proposals[proposalId];
    if (!proposal || proposal.state !== 'STAGED') fail('INVALID_PROPOSAL_STATE', 'Only a staged proposal may receive a disposition');
    const state = String(input.state || '');
    if (!['HANDED_TO_MODULE_INSTALLER', 'WITHDRAWN', 'SUPERSEDED', 'REJECTED'].includes(state)) fail('INVALID_PROPOSAL_STATE', 'Unsupported proposal disposition');
    const at = now();
    const payload = { proposalId, state, authorityRef: requireText(input.authorityRef, 'authorityRef', 512) };
    const written = append(snapshot, input, 'proposal.disposition-recorded', payload, actor(input.actorKind || 'local-user', input.actorId || 'local-user'), at);
    return { proposal: clone(written.snapshot.proposals[proposalId]), revision: written.snapshot.revision, eventDigest: written.event.eventDigest };
  }

  function prepareActivation(input) {
    const snapshot = readSnapshot();
    requireRevision(snapshot, input.expectedRevision);
    if (input.confirmation !== 'MIKE APPROVES ACTIVATION RECORD') fail('MIKE_CONFIRMATION_REQUIRED', 'Exact Mike activation-record confirmation is required');
    const moduleId = requireModuleId(input.moduleId);
    const module = snapshot.modules[moduleId];
    const fromRecordId = requireId(input.fromRecordId, 'fromRecordId');
    const toRecordId = requireId(input.toRecordId, 'toRecordId');
    const from = snapshot.versions[fromRecordId];
    const to = snapshot.versions[toRecordId];
    if (!module || !from || !to || from.moduleId !== moduleId || to.moduleId !== moduleId) fail('UNKNOWN_VERSION', 'Activation records must belong to one recorded module');
    if (module.headRecordId !== toRecordId || to.parentRecordId !== fromRecordId) fail('STALE_BASE', 'Activation target must be the current head and directly extend the source record');
    if (module.knownGoodRecordId !== fromRecordId) fail('KNOWN_GOOD_SOURCE_REQUIRED', 'Activation source must be the selected known-good record');
    const preparedAt = now();
    const attemptId = requireId(input.attemptId || nextId('activation'), 'attemptId');
    if (snapshot.activations[attemptId]) fail('DUPLICATE_ACTIVATION', `Activation ${attemptId} already exists`);
    const activation = {
      schema: ACTIVATION_SCHEMA,
      attemptId,
      moduleId,
      fromRecordId,
      toRecordId,
      sourceDigest: from.contentDigest,
      targetDigest: to.contentDigest,
      installerCandidateId: requireText(input.installerCandidateId, 'installerCandidateId', 256),
      installerReviewRef: requireText(input.installerReviewRef, 'installerReviewRef', 512),
      recoverySnapshotRef: requireText(input.recoverySnapshotRef, 'recoverySnapshotRef', 512),
      mikeApprovalRef: requireText(input.mikeApprovalRef, 'mikeApprovalRef', 512),
      state: 'PREPARED',
      preparedAt,
      preparedBy: 'Mike',
      startedAt: null,
      installerAttemptRef: null,
      observation: null,
      verification: null,
      recoveryHandoff: null,
      authorityMap: {
        fileWriteAndInstall: 'module-installer',
        verification: 'verification-spine-and-specialists',
        snapshotRestoreRollback: 'recovery-center',
        ledger: 'facts-and-holds-only'
      }
    };
    const written = append(snapshot, input, 'activation.prepared', { activation }, actor('mike-approved', 'Mike'), preparedAt);
    return { activation: clone(activation), revision: written.snapshot.revision, eventDigest: written.event.eventDigest };
  }

  function markActivationStarted(input) {
    const snapshot = readSnapshot();
    requireRevision(snapshot, input.expectedRevision);
    if (input.confirmation !== 'RECORD MODULE INSTALLER ATTEMPT') fail('EXACT_CONFIRMATION_REQUIRED', 'Exact installer-attempt recording confirmation is required');
    const attemptId = requireId(input.attemptId, 'attemptId');
    const activation = snapshot.activations[attemptId];
    if (!activation || activation.state !== 'PREPARED') fail('INVALID_ACTIVATION_STATE', 'Only a prepared activation can be marked started');
    const at = now();
    const payload = { attemptId, installerAttemptRef: requireText(input.installerAttemptRef, 'installerAttemptRef', 512) };
    const written = append(snapshot, input, 'activation.started', payload, actor('module-installer-observer', input.actorId || 'module-installer'), at);
    return { activation: clone(written.snapshot.activations[attemptId]), revision: written.snapshot.revision, eventDigest: written.event.eventDigest };
  }

  function inspectInterruptedActivations() {
    const snapshot = readSnapshot();
    const activations = Object.values(snapshot.activations).filter(item => ['PREPARED', 'ACTIVATING'].includes(item.state)).map(item => ({
      schema: `${ACTIVATION_SCHEMA}#interrupted-hold`,
      attemptId: item.attemptId,
      moduleId: item.moduleId,
      persistedState: item.state,
      effectiveState: 'INTERRUPTED_HOLD',
      sourceDigest: item.sourceDigest,
      targetDigest: item.targetDigest,
      recoverySnapshotRef: item.recoverySnapshotRef,
      allowedNextActions: ['record-external-state-observation', 'request-explicit-recovery-center-review'],
      automaticInstallPerformed: false,
      automaticRollbackPerformed: false
    }));
    return { schema: `${ACTIVATION_SCHEMA}#interrupted-inspection`, revision: snapshot.revision, activations };
  }

  function recordActivationObservation(input) {
    const snapshot = readSnapshot();
    requireRevision(snapshot, input.expectedRevision);
    if (input.confirmation !== 'RECORD ACTIVATION OBSERVATION') fail('EXACT_CONFIRMATION_REQUIRED', 'Exact activation-observation confirmation is required');
    const attemptId = requireId(input.attemptId, 'attemptId');
    const activation = snapshot.activations[attemptId];
    if (!activation || !['PREPARED', 'ACTIVATING'].includes(activation.state)) fail('INVALID_ACTIVATION_STATE', 'Activation observation is only valid while prepared or activating');
    const observedDigest = requireDigest(input.observedDigest, 'observedDigest');
    const observedAt = now();
    const state = observedDigest === activation.targetDigest ? 'AWAITING_VERIFICATION' : observedDigest === activation.sourceDigest ? 'NOT_APPLIED' : 'RECOVERY_HOLD';
    const observation = { observedDigest, observedAt, observationRef: requireText(input.observationRef, 'observationRef', 512), interpretation: state };
    const written = append(snapshot, input, 'activation.observed', { attemptId, state, observation }, actor('external-state-observer', input.actorId || 'local-user'), observedAt);
    return { activation: clone(written.snapshot.activations[attemptId]), revision: written.snapshot.revision, eventDigest: written.event.eventDigest };
  }

  function recordActivationVerification(input) {
    const snapshot = readSnapshot();
    requireRevision(snapshot, input.expectedRevision);
    if (input.confirmation !== 'RECORD VERIFICATION EVIDENCE') fail('EXACT_CONFIRMATION_REQUIRED', 'Exact verification-evidence confirmation is required');
    const attemptId = requireId(input.attemptId, 'attemptId');
    const activation = snapshot.activations[attemptId];
    if (!activation || activation.state !== 'AWAITING_VERIFICATION') fail('INVALID_ACTIVATION_STATE', 'Verification evidence requires an observed target digest');
    const verdict = String(input.verdict || '').toUpperCase();
    if (!['PASS', 'FAIL', 'HELD'].includes(verdict)) fail('INVALID_VERIFICATION_VERDICT', 'Verification verdict must be PASS, FAIL, or HELD');
    const at = now();
    const state = verdict === 'PASS' ? 'AWAITING_MIKE_ACCEPTANCE' : 'VERIFICATION_HOLD';
    const verification = { verdict, receiptRef: requireText(input.verificationReceiptRef, 'verificationReceiptRef', 512), recordedAt: at, permissionGranted: false };
    const written = append(snapshot, input, 'activation.verification-recorded', { attemptId, state, verification }, actor('verification-evidence-observer', input.actorId || 'verification-spine'), at);
    return { activation: clone(written.snapshot.activations[attemptId]), revision: written.snapshot.revision, eventDigest: written.event.eventDigest };
  }

  function acceptActivationRecord(input) {
    const snapshot = readSnapshot();
    requireRevision(snapshot, input.expectedRevision);
    if (input.confirmation !== 'MIKE ACCEPTS ACTIVATION RECORD') fail('MIKE_CONFIRMATION_REQUIRED', 'Exact Mike activation acceptance is required');
    const attemptId = requireId(input.attemptId, 'attemptId');
    const activation = snapshot.activations[attemptId];
    if (!activation || activation.state !== 'AWAITING_MIKE_ACCEPTANCE') fail('INVALID_ACTIVATION_STATE', 'Only a verified observation can be accepted');
    const at = now();
    const approvalRef = requireText(input.approvalRef, 'approvalRef', 512);
    const written = append(snapshot, input, 'activation.accepted', { attemptId, approvalRef }, actor('mike-approved', 'Mike'), at);
    return { activation: clone(written.snapshot.activations[attemptId]), revision: written.snapshot.revision, eventDigest: written.event.eventDigest };
  }

  function recordRecoveryCenterHandoff(input) {
    const snapshot = readSnapshot();
    requireRevision(snapshot, input.expectedRevision);
    if (input.confirmation !== 'MIKE REQUESTS RECOVERY REVIEW') fail('MIKE_CONFIRMATION_REQUIRED', 'Exact Mike recovery-review confirmation is required');
    const attemptId = requireId(input.attemptId, 'attemptId');
    const activation = snapshot.activations[attemptId];
    if (!activation || !['RECOVERY_HOLD', 'VERIFICATION_HOLD'].includes(activation.state)) fail('INVALID_ACTIVATION_STATE', 'Recovery handoff requires an explicit recovery or verification hold');
    const at = now();
    const handoff = {
      schema: 'axm.module-evolution-ledger.recovery-center-handoff/v1',
      attemptId,
      moduleId: activation.moduleId,
      recoverySnapshotRef: activation.recoverySnapshotRef,
      sourceDigest: activation.sourceDigest,
      targetDigest: activation.targetDigest,
      observedDigest: activation.observation && activation.observation.observedDigest,
      requestedAction: 'review-recovery-options',
      authority: 'recovery-center',
      actionPerformed: false,
      requestedAt: at,
      approvalRef: requireText(input.approvalRef, 'approvalRef', 512)
    };
    const written = append(snapshot, input, 'activation.recovery-handoff-recorded', { attemptId, handoff }, actor('mike-approved', 'Mike'), at);
    return { handoff: clone(handoff), activation: clone(written.snapshot.activations[attemptId]), revision: written.snapshot.revision, eventDigest: written.event.eventDigest };
  }

  function authorityStatement() {
    return {
      schema: 'axm.module-evolution-ledger.authority-statement/v1',
      grants: ['append-local-ledger-facts', 'evaluate-bounded-json-patches', 'derive-pacing-holds', 'emit-authority-handoffs'],
      refuses: ['module-file-write', 'install', 'promotion', 'rollback', 'restore', 'network-research', 'provider-execution', 'canon-mutation', 'permission-grant', 'verification-as-permission'],
      storageRoot: storage.stateRoot
    };
  }

  return {
    schemas: { SNAPSHOT_SCHEMA, VERSION_SCHEMA, KNOWN_GOOD_SCHEMA, PROPOSAL_SCHEMA, ACTIVATION_SCHEMA, POLICY_SCHEMA },
    readSnapshot,
    recordVersion,
    selectKnownGood,
    configurePacingPolicy,
    evaluatePacing,
    stagePatchProposal,
    evaluateProposalAgainstCurrent,
    recordProposalDisposition,
    prepareActivation,
    markActivationStarted,
    inspectInterruptedActivations,
    recordActivationObservation,
    recordActivationVerification,
    acceptActivationRecord,
    recordRecoveryCenterHandoff,
    authorityStatement
  };
}

module.exports = {
  SNAPSHOT_SCHEMA,
  VERSION_SCHEMA,
  KNOWN_GOOD_SCHEMA,
  PROPOSAL_SCHEMA,
  ACTIVATION_SCHEMA,
  POLICY_SCHEMA,
  DEFAULT_POLICY,
  createLedger,
  preparePatch,
  evaluatePatch,
  digestDocument: digestValue
};
