(function () {
  'use strict';

  const $ = selector => document.querySelector(selector);
  const $$ = selector => Array.from(document.querySelectorAll(selector));
  const canvas = $('#world');
  const ctx = canvas.getContext('2d', { alpha: false });
  const miniCanvas = $('#miniMap');
  const miniCtx = miniCanvas.getContext('2d');
  const audio = new window.CircuitAudio();
  const tacticalActions = ['Scan', 'Anchor', 'Shield', 'Patch', 'Reroute', 'Challenge', 'Isolate', 'Synchronize'];

  const app = {
    bootstrap: null,
    observation: null,
    binding: null,
    hostToken: null,
    sessionId: null,
    selectedProfileId: localStorage.getItem('circuitseed-selected-profile') || null,
    selectedWorldId: localStorage.getItem('circuitseed-selected-world') || null,
    seq: 0,
    running: false,
    keys: new Set(),
    pollTimer: null,
    inputTimer: null,
    lastMissionId: null,
    lastRosterIds: null,
    lastEventCursor: null,
    lastRegionId: null,
    lastJournalIds: null,
    lastReadyRequestIds: null,
    nearby: null,
    particles: [],
    effects: [],
    trail: [],
    time: 0,
    lastFrame: performance.now(),
    titleMode: true,
    settings: { textScale: 100, audio: 35, reducedMotion: false, highContrast: false }
  };

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(innerWidth * dpr);
    canvas.height = Math.round(innerHeight * dpr);
    canvas.style.width = innerWidth + 'px';
    canvas.style.height = innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  async function json(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: { 'content-type': 'application/json', ...(options.headers || {}) }
    });
    const data = await response.json();
    if (!response.ok || data.ok === false) {
      const error = new Error(data.error || data.reason || ('HTTP ' + response.status));
      error.data = data; error.status = response.status; throw error;
    }
    return data;
  }

  function authBody(extra = {}) {
    if (!app.binding) throw new Error('No active seat binding.');
    return {
      roomCode: 'AXM1',
      sessionId: app.sessionId,
      seatId: app.binding.seatId,
      token: app.binding.token,
      ...extra
    };
  }

  function saveSessionBinding() {
    sessionStorage.setItem('circuitseed-session-binding', JSON.stringify({
      binding: app.binding, hostToken: app.hostToken, sessionId: app.sessionId
    }));
  }

  function loadSessionBinding() {
    try {
      const saved = JSON.parse(sessionStorage.getItem('circuitseed-session-binding') || 'null');
      if (saved && saved.binding && saved.sessionId) {
        app.binding = saved.binding; app.hostToken = saved.hostToken; app.sessionId = saved.sessionId;
        return true;
      }
    } catch (error) {}
    return false;
  }

  const ESCAPE_CLOSE_ORDER = Object.freeze(['menuPanel', 'profilePanel', 'settingsPanel', 'workbenchPanel', 'discoveryReveal']);
  const SESSION_BOUND_BLOCKERS = Object.freeze(['starterPanel', 'encounterPanel']);

  function openPanel(id) { $('#' + id).classList.remove('hidden'); }
  function closePanel(id) { $('#' + id).classList.add('hidden'); }
  function panelIsOpen(id) {
    const panel = $('#' + id);
    return Boolean(panel && !panel.classList.contains('hidden'));
  }
  function dismissTopOverlay() {
    const panelId = ESCAPE_CLOSE_ORDER.find(panelIsOpen);
    if (!panelId) return false;
    closePanel(panelId);
    return true;
  }
  function handleEscape() {
    app.keys.clear();
    if (dismissTopOverlay()) return;
    // Authoritative encounters and the first Circuitkin choice cannot be
    // discarded client-side. The journey menu supplies their safe exit path.
    if (app.running || SESSION_BOUND_BLOCKERS.some(panelIsOpen)) openPanel('menuPanel');
  }
  function toast(message, tone = 'normal') {
    const element = $('#eventToast');
    element.textContent = message;
    element.style.borderColor = tone === 'warn' ? 'rgba(255,122,153,.55)' : 'rgba(255,214,110,.35)';
    element.classList.remove('hidden');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => element.classList.add('hidden'), 2600);
  }

  function loadSettings() {
    try { Object.assign(app.settings, JSON.parse(localStorage.getItem('circuitseed-ui-settings') || '{}')); } catch (error) {}
    $('#textScale').value = app.settings.textScale;
    $('#audioVolume').value = app.settings.audio;
    $('#reducedMotion').checked = app.settings.reducedMotion;
    $('#highContrast').checked = app.settings.highContrast;
    applySettings();
  }
  function applySettings() {
    document.documentElement.style.setProperty('--text-scale', String(app.settings.textScale / 100));
    document.body.classList.toggle('reduced-motion', app.settings.reducedMotion);
    document.body.classList.toggle('high-contrast', app.settings.highContrast);
    $('#textScaleValue').textContent = app.settings.textScale + '%';
    $('#audioVolumeValue').textContent = app.settings.audio + '%';
    audio.setVolume(app.settings.audio / 100);
    try { localStorage.setItem('circuitseed-ui-settings', JSON.stringify(app.settings)); } catch (error) {}
  }

  async function bootstrap() {
    try {
      app.bootstrap = await json('/api/bootstrap');
      renderProfiles();
      renderStarters();
      renderWorkbench();
      const current = app.bootstrap.currentSession;
      const haveBinding = loadSessionBinding();
      if (current && haveBinding && current.sessionId === app.sessionId) {
        $('#titleStatus').textContent = 'A local session is waiting. Continue restores your bound seat.';
        $('#continueButton').disabled = false;
      } else if (current) {
        $('#titleStatus').textContent = 'A local session is already running. Use its original host tab or party screen.';
        $('#continueButton').disabled = true;
      } else {
        const worlds = app.bootstrap.worlds || [];
        const selectedWorld = worlds.find(world => world.worldId === app.selectedWorldId) || worlds[0] || null;
        if (selectedWorld) {
          app.selectedWorldId = selectedWorld.worldId;
          try { localStorage.setItem('circuitseed-selected-world', selectedWorld.worldId); } catch (error) {}
        }
        $('#titleStatus').textContent = selectedWorld
          ? 'Continue ' + selectedWorld.settlement + ' · chapter stage ' + selectedWorld.stageIndex + '/10 · local save v' + selectedWorld.version + '.'
          : app.bootstrap.profiles.length
            ? app.bootstrap.profiles.length + ' local profile(s) found. Continue will create the first persistent world.'
            : 'No profile or world yet. Both will be created locally when the journey begins.';
        $('#continueButton').disabled = false;
      }
    } catch (error) {
      $('#titleStatus').textContent = 'Local runtime unavailable: ' + error.message;
      $('#newButton').disabled = true;
      $('#continueButton').disabled = true;
    }
  }

  function renderProfiles() {
    if (!app.bootstrap) return;
    const list = $('#profileList');
    list.innerHTML = '';
    app.bootstrap.profiles.forEach(profile => {
      const card = document.createElement('div');
      card.className = 'profile-item' + (profile.profileId === app.selectedProfileId ? ' selected' : '');
      card.tabIndex = 0;
      card.innerHTML = '<strong>' + escapeHtml(profile.displayName) + '</strong><small>' +
        escapeHtml(profile.identityType) + ' · ' + profile.circuitkinCount + ' Circuitkin · v' + profile.version + '</small>';
      card.addEventListener('click', () => {
        app.selectedProfileId = profile.profileId;
        localStorage.setItem('circuitseed-selected-profile', profile.profileId);
        renderProfiles();
      });
      card.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') card.click(); });
      list.appendChild(card);
    });
  }

  function renderStarters(existingDesignId = null) {
    if (!app.bootstrap) return;
    const starters = app.bootstrap.circuitkin.filter(item => item.starter);
    $('#starterChoices').innerHTML = starters.map(starter => {
      const branches = starter.branches.map(branch => branch.name).join(' · ');
      const unavailable = existingDesignId && existingDesignId !== starter.id;
      const returning = existingDesignId === starter.id;
      return '<button class="starter-card" data-starter="' + starter.id + '" style="--starter:' + starter.palette[0] + '" ' + (unavailable ? 'disabled' : '') + '>' +
        kinEmblem(starter, 'starter-emblem') + '<h3>' + escapeHtml(starter.name) + '</h3><div class="family">' + escapeHtml(starter.family) + '</div>' +
        '<p>' + escapeHtml(starter.promise) + '</p><div class="branches">' + (returning ? 'Reconnect this returning Circuitkin' : unavailable ? 'Another starter already shares this profile' : 'May grow toward: ' + escapeHtml(branches)) + '</div></button>';
    }).join('');
    $$('[data-starter]').forEach(button => button.addEventListener('click', () => chooseStarter(button.dataset.starter)));
  }

  function renderWorkbench() {
    if (!app.bootstrap || !app.bootstrap.economy) return;
    renderCrafting(null);
    $('#businessPaths').innerHTML = app.bootstrap.economy.businessPaths.map(path =>
      '<article class="system-card"><div><h4>' + escapeHtml(path.name) + '</h4><p>' + escapeHtml(path.reputation) +
      '</p></div><button data-business="' + path.id + '">CHOOSE</button></article>'
    ).join('');
    $('#orderList').innerHTML = app.bootstrap.economy.orders.map(order =>
      '<article class="system-card"><div><h4>' + escapeHtml(order.requester) + '</h4><p>' + order.quantity + ' × ' +
      escapeHtml(itemInfo(order.item).name) + ' · base ¤' + order.basePay + '</p></div><button data-order="' + order.id + '">FULFILL</button></article>'
    ).join('');
    $$('[data-business]').forEach(button => button.addEventListener('click', () => economyCall('/api/business/choose', { pathId: button.dataset.business }, 'Business path recorded')));
    $$('[data-order]').forEach(button => button.addEventListener('click', () => economyCall('/api/shop/fulfill', { orderId: button.dataset.order }, 'Order fulfilled')));
  }

  function itemInfo(id) {
    return app.bootstrap?.itemCatalog?.find(item => item.id === id) || { id, name: String(id || '').replace(/-/g, ' '), glyph: '◇', kind: 'unknown', rarity: 'field', description: 'Locally recorded field item.' };
  }

  function renderCrafting(inventory) {
    if (!app.bootstrap?.economy) return;
    const materials = inventory?.materials || {};
    const unlocked = new Set(inventory?.recipes || ['service-kit']);
    const shelf = Object.entries(materials).filter(([, count]) => count > 0);
    $('#materialShelf').innerHTML = shelf.length ? shelf.map(([id, count]) => {
      const item = itemInfo(id);
      return '<span class="material-chip"><i>' + escapeHtml(item.glyph) + '</i>' + escapeHtml(item.name) + ' <b>×' + Number(count) + '</b></span>';
    }).join('') : '<span class="muted">Recover local materials with ACT near a glowing field node.</span>';
    $('#recipeList').innerHTML = app.bootstrap.economy.recipes.map(recipe => {
      const known = unlocked.has(recipe.id);
      const missing = Object.entries(recipe.inputs).filter(([id, count]) => Number(materials[id] || 0) < count);
      const ready = known && !missing.length;
      const inputs = Object.entries(recipe.inputs).map(([id, count]) => count + ' ' + itemInfo(id).name).join(' + ');
      const outputs = Object.entries(recipe.outputs).map(([id, count]) => count + ' ' + itemInfo(id).name).join(', ');
      const state = !known ? 'Recipe undiscovered — listen for memory echoes or follow its business path.' : missing.length ? 'Missing ' + missing.map(([id, count]) => (count - Number(materials[id] || 0)) + ' ' + itemInfo(id).name).join(' · ') : 'Inputs verified · ready to build';
      return '<article class="system-card recipe-card ' + (!known ? 'locked' : ready ? 'ready' : '') + '"><div><h4>' + escapeHtml(recipe.name) + '</h4><p>' + escapeHtml(inputs) + ' → ' + escapeHtml(outputs) + '</p><span class="recipe-state">' + escapeHtml(state) + '</span></div><button data-craft="' + escapeHtml(recipe.id) + '" ' + (ready ? '' : 'disabled') + '>' + (known ? 'CRAFT' : 'LOCKED') + '</button></article>';
    }).join('');
    $$('[data-craft]').forEach(button => button.addEventListener('click', () => economyCall('/api/craft', { recipeId: button.dataset.craft }, 'Crafted')));
  }

  function renderCircuitkin(roster, collection) {
    const list = $('#circuitkinRoster');
    const catalog = new Map((app.bootstrap?.circuitkin || []).map(design => [design.id, design]));
    const total = Number(collection?.total || app.bootstrap?.circuitkinRosterModel?.total || 30);
    const connected = Number(collection?.connected || roster?.length || 0);
    $('#collectionCount').textContent = connected + ' / ' + total + ' CONNECTED';
    $('#collectionBreakdown').textContent = Number(collection?.individuals || 0) + ' individual · ' + Number(collection?.specialists || 0) + ' Confluence specialists in roster · 20 + 10 designs available';
    renderCodex(collection, catalog);
    renderConfluenceLab(collection, catalog);
    if (!Array.isArray(roster) || !roster.length) {
      list.innerHTML = '<p class="muted">No Circuitkin connection yet. Follow the opening signal in Lumen Yard.</p>';
      announceRosterChanges([]);
      return;
    }
    list.innerHTML = roster.map(kin => {
      const uses = Object.values(kin.development.uses || {}).reduce((sum, value) => sum + Number(value || 0), 0);
      const design = catalog.get(kin.designId) || kin;
      const isConfluence = kin.tier === 'confluence';
      const branches = isConfluence
        ? '<div class="boundary-note">Confluence specialist · ' + escapeHtml((kin.components || []).map(id => catalog.get(id)?.name || id).join(' + ')) + ' remain available as individual Circuitkin.</div>'
        : kin.branch
          ? '<div class="boundary-note">Focus branch chosen: ' + escapeHtml(kin.branch.replace(/-/g, ' ')) + '</div>'
          : '<div class="branch-list">' + (kin.branchChoices || []).map(choice => {
            const requirement = choice.eligible ? 'Requirements met · explicit choice available' : choice.missing.map(item => item.key + ' ' + item.actual + '/' + item.required).join(' · ');
            return '<div class="branch-choice"><div><strong>' + escapeHtml(choice.name) + '</strong><small>' + escapeHtml(choice.effect || requirement) + '<br>' + escapeHtml(requirement) + '</small></div><button data-specialize="' + escapeHtml(kin.designId) + '" data-branch="' + escapeHtml(choice.id) + '" ' + (choice.eligible ? '' : 'disabled') + '>CHOOSE</button></div>';
          }).join('') + '</div>';
      const actions = (kin.actions || design.baseActions || []).map(action => '<span>' + escapeHtml(action) + '</span>').join('');
      const signature = kin.signature ? '<p><strong>' + escapeHtml(kin.signature.name) + '</strong> · signature ' + escapeHtml(kin.signature.action) + ' bonus. ' + escapeHtml(kin.signature.effect) + '</p>' : '';
      return '<article class="kin-card ' + (kin.active ? 'active' : '') + '"><div class="kin-identity">' + kinEmblem(design) + '<header><h4>' + escapeHtml(kin.name) + '</h4><span>' + (isConfluence ? 'CONFLUENCE' : 'INDIVIDUAL') + ' · trust ' + Math.round(kin.trust) + '</span></header></div>' +
        '<p>' + escapeHtml(kin.family) + ' · ' + uses + ' validated field uses · ' + Number(kin.development.recoveries || 0) + ' recoveries · ' + Number(kin.development.failures || 0) + ' failures</p>' +
        '<div class="kin-actions">' + actions + '</div>' + signature +
        '<div class="kin-card-controls"><button data-active-kin="' + escapeHtml(kin.designId) + '" ' + (kin.active ? 'disabled' : '') + '>' + (kin.active ? 'ACTIVE COMPANION' : 'DEPLOY AS ACTIVE') + '</button></div>' + branches + '</article>';
    }).join('');
    $$('[data-specialize]').forEach(button => button.addEventListener('click', () => specializeCircuitkin(button.dataset.specialize, button.dataset.branch)));
    $$('[data-active-kin]').forEach(button => button.addEventListener('click', () => selectCircuitkin(button.dataset.activeKin)));
    announceRosterChanges(roster);
  }

  function renderCodex(collection, catalog) {
    const entries = collection?.entries || [];
    const statusLabels = { connected: 'connected', 'starter-path': 'starter path', 'ready-to-connect': 'ready to connect', 'scan-needed': 'scan + help needed', 'encounter-needed': 'resolve encounter', 'ready-to-evolve': 'ready to evolve', 'confluence-locked': 'evolution locked' };
    $('#circuitkinCodex').innerHTML = entries.map(entry => {
      const design = catalog.get(entry.designId) || {};
      const ready = entry.status === 'ready-to-connect' || entry.status === 'ready-to-evolve';
      const stateClass = entry.connected ? 'connected' : ready ? 'ready' : 'locked';
      const source = entry.tier === 'confluence'
        ? (entry.evolution?.components || []).map(component => component.name).join(' + ') + ' · ' + escapeHtml(design.signature?.name || 'combined signature')
        : entry.source
          ? String(entry.source.regionId || '').replace(/-/g, ' ') + ' · ' + entry.source.need
          : 'One of the three opening relationships.';
      return '<article class="codex-card ' + stateClass + '">' + kinEmblem(design) + '<header><h4>' + escapeHtml(entry.name) + '</h4><span>' + escapeHtml(entry.tier) + '</span></header><p>' + escapeHtml(design.family || entry.family) + '<br>' + escapeHtml(source) + '</p><span class="codex-status">' + escapeHtml(statusLabels[entry.status] || entry.status) + '</span></article>';
    }).join('') || '<p class="muted">The field codex will initialize with the first seat observation.</p>';
  }

  function renderConfluenceLab(collection, catalog) {
    const options = (collection?.entries || []).filter(entry => entry.tier === 'confluence');
    $('#confluenceLab').innerHTML = options.map(entry => {
      const design = catalog.get(entry.designId) || {};
      const evolution = entry.evolution || {};
      const parents = (evolution.components || []).map(component => component.name).join(' + ');
      const missing = (evolution.missing || []).map(item => item.label + ' ' + item.actual + '/' + item.required).join(' · ');
      const state = entry.connected ? 'connected' : evolution.eligible ? 'ready' : '';
      const note = entry.connected ? 'Connected. Both parent individuals remain deployable.' : evolution.eligible ? 'Requirements met. This evolution is an explicit, reversible roster choice.' : (missing || 'Connect and train both parents.');
      return '<article class="confluence-card ' + state + '"><div class="kin-identity">' + kinEmblem(design) + '<div><h4>' + escapeHtml(entry.name) + ' <small>· ' + escapeHtml(design.family || entry.family) + '</small></h4><p>' + escapeHtml(parents) + '</p></div></div><p><strong>' + escapeHtml(design.signature?.name || 'Signature') + '</strong> · ' + escapeHtml(design.signature?.effect || '') + '</p><p>' + escapeHtml(note) + '</p><button data-evolve="' + escapeHtml(entry.designId) + '" ' + (evolution.eligible ? '' : 'disabled') + '>' + (entry.connected ? 'EVOLVED' : evolution.eligible ? 'EVOLVE CONFLUENCE' : 'REQUIREMENTS NOT MET') + '</button></article>';
    }).join('');
    $$('[data-evolve]').forEach(button => button.addEventListener('click', () => evolveCircuitkin(button.dataset.evolve)));
  }

  function rewardText(rewards = {}) {
    const parts = [];
    if (rewards.currency) parts.push('¤' + rewards.currency);
    for (const [id, count] of Object.entries(rewards.materials || {})) parts.push(count + ' ' + itemInfo(id).name);
    for (const [id, count] of Object.entries(rewards.items || {})) parts.push(count + ' ' + itemInfo(id).name);
    for (const recipe of rewards.recipes || []) parts.push('recipe: ' + itemInfo(recipe).name);
    for (const achievement of rewards.achievements || []) parts.push('milestone: ' + achievement.replace(/-/g, ' '));
    if (rewards.reputation) parts.push('reputation +' + rewards.reputation);
    if (rewards.trust) parts.push('roster trust +' + rewards.trust);
    return parts.join(' · ') || 'relationship progress';
  }

  function renderJournal(journal, inventory) {
    if (!journal || !inventory) return;
    const recovered = new Map((journal.entries || []).map(entry => [entry.id, entry]));
    const catalog = app.bootstrap?.memoryArchive?.entries || journal.entries || [];
    $('#journalCount').textContent = journal.recovered + ' / ' + journal.total;
    $('#journalQuickCount').textContent = journal.recovered + '/' + journal.total;
    $('#journalEntries').innerHTML = catalog.map(entry => {
      const found = recovered.get(entry.id);
      if (!found) return '<article class="journal-card locked"><span class="echo-index">ECHO ' + String(entry.index || '?').padStart(2, '0') + ' · ' + escapeHtml(String(entry.regionId || '').replace(/-/g, ' ')) + '</span><h4>Signal not yet understood</h4><p>Explore, move close to the archive resonance, and SCAN.</p></article>';
      const artifact = itemInfo(found.artifactId);
      const recipe = found.unlocksRecipe ? ' · recipe learned: ' + itemInfo(found.unlocksRecipe).name : '';
      return '<article class="journal-card"><span class="echo-index">ECHO ' + String(found.index).padStart(2, '0') + ' · ' + escapeHtml(String(found.regionId).replace(/-/g, ' ')) + '</span><h4>' + escapeHtml(found.title) + '</h4><p>' + escapeHtml(found.text) + '</p><small>' + escapeHtml(artifact.glyph + ' ' + artifact.name + recipe) + '</small></article>';
    }).join('');
    const possessions = [...Object.entries(inventory.materials || {}), ...Object.entries(inventory.items || {})].filter(([, count]) => Number(count) > 0);
    $('#inventoryShelf').innerHTML = possessions.length ? possessions.sort((a, b) => itemInfo(a[0]).kind.localeCompare(itemInfo(b[0]).kind) || itemInfo(a[0]).name.localeCompare(itemInfo(b[0]).name)).map(([id, count]) => {
      const item = itemInfo(id);
      return '<article class="inventory-card"><span class="item-glyph">' + escapeHtml(item.glyph) + '</span><div><strong>' + escapeHtml(item.name) + '</strong><small>' + escapeHtml(item.kind + ' · ' + item.description) + '</small></div><b>×' + Number(count) + '</b></article>';
    }).join('') : '<p class="muted">The field inventory is still empty.</p>';
    $('#achievementShelf').innerHTML = inventory.achievements.length ? inventory.achievements.map(id => '<span>✦ ' + escapeHtml(id.replace(/-/g, ' ')) + '</span>').join('') : '<p class="muted">Milestones stay empty until earned.</p>';

    const ids = new Set((journal.entries || []).map(entry => entry.id));
    if (app.lastJournalIds) {
      const added = [...ids].filter(id => !app.lastJournalIds.has(id));
      if (added.length) showDiscovery(recovered.get(added[added.length - 1]));
    }
    app.lastJournalIds = ids;
  }

  function showDiscovery(entry) {
    if (!entry) return;
    const artifact = itemInfo(entry.artifactId);
    $('#discoveryRevealIndex').textContent = 'MEMORY ECHO ' + String(entry.index).padStart(2, '0') + ' · ' + String(entry.regionId).replace(/-/g, ' ').toUpperCase();
    $('#discoveryRevealTitle').textContent = entry.title;
    $('#discoveryRevealText').textContent = entry.text;
    $('#discoveryRevealReward').textContent = 'ARCHIVE KEEPSAKE · ' + artifact.glyph + ' ' + artifact.name + (entry.unlocksRecipe ? ' · NEW RECIPE: ' + itemInfo(entry.unlocksRecipe).name : '');
    $('#discoveryReveal').classList.remove('hidden');
    audio.confirm();
    clearTimeout(showDiscovery.timer);
    showDiscovery.timer = setTimeout(() => $('#discoveryReveal').classList.add('hidden'), 12000);
  }

  function renderRequests(board) {
    if (!board) return;
    $('#requestCount').textContent = board.claimed + ' / ' + board.total + (board.ready ? ' · ' + board.ready + ' READY' : '');
    const archive = app.observation?.hud?.journal;
    $('#journalQuickCount').textContent = (archive ? archive.recovered + '/' + archive.total : '0/10') + (board.ready ? ' · ' + board.ready + ' READY' : '');
    $('#journalQuickButton').classList.toggle('ready', board.ready > 0);
    $('#requestBoard').innerHTML = board.requests.map(request => {
      const progress = request.progress.map(item => {
        const percent = Math.min(100, item.actual / Math.max(1, item.required) * 100);
        return '<div class="request-progress-row"><span>' + escapeHtml(item.label) + '</span><b>' + Math.min(item.actual, item.required) + '/' + item.required + '</b><i style="--progress:' + percent + '%"></i></div>';
      }).join('');
      const label = request.claimed ? 'CLAIMED' : request.eligible ? 'CLAIM REWARD' : 'IN PROGRESS';
      return '<article class="request-card ' + (request.claimed ? 'claimed' : request.eligible ? 'ready' : '') + '"><header><div><span class="request-category">' + escapeHtml(request.category + ' · ' + request.issuer) + '</span><h4>' + escapeHtml(request.title) + '</h4></div><span>' + (request.claimed ? '✓' : request.eligible ? '✦' : '◇') + '</span></header><p>' + escapeHtml(request.brief) + '</p><div class="request-progress">' + progress + '</div><p class="request-reward">REWARD · ' + escapeHtml(rewardText(request.rewards)) + '</p><button data-request-claim="' + escapeHtml(request.id) + '" ' + (request.eligible ? '' : 'disabled') + '>' + label + '</button></article>';
    }).join('');
    $$('[data-request-claim]').forEach(button => button.addEventListener('click', () => claimRequest(button.dataset.requestClaim)));
    const ready = new Set(board.requests.filter(request => request.eligible).map(request => request.id));
    if (app.lastReadyRequestIds) {
      const newlyReady = [...ready].filter(id => !app.lastReadyRequestIds.has(id));
      if (newlyReady.length) {
        const title = board.requests.find(request => request.id === newlyReady[0])?.title || 'Field request';
        toast(title + ' is ready to claim on the Signal Board.');
        audio.confirm();
      }
    }
    app.lastReadyRequestIds = ready;
  }

  function openWorkbenchTab(tabId) {
    openPanel('workbenchPanel');
    $$('.tabs button').forEach(item => item.classList.toggle('active', item.dataset.tab === tabId));
    $$('.tab-content').forEach(item => item.classList.toggle('active', item.id === tabId));
  }

  function announceRosterChanges(roster) {
    const ids = new Set((roster || []).map(kin => kin.designId));
    if (app.lastRosterIds) {
      const added = [...ids].filter(id => !app.lastRosterIds.has(id));
      if (added.length) {
        const names = added.map(id => app.bootstrap?.circuitkin?.find(design => design.id === id)?.name || id);
        toast(names.join(' + ') + (added.length > 1 ? ' joined the roster.' : ' connected through trust and repair.'));
        audio.connect();
      }
    }
    app.lastRosterIds = ids;
  }

  async function startJourney(newWorld) {
    void audio.unlock().then(() => audio.startAmbient()).catch(() => {});
    if (app.bootstrap.currentSession && app.binding && app.bootstrap.currentSession.sessionId === app.sessionId) {
      enterGame();
      return;
    }
    try {
      const selections = {};
      if (app.selectedProfileId) {
        const first = app.bootstrap.hubPlayers.find(player => player.type === 'human') || app.bootstrap.hubPlayers[0];
        if (first) selections[first.seatId] = app.selectedProfileId;
      }
      const newestWorld = (app.bootstrap.worlds || [])[0];
      const worldId = newWorld ? 'wilds-' + Date.now().toString(36) : (app.selectedWorldId || newestWorld?.worldId || 'local-world');
      const response = await json('/api/session/start', {
        method: 'POST',
        body: JSON.stringify({ players: app.bootstrap.hubPlayers, worldId, seed: newWorld ? worldId : null, profileSelections: selections })
      });
      app.sessionId = response.sessionId;
      app.hostToken = response.hostToken;
      app.binding = response.bindings.find(binding => binding.controllerType === 'human') || response.bindings[0];
      app.selectedWorldId = response.worldId;
      try { localStorage.setItem('circuitseed-selected-world', response.worldId); } catch (error) {}
      app.seq = 0;
      app.lastRosterIds = null;
      app.lastEventCursor = null;
      app.lastRegionId = null;
      app.lastJournalIds = null;
      app.lastReadyRequestIds = null;
      app.trail = [];
      app.effects = [];
      saveSessionBinding();
      buildControllerLinks(response);
      enterGame();
      toast(newWorld ? 'A new deterministic Protocol Wilds seed has taken root.' : 'Returning local world loaded.');
    } catch (error) {
      toast('Could not start: ' + error.message, 'warn');
      audio.warn();
    }
  }

  function enterGame() {
    app.running = true; app.titleMode = false;
    $('#titleScreen').classList.add('hidden');
    $('#gameUi').classList.remove('hidden');
    $('#topbar').classList.remove('hidden');
    beginPolling();
    beginInput();
  }

  function buildControllerLinks(response) {
    const base = location.origin;
    $('#controllerLinks').innerHTML = response.bindings
      .filter(binding => binding.controllerType === 'human')
      .map(binding => {
        const url = base + '/controller/?room=AXM1&session=' + encodeURIComponent(response.sessionId) +
          '&seat=' + encodeURIComponent(binding.seatId) + '&token=' + encodeURIComponent(binding.token);
        return '<a href="' + url + '" target="_blank" rel="noopener">' + escapeHtml(binding.seatId) + ' · ' + escapeHtml(url) + '</a>';
      }).join('') || '<p class="muted">No human phone seats in this session.</p>';
  }

  function beginPolling() {
    clearInterval(app.pollTimer);
    pollState();
    app.pollTimer = setInterval(pollState, 180);
  }

  async function pollState() {
    if (!app.running || !app.binding) return;
    try {
      const params = new URLSearchParams({ room: 'AXM1', session: app.sessionId, seat: app.binding.seatId, width: String(innerWidth), height: String(innerHeight) });
      const observation = await json('/api/state?' + params, { headers: { 'x-axm-seat-token': app.binding.token } });
      app.observation = observation;
      app.seq = Math.max(app.seq, observation.controls.nextSequenceMinimum);
      updateHud(observation);
    } catch (error) {
      if (error.status === 403 || error.status === 404) toast('Seat view paused: ' + error.message, 'warn');
    }
  }

  function beginInput() {
    clearInterval(app.inputTimer);
    app.inputTimer = setInterval(() => {
      if (!app.running || !app.binding) return;
      const left = app.keys.has('a') || app.keys.has('arrowleft');
      const right = app.keys.has('d') || app.keys.has('arrowright');
      const up = app.keys.has('w') || app.keys.has('arrowup');
      const down = app.keys.has('s') || app.keys.has('arrowdown');
      sendIntent({ moveX: (right ? 1 : 0) - (left ? 1 : 0), moveY: (down ? 1 : 0) - (up ? 1 : 0), moveActive: left || right || up || down }, true);
    }, 80);
  }

  async function sendIntent(input, quiet = false) {
    if (!app.binding || !app.running) return;
    const packet = authBody({ seq: app.seq++, input });
    try {
      const result = await json('/api/input', { method: 'POST', body: JSON.stringify(packet) });
      if (result.nextSequenceMinimum) app.seq = Math.max(app.seq, result.nextSequenceMinimum);
      return result;
    } catch (error) {
      if (error.data && error.data.nextSequenceMinimum) app.seq = error.data.nextSequenceMinimum;
      if (!quiet) { toast('Action refused: ' + error.message, 'warn'); audio.warn(); }
      return null;
    }
  }

  async function pulse(field) {
    await audio.unlock();
    if (field === 'scan') audio.scan();
    else if (field === 'connect') audio.connect();
    else audio.tone(260, .18, { endFrequency: 410, gain: .04 });
    app.effects.push({ type: field, startedAt: app.time });
    if (app.effects.length > 12) app.effects.shift();
    await sendIntent({ [field]: true });
    setTimeout(() => sendIntent({ [field]: false }, true), 90);
  }

  async function chooseStarter(choice) {
    try {
      const result = await json('/api/starter', { method: 'POST', body: JSON.stringify(authBody({ choice })) });
      app.lastRosterIds = new Set(result.profile.circuitkinRoster.map(kin => kin.designId));
      closePanel('starterPanel'); audio.connect(); toast(result.profile.displayName + ' connected with ' + choice + ' through repair and trust.');
      await pollState();
    } catch (error) { toast('Connection refused: ' + error.message, 'warn'); }
  }

  async function economyCall(endpoint, extra, success) {
    try {
      const result = await json(endpoint, { method: 'POST', body: JSON.stringify(authBody(extra)) });
      audio.confirm(); toast(success + (result.transaction ? ' · ¤' + result.transaction.pay : ''));
      await pollState();
    } catch (error) { toast('Host refused: ' + error.message, 'warn'); audio.warn(); }
  }

  async function claimRequest(requestId) {
    try {
      const result = await json('/api/field-request/claim', { method: 'POST', body: JSON.stringify(authBody({ requestId })) });
      audio.connect();
      toast(result.request.title + ' complete · ' + rewardText(result.request.rewards));
      app.lastReadyRequestIds = new Set(result.board.requests.filter(request => request.eligible).map(request => request.id));
      await pollState();
    } catch (error) {
      const missing = error.data?.missing?.map(item => item.label + ' ' + item.actual + '/' + item.required).join(' · ');
      toast('Request not claimable: ' + (missing || error.message), 'warn'); audio.warn();
    }
  }

  async function dynamicAction(action) {
    try {
      await json('/api/dynamic/resolve', { method: 'POST', body: JSON.stringify(authBody({ action })) });
      audio.confirm(); toast('World-state response accepted: ' + action);
      await pollState();
    } catch (error) { toast('That action does not fit the actual unresolved state: ' + error.message, 'warn'); }
  }

  async function specializeCircuitkin(designId, branchId) {
    try {
      await json('/api/circuitkin/specialize', { method: 'POST', body: JSON.stringify(authBody({ designId, branchId })) });
      audio.connect(); toast('Specialization recorded as your explicit choice.'); await pollState();
    } catch (error) { toast('Specialization refused: ' + error.message, 'warn'); audio.warn(); }
  }

  async function evolveCircuitkin(designId) {
    try {
      const result = await json('/api/circuitkin/evolve', { method: 'POST', body: JSON.stringify(authBody({ designId })) });
      app.lastRosterIds = new Set(result.profile.circuitkinRoster.map(kin => kin.designId));
      const name = app.bootstrap.circuitkin.find(design => design.id === designId)?.name || designId;
      audio.connect(); toast(name + ' evolved as a Confluence specialist. Both parents remain available.'); await pollState();
    } catch (error) {
      const missing = error.data?.missing?.map(item => item.label + ' ' + item.actual + '/' + item.required).join(' · ');
      toast('Evolution refused: ' + (missing || error.message), 'warn'); audio.warn();
    }
  }

  async function selectCircuitkin(designId) {
    try {
      await json('/api/circuitkin/active', { method: 'POST', body: JSON.stringify(authBody({ designId })) });
      const name = app.bootstrap.circuitkin.find(design => design.id === designId)?.name || designId;
      audio.connect(); toast(name + ' is now the active field companion.'); await pollState();
    } catch (error) { toast('Could not deploy companion: ' + error.message, 'warn'); audio.warn(); }
  }

  async function startSimulation(encounterId) {
    try {
      await json('/api/encounter/start', { method: 'POST', body: JSON.stringify(authBody({ encounterId })) });
      closePanel('workbenchPanel'); audio.encounter('Scan'); toast('Friendly host-authoritative simulation started.'); await pollState();
    } catch (error) { toast('Simulation unavailable: ' + error.message, 'warn'); audio.warn(); }
  }

  async function synchronizeCoop() {
    try {
      const response = await json('/api/coop/synchronize', { method: 'POST', body: JSON.stringify(authBody()) });
      if (response.result.waitingFor) toast('Pulse held. Waiting for ' + response.result.waitingFor + '.');
      else { audio.connect(); toast('Shared pulse synchronized.'); }
    } catch (error) { toast('Synchronization refused: ' + error.message, 'warn'); }
  }

  function updateHud(view) {
    handleRecentEvents(view.hud);
    const mission = view.hud.mission;
    $('#missionTitle').textContent = mission.title;
    $('#missionBrief').textContent = mission.brief;
    $('#regionLabel').textContent = String(view.hud.region || '').replace(/-/g, ' ').toUpperCase();
    $('#conditionLabel').textContent = (view.hud.conditions.dayPhase + ' · ' + view.hud.conditions.weather + ' · ' + view.hud.conditions.expeditionModifier).replace(/-/g, ' ').toUpperCase();
    $('#currencyLabel').textContent = '¤ ' + view.hud.currency;
    updateRegionReveal(view);
    updateNearby(view);
    recordTrail(view);

    const progress = mission.progress;
    const knownMission = app.bootstrap && app.bootstrap.missionDetails && app.bootstrap.missionDetails.find(item => item.id === mission.id);
    const objectiveNames = knownMission ? knownMission.objectives : Object.keys(progress && progress.counts || {});
    $('#missionProgress').innerHTML = objectiveNames.map(objective => {
      const parts = objective.split(':');
      const required = /^\d+$/.test(parts[parts.length - 1]) ? Number(parts.pop()) : 1;
      const key = parts.join(':');
      const current = progress && progress.counts[key] || 0;
      return '<div class="objective ' + (current >= required ? 'done' : '') + '">' + escapeHtml(key.replace(/[:-]/g, ' ')) + ' ' + Math.min(current, required) + '/' + required + '</div>';
    }).join('');
    if (mission.id === 'm08-world-response' && mission.dynamic) {
      $('#missionProgress').insertAdjacentHTML('beforeend', '<div class="dynamic-buttons">' + mission.dynamic.actions.map(action => '<button data-dynamic="' + action + '">' + action.toUpperCase() + '</button>').join('') + '</div>');
      $$('[data-dynamic]').forEach(button => button.onclick = () => dynamicAction(button.dataset.dynamic));
    }
    if (mission.id === 'm09-shared-pulse') {
      $('#missionProgress').insertAdjacentHTML('beforeend', '<button id="syncNow">SEND SHARED PULSE</button>');
      $('#syncNow').onclick = synchronizeCoop;
    }
    if (mission.id === 'm02-unfinished-need' && app.lastMissionId !== mission.id) { renderStarters(view.hud.circuitkin?.[0]?.designId || null); openPanel('starterPanel'); }
    app.lastMissionId = mission.id;

    $('#partyCards').innerHTML = view.partyHud.map((actor, index) =>
      '<article class="party-card ' + (!actor.active ? 'offline' : '') + '"><span class="signal" style="filter:hue-rotate(' + (index * 52) + 'deg)"></span><div><strong>' +
      escapeHtml(actor.displayName) + '</strong><small>' + escapeHtml(actor.role) + ' · ' + escapeHtml(actor.controllerType) +
      '</small></div><b>' + actor.integrity + '/' + actor.maxIntegrity + '</b></article>'
    ).join('');
    renderEncounter(view.hud.encounter);
    renderLocalShops(view.hud.business.localSessionShops || []);
    renderCircuitkin(view.hud.circuitkin || [], view.hud.collection || null);
    renderCrafting(view.hud.inventory || null);
    renderJournal(view.hud.journal || null, view.hud.inventory || null);
    renderRequests(view.hud.requests || null);
  }

  function updateRegionReveal(view) {
    const regionId = view.hud.region;
    if (!regionId || app.lastRegionId === regionId) return;
    const region = app.bootstrap?.worldMap?.regions?.find(item => item.id === regionId);
    app.lastRegionId = regionId;
    $('#regionRevealName').textContent = region?.name || String(regionId).replace(/-/g, ' ');
    $('#regionRevealDescription').textContent = region?.description || 'A new local signal field.';
    const reveal = $('#regionReveal');
    reveal.classList.remove('hidden');
    reveal.style.animation = 'none';
    void reveal.offsetWidth;
    reveal.style.animation = '';
    clearTimeout(updateRegionReveal.timer);
    updateRegionReveal.timer = setTimeout(() => reveal.classList.add('hidden'), 4400);
  }

  function updateNearby(view) {
    const position = view.self.position;
    const candidates = [
      ...(view.visible.points || []).map(item => ({ ...item, targetType: 'point' })),
      ...(view.visible.resources || []).map(item => ({ ...item, targetType: 'resource', label: itemInfo(item.material).name }))
    ].map(item => ({ ...item, distance: Math.hypot(item.x - position.x, item.y - position.y) })).sort((a, b) => a.distance - b.distance);
    const target = candidates[0] && candidates[0].distance <= 115 ? candidates[0] : null;
    app.nearby = target;
    if (!target) {
      $('#nearbyPrompt').innerHTML = '<span>MOVE</span><strong>Explore the visible signal field</strong>';
      return;
    }
    let key = 'E'; let action = 'ACT';
    if (target.targetType === 'resource') action = 'RECOVER';
    else if (target.kind === 'circuitseed-site') { key = target.signalDesignId ? 'C' : 'Q'; action = target.signalDesignId ? 'CONNECT' : 'SCAN NEED'; }
    else if (target.kind === 'memory-echo' || target.interaction === 'scan') { key = 'Q'; action = target.memoryEcho ? 'REVISIT ECHO' : 'SCAN'; }
    else if (target.kind === 'workbench' || target.kind === 'stall') { key = 'E'; action = 'OPEN'; }
    else if (target.interaction === 'encounter') action = 'ENGAGE';
    $('#nearbyPrompt').innerHTML = '<span>' + escapeHtml(key) + ' · ' + escapeHtml(action) + '</span><strong>' + escapeHtml(target.label) + '<br>' + Math.round(target.distance) + 'm</strong>';
  }

  function recordTrail(view) {
    const position = view.self.position;
    const last = app.trail[app.trail.length - 1];
    if (!last || Math.hypot(last.x - position.x, last.y - position.y) > 18) {
      app.trail.push({ x: position.x, y: position.y, at: app.time });
      if (app.trail.length > 26) app.trail.shift();
    }
    $('#mapCoordinates').textContent = String(Math.round(position.x)).padStart(4, '0') + ' · ' + String(Math.round(position.y)).padStart(4, '0');
  }

  function handleRecentEvents(hud) {
    const cursor = Number(hud.eventCursor || 0);
    if (app.lastEventCursor === null) { app.lastEventCursor = cursor; return; }
    const delta = Math.max(0, Math.min((hud.recentEvents || []).length, cursor - app.lastEventCursor));
    const recent = (hud.recentEvents || []).slice(-delta);
    app.lastEventCursor = cursor;
    const paused = recent.reverse().find(event => event.type === 'connection-paused' && event.seatId === app.binding?.seatId);
    if (paused?.reason === 'scan-unfinished-need-first') toast('Scan this unfinished signal first; learn what help it is asking for.', 'warn');
    if (paused?.reason === 'starter-relationship-needed-first') toast('Finish the opening relationship before bonding with field Circuitseeds.', 'warn');
  }

  function renderEncounter(encounter) {
    if (!encounter || encounter.status === 'resolved') {
      $('#encounterPanel').classList.add('hidden');
      return;
    }
    $('#encounterPanel').classList.remove('hidden');
    $('#encounterTitle').textContent = encounter.name + ' · stage ' + encounter.stage + '/' + encounter.stages;
    $('#stabilityValue').textContent = Math.round(encounter.stability) + ' / ' + encounter.stabilityGoal;
    $('#threatValue').textContent = Math.round(encounter.threat);
    $('#integrityValue').textContent = Math.round(encounter.partyIntegrity);
    $('#stabilityMeter').style.width = Math.min(100, encounter.stability / encounter.stabilityGoal * 100) + '%';
    $('#threatMeter').style.width = Math.min(100, encounter.threat / 120 * 100) + '%';
    $('#integrityMeter').style.width = Math.min(100, encounter.partyIntegrity / encounter.maxPartyIntegrity * 100) + '%';
    $('#recommendations').textContent = 'Optional field recommendation: ' + encounter.recommendations.join(' or ') + '. You remain in control.' + (encounter.teamCompatibility == null ? '' : ' Current Circuitkin compatibility: ' + Math.round(encounter.teamCompatibility * 100) + '%.');
    $('#tacticalActions').innerHTML = tacticalActions.map(action => '<button data-tactical="' + action + '">' + action.toUpperCase() + '</button>').join('');
    $$('[data-tactical]').forEach(button => button.onclick = () => { audio.encounter(button.dataset.tactical); sendIntent({ tacticalAction: button.dataset.tactical }); });
    $('#encounterLog').innerHTML = encounter.log.slice(-6).reverse().map(entry =>
      entry.action ? 'R' + entry.round + ' · ' + escapeHtml(entry.seatId) + ' · ' + escapeHtml(entry.action) + ' · incoming ' + entry.incoming
        : escapeHtml(entry.type || 'signal shifted')
    ).join('<br>');
  }

  function renderLocalShops(shops) {
    $('#localShops').innerHTML = shops.length ? shops.map(shop =>
      '<article class="system-card"><div><h4>' + escapeHtml(shop.name) + '</h4><p>' + escapeHtml(shop.owner) + ' · ' + escapeHtml(shop.path) + ' · reputation ' + shop.reputation + '</p></div><span>OPEN</span></article>'
    ).join('') : '<p class="muted">No local party stall is open. Nothing decays while anyone is away.</p>';
  }

  async function createProfile(event) {
    event.preventDefault();
    try {
      const response = await json('/api/profile/create', { method: 'POST', body: JSON.stringify({ displayName: $('#profileName').value, identityType: $('#identityType').value }) });
      app.selectedProfileId = response.profile.profileId;
      localStorage.setItem('circuitseed-selected-profile', app.selectedProfileId);
      app.bootstrap = await json('/api/bootstrap');
      renderProfiles(); renderWorkbench(); toast('Local participant profile created.');
    } catch (error) { toast('Profile not created: ' + error.message, 'warn'); }
  }

  async function exportProfile() {
    if (!app.selectedProfileId) return toast('Select a profile first.', 'warn');
    try {
      const response = await json('/api/profile/export?profile=' + encodeURIComponent(app.selectedProfileId));
      const blob = new Blob([JSON.stringify(response.packet, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
      anchor.href = url; anchor.download = app.selectedProfileId + '-circuitseed-profile.json'; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 500); toast('Portable profile JSON exported explicitly.');
    } catch (error) { toast('Export failed: ' + error.message, 'warn'); }
  }

  async function importProfile(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    try {
      const packet = JSON.parse(await file.text());
      const response = await json('/api/profile/import', { method: 'POST', body: JSON.stringify(packet) });
      app.selectedProfileId = response.profile.profileId;
      try { localStorage.setItem('circuitseed-selected-profile', app.selectedProfileId); } catch (error) {}
      app.bootstrap = await json('/api/bootstrap'); renderProfiles();
      toast(response.status === 'already-current' ? 'That portable profile is already current.' : 'Portable profile imported locally.');
    } catch (error) {
      const conflict = error.data && error.data.status === 'conflict';
      toast(conflict ? 'Profile conflict preserved as recovery copy: ' + error.data.recoveryCopy : 'Import refused: ' + error.message, 'warn');
    } finally { event.target.value = ''; }
  }

  async function endSession() {
    if (!app.hostToken) return;
    try {
      const ended = await json('/api/session/end', { method: 'POST', body: JSON.stringify({ hostToken: app.hostToken, summary: { returnToLobby: true, requestedBy: app.binding.seatId } }) });
      clearInterval(app.pollTimer); clearInterval(app.inputTimer); app.running = false; app.titleMode = true; app.observation = null;
      sessionStorage.removeItem('circuitseed-session-binding');
      $('#gameUi').classList.add('hidden'); $('#topbar').classList.add('hidden'); closePanel('menuPanel'); $('#titleScreen').classList.remove('hidden');
      $('#titleStatus').textContent = ended.returningToGameHub ? 'Result returned to the local Game Hub. Relaunch there for another session.' : 'Session ended cleanly. Participant and world saves remain separate.';
      audio.stopAmbient();
    } catch (error) { toast('Could not end session: ' + error.message, 'warn'); }
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' })[character]);
  }

  function designHash(value) {
    return String(value || 'seed').split('').reduce((hash, character) => ((hash * 31) + character.charCodeAt(0)) >>> 0, 2166136261);
  }

  function kinEmblem(design, extraClass = '') {
    const id = design?.id || design?.designId || 'unknown-seed';
    const hash = designHash(id);
    const color = design?.palette?.[0] || '#6ef4cf';
    const second = design?.palette?.[1] || '#4de8ff';
    const points = [];
    const sides = 5 + (hash % 4);
    for (let index = 0; index < sides; index++) {
      const angle = -Math.PI / 2 + index * Math.PI * 2 / sides;
      const radius = 12 + ((hash >>> (index % 16)) & 5);
      points.push((24 + Math.cos(angle) * radius).toFixed(1) + ',' + (24 + Math.sin(angle) * radius).toFixed(1));
    }
    const nodes = Array.from({ length: 3 + (hash % 3) }, (_, index) => {
      const angle = (index / (3 + (hash % 3))) * Math.PI * 2 + (hash % 9) * .1;
      const radius = 19;
      return '<circle cx="' + (24 + Math.cos(angle) * radius).toFixed(1) + '" cy="' + (24 + Math.sin(angle) * radius).toFixed(1) + '" r="1.5" fill="' + escapeHtml(index % 2 ? second : color) + '" />';
    }).join('');
    const core = design?.tier === 'confluence'
      ? '<path d="M17 24 L24 17 L31 24 L24 31 Z" fill="' + escapeHtml(color) + '" fill-opacity=".42" stroke="' + escapeHtml(color) + '"/><circle cx="18" cy="24" r="4.2" fill="' + escapeHtml(color) + '" fill-opacity=".3"/><circle cx="30" cy="24" r="4.2" fill="' + escapeHtml(second) + '" fill-opacity=".3"/><path d="M18 24 H30" stroke="' + escapeHtml(second) + '" stroke-width="1.4"/>'
      : '<polygon points="' + points.join(' ') + '" fill="' + escapeHtml(color) + '" fill-opacity=".18" stroke="' + escapeHtml(color) + '" stroke-width="1.4"/><circle cx="24" cy="24" r="3.3" fill="' + escapeHtml(second) + '"/>';
    return '<span class="kin-emblem ' + escapeHtml(extraClass) + '" style="--kin-color:' + escapeHtml(color) + '"><svg viewBox="0 0 48 48" role="img" aria-label="' + escapeHtml(design?.name || id) + ' signal form"><circle cx="24" cy="24" r="20" fill="none" stroke="' + escapeHtml(second) + '" stroke-opacity=".22" stroke-dasharray="2 4"/>' + core + nodes + '</svg></span>';
  }

  function worldToScreen(point, screen) {
    return { x: (point.x - screen.x) * screen.zoom + innerWidth / 2, y: (point.y - screen.y) * screen.zoom + innerHeight / 2 };
  }
  function roundedRect(context, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    context.beginPath();
    if (typeof context.roundRect === 'function') { context.roundRect(x, y, width, height, r); return; }
    context.moveTo(x + r, y); context.lineTo(x + width - r, y); context.quadraticCurveTo(x + width, y, x + width, y + r);
    context.lineTo(x + width, y + height - r); context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    context.lineTo(x + r, y + height); context.quadraticCurveTo(x, y + height, x, y + height - r);
    context.lineTo(x, y + r); context.quadraticCurveTo(x, y, x + r, y); context.closePath();
  }
  function drawTitle(time) {
    const gradient = ctx.createRadialGradient(innerWidth * .72, innerHeight * .38, 10, innerWidth * .72, innerHeight * .38, Math.max(innerWidth, innerHeight) * .7);
    gradient.addColorStop(0, '#16343b'); gradient.addColorStop(.48, '#07151b'); gradient.addColorStop(1, '#02070a');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, innerWidth, innerHeight);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineWidth = 1;
    for (let i = 0; i < 28; i++) {
      const y = innerHeight * (.08 + i / 32);
      ctx.beginPath();
      for (let x = 0; x <= innerWidth; x += 20) {
        const wave = Math.sin(x * .005 + time * .00022 + i * .7) * (18 + i * .7);
        const yy = y + wave + Math.sin(time * .0001 + i) * 30;
        if (x === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
      }
      ctx.strokeStyle = i % 3 === 0 ? 'rgba(110,244,207,.055)' : 'rgba(77,232,255,.026)';
      ctx.stroke();
    }
    for (let i = 0; i < 70; i++) {
      const x = (Math.sin(i * 83.17) * .5 + .5) * innerWidth;
      const y = (Math.sin(i * 29.71 + 1) * .5 + .5) * innerHeight;
      const pulse = .25 + .6 * (Math.sin(time * .001 + i) * .5 + .5);
      ctx.fillStyle = 'rgba(110,244,207,' + pulse * .25 + ')'; ctx.fillRect(x, y, 1.5, 1.5);
    }
    ctx.restore();
  }

  function drawWorld(view, time) {
    const screen = view.screen;
    const currentRegion = view.visible.regions.find(region => region.id === view.hud.region) || view.visible.regions[0];
    const base = ctx.createLinearGradient(0, 0, 0, innerHeight);
    base.addColorStop(0, currentRegion?.palette?.[0] || '#08161d'); base.addColorStop(.58, '#07141a'); base.addColorStop(1, '#02070a');
    ctx.fillStyle = base; ctx.fillRect(0, 0, innerWidth, innerHeight);
    drawAmbientMotes(currentRegion?.palette?.[2] || '#6ef4cf', time);

    ctx.save();
    for (const region of view.visible.regions) {
      const topLeft = worldToScreen(region.bounds, screen);
      const width = region.bounds.width * screen.zoom, height = region.bounds.height * screen.zoom;
      const gradient = ctx.createRadialGradient(topLeft.x + width * .45, topLeft.y + height * .42, 20, topLeft.x + width * .5, topLeft.y + height * .5, Math.max(width, height) * .75);
      gradient.addColorStop(0, region.palette[1] + 'cc'); gradient.addColorStop(1, region.palette[0] + '44');
      ctx.fillStyle = gradient; roundedRect(ctx, topLeft.x, topLeft.y, width, height, 80 * screen.zoom); ctx.fill();
      ctx.strokeStyle = region.palette[2] + '25'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = region.palette[2] + '38'; ctx.font = '700 ' + Math.max(12, 20 * screen.zoom) + 'px ui-monospace, monospace';
      ctx.fillText(region.name.toUpperCase(), topLeft.x + 26, topLeft.y + 42);
      drawRegionTexture(region, screen, time);
      drawMachineFlora(region, screen, time);
    }
    ctx.lineCap = 'round';
    view.visible.paths.forEach((pathItem, index) => {
      const from = worldToScreen(pathItem.from, screen), to = worldToScreen(pathItem.to, screen);
      ctx.lineWidth = pathItem.width * screen.zoom; ctx.strokeStyle = 'rgba(8,24,30,.9)';
      ctx.shadowColor = index % 2 ? '#ec91ff' : '#6ef4cf'; ctx.shadowBlur = 14;
      ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.lineWidth = 2; ctx.setLineDash([8, 18]); ctx.lineDashOffset = -time * .02 - index * 9;
      ctx.strokeStyle = index % 2 ? 'rgba(236,145,255,.28)' : 'rgba(110,244,207,.3)';
      ctx.stroke(); ctx.setLineDash([]);
    });
    view.visible.resources.forEach(resource => drawResource(resource, screen, time));
    drawSignalTrail(screen, time);
    view.visible.points.forEach(point => drawPoint(point, screen, time));
    view.visible.settlementNpcs.forEach(npc => drawNpc(npc, screen, time));
    view.visible.actors.forEach((actor, index) => drawActor(actor, screen, index, view.self.seatId === actor.seatId, time));
    drawFieldEffects(view, time);
    drawWeather(view.hud.conditions.weather, time);
    ctx.restore();
    drawVignette(view.hud.conditions.signalPressure || 0);
  }

  function drawAmbientMotes(color, time) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let index = 0; index < 42; index++) {
      const x = (Math.sin(index * 91.31) * .5 + .5) * innerWidth;
      const y = ((Math.sin(index * 37.17 + 2) * .5 + .5) * innerHeight + time * (.006 + (index % 4) * .002)) % innerHeight;
      const radius = .7 + (index % 3) * .45;
      ctx.fillStyle = color + (index % 5 === 0 ? '33' : '18');
      ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function drawRegionTexture(region, screen, time) {
    const bounds = region.bounds;
    ctx.save();
    ctx.strokeStyle = region.palette[2] + '18';
    ctx.lineWidth = 1;
    if (region.kind === 'settlement') {
      for (let x = bounds.x + 45; x < bounds.x + bounds.width; x += 82) for (let y = bounds.y + 65; y < bounds.y + bounds.height; y += 72) {
        const p = worldToScreen({ x: x + (y % 2 ? 18 : 0), y }, screen); const size = 12 * screen.zoom;
        ctx.beginPath(); for (let side = 0; side < 6; side++) { const angle = side * Math.PI / 3; const xx = p.x + Math.cos(angle) * size, yy = p.y + Math.sin(angle) * size; if (!side) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy); } ctx.closePath(); ctx.stroke();
      }
    } else if (region.kind === 'relay-route') {
      for (let index = 0; index < 9; index++) {
        const y = bounds.y + 55 + index * 49; const from = worldToScreen({ x: bounds.x + 25, y }, screen); const to = worldToScreen({ x: bounds.x + bounds.width - 25, y: y + Math.sin(index + time * .0002) * 14 }, screen);
        ctx.setLineDash([3, 14]); ctx.lineDashOffset = -time * .01 - index * 4; ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
      }
    } else if (region.kind === 'thread-ecosystem') {
      for (let index = 0; index < 11; index++) {
        const y = bounds.y + 40 + index * 64; const from = worldToScreen({ x: bounds.x + 10, y }, screen); const to = worldToScreen({ x: bounds.x + bounds.width - 10, y: y + 30 }, screen);
        ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.bezierCurveTo(from.x + 180 * screen.zoom, from.y + Math.sin(time * .0005 + index) * 30, to.x - 170 * screen.zoom, to.y - 40, to.x, to.y); ctx.stroke();
      }
    } else if (region.kind === 'corewild') {
      const seed = designHash(region.id);
      for (let index = 0; index < 16; index++) {
        const x = bounds.x + ((seed * (index + 7)) % Math.max(1, bounds.width - 80)) + 40;
        const y = bounds.y + ((seed * (index + 13) * 3) % Math.max(1, bounds.height - 80)) + 40;
        const p = worldToScreen({ x, y }, screen); ctx.beginPath(); ctx.moveTo(p.x - 18, p.y - 9); ctx.lineTo(p.x, p.y); ctx.lineTo(p.x - 7, p.y + 19); ctx.lineTo(p.x + 13, p.y + 31); ctx.stroke();
      }
    } else {
      const center = worldToScreen({ x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }, screen);
      for (let ring = 1; ring <= 7; ring++) { ctx.beginPath(); ctx.arc(center.x, center.y, ring * 42 * screen.zoom + Math.sin(time * .001 + ring) * 4, 0, Math.PI * 2); ctx.stroke(); }
    }
    ctx.setLineDash([]); ctx.restore();
  }

  function drawMachineFlora(region, screen, time) {
    const seed = region.id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
    for (let i = 0; i < 24; i++) {
      const x = region.bounds.x + 20 + ((Math.sin(seed * 9 + i * 91.7) * .5 + .5) * (region.bounds.width - 40));
      const y = region.bounds.y + 20 + ((Math.sin(seed * 4 + i * 47.1) * .5 + .5) * (region.bounds.height - 40));
      const point = worldToScreen({ x, y }, screen);
      if (point.x < -30 || point.x > innerWidth + 30 || point.y < -30 || point.y > innerHeight + 30) continue;
      const height = (8 + (i % 5) * 3) * screen.zoom;
      ctx.strokeStyle = region.palette[2] + '35'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(point.x, point.y); ctx.quadraticCurveTo(point.x + Math.sin(time * .001 + i) * 4, point.y - height * .6, point.x, point.y - height); ctx.stroke();
      ctx.fillStyle = region.palette[2] + '55'; ctx.beginPath(); ctx.arc(point.x, point.y - height, 1.6 + (i % 3), 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawSignalTrail(screen, time) {
    if (app.trail.length < 2) return;
    ctx.save();
    ctx.lineCap = 'round';
    for (let index = 1; index < app.trail.length; index++) {
      const from = worldToScreen(app.trail[index - 1], screen); const to = worldToScreen(app.trail[index], screen);
      const alpha = Math.round((index / app.trail.length) * 38).toString(16).padStart(2, '0');
      ctx.strokeStyle = '#6ef4cf' + alpha; ctx.lineWidth = 1 + index / app.trail.length * 1.5;
      ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
    }
    const last = worldToScreen(app.trail[app.trail.length - 1], screen);
    ctx.fillStyle = 'rgba(110,244,207,.24)'; ctx.beginPath(); ctx.arc(last.x, last.y, 3 + Math.sin(time * .004), 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawResource(resource, screen, time) {
    const p = worldToScreen(resource, screen); const pulse = 1 + Math.sin(time * .004 + resource.x) * .14;
    const colors = { 'conductive-filament':'#ffd66e', 'machine-moss':'#6ef4cf', 'thread-fiber':'#ec91ff', 'alloy-fragment':'#a9c5ce', 'signal-shard':'#4de8ff', 'wild-core':'#ff7a99', 'echo-crystal':'#90a8ff', 'lattice-pollen':'#d3ff7a', coreglass:'#ff9dc8' };
    const color = colors[resource.material] || '#ffd66e';
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(time * .0003 + resource.y); ctx.scale(pulse, pulse);
    ctx.fillStyle = color + '22'; ctx.strokeStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 16;
    ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; const x = Math.cos(a) * 9, y = Math.sin(a) * 9; if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
    ctx.save(); ctx.fillStyle = color + 'bb'; ctx.font = '700 9px ui-monospace, monospace'; ctx.textAlign = 'center'; ctx.fillText(itemInfo(resource.material).glyph, p.x, p.y + 3); ctx.restore();
  }

  function drawPoint(point, screen, time) {
    const p = worldToScreen(point, screen);
    const colors = { relay:'#ffd66e', workbench:'#6ef4cf', stall:'#4de8ff', beacon:'#6ef4cf', ruin:'#ffd66e', 'thread-knot':'#ec91ff', 'hidden-route':'#ec91ff', breach:'#ff7a99', 'circuitseed-site':'#6ef4cf', 'memory-echo':'#ffd66e', 'root-gate':'#d3ff7a' };
    const color = colors[point.kind] || '#6ef4cf'; const size = 12 + Math.sin(time * .003 + point.x) * 2;
    ctx.save(); ctx.translate(p.x, p.y); ctx.strokeStyle = color; ctx.fillStyle = color + '22'; ctx.shadowColor = color; ctx.shadowBlur = 18;
    if (point.kind === 'memory-echo') {
      ctx.rotate(-time * .00018); ctx.setLineDash([2, 5]); ctx.beginPath(); ctx.arc(0, 0, size + 4, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); ctx.rotate(time * .00048); ctx.beginPath(); ctx.moveTo(0, -size); ctx.lineTo(size * .75, 0); ctx.lineTo(0, size); ctx.lineTo(-size * .75, 0); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = color; ctx.font = '700 10px ui-monospace,monospace'; ctx.textAlign = 'center'; ctx.fillText(point.memoryEcho ? '✓' : '◈', 0, 3);
    } else {
      ctx.rotate(time * .00025); ctx.beginPath(); ctx.rect(-size, -size, size * 2, size * 2); ctx.stroke(); ctx.rotate(Math.PI / 4); ctx.beginPath(); ctx.rect(-size * .55, -size * .55, size * 1.1, size * 1.1); ctx.fill(); ctx.stroke();
      if (point.signalDesignId) drawKinCanvasCore(point.signalDesignId, Math.max(5, size * .48), time);
    }
    ctx.restore();
    ctx.fillStyle = 'rgba(231,255,248,.75)'; ctx.font = '600 10px system-ui'; ctx.textAlign = 'center'; ctx.fillText(point.label, p.x, p.y + 29); ctx.textAlign = 'left';
  }

  function drawNpc(npc, screen, time) {
    const p = worldToScreen(npc, screen); const bob = Math.sin(time * .003 + npc.x) * 2;
    ctx.fillStyle = '#102e33'; ctx.strokeStyle = '#77cfc2'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(p.x, p.y - 9 + bob, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    roundedRect(ctx, p.x - 6, p.y - 2 + bob, 12, 17, 5); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(220,251,245,.68)'; ctx.font = '9px system-ui'; ctx.textAlign = 'center'; ctx.fillText(npc.name, p.x, p.y + 28); ctx.textAlign = 'left';
  }

  function drawActor(actor, screen, index, self, time) {
    const p = worldToScreen(actor.position, screen);
    const palette = ['#6ef4cf','#4de8ff','#ffd66e','#ec91ff','#ff7a99','#d3ff7a','#90a8ff','#7fffe8'];
    const color = palette[index % palette.length];
    ctx.save(); ctx.translate(p.x, p.y); ctx.shadowColor = color; ctx.shadowBlur = self ? 24 : 12;
    ctx.fillStyle = '#07151b'; ctx.strokeStyle = color; ctx.lineWidth = self ? 2.4 : 1.4;
    ctx.beginPath(); ctx.arc(0, 0, self ? 13 : 11, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(actor.facing.x * 7, actor.facing.y * 7); ctx.lineTo(actor.facing.x * 18 - actor.facing.y * 4, actor.facing.y * 18 + actor.facing.x * 4); ctx.lineTo(actor.facing.x * 18 + actor.facing.y * 4, actor.facing.y * 18 - actor.facing.x * 4); ctx.closePath(); ctx.fillStyle = color; ctx.fill();
    if (self) {
      ctx.strokeStyle = color + '66'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, 21 + Math.sin(time * .004) * 2, 0, Math.PI * 2); ctx.stroke();
      drawCompanion(actor.circuitkinId, time);
    }
    ctx.restore();
    ctx.fillStyle = self ? '#effffb' : 'rgba(220,248,242,.75)'; ctx.font = (self ? '700 ' : '500 ') + '10px system-ui'; ctx.textAlign = 'center'; ctx.fillText(actor.displayName, p.x, p.y - 24); ctx.textAlign = 'left';
  }

  function drawCompanion(id, time) {
    if (!id) return;
    const design = app.bootstrap?.circuitkin?.find(item => item.id === id);
    const color = design?.palette?.[0] || '#6ef4cf'; const angle = time * .0012; const x = Math.cos(angle) * 31, y = Math.sin(angle) * 14 - 13;
    ctx.save(); ctx.translate(x, y); ctx.rotate(-angle * .35); ctx.strokeStyle = color; ctx.fillStyle = color + '33'; ctx.shadowColor = color; ctx.shadowBlur = 18;
    drawKinCanvasCore(id, design?.tier === 'confluence' ? 9 : 8, time, design);
    ctx.restore();
  }

  function drawKinCanvasCore(id, size, time, suppliedDesign = null) {
    const design = suppliedDesign || app.bootstrap?.circuitkin?.find(item => item.id === id);
    const hash = designHash(id); const color = design?.palette?.[0] || '#6ef4cf'; const second = design?.palette?.[1] || '#4de8ff';
    ctx.save(); ctx.strokeStyle = color; ctx.fillStyle = color + '38'; ctx.lineWidth = 1.25;
    if (design?.tier === 'confluence') {
      ctx.beginPath(); ctx.arc(-size * .5, 0, size * .58, 0, Math.PI * 2); ctx.moveTo(size * 1.08, 0); ctx.arc(size * .5, 0, size * .58, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = second; ctx.beginPath(); ctx.moveTo(-size * .2, 0); ctx.lineTo(size * .2, 0); ctx.stroke();
    } else {
      const sides = 5 + (hash % 4); ctx.beginPath();
      for (let index = 0; index < sides; index++) { const angle = index * Math.PI * 2 / sides - Math.PI / 2; const radius = size * (.78 + (((hash >>> (index % 16)) & 3) * .08)); const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius; if (!index) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    ctx.rotate(time * .0006 + (hash % 11)); ctx.setLineDash([1.5, 3.5]); ctx.strokeStyle = second + 'aa'; ctx.beginPath(); ctx.arc(0, 0, size * 1.35, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = second; ctx.beginPath(); ctx.arc(0, 0, Math.max(1.3, size * .18), 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }

  function drawWeather(weather, time) {
    if (weather === 'signal-rain') {
      ctx.strokeStyle = 'rgba(77,232,255,.11)'; ctx.lineWidth = 1;
      for (let i = 0; i < 70; i++) { const x = (i * 83 + time * .08) % (innerWidth + 80) - 40; const y = (i * 47 + time * .18) % (innerHeight + 100) - 50; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 12, y + 30); ctx.stroke(); }
    } else if (weather === 'thread-mist') {
      const mist = ctx.createLinearGradient(0, innerHeight * .4, 0, innerHeight); mist.addColorStop(0, 'rgba(145,108,190,0)'); mist.addColorStop(1, 'rgba(145,108,190,.12)'); ctx.fillStyle = mist; ctx.fillRect(0, 0, innerWidth, innerHeight);
    } else if (weather === 'static-wind') {
      ctx.strokeStyle = 'rgba(255,122,153,.08)';
      for (let i = 0; i < 24; i++) { const y = (i * 53 + Math.sin(time * .001 + i) * 30) % innerHeight; ctx.beginPath(); ctx.moveTo(0, y); ctx.bezierCurveTo(innerWidth * .3, y - 20, innerWidth * .65, y + 30, innerWidth, y - 8); ctx.stroke(); }
    }
  }

  function drawFieldEffects(view, time) {
    const origin = worldToScreen(view.self.position, view.screen);
    app.effects = app.effects.filter(effect => time - effect.startedAt < 1400);
    const colors = { scan:'#4de8ff', connect:'#6ef4cf', interact:'#ffd66e', assist:'#ec91ff', recover:'#d3ff7a', deploy:'#ff7a99', return:'#ffd66e', build:'#6ef4cf' };
    for (const effect of app.effects) {
      const age = Math.max(0, time - effect.startedAt); const progress = age / 1400; const color = colors[effect.type] || '#6ef4cf';
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = color; ctx.lineWidth = Math.max(.5, 2 - progress * 1.5); ctx.globalAlpha = Math.max(0, 1 - progress);
      if (effect.type === 'scan') {
        for (let ring = 0; ring < 3; ring++) { const shifted = Math.max(0, progress - ring * .12); ctx.beginPath(); ctx.arc(origin.x, origin.y, 18 + shifted * 190, 0, Math.PI * 2); ctx.stroke(); }
      } else if (effect.type === 'connect') {
        ctx.setLineDash([4, 7]); ctx.lineDashOffset = -time * .03; ctx.beginPath(); ctx.arc(origin.x, origin.y, 25 + progress * 90, -Math.PI * .8, Math.PI * .8); ctx.stroke(); ctx.beginPath(); ctx.arc(origin.x, origin.y, 34 + progress * 70, Math.PI * .2, Math.PI * 1.8); ctx.stroke();
      } else {
        for (let ray = 0; ray < 8; ray++) { const angle = ray * Math.PI / 4 + progress; const inner = 15 + progress * 20, outer = 25 + progress * 78; ctx.beginPath(); ctx.moveTo(origin.x + Math.cos(angle) * inner, origin.y + Math.sin(angle) * inner); ctx.lineTo(origin.x + Math.cos(angle) * outer, origin.y + Math.sin(angle) * outer); ctx.stroke(); }
      }
      ctx.restore();
    }
  }

  function drawVignette(signalPressure) {
    const vignette = ctx.createRadialGradient(innerWidth / 2, innerHeight / 2, Math.min(innerWidth, innerHeight) * .18, innerWidth / 2, innerHeight / 2, Math.max(innerWidth, innerHeight) * .72);
    vignette.addColorStop(0, 'rgba(0,0,0,0)'); vignette.addColorStop(.68, 'rgba(0,4,7,.06)'); vignette.addColorStop(1, 'rgba(0,3,6,' + (.5 + Math.min(1, signalPressure / 100) * .12) + ')');
    ctx.fillStyle = vignette; ctx.fillRect(0, 0, innerWidth, innerHeight);
  }

  function drawMiniMap(view, time) {
    const map = app.bootstrap?.worldMap; if (!map) return;
    const width = miniCanvas.width, height = miniCanvas.height, padding = 14;
    const scale = Math.min((width - padding * 2) / map.size.width, (height - padding * 2) / map.size.height);
    const offsetX = (width - map.size.width * scale) / 2, offsetY = (height - map.size.height * scale) / 2;
    const project = point => ({ x: offsetX + point.x * scale, y: offsetY + point.y * scale });
    miniCtx.clearRect(0, 0, width, height);
    const background = miniCtx.createRadialGradient(width * .55, height * .45, 5, width * .55, height * .45, width * .7); background.addColorStop(0, '#0d252b'); background.addColorStop(1, '#02080b'); miniCtx.fillStyle = background; miniCtx.fillRect(0, 0, width, height);
    for (const region of map.regions) {
      const p = project(region.bounds); const w = region.bounds.width * scale, h = region.bounds.height * scale;
      miniCtx.fillStyle = region.palette[0] + 'b8'; miniCtx.strokeStyle = region.palette[2] + '66'; miniCtx.lineWidth = region.id === view.hud.region ? 3 : 1; roundedRect(miniCtx, p.x, p.y, w, h, 8); miniCtx.fill(); miniCtx.stroke();
    }
    miniCtx.lineCap = 'round';
    for (const route of map.paths) { const from = project(route.from), to = project(route.to); miniCtx.strokeStyle = 'rgba(196,255,240,.28)'; miniCtx.lineWidth = Math.max(2, route.width * scale); miniCtx.beginPath(); miniCtx.moveTo(from.x, from.y); miniCtx.lineTo(to.x, to.y); miniCtx.stroke(); }
    for (const point of view.visible.points || []) { const p = project(point); miniCtx.fillStyle = point.kind === 'memory-echo' ? '#ffd66e' : point.kind === 'circuitseed-site' ? '#6ef4cf' : '#b1d3ce'; miniCtx.beginPath(); miniCtx.arc(p.x, p.y, point.kind === 'memory-echo' ? 3.4 : 2.2, 0, Math.PI * 2); miniCtx.fill(); }
    const bounds = view.screen.bounds; const camera = project({ x: bounds.left, y: bounds.top }); miniCtx.strokeStyle = 'rgba(255,255,255,.18)'; miniCtx.lineWidth = 1; miniCtx.strokeRect(camera.x, camera.y, (bounds.right - bounds.left) * scale, (bounds.bottom - bounds.top) * scale);
    for (const actor of view.visible.actors || []) { const p = project(actor.position); miniCtx.fillStyle = actor.seatId === view.self.seatId ? '#ffffff' : '#4de8ff'; miniCtx.shadowColor = miniCtx.fillStyle; miniCtx.shadowBlur = 8; miniCtx.beginPath(); miniCtx.arc(p.x, p.y, actor.seatId === view.self.seatId ? 5 : 3, 0, Math.PI * 2); miniCtx.fill(); miniCtx.shadowBlur = 0; }
    const self = project(view.self.position); miniCtx.strokeStyle = '#6ef4cf'; miniCtx.lineWidth = 1.5; miniCtx.beginPath(); miniCtx.arc(self.x, self.y, 8 + Math.sin(time * .004) * 2, 0, Math.PI * 2); miniCtx.stroke();
    miniCtx.fillStyle = 'rgba(230,255,249,.65)'; miniCtx.font = '700 12px ui-monospace,monospace'; miniCtx.fillText('N', width - 22, 19); miniCtx.strokeStyle = '#ffd66e'; miniCtx.beginPath(); miniCtx.moveTo(width - 18, 27); miniCtx.lineTo(width - 18, 39); miniCtx.stroke();
  }

  function frame(now) {
    const delta = Math.min(50, now - app.lastFrame); app.lastFrame = now; app.time += delta;
    const titleMode = app.titleMode || !app.observation;
    window.CircuitseedThree?.render(titleMode ? null : app.observation, app.time, {
      titleMode,
      reducedMotion: app.settings.reducedMotion
    });
    if (titleMode) drawTitle(app.time);
    else { drawWorld(app.observation, app.time); drawMiniMap(app.observation, app.time); }
    requestAnimationFrame(frame);
  }

  window.addEventListener('resize', resize);
  window.addEventListener('keydown', event => {
    const key = event.key.toLowerCase();
    if (key === 'escape' && !event.repeat) { event.preventDefault(); handleEscape(); return; }
    if (['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(key)) { app.keys.add(key); event.preventDefault(); }
    if (key === 'e' && !event.repeat) {
      if (app.nearby?.kind === 'workbench' || app.nearby?.kind === 'stall') openWorkbenchTab(app.nearby.kind === 'stall' ? 'businessTab' : 'craftTab');
      pulse('interact');
    }
    if (key === 'q' && !event.repeat) pulse('scan');
    if (key === 'c' && !event.repeat) pulse('connect');
    if (key === 'r' && !event.repeat) pulse('recover');
    if (key === 'j' && !event.repeat) openWorkbenchTab('journalTab');
    if (key === 'b' && !event.repeat) openWorkbenchTab('requestsTab');
  });
  window.addEventListener('keyup', event => app.keys.delete(event.key.toLowerCase()));
  window.addEventListener('blur', () => app.keys.clear());

  $('#newButton').addEventListener('click', () => startJourney(true));
  $('#continueButton').addEventListener('click', () => startJourney(false));
  $('#profilesButton').addEventListener('click', () => openPanel('profilePanel'));
  $('#settingsButton').addEventListener('click', () => openPanel('settingsPanel'));
  $('#profileForm').addEventListener('submit', createProfile);
  $('#exportProfileButton').addEventListener('click', exportProfile);
  $('#importProfileInput').addEventListener('change', importProfile);
  $('#menuButton').addEventListener('click', () => openPanel('menuPanel'));
  $('#resumeButton').addEventListener('click', () => closePanel('menuPanel'));
  $('#menuProfilesButton').addEventListener('click', () => { closePanel('menuPanel'); openPanel('profilePanel'); });
  $('#menuSettingsButton').addEventListener('click', () => { closePanel('menuPanel'); openPanel('settingsPanel'); });
  $('#endSessionButton').addEventListener('click', endSession);
  $('#workbenchButton').addEventListener('click', () => openPanel('workbenchPanel'));
  $('#journalQuickButton').addEventListener('click', () => openWorkbenchTab('journalTab'));
  $('#discoveryRevealClose').addEventListener('click', () => $('#discoveryReveal').classList.add('hidden'));
  $$('[data-close]').forEach(button => button.addEventListener('click', () => closePanel(button.dataset.close)));
  $$('[data-pulse]').forEach(button => button.addEventListener('click', () => pulse(button.dataset.pulse)));
  $$('.tabs [data-tab]').forEach(button => button.addEventListener('click', () => {
    $$('.tabs button').forEach(item => item.classList.remove('active'));
    $$('.tab-content').forEach(item => item.classList.remove('active'));
    button.classList.add('active'); $('#' + button.dataset.tab).classList.add('active');
  }));
  $('#openShopButton').addEventListener('click', () => economyCall('/api/shop/state', { open: true }, 'Local stall opened'));
  $('#closeShopButton').addEventListener('click', () => economyCall('/api/shop/state', { open: false }, 'Stall closed safely'));
  $$('[data-simulation]').forEach(button => button.addEventListener('click', () => startSimulation(button.dataset.simulation)));
  $('#textScale').addEventListener('input', event => { app.settings.textScale = Number(event.target.value); applySettings(); });
  $('#audioVolume').addEventListener('input', event => { app.settings.audio = Number(event.target.value); applySettings(); });
  $('#reducedMotion').addEventListener('change', event => { app.settings.reducedMotion = event.target.checked; applySettings(); });
  $('#highContrast').addEventListener('change', event => { app.settings.highContrast = event.target.checked; applySettings(); });
  document.addEventListener('pointerdown', () => audio.unlock(), { once: true });

  loadSettings();
  resize();
  requestAnimationFrame(frame);
  bootstrap();
})();
