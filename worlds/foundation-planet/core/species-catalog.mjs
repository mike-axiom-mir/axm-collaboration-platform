export const SPECIES_CATALOG_SCHEMA = 'axm.foundation-planet.species-catalog/v1';
export const SPECIES_CATALOG_VERSION = '0.2.0';

const allLand = ['coast','desert','savanna','grassland','temperate_forest','rainforest','taiga','tundra','alpine','ice'];
const allWater = ['coast','ocean','deep_ocean'];

function entry(id, commonName, layer, trophicRole, biomes, options = {}) {
  return Object.freeze({
    id, commonName, layer, trophicRole, biomes: Object.freeze(biomes),
    realms: Object.freeze(options.realms || ['terrestrial']),
    temperatureC: Object.freeze(options.temperatureC || [-18, 34]),
    moisture: Object.freeze(options.moisture || [.18, .9]),
    elevationM: Object.freeze(options.elevationM || [0, 3200]),
    salinityPsu: Object.freeze(options.salinityPsu || [0, 1]),
    waterDepthM: Object.freeze(options.waterDepthM || [0, 0]),
    freshwaterNeed: options.freshwaterNeed ?? 0,
    bodyMassKg: options.bodyMassKg ?? null,
    social: options.social || 'solitary', activity: options.activity || 'diurnal',
    locomotion: options.locomotion || (layer === 'fauna' ? 'walk' : 'rooted'),
    behavior: options.behavior || (layer === 'fauna' ? 'forage' : 'grow'),
    lifespanYears: options.lifespanYears ?? 12,
    reproductionDays: options.reproductionDays ?? 365,
    maturityYears: options.maturityYears ?? Math.min(options.lifespanYears ?? 12, Math.max(.01, (options.lifespanYears ?? 12) * .18)),
    offspringPerEvent: options.offspringPerEvent ?? (layer === 'fauna' ? 2 : null),
    lifeStrategy: options.lifeStrategy || ((options.lifespanYears ?? 12) > 40 ? 'slow' : (options.reproductionDays ?? 365) < 90 ? 'fast' : 'intermediate'),
    keystoneRole: options.keystoneRole || null,
    diet: Object.freeze(options.diet || []),
    assetArchetype: options.assetArchetype || id,
    simulationTiers: Object.freeze(options.simulationTiers || ['regional-statistical','local-group']),
    scientificClaim: false
  });
}

