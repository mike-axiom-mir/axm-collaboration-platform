/* ============================================================
   AXM SKIN — skin-core.js
   Freedom in safety. Don't cage, only protect.

   A skin is DATA, never code. It may change almost everything about
   how the hub looks — colours, radius, density, where the nav sits,
   which vault assets decorate it. It may NOT do three things:

     1. touch anything outside the declared editable surface
     2. hide, shrink, or wash out an element the system needs to stay
        honest (hidden-module count, door-sign notice, permissions,
        retirement banner, action log)
     3. arrive without saying what it changes

   Blocking display:none is not enough — a warning painted black on
   black is just as hidden. So READABILITY is a checked invariant:
   every truth-bearing colour pair must clear a contrast floor.

   Everything here is pure. The same validation runs in the browser
   before a skin is applied, and in node under skin-selftest.js.
   ============================================================ */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') root.AXMSkin = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SCHEMA = 'axm.skin/v1';

  /* ---- THE EDITABLE SURFACE ----
     Declared explicitly. Anything not on this list is not editable,
     and a skin that reaches for it is refused with a clear reason.
     Adding to this list is a deliberate act, visible in a diff. */
  const COLOR_TOKENS = ['--space','--ink','--panel','--panel-2','--line','--edge',
    '--text','--muted','--muted-2','--cy','--cy-dim','--blue','--gold','--red','--green','--purple'];
  const NUMBER_TOKENS = { '--radius': [0, 28], '--radius-s': [0, 22] };
  /* fonts are an injection vector (url(...)), so: named families only */
  const FONT_TOKENS = ['--font','--mono'];
  const FONT_ALLOW = ['system-ui','sans-serif','serif','monospace','ui-monospace',
    'Georgia','Cascadia Mono','Consolas','Segoe UI','Inter','Helvetica','Arial'];

  const SLOTS = {
    nav:     ['left','right','rail'],      /* rail = icon-only strip */
    status:  ['bottom','top'],
    density: ['cozy','compact']
  };

  /* ---- INVARIANTS: what a skin may never take away ----
     Each entry says WHY, so a refusal explains itself instead of
     just saying no. These mirror the guarantees the hub makes. */
  const REQUIRED_ELEMENTS = [
    { id: 'modList',    why: 'the module switcher — and the hidden-machine-module count lives here' },
    { id: 'logTail',    why: 'the action log tail: what the system just did' },
    { id: 'btnPerm',    why: 'permissions screen — what a module was granted or denied' },
    { id: 'btnLayers',  why: 'layers screen — carries the "a door sign is not a lock" notice' },
    { id: 'btnModules', why: 'add/remove modules' },
    { id: 'btnSettings',why: 'settings' },
    { id: 'activeName', why: 'which module you are actually inside' }
  ];

  /* Truth-bearing colour pairs. A warning you cannot read is a warning
     that was hidden. WCAG AA is 4.5:1 for body text; we hold warnings
     and body text to that, and dimmer/secondary text to 3.0:1. */
  const CONTRAST_PAIRS = [
    { fg: '--text',  bg: '--panel', min: 4.5, why: 'body text on panels' },
    { fg: '--text',  bg: '--space', min: 4.5, why: 'body text on background' },
    { fg: '--gold',  bg: '--panel', min: 4.5, why: 'WARNINGS: door-sign notice, retirement banner, forced-step reasons' },
    { fg: '--red',   bg: '--panel', min: 4.5, why: 'FAILURES: errors, denied permissions, superseded flags' },
    { fg: '--green', bg: '--panel', min: 3.0, why: 'passes and granted permissions' },
    { fg: '--cy',    bg: '--panel', min: 3.0, why: 'primary actions' },
    { fg: '--muted', bg: '--panel', min: 3.0, why: 'the hidden-module count and other secondary truth' }
  ];

  /* ---- colour parsing + WCAG contrast (pure, testable) ---- */
  const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
  const RGB = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*[\d.]+\s*)?\)$/i;

  function parseColor(v) {
    if (typeof v !== 'string') return null;
    const s = v.trim();
    let m = s.match(HEX);
    if (m) {
      let h = m[1];
      if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
      return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
    }
    m = s.match(RGB);
    if (m) {
      const c = [ +m[1], +m[2], +m[3] ];
      return c.every(x => x >= 0 && x <= 255) ? c : null;
    }
    return null;   /* no url(), no var(), no calc(), no expressions */
  }
  function luminance(rgb) {
    const a = rgb.map(v => { v /= 255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); });
    return 0.2126*a[0] + 0.7152*a[1] + 0.0722*a[2];
  }
  function contrast(fg, bg) {
    const a = parseColor(fg), b = parseColor(bg);
    if (!a || !b) return 0;
    const l1 = luminance(a), l2 = luminance(b);
    const hi = Math.max(l1,l2), lo = Math.min(l1,l2);
    return (hi + 0.05) / (lo + 0.05);
  }

  /* ---- default skin: the shell's own tokens ---- */
  const DEFAULT = {
    schema: SCHEMA, id: 'axm-default', name: 'AXM Default', author: 'axm',
    tokens: {
      '--space':'#080b14','--ink':'#101318','--panel':'#181d25','--panel-2':'#0d1320',
      '--line':'#2a313d','--edge':'#1d2942','--text':'#dce2ea','--muted':'#828d9e','--muted-2':'#566179',
      '--cy':'#38d6ec','--cy-dim':'#1c7f92','--blue':'#2f6dff','--gold':'#e8b54a',
      '--red':'#e86a5f','--green':'#63d68a','--purple':'#b18cff',
      '--radius':'14','--radius-s':'9'
    },
    slots: { nav:'left', status:'bottom', density:'cozy' },
    assets: {}
  };

  /* ============================================================
     ASSET SLOTS — the declared surface for imagery.
     Colours are allowlisted. Layout slots are allowlisted. Assets must be
     too, or a designer has nothing to work from and a skin can smuggle in
     keys nothing renders.

     Every size below is derived from the shell's own CSS, not invented:
       .mark 30x30 · .mod .ic 20x20 · sidebar 210px · rail 62px
       .statusbar min-height 40px · .topbar ~50px · .hcard radius 14px
     Author at @2x so the asset survives a high-DPI screen; @3x is optional
     and only pays off on phones.

     EVERY SLOT IS OPTIONAL. A skin with zero assets is a complete skin —
     the shell renders without any of them. Nothing here is required, so a
     missing asset can never break a hub, only leave it plainer.
     ============================================================ */
  const ASSET_SLOTS = {
    'brand.mark': {
      w: 30, h: 30, format: 'svg|png', dpi: '@2x = 60x60, @3x = 90x90',
      deliverables: ['1x 30x30', '2x 60x60', '3x 90x90'],
      where: 'top bar, far left — the cube glyph',
      note: 'Square. Must read at 30px. Keep strokes >= 1.5px at 1x. Transparent background.'
    },
    'brand.wordmark': {
      w: 120, h: 24, format: 'svg|png', dpi: '@2x = 240x48',
      deliverables: ['1x 120x24', '2x 240x48'],
      where: 'top bar, beside the mark — replaces the "AXM Hub" text',
      note: 'Transparent. Baseline-centred. If omitted, the text renders instead.'
    },
    'nav.icon.default': {
      w: 20, h: 20, format: 'svg', dpi: 'vector only',
      deliverables: ['vector 20x20'],
      where: 'sidebar, one per module, and the icon rail',
      note: 'Monochrome, currentColor. It is recoloured by --cy / --text. Do not bake colour in. Must read at 20px AND centred in a 62px rail.'
    },
    'sidebar.background': {
      w: 210, h: 1200, format: 'png|webp', dpi: '@2x = 420x2400',
      deliverables: ['1x 210x1200', '2x 420x2400'],
      where: 'behind the module switcher',
      note: 'Tiles vertically. 210px wide when nav=left|right; the rail is 62px, so it will be CROPPED CENTRALLY, not scaled. Keep the important 62px in the middle.'
    },
    'viewport.background': {
      w: 1600, h: 900, format: 'png|webp|jpg', dpi: '@2x = 3200x1800',
      deliverables: ['1x 1600x900', '2x 3200x1800'],
      where: 'behind the module area, visible on Home and around modules',
      note: 'Covers a variable region. It is CENTRE-CROPPED, never stretched. Assume the outer 15% on every edge can be cut. Keep nothing important there.'
    },
    'home.hero': {
      w: 1200, h: 320, format: 'png|webp', dpi: '@2x = 2400x640',
      deliverables: ['1x 1200x320', '2x 2400x640'],
      where: 'top of the Home screen, behind the welcome text',
      note: 'Text sits on the LEFT third. Keep that area calm or the readability floor will refuse your --text colour.'
    },
    'card.texture': {
      w: 400, h: 260, format: 'png|webp', dpi: '@2x = 800x520',
      deliverables: ['1x 400x260', '2x 800x520'],
      where: 'module cards on Home, and overlay sheets',
      note: 'Tiles or centre-crops. Corner radius 14px is applied by the shell — do not draw rounded corners.'
    },
    'statusbar.background': {
      w: 1600, h: 40, format: 'png|webp', dpi: '@2x = 3200x80',
      deliverables: ['1x 1600x40', '2x 3200x80'],
      where: 'the action-log strip along the bottom',
      note: 'Only 40px tall. The log tail text sits on it — keep contrast low and even, or --muted becomes unreadable and the skin is refused.'
    },
    'overlay.backdrop': {
      w: 1600, h: 900, format: 'png|webp', dpi: '@2x = 3200x1800',
      deliverables: ['1x 1600x900', '2x 3200x1800'],
      where: 'behind Settings / Permissions / Layers / Modules sheets',
      note: 'The shell blurs and darkens it. Subtle patterns disappear. Use large shapes.'
    },
    'viewport.empty': {
      w: 480, h: 360, format: 'png|svg', dpi: '@2x = 960x720',
      deliverables: ['1x 480x360', '2x 960x720'],
      where: 'the error / recovery card when a module fails to load',
      note: 'Shown next to an error message. Do not make it alarming — the shell already says what went wrong.'
    }
  };

  /* A designer-facing spec sheet, generated from the registry so it can
     never drift from what the code accepts. */
  function assetSpec() {
    return Object.keys(ASSET_SLOTS).map(k => Object.assign({ slot: k, required: false }, ASSET_SLOTS[k]));
  }

  /* Complete designer handoff. Runtime asset keys and concrete image files
     are different counts; keeping both generated makes that distinction
     visible and prevents the production sheet from drifting. */
  function productionSpec() {
    const controls = [];
    COLOR_TOKENS.forEach(key => controls.push({ kind:'colour', key }));
    Object.keys(NUMBER_TOKENS).forEach(key => controls.push({ kind:'number', key }));
    FONT_TOKENS.forEach(key => controls.push({ kind:'font', key }));
    Object.keys(SLOTS).forEach(key => controls.push({ kind:'layout', key, options:SLOTS[key].slice() }));

    const productionFiles = [];
    assetSpec().forEach(asset => {
      (asset.deliverables || []).forEach(deliverable => {
        productionFiles.push({ slot:asset.slot, deliverable, format:asset.format, where:asset.where });
      });
    });
    const safetyChecks = CONTRAST_PAIRS.map(p => ({ kind:'contrast', key:p.fg + ' on ' + p.bg, why:p.why }))
      .concat(REQUIRED_ELEMENTS.map(e => ({ kind:'required-element', key:e.id, why:e.why })));
    return {
      controls,
      runtimeAssets: assetSpec(),
      productionFiles,
      safetyChecks,
      counts: {
        controls: controls.length,
        runtimeAssets: Object.keys(ASSET_SLOTS).length,
        productionFiles: productionFiles.length,
        safetyChecks: safetyChecks.length,
        total: controls.length + productionFiles.length + safetyChecks.length
      }
    };
  }

  /* ---- validation: the cage that isn't a cage ---- */
  function validate(skin) {
    const errors = [], warnings = [];
    if (!skin || typeof skin !== 'object') return { ok:false, errors:['skin is not an object'], warnings };
    if (skin.schema !== SCHEMA) errors.push('wrong or missing schema (expected ' + SCHEMA + ')');

    /* a skin is DATA. Any hint of code is refused outright. */
    ['css','style','script','js','html','onload'].forEach(k => {
      if (k in skin) errors.push('a skin is data, not code — remove "' + k + '"');
    });

    const t = skin.tokens || {};
    Object.keys(t).forEach(k => {
      const v = t[k];
      if (COLOR_TOKENS.indexOf(k) >= 0) {
        if (!parseColor(v)) errors.push(k + ': not a plain colour (#hex or rgb() only — no url(), var(), calc())');
      } else if (k in NUMBER_TOKENS) {
        const n = Number(v);
        const [lo,hi] = NUMBER_TOKENS[k];
        if (!isFinite(n)) errors.push(k + ': must be a number');
        else if (n < lo || n > hi) errors.push(k + ': ' + n + ' outside allowed range ' + lo + '–' + hi);
      } else if (FONT_TOKENS.indexOf(k) >= 0) {
        const fams = String(v).split(',').map(s => s.trim().replace(/^["']|["']$/g,''));
        const bad = fams.filter(f => FONT_ALLOW.indexOf(f) < 0);
        if (bad.length) errors.push(k + ': font families not allowed (' + bad.join(', ') + ') — named families only, no url()');
      } else {
        errors.push(k + ': not part of the editable surface');
      }
    });

    const s = skin.slots || {};
    Object.keys(s).forEach(k => {
      if (!(k in SLOTS)) errors.push('slot "' + k + '" does not exist');
      else if (SLOTS[k].indexOf(s[k]) < 0) errors.push('slot ' + k + ': "' + s[k] + '" is not a legal arrangement (' + SLOTS[k].join('|') + ')');
    });

    /* local-first: assets come from the vault, never off the internet.
       And the slot must EXIST — an undeclared slot renders nowhere, so
       accepting it would silently waste a designer's work. */
    const a = skin.assets || {};
    Object.keys(a).forEach(k => {
      const v = String(a[k]);
      if (!(k in ASSET_SLOTS))
        errors.push('asset slot "' + k + '" does not exist — nothing would render it. Legal slots: ' + Object.keys(ASSET_SLOTS).join(', '));
      if (!/^vault:[\w.-]+$/.test(v)) errors.push('asset "' + k + '": must be a vault reference (vault:id), not a URL — local-first');
    });

    if (!skin.name) warnings.push('skin has no name');
    if (!skin.author) warnings.push('skin has no author — provenance matters');
    return { ok: errors.length === 0, errors, warnings };
  }

  /* ---- the readability invariant ----
     Applied to the MERGED skin, because a skin that changes only --panel
     can still make the default --gold unreadable. */
  function checkReadability(skin) {
    const merged = Object.assign({}, DEFAULT.tokens, (skin && skin.tokens) || {});
    const failures = [];
    CONTRAST_PAIRS.forEach(p => {
      const r = contrast(merged[p.fg], merged[p.bg]);
      if (r < p.min) failures.push({
        pair: p.fg + ' on ' + p.bg, ratio: Math.round(r*100)/100, min: p.min, why: p.why,
        message: 'This would make ' + p.why + ' hard or impossible to read. A warning you cannot read is a warning that was hidden.'
      });
    });
    return { ok: failures.length === 0, failures };
  }

  /* ---- element invariants (checked in the browser after apply) ----
     `probe(id)` returns {present, visible, w, h} — injected so this is
     testable without a DOM. */
  function checkElements(probe) {
    const failures = [];
    REQUIRED_ELEMENTS.forEach(e => {
      const r = probe(e.id) || { present:false };
      if (!r.present) failures.push({ id: e.id, why: e.why, reason: 'missing' });
      else if (!r.visible) failures.push({ id: e.id, why: e.why, reason: 'hidden' });
      else if ((r.w != null && r.w < 4) || (r.h != null && r.h < 4))
        failures.push({ id: e.id, why: e.why, reason: 'shrunk to nothing' });
    });
    return { ok: failures.length === 0, failures };
  }

  /* ---- non-hidden: a skin must say what it changes ----
     Generated, not trusted from the file. The report is what the user
     sees before applying, and what gets written to the action log. */
  function diff(skin) {
    const changes = [];
    const t = (skin && skin.tokens) || {};
    Object.keys(t).forEach(k => {
      if (String(DEFAULT.tokens[k]) !== String(t[k]))
        changes.push({ kind:'token', key:k, from: DEFAULT.tokens[k], to: t[k] });
    });
    const s = (skin && skin.slots) || {};
    Object.keys(s).forEach(k => {
      if (DEFAULT.slots[k] !== s[k]) changes.push({ kind:'slot', key:k, from: DEFAULT.slots[k], to: s[k] });
    });
    Object.keys((skin && skin.assets) || {}).forEach(k => changes.push({ kind:'asset', key:k, to: skin.assets[k] }));
    return changes;
  }

  /* ---- shared skins reference assets you may not have ----
     `vault:bg_hero_v2` is a valid REFERENCE even on a machine where that
     asset was never created. Applying such a skin would leave a blank
     where a background should be — silently. So on import we ask the
     vault what actually exists and SAY what is missing. A missing asset
     is not a refusal (the skin still works, minus decoration); it is a
     warning that must be shown, never swallowed.
     `has(id)` is injected: true if the vault holds that asset. */
  function checkAssets(skin, has) {
    const assets = (skin && skin.assets) || {};
    const missing = [];
    Object.keys(assets).forEach(k => {
      const ref = String(assets[k]);
      const id = ref.replace(/^vault:/, '');
      if (!has(id)) missing.push({ slot: k, ref: ref, id: id });
    });
    return { ok: missing.length === 0, missing };
  }

  /* ---- the whole gate, in one call ----
     A skin loads only if it is well-formed, readable, and honest.
     Otherwise you get reasons, and the previous skin stays.
     `has` is optional; when given, missing assets come back as warnings. */
  function accept(skin, probe, has) {
    const v = validate(skin);
    if (!v.ok) return { ok:false, stage:'validate', errors:v.errors, warnings:v.warnings };
    const r = checkReadability(skin);
    if (!r.ok) return { ok:false, stage:'readability', errors: r.failures.map(f =>
      f.pair + ' is ' + f.ratio + ':1, needs ' + f.min + ':1 — ' + f.why), failures:r.failures };
    if (probe) {
      const e = checkElements(probe);
      if (!e.ok) return { ok:false, stage:'elements', errors: e.failures.map(f =>
        '#' + f.id + ' ' + f.reason + ' — ' + f.why), failures:e.failures };
    }
    const warnings = (v.warnings || []).slice();
    let missingAssets = [];
    if (has) {
      const a = checkAssets(skin, has);
      missingAssets = a.missing;
      a.missing.forEach(m => warnings.push('asset "' + m.slot + '" (' + m.ref + ') is not in your vault — that part of the skin will not appear'));
    }
    return { ok:true, changes: diff(skin), warnings, missingAssets };
  }

  /* merge for rendering: defaults fill every gap, so a one-line skin works */
  function resolve(skin) {
    return {
      tokens: Object.assign({}, DEFAULT.tokens, (skin && skin.tokens) || {}),
      slots:  Object.assign({}, DEFAULT.slots,  (skin && skin.slots)  || {}),
      assets: Object.assign({}, (skin && skin.assets) || {})
    };
  }

  function newSkin(name, author) {
    return { schema: SCHEMA, id: 'skin_' + Math.random().toString(36).slice(2,8),
             name: name || 'Untitled skin', author: author || 'me',
             tokens: {}, slots: {}, assets: {} };
  }

  /* ---- fingerprint: two people can check they hold the same skin ----
     Stable over key order. NON-CRYPTOGRAPHIC: it detects accident and
     drift, not a determined forger. Named honestly so nobody mistakes it
     for a signature. */
  function fingerprint(skin) {
    const r = resolve(skin);
    const stable = JSON.stringify([
      Object.keys(r.tokens).sort().map(k => [k, String(r.tokens[k])]),
      Object.keys(r.slots).sort().map(k => [k, String(r.slots[k])]),
      Object.keys(r.assets).sort().map(k => [k, String(r.assets[k])])
    ]);
    let h = 5381;
    for (let i = 0; i < stable.length; i++) h = ((h << 5) + h + stable.charCodeAt(i)) >>> 0;
    let h2 = 52711;
    for (let i = stable.length - 1; i >= 0; i--) h2 = ((h2 << 5) + h2 + stable.charCodeAt(i)) >>> 0;
    return (h.toString(16) + h2.toString(16)).padStart(16, '0').slice(0, 16);
  }

  /* ---- provenance on import ----
     A skin's own "author" field is a CLAIM, not a fact — anyone can type
     any name. We record it as claimed, stamp where it actually came from,
     and never present the two as the same thing. */
  function importRecord(skin, origin, who) {
    return {
      origin: origin || 'file',              /* file | gallery | authored */
      author_claimed: (skin && skin.author) || null,
      imported_by: who || 'me',
      imported_at: new Date().toISOString(),
      fingerprint: fingerprint(skin),
      verified_author: false                 /* nothing here proves authorship */
    };
  }

  /* ---- a shareable pack: many skins in one file ---- */
  const PACK_SCHEMA = 'axm.skinpack/v1';
  function newPack(name, author, skins) {
    return { schema: PACK_SCHEMA, name: name || 'Skin pack', author: author || 'me',
             created: new Date().toISOString(), skins: skins || [] };
  }
  /* Every skin in a pack is gated individually. One bad skin does not
     poison the rest — it is reported and skipped, never silently dropped. */
  function acceptPack(pack) {
    if (!pack || pack.schema !== PACK_SCHEMA) return { ok:false, error:'not an AXM skin pack' };
    const accepted = [], refused = [];
    (pack.skins || []).forEach((s, i) => {
      const a = accept(s, null);
      if (a.ok) accepted.push({ skin: s, changes: a.changes.length, fingerprint: fingerprint(s) });
      else refused.push({ index: i, name: (s && s.name) || '#' + i, stage: a.stage, errors: a.errors });
    });
    return { ok: accepted.length > 0, accepted, refused,
             note: refused.length ? refused.length + ' skin(s) refused and skipped — the rest are usable' : 'all skins passed the gate' };
  }

  return { SCHEMA, PACK_SCHEMA, DEFAULT, COLOR_TOKENS, NUMBER_TOKENS, FONT_TOKENS, FONT_ALLOW,
           SLOTS, ASSET_SLOTS, assetSpec, productionSpec, REQUIRED_ELEMENTS, CONTRAST_PAIRS,
           parseColor, contrast, validate, checkReadability, checkElements, checkAssets,
           diff, accept, resolve, newSkin, fingerprint, importRecord, newPack, acceptPack };
});
