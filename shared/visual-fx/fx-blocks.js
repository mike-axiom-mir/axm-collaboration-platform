/* ============================================================
   AXM FX BLOCKS  —  fx-blocks.js   (v0.1, DRAFT / TEST-not-canon)
   Modular, deterministic, zero-dependency visual-effect "lego blocks".
   Each block emits PORTABLE outputs so it works anywhere:
     - svgFilter : an <filter>/<defs> string (browsers, SVG, rasterizers, games)
     - css       : ready-to-drop CSS (sites, apps, OS themes)
     - tokens    : plain numbers (shaders / engines map these)
   Blocks compose: stack a gradient + a glow + grain and you have a look.
   Pure functions, no randomness at call time (noise uses a fixed seed),
   no network, no state.  Run:  node fx-blocks.js  (writes ./out gallery)
   ============================================================ */
'use strict';

/* ---------- tiny colour helpers ---------- */
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function hexToRgb(hex) { const h = hex.replace('#', ''); return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)]; }
function rgbToHex(r,g,b){ const c=v=>clamp(Math.round(v),0,255).toString(16).padStart(2,'0'); return '#'+c(r)+c(g)+c(b); }
function mix(a, b, t){ const A=hexToRgb(a), B=hexToRgb(b); return rgbToHex(A[0]+(B[0]-A[0])*t, A[1]+(B[1]-A[1])*t, A[2]+(B[2]-A[2])*t); }
function shade(hex, amt){ const [r,g,b]=hexToRgb(hex); const f=amt<0?0:255, t=Math.abs(amt); return rgbToHex(r+(f-r)*t, g+(f-g)*t, b+(f-b)*t); }
function rgba(hex, a){ const [r,g,b]=hexToRgb(hex); return `rgba(${r},${g},${b},${a})`; }

function stable(value) {
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + stable(value[k])).join(',') + '}';
  return JSON.stringify(value);
}
function hash(text) {
  let value = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    value ^= text.charCodeAt(i);
    value = Math.imul(value, 16777619);
  }
  return (value >>> 0).toString(16).padStart(8, '0');
}
function uid(prefix, payload){ return (prefix || 'fx') + '-' + hash(stable(payload || {})); }

/* ============================================================
   THE BLOCKS
   Each returns { id, kind, css, svgFilter|svgDefs, tokens }
   ============================================================ */
