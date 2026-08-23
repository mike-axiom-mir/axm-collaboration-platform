#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Core = require('../../../tools/deterministic-json-core');

const ROOT = path.resolve(__dirname,'../../..');
const source = JSON.parse(fs.readFileSync(path.join(ROOT,'state/tool-readiness/latest-selftests.json'),'utf8'));
const index = JSON.parse(fs.readFileSync(path.join(ROOT,'tools-index.json'),'utf8'));
const reviewResult = source.results.find(item => item.id === 'review-inbox');
const reviewTool = index.tools.find(item => item.id === 'review-inbox');
const currentSelftestSha256 = crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,'tools/review-inbox/selftest.js'))).digest('hex');
if (!reviewResult || !reviewTool) throw new Error('review-inbox readiness evidence is missing');
const notPass = source.results.filter(item => item.verdict !== 'PASS').map(item => ({ id:item.id, verdict:item.verdict, exitCode:item.exitCode }));
const receipt = {
  schema:'axm.promotion-selftest-receipt/v1', status:notPass.length ? 'MIXED' : 'PASS',
  generatedAt:source.generatedAt, workers:source.workers, timeoutMs:source.timeoutMs,
  summary:{ total:source.results.length, pass:source.results.filter(item => item.verdict === 'PASS').length, notPass:notPass.length },
  reviewInbox:{
    path:reviewResult.path, verdict:reviewResult.verdict, exitCode:reviewResult.exitCode,
    recordedSelftestSha256:reviewResult.selftestSha256, currentSelftestSha256,
    exactCurrentSelftestDigest:reviewResult.selftestSha256 === currentSelftestSha256,
    indexPromotionState:reviewTool.promotion.state, indexPromotionBlockers:reviewTool.promotion.blockers
  },
  preservedNonPass:notPass,
  truth:{
    reviewInboxSelftestCurrentAndPassing:reviewResult.verdict === 'PASS' && reviewResult.selftestSha256 === currentSelftestSha256,
    readyForHumanReviewIsPromotion:false, readyForHumanReviewIsCanon:false,
    otherToolFailuresConvertedToPass:false, failureTailsRetained:false,
    mergeAuthorized:false, canonAuthorized:false
  },
  receiptDigest:null
};
const body = JSON.parse(Core.canonicalJson(receipt));
delete body.receiptDigest;
receipt.receiptDigest = 'sha256:' + crypto.createHash('sha256').update(Core.canonicalJson(body)).digest('hex');
fs.writeFileSync(path.join(__dirname,'PROMOTION_SELFTEST_RECEIPT.json'),JSON.stringify(receipt,null,2) + '\n','utf8');
process.stdout.write('PROMOTION SELFTEST ' + receipt.status + ' · review-inbox ' + reviewResult.verdict + ' current=' + receipt.reviewInbox.exactCurrentSelftestDigest + ' · ' + receipt.summary.notPass + ' other nonpass retained\n');
if (!receipt.truth.reviewInboxSelftestCurrentAndPassing || reviewTool.promotion.state !== 'READY_FOR_HUMAN_REVIEW') process.exitCode = 1;
