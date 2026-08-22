'use strict';

(() => {
  const byId = (id) => document.getElementById(id);
  const state = { view: null, busy: false, resetArmed: false, resetTimer: null };
  const settings = { highContrast: false, reducedMotion: true };

  function readSetting(name, fallback) {
    try { const value = localStorage.getItem('axm-four-roots-' + name); return value === null ? fallback : value === 'true'; }
    catch (_) { return fallback; }
  }
  function writeSetting(name, value) { try { localStorage.setItem('axm-four-roots-' + name, String(value)); } catch (_) {} }
  function applySettings() {
    document.body.classList.toggle('high-contrast', settings.highContrast);
    document.body.classList.toggle('reduced-motion', settings.reducedMotion);
    byId('contrast-button').setAttribute('aria-pressed', String(settings.highContrast));
    byId('motion-button').setAttribute('aria-pressed', String(settings.reducedMotion));
  }
  function toggleSetting(name) { settings[name] = !settings[name]; writeSetting(name, settings[name]); applySettings(); }

  function actorAt(view, x, y) { return view.zone.actors.find((actor) => actor.x === x && actor.y === y) || null; }
  function renderMap(view) {
    const map = byId('game-map');
    const fragment = document.createDocumentFragment();
    view.zone.map.forEach((row, y) => Array.from(row).forEach((terrain, x) => {
      const tile = document.createElement('div');
      tile.className = 'tile ' + (terrain === '#' ? 'wall' : terrain === '~' ? 'water' : 'ground');
      const actor = actorAt(view, x, y);
      const hasPlayer = view.player.x === x && view.player.y === y;
      if (actor) {
        const marker = document.createElement('span');
        marker.className = 'actor ' + actor.kind;
        marker.textContent = actor.glyph;
        marker.title = actor.label;
        tile.appendChild(marker);
      }
      if (hasPlayer) {
        tile.classList.add('has-player');
        const player = document.createElement('span');
        player.className = 'player';
        player.title = 'You';
        tile.appendChild(player);
      }
      tile.setAttribute('aria-hidden', 'true');
      fragment.appendChild(tile);
    }));
    map.replaceChildren(fragment);
    map.setAttribute('aria-label', view.zone.name + '. Player at column ' + (view.player.x + 1) + ', row ' + (view.player.y + 1) + '. ' + (view.interaction.available ? view.interaction.label + ' is nearby.' : 'No interaction nearby.'));
  }

  function renderRoots(view) {
    const list = byId('root-list');
    list.replaceChildren(...view.progress.roots.map((root, index) => {
      const item = document.createElement('li');
      item.className = root.acquired ? 'acquired' : '';
      item.style.setProperty('--root-color', root.color);
      const seal = document.createElement('span'); seal.className = 'root-seal'; seal.textContent = root.acquired ? '✓' : String(index + 1);
      const copy = document.createElement('span'); copy.className = 'root-copy';
      const name = document.createElement('strong'); name.textContent = root.name;
      const description = document.createElement('small'); description.textContent = root.description;
      copy.append(name, description); item.append(seal, copy); return item;
    }));
  }

  function renderQuests(view) {
    let currentFound = false;
    const rows = view.progress.quests.map((quest) => {
      const item = document.createElement('li');
      item.className = quest.complete ? 'complete' : (!currentFound ? 'current' : '');
      if (!quest.complete && !currentFound) currentFound = true;
      const title = document.createElement('strong'); title.textContent = quest.title;
      const description = document.createElement('small'); description.textContent = quest.description;
      item.append(title, description); return item;
    });
    byId('quest-list').replaceChildren(...rows);
  }

  function renderInventory(view) {
    const list = byId('inventory-list');
    if (!view.progress.inventory.length) {
      const empty = document.createElement('li'); empty.className = 'empty-item'; empty.textContent = 'No discoveries carried yet.'; list.replaceChildren(empty); return;
    }
    list.replaceChildren(...view.progress.inventory.map((item) => {
      const row = document.createElement('li'); row.textContent = item.name; row.title = item.description; return row;
    }));
  }

  function render(view) {
    state.view = view;
    window.AXM_ADVENTURE_STATE = JSON.parse(JSON.stringify(view));
    document.documentElement.style.setProperty('--accent', view.zone.accent);
    byId('tagline').textContent = view.release.tagline;
    byId('zone-title').textContent = view.zone.name;
    byId('zone-subtitle').textContent = view.zone.subtitle;
    byId('move-count').textContent = String(view.progress.moves);
    byId('story-message').textContent = view.message;
    byId('nearby-message').textContent = view.interaction.available ? view.interaction.label + ' is close enough to interact with.' : 'Nothing nearby asks for interaction.';
    byId('interact-button').disabled = !view.interaction.available || state.busy;
    byId('interact-label').textContent = view.interaction.available ? view.interaction.label : 'Nothing nearby';
    byId('release-line').textContent = view.release.id + ' · ' + view.release.version + ' · ' + view.release.contentDigest.slice(0, 22) + '…';
    renderMap(view); renderRoots(view); renderQuests(view); renderInventory(view);
    const ending = byId('ending-panel');
    ending.hidden = !view.ending;
    if (view.ending) {
      byId('ending-title').textContent = view.ending.title;
      byId('ending-message').textContent = view.ending.message;
      byId('ending-next').textContent = view.ending.next;
      ending.scrollIntoView({ behavior: settings.reducedMotion ? 'auto' : 'smooth', block: 'nearest' });
    }
  }

  async function request(pathname, init) {
    const response = await fetch(pathname, init);
    const value = await response.json();
    if (!response.ok) {
      if (value.view) render(value.view);
      throw new Error(value.error || ('request failed with ' + response.status));
    }
    return value;
  }

  async function act(action, direction) {
    if (state.busy || !state.view) return false;
    state.busy = true;
    document.body.dataset.busy = 'true';
    try {
      const body = { action, expectedRevision: state.view.revision };
      if (direction !== undefined) body.direction = direction;
      render(await request('/api/action', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));
      return true;
    } catch (error) {
      byId('story-message').textContent = 'The action was not applied: ' + error.message;
      return false;
    } finally {
      state.busy = false;
      delete document.body.dataset.busy;
      if (state.view) byId('interact-button').disabled = !state.view.interaction.available;
    }
  }

  function closeHelp() { byId('help-panel').hidden = true; byId('help-button').setAttribute('aria-expanded', 'false'); }
  function toggleHelp(force) {
    const panel = byId('help-panel');
    const open = force === undefined ? panel.hidden : Boolean(force);
    panel.hidden = !open; byId('help-button').setAttribute('aria-expanded', String(open));
    if (open) byId('help-close').focus();
  }
  function disarmReset() {
    state.resetArmed = false; clearTimeout(state.resetTimer); state.resetTimer = null;
    byId('reset-button').classList.remove('armed'); byId('reset-button').textContent = 'Start a new journey';
  }
  async function resetJourney() {
    if (!state.view || state.busy) return;
    if (!state.resetArmed) {
      state.resetArmed = true; byId('reset-button').classList.add('armed'); byId('reset-button').textContent = 'Confirm new journey';
      state.resetTimer = setTimeout(disarmReset, 8000); return;
    }
    state.busy = true;
    try {
      const view = await request('/api/reset', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ confirm: true, expectedRevision: state.view.revision }) });
      disarmReset(); render(view);
    } catch (error) { byId('story-message').textContent = 'Reset was not applied: ' + error.message; }
    finally { state.busy = false; }
  }

  document.querySelectorAll('[data-direction]').forEach((button) => button.addEventListener('click', () => act('move', button.dataset.direction)));
  byId('interact-button').addEventListener('click', () => act('interact'));
  byId('help-button').addEventListener('click', () => toggleHelp());
  byId('help-close').addEventListener('click', closeHelp);
  byId('contrast-button').addEventListener('click', () => toggleSetting('highContrast'));
  byId('motion-button').addEventListener('click', () => toggleSetting('reducedMotion'));
  byId('reset-button').addEventListener('click', resetJourney);
  document.addEventListener('keydown', (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const target = event.target;
    const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT');
    if (typing) return;
    const direction = { ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down', ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right' }[event.key];
    if (direction) { event.preventDefault(); act('move', direction); return; }
    if (event.key === 'e' || event.key === 'E' || event.key === ' ') { event.preventDefault(); act('interact'); return; }
    if (event.key === 'h' || event.key === 'H') { event.preventDefault(); toggleHelp(); return; }
    if (event.key === 'c' || event.key === 'C') { event.preventDefault(); toggleSetting('highContrast'); return; }
    if (event.key === 'm' || event.key === 'M') { event.preventDefault(); toggleSetting('reducedMotion'); return; }
    if (event.key === 'Escape') { closeHelp(); disarmReset(); }
  });

  settings.highContrast = readSetting('highContrast', false);
  settings.reducedMotion = readSetting('reducedMotion', true);
  applySettings();
  window.AXM_ADVENTURE_ACTION = act;
  window.AXM_ADVENTURE_RESET = resetJourney;
  request('/api/bootstrap').then(render).catch((error) => { byId('story-message').textContent = 'The local adventure runtime did not answer: ' + error.message; });
})();
