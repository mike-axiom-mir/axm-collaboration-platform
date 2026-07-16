'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const testFiles = fs.readdirSync(path.join(ROOT, 'tests')).filter(file => file.endsWith('.test.js')).map(file => path.join('tests', file));
const testRun = spawnSync(process.execPath, ['--test'].concat(testFiles), { cwd: ROOT, shell: false, encoding: 'utf8' });
const tests = String(testRun.stdout || testRun.stderr || `test process exited ${testRun.status}`).trim();
const report = `# Mirror Seed-0 Action Report\n\nGenerated: ${new Date().toISOString()}\n\n## Honest body state\n\n- Deterministic principle-cell kernel: present\n- Typed evidence and contradiction traces: present\n- Learned weights: absent\n- Language/world/vision/tool organs: absent\n- External network authority: absent\n- Canon authority: absent\n\n## Verification output\n\n\`\`\`text\n${tests}\n\`\`\`\n`;
const out = path.join(ROOT, 'exports', 'action-reports', 'ACTION_REPORT_SEED_0.md');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, report, 'utf8');
console.log(out);
