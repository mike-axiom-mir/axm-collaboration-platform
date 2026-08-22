#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

let sharp;
try { sharp = require('sharp'); }
catch (error) {
  console.error('The optional Sharp image package is required to rebuild Steam screenshot drafts.');
  console.error('Use the Codex workspace dependency runtime or install Sharp in a development environment.');
  process.exit(2);
}

const ROOT = path.resolve(__dirname, '..', '..', '..');
const RAW = path.join(__dirname, 'assets', 'draft', 'captures', 'raw');
const OUTPUT = path.join(__dirname, 'assets', 'draft', 'candidate', 'screenshots');

const CAPTURES = [
  {
    file: '01-axm-pong-duet-gameplay.jpg',
    game_id: '002-robo-pong',
    game: 'AXM Pong Duet',
    runtime_url: 'http://127.0.0.1:8792/',
    observed_interaction: 'Started a story-coop match, passed the countdown, and observed the active Chapter 02 arena.'
  },
  {
    file: '02-district-party-gameplay.jpg',
    game_id: '008-district-party',
    game: 'District Party',
    runtime_url: 'http://127.0.0.1:8798/party-screen.html?party=party_a',
    observed_interaction: 'Started a local city session and observed the live Party House mission-board play screen.'
  },
  {
    file: '03-living-globe-tycoon-gameplay.jpg',
    game_id: '010-living-globe-tycoon',
    game: 'Living Globe Tycoon · Island Steward',
    runtime_url: 'http://127.0.0.1:8800/',
    observed_interaction: 'Continued the living world and opened the interactive Palace of Stewardship while the simulation advanced.'
  },
  {
    file: '04-bonk-and-bolt-gameplay.jpg',
    game_id: '014-bonk-and-bolt',
    game: 'Bonk & Bolt: The 24th Hour',
    runtime_url: 'http://127.0.0.1:8814/',
    observed_interaction: 'Created a Human Panzer solo adventure and observed active 3D play in Kettlewick.'
  },
  {
    file: '05-hexbound-rooftops-gameplay.jpg',
    game_id: '016-hexbound-rooftops',
    game: 'HEXBOUND: Rooftops of Neverafter',
    runtime_url: 'http://127.0.0.1:8816/',
    observed_interaction: 'Opened a live skirmish and observed the running battlefield, active Chronogust anomaly, and committed rival scheme.'
  }
];

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

async function main() {
  fs.mkdirSync(OUTPUT, { recursive: true });
  const screenshots = [];
  for (const capture of CAPTURES) {
    const source = path.join(RAW, capture.file);
    if (!fs.existsSync(source)) throw new Error('missing live gameplay capture: ' + path.relative(ROOT, source));
    const sourceBytes = fs.readFileSync(source);
    const sourceMetadata = await sharp(sourceBytes).metadata();
    if (sourceMetadata.width * 9 !== sourceMetadata.height * 16) {
      throw new Error(capture.file + ' is not an exact 16:9 live capture');
    }
    const output = path.join(OUTPUT, capture.file);
    await sharp(sourceBytes)
      .resize({ width: 1920, height: 1080, fit: 'fill', kernel: sharp.kernel.lanczos3 })
      .jpeg({ quality: 94, chromaSubsampling: '4:4:4', mozjpeg: true })
      .toFile(output);
    const outputBytes = fs.readFileSync(output);
    const outputMetadata = await sharp(outputBytes).metadata();
    screenshots.push({
      file: capture.file,
      game_id: capture.game_id,
      game: capture.game,
      runtime_url: capture.runtime_url,
      observed_interaction: capture.observed_interaction,
      captured_on: '2026-08-16',
      capture_method: 'Codex in-app browser live runtime screenshot',
      generated_image: false,
      source: {
        file: path.relative(path.join(__dirname, 'assets', 'draft'), source).replaceAll('\\', '/'),
        width: sourceMetadata.width,
        height: sourceMetadata.height,
        sha256: sha256(sourceBytes)
      },
      candidate: {
        width: outputMetadata.width,
        height: outputMetadata.height,
        format: outputMetadata.format,
        sha256: sha256(outputBytes)
      }
    });
  }
  const manifest = {
    schema: 'axm.steam-gameplay-screenshot-draft/v1',
    status: 'TEST',
    product: 'AXM Local GameHub',
    captured_on: '2026-08-16',
    human_approval: false,
    steam_upload_performed: false,
    source_frames_are_live_gameplay: true,
    only_deterministic_resize_applied: true,
    content_editing_performed: false,
    screenshots
  };
  fs.writeFileSync(path.join(OUTPUT, 'screenshot-manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  console.log(`Steam gameplay screenshot drafts built: ${screenshots.length} live frames in ${path.relative(ROOT, OUTPUT)}`);
}

if (require.main === module) main().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});

module.exports = { CAPTURES, OUTPUT, RAW, main, sha256 };
