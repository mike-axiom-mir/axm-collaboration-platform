(function () {
  'use strict';

  var O = AXMOps, notice = document.getElementById('notice');

  function badge(text) { return '<span class="badge">' + O.esc(text) + '</span>'; }

  function providerFacts(value) {
    var provider = value.structuredProviders && value.structuredProviders.codeRecipes;
    if (!provider) return '';
    if (provider.status === 'INDEXED') return '<span>' + Number(provider.entryCount || 0) + ' structured code recipes</span>';
    if (provider.status === 'HELD') return '<span>code recipes held: ' + O.esc(provider.reason || 'invalid provider') + '</span>';
    return '<span>code recipe provider absent</span>';
  }

  function status() {
    O.get('/api/search').then(function (value) {
      document.getElementById('facts').innerHTML = '<span>' + value.entryCount + ' indexed entries</span><span>built ' + O.date(value.builtAt) + '</span><span>' + value.roots.length + ' source roots</span>' + providerFacts(value);
    }).catch(function (error) { O.notice(notice, error.message, 'bad'); });
  }

  function resultCard(result) {
    var structured = result.kind === 'structured-code-recipe';
    var labels = badge('score ' + result.score);
    if (structured) {
      labels += badge('CODE RECIPE');
      labels += badge(result.reviewState === 'STRUCTURE_HOLD' ? 'REVIEW HOLD' : 'REFERENCE ONLY');
      if (result.syntaxStatus && result.syntaxStatus !== 'NOT_AUDITED') labels += badge(result.syntaxStatus.replace(/_/g, ' '));
    }
    var provenance = structured
      ? '<p class="muted">Source ' + O.esc(result.sourceId || 'unknown') + ' · pack <code>' + O.esc((result.parentSha256 || '').slice(0, 16)) + '</code></p>'
      : '';
    return '<article class="card">' + labels + '<h3>' + O.esc(result.title || result.name) + '</h3><p><code>' + O.esc(result.path) + '</code></p><p>' + O.esc(result.snippet || 'Binary or metadata-only result.') + '</p>' + provenance + '<p class="muted">' + O.bytes(result.bytes) + ' · ' + O.date(result.modifiedAt) + ' · <code>' + O.esc(result.sha256.slice(0, 16)) + '</code></p></article>';
  }

  function search() {
    var query = document.getElementById('query').value.trim(), prefix = document.getElementById('prefix').value.trim();
    if (!query) return;
    O.get('/api/search?q=' + encodeURIComponent(query) + '&prefix=' + encodeURIComponent(prefix) + '&limit=60').then(function (value) {
      document.getElementById('facts').innerHTML = '<span>' + value.total + ' match(es)</span><span>index ' + O.date(value.indexBuiltAt) + '</span>';
      document.getElementById('results').innerHTML = value.results.map(resultCard).join('') || '<div class="panel">No matching indexed source.</div>';
    }).catch(function (error) { O.notice(notice, error.message, 'bad'); });
  }

  document.getElementById('form').onsubmit = function (event) { event.preventDefault(); search(); };
  document.getElementById('reindex').onclick = function () {
    O.notice(notice, 'Rebuilding bounded local index…', 'warn');
    O.post('/api/search/reindex', {}, { 'x-axm-search':'explicit-reindex' }).then(function (value) {
      O.notice(notice, 'Indexed ' + value.entryCount + ' entries.', 'ok'); status(); search();
    }).catch(function (error) { O.notice(notice, error.message, 'bad'); });
  };
  status();
}());
