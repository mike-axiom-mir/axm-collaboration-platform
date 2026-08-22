#!/usr/bin/env node
'use strict';

const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

let sharp;
try { sharp = require('sharp'); }
catch (error) {
  console.error('The optional Sharp image package is required to rebuild Steam art drafts.');
  console.error('Use the Codex workspace dependency runtime or install Sharp in a development environment.');
  process.exit(2);
}

const ROOT = path.resolve(__dirname, '..', '..', '..');
const SOURCE = path.join(__dirname, 'assets', 'draft', 'source');
const OUTPUT = path.join(__dirname, 'assets', 'draft', 'candidate');
const WIDE = path.join(SOURCE, 'gamehub-key-art-wide-v1.png');
const VERTICAL = path.join(SOURCE, 'gamehub-key-art-vertical-v1.png');
const WORDMARK = path.join(SOURCE, 'gamehub-wordmark-draft.svg');
const MARK = path.join(ROOT, 'assets', 'local', 'launcher', 'logo.svg');

const ART_SPECS = [
  { file: 'store-header.png', width: 920, height: 430, source: WIDE, position: 'centre', logoWidth: 610, logoTop: 28 },
  { file: 'store-small.png', width: 462, height: 174, source: WIDE, position: 'centre', logoWidth: 330, logoTop: 15 },
  { file: 'store-main.png', width: 1232, height: 706, source: WIDE, position: 'centre', logoWidth: 760, logoTop: 42 },
  { file: 'store-vertical.png', width: 748, height: 896, source: VERTICAL, position: 'centre', logoWidth: 620, logoTop: 35 },
  { file: 'library-capsule.png', width: 600, height: 900, source: VERTICAL, position: 'centre', logoWidth: 510, logoTop: 42 },
  { file: 'library-header.png', width: 920, height: 430, source: WIDE, position: 'centre', logoWidth: 610, logoTop: 28 }
];
const OUTPUT_FILES = [
  'store-header.png', 'store-small.png', 'store-main.png', 'store-vertical.png',
  'shortcut-icon.png', 'app-icon.jpg', 'library-capsule.png',
  'library-hero.png', 'library-logo.png', 'library-header.png'
];

function darkTop(width, height) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#020713" stop-opacity=".82"/><stop offset=".42" stop-color="#020713" stop-opacity=".28"/><stop offset=".72" stop-color="#020713" stop-opacity="0"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`);
}

function iconBackground(size) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><defs><radialGradient id="r" cx="35%" cy="26%"><stop offset="0" stop-color="#173661"/><stop offset=".48" stop-color="#09162c"/><stop offset="1" stop-color="#020712"/></radialGradient><linearGradient id="l" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#46d7e7"/><stop offset="1" stop-color="#b18cff"/></linearGradient></defs><rect width="100%" height="100%" rx="${Math.round(size * .18)}" fill="url(#r)"/><rect x="${Math.round(size * .035)}" y="${Math.round(size * .035)}" width="${Math.round(size * .93)}" height="${Math.round(size * .93)}" rx="${Math.round(size * .15)}" fill="none" stroke="url(#l)" stroke-width="${Math.max(2, Math.round(size * .025))}" opacity=".75"/></svg>`);
}

async function wordmark(width) {
  return sharp(WORDMARK).resize({ width }).png().toBuffer();
}

async function buildArt(spec) {
  const logo = await wordmark(spec.logoWidth);
  const logoMeta = await sharp(logo).metadata();
  const left = Math.round((spec.width - logoMeta.width) / 2);
  await sharp(spec.source)
    .resize({ width: spec.width, height: spec.height, fit: 'cover', position: spec.position })
    .composite([
      { input: darkTop(spec.width, spec.height), left: 0, top: 0 },
      { input: logo, left, top: spec.logoTop }
    ])
    .png({ compressionLevel: 9 })
    .toFile(path.join(OUTPUT, spec.file));
}

async function buildIcon(file, size, jpeg) {
  const markSize = Math.round(size * .72);
  const mark = await sharp(MARK).resize({ width: markSize, height: markSize, fit: 'contain' }).png().toBuffer();
  const pipeline = sharp(iconBackground(size)).composite([{ input: mark, left: Math.round((size - markSize) / 2), top: Math.round((size - markSize) / 2) }]);
  if (jpeg) await pipeline.jpeg({ quality: 94, chromaSubsampling: '4:4:4' }).toFile(path.join(OUTPUT, file));
  else await pipeline.png({ compressionLevel: 9 }).toFile(path.join(OUTPUT, file));
}

async function main() {
  for (const required of [WIDE, VERTICAL, WORDMARK, MARK]) {
    if (!fs.existsSync(required)) throw new Error('missing Steam art input: ' + path.relative(ROOT, required));
  }
  fs.mkdirSync(OUTPUT, { recursive: true });
  for (const spec of ART_SPECS) await buildArt(spec);
  await sharp(WIDE).resize({ width: 3840, height: 1240, fit: 'cover', position: 'centre' }).png({ compressionLevel: 9 }).toFile(path.join(OUTPUT, 'library-hero.png'));
  await sharp(WORDMARK).resize({ width: 1280, height: 360, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png({ compressionLevel: 9 }).toFile(path.join(OUTPUT, 'library-logo.png'));
  await buildIcon('shortcut-icon.png', 256, false);
  await buildIcon('app-icon.jpg', 184, true);
  const assets = [];
  for (const name of OUTPUT_FILES) {
    const file = path.join(OUTPUT, name);
    const bytes = fs.readFileSync(file);
    const metadata = await sharp(bytes).metadata();
    assets.push({
      file: name,
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      has_alpha: metadata.hasAlpha === true,
      sha256: crypto.createHash('sha256').update(bytes).digest('hex')
    });
  }
  const manifest = {
    schema: 'axm.steam-art-draft/v1',
    status: 'TEST',
    created_at: '2026-08-16',
    product: 'AXM Local GameHub',
    human_approval: false,
    steam_upload_performed: false,
    generated_source_disclosure_required: true,
    sources: [
      'source/gamehub-key-art-wide-v1.png',
      'source/gamehub-key-art-vertical-v1.png',
      'source/gamehub-wordmark-draft.svg'
    ],
    assets
  };
  fs.writeFileSync(path.join(OUTPUT, 'candidate-manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  console.log(`Steam art drafts built: ${OUTPUT_FILES.length} files in ${path.relative(ROOT, OUTPUT)}`);
}

if (require.main === module) main().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});

module.exports = { ART_SPECS, OUTPUT, OUTPUT_FILES, SOURCE, buildArt, buildIcon, darkTop, iconBackground, main };