export const SPECIES_CATALOG = Object.freeze([
  entry('plant.oak','Oak','vegetation','producer',['temperate_forest','grassland'],{temperatureC:[-8,27],moisture:[.42,.86],elevationM:[0,1800],lifespanYears:240,reproductionDays:365,assetArchetype:'broadleaf-tree'}),
  entry('plant.beech','Beech','vegetation','producer',['temperate_forest'],{temperatureC:[-6,24],moisture:[.5,.9],elevationM:[0,1500],lifespanYears:190,assetArchetype:'broadleaf-tree'}),
  entry('plant.pine','Pine','vegetation','producer',['temperate_forest','taiga','alpine'],{temperatureC:[-22,26],moisture:[.3,.82],elevationM:[0,3500],lifespanYears:170,assetArchetype:'conifer'}),
  entry('plant.spruce','Spruce','vegetation','producer',['taiga','alpine'],{temperatureC:[-30,18],moisture:[.42,.9],elevationM:[0,3200],lifespanYears:210,assetArchetype:'conifer'}),
  entry('plant.fir','Fir','vegetation','producer',['taiga','temperate_forest'],{temperatureC:[-24,20],moisture:[.48,.92],elevationM:[0,2800],lifespanYears:180,assetArchetype:'conifer'}),
  entry('plant.larch','Larch','vegetation','producer',['taiga','tundra'],{temperatureC:[-34,19],moisture:[.34,.82],elevationM:[0,2600],lifespanYears:150,assetArchetype:'conifer'}),
  entry('plant.birch','Birch','vegetation','producer',['grassland','temperate_forest','taiga'],{temperatureC:[-24,25],moisture:[.38,.88],elevationM:[0,2200],lifespanYears:85,assetArchetype:'slender-broadleaf'}),
  entry('plant.willow','Willow','vegetation','producer',['grassland','coast','temperate_forest'],{temperatureC:[-15,29],moisture:[.58,1],elevationM:[0,1800],lifespanYears:75,assetArchetype:'riparian-tree'}),
  entry('plant.acacia','Acacia','vegetation','producer',['savanna','desert'],{temperatureC:[16,42],moisture:[.12,.55],elevationM:[0,1900],lifespanYears:75,assetArchetype:'savanna-tree'}),
  entry('plant.baobab','Baobab','vegetation','producer',['savanna'],{temperatureC:[20,43],moisture:[.18,.58],elevationM:[0,1300],lifespanYears:700,assetArchetype:'baobab'}),
  entry('plant.kapok','Kapok','vegetation','producer',['rainforest'],{temperatureC:[21,36],moisture:[.72,1],elevationM:[0,900],lifespanYears:130,assetArchetype:'emergent-tree'}),
  entry('plant.palm','Palm','vegetation','producer',['rainforest','coast'],{temperatureC:[19,39],moisture:[.52,1],elevationM:[0,1100],lifespanYears:95,assetArchetype:'palm'}),
  entry('plant.mangrove','Mangrove','vegetation','producer',['coast'],{realms:['terrestrial','coastal'],temperatureC:[17,38],moisture:[.8,1],elevationM:[-20,25],salinityPsu:[4,40],lifespanYears:90,assetArchetype:'mangrove'}),
  entry('plant.steppe-grass','Steppe grass','vegetation','producer',['grassland','savanna'],{temperatureC:[-12,38],moisture:[.2,.68],elevationM:[0,2600],lifespanYears:4,reproductionDays:120,assetArchetype:'grass'}),
  entry('plant.desert-shrub','Desert shrub','vegetation','producer',['desert'],{temperatureC:[5,45],moisture:[.05,.4],elevationM:[0,2400],lifespanYears:28,assetArchetype:'shrub'}),
  entry('plant.dwarf-willow','Dwarf willow','vegetation','producer',['tundra'],{temperatureC:[-38,12],moisture:[.28,.8],elevationM:[0,1800],lifespanYears:45,assetArchetype:'dwarf-shrub'}),
  entry('plant.lichen','Lichen','vegetation','producer',['tundra','alpine','ice'],{temperatureC:[-45,16],moisture:[.08,.78],elevationM:[0,5200],lifespanYears:80,assetArchetype:'ground-cover'}),
  entry('plant.maple','Maple','vegetation','producer',['temperate_forest','grassland'],{temperatureC:[-14,29],moisture:[.4,.9],elevationM:[0,1900],lifespanYears:160,assetArchetype:'broadleaf-tree'}),
  entry('plant.chestnut','Chestnut','vegetation','producer',['temperate_forest'],{temperatureC:[-10,30],moisture:[.38,.84],elevationM:[0,1600],lifespanYears:210,assetArchetype:'broadleaf-tree'}),
  entry('plant.redwood','Redwood','vegetation','producer',['temperate_forest','coast'],{temperatureC:[2,26],moisture:[.62,1],elevationM:[0,1200],lifespanYears:900,keystoneRole:'old-growth-canopy',assetArchetype:'giant-conifer'}),
  entry('plant.eucalyptus','Eucalyptus','vegetation','producer',['temperate_forest','savanna'],{temperatureC:[7,38],moisture:[.24,.76],elevationM:[0,1700],lifespanYears:180,keystoneRole:'fire-adapted-canopy',assetArchetype:'broadleaf-tree'}),
  entry('plant.savanna-grass','Savanna grass','vegetation','producer',['savanna','grassland'],{temperatureC:[8,43],moisture:[.14,.66],elevationM:[0,2400],lifespanYears:5,reproductionDays:80,assetArchetype:'grass'}),
  entry('plant.cactus','Columnar cactus','vegetation','producer',['desert'],{temperatureC:[5,48],moisture:[.02,.3],elevationM:[0,2600],lifespanYears:140,reproductionDays:730,assetArchetype:'cactus'}),
  entry('plant.sagebrush','Sagebrush','vegetation','producer',['desert','grassland'],{temperatureC:[-18,39],moisture:[.06,.42],elevationM:[200,3000],lifespanYears:70,assetArchetype:'shrub'}),
  entry('plant.bamboo','Bamboo','vegetation','producer',['rainforest','temperate_forest'],{temperatureC:[4,38],moisture:[.55,1],elevationM:[0,2600],lifespanYears:55,reproductionDays:1800,lifeStrategy:'clonal',assetArchetype:'bamboo'}),
  entry('plant.rainforest-fern','Rainforest fern','vegetation','producer',['rainforest','temperate_forest'],{temperatureC:[8,36],moisture:[.68,1],elevationM:[0,2400],lifespanYears:35,reproductionDays:120,assetArchetype:'fern'}),
  entry('plant.alpine-moss','Alpine moss','vegetation','producer',['alpine','tundra','taiga'],{temperatureC:[-35,18],moisture:[.3,1],elevationM:[500,5600],lifespanYears:45,assetArchetype:'ground-cover'}),
  entry('plant.wetland-sedge','Wetland sedge','vegetation','producer',['grassland','taiga','tundra','coast'],{realms:['terrestrial','freshwater','coastal'],freshwaterNeed:.3,salinityPsu:[0,10],temperatureC:[-24,32],moisture:[.62,1],elevationM:[0,2600],lifespanYears:12,reproductionDays:90,assetArchetype:'wetland-grass'}),
  entry('plant.cattail','Cattail','vegetation','freshwater-producer',['grassland','temperate_forest','taiga'],{realms:['freshwater'],freshwaterNeed:.48,salinityPsu:[0,3],waterDepthM:[0,2],temperatureC:[-12,34],moisture:[.72,1],lifespanYears:8,reproductionDays:90,assetArchetype:'emergent-aquatic'}),
  entry('plant.water-lily','Water lily','vegetation','freshwater-producer',['rainforest','grassland','temperate_forest'],{realms:['freshwater'],freshwaterNeed:.55,salinityPsu:[0,2],waterDepthM:[0,5],temperatureC:[4,36],moisture:[.78,1],lifespanYears:18,reproductionDays:160,assetArchetype:'floating-aquatic'}),
  entry('plant.kelp','Kelp forest','vegetation','marine-producer',['coast','ocean'],{realms:['marine','coastal'],salinityPsu:[24,40],waterDepthM:[0,90],temperatureC:[-2,24],moisture:[.9,1],lifespanYears:12,reproductionDays:120,keystoneRole:'marine-forest',assetArchetype:'kelp'}),
  entry('plant.seagrass','Seagrass meadow','vegetation','marine-producer',['coast'],{realms:['marine','coastal'],salinityPsu:[14,40],waterDepthM:[0,45],temperatureC:[4,34],moisture:[.9,1],lifespanYears:35,reproductionDays:150,keystoneRole:'nursery-habitat',assetArchetype:'seagrass'}),
  entry('plant.phytoplankton','Phytoplankton','vegetation','marine-producer',allWater,{realms:['marine','deep-marine','coastal'],salinityPsu:[18,42],waterDepthM:[0,8000],temperatureC:[-2,36],moisture:[.9,1],lifespanYears:.02,reproductionDays:.5,lifeStrategy:'bloom',keystoneRole:'ocean-primary-production',assetArchetype:'plankton-field',simulationTiers:['planet-statistical','regional-statistical']}),

  entry('animal.bison','Bison','fauna','large-herbivore',['grassland'],{temperatureC:[-24,29],moisture:[.25,.74],bodyMassKg:620,social:'herd',behavior:'graze',lifespanYears:20,diet:['grass'],assetArchetype:'large-grazer'}),
  entry('animal.red-deer','Red deer','fauna','browser',['grassland','temperate_forest'],{temperatureC:[-18,28],moisture:[.34,.88],bodyMassKg:170,social:'herd',behavior:'graze',lifespanYears:18,diet:['grass','leaves'],assetArchetype:'deer'}),
  entry('animal.hare','Hare','fauna','small-herbivore',['grassland','temperate_forest','tundra'],{temperatureC:[-30,31],moisture:[.2,.86],bodyMassKg:4,social:'solitary',behavior:'forage',lifespanYears:7,reproductionDays:70,diet:['grass','shoots'],assetArchetype:'small-mammal'}),
  entry('animal.wild-horse','Wild horse','fauna','large-herbivore',['grassland','savanna'],{temperatureC:[-16,37],moisture:[.18,.68],bodyMassKg:410,social:'herd',behavior:'graze',lifespanYears:26,diet:['grass'],assetArchetype:'equid'}),
  entry('animal.elephant','Elephant','fauna','megaherbivore',['savanna','rainforest'],{temperatureC:[17,40],moisture:[.28,1],elevationM:[0,2500],bodyMassKg:4400,social:'herd',behavior:'browse',lifespanYears:68,reproductionDays:1500,diet:['grass','leaves','bark'],assetArchetype:'elephant'}),
  entry('animal.antelope','Antelope','fauna','large-herbivore',['savanna','grassland'],{temperatureC:[8,42],moisture:[.16,.7],bodyMassKg:85,social:'herd',behavior:'graze',lifespanYears:16,diet:['grass','shoots'],assetArchetype:'antelope'}),
  entry('animal.giraffe','Giraffe','fauna','browser',['savanna'],{temperatureC:[16,43],moisture:[.18,.62],bodyMassKg:920,social:'herd',behavior:'browse',lifespanYears:27,diet:['leaves'],assetArchetype:'giraffe'}),
  entry('animal.reindeer','Reindeer','fauna','large-herbivore',['taiga','tundra'],{temperatureC:[-42,16],moisture:[.22,.82],bodyMassKg:160,social:'herd',behavior:'migrate',lifespanYears:18,diet:['lichen','grass'],assetArchetype:'deer'}),
  entry('animal.mountain-goat','Mountain goat','fauna','browser',['alpine','tundra'],{temperatureC:[-32,18],moisture:[.2,.8],elevationM:[900,5200],bodyMassKg:75,social:'small-group',behavior:'climb',lifespanYears:14,diet:['grass','shrubs'],assetArchetype:'goat'}),
  entry('animal.camel','Camel','fauna','large-herbivore',['desert'],{temperatureC:[-2,49],moisture:[.02,.36],bodyMassKg:520,social:'herd',behavior:'wander',lifespanYears:42,diet:['shrubs','grass'],assetArchetype:'camel'}),
  entry('animal.capybara','Capybara','fauna','semi-aquatic-herbivore',['rainforest','coast'],{realms:['terrestrial','freshwater','coastal'],freshwaterNeed:.35,salinityPsu:[0,8],temperatureC:[17,39],moisture:[.7,1],elevationM:[0,1200],bodyMassKg:48,social:'group',behavior:'waterside-forage',locomotion:'amphibious',lifespanYears:10,diet:['grass','aquatic-plants'],assetArchetype:'capybara'}),
  entry('animal.wolf','Wolf','fauna','apex-predator',['grassland','temperate_forest','taiga','tundra'],{temperatureC:[-38,30],moisture:[.2,.9],bodyMassKg:42,social:'pack',activity:'crepuscular',behavior:'stalk',lifespanYears:13,diet:['large-herbivore','small-herbivore'],assetArchetype:'canid'}),
  entry('animal.fox','Fox','fauna','mesopredator',['grassland','temperate_forest','taiga','tundra','desert'],{temperatureC:[-34,39],moisture:[.08,.9],bodyMassKg:8,social:'solitary',activity:'crepuscular',behavior:'stalk',lifespanYears:8,diet:['small-herbivore','insects','fruit'],assetArchetype:'canid'}),
  entry('animal.lynx','Lynx','fauna','mesopredator',['temperate_forest','taiga'],{temperatureC:[-32,25],moisture:[.34,.9],bodyMassKg:22,social:'solitary',activity:'crepuscular',behavior:'ambush',lifespanYears:15,diet:['small-herbivore','deer'],assetArchetype:'feline'}),
  entry('animal.lion','Lion','fauna','apex-predator',['savanna'],{temperatureC:[13,43],moisture:[.12,.64],bodyMassKg:185,social:'pride',activity:'crepuscular',behavior:'stalk',lifespanYears:16,diet:['large-herbivore'],assetArchetype:'large-feline'}),
  entry('animal.snow-leopard','Snow leopard','fauna','apex-predator',['alpine'],{temperatureC:[-32,15],moisture:[.14,.72],elevationM:[1800,5600],bodyMassKg:38,social:'solitary',activity:'crepuscular',behavior:'ambush',lifespanYears:18,diet:['goat','small-herbivore'],assetArchetype:'large-feline'}),
  entry('animal.polar-bear','Polar bear','fauna','apex-predator',['ice','tundra'],{temperatureC:[-48,8],moisture:[.12,1],bodyMassKg:430,social:'solitary',behavior:'wander',lifespanYears:27,diet:['fish','marine-mammal'],assetArchetype:'bear'}),
  entry('animal.crocodile','Crocodile','fauna','aquatic-predator',['rainforest','coast','savanna'],{realms:['terrestrial','freshwater','coastal'],freshwaterNeed:.28,salinityPsu:[0,18],temperatureC:[20,42],moisture:[.58,1],elevationM:[0,800],bodyMassKg:360,social:'group',activity:'crepuscular',behavior:'waterside-ambush',locomotion:'amphibious',lifespanYears:65,diet:['fish','herbivore'],assetArchetype:'crocodilian'}),
  entry('animal.eagle','Eagle','fauna','aerial-predator',['grassland','alpine','temperate_forest','savanna'],{temperatureC:[-18,36],moisture:[.16,.86],elevationM:[0,5200],bodyMassKg:5.5,social:'pair',behavior:'soar',locomotion:'fly',lifespanYears:24,diet:['small-herbivore','fish'],assetArchetype:'raptor'}),
  entry('animal.songbird','Songbird','fauna','insectivore',['grassland','temperate_forest','rainforest','taiga'],{temperatureC:[-12,38],moisture:[.32,1],bodyMassKg:.06,social:'flock',behavior:'flock',locomotion:'fly',lifespanYears:6,diet:['insects','seeds'],assetArchetype:'small-bird'}),
  entry('animal.waterfowl','Waterfowl','fauna','aquatic-forager',['coast','grassland','taiga','tundra'],{realms:['terrestrial','freshwater','coastal'],freshwaterNeed:.22,salinityPsu:[0,35],temperatureC:[-28,34],moisture:[.55,1],bodyMassKg:2.1,social:'flock',behavior:'migrate',locomotion:'fly',lifespanYears:15,diet:['aquatic-plants','insects'],assetArchetype:'waterfowl'}),
  entry('animal.vulture','Vulture','fauna','scavenger',['savanna','desert','grassland'],{temperatureC:[7,45],moisture:[.06,.7],bodyMassKg:7,social:'flock',behavior:'soar',locomotion:'fly',lifespanYears:28,diet:['carrion'],assetArchetype:'raptor'}),
  entry('animal.river-fish','River fish','fauna','aquatic-forager',['rainforest','temperate_forest','grassland','taiga'],{realms:['freshwater'],freshwaterNeed:.42,salinityPsu:[0,3],waterDepthM:[0,40],temperatureC:[-2,31],moisture:[.55,1],elevationM:[0,2600],bodyMassKg:1.8,social:'school',behavior:'swim',locomotion:'swim',lifespanYears:9,diet:['insects','algae'],assetArchetype:'fish'}),
  entry('animal.brown-bear','Brown bear','fauna','omnivore',['temperate_forest','taiga','tundra'],{temperatureC:[-32,30],moisture:[.24,.94],bodyMassKg:280,social:'solitary',activity:'crepuscular',behavior:'forage',lifespanYears:28,reproductionDays:900,diet:['fish','fruit','small-herbivore','carrion'],assetArchetype:'bear'}),
  entry('animal.moose','Moose','fauna','browser',['taiga','temperate_forest','tundra'],{temperatureC:[-42,20],moisture:[.42,1],bodyMassKg:470,social:'solitary',behavior:'browse',lifespanYears:22,diet:['leaves','aquatic-plants'],assetArchetype:'deer'}),
  entry('animal.wild-boar','Wild boar','fauna','omnivore',['temperate_forest','grassland','rainforest'],{temperatureC:[-18,36],moisture:[.32,1],bodyMassKg:95,social:'group',activity:'crepuscular',behavior:'forage',lifespanYears:18,diet:['roots','fruit','insects','carrion'],assetArchetype:'boar'}),
  entry('animal.zebra','Zebra','fauna','large-herbivore',['savanna','grassland'],{temperatureC:[10,43],moisture:[.16,.68],bodyMassKg:330,social:'herd',behavior:'migrate',lifespanYears:25,diet:['grass'],assetArchetype:'equid'}),
  entry('animal.rhinoceros','Rhinoceros','fauna','megaherbivore',['savanna','rainforest'],{temperatureC:[14,42],moisture:[.22,.92],bodyMassKg:2100,social:'solitary',behavior:'graze',lifespanYears:48,reproductionDays:1400,diet:['grass','leaves'],keystoneRole:'megaherbivore-engineer',assetArchetype:'rhinoceros'}),
  entry('animal.hyena','Hyena','fauna','apex-predator',['savanna','desert','grassland'],{temperatureC:[5,44],moisture:[.08,.7],bodyMassKg:58,social:'clan',activity:'crepuscular',behavior:'pursue',lifespanYears:20,diet:['large-herbivore','carrion'],assetArchetype:'hyena'}),
  entry('animal.jaguar','Jaguar','fauna','apex-predator',['rainforest','savanna'],{temperatureC:[14,39],moisture:[.5,1],bodyMassKg:95,social:'solitary',activity:'crepuscular',behavior:'ambush',lifespanYears:17,diet:['herbivore','fish'],assetArchetype:'large-feline'}),
  entry('animal.forest-primate','Forest primate','fauna','omnivore',['rainforest','temperate_forest'],{temperatureC:[8,38],moisture:[.55,1],bodyMassKg:18,social:'troop',activity:'diurnal',behavior:'canopy-forage',locomotion:'climb',lifespanYears:32,reproductionDays:900,diet:['fruit','leaves','insects'],assetArchetype:'primate'}),
  entry('animal.owl','Owl','fauna','aerial-predator',['temperate_forest','taiga','grassland','desert'],{temperatureC:[-28,39],moisture:[.08,.92],bodyMassKg:1.4,social:'pair',activity:'nocturnal',behavior:'ambush',locomotion:'fly',lifespanYears:18,diet:['small-herbivore','insects'],assetArchetype:'owl'}),
  entry('animal.constrictor-snake','Constrictor snake','fauna','mesopredator',['rainforest','savanna','desert'],{temperatureC:[15,43],moisture:[.1,1],bodyMassKg:28,social:'solitary',activity:'crepuscular',behavior:'ambush',locomotion:'slither',lifespanYears:24,diet:['small-herbivore','birds'],assetArchetype:'snake'}),
  entry('animal.tree-frog','Tree frog','fauna','amphibian-insectivore',['rainforest','temperate_forest'],{realms:['terrestrial','freshwater'],freshwaterNeed:.3,salinityPsu:[0,2],temperatureC:[7,37],moisture:[.68,1],bodyMassKg:.03,social:'chorus',activity:'nocturnal',behavior:'breed-seasonally',locomotion:'hop',lifespanYears:8,reproductionDays:180,offspringPerEvent:600,diet:['insects'],assetArchetype:'frog'}),
  entry('animal.honeybee','Wild honeybee','fauna','pollinator',['grassland','temperate_forest','savanna','rainforest'],{temperatureC:[5,39],moisture:[.18,.92],bodyMassKg:.00012,social:'colony',activity:'diurnal',behavior:'pollinate',locomotion:'fly',lifespanYears:.2,reproductionDays:24,offspringPerEvent:800,diet:['nectar','pollen'],keystoneRole:'pollinator',assetArchetype:'bee-swarm'}),
  entry('animal.salmon','Salmon','fauna','aquatic-forager',['coast','taiga','temperate_forest','tundra'],{realms:['freshwater','coastal','marine'],freshwaterNeed:.18,salinityPsu:[0,36],waterDepthM:[0,300],temperatureC:[-2,22],moisture:[.62,1],bodyMassKg:6,social:'school',behavior:'migrate',locomotion:'swim',lifespanYears:7,reproductionDays:1200,offspringPerEvent:3500,diet:['insects','fish','plankton'],keystoneRole:'nutrient-transfer',assetArchetype:'fish'}),
  entry('animal.trout','Trout','fauna','aquatic-forager',['taiga','temperate_forest','grassland'],{realms:['freshwater'],freshwaterNeed:.5,salinityPsu:[0,3],waterDepthM:[0,80],temperatureC:[-1,24],moisture:[.58,1],bodyMassKg:2.4,social:'school',behavior:'swim',locomotion:'swim',lifespanYears:11,reproductionDays:365,offspringPerEvent:1200,diet:['insects','fish'],assetArchetype:'fish'}),
  entry('animal.reef-fish','Reef fish','fauna','aquatic-forager',['coast'],{realms:['marine','coastal'],salinityPsu:[25,42],waterDepthM:[0,120],temperatureC:[16,36],moisture:[.9,1],bodyMassKg:.8,social:'school',behavior:'reef-forage',locomotion:'swim',lifespanYears:8,diet:['algae','plankton','invertebrates'],assetArchetype:'reef-fish'}),
  entry('animal.tuna','Tuna','fauna','pelagic-predator',['ocean','deep_ocean'],{realms:['marine','deep-marine'],salinityPsu:[28,42],waterDepthM:[0,8000],temperatureC:[5,32],moisture:[.9,1],bodyMassKg:180,social:'school',behavior:'migrate',locomotion:'swim',lifespanYears:32,reproductionDays:365,offspringPerEvent:1000000,diet:['fish','squid'],assetArchetype:'large-fish'}),
  entry('animal.shark','Pelagic shark','fauna','marine-apex-predator',['coast','ocean','deep_ocean'],{realms:['marine','deep-marine','coastal'],salinityPsu:[22,42],waterDepthM:[0,8000],temperatureC:[2,34],moisture:[.9,1],bodyMassKg:520,social:'solitary',behavior:'patrol',locomotion:'swim',lifespanYears:45,reproductionDays:900,offspringPerEvent:8,diet:['fish','marine-mammal','carrion'],assetArchetype:'shark'}),
  entry('animal.manta-ray','Manta ray','fauna','marine-filter-feeder',['coast','ocean'],{realms:['marine','coastal'],salinityPsu:[25,42],waterDepthM:[0,1200],temperatureC:[15,32],moisture:[.9,1],bodyMassKg:1200,social:'small-group',behavior:'migrate',locomotion:'swim',lifespanYears:40,reproductionDays:1500,offspringPerEvent:1,diet:['plankton'],assetArchetype:'ray'}),
  entry('animal.baleen-whale','Baleen whale','fauna','marine-filter-feeder',['ocean','deep_ocean'],{realms:['marine','deep-marine'],salinityPsu:[26,42],waterDepthM:[0,8000],temperatureC:[-2,30],moisture:[.9,1],bodyMassKg:65000,social:'small-group',behavior:'migrate',locomotion:'swim',lifespanYears:85,reproductionDays:1100,offspringPerEvent:1,diet:['krill','plankton'],keystoneRole:'ocean-nutrient-pump',assetArchetype:'whale'}),
  entry('animal.dolphin','Dolphin','fauna','marine-predator',['coast','ocean','deep_ocean'],{realms:['marine','deep-marine','coastal'],salinityPsu:[18,42],waterDepthM:[0,8000],temperatureC:[4,34],moisture:[.9,1],bodyMassKg:180,social:'pod',behavior:'cooperative-hunt',locomotion:'swim',lifespanYears:48,reproductionDays:1100,offspringPerEvent:1,diet:['fish','squid'],assetArchetype:'dolphin'}),
  entry('animal.seal','Seal','fauna','marine-predator',['coast','ocean'],{realms:['marine','coastal'],salinityPsu:[18,42],waterDepthM:[0,1800],temperatureC:[-2,24],moisture:[.9,1],bodyMassKg:140,social:'colony',behavior:'dive-forage',locomotion:'amphibious',lifespanYears:32,reproductionDays:365,offspringPerEvent:1,diet:['fish','squid'],assetArchetype:'seal'}),
  entry('animal.krill','Krill','fauna','zooplankton',['ocean','deep_ocean','coast'],{realms:['marine','deep-marine','coastal'],salinityPsu:[22,42],waterDepthM:[0,8000],temperatureC:[-2,26],moisture:[.9,1],bodyMassKg:.001,social:'swarm',behavior:'vertical-migrate',locomotion:'swim',lifespanYears:6,reproductionDays:120,offspringPerEvent:8000,diet:['phytoplankton'],keystoneRole:'pelagic-food-base',assetArchetype:'plankton-field',simulationTiers:['planet-statistical','regional-statistical']}),
  entry('animal.octopus','Octopus','fauna','marine-predator',['coast','ocean'],{realms:['marine','coastal'],salinityPsu:[20,42],waterDepthM:[0,1600],temperatureC:[2,30],moisture:[.9,1],bodyMassKg:18,social:'solitary',activity:'crepuscular',behavior:'benthic-ambush',locomotion:'swim',lifespanYears:5,reproductionDays:900,offspringPerEvent:80000,diet:['crustaceans','fish'],assetArchetype:'octopus'}),
  entry('animal.sea-turtle','Sea turtle','fauna','marine-herbivore',['coast','ocean'],{realms:['marine','coastal'],salinityPsu:[20,42],waterDepthM:[0,2400],temperatureC:[15,34],moisture:[.9,1],bodyMassKg:120,social:'solitary',behavior:'migrate',locomotion:'swim',lifespanYears:75,reproductionDays:1100,offspringPerEvent:90,diet:['seagrass','jellyfish','algae'],assetArchetype:'sea-turtle'}),

  entry('decomposer.mycorrhizal-fungi','Mycorrhizal fungi','decomposers','symbiotic-decomposer',allLand,{temperatureC:[-8,36],moisture:[.32,1],behavior:'decompose',locomotion:'soil-network',lifespanYears:20,diet:['deadwood','root-exudates'],assetArchetype:'fungal-network'}),
  entry('decomposer.saproxylic-fungi','Deadwood fungi','decomposers','wood-decomposer',['temperate_forest','rainforest','taiga'],{temperatureC:[-10,34],moisture:[.45,1],behavior:'decompose',lifespanYears:12,diet:['deadwood'],assetArchetype:'fungi'}),
  entry('decomposer.earthworm','Earthworm','decomposers','soil-engineer',['grassland','temperate_forest','rainforest'],{temperatureC:[2,31],moisture:[.48,1],bodyMassKg:.004,behavior:'soil-mix',locomotion:'burrow',lifespanYears:6,reproductionDays:60,diet:['detritus'],assetArchetype:'soil-fauna'}),
  entry('decomposer.dung-beetle','Dung beetle','decomposers','detritivore',['grassland','savanna','rainforest'],{temperatureC:[12,42],moisture:[.18,1],bodyMassKg:.01,behavior:'recycle',locomotion:'walk',lifespanYears:2,reproductionDays:40,diet:['dung'],assetArchetype:'beetle'}),
  entry('decomposer.termite','Termite','decomposers','wood-decomposer',['savanna','rainforest','desert'],{temperatureC:[16,43],moisture:[.16,1],bodyMassKg:.001,social:'colony',behavior:'decompose',locomotion:'burrow',lifespanYears:4,diet:['deadwood'],assetArchetype:'colony-insect'}),
  entry('decomposer.soil-bacteria','Soil bacteria','decomposers','microbial-decomposer',allLand,{temperatureC:[-12,46],moisture:[.08,1],behavior:'nutrient-cycle',locomotion:'microbial',lifespanYears:.01,reproductionDays:.02,diet:['detritus'],assetArchetype:'microbial-field'}),
  entry('decomposer.carrion-beetle','Carrion beetle','decomposers','carrion-decomposer',['grassland','temperate_forest','taiga','savanna'],{temperatureC:[-4,38],moisture:[.18,.92],bodyMassKg:.02,behavior:'recycle',lifespanYears:2,diet:['carrion'],assetArchetype:'beetle'}),
  entry('decomposer.lichen-microbiome','Lichen microbiome','decomposers','pioneer-symbiont',['tundra','alpine','ice'],{temperatureC:[-48,18],moisture:[.04,.82],elevationM:[0,5800],behavior:'weather-rock',locomotion:'rooted',lifespanYears:70,diet:['mineral-nutrients'],assetArchetype:'microbial-field'}),
  entry('decomposer.millipede','Millipede','decomposers','detritivore',['temperate_forest','rainforest','grassland'],{temperatureC:[4,34],moisture:[.5,1],bodyMassKg:.012,activity:'nocturnal',behavior:'litter-shred',locomotion:'walk',lifespanYears:7,reproductionDays:120,diet:['leaf-litter'],assetArchetype:'soil-fauna'}),
  entry('decomposer.springtail','Springtail','decomposers','micro-detritivore',['temperate_forest','rainforest','taiga','tundra','grassland'],{temperatureC:[-18,34],moisture:[.42,1],bodyMassKg:.00001,social:'aggregation',behavior:'litter-shred',locomotion:'hop',lifespanYears:1,reproductionDays:20,diet:['fungi','detritus'],assetArchetype:'soil-fauna'}),
  entry('decomposer.freshwater-bacteria','Freshwater bacteria','decomposers','freshwater-microbial-decomposer',['rainforest','temperate_forest','grassland','taiga','tundra'],{realms:['freshwater'],freshwaterNeed:.4,salinityPsu:[0,3],waterDepthM:[0,80],temperatureC:[-2,36],moisture:[.6,1],behavior:'nutrient-cycle',locomotion:'microbial',lifespanYears:.005,reproductionDays:.01,diet:['dissolved-organics'],assetArchetype:'microbial-field'}),
  entry('decomposer.freshwater-fungi','Freshwater fungi','decomposers','freshwater-decomposer',['rainforest','temperate_forest','grassland','taiga'],{realms:['freshwater'],freshwaterNeed:.45,salinityPsu:[0,4],waterDepthM:[0,60],temperatureC:[0,33],moisture:[.68,1],behavior:'decompose',locomotion:'water-network',lifespanYears:3,reproductionDays:14,diet:['leaf-litter','deadwood'],assetArchetype:'fungal-network'}),
  entry('decomposer.marine-bacteria','Marine bacteria','decomposers','marine-microbial-decomposer',allWater,{realms:['marine','deep-marine','coastal'],salinityPsu:[18,42],waterDepthM:[0,8000],temperatureC:[-2,38],moisture:[.9,1],behavior:'nutrient-cycle',locomotion:'microbial',lifespanYears:.003,reproductionDays:.01,diet:['marine-snow','dissolved-organics'],assetArchetype:'microbial-field',simulationTiers:['planet-statistical','regional-statistical']}),
  entry('decomposer.marine-fungi','Marine fungi','decomposers','marine-decomposer',allWater,{realms:['marine','deep-marine','coastal'],salinityPsu:[15,42],waterDepthM:[0,8000],temperatureC:[-2,34],moisture:[.9,1],behavior:'decompose',locomotion:'water-network',lifespanYears:4,reproductionDays:10,diet:['marine-detritus','algae'],assetArchetype:'fungal-network'}),
  entry('decomposer.amphipod','Detritus amphipod','decomposers','marine-detritivore',['coast','ocean','deep_ocean'],{realms:['marine','deep-marine','coastal'],salinityPsu:[16,42],waterDepthM:[0,8000],temperatureC:[-2,32],moisture:[.9,1],bodyMassKg:.002,social:'aggregation',behavior:'scavenge',locomotion:'swim',lifespanYears:2,reproductionDays:50,diet:['marine-snow','carrion'],assetArchetype:'crustacean'}),
  entry('decomposer.sea-cucumber','Sea cucumber','decomposers','benthic-detritivore',['coast','ocean','deep_ocean'],{realms:['marine','deep-marine','coastal'],salinityPsu:[18,42],waterDepthM:[0,8000],temperatureC:[-2,30],moisture:[.9,1],bodyMassKg:1.8,social:'aggregation',behavior:'sediment-process',locomotion:'crawl',lifespanYears:10,reproductionDays:365,diet:['marine-snow','sediment-organics'],keystoneRole:'benthic-biotturbation',assetArchetype:'sea-cucumber'})
]);

