'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const ASSET_ROOT = path.join(ROOT, 'assets');
const GENERATED_ROOT = path.join(ROOT, 'generated');

const PACKS = [
  {
    id: 'kenney-retro-urban',
    provider: 'Kenney',
    title: 'Retro Urban Kit',
    license: 'CC0-1.0',
    root: 'kenney/retro-urban',
    sourcePage: 'https://kenney.nl/assets/retro-urban-kit',
    sourceArchive: 'https://kenney.nl/media/pages/assets/retro-urban-kit/8314d4db22-1738147509/kenney_retro-urban-kit.zip'
  },
  {
    id: 'kenney-city-commercial',
    provider: 'Kenney',
    title: 'City Kit Commercial',
    license: 'CC0-1.0',
    root: 'kenney/city-commercial',
    sourcePage: 'https://kenney.nl/assets/city-kit-commercial',
    sourceArchive: 'https://kenney.nl/media/pages/assets/city-kit-commercial/a742d900eb-1753115042/kenney_city-kit-commercial_2.1.zip'
  },
  {
    id: 'kenney-city-roads',
    provider: 'Kenney',
    title: 'City Kit Roads',
    license: 'CC0-1.0',
    root: 'kenney/city-roads',
    sourcePage: 'https://kenney.nl/assets/city-kit-roads',
    sourceArchive: 'https://kenney.nl/media/pages/assets/city-kit-roads/74288c9459-1741864740/kenney_city-kit-roads.zip'
  },
  {
    id: 'kenney-car-kit',
    provider: 'Kenney',
    title: 'Car Kit',
    license: 'CC0-1.0',
    root: 'kenney/car-kit',
    sourcePage: 'https://kenney.nl/assets/car-kit',
    sourceArchive: 'https://kenney.nl/media/pages/assets/car-kit/1a312ec241-1775131960/kenney_car-kit.zip'
  },
  {
    id: 'quaternius-animated-men',
    provider: 'Quaternius',
    title: 'Animated Men Pack',
    license: 'CC0-1.0',
    root: 'quaternius/animated-men',
    sourcePage: 'https://poly.pizza/bundle/Animated-Men-Pack-DAC9SDgMQT',
    sourceArchive: null
  }
];

function sha256(file) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(file));
  return `sha256:${hash.digest('hex')}`;
}

function listFiles(root, extension) {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(extension))
    .map((entry) => path.join(root, entry.name))
    .sort((a, b) => a.localeCompare(b));
}

function parseGlb(file) {
  const data = fs.readFileSync(file);
  if (data.length < 20 || data.toString('ascii', 0, 4) !== 'glTF') {
    throw new Error(`Not a GLB file: ${file}`);
  }
  const version = data.readUInt32LE(4);
  const declaredLength = data.readUInt32LE(8);
  const jsonLength = data.readUInt32LE(12);
  const jsonType = data.readUInt32LE(16);
  if (version !== 2 || declaredLength !== data.length || jsonType !== 0x4E4F534A) {
    throw new Error(`Unsupported or malformed GLB: ${file}`);
  }
  const document = JSON.parse(data.toString('utf8', 20, 20 + jsonLength).trim());
  let triangles = 0;
  for (const mesh of document.meshes || []) {
    for (const primitive of mesh.primitives || []) {
      const accessorIndex = Number.isInteger(primitive.indices)
        ? primitive.indices
        : primitive.attributes && primitive.attributes.POSITION;
      const count = Number.isInteger(accessorIndex) && document.accessors && document.accessors[accessorIndex]
        ? document.accessors[accessorIndex].count || 0
        : 0;
      const mode = primitive.mode === undefined ? 4 : primitive.mode;
      if (mode === 4) triangles += Math.floor(count / 3);
      if (mode === 5 || mode === 6) triangles += Math.max(0, count - 2);
    }
  }
  return {
    version,
    meshes: (document.meshes || []).length,
    nodes: (document.nodes || []).length,
    materials: (document.materials || []).length,
    textures: (document.textures || []).length,
    animations: (document.animations || []).length,
    skins: (document.skins || []).length,
    triangles
  };
}

