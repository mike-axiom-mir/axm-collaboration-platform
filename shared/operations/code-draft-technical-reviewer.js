'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Clone = require('../../tools/mirror-code-clone/mirror-code-clone-kernel');

const ASSESSMENT_SCHEMA = 'axm.code-draft-technical-review/v1';
const BATCH_SCHEMA = 'axm.code-draft-technical-review-batch/v1';
const REFUSAL_SCHEMA = 'axm.code-draft-technical-refusal/v1';
const REVIEW_KIND = 'code-improvement-draft';
const BATCH_LIMIT = 25;

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
  }
  return value;
}

function stableJson(value) { return JSON.stringify(stable(value)); }

function isWithin(child, parent) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative !== '' && relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
}

function ordinaryFile(filePath, label) {
  if (!fs.existsSync(filePath)) throw new Error(label + ' is missing');
  const stat = fs.lstatSync(filePath);
  if (stat.isSymbolicLink() || !stat.isFile()) throw new Error(label + ' must be a regular file');
}

function readJson(filePath, label) {
  ordinaryFile(filePath, label);
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
  catch (error) { throw new Error(label + ' is not valid JSON: ' + error.message); }
}

function artifactDigest(receipt) {
  return sha256(stableJson({
    schema: receipt.schema,
    evidence: receipt.evidence,
    source: receipt.source,
    draft: receipt.draft,
    boundaries: receipt.boundaries
  }));
}