const byId = new Map(SPECIES_CATALOG.map(species => [species.id, species]));
export function speciesById(id) { return byId.get(id) || null; }

function rangeScore(value, range, softness) {
  if (value >= range[0] && value <= range[1]) return 1;
  const distance = value < range[0] ? range[0] - value : value - range[1];
  return Math.max(0, 1 - distance / softness);
}

export function habitatScore(species, sample) {
  if (!species || !sample || !species.biomes.includes(sample.biome)) return 0;
  const sampleRealms = sample.ecology?.realms || (sample.land ? ['terrestrial'] : ['marine']);
  if (!species.realms.some(realm => sampleRealms.includes(realm))) return 0;
  const aquatic = species.realms.some(realm => realm === 'marine' || realm === 'deep-marine' || realm === 'freshwater' || realm === 'coastal');
  const habitatTemperature = aquatic && Number.isFinite(sample.ecology?.waterTemperatureC) ? sample.ecology.waterTemperatureC : sample.temperatureC;
  const temperature = rangeScore(habitatTemperature, species.temperatureC, 10);
  const moisture = rangeScore(sample.moisture, species.moisture, .22);
  const elevation = species.realms.includes('terrestrial') ? rangeScore(sample.elevationM, species.elevationM, 900) : 1;
  const salinity = aquatic ? rangeScore(sample.ecology?.salinityPsu ?? 0, species.salinityPsu, 8) : 1;
  const depth = species.waterDepthM[1] > 0 && sample.ecology?.waterDepthM > 0
    ? rangeScore(sample.ecology.waterDepthM, species.waterDepthM, Math.max(80, species.waterDepthM[1] * .4)) : 1;
  const freshwater = species.realms.includes('freshwater')
    ? rangeScore(sample.ecology?.freshwaterPotential ?? 0, [species.freshwaterNeed, 1], .2) : 1;
  return temperature * moisture * elevation * salinity * depth * freshwater;
}

