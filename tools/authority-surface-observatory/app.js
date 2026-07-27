'use strict';

(function () {
  const map = window.AXM_AUTHORITY_SURFACE_MAP;
  const summaryGrid = document.getElementById('summary-grid');
  const moduleList = document.getElementById('module-list');
  const permissionList = document.getElementById('permission-list');

  function make(tag, className, value) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (value !== undefined) element.textContent = String(value);
    return element;
  }

  function summary(label, value, tone) {
    const card = make('article', 'summary-card ' + tone);
    card.append(make('strong', null, value), make('span', null, label));
    summaryGrid.appendChild(card);
  }

  function moduleRow(module) {
    const row = make('article', 'module-row ' + module.state.toLowerCase().replaceAll('_', '-'));
    const identity = make('div', 'module-identity');
    identity.append(
      make('strong', null, module.id),
      make('span', null, module.version + ' · ' + module.status),
      make('code', null, module.state.replaceAll('_', ' '))
    );
    const counts = make('div', 'counts');
    counts.append(
      make('span', null, module.manifest.permissions.length + ' manifest permissions'),
      make('span', null, module.contract.permissions.length + ' contract permissions'),
      make('span', null, module.contract.writes.length + ' writes'),
      make('span', null, module.contract.refuses.length + ' refusals')
    );
    const findings = make('div', 'findings');
    for (const finding of module.findings) findings.appendChild(make('span', null, finding.replaceAll('_', ' ')));
    row.append(identity, counts, findings);
    return row;
  }

  function permissionRow(permission) {
    const row = make('article', 'permission-row');
    row.append(
      make('strong', null, permission.permission),
      make('span', null, 'manifest · ' + (permission.manifestDeclarers.join(', ') || 'none')),
      make('span', null, 'contract · ' + (permission.contractDeclarers.join(', ') || 'none')),
      make('span', null, 'uses · ' + (permission.manifestUsesDeclarers.join(', ') || 'none'))
    );
    return row;
  }

  if (!map || map.schema !== 'axm.authority-surface-map/v1') {
    moduleList.appendChild(make('p', 'empty', 'Authority map unavailable. Run authority-cli.js with --browser-output current-authority-map.js.'));
    return;
  }

  document.getElementById('measured-at').textContent = 'Measured ' + map.measuredAt + ' · ' + map.source.label;
  document.getElementById('fingerprint').textContent = map.source.fingerprint.slice(0, 20);
  summary('Modules', map.summary.modules, 'neutral');
  summary('Exact declarations', map.summary.exactDeclarations, 'exact');
  summary('Contract unknown', map.summary.contractAuthorityUnknown, 'unknown');
  summary('Incomplete', map.summary.incompleteDeclarations, 'incomplete');
  summary('Permission seams', map.summary.permissionDrift + map.summary.permissionOutsideUses + map.summary.contractIdDrift, 'drift');

  const seams = map.modules
    .filter(module => module.state !== 'EXACT_DECLARATION')
    .sort((left, right) => left.state.localeCompare(right.state) || left.id.localeCompare(right.id));
  for (const module of seams) moduleList.appendChild(moduleRow(module));
  if (!seams.length) moduleList.appendChild(make('p', 'empty', 'All scanned authority declarations are exact.'));

  for (const permission of map.permissions) permissionList.appendChild(permissionRow(permission));
  if (!map.permissions.length) permissionList.appendChild(make('p', 'empty', 'No permission tokens declared.'));
}());
