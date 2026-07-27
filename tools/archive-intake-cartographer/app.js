'use strict';

(function () {
  const map = window.AXM_ARCHIVE_INTAKE_MAP;
  const summaryGrid = document.getElementById('summary-grid');
  const archiveList = document.getElementById('archive-list');
  const relationList = document.getElementById('relation-list');
  const relationCounts = document.getElementById('relation-counts');

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

  function shortPath(value) {
    const parts = String(value).split('/');
    return parts.length > 3 ? '…/' + parts.slice(-3).join('/') : value;
  }

  function archiveRow(archive) {
    const row = make('article', 'archive-row');
    const identity = make('div', 'archive-identity');
    identity.append(
      make('strong', null, shortPath(archive.relativePath)),
      make('code', null, archive.sha256 ? archive.sha256.slice(0, 20) : 'digest unavailable')
    );
    const facts = make('div', 'archive-facts');
    facts.append(
      make('span', null, archive.zipEntriesDeclared + ' entries'),
      make('span', null, archive.fileEntries + ' files'),
      make('span', null, archive.bytes.toLocaleString() + ' bytes')
    );
    row.append(
      identity,
      facts,
      make('span', 'status ' + archive.status.toLowerCase().replaceAll('_', '-'), archive.status.replaceAll('_', ' '))
    );
    return row;
  }

  function relationRow(relation) {
    const row = make('article', 'relation-row');
    const paths = make('div', 'relation-paths');
    paths.append(
      make('span', null, shortPath(relation.left)),
      make('span', 'arrow', '↔'),
      make('span', null, shortPath(relation.right))
    );
    const metrics = make('div', 'relation-metrics');
    metrics.append(
      make('span', null, relation.pathIntersection + ' shared paths'),
      make('span', null, relation.identicalAtSamePath + ' unchanged'),
      make('span', null, relation.changedAtSamePath + ' changed')
    );
    row.append(
      make('strong', 'relation-kind', relation.kind.replaceAll('_', ' ')),
      paths,
      metrics
    );
    return row;
  }

  if (!map || map.schema !== 'axm.archive-intake-map/v1') {
    archiveList.appendChild(make('p', 'empty', 'Archive map unavailable. Run archive-cli.js with --browser-output current-archive-map.js.'));
    return;
  }

  document.getElementById('measured-at').textContent = 'Measured ' + map.measuredAt + ' · ' + map.source.label;
  document.getElementById('fingerprint').textContent = map.source.fingerprint.slice(0, 20);
  summary('Archives', map.summary.totalArchives, 'neutral');
  summary('Unique bytes', map.summary.uniqueArchiveDigests, 'ready');
  summary('Exact duplicates', map.summary.exactDuplicateCopies, 'duplicate');
  summary('Review holds', map.summary.reviewRequired, 'review');
  summary('Repair holds', map.summary.needsRepair, 'repair');

  for (const archive of map.archives) archiveList.appendChild(archiveRow(archive));

  const counts = Object.entries(map.summary.relationCounts)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
  for (const [kind, count] of counts) {
    const chip = make('span', kind === 'DISJOINT_PATHS' ? 'relation-chip quiet-chip' : 'relation-chip');
    chip.append(make('strong', null, count), make('span', null, kind.replaceAll('_', ' ')));
    relationCounts.appendChild(chip);
  }

  const meaningful = map.relations
    .filter(relation => relation.kind !== 'DISJOINT_PATHS')
    .sort((left, right) => left.kind.localeCompare(right.kind) || left.left.localeCompare(right.left));
  if (!meaningful.length) {
    relationList.appendChild(make('p', 'empty', 'No non-disjoint archive relationships were found.'));
  } else {
    for (const relation of meaningful) relationList.appendChild(relationRow(relation));
  }
}());
