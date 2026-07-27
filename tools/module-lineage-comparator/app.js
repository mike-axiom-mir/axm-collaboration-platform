'use strict';

(function () {
  const comparison = window.AXM_MODULE_LINEAGE_COMPARISON;
  const summaryGrid = document.getElementById('summary-grid');
  const fileList = document.getElementById('file-list');
  const declaredList = document.getElementById('declared-list');

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

  function bundle(prefix, bundle) {
    document.getElementById(prefix + '-label').textContent = bundle.label;
    document.getElementById(prefix + '-meta').textContent =
      (bundle.moduleId || 'module id unknown') + ' · ' +
      (bundle.manifestVersion || 'version unknown') + ' · ' +
      bundle.fileCount + ' files';
    document.getElementById(prefix + '-digest').textContent = bundle.canonicalDigest.slice(0, 24);
  }

  function fileRow(kind, record) {
    const row = make('article', 'delta-row ' + kind.toLowerCase());
    const identity = make('div', 'delta-identity');
    identity.append(make('strong', null, record.path), make('span', null, kind));
    let evidence = '';
    if (kind === 'CHANGED') {
      evidence = record.baselineSha256.slice(0, 12) + ' → ' + record.candidateSha256.slice(0, 12);
    } else {
      evidence = record.sha256.slice(0, 18);
    }
    row.append(identity, make('code', null, evidence));
    return row;
  }

  function declarationRow(group, item) {
    const row = make('article', 'declared-row');
    const identity = make('div');
    identity.append(make('span', 'group', group), make('strong', null, item.field));
    row.append(identity, make('span', 'state state-' + item.state.toLowerCase(), item.state));
    return row;
  }

  if (!comparison || comparison.schema !== 'axm.module-lineage-comparison/v1') {
    fileList.appendChild(make('p', 'empty', 'Comparison unavailable. Run lineage-cli.js with --browser-output current-comparison.js.'));
    return;
  }

  document.getElementById('measured-at').textContent = 'Measured ' + comparison.measuredAt;
  document.getElementById('fingerprint').textContent = comparison.fingerprint.slice(0, 20);
  document.getElementById('relation').textContent = comparison.relation.replaceAll('_', ' ');
  bundle('baseline', comparison.direction.baseline);
  bundle('candidate', comparison.direction.candidate);

  summary('Added files', comparison.summary.addedFiles, 'added');
  summary('Removed files', comparison.summary.removedFiles, 'removed');
  summary('Changed files', comparison.summary.changedFiles, 'changed');
  summary('Unchanged files', comparison.summary.unchangedFiles, 'same');
  summary('Structural issues', comparison.summary.structuralIssues, 'issue');

  const sections = [
    ['ADDED', comparison.fileDelta.added],
    ['REMOVED', comparison.fileDelta.removed],
    ['CHANGED', comparison.fileDelta.changed],
    ['UNCHANGED', comparison.fileDelta.unchanged]
  ];
  for (const [kind, rows] of sections) {
    for (const row of rows) fileList.appendChild(fileRow(kind, row));
  }
  if (!fileList.children.length) fileList.appendChild(make('p', 'empty', 'No file records.'));

  const groups = [
    ['MANIFEST', comparison.declaredDelta.manifestFields],
    ['CONTRACT', comparison.declaredDelta.contractFields]
  ];
  for (const [group, rows] of groups) {
    for (const row of rows) declaredList.appendChild(declarationRow(group, row));
  }
}());
