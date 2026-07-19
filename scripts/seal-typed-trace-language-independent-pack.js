'use strict';

const fs = require('fs');
const path = require('path');
const Exam = require('../organs/typed-trace-language-independent-exam-organ');

const input = process.argv[2];
const output = process.argv[3];
if (!input || !output) throw new Error('usage: node scripts/seal-typed-trace-language-independent-pack.js <draft.json> <sealed.json>');
const inputPath = path.resolve(input);
const outputPath = path.resolve(output);
if (inputPath === outputPath) throw new Error('seal output must differ from the authored draft');
if (fs.existsSync(outputPath)) throw new Error(`seal output already exists: ${outputPath}`);
const pack = Exam.sealPack(JSON.parse(fs.readFileSync(inputPath, 'utf8')));
Exam.assertSealedPack(pack);
fs.writeFileSync(outputPath, JSON.stringify(pack, null, 2) + '\n', { flag: 'wx' });
process.stdout.write(JSON.stringify({ ok: true, packId: pack.packId, packDigest: pack.packDigest, records: pack.records.length, outputPath }, null, 2) + '\n');
