/* AXM Atrium Vortex — additive hero centerpiece (v0.1, DRAFT / TEST, not canon)
   Presentation only: no state, permission, network, lifecycle, publish,
   repair or promotion authority. Draws the glowing funnel/portal that the
   concept render has and the live signal-field lacks. It MOUNTS ITS OWN
   canvas inside .home-hero, so it cannot disturb #sentientSignalField.
   Deterministic (seeded), palette-matched to sentient-atrium, and it goes
   fully still under prefers-reduced-motion. Auto-mounts; also exports API. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AXMAtriumVortex = api;
  if (root && root.document) {
    const start = () => api.mount(root.document);
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', start, { once:true });
    else start();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VERSION = '0.1.0';
  const SEED = 0x41584d35;                                   // "AXM5" — same stable seed
  const TAU = Math.PI * 2;
  const PALETTE = ['#56f1dc', '#62d8e8', '#82b7ff', '#a58cff']; // teal · cyan · blue · violet

  /* seeded prng (mulberry32) — deterministic particle field */
  function generator(seed) {
    let v = seed >>> 0;
    return function () {
      v += 0x6D2B79F5;
      let n = v;
      n = Math.imul(n ^ (n >>> 15), n | 1);
      n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
      return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
    };
  }

  function blueprint(seed) {
    const next = generator((seed == null ? SEED : seed) >>> 0);
    // rising motes that spiral up the core
    const motes = Array.from({ length:64 }, () => ({
      ang:next() * TAU,
      rad:0.05 + next() * 0.9,          // 0..1 of funnel radius
      y:next(),                         // 0 (bottom) .. 1 (top) phase
      spd:0.06 + next() * 0.16,
      size:0.6 + next() * 1.8,
      color:Math.floor(next() * PALETTE.length),
      tw:next() * TAU
    }));
    return { version:VERSION, seed:(seed == null ? SEED : seed) >>> 0, motes };
  }

  function hexRGB(h) { return [parseInt(h.substr(1,2),16), parseInt(h.substr(3,2),16), parseInt(h.substr(5,2),16)]; }
  function rgba(h, a) { const c = hexRGB(h); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }

  /* one frame of the funnel.
     layer 'full'   = draw the whole funnel structure (standalone centerpiece)
     layer 'motion' = draw ONLY the flow (core shimmer + rising motes), so a
                      static image underneath (e.g. sentient-atrium-core.webp)
                      keeps its detail and simply comes alive. */
  function render(ctx, W, H, bp, t, still, layer) {
    const motionOnly = layer === 'motion';
    ctx.clearRect(0, 0, W, H);
    const time = still ? 0 : t / 1000;
    const cx = W * 0.60;                 // portal axis, centre-right like the render
    const coreY = H * 0.52;              // where the funnel pinches
    const unit = Math.min(W, H);
    const swirl = still ? 0 : time * 0.25;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';   // additive glow stacks like light

    /* ---- central core beam + hot core ---- */
    const beam = ctx.createLinearGradient(cx, coreY - H * 0.42, cx, coreY + H * 0.42);
    beam.addColorStop(0, rgba('#eafffb', 0));
    beam.addColorStop(0.5, rgba('#d6fff6', 0.5));
    beam.addColorStop(1, rgba('#eafffb', 0));
    ctx.fillStyle = beam;
    const beamW = unit * (0.012 + 0.004 * Math.sin(time * 1.6));
    ctx.fillRect(cx - beamW, coreY - H * 0.42, beamW * 2, H * 0.84);

    const core = ctx.createRadialGradient(cx, coreY, 0, cx, coreY, unit * 0.16);
    core.addColorStop(0, rgba('#f2fffb', 0.9));
    core.addColorStop(0.28, rgba('#56f1dc', 0.5));
    core.addColorStop(1, rgba('#56f1dc', 0));
    ctx.fillStyle = core;
    ctx.beginPath(); ctx.arc(cx, coreY, unit * 0.16, 0, TAU); ctx.fill();

    const floorY = coreY + H * 0.30;

    /* structural rings only in 'full' mode. The per-ring shadowBlur IS the neon
       glow — it's what makes the funnel lush instead of a bare wireframe. */
    if (!motionOnly) {
      /* upper funnel: dense rings widen going up from the core */
      const upRings = 38;
      for (let i = 0; i < upRings; i++) {
        const p = i / (upRings - 1);
        const y = coreY - p * H * 0.46;
        const rx = unit * (0.03 + p * 0.34) * (1 + 0.04 * Math.sin(time * 1.2 + i * 0.5));
        const ry = rx * 0.26;
        const col = PALETTE[Math.floor(p * (PALETTE.length - 1) + 0.5)];
        const a = (1 - p) * 0.55 + 0.07;
        ctx.strokeStyle = rgba(col, a);
        ctx.lineWidth = 1.1;
        ctx.shadowColor = rgba(col, Math.min(1, a * 1.5));
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.ellipse(cx, y, rx, ry, Math.sin(swirl + i * 0.2) * 0.05, 0, TAU);
        ctx.stroke();
      }
      /* lower platform: concentric rings on the "floor" */
      const flRings = 8;
      for (let i = 0; i < flRings; i++) {
        const p = i / (flRings - 1);
        const rx = unit * (0.06 + p * 0.42);
        const ry = rx * 0.22;
        const col = PALETTE[(i + 1) % PALETTE.length];
        const a = (1 - p) * 0.36 + 0.06;
        ctx.strokeStyle = rgba(col, a);
        ctx.lineWidth = 1;
        ctx.shadowColor = rgba(col, Math.min(1, a * 1.5));
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.ellipse(cx, floorY, rx, ry, -swirl * 0.4, 0, TAU);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
    }

    /* ---- rising motes spiralling up the funnel ---- */
    bp.motes.forEach(m => {
      const yp = still ? m.y : (m.y + time * m.spd) % 1;          // 0 bottom -> 1 top
      const y = floorY - yp * (floorY - (coreY - H * 0.42));
      const funnelR = unit * (0.03 + (1 - Math.min(1, (floorY - y) / (floorY - coreY + 1))) * 0.0)
                    + unit * (0.34 * Math.max(0, (coreY - y) / (H * 0.46)) + 0.05);
      const ang = m.ang + swirl * (0.6 + m.rad) + (still ? 0 : time * 0.3);
      const rr = funnelR * m.rad;
      const x = cx + Math.cos(ang) * rr;
      const yy = y + Math.sin(ang) * rr * 0.26;
      const tw = still ? 0.7 : (0.35 + 0.65 * Math.abs(Math.sin(time * 1.1 + m.tw)));
      const a = tw * (0.25 + 0.55 * (1 - yp));
      ctx.fillStyle = rgba(PALETTE[m.color], a);
      ctx.beginPath(); ctx.arc(x, yy, m.size, 0, TAU); ctx.fill();
    });

    /* ---- soft ambient bloom over the whole portal ---- */
    const bloom = ctx.createRadialGradient(cx, coreY, 0, cx, coreY, unit * 0.5);
    bloom.addColorStop(0, rgba('#56f1dc', 0.10));
    bloom.addColorStop(0.55, rgba('#a58cff', 0.06));
    bloom.addColorStop(1, rgba('#a58cff', 0));
    ctx.fillStyle = bloom;
    ctx.fillRect(cx - unit * 0.5, coreY - unit * 0.5, unit, unit);

    ctx.restore();
  }

  function mount(doc, opts) {
    opts = opts || {};
    doc = doc || (typeof document !== 'undefined' ? document : null);
    if (!doc) return null;
    const host = doc.querySelector(opts.hostSelector || '.home-hero') ||
                 doc.getElementById('homeScreen') || doc.body;
    if (!host || host.dataset.vortexMounted === 'true') return null;
    host.dataset.vortexMounted = 'true';
    const win = doc.defaultView || (typeof window !== 'undefined' ? window : null);
    const reduce = !!(win && win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)').matches);

    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    const canvas = doc.createElement('canvas');
    canvas.className = 'atrium-vortex-field';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:0';
    host.insertBefore(canvas, host.firstChild);

    const bp = blueprint(opts.seed);
    const layer = opts.layer || 'full';                 // 'full' | 'motion'
    const ctx = canvas.getContext('2d');
    let W = 0, H = 0, ratio = 1, start = win && win.performance ? win.performance.now() : 0, frameId = 0, running = true;

    function resize() {
      const r = host.getBoundingClientRect();
      W = Math.max(320, Math.round(r.width)); H = Math.max(240, Math.round(r.height));
      ratio = Math.max(1, Math.min(1.5, (win && win.devicePixelRatio) || 1));
      canvas.width = Math.round(W * ratio); canvas.height = Math.round(H * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    }
    function draw(now) {
      if (!running) return;
      render(ctx, W, H, bp, now - start, reduce, layer);
      if (!reduce && !doc.hidden) frameId = win.requestAnimationFrame(draw);
    }
    function redraw() { render(ctx, W, H, bp, 0, reduce, layer); }
    function onResize() { resize(); redraw(); }

    resize();
    if (win && win.ResizeObserver) new win.ResizeObserver(onResize).observe(host);
    else if (win) win.addEventListener('resize', onResize, { passive:true });
    if (win) doc.addEventListener('visibilitychange', function () {
      if (doc.hidden) { if (frameId) win.cancelAnimationFrame(frameId); frameId = 0; }
      else if (!reduce && !frameId) { start = win.performance.now(); frameId = win.requestAnimationFrame(draw); }
    });
    doc.body.dataset.vortexSeed = String((opts.seed == null ? SEED : opts.seed) >>> 0);
    doc.body.dataset.vortexMotion = reduce ? 'still' : 'live';
    if (reduce) redraw(); else frameId = win.requestAnimationFrame(draw);

    return {
      seed:(opts.seed == null ? SEED : opts.seed) >>> 0,
      redraw:redraw,
      stop:function () { running = false; if (frameId && win) win.cancelAnimationFrame(frameId); frameId = 0; }
    };
  }

  return { VERSION, SEED, PALETTE:PALETTE.slice(), blueprint, render, mount };
});
