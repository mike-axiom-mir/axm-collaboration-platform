(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AXMGameCapabilityAtlas = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var PLAN_SCHEMA = 'axm.game-capability-plan/v1';

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function normalize(value) {
    return String(value == null ? '' : value).trim().toLowerCase();
  }

  function terms(value) {
    return normalize(value).split(/[^a-z0-9]+/).filter(function (term) { return term.length > 1; });
  }

  function validate(catalog) {
    var errors = [];
    if (!catalog || catalog.schema !== 'axm.game-capability-atlas/v1') errors.push('catalog schema');
    if (!catalog || !Array.isArray(catalog.categories) || catalog.categories.length !== 20) errors.push('20 categories');
    if (!catalog || !Array.isArray(catalog.modules) || catalog.modules.length !== 500) errors.push('500 modules');
    if (!catalog || !Array.isArray(catalog.balancedWaves) || catalog.balancedWaves.length !== 25) errors.push('25 balanced waves');
    var ids = catalog && Array.isArray(catalog.modules) ? catalog.modules.map(function (row) { return row.id; }) : [];
    if (new Set(ids).size !== ids.length) errors.push('unique module IDs');
    return { pass: errors.length === 0, errors: errors };
  }

  function categoryMap(catalog) {
    var result = {};
    (catalog.categories || []).forEach(function (row) { result[row.id] = row; });
    return result;
  }

  function moduleMap(catalog) {
    var result = {};
    (catalog.modules || []).forEach(function (row) { result[row.id] = row; });
    return result;
  }

  function search(catalog, options) {
    options = options || {};
    var queryTerms = terms(options.query);
    var selectedCategory = normalize(options.category);
    var categories = categoryMap(catalog);
    var limit = Math.max(1, Math.min(500, Number(options.limit) || 100));
    return (catalog.modules || []).map(function (row) {
      if (selectedCategory && row.category !== selectedCategory) return null;
      var category = categories[row.category] || {};
      var title = normalize(row.title);
      var shortcut = normalize(row.shortcut);
      var tags = normalize((row.tags || []).join(' '));
      var layer = normalize(row.layer);
      var categoryText = normalize(category.title);
      var score = queryTerms.length ? queryTerms.reduce(function (sum, term) {
        if (title.indexOf(term) >= 0) sum += 8;
        if (tags.indexOf(term) >= 0) sum += 5;
        if (categoryText.indexOf(term) >= 0) sum += 4;
        if (shortcut.indexOf(term) >= 0) sum += 3;
        if (layer.indexOf(term) >= 0) sum += 2;
        return sum;
      }, 0) : 1;
      if (queryTerms.length && score === 0) return null;
      return { module: row, category: category, score: score };
    }).filter(Boolean).sort(function (left, right) {
      return right.score - left.score || left.module.number - right.module.number;
    }).slice(0, limit);
  }

  function balancedWave(catalog, number) {
    var waveNumber = Math.max(1, Math.min(25, Number(number) || 1));
    var wave = (catalog.balancedWaves || []).find(function (row) { return row.number === waveNumber; });
    if (!wave) throw new Error('Balanced wave not found: ' + waveNumber);
    var modules = moduleMap(catalog);
    return wave.moduleIds.map(function (id) {
      if (!modules[id]) throw new Error('Balanced wave references missing module: ' + id);
      return modules[id];
    });
  }

  function buildPlan(catalog, request) {
    request = request || {};
    var validation = validate(catalog);
    if (!validation.pass) throw new Error('Invalid atlas: ' + validation.errors.join(', '));
    var modules = moduleMap(catalog);
    var requested = Array.isArray(request.moduleIds) && request.moduleIds.length
      ? request.moduleIds
      : balancedWave(catalog, request.wave || 1).map(function (row) { return row.id; });
    var unique = [];
    requested.forEach(function (id) {
      if (!modules[id]) throw new Error('Unknown game capability: ' + id);
      if (unique.indexOf(id) < 0) unique.push(id);
    });
    if (unique.length > 100) throw new Error('A project plan is bounded to 100 modules');
    var categories = categoryMap(catalog);
    var items = unique.map(function (id) {
      var row = modules[id];
      return {
        moduleId: row.id,
        title: row.title,
        category: row.category,
        categoryTitle: categories[row.category].title,
        status: 'PROPOSED',
        action: row.shortcut,
        rationale: row.rationale,
        guard: row.guard,
        requiredEvidence: clone(row.requiredEvidence || []),
        proofStatus: row.proofStatus
      };
    });
    var categoryCounts = {};
    items.forEach(function (item) { categoryCounts[item.category] = (categoryCounts[item.category] || 0) + 1; });
    return {
      schema: PLAN_SCHEMA,
      version: '1.0.0',
      project: {
        id: String(request.projectId || 'detached-game-project'),
        name: String(request.projectName || 'Detached game project')
      },
      goal: String(request.goal || 'Build a playable, testable game slice'),
      source: clone(catalog.source),
      createdAt: request.createdAt || new Date().toISOString(),
      items: items,
      coverage: {
        selectedModules: items.length,
        coveredCategories: Object.keys(categoryCounts).length,
        totalCategories: 20,
        categoryCounts: categoryCounts
      },
      truth: {
        kind: 'project checklist and evidence plan',
        authority: 'NONE',
        automaticInstall: false,
        behavioralValidation: false
      }
    };
  }

  return {
    VERSION: '1.0.0',
    PLAN_SCHEMA: PLAN_SCHEMA,
    validate: validate,
    search: search,
    balancedWave: balancedWave,
    buildPlan: buildPlan
  };
});
