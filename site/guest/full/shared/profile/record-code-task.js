#!/usr/bin/env node
'use strict';

const DEFAULT_ORIGIN = 'http://127.0.0.1:8788';

function parse(argv) {
  const out = { files: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const name = token.slice(2);
    const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
    if (name === 'file') out.files.push(value);
    else out[name] = value;
  }
  return out;
}

function required(value, label) {
  const clean = String(value == null ? '' : value).trim();
  if (!clean) throw new Error(`${label} is required`);
  return clean;
}

async function json(url, options) {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `profile HTTP ${response.status}`);
  return body;
}

async function main() {
  const args = parse(process.argv.slice(2));
  const actor = required(args.actor, '--actor');
  const mood = required(args.mood, '--mood');
  const task = required(args.task, '--task');
  const count = Math.floor(Number(args.count));
  if (!Number.isFinite(count) || count < 1) throw new Error('--count must be an exact positive character count');
  if (!['infrastructure', 'entertainment', 'software'].includes(mood)) throw new Error('--mood must be infrastructure, entertainment, or software');
  const evidence = required(args.evidence || (args.files.length ? `Reviewed task files: ${args.files.join(', ')}` : ''), '--evidence or --file');
  const origin = String(args.origin || DEFAULT_ORIGIN).replace(/\/$/, '');
  const current = await json(`${origin}/api/profile`, { cache: 'no-store' });
  if (!current.profile || !current.profile.enabled) {
    console.log('AXM profile is paused; code task receipt was not recorded.');
    return;
  }
  if (!(current.profile.members || []).some(member => member.id === actor)) throw new Error(`unknown profile member: ${actor}`);
  const body = {
    type: 'code-characters',
    codeMood: mood,
    count,
    dedupeKey: `code-task:${actor}:${task}`,
    participants: [actor],
    actorId: actor,
    evidence,
    source: String(args.source || 'AXM code task receipt'),
    meta: { codeMood: mood, taskId: task, files: args.files.slice(0, 100) }
  };
  const result = await json(`${origin}/api/profile/event`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-axm-profile-event': 'signed-local-receipt' },
    body: JSON.stringify(body)
  });
  console.log(result.duplicate
    ? `Code task ${task} was already counted for ${actor}.`
    : `Counted ${count.toLocaleString()} ${mood} code characters for ${actor}.`);
}

main().catch(error => {
  console.error(`AXM code receipt failed: ${error.message}`);
  process.exitCode = 1;
});
