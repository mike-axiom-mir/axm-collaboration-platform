(function (root, factory) {
  var deterministicJson = root && root.AXMDeterministicJson;
  var nodeCrypto = null;
  if (typeof module !== 'undefined' && module.exports) {
    deterministicJson = require('../deterministic-json-core/index.js');
    nodeCrypto = require('crypto');
    module.exports = factory(deterministicJson, nodeCrypto, null);
  } else {
    root.AXMExternalPatternObservatory = factory(deterministicJson, null, root && root.crypto);
  }
})(typeof self !== 'undefined' ? self : this, function (DeterministicJson, nodeCrypto, webCrypto) {
  'use strict';

  var MATRIX_SCHEMA = 'axm.external-repo-pattern-matrix/v1';
  var REPORT_SCHEMA = 'axm.external-pattern-observatory-report/v1';
  var CARD_SCHEMA = 'axm.external-pattern-card/v1';

  function assert(condition, message) {
    if (!condition) throw new Error(message);
  }

  function text(value, field, limit) {
    assert(typeof value === 'string', field + ' must be a string');
    var normalized = value.trim();
    assert(normalized.length > 0, field + ' must not be empty');
    assert(normalized.length <= (limit || 4000), field + ' is too long');
    return normalized;
  }

  function list(value, field, limit) {
    assert(Array.isArray(value), field + ' must be an array');
    var seen = Object.create(null);
    return value.map(function (item, index) {
      return text(item, field + '[' + index + ']', limit || 1000);
    }).filter(function (item) {
      if (seen[item]) return false;
      seen[item] = true;
      return true;
    }).sort();
  }

  function canonical(value) {
    assert(DeterministicJson && typeof DeterministicJson.canonicalJson === 'function', 'deterministic JSON dependency is unavailable');
    return DeterministicJson.canonicalJson(value);
  }

  function bytesToHex(bytes) {
    return Array.prototype.map.call(new Uint8Array(bytes), function (byte) {
      return byte.toString(16).padStart(2, '0');
    }).join('');
  }

  async function sha256(value) {
    var serialized = typeof value === 'string' ? value : canonical(value);
    if (nodeCrypto) return nodeCrypto.createHash('sha256').update(serialized, 'utf8').digest('hex');
    assert(webCrypto && webCrypto.subtle && typeof TextEncoder !== 'undefined', 'SHA-256 runtime is unavailable');
    return bytesToHex(await webCrypto.subtle.digest('SHA-256', new TextEncoder().encode(serialized)));
  }

  function normalizeProject(raw, index) {
    assert(raw && typeof raw === 'object' && !Array.isArray(raw), 'projects[' + index + '] must be an object');
    return {
      id: text(raw.id, 'projects[' + index + '].id', 120).toLowerCase(),
      family: text(raw.family, 'projects[' + index + '].family', 120),
      priority: text(raw.priority, 'projects[' + index + '].priority', 120),
      integrationMode: text(raw.integration_mode || raw.integrationMode, 'projects[' + index + '].integration_mode', 160),
      primaryPattern: text(raw.primary_pattern || raw.primaryPattern, 'projects[' + index + '].primary_pattern', 1000),
      axmUse: list(raw.axm_use || raw.axmUse, 'projects[' + index + '].axm_use', 600),
      warnings: list(raw.warnings, 'projects[' + index + '].warnings', 600),
      reportedLicenseHint: text(raw.license_hint || raw.reportedLicenseHint, 'projects[' + index + '].license_hint', 600),
      reportedLicenseClass: text(raw.license_class || raw.reportedLicenseClass, 'projects[' + index + '].license_class', 120)
    };
  }

  function normalizeMatrix(raw) {
    assert(raw && typeof raw === 'object' && !Array.isArray(raw), 'matrix must be an object');
    assert(raw.schema === MATRIX_SCHEMA, 'unsupported matrix schema');
    assert(Array.isArray(raw.projects), 'matrix projects must be an array');
    var ids = Object.create(null);
    var projects = raw.projects.map(normalizeProject).sort(function (left, right) {
      return left.id.localeCompare(right.id);
    });
    projects.forEach(function (project) {
      assert(!ids[project.id], 'duplicate project id: ' + project.id);
      ids[project.id] = true;
    });
    return {
      schema: MATRIX_SCHEMA,
      version: typeof raw.version === 'string' ? raw.version.trim() : '',
      status: typeof raw.status === 'string' ? raw.status.trim() : 'UNSPECIFIED',
      generatedDate: typeof raw.generated_date === 'string' ? raw.generated_date.trim() : null,
      projects: projects
    };
  }

  function semanticCardPayload(project) {
    return {
      sourceId: 'external-repo:' + project.id,
      family: project.family,
      priority: project.priority,
      integrationMode: project.integrationMode,
      primaryPattern: project.primaryPattern,
      axmUse: project.axmUse,
      warnings: project.warnings,
      reportedLicenseHint: project.reportedLicenseHint,
      reportedLicenseClass: project.reportedLicenseClass
    };
  }

  async function compileCard(project) {
    var semantic = semanticCardPayload(project);
    return {
      schema: CARD_SCHEMA,
      id: 'pattern:' + project.id,
      sourceId: semantic.sourceId,
      family: project.family,
      priority: project.priority,
      integrationMode: project.integrationMode,
      summary: project.primaryPattern,
      axmUse: project.axmUse,
      warnings: project.warnings,
      source: {
        assertionState: 'SOURCE_REPORTED_UNVERIFIED',
        coordinates: null,
        pinnedContentDigest: null,
        freshness: 'UNKNOWN',
        stale: true
      },
      license: {
        reportedHint: project.reportedLicenseHint,
        reportedClass: project.reportedLicenseClass,
        verification: 'UNVERIFIED',
        reuseDecision: 'BLOCKED_PENDING_PINNED_SOURCE_LICENSE'
      },
      instructionTreatment: 'INERT_DATA',
      semanticDigest: 'sha256:' + await sha256(semantic)
    };
  }

  async function compileMatrix(raw, provenance) {
    var matrix = normalizeMatrix(raw);
    var cards = [];
    for (var index = 0; index < matrix.projects.length; index += 1) {
      cards.push(await compileCard(matrix.projects[index]));
    }
    var report = {
      schema: REPORT_SCHEMA,
      version: '0.1.0',
      status: 'EXPERIMENTAL',
      input: {
        schema: matrix.schema,
        version: matrix.version,
        reportedStatus: matrix.status,
        sourcePackSha256: provenance && provenance.sourcePackSha256 ? String(provenance.sourcePackSha256) : null,
        projectCount: cards.length
      },
      summary: {
        cards: cards.length,
        sourceReportedUnverified: cards.length,
        sourceUnpinned: cards.length,
        freshnessUnknown: cards.length,
        licenseReuseBlocked: cards.length,
        conflicts: 0
      },
      cards: cards,
      truth: {
        externalStatementsAreSourceReported: true,
        externalStatementsVerified: false,
        patternCardsAreRuntimeProof: false,
        embeddedInstructionsExecuted: false,
        networkFetch: false,
        repositoryClone: false,
        packageInstall: false,
        foreignCodeExecution: false,
        reuseAuthorized: false,
        promoted: false,
        canon: false
      }
    };
    report.reportDigest = 'sha256:' + await sha256({
      schema: report.schema,
      version: report.version,
      cards: cards.map(function (card) { return { id: card.id, semanticDigest: card.semanticDigest }; }),
      truth: report.truth
    });
    return report;
  }

  function cardMap(report) {
    assert(report && report.schema === REPORT_SCHEMA && Array.isArray(report.cards), 'compiled report is required');
    var map = Object.create(null);
    report.cards.forEach(function (card) {
      assert(!map[card.id], 'duplicate compiled card id: ' + card.id);
      map[card.id] = card;
    });
    return map;
  }

  function compareReports(before, after) {
    var left = cardMap(before);
    var right = cardMap(after);
    var added = [];
    var removed = [];
    var changed = [];
    var unchanged = [];
    var licenseChanged = [];
    Object.keys(left).sort().forEach(function (id) {
      if (!right[id]) {
        removed.push(id);
      } else if (left[id].semanticDigest !== right[id].semanticDigest) {
        changed.push(id);
        if (canonical(left[id].license) !== canonical(right[id].license)) licenseChanged.push(id);
      } else {
        unchanged.push(id);
      }
    });
    Object.keys(right).sort().forEach(function (id) {
      if (!left[id]) added.push(id);
    });
    return {
      schema: 'axm.external-pattern-snapshot-diff/v1',
      state: added.length || removed.length || changed.length ? 'CHANGED' : 'UNCHANGED',
      added: added,
      removed: removed,
      changed: changed,
      unchanged: unchanged,
      licenseChanged: licenseChanged,
      staleCardIds: added.concat(changed).sort(),
      reuseDecision: licenseChanged.length ? 'BLOCKED_PENDING_LICENSE_REVIEW' : 'NO_NEW_REUSE_AUTHORITY'
    };
  }

  function resolveAssertions(raw) {
    assert(raw && raw.schema === 'axm.external-source-assertion-set/v1', 'unsupported assertion set schema');
    assert(Array.isArray(raw.assertions), 'assertions must be an array');
    var groups = Object.create(null);
    raw.assertions.forEach(function (assertion, index) {
      assert(assertion && typeof assertion === 'object', 'assertions[' + index + '] must be an object');
      var sourceId = text(assertion.sourceId, 'assertions[' + index + '].sourceId', 200);
      var field = text(assertion.field, 'assertions[' + index + '].field', 200);
      var key = sourceId + '\u0000' + field;
      if (!groups[key]) groups[key] = { sourceId: sourceId, field: field, values: [] };
      var encoded = canonical(assertion.value);
      if (!groups[key].values.some(function (item) { return item.canonical === encoded; })) {
        groups[key].values.push({ canonical: encoded, value: assertion.value });
      }
    });
    var resolutions = Object.keys(groups).sort().map(function (key) {
      var group = groups[key];
      return {
        sourceId: group.sourceId,
        field: group.field,
        verdict: group.values.length > 1 ? 'CONFLICT' : 'UNVERIFIED',
        assertedValues: group.values.map(function (item) { return item.value; })
      };
    });
    return {
      schema: 'axm.external-assertion-resolution/v1',
      state: resolutions.some(function (item) { return item.verdict === 'CONFLICT'; }) ? 'CONFLICT' : 'UNVERIFIED',
      resolutions: resolutions,
      truth: { contradictionAveragedAway: false, assertionsVerified: false }
    };
  }

  function filterCards(report, filters) {
    var query = String(filters && filters.query || '').trim().toLowerCase();
    var family = String(filters && filters.family || '').trim();
    var priority = String(filters && filters.priority || '').trim();
    return cardMap(report) && report.cards.filter(function (card) {
      var haystack = [card.id, card.family, card.priority, card.summary, card.integrationMode]
        .concat(card.axmUse, card.warnings).join(' ').toLowerCase();
      return (!query || haystack.indexOf(query) !== -1) && (!family || card.family === family) && (!priority || card.priority === priority);
    });
  }

  return {
    MATRIX_SCHEMA: MATRIX_SCHEMA,
    REPORT_SCHEMA: REPORT_SCHEMA,
    CARD_SCHEMA: CARD_SCHEMA,
    normalizeMatrix: normalizeMatrix,
    compileMatrix: compileMatrix,
    compareReports: compareReports,
    resolveAssertions: resolveAssertions,
    filterCards: filterCards,
    canonical: canonical,
    sha256: sha256
  };
});