export function candidatesFor(sample, layer) {
  return SPECIES_CATALOG
    .filter(species => species.layer === layer)
    .map(species => ({ species, score: habitatScore(species, sample) }))
    .filter(candidate => candidate.score > .08)
    .sort((a, b) => b.score - a.score || a.species.id.localeCompare(b.species.id));
}

export function chooseSpecies(sample, layer, unitValue = 0) {
  const candidates = candidatesFor(sample, layer);
  if (!candidates.length) return null;
  const total = candidates.reduce((sum, candidate) => sum + candidate.score, 0);
  let cursor = Math.max(0, Math.min(.999999, unitValue)) * total;
  for (const candidate of candidates) {
    cursor -= candidate.score;
    if (cursor <= 0) return candidate.species;
  }
  return candidates[candidates.length - 1].species;
}

export function activityFactor(species, hour) {
  const h = ((Number(hour) % 24) + 24) % 24;
  if (!species) return 0;
  if (species.activity === 'nocturnal') return .12 + .88 * Math.max(0, Math.cos((h - 1) / 12 * Math.PI));
  if (species.activity === 'crepuscular') {
    const dawn = Math.exp(-Math.pow((h - 6) / 2.25, 2));
    const dusk = Math.exp(-Math.pow((h - 18) / 2.25, 2));
    return .15 + .85 * Math.max(dawn, dusk);
  }
  return .12 + .88 * Math.max(0, Math.sin((h - 6) / 12 * Math.PI));
}

export function catalogDescription() {
  const counts = {};
  SPECIES_CATALOG.forEach(species => { counts[species.layer] = (counts[species.layer] || 0) + 1; });
  return {
    schema: SPECIES_CATALOG_SCHEMA, version: SPECIES_CATALOG_VERSION,
    entryCount: SPECIES_CATALOG.length, counts,
    declaredFields: ['realm','habitat-envelope','salinity','water-depth','freshwater-dependency','trophic-role','body-mass','social-structure','activity-cycle','locomotion','behavior','maturity','lifespan','reproduction','life-strategy','keystone-role','diet','simulation-tiers'],
    scope: 'expanded terrestrial, freshwater and marine ecological guild catalog; not a complete planetary species inventory',
    scientificClaim: false
  };
}
