'use strict';

(function () {
  const map = window.AXM_MODULE_FOOTPRINT_MAP;
  const summaryGrid = document.getElementById('summary-grid');
  const moduleList = document.getElementById('module-list');

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
}());
