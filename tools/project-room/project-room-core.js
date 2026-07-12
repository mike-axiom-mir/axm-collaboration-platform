(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ProjectRoomCore = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var FORMAT = 'axm.project-room/v1';
  var VERSION = 2;
  var STAGES = ['ideas', 'next', 'building', 'testing', 'done'];
  var PROJECT_STATUSES = ['planning', 'active', 'paused', 'review', 'complete'];

  function now() { return new Date().toISOString(); }
  function id(prefix) { return (prefix || 'item') + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8); }
  function text(value, max) { var out = String(value == null ? '' : value).trim(); return max ? out.slice(0, max) : out; }
  function date(value) { var candidate = text(value, 30); return /^\d{4}-\d{2}-\d{2}$/.test(candidate) ? candidate : ''; }
  function time(value) { var candidate = text(value, 10); return /^\d{2}:\d{2}$/.test(candidate) ? candidate : ''; }
  function choice(value, allowed, fallback) { return allowed.indexOf(value) >= 0 ? value : fallback; }
  function lines(value, cap) {
    var input = Array.isArray(value) ? value : String(value || '').split(/\r?\n/);
    return input.map(function (line) { return text(line, 1000); }).filter(Boolean).slice(0, cap || 100);
  }
  function list(input, normalizer, cap) {
    return (Array.isArray(input) ? input : []).map(normalizer).filter(function (item) { return item && item.title; }).slice(0, cap || 2000);
  }
  function stamp(input, fallback) { return text(input, 40) || fallback || now(); }

  function emptyRoom() {
    var at = now();
    return {
      format: FORMAT, version: VERSION,
      project: { title: 'Untitled project', summary: '', status: 'planning', lead: '', createdAt: at, updatedAt: at },
      cards: [], goals: [], milestones: [], decisions: [], documents: [], messages: [], events: [], forms: [], reviews: [], activity: [], versions: [],
      updatedAt: at
    };
  }
  function normalizeProject(input) {
    input = input || {};
    return {
      title: text(input.title, 160) || 'Untitled project', summary: text(input.summary, 10000),
      status: choice(input.status, PROJECT_STATUSES, 'planning'), lead: text(input.lead, 120),
      createdAt: stamp(input.createdAt), updatedAt: stamp(input.updatedAt)
    };
  }
  function normalizeCard(input) {
    input = input || {};
    var stage = choice(input.stage, STAGES, 'ideas');
    var evidence = lines(input.evidence, 50);
    if (stage === 'done' && !evidence.length) stage = 'testing';
    return {
      id: text(input.id, 100) || id('card'), title: text(input.title, 120), description: text(input.description, 5000), stage: stage,
      ownerType: choice(input.ownerType, ['human', 'ai', 'shared', 'unassigned'], 'unassigned'), ownerName: text(input.ownerName, 100),
      goalId: text(input.goalId, 100), milestoneId: text(input.milestoneId, 100), dueDate: date(input.dueDate), evidence: evidence,
      createdAt: stamp(input.createdAt), updatedAt: stamp(input.updatedAt), completedAt: stage === 'done' ? stamp(input.completedAt) : ''
    };
  }
  function normalizeGoal(input) {
    input = input || {};
    return { id: text(input.id, 100) || id('goal'), title: text(input.title, 120), outcome: text(input.outcome, 2000), targetDate: date(input.targetDate), createdAt: stamp(input.createdAt) };
  }
  function normalizeMilestone(input) {
    input = input || {};
    return { id: text(input.id, 100) || id('milestone'), title: text(input.title, 120), goalId: text(input.goalId, 100), targetDate: date(input.targetDate), createdAt: stamp(input.createdAt) };
  }
  function normalizeDecision(input) {
    input = input || {};
    return { id: text(input.id, 100) || id('decision'), title: text(input.title, 160), choice: text(input.choice, 3000), reason: text(input.reason, 5000), owner: text(input.owner, 120), decidedOn: date(input.decidedOn), createdAt: stamp(input.createdAt) };
  }
  function normalizeDocument(input) {
    input = input || {};
    return { id: text(input.id, 100) || id('doc'), title: text(input.title, 160), kind: choice(input.kind, ['note', 'brief', 'wiki', 'spec'], 'note'), body: text(input.body, 50000), updatedAt: stamp(input.updatedAt), createdAt: stamp(input.createdAt) };
  }
  function normalizeMessage(input) {
    input = input || {};
    return { id: text(input.id, 100) || id('message'), title: text(input.title || 'Update', 160), body: text(input.body, 10000), authorType: choice(input.authorType, ['human', 'ai', 'shared'], 'human'), authorName: text(input.authorName, 120), createdAt: stamp(input.createdAt) };
  }
  function normalizeEvent(input) {
    input = input || {};
    return { id: text(input.id, 100) || id('event'), title: text(input.title, 160), date: date(input.date), time: time(input.time), note: text(input.note, 3000), createdAt: stamp(input.createdAt) };
  }
  function normalizeForm(input) {
    input = input || {};
    return { id: text(input.id, 100) || id('form'), title: text(input.title, 160), prompt: text(input.prompt, 5000), response: text(input.response, 10000), status: choice(input.status, ['open', 'answered', 'closed'], 'open'), createdAt: stamp(input.createdAt), updatedAt: stamp(input.updatedAt) };
  }
  function normalizeReview(input) {
    input = input || {};
    return { id: text(input.id, 100) || id('review'), title: text(input.title, 160), kind: choice(input.kind, ['daily', 'review', 'evidence'], 'review'), body: text(input.body, 10000), verdict: choice(input.verdict, ['note', 'pass', 'warn', 'fail'], 'note'), cardId: text(input.cardId, 100), createdAt: stamp(input.createdAt) };
  }
  function normalizeActivity(input) {
    input = input || {};
    return { id: text(input.id, 100) || id('activity'), title: text(input.title || input.message, 500), kind: text(input.kind, 60) || 'change', actor: text(input.actor, 120), createdAt: stamp(input.createdAt) };
  }
  function normalizeVersion(input) {
    input = input || {};
    return { id: text(input.id, 100) || id('version'), title: text(input.title, 160) || 'Checkpoint', note: text(input.note, 2000), createdAt: stamp(input.createdAt), snapshot: input.snapshot && typeof input.snapshot === 'object' ? JSON.parse(JSON.stringify(input.snapshot)) : null };
  }

  function normalizeRoom(input) {
    if (!input || (input.format && input.format !== FORMAT)) throw new Error('This is not an AXM Project Room file.');
    var room = emptyRoom();
    room.project = normalizeProject(input.project || { title: input.name || 'Untitled project' });
    room.goals = list(input.goals, normalizeGoal, 500);
    room.milestones = list(input.milestones, normalizeMilestone, 1000);
    room.cards = list(input.cards, normalizeCard, 5000);
    room.decisions = list(input.decisions, normalizeDecision, 2000);
    room.documents = list(input.documents, normalizeDocument, 1000);
    room.messages = list(input.messages, normalizeMessage, 5000);
    room.events = list(input.events, normalizeEvent, 2000);
    room.forms = list(input.forms, normalizeForm, 1000);
    room.reviews = list(input.reviews, normalizeReview, 3000);
    room.activity = (Array.isArray(input.activity) ? input.activity : []).map(normalizeActivity).filter(function (item) { return item.title; }).slice(-5000);
    room.versions = (Array.isArray(input.versions) ? input.versions : []).map(normalizeVersion).filter(function (item) { return item.snapshot; }).slice(-50);

    var goalIds = room.goals.map(function (g) { return g.id; });
    var milestoneIds = room.milestones.map(function (m) { return m.id; });
    var cardIds = room.cards.map(function (c) { return c.id; });
    room.milestones.forEach(function (m) { if (goalIds.indexOf(m.goalId) < 0) m.goalId = ''; });
    room.cards.forEach(function (c) { if (goalIds.indexOf(c.goalId) < 0) c.goalId = ''; if (milestoneIds.indexOf(c.milestoneId) < 0) c.milestoneId = ''; });
    room.reviews.forEach(function (review) { if (cardIds.indexOf(review.cardId) < 0) review.cardId = ''; });
    room.version = VERSION; room.updatedAt = now(); room.project.updatedAt = room.updatedAt;
    return room;
  }

  function moveCard(card, targetStage) {
    if (!card) return { ok: false, error: 'Card not found.' };
    if (STAGES.indexOf(targetStage) < 0) return { ok: false, error: 'Unknown board column.' };
    if (targetStage === 'done' && (!Array.isArray(card.evidence) || !card.evidence.length)) return { ok: false, error: 'Add at least one evidence line before moving this card to Done.' };
    card.stage = targetStage; card.updatedAt = now(); card.completedAt = targetStage === 'done' ? now() : '';
    return { ok: true, card: card };
  }
  function timeline(room) {
    var items = [];
    room.goals.forEach(function (g) { if (g.targetDate) items.push({ date: g.targetDate, time: '', kind: 'Goal', title: g.title, id: g.id }); });
    room.milestones.forEach(function (m) { if (m.targetDate) items.push({ date: m.targetDate, time: '', kind: 'Milestone', title: m.title, id: m.id }); });
    room.cards.forEach(function (c) { if (c.dueDate && c.stage !== 'done') items.push({ date: c.dueDate, time: '', kind: 'Task', title: c.title, id: c.id }); });
    room.events.forEach(function (e) { if (e.date) items.push({ date: e.date, time: e.time, kind: 'Event', title: e.title, id: e.id }); });
    room.decisions.forEach(function (d) { if (d.decidedOn) items.push({ date: d.decidedOn, time: '', kind: 'Decision', title: d.title, id: d.id }); });
    return items.sort(function (a, b) { return a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || '') || a.kind.localeCompare(b.kind); });
  }
  function appendActivity(room, kind, title, actor) {
    room.activity.push(normalizeActivity({ kind: kind, title: title, actor: actor || 'local user', createdAt: now() }));
    if (room.activity.length > 5000) room.activity = room.activity.slice(-5000);
  }
  function snapshot(room) {
    var copy = JSON.parse(JSON.stringify(room));
    copy.versions = [];
    return copy;
  }
  function createVersion(room, title, note) {
    var version = normalizeVersion({ title: title || 'Checkpoint', note: note, createdAt: now(), snapshot: snapshot(room) });
    room.versions.push(version); if (room.versions.length > 50) room.versions = room.versions.slice(-50);
    appendActivity(room, 'version', 'Checkpoint created: ' + version.title);
    return version;
  }
  function restoreVersion(room, versionId) {
    var version = room.versions.find(function (candidate) { return candidate.id === versionId; });
    if (!version || !version.snapshot) return { ok: false, error: 'Checkpoint not found.' };
    var history = JSON.parse(JSON.stringify(room.versions));
    var restored = normalizeRoom(version.snapshot);
    restored.versions = history;
    appendActivity(restored, 'restore', 'Restored checkpoint: ' + version.title);
    return { ok: true, room: restored, version: version };
  }
  function summary(room) {
    return {
      cards: room.cards.length, openCards: room.cards.filter(function (c) { return c.stage !== 'done'; }).length,
      doneCards: room.cards.filter(function (c) { return c.stage === 'done'; }).length,
      goals: room.goals.length, milestones: room.milestones.length, decisions: room.decisions.length,
      documents: room.documents.length, messages: room.messages.length, events: room.events.length,
      forms: room.forms.length, reviews: room.reviews.length, versions: room.versions.length
    };
  }

  return {
    FORMAT: FORMAT, VERSION: VERSION, STAGES: STAGES, PROJECT_STATUSES: PROJECT_STATUSES,
    now: now, id: id, emptyRoom: emptyRoom, normalizeCard: normalizeCard, normalizeRoom: normalizeRoom,
    normalizeDecision: normalizeDecision, normalizeDocument: normalizeDocument, normalizeMessage: normalizeMessage,
    normalizeEvent: normalizeEvent, normalizeForm: normalizeForm, normalizeReview: normalizeReview,
    moveCard: moveCard, timeline: timeline, appendActivity: appendActivity,
    snapshot: snapshot, createVersion: createVersion, restoreVersion: restoreVersion, summary: summary
  };
}));
