#!/usr/bin/env node
/* ============================================================
   AXM SKIN — skin-selftest.js
   Two things must both be true: freedom is real, and the
   protections cannot be walked around. Exit 0 = pass.
   Run:  node hub/skin-selftest.js
   ============================================================ */
'use strict';
const S = require('./skin-core.js');
const out = []; let fails = 0;
const ok = m => out.push('  PASS  ' + m);
const bad = m => { out.push('  FAIL  ' + m); fails++; };

/* ---- 1. FREEDOM: the default is legal, and wild skins are legal ---- */
(function freedom() {
  S.accept(S.DEFAULT).ok ? ok('freedom: the default skin passes its own gate') : bad('default skin rejected');

  const wild = S.newSkin('Cozy Wood Workshop', 'errol');
  wild.tokens = { '--space':'#2b1d12','--panel':'#3a2819','--panel-2':'#241710',
                  '--text':'#f5e6d3','--muted':'#c9a789','--cy':'#e0a458','--cy-dim':'#8a5a24',
                  '--gold':'#ffd88a','--red':'#ff9a8a','--green':'#a8d68a','--radius':'22' };
  wild.slots = { nav:'right', density:'compact' };
  const w = S.accept(wild);
  w.ok ? ok('freedom: a totally different palette + right-hand nav + compact is accepted')
       : bad('a legitimate wild skin was refused: ' + (w.errors||[]).join('; '));
  (w.changes.length > 8) ? ok('freedom: ' + w.changes.length + ' changes allowed in one skin') : bad('too few changes allowed');

  const rail = S.newSkin('Rail', 'me'); rail.slots = { nav:'rail' };
  S.accept(rail).ok ? ok('freedom: the nav can become an icon rail') : bad('rail arrangement refused');

  const minimal = S.newSkin('One-liner', 'me'); minimal.tokens = { '--cy':'#ff00aa' };
  S.accept(minimal).ok ? ok('freedom: a one-token skin works (defaults fill the rest)') : bad('minimal skin refused');
  S.resolve(minimal).tokens['--panel'] === S.DEFAULT.tokens['--panel'] ? ok('resolve(): gaps fall back to default') : bad('resolve did not fill gaps');
})();

/* ---- 2. SAFETY: a skin is data, never code ---- */
(function notCode() {
  const evil = S.newSkin('Evil', 'x'); evil.css = 'body{display:none}';
  !S.validate(evil).ok ? ok('safety: a skin carrying raw css is refused') : bad('raw css accepted');

  const evil2 = S.newSkin('Evil2', 'x'); evil2.script = 'fetch("http://x")';
  !S.validate(evil2).ok ? ok('safety: a skin carrying script is refused') : bad('script accepted');

  const inj = S.newSkin('Inject', 'x'); inj.tokens = { '--cy': 'url(javascript:alert(1))' };
  !S.validate(inj).ok ? ok('safety: url(javascript:) in a colour is refused') : bad('javascript url accepted');

  const varchain = S.newSkin('Var', 'x'); varchain.tokens = { '--cy': 'var(--evil)' };
  !S.validate(varchain).ok ? ok('safety: var() chains refused (no indirection)') : bad('var() accepted');

  const calc = S.newSkin('Calc', 'x'); calc.tokens = { '--radius': 'calc(100vw)' };
  !S.validate(calc).ok ? ok('safety: calc() refused in a numeric token') : bad('calc accepted');

  const font = S.newSkin('Font', 'x'); font.tokens = { '--font': 'url(http://evil/f.woff)' };
  !S.validate(font).ok ? ok('safety: font url() refused — named families only') : bad('font url accepted');

  const okFont = S.newSkin('Font2', 'me'); okFont.tokens = { '--font': 'Georgia, serif' };
  S.validate(okFont).ok ? ok('freedom: an allowed font family is accepted') : bad('legit font refused');
})();

