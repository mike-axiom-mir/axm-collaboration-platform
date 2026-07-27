export const BAKE_SCHEMA = 'axm.pbr-material-bake/v1';
export const TANGENT_CONVENTION = 'OpenGL tangent space; +Y green; texture V increases downward';

export const MATERIAL_FAMILIES = {
  brick: { label: 'Weathered brick', base: [156, 67, 43], accent: [105, 39, 29], scale: 1, normalStrength: 3.1 },
  asphalt: { label: 'Road asphalt', base: [48, 52, 54], accent: [81, 77, 65], scale: 1.35, normalStrength: 4.5 },
  'painted-metal': { label: 'Painted metal', base: [47, 104, 126], accent: [119, 136, 139], scale: .9, normalStrength: 2.7 },
  glass: { label: 'Architectural glass', base: [66, 113, 126], accent: [137, 184, 190], scale: .72, normalStrength: 1.7 },
  skin: { label: 'Character skin', base: [174, 116, 91], accent: [112, 68, 56], scale: 1.15, normalStrength: 2.2 },
  'vehicle-paint': { label: 'Metallic vehicle paint', base: [133, 26, 31], accent: [222, 91, 62], scale: .82, normalStrength: 2.5 }
};

function clamp(value, minimum = 0, maximum = 1) { return Math.max(minimum, Math.min(maximum, value)); }
function mix(a, b, amount) { return a + (b - a) * amount; }
function smooth(value) { return value * value * (3 - 2 * value); }
function seedNumber(seed) {
  let value = 2166136261;
  for (const character of String(seed)) value = Math.imul(value ^ character.charCodeAt(0), 16777619);
  return value >>> 0;
}
function hash2(x, y, seed) {
  let value = Math.imul((x | 0) ^ seed, 374761393) + Math.imul((y | 0) ^ (seed >>> 8), 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}
function valueNoise(x, y, seed) {
  const xi = Math.floor(x), yi = Math.floor(y), tx = smooth(x - xi), ty = smooth(y - yi);
  const a = mix(hash2(xi, yi, seed), hash2(xi + 1, yi, seed), tx);
  const b = mix(hash2(xi, yi + 1, seed), hash2(xi + 1, yi + 1, seed), tx);
  return mix(a, b, ty);
}
function fractal(x, y, seed, octaves = 4) {
  let sum = 0, weight = .55, scale = 1, total = 0;
  for (let octave = 0; octave < octaves; octave += 1) {
    sum += valueNoise(x * scale, y * scale, seed + octave * 977) * weight;
    total += weight; weight *= .52; scale *= 2.03;
  }
  return sum / total;
}
function colorMix(a, b, amount) { return a.map((value, index) => Math.round(mix(value, b[index], amount))); }

function sampleFamily(family, u, v, seed) {
  const noise = fractal(u * 8, v * 8, seed, 5);
  const micro = fractal(u * 43, v * 43, seed + 311, 3);
  if (family === 'brick') {
    const rows = 7, columns = 5;
    const row = Math.floor(v * rows), offset = row % 2 ? .5 : 0;
    const localU = ((u * columns + offset) % 1 + 1) % 1, localV = (v * rows) % 1;
    const mortarDistance = Math.min(localU, 1 - localU, localV, 1 - localV);
    const mortar = smooth(clamp((.075 - mortarDistance) / .055));
    const chip = hash2(Math.floor(u * 80), Math.floor(v * 80), seed + 901) > .92 ? .18 : 0;
    const brickColor = colorMix([177,74,45],[104,34,26], clamp(noise*.72+chip));
    const mortarColor = colorMix([105,101,91],[145,137,119], noise*.55);
    return { color: colorMix(brickColor,mortarColor,mortar), height: clamp(.66 - mortar*.54 + micro*.11-chip), ao: clamp(.9-mortar*.35-chip*.5), roughness: clamp(.66+noise*.19+mortar*.1), metallic: 0, emissive: [0,0,0] };
  }
  if (family === 'asphalt') {
    const aggregate = hash2(Math.floor(u*170),Math.floor(v*170),seed+701);
    const stone = aggregate > .88 ? (aggregate-.88)*3.8 : 0;
    return { color: colorMix([40,44,46],[91,83,66],clamp(noise*.3+stone*.7)), height: clamp(.35+micro*.25+stone*.42), ao: clamp(.82+noise*.12-stone*.08), roughness: clamp(.78+micro*.16-stone*.2), metallic: 0, emissive:[0,0,0] };
  }
  if (family === 'painted-metal') {
    const scratchWave = Math.abs(Math.sin((u*2.1+v)*92 + noise*4));
    const chip = hash2(Math.floor(u*120),Math.floor(v*120),seed+123) > .965 || scratchWave > .995;
    return { color: chip ? [118,124,124] : colorMix([35,91,116],[80,145,158],noise*.45), height: clamp(.56+micro*.055-(chip?.12:0)), ao: clamp(.94-micro*.08), roughness: chip?.42:clamp(.31+micro*.12), metallic: chip?1:.18, emissive:[0,0,0] };
  }
  if (family === 'glass') {
    const ripple = Math.sin((u*1.2+v*.75)*22+noise*2)*.5+.5;
    const dust = micro > .83 ? (micro-.83)*1.5 : 0;
    return { color: colorMix([47,91,108],[126,174,182],noise*.35+dust*.3), height: clamp(.5+(ripple-.5)*.075+dust*.07), ao: clamp(.97-dust*.18), roughness: clamp(.08+dust*.36+micro*.035), metallic:0, emissive:[1,2,2] };
  }
  if (family === 'skin') {
    const pore = hash2(Math.floor(u*150),Math.floor(v*150),seed+77);
    const poreDepth = pore > .86 ? (pore-.86)*1.7 : 0;
    const blush = valueNoise(u*3.2,v*3.2,seed+519);
    return { color: colorMix([162,101,80],[206,143,112],clamp(noise*.38+blush*.24)), height: clamp(.54+micro*.07-poreDepth*.16), ao: clamp(.94-poreDepth*.28), roughness: clamp(.48+micro*.15-poreDepth*.12), metallic:0, emissive:[0,0,0] };
  }
  const flake = hash2(Math.floor(u*190),Math.floor(v*190),seed+808);
  const bright = flake > .92 ? (flake-.92)*5 : 0;
  return { color: colorMix([112,18,25],[218,76,48],clamp(noise*.45+bright*.45)), height: clamp(.53+(micro-.5)*.06+bright*.035), ao:clamp(.96-micro*.05), roughness:clamp(.2+micro*.13-bright*.06), metallic:clamp(.68+bright*.25), emissive:[2,0,0] };
}

function setPixel(target, index, red, green, blue, alpha = 255) {
  target[index] = Math.round(clamp(red,0,255)); target[index+1] = Math.round(clamp(green,0,255)); target[index+2] = Math.round(clamp(blue,0,255)); target[index+3] = Math.round(clamp(alpha,0,255));
}

function sampleHeight(height, size, x, y) {
  const wrappedX = (x + size) % size, wrappedY = (y + size) % size;
  return height[wrappedY * size + wrappedX];
}

export function bakeMaterial(recipe = {}) {
  const family = MATERIAL_FAMILIES[recipe.family] ? recipe.family : 'brick';
  const profile = MATERIAL_FAMILIES[family];
  const size = Math.round(clamp(Number(recipe.size) || 128, 32, 512));
  const seed = seedNumber(recipe.seed || `${family}-01`);
  const strength = clamp(Number(recipe.normalStrength) || profile.normalStrength, .25, 8);
  const pixels = size * size, heightValues = new Float32Array(pixels), samples = new Array(pixels);
  for (let y=0;y<size;y+=1) for(let x=0;x<size;x+=1){
    const index=y*size+x, sample=sampleFamily(family,(x+.5)/size*profile.scale,(y+.5)/size*profile.scale,seed);
    samples[index]=sample;heightValues[index]=sample.height;
  }
  const maps={albedo:new Uint8ClampedArray(pixels*4),normal:new Uint8ClampedArray(pixels*4),orm:new Uint8ClampedArray(pixels*4),emissive:new Uint8ClampedArray(pixels*4),height:new Uint8ClampedArray(pixels*4)};
  for(let y=0;y<size;y+=1)for(let x=0;x<size;x+=1){
    const pixel=y*size+x,offset=pixel*4,sample=samples[pixel];
    const dx=(sampleHeight(heightValues,size,x+1,y)-sampleHeight(heightValues,size,x-1,y))*strength;
    const dy=(sampleHeight(heightValues,size,x,y+1)-sampleHeight(heightValues,size,x,y-1))*strength;
    const length=Math.hypot(dx,dy,1),nx=-dx/length,ny=-dy/length,nz=1/length;
    setPixel(maps.albedo,offset,...sample.color,255);
    setPixel(maps.normal,offset,(nx*.5+.5)*255,(ny*.5+.5)*255,(nz*.5+.5)*255,255);
    setPixel(maps.orm,offset,sample.ao*255,sample.roughness*255,sample.metallic*255,255);
    setPixel(maps.emissive,offset,...sample.emissive,255);
    const h=sample.height*255;setPixel(maps.height,offset,h,h,h,255);
  }
  return {schema:BAKE_SCHEMA,recipe:{family,label:profile.label,seed:String(recipe.seed||`${family}-01`),size,normalStrength:strength,tangentConvention:TANGENT_CONVENTION,packing:{orm:{red:'ambient-occlusion',green:'roughness',blue:'metalness'}}},maps};
}

export function renderMaterialBall(bake) {
  const {size}=bake.recipe, output=new Uint8ClampedArray(size*size*4),light=[-.45,.58,.68],view=[0,0,1];
  for(let y=0;y<size;y+=1)for(let x=0;x<size;x+=1){
    const offset=(y*size+x)*4,sx=(x+.5)/size*2-1,sy=1-(y+.5)/size*2,r2=sx*sx+sy*sy;
    if(r2>1){setPixel(output,offset,8,13,18,255);continue;}
    const sz=Math.sqrt(1-r2),normal=[sx,sy,sz];
    const albedo=[bake.maps.albedo[offset]/255,bake.maps.albedo[offset+1]/255,bake.maps.albedo[offset+2]/255];
    const ao=bake.maps.orm[offset]/255,rough=bake.maps.orm[offset+1]/255,metal=bake.maps.orm[offset+2]/255;
    const diffuse=Math.max(0,normal[0]*light[0]+normal[1]*light[1]+normal[2]*light[2]);
    const half=[light[0]+view[0],light[1]+view[1],light[2]+view[2]],halfLength=Math.hypot(...half),h=half.map(v=>v/halfLength);
    const spec=Math.pow(Math.max(0,normal[0]*h[0]+normal[1]*h[1]+normal[2]*h[2]),mix(96,5,rough))*(1-rough*.55);
    const edge=Math.pow(1-sz,4)*.3;
    const color=albedo.map((channel,index)=>clamp(channel*(.14*ao+diffuse*(1-metal*.55))+(mix(.04,channel,metal))*spec+edge+(bake.maps.emissive[offset+index]/255)));
    setPixel(output,offset,color[0]*255,color[1]*255,color[2]*255,255);
  }
  return output;
}
