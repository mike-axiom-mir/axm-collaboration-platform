'use strict';

const source = document.querySelector('#source');
const output = document.querySelector('#output');
const commands = document.querySelector('#commands');
const message = document.querySelector('#message');
const returnTemplate = {
  schema: 'axm.branch-module-return/v1',
  module: { id: 'replace-with-portable-module-id', version: 'v0.1', title: 'Replace with portable module title', summary: 'One bounded capability extracted from a specialized branch.' },
  source: { project: 'replace-with-source-project', repository: null, branch: 'replace-with-source-branch', commit: null },
  selection: { files: ['axm-branch-return.json', 'manifest.json', 'module.contract.json', 'index.html', 'selftest.js'] },
  portability: {
    target: 'axm-workshop-dependency-free', branchRuntimeRequired: false, networkRequired: false, packageManagerRequired: false, hostCommandsRequired: false,
    externalPackages: [], remoteServices: [], nativeComponents: [], hostCommands: [], absolutePaths: [], workshopCapabilities: [], permissions: []
  },
  verification: { selftest: 'selftest.js' },
  requiredSeats: 'dual'
};

function quote(value) { return '"' + String(value).replace(/"/g, '\\"') + '"'; }
function render() {
  const sourceValue = quote(source.value.trim());
  const outputValue = quote(output.value.trim());
  commands.textContent = [
    'node intake-cli.js inspect --source ' + sourceValue,
    'node intake-cli.js pack --source ' + sourceValue + ' --out ' + outputValue,
    'node intake-cli.js verify --package ' + outputValue + ' --receipt ' + quote(output.value.trim() + '.receipt.json')
  ].join('\n');
}
async function copy(text, label) {
  await navigator.clipboard.writeText(text);
  message.textContent = label;
  window.setTimeout(() => { message.textContent = ''; }, 2400);
}
source.addEventListener('input', render);
output.addEventListener('input', render);
document.querySelector('#copy').addEventListener('click', () => copy(commands.textContent, 'Commands copied.'));
document.querySelector('#template').addEventListener('click', () => copy(JSON.stringify(returnTemplate, null, 2) + '\n', 'Return-contract template copied.'));
render();