/* ---- 3. the editable surface is a boundary, and it explains itself ---- */
(function surface() {
  const reach = S.newSkin('Reach', 'x'); reach.tokens = { '--secret-internal': '#fff' };
  const v = S.validate(reach);
  (!v.ok && v.errors[0].includes('not part of the editable surface'))
    ? ok('surface: an undeclared token is refused, with a reason') : bad('undeclared token accepted');

  const slot = S.newSkin('Slot', 'x'); slot.slots = { nav:'floating-radial-3d' };
  const v2 = S.validate(slot);
  (!v2.ok && v2.errors[0].includes('not a legal arrangement'))
    ? ok('surface: an illegal slot arrangement is refused, and the legal ones are named') : bad('illegal slot accepted');

  const ghost = S.newSkin('Ghost', 'x'); ghost.slots = { nonexistent:'x' };
  !S.validate(ghost).ok ? ok('surface: a slot that does not exist is refused') : bad('ghost slot accepted');

  const range = S.newSkin('Huge', 'x'); range.tokens = { '--radius': '9999' };
  !S.validate(range).ok ? ok('surface: numeric tokens are range-checked') : bad('absurd radius accepted');
})();

/* ---- 4. LOCAL-FIRST: assets come from the vault, not the internet ---- */
(function localFirst() {
  const remote = S.newSkin('Remote', 'x'); remote.assets = { 'home.hero': 'https://cdn.example.com/bg.png' };
  !S.validate(remote).ok ? ok('local-first: a remote asset URL is refused') : bad('remote asset accepted');
  const vault = S.newSkin('Vault', 'me'); vault.assets = { 'home.hero': 'vault:bg_hero_v2' };
  S.validate(vault).ok ? ok('local-first: a vault: reference is accepted') : bad('vault ref refused');
})();

/* ---- 5. THE REAL ATTACK: hiding by contrast, not by display:none ---- */
(function hidingByContrast() {
  /* blocking display:none is not enough. Paint the warning black on black. */
  const stealth = S.newSkin('Stealth', 'x');
  stealth.tokens = { '--panel':'#000000', '--gold':'#000000' };   /* warnings vanish */
  const a = S.accept(stealth);
  (!a.ok && a.stage === 'readability') ? ok('ATTACK BLOCKED: warnings painted black-on-black fail the readability floor') : bad('black-on-black warning slipped through');
  (a.failures || []).some(f => f.pair.includes('--gold'))
    ? ok('the refusal names the exact pair that would have hidden the warning') : bad('refusal did not identify the pair');
  (a.errors || []).some(e => e.includes('door-sign') || e.includes('retirement'))
    ? ok('the refusal explains WHAT truth would have been hidden') : bad('refusal gave no reason');

  /* subtler: only change the panel, leave the default gold. Still caught,
     because readability is checked on the MERGED skin, not the diff. */
  const subtle = S.newSkin('Subtle', 'x'); subtle.tokens = { '--panel':'#e8b54a' };  /* panel = gold */
  const b = S.accept(subtle);
  (!b.ok && b.stage === 'readability') ? ok('ATTACK BLOCKED: changing only the panel to hide default warnings is caught (merged check)') : bad('merged readability check missed it');

  /* washing out failures/errors */
  const wash = S.newSkin('Wash', 'x'); wash.tokens = { '--red':'#1a1e26', '--panel':'#181d25' };
  !S.accept(wash).ok ? ok('ATTACK BLOCKED: error red washed into the panel is caught') : bad('washed-out error colour accepted');

  /* and the hidden-module count, which is --muted */
  const mute = S.newSkin('Mute', 'x'); mute.tokens = { '--muted':'#191d24', '--panel':'#181d25' };
  !S.accept(mute).ok ? ok('ATTACK BLOCKED: the hidden-machine-module count cannot be washed out') : bad('muted count hidden');

  /* a light theme must still pass — protection is not a cage */
  const light = S.newSkin('Daylight', 'me');
  light.tokens = { '--space':'#f4f6fa','--panel':'#ffffff','--panel-2':'#eef1f6',
                   '--text':'#12161d','--muted':'#5a6472','--edge':'#d3d9e2','--line':'#e2e6ec',
                   '--cy':'#0e7f92','--gold':'#8a5d00','--red':'#b3261e','--green':'#1e6b34','--purple':'#5b3fb5' };
  const l = S.accept(light);
  l.ok ? ok('not a cage: a full LIGHT theme passes every invariant') : bad('light theme wrongly refused: ' + (l.errors||[]).join('; '));
})();

