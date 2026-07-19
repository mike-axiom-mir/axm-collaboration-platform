'use strict';

const PROFILE_SCHEMA = 'axm.game-art-direction-profile/v1';

const PROFILES = Object.freeze({
  'urban-2004-original': Object.freeze({
    schema: PROFILE_SCHEMA,
    id: 'urban-2004-original',
    title: 'Original 2004 Urban Action',
    eraTarget: '2002-2006 console and PC visual baseline',
    detailTier: 'generation-2004',
    claimBoundary: 'Original technical and visual production profile inspired only by broad 2002-2006 hardware-era constraints; no copied commercial art, map, character, vehicle, brand, texture, or protected style.',
    units: 'metres',
    upAxis: 'y',
    handedness: 'right',
    gridMetres: 4,
    textureAtlas: { width: 1024, height: 1024, tilesAcross: 8, colourSpace: 'sRGB' },
    lodDistancesMetres: [0, 55, 120],
    budgets: {
      building: { triangles: [6000, 1800, 280], texture: 512 },
      road: { triangles: [1800, 520, 80], texture: 512 },
      prop: { triangles: [1800, 480, 80], texture: 256 },
      vehicle: { triangles: [3200, 1100, 240], texture: 512 },
      character: { triangles: [2200, 750, 160], texture: 512 }
    },
    visualTriangleFloor: { building: 800, road: 180, prop: 120, vehicle: 650, character: 450 },
    palette: {
      concrete: '#8f918d', brick: '#9d5c4e', glass: '#47758d', metal: '#707983', asphalt: '#292e35', lane: '#e2d5a0', grass: '#597548', bark: '#61462f',
      roof: '#514d58', vehicle: '#b83d39', tire: '#171a1e', skin: '#bd896c', cloth: '#354f72', trim: '#c8baa0', emissive: '#ffd26d', sign: '#35728d',
      'window-lit': '#d9b86b', 'window-dark': '#29485d', stone: '#aaa392', stucco: '#c2ad91', wood: '#705039', chrome: '#aeb9c0', headlight: '#f3e9bd', taillight: '#b72f32',
      pavement: '#7b7e7b', dirt: '#78634b', 'foliage-dark': '#354f36', denim: '#385b7b', leather: '#4b362b', 'concrete-dark': '#626965', 'brick-light': '#b77760', 'roof-tile': '#754840'
    },
    families: {
      buildings: ['apartment-midrise', 'corner-shop', 'warehouse', 'row-houses', 'hotel-tower'],
      roads: ['road-straight', 'road-corner', 'road-cross', 'sidewalk-plaza', 'service-alley'],
      props: ['streetlamp', 'bench', 'street-bin', 'hydrant', 'barrier', 'street-tree', 'traffic-light', 'phone-booth'],
      vehicles: ['sedan', 'taxi', 'van', 'patrol-car', 'sports-coupe'],
      characters: ['civilian-a', 'civilian-b', 'civilian-c', 'civilian-d']
    },
    styleRules: [
      'recognizable authored silhouette at contact-sheet distance',
      'facade depth through frames sills awnings balconies doors vents and roof furniture',
      'vehicles require wheels hubs glazing lamps mirrors plates and differentiated body profiles',
      'characters require articulated human proportions head hair hands shoes and outfit separation',
      'one shared atlas vocabulary with era-appropriate baked surface detail',
      'three monotonic LODs for every visible asset with a non-trivial LOD0 geometry floor',
      'separate visual collision navigation animation and scene-presentation artifacts',
      'brand-free original signage colours and vehicle designs'
    ]
  }),
  'urban-2001-low-poly': Object.freeze({
    schema: PROFILE_SCHEMA,
    id: 'urban-2001-low-poly',
    title: 'Early 3D Urban Action',
    claimBoundary: 'Technical low-poly production profile; not a copy of any commercial game, art direction, characters, brands, map, or textures.',
    units: 'metres',
    upAxis: 'y',
    handedness: 'right',
    gridMetres: 4,
    textureAtlas: { width: 512, height: 512, tilesAcross: 4, colourSpace: 'sRGB' },
    lodDistancesMetres: [0, 45, 100],
    budgets: {
      building: { triangles: [1800, 760, 180], texture: 256 },
      road: { triangles: [420, 180, 40], texture: 256 },
      prop: { triangles: [420, 180, 48], texture: 128 },
      vehicle: { triangles: [1100, 520, 140], texture: 256 },
      character: { triangles: [700, 360, 120], texture: 256 }
    },
    palette: {
      concrete: '#8d8a80', brick: '#955d4e', glass: '#66889a', metal: '#717880',
      asphalt: '#30343a', lane: '#d9cf9f', grass: '#63784e', bark: '#6d4f35',
      roof: '#5d5960', vehicle: '#b94746', tire: '#202226', skin: '#b98468',
      cloth: '#445b78', trim: '#c4b69a', emissive: '#e6b85c', sign: '#4c7690'
    },
    families: {
      buildings: ['apartment-midrise', 'corner-shop', 'warehouse', 'row-houses'],
      roads: ['road-straight', 'road-corner', 'road-cross', 'sidewalk-plaza'],
      props: ['streetlamp', 'bench', 'street-bin', 'hydrant', 'barrier', 'street-tree'],
      vehicles: ['sedan', 'taxi', 'van', 'patrol-car'],
      characters: ['civilian-a', 'civilian-b']
    },
    styleRules: [
      'large readable silhouettes before surface detail',
      'one shared atlas vocabulary across every family',
      'meter-scale proportions and four-metre modular alignment',
      'three monotonic LODs for every visible asset',
      'separate visual, collision, navigation and animation artifacts',
      'brand-free generated signage and colours'
    ]
  })
});

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function get(id) {
  const profile = PROFILES[String(id || 'urban-2004-original')];
  if (!profile) throw new Error('Unknown game art-direction profile');
  return clone(profile);
}
function list() { return Object.keys(PROFILES).map(get); }

module.exports = { PROFILE_SCHEMA, get, list };
