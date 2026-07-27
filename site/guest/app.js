(function () {
  'use strict';

  var config = window.AXM_PUBLIC_CONFIG || {};
  var SESSION_MINUTES = Number(config.sessionMinutes) || 30;
  var GRACE_MINUTES = Number(config.exportGraceMinutes) || 5;
  var SESSION_MS = SESSION_MINUTES * 60 * 1000;
  var GRACE_MS = GRACE_MINUTES * 60 * 1000;
  var STORAGE_KEY = config.guestStorageKey || 'axm.guest.session.v1';
  var HANDOFF_KEY = config.handoffKey || 'axm.guest.project-room-handoff.v1';
  var MAX_IMPORT_BYTES = Number(config.maxImportBytes) || 1024 * 1024;
  var STATE_SCHEMA = 'axm.guest-session-state/v1';
  var EXPORT_SCHEMA = 'axm.guest-session-export/v1';
  var PROJECT_FORMAT = 'axm.project-room/v1';
  var STAGES = ['ideas', 'building', 'done'];
  var state = loadState();
  var toastTimer = null;
  var lastTick = performance.now();
  var lastPersistSecond = -1;
  var storageWarningShown = false;

  function $(id) { return document.getElementById(id); }
  function now() { return new Date().toISOString(); }
  function text(value, max) {
    var output = String(value == null ? '' : value).trim();
    return max ? output.slice(0, max) : output;
  }
  function id(prefix) {
    var random = '';
    if (window.crypto && window.crypto.getRandomValues) {
      var bytes = new Uint32Array(2);
      window.crypto.getRandomValues(bytes);
      random = bytes[0].toString(36) + bytes[1].toString(36);
    } else random = Math.random().toString(36).slice(2, 12);
    return (prefix || 'item') + '-' + Date.now().toString(36) + '-' + random.slice(0, 10);
  }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function emptyProject() {
    return { title: 'Untitled project', lead: '', purpose: '', northStar: '', scratchpad: '', cards: [] };
  }
  function freshState() {
    var at = now();
    return {
      schema: STATE_SCHEMA,
      version: 1,
      id: id('guest'),
      status: 'ready',
      createdAt: at,
      startedAt: '',
      updatedAt: at,
      remainingMs: SESSION_MS,
      graceRemainingMs: GRACE_MS,
      changeRevision: 0,
      exportRevision: -1,
      lastExportAt: '',
      project: emptyProject()
    };
  }
  function normalizeCard(input) {
    input = input || {};
    var stage = STAGES.indexOf(input.stage) >= 0 ? input.stage : 'ideas';
    var evidence = text(input.evidence, 3000);
    if (stage === 'done' && !evidence) stage = 'building';
    return {
      id: text(input.id, 100) || id('card'),
      title: text(input.title, 120),
      details: text(input.details || input.description, 3000),
      stage: stage,
      owner: ['human', 'ai', 'shared', 'unassigned'].indexOf(input.owner || input.ownerType) >= 0 ? (input.owner || input.ownerType) : 'unassigned',
      ownerName: text(input.ownerName, 100),
      evidence: evidence,
      createdAt: text(input.createdAt, 40) || now(),
      updatedAt: text(input.updatedAt, 40) || now()
    };
  }
  function normalizeState(input) {
    if (!input || input.schema !== STATE_SCHEMA) return freshState();
    var output = freshState();
    output.id = text(input.id, 100) || output.id;
    output.status = ['ready', 'active', 'grace', 'ended'].indexOf(input.status) >= 0 ? input.status : 'ready';
    output.createdAt = text(input.createdAt, 40) || output.createdAt;
    output.startedAt = text(input.startedAt, 40);
    output.updatedAt = text(input.updatedAt, 40) || output.updatedAt;
    output.remainingMs = Math.max(0, Math.min(SESSION_MS, Number(input.remainingMs) || 0));
    output.graceRemainingMs = Math.max(0, Math.min(GRACE_MS, Number(input.graceRemainingMs) || 0));
    output.changeRevision = Math.max(0, Math.floor(Number(input.changeRevision) || 0));
    output.exportRevision = Math.floor(Number(input.exportRevision));
    if (!Number.isFinite(output.exportRevision)) output.exportRevision = -1;
    output.lastExportAt = text(input.lastExportAt, 40);
    var project = input.project || {};
    output.project = {
      title: text(project.title, 120) || 'Untitled project',
      lead: text(project.lead, 100),
      purpose: text(project.purpose, 4000),
      northStar: text(project.northStar, 300),
      scratchpad: text(project.scratchpad, 30000),
      cards: (Array.isArray(project.cards) ? project.cards : []).map(normalizeCard).filter(function (card) { return card.title; }).slice(0, 250)
    };
    if (output.status === 'active' && output.remainingMs <= 0) output.status = 'grace';
    if (output.status === 'grace' && output.graceRemainingMs <= 0) output.status = 'ended';
    return output;
  }
  function loadState() {
    try {
      var raw = sessionStorage.getItem(STORAGE_KEY);
      return raw ? normalizeState(JSON.parse(raw)) : freshState();
    } catch (error) {
      return freshState();
    }
  }
  function persist() {
    state.updatedAt = now();
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      if (!storageWarningShown) {
        storageWarningShown = true;
        toast('This browser blocked sessionStorage. Export often; a refresh may lose this workroom.');
      }
    }
  }
  function clearStoredSession() {
    try { sessionStorage.removeItem(STORAGE_KEY); } catch (error) {}
  }
  function toast(message) {
    var node = $('toast');
    node.textContent = message;
    node.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { node.classList.remove('show'); }, 3200);
  }
  function formatTime(milliseconds) {
    var total = Math.max(0, Math.ceil(milliseconds / 1000));
    return String(Math.floor(total / 60)).padStart(2, '0') + ':' + String(total % 60).padStart(2, '0');
  }
  function isEditable() { return state.status === 'active'; }
  function hasUnsavedExport() { return state.changeRevision > state.exportRevision; }
  function hasProjectContent() {
    return state.project.title !== 'Untitled project' || state.project.lead || state.project.purpose || state.project.northStar || state.project.scratchpad || state.project.cards.length;
  }

  function syncInputsFromProject() {
    $('projectTitle').value = state.project.title;
    $('projectLead').value = state.project.lead;
    $('projectPurpose').value = state.project.purpose;
    $('northStar').value = state.project.northStar;
    $('scratchpad').value = state.project.scratchpad;
  }
  function syncProjectFromInputs() {
    state.project.title = text($('projectTitle').value, 120) || 'Untitled project';
    state.project.lead = text($('projectLead').value, 100);
    state.project.purpose = text($('projectPurpose').value, 4000);
    state.project.northStar = text($('northStar').value, 300);
    state.project.scratchpad = text($('scratchpad').value, 30000);
  }
  function markChanged(message) {
    if (!isEditable()) return;
    state.changeRevision += 1;
    $('afterExport').hidden = true;
    persist();
    updateSaveStatus();
    if (message) toast(message);
  }
  function updateSaveStatus() {
    if (state.status === 'ready') $('saveStatus').textContent = 'Timer not started';
    else if (state.status === 'active') $('saveStatus').textContent = 'Kept in this tab · ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    else $('saveStatus').textContent = 'Editing locked · export remains available';
  }

  function setExternalLinks() {
    if (config.repositoryUrl) $('githubSupport').href = config.repositoryUrl;
    if (config.communityUrl) $('communitySupport').href = config.communityUrl;
    if (config.supportUrl) {
      $('paidSupport').href = config.supportUrl;
      $('paidSupport').hidden = false;
    }
    document.querySelectorAll('[data-session-minutes]').forEach(function (node) { node.textContent = String(SESSION_MINUTES); });
  }

  function updateTimer() {
    var milliseconds = state.status === 'grace' ? state.graceRemainingMs : state.remainingMs;
    var maximum = state.status === 'grace' ? GRACE_MS : SESSION_MS;
    var percent = maximum ? Math.max(0, Math.min(100, milliseconds / maximum * 100)) : 0;
    $('timer').textContent = formatTime(milliseconds);
    $('timerBar').style.width = percent + '%';
    var meterStatus = document.querySelector('[data-meter-status]');
    meterStatus.className = 'meter-status';
    if (state.status === 'ready') {
      meterStatus.innerHTML = '<i aria-hidden="true"></i> WAITING';
      $('timerCaption').textContent = 'Timer starts when you enter';
    } else if (state.status === 'active') {
      meterStatus.classList.add(milliseconds <= 5 * 60 * 1000 ? 'is-warning' : 'is-active');
      meterStatus.innerHTML = '<i aria-hidden="true"></i> ' + (milliseconds <= 5 * 60 * 1000 ? 'WRAP UP' : 'ACTIVE');
      $('timerCaption').textContent = document.hidden ? 'Paused while this tab is hidden' : 'Active time · pauses when hidden';
    } else if (state.status === 'grace') {
      meterStatus.classList.add('is-warning');
      meterStatus.innerHTML = '<i aria-hidden="true"></i> EXPORT WINDOW';
      $('timerCaption').textContent = 'Editing locked · download now';
    } else {
      meterStatus.classList.add('is-ended');
      meterStatus.innerHTML = '<i aria-hidden="true"></i> CLEARED';
      $('timerCaption').textContent = 'Session memory erased';
    }
  }

  function setEditingState() {
    var locked = !isEditable();
    document.body.classList.toggle('is-locked', state.status === 'grace');
    ['projectTitle', 'projectLead', 'projectPurpose', 'northStar', 'scratchpad', 'addCard'].forEach(function (name) {
      $(name).disabled = locked;
    });
    document.querySelectorAll('#projectForm button, .card-actions button').forEach(function (button) { button.disabled = locked; });
    $('exportButton').disabled = state.status === 'ready' || state.status === 'ended';
    $('mainExport').disabled = state.status === 'ended';
    updateSaveStatus();
  }

  function showCurrentView() {
    var ready = state.status === 'ready';
    var ended = state.status === 'ended';
    $('welcomePanel').hidden = !ready;
    $('workroom').hidden = ready || ended;
    $('endedPanel').hidden = !ended;
    $('expiryBanner').hidden = state.status !== 'grace';
    if (!ready && !ended) {
      syncInputsFromProject();
      renderProject();
      if (state.lastExportAt && state.exportRevision === state.changeRevision) showAfterExport();
    }
    setEditingState();
    updateTimer();
  }

  function renderProject() {
    $('projectHeading').textContent = state.project.title || 'Untitled project';
    var counts = { ideas: 0, building: 0, done: 0 };
    STAGES.forEach(function (stage) {
      var cards = state.project.cards.filter(function (card) { return card.stage === stage; });
      counts[stage] = cards.length;
      renderCardList(stage, cards);
      $(stage + 'Badge').textContent = String(cards.length);
    });
    $('ideaCount').textContent = String(counts.ideas);
    $('buildCount').textContent = String(counts.building);
    $('checkedCount').textContent = String(counts.done);
    setEditingState();
  }

  function ownerLabel(card) {
    var labels = { human: 'Human', ai: 'AI', shared: 'Human + AI', unassigned: 'Unassigned' };
    return (labels[card.owner] || labels.unassigned) + (card.ownerName ? ' · ' + card.ownerName : '');
  }
  function makeButton(label, action, value) {
    var button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.dataset[action] = value;
    button.disabled = !isEditable();
    return button;
  }
  function renderCardList(stage, cards) {
    var list = $(stage + 'List');
    list.textContent = '';
    if (!cards.length) {
      var empty = document.createElement('div');
      empty.className = 'empty-column';
      empty.textContent = stage === 'ideas' ? 'Catch the first piece of the idea.' : stage === 'building' ? 'Move a chosen card here.' : 'Checked work will carry its evidence here.';
      list.appendChild(empty);
      return;
    }
    cards.forEach(function (card) {
      var article = document.createElement('article');
      article.className = 'work-card';
      article.dataset.card = card.id;
      var title = document.createElement('h3');
      title.textContent = card.title;
      article.appendChild(title);
      if (card.details) {
        var detail = document.createElement('p');
        detail.textContent = card.details;
        article.appendChild(detail);
      }
      var meta = document.createElement('div');
      meta.className = 'card-meta';
      var owner = document.createElement('span');
      owner.className = 'card-chip owner-' + card.owner;
      owner.textContent = ownerLabel(card);
      meta.appendChild(owner);
      article.appendChild(meta);
      if (card.evidence) {
        var evidence = document.createElement('div');
        evidence.className = 'evidence-chip';
        evidence.textContent = '✓ Evidence attached';
        article.appendChild(evidence);
      }
      var actions = document.createElement('div');
      actions.className = 'card-actions';
      var index = STAGES.indexOf(stage);
      if (index > 0) actions.appendChild(makeButton('← Back', 'move', STAGES[index - 1]));
      if (index < STAGES.length - 1) actions.appendChild(makeButton(index === 1 ? 'Check →' : 'Build →', 'move', STAGES[index + 1]));
      actions.appendChild(makeButton('Open', 'open', card.id));
      article.appendChild(actions);
      list.appendChild(article);
    });
  }

  function startSession(project) {
    if (state.status === 'ended') state = freshState();
    if (project) state.project = project;
    state.status = 'active';
    state.startedAt = state.startedAt || now();
    state.remainingMs = state.remainingMs > 0 ? state.remainingMs : SESSION_MS;
    state.graceRemainingMs = GRACE_MS;
    lastTick = performance.now();
    persist();
    showCurrentView();
    $('projectTitle').focus();
    toast('Session started. Export whenever you want—there is no reason to wait for the timer.');
  }
  function starterProject() {
    var at = now();
    return {
      title: 'Small signal, real exit',
      lead: 'Shared seat',
      purpose: 'Turn one loose idea into a project another person can understand and continue.',
      northStar: 'The exported file explains what matters, what is next and what was actually checked.',
      scratchpad: 'Questions:\n- Who is this for?\n- What is the smallest honest proof?\n- What must stay local?\n\nRemember: export before leaving.',
      cards: [
        normalizeCard({ id: id('card'), title: 'Name the person this helps', details: 'Write one concrete person or group, not everyone.', stage: 'ideas', owner: 'human', createdAt: at }),
        normalizeCard({ id: id('card'), title: 'Build the smallest useful proof', details: 'Keep the first version bounded enough to inspect.', stage: 'building', owner: 'shared', ownerName: 'Human + machine', createdAt: at }),
        normalizeCard({ id: id('card'), title: 'Confirm the export opens', details: 'Download and inspect the project file.', stage: 'done', owner: 'human', evidence: 'Starter example includes a valid portable Project Room record.', createdAt: at })
      ]
    };
  }

  function openCard(cardId, message) {
    if (!isEditable()) return;
    var card = state.project.cards.find(function (candidate) { return candidate.id === cardId; });
    $('cardId').value = card ? card.id : '';
    $('cardDialogTitle').textContent = card ? 'Edit work card' : 'Add work card';
    $('cardTitle').value = card ? card.title : '';
    $('cardDetails').value = card ? card.details : '';
    $('cardStage').value = card ? card.stage : 'ideas';
    $('cardOwner').value = card ? card.owner : 'unassigned';
    $('cardOwnerName').value = card ? card.ownerName : '';
    $('cardEvidence').value = card ? card.evidence : '';
    $('deleteCard').hidden = !card;
    $('cardMessage').textContent = message || '';
    $('cardDialog').showModal();
    $('cardTitle').focus();
  }
  function closeCard() {
    $('cardDialog').close();
    $('cardMessage').textContent = '';
  }
  function saveCard() {
    var title = text($('cardTitle').value, 120);
    var stage = $('cardStage').value;
    var evidence = text($('cardEvidence').value, 3000);
    if (!title) { $('cardMessage').textContent = 'A clear title is required.'; return; }
    if (stage === 'done' && !evidence) { $('cardMessage').textContent = 'Checked needs one evidence line. Choose Building if it is not checked yet.'; return; }
    var cardId = $('cardId').value;
    var card = state.project.cards.find(function (candidate) { return candidate.id === cardId; });
    if (!card) {
      card = normalizeCard({ id: id('card'), title: title, createdAt: now() });
      state.project.cards.push(card);
    }
    card.title = title;
    card.details = text($('cardDetails').value, 3000);
    card.stage = stage;
    card.owner = $('cardOwner').value;
    card.ownerName = text($('cardOwnerName').value, 100);
    card.evidence = evidence;
    card.updatedAt = now();
    markChanged('Work card saved.');
    renderProject();
    closeCard();
  }
  function moveCard(cardId, stage) {
    if (!isEditable()) return;
    var card = state.project.cards.find(function (candidate) { return candidate.id === cardId; });
    if (!card) return;
    if (stage === 'done' && !card.evidence) { openCard(cardId, 'Add one evidence line before moving this card to Checked.'); return; }
    card.stage = stage;
    card.updatedAt = now();
    markChanged(stage === 'done' ? 'Card checked with evidence.' : 'Card moved to ' + stage + '.');
    renderProject();
  }

  function projectRoomRecord() {
    syncProjectFromInputs();
    var at = now();
    var room = {
      format: PROJECT_FORMAT,
      version: 2,
      project: {
        title: state.project.title,
        summary: state.project.purpose + (state.project.northStar ? '\n\nNorth-star outcome: ' + state.project.northStar : ''),
        status: 'active',
        lead: state.project.lead,
        createdAt: state.createdAt,
        updatedAt: at
      },
      cards: state.project.cards.map(function (card) {
        return {
          id: card.id,
          title: card.title,
          description: card.details,
          stage: card.stage === 'ideas' ? 'ideas' : card.stage === 'building' ? 'building' : 'done',
          ownerType: card.owner,
          ownerName: card.ownerName,
          goalId: '',
          milestoneId: '',
          dueDate: '',
          evidence: card.evidence ? card.evidence.split(/\r?\n/).map(function (line) { return text(line, 1000); }).filter(Boolean).slice(0, 50) : [],
          createdAt: card.createdAt,
          updatedAt: card.updatedAt,
          completedAt: card.stage === 'done' ? card.updatedAt : ''
        };
      }),
      goals: [], milestones: [], decisions: [],
      documents: state.project.scratchpad ? [{ id: id('doc'), title: 'Guest session scratchpad', kind: 'note', body: state.project.scratchpad, createdAt: at, updatedAt: at }] : [],
      messages: [], events: [], forms: [], reviews: [],
      activity: [{ id: id('activity'), title: 'Exported from the AXM public guest workroom.', kind: 'guest-export', actor: state.project.lead || 'guest', createdAt: at }],
      versions: [],
      updatedAt: at
    };
    return room;
  }
  function exportPacket() {
    return {
      schema: EXPORT_SCHEMA,
      version: 1,
      exportedAt: now(),
      source: {
        name: 'AXM Workshop public guest workroom',
        sessionId: state.id,
        sessionLengthActiveMinutes: SESSION_MINUTES,
        storage: 'browser-sessionStorage',
        networkApiUsed: false,
        automaticExecution: false
      },
      projectRoom: projectRoomRecord(),
      guest: { purpose: state.project.purpose, northStar: state.project.northStar, timerStatusAtExport: state.status }
    };
  }
  function safeFilename(value) {
    return text(value, 40).replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '') || 'GUEST_PROJECT';
  }
  function downloadExport() {
    if (state.status === 'ready' || state.status === 'ended') return;
    var packet = exportPacket();
    var blob = new Blob([JSON.stringify(packet, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'AXM_' + safeFilename(state.project.title) + '_' + new Date().toISOString().slice(0, 10) + '.axm.json';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1200);
    state.lastExportAt = packet.exportedAt;
    state.exportRevision = state.changeRevision;
    persist();
    showAfterExport();
    toast('Export prepared. Check your Downloads folder before closing this tab.');
  }
  function showAfterExport() {
    $('afterExport').hidden = false;
    var local = /^(localhost|127\.0\.0\.1|\[?::1\]?)$/.test(location.hostname) && /\/site\/guest\/?$/.test(location.pathname);
    $('localHandoff').hidden = !local;
    $('handoffNote').hidden = !local;
  }

  function projectFromRoom(room, guest) {
    if (!room || room.format !== PROJECT_FORMAT) throw new Error('This file does not contain an AXM Project Room record.');
    var documents = Array.isArray(room.documents) ? room.documents : [];
    var scratch = documents.find(function (document) { return /guest session scratchpad/i.test(document.title || ''); });
    return {
      title: text(room.project && room.project.title, 120) || 'Imported project',
      lead: text(room.project && room.project.lead, 100),
      purpose: text(guest && guest.purpose, 4000) || text(room.project && room.project.summary, 4000).split('\n\nNorth-star outcome:')[0],
      northStar: text(guest && guest.northStar, 300),
      scratchpad: text(scratch && scratch.body, 30000),
      cards: (Array.isArray(room.cards) ? room.cards : []).map(function (card) {
        var stage = card.stage === 'done' ? 'done' : card.stage === 'ideas' ? 'ideas' : 'building';
        return normalizeCard({
          id: card.id,
          title: card.title,
          details: card.description,
          stage: stage,
          owner: card.ownerType,
          ownerName: card.ownerName,
          evidence: Array.isArray(card.evidence) ? card.evidence.join('\n') : card.evidence,
          createdAt: card.createdAt,
          updatedAt: card.updatedAt
        });
      }).filter(function (card) { return card.title; }).slice(0, 250)
    };
  }
  function importObject(parsed) {
    if (state.status === 'grace') throw new Error('The editing window is closed. Export this project or start a fresh session before importing.');
    var room = parsed && parsed.schema === EXPORT_SCHEMA ? parsed.projectRoom : parsed && parsed.projectRoom ? parsed.projectRoom : parsed;
    var project = projectFromRoom(room, parsed && parsed.guest);
    if (!window.confirm('Import “' + project.title + '” into this guest session?\n\nThis replaces the current guest project. Export first if you still need it. Nothing will run automatically.')) return;
    if (state.status === 'ready' || state.status === 'ended') state = freshState();
    state.project = project;
    state.status = 'active';
    state.startedAt = state.startedAt || now();
    state.changeRevision += 1;
    state.exportRevision = -1;
    state.lastExportAt = '';
    lastTick = performance.now();
    persist();
    showCurrentView();
    toast('Project imported locally into this tab.');
  }
  function importFile(file) {
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) { toast('Import refused: the guest workroom accepts files up to 1 MB.'); return; }
    var reader = new FileReader();
    reader.onload = function () {
      try { importObject(JSON.parse(String(reader.result || ''))); }
      catch (error) { toast('Import refused: ' + error.message); }
      $('importFile').value = '';
    };
    reader.onerror = function () { toast('The browser could not read that file.'); };
    reader.readAsText(file);
  }

  function enterGrace() {
    state.status = 'grace';
    state.remainingMs = 0;
    state.graceRemainingMs = GRACE_MS;
    persist();
    showCurrentView();
    $('expiryTitle').textContent = 'Session complete. Editing is locked.';
    $('expiryMessage').textContent = 'Export now. This tab keeps your work available for ' + GRACE_MINUTES + ' more active minutes.';
    toast('Time is complete. Your work is still here—export it now.');
  }
  function endAndClear() {
    state.status = 'ended';
    state.project = emptyProject();
    state.remainingMs = 0;
    state.graceRemainingMs = 0;
    clearStoredSession();
    showCurrentView();
  }
  function tick() {
    var current = performance.now();
    var delta = Math.max(0, Math.min(2000, current - lastTick));
    lastTick = current;
    if (!document.hidden && (state.status === 'active' || state.status === 'grace')) {
      if (state.status === 'active') {
        state.remainingMs = Math.max(0, state.remainingMs - delta);
        if (state.remainingMs <= 0) enterGrace();
      } else {
        state.graceRemainingMs = Math.max(0, state.graceRemainingMs - delta);
        if (state.graceRemainingMs <= 0) endAndClear();
      }
      var second = Math.floor((state.status === 'grace' ? state.graceRemainingMs : state.remainingMs) / 1000);
      if (second !== lastPersistSecond) { lastPersistSecond = second; persist(); }
    }
    updateTimer();
  }

  function shareDoorway() {
    var share = { title: 'AXM Workshop', text: 'Try a free 30-minute local-first AXM guest workroom and take your project with you.', url: new URL('../', location.href).href };
    if (navigator.share) {
      navigator.share(share).then(function () { toast('Doorway shared.'); }).catch(function () {});
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(share.url).then(function () { toast('Front-door link copied.'); }).catch(function () { toast(share.url); });
    } else toast(share.url);
  }
  function openLocalHandoff() {
    var packet = exportPacket();
    if (!window.confirm('Send this exported project to the local Project Room in this tab?\n\nProject Room will show a second confirmation before replacing its current local project. Nothing runs automatically.')) return;
    try {
      sessionStorage.setItem(HANDOFF_KEY, JSON.stringify(packet));
      location.href = '../../tools/project-room/index.html?guest-handoff=1';
    } catch (error) { toast('Local handoff could not be prepared. Use the downloaded .axm.json file instead.'); }
  }
  function resetToWelcome() {
    if (hasProjectContent() && !window.confirm('Discard this guest session?\n\nIts tab memory will be erased. Export first if you need the project.')) return;
    clearStoredSession();
    state = freshState();
    lastTick = performance.now();
    showCurrentView();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  $('startSession').addEventListener('click', function () { startSession(); });
  $('loadExample').addEventListener('click', function () { startSession(starterProject()); });
  $('retrySession').addEventListener('click', function () { state = freshState(); startSession(); });
  $('endedImport').addEventListener('click', function () { $('importFile').click(); });
  $('importButton').addEventListener('click', function () { if (state.status === 'grace') toast('Export or start fresh before importing.'); else $('importFile').click(); });
  $('importFile').addEventListener('change', function () { importFile(this.files && this.files[0]); });
  ['exportButton', 'mainExport', 'expiryExport'].forEach(function (name) { $(name).addEventListener('click', downloadExport); });
  $('resetSession').addEventListener('click', resetToWelcome);
  $('projectForm').addEventListener('submit', function (event) { event.preventDefault(); if (!isEditable()) return; syncProjectFromInputs(); markChanged('Project signal saved.'); renderProject(); });
  ['projectTitle', 'projectLead', 'projectPurpose', 'northStar', 'scratchpad'].forEach(function (name) {
    $(name).addEventListener('input', function () { if (!isEditable()) return; syncProjectFromInputs(); markChanged(); renderProject(); });
  });
  $('addCard').addEventListener('click', function () { openCard(''); });
  $('board').addEventListener('click', function (event) {
    var article = event.target.closest('[data-card]');
    if (!article) return;
    var move = event.target.closest('[data-move]');
    var open = event.target.closest('[data-open]');
    if (move) moveCard(article.dataset.card, move.dataset.move);
    if (open) openCard(open.dataset.open);
  });
  $('cardForm').addEventListener('submit', function (event) { event.preventDefault(); saveCard(); });
  $('closeCard').addEventListener('click', closeCard);
  $('cancelCard').addEventListener('click', closeCard);
  $('deleteCard').addEventListener('click', function () {
    var card = state.project.cards.find(function (candidate) { return candidate.id === $('cardId').value; });
    if (!card || !window.confirm('Delete “' + card.title + '”?')) return;
    state.project.cards = state.project.cards.filter(function (candidate) { return candidate.id !== card.id; });
    markChanged('Work card deleted.');
    renderProject();
    closeCard();
  });
  $('shareButton').addEventListener('click', shareDoorway);
  $('localHandoff').addEventListener('click', openLocalHandoff);
  document.addEventListener('visibilitychange', function () { lastTick = performance.now(); updateTimer(); });
  window.addEventListener('beforeunload', function (event) {
    if ((state.status === 'active' || state.status === 'grace') && hasUnsavedExport()) {
      event.preventDefault();
      event.returnValue = '';
    }
  });

  setExternalLinks();
  showCurrentView();
  if (state.status === 'ended') clearStoredSession();
  setInterval(tick, 250);
}());