function inferKind(packId, name) {
  if (packId === 'quaternius-animated-men') return 'pedestrian';
  if (packId === 'kenney-car-kit') {
    if (/^(sedan|suv|taxi|van|police|ambulance|delivery|firetruck|garbage|truck|tractor|race|hatchback|kart)/.test(name)) return 'vehicle';
    if (/^debris/.test(name)) return 'damage-part';
    return 'vehicle-part';
  }
  if (packId === 'kenney-city-roads') {
    if (/^road|^tile|^bridge/.test(name)) return 'road';
    if (/^light/.test(name)) return 'street-light';
    return 'road-prop';
  }
  if (packId === 'kenney-city-commercial') {
    if (/^building/.test(name)) return 'building';
    if (/^low-detail-building/.test(name)) return 'building-lod';
    return 'storefront-part';
  }
  if (packId === 'kenney-retro-urban') {
    if (/^wall|^window|^door|^roof|^balcony/.test(name)) return 'building-part';
    if (/^road/.test(name)) return 'road';
    if (/^truck/.test(name)) return 'vehicle';
    if (/^tree|^grass/.test(name)) return 'foliage';
    return 'urban-prop';
  }
  return 'uncategorized-source';
}

function previewFor(packRoot, name) {
  for (const extension of ['.png', '.webp', '.jpg']) {
    const candidate = path.join(packRoot, 'previews', `${name}${extension}`);
    if (fs.existsSync(candidate)) return path.relative(ROOT, candidate).split(path.sep).join('/');
  }
  return null;
}

function build() {
  const assets = [];
  const sourceFiles = [];
  for (const pack of PACKS) {
    const packRoot = path.join(ASSET_ROOT, pack.root);
    const models = listFiles(path.join(packRoot, 'models'), '.glb');
    for (const file of models) {
      const name = path.basename(file, '.glb');
      const relativePath = path.relative(ROOT, file).split(path.sep).join('/');
      const stat = fs.statSync(file);
      const digest = sha256(file);
      const glb = parseGlb(file);
      assets.push({
        id: `${pack.id}:${name}`,
        packId: pack.id,
        provider: pack.provider,
        title: name.split('-').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
        name,
        kind: inferKind(pack.id, name),
        license: pack.license,
        model: relativePath,
        preview: previewFor(packRoot, name),
        bytes: stat.size,
        sha256: digest,
        glb
      });
      sourceFiles.push({ path: relativePath, bytes: stat.size, sha256: digest });
    }
  }

  assets.sort((a, b) => a.id.localeCompare(b.id));
  const kinds = {};
  const totals = { assets: assets.length, triangles: 0, animations: 0, materials: 0, texturedAssets: 0, animatedAssets: 0 };
  for (const asset of assets) {
    kinds[asset.kind] = (kinds[asset.kind] || 0) + 1;
    totals.triangles += asset.glb.triangles;
    totals.animations += asset.glb.animations;
    totals.materials += asset.glb.materials;
    if (asset.glb.textures > 0) totals.texturedAssets += 1;
    if (asset.glb.animations > 0) totals.animatedAssets += 1;
  }

  const catalog = {
    schema: 'axm.ps2-asset-forge.catalog/v1',
    generatedAt: new Date().toISOString(),
    policy: {
      runtimeNetworkRequired: false,
      automaticExternalGeneration: false,
      candidateAuthority: 'human-visual-approval-required',
      licenseAllowlist: ['CC0-1.0']
    },
    totals,
    kinds,
    packs: PACKS.map(({ root, ...pack }) => ({ ...pack, localRoot: `assets/${root}` })),
    assets
  };
  const manifest = {
    schema: 'axm.ps2-asset-forge.source-manifest/v1',
    generatedAt: catalog.generatedAt,
    runtimeNetworkRequired: false,
    packs: catalog.packs,
    files: sourceFiles
  };

  fs.mkdirSync(GENERATED_ROOT, { recursive: true });
  fs.writeFileSync(path.join(GENERATED_ROOT, 'source-catalog.json'), `${JSON.stringify(catalog, null, 2)}\n`);
  fs.writeFileSync(path.join(GENERATED_ROOT, 'source-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return catalog;
}

if (require.main === module) {
  const catalog = build();
  process.stdout.write(`${JSON.stringify({ ok: true, totals: catalog.totals, kinds: catalog.kinds }, null, 2)}\n`);
}

module.exports = { PACKS, build, inferKind, parseGlb };
