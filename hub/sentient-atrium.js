/* AXM Sentient Atrium visual field
   Deterministic Presentation only: no state, permission, network, lifecycle,
   publish, repair or promotion authority. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AXMSentientAtrium = api;
  if (root && root.document) {
    const start = () => api.mount(root.document);
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', start, { once:true });
    else start();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VERSION = '0.1.0';
  const SEED = 0x41584d35; // "AXM5" — stable visual seed.
  const TAU = Math.PI * 2;
  const PALETTE = ['#56f1dc', '#62d8e8', '#82b7ff', '#a58cff'];

  function generator(seed) {
    let value = seed >>> 0;
    return function next() {
      value += 0x6D2B79F5;
      let n = value;
      n = Math.imul(n ^ (n >>> 15), n | 1);
      n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
      return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
    };
  }

  function round(value) { return Math.round(value * 1000000) / 1000000; }

  function createBlueprint(width, height, seed) {
    const w = Math.max(320, Math.round(Number(width) || 0));
    const h = Math.max(240, Math.round(Number(height) || 0));
    const next = generator((seed == null ? SEED : seed) >>> 0);
    const top = Array.from({ length:18 }, (_, index) => ({
      x:round(index / 17),
      amplitude:round(.08 + next() * .42),
      frequency:round(.72 + next() * 1.35),
      phase:round(next() * TAU),
      color:index === 0 || index === 9 ? 0 : Math.floor(next() * PALETTE.length)
    }));
    const flows = Array.from({ length:7 }, (_, index) => ({
      y:round(.62 + index * .031),
      amplitude:round(.012 + next() * .026),
      frequency:round(.7 + next() * 1.1),
      phase:round(next() * TAU),
      color:index % PALETTE.length,
      alpha:round(.05 + next() * .09)
    }));
    const nodes = Array.from({ length:32 }, (_, index) => ({
      x:round(.17 + next() * .77),
      y:round(.58 + next() * .32),
      radius:round(.7 + next() * 1.5),
      phase:round(next() * TAU),
      color:(index + Math.floor(next() * PALETTE.length)) % PALETTE.length
    }));
    return { version:VERSION, seed:(seed == null ? SEED : seed) >>> 0, width:w, height:h, top, flows, nodes };
  }

  function sample(blueprint, elapsedMs, still) {
    const time = still ? 0 : Math.max(0, Number(elapsedMs) || 0) / 1000;
    return {
      top:blueprint.top.map(point => round(Math.sin(time * point.frequency + point.phase) * point.amplitude)),
      flows:blueprint.flows.map(flow => round(Math.sin(time * .18 + flow.phase) * flow.amplitude)),
      nodes:blueprint.nodes.map(node => round(.55 + .45 * Math.sin(time * .72 + node.phase)))
    };
  }

  function drawWave(ctx, blueprint, frame, y, height, color, alpha, frequency, phase) {
    const width = blueprint.width;
    ctx.beginPath();
    for (let x = 0; x <= width; x += 8) {
      const t = x / width;
      const envelope = .34 + .66 * Math.sin(Math.PI * t);
      const pulse = Math.sin(t * TAU * frequency + phase) * height * envelope;
      const micro = Math.sin(t * TAU * 17 + phase * .37) * height * .12;
      const py = y + pulse + micro;
      if (x === 0) ctx.moveTo(x, py); else ctx.lineTo(x, py);
    }
    ctx.strokeStyle = color;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function render(canvas, blueprint, elapsedMs, options) {
    if (!canvas || !canvas.getContext) return false;
    const opts = options || {};
    const ratio = Math.max(1, Math.min(1.5, Number(opts.pixelRatio) || 1));
    const width = blueprint.width;
    const height = blueprint.height;
    if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
    }
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    const ctx = canvas.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const frame = sample(blueprint, elapsedMs, !!opts.still);

    const ribbonY = Math.min(66, Math.max(52, height * .065));
    const ribbonGradient = ctx.createLinearGradient(0, 0, width, 0);
    ribbonGradient.addColorStop(0, '#f07c72');
    ribbonGradient.addColorStop(.26, '#56f1dc');
    ribbonGradient.addColorStop(.63, '#62d8e8');
    ribbonGradient.addColorStop(1, '#a58cff');
    drawWave(ctx, blueprint, frame, ribbonY, 2.4, ribbonGradient, .56, 4.1, elapsedMs / 2100);

    if (opts.home !== false) {
      blueprint.flows.forEach((flow, index) => {
        drawWave(
          ctx,
          blueprint,
          frame,
          height * (flow.y + frame.flows[index]),
          height * flow.amplitude,
          PALETTE[flow.color],
          flow.alpha,
          flow.frequency,
          flow.phase + elapsedMs / 7600
        );
      });
      blueprint.nodes.forEach((node, index) => {
        const glow = frame.nodes[index];
        ctx.beginPath();
        ctx.arc(node.x * width, node.y * height, node.radius + glow, 0, TAU);
        ctx.fillStyle = PALETTE[node.color];
        ctx.globalAlpha = .09 + glow * .12;
        ctx.shadowColor = PALETTE[node.color];
        ctx.shadowBlur = 9 + glow * 9;
        ctx.fill();
      });
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }
    return true;
  }

  function mount(doc) {
    const canvas = doc && doc.getElementById('sentientSignalField');
    if (!canvas || canvas.dataset.mounted === 'true') return null;
    canvas.dataset.mounted = 'true';
    const win = doc.defaultView || (typeof window !== 'undefined' ? window : null);
    const reduce = !!(win && win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)').matches);
    let blueprint;
    let start = win && win.performance ? win.performance.now() : 0;
    let running = true;
    let frameId = 0;

    const enhanceTitle = () => {
      const title = doc.getElementById('homeTitle');
      if (!title || title.querySelector('em')) return;
      if (title.textContent.trim() !== 'What would you like to make today?') return;
      title.textContent = '';
      title.appendChild(doc.createTextNode('What would you like to '));
      const emphasis = doc.createElement('em');
      emphasis.textContent = 'make';
      title.appendChild(emphasis);
      title.appendChild(doc.createTextNode(' today?'));
    };
    const syncClock = () => {
      const clock = doc.getElementById('sentientRibbonTime');
      if (!clock) return;
      const tail = doc.getElementById('logTail');
      const match = tail && String(tail.textContent || '').match(/\b(\d{1,2}:\d{2}\s(?:AM|PM))\b/i);
      const now = new Date();
      clock.textContent = match ? match[1].toUpperCase() : now.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
      clock.dateTime = now.toISOString();
    };

    const homeVisible = () => {
      const home = doc.getElementById('homeScreen');
      return !home || (home.style.display !== 'none' && !home.hidden);
    };
    const resize = () => {
      const shell = canvas.parentElement;
      const rect = shell ? shell.getBoundingClientRect() : { width:win.innerWidth, height:win.innerHeight };
      blueprint = createBlueprint(rect.width, rect.height, SEED);
      doc.body.dataset.atriumSeed = String(SEED >>> 0);
      doc.body.dataset.atriumMotion = reduce ? 'still' : 'live';
    };
    const tick = now => {
      if (!running) return;
      if (!blueprint) resize();
      render(canvas, blueprint, now - start, {
        pixelRatio:win && win.devicePixelRatio,
        still:reduce,
        home:homeVisible()
      });
      if (!reduce && !doc.hidden) frameId = win.requestAnimationFrame(tick);
    };
    const redraw = () => {
      if (!blueprint) resize();
      render(canvas, blueprint, 0, { pixelRatio:win && win.devicePixelRatio, still:reduce, home:homeVisible() });
    };
    const onVisibility = () => {
      if (doc.hidden) {
        if (frameId) win.cancelAnimationFrame(frameId);
        frameId = 0;
      } else if (!reduce && !frameId) {
        start = win.performance.now();
        frameId = win.requestAnimationFrame(tick);
      }
    };
    const onResize = () => { resize(); redraw(); };
    if (win && win.ResizeObserver) new win.ResizeObserver(onResize).observe(canvas.parentElement);
    else if (win) win.addEventListener('resize', onResize, { passive:true });
    doc.addEventListener('visibilitychange', onVisibility);
    const home = doc.getElementById('homeScreen');
    if (home && win && win.MutationObserver) new win.MutationObserver(redraw).observe(home, { attributes:true, attributeFilter:['style','hidden'] });
    const title = doc.getElementById('homeTitle');
    if (title && win && win.MutationObserver) new win.MutationObserver(enhanceTitle).observe(title, { childList:true, subtree:true, characterData:true });
    const logTail = doc.getElementById('logTail');
    if (logTail && win && win.MutationObserver) new win.MutationObserver(syncClock).observe(logTail, { childList:true, subtree:true, characterData:true });
    enhanceTitle();
    syncClock();
    resize();
    if (reduce) redraw(); else frameId = win.requestAnimationFrame(tick);
    return {
      seed:SEED,
      stop:function () {
        running = false;
        if (frameId && win) win.cancelAnimationFrame(frameId);
        frameId = 0;
      },
      redraw:redraw,
      blueprint:function () { return blueprint; }
    };
  }

  return { VERSION, SEED, PALETTE:PALETTE.slice(), createBlueprint, sample, render, mount };
});
