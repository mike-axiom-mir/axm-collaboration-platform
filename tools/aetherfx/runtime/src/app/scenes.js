(function (root) {
  'use strict';
  const AXM = root.AXM;
  const esc = AXM.Utils.escapeHtml;

  function dashboard() {
    return `
      <section class="axm-scene scene-dashboard" aria-label="Command dashboard preview">
        <aside class="scene-sidebar" data-axm-role="surface" data-axm-depth="-1">
          <div class="scene-brand"><span class="brand-mark">AXM</span><small>VISUAL FABRIC</small></div>
          <nav class="scene-nav" aria-label="Preview navigation">
            <button class="scene-nav-item is-active" data-axm-role="active"><span>◈</span> Overview</button>
            <button class="scene-nav-item"><span>◇</span> Modules</button>
            <button class="scene-nav-item"><span>⌁</span> Scenes</button>
            <button class="scene-nav-item"><span>◎</span> Verification</button>
          </nav>
          <div class="scene-sidebar-foot" data-axm-role="surface">
            <span class="status-dot"></span><div><strong>Local node</strong><small>Healthy · private</small></div>
          </div>
        </aside>
        <main class="scene-main">
          <header class="scene-topbar entry-item" data-axm-depth="0">
            <div><small>WORKSPACE / VISUAL FABRIC</small><h2>Good light. Clear structure.</h2></div>
            <div class="topbar-actions"><span class="scene-chip">Local</span><span class="avatar">M</span></div>
          </header>
          <div class="metric-grid">
            <article class="metric-card entry-item" data-axm-role="surface active" data-axm-depth="1"><small>ACTIVE MODULES</small><strong>18</strong><span>+4 composed</span></article>
            <article class="metric-card entry-item" data-axm-role="surface" data-axm-depth="1"><small>VALIDATION</small><strong>100%</strong><span>0 blocking faults</span></article>
            <article class="metric-card entry-item" data-axm-role="surface" data-axm-depth="1"><small>QUALITY TIER</small><strong>HIGH</strong><span>adaptive fallback</span></article>
          </div>
          <div class="dashboard-lower">
            <article class="chart-card entry-item" data-axm-role="surface" data-axm-depth="1">
              <div class="card-heading"><div><small>COMPOSITION HEALTH</small><h3>Effect balance</h3></div><span class="scene-chip">Live</span></div>
              <div class="chart-area" aria-hidden="true">
                <div class="chart-grid-lines"></div>
                <svg viewBox="0 0 520 180" preserveAspectRatio="none"><defs><linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--axm-accent)" stop-opacity=".38"/><stop offset="1" stop-color="var(--axm-accent)" stop-opacity="0"/></linearGradient></defs><path class="chart-fill" d="M0 152 C45 138 58 106 105 120 S166 72 214 92 S276 44 330 64 S402 32 520 20 L520 180 L0 180Z" fill="url(#chartFill)"/><path class="chart-line" d="M0 152 C45 138 58 106 105 120 S166 72 214 92 S276 44 330 64 S402 32 520 20" fill="none" stroke="var(--axm-accent)" stroke-width="4"/></svg>
              </div>
              <div class="chart-legend"><span><i></i>Readability</span><span><i></i>Depth</span><span><i></i>Performance</span></div>
            </article>
            <aside class="activity-card entry-item" data-axm-role="surface" data-axm-depth="2">
              <div class="card-heading"><div><small>RECENT ACTIONS</small><h3>Trace</h3></div></div>
              <div class="activity-list">
                <div><span class="activity-icon">✓</span><p><strong>Recipe verified</strong><small>Dependencies resolved</small></p></div>
                <div><span class="activity-icon">↗</span><p><strong>Composite captured</strong><small>8 modules · reusable</small></p></div>
                <div><span class="activity-icon">◇</span><p><strong>Fallback tested</strong><small>Low quality remains readable</small></p></div>
              </div>
              <div class="scene-progress" data-axm-role="loading"><span style="width:78%"></span></div>
            </aside>
          </div>
        </main>
      </section>`;
  }

  function hero() {
    return `
      <section class="axm-scene scene-hero" aria-label="Luminous website hero preview">
        <header class="hero-nav entry-item" data-axm-role="surface" data-axm-depth="1">
          <div class="scene-brand"><span class="brand-mark">AXM</span><small>CREATE ENGINE</small></div>
          <nav><span>Fabric</span><span>Library</span><span>Stewardship</span></nav>
          <button class="hero-nav-cta" data-axm-role="active">Enter workshop</button>
        </header>
        <div class="hero-body">
          <div class="hero-copy" data-axm-depth="1">
            <span class="hero-kicker entry-item">MODULAR VISUAL INTELLIGENCE</span>
            <h1 class="entry-item">Bring your own <em>light</em> to every scene.</h1>
            <p class="entry-item">Compose materials, motion, atmosphere, and focus as reusable parts. Keep the controls simple. Keep the source inspectable.</p>
            <div class="hero-actions entry-item"><button class="primary-cta" data-axm-role="surface active">Create a scene</button><button class="secondary-cta" data-axm-role="surface">Inspect the recipe</button></div>
            <div class="hero-proof entry-item"><span><strong>64</strong> modules</span><span><strong>0</strong> cloud calls</span><span><strong>4</strong> scenes</span></div>
          </div>
          <div class="hero-visual" data-axm-depth="2" aria-hidden="true">
            <div class="orbital-shell" data-axm-role="surface active">
              <div class="orb-core"></div><div class="orbit orbit-a"></div><div class="orbit orbit-b"></div><div class="orbit orbit-c"></div>
              <span class="orbit-node node-a"></span><span class="orbit-node node-b"></span><span class="orbit-node node-c"></span>
            </div>
            <div class="floating-label label-one" data-axm-role="surface"><small>MATERIAL</small><strong>Aetherglass</strong></div>
            <div class="floating-label label-two" data-axm-role="surface"><small>LIGHT</small><strong>Reactive rim</strong></div>
            <div class="floating-label label-three" data-axm-role="surface"><small>STATUS</small><strong>Composed</strong></div>
          </div>
        </div>
      </section>`;
  }

  function hud() {
    return `
      <section class="axm-scene scene-hud" aria-label="Game HUD preview">
        <div class="hud-world" aria-hidden="true">
          <div class="world-grid"></div><div class="world-tower tower-a"></div><div class="world-tower tower-b"></div><div class="world-road"></div><div class="world-horizon"></div>
        </div>
        <header class="hud-top entry-item">
          <div class="hud-score" data-axm-role="surface"><small>TEAM SCORE</small><strong>04<span>:</span>02</strong></div>
          <div class="hud-objective" data-axm-role="surface active"><span class="status-dot"></span><div><small>ACTIVE OBJECTIVE</small><strong>Stabilize the light gate</strong></div></div>
          <div class="hud-clock" data-axm-role="surface"><small>MISSION</small><strong>08:42</strong></div>
        </header>
        <aside class="hud-player entry-item" data-axm-role="surface" data-axm-depth="1">
          <div class="player-avatar">M</div><div class="player-copy"><small>PLAYER ONE</small><strong>MIKE</strong><div class="health-bar"><span style="width:82%"></span></div></div><span class="player-level">LV 12</span>
        </aside>
        <aside class="hud-radar entry-item" data-axm-role="surface active" data-axm-depth="2">
          <div class="radar-grid"><i></i><b></b><span class="radar-dot dot-a"></span><span class="radar-dot dot-b"></span><span class="radar-player"></span></div><small>DISTRICT 04</small>
        </aside>
        <div class="hud-crosshair" data-axm-role="active" aria-hidden="true"><span></span><span></span></div>
        <footer class="hud-bottom entry-item">
          <div class="ability-row"><button data-axm-role="surface"><b>Q</b><span>Pulse</span></button><button data-axm-role="surface active"><b>E</b><span>Light bridge</span></button><button data-axm-role="surface"><b>R</b><span>Repair</span></button></div>
          <div class="weapon-panel" data-axm-role="surface loading"><div><small>ENERGY TOOL</small><strong>ARC-7</strong></div><span class="ammo">18<small>/ 90</small></span></div>
        </footer>
      </section>`;
  }

  function launcher() {
    const cards = [
      ['Visual Fabric', 'Create materials, light rigs, and scene molds.', 'OPEN', 'active'],
      ['Asset Forge', 'Build reusable visual assets and verified packs.', 'READY', ''],
      ['District Party', 'Launch the local multiplayer proof scene.', 'LOCAL', ''],
      ['Mirror Lab', 'Inspect provenance, changes, and package health.', 'CHECK', '']
    ].map(([title, description, status, active], index) => `
      <article class="launcher-card entry-item ${active ? 'is-selected' : ''}" data-axm-role="surface ${active ? 'active' : ''}" data-axm-depth="${index % 3}">
        <div class="launcher-card-art art-${index + 1}"><span>${['✦','◇','▦','◎'][index]}</span></div>
        <div class="launcher-card-copy"><small>AXM MODULE ${String(index + 1).padStart(2, '0')}</small><h3>${esc(title)}</h3><p>${esc(description)}</p></div>
        <span class="launcher-status">${esc(status)}</span>
      </article>`).join('');
    return `
      <section class="axm-scene scene-launcher" aria-label="Local launcher preview">
        <aside class="launcher-rail" data-axm-role="surface" data-axm-depth="-1">
          <div class="launcher-logo">AXM</div><button class="rail-button is-active">⌂</button><button class="rail-button">▦</button><button class="rail-button">◇</button><button class="rail-button">⚙</button><span class="rail-spacer"></span><div class="rail-avatar">M</div>
        </aside>
        <main class="launcher-main">
          <header class="launcher-header entry-item"><div><small>LOCAL WORKSHOP</small><h2>Choose where to create.</h2></div><div class="launcher-health" data-axm-role="surface"><span class="status-dot"></span><div><small>FOUNDATION</small><strong>All systems healthy</strong></div></div></header>
          <div class="launcher-grid">${cards}</div>
          <footer class="launcher-footer entry-item" data-axm-role="surface loading"><div><small>WORKSHOP INDEX</small><strong>Verified 64 modules · 4 scenes · 14 sealed packages</strong></div><div class="scene-progress"><span style="width:100%"></span></div><span>PASS</span></footer>
        </main>
      </section>`;
  }

  AXM.Scenes = {
    render(sceneModule) {
      const renderer = sceneModule?.renderer?.sceneRenderer || 'dashboard';
      const map = { dashboard, hero, hud, launcher };
      return (map[renderer] || dashboard)();
    }
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
