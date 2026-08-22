'use strict';

(() => {
  const STAGE_BASE = '../../shared/universal-object-fabric/source-stage-v0.7/game-stage/';
  const state = { assets: [], selected: null, query: '' };
  const list = document.getElementById('assetList');
  const detail = document.getElementById('detail');
  const count = document.getElementById('resultCount');
  const search = document.getElementById('searchInput');

  const fetchJson = async relative => {
    const response = await fetch(STAGE_BASE + relative, { cache: 'no-store' });
    if (!response.ok) throw new Error(`${relative}: HTTP ${response.status}`);
    return response.json();
  };

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);

  const previewUrl = asset => STAGE_BASE + 'game_geometry/' + asset.runtime.hero_preview;
  const formatMetres = values => values.map(value => Number(value).toFixed(2)).join(' × ') + ' m';
  const formatBytes = value => value < 1024 * 1024 ? `${Math.round(value / 1024)} KB` : `${(value / 1024 / 1024).toFixed(1)} MB`;

  function filteredAssets() {
    const query = state.query.trim().toLowerCase();
    if (!query) return state.assets;
    return state.assets.filter(asset => [asset.asset_id, asset.runtime.name, asset.runtime.family, ...(asset.runtime.tags || [])].join(' ').toLowerCase().includes(query));
  }

  function renderList() {
    const assets = filteredAssets();
    count.value = `${assets.length} / ${state.assets.length}`;
    list.innerHTML = assets.map(asset => `
      <button class="asset-button" type="button" data-identity="${escapeHtml(asset.identity)}" aria-current="${asset.identity === state.selected ? 'true' : 'false'}">
        <img class="asset-thumb" src="${escapeHtml(previewUrl(asset))}" alt="" loading="lazy">
        <span class="asset-copy"><strong>${escapeHtml(asset.runtime.name)}</strong><span>${escapeHtml(asset.asset_id)} · ${escapeHtml(asset.runtime.family)}</span></span>
        <span class="validation ${asset.universal.validation_status === 'WARN' ? 'warn' : ''}">${escapeHtml(asset.universal.validation_status)}</span>
      </button>`).join('');
    list.querySelectorAll('button').forEach(button => button.addEventListener('click', () => select(button.dataset.identity)));
  }

  function resolutionFor(asset) {
    return {
      schema: 'axm.uof.exact-resolution/v0.7',
      identity: asset.identity,
      stage_root: 'shared/universal-object-fabric/source-stage-v0.7/game-stage',
      runtime_manifest: asset.runtime_manifest,
      universal_manifest: asset.universal_manifest,
      runtime_capsule: asset.runtime_capsule,
      visual_skin: asset.visual_skin
    };
  }

  async function copyResolution(asset, button) {
    const value = JSON.stringify(resolutionFor(asset), null, 2);
    await navigator.clipboard.writeText(value);
    const original = button.textContent;
    button.textContent = 'Copied exact record';
    setTimeout(() => { button.textContent = original; }, 1400);
  }

  function select(identity) {
    const asset = state.assets.find(item => item.identity === identity);
    if (!asset) return;
    state.selected = identity;
    renderList();
    const bounds = asset.runtime.bounds.extents_m;
    const warning = asset.universal.validation_status === 'WARN'
      ? '<span class="chip" style="color:var(--amber)">Declared connectivity WARN</span>'
      : '<span class="chip">Object validation PASS</span>';
    detail.innerHTML = `
      <div class="object-hero">
        <div class="preview-frame"><img src="${escapeHtml(previewUrl(asset))}" alt="Preview of ${escapeHtml(asset.runtime.name)}"></div>
        <div class="object-copy">
          <p class="eyebrow">${escapeHtml(asset.runtime.family)}</p>
          <h2>${escapeHtml(asset.runtime.name)}</h2>
          <p class="identity">${escapeHtml(asset.identity)} · ${escapeHtml(asset.universal.object_identity)}</p>
          <div class="chips">${warning}<span class="chip">Runtime Capsule 0.7</span><span class="chip">visual skin 0.6</span><span class="chip">3 LODs</span></div>
          <div class="metric-grid">
            <div class="metric"><span>Bounds</span><strong>${escapeHtml(formatMetres(bounds))}</strong></div>
            <div class="metric"><span>LOD0 faces</span><strong>${Number(asset.runtime.lod0_faces).toLocaleString()}</strong></div>
            <div class="metric"><span>Game GLB</span><strong>${escapeHtml(formatBytes(asset.runtime.game_glb_bytes))}</strong></div>
          </div>
          <div class="actions">
            <button id="copyResolution" type="button">Copy exact resolution</button>
            <a href="${escapeHtml(previewUrl(asset))}" target="_blank" rel="noreferrer">Open preview</a>
            <a href="${escapeHtml(STAGE_BASE + asset.runtime_manifest)}" target="_blank" rel="noreferrer">Runtime manifest</a>
          </div>
        </div>
      </div>
      <div class="contract-grid">
        <div class="contract-card"><strong>Universal Object manifest</strong><code>${escapeHtml(asset.universal_manifest)}</code></div>
        <div class="contract-card"><strong>Runtime Capsule</strong><code>${escapeHtml(asset.runtime_capsule)}</code></div>
        <div class="contract-card"><strong>Visual-skin binding</strong><code>${escapeHtml(asset.visual_skin)}</code></div>
        <div class="contract-card"><strong>Authority</strong><code>receiving game owns physics, behavior and acceptance</code></div>
      </div>`;
    document.getElementById('copyResolution').addEventListener('click', event => copyResolution(asset, event.currentTarget).catch(error => {
      event.currentTarget.textContent = 'Clipboard unavailable';
      console.error(error);
    }));
  }

  async function start() {
    try {
      const [stage, resolution, runtime, universal] = await Promise.all([
        fetchJson('STAGE_MANIFEST.json'),
        fetchJson('STAGE_RESOLUTION_MAP.json'),
        fetchJson('game_geometry/AXM_RUNTIME_CATALOG.json'),
        fetchJson('universal_objects/UNIVERSAL_OBJECT_CATALOG.json')
      ]);
      if (stage.status !== 'STAGED-NOT-INTEGRATED' || stage.asset_count !== 10) throw new Error('unexpected stage identity or status');
      const runtimes = new Map(runtime.assets.map(item => [`${item.asset_id}@${item.version}`, item]));
      const universals = new Map(universal.assets.map(item => [`${item.asset_id}@${item.asset_version}`, item]));
      state.assets = resolution.assets.map(item => {
        const identity = `${item.asset_id}@${item.asset_version}`;
        const joined = { ...item, identity, runtime: runtimes.get(identity), universal: universals.get(identity) };
        if (!joined.runtime || !joined.universal) throw new Error('catalog identity mismatch: ' + identity);
        return joined;
      });
      renderList();
      select(state.assets[0].identity);
    } catch (error) {
      count.value = 'Unavailable';
      detail.innerHTML = `<div class="empty-state"><p class="eyebrow">Stage unavailable</p><h2>${escapeHtml(error.message)}</h2><p class="lede">Serve the Workshop root over HTTP; browser fetch cannot consume this stage through file://.</p></div>`;
      console.error(error);
    }
  }

  search.addEventListener('input', () => { state.query = search.value; renderList(); });
  start();
})();
