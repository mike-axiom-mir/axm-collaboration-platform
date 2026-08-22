(function () {
  'use strict';
  const input = document.getElementById('capsule-input');
  const result = document.getElementById('result');
  const exportButton = document.getElementById('export-receipt');
  let receipt = null;

  function pathOf(file) { return String(file.webkitRelativePath || file.name).replace(/\\/g, '/'); }

  async function sha256File(file) {
    const bytes = await file.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest)).map(function (value) {
      return value.toString(16).padStart(2, '0');
    }).join('');
  }

  function show(data) {
    result.textContent = JSON.stringify(data, null, 2);
    result.dataset.verdict = data.verdict || 'HOLD';
  }

  input.addEventListener('change', async function () {
    receipt = null;
    exportButton.disabled = true;
    const files = Array.from(input.files || []);
    const manifests = files.filter(function (file) { return file.name === AXMBranchBackfeed.MANIFEST_NAME; });
    if (manifests.length !== 1) {
      show({ verdict: 'HOLD', failures: ['select one capsule folder containing exactly one ' + AXMBranchBackfeed.MANIFEST_NAME] });
      return;
    }
    try {
      const manifestFile = manifests[0];
      const fullManifestPath = pathOf(manifestFile);
      const prefix = fullManifestPath.slice(0, fullManifestPath.length - AXMBranchBackfeed.MANIFEST_NAME.length);
      const selected = {};
      files.forEach(function (file) {
        const full = pathOf(file);
        if (full.indexOf(prefix) !== 0) return;
        selected[full.slice(prefix.length)] = file;
      });
      const capsuleText = await manifestFile.text();
      const capsule = JSON.parse(capsuleText);
      receipt = await AXMBranchBackfeed.verifyInventory(capsule, selected, sha256File);
      receipt.capsule_manifest_sha256 = await sha256File(manifestFile);
      show(receipt);
      exportButton.disabled = false;
      if (receipt.verdict === 'READY_FOR_GRAFT') {
        window.parent.postMessage({ type: 'hub:verify:pass', id: 'branch-backfeed-lab', receipt: receipt }, '*');
      } else {
        window.parent.postMessage({
          type: 'hub:error', id: 'branch-backfeed-lab',
          msg: 'Capsule held: ' + receipt.failures.join('; '), receipt: receipt
        }, '*');
      }
    } catch (error) {
      show({ verdict: 'HOLD', failures: [String(error && error.message || error)] });
    }
  });

  exportButton.addEventListener('click', function () {
    if (!receipt) return;
    const blob = new Blob([JSON.stringify(receipt, null, 2) + '\n'], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'branch-backfeed-intake-receipt.json';
    link.click();
    setTimeout(function () { URL.revokeObjectURL(link.href); }, 0);
  });

  window.parent.postMessage({
    type: 'hub:ready',
    passport: {
      id: 'branch-backfeed-lab', name: 'AXM Branch Backfeed Lab', version: 'v0.1',
      hubApiVersion: '1.0', permissions: [], savesState: false, handlesShutdown: false
    }
  }, '*');
})();