const Blocks = {

  /* --- GRADIENTS --- */
  linearGradient({ stops = ['#6a5cff', '#00e0ff'], angle = 135 } = {}) {
    const id = uid('lin', { stops, angle });
    const css = `background: linear-gradient(${angle}deg, ${stops.join(', ')});`;
    // SVG angle -> x1y1x2y2
    const a = (angle - 90) * Math.PI / 180;
    const x2 = (0.5 + Math.cos(a) / 2).toFixed(3), y2 = (0.5 + Math.sin(a) / 2).toFixed(3);
    const x1 = (0.5 - Math.cos(a) / 2).toFixed(3), y1 = (0.5 - Math.sin(a) / 2).toFixed(3);
    const svgDefs = `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">` +
      stops.map((c, i) => `<stop offset="${(i/(stops.length-1)*100).toFixed(1)}%" stop-color="${c}"/>`).join('') +
      `</linearGradient>`;
    return { id, kind: 'gradient.linear', css, svgDefs, paint: `url(#${id})`, tokens: { stops, angle } };
  },

  radialGradient({ stops = ['#ffd23f', '#e8483f'], cx = 50, cy = 40 } = {}) {
    const id = uid('rad', { stops, cx, cy });
    const css = `background: radial-gradient(circle at ${cx}% ${cy}%, ${stops.join(', ')});`;
    const svgDefs = `<radialGradient id="${id}" cx="${cx}%" cy="${cy}%" r="75%">` +
      stops.map((c, i) => `<stop offset="${(i/(stops.length-1)*100).toFixed(1)}%" stop-color="${c}"/>`).join('') +
      `</radialGradient>`;
    return { id, kind: 'gradient.radial', css, svgDefs, paint: `url(#${id})`, tokens: { stops, cx, cy } };
  },

  conicGradient({ stops = ['#ff5d8f', '#ffd23f', '#00e0ff', '#6a5cff', '#ff5d8f'], from = 0, cx = 50, cy = 50 } = {}) {
    // native CSS; SVG has no conic — we note that and provide CSS + tokens only
    const css = `background: conic-gradient(from ${from}deg at ${cx}% ${cy}%, ${stops.join(', ')});`;
    return { id: uid('con', { stops, from, cx, cy }), kind: 'gradient.conic', css, svgDefs: null, tokens: { stops, from, cx, cy },
      note: 'SVG has no native conic gradient; use CSS, or bake to a texture for engines.' };
  },

  /* --- LIGHT --- */
  glow({ color = '#00e0ff', blur = 8, spread = 1.4 } = {}) {
    const id = uid('glow', { color, blur, spread });
    const svgFilter = `<filter id="${id}" x="-60%" y="-60%" width="220%" height="220%">
  <feGaussianBlur in="SourceAlpha" stdDeviation="${blur}" result="b"/>
  <feFlood flood-color="${color}" flood-opacity="${clamp(spread*0.7,0,1)}"/>
  <feComposite in2="b" operator="in" result="g"/>
  <feMerge><feMergeNode in="g"/><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge>
</filter>`;
    const css = `filter: drop-shadow(0 0 ${blur}px ${rgba(color,0.9)}) drop-shadow(0 0 ${blur*2}px ${rgba(color,0.6)});`;
    return { id, kind: 'light.glow', css, svgFilter, tokens: { color, blur, spread } };
  },

  neon({ color = '#ff4df0', core = '#ffffff', blur = 6 } = {}) {
    const id = uid('neon', { color, core, blur });
    const svgFilter = `<filter id="${id}" x="-80%" y="-80%" width="260%" height="260%">
  <feGaussianBlur in="SourceAlpha" stdDeviation="${blur*1.8}" result="b1"/>
  <feFlood flood-color="${color}"/><feComposite in2="b1" operator="in" result="halo"/>
  <feGaussianBlur in="SourceAlpha" stdDeviation="${blur*0.6}" result="b2"/>
  <feFlood flood-color="${core}"/><feComposite in2="b2" operator="in" result="hot"/>
  <feMerge><feMergeNode in="halo"/><feMergeNode in="halo"/><feMergeNode in="hot"/><feMergeNode in="SourceGraphic"/></feMerge>
</filter>`;
    const css = `color:${core}; text-shadow: 0 0 ${blur}px ${color}, 0 0 ${blur*2}px ${color}, 0 0 ${blur*4}px ${color};`;
    return { id, kind: 'light.neon', css, svgFilter, tokens: { color, core, blur } };
  },

  softShadow({ color = '#000000', y = 10, blur = 24, opacity = 0.28 } = {}) {
    const id = uid('sh', { color, y, blur, opacity });
    const svgFilter = `<filter id="${id}" x="-40%" y="-40%" width="180%" height="180%">
  <feDropShadow dx="0" dy="${y}" stdDeviation="${blur/2}" flood-color="${color}" flood-opacity="${opacity}"/>
</filter>`;
    const css = `box-shadow: 0 ${y}px ${blur}px ${rgba(color,opacity)};`;
    return { id, kind: 'light.softShadow', css, svgFilter, tokens: { color, y, blur, opacity } };
  },

  longShadow({ color = '#2a2340', length = 24, angle = 45 } = {}) {
    // flat-design long shadow: many stacked offsets (returned as a reusable <g> transform list)
    const rad = angle * Math.PI / 180, dx = Math.cos(rad), dy = Math.sin(rad);
    const layers = [];
    for (let i = 1; i <= length; i++) layers.push(`${(dx*i).toFixed(1)},${(dy*i).toFixed(1)}`);
    const cssParts = layers.map(o => { const [x,y]=o.split(','); return `${x}px ${y}px ${color}`; });
    const css = `text-shadow: ${cssParts.join(', ')};`;
    return { id: uid('long', { color, length, angle }), kind: 'light.longShadow', css, offsets: layers, color, tokens: { color, length, angle } };
  },

  rimBevel({ light = '#ffffff', dark = '#000000', strength = 0.35 } = {}) {
    // cheap engraved/embossed edge: top light inset + bottom dark inset
    const css = `box-shadow: inset 0 1px 0 ${rgba(light,strength)}, inset 0 -2px 3px ${rgba(dark,strength*0.9)};`;
    return { id: uid('rim', { light, dark, strength }), kind: 'light.rimBevel', css, svgFilter: null,
      strokeTop: rgba(light, strength), strokeBottom: rgba(dark, strength), tokens: { light, dark, strength } };
  },

  spotlight({ color = '#ffffff', cx = 50, cy = 20, intensity = 0.5 } = {}) {
    const id = uid('spot', { color, cx, cy, intensity });
    const svgDefs = `<radialGradient id="${id}" cx="${cx}%" cy="${cy}%" r="80%">
  <stop offset="0%" stop-color="${rgba(color, intensity)}"/>
  <stop offset="60%" stop-color="${rgba(color, intensity*0.25)}"/>
  <stop offset="100%" stop-color="${rgba(color,0)}"/>
</radialGradient>`;
    const css = `background: radial-gradient(circle at ${cx}% ${cy}%, ${rgba(color,intensity)}, ${rgba(color,0)} 70%);`;
    return { id, kind: 'light.spotlight', css, svgDefs, paint: `url(#${id})`, tokens: { color, cx, cy, intensity } };
  },

  /* --- SURFACE / TEXTURE --- */
  vignette({ color = '#000000', strength = 0.55 } = {}) {
    const id = uid('vig', { color, strength });
    const svgDefs = `<radialGradient id="${id}" cx="50%" cy="50%" r="75%">
  <stop offset="55%" stop-color="${rgba(color,0)}"/>
  <stop offset="100%" stop-color="${rgba(color,strength)}"/>
</radialGradient>`;
    const css = `background: radial-gradient(ellipse at center, ${rgba(color,0)} 55%, ${rgba(color,strength)} 100%);`;
    return { id, kind: 'surface.vignette', css, svgDefs, paint: `url(#${id})`, tokens: { color, strength } };
  },

  grain({ amount = 0.35, size = 0.9, seed = 7 } = {}) {
    const id = uid('grain', { amount, size, seed });
    // greyscale speckle: fractal noise -> desaturate to opaque grey grain, overlaid at low opacity
    const svgFilter = `<filter id="${id}" x="0" y="0" width="100%" height="100%">
  <feTurbulence type="fractalNoise" baseFrequency="${size}" numOctaves="2" seed="${seed}" stitchTiles="stitch" result="n"/>
  <feColorMatrix in="n" type="saturate" values="0"/>
  <feComponentTransfer><feFuncA type="linear" slope="0" intercept="1"/></feComponentTransfer>
</filter>`;
    const css = `/* grain: overlay an SVG feTurbulence layer at opacity ~${amount}; CSS alone can't do true noise */`;
    return { id, kind: 'surface.grain', css, svgFilter, overlayOpacity: amount, tokens: { amount, size, seed } };
  },

  scanlines({ color = '#000000', gap = 4, opacity = 0.22 } = {}) {
    const id = uid('scan', { color, gap, opacity });
    const svgDefs = `<pattern id="${id}" width="4" height="${gap}" patternUnits="userSpaceOnUse">
  <rect width="4" height="${(gap/2).toFixed(1)}" fill="${rgba(color,opacity)}"/>
</pattern>`;
    const css = `background: repeating-linear-gradient(0deg, ${rgba(color,opacity)} 0 1px, transparent 1px ${gap}px);`;
    return { id, kind: 'surface.scanlines', css, svgDefs, paint: `url(#${id})`, tokens: { color, gap, opacity } };
  },

  sheen({ color = '#ffffff', angle = 20, strength = 0.5 } = {}) {
    const id = uid('sheen', { color, angle, strength });
    const svgDefs = `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0" gradientTransform="rotate(${angle} .5 .5)">
  <stop offset="0%" stop-color="${rgba(color,0)}"/>
  <stop offset="45%" stop-color="${rgba(color,0)}"/>
  <stop offset="50%" stop-color="${rgba(color,strength)}"/>
  <stop offset="55%" stop-color="${rgba(color,0)}"/>
  <stop offset="100%" stop-color="${rgba(color,0)}"/>
</linearGradient>`;
    const css = `background: linear-gradient(${angle+90}deg, transparent 45%, ${rgba(color,strength)} 50%, transparent 55%);` +
      ` /* animate background-position for a moving sweep */`;
    return { id, kind: 'surface.sheen', css, svgDefs, paint: `url(#${id})`, tokens: { color, angle, strength } };
  },

  frostedGlass({ blur = 6, tint = '#ffffff', tintAlpha = 0.15 } = {}) {
    const id = uid('frost', { blur, tint, tintAlpha });
    const svgFilter = `<filter id="${id}" x="-20%" y="-20%" width="140%" height="140%">
  <feGaussianBlur in="SourceGraphic" stdDeviation="${blur}"/>
</filter>`;
    const css = `backdrop-filter: blur(${blur}px); background: ${rgba(tint,tintAlpha)}; border: 1px solid ${rgba('#ffffff',0.25)};`;
    return { id, kind: 'surface.frostedGlass', css, svgFilter, panelFill: rgba(tint, tintAlpha), tokens: { blur, tint, tintAlpha } };
  },

  gradientBorder({ stops = ['#6a5cff', '#00e0ff', '#ff4df0'], width = 3, radius = 14 } = {}) {
    const g = Blocks.linearGradient({ stops, angle: 120 });
    const css = `border: ${width}px solid transparent; border-radius: ${radius}px;` +
      ` background: linear-gradient(#111,#111) padding-box, linear-gradient(120deg, ${stops.join(', ')}) border-box;`;
    return { id: uid('gb', { stops, width, radius }), kind: 'surface.gradientBorder', css, svgDefs: g.svgDefs, paint: g.paint, width, radius, tokens: { stops, width, radius } };
  }
};

