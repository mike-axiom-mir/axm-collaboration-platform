'use strict';

const Skin = require('./skin-core.js');
const Renderer = require('./skin-renderer.js');

let fail = 0;
function ok(name, pass) {
  if (pass) console.log('  PASS  ' + name);
  else { console.log('  FAIL  ' + name); fail++; }
}

(async function () {
  console.log('AXM SKIN RENDERER SELFTEST — ' + new Date().toISOString());

  const skinSlots = Object.keys(Skin.ASSET_SLOTS).sort();
  const renderSlots = Object.keys(Renderer.STYLE).sort();
  ok('renderer covers the exact 10 declared skin slots', JSON.stringify(skinSlots) === JSON.stringify(renderSlots));
  ok('same-origin skin-vault PNG accepted', Renderer.localSource('/assets/local/skin-vault/hero.png'));
  ok('same-origin skin-vault SVG accepted', Renderer.localSource('/assets/local/skin-vault/mark.svg'));
  ok('remote URL refused', !Renderer.localSource('https://example.com/hero.png'));
  ok('path traversal refused', !Renderer.localSource('/assets/local/skin-vault/../private.png'));

  const index = { schema:'axm.skin-vault/v1', assets:{
    hero:{ src:'/assets/local/skin-vault/hero.png' },
    mark:'/assets/local/skin-vault/mark.svg',
    bad:{ src:'https://example.com/bad.png' }
  }};
  const refs = {
    'home.hero':'vault:hero',
    'brand.mark':'vault:mark',
    'card.texture':'vault:missing',
    'viewport.background':'vault:bad'
  };
  const resolved = Renderer.resolve(refs, index);
  ok('two valid vault references resolve', resolved.found.length === 2);
  ok('missing vault id stays visible as missing', resolved.missing.length === 1 && resolved.missing[0].id === 'missing');
  ok('unsafe indexed source is refused', resolved.refused.length === 1 && resolved.refused[0].id === 'bad');

  const props = {}, classes = new Set();
  const fakeRoot = { style:{
    setProperty(k,v){ props[k] = v; },
    removeProperty(k){ delete props[k]; }
  }};
  const fakeBody = { classList:{
    add(k){ classes.add(k); },
    remove(k){ classes.delete(k); }
  }};
  class FakeImage {
    set src(v) { this._src = v; Promise.resolve().then(() => this.onload && this.onload()); }
  }
  const applied = await Renderer.apply({ 'home.hero':'vault:hero' }, {
    root:fakeRoot, body:fakeBody, Image:FakeImage,
    fetch:async () => ({ ok:true, json:async () => index })
  });
  ok('apply paints a CSS variable only after the file-load probe', applied.applied.length === 1 && /hero\.png/.test(props['--skin-home-hero'] || ''));
  ok('apply activates only the matching dormant CSS class', classes.has('skin-asset-home-hero') && classes.size === 1);

  console.log('\n' + fail + ' FAIL');
  process.exitCode = fail ? 1 : 0;
})().catch(e => {
  console.error(e && e.stack ? e.stack : e);
  process.exitCode = 1;
});
