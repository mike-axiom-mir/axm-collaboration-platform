(function () {
  'use strict';

  var MIKE = 'actor:human:mike';
  var data = { status: null, entities: [], proposals: [], events: [], adapters: [], selected: null, preview: null };
  var $ = function (id) { return document.getElementById(id); };

  async function json(url, options) {
    var response = await fetch(url, Object.assign({ cache: 'no-store' }, options || {}));
    var body = await response.json().catch(function () { return {}; });
    if (!response.ok || body.ok === false) throw new Error(body.error || ('HTTP ' + response.status));
    return body;
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function text(node, value) {
    node.textContent = value == null ? '' : String(value);
    return node;
  }

  function make(tag, className, value) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (value !== undefined) text(node, value);
    return node;
  }

  function pretty(value) {
    return JSON.stringify(value == null ? null : value, null, 2);
  }

  function statusTone(value) {
    if (['VERIFIED', 'APPLIED', 'APPROVED', 'ROLLED_BACK', 'VALIDATED'].indexOf(value) >= 0) return 'ok';
    if (['REJECTED', 'FAILED', 'CONFLICTED', 'EXPIRED'].indexOf(value) >= 0) return 'bad';
    return 'warn';
  }

  function renderStatus() {
    var root = $('statusCards');
    clear(root);
    var s = data.status;
    var cards = [
      ['Entities', s.counts.entities, 'canonical registry'],
      ['Proposals', s.counts.proposals, 'every direction'],
      ['Applications', s.counts.applications, 'approved only'],
      ['Snapshots', s.counts.snapshots, 'before + after'],
      ['Events', s.counts.events, 'append-only local'],
      ['Journal', s.journal.ok ? 'PASS' : 'FAIL', s.journal.ok ? 'hash chain intact' : 'review required']
    ];
    cards.forEach(function (item) {
      var card = make('article', 'status-card');
      card.appendChild(make('label', '', item[0]));
      card.appendChild(make('strong', '', item[1]));
      card.appendChild(make('small', '', item[2]));
      root.appendChild(card);
    });
    $('lastUpdated').textContent = 'Revision ' + s.revision + ' · authority ' + s.authority_revision + ' · ' + new Date().toLocaleTimeString();
    var warning = $('warning');
    warning.hidden = s.journal.ok;
    warning.textContent = s.journal.ok ? '' : 'Journal verification failed. Stop application work and inspect the local log.';
  }

  function renderAdapters() {
    var root = $('adapters');
    clear(root);
    data.adapters.forEach(function (item) {
      var d = item.descriptor;
      var card = make('article', 'adapter-card');
      var head = make('div', 'adapter-head');
      var title = make('div');
      title.appendChild(make('div', 'eyebrow', d.system_type));
      title.appendChild(make('h3', '', d.source_system_id));
      head.appendChild(title);
      head.appendChild(make('span', 'chip ' + (item.connection.mode === 'approved_apply' ? 'ready' : 'warn'), item.connection.mode.toUpperCase()));
      card.appendChild(head);
      card.appendChild(make('p', '', d.limitations.join(' · ')));
      var meta = make('div', 'adapter-meta');
      meta.appendChild(make('span', 'chip', d.adapter_id));
      meta.appendChild(make('span', 'chip', 'rev ' + item.health.revision));
      meta.appendChild(make('span', 'chip', item.health.ok ? 'HEALTHY' : 'UNAVAILABLE'));
      card.appendChild(meta);
      root.appendChild(card);
    });
  }

  function renderEntities() {
    var root = $('entities');
    var query = String($('entityFilter').value || '').toLowerCase();
    clear(root);
    data.entities.filter(function (entity) {
      return !query || [entity.name, entity.entity_type, entity.source_system, entity.mirror_id].join(' ').toLowerCase().indexOf(query) >= 0;
    }).forEach(function (entity) {
      var row = document.createElement('tr');
      var name = document.createElement('td');
      name.appendChild(make('b', '', entity.name));
      name.appendChild(make('small', '', entity.mirror_id));
      row.appendChild(name);
      row.appendChild(make('td', '', entity.entity_type));
      row.appendChild(make('td', '', entity.source_system));
      row.appendChild(make('td', '', entity.truth_facets.verification + ' · ' + entity.truth_facets.connection));
      row.appendChild(make('td', '', entity.revision || 1));
      root.appendChild(row);
    });
  }

  function renderProposalList() {
    var root = $('proposalList');
    clear(root);
    $('proposalCount').textContent = data.proposals.length + ' PACKET' + (data.proposals.length === 1 ? '' : 'S');
    if (!data.proposals.length) {
      root.appendChild(make('div', 'empty', 'No proposal packets in local state.'));
      return;
    }
    data.proposals.slice().sort(function (a, b) { return b.created_at.localeCompare(a.created_at); }).forEach(function (packet) {
      var button = make('button', 'proposal-card' + (data.selected && data.selected.packet_id === packet.packet_id ? ' selected' : ''));
      button.type = 'button';
      button.appendChild(make('strong', '', packet.intent || packet.packet_id));
      var meta = make('span');
      meta.appendChild(make('em', '', packet.status));
      meta.appendChild(make('span', '', packet.source_system + ' → ' + packet.target_system));
      button.appendChild(meta);
      button.addEventListener('click', function () { selectProposal(packet.packet_id); });
      root.appendChild(button);
    });
  }

  function actionButton(label, className, fn) {
    var button = make('button', className, label);
    button.type = 'button';
    button.addEventListener('click', fn);
    return button;
  }

  async function perform(url, body) {
    var resultNode = $('actionResult');
    resultNode.hidden = false;
    resultNode.textContent = 'Working through the local gate…';
    try {
      var result = await json(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body || {})
      });
      resultNode.textContent = 'Completed · ' + (result.packet && result.packet.status || result.status || result.rollback && result.rollback.status || 'receipt returned');
      await refresh();
      if (data.selected) await selectProposal(data.selected.packet_id);
    } catch (error) {
      resultNode.textContent = 'Refused / failed · ' + error.message;
    }
  }

  function renderActions(packet) {
    var root = $('reviewActions');
    clear(root);
    var base = '/mirror/proposals/' + encodeURIComponent(packet.packet_id);
    if (packet.status === 'DRAFT') root.appendChild(actionButton('Validate packet', 'secondary', function () { perform(base + '/validate', { actor_id: MIKE }); }));
    if (packet.status === 'VALIDATED') root.appendChild(actionButton('Submit proposal', 'secondary', function () { perform(base + '/propose', { actor_id: MIKE }); }));
    if (packet.status === 'PROPOSED') root.appendChild(actionButton('Start review', 'secondary', function () { perform(base + '/review', { actor_id: MIKE, note: 'Dashboard review opened.' }); }));
    if (packet.status === 'PROPOSED' || packet.status === 'UNDER_REVIEW') {
      root.appendChild(actionButton('Approve proposal', 'approve', function () { perform(base + '/approve', { actor_id: MIKE, reason: 'Approved from the visible local review surface.' }); }));
      root.appendChild(actionButton('Reject proposal', 'reject', function () { perform(base + '/reject', { actor_id: MIKE, reason: 'Rejected from the visible local review surface.' }); }));
      root.appendChild(actionButton('Request amendment', 'warning-button', function () { perform(base + '/amend', { actor_id: MIKE, reason: 'Amendment requested from the visible local review surface.' }); }));
    }
    if (packet.status === 'APPROVED') root.appendChild(actionButton('Apply approved packet', 'approve', function () { perform(base + '/apply', { actor_id: MIKE }); }));
    var application = packet.application_receipt;
    if (application && packet.status === 'APPLIED') {
      root.appendChild(actionButton('Verify application', 'secondary', function () { perform('/mirror/applications/' + encodeURIComponent(application.application_id) + '/verify', { actor_id: MIKE }); }));
    }
    if (application && (packet.status === 'APPLIED' || packet.status === 'VERIFIED')) {
      root.appendChild(actionButton('Roll back application', 'reject', function () { perform('/mirror/applications/' + encodeURIComponent(application.application_id) + '/rollback', { actor_id: MIKE }); }));
    }
    if (!root.children.length) root.appendChild(make('span', 'muted', 'No transition is available from this terminal state.'));
  }

  function renderReview() {
    var packet = data.selected;
    $('emptyReview').hidden = !!packet;
    $('review').hidden = !packet;
    var badge = $('proposalStatus');
    if (!packet) {
      badge.textContent = 'NO PROPOSAL SELECTED';
      badge.className = 'state neutral';
      return;
    }
    badge.textContent = packet.status;
    badge.className = 'state ' + statusTone(packet.status);
    $('reviewSource').textContent = packet.source_system;
    $('reviewTarget').textContent = packet.target_system;
    $('reviewActor').textContent = packet.actor.display_name + ' · ' + packet.actor.actor_type;
    $('reviewRisk').textContent = packet.risk_level.toUpperCase();
    $('reviewReversibility').textContent = packet.reversibility;
    $('reviewEvidence').textContent = packet.evidence_refs.length + ' reference' + (packet.evidence_refs.length === 1 ? '' : 's');
    $('reviewIntent').textContent = packet.intent;
    $('reviewReason').textContent = packet.reason;
    $('reviewOperations').textContent = pretty(packet.operations);
    $('reviewDiff').textContent = pretty(data.preview && data.preview.adapter_preview && data.preview.adapter_preview.diff || { note: 'preview unavailable' });
    $('reviewUnknowns').textContent = pretty(data.preview && data.preview.truth_unknowns || []);
    $('reviewConflicts').textContent = pretty(data.preview && data.preview.conflicts || []);
    renderActions(packet);
  }

  function renderEvents() {
    var root = $('events');
    clear(root);
    data.events.slice(-100).reverse().forEach(function (event) {
      var row = make('div', 'event');
      row.appendChild(make('time', '', new Date(event.timestamp).toLocaleString()));
      row.appendChild(make('strong', '', event.event_type));
      row.appendChild(make('span', '', (event.actor.display_name || event.actor.actor_id || 'Unknown actor') + (event.related_packet ? ' · ' + event.related_packet : '')));
      row.appendChild(make('code', 'hash', event.event_hash.slice(0, 16)));
      root.appendChild(row);
    });
  }

  async function selectProposal(packetId) {
    try {
      var found = data.proposals.find(function (packet) { return packet.packet_id === packetId; });
      if (!found) {
        data.selected = null;
        data.preview = null;
      } else {
        data.selected = found;
        var result = await json('/mirror/proposals/' + encodeURIComponent(packetId) + '/preview', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{}'
        });
        data.preview = result.preview;
      }
    } catch (error) {
      data.preview = { conflicts: [{ type: 'preview_error', error: error.message }] };
    }
    renderProposalList();
    renderReview();
  }

  async function refresh() {
    try {
      var results = await Promise.all([
        json('/health'),
        json('/mirror/entities'),
        json('/mirror/proposals'),
        json('/mirror/events'),
        json('/mirror/adapters')
      ]);
      data.status = results[0];
      data.entities = results[1].items;
      data.proposals = results[2].items;
      data.events = results[3].items;
      data.adapters = results[4].items;
      if (data.selected) data.selected = data.proposals.find(function (packet) { return packet.packet_id === data.selected.packet_id; }) || null;
      renderStatus();
      renderAdapters();
      renderEntities();
      renderProposalList();
      renderReview();
      renderEvents();
    } catch (error) {
      var warning = $('warning');
      warning.hidden = false;
      warning.textContent = 'Dashboard could not load local state: ' + error.message;
    }
  }

  $('refresh').addEventListener('click', refresh);
  $('reset').addEventListener('click', function () {
    if (!confirm('Reset deterministic mock state? Source files are preserved; runtime history is replaced.')) return;
    perform('/demo/reset', {});
  });
  $('entityFilter').addEventListener('input', renderEntities);
  refresh();
}());