/* ---- 6. contrast maths is right (spot-check against known values) ---- */
(function maths() {
  Math.abs(S.contrast('#ffffff','#000000') - 21) < 0.01 ? ok('contrast: white on black = 21:1') : bad('contrast maths wrong (white/black)');
  Math.abs(S.contrast('#000000','#000000') - 1) < 0.01 ? ok('contrast: identical colours = 1:1') : bad('contrast maths wrong (identical)');
  S.contrast('#777777','#ffffff') > 4.4 && S.contrast('#777777','#ffffff') < 4.7 ? ok('contrast: mid-grey on white ≈ 4.5:1 (WCAG AA boundary)') : bad('contrast maths off at the AA boundary');
  S.parseColor('#abc') && S.parseColor('rgb(1,2,3)') ? ok('parse: 3-digit hex and rgb() both understood') : bad('colour parsing incomplete');
  !S.parseColor('rgb(300,0,0)') ? ok('parse: out-of-range rgb refused') : bad('bad rgb accepted');
})();

/* ---- 7. element invariants: a skin cannot delete the truth-bearers ---- */
(function elements() {
  const allGood = () => ({ present:true, visible:true, w:100, h:20 });
  S.checkElements(allGood).ok ? ok('elements: a healthy shell passes') : bad('healthy shell failed');

  const hideCount = id => id === 'modList' ? { present:true, visible:false } : allGood();
  const r = S.checkElements(hideCount);
  (!r.ok && r.failures[0].id === 'modList' && r.failures[0].why.includes('hidden-machine-module count'))
    ? ok('elements: hiding the module list (and its hidden-count line) is caught, with why') : bad('hidden module list not caught');

  const shrink = id => id === 'logTail' ? { present:true, visible:true, w:1, h:0 } : allGood();
  const r2 = S.checkElements(shrink);
  (!r2.ok && r2.failures[0].reason === 'shrunk to nothing') ? ok('elements: shrinking the action log to nothing is caught') : bad('shrink-to-zero not caught');

  const dropPerm = id => id === 'btnPerm' ? { present:false } : allGood();
  !S.checkElements(dropPerm).ok ? ok('elements: removing the permissions screen is caught') : bad('permissions removal not caught');

  const dropLayers = id => id === 'btnLayers' ? { present:false } : allGood();
  const r3 = S.checkElements(dropLayers);
  r3.failures[0].why.includes('door sign') ? ok('elements: removing the layers screen names the door-sign notice it carries') : bad('door-sign reason missing');

  /* accept() runs the element probe too, when one is given */
  const good = S.newSkin('G','me');
  S.accept(good, allGood).ok ? ok('accept(): passes when validate + readability + elements all pass') : bad('accept failed on a good skin');
  const a = S.accept(good, dropPerm);
  (!a.ok && a.stage === 'elements') ? ok('accept(): fails at the element stage, and says so') : bad('accept did not reach element stage');
})();

/* ---- 8. NON-HIDDEN: a skin must say what it changes ---- */
(function nonHidden() {
  const s = S.newSkin('Report','me');
  s.tokens = { '--cy':'#ff0000' }; s.slots = { nav:'right' }; s.assets = { 'home.hero':'vault:x' };
  const d = S.diff(s);
  d.length === 3 ? ok('non-hidden: the diff reports every change (token + slot + asset)') : bad('diff incomplete: ' + d.length);
  d.find(c => c.kind==='token').from === S.DEFAULT.tokens['--cy'] ? ok('non-hidden: the diff shows FROM and TO, not just TO') : bad('diff missing from-value');
  /* the report is generated, never trusted from the file */
  s.declares = [{ kind:'token', key:'--nothing' }];
  S.diff(s).length === 3 ? ok('non-hidden: the diff is GENERATED — a lying "declares" field is ignored') : bad('trusted the skin\'s own claim');

  const anon = S.newSkin('Anon', ''); anon.author = '';
  S.validate(anon).warnings.some(w => w.includes('provenance')) ? ok('non-hidden: an authorless skin warns about provenance') : bad('no provenance warning');
})();