function create(options) {
  if (!options || !options.root || !options.reviewService || typeof options.reviewService.recordTechnicalReview !== 'function' || typeof options.reviewService.recordTechnicalRefusal !== 'function') {
    throw new Error('code-draft technical reviewer adapters required');
  }
  const root = path.resolve(options.root);

  function inspect(id, expectedDigest) {
    const item = options.reviewService.get(id);
    if (!item) throw new Error('review item not found');
    if (item.kind !== REVIEW_KIND) throw new Error('technical check only accepts code-improvement drafts');
    const digest = String(expectedDigest || '').toLowerCase();
    if (digest !== item.artifactDigest) throw new Error('technical check digest does not match the reviewed artifact');
    if (!item.action || item.action.type !== 'review-code-draft' || item.action.automaticApply !== false) {
      throw new Error('code draft is missing its candidate-only action boundary');
    }

    const candidateRoot = path.resolve(String(item.action.candidateRoot || ''));
    const checkedCandidate = Clone.assertCandidateRoot(candidateRoot);
    const receiptPath = path.resolve(String(item.action.receiptPath || ''));
    if (!isWithin(receiptPath, checkedCandidate.root)) throw new Error('technical review receipt escapes the candidate root');
    const receipt = readJson(receiptPath, 'technical review receipt');
    if (receipt.schema !== Clone.RECEIPT_SCHEMA) throw new Error('technical review receipt schema is unsupported');
    if (String(receipt.artifactDigest || '').toLowerCase() !== digest || artifactDigest(receipt) !== digest) {
      throw new Error('technical review receipt digest does not match the exact candidate');
    }
    if (!receipt.evidence || receipt.evidence.moduleId !== item.action.moduleId) throw new Error('technical review module identity does not match the queued draft');
    if (!receipt.source || receipt.source.unchanged !== true || receipt.source.writeAttempted !== false) throw new Error('technical review cannot prove the Workshop source stayed unchanged');
    if (!receipt.boundaries || receipt.boundaries.candidateRootOnly !== true || receipt.boundaries.sourceWorkshopWriteAttempted !== false || receipt.boundaries.installed !== false || receipt.boundaries.promoted !== false || receipt.boundaries.published !== false) {
      throw new Error('technical review candidate boundary is incomplete');
    }
    if (!receipt.draft || receipt.draft.reviewRequired !== true || receipt.draft.automaticApply !== false) throw new Error('technical review candidate is missing its no-auto-apply boundary');

    const relativePath = String(receipt.evidence.relativePath || '').replace(/\//g, path.sep);
    if (!relativePath || path.isAbsolute(relativePath)) throw new Error('technical review candidate path is invalid');
    const candidateFile = path.resolve(candidateRoot, relativePath);
    const sourceFile = path.resolve(root, relativePath);
    if (!isWithin(candidateFile, candidateRoot) || !isWithin(sourceFile, root)) throw new Error('technical review file path escapes its bounded root');
    ordinaryFile(candidateFile, 'candidate manifest');
    ordinaryFile(sourceFile, 'source manifest');
    const candidateBytes = fs.readFileSync(candidateFile);
    const sourceBytes = fs.readFileSync(sourceFile);
    if (sha256(candidateBytes) !== receipt.evidence.finalSha256) throw new Error('candidate manifest hash changed after drafting');
    const sourceHash = sha256(sourceBytes);
    if (sourceHash !== receipt.source.beforeSha256 || sourceHash !== receipt.source.afterSha256) throw new Error('Workshop source changed after this candidate was drafted');

    const candidateManifest = readJson(candidateFile, 'candidate manifest');
    if (!Array.isArray(candidateManifest.permissions)) throw new Error('candidate manifest permissions are not an array');
    const expectedPermissions = Array.isArray(receipt.evidence.addedPermissions) ? receipt.evidence.addedPermissions.map(String) : [];
    const actualPermissions = candidateManifest.permissions.map(String);
    if (receipt.evidence.repairClass === Clone.COMPLETENESS_REPAIR_CLASS) {
      if (actualPermissions.length !== 0 || expectedPermissions.length !== 0) throw new Error('candidate empty permissions field does not match the receipt');
    } else if (receipt.evidence.repairClass === Clone.REPAIR_CLASS) {
      if (expectedPermissions.some(permission => !actualPermissions.includes(permission))) throw new Error('candidate permissions do not include every receipt-declared addition');
    } else throw new Error('technical review repair class is unsupported');
    if (!receipt.evidence.verifier || receipt.evidence.verifier.pass !== true) throw new Error('candidate did not pass its bounded draft verifier');

    const scan = Clone.scanCandidate(candidateRoot);
    const row = scan.rows.find(entry => entry.module && entry.module.manifest && entry.module.manifest.id === item.action.moduleId);
    if (!row) throw new Error('technical review could not find the queued module in the candidate');
    const remainingErrors = row.module.check && Array.isArray(row.module.check.errors) ? row.module.check.errors.slice() : ['bounded module validation was unavailable'];
    const wholeModuleReady = !!(row.module.check && row.module.check.pass === true && remainingErrors.length === 0);
    const checks = [
      { id:'exact-receipt-digest', status:'PASS', evidence:'Receipt canonical digest matches the queued SHA-256.' },
      { id:'candidate-file-integrity', status:'PASS', evidence:'Candidate manifest SHA-256 matches the sealed receipt.' },
      { id:'source-unchanged', status:'PASS', evidence:'Current Workshop source still matches both sealed source hashes.' },
      { id:'candidate-only-boundary', status:'PASS', evidence:'Receipt refuses install, promote, publish, source write and automatic apply.' },
      { id:'bounded-module-contract', status:wholeModuleReady ? 'PASS' : 'HOLD', evidence:wholeModuleReady ? 'Candidate passes its bounded module contract.' : remainingErrors.join('; ').slice(0, 500) }
    ];
    const emptyPermissionClaim = receipt.evidence.repairClass === Clone.COMPLETENESS_REPAIR_CLASS && actualPermissions.length === 0;
    const verdict = wholeModuleReady ? 'APPROVE' : 'HOLD';
    const summary = verdict === 'APPROVE'
      ? 'APPROVE — Exact receipt and candidate hashes match, the Workshop source is unchanged, and the bounded module contract passes. This records review only; it does not apply the patch.'
      : 'HOLD — Exact receipt and candidate hashes match and the Workshop source is unchanged, but the bounded module check still reports: ' + remainingErrors.join('; ').slice(0, 420) + (emptyPermissionClaim ? '. An empty permissions list is not proven safe, so machine approval is withheld.' : '. Machine approval is withheld until those errors are repaired.');
    return {
      schema: ASSESSMENT_SCHEMA,
      artifactDigest: digest,
      moduleId: item.action.moduleId,
      repairClass: String(receipt.evidence.repairClass || 'unknown'),
      verdict,
      summary,
      checks,
      wholeModuleReady,
      sourceUnchanged: true,
      candidateIntegrity: true,
      automaticApply: false,
      applyAuthority: 'NONE',
      promotionAuthority: 'NONE',
      publicationAuthority: 'NONE'
    };
  }

  function review(id, expectedDigest) {
    const assessment = inspect(id, expectedDigest);
    return { assessment, item: options.reviewService.recordTechnicalReview(id, assessment) };
  }

  function hasExactTechnicalReview(item) {
    return Array.isArray(item.votes) && item.votes.some(vote =>
      vote && vote.actorKind === 'machine' && vote.artifactDigest === item.artifactDigest &&
      vote.technicalReview && vote.technicalReview.schema === ASSESSMENT_SCHEMA
    );
  }

  function uncheckedItems() {
    const closed = ['SUPERSEDED','REJECTED','REPAIR','CANCELLED','EXPIRED'];
    return options.reviewService.list().filter(item =>
      item.kind === REVIEW_KIND && closed.indexOf(item.state) < 0 && !hasExactTechnicalReview(item)
    );
  }

  function permanentRefusal(error, item) {
    const message = String(error && error.message || error || '');
    let reasonCode = '', summary = '';
    if (/Workshop source changed after this candidate was drafted/i.test(message)) {
      reasonCode = 'SOURCE_DRIFT';
      summary = 'STALE — The Workshop source changed after this exact draft was created, so this copy no longer matches what exists now. The old copy was retired without a vote or code change. A new candidate must be drafted from current source.';
    } else if (/candidate manifest hash changed after drafting/i.test(message)) {
      reasonCode = 'CANDIDATE_DRIFT';
      summary = 'INVALID COPY — The candidate bytes changed after its receipt was sealed, so the exact copy can no longer be trusted. It was retired without a vote or code change. A new sealed candidate is required.';
    } else if (/receipt digest does not match|receipt schema is unsupported|receipt escapes the candidate root|candidate path is invalid|file path escapes its bounded root/i.test(message)) {
      reasonCode = 'EVIDENCE_INVALID';
      summary = 'INVALID EVIDENCE — This exact candidate has a broken receipt, digest, schema, or path boundary. It was retired without a vote or code change. A new correctly sealed candidate is required.';
    }
    if (!reasonCode) return null;
    return {
      schema:REFUSAL_SCHEMA,
      artifactDigest:item.artifactDigest,
      moduleId:item.action && item.action.moduleId || item.title,
      reasonCode,
      summary,
      replacementRequired:true,
      automaticApply:false,
      applyAuthority:'NONE',
      promotionAuthority:'NONE',
      publicationAuthority:'NONE'
    };
  }

  function reviewPending() {
    const selected = uncheckedItems().slice(0, BATCH_LIMIT);
    const results = selected.map(item => {
      try {
        const checked = review(item.id, item.artifactDigest);
        return {
          id:item.id,
          moduleId:item.action && item.action.moduleId || item.title,
          artifactDigest:item.artifactDigest,
          status:'CHECKED',
          verdict:checked.assessment.verdict,
          summary:checked.assessment.summary
        };
      } catch (error) {
        const refusal = permanentRefusal(error, item);
        if (refusal) {
          options.reviewService.recordTechnicalRefusal(item.id, refusal);
          return {
            id:item.id,
            moduleId:item.action && item.action.moduleId || item.title,
            artifactDigest:item.artifactDigest,
            status:'RETIRED',
            verdict:'NONE',
            reasonCode:refusal.reasonCode,
            summary:refusal.summary
          };
        }
        return {
          id:item.id,
          moduleId:item.action && item.action.moduleId || item.title,
          artifactDigest:item.artifactDigest,
          status:'REFUSED',
          verdict:'NONE',
          summary:String(error && error.message || error || 'technical check refused').replace(root, '[WORKSHOP]').slice(0, 500)
        };
      }
    });
    const checked = results.filter(result => result.status === 'CHECKED');
    return {
      schema:BATCH_SCHEMA,
      limit:BATCH_LIMIT,
      selected:results.length,
      checked:checked.length,
      approved:checked.filter(result => result.verdict === 'APPROVE').length,
      held:checked.filter(result => result.verdict === 'HOLD').length,
      retired:results.filter(result => result.status === 'RETIRED').length,
      refused:results.filter(result => result.status === 'REFUSED').length,
      remainingUnchecked:uncheckedItems().length,
      automaticApply:false,
      applyAuthority:'NONE',
      results
    };
  }

  return { inspect, review, reviewPending, permanentRefusal };
}

module.exports = { create, artifactDigest, stableJson, ASSESSMENT_SCHEMA, BATCH_SCHEMA, REFUSAL_SCHEMA, REVIEW_KIND, BATCH_LIMIT };
