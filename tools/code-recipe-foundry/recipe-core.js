(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AXMCodeRecipes = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var LIMITS = Object.freeze({ maxBytes: 5 * 1024 * 1024, maxRows: 5000, maxSnippetLines: 6 });
  var FIELD_ALIASES = Object.freeze({
    rank: ['rank', 'rang'],
    title: ['title', 'titel'],
    snippet: ['snippet', 'code', 'code_snippet'],
    description: ['description', 'beschrijving', 'summary', 'what_it_does'],
    primaryLanguage: ['primarylanguage', 'primary_language', 'primarytechnology', 'primary_technology', 'language', 'taal', 'category'],
    domain: ['domain', 'domein', 'category', 'categorie'],
    tags: ['tags', 'labels'],
    sourceUrl: ['sourceurl', 'source_url', 'source', 'bron_url', 'bronurl'],
    popularityIndicator: ['popularityindicator', 'popularity_indicator', 'popularity', 'populariteit'],
    popularityScope: ['popularityscope', 'popularity_scope'],
    familyKey: ['familykey', 'family_key', 'family', 'deduplicationgroup', 'deduplicatiegroep', 'group', 'groep'],
    familyKeySource: ['familykeysource', 'family_key_source'],
    sourceId: ['sourceid', 'source_id', 'id'],
    categoryRank: ['categoryrank', 'category_rank'],
    notesSafety: ['notessafety', 'notes_safety', 'safetynotes', 'safety_notes'],
    difficulty: ['difficulty', 'moeilijkheid'],
    platform: ['platform'],
    versionBasis: ['versionbasis', 'version_basis'],
    researchDate: ['researchdate', 'research_date'],
    verification: ['verification', 'verification_note'],
    rankingBasis: ['rankingbasis', 'ranking_basis'],
    reviewState: ['reviewstate', 'review_state'],
    holdReasons: ['holdreasons', 'hold_reasons']
  });

  function cleanText(value) {
    return String(value == null ? '' : value).replace(/\r\n?/g, '\n').trim();
  }

  function utf8Length(value) {
    value = String(value == null ? '' : value);
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(value).length;
    if (typeof Buffer !== 'undefined') return Buffer.byteLength(value, 'utf8');
    return encodeURIComponent(value).replace(/%[0-9A-F]{2}|./gi, 'x').length;
  }

  function headerKey(value) {
    return cleanText(value).replace(/^\uFEFF/, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  }

  function slug(value) {
    var normalized = cleanText(value).normalize ? cleanText(value).normalize('NFKD') : cleanText(value);
    return normalized.toLowerCase().replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 120);
  }

  function fnv32(value, seed) {
    var hash = seed >>> 0;
    for (var i = 0; i < value.length; i += 1) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 16777619) >>> 0;
    }
    return ('00000000' + hash.toString(16)).slice(-8);
  }

  function stableId(value) {
    return 'recipe-' + fnv32(value, 2166136261) + fnv32(value, 2246822507);
  }

  function stableStringify(value) {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
    return '{' + Object.keys(value).sort().map(function (key) {
      return JSON.stringify(key) + ':' + stableStringify(value[key]);
    }).join(',') + '}';
  }

  function parseCsv(text) {
    text = String(text == null ? '' : text);
    var rows = [], row = [], field = '', quoted = false;
    for (var i = 0; i < text.length; i += 1) {
      var ch = text[i];
      if (quoted) {
        if (ch === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
        else if (ch === '"') quoted = false;
        else field += ch;
      } else if (ch === '"') {
        if (field.length) throw new Error('CSV quote begins inside an unquoted field at character ' + i + '.');
        quoted = true;
      } else if (ch === ',') {
        row.push(field); field = '';
      } else if (ch === '\n') {
        row.push(field); rows.push(row); row = []; field = '';
      } else if (ch !== '\r') field += ch;
    }
    if (quoted) throw new Error('CSV contains an unterminated quoted field.');
    row.push(field);
    if (row.some(function (cell) { return cell.length; }) || rows.length === 0) rows.push(row);
    rows = rows.filter(function (cells) { return cells.some(function (cell) { return cleanText(cell); }); });
    if (rows.length < 2) throw new Error('CSV needs one header row and at least one data row.');
    var headers = rows.shift().map(function (cell) { return cleanText(cell).replace(/^\uFEFF/, ''); });
    var seen = Object.create(null);
    headers.forEach(function (header) {
      var key = headerKey(header);
      if (!key) throw new Error('CSV contains an empty header.');
      if (seen[key]) throw new Error('CSV contains duplicate header: ' + header + '.');
      seen[key] = true;
    });
    return rows.map(function (cells) {
      var result = {};
      headers.forEach(function (header, index) { result[header] = cells[index] == null ? '' : cells[index]; });
      return result;
    });
  }

  function parseJson(text) {
    var parsed = JSON.parse(String(text == null ? '' : text));
    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.recipes)) return parsed.recipes;
    if (parsed && Array.isArray(parsed.entries)) return parsed.entries;
    if (parsed && Array.isArray(parsed.cheats)) return parsed.cheats;
    throw new Error('JSON must be an array or an object containing recipes[], entries[], or cheats[].');
  }

  function parseInput(text, format) {
    if (utf8Length(text) > LIMITS.maxBytes) throw new Error('Input exceeds the 5 MiB bounded intake limit.');
    format = cleanText(format).toLowerCase();
    if (!format || format === 'auto') format = /^\s*[\[{]/.test(String(text || '')) ? 'json' : 'csv';
    var rows = format === 'csv' ? parseCsv(text) : format === 'json' ? parseJson(text) : null;
    if (!rows) throw new Error('Only CSV and JSON intake are supported.');
    if (rows.length > LIMITS.maxRows) throw new Error('Input exceeds the 5,000-row bounded intake limit.');
    return { format: format, rows: rows };
  }

  function rowMap(row) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
    var map = Object.create(null);
    Object.keys(row).forEach(function (key) { map[headerKey(key)] = row[key]; });
    return map;
  }

  function getField(map, name) {
    var aliases = FIELD_ALIASES[name] || [];
    for (var i = 0; i < aliases.length; i += 1) {
      var key = headerKey(aliases[i]);
      if (Object.prototype.hasOwnProperty.call(map, key)) return map[key];
    }
    return '';
  }

  function parseTags(value) {
    var values = [];
    if (Array.isArray(value)) values = value;
    else {
      var text = cleanText(value);
      if (text[0] === '[') {
        try { var parsed = JSON.parse(text); if (Array.isArray(parsed)) values = parsed; }
        catch (error) { values = text.split(/[,;|]/); }
      } else values = text.split(/[,;|]/);
    }
    var seen = Object.create(null);
    return values.map(function (item) { return cleanText(item); }).filter(function (item) {
      var key = item.toLowerCase();
      if (!item || seen[key]) return false;
      seen[key] = true;
      return true;
    }).slice(0, 20);
  }

  function safeSourceUrl(value) {
    var text = cleanText(value);
    if (!text) return null;
    try {
      var parsed = new URL(text);
      if (!/^https?:$/.test(parsed.protocol) || parsed.username || parsed.password) return null;
      return parsed.href;
    } catch (error) { return null; }
  }

  function issue(rowNumber, code, message, severity, field) {
    return { row: rowNumber, code: code, field: field || null, severity: severity || 'ERROR', message: message };
  }

  function normalizeRow(row, rowNumber, options) {
    options = options || {};
    var map = rowMap(row), issues = [];
    if (!map) return { recipe: null, issues: [issue(rowNumber, 'ROW_NOT_OBJECT', 'Row must be an object or CSV record.')] };
    var title = cleanText(getField(map, 'title'));
    var snippet = cleanText(getField(map, 'snippet'));
    var description = cleanText(getField(map, 'description'));
    var primaryLanguage = cleanText(getField(map, 'primaryLanguage'));
    var tags = parseTags(getField(map, 'tags'));
    var sourceUrl = safeSourceUrl(getField(map, 'sourceUrl'));
    var popularityIndicator = cleanText(getField(map, 'popularityIndicator'));
    var domain = cleanText(getField(map, 'domain')) || null;
    var rawRank = Number(getField(map, 'rank'));
    var rank = Number.isInteger(rawRank) && rawRank > 0 ? rawRank : null;
    var rawFamily = cleanText(getField(map, 'familyKey'));
    var familyKey = slug(rawFamily || title);
    var scope = cleanText(getField(map, 'popularityScope')).toLowerCase();
    var allowedScopes = ['snippet', 'repository', 'ecosystem', 'source', 'not-measured', 'unknown'];
    if (allowedScopes.indexOf(scope) === -1) scope = 'unknown';
    var lineCount = snippet ? snippet.split('\n').length : 0;
    var maxSnippetLines = Number(options.maxSnippetLines || LIMITS.maxSnippetLines);
    var longFormHold = lineCount > LIMITS.maxSnippetLines && lineCount <= maxSnippetLines && options.reviewPolicy === 'LONG_FORM_HOLD';
    var holdReasons = parseTags(getField(map, 'holdReasons')).map(function (value) { return slug(value).toUpperCase(); }).filter(Boolean);
    if (longFormHold && holdReasons.indexOf('SNIPPET_OVER_SIX_LINES') === -1) holdReasons.push('SNIPPET_OVER_SIX_LINES');
    var familyKeySource = cleanText(getField(map, 'familyKeySource')).toUpperCase();
    if (['DECLARED', 'DERIVED_TITLE', 'DERIVED_CATEGORY_TITLE'].indexOf(familyKeySource) === -1) familyKeySource = rawFamily ? 'DECLARED' : 'DERIVED_TITLE';
    var rankingBasis = cleanText(getField(map, 'rankingBasis')).toUpperCase();
    if (rankingBasis !== 'EDITORIAL_NOT_POPULARITY_MEASURED') rankingBasis = 'DECLARED_POPULARITY_CONTEXT';
    var sourceId = cleanText(getField(map, 'sourceId')) || null;
    var rawCategoryRank = Number(getField(map, 'categoryRank'));
    var categoryRank = Number.isInteger(rawCategoryRank) && rawCategoryRank > 0 ? rawCategoryRank : null;
    var notesSafety = cleanText(getField(map, 'notesSafety')) || null;
    var difficulty = cleanText(getField(map, 'difficulty')) || null;
    var platform = cleanText(getField(map, 'platform')) || null;
    var versionBasis = cleanText(getField(map, 'versionBasis')) || null;
    var researchDate = cleanText(getField(map, 'researchDate')) || null;
    var verification = cleanText(getField(map, 'verification')) || null;

    if (!title) issues.push(issue(rowNumber, 'TITLE_REQUIRED', 'Title is required.', 'ERROR', 'title'));
    else if (title.length > 160) issues.push(issue(rowNumber, 'TITLE_TOO_LONG', 'Title exceeds 160 characters.', 'ERROR', 'title'));
    if (!snippet) issues.push(issue(rowNumber, 'SNIPPET_REQUIRED', 'Snippet is required.', 'ERROR', 'snippet'));
    else if (snippet.length > 4000) issues.push(issue(rowNumber, 'SNIPPET_TOO_LONG', 'Snippet exceeds 4,000 characters.', 'ERROR', 'snippet'));
    else if (lineCount > LIMITS.maxSnippetLines && !longFormHold) issues.push(issue(rowNumber, 'SNIPPET_TOO_MANY_LINES', 'Snippet exceeds the six-line contract.', 'ERROR', 'snippet'));
    else if (longFormHold) issues.push(issue(rowNumber, 'SNIPPET_LONG_FORM_HOLD', 'Snippet exceeds six lines and is retained only as a visible review hold.', 'WARNING', 'snippet'));
    if (!description) issues.push(issue(rowNumber, 'DESCRIPTION_REQUIRED', 'Description is required.', 'ERROR', 'description'));
    else if (description.length > 600) issues.push(issue(rowNumber, 'DESCRIPTION_TOO_LONG', 'Description exceeds 600 characters.', 'ERROR', 'description'));
    if (!primaryLanguage) issues.push(issue(rowNumber, 'LANGUAGE_REQUIRED', 'Primary language is required.', 'ERROR', 'primaryLanguage'));
    else if (primaryLanguage.length > 80) issues.push(issue(rowNumber, 'LANGUAGE_TOO_LONG', 'Primary language exceeds 80 characters.', 'ERROR', 'primaryLanguage'));
    if (!tags.length) issues.push(issue(rowNumber, 'TAGS_REQUIRED', 'At least one tag is required.', 'ERROR', 'tags'));
    if (!sourceUrl) issues.push(issue(rowNumber, 'SOURCE_URL_INVALID', 'Source URL must be HTTP(S) and contain no embedded credentials.', 'ERROR', 'sourceUrl'));
    if (!popularityIndicator) issues.push(issue(rowNumber, 'POPULARITY_INDICATOR_REQUIRED', 'Popularity indicator is required as source context.', 'ERROR', 'popularityIndicator'));
    if (!rank) issues.push(issue(rowNumber, 'RANK_NOT_DECLARED', 'No positive integer rank was declared; ordering will fall back to title.', 'WARNING', 'rank'));
    if (!rawFamily) issues.push(issue(rowNumber, 'FAMILY_KEY_DERIVED', 'Family key was mechanically derived from the title and needs review.', 'WARNING', 'familyKey'));
    else if (rawFamily !== familyKey) issues.push(issue(rowNumber, 'FAMILY_KEY_NORMALIZED', 'Family key was normalized visibly for portable grouping.', 'WARNING', 'familyKey'));
    if (scope === 'unknown') issues.push(issue(rowNumber, 'POPULARITY_SCOPE_UNKNOWN', 'Popularity is preserved as context but is not attributed to snippet, repository, ecosystem, or source.', 'WARNING', 'popularityScope'));
    if (scope === 'not-measured' && rankingBasis !== 'EDITORIAL_NOT_POPULARITY_MEASURED') issues.push(issue(rowNumber, 'RANKING_BASIS_REQUIRED', 'A not-measured popularity scope requires the explicit editorial ranking basis.', 'ERROR', 'rankingBasis'));
    holdReasons.filter(function (reason) { return reason !== 'SNIPPET_OVER_SIX_LINES'; }).forEach(function (reason) {
      issues.push(issue(rowNumber, 'DECLARED_REVIEW_HOLD', 'Recipe remains held for review: ' + reason + '.', 'WARNING', 'holdReasons'));
    });
    if (!familyKey) issues.push(issue(rowNumber, 'FAMILY_KEY_INVALID', 'Family key cannot be empty.', 'ERROR', 'familyKey'));
    if (issues.some(function (item) { return item.severity === 'ERROR'; })) return { recipe: null, issues: issues };

    var identity = [primaryLanguage.toLowerCase(), snippet, sourceUrl].join('\n---\n');
    return {
      identity: identity,
      recipe: {
        id: stableId(identity), rank: rank, title: title, snippet: snippet, description: description,
        primaryLanguage: primaryLanguage, domain: domain, tags: tags, sourceUrl: sourceUrl,
        popularityIndicator: popularityIndicator, popularityScope: scope, rankingBasis: rankingBasis,
        familyKey: familyKey, familyKeySource: familyKeySource,
        reviewState: holdReasons.length ? 'STRUCTURE_HOLD' : 'SOURCE_REVIEW_REQUIRED', holdReasons: holdReasons,
        sourceId: sourceId, categoryRank: categoryRank, notesSafety: notesSafety, difficulty: difficulty,
        platform: platform, versionBasis: versionBasis, researchDate: researchDate, verification: verification
      },
      issues: issues
    };
  }

  function groupFamilies(recipes) {
    var groups = Object.create(null);
    recipes.forEach(function (recipe) {
      var group = groups[recipe.familyKey] || (groups[recipe.familyKey] = { familyKey: recipe.familyKey, recipeIds: [], languages: [] });
      group.recipeIds.push(recipe.id);
      if (group.languages.indexOf(recipe.primaryLanguage) === -1) group.languages.push(recipe.primaryLanguage);
    });
    return Object.keys(groups).sort().map(function (key) {
      groups[key].languages.sort(function (a, b) { return a.localeCompare(b); });
      return groups[key];
    });
  }

  function ingest(text, options) {
    options = options || {};
    if (Number(options.maxSnippetLines || LIMITS.maxSnippetLines) > LIMITS.maxSnippetLines && options.reviewPolicy !== 'LONG_FORM_HOLD') {
      throw new Error('A line limit above six requires the explicit LONG_FORM_HOLD review policy.');
    }
    if (Number(options.maxSnippetLines || LIMITS.maxSnippetLines) > 20) throw new Error('Long-form review intake is bounded to 20 lines.');
    var parsed = parseInput(text, options.format || 'auto');
    var accepted = [], issues = [], seen = Object.create(null), duplicateCount = 0;
    parsed.rows.forEach(function (row, index) {
      var result = normalizeRow(row, index + 2, options);
      issues = issues.concat(result.issues);
      if (!result.recipe) return;
      if (seen[result.identity]) {
        duplicateCount += 1;
        issues.push(issue(index + 2, 'DUPLICATE_EXACT', 'Exact language, snippet, and source duplicate was not imported.', 'ERROR'));
        return;
      }
      seen[result.identity] = true;
      accepted.push(result.recipe);
    });
    accepted.sort(function (a, b) {
      if (a.rank && b.rank && a.rank !== b.rank) return a.rank - b.rank;
      if (a.rank && !b.rank) return -1;
      if (!a.rank && b.rank) return 1;
      return a.title.localeCompare(b.title) || a.primaryLanguage.localeCompare(b.primaryLanguage);
    });
    var families = groupFamilies(accepted);
    var errorRows = Object.create(null);
    issues.filter(function (item) { return item.severity === 'ERROR'; }).forEach(function (item) { errorRows[item.row] = true; });
    return {
      format: parsed.format,
      recipes: accepted,
      families: families,
      issues: issues,
      summary: {
        rawRows: parsed.rows.length,
        accepted: accepted.length,
        reviewReady: accepted.filter(function (item) { return item.reviewState === 'SOURCE_REVIEW_REQUIRED'; }).length,
        held: accepted.filter(function (item) { return item.reviewState === 'STRUCTURE_HOLD'; }).length,
        rejectedRows: Object.keys(errorRows).length,
        exactDuplicates: duplicateCount,
        warnings: issues.filter(function (item) { return item.severity === 'WARNING'; }).length,
        families: families.length,
        sourceReviewRequired: accepted.length
      }
    };
  }

  function buildPack(result, metadata) {
    metadata = metadata || {};
    return {
      schema: 'axm.code-recipe-pack/v1',
      generatedAt: metadata.generatedAt || new Date().toISOString(),
      source: {
        label: cleanText(metadata.label) || 'user-selected-intake',
        format: result.format,
        originalArtifactAvailable: metadata.originalArtifactAvailable !== false,
        researchReportOnly: metadata.researchReportOnly === true
      },
      summary: result.summary,
      recipes: result.recipes,
      families: result.families,
      truth: {
        snippetsExecuted: false,
        structuralValidationCompleted: true,
        sourceClaimsVerified: false,
        licensesVerified: false,
        popularityIsCorrectnessProof: false,
        semanticDeduplicationCompleted: false,
        reviewHoldsEnforced: true,
        automaticPromotion: false,
        canon: false
      }
    };
  }

  function buildReceipt(result, metadata) {
    metadata = metadata || {};
    return {
      schema: 'axm.code-recipe-intake-receipt/v1',
      observedAt: metadata.observedAt || new Date().toISOString(),
      source: { label: cleanText(metadata.label) || 'user-selected-intake', format: result.format },
      summary: result.summary,
      issues: result.issues,
      boundaries: { snippetsExecuted: false, networkFetched: false, invalidRowsHidden: false, automaticPromotion: false, canon: false }
    };
  }

  function search(recipes, query, language, familyKey, reviewState, difficulty) {
    var needle = cleanText(query).toLowerCase();
    return (recipes || []).filter(function (recipe) {
      if (language && recipe.primaryLanguage !== language) return false;
      if (familyKey && recipe.familyKey !== familyKey) return false;
      if (reviewState && recipe.reviewState !== reviewState) return false;
      if (difficulty && recipe.difficulty !== difficulty) return false;
      if (!needle) return true;
      return [recipe.sourceId, recipe.title, recipe.description, recipe.notesSafety, recipe.primaryLanguage, recipe.domain, recipe.familyKey, recipe.difficulty, recipe.platform, recipe.versionBasis, recipe.verification].concat(recipe.tags || []).join(' ').toLowerCase().indexOf(needle) !== -1;
    });
  }

  return {
    LIMITS: LIMITS,
    FIELD_ALIASES: FIELD_ALIASES,
    parseCsv: parseCsv,
    parseJson: parseJson,
    parseInput: parseInput,
    normalizeRow: normalizeRow,
    ingest: ingest,
    groupFamilies: groupFamilies,
    buildPack: buildPack,
    buildReceipt: buildReceipt,
    search: search,
    stableId: stableId,
    stableStringify: stableStringify,
    utf8Length: utf8Length,
    slug: slug,
    parseTags: parseTags
  };
}));
