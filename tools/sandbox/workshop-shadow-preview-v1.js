'use strict';

const fs = require('fs');
const path = require('path');
const Planner = require('../../shared/code-capability-fabric/workshop-shadow-improvement-planner-v1');
const Shadow = require('./workshop-shadow-sandbox-v1');

function parse(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index], value = argv[index + 1];
    if (!['--source-root', '--session-id', '--evaluated-at', '--source-label'].includes(key) || value == null) throw new Error('usage: --source-root <absolute> --session-id <portable-id> [--evaluated-at <ISO>] [--source-label <label>]');
    options[key.slice(2)] = value;
  }
  if (!options['source-root'] || !options['session-id']) throw new Error('--source-root and --session-id are required');
  if (!/^[a-z0-9][a-z0-9._-]{1,127}$/.test(options['session-id'])) throw new Error('--session-id must be a portable id');
  return options;
}

(async () => {
  const options = parse(process.argv.slice(2));
  const parentRoot = Shadow.SHADOW_STATE_ROOT;
  const sessionRoot = path.join(parentRoot, options['session-id']);
  let prior = null;
  if (fs.existsSync(sessionRoot)) prior = JSON.parse(fs.readFileSync(path.join(sessionRoot, 'source', 'iteration-000.snapshot.json'), 'utf8'));
  const evaluatedAt = options['evaluated-at'] || (prior && prior.evaluatedAt) || new Date().toISOString();
  const sourceLabel = options['source-label'] || (prior && prior.sourceLabel) || 'current-workshop';
  const request = Planner.buildExampleRequest(evaluatedAt, sourceLabel);
  let session;
  if (fs.existsSync(sessionRoot)) {
    session = Shadow.resumeSession({ sourceRoot: options['source-root'], parentRoot, sessionId: options['session-id'], request });
    const refresh = Shadow.refreshSession(session);
    session = refresh.session;
    process.stdout.write('SHADOW_REFRESH ' + refresh.status + '\n');
  } else {
    const prepared = Shadow.prepare({ sourceRoot: options['source-root'], request });
    if (prepared.plan.status !== 'DRAFT_PLANNED') {
      process.stdout.write('SHADOW_CURRENT_NO_DRAFT ' + prepared.snapshot.sourceStateDigest + '\n');
      return;
    }
    session = Shadow.createSession({ parentRoot, sessionId: options['session-id'], prepared });
    process.stdout.write('SHADOW_CREATED ' + session.latest.id + '\n');
  }
  const preview = await Shadow.startPreview(session);
  process.stdout.write('SHADOW_PREVIEW ' + preview.url + '\n');
  process.stdout.write('candidateExecuted=false installed=false authority=NONE\n');
  const close = async () => { await preview.close(); process.exit(0); };
  process.once('SIGINT', close); process.once('SIGTERM', close);
})().catch((error) => { process.stderr.write('SHADOW_ERROR ' + error.message + '\n'); process.exitCode = 1; });
