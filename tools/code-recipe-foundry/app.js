(function () {
  'use strict';

  var Core = window.AXMCodeRecipes;
  var STORAGE_KEY = 'axm.code-recipe-foundry.v1';
  var current = null;
  var source = { label: 'platform-code-cheats', format: 'auto' };
  var sourcePack = null;
  var syntaxAudit = null;
  var syntaxBySourceId = Object.create(null);
  var visibleLimit = 100;

  function $(id) { return document.getElementById(id); }
  function element(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = String(text);
    return node;
  }
  function clear(node) { node.replaceChildren(); }
  function notice(message, state) { $('notice').textContent = message; $('notice').className = 'notice' + (state ? ' ' + state : ''); }
  function downloadJson(name, value) {
    var blob = new Blob([JSON.stringify(value, null, 2) + '\n'], { type: 'application/json' });
    var url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = name; link.click();
    setTimeout(function () { URL.revokeObjectURL(url); }, 0);
  }
  function safeName(value) { return String(value || 'code-recipes').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'code-recipes'; }

  function renderStats(summary) {
    var host = $('stats'); clear(host);
    [
      ['Raw rows', summary.rawRows], ['Quick recipes', summary.reviewReady == null ? summary.accepted : summary.reviewReady],
      ['Review holds', summary.held || 0], ['Rejected rows', summary.rejectedRows],
      ['Warnings', summary.warnings], ['Families', summary.families],
      ['Syntax pass', syntaxAudit ? syntaxAudit.summary.syntaxPass : 0]
    ].forEach(function (item) {
      var card = element('div', 'stat'); card.append(element('strong', '', item[1]), element('span', '', item[0])); host.append(card);
    });
  }

  function option(value, label) { var node = element('option', '', label); node.value = value; return node; }
  function renderFilters() {
    var language = $('languageFilter'), family = $('familyFilter'), difficulty = $('difficultyFilter'), syntax = $('syntaxFilter');
    var selectedLanguage = language.value, selectedFamily = family.value, selectedDifficulty = difficulty.value, selectedSyntax = syntax.value;
    clear(language); clear(family); clear(difficulty); clear(syntax); language.append(option('', 'All languages')); family.append(option('', 'All families')); difficulty.append(option('', 'All levels')); syntax.append(option('', 'All syntax states'));
    Array.from(new Set(current.recipes.map(function (row) { return row.primaryLanguage; }))).sort().forEach(function (value) { language.append(option(value, value)); });
    current.families.forEach(function (row) { family.append(option(row.familyKey, row.familyKey + ' · ' + row.recipeIds.length)); });
    Array.from(new Set(current.recipes.map(function (row) { return row.difficulty; }).filter(Boolean))).sort().forEach(function (value) { difficulty.append(option(value, value)); });
    ['SYNTAX_PASS', 'CONTEXT_UNSUPPORTED', 'VERIFIER_UNAVAILABLE', 'REVIEW_HOLD', 'NOT_AUDITED'].forEach(function (value) { syntax.append(option(value, value.replace(/_/g, ' '))); });
    language.value = selectedLanguage; family.value = selectedFamily; difficulty.value = selectedDifficulty; syntax.value = selectedSyntax;
  }

  function copySnippet(recipe, button) {
    if (!navigator.clipboard || !navigator.clipboard.writeText) { notice('Clipboard API is unavailable in this browser; no hidden fallback ran.', 'fail'); return; }
    navigator.clipboard.writeText(recipe.snippet).then(function () {
      button.textContent = 'Copied'; notice('Copied inert snippet text: ' + recipe.title + '.', 'pass');
      setTimeout(function () { button.textContent = 'Copy'; }, 1000);
    }).catch(function (error) { notice('Clipboard write was refused: ' + error.message, 'fail'); });
  }

  function recipeCard(recipe) {
    var held = recipe.reviewState === 'STRUCTURE_HOLD';
    var card = element('article', 'recipe' + (held ? ' hold' : ''));
    var head = element('div', 'recipe-head'), title = element('h3', '', recipe.title), rank = element('span', 'recipe-rank', recipe.rank ? '#' + recipe.rank : 'UNRANKED');
    head.append(title, rank);
    var meta = element('div', 'meta');
    meta.append(element('span', 'chip language', recipe.primaryLanguage), element('span', 'chip', recipe.familyKey));
    if (recipe.difficulty) meta.append(element('span', 'chip', recipe.difficulty));
    if (held) meta.append(element('span', 'chip hold', 'REVIEW HOLD'));
    var syntaxStatus = syntaxBySourceId[recipe.sourceId] || 'NOT_AUDITED';
    if (syntaxStatus !== 'NOT_AUDITED') meta.append(element('span', 'chip syntax', syntaxStatus.replace(/_/g, ' ')));
    recipe.tags.slice(0, 4).forEach(function (tag) { meta.append(element('span', 'chip', tag)); });
    var code = element('pre', '', recipe.snippet), description = element('p', '', recipe.description);
    var foot = element('div', 'recipe-foot'), link = element('a', '', 'Source'), copy = element('button', '', held ? 'Held' : 'Copy');
    link.href = recipe.sourceUrl; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.title = recipe.sourceUrl;
    copy.type = 'button'; copy.disabled = held;
    if (!held) copy.addEventListener('click', function () { copySnippet(recipe, copy); });
    card.append(head, meta, code, description);
    if (recipe.notesSafety) card.append(element('p', 'safety', 'Safety: ' + recipe.notesSafety));
    if (held) card.append(element('p', 'hold-reason', 'HOLD: ' + (recipe.holdReasons || []).join(' · ')));
    foot.append(link, copy); card.append(foot); return card;
  }

  function renderCatalog() {
    var host = $('catalog'); clear(host);
    if (!current) {
      var empty = element('div', 'empty'); empty.append(element('strong', '', 'No catalog is loaded in this session.'), element('span', '', 'Load the installed catalog or import a compatible JSON/CSV pack.')); host.append(empty); $('catalogStatus').textContent = '0 shown'; $('showMoreButton').disabled = true; return;
    }
    var rows = Core.search(current.recipes, $('query').value, $('languageFilter').value, $('familyFilter').value, $('reviewFilter').value, $('difficultyFilter').value);
    var syntaxFilter = $('syntaxFilter').value;
    if (syntaxFilter) rows = rows.filter(function (recipe) { return (syntaxBySourceId[recipe.sourceId] || 'NOT_AUDITED') === syntaxFilter; });
    if (!rows.length) { var none = element('div', 'empty'); none.append(element('strong', '', 'No matching recipes.'), element('span', '', 'Change the local filters; no source was fetched.')); host.append(none); $('catalogStatus').textContent = '0 of 0 shown'; $('showMoreButton').disabled = true; return; }
    rows.slice(0, visibleLimit).forEach(function (recipe) { host.append(recipeCard(recipe)); });
    $('catalogStatus').textContent = Math.min(visibleLimit, rows.length) + ' of ' + rows.length + ' shown';
    $('showMoreButton').disabled = visibleLimit >= rows.length;
  }

  function renderIssues() {
    var host = $('issues'); clear(host); $('issueCount').textContent = current ? String(current.issues.length) : '0';
    if (!current || !current.issues.length) { host.append(element('p', 'muted', current ? 'No structural issues.' : 'No intake has been validated.')); return; }
    current.issues.slice(0, 300).forEach(function (item) {
      var row = element('div', 'issue ' + item.severity.toLowerCase());
      row.append(element('code', '', 'ROW ' + item.row), element('span', '', item.message), element('strong', '', item.code)); host.append(row);
    });
    if (current.issues.length > 300) host.append(element('p', 'muted', (current.issues.length - 300) + ' additional issues are preserved in the exported receipt.'));
  }

  function render() {
    if (!current) {
      clear($('stats')); renderCatalog(); renderIssues();
      ['saveButton', 'exportPackButton', 'exportReceiptButton'].forEach(function (id) { $(id).disabled = true; });
      return;
    }
    renderStats(current.summary); renderFilters(); renderCatalog(); renderIssues();
    ['saveButton', 'exportPackButton', 'exportReceiptButton'].forEach(function (id) { $(id).disabled = false; });
    $('truthBanner').replaceChildren(element('strong', '', 'Structural truth:'), element('span', '', (current.summary.reviewReady == null ? current.summary.accepted : current.summary.reviewReady) + ' quick recipes · ' + (current.summary.held || 0) + ' review holds · none executed.'));
  }

  function packForExport() {
    var pack = Core.buildPack(current, { label: source.label });
    if (sourcePack) {
      pack.source = sourcePack.source;
      pack.summary = Object.assign({}, sourcePack.summary, pack.summary);
      pack.truth = Object.assign({}, sourcePack.truth, pack.truth);
    }
    return pack;
  }

  function receiptForExport() {
    var receipt = Core.buildReceipt(current, { label: source.label });
    if (sourcePack && sourcePack.source) receipt.source = sourcePack.source;
    return receipt;
  }

  function runIntake(text, format, label, options) {
    try {
      current = Core.ingest(text, Object.assign({ format: format }, options || {})); source = { label: label || 'user-selected-intake', format: current.format }; sourcePack = null; syntaxAudit = null; syntaxBySourceId = Object.create(null); visibleLimit = 100;
      render();
      notice(current.summary.accepted + ' accepted · ' + current.summary.rejectedRows + ' rejected rows · ' + current.summary.families + ' families. Review issues before saving.', current.summary.accepted ? 'pass' : 'fail');
      if (window.AXMHub) AXMHub.log('code recipe intake validated: ' + current.summary.accepted + ' accepted; no snippets executed');
    } catch (error) { notice(error.message, 'fail'); }
  }

  $('loadInstalledButton').addEventListener('click', function () {
    var button = this; button.disabled = true; notice('Loading the module-local normalized catalog…');
    Promise.all([
      fetch('catalog/code-cheats-1000.code-recipes.json', { cache:'no-store' }).then(function (response) { if (!response.ok) throw new Error('installed catalog HTTP ' + response.status); return response.json(); }),
      fetch('catalog/code-cheats-1000.intake-receipt.json', { cache:'no-store' }).then(function (response) { if (!response.ok) throw new Error('installed receipt HTTP ' + response.status); return response.json(); }),
      fetch('catalog/code-cheats-1000.syntax-audit.json', { cache:'no-store' }).then(function (response) { if (!response.ok) throw new Error('installed syntax audit HTTP ' + response.status); return response.json(); })
    ]).then(function (values) {
      var pack = values[0], receipt = values[1], audit = values[2];
      current = Core.ingest(JSON.stringify(pack), { format:'json', maxSnippetLines:20, reviewPolicy:'LONG_FORM_HOLD' });
      if (current.summary.accepted !== 1000 || current.summary.held !== 63 || receipt.summary.held !== 63 || audit.schema !== 'axm.code-recipe-syntax-audit/v1' || audit.summary.syntaxPass !== 111) throw new Error('installed catalog count contract changed');
      syntaxAudit = audit; syntaxBySourceId = Object.create(null); audit.results.forEach(function (row) { syntaxBySourceId[row.sourceId] = row.status; });
      current.issues = receipt.issues; sourcePack = pack; source = { label:pack.source.label, format:'json' }; visibleLimit = 100;
      $('sourceLabel').value = source.label; render(); notice('Installed catalog loaded: 937 quick recipes · 63 review holds · 0 executed.', 'pass');
    }).catch(function (error) { notice('Installed catalog refused: ' + error.message, 'fail'); }).finally(function () { button.disabled = false; });
  });

  $('validateButton').addEventListener('click', function () {
    runIntake($('pasteInput').value, $('format').value, $('sourceLabel').value);
  });
  $('fileInput').addEventListener('change', function () {
    var file = this.files && this.files[0]; if (!file) return;
    if (file.size > Core.LIMITS.maxBytes) { notice('Selected file exceeds the 5 MiB intake limit.', 'fail'); return; }
    var extension = (file.name.split('.').pop() || '').toLowerCase();
    if (extension !== 'csv' && extension !== 'json') { notice('Only CSV and JSON are supported. Export XLSX as UTF-8 CSV first.', 'fail'); return; }
    var reader = new FileReader();
    reader.onload = function () { $('sourceLabel').value = file.name; runIntake(reader.result, extension, file.name); };
    reader.onerror = function () { notice('The selected file could not be read.', 'fail'); };
    reader.readAsText(file);
  });
  ['query', 'languageFilter', 'familyFilter', 'reviewFilter', 'difficultyFilter', 'syntaxFilter'].forEach(function (id) { $(id).addEventListener(id === 'query' ? 'input' : 'change', function () { visibleLimit = 100; renderCatalog(); }); });
  $('showMoreButton').addEventListener('click', function () { visibleLimit += 100; renderCatalog(); });

  $('saveButton').addEventListener('click', function () {
    if (!current) return;
    try {
      var pack = packForExport();
      var receipt = receiptForExport();
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ pack: pack, receipt: receipt }));
      notice('Validated pack saved in this browser. This is local continuity, not backup or promotion.', 'pass');
      if (window.AXMHub) AXMHub.save({ format: 1, sourceLabel: source.label, accepted: current.summary.accepted, families: current.summary.families });
    } catch (error) { notice('Local save failed: ' + error.message, 'fail'); }
  });
  $('exportPackButton').addEventListener('click', function () {
    if (!current) return; downloadJson(safeName(source.label) + '.code-recipes.json', packForExport()); notice('Normalized recipe pack downloaded explicitly.', 'pass');
  });
  $('exportReceiptButton').addEventListener('click', function () {
    if (!current) return; downloadJson(safeName(source.label) + '.intake-receipt.json', receiptForExport()); notice('Intake receipt downloaded with all row-level issues.', 'pass');
  });
  $('clearButton').addEventListener('click', function () {
    current = null; sourcePack = null; syntaxAudit = null; syntaxBySourceId = Object.create(null); visibleLimit = 100; localStorage.removeItem(STORAGE_KEY); $('pasteInput').value = ''; $('fileInput').value = ''; $('query').value = ''; $('languageFilter').value = ''; $('familyFilter').value = ''; $('reviewFilter').value = ''; $('difficultyFilter').value = ''; $('syntaxFilter').value = '';
    $('truthBanner').replaceChildren(element('strong', '', 'Recovered catalog:'), element('span', '', '1,000 JSON/CSV-matched entries are installed locally: 937 quick recipes and 63 visible review holds.'));
    render(); notice('Local Code Recipe Foundry state cleared explicitly.');
  });

  function restore() {
    try {
      var saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (!saved || !saved.pack) return;
      current = Core.ingest(JSON.stringify(saved.pack), { format: 'json', maxSnippetLines:20, reviewPolicy:'LONG_FORM_HOLD' });
      if (saved.receipt && Array.isArray(saved.receipt.issues)) current.issues = saved.receipt.issues;
      source = { label: saved.pack.source && saved.pack.source.label || 'saved-pack', format: 'json' }; sourcePack = saved.pack;
      $('sourceLabel').value = source.label; render(); notice('Restored an explicitly saved local pack and revalidated its recipes.', 'pass');
    } catch (error) { notice('Saved local state was invalid and was not restored: ' + error.message, 'fail'); }
  }

  if (window.AXMHub) {
    AXMHub.onInit(function () { AXMHub.log('Code Recipe Foundry ready; imported snippets are inert text'); });
    AXMHub.onShutdown(function () { AXMHub.log('Code Recipe Foundry closing; no background work remains'); });
    AXMHub.ready({ id:'code-recipe-foundry', name:'Code Recipe Foundry', version:'v0.3', hubApiVersion:'1.0', permissions:['storage','export','clipboard-write'], savesState:true, handlesShutdown:true });
  }
  restore();
}());
