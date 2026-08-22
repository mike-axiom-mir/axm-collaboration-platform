'use strict';

(function () {
  const map = window.AXM_MODULE_FOOTPRINT_MAP;
  const pressure = window.AXM_STORAGE_PRESSURE_MAP;
  const summaryGrid = document.getElementById('summary-grid');
  const moduleList = document.getElementById('module-list');
  const pressureGrid = document.getElementById('pressure-summary-grid');
  const classList = document.getElementById('class-list');
  const duplicateList = document.getElementById('duplicate-list');
  const fanoutList = document.getElementById('fanout-list');

  function make(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = String(text);
    return element;
  }

  function bytes(value) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let amount = Number(value) || 0;
    let index = 0;
    while (amount >= 1024 && index < units.length - 1) {
      amount /= 1024;
      index += 1;
    }
    return amount.toFixed(index ? 1 : 0) + ' ' + units[index];
  }

  function summary(label, value, tone) {
    const card = make('article', 'summary-card ' + tone);
    card.append(make('strong', null, value), make('span', null, label));
    summaryGrid.appendChild(card);
  }

  function pressureSummary(label, value, tone) {
    const card = make('article', 'summary-card ' + tone);
    card.append(make('strong', null, value), make('span', null, label));
    pressureGrid.appendChild(card);
  }

  if (!map || map.schema !== 'axm.module-footprint-map/v1') {
    moduleList.appendChild(make('p', 'empty', 'Footprint map unavailable. Run footprint-cli.js with --browser-output current-footprint-map.js.'));
    return;
  }

  document.getElementById('measured-at').textContent = 'Measured ' + map.measuredAt + ' · ' + map.source.label;
  document.getElementById('fingerprint').textContent = map.source.footprintFingerprint.slice(0, 20);
  summary('Modules', map.summary.modules, 'neutral');
  summary('Active files', map.summary.files, 'good');
  summary('Active bytes', bytes(map.summary.bytes), 'good');
  summary('Skipped symlinks', map.summary.skippedSymlinks, 'hold');
  summary('Read issues', map.summary.readIssues, 'unknown');

  map.modules.slice().sort((left, right) => right.bytes - left.bytes || left.id.localeCompare(right.id)).forEach(module => {
    const row = make('article', 'row');
    const identity = make('div', 'identity');
    identity.append(make('strong', null, module.id), make('code', null, module.status + ' · ' + module.version));
    const totals = make('div', 'totals');
    totals.append(make('strong', null, bytes(module.bytes)), make('span', null, module.files + ' regular file(s)'));
    const details = make('div', 'details');
    details.append(
      make('span', null, module.largestFile ? 'Largest · ' + module.largestFile.path + ' · ' + bytes(module.largestFile.bytes) : 'No regular files'),
      make('span', null, 'Extensions · ' + module.extensions.slice(0, 5).map(item => item.extension + ' ' + bytes(item.bytes)).join(' · ')),
      make('span', null, 'Excluded ' + module.excludedDirectories.length + ' · symlinks ' + module.skippedSymlinks.length + ' · issues ' + module.readIssues.length)
    );
    row.append(identity, totals, details);
    moduleList.appendChild(row);
  });
  if (!map.modules.length) moduleList.appendChild(make('p', 'empty', 'No top-level module manifests observed.'));

  if (!pressure || pressure.schema !== 'axm.storage-pressure-map/v1') {
    classList.appendChild(make('p', 'empty', 'Generate current-storage-pressure-map.js with storage-pressure-cli.js.'));
    duplicateList.appendChild(make('p', 'empty', 'No pressure snapshot loaded.'));
    fanoutList.appendChild(make('p', 'empty', 'No pressure snapshot loaded.'));
    return;
  }

  document.getElementById('pressure-state').textContent = pressure.measuredAt + ' / ' + pressure.growth.state.replaceAll('_', ' ');
  pressureSummary('Roots', pressure.summary.roots, 'neutral');
  pressureSummary('All files', pressure.summary.files, 'good');
  pressureSummary('Logical bytes', bytes(pressure.summary.logicalBytes), 'good');
  pressureSummary('Allocated estimate', bytes(pressure.summary.allocatedBytesEstimate), 'hold');
  pressureSummary('Duplicate bytes', bytes(pressure.summary.exactDuplicatePhysicalBytes), 'unknown');
  pressureSummary('Duplicate groups', pressure.summary.exactDuplicateGroups, 'unknown');

  pressure.retentionClasses.slice().sort((left, right) => right.logicalBytes - left.logicalBytes || left.id.localeCompare(right.id)).forEach(item => {
    const row = make('article', 'row pressure-row');
    row.append(
      make('code', null, item.id.replaceAll('_', ' ')),
      make('strong', null, bytes(item.logicalBytes)),
      make('span', null, item.files + ' file(s)'),
      make('small', null, item.exactDuplicateGroupMemberships + ' exact duplicate group membership(s)')
    );
    classList.appendChild(row);
  });

  pressure.exactDuplicateGroups.slice(0, 25).forEach(group => {
    const first = group.paths[0];
    const row = make('article', 'row pressure-row ' + (group.reviewState === 'LOWER_RISK_REVIEW' ? 'review-row' : 'hold-row'));
    row.append(
      make('code', null, bytes(group.redundantPhysicalBytes)),
      make('strong', null, group.filePaths + ' equal path(s)'),
      make('span', null, group.reviewState.replaceAll('_', ' ')),
      make('small', null, first ? first.rootId + ':' + first.path : group.id)
    );
    duplicateList.appendChild(row);
  });
  if (!pressure.exactDuplicateGroups.length) duplicateList.appendChild(make('p', 'empty', 'No exact duplicate group observed in this snapshot.'));

  pressure.directoryPressure.slice(0, 25).forEach(directory => {
    const row = make('article', 'row pressure-row');
    row.append(
      make('code', null, directory.rootId),
      make('strong', null, directory.immediateEntries + ' entries'),
      make('span', null, directory.immediateFiles + ' files / ' + directory.immediateDirectories + ' folders'),
      make('small', null, directory.path)
    );
    fanoutList.appendChild(row);
  });
}());
