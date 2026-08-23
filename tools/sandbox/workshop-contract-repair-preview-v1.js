'use strict';

const fs = require('fs');
const path = require('path');
const Planner = require('../../shared/code-capability-fabric/workshop-contract-repair-planner-v1');
const Shadow = require('./workshop-contract-repair-sandbox-v1');

function parse(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index], value = argv[index + 1];
    if (!['--source-root', '--session-id', '--tool-id', '--evaluated-at', '--source-label'].includes(key) || value == null) throw new Error('usage: --source-root <absolute> --session-id <portable-id> --tool-id <portable-id> [--evaluated-at <ISO>] [--source-label <label>]');
    options[key.slice(2)] = value;
  }
  if (!options['source-root'] || !options['session-id'] || !options['tool-id']) throw new Error('--source-root, --session-id, and --tool-id are required');
  if (!/^[a-z0-9][a-z0-9._-]{1,127}$/.test(options['session-id']) || !/^[a-z0-9][a-z0-9._-]{1,127}$/.test(options['tool-id'])) throw new Error('session-id and tool-id must be portable ids');
  return options;
}

(async () => {
  const options = parse(process.argv.slice(2)), parentRoot = Shadow.CONTRACT_REPAIR_STATE_ROOT, sessionRoot = path.join(parentRoot, options['session-id']);
  let prior = null;
  if (fs.existsSync(sessionRoot)) prior = JSON.parse(fs.readFileSync(path.join(sessionRoot, 'source', 'iteration-000.observation.json'), 'utf8'));
  const evaluatedAt = options['evaluated-at'] || (prior && prior.evaluatedAt) || new Date().toISOString();
  const sourceLabel = options['source-label'] || (prior && prior.sourceLabel) || 'current-workshop';
  const toolId = prior ? prior.target.toolId : options['tool-id'];
  if (toolId !== options['tool-id']) throw new Error('existing session target differs from --tool-id');
  const request = Planner.buildExampleRequest(evaluatedAt, sourceLabel, toolId);
  let session;
  if (fs.existsSync(sessionRoot)) {
    session = Shadow.resumeSession({ sourceRoot: options['source-root'], parentRoot, sessionId: options['session-id'], request });
    const refresh = Shadow.refreshSession(session);
    if (refresh.status === 'CURRENT_NO_DRAFT' || refresh.status === 'HOLD') { process.stdout.write('CONTRACT_REPAIR_' + refresh.status + ' ' + refresh.prepared.plan.finding + '\n'); return; }
    session = refresh.session; process.stdout.write('CONTRACT_REPAIR_REFRESH ' + refresh.status + '\n');
  } else {
    const prepared = Shadow.prepare({ sourceRoot: options['source-root'], request });
    if (prepared.plan.status !== 'DRAFT_ALTERNATIVES_PLANNED') { process.stdout.write('CONTRACT_REPAIR_' + prepared.plan.status + ' ' + prepared.plan.finding + '\n'); return; }
    session = Shadow.createSession({ parentRoot, sessionId: options['session-id'], prepared }); process.stdout.write('CONTRACT_REPAIR_CREATED ' + session.latest.id + '\n');
  }
  const preview = await Shadow.startPreview(session);
  process.stdout.write('CONTRACT_REPAIR_PREVIEW ' + preview.url + '\n');
  process.stdout.write('selectedAlternative=null candidateExecuted=false testsExecuted=false installed=false authority=NONE\n');
  const close = async () => { await preview.close(); process.exit(0); };
  process.once('SIGINT', close); process.once('SIGTERM', close);
})().catch((error) => { process.stderr.write('CONTRACT_REPAIR_ERROR ' + error.message + '\n'); process.exitCode = 1; });
