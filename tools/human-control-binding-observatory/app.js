'use strict';

(function () {
  const map = window.AXM_HUMAN_CONTROL_BINDING_MAP;
  const request = window.AXM_HUMAN_CONTROL_BINDING_REVIEW_REQUEST;
  const byId = id => document.getElementById(id);
  const make = (tag, cls, text) => {
    const element = document.createElement(tag);
    if (cls) element.className = cls;
    if (text !== undefined) element.textContent = String(text);
    return element;
  };
  const card = (label, value, tone) => {
    const element = make('article', 'card ' + tone);
    element.append(make('strong', null, value), make('span', null, label));
    byId('summary').appendChild(element);
  };
  if (!map || map.schema !== 'axm.human-control-binding-map/v1') {
    byId('modules').appendChild(make('p', 'empty', 'Generate current-human-control-binding-map.js.'));
    return;
  }
  byId('measured').textContent = 'Measured ' + map.measuredAt + ' · graph ' + map.source.graphFingerprint.slice(0, 12);
  byId('fingerprint').textContent = map.source.fingerprint.slice(0, 20);
  card('Controls', map.summary.controls, 'neutral');
  card('Static bindings', map.summary.staticBindings, 'good');
  card('Native actions', map.summary.nativeActions, 'good');
  card('No static evidence', map.summary.noStaticBindingEvidence, 'review');
  card('Unnamed observations', map.summary.unnamedControlObservations, 'hold');
  card('Duplicate ID groups', map.summary.duplicateIdGroups, 'issue');
  if (request && request.schema === 'axm.human-control-binding-review-request/v1') {
    byId('request-state').textContent = request.summary.questionsAnswered + ' ANSWERED · ' + request.summary.questionsRequested + ' REQUESTED';
    byId('request').replaceChildren(make('strong', null, request.selectedModule.moduleId), make('p', null, request.summary.controlsSelected + ' selected controls · browser and human review remain unrun'));
  }
  map.reviewModules.forEach(module => {
    const row = make('article', 'row');
    row.append(make('code', null, module.moduleId), make('strong', null, module.noStaticBindingEvidence + ' no static match'), make('span', null, module.unnamedControlObservations + ' unnamed · ' + module.duplicateIdGroups + ' duplicate ID groups'), make('small', null, module.state.replaceAll('_', ' ')));
    byId('modules').appendChild(row);
  });
  map.modules.flatMap(module => module.controls.map(control => ({ moduleId: module.id, control }))).forEach(item => {
    const row = make('article', 'row');
    row.append(make('code', null, item.moduleId + ' · ' + item.control.tag), make('strong', null, item.control.accessibleNameObservation || item.control.id || 'unnamed'), make('span', null, item.control.bindingState.replaceAll('_', ' ')), make('small', null, item.control.entryPath + ':' + item.control.line));
    byId('controls').appendChild(row);
  });
}());
