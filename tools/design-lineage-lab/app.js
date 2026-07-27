'use strict';

const Core = globalThis.AXMDesignLineage;
const byId = id => document.getElementById(id);
let compiled = null;

const example = {
  schema: 'axm.design-lineage.bundle/v1',
  source_bundle_ref: 'platform-visual-pressure-test/example',
  records: [
    {
      source: { ref: 'chat/example#revive-icons', type: 'chat-extract' },
      subject: 'co-op revive icon family',
      kind: 'lesson',
      decision: 'revised',
      criterion: 'readability',
      observation: 'Three distinct silhouettes remained readable at game scale; colour-only variation did not.',
      reasons: ['silhouette survives desaturation', 'small-size recognition improved'],
      rules: [{ statement: 'Prefer silhouette variation before palette variation for small gameplay icons.', polarity: 'prefer', scope: 'game-ui/icons' }],
      artifact_ref: 'asset-fabric/revive-family'
    },
    {
      source: { ref: 'chat/example#transparent-cutout', type: 'chat-extract' },
      subject: 'top-down character cutout',
      kind: 'rejection',
      decision: 'rejected',
      criterion: 'transparency',
      observation: 'The generated checkerboard was painted into the image instead of becoming alpha.',
      reasons: ['false transparency breaks compositing'],
      rules: [{ statement: 'Reject checkerboard pixels presented as transparency.', polarity: 'required', scope: 'raster/cutouts' }]
    }
  ]
};

function clearNode(node, emptyText) {
  node.replaceChildren();
  if (emptyText) { node.className = 'list empty'; node.textContent = emptyText; }
  else node.className = 'list';
}

function item(title, meta, body, className) {
  const article = document.createElement('article');
  article.className = 'item ' + (className || '');
  const top = document.createElement('div'); top.className = 'item-top';
  const strong = document.createElement('strong'); strong.textContent = title;
  const pill = document.createElement('span'); pill.className = 'pill'; pill.textContent = meta;
  const paragraph = document.createElement('p'); paragraph.textContent = body;
  top.append(strong, pill); article.append(top, paragraph); return article;
}

function render(result) {
  const stats = result.stats;
  byId('admittedMetric').textContent = stats.admitted;
  byId('duplicateMetric').textContent = stats.exact_duplicates;
  byId('conflictMetric').textContent = stats.conflicts;
  byId('candidateMetric').textContent = stats.vocabulary_candidates;
  byId('receiptSummary').innerHTML = '<p><strong>' + result.id + '</strong><br>' + stats.exact_provenance + ' exact source digests · ' + stats.partial_provenance + ' partial references · ' + stats.invalid + ' invalid records<br>Authority: evidence ledger only; no automatic promotion.</p>';

  const records = byId('recordList'); clearNode(records, result.records.length ? '' : 'Nothing admitted.');
  result.records.forEach(record => records.append(item(record.subject, record.kind + ' · ' + record.decision, record.observation + ' [' + record.provenance + ']')));
  const conflicts = byId('conflictList'); clearNode(conflicts, result.conflicts.length ? '' : 'No conflicting decisions detected.');
  result.conflicts.forEach(conflict => conflicts.append(item(conflict.subject_criterion, conflict.status, conflict.decisions.join(' ↔ ') + ' · ' + conflict.records.length + ' evidence records', 'conflict')));
  const candidates = byId('candidateList'); clearNode(candidates, result.vocabulary_candidates.length ? '' : 'No reusable rules extracted.');
  result.vocabulary_candidates.forEach(candidate => candidates.append(item(candidate.statement, candidate.polarity + ' · ' + candidate.criterion, candidate.scope + ' · ' + candidate.evidence.length + ' evidence record(s)', 'candidate')));
  byId('exportButton').disabled = false;
}

async function compile() {
  const message = byId('message');
  message.className = 'message'; message.textContent = 'Compiling exact lineage…';
  try {
    compiled = await Core.compileBundle(byId('bundleInput').value);
    render(compiled);
    message.className = 'message pass';
    message.textContent = 'PASS · compact ledger compiled; review authority remains human/machine explicit.';
    if (globalThis.AXMHub) AXMHub.log('Design Lineage compiled ' + compiled.stats.admitted + ' records with ' + compiled.stats.conflicts + ' conflicts.');
  } catch (error) {
    compiled = null; byId('exportButton').disabled = true;
    message.className = 'message fail'; message.textContent = 'BLOCKED · ' + error.message;
  }
}

function reset() {
  compiled = null; byId('bundleInput').value = ''; byId('fileInput').value = ''; byId('fileName').textContent = 'Nothing leaves this browser.';
  ['admittedMetric','duplicateMetric','conflictMetric','candidateMetric'].forEach(id => byId(id).textContent = '0');
  byId('receiptSummary').innerHTML = '<p>No compiled receipt yet.</p>';
  clearNode(byId('recordList'), 'Nothing admitted.'); clearNode(byId('conflictList'), 'No conflict evidence.'); clearNode(byId('candidateList'), 'No review candidates.');
  byId('message').className = 'message'; byId('message').textContent = 'Session cleared; no raw evidence was retained.'; byId('exportButton').disabled = true;
}

byId('exampleButton').addEventListener('click', () => { byId('bundleInput').value = JSON.stringify(example, null, 2); byId('message').textContent = 'Example loaded; compile when ready.'; });
byId('compileButton').addEventListener('click', compile);
byId('clearButton').addEventListener('click', reset);
byId('fileInput').addEventListener('change', event => {
  const file = event.target.files[0]; if (!file) return;
  if (file.size > 1024 * 1024) { byId('message').className = 'message fail'; byId('message').textContent = 'BLOCKED · compact JSON inputs are limited to 1 MB.'; return; }
  const reader = new FileReader(); reader.onload = () => { byId('bundleInput').value = String(reader.result); byId('fileName').textContent = file.name + ' loaded into this session only.'; }; reader.readAsText(file);
});
byId('exportButton').addEventListener('click', () => {
  if (!compiled) return;
  const blob = new Blob([JSON.stringify(compiled, null, 2)], { type: 'application/json' });
  const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = compiled.id + '.json'; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 0);
});

if (globalThis.AXMHub) {
  AXMHub.ready({ id: 'design-lineage-lab', name: 'Design Lineage Lab', version: 'v0.1', hubApiVersion: '1.0', permissions: ['export'], savesState: false, handlesShutdown: true });
  AXMHub.onInit(() => AXMHub.log('Design Lineage Lab ready · session-only compact evidence.'));
  AXMHub.onShutdown(reset);
}

