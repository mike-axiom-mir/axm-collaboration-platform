'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Episode = require('./session-episode');

const SCHEMA = 'axm.mirror.workshop-action-feed/v1';
const SETTINGS_SCHEMA = 'axm.mirror.workshop-action-feed-settings/v1';
const DEFAULTS = Object.freeze({
  schema: SETTINGS_SCHEMA,
  enabled: false,
  packageDefault: false,
  approvalMode: 'explicit-local-opt-in',
  reviewer: 'policy:local-human-steward',
  updatedAt: null,
  updatedBy: null
});

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((out, key) => { out[key] = stable(value[key]); return out; }, {});
}

function digest(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function clean(value, maximum = 1000) {
  return String(value == null ? '' : value).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, maximum);
}

function safeName(value) {
  return clean(value, 120).toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'unknown';
}

function actorOf(value) {
  value = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    id: clean(value.id || value.actor_id, 100) || 'unknown',
    kind: clean(value.kind || value.actor_kind, 60).toLowerCase() || 'unknown',
    name: clean(value.name || value.displayName || value.display_name || value.id || value.actor_id, 120) || 'Unknown'
  };
}

function locations(options = {}) {
  const root = path.resolve(options.root || path.resolve(__dirname, '..'));
  const stateDir = path.resolve(options.stateDir || path.join(root, 'state', 'action-lesson-feed'));
  return {
    root,
    stateDir,
    settingsFile: path.resolve(options.settingsFile || path.join(stateDir, 'settings.json')),
    journalFile: path.resolve(options.journalFile || path.join(stateDir, 'events.jsonl')),
    episodeDir: path.resolve(options.episodeDir || path.join(root, 'training', 'datasets', 'episodes'))
  };
}

function atomicJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(stable(value), null, 2) + '\n', 'utf8');
  fs.renameSync(temporary, file);
}

function readSettings(options = {}) {
  const place = locations(options);
  let stored = {};
  try { stored = JSON.parse(fs.readFileSync(place.settingsFile, 'utf8')); } catch (_) {}
  if (stored.schema && stored.schema !== SETTINGS_SCHEMA) throw new Error('unsupported Workshop action feed settings schema');
  return Object.assign({}, DEFAULTS, stored, { enabled: stored.enabled === true, packageDefault: false });
}

function configure(input = {}, options = {}) {
  const place = locations(options);
  const actor = actorOf(input.actor);
  if (actor.kind !== 'human') throw new Error('only an explicit human steward may change Workshop action lesson intake');
  if (typeof input.enabled !== 'boolean') throw new Error('enabled must be true or false');
  const settings = {
    schema: SETTINGS_SCHEMA,
    enabled: input.enabled,
    packageDefault: false,
    approvalMode: 'explicit-local-opt-in',
    reviewer: `human:${actor.id}`,
    updatedAt: new Date().toISOString(),
    updatedBy: actor
  };
  atomicJson(place.settingsFile, settings);
  appendJournal(place, { event: 'SETTING_CHANGED', enabled: settings.enabled, actor: actor.id });
  return settings;
}

function appendJournal(place, event) {
  fs.mkdirSync(place.stateDir, { recursive: true });
  const record = Object.assign({ schema: SCHEMA, at: new Date().toISOString() }, event);
  fs.appendFileSync(place.journalFile, JSON.stringify(stable(record)) + '\n', 'utf8');
}

function journalCounts(file) {
  const counts = { received: 0, accepted: 0, ignored: 0, refused: 0, settingsChanges: 0 };
  let lines = [];
  try { lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean); } catch (_) {}
  for (const line of lines) {
    let event;
    try { event = JSON.parse(line).event; } catch (_) { continue; }
    if (event === 'ACTION_RECEIVED') counts.received += 1;
    if (event === 'LESSON_ACCEPTED' || event === 'LESSON_REUSED') counts.accepted += 1;
    if (event === 'ACTION_IGNORED_OPTED_OUT') counts.ignored += 1;
    if (event === 'ACTION_REFUSED') counts.refused += 1;
    if (event === 'SETTING_CHANGED') counts.settingsChanges += 1;
  }
  return counts;
}

