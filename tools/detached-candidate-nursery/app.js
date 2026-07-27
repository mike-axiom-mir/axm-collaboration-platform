'use strict';

(function () {
  const registry = window.AXM_CANDIDATE_REGISTRY;
  const summaryGrid = document.getElementById('summary-grid');
  const candidateList = document.getElementById('candidate-list');
  const archiveList = document.getElementById('archive-list');

  function text(element, value) {
    element.textContent = String(value);
  }

  function make(tag, className, value) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (value !== undefined) text(element, value);
    return element;
  }

  function summary(label, count, tone) {
    const card = make('article', 'summary-card ' + tone);
    card.append(make('strong', null, count), make('span', null, label));
    summaryGrid.appendChild(card);
  }

  function issueList(items, empty) {
    const list = make('ul', 'issues');
    if (!items.length) {
      list.appendChild(make('li', 'quiet', empty));
      return list;
    }
    for (const item of items.slice(0, 8)) {
      list.appendChild(make('li', null, item.code + (item.file ? ' · ' + item.file : '')));
    }
    return list;
  }

  function candidateCard(candidate) {
    const article = make('article', 'candidate');
    const head = make('div', 'candidate-head');
    const title = make('div');
    title.append(make('p', 'candidate-id', candidate.id || candidate.folder), make('h3', null, candidate.name));
    head.append(title, make('span', 'status ' + candidate.status.toLowerCase().replaceAll('_', '-'), candidate.status.replaceAll('_', ' ')));
    article.appendChild(head);
    const facts = make('div', 'facts');
    facts.append(
      make('span', null, (candidate.version || 'version unknown') + ' · ' + (candidate.declaredStatus || 'status unknown')),
      make('span', null, candidate.fileCount + ' files · ' + candidate.totalBytes + ' bytes'),
      make('code', null, candidate.bundle ? candidate.bundle.canonicalDigest.slice(0, 20) : 'no exact bundle yet')
    );
    article.appendChild(facts);
    const details = make('div', 'detail-grid');
    const errors = make('div');
    errors.append(make('h4', null, 'Errors'), issueList(candidate.errors, 'None'));
    const warnings = make('div');
    warnings.append(make('h4', null, 'Warnings'), issueList(candidate.warnings, 'None'));
    details.append(errors, warnings);
    article.appendChild(details);
    return article;
  }

  if (!registry || registry.schema !== 'axm.detached-candidate-registry/v1') {
    candidateList.appendChild(make('p', 'empty', 'Registry unavailable. Run nursery-cli.js with --browser-output current-registry.js.'));
    return;
  }

  text(document.getElementById('fingerprint'), registry.source.fingerprint.slice(0, 16));
  text(document.getElementById('measured-at'), 'Measured ' + registry.measuredAt + ' · ' + registry.source.label);
  summary('Total', registry.summary.total, 'neutral');
  summary('Ready later', registry.summary.readyForLaterIntake, 'ready');
  summary('Review', registry.summary.reviewRequired, 'review');
  summary('Drafts', registry.summary.drafts, 'draft');
  summary('Repair', registry.summary.needsRepair, 'repair');

  if (!registry.candidates.length) {
    candidateList.appendChild(make('p', 'empty', 'No detached candidate folders were found in this measured supply.'));
  } else {
    for (const candidate of registry.candidates) candidateList.appendChild(candidateCard(candidate));
  }

  if (!registry.archives.length) {
    archiveList.appendChild(make('p', 'empty', 'No sibling ZIP archives were present at measurement time.'));
  } else {
    for (const archive of registry.archives) {
      const row = make('article', 'archive-row');
      row.append(
        make('strong', null, archive.file),
        make('span', null, archive.bytes + ' bytes'),
        make('code', null, archive.sha256 || archive.digestStatus)
      );
      archiveList.appendChild(row);
    }
  }
}());
