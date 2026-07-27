(function () {
  'use strict';
  var FX = globalThis.AXMVisualFX;
  if (!FX || !FX.Blocks) {
    document.body.textContent = 'AXM Visual FX runtime is unavailable.';
    return;
  }

  var names = Object.keys(FX.Blocks);
  var selected = 'glow';
  var list = document.getElementById('effectList');
  var specimen = document.getElementById('specimen');
  var notice = document.getElementById('notice');
  var labels = {
    linearGradient:'Linear gradient',radialGradient:'Radial gradient',conicGradient:'Conic gradient',glow:'Glow',neon:'Neon',softShadow:'Soft shadow',longShadow:'Long shadow',rimBevel:'Rim / bevel',spotlight:'Spotlight',vignette:'Vignette',grain:'Film grain',scanlines:'Scanlines',sheen:'Sheen',frostedGlass:'Frosted glass',gradientBorder:'Gradient border'
  };

  function humanLimit(name, block) {
    if (name === 'conicGradient') return 'CSS and tokens are exact. SVG has no native conic-gradient equivalent; engines must bake or adapt it.';
    if (name === 'frostedGlass') return 'Exact appearance requires a live backdrop. A static tile cannot prove what will be blurred.';
    if (name === 'grain') return 'Browser SVG uses feTurbulence. Some offline rasterizers, including the proof renderer, do not support it.';
    return block.note || 'CSS and token forms are available. Visual approval and target-host integration remain separate gates.';
  }

  function recipe(name, block) {
    return {
      schema: 'axm.visual-fx-recipe/v1', version: '1.0.0', id: 'preview-' + block.id,
      effect: { name: name, kind: block.kind, parameters: block.tokens },
      outputs: { css: true, svg: !!(block.svgFilter || block.svgDefs), tokens: true },
      provenance: { origin: 'local-generated', creator: 'Opus for Mike Tobi / AXM' },
      authority: { automatic_apply: false, visual_approval: false, canonical: false }
    };
  }

  function renderPreview(name, block) {
    specimen.removeAttribute('style');
    specimen.style.cssText = block.css || '';
    specimen.style.transform = name === 'longShadow' ? 'translate(-8px,-8px)' : '';
    document.getElementById('specimenLabel').textContent = name;
  }

  function render() {
    var block = FX.Blocks[selected]();
    list.querySelectorAll('button').forEach(function (button) { button.setAttribute('aria-current', String(button.dataset.name === selected)); });
    document.getElementById('effectName').textContent = labels[selected] || selected;
    document.getElementById('effectKind').textContent = block.kind;
    document.getElementById('effectLimit').textContent = humanLimit(selected, block);
    document.getElementById('cssOutput').textContent = block.css;
    var forms = document.getElementById('forms');
    forms.replaceChildren();
    [['CSS',true],['SVG',!!(block.svgFilter || block.svgDefs)],['TOKENS',true]].forEach(function (entry) {
      var chip = document.createElement('span'); chip.textContent = entry[0] + ' ' + (entry[1] ? 'READY' : 'N/A'); if (entry[1]) chip.className = 'yes'; forms.appendChild(chip);
    });
    renderPreview(selected, block);
    notice.textContent = (labels[selected] || selected) + ' · content id ' + block.id;
  }

  names.forEach(function (name, index) {
    var button = document.createElement('button');
    button.type = 'button'; button.dataset.name = name;
    var text = document.createElement('span'); text.textContent = labels[name] || name;
    var number = document.createElement('i'); number.textContent = String(index + 1).padStart(2, '0');
    button.append(text, number);
    button.addEventListener('click', function () { selected = name; render(); });
    list.appendChild(button);
  });
  document.getElementById('effectCount').textContent = names.length + ' admitted';

  document.getElementById('copyCss').addEventListener('click', function () {
    var text = FX.Blocks[selected]().css;
    var operation = navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(text) : Promise.reject(new Error('Clipboard unavailable'));
    operation.then(function () { notice.textContent = 'CSS copied · no host changed'; }).catch(function () { notice.textContent = 'Clipboard blocked · CSS remains visible below'; });
  });
  document.getElementById('downloadRecipe').addEventListener('click', function () {
    var block = FX.Blocks[selected]();
    var blob = new Blob([JSON.stringify(recipe(selected, block), null, 2)], { type: 'application/json' });
    var link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'axm-' + selected + '-fx-recipe.json'; link.click();
    setTimeout(function () { URL.revokeObjectURL(link.href); }, 0);
    notice.textContent = 'Recipe downloaded · candidate only';
  });

  render();
}());
