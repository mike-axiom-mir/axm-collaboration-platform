(function () {
  'use strict';
  var Atlas = window.AXMGameCapabilityAtlas;
  var catalog = null;
  var selected = new Set();
  var project = { id: 'detached-game-project', name: 'Detached game plan' };
  var $ = function (id) { return document.getElementById(id); };

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
    });
  }

  function status(message, bad) {
    $('status').textContent = message;
    $('status').classList.toggle('bad', !!bad);
    if (window.AXMHub) AXMHub.log(message);
  }

  function readForgeProject() {
    try {
      var state = JSON.parse(localStorage.getItem('axm.game-forge.projects.v1') || 'null');
      var active = state && Array.isArray(state.projects)
        ? state.projects.find(function (row) { return row.id === state.activeId; })
        : null;
      if (active) project = { id: active.id, name: active.name };
    } catch (error) {}
    $('projectName').textContent = project.name;
    $('projectMeta').textContent = project.id === 'detached-game-project'
      ? 'Open inside Game Forge to attach this plan to a project.'
      : project.id + ' · ready for an explicit plan handoff';
  }

  function loadWave(number) {
    selected = new Set(Atlas.balancedWave(catalog, number).map(function (row) { return row.id; }));
    render();
    status('Balanced wave ' + number + ' loaded · one module from every game domain');
  }

  function createPlan() {
    return Atlas.buildPlan(catalog, {
      projectId: project.id,
      projectName: project.name,
      goal: $('goal').value,
      moduleIds: Array.from(selected)
    });
  }

  function updateCoverage() {
    var rows = catalog.modules.filter(function (row) { return selected.has(row.id); });
    $('selectedCount').textContent = rows.length;
    $('coverageDomains').textContent = new Set(rows.map(function (row) { return row.category; })).size + '/20';
    $('coverageEvidence').textContent = rows.reduce(function (sum, row) { return sum + (row.requiredEvidence || []).length; }, 0);
  }

  function renderCategories() {
    var rail = $('categoryRail');
    var select = $('category');
    if (!select.dataset.ready) {
      catalog.categories.forEach(function (row) {
        var option = document.createElement('option');
        option.value = row.id;
        option.textContent = row.id + ' · ' + row.title;
        select.appendChild(option);
      });
      select.dataset.ready = '1';
    }
    rail.innerHTML = '';
    catalog.categories.forEach(function (row) {
      var button = document.createElement('button');
      button.textContent = row.id + ' ' + row.title;
      button.classList.toggle('active', select.value === row.id);
      button.onclick = function () { select.value = select.value === row.id ? '' : row.id; render(); };
      rail.appendChild(button);
    });
  }

  function resultRows() {
    var rows = Atlas.search(catalog, { query: $('query').value, category: $('category').value, limit: 500 });
    if ($('selectedOnly').checked) rows = rows.filter(function (row) { return selected.has(row.module.id); });
    return { total: rows.length, rows: rows.slice(0, 80) };
  }

  function renderResults() {
    var result = resultRows();
    var rows = result.rows;
    $('resultCount').textContent = result.total + (result.total === 1 ? ' pattern' : ' patterns') + (result.total > rows.length ? ' · showing first ' + rows.length : '');
    var box = $('results');
    box.innerHTML = '';
    if (!rows.length) {
      box.innerHTML = '<div class="loading">No capability matches this view.</div>';
      return;
    }
    rows.forEach(function (result) {
      var row = result.module;
      var card = document.createElement('article');
      card.className = 'capability' + (selected.has(row.id) ? ' selected' : '');
      card.innerHTML = '<header><div><div class="meta">' + esc(row.id) + ' · DOMAIN ' + esc(row.category) + '</div><h3>' + esc(row.title) + '</h3></div><button class="pick" aria-label="' + (selected.has(row.id) ? 'Remove' : 'Add') + ' ' + esc(row.title) + '">' + (selected.has(row.id) ? '✓' : '+') + '</button></header><p>' + esc(row.shortcut) + '</p><div class="guard"><b>Watch:</b> ' + esc(row.guard) + '</div><footer><div class="tags">' + (row.tags || []).slice(0, 4).map(function (tag) { return '<span>' + esc(tag) + '</span>'; }).join('') + '</div><span>' + (row.requiredEvidence || []).length + ' evidence prompts</span></footer>';
      card.querySelector('.pick').onclick = function () {
        if (selected.has(row.id)) selected.delete(row.id); else selected.add(row.id);
        render();
      };
      box.appendChild(card);
    });
  }

  function render() {
    renderCategories();
    renderResults();
    updateCoverage();
  }

  function applyPlan() {
    if (!selected.size) return status('Select at least one capability before attaching a plan', true);
    var plan = createPlan();
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'AXM_GAME_CAPABILITY_PLAN_APPLY', plan: plan }, window.location.origin);
      status('Plan sent to the active Game Forge project');
      return;
    }
    try {
      var state = JSON.parse(localStorage.getItem('axm.game-forge.projects.v1') || 'null');
      var active = state && Array.isArray(state.projects)
        ? state.projects.find(function (row) { return row.id === state.activeId; })
        : null;
      if (!active) return status('No active Game Forge project. Create one or open this Atlas inside Game Forge.', true);
      active.capabilityPlan = plan;
      active.updatedAt = new Date().toISOString();
      state.updatedAt = active.updatedAt;
      localStorage.setItem('axm.game-forge.projects.v1', JSON.stringify(state));
      status('Plan attached to ' + active.name + ' · reopen Game Forge to refresh its in-memory document');
    } catch (error) {
      status('Plan handoff failed: ' + error.message, true);
    }
  }

  function exportPlan() {
    if (!selected.size) return status('Select at least one capability before exporting', true);
    var plan = createPlan();
    var blob = new Blob([JSON.stringify(plan, null, 2) + '\n'], { type: 'application/json' });
    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'AXM_GAME_CAPABILITY_PLAN_' + project.id + '.json';
    link.click();
    setTimeout(function () { URL.revokeObjectURL(link.href); }, 1000);
    status('Portable game capability plan exported');
  }

  async function init() {
    if (!Atlas) throw new Error('Shared Game Capability Atlas runtime did not load');
    var response = await fetch('../../shared/game-capability-atlas/catalog.json');
    if (!response.ok) throw new Error('Catalog HTTP ' + response.status);
    catalog = await response.json();
    var validation = Atlas.validate(catalog);
    if (!validation.pass) throw new Error('Catalog invalid: ' + validation.errors.join(', '));
    readForgeProject();
    $('moduleCount').textContent = catalog.modules.length;
    $('categoryCount').textContent = catalog.categories.length;
    $('query').oninput = render;
    $('category').onchange = render;
    $('selectedOnly').onchange = render;
    $('loadStarter').onclick = function () { loadWave(1); };
    $('clearPlan').onclick = function () { selected.clear(); render(); status('Selection cleared · source catalog unchanged'); };
    $('applyPlan').onclick = applyPlan;
    $('exportPlan').onclick = exportPlan;
    loadWave(1);
    if (window.AXM && AXM.init) await AXM.init({ id: 'game-capability-atlas', name: 'AXM Game Production Atlas', version: 'v1.0' });
    if (window.AXMHub) {
      AXMHub.ready({ version: 'v1.0', capabilities: ['500-module-search', 'balanced-game-plan', 'game-forge-plan-handoff', 'plan-export'] });
      AXMHub.verifyPass();
    }
  }

  init().catch(function (error) { status('Atlas failed: ' + error.message, true); });
})();