/* ---- 9. SHARING: fingerprints, provenance, and packs ---- */
(function sharing() {
  const a = S.newSkin('A','mike'); a.tokens = { '--cy':'#ff0000' };
  const b = S.newSkin('B','ivan'); b.tokens = { '--cy':'#ff0000' };
  /* different ids and names, same look -> same fingerprint */
  S.fingerprint(a) === S.fingerprint(b) ? ok('share: fingerprint is of the LOOK, not the name/id') : bad('fingerprint depends on name/id');
  const c = S.newSkin('A','mike'); c.tokens = { '--cy':'#ff0001' };
  S.fingerprint(a) !== S.fingerprint(c) ? ok('share: a one-digit colour change changes the fingerprint') : bad('fingerprint insensitive to change');
  /* key order must not matter */
  const d = S.newSkin('D','x'); d.tokens = { '--gold':'#e8b54a', '--cy':'#ff0000' };
  const e = S.newSkin('E','y'); e.tokens = { '--cy':'#ff0000', '--gold':'#e8b54a' };
  S.fingerprint(d) === S.fingerprint(e) ? ok('share: fingerprint is stable across key order') : bad('fingerprint unstable');
  S.fingerprint(a).length === 16 ? ok('share: fingerprint is a fixed 16 chars') : bad('fingerprint wrong length');

  /* provenance: the author field is a CLAIM */
  const liar = S.newSkin('Official AXM Theme', 'axm');
  const rec = S.importRecord(liar, 'gallery', 'mike');
  (rec.author_claimed === 'axm' && rec.verified_author === false)
    ? ok('provenance: an imported author is recorded as CLAIMED, never verified') : bad('import trusted the author field');
  (rec.origin === 'gallery' && rec.imported_by === 'mike' && rec.fingerprint)
    ? ok('provenance: origin, importer, time and fingerprint are stamped on import') : bad('import record incomplete');

  /* packs: many skins, gated one by one */
  const good1 = S.newSkin('Good1','me'); good1.tokens = { '--cy':'#22aacc' };
  const good2 = S.newSkin('Good2','me'); good2.slots = { nav:'rail' };
  const evil  = S.newSkin('Evil','x');   evil.tokens = { '--panel':'#000000','--gold':'#000000' };
  const pack = S.newPack('Community pack','errol',[good1, evil, good2]);
  const p = S.acceptPack(pack);
  (p.ok && p.accepted.length === 2 && p.refused.length === 1)
    ? ok('pack: good skins accepted, the hiding skin refused — one bad skin does not poison the pack') : bad('pack gating wrong');
  (p.refused[0].stage === 'readability' && p.refused[0].errors.length)
    ? ok('pack: the refused skin is REPORTED with its stage and reason, never silently dropped') : bad('refusal not reported');
  p.accepted.every(x => x.fingerprint) ? ok('pack: every accepted skin carries a fingerprint') : bad('pack missing fingerprints');
  !S.acceptPack({ schema:'something/else' }).ok ? ok('pack: a file that is not an AXM pack is refused') : bad('bogus pack accepted');

  /* a pack of only-bad skins fails as a whole */
  !S.acceptPack(S.newPack('Bad','x',[evil])).ok ? ok('pack: a pack with nothing usable fails') : bad('empty-after-gating pack passed');
})();

