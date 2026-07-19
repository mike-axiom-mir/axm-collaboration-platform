const PALETTES = Object.freeze({
  petrol: { body: '#1f756f', accent: '#e2a64a', sign: '#f0d8a8', sky: '#17293c' },
  rust: { body: '#963f32', accent: '#d09a48', sign: '#f0cab1', sky: '#2d2631' },
  cobalt: { body: '#315b9b', accent: '#e7b63c', sign: '#d8e8f4', sky: '#172641' },
  olive: { body: '#66713f', accent: '#c77f36', sign: '#e8d7b0', sky: '#293028' }
});

const VEHICLES = Object.freeze(['sedan', 'sedan-sports', 'hatchback-sports', 'suv', 'suv-luxury', 'taxi', 'van']);
const BUILDINGS = Object.freeze(['building-a', 'building-b', 'building-c', 'building-d', 'building-e', 'building-f', 'building-g', 'building-h']);
const PEOPLE = Object.freeze(['man-in-suit', 'man-casual-a', 'man-casual-b', 'man-long-sleeves']);

function hashSeed(value) {
  let hash = 2166136261;
  const text = String(value || 'axiom');
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function choose(items, seed, salt = 0) {
  return items[(hashSeed(`${seed}:${salt}`) % items.length + items.length) % items.length];
}

export function createRecipe(input = {}) {
  const seed = String(input.seed || 'tilburg-0405').trim().slice(0, 80) || 'tilburg-0405';
  const target = ['street', 'storefront', 'vehicle', 'pedestrian'].includes(input.target) ? input.target : 'street';
  const paletteId = PALETTES[input.palette] ? input.palette : 'petrol';
  const wear = Math.max(0, Math.min(100, Number(input.wear) || 0));
  const density = Math.max(1, Math.min(4, Math.round(Number(input.density) || 2)));
  return {
    schema: 'axm.ps2-asset-forge.recipe/v1',
    id: `forge-${hashSeed(`${seed}:${target}:${paletteId}:${wear}:${density}`).toString(16).padStart(8, '0')}`,
    seed,
    target,
    artFloor: 'PS2_2002_2006',
    paletteId,
    palette: PALETTES[paletteId],
    wear,
    density,
    selections: {
      vehicle: choose(VEHICLES, seed, 11),
      building: choose(BUILDINGS, seed, 23),
      pedestrian: choose(PEOPLE, seed, 37),
      awning: choose(['detail-awning', 'detail-awning-wide'], seed, 41),
      streetLight: choose(['light-curved', 'light-square', 'light-curved-double'], seed, 47)
    },
    outputs: ['glb', 'recipe-json', 'asset-fabric-handoff'],
    generators: {
      surface: 'axm.seeded-surface/v1',
      facade: 'axm.weathered-facade/v1',
      signage: 'axm.editable-canvas-sign/v1'
    },
    provenancePolicy: 'retain-every-source-digest',
    runtimeNetworkRequired: false,
    humanVisualApprovalRequired: true,
    retentionPolicy: {
      previewPersistence: 'memory-only-replaced-on-next-forge',
      automaticPromotion: false,
      exportRequiresHumanApproval: true
    }
  };
}

export function validateRecipe(recipe) {
  const failures = [];
  if (!recipe || recipe.schema !== 'axm.ps2-asset-forge.recipe/v1') failures.push('schema');
  if (!recipe || !['street', 'storefront', 'vehicle', 'pedestrian'].includes(recipe.target)) failures.push('target');
  if (!recipe || !PALETTES[recipe.paletteId]) failures.push('palette');
  if (!recipe || recipe.runtimeNetworkRequired !== false) failures.push('offline-runtime');
  if (!recipe || recipe.humanVisualApprovalRequired !== true) failures.push('human-visual-gate');
  return { ok: failures.length === 0, failures };
}

export function buildHandoff(recipe, usedSources = []) {
  const validation = validateRecipe(recipe);
  if (!validation.ok) throw new Error(`Invalid recipe: ${validation.failures.join(', ')}`);
  return {
    schema: 'axm.asset-fabric.need/v2',
    needId: `${recipe.id}-delivery`,
    status: 'candidate',
    targetCanvas: {
      medium: 'game-3d-asset',
      coordinateSystem: 'right-handed-y-up',
      artFloor: recipe.artFloor,
      intendedUse: recipe.target,
      runtime: ['three-webgl', 'gltf-2.0']
    },
    requiredOutputs: ['model/gltf-binary', 'application/json+axm-recipe', 'provenance-manifest'],
    editableRecipe: recipe,
    sourceAssets: usedSources,
    constraints: {
      runtimeNetworkRequired: false,
      licenseAllowlist: ['CC0-1.0', 'MIT'],
      publicReleaseRequiresHumanVisualApproval: true,
      generatedVariantsAreRetainedAutomatically: false
    }
  };
}

export const forgeConstants = { PALETTES, VEHICLES, BUILDINGS, PEOPLE };
