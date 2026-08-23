(function () {
  'use strict';

  var Core = window.AXMCollaborationRoom;
  var selectedActor = 'mike';
  var selectedScenario = 'plan';
  var positions = {
    mike: [50, 12],
    fabric: [78, 31],
    atlas: [82, 67],
    nursery: [59, 86],
    evidence: [27, 82],
    mirror: [13, 55],
    ai: [20, 22]
  };

  function byId(id) { return document.getElementById(id); }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function make(tag, className, value) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (value !== undefined) node.textContent = String(value);
    return node;
  }
  function actor(id) {
    return Core.COLLABORATORS.find(function (item) { return item.id === id; });
  }
  function lineCoordinates(id) {
    var point = positions[id];
    return { x: point[0] * 10, y: point[1] * 6.8 };
  }
  function renderLinks(active) {
    var svg = byId('links');
    clear(svg);
    Core.COLLABORATORS.forEach(function (item) {
      var point = lineCoordinates(item.id);
      var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', '500');
      line.setAttribute('y1', '340');
      line.setAttribute('x2', String(point.x));
      line.setAttribute('y2', String(point.y));
      if (active.indexOf(item.id) >= 0) line.setAttribute('class', 'active');
      svg.appendChild(line);
    });
  }
  function renderActors(active) {
    var root = byId('actors');
    clear(root);
    Core.COLLABORATORS.forEach(function (item) {
      var button = make('button', 'actor-node tone-' + item.tone);
      button.type = 'button';
      button.dataset.actorId = item.id;
      button.style.setProperty('--left', positions[item.id][0] + '%');
      button.style.setProperty('--top', positions[item.id][1] + '%');
      button.classList.toggle('route-active', active.indexOf(item.id) >= 0);
      button.classList.toggle('selected', selectedActor === item.id);
      button.setAttribute('role', 'listitem');
      button.setAttribute('aria-label', 'Inspect ' + item.name + ', ' + item.state);
      button.append(make('span', 'glyph', item.glyph), make('span', 'name', item.name), make('span', 'node-state', item.state));
      button.addEventListener('click', function () {
        selectedActor = item.id;
        renderActorInspector();
        renderActors(Core.scenario(selectedScenario).active);
      });
      root.appendChild(button);
    });
  }
  function list(root, values) {
    clear(root);
    values.forEach(function (value) { root.appendChild(make('li', null, value)); });
  }
  function renderActorInspector() {
    var item = actor(selectedActor) || Core.COLLABORATORS[0];
    var portrait = byId('portrait');
    portrait.className = 'portrait tone-' + item.tone;
    portrait.querySelector('span').textContent = item.glyph;
    byId('actor-kind').textContent = item.kind;
    byId('actor-name').textContent = item.name;
    byId('actor-state').textContent = item.state;
    byId('actor-role').textContent = item.role;
    byId('actor-evidence').textContent = item.evidence;
    list(byId('actor-can'), item.can);
    list(byId('actor-cannot'), item.cannot);
  }
  function renderScenario() {
    var value = Core.scenario(selectedScenario);
    byId('scenario-state').textContent = value.state;
    byId('scenario-title').textContent = value.label;
    byId('scenario-summary').textContent = value.summary;
    byId('next-gate').textContent = value.nextGate;
    byId('core-state').textContent = value.id.toUpperCase();
    clear(byId('flow'));
    value.flow.forEach(function (step) { byId('flow').appendChild(make('li', null, step)); });
    Array.prototype.forEach.call(document.querySelectorAll('[data-scenario]'), function (button) {
      button.classList.toggle('selected', button.dataset.scenario === selectedScenario);
    });
    renderLinks(value.active);
    renderActors(value.active);
  }
  function setStatus(message, tone) {
    byId('status').textContent = message;
    byId('status').className = tone || '';
  }
  function prepareDecision(decision) {
    try {
      var draft = Core.buildDecisionDraft({
        goal: byId('goal').value,
        decision: decision,
        candidateDigest: byId('candidate-digest').value,
        note: byId('decision-note').value,
        acknowledgement: byId('draft-ack').checked
      });
      Core.validateDecisionDraft(draft);
      byId('draft-state').textContent = draft.status;
      byId('draft-json').textContent = JSON.stringify(draft, null, 2);
      setStatus('Draft prepared in page memory. Real effect: NONE. Next: ' + draft.nextGate + '.', 'ok');
    } catch (error) {
      byId('draft-state').textContent = 'DRAFT REFUSED';
      byId('draft-json').textContent = 'No record emitted.';
      setStatus(error.message, 'error');
    }
  }
  function clearDraft() {
    byId('draft-state').textContent = 'NO DRAFT';
    byId('draft-json').textContent = 'Choose Hold, Ask repair, or Prepare trial.';
    byId('draft-ack').checked = false;
    setStatus('Ephemeral draft cleared. Nothing had been submitted, saved, or authorized.');
  }

  Array.prototype.forEach.call(document.querySelectorAll('[data-scenario]'), function (button) {
    button.addEventListener('click', function () { selectedScenario = button.dataset.scenario; renderScenario(); });
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-decision]'), function (button) {
    button.addEventListener('click', function () { prepareDecision(button.dataset.decision); });
  });
  byId('clear-draft').addEventListener('click', clearDraft);

  renderScenario();
  renderActorInspector();
}());
