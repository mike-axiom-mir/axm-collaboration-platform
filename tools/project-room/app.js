(function () {
  'use strict';

  var Core = window.ProjectRoomCore;
  var STORE = 'axm.project-room.v1';
  var VIEWS = ['overview', 'board', 'direction', 'timeline', 'knowledge', 'collaboration', 'review', 'versions'];
  var stageInfo = [
    { id: 'ideas', title: 'Ideas', note: 'Captured, not committed' },
    { id: 'next', title: 'Next', note: 'Chosen for attention' },
    { id: 'building', title: 'Building', note: 'Work is happening' },
    { id: 'testing', title: 'Testing', note: 'Check the result' },
    { id: 'done', title: 'Done', note: 'Evidence attached' }
  ];
  var room = loadRoom();
  var toastTimer = null;

  function $(id) { return document.getElementById(id); }
  function esc(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function nl(value) { return esc(value).replace(/\n/g, '<br>'); }
  function loadRoom() { try { var saved = JSON.parse(localStorage.getItem(STORE) || 'null'); return saved ? Core.normalizeRoom(saved) : Core.emptyRoom(); } catch (error) { return Core.emptyRoom(); } }
  function toast(message) { var el = $('toast'); el.textContent = message; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2800); }
  function saveRoom(kind, message) {
    room.updatedAt = Core.now(); room.project.updatedAt = room.updatedAt;
    if (message) Core.appendActivity(room, kind || 'change', message);
    localStorage.setItem(STORE, JSON.stringify(room));
    $('saveState').textContent = 'Saved locally · ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (window.AXMHub && AXMHub.inHub) AXMHub.save(room);
    if (message) toast(message);
  }
  function findCard(id) { return room.cards.find(function (item) { return item.id === id; }); }
  function findGoal(id) { return room.goals.find(function (item) { return item.id === id; }); }
  function findMilestone(id) { return room.milestones.find(function (item) { return item.id === id; }); }
  function humanDate(value) { if (!value) return ''; var d = new Date(value + 'T12:00:00'); return isNaN(d) ? value : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }); }
  function humanStamp(value) { var d = new Date(value); return isNaN(d) ? value : d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }); }
  function overdue(value) { if (!value) return false; var d = new Date(), key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); return value < key; }
  function optionList(items, selected, emptyLabel) { return '<option value="">' + esc(emptyLabel) + '</option>' + items.map(function (item) { return '<option value="' + esc(item.id) + '"' + (selected === item.id ? ' selected' : '') + '>' + esc(item.title) + '</option>'; }).join(''); }
  function empty(message) { return '<div class="empty-state">' + esc(message) + '</div>'; }
  function removeButton(attr, id) { return '<button class="danger mini" ' + attr + '="' + esc(id) + '">Delete</button>'; }

  function renderOverview() {
    var s = Core.summary(room);
    $('roomTitle').textContent = room.project.title;
    $('projectTitle').value = room.project.title; $('projectLead').value = room.project.lead; $('projectStatus').value = room.project.status; $('projectSummary').value = room.project.summary;
    $('projectStats').innerHTML = [
      ['Open work', s.openCards, 'tasks not Done'], ['Completed', s.doneCards, 'evidence-gated'], ['Goals', s.goals, 'desired outcomes'], ['Knowledge', s.documents, 'documents'], ['Reviews', s.reviews, 'recorded checks'], ['Checkpoints', s.versions, 'recovery points']
    ].map(function (x) { return '<div class="stat"><b>' + x[1] + '</b><span>' + esc(x[0]) + '</span><small>' + esc(x[2]) + '</small></div>'; }).join('');
    var upcoming = Core.timeline(room).slice(0, 8);
    $('overviewTimeline').innerHTML = upcoming.length ? upcoming.map(function (item) { return '<div class="compact-row"><time>' + esc(humanDate(item.date)) + (item.time ? ' · ' + esc(item.time) : '') + '</time><span class="kind-chip">' + esc(item.kind) + '</span><b>' + esc(item.title) + '</b></div>'; }).join('') : empty('No dates yet.');
    $('decisionList').innerHTML = room.decisions.length ? room.decisions.slice().reverse().map(function (d) { return '<article class="list-item"><div class="list-item-head"><div><h3>' + esc(d.title) + '</h3><p><b>' + nl(d.choice) + '</b></p>' + (d.reason ? '<p>' + nl(d.reason) + '</p>' : '') + '</div>' + removeButton('data-delete-decision', d.id) + '</div><div class="list-meta">' + (d.decidedOn ? esc(humanDate(d.decidedOn)) : esc(humanStamp(d.createdAt))) + (d.owner ? ' · ' + esc(d.owner) : '') + '</div></article>'; }).join('') : empty('No decisions recorded.');
    $('eventList').innerHTML = room.events.length ? room.events.slice().sort(function (a, b) { return (a.date || '9999').localeCompare(b.date || '9999'); }).map(function (e) { return '<article class="list-item"><div class="list-item-head"><div><h3>' + esc(e.title) + '</h3><p>' + esc(e.note || 'No note') + '</p></div>' + removeButton('data-delete-event', e.id) + '</div><div class="list-meta">' + esc(humanDate(e.date)) + (e.time ? ' · ' + esc(e.time) : '') + '</div></article>'; }).join('') : empty('No events scheduled.');
  }

  function renderBoard() {
    $('board').innerHTML = stageInfo.map(function (stage, stageIndex) {
      var cards = room.cards.filter(function (card) { return card.stage === stage.id; });
      var contents = cards.length ? cards.map(function (card) {
        var ownerClass = card.ownerType === 'human' ? 'owner-human' : card.ownerType === 'ai' ? 'owner-ai' : card.ownerType === 'shared' ? 'owner-shared' : '';
        var ownerLabel = card.ownerType === 'shared' ? 'Human + AI' : card.ownerType.charAt(0).toUpperCase() + card.ownerType.slice(1); if (card.ownerName) ownerLabel += ' · ' + card.ownerName;
        var goal = findGoal(card.goalId), milestone = findMilestone(card.milestoneId), links = [goal ? 'Goal: ' + goal.title : '', milestone ? 'Milestone: ' + milestone.title : ''].filter(Boolean).join('<br>');
        return '<article class="card" data-card="' + esc(card.id) + '"><h3>' + esc(card.title) + '</h3><div class="card-meta"><span class="owner-chip ' + ownerClass + '">' + esc(ownerLabel) + '</span>' + (card.dueDate ? '<span class="date-chip ' + (overdue(card.dueDate) && card.stage !== 'done' ? 'overdue' : '') + '">' + esc(humanDate(card.dueDate)) + '</span>' : '') + '</div>' + (links ? '<div class="card-links">' + links + '</div>' : '') + (card.evidence.length ? '<div class="evidence-chip">✓ ' + card.evidence.length + ' evidence item' + (card.evidence.length === 1 ? '' : 's') + '</div>' : '') + '<div class="card-actions">' + (stageIndex > 0 ? '<button data-move="' + stageInfo[stageIndex - 1].id + '">← Back</button>' : '') + (stageIndex < stageInfo.length - 1 ? '<button data-move="' + stageInfo[stageIndex + 1].id + '">' + (stageIndex === 3 ? 'Finish' : 'Next') + ' →</button>' : '') + '<button class="quiet open" data-open="' + esc(card.id) + '">Open</button></div></article>';
      }).join('') : '<div class="empty-column">Nothing here yet</div>';
      return '<section class="column" data-stage="' + stage.id + '"><div class="column-head"><h3>' + stage.title + '</h3><span class="column-count">' + cards.length + '</span></div><div class="column-note">' + stage.note + '</div>' + contents + '</section>';
    }).join('');
  }
  function goalProgress(goalId) { var cards = room.cards.filter(function (c) { return c.goalId === goalId; }), done = cards.filter(function (c) { return c.stage === 'done'; }).length; return { cards: cards.length, done: done, percent: cards.length ? Math.round(done / cards.length * 100) : 0 }; }
  function milestoneProgress(id) { var cards = room.cards.filter(function (c) { return c.milestoneId === id; }), done = cards.filter(function (c) { return c.stage === 'done'; }).length; return { cards: cards.length, done: done, percent: cards.length ? Math.round(done / cards.length * 100) : 0 }; }
  function renderDirection() {
    $('milestoneGoal').innerHTML = optionList(room.goals, '', 'No linked goal');
    $('goalList').innerHTML = room.goals.length ? room.goals.map(function (g) { var p = goalProgress(g.id); return '<article class="list-item"><div class="list-item-head"><div><h3>' + esc(g.title) + '</h3><p>' + esc(g.outcome || 'No outcome written') + '</p></div>' + removeButton('data-delete-goal', g.id) + '</div><div class="list-meta">' + (g.targetDate ? 'Target ' + esc(humanDate(g.targetDate)) + ' · ' : '') + p.done + '/' + p.cards + ' linked cards done</div><div class="progress"><span style="width:' + p.percent + '%"></span></div></article>'; }).join('') : empty('No goals yet.');
    $('milestoneList').innerHTML = room.milestones.length ? room.milestones.map(function (m) { var p = milestoneProgress(m.id), g = findGoal(m.goalId); return '<article class="list-item"><div class="list-item-head"><div><h3>' + esc(m.title) + '</h3><p>' + (g ? 'For goal: ' + esc(g.title) : 'Not linked to a goal') + '</p></div>' + removeButton('data-delete-milestone', m.id) + '</div><div class="list-meta">' + (m.targetDate ? 'Target ' + esc(humanDate(m.targetDate)) + ' · ' : '') + p.done + '/' + p.cards + ' linked cards done</div><div class="progress"><span style="width:' + p.percent + '%"></span></div></article>'; }).join('') : empty('No milestones yet.');
  }
  function renderTimeline() { var items = Core.timeline(room); $('timeline').innerHTML = items.length ? items.map(function (item) { return '<div class="timeline-row ' + (overdue(item.date) ? 'overdue' : '') + '"><time>' + esc(humanDate(item.date)) + (item.time ? '<small>' + esc(item.time) + '</small>' : '') + '</time><span class="kind-chip">' + esc(item.kind) + '</span><strong>' + esc(item.title) + '</strong></div>'; }).join('') : empty('No dates yet.'); }
  function renderKnowledge() {
    $('documentList').innerHTML = room.documents.length ? room.documents.slice().reverse().map(function (d) { return '<article class="list-item"><div class="list-item-head"><div><span class="kind-chip">' + esc(d.kind) + '</span><h3>' + esc(d.title) + '</h3><p class="long-text">' + nl(d.body) + '</p></div>' + removeButton('data-delete-document', d.id) + '</div><div class="list-meta">Updated ' + esc(humanStamp(d.updatedAt)) + '</div></article>'; }).join('') : empty('No project documents yet.');
    $('formList').innerHTML = room.forms.length ? room.forms.slice().reverse().map(function (f) { return '<article class="list-item"><div class="list-item-head"><div><span class="status-chip status-' + esc(f.status) + '">' + esc(f.status) + '</span><h3>' + esc(f.title) + '</h3><p><b>Prompt:</b> ' + nl(f.prompt) + '</p><p><b>Response:</b> ' + nl(f.response || 'Waiting for response') + '</p></div>' + removeButton('data-delete-form', f.id) + '</div></article>'; }).join('') : empty('No forms or structured questions yet.');
  }
  function renderCollaboration() {
    $('messageList').innerHTML = room.messages.length ? room.messages.slice().reverse().map(function (m) { return '<article class="message message-' + esc(m.authorType) + '"><div class="message-head"><b>' + esc(m.title) + '</b><span>' + esc(m.authorName || m.authorType) + ' · ' + esc(humanStamp(m.createdAt)) + '</span></div><p>' + nl(m.body) + '</p>' + removeButton('data-delete-message', m.id) + '</article>'; }).join('') : empty('No project updates yet.');
    $('activityList').innerHTML = room.activity.length ? room.activity.slice().reverse().slice(0, 100).map(function (a) { return '<div class="activity"><i></i><div><b>' + esc(a.title) + '</b><span>' + esc(a.kind) + ' · ' + esc(a.actor || 'local user') + ' · ' + esc(humanStamp(a.createdAt)) + '</span></div></div>'; }).join('') : empty('No activity recorded yet.');
  }
  function renderReview() {
    $('reviewCard').innerHTML = optionList(room.cards, '', 'No linked card');
    $('reviewList').innerHTML = room.reviews.length ? room.reviews.slice().reverse().map(function (r) { var card = findCard(r.cardId); return '<article class="list-item verdict-' + esc(r.verdict) + '"><div class="list-item-head"><div><div><span class="kind-chip">' + esc(r.kind) + '</span> <span class="status-chip">' + esc(r.verdict) + '</span></div><h3>' + esc(r.title) + '</h3><p>' + nl(r.body) + '</p></div>' + removeButton('data-delete-review', r.id) + '</div><div class="list-meta">' + esc(humanStamp(r.createdAt)) + (card ? ' · Card: ' + esc(card.title) : '') + '</div></article>'; }).join('') : empty('No reviews yet.');
  }
  function renderVersions() {
    $('versionList').innerHTML = room.versions.length ? room.versions.slice().reverse().map(function (v) { return '<article class="list-item"><div class="list-item-head"><div><h3>' + esc(v.title) + '</h3><p>' + esc(v.note || 'No note') + '</p></div><button class="primary mini" data-restore-version="' + esc(v.id) + '">Restore</button></div><div class="list-meta">' + esc(humanStamp(v.createdAt)) + '</div></article>'; }).join('') : empty('No checkpoints yet.');
  }
  function renderAll() { renderOverview(); renderBoard(); renderDirection(); renderTimeline(); renderKnowledge(); renderCollaboration(); renderReview(); renderVersions(); }

  function moveCard(cardId, stage) { var result = Core.moveCard(findCard(cardId), stage); if (!result.ok) { toast(result.error); openCard(cardId, result.error); return; } saveRoom('card', stage === 'done' ? 'Finished with evidence.' : 'Card moved to ' + stage + '.'); renderAll(); }
  function openCard(cardId, note) { var c = findCard(cardId); if (!c) return; $('cardId').value = c.id; $('cardTitle').value = c.title; $('cardDescription').value = c.description; $('cardStage').value = c.stage; $('cardOwnerType').value = c.ownerType; $('cardOwnerName').value = c.ownerName; $('cardDueDate').value = c.dueDate; $('cardGoal').innerHTML = optionList(room.goals, c.goalId, 'No linked goal'); $('cardMilestone').innerHTML = optionList(room.milestones, c.milestoneId, 'No linked milestone'); $('cardEvidence').value = c.evidence.join('\n'); $('cardDialogNote').textContent = note || ''; $('cardDialog').showModal(); }
  function closeCard() { $('cardDialog').close(); $('cardDialogNote').textContent = ''; }
  function saveCard() {
    var c = findCard($('cardId').value), title = $('cardTitle').value.trim(); if (!c || !title) { $('cardDialogNote').textContent = 'A title is required.'; return; }
    var stage = $('cardStage').value, evidence = $('cardEvidence').value.split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean);
    if (stage === 'done' && !evidence.length) { $('cardDialogNote').textContent = 'Add at least one evidence line before choosing Done.'; return; }
    c.title = title; c.description = $('cardDescription').value.trim(); c.ownerType = $('cardOwnerType').value; c.ownerName = $('cardOwnerName').value.trim(); c.dueDate = $('cardDueDate').value; c.goalId = $('cardGoal').value; c.milestoneId = $('cardMilestone').value; c.evidence = evidence;
    var moved = Core.moveCard(c, stage); if (!moved.ok) { $('cardDialogNote').textContent = moved.error; return; }
    saveRoom('card', 'Card saved: ' + c.title); renderAll(); closeCard();
  }
  function switchView(name) { document.querySelectorAll('.tab').forEach(function (b) { var active = b.dataset.view === name; b.classList.toggle('active', active); if (active) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); }); VIEWS.forEach(function (v) { $(v + 'View').hidden = v !== name; }); }
  function downloadExport() { var url = URL.createObjectURL(new Blob([JSON.stringify(room, null, 2)], { type: 'application/json' })), a = document.createElement('a'); a.href = url; a.download = 'AXM_PROJECT_' + room.project.title.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '').slice(0, 40) + '_' + new Date().toISOString().slice(0, 10) + '.json'; a.click(); setTimeout(function () { URL.revokeObjectURL(url); }, 1000); toast('Full project backup downloaded.'); }
  function importFile(file) { if (!file) return; var reader = new FileReader(); reader.onload = function () { try { var imported = Core.normalizeRoom(JSON.parse(reader.result)), s = Core.summary(imported); if (!confirm('Replace this Project Room with the imported project?\n\n' + s.cards + ' cards · ' + s.documents + ' documents · ' + s.versions + ' checkpoints\n\nExport first if you need the current project.')) return; room = imported; saveRoom('import', 'Project import completed.'); renderAll(); } catch (e) { toast('Import refused: ' + e.message); } $('importFile').value = ''; }; reader.readAsText(file); }

  document.querySelectorAll('.tab').forEach(function (b) { b.onclick = function () { switchView(b.dataset.view); }; });
  $('ideaForm').onsubmit = function (e) { e.preventDefault(); var title = $('ideaTitle').value.trim(); if (!title) return; room.cards.push(Core.normalizeCard({ title: title, stage: 'ideas' })); $('ideaTitle').value = ''; saveRoom('idea', 'Idea captured: ' + title); renderAll(); };
  $('projectForm').onsubmit = function (e) { e.preventDefault(); var previousStatus = room.project.status; room.project.title = $('projectTitle').value.trim() || 'Untitled project'; room.project.lead = $('projectLead').value.trim(); room.project.status = $('projectStatus').value; room.project.summary = $('projectSummary').value.trim(); saveRoom('project', 'Project brief updated.'); renderAll(); if (previousStatus !== 'complete' && room.project.status === 'complete' && window.AXMProfile) { var doneCount = room.cards.filter(function (card) { return card.stage === 'done'; }).length; AXMProfile.record({ type: 'project-completed', dedupeKey: 'project-room:' + room.project.id + ':complete', candidates: [{ name: room.project.lead }], evidence: 'Project Room marked "' + room.project.title + '" complete with ' + doneCount + ' done cards and ' + room.reviews.length + ' reviews.', source: 'Project Room', meta: { projectId: room.project.id, title: room.project.title } }).catch(function () {}); } };
  $('decisionForm').onsubmit = function (e) { e.preventDefault(); var title = $('decisionTitle').value.trim(); if (!title) return; room.decisions.push(Core.normalizeDecision({ title: title, choice: $('decisionChoice').value, reason: $('decisionReason').value, owner: $('decisionOwner').value, decidedOn: $('decisionDate').value })); e.target.reset(); saveRoom('decision', 'Decision recorded: ' + title); renderAll(); };
  $('eventForm').onsubmit = function (e) { e.preventDefault(); var title = $('eventTitle').value.trim(); if (!title) return; room.events.push(Core.normalizeEvent({ title: title, date: $('eventDate').value, time: $('eventTime').value, note: $('eventNote').value })); e.target.reset(); saveRoom('event', 'Event added: ' + title); renderAll(); };
  $('showGoalForm').onclick = function () { $('goalForm').hidden = false; $('goalTitle').focus(); }; $('showMilestoneForm').onclick = function () { $('milestoneForm').hidden = false; $('milestoneTitle').focus(); };
  document.querySelectorAll('[data-cancel-form]').forEach(function (b) { b.onclick = function () { $(b.dataset.cancelForm).hidden = true; }; });
  $('goalForm').onsubmit = function (e) { e.preventDefault(); var title = $('goalTitle').value.trim(); if (!title) return; room.goals.push({ id: Core.id('goal'), title: title, outcome: $('goalOutcome').value.trim(), targetDate: $('goalDate').value, createdAt: Core.now() }); e.target.reset(); e.target.hidden = true; saveRoom('goal', 'Goal added: ' + title); renderAll(); };
  $('milestoneForm').onsubmit = function (e) { e.preventDefault(); var title = $('milestoneTitle').value.trim(); if (!title) return; room.milestones.push({ id: Core.id('milestone'), title: title, goalId: $('milestoneGoal').value, targetDate: $('milestoneDate').value, createdAt: Core.now() }); e.target.reset(); e.target.hidden = true; saveRoom('milestone', 'Milestone added: ' + title); renderAll(); };
  $('documentForm').onsubmit = function (e) { e.preventDefault(); var title = $('documentTitle').value.trim(); if (!title) return; room.documents.push(Core.normalizeDocument({ title: title, kind: $('documentKind').value, body: $('documentBody').value })); e.target.reset(); saveRoom('document', 'Document saved: ' + title); renderAll(); };
  $('formForm').onsubmit = function (e) { e.preventDefault(); var title = $('formTitle').value.trim(); if (!title) return; room.forms.push(Core.normalizeForm({ title: title, prompt: $('formPrompt').value, response: $('formResponse').value, status: $('formStatus').value })); e.target.reset(); saveRoom('form', 'Structured question saved: ' + title); renderAll(); };
  $('messageForm').onsubmit = function (e) { e.preventDefault(); var title = $('messageTitle').value.trim(), body = $('messageBody').value.trim(); if (!title || !body) return; room.messages.push(Core.normalizeMessage({ title: title, body: body, authorType: $('messageAuthorType').value, authorName: $('messageAuthorName').value })); e.target.reset(); $('messageTitle').value = 'Update'; saveRoom('message', 'Project update posted: ' + title); renderAll(); };
  $('reviewForm').onsubmit = function (e) { e.preventDefault(); var title = $('reviewTitle').value.trim(); if (!title) return; room.reviews.push(Core.normalizeReview({ title: title, kind: $('reviewKind').value, verdict: $('reviewVerdict').value, cardId: $('reviewCard').value, body: $('reviewBody').value })); e.target.reset(); saveRoom('review', 'Review recorded: ' + title); renderAll(); };
  $('versionForm').onsubmit = function (e) { e.preventDefault(); var title = $('versionTitle').value.trim(); if (!title) return; Core.createVersion(room, title, $('versionNote').value); saveRoom('', ''); e.target.reset(); toast('Checkpoint created: ' + title); renderAll(); };
  $('quickCheckpoint').onclick = function () { var title = prompt('Checkpoint name', 'Checkpoint ' + new Date().toLocaleString()); if (!title) return; Core.createVersion(room, title, 'Quick checkpoint'); saveRoom('', ''); toast('Checkpoint created.'); renderAll(); switchView('versions'); };
  $('versionExport').onclick = downloadExport; $('exportButton').onclick = downloadExport; $('importButton').onclick = function () { $('importFile').click(); }; $('importFile').onchange = function () { importFile(this.files && this.files[0]); };
  $('board').onclick = function (e) { var move = e.target.closest('[data-move]'), open = e.target.closest('[data-open]'); if (move) moveCard(e.target.closest('[data-card]').dataset.card, move.dataset.move); if (open) openCard(open.dataset.open); };
  $('cardForm').onsubmit = function (e) { e.preventDefault(); saveCard(); }; $('closeCard').onclick = closeCard; $('cancelCard').onclick = closeCard;
  $('deleteCard').onclick = function () { var c = findCard($('cardId').value); if (c && confirm('Delete “' + c.title + '”?')) { room.cards = room.cards.filter(function (x) { return x.id !== c.id; }); saveRoom('delete', 'Card deleted: ' + c.title); renderAll(); closeCard(); } };

  document.addEventListener('click', function (e) {
    var rules = [
      ['deleteGoal', 'goals', 'goal'], ['deleteMilestone', 'milestones', 'milestone'], ['deleteDecision', 'decisions', 'decision'], ['deleteEvent', 'events', 'event'],
      ['deleteDocument', 'documents', 'document'], ['deleteForm', 'forms', 'form'], ['deleteMessage', 'messages', 'message'], ['deleteReview', 'reviews', 'review']
    ];
    rules.some(function (rule) {
      var button = e.target.closest('[data-' + rule[0].replace(/[A-Z]/g, function (c) { return '-' + c.toLowerCase(); }) + ']'); if (!button) return false;
      var key = rule[0].replace(/[A-Z]/g, function (c) { return '-' + c.toLowerCase(); }), targetId = button.dataset[rule[0]], item = room[rule[1]].find(function (x) { return x.id === targetId; });
      if (!item || !confirm('Delete “' + item.title + '”?')) return true;
      room[rule[1]] = room[rule[1]].filter(function (x) { return x.id !== targetId; });
      if (rule[1] === 'goals') { room.cards.forEach(function (c) { if (c.goalId === targetId) c.goalId = ''; }); room.milestones.forEach(function (m) { if (m.goalId === targetId) m.goalId = ''; }); }
      if (rule[1] === 'milestones') room.cards.forEach(function (c) { if (c.milestoneId === targetId) c.milestoneId = ''; });
      saveRoom('delete', rule[2] + ' deleted: ' + item.title); renderAll(); return true;
    });
    var restore = e.target.closest('[data-restore-version]');
    if (restore && confirm('Restore this checkpoint? Current unsaved changes will be replaced, but checkpoint history stays.')) { var result = Core.restoreVersion(room, restore.dataset.restoreVersion); if (!result.ok) toast(result.error); else { room = result.room; saveRoom('', ''); toast('Checkpoint restored: ' + result.version.title); renderAll(); } }
  });

  renderAll(); switchView('overview');
  if (window.AXMHub) { AXMHub.onInit(function () { AXMHub.log('Project Room ready · merged local project record loaded'); }); AXMHub.ready({ id: 'project-room', name: 'AXM Project Room', version: 'v0.2', hubApiVersion: '1.0', permissions: [], savesState: true, handlesShutdown: false }); }
}());