function approvedLessonCount(directory) {
  let count = 0;
  try {
    for (const name of fs.readdirSync(directory).filter(name => name.endsWith('.json'))) {
      try {
        const episode = JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8'));
        if (episode.source && episode.source.capturedBy === 'workshop-action-lesson-feed' && episode.review && episode.review.state === 'APPROVED') count += 1;
      } catch (_) {}
    }
  } catch (_) {}
  return count;
}

function status(options = {}) {
  const place = locations(options);
  const settings = readSettings(options);
  return {
    ok: true,
    schema: SCHEMA,
    state: settings.enabled ? 'OPTED_IN' : 'OPTED_OUT',
    enabled: settings.enabled,
    packageDefault: false,
    approvalMode: settings.approvalMode,
    updatedAt: settings.updatedAt,
    updatedBy: settings.updatedBy,
    lessons: { approved: approvedLessonCount(place.episodeDir) },
    events: journalCounts(place.journalFile),
    privacy: {
      rawInputsStored: false,
      rawOutputsStored: false,
      promptsStored: false,
      receiptsOnly: true
    },
    training: 'Lessons enter the reviewed private corpus. They do not trigger training, runtime promotion, canon, or authority by themselves.'
  };
}

function evidenceLines(value) {
  const output = [];
  for (const item of (Array.isArray(value) ? value : []).slice(0, 32)) {
    if (typeof item === 'string') {
      const line = clean(item, 800);
      if (line) output.push(line);
      continue;
    }
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const parts = [];
    for (const key of ['id', 'kind', 'status', 'statement', 'sha256']) {
      const part = clean(item[key], key === 'statement' ? 700 : 160);
      if (part) parts.push(`${key}=${part}`);
    }
    if (parts.length) output.push(parts.join('; '));
  }
  return output;
}

function validateAction(action) {
  if (!action || typeof action !== 'object' || Array.isArray(action)) throw new Error('Workshop action receipt must be an object');
  if (action.schema !== 'axm.action/v1') throw new Error('unsupported Workshop action schema');
  if (!['COMPLETE', 'FAILED'].includes(action.state)) throw new Error('only completed or failed Workshop actions may become lessons');
  if (!action.approval || action.approval.decision !== 'APPROVED') throw new Error('Workshop action lesson requires explicit approval');
  if (!action.receipt || typeof action.receipt.ok !== 'boolean') throw new Error('Workshop action lesson requires an outcome receipt');
  if ((action.state === 'COMPLETE') !== action.receipt.ok) throw new Error('Workshop action state contradicts its receipt');
  const tool = clean(action.tool, 100);
  const operation = clean(action.operation, 100);
  const actionId = clean(action.id, 160);
  const evidence = evidenceLines(action.receipt.evidence);
  if (!tool || !operation || !actionId) throw new Error('Workshop action id, tool, and operation are required');
  if (!evidence.length) throw new Error('Workshop action lesson requires inspectable receipt evidence');
  const originActor = actorOf(action.actor);
  const approvalActor = actorOf(action.approval.actor);
  const receiptActor = actorOf(action.receipt.actor);
  if ([originActor, approvalActor, receiptActor].some(actor => actor.id === 'unknown' || actor.kind === 'unknown')) throw new Error('Workshop action lesson requires attributed request, approval, and receipt actors');
  return { actionId, tool, operation, evidence, originActor, approvalActor, receiptActor };
}

