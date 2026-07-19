'use strict';

const fs = require('fs');
const path = require('path');
const Operations = require('../operations/operations-utils');

function targetPath(root, relative) {
  const base = path.resolve(root);
  const target = path.resolve(base, String(relative || '').replace(/\\/g, '/'));
  if (target !== base && !target.startsWith(base + path.sep)) throw new Error('Artifact path escapes pack root');
  return target;
}

function assertEmptyOrMissing(directory) {
  const output = path.resolve(directory);
  if (!fs.existsSync(output)) return output;
  if (!fs.statSync(output).isDirectory()) throw new Error('Pack output exists and is not a directory');
  if (fs.readdirSync(output).length) throw new Error('Pack output directory must be new or empty');
  return output;
}

function writePack(directory, buildResult, options) {
  if (!buildResult || !buildResult.manifest || !Array.isArray(buildResult.artifacts)) throw new Error('A completed game asset build is required');
  if (!['TECHNICAL_BASELINE_PASS','PS2_TECHNICAL_CANDIDATE_PASS'].includes(buildResult.report.status)) throw new Error('Held game asset builds cannot be written');
  const opts = Object.assign({ zip:false }, options || {}), output = assertEmptyOrMissing(directory);
  fs.mkdirSync(output, { recursive:true });
  let bytes = 0;
  for (const item of buildResult.artifacts) {
    const file = targetPath(output, item.path), body = item.text != null ? Buffer.from(item.text, 'utf8') : Buffer.from(item.data || []);
    fs.mkdirSync(path.dirname(file), { recursive:true });
    fs.writeFileSync(file, body, { flag:'wx' });
    bytes += body.length;
  }
  let archive = null;
  if (opts.zip) archive = Operations.zipDirectory(output, output + '.zip');
  return { schema:'axm.game-asset-pack-write-receipt/v1', output, files:buildResult.artifacts.length, bytes, archive, status:'WRITTEN_CANDIDATE_ONLY' };
}

module.exports = { targetPath, assertEmptyOrMissing, writePack };
