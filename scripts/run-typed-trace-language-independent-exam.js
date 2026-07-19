'use strict';

const fs = require('fs');
const path = require('path');
const Exam = require('../organs/typed-trace-language-independent-exam-organ');

const source = process.argv[2];
if (!source) throw new Error('usage: node scripts/run-typed-trace-language-independent-exam.js <sealed-pack.json>');
const sourcePath = path.resolve(source);
const pack = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const result = Exam.run(pack);
process.stdout.write(JSON.stringify({
  ok: true,
  examId: result.exam.examId,
  examDigest: result.exam.examDigest,
  state: result.exam.state,
  records: result.exam.evaluation.summary.recordsAssessed,
  accepted: result.exam.evaluation.summary.acceptedShadowRenderings,
  observedPlanFamilies: result.exam.coverage.observedPlanFamilies,
  missingPlanFamilies: result.exam.coverage.missingPlanFamilies,
  declaredIndependenceNotProven: true,
  reused: result.reused,
  runDir: result.runDir
}, null, 2) + '\n');
