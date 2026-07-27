'use strict';

(function () {
  const map = window.AXM_DUAL_DOOR_MAP;
  const request = window.AXM_DOOR_REVIEW_REQUEST;
  const summaryGrid = document.getElementById('summary-grid');
  const moduleList = document.getElementById('module-list');

  function make(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = String(text);
    return element;
  }

  function summary(label, value, tone) {
    const card = make('article', 'summary-card ' + tone);
    card.append(make('strong', null, value), make('span', null, label));
    summaryGrid.appendChild(card);
  }

  if (!map || map.schema !== 'axm.dual-door-map/v1') {
    moduleList.appendChild(make('p', 'empty', 'Dual door map unavailable. Generate current-dual-door-map.js.'));
    return;
  }

  document.getElementById('measured-at').textContent = 'Measured ' + map.measuredAt + ' · ' + map.source.label;
  document.getElementById('fingerprint').textContent = map.source.fingerprint.slice(0, 20);
  summary('Modules', map.summary.modules, 'neutral');
  summary('Human doors present', map.summary.humanDoorsPresent, 'good');
  summary('Machine doors present', map.summary.machineDoorsPresent, 'machine');
  summary('Optional machine absence', map.summary.machineDoorsOptionalNotDeclared, 'hold');
  summary('Door issues', map.summary.humanDoorIssues + map.summary.machineDoorIssues, 'unknown');

  if (request && request.schema === 'axm.door-review-request/v1') {
    const requestState = document.getElementById('request-state');
    const requestDetail = document.getElementById('request-detail');
    const requestChecks = document.getElementById('request-checks');
    requestState.textContent = request.summary.checksRun + ' RUN · ' + request.summary.checksRequested + ' REQUESTED';
    requestDetail.replaceChildren();
    const identity = make('div', 'request-identity');
    identity.append(
      make('span', null, request.selectedDoor.kind + ' DOOR'),
      make('strong', null, request.selectedModule.id),
      make('code', null, request.selectedDoor.path)
    );
    const selection = make('div', 'request-selection');
    selection.append(
      make('span', null, request.selectedAction ? 'DECLARED ACTION' : 'REVIEW TYPE'),
      make('strong', null, request.selectedAction ? request.selectedAction.id : 'visible route review'),
      make('small', null, 'No command, fixture, or execution included')
    );
    requestDetail.append(identity, selection);
    request.checks.forEach(check => {
      const row = make('article', 'request-check');
      row.append(make('code', null, check.id), make('strong', null, check.state.replaceAll('_', ' ')));
      requestChecks.appendChild(row);
    });
  }

  map.modules.forEach(module => {
    const row = make('article', 'row');
    const identity = make('div', 'identity');
    identity.append(make('strong', null, module.id), make('code', null, module.status + ' · ' + module.version));
    const human = make('div', 'door human');
    human.append(make('span', null, 'HUMAN'), make('strong', null, module.human.state), make('code', null, module.human.path || 'not declared'));
    const machine = make('div', 'door machine');
    machine.append(
      make('span', null, 'MACHINE'),
      make('strong', null, module.machine.entry.state),
      make('code', null, module.machine.entry.path || 'optional · not declared'),
      make('small', null, module.machine.actions.length + ' action declaration(s) · ' + module.machine.actionShape.replaceAll('_', ' '))
    );
    row.append(identity, human, machine);
    moduleList.appendChild(row);
  });
}());