/* ============================================================
   GALLERY renderer (proof) — one SVG tile per block, rasterizable
   ============================================================ */
function gallery() {
  const TW = 210, TH = 150, cols = 4, pad = 16, gap = 14;
  const tiles = [];
  const defs = [];
  const push = (title, inner, extraDefs) => { tiles.push({ title, inner }); if (extraDefs) defs.push(extraDefs); };

  // 1 linear gradient
  { const b = Blocks.linearGradient({ stops:['#6a5cff','#00e0ff'], angle:135 }); defs.push(b.svgDefs);
    push('linearGradient', `<rect x="0" y="0" width="${TW}" height="${TH-26}" rx="12" fill="${b.paint}"/>`); }
  // 2 radial gradient
  { const b = Blocks.radialGradient({ stops:['#ffd23f','#e8483f'], cx:50, cy:38 }); defs.push(b.svgDefs);
    push('radialGradient', `<rect width="${TW}" height="${TH-26}" rx="12" fill="${b.paint}"/>`); }
  // 3 glow
  { const g = Blocks.glow({ color:'#00e0ff', blur:7 }); defs.push(g.svgFilter);
    push('glow', `<rect width="${TW}" height="${TH-26}" rx="12" fill="#0b0e14"/><g filter="url(#${g.id})"><circle cx="${TW/2}" cy="${(TH-26)/2}" r="30" fill="#00e0ff"/></g>`); }
  // 4 neon
  { const n = Blocks.neon({ color:'#ff4df0', blur:5 }); defs.push(n.svgFilter);
    push('neon', `<rect width="${TW}" height="${TH-26}" rx="12" fill="#0b0e14"/><g filter="url(#${n.id})"><text x="${TW/2}" y="${(TH-26)/2+8}" font-family="Arial Black,sans-serif" font-size="30" font-weight="900" fill="#ffffff" text-anchor="middle">AXM</text></g>`); }
  // 5 soft shadow
  { const s = Blocks.softShadow({ y:10, blur:22, opacity:0.35 }); defs.push(s.svgFilter);
    push('softShadow', `<rect width="${TW}" height="${TH-26}" rx="12" fill="#eef1f6"/><g filter="url(#${s.id})"><rect x="${TW/2-45}" y="${(TH-26)/2-28}" width="90" height="56" rx="12" fill="#ffffff"/></g>`); }
  // 6 long shadow
  { const ls = Blocks.longShadow({ color:'#3a2f5c', length:22, angle:45 });
    const shapes = ls.offsets.map(o=>{const[x,y]=o.split(',');return `<circle cx="${TW/2+ +x}" cy="${(TH-26)/2+ +y}" r="26" fill="${ls.color}"/>`;}).reverse().join('');
    push('longShadow', `<rect width="${TW}" height="${TH-26}" rx="12" fill="#ffd23f"/>${shapes}<circle cx="${TW/2}" cy="${(TH-26)/2}" r="26" fill="#e8483f"/>`); }
  // 7 rim/bevel (button)
  { push('rimBevel', `<rect width="${TW}" height="${TH-26}" rx="12" fill="#c9ced8"/><rect x="${TW/2-50}" y="${(TH-26)/2-22}" width="100" height="44" rx="10" fill="#3a7bd5"/><rect x="${TW/2-50}" y="${(TH-26)/2-22}" width="100" height="44" rx="10" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="1.5"/><rect x="${TW/2-50}" y="${(TH-26)/2-4}" width="100" height="26" rx="10" fill="rgba(0,0,0,0.18)"/>`); }
  // 8 spotlight
  { const sp = Blocks.spotlight({ cx:50, cy:15, intensity:0.7 }); defs.push(sp.svgDefs);
    push('spotlight', `<rect width="${TW}" height="${TH-26}" rx="12" fill="#141822"/><rect width="${TW}" height="${TH-26}" rx="12" fill="${sp.paint}"/>`); }
  // 9 vignette
  { const v = Blocks.vignette({ strength:0.6 }); defs.push(v.svgDefs);
    push('vignette', `<rect width="${TW}" height="${TH-26}" rx="12" fill="#4a7ad0"/><rect width="${TW}" height="${TH-26}" rx="12" fill="${v.paint}"/>`); }
  // 10 gradient border (grain is feTurbulence = browser-native; not shown here as the rasterizer lacks it)
  { const gb = Blocks.linearGradient({ stops:['#6a5cff','#00e0ff','#ff4df0'], angle:120 }); defs.push(gb.svgDefs);
    push('gradientBorder', `<rect width="${TW}" height="${TH-26}" rx="14" fill="#111318"/><rect x="3" y="3" width="${TW-6}" height="${TH-26-6}" rx="12" fill="none" stroke="${gb.paint}" stroke-width="4"/>`); }
  // 11 scanlines
  { const sc = Blocks.scanlines({ gap:4, opacity:0.5 }); defs.push(sc.svgDefs);
    push('scanlines', `<rect width="${TW}" height="${TH-26}" rx="12" fill="#12d17a"/><rect width="${TW}" height="${TH-26}" rx="12" fill="url(#${sc.id})"/>`); }
  // 12 sheen
  { const sh = Blocks.sheen({ angle:20, strength:0.7 }); defs.push(sh.svgDefs);
    push('sheen', `<rect width="${TW}" height="${TH-26}" rx="12" fill="#2a2f3a"/><rect width="${TW}" height="${TH-26}" rx="12" fill="url(#${sh.id})"/>`); }

  const rows = Math.ceil(tiles.length / cols);
  const W = pad*2 + cols*TW + (cols-1)*gap;
  const H = pad*2 + 24 + rows*(TH) + (rows-1)*gap;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>${defs.join('\n')}</defs>
<rect width="${W}" height="${H}" fill="#1b1e24"/>
<text x="${pad}" y="${pad+8}" fill="#fff" font-family="sans-serif" font-size="15" font-weight="bold">AXM FX Blocks — v0.1 (SVG-filter + CSS + tokens, drop in anywhere)</text>`;
  tiles.forEach((t, i) => {
    const cx = pad + (i % cols) * (TW + gap);
    const cy = pad + 24 + Math.floor(i / cols) * (TH + gap);
    s += `<g transform="translate(${cx},${cy})">${t.inner}` +
      `<text x="8" y="${TH-8}" fill="#cbd3dd" font-family="monospace" font-size="12">${t.title}</text></g>`;
  });
  return s + '\n</svg>\n';
}

const API = { VERSION: '0.1.0', Blocks, gallery, mix, shade, rgba, stable, hash };

// The same deterministic implementation is available to governed Node hands
// and to local browser tools. Exposure is passive: loading this file never
// applies an effect to a host document.
if (typeof module === 'object' && module.exports) module.exports = API;
if (typeof globalThis !== 'undefined') globalThis.AXMVisualFX = API;

/* ---------- run demo ---------- */
if (typeof require === 'function' && typeof module === 'object' && require.main === module) {
  const fs = require('fs'), path = require('path');
  const outDir = path.join(__dirname, 'out'); fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'gallery.svg'), gallery());
  // also dump every block's portable outputs as one JSON catalog
  const catalog = {};
  const samples = {
    linearGradient: {}, radialGradient: {}, conicGradient: {}, glow: {}, neon: {}, softShadow: {},
    longShadow: {}, rimBevel: {}, spotlight: {}, vignette: {}, grain: {}, scanlines: {}, sheen: {}, frostedGlass: {}, gradientBorder: {}
  };
  Object.keys(samples).forEach(k => { const b = Blocks[k](samples[k]); catalog[k] = { kind: b.kind, css: b.css, hasSvg: !!(b.svgFilter||b.svgDefs), tokens: b.tokens }; });
  fs.writeFileSync(path.join(outDir, 'blocks.catalog.json'), JSON.stringify(catalog, null, 2));
  console.log('fx-blocks demo written to ./out (', Object.keys(samples).length, 'blocks )');
}
