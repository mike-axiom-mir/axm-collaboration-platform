'use strict';

const fs = require('node:fs');
const path = require('node:path');
const Blocks = require('../../shared/procedural-animation-blocks/index.js');

const colors = {
  juice: '255, 116, 134', camera: '138, 116, 255', locomotion: '68, 215, 202', 'directed-morph': '255, 184, 92'
};

function buildPack() {
  return {
    schema: 'axm.shapeable.block-pack', schemaVersion: 1, id: 'axm-procedural-animation',
    name: 'AXM Procedural Animation Blocks', version: '0.1.0',
    source: 'Local Opus generation for Mike Tobi / AXM, admitted through governed Workshop intake',
    testStatus: 'TESTED: deterministic block output and animation-spine compatibility; human motion review remains required',
    licenseStatus: 'AXM LOCAL / PROJECT-OWNED',
    blocks: Blocks.list().map((item) => ({
      layer: 'visual', type: `axm-anim--${item.id}`, label: item.label,
      subtitle: `${item.family} · ${item.duration_ms} ms${item.loop ? ' · loop' : ''}`,
      group: `Motion blocks · ${item.family}`, icon: 'effect', rgb: colors[item.family],
      description: `A deterministic ${item.label.toLowerCase()} candidate. It describes motion without silently applying it to a runtime or approving its appearance.`,
      input: true, output: true, targets: ['game', 'dashboard', 'website', 'custom'], permission: null, influenceModule: null,
      defaults: { motionBlock: item.id, durationMs: item.duration_ms, notes: '' },
      fields: [
        { key: 'motionBlock', label: 'Motion block', type: 'select', options: [item.id] },
        { key: 'durationMs', label: 'Duration (ms)', type: 'number', min: 50, max: 10000 },
        { key: 'notes', label: 'Target notes', type: 'textarea' }
      ]
    }))
  };
}

if (require.main === module) {
  fs.writeFileSync(path.join(__dirname, 'shapeable-block-pack.json'), JSON.stringify(buildPack(), null, 2) + '\n');
  console.log('Animation Shapeable pack written.');
}

module.exports = { buildPack };