function makeEpisode(action, facts, settings) {
  const success = action.receipt.ok === true;
  const actionDigest = digest({
    schema: action.schema,
    id: facts.actionId,
    name: clean(action.name, 160),
    tool: facts.tool,
    operation: facts.operation,
    requestedPermission: clean(action.requestedPermission, 100),
    state: action.state,
    actors: [facts.originActor, facts.approvalActor, facts.receiptActor],
    approval: { decision: action.approval.decision, reason: clean(action.approval.reason, 500) },
    receipt: { ok: success, evidence: facts.evidence, error: clean(action.receipt.error, 500) }
  });
  const episode = Episode.normalize({
    schema: Episode.SCHEMA,
    episodeId: `episode-workshop-action-${actionDigest.slice(0, 20)}`,
    groupId: `workshop-action/${safeName(facts.tool)}/${safeName(facts.operation)}`,
    source: {
      provider: 'axm-workshop-local',
      model: `workshop-action-receipt/${safeName(facts.originActor.kind)}`,
      sessionRef: facts.actionId,
      usePermission: 'allowed',
      permissionBasis: `Explicit local Workshop action-feed opt-in by ${settings.reviewer}; package default is off.`,
      capturedBy: 'workshop-action-lesson-feed'
    },
    goal: `${clean(action.name, 160) || 'Workshop action'}: ${facts.tool}/${facts.operation}`,
    observations: [
      `${facts.originActor.name} (${facts.originActor.kind}) requested the bounded action.`,
      `${facts.approvalActor.name} explicitly approved it${clean(action.approval.reason, 500) ? `: ${clean(action.approval.reason, 500)}` : '.'}`,
      `The attributed receipt reported ${action.state}.`
    ],
    evidenceRefs: facts.evidence.map(line => `receipt://${facts.actionId}#${line}`),
    candidates: [
      'Attempt the explicitly approved bounded action and require an outcome receipt.',
      'Hold or repair when permission, execution, evidence, or quality is insufficient.'
    ],
    decision: success ? 'Record the evidence-backed completion as a candidate lesson.' : 'Preserve the failure and route it toward repair instead of calling it complete.',
    outcome: success ? 'The approved action completed according to its attributed receipt.' : `The approved action failed according to its attributed receipt: ${clean(action.receipt.error, 500) || 'no additional error detail supplied'}`,
    verification: facts.evidence.map(line => `Receipt evidence: ${line}`),
    repairs: success ? ['Keep later use bounded by the same permission and evidence requirements.'] : [`Repair ${facts.tool}/${facts.operation}; do not promote this failure as success.`],
    limitations: [
      'Raw action inputs, prompts, proposals, and outputs were deliberately excluded from the learning feed.',
      'The service receipt is attributed evidence, not independent proof of quality or general capability.',
      'Admission to the private corpus grants no runtime, tool, canon, identity, or authority promotion.'
    ]
  });
  return { episode, actionDigest };
}

function ingest(action, options = {}) {
  const place = locations(options);
  const settings = readSettings(options);
  if (!settings.enabled) return { ok: true, accepted: false, state: 'OPTED_OUT', reason: 'Workshop action lesson intake is disabled.' };
  appendJournal(place, { event: 'ACTION_RECEIVED', actionDigest: digest({ schema: action && action.schema, id: action && action.id }) });
  let facts;
  try { facts = validateAction(action); }
  catch (error) {
    appendJournal(place, { event: 'ACTION_REFUSED', actionDigest: digest({ schema: action && action.schema, id: action && action.id }), reason: clean(error.message, 300) });
    throw error;
  }
  const made = makeEpisode(action, facts, settings);
  const approved = Episode.approve(made.episode, {
    reviewer: settings.reviewer,
    statement: 'Admitted by explicit local opt-in from a completed or failed attributed AXM action receipt. Raw inputs and outputs were excluded.',
    expectedDigest: made.episode.digest,
    reviewedAt: null
  });
  fs.mkdirSync(place.episodeDir, { recursive: true });
  const file = path.join(place.episodeDir, `${approved.episodeId}.json`);
  if (fs.existsSync(file)) {
    const existing = JSON.parse(fs.readFileSync(file, 'utf8'));
    Episode.verify(existing);
    if (existing.digest !== approved.digest || existing.source.sessionRef !== facts.actionId) throw new Error('Workshop action lesson identity collision refuses overwrite');
    appendJournal(place, { event: 'LESSON_REUSED', actionDigest: made.actionDigest, episodeId: approved.episodeId });
    return { ok: true, accepted: true, state: 'REUSED_EQUIVALENT_LESSON', episodeId: approved.episodeId, digest: approved.digest };
  }
  atomicJson(file, approved);
  appendJournal(place, { event: 'LESSON_ACCEPTED', actionDigest: made.actionDigest, episodeId: approved.episodeId });
  return { ok: true, accepted: true, state: 'ADMITTED_PRIVATE_LESSON', episodeId: approved.episodeId, digest: approved.digest };
}

module.exports = { SCHEMA, SETTINGS_SCHEMA, DEFAULTS, readSettings, configure, status, ingest, validateAction, makeEpisode };
