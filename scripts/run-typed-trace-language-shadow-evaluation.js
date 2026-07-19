'use strict';

const path = require('path');
const Evaluation = require('../organs/typed-trace-language-shadow-evaluation-organ');

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function main() {
  const receiptDir = path.resolve(argument('--receipts') || Evaluation.DEFAULT_RECEIPT_DIR);
  const records = Evaluation.collectRealReasoningReceiptRecords(receiptDir);
  if (!records.length) throw new Error(`no permissioned real local typed traces discovered under ${receiptDir}`);
  const result = Evaluation.run(records);
  process.stdout.write(JSON.stringify({
    schema: 'axm.mirror.typed-trace-language-shadow-evaluation-run/v1',
    batchId: result.batch.batchId,
    batchDigest: result.batch.batchDigest,
    state: result.batch.state,
    reused: result.reused,
    runDir: result.runDir,
    summary: result.batch.summary,
    authority: result.batch.authority,
    boundary: result.batch.boundary
  }, null, 2) + '\n');
}

if (require.main === module) main();
module.exports = { main };
