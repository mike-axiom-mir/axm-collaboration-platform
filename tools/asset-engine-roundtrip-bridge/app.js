import { BRIDGE_SCHEMA, compileEngineContract, inspectBytes, sha256Hex, stableJson } from './bridge-core.mjs';
import { verifyRoundTrip } from './roundtrip-verifier.mjs';

const assets = {
  storefront: {
    id: 'district-storefront',
    label: 'District storefront',
    url: '../ps2-asset-forge/proof/exports/storefront-technical-proof.glb'
  },
  pedestrian: {
    id: 'animated-pedestrian',
    label: 'Animated pedestrian',
    url: '../ps2-asset-forge/proof/exports/animated-pedestrian.glb'
  }
};

const choices = [...document.querySelectorAll('.asset-choice')];
const runButton = document.querySelector('#run-button');
const exportButton = document.querySelector('#export-button');
const verdictCard = document.querySelector('#verdict-card');
const verdictIcon = document.querySelector('#verdict-icon');
const verdictTitle = document.querySelector('#verdict-title');
const verdictCopy = document.querySelector('#verdict-copy');
const sourceName = document.querySelector('#source-name');
const sourceDigest = document.querySelector('#source-digest');
const checkTotal = document.querySelector('#check-total');
const passCount = document.querySelector('#pass-count');
const lossCount = document.querySelector('#loss-count');
const checkList = document.querySelector('#check-list');
const lossList = document.querySelector('#loss-list');
const receiptDigest = document.querySelector('#receipt-digest');
const receiptJson = document.querySelector('#receipt-json');
const metricFields = {
  bytes: document.querySelector('#byte-count'), nodes: document.querySelector('#node-count'),
  meshes: document.querySelector('#mesh-count'), materials: document.querySelector('#material-count'),
  skins: document.querySelector('#skin-count'), animations: document.querySelector('#animation-count')
};

let selected = 'storefront';
let currentReceipt = null;

function setWorking(asset) {
  verdictCard.dataset.status = 'working';
  verdictIcon.textContent = '···';
  verdictTitle.textContent = `Reading ${asset.label}`;
  verdictCopy.textContent = 'Hashing original bytes before semantic translation…';
  runButton.disabled = true;
  exportButton.disabled = true;
}

function setError(error) {
  verdictCard.dataset.status = 'blocked';
  verdictIcon.textContent = '!';
  verdictTitle.textContent = 'Bridge stopped honestly';
  verdictCopy.textContent = error instanceof Error ? error.message : String(error);
  checkList.innerHTML = '<div class="loss-item"><strong>No receipt emitted</strong><p>The source or verifier failed before a trustworthy result existed.</p></div>';
  runButton.disabled = false;
  exportButton.disabled = true;
}

function renderChecks(verification) {
  checkList.replaceChildren(...verification.checks.map((entry) => {
    const item = document.createElement('article');
    item.className = `check-item ${entry.status}`;
    item.innerHTML = `<span class="check-mark">${entry.status === 'pass' ? '✓' : '×'}</span><div><strong>${entry.label}</strong><small>${entry.evidence}</small></div>`;
    return item;
  }));
  checkTotal.textContent = `${verification.summary.passed} / ${verification.checks.length} checks`;
  passCount.textContent = `${verification.summary.passed} PASS`;
}

function renderLosses(losses) {
  lossCount.textContent = losses.length ? `${losses.length} DECLARED` : '0 HIDDEN';
  if (!losses.length) {
    lossList.innerHTML = '<div class="empty-loss"><div><strong>Zero hidden loss</strong><p>Every semantic category required by this asset survived the engine contract.</p></div></div>';
    return;
  }
  lossList.replaceChildren(...losses.map((loss) => {
    const item = document.createElement('article');
    item.className = 'loss-item';
    item.innerHTML = `<strong>${loss.id} · ${loss.path}</strong><p>${loss.detail}</p>`;
    return item;
  }));
}

async function run() {
  const asset = assets[selected];
  setWorking(asset);
  try {
    const response = await fetch(asset.url);
    if (!response.ok) throw new Error(`${asset.label}: HTTP ${response.status}`);
    const bytes = await response.arrayBuffer();
    const digestBefore = await sha256Hex(bytes);
    const inspected = inspectBytes(bytes, asset.id);
    const engineContract = compileEngineContract(inspected.descriptor, { sha256: digestBefore, byteLength: bytes.byteLength, losses: inspected.losses });
    const verification = verifyRoundTrip(inspected.descriptor, engineContract, { sha256: digestBefore, byteLength: bytes.byteLength });
    const digestAfter = await sha256Hex(bytes);
    if (digestBefore !== digestAfter) throw new Error('Source byte identity changed during an inspection-only route.');
    const receiptBase = {
      schema: BRIDGE_SCHEMA,
      assetId: asset.id,
      source: { sha256: digestBefore, byteLength: bytes.byteLength, immutable: true, bytesWritten: 0 },
      sourceDescriptor: inspected.descriptor,
      engineContract,
      verification
    };
    const receiptSha256 = await sha256Hex(new TextEncoder().encode(stableJson(receiptBase)).buffer);
    currentReceipt = { ...receiptBase, receiptSha256 };

    const structure = inspected.descriptor.structure;
    metricFields.bytes.textContent = bytes.byteLength.toLocaleString('en-US');
    for (const key of ['nodes','meshes','materials','skins','animations']) metricFields[key].textContent = structure[key].toLocaleString('en-US');
    sourceName.textContent = asset.label;
    sourceDigest.textContent = `SHA256 ${digestBefore.slice(0, 16)}…${digestBefore.slice(-8)}`;
    receiptDigest.textContent = `SHA256 ${receiptSha256}`;
    receiptJson.textContent = JSON.stringify(currentReceipt, null, 2);
    renderChecks(verification);
    renderLosses(engineContract.lossRegistry);
    verdictCard.dataset.status = verification.status;
    verdictIcon.textContent = verification.status === 'pass' ? '✓' : '×';
    verdictTitle.textContent = verification.status === 'pass' ? 'Semantic parity proven' : 'Runtime loss blocks the bridge';
    verdictCopy.textContent = verification.status === 'pass'
      ? `${verification.summary.passed} independent checks passed against the exact source digest.`
      : `${verification.summary.failed} parity failure(s) and ${verification.summary.losses} declared loss(es) require repair.`;
    runButton.disabled = false;
    exportButton.disabled = false;
    document.body.dataset.bridgeStatus = verification.status;
    document.body.dataset.assetId = asset.id;
    document.body.dataset.sourceSha256 = digestBefore;
    document.body.dataset.receiptSha256 = receiptSha256;
  } catch (error) {
    currentReceipt = null;
    setError(error);
    console.error(error);
  }
}

choices.forEach((choice) => choice.addEventListener('click', () => {
  selected = choice.dataset.asset;
  choices.forEach((item) => {
    const active = item === choice;
    item.classList.toggle('active', active);
    item.setAttribute('aria-pressed', String(active));
  });
  run();
}));
runButton.addEventListener('click', run);
exportButton.addEventListener('click', () => {
  if (!currentReceipt) return;
  const url = URL.createObjectURL(new Blob([JSON.stringify(currentReceipt, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${currentReceipt.assetId}-${currentReceipt.receiptSha256.slice(0, 12)}-roundtrip.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
});

window.__AXM_ASSET_ENGINE_BRIDGE__ = { run, getReceipt: () => currentReceipt ? structuredClone(currentReceipt) : null };
run();
