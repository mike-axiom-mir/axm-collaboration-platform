'use strict';

(function attach(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AXMDesignLineage = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildApi() {
  const BUNDLE_SCHEMA = 'axm.design-lineage.bundle/v1';
  const RECORD_SCHEMA = 'axm.design-lineage.record/v1';
  const LEDGER_SCHEMA = 'axm.design-lineage.ledger/v1';
  const VOCABULARY_SCHEMA = 'axm.design-vocabulary-candidate/v1';
  const MAX_RECORDS = 500;
  const MAX_TEXT = 4000;
  const KINDS = new Set(['artifact', 'observation', 'rejection', 'correction', 'lesson', 'constraint']);
  const DECISIONS = new Set(['accepted', 'rejected', 'revised', 'unknown']);
  const CRITERIA = new Set(['composition', 'readability', 'transparency', 'palette', 'typography', 'motion', 'spatial-hierarchy', 'consistency', 'usability', 'technical', 'other']);
  const POLARITIES = new Set(['prefer', 'avoid', 'required']);
  const BANNED_KEYS = new Set(['raw', 'rawcontent', 'raw_content', 'imagedata', 'image_data', 'video', 'videodata', 'video_data', 'transcript', 'chatlog', 'chat_log', 'base64']);

  function stable(value) {
    if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
    if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + stable(value[key])).join(',') + '}';
    return JSON.stringify(value);
  }

  function cleanText(value, field, required) {
    const text = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
    if (required && !text) throw new Error(field + ' is required');
    if (text.length > MAX_TEXT) throw new Error(field + ' exceeds ' + MAX_TEXT + ' characters');
    return text;
  }

  function cleanList(value, field) {
    if (value == null) return [];
    if (!Array.isArray(value)) throw new Error(field + ' must be an array');
    return [...new Set(value.map((item, index) => cleanText(item, field + '[' + index + ']', true)))].sort();
  }

  function findBannedKey(value, trail) {
    if (!value || typeof value !== 'object') return null;
    for (const [key, child] of Object.entries(value)) {
      const here = trail ? trail + '.' + key : key;
      if (BANNED_KEYS.has(String(key).toLowerCase())) return here;
      const nested = findBannedKey(child, here);
      if (nested) return nested;
    }
    return null;
  }

  async function sha256(value) {
    if (!globalThis.crypto || !globalThis.crypto.subtle) throw new Error('Web Crypto SHA-256 is unavailable');
    const bytes = new TextEncoder().encode(String(value));
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  }

  function normalizeDigest(value) {
    const digest = cleanText(value, 'source.digest', false).replace(/^sha256:/i, '').toLowerCase();
    if (digest && !/^[a-f0-9]{64}$/.test(digest)) throw new Error('source.digest must be a SHA-256 hex digest');
    return digest;
  }

  function normalizeRule(rule, index) {
    if (!rule || typeof rule !== 'object' || Array.isArray(rule)) throw new Error('rules[' + index + '] must be an object');
    const polarity = cleanText(rule.polarity || 'prefer', 'rules[' + index + '].polarity', true).toLowerCase();
    if (!POLARITIES.has(polarity)) throw new Error('rules[' + index + '].polarity is unsupported');
    return {
      statement: cleanText(rule.statement, 'rules[' + index + '].statement', true),
      polarity,
      scope: cleanText(rule.scope || 'general', 'rules[' + index + '].scope', true)
    };
  }

  function normalizeRecord(record, index) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) throw new Error('records[' + index + '] must be an object');
    const banned = findBannedKey(record, 'records[' + index + ']');
    if (banned) throw new Error(banned + ' is raw evidence; store a reference and digest instead');
    const source = record.source && typeof record.source === 'object' ? record.source : {};
    const kind = cleanText(record.kind, 'records[' + index + '].kind', true).toLowerCase();
    const decision = cleanText(record.decision || 'unknown', 'records[' + index + '].decision', true).toLowerCase();
    const criterion = cleanText(record.criterion || 'other', 'records[' + index + '].criterion', true).toLowerCase();
    if (!KINDS.has(kind)) throw new Error('records[' + index + '].kind is unsupported');
    if (!DECISIONS.has(decision)) throw new Error('records[' + index + '].decision is unsupported');
    if (!CRITERIA.has(criterion)) throw new Error('records[' + index + '].criterion is unsupported');
    const rules = record.rules == null ? [] : record.rules.map(normalizeRule);
    return {
      schema: RECORD_SCHEMA,
      source: {
        ref: cleanText(source.ref, 'records[' + index + '].source.ref', true),
        digest: normalizeDigest(source.digest),
        type: cleanText(source.type || 'unknown', 'records[' + index + '].source.type', true)
      },
      subject: cleanText(record.subject, 'records[' + index + '].subject', true),
      domain: cleanText(record.domain || 'visual-design', 'records[' + index + '].domain', true),
      kind,
      decision,
      criterion,
      observation: cleanText(record.observation, 'records[' + index + '].observation', true),
      reasons: cleanList(record.reasons, 'records[' + index + '].reasons'),
      rules,
      artifact_ref: cleanText(record.artifact_ref, 'records[' + index + '].artifact_ref', false),
      supersedes: cleanList(record.supersedes, 'records[' + index + '].supersedes')
    };
  }

  function groupBy(items, keyOf) {
    const groups = new Map();
    for (const item of items) {
      const key = keyOf(item);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    }
    return groups;
  }

  async function compileBundle(input) {
    const parsed = typeof input === 'string' ? JSON.parse(input) : input;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('bundle must be an object');
    if (parsed.schema !== BUNDLE_SCHEMA) throw new Error('bundle schema must be ' + BUNDLE_SCHEMA);
    if (!Array.isArray(parsed.records)) throw new Error('bundle.records must be an array');
    if (parsed.records.length > MAX_RECORDS) throw new Error('bundle exceeds the ' + MAX_RECORDS + '-record session limit');

    const errors = [];
    const normalized = [];
    parsed.records.forEach((record, index) => {
      try { normalized.push(normalizeRecord(record, index)); }
      catch (error) { errors.push({ index, message: error.message }); }
    });

    const hashed = [];
    for (const record of normalized) {
      const evidenceDigest = await sha256(stable(record));
      const lessonDigest = await sha256(stable({
        subject: record.subject.toLowerCase(),
        criterion: record.criterion,
        decision: record.decision,
        rules: record.rules.map(rule => ({ ...rule, statement: rule.statement.toLowerCase() }))
      }));
      hashed.push({ ...record, id: 'design-evidence-' + evidenceDigest.slice(0, 16), evidence_digest: evidenceDigest, lesson_digest: lessonDigest, provenance: record.source.digest ? 'EXACT_SOURCE_DIGEST' : 'PARTIAL_SOURCE_REFERENCE' });
    }

    const exactGroups = groupBy(hashed, record => record.evidence_digest);
    const records = [];
    const exactDuplicates = [];
    for (const group of exactGroups.values()) {
      records.push(group[0]);
      if (group.length > 1) exactDuplicates.push({ evidence_digest: group[0].evidence_digest, kept: group[0].id, removed_count: group.length - 1 });
    }

    const lessonGroups = groupBy(records, record => record.lesson_digest);
    const repeatedLessons = [];
    for (const group of lessonGroups.values()) {
      if (group.length > 1) repeatedLessons.push({ lesson_digest: group[0].lesson_digest, records: group.map(record => record.id), sources: group.map(record => record.source.ref) });
    }

    const subjectGroups = groupBy(records, record => record.subject.toLowerCase() + '|' + record.criterion);
    const conflicts = [];
    for (const [key, group] of subjectGroups) {
      const decisions = [...new Set(group.map(record => record.decision).filter(decision => decision !== 'unknown'))].sort();
      if (decisions.length > 1) conflicts.push({ subject_criterion: key, decisions, records: group.map(record => record.id), status: 'HUMAN_REVIEW_REQUIRED' });
    }

    const candidateMap = new Map();
    for (const record of records) {
      for (const rule of record.rules) {
        const key = await sha256(stable({ domain: record.domain, criterion: record.criterion, ...rule }));
        if (!candidateMap.has(key)) candidateMap.set(key, { schema: VOCABULARY_SCHEMA, id: 'design-rule-' + key.slice(0, 16), domain: record.domain, criterion: record.criterion, ...rule, evidence: [], status: 'REVIEW_REQUIRED' });
        candidateMap.get(key).evidence.push(record.id);
      }
    }
    const vocabularyCandidates = [...candidateMap.values()].map(candidate => ({ ...candidate, evidence: [...new Set(candidate.evidence)].sort() })).sort((a, b) => a.id.localeCompare(b.id));
    const bundleId = 'design-lineage-' + (await sha256(stable(records.map(record => record.evidence_digest).sort()))).slice(0, 16);

    return {
      schema: LEDGER_SCHEMA,
      id: bundleId,
      source_bundle_ref: cleanText(parsed.source_bundle_ref || '', 'source_bundle_ref', false),
      records,
      errors,
      exact_duplicates: exactDuplicates,
      repeated_lessons: repeatedLessons,
      conflicts,
      vocabulary_candidates: vocabularyCandidates,
      stats: {
        submitted: parsed.records.length,
        admitted: records.length,
        invalid: errors.length,
        exact_duplicates: exactDuplicates.reduce((total, duplicate) => total + duplicate.removed_count, 0),
        repeated_lesson_groups: repeatedLessons.length,
        conflicts: conflicts.length,
        exact_provenance: records.filter(record => record.provenance === 'EXACT_SOURCE_DIGEST').length,
        partial_provenance: records.filter(record => record.provenance === 'PARTIAL_SOURCE_REFERENCE').length,
        vocabulary_candidates: vocabularyCandidates.length
      },
      authority: 'EVIDENCE_LEDGER_ONLY_NO_AUTOMATIC_PROMOTION'
    };
  }

  return { BUNDLE_SCHEMA, RECORD_SCHEMA, LEDGER_SCHEMA, VOCABULARY_SCHEMA, MAX_RECORDS, KINDS: [...KINDS], DECISIONS: [...DECISIONS], CRITERIA: [...CRITERIA], stable, sha256, normalizeRecord, compileBundle };
});

