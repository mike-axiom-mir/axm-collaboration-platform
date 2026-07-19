(function () {
  'use strict';
  var O = AXMOps;
  var notice = document.getElementById('notice');
  var worldId = document.getElementById('worldId');

  function selectedWorldId() {
    return String(worldId.value || 'living-globe').trim().toLowerCase();
  }

  function loadCatalog() {
    return O.get('/api/living-worlds').then(function (catalog) {
      var worlds = Array.isArray(catalog.worlds) ? catalog.worlds : [];
      document.getElementById('catalog').textContent = worlds.map(function (world) {
        return world.worldId + ' · r' + world.revision + ' · ' + world.entities + ' entities';
      }).join('\n') || 'No worlds are registered.';
      return worlds;
    }).catch(function (error) {
      O.notice(notice, error.message, 'bad');
      return [];
    });
  }

  function load() {
    var id = selectedWorldId();
    O.get('/api/living-world?worldId=' + encodeURIComponent(id)).then(function (world) {
      document.getElementById('revision').value = world.revision;
      document.getElementById('facts').innerHTML = [
        '<span>world ' + O.esc(world.worldId) + '</span>',
        '<span>owner ' + O.esc(world.owner) + '</span>',
        '<span>revision ' + world.revision + '</span>',
        '<span>' + world.entities.length + ' entities</span>',
        '<span>' + Object.keys(world.facts).length + ' facts</span>',
        world.lineageId ? '<span>lineage ' + O.esc(world.lineageId) + '</span>' : ''
      ].join('');
      document.getElementById('out').textContent = O.pretty(world);
    }).catch(function (error) {
      O.notice(notice, error.message, 'bad');
    });
  }

  document.getElementById('loadWorld').onclick = load;
  document.getElementById('createWorld').onclick = function () {
    var request;
    try { request = JSON.parse(document.getElementById('createBody').value); }
    catch (_) { return O.notice(notice, 'Bootstrap contract must be valid JSON.', 'bad'); }
    O.post('/api/living-world/create', request, { 'x-axm-world': 'explicit-create-world' }).then(function (created) {
      worldId.value = created.worldId;
      O.notice(notice, 'Created isolated world ' + created.worldId + ' at revision 0.', 'ok');
      loadCatalog();
      load();
    }).catch(function (error) { O.notice(notice, error.message, 'bad'); });
  };
  document.getElementById('patch').onclick = function () {
    var operations;
    try { operations = JSON.parse(document.getElementById('ops').value); }
    catch (_) { return O.notice(notice, 'Operations must be valid JSON.', 'bad'); }
    O.post('/api/living-world/patch', {
      worldId: selectedWorldId(),
      expectedRevision: Number(document.getElementById('revision').value),
      operations: operations,
      source: 'living-world-console'
    }, { 'x-axm-world': 'expected-revision-patch' }).then(function (result) {
      O.notice(notice, result.world.worldId + ' advanced to revision ' + result.world.revision + '.', 'ok');
      loadCatalog();
      load();
    }).catch(function (error) { O.notice(notice, error.message, 'bad'); });
  };
  document.getElementById('snapshot').onclick = function () {
    O.post('/api/living-world/snapshot', {
      worldId: selectedWorldId(),
      reason: document.getElementById('reason').value
    }, { 'x-axm-world': 'explicit-snapshot' }).then(function (snapshot) {
      O.notice(notice, 'Snapshot created for ' + snapshot.worldId + ': ' + snapshot.id, 'ok');
      load();
    }).catch(function (error) { O.notice(notice, error.message, 'bad'); });
  };
  document.getElementById('refresh').onclick = function () { loadCatalog(); load(); };

  loadCatalog();
  load();
}());
