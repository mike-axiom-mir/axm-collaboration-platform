'use strict';

const fileInput = document.getElementById('receipt-file');
const status = document.getElementById('status');
const dashboard = document.getElementById('dashboard');
const metrics = document.getElementById('metrics');
const judgmentList = document.getElementById('judgment-list');
const readyList = document.getElementById('ready-list');
const truth = document.getElementById('truth');

function metric(value, label) {
  const article = document.createElement('article');
  const strong = document.createElement('strong');
  const small = document.createElement('small');
  strong.textContent = String(value ?? 0);
  small.textContent = label;
  article.append(strong, small);
  return article;
}

function fillList(element, values) {
  element.replaceChildren();
  for (const value of values.slice(0, 200)) {
    const item = document.createElement('li');
    item.textContent = value;
    element.append(item);
  }
  if (values.length > 200) {
    const item = document.createElement('li');
    item.textContent = '+' + (values.length - 200) + ' more in the machine-readable receipt';
    element.append(item);
  }
}

function render(receipt) {
  if (!receipt || receipt.schema !== 'axm.bulk-intake-conveyor-receipt/v1') {
    throw new Error('This is not an AXM Bulk Intake Conveyor v1 receipt.');
  }
  const summary = receipt.summary || {};
  const queues = receipt.queues || {};
  const judgment = [...(queues.archiveJudgment || []), ...(queues.candidateJudgment || [])];
  const ready = queues.candidateReadyForDeeperReview || [];
  metrics.replaceChildren(
    metric(summary.archives, 'ZIP carriers'),
    metric(summary.structuralCandidateRoots, 'structural candidates'),
    metric(summary.exactDuplicateCopies, 'exact duplicate copies'),
    metric(receipt.batches?.deeperReview?.length || 0, 'deeper-review batches')
  );
  fillList(judgmentList, judgment);
  fillList(readyList, ready);
  document.getElementById('judgment-count').textContent = judgment.length;
  document.getElementById('ready-count').textContent = ready.length;
  truth.textContent = JSON.stringify({
    receiptDigest: receipt.receiptDigest,
    handoff: receipt.handoff,
    truth: receipt.truth,
    performance: receipt.performance
  }, null, 2);
  status.textContent = 'Loaded receipt ' + String(receipt.receiptDigest || '').slice(0, 16) + '…';
  dashboard.hidden = false;
}

fileInput.addEventListener('change', async () => {
  dashboard.hidden = true;
  const file = fileInput.files && fileInput.files[0];
  if (!file) return;
  status.textContent = 'Reading local receipt…';
  try {
    render(JSON.parse(await file.text()));
  } catch (error) {
    status.textContent = 'Receipt refused: ' + error.message;
  }
});