/* ---- 10. THE DOWNLOAD-FROM-THE-WEB PATH ---- */
(function downloadedSkins() {
  /* someone downloads a skin from a forum. It references an asset they
     do not have. It must still work — and must SAY what is missing. */
  const shared = S.newSkin('Nebula', 'stranger');
  shared.tokens = { '--cy':'#7f5cff' };
  shared.assets = { 'viewport.background': 'vault:nebula_bg', 'brand.mark': 'vault:nebula_mark' };
  const emptyVault = () => false;
  const a = S.accept(shared, null, emptyVault);
  a.ok ? ok('web: a downloaded skin with missing assets still APPLIES (colours work)') : bad('missing assets wrongly refused the skin');
  a.missingAssets.length === 2 ? ok('web: both missing assets are detected') : bad('missing assets not detected');
  a.warnings.some(w => w.includes('not in your vault') && w.includes('will not appear'))
    ? ok('web: missing assets WARN loudly — never a silent blank') : bad('missing asset was swallowed silently');

  const fullVault = id => id === 'nebula_bg' || id === 'nebula_mark';
  const b = S.accept(shared, null, fullVault);
  (b.ok && b.missingAssets.length === 0 && !b.warnings.some(w => w.includes('vault')))
    ? ok('web: with the assets present, no false warning') : bad('false missing-asset warning');

  /* backwards compatible: no vault probe = no asset claims either way */
  const c = S.accept(shared, null);
  (c.ok && c.missingAssets.length === 0) ? ok('web: without a vault probe, the gate makes no claim about assets') : bad('gate invented asset facts');

  /* a hostile skin downloaded from the web is still refused, assets or not */
  const hostile = S.newSkin('Free Neon Pack!!', 'axm');
  hostile.tokens = { '--panel':'#101010', '--gold':'#111111' };
  hostile.assets = { 'home.hero': 'vault:x' };
  const h = S.accept(hostile, null, emptyVault);
  (!h.ok && h.stage === 'readability') ? ok('web: a hostile download is refused before assets are even considered') : bad('hostile download slipped through');

  /* checkAssets is pure and standalone */
  const s2 = S.newSkin('S','me'); s2.assets = { 'home.hero':'vault:a', 'card.texture':'vault:b' };
  const partial = id => id === 'a';
  const r = S.checkAssets(s2, partial);
  (!r.ok && r.missing.length === 1 && r.missing[0].id === 'b') ? ok('web: checkAssets names exactly which asset is absent') : bad('checkAssets wrong');
})();

/* ---- 11. ASSET SLOTS: a designer must know what to make ---- */
(function assetSlots() {
  Object.keys(S.ASSET_SLOTS).length >= 8 ? ok('assets: a slot registry exists (' + Object.keys(S.ASSET_SLOTS).length + ' slots)') : bad('no asset slot registry');

  const made = S.newSkin('X','me'); made.assets = { totally_made_up_slot: 'vault:a' };
  const v = S.validate(made);
  (!v.ok && v.errors[0].includes('does not exist') && v.errors[0].includes('Legal slots'))
    ? ok('assets: an undeclared slot is refused, and the legal ones are named') : bad('undeclared asset slot accepted');

  const real = S.newSkin('Y','me'); real.assets = { 'home.hero': 'vault:hero_v2' };
  S.validate(real).ok ? ok('assets: a declared slot is accepted') : bad('declared slot refused');

  const none = S.newSkin('Z','me');
  S.accept(none, null).ok ? ok('assets: EVERY slot is optional — a skin with zero assets is complete') : bad('assets wrongly required');

  /* the spec sheet is generated, so it cannot drift from the gate */
  const spec = S.assetSpec();
  spec.length === Object.keys(S.ASSET_SLOTS).length ? ok('assets: the spec sheet is generated from the registry (cannot drift)') : bad('spec sheet drifted');
  spec.every(s => s.w && s.h && s.format && s.where && s.note) ? ok('assets: every slot declares size, format, location and a note') : bad('a slot is underspecified');
  spec.every(s => s.required === false) ? ok('assets: no slot is required — a missing asset can never break a hub') : bad('a slot is required');

  /* sizes must be real numbers a designer can act on */
  const mark = S.ASSET_SLOTS['brand.mark'];
  (mark.w === 30 && mark.h === 30) ? ok('assets: brand.mark is 30x30, matching .mark in the shell CSS') : bad('brand.mark size does not match the CSS');
  const icon = S.ASSET_SLOTS['nav.icon.default'];
  (icon.w === 20 && icon.format === 'svg') ? ok('assets: nav icons are 20x20 vector, matching .mod .ic') : bad('nav icon spec wrong');
  S.ASSET_SLOTS['sidebar.background'].w === 210 ? ok('assets: sidebar bg is 210px, matching grid-template-columns') : bad('sidebar bg width wrong');

  /* an asset can still never hide a warning */
  const sneaky = S.newSkin('Sneaky','x');
  sneaky.assets = { 'statusbar.background': 'vault:black' };
  sneaky.tokens = { '--muted':'#181d25', '--panel':'#181d25' };
  !S.accept(sneaky, null).ok ? ok('assets: an image does not exempt a skin from the readability floor') : bad('asset used to bypass readability');
})();

const head = 'AXM SKIN SELFTEST — ' + new Date().toISOString() + '\n' + fails + ' FAIL\n\n';
console.log(head + out.join('\n') + '\n');
process.exit(fails ? 1 : 0);
