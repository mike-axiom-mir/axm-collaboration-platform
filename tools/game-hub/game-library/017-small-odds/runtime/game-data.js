export const GAME_VERSION = 10;
export const SAVE_KEY = 'axm.small-odds.save.v1';
export const MONEY = '₡';

export const RARITIES = Object.freeze([
  { id: 'common', label: 'Common', weight: 650000, value: 1, power: 1, color: '#a9b8ae', aura: 'quietly functional' },
  { id: 'uncommon', label: 'Curious', weight: 230000, value: 1.55, power: 1.3, color: '#7fe3b1', aura: 'mildly disobedient' },
  { id: 'rare', label: 'Rare', weight: 90000, value: 2.7, power: 1.8, color: '#6bc6ff', aura: 'locally improbable' },
  { id: 'exotic', label: 'Exotic', weight: 25000, value: 5.2, power: 2.7, color: '#ff79d7', aura: 'socially alarming' },
  { id: 'legendary', label: 'Legendary', weight: 4900, value: 13, power: 4.5, color: '#ffc65c', aura: 'followed by impossible shadows' },
  { id: 'unknown', label: 'UNKNOWN', weight: 100, value: 40, power: 9, color: '#f6ff7a', aura: 'refusing the interface contract' }
]);

export const ITEM_FORMS = Object.freeze([
  { id:'lamp', name:'Pocket Lamp', glyph:'◉', category:'appliance', baseValue:18, durability:5, installable:true, tags:['light','home','fashion'] },
  { id:'furnace', name:'Fist-Sized Furnace', glyph:'⬡', category:'appliance', baseValue:30, durability:4, installable:true, tags:['heat','industry','food'] },
  { id:'spoon', name:'Atmospheric Spoon', glyph:'ϟ', category:'tool', baseValue:12, durability:6, installable:false, tags:['food','weather','precision'] },
  { id:'brick', name:'Remembering Brick', glyph:'▰', category:'material', baseValue:9, durability:9, installable:true, tags:['home','history','construction'] },
  { id:'curtain', name:'Truth Curtain', glyph:'≋', category:'furnishing', baseValue:24, durability:7, installable:true, tags:['home','truth','privacy'] },
  { id:'key', name:'Unlicensed Key', glyph:'⌁', category:'tool', baseValue:20, durability:3, installable:false, tags:['access','crime','precision'] },
  { id:'kettle', name:'Weather Kettle', glyph:'♨', category:'appliance', baseValue:28, durability:5, installable:true, tags:['food','weather','home'] },
  { id:'contract', name:'Folded Contract', glyph:'⌑', category:'document', baseValue:15, durability:2, installable:false, tags:['legal','business','debt'] },
  { id:'cocoon', name:'Muttering Cocoon', glyph:'◍', category:'creature', baseValue:34, durability:1, installable:false, tags:['pet','biology','mystery'] },
  { id:'shoe', name:'Single Executive Shoe', glyph:'◒', category:'fashion', baseValue:19, durability:6, installable:false, tags:['fashion','business','travel'] },
  { id:'bell', name:'Polite Alarm Bell', glyph:'♢', category:'appliance', baseValue:17, durability:8, installable:true, tags:['sound','safety','home'] },
  { id:'seed', name:'Architectural Seed', glyph:'✦', category:'biology', baseValue:27, durability:3, installable:true, tags:['biology','construction','food'] },
  { id:'mirror', name:'Borrowed Mirror', glyph:'◇', category:'furnishing', baseValue:26, durability:4, installable:true, tags:['fashion','truth','home'] },
  { id:'ticket', name:'Destination Ticket', glyph:'▱', category:'document', baseValue:21, durability:1, installable:false, tags:['travel','legal','mystery'] },
  { id:'battery', name:'Emotional Battery', glyph:'▣', category:'component', baseValue:23, durability:5, installable:true, tags:['power','emotion','industry'] },
  { id:'jar', name:'Sealed Jar of Almost', glyph:'◌', category:'container', baseValue:16, durability:4, installable:true, tags:['food','mystery','trade'] },
  { id:'hat', name:'Municipal Hat', glyph:'⌂', category:'fashion', baseValue:22, durability:8, installable:false, tags:['fashion','legal','reputation'] },
  { id:'map', name:'Map of Nearby Elsewhere', glyph:'⌘', category:'document', baseValue:25, durability:5, installable:true, tags:['travel','access','mystery'] },
  { id:'toaster', name:'Argument Toaster', glyph:'▥', category:'appliance', baseValue:20, durability:5, installable:true, tags:['food','sound','home'] },
  { id:'umbrella', name:'Indoor Umbrella', glyph:'⌇', category:'tool', baseValue:14, durability:7, installable:false, tags:['weather','safety','fashion'] },
  { id:'coin', name:'Self-Conscious Coin', glyph:'⊙', category:'currency', baseValue:31, durability:10, installable:false, tags:['money','emotion','trade'] },
  { id:'mask', name:'Secondhand Face', glyph:'◈', category:'fashion', baseValue:29, durability:4, installable:false, tags:['fashion','privacy','reputation'] },
  { id:'antenna', name:'Domestic Antenna', glyph:'⋔', category:'component', baseValue:32, durability:6, installable:true, tags:['signal','home','power'] },
  { id:'lunchbox', name:'Emergency Lunchbox', glyph:'▤', category:'container', baseValue:18, durability:6, installable:true, tags:['food','safety','business'] }
]);

export const CORE_BEHAVIORS = Object.freeze([
  { id:'duplicates-warmth', name:'Heat Echo', suffix:'of Repeated Warmth', tags:['heat','power'], effect:{ energy:5, home:2 }, value:9, line:'Copies nearby warmth, including emotional warmth, with poor judgment.' },
  { id:'finds-loopholes', name:'Loophole Appetite', suffix:'of Legal Snacking', tags:['legal','access'], effect:{ money:7, reputation:-1 }, value:12, line:'Finds a technically permitted route through rules nobody had finished writing.' },
  { id:'stores-apologies', name:'Apology Storage', suffix:'of Deferred Sorry', tags:['emotion','social'], effect:{ relation:4, energy:2 }, value:8, line:'Stores apologies and releases them later with inconvenient sincerity.' },
  { id:'predicts-lunch', name:'Lunch Oracle', suffix:'of Tomorrow’s Lunch', tags:['food','signal'], effect:{ energy:7, knowledge:2 }, value:10, line:'Predicts lunch accurately enough to frighten restaurants.' },
  { id:'eats-debt', name:'Debt Digestion', suffix:'of Digestible Debt', tags:['debt','money'], effect:{ money:11, energy:-3 }, value:14, line:'Consumes small obligations, then burps compound interest.' },
  { id:'grows-rooms', name:'Room Budding', suffix:'of Additional Rooms', tags:['construction','home','biology'], effect:{ home:5, money:-2 }, value:15, line:'Attempts to grow a new room from any sufficiently embarrassed wall.' },
  { id:'translates-weather', name:'Weather Translation', suffix:'of Subtitled Weather', tags:['weather','signal'], effect:{ knowledge:4, money:3 }, value:9, line:'Translates atmospheric events into deeply personal criticism.' },
  { id:'attracts-customers', name:'Customer Gravity', suffix:'of Unplanned Customers', tags:['business','reputation'], effect:{ money:9, reputation:3 }, value:13, line:'Produces customers without checking whether you own a business.' },
  { id:'repels-bullies', name:'Proportional Courage', suffix:'of Sudden Personal Space', tags:['safety','emotion'], effect:{ relation:2, reputation:5 }, value:11, line:'Makes larger creatures remember an urgent appointment elsewhere.' },
  { id:'ferments-rumors', name:'Rumor Ferment', suffix:'of Matured Gossip', tags:['social','trade'], effect:{ reputation:4, money:4 }, value:10, line:'Turns harmless observations into tradable social pressure.' },
  { id:'bends-distance', name:'Distance Fold', suffix:'of Nearby Far Away', tags:['travel','access','power'], effect:{ energy:4, knowledge:3 }, value:16, line:'Shortens a journey by making the destination slightly nervous.' },
  { id:'calms-machines', name:'Machine Lullaby', suffix:'of Quiet Appliances', tags:['industry','sound','home'], effect:{ home:3, energy:4 }, value:9, line:'Calms mechanisms until they forget why they were unionizing.' },
  { id:'prints-coupons', name:'Coupon Secretion', suffix:'of Specific Discounts', tags:['money','trade','food'], effect:{ money:6, energy:3 }, value:7, line:'Prints discounts for products that may not have been invented yet.' },
  { id:'collects-shadows', name:'Shadow Banking', suffix:'of Invested Darkness', tags:['mystery','money','privacy'], effect:{ money:8, knowledge:3 }, value:15, line:'Stores shadows and lends them back at dusk with interest.' },
  { id:'fixes-one-thing', name:'Extremely Narrow Repair', suffix:'of One Exact Repair', tags:['precision','construction'], effect:{ home:4, reputation:1 }, value:8, line:'Repairs precisely one kind of failure and develops opinions about the rest.' },
  { id:'sings-value', name:'Price Song', suffix:'of Audible Value', tags:['sound','trade'], effect:{ money:5, reputation:2 }, value:11, line:'Sings its own market value; occasionally harmonizes with inflation.' },
  { id:'breeds-buttons', name:'Button Husbandry', suffix:'of Excess Controls', tags:['industry','fashion'], effect:{ money:3, home:2, knowledge:1 }, value:6, line:'Grows new buttons, half of which control feelings.' },
  { id:'holds-gravity', name:'Gravity Reserve', suffix:'of Emergency Down', tags:['gravity','safety','power'], effect:{ energy:6, home:2 }, value:14, line:'Stores a small quantity of down for gravity-related emergencies.' },
  { id:'remembers-owners', name:'Owner Memory', suffix:'of Previous Mistakes', tags:['history','emotion'], effect:{ relation:3, knowledge:4 }, value:12, line:'Remembers every previous owner and rates them when bored.' },
  { id:'argues-with-time', name:'Chronological Objection', suffix:'of Procedural Yesterday', tags:['time','legal','mystery'], effect:{ energy:3, knowledge:6 }, value:18, line:'Files formal objections against events that have already occurred.' }
]);

export const FUTURE_TRIGGERS = Object.freeze([
  { id:'gas-rain', name:'during apologetic gas rain', tags:['weather','gas'], bonus:1.6, line:'It is waiting for the sky to apologize.' },
  { id:'reverse-gravity', name:'when gravity reverses', tags:['gravity'], bonus:1.9, line:'It becomes useful when down changes management.' },
  { id:'family-meal', name:'during a family meal', tags:['family','food'], bonus:1.45, line:'It reacts strongly to shared food and unshared opinions.' },
  { id:'market-rush', name:'inside a crowded market', tags:['market','trade'], bonus:1.5, line:'Crowds make its hidden function impatient.' },
  { id:'someone-lies', name:'near a social lie', tags:['truth','social'], bonus:1.75, line:'A lie makes it produce a small but invoiceable miracle.' },
  { id:'machine-strike', name:'during a machine strike', tags:['industry','sound'], bonus:1.7, line:'Labor disputes unlock an undocumented mode.' },
  { id:'parent-proud', name:'when a parent feels proud', tags:['family','emotion'], bonus:1.8, line:'Parental pride is apparently a high-voltage fuel.' },
  { id:'business-fails', name:'after a business loses money', tags:['business','debt'], bonus:2.05, line:'Failure is its preferred startup capital.' },
  { id:'pet-jealous', name:'when a pet becomes jealous', tags:['pet','emotion'], bonus:1.65, line:'Pet jealousy reveals a second, furrier purpose.' },
  { id:'power-dip', name:'during a neighborhood power dip', tags:['power','home'], bonus:1.55, line:'It wakes when respectable appliances go dark.' },
  { id:'festival', name:'under festival lights', tags:['festival','reputation'], bonus:1.5, line:'Public celebration makes it demand a stage.' },
  { id:'debt-day', name:'on municipal debt day', tags:['debt','legal'], bonus:1.7, line:'Forms become optional around municipal debt.' },
  { id:'sea-climbs', name:'when the Glimmer climbs ashore', tags:['glimmer','biology'], bonus:1.85, line:'The non-water sea recognizes it as extended family.' },
  { id:'at-midnight', name:'at local midnight', tags:['time','mystery'], bonus:1.4, line:'Midnight causes a quiet violation of causality.' },
  { id:'home-repair', name:'during a home repair', tags:['home','construction'], bonus:1.5, line:'Broken domestic infrastructure activates its professional instincts.' },
  { id:'customer-complains', name:'when a customer complains', tags:['business','social'], bonus:1.6, line:'Complaints make it significantly more entrepreneurial.' },
  { id:'gift-given', name:'after an honest gift', tags:['gift','emotion'], bonus:1.55, line:'Generosity loosens a hidden mechanical valve.' },
  { id:'tiny-brave', name:'when Pip does something brave', tags:['courage','safety'], bonus:2.1, line:'It has excellent taste in disproportionate courage.' }
]);

export const QUIRKS = Object.freeze([
  { id:'apologetic', prefix:'Apologetic', tags:['social'], value:2, line:'It says sorry before and after functioning.' },
  { id:'left-handed', prefix:'Left-Handed', tags:['precision'], value:1, line:'It works best from a direction anatomy does not support.' },
  { id:'unionized', prefix:'Unionized', tags:['industry'], value:5, line:'It observes breaks, negotiates hours, and has excellent representation.' },
  { id:'jealous', prefix:'Jealous', tags:['emotion','pet'], value:3, line:'It notices when another possession receives attention.' },
  { id:'tax-scented', prefix:'Tax-Scented', tags:['legal','money'], value:6, line:'It smells like forms, consequences, and warm toner.' },
  { id:'overeducated', prefix:'Overeducated', tags:['knowledge'], value:4, line:'It explains itself using a theory that has not happened yet.' },
  { id:'mildly-haunted', prefix:'Mildly Haunted', tags:['history','mystery'], value:6, line:'One previous owner is still offering unsolicited support.' },
  { id:'dramatic', prefix:'Needlessly Dramatic', tags:['reputation','sound'], value:3, line:'Every minor function receives a full ceremonial overture.' },
  { id:'shy', prefix:'Painfully Shy', tags:['privacy'], value:-1, line:'It stops working whenever someone admits to watching.' },
  { id:'hungry', prefix:'Financially Hungry', tags:['money','debt'], value:4, line:'It occasionally eats the smallest currency denomination nearby.' },
  { id:'formal', prefix:'Overly Formal', tags:['legal','social'], value:2, line:'It requires introductions before all emergency use.' },
  { id:'singing', prefix:'Off-Key', tags:['sound'], value:1, line:'It hums a note that neighboring architecture dislikes.' },
  { id:'sticky', prefix:'Emotionally Adhesive', tags:['emotion','home'], value:3, line:'It becomes attached to rooms and also to the idea of rooms.' },
  { id:'optimistic', prefix:'Dangerously Optimistic', tags:['courage'], value:5, line:'It interprets warnings as early applause.' },
  { id:'bureaucratic', prefix:'Bureaucratic', tags:['legal','business'], value:7, line:'It generates three permissions for every problem.' },
  { id:'reverse', prefix:'Reverse-Polite', tags:['truth','social'], value:4, line:'It insults friends and compliments incoming hazards.' }
]);

export const MATERIALS = Object.freeze([
  { id:'enamel', adjective:'Enamel', tags:['home'], value:2, texture:'scuffed enamel' },
  { id:'glimmerglass', adjective:'Glimmerglass', tags:['glimmer','mystery'], value:8, texture:'elastic translucent glass' },
  { id:'moodbrass', adjective:'Mood-Brass', tags:['emotion','industry'], value:6, texture:'warm metal that blushes' },
  { id:'fungus', adjective:'Quilted Fungus', tags:['biology','food'], value:3, texture:'soft stitched mycelium' },
  { id:'moonplastic', adjective:'Moon-Plastic', tags:['travel'], value:5, texture:'lightweight lunar polymer' },
  { id:'debtwood', adjective:'Debtwood', tags:['debt','history'], value:4, texture:'grain arranged like fine print' },
  { id:'static-silk', adjective:'Static-Silk', tags:['power','fashion'], value:7, texture:'crackling woven filament' },
  { id:'bone-ceramic', adjective:'Bone-Ceramic', tags:['history','home'], value:5, texture:'warm singing ceramic' },
  { id:'frozen-smoke', adjective:'Frozen-Smoke', tags:['weather','mystery'], value:9, texture:'solid grey vapor' },
  { id:'company-chrome', adjective:'Company-Chrome', tags:['business','reputation'], value:6, texture:'reflective corporate alloy' },
  { id:'sleep-copper', adjective:'Sleep-Copper', tags:['power','emotion'], value:5, texture:'drowsy conductive metal' },
  { id:'edible-stone', adjective:'Edible-Stone', tags:['food','construction'], value:3, texture:'dense mineral pastry' },
  { id:'echo-rubber', adjective:'Echo-Rubber', tags:['sound','safety'], value:4, texture:'soft material with delayed impacts' },
  { id:'timefelt', adjective:'Timefelt', tags:['time','fashion'], value:10, texture:'fibers woven slightly tomorrow' }
]);

export const HISTORIES = Object.freeze([
  { id:'failed-king', label:'formerly owned by a failed king', tags:['history','reputation'], value:8 },
  { id:'never-opened', label:'returned unopened from the future', tags:['time','mystery'], value:10 },
  { id:'restaurant', label:'retired from a zero-gravity restaurant', tags:['food','gravity'], value:5 },
  { id:'divorce', label:'awarded to nobody in a complicated divorce', tags:['legal','emotion'], value:4 },
  { id:'moon-union', label:'assembled during a moon-union lunch break', tags:['industry','travel'], value:6 },
  { id:'prophecy', label:'misprinted in a minor prophecy', tags:['mystery','knowledge'], value:7 },
  { id:'parental', label:'recommended by three disappointed parents', tags:['family','social'], value:3 },
  { id:'illegal-garden', label:'grown in an illegal indoor garden', tags:['biology','crime'], value:5 },
  { id:'bank-vault', label:'found behind a bank vault rather than inside it', tags:['money','access'], value:8 },
  { id:'tourist', label:'lost by an interdimensional tourist', tags:['travel','mystery'], value:9 },
  { id:'office-party', label:'survived a hostile office party', tags:['business','courage'], value:4 },
  { id:'sea-memory', label:'remembered into existence by the Glimmer', tags:['glimmer','history'], value:11 },
  { id:'small-war', label:'declared neutral in a very small war', tags:['legal','safety'], value:5 },
  { id:'catalog-error', label:'manufactured because of a catalog typo', tags:['business','truth'], value:2 }
]);

export const CONDITIONS = Object.freeze([
  { id:'factory-ish', label:'factory-ish', value:1, durability:1, line:'Almost new if viewed from behind.' },
  { id:'pre-loved', label:'pre-loved', value:.85, durability:0, line:'Loved previously and perhaps excessively.' },
  { id:'professionally-licked', label:'professionally licked', value:.8, durability:-1, line:'Certified clean by an unclear authority.' },
  { id:'future-damaged', label:'damaged next week', value:.75, durability:-1, line:'The damage has not arrived yet, but paperwork has.' },
  { id:'emotionally-mint', label:'emotionally mint', value:1.15, durability:1, line:'Physically questionable, emotionally pristine.' },
  { id:'overclocked', label:'dangerously overclocked', value:1.35, durability:-2, line:'Fast, bright, and legally considered a weather event.' },
  { id:'museum-dusty', label:'museum dusty', value:1.25, durability:0, line:'Covered in high-value institutional dust.' },
  { id:'still-warm', label:'still warm', value:1.05, durability:0, line:'No source of warmth is currently confessing.' },
  { id:'folded-wrong', label:'folded incorrectly', value:.9, durability:0, line:'Possesses at least one unauthorized dimension.' },
  { id:'self-repaired', label:'self-repaired', value:1.2, durability:2, line:'Fixed itself and now expects gratitude.' },
  { id:'politely-cracked', label:'politely cracked', value:.7, durability:-2, line:'The crack waits until introductions are complete.' },
  { id:'unreasonably-perfect', label:'unreasonably perfect', value:1.5, durability:2, line:'Its condition is statistically impolite.' }
]);

// Cosmetic lineage is deliberately separate: no style entry alters power, odds, actions, or value.
export const STYLE_FAMILIES = Object.freeze([
  { id:'tube-age', name:'Tube-Age Domestic', palette:['#ffb45b','#4f9c8b'], shape:'round', note:'Enamel housings and glowing appliance tubes.' },
  { id:'shore-salvage', name:'Shore Salvage', palette:['#63d9d2','#7b5b97'], shape:'shell', note:'Pearlescent shell plates and Glimmer corrosion.' },
  { id:'company-polite', name:'Company Polite', palette:['#d8d6c9','#ff665e'], shape:'square', note:'Corporate chrome and apologetic warning labels.' },
  { id:'fungal-cozy', name:'Fungal Cozy', palette:['#e6a96b','#8ccf68'], shape:'soft', note:'Quilted spores, warm seams, soft corners.' },
  { id:'night-market', name:'Night Market Electric', palette:['#ff57c8','#53d8ff'], shape:'tall', note:'Hand-wired neon and repurposed stall hardware.' },
  { id:'municipal-amber', name:'Municipal Amber', palette:['#ffc34a','#6c705f'], shape:'seal', note:'Civic stamps, amber indicators, severe handles.' },
  { id:'yesterday-luxury', name:'Yesterday Luxury', palette:['#a78cff','#f0cb87'], shape:'slim', note:'Timefelt, fading gilt, and fashionable lateness.' },
  { id:'pet-chewed', name:'Pet-Chewed Practical', palette:['#d78266','#7bbca7'], shape:'bite', note:'Durable casing with affectionate tooth geometry.' },
  { id:'orbit-baroque', name:'Orbit Baroque', palette:['#f8df8c','#315c78'], shape:'orbit', note:'Tiny moons, brass filigree, needlessly grand feet.' },
  { id:'unknown-contract', name:'[STYLE FAMILY REFUSED]', palette:['#efff6a','#130d27'], shape:'impossible', note:'The renderer denies responsibility.' }
]);

export const WORLD_EVENTS = Object.freeze([
  { id:'gas-rain', name:'Apologetic Gas Rain', summary:'The sky keeps saying sorry. Weather goods and sealed containers surge.', tags:['weather','gas'], boosts:{ weather:1.8, safety:1.35, food:.8 }, tint:'#a77bd8' },
  { id:'reverse-gravity', name:'Reverse-Gravity Lunch', summary:'Everything falls upward until dessert. Gravity and food goods are suddenly essential.', tags:['gravity','food'], boosts:{ gravity:2.1, food:1.45, construction:.75 }, tint:'#77c8ff' },
  { id:'machine-strike', name:'Domestic Machine Strike', summary:'Appliances demand knobs, respect, and every ninth afternoon.', tags:['industry','sound'], boosts:{ industry:1.8, sound:1.4, power:1.3 }, tint:'#ff9a62' },
  { id:'glimmer-climb', name:'The Glimmer Comes Visiting', summary:'The sea has climbed three streets inland and is browsing window displays.', tags:['glimmer','biology'], boosts:{ glimmer:2, biology:1.55, home:.8 }, tint:'#58e2ca' },
  { id:'truth-week', name:'Mandatory Honesty Afternoon', summary:'Lying is temporarily visible as purple steam.', tags:['truth','social'], boosts:{ truth:2, privacy:1.6, social:1.25 }, tint:'#e889ff' },
  { id:'debt-day', name:'Municipal Debt Day', summary:'Debts migrate between citizens until someone provides snacks.', tags:['debt','legal'], boosts:{ debt:1.9, legal:1.55, money:1.3 }, tint:'#e0b85d' },
  { id:'festival', name:'Festival of Being Slightly Taller', summary:'Everyone wears vertical hats. Fashion and public spectacle boom.', tags:['festival','reputation'], boosts:{ fashion:1.7, reputation:1.5, sound:1.25 }, tint:'#ff6eae' },
  { id:'power-dip', name:'Neighborhood Power Nap', summary:'The grid is asleep. Quiet power sources command embarrassing prices.', tags:['power','home'], boosts:{ power:1.85, home:1.25, industry:1.2 }, tint:'#4a72a8' },
  { id:'market-rush', name:'Three-Minute Market Century', summary:'For three minutes, commerce experiences one hundred years.', tags:['market','trade'], boosts:{ trade:1.75, business:1.5, history:1.4 }, tint:'#f6c459' },
  { id:'quiet-orbit', name:'Quiet Orbit', summary:'Nothing planetary is on fire. Collectors become interested in mysteries.', tags:['time','mystery'], boosts:{ mystery:1.6, history:1.25, safety:1.15 }, tint:'#6572a5' }
]);

export const LOCATIONS = Object.freeze({
  room: { id:'room', name:"Pip's old room", kicker:'BACK WHERE THE CEILING REMEMBERS YOU', color:'#7b4f72', tags:['home','privacy','power'], focus:[.18,.42,.68,.86], actor:'dad', hotspots:['portal','window','old-shelf'] },
  kitchen: { id:'kitchen', name:'Family kitchen', kicker:'DINNER IS CURRENTLY NEGOTIATING', color:'#a45f4b', tags:['family','food','home'], focus:[.2,.45,.72,.88], actor:'mom', hotspots:['dinner-organism','heating-organ','family-table'] },
  shore: { id:'shore', name:'The Glimmer shore', kicker:'THE SEA IS NOT WATER AND RESENTS THE COMPARISON', color:'#3b6c8b', tags:['glimmer','biology','weather'], focus:[.12,.34,.61,.84], actor:'shellby', hotspots:['portal-creature','gel-tide','lost-pockets'] },
  district: { id:'district', name:'Lopsided Lane', kicker:'THE NEIGHBORHOOD HAS A SCHEDULE AND SEVERAL OPINIONS', color:'#52647b', tags:['neighborhood','social','home','business'], focus:[.12,.36,.62,.86], actor:'tavi', hotspots:['living-noticeboard','delivery-chute','parents-window'] },
  market: { id:'market', name:'Ragpicker Market', kicker:'EVERYTHING HAS HAD AT LEAST TWO OWNERS', color:'#71526f', tags:['market','trade','business'], focus:[.14,.4,.64,.87], actor:'vendor', hotspots:['price-oracle','empty-stall','crowd'] },
  starspite: { id:'starspite', name:'Starspite Casino Ship', kicker:'THE HOUSE EDGE IS POSTED; THE HOUSE ITSELF IS ARMED', color:'#5b3f84', tags:['casino','space','risk','truth'], focus:[.14,.39,.64,.86], actor:'vesper', hotspots:['odds-floor','artifact-auction','observation-lounge'] }
});

export const ACTORS = Object.freeze({
  mom: { id:'mom', name:'Mum Vela', role:'parent', color:'#f19c7a', positions:{ kitchen:.67, room:.82 }, lines:['Dinner has submitted a counteroffer.','I kept your room exactly as embarrassing as you left it.','You do not owe us success, Pip. You do owe me one clean mug.'] },
  dad: { id:'dad', name:'Dad Obo', role:'parent', color:'#9ecf8d', positions:{ room:.77, kitchen:.24 }, lines:['That machine has more plugs than our insurance permits.','I found your school shoes. They are somehow smaller than you.','Your mother says not to encourage you. I built a shelf.'] },
  shellby: { id:'shellby', name:'Shellby?', role:'wild machine-creature', color:'#6de0cf', positions:{ shore:.67 }, lines:['Krrrp—bloop.','The creature keeps one eye on you and seven on the portal.','It appears to be invoicing the sea.'] },
  tavi: { id:'tavi', name:'Tavi Spool', role:'lampmoss gardener', color:'#78d7b6', positions:{ district:.22 }, lines:['The lampmoss only bites people who call it landscaping.','Your parents still wave at every parcel. Even the threatening ones.','Carry an object down this lane and it becomes public information.'] },
  oola: { id:'oola', name:'Oola Ninehands', role:'parcel-spine mechanic', color:'#f0b766', positions:{ district:.43 }, lines:['Every delivery has a backbone. Cheap deliveries slouch.','I repaired the chute. It now judges postage but cannot enforce it.','A sale is just a gift wearing a receipt and leaving faster.'] },
  nibbin: { id:'nibbin', name:'The Nibbin Choir', role:'three-person window tenant', color:'#d591d7', positions:{ district:.65 }, lines:['We heard your storefront sign humming in four-part debt.','One of us likes the object. Two of us are preparing minutes.','A quiet street is only a loud street between verses.'] },
  latch: { id:'latch', name:'Granduncle Latch', role:'retired door historian', color:'#8fb4d9', positions:{ district:.82 }, lines:['I remember when this lane leaned the other direction.','Doors are biographies with hinges.','Your dad built another bracket. He thinks nobody noticed.'] },
  sumi: { id:'sumi', name:'Sumi Hush', role:'night-heat steward', color:'#ef9fbe', positions:{ district:.55 }, lines:['The hatchlings sleep by day and invoice the cold by night.','Heat is a household need, not a personality test.','Our radiator accepts votes, steam, and exact maintenance records.'] },
  vendor: { id:'vendor', name:'Auntie Grift', role:'market broker', color:'#d59af2', positions:{ market:.72 }, lines:['Worth is just panic wearing a number.','I buy anything except cursed hats. I rent cursed hats.','Hold long enough and junk becomes heritage.'] },
  vesper: { id:'vesper', name:'Vesper Coil', role:'probability croupier', color:'#b99aff', positions:{ starspite:.73 }, lines:['The odds are above the table, tiny guest. The consequences are beneath it.','We banned hidden pity systems. They made the chandeliers feel manipulative.','Your item may insure a loss. It may not whisper to the wheel.','The casino remembers every wager but is contractually forbidden to believe you are due.'] }
});

// Residents move through authored time blocks. These schedules are public,
// deterministic data: they never consume entropy and never look at Pip's luck.
export const DISTRICT_RESIDENTS = Object.freeze([
  {
    id:'tavi', glyph:'✾', interests:['biology','home','weather'],
    schedule:{
      deepnight:{ zone:'roof-garden', label:'coaxing lampmoss through its nightmares', x:.18 },
      foreglow:{ zone:'stoop', label:'watering the lane’s luminous bite-plants', x:.28 },
      highglow:{ zone:'shade-arch', label:'selling legal shade to overheated windows', x:.55 },
      afterglow:{ zone:'stoop', label:'counting which porch lights came home', x:.24 }
    }
  },
  {
    id:'oola', glyph:'⇥', interests:['business','legal','travel'],
    schedule:{
      deepnight:{ zone:'chute', label:'resetting the parcel spine one vertebra at a time', x:.72 },
      foreglow:{ zone:'chute', label:'sorting deliveries by emotional weight', x:.76 },
      highglow:{ zone:'crossing', label:'walking a crate that refuses wheels', x:.46 },
      afterglow:{ zone:'workbench', label:'repairing tomorrow’s postage', x:.66 }
    }
  },
  {
    id:'nibbin', glyph:'♫', interests:['sound','social','truth'],
    schedule:{
      deepnight:{ zone:'window', label:'whisper-rehearsing so the glass can sleep', x:.58 },
      foreglow:{ zone:'tram-lung', label:'singing the commuter organ awake', x:.38 },
      highglow:{ zone:'window', label:'arguing in harmony about lunch', x:.62 },
      afterglow:{ zone:'corner-stage', label:'performing the day’s factual errors', x:.48 }
    }
  },
  {
    id:'latch', glyph:'⌂', interests:['power','history','precision'],
    schedule:{
      deepnight:{ zone:'old-door', label:'listening for hinges that remember him', x:.88 },
      foreglow:{ zone:'parents-window', label:'inspecting Dad’s newest bracket from a respectful distance', x:.84 },
      highglow:{ zone:'noticeboard', label:'correcting the lane map from memory', x:.16 },
      afterglow:{ zone:'old-door', label:'telling sunset how the street used to lean', x:.9 }
    }
  }
]);

// One authored reaction family lets public world events change what the lane
// says about an object. It changes encounters, never a portal table or roll.
export const DISTRICT_CONTEXT_REACTIONS = Object.freeze([
  { id:'street-power-nap', eventTags:['power'], itemTags:['power','home'], line:'Every sleeping window turns toward the object like a sunflower with a utility bill.' },
  { id:'street-glimmer-climb', eventTags:['glimmer'], itemTags:['glimmer','biology','safety'], line:'The inland Glimmer tastes the object’s history and politely leaves a tide mark.' },
  { id:'street-truth-steam', eventTags:['truth'], itemTags:['truth','legal','social'], line:'Purple honesty steam outlines the object and every sentence recently spoken about it.' },
  { id:'street-market-century', eventTags:['market','trade'], itemTags:['trade','business','history'], line:'The three-minute market century prices the object, reprices it, and sends a tiny apology.' }
]);

// The Kettle household is a deterministic neighborhood dependency, not a
// market roll. Standing changes through authored choices and is translated
// into one disclosed schedule band and one disclosed business-service factor.
export const DISTRICT_SUPPLIER = Object.freeze({
  id:'crooked-kettle',
  name:'Crooked Kettle Cooperative',
  household:'Ari Soot, Pella Steam, and a kettle with two votes',
  glyph:'♨',
  description:'A three-door household that supplies lampmoss tonic, parcel vertebrae, choir paper, and historically accurate hinges.',
  bands:[
    { id:'strained', maximum:-2, label:'STRAINED', businessFactor:.9, color:'#ef8f78', summary:'Deliveries arrive apologizing. The lane keeps covering shifts.' },
    { id:'balancing', minimum:-1, maximum:1, label:'BALANCING', businessFactor:1, color:'#8fb4d9', summary:'The kettle whistles exactly as much stock as the street can carry.' },
    { id:'stocked', minimum:2, maximum:4, label:'STOCKED', businessFactor:1.06, color:'#78d7b6', summary:'Shared shelves are full enough for favors to travel in both directions.' },
    { id:'flourishing', minimum:5, label:'FLOURISHING', businessFactor:1.12, color:'#f0b766', summary:'The cooperative has surplus, confidence, and one unnecessary brass awning.' }
  ],
  scheduleOverrides:{
    strained:{
      tavi:{ zone:'kettle-yard', label:'measuring the last lampmoss tonic into diplomatic teaspoons', x:.34 },
      oola:{ zone:'supplier-chute', label:'holding the cooperative chute together with six patient hands', x:.4 },
      nibbin:{ zone:'ration-window', label:'singing the stock ledger slowly enough to find the missing line', x:.57 },
      latch:{ zone:'queue-door', label:'keeping the supply queue historically single-file', x:.7 }
    },
    stocked:{
      tavi:{ zone:'cutting-table', label:'trading lampmoss cuttings for tomorrow\'s tonic', x:.31 },
      oola:{ zone:'supplier-chute', label:'testing a fresh parcel vertebra from the Kettle shelf', x:.48 },
      nibbin:{ zone:'invoice-balcony', label:'harmonizing invoices that finally agree with the boxes', x:.64 },
      latch:{ zone:'brass-awning', label:'checking that the new hinge labels respect chronology', x:.8 }
    },
    flourishing:{
      tavi:{ zone:'shared-greenhouse', label:'teaching surplus lampmoss to shade the whole lane', x:.27 },
      oola:{ zone:'parade-chute', label:'walking three confident parcels abreast', x:.45 },
      nibbin:{ zone:'cooperative-roof', label:'broadcasting the surplus in responsibly modest harmony', x:.63 },
      latch:{ zone:'brass-awning', label:'giving tours of the awning before it becomes inaccurate', x:.83 }
    }
  }
});

// Hushglass House is the first second-household commons node. Warmth is
// persistent authored state: it selects public schedule overrides and never
// reads, consumes, or modifies portal/casino entropy.
export const NEIGHBORHOOD_COMMONS = Object.freeze({
  id:'hushglass-house',
  name:'Hushglass House',
  household:'Sumi Hush, three night-shift hatchlings, and a radiator that refuses private ownership',
  glyph:'HG',
  resource:'shared night heat',
  description:'The youngest household on Lopsided Lane sleeps through highglow and needs the street heat-loop after every other window thinks the day is finished.',
  petSkillTags:['legal','emotion','family','trade','business','safety'],
  bands:[
    { id:'cold', maximum:-1, label:'COLD DEBT', color:'#8fb4d9', summary:'The radiator is borrowing warmth from tomorrow and the lane keeps noticing the quiet windows.' },
    { id:'rationing', minimum:0, maximum:2, label:'RATIONING', color:'#b99aff', summary:'One night of heat remains. Every household has an opinion about who should move it.' },
    { id:'shared', minimum:3, maximum:5, label:'SHARED WARMTH', color:'#ef9fbe', summary:'The heat loop recognizes Hushglass as part of the street instead of an exception to it.' },
    { id:'open', minimum:6, label:'OPEN RADIATOR', color:'#f0b766', summary:'Surplus night heat moves through the lane under a public agreement with every valve named.' }
  ],
  scheduleOverrides:{
    cold:{
      tavi:{ zone:'heat-meter', label:'wrapping lampmoss around the frozen heat meter', x:.34 },
      oola:{ zone:'hushglass-stoop', label:'walking one warm parcel in circles outside Hushglass', x:.5 },
      nibbin:{ zone:'cold-window', label:'singing the hatchlings a legally non-heating lullaby', x:.63 },
      latch:{ zone:'radiator-door', label:'checking whether old hinges can remember summer', x:.76 }
    },
    shared:{
      tavi:{ zone:'shared-duct', label:'teaching lampmoss to shade the new heat-share duct', x:.32 },
      oola:{ zone:'warm-parcel-stop', label:'delivering heat cells on the public night route', x:.48 },
      nibbin:{ zone:'hushglass-balcony', label:'rehearsing the valve agreement in six warm parts', x:.64 },
      latch:{ zone:'radiator-door', label:'dating every shared valve without claiming ownership', x:.79 }
    },
    open:{
      tavi:{ zone:'warm-greenhouse', label:'growing public shade above the surplus heat loop', x:.28 },
      oola:{ zone:'open-radiator-route', label:'walking spare warmth toward the next cold address', x:.46 },
      nibbin:{ zone:'open-balcony', label:'broadcasting the night-heat ledger to every window', x:.66 },
      latch:{ zone:'valve-museum', label:'giving accurate tours of the lane\'s newest old radiator', x:.82 }
    }
  },
  maintenance:Object.freeze({
    resource:'night-valve reliability', intervalDays:4, graceDays:1, minimumWarmth:3, minimumAgreements:1,
    assetTags:['power','construction','precision','safety','home'],
    petSkillTags:['legal','emotion','family','trade','safety'],
    governance:Object.freeze({
      firstChoiceCycle:1,
      reviewAfterCycles:2,
      models:[
        {
          id:'communal-charter', label:'KEEP THE VALVE UNDER A COMMUNAL CHARTER', shortLabel:'COMMON CHARTER',
          ownership:'No household, shop, or contractor owns the night valve; every service date and meter reading stays public.',
          rights:['every household may inspect the meter','any named route may service the valve'],
          obligations:['publish dates before work starts','leave an open repair record after every return'],
          hours:1, energyCost:3,
          requirement:'one completed service cycle + an active public due date',
          decisionEffect:{ trustDelta:1, agreementsDelta:0, supplierStandingDelta:0, workStandingDelta:0, workPressureDelta:-1, businessRatingGain:0, homeGain:1, residentId:'sumi', residentRelationshipGain:1, houseMark:'common-valve-charter' },
          serviceEffect:{ integrityDelta:0, warmthDelta:1, trustDelta:1, supplierStandingDelta:0, workStandingDelta:0, workPressureDelta:-1, businessRatingGain:0, homeGain:0, residentRelationshipGain:0, petAffectionGain:0 }
        },
        {
          id:'household-trust', label:'PLACE THE VALVE IN A HUSHGLASS HOUSEHOLD TRUST', shortLabel:'HOUSEHOLD TRUST',
          ownership:'Hushglass holds the valve for the lane, with a narrow night-heat veto and no right to sell it.',
          rights:['Hushglass may reserve night heat for the hatchlings','the lane may inspect every use of the veto'],
          obligations:['disclose every reserved hour','return surplus heat to the public loop'],
          hours:1, energyCost:3, minimumTrust:5,
          requirement:'Hushglass trust 5 + one completed service cycle + an active public due date',
          decisionEffect:{ trustDelta:1, agreementsDelta:1, supplierStandingDelta:0, workStandingDelta:0, workPressureDelta:0, businessRatingGain:0, homeGain:1, residentId:'sumi', residentRelationshipGain:2, houseMark:'hushglass-trust-deed' },
          serviceEffect:{ integrityDelta:0, warmthDelta:0, trustDelta:1, supplierStandingDelta:0, workStandingDelta:0, workPressureDelta:0, businessRatingGain:0, homeGain:1, residentRelationshipGain:0, petAffectionGain:0 }
        },
        {
          id:'service-cooperative', label:'LICENSE A TRANSPARENT SERVICE COOPERATIVE', shortLabel:'SERVICE CO-OP',
          ownership:'The Crooked Kettle and Long Table jointly hold a revocable service license; the lane keeps the valve and the records.',
          rights:['the cooperative may post paid bids','retained tools stay with their named owners'],
          obligations:['publish rates before bidding','credit household, creature, and tool labor by name'],
          hours:1, energyCost:4, minimumBusinessRating:10, minimumSupplierStanding:6, minimumWorkStanding:3,
          requirement:'store rating 10 + Kettle standing 6 + Long Table standing 3 + one completed service cycle',
          decisionEffect:{ trustDelta:0, agreementsDelta:0, supplierStandingDelta:1, workStandingDelta:1, workPressureDelta:1, businessRatingGain:1, homeGain:0, residentId:'oola', residentRelationshipGain:1, houseMark:'service-coop-license' },
          serviceEffect:{ integrityDelta:0, warmthDelta:0, trustDelta:0, supplierStandingDelta:1, workStandingDelta:1, workPressureDelta:1, businessRatingGain:1, homeGain:0, residentRelationshipGain:0, petAffectionGain:0 }
        }
      ]
    }),
    faults:[
      {
        id:'relay-backfeed', label:'RETAINED RELAY BACKFEED', glyph:'RLY',
        summary:'The valve is reading a previously retained shop or home relay as public property and feeding heat backward through its ownership tag.',
        trigger:'most recent completed service used a retained relay',
        scheduleOverrides:{ tavi:{ zone:'relay-title-check', label:'reading every retained ownership title aloud at the backfeeding relay', x:.33 }, oola:{ zone:'backfeed-crate', label:'holding the cooperative crate clear of the reversed heat line', x:.51 } },
        serviceByModel:{
          'communal-charter':{ integrityDelta:1, warmthDelta:0, trustDelta:1, supplierStandingDelta:0, workStandingDelta:0, workPressureDelta:0, businessRatingGain:0, homeGain:1, residentRelationshipGain:0, petAffectionGain:0 },
          'household-trust':{ integrityDelta:1, warmthDelta:1, trustDelta:0, supplierStandingDelta:0, workStandingDelta:0, workPressureDelta:0, businessRatingGain:0, homeGain:1, residentRelationshipGain:0, petAffectionGain:0 },
          'service-cooperative':{ integrityDelta:1, warmthDelta:0, trustDelta:0, supplierStandingDelta:1, workStandingDelta:1, workPressureDelta:1, businessRatingGain:1, homeGain:0, residentRelationshipGain:0, petAffectionGain:0 }
        }
      },
      {
        id:'signature-drift', label:'CREATURE-SIGNATURE DRIFT', glyph:'PET',
        summary:'The valve remembers the returning creature more clearly than the households, so its next service must decide whose signature actually governs.',
        trigger:'most recent completed service returned with a pet named in the original accord',
        scheduleOverrides:{ nibbin:{ zone:'signature-chorus', label:'singing the creature signature beside every household name', x:.65 }, latch:{ zone:'seal-comparison', label:'comparing the old pet seal with the current public valve', x:.79 } },
        serviceByModel:{
          'communal-charter':{ integrityDelta:1, warmthDelta:0, trustDelta:1, supplierStandingDelta:0, workStandingDelta:0, workPressureDelta:0, businessRatingGain:0, homeGain:0, residentRelationshipGain:0, petAffectionGain:1 },
          'household-trust':{ integrityDelta:0, warmthDelta:1, trustDelta:1, supplierStandingDelta:0, workStandingDelta:0, workPressureDelta:0, businessRatingGain:0, homeGain:1, residentRelationshipGain:0, petAffectionGain:1 },
          'service-cooperative':{ integrityDelta:1, warmthDelta:0, trustDelta:0, supplierStandingDelta:1, workStandingDelta:1, workPressureDelta:1, businessRatingGain:1, homeGain:0, residentRelationshipGain:0, petAffectionGain:0 }
        }
      },
      {
        id:'bid-hammer', label:'CONTRACT BID-HAMMER', glyph:'BID',
        summary:'Repeated bid pressure has taught the jig to accept the loudest invoice before it checks the shared service record.',
        trigger:'most recent service used the Long Table contract, or current rivalry pressure is at least 2',
        scheduleOverrides:{ oola:{ zone:'bid-hammer-board', label:'pinning the loudest bid beneath the actual valve measurements', x:.5 }, latch:{ zone:'contract-rattle', label:'dating each contract rattle before it becomes precedent', x:.8 } },
        serviceByModel:{
          'communal-charter':{ integrityDelta:1, warmthDelta:0, trustDelta:1, supplierStandingDelta:0, workStandingDelta:1, workPressureDelta:-1, businessRatingGain:0, homeGain:0, residentRelationshipGain:0, petAffectionGain:0 },
          'household-trust':{ integrityDelta:0, warmthDelta:1, trustDelta:1, supplierStandingDelta:0, workStandingDelta:0, workPressureDelta:-1, businessRatingGain:0, homeGain:1, residentRelationshipGain:0, petAffectionGain:0 },
          'service-cooperative':{ integrityDelta:1, warmthDelta:0, trustDelta:0, supplierStandingDelta:1, workStandingDelta:1, workPressureDelta:1, businessRatingGain:1, homeGain:0, residentRelationshipGain:0, petAffectionGain:0 }
        }
      },
      {
        id:'date-fog', label:'PUBLIC DATE-FOG', glyph:'DAY',
        summary:'The repair still works, but copied dates have blurred until the lane can no longer tell inspection day from service day.',
        trigger:'fallback when no retained relay, returning creature, or bid-pressure cause is present',
        scheduleOverrides:{ tavi:{ zone:'date-lampmoss', label:'growing one lampmoss numeral for every public service date', x:.33 }, nibbin:{ zone:'date-chorus', label:'singing inspection day and service day as different notes', x:.64 } },
        serviceByModel:{
          'communal-charter':{ integrityDelta:1, warmthDelta:0, trustDelta:1, supplierStandingDelta:0, workStandingDelta:0, workPressureDelta:-1, businessRatingGain:0, homeGain:0, residentRelationshipGain:0, petAffectionGain:0 },
          'household-trust':{ integrityDelta:0, warmthDelta:1, trustDelta:1, supplierStandingDelta:0, workStandingDelta:0, workPressureDelta:0, businessRatingGain:0, homeGain:1, residentRelationshipGain:0, petAffectionGain:0 },
          'service-cooperative':{ integrityDelta:1, warmthDelta:0, trustDelta:0, supplierStandingDelta:1, workStandingDelta:1, workPressureDelta:1, businessRatingGain:1, homeGain:0, residentRelationshipGain:0, petAffectionGain:0 }
        }
      }
    ],
    integrityBands:[
      { id:'offline', maximum:0, label:'OFFLINE', color:'#8fb4d9', summary:'The agreement exists, but the shared valve has no maintained service record.' },
      { id:'patched', minimum:1, maximum:2, label:'PATCHED', color:'#b99aff', summary:'The loop works under a named temporary repair and needs its next public cycle.' },
      { id:'steady', minimum:3, maximum:4, label:'STEADY', color:'#78d7b6', summary:'The service record, valve, and route all agree about who keeps the night warm.' },
      { id:'resilient', minimum:5, label:'RESILIENT', color:'#f0b766', summary:'Repeated maintenance has made the shared loop sturdy enough to absorb one bad night.' }
    ],
    scheduleOverrides:{
      due:{
        oola:{ zone:'valve-bid-board', label:'holding the Hushglass valve bid where every household can read it', x:.5 },
        latch:{ zone:'maintenance-date', label:'dating the next service before the old repair becomes folklore', x:.78 }
      },
      active:{
        tavi:{ zone:'service-lampmoss', label:'teaching lampmoss to illuminate the open service record', x:.32 },
        oola:{ zone:'shared-tool-route', label:'walking tools between Hushglass and the Long Table without hiding ownership', x:.49 },
        nibbin:{ zone:'maintenance-chorus', label:'singing each valve check exactly once', x:.65 },
        latch:{ zone:'service-ledger', label:'checking the maintenance dates against the actual radiator', x:.8 }
      },
      overdue:{
        tavi:{ zone:'cooling-meter', label:'wrapping the overdue meter in lampmoss warning tape', x:.34 },
        oola:{ zone:'contested-valve', label:'guarding the valve while two invoices claim the same wrench', x:.5 },
        nibbin:{ zone:'late-service-bell', label:'broadcasting the overdue service without calling it bad luck', x:.64 },
        latch:{ zone:'undated-repair', label:'refusing to let an undated repair become history', x:.79 }
      }
    },
    routes:[
      { id:'public-rota', label:'HONOR THE PUBLIC VALVE ROTA', detail:'Use the saved household agreement, Crooked Kettle stock, and Long Table measurements without creating a private owner.', hours:2, energyCost:6, dueDays:1, requirement:'saved accord return + shared warmth', returnEffect:{ integrityDelta:2, warmthDelta:1, trustDelta:1, supplierStandingDelta:1, workStandingDelta:1, workPressureDelta:-1, businessRatingGain:1, homeGain:1, residentId:'tavi', residentRelationshipGain:1, houseMark:'valve-rota-card' } },
      { id:'retained-relay', label:'LEND A RETAINED SHOP OR HOME RELAY', detail:'Use one actually installed or storefront-equipped object with a matching tag. It stays owned and gains public service history.', hours:1, energyCost:4, dueDays:1, requiresAsset:true, requirement:'installed/store equipment with power, construction, precision, safety, or home', returnEffect:{ integrityDelta:3, warmthDelta:1, trustDelta:1, supplierStandingDelta:0, workStandingDelta:0, workPressureDelta:1, businessRatingGain:2, homeGain:2, residentId:'oola', residentRelationshipGain:1, houseMark:'shop-relay-window' } },
      { id:'returning-pet', label:'RETURN WITH THE CREATURE WHO SIGNED FIRST', detail:'Only the currently assigned pet whose id appears in the original Hushglass receipt can repeat the route; literal maintenance tags are counted again.', hours:2, energyCost:5, dueDays:1, requiresReturningPet:true, minimumLaborPoints:3, requirement:'previous Hushglass participant + assigned literal skill evidence', returnEffect:{ integrityDelta:2, warmthDelta:1, trustDelta:2, supplierStandingDelta:1, workStandingDelta:1, workPressureDelta:-1, businessRatingGain:1, homeGain:1, residentId:'oola', residentRelationshipGain:1, petAffectionGain:1, houseMark:'pet-valve-seal' } }
    ],
    workOrder:{
      id:'hushglass-night-valve-jig', title:'Rebuild the Hushglass night-valve jig', requester:'Sumi Hush through the Long Table', residentId:'oola',
      summary:'The shared loop is due. The Long Table has posted a paid bid beside the public rota, making ownership and pressure part of the job instead of hidden difficulty.',
      requiredTags:['construction','precision','safety','power','home'], skillTags:['legal','emotion','trade','safety'], basePay:36, dueDays:1, toolDurability:1, commonsConflict:true,
      returnText:'The Hushglass jig returned to the shared valve with its labor, ownership, and pressure written on the same plate.',
      maintenanceByApproach:{
        'share-the-shift':{ integrityDelta:3, warmthDelta:1, trustDelta:1, sumiRelationshipGain:1, houseMark:'shared-contract-stencil' },
        'beat-the-table':{ integrityDelta:2, warmthDelta:1, trustDelta:-1, sumiRelationshipGain:0, houseMark:'exclusive-contract-stencil' }
      }
    }
  })
});

// Each resident owns one authored repeatable arc. Availability is a plain
// relationship prerequisite plus a day cooldown; choices schedule a known
// follow-up and never consume entropy or look at portal/casino history.
export const DISTRICT_ARCS = Object.freeze([
  {
    id:'tavi-tonic-vote', residentId:'tavi', minRelationship:1, cooldownDays:5, dueDays:2,
    title:'The lampmoss wants a vote in tonic purchasing',
    summary:'Tavi has one watering thimble, twelve biting constituents, and a cooperative order form that recognizes roots as signatures.',
    choices:[
      { id:'count-root-votes', label:'COUNT EVERY ROOT VOTE', detail:'Spend the afternoon translating leaf bites into a legitimate shared order.', hours:2, effect:{ energy:-6, knowledge:2, relation:2 }, supplierStandingDelta:2, result:'The order form accepts twelve root marks and one very small witness.', followup:{ text:'The Kettle household delivered tonic by committee. Tavi sent home a glowing cutting labeled "Pip voted too."', effect:{ home:1 }, residentRelationshipGain:1, businessRatingGain:1, parentText:'Mum placed Tavi\'s committee cutting near the kitchen light. It now votes on soup.' } },
      { id:'protect-wild-share', label:'LEAVE A WILD SHARE UNPURCHASED', detail:'Buy less tonic and preserve one patch outside the cooperative ledger.', hours:1, effect:{ energy:-3, knowledge:3, relation:1 }, supplierStandingDelta:-1, result:'Tavi marks one patch "not inventory" and the lampmoss stops biting the pen.', followup:{ text:'The unpurchased patch spread into a public shade arch. The cooperative lost stock but the lane gained weather.', effect:{ reputation:2 }, residentRelationshipGain:2, businessRatingGain:0, parentText:'Mum copied Tavi\'s wild-share notice onto the family pantry: not everything useful must become stock.' } }
    ]
  },
  {
    id:'oola-vertebra-audit', residentId:'oola', minRelationship:1, cooldownDays:6, dueDays:1,
    title:'The parcel spine has rejected a cheap vertebra',
    summary:'Oola can install the cooperative part, return it with a precise complaint, or ask Pip to become temporary structural evidence.',
    choices:[
      { id:'carry-test-crate', label:'CARRY THE TEST CRATE TOGETHER', detail:'Walk the new vertebra through a full delivery cycle before anyone signs acceptance.', hours:2, effect:{ energy:-8, relation:3, reputation:1 }, supplierStandingDelta:2, result:'The crate completes the route without slouching. Oola signs with all available hands.', followup:{ text:'The verified vertebra entered cooperative stock and three delayed parcels stood up straighter.', effect:{ money:16 }, residentRelationshipGain:1, businessRatingGain:1, parentText:'Dad mounted Oola\'s rejected prototype above the old window. It now supports nothing with great confidence.' } },
      { id:'publish-safe-limit', label:'PUBLISH THE SAFE LOAD LIMIT', detail:'Refuse the rushed installation and make the supplier print an honest maximum.', hours:1, effect:{ energy:-3, knowledge:3, relation:2 }, supplierStandingDelta:-1, result:'Oola prints the limit large enough for a parcel to read while moving.', followup:{ text:'Fewer parcels moved, but none folded. The cooperative posted the corrected limit beside every chute.', effect:{ reputation:3 }, residentRelationshipGain:1, businessRatingGain:0, parentText:'Dad put Oola\'s safe-load card beside the family shelf. The shelf has stopped boasting.' } }
    ]
  },
  {
    id:'nibbin-invoice-rest', residentId:'nibbin', minRelationship:1, cooldownDays:5, dueDays:2,
    title:'The cooperative invoice has no rests',
    summary:'The Nibbin Choir can sing every line, but an invoice without silence becomes legally continuous and financially enormous.',
    choices:[
      { id:'score-the-pauses', label:'SCORE THE MISSING PAUSES', detail:'Help place honest rests between quantities before the kettle counts one eternal order.', hours:2, effect:{ energy:-5, knowledge:2, relation:3 }, supplierStandingDelta:2, result:'The invoice gains rests, bar lines, and a merciful final total.', followup:{ text:'The corrected invoice cleared. The Choir performed the first affordable silence on Lopsided Lane.', effect:{ reputation:2 }, residentRelationshipGain:1, businessRatingGain:2, parentText:'Mum framed one bar of the Nibbin Choir\'s affordable silence. Dinner keeps trying to hum it.' } },
      { id:'keep-one-voice-free', label:'KEEP ONE VOICE OFF THE LEDGER', detail:'Protect one singer from becoming unpaid accounting infrastructure.', hours:1, effect:{ energy:-2, knowledge:2, relation:2 }, supplierStandingDelta:-1, result:'One Nibbin closes the ledger and opens the window. The other two discover rests by necessity.', followup:{ text:'The invoice took longer, but the Choir kept its third voice. The cooperative published a labor footnote.', effect:{ reputation:3 }, residentRelationshipGain:2, businessRatingGain:0, parentText:'Mum pinned the cooperative labor footnote near the family table, where unpaid chores can see it.' } }
    ]
  },
  {
    id:'latch-hinge-credit', residentId:'latch', minRelationship:1, cooldownDays:7, dueDays:2,
    title:'Granduncle Latch found interest accumulating on a hinge',
    summary:'The Kettle household lent the lane three brass hinges. One has started charging historical interest in doors.',
    choices:[
      { id:'lend-family-bracket', label:'LEND DAD\'S SPARE BRACKET', detail:'Bridge the shortage with a family part and document exactly when ownership returns.', hours:2, effect:{ energy:-5, relation:3, home:-1 }, supplierStandingDelta:2, result:'Latch dates the bracket, the loan, the return, and the argument that will happen if any date moves.', followup:{ text:'The cooperative returned Dad\'s bracket polished and paid one hinge of interest.', effect:{ home:3 }, residentRelationshipGain:1, businessRatingGain:1, parentText:'Dad rehung the returned bracket beside the old window. It has earned one tiny brass hinge and unbearable confidence.' } },
      { id:'archive-the-shortage', label:'ARCHIVE THE SHORTAGE, NOT THE DEBT', detail:'Refuse a new loan and make the household record why its hinge supply ran thin.', hours:1, effect:{ knowledge:4, relation:2 }, supplierStandingDelta:-1, result:'Latch files the shortage under causes instead of character flaws.', followup:{ text:'The archive exposed a double-voting kettle order. Supply stayed tight, but nobody blamed the youngest door.', effect:{ reputation:3 }, residentRelationshipGain:2, businessRatingGain:0, parentText:'Dad copied Latch\'s shortage archive into the family repair book under "ask what happened first."' } }
    ]
  }
]);

// The Long Table is an authored employer and competitor, not a buyer roll.
// One order rotates by public calendar arithmetic. A real tool and the assigned
// pet's literal species/trait tags produce a disclosed labor quote.
export const NEIGHBORHOOD_WORKS = Object.freeze({
  id:'long-table-works',
  name:'The Long Table Works',
  household:'Mara Wold, seven cousins, and a table that negotiates overtime',
  glyph:'LT',
  description:'A larger Bent Street workshop that competes with Pip for repairs and hires the bedroom store for overflow production.',
  pressureBands:[
    { id:'cordial', maximum:1, label:'CORDIAL RIVALRY', wageFactor:1, color:'#78d7b6', summary:'They share measurements, work, and exactly one kettle break.' },
    { id:'watching', minimum:2, maximum:4, label:'WATCHING THE BID', wageFactor:.96, color:'#f0b766', summary:'The cousins check Pip\'s prices before posting their own.' },
    { id:'contested', minimum:5, label:'CONTESTED STREET', wageFactor:.9, color:'#ef8f78', summary:'Rush bids have tightened the work board and the Lane can feel it.' }
  ],
  approaches:[
    { id:'share-the-shift', label:'SHARE THE SHIFT AND MEASUREMENT', detail:'Take the public rate, credit the pet by name, and return one production note to the Lane.', hours:3, energyCost:7, wageFactor:1, standingDelta:2, pressureDelta:-1, supplierStandingDelta:1, businessRatingGain:1, residentRelationshipGain:1, homeGain:1 },
    { id:'beat-the-table', label:'BEAT THE LONG TABLE\'S BID', detail:'Rush the same work for a higher invoice. The arithmetic is public; so is the pressure it creates.', hours:2, energyCost:11, wageFactor:1.18, standingDelta:1, pressureDelta:2, supplierStandingDelta:-1, businessRatingGain:2, residentRelationshipGain:0, homeGain:0 }
  ],
  orders:[
    { id:'root-vote-payroll', title:'Bind twelve root-vote payroll sleeves', requester:'Tavi Spool', residentId:'tavi', summary:'The lampmoss cooperative needs sleeves that survive law, sap, and a filing cabinet with opinions.', requiredTags:['legal','trade','history','precision','power','home'], skillTags:['legal','emotion','trade','business'], basePay:26, dueDays:1, toolDurability:1, returnText:'The sleeves passed twelve root signatures and one extremely small payroll audit.' },
    { id:'parcel-spine-jig', title:'Build a jig for honest parcel vertebrae', requester:'Oola Ninehands', residentId:'oola', summary:'Oola needs a repeatable alignment tool before another cheap vertebra learns to slouch.', requiredTags:['construction','industry','precision','travel','business'], skillTags:['industry','trade','business','safety'], basePay:31, dueDays:1, toolDurability:1, returnText:'The jig held every parcel vertebra to the same disclosed angle.' },
    { id:'invoice-hushers', title:'Make three invoice hushers for the Choir', requester:'The Nibbin Choir', residentId:'nibbin', summary:'The invoices need small rests that count as silence without becoming unpaid labor.', requiredTags:['sound','truth','business','family','food'], skillTags:['sound','business','family','truth'], basePay:29, dueDays:2, toolDurability:1, returnText:'The hushers created three affordable silences and one correctly paid rest.' }
  ]
});

export const ACTIVITIES = Object.freeze([
  { id:'sort-boxes', location:'room', actor:'dad', label:'Sort the old moving boxes', detail:'Find what the room remembers. Dad pretends not to get sentimental.', tags:['family','history','home'], hours:2, energy:-6, relation:3, money:4, home:1 },
  { id:'repair-heater', location:'kitchen', actor:'mom', label:'Help soothe the heating organ', detail:'Hold its warm tendrils while Mum negotiates a service agreement.', tags:['family','heat','home','construction'], hours:2, energy:-8, relation:4, home:2 },
  { id:'cook-dinner', location:'kitchen', actor:'mom', label:'Cook whatever dinner becomes', detail:'Work beside Mum while the main course attempts a legal identity.', tags:['family','food','truth'], hours:2, energy:9, relation:5, money:-3 },
  { id:'walk-glimmer', location:'shore', actor:'shellby', label:'Walk beside the Glimmer', detail:'The sea folds around your ankles and returns one memory incorrectly.', tags:['glimmer','biology','courage'], hours:2, energy:4, knowledge:3 },
  { id:'befriend-mite', location:'shore', actor:'shellby', label:'Follow the tiny tax-mite', detail:'It leads you through municipal kelp and appears willing to be employed.', tags:['pet','legal','glimmer'], hours:1, energy:-2, special:'adopt-starter-pet' },
  { id:'tend-lampmoss', location:'district', actor:'tavi', label:'Help Tavi negotiate with the lampmoss', detail:'Hold a watering thimble while the hedge debates whether Pip counts as weather.', tags:['neighborhood','biology','home'], hours:1, energy:-4, knowledge:2, relation:2, home:1 },
  { id:'walk-parcel-spine', location:'district', actor:'oola', label:'Walk Oola’s stubborn parcel spine', detail:'The delivery crate has rejected wheels and would like a very small escort.', tags:['neighborhood','business','travel'], hours:2, energy:-7, money:12, reputation:1, relation:2 },
  { id:'listen-prices', location:'market', actor:'vendor', label:'Listen to the Price Oracle', detail:'Auntie Grift translates screaming prices into slightly quieter prices.', tags:['market','trade','knowledge'], hours:1, energy:-3, knowledge:4, reputation:1 },
  { id:'work-crowd', location:'market', actor:'vendor', label:'Carry impossible groceries', detail:'You earn a few credits and one customer remembers your name correctly.', tags:['market','business','courage'], hours:2, energy:-9, money:18, reputation:2 },
  { id:'read-odds-wall', location:'starspite', actor:'vesper', label:'Read the wall of exact odds', detail:'Every denominator is illuminated. One footnote is legally larger than Vesper.', tags:['casino','truth','knowledge'], hours:1, energy:-2, knowledge:5, relation:2 },
  { id:'return-lost-chip', location:'starspite', actor:'vesper', label:'Return a giant stranger\'s lost chip', detail:'The chip is larger than Pip and worth less than the honest gesture.', tags:['casino','social','courage'], hours:2, energy:-7, money:8, reputation:3, relation:3 },
  { id:'report-probability-crime', location:'starspite', actor:'vesper', label:'Report a probability crime', detail:'Someone advertised a lucky streak as a mathematical entitlement. Security looks offended.', tags:['casino','legal','truth'], hours:2, energy:-5, knowledge:4, reputation:4, relation:4, special:'report-probability-crime' }
]);

// Life threads are authored situations, not random drops or accepted quests.
// The simulation deterministically chooses an eligible situation from the
// current day, place, world event, and relationship state. If Pip does nothing,
// the situation keeps moving and records its own consequence.
export const LIFE_THREADS = Object.freeze([
  {
    id:'dad-shelf-alibi', location:'room', actor:'dad', minDay:2, repeatAfterDays:8,
    title:'Dad\'s shelf remembers being a ladder',
    summary:'It keeps leaning toward the window. Dad has put a cushion beneath it and called that engineering.',
    actorLine:'I can fix it alone. That is not a request. It is just a sentence with hopeful posture.',
    tags:['family','home','construction','history'], expiresInDays:2,
    unattended:{ text:'Dad fixed the remembering shelf alone. It now holds objects and one tiny grudge.', effect:{ relation:1, home:1 }, tags:['family','home','history'] },
    neighborChoice:{ id:'ask-latch-hinge-memory', label:'ASK GRANDUNCLE LATCH WHICH HINGE REMEMBERS', detail:'Available because Latch trusts Pip enough to bring door history into the family room.', residentId:'latch', minRelationship:3, residentRelationshipGain:2, supplierStandingDelta:1, hours:1, effect:{ energy:-3, relation:3, home:2, knowledge:2 }, result:'Latch identifies the nostalgic hinge. Dad repairs the shelf instead of arguing with its previous career.', delayed:{ days:1, text:'Latch returned with a dated hinge biography and Dad read the entire footnote aloud.', effect:{ relation:2, home:1 }, tags:['family','home','history','neighborhood'] } },
    choices:[
      { id:'hold-the-ladder', label:'SPEND THE EVENING HOLDING IT STILL', detail:'Dad repairs the brackets while Pip becomes a very small structural column.', hours:3, effect:{ energy:-9, relation:4, home:1 }, result:'The shelf stops remembering the dangerous part of its previous career.', delayed:{ days:1, text:'Dad added Pip\'s name to the shelf warranty in handwriting far too proud for a warranty.', effect:{ relation:2, home:2 }, tags:['family','home','construction','emotion'] } },
      { id:'object-brace', label:'OFFER AN OBJECT AS A CLEVER BRACE', detail:'A relevant possession can join the repair and gain a history of holding up the family home.', hours:1, itemTags:['construction','precision','home','power'], itemDurability:1, effect:{ energy:-3, relation:2, home:2 }, result:'The object takes one durability of responsibility and the shelf accepts the new management.', delayed:{ days:1, text:'The repaired shelf survived a full night and Dad has started showing it to visitors.', effect:{ relation:2, home:3, reputation:1 }, tags:['family','home','construction','parent-proud'] } },
      { id:'declare-art', label:'DECLARE THE LEAN AN ARTISTIC DECISION', detail:'Technically free. Socially expensive. Potentially fashionable.', hours:1, effect:{ knowledge:2, reputation:2, relation:-1 }, result:'Dad writes "intentional" on the wall in removable ink.', delayed:{ days:2, text:'A neighbor complimented the leaning shelf. Dad is furious that Pip may have been right.', effect:{ relation:2, reputation:2 }, tags:['family','home','reputation','truth'] } }
    ]
  },
  {
    id:'dinner-personhood', location:'kitchen', actor:'mom', minDay:2, repeatAfterDays:9,
    title:'Dinner has applied for legal personhood',
    summary:'The main course refuses to be served until somebody witnesses page fourteen. Mum has flour on every hand.',
    actorLine:'I support dinner\'s rights. I also support eating before midnight. These positions are becoming incompatible.',
    tags:['family','food','legal','truth'], expiresInDays:2,
    unattended:{ text:'Mum completed dinner\'s personhood form alone. Dinner now pays rent in soup.', effect:{ relation:1, energy:4 }, tags:['family','food','legal'] },
    neighborChoice:{ id:'ask-tavi-root-witness', label:'ASK TAVI FOR A ROOT WITNESS', detail:'Available because Tavi trusts Pip with one legally articulate lampmoss cutting.', residentId:'tavi', minRelationship:3, residentRelationshipGain:2, supplierStandingDelta:1, hours:1, effect:{ energy:-3, relation:3, knowledge:2 }, result:'Tavi\'s lampmoss signs as a botanical witness and dinner accepts the precedent.', delayed:{ days:1, text:'Dinner sent the witness a soup dividend. Tavi shared the receipt with Pip\'s parents.', effect:{ energy:7, relation:2, home:1 }, tags:['family','food','legal','neighborhood'] } },
    choices:[
      { id:'witness-form', label:'WITNESS THE FORM PROPERLY', detail:'Read every clause, including the one defining gravy as a dependent.', hours:2, effect:{ energy:-5, knowledge:4, relation:4 }, result:'Dinner signs with a sauce print. Mum looks relieved and slightly outnumbered.', delayed:{ days:1, text:'The newly legal dinner sent Pip a thank-you lunch in a registered envelope.', effect:{ energy:10, relation:2 }, tags:['family','food','legal','gift'] } },
      { id:'object-witness', label:'LET A RELEVANT OBJECT TESTIFY', detail:'Legal, truthful, social, or food-minded possessions may provide expert evidence.', hours:1, itemTags:['legal','truth','social','food'], itemDurability:1, effect:{ knowledge:2, relation:3 }, result:'The object gives testimony. Nobody is certain it was sworn in, but the form stops screaming.', delayed:{ days:1, text:'Dinner\'s application passed review because Pip\'s object supplied the only legible testimony.', effect:{ relation:3, reputation:2, energy:6 }, tags:['family','food','legal','truth','parent-proud'] } },
      { id:'pay-filing-fee', label:'PAY THE EXPEDITED FILING FEE', detail:'Municipal law becomes much faster when fed exactly twenty-four credits.', hours:1, cost:24, effect:{ relation:3, reputation:1 }, result:'A pneumatic tube swallows the fee and immediately declares dinner a small business.', delayed:{ days:2, text:'Dinner\'s first tax refund arrived. Mum quietly put Pip\'s filing fee back in the family jar.', effect:{ money:12, relation:2, home:1 }, tags:['family','food','legal','money'] } },
      { id:'eat-the-evidence', label:'EAT THE EVIDENCE BEFORE IT IS APPROVED', detail:'Pip is hungry. The ethical situation is extremely seasoned.', hours:1, effect:{ energy:16, relation:-4, reputation:-1 }, result:'The hearing ends for practical reasons. Mum uses Pip\'s full childhood name.', delayed:{ days:1, text:'Mum forgave the personhood incident but labeled every snack "POTENTIAL CITIZEN."', effect:{ relation:1, home:-1 }, tags:['family','food','truth'] } }
    ]
  },
  {
    id:'shellby-procession', location:'shore', actor:'shellby', minDay:2, repeatAfterDays:7,
    title:'Five smaller machine-shells are following Shellby',
    summary:'A municipal collector is counting legs nearby. Shellby keeps pretending this is unrelated.',
    actorLine:'Krrrp-bloop-bloop. The last bloop sounds legally worried.',
    tags:['glimmer','biology','legal','safety'], expiresInDays:2,
    unattended:{ text:'Shellby led the small procession into the Glimmer before the collector finished counting.', effect:{ relation:1, knowledge:1 }, tags:['glimmer','biology','legal'] },
    neighborChoice:{ id:'ask-oola-parcel-shelter', label:'ASK OOLA FOR A WALKING SHELTER', detail:'Available because Oola trusts Pip with one parcel spine that can carry living passengers.', residentId:'oola', minRelationship:3, residentRelationshipGain:2, supplierStandingDelta:1, hours:2, effect:{ energy:-5, relation:4, knowledge:2 }, result:'Oola fits the procession inside a parcel that walks itself past the collector.', delayed:{ days:1, text:'The walking shelter returned empty, upright, and covered in tiny shell thank-you stamps.', effect:{ relation:2, reputation:2 }, tags:['glimmer','biology','travel','neighborhood'] } },
    choices:[
      { id:'stand-in-way', label:'STAND BETWEEN THEM AND THE COLLECTOR', detail:'Pip is smaller than the clipboard. This improves the symbolism, not the safety.', hours:2, effect:{ energy:-10, relation:5, reputation:4 }, result:'The collector decides the paperwork is not rated for disproportionate courage.', delayed:{ days:1, text:'The shell procession returned with a polished button for Pip. Shellby looks offensively proud.', effect:{ relation:3, money:9 }, tags:['glimmer','biology','courage','gift','emotion'] } },
      { id:'object-hideout', label:'BUILD A HIDING PLACE FROM AN OBJECT', detail:'Safety, privacy, biology, or Glimmer-tagged objects can shelter the procession.', hours:1, itemTags:['safety','privacy','biology','glimmer'], itemDurability:1, effect:{ energy:-4, relation:3, knowledge:2 }, result:'The object becomes a temporary habitat and acquires several tiny tenants.', delayed:{ days:2, text:'The small machine-shells improved their borrowed shelter and returned it with impossible hinges.', effect:{ relation:3, home:2, knowledge:2 }, tags:['glimmer','biology','home','gift'] } },
      { id:'sell-location', label:'SELL THE COLLECTOR A VERY ACCURATE DIRECTION', detail:'Immediate money. Shellby will understand exactly what happened.', hours:1, effect:{ money:32, relation:-7, reputation:-2 }, result:'The collector pays. Shellby stops making eye contact with all eight eyes.', delayed:{ days:1, text:'The collector found only an empty spiral in the Glimmer. Auntie Grift heard who supplied the direction.', effect:{ reputation:-2, knowledge:2 }, tags:['glimmer','trade','truth','social'] } },
      { id:'map-drain', label:'LEAD THEM THROUGH THE MUNICIPAL KELP DRAINS', detail:'Slow, damp, and legal if nobody asks the kelp.', hours:3, effect:{ energy:-8, relation:4, knowledge:3 }, result:'Every shell reaches the far cove. Pip emerges wearing three forms and a seaweed tie.', delayed:{ days:1, text:'Municipal kelp mailed Pip an access token for future low-tide shortcuts.', effect:{ knowledge:3, reputation:1 }, tags:['glimmer','travel','access','legal'] } }
    ]
  },
  {
    id:'oracle-memory-price', location:'market', actor:'vendor', minDay:3, repeatAfterDays:8,
    title:'The Price Oracle has valued Auntie Grift\'s memory',
    summary:'It says one childhood afternoon is worth forty-five credits. Grift says the afternoon was badly maintained.',
    actorLine:'Do not look sentimental, sprout. Sentiment is how an oracle adds a zero.',
    tags:['market','trade','history','emotion'], expiresInDays:2,
    unattended:{ text:'Auntie Grift let the memory remain on the board. By closing time it had appreciated into gossip.', effect:{ relation:1, reputation:1 }, tags:['market','trade','history','social'] },
    neighborChoice:{ id:'ask-nibbin-countermelody', label:'ASK THE NIBBIN CHOIR FOR A COUNTER-MELODY', detail:'Available because the Choir trusts Pip enough to sing what the oracle omitted.', residentId:'nibbin', minRelationship:3, residentRelationshipGain:2, supplierStandingDelta:1, hours:2, effect:{ energy:-4, relation:4, knowledge:3 }, result:'The counter-melody restores the unpriced half of Grift\'s afternoon.', delayed:{ days:2, text:'The Price Oracle revised the memory to "not for sale; still in use." Grift sent the Choir a commission and Pip a look.', effect:{ relation:3, reputation:2 }, tags:['market','history','sound','neighborhood'] } },
    workChoice:{ id:'file-memory-as-training', label:'FILE THE AFTERNOON AS PAID TRAINING', detail:'Available because the Long Table now trusts Pip to recognize experience as labor instead of inventory.', minStanding:2, standingDelta:1, pressureDelta:-1, hours:1, effect:{ energy:-2, relation:4, knowledge:4, reputation:2 }, result:'Grift\'s afternoon becomes a paid training record. The Price Oracle removes the sale sticker and adds an hourly rate.', delayed:{ days:1, text:'The Long Table paid Grift for a training hour and posted the memory under "experience still owned by the worker."', effect:{ money:16, relation:2, reputation:2 }, tags:['market','work','history','truth','employment'] } },
    choices:[
      { id:'listen-memory', label:'SIT WITH GRIFT WHILE IT PLAYS', detail:'No purchase. Just two hours inside somebody else\'s ordinary afternoon.', hours:2, effect:{ energy:-4, relation:5, knowledge:4 }, result:'The memory contains no secret treasure, only young Grift laughing before she learned wholesale.', delayed:{ days:1, text:'Grift lowered one of Pip\'s old debts without mentioning the afternoon.', effect:{ money:18, relation:2 }, tags:['market','history','emotion','gift'] } },
      { id:'object-appraisal', label:'ASK AN OBJECT FOR A SECOND OPINION', detail:'Truth, history, trade, or emotion-tagged objects may challenge the oracle.', hours:1, itemTags:['truth','history','trade','emotion'], itemDurability:1, effect:{ knowledge:3, relation:3 }, result:'The object finds a hidden clause: memories cannot be priced while their owner is still using them.', delayed:{ days:1, text:'The Price Oracle posted a correction and credited Pip\'s object as an independent appraiser.', effect:{ reputation:4, relation:2, money:11 }, tags:['market','truth','history','trade'] } },
      { id:'buy-memory', label:'BUY THE MEMORY AND GIVE IT BACK', detail:'Forty-five credits for an afternoon Grift already owns in every way that matters.', hours:1, cost:45, effect:{ relation:7, reputation:2 }, result:'Grift calls it terrible business and puts the memory somewhere safe.', delayed:{ days:2, text:'Auntie Grift repaid the gesture with a premium customer referral.', effect:{ money:34, relation:2, reputation:3 }, tags:['market','business','gift','emotion'] } },
      { id:'resell-rumor', label:'SELL A RUMOR ABOUT WHAT THE MEMORY CONTAINS', detail:'Nobody has to know it mostly contains a sandwich.', hours:1, effect:{ money:27, relation:-5, reputation:3 }, result:'The rumor sells instantly. Grift recognizes Pip\'s phrasing instantly.', delayed:{ days:1, text:'The invented memory rumor returned as market fact and made honest prices slightly harder.', effect:{ reputation:-4, money:7 }, tags:['market','trade','social','truth'] } }
    ]
  },
  {
    id:'hushglass-heat-hearing', location:'district', actor:'sumi', minDay:4, repeatAfterDays:8,
    householdId:'hushglass-house',
    title:'Hushglass House has one night of heat and two contracts for it',
    summary:'Crooked Kettle can spare steam, the Long Table can build a duct, and neither agreement says who stays warm first.',
    actorLine:'The hatchlings need night heat. The street needs an agreement that still exists after breakfast.',
    tags:['neighborhood','home','power','legal','employment'], expiresInDays:2,
    unattended:{
      text:'Sumi rationed the last heat alone. The hatchlings slept in coats and the radiator entered one night of cold debt.',
      effect:{ relation:1 }, householdEffect:{ warmthDelta:-1, trustDelta:-1 },
      tags:['neighborhood','home','power','cold']
    },
    supplierChoice:{
      id:'borrow-kettle-steam', label:'BORROW KETTLE STEAM AGAINST NEXT WEEK',
      detail:'Available because Crooked Kettle has enough standing to make a public, reversible sacrifice.',
      minStanding:2, supplierStandingDelta:-2, hours:1, effect:{ energy:-3, relation:3, knowledge:2 },
      householdEffect:{ warmthDelta:2, trustDelta:1, agreementsDelta:1 },
      result:'Crooked Kettle opens one named valve. Hushglass receives heat and the supplier ledger records exactly what tomorrow owes.',
      delayed:{ days:1, text:'The borrowed steam returned as a shared refill shift instead of a private debt.', effect:{ relation:2, reputation:1 }, tags:['neighborhood','home','power','supplier'], householdReturn:{ warmthDelta:1, trustDelta:1, supplierStandingDelta:1, workStandingDelta:0, workPressureDelta:0, businessRatingGain:1, homeGain:1, residentId:'tavi', residentRelationshipGain:1, houseMark:'heat-share-mobile' } }
    },
    workChoice:{
      id:'commission-shared-duct', label:'COMMISSION THE LONG TABLE\'S SHARED DUCT',
      detail:'Available while Long Table standing is trusted and rivalry pressure has not become contested.',
      minStanding:2, maximumPressure:4, standingDelta:1, pressureDelta:-1, hours:2, cost:28, effect:{ energy:-6, relation:4, knowledge:3 },
      householdEffect:{ warmthDelta:2, trustDelta:2, agreementsDelta:1, supplierStandingDelta:1 },
      result:'The Long Table publishes the duct dimensions, credits Crooked Kettle for the valve, and leaves Hushglass holding the maintenance copy.',
      delayed:{ days:1, text:'The shared duct survived its first night and every household signed the same warm page.', effect:{ relation:2, reputation:2 }, tags:['neighborhood','home','construction','employment'], householdReturn:{ warmthDelta:2, trustDelta:1, supplierStandingDelta:1, workStandingDelta:1, workPressureDelta:-1, businessRatingGain:2, homeGain:1, residentId:'oola', residentRelationshipGain:1, houseMark:'heat-share-mobile' } }
    },
    neighborChoice:{
      id:'ask-oola-warm-parcel', label:'ASK OOLA TO WALK A HEAT CELL UP THE WALL',
      detail:'Available because Oola trusts Pip with a parcel whose destination is a sleeping household instead of a buyer.',
      residentId:'oola', minRelationship:3, residentRelationshipGain:2, supplierStandingDelta:1, hours:2, effect:{ energy:-5, relation:4, knowledge:2 },
      householdEffect:{ warmthDelta:1, trustDelta:2, agreementsDelta:1 },
      result:'Oola gives the heat cell a spine. It climbs the wall, knocks politely, and refuses a delivery fee.',
      delayed:{ days:1, text:'The walking heat cell returned with three hatchling handprints and a public route map.', effect:{ relation:2, reputation:2 }, tags:['neighborhood','home','travel','gift'], householdReturn:{ warmthDelta:2, trustDelta:1, supplierStandingDelta:1, workStandingDelta:0, workPressureDelta:-1, businessRatingGain:1, homeGain:1, residentId:'oola', residentRelationshipGain:1, houseMark:'heat-share-mobile' } }
    },
    petChoice:{
      id:'pet-audit-heat-share', label:'LET THE PET AUDIT WHO GETS WARM',
      detail:'A relevant assigned pet can make species and named-trait evidence part of the public heat ledger.',
      skillTags:['legal','emotion','family','trade','business','safety'], minLaborPoints:2, affectionGain:1,
      supplierStandingDelta:1, workPressureDelta:-1, hours:1, effect:{ energy:-2, relation:4, knowledge:3, reputation:1 },
      householdEffect:{ warmthDelta:2, trustDelta:3, agreementsDelta:1 },
      result:'The pet checks every valve, names every household, and refuses to certify a warm room beside an unexplained cold one.',
      delayed:{ days:1, text:'The pet-authored heat ledger returned with signatures from Hushglass, Crooked Kettle, and the Long Table.', effect:{ relation:2, reputation:2 }, tags:['neighborhood','home','legal','pet'], householdReturn:{ warmthDelta:2, trustDelta:1, supplierStandingDelta:1, workStandingDelta:1, workPressureDelta:0, businessRatingGain:1, homeGain:2, residentId:'oola', residentRelationshipGain:1, houseMark:'heat-share-mobile' } }
    },
    choices:[
      { id:'take-cold-shift', label:'TAKE THE FIRST COLD SHIFT WITH SUMI', detail:'Spend the night keeping company while the remaining heat is rationed by name.', hours:3, effect:{ energy:-8, relation:5 }, householdEffect:{ warmthDelta:0, trustDelta:2, agreementsDelta:1 }, result:'Nobody becomes warmer, but nobody is alone and the ration list stops pretending comfort is equal.', delayed:{ days:1, text:'Sumi returned the blanket with a written promise that companionship will not replace infrastructure.', effect:{ relation:2, home:1 }, tags:['neighborhood','home','emotion'], householdReturn:{ warmthDelta:1, trustDelta:1, supplierStandingDelta:0, workStandingDelta:0, workPressureDelta:0, businessRatingGain:0, homeGain:1, residentId:'tavi', residentRelationshipGain:0, houseMark:'heat-share-mobile' } } },
      { id:'object-heat-bridge', label:'BUILD A HEAT BRIDGE FROM AN OWNED OBJECT', detail:'Power, home, construction, precision, or safety objects can take one durability of public responsibility.', hours:1, itemTags:['power','home','construction','precision','safety'], itemDurability:1, effect:{ energy:-3, relation:3, knowledge:2 }, householdEffect:{ warmthDelta:2, trustDelta:2, agreementsDelta:1 }, result:'The object bridges one cold wall and gains a history of heating somebody else\'s night.', delayed:{ days:1, text:'The heat bridge held. Hushglass published the object\'s contribution beside the household bill.', effect:{ relation:2, reputation:2 }, tags:['neighborhood','home','power','construction'], householdReturn:{ warmthDelta:2, trustDelta:1, supplierStandingDelta:1, workStandingDelta:1, workPressureDelta:0, businessRatingGain:1, homeGain:2, residentId:'latch', residentRelationshipGain:1, houseMark:'heat-share-mobile' } } },
      { id:'buy-night-cell', label:'BUY ONE NIGHT CELL AT THE POSTED PRICE', detail:'Forty-two credits solve tonight without pretending purchase alone is a neighborhood agreement.', hours:1, cost:42, effect:{ relation:3, reputation:1 }, householdEffect:{ warmthDelta:1, trustDelta:1, agreementsDelta:0 }, result:'The cell warms the hatchlings. Sumi posts the receipt next to the still-unsolved heat loop.', delayed:{ days:1, text:'The empty night cell became a public meter housing and stopped being a private solution.', effect:{ relation:2, knowledge:2 }, tags:['neighborhood','home','money','truth'], householdReturn:{ warmthDelta:1, trustDelta:1, supplierStandingDelta:1, workStandingDelta:0, workPressureDelta:0, businessRatingGain:1, homeGain:1, residentId:'nibbin', residentRelationshipGain:1, houseMark:'heat-share-mobile' } } }
    ]
  },
  {
    id:'starspite-streak-refugee', location:'starspite', actor:'vesper', minDay:4, repeatAfterDays:10, requiresStarspite:true,
    title:'A giant patron believes Pip stole their winning streak',
    summary:'They are kneeling to make the accusation merely enormous. Vesper has brought the complete receipt history.',
    actorLine:'The patron is frightened, not correct. We can address either condition. Preferably both.',
    tags:['casino','truth','social','safety'], expiresInDays:2,
    unattended:{ text:'Vesper walked the patron through every receipt. They apologized to Pip by leaving an impractically large flower.', effect:{ relation:2, reputation:1 }, tags:['casino','truth','social'] },
    choices:[
      { id:'teach-receipts', label:'READ EVERY RECEIPT WITH THEM', detail:'A slow tour through independence, sample size, and why nobody is due.', hours:3, effect:{ energy:-7, knowledge:5, relation:5, reputation:2 }, result:'The patron finally blames variance, which is too abstract to threaten in a corridor.', delayed:{ days:1, text:'The former streak-believer now volunteers beside Starspite\'s exact-odds wall.', effect:{ relation:3, reputation:4, knowledge:2 }, tags:['casino','truth','knowledge','social'] } },
      { id:'object-demonstration', label:'LET A TRUTHFUL OBJECT DEMONSTRATE', detail:'Truth, precision, legal, or casino artifacts can testify without changing any outcome.', hours:1, itemTags:['truth','precision','legal','casino'], itemDurability:1, effect:{ knowledge:3, relation:3, reputation:2 }, result:'The object demonstrates fixed odds. It does not perform a lucky result on demand.', delayed:{ days:1, text:'Starspite added the object\'s demonstration to staff training with a full non-random provenance note.', effect:{ relation:3, reputation:4, money:14 }, tags:['casino','truth','precision','reputation'] } },
      { id:'buy-shuttle', label:'BUY THEM A QUIET SHUTTLE HOME', detail:'Sixty credits buys distance from the tables and a beverage that cannot make predictions.', hours:1, cost:60, effect:{ relation:4, reputation:3 }, result:'The patron leaves the casino before fear becomes another wager.', delayed:{ days:2, text:'The patron sent back the unused shuttle deposit and a note addressed to "the statistically independent tiny person."', effect:{ money:30, relation:2 }, tags:['casino','travel','gift','truth'] } },
      { id:'sell-charm', label:'SELL THEM A COMPLETELY USELESS LUCK CHARM', detail:'Profitable, legal, and against everything the wall of exact odds is trying to say.', hours:1, effect:{ money:48, relation:-7, reputation:-3 }, result:'The patron buys reassurance. Vesper records the transaction without blinking.', delayed:{ days:1, text:'The useless charm failed to control probability. Starspite refunded the patron and invoiced Pip for the lesson.', effect:{ money:-24, reputation:-4 }, tags:['casino','truth','legal','debt'] } }
    ]
  }
]);

// Every casino game's math is public data. Win sets, multipliers, RTP, and edge are
// rendered directly from these values and copied into each immutable play receipt.
export const CASINO_GAMES = Object.freeze([
  {
    id:'mobius-twelve', name:'Möbius Twelve', glyph:'∞', outcomes:12, winNumbers:[12], payoutMultiplier:11,
    stakes:[5,20,50], description:'The brass loop chooses one of twelve numbered waiting rooms. Pip backs room twelve.',
    outcomeLabel:'waiting room', color:'#f2bd67'
  },
  {
    id:'triple-moon', name:'Three-Moon Split', glyph:'◒', outcomes:16, winNumbers:[2,7,13], payoutMultiplier:5,
    stakes:[5,20,50], description:'Sixteen moons cross the glass. The three legally visible moons pay.',
    outcomeLabel:'moon', color:'#8bd9ef'
  },
  {
    id:'truth-coin', name:'Truth Coin', glyph:'◇', outcomes:2, winNumbers:[2], payoutMultiplier:2,
    stakes:[2,5,10], description:'A capped zero-edge game. Honest pays double; evasive keeps the stake.',
    outcomeLabel:'answer', color:'#8ce1bd'
  }
]);

// These are authored artifacts sold at posted prices, not random draws. Their
// provenance receipts explicitly say so and never borrow portal rarity odds.
export const CASINO_LOTS = Object.freeze([
  {
    id:'edge-compass', name:'House-Edge Compass', glyph:'⌁', price:180, rarity:'rare', rarityLabel:'Authored Artifact', rarityColor:'#6bc6ff', aura:'points toward disclosed disadvantages',
    subtitle:'FIXED-PROVENANCE TOOL · CASINO', description:'Points toward the nearest mathematical disadvantage and sighs if you proceed anyway.',
    provenance:'Posted-price lot from the Starspite honesty auction.', drawback:'It also points at bad sandwiches.', tags:['casino','truth','precision'], effect:{ knowledge:5, reputation:1 },
    triggerName:'when an exact disadvantage is disclosed', triggerTags:['casino','truth'], triggerBonus:1.7, baseValue:210, durability:7, installable:true
  },
  {
    id:'courtesy-void', name:'Courtesy Void in a Jar', glyph:'●', price:360, rarity:'exotic', rarityLabel:'Authored Artifact', rarityColor:'#ff79d7', aura:'politely absent',
    subtitle:'FIXED-PROVENANCE CONTAINER · SPACE', description:'Stores one awkward silence and releases it exactly when conversation improves.',
    provenance:'Posted-price lot from the Starspite honesty auction.', drawback:'The jar considers bedrooms a form of conversation.', tags:['casino','space','privacy','home'], effect:{ energy:8, home:3 },
    triggerName:'during private life in space', triggerTags:['space','privacy'], triggerBonus:2.1, baseValue:430, durability:5, installable:true
  },
  {
    id:'co-owned-exit', name:'Co-Owned Emergency Exit', glyph:'⇥', price:720, rarity:'legendary', rarityLabel:'Authored Artifact', rarityColor:'#ffc65c', aura:'already halfway elsewhere',
    subtitle:'FIXED-PROVENANCE DOOR · LEGAL', description:'An emergency exit jointly owned by both sides of the wall. Neither side accepts maintenance liability.',
    provenance:'Posted-price lot from the Starspite honesty auction.', drawback:'May open into a meeting about exits.', tags:['casino','travel','legal','home'], effect:{ energy:10, knowledge:7, home:4 },
    triggerName:'during legally complicated travel', triggerTags:['travel','legal'], triggerBonus:2.6, baseValue:900, durability:9, installable:true
  }
]);

export const HOME_UPGRADES = Object.freeze([
  { id:'shelf', name:'Dad’s Suspiciously Strong Shelf', cost:75, home:4, requirement:0, description:'Displays two installed objects and makes Dad visibly pleased.' },
  { id:'heating-organ', name:'Licensed Heating Organ', cost:180, home:8, requirement:4, description:'Warm rooms, calmer dinners, and +1 energy after every family activity.' },
  { id:'glimmer-window', name:'Glimmerglass Bay Window', cost:420, home:14, requirement:10, description:'Shows tomorrow’s weather-event family and improves mystery reactions.' },
  { id:'impossible-annex', name:'Small Impossible Annex', cost:950, home:26, requirement:22, description:'Adds a room whose inside has better financial prospects than its outside.' }
]);

export const PORTAL_UPGRADES = Object.freeze([
  { id:'charge-rack', name:'Secondhand Charge Rack', cost:95, level:1, description:'+2 maximum portal charges.' },
  { id:'gentle-overclock', name:'Gentle-ish Overclocker', cost:240, level:2, description:'+1 free charge at each new day; odds remain unchanged.' },
  { id:'parallel-aperture', name:'Parallel Aperture', cost:700, level:3, description:'Generate two independent items per activation for two charges; each keeps its own receipt.' },
  { id:'receipt-printer', name:'Probability Receipt Printer', cost:160, level:1, description:'Shows full entropy seed and raw rolls directly on item cards.' }
]);

export const BUSINESS_TYPES = Object.freeze([
  { id:'repair', name:'Tiny Repairs for Enormous Problems', cost:120, tags:['precision','construction','industry'], baseIncome:16, description:'Repair household things while standing inside them.' },
  { id:'food', name:'Questionable Lunch Forecasts', cost:105, tags:['food','weather','signal'], baseIncome:14, description:'Sell tomorrow’s menu today, then desperately make it true.' },
  { id:'oddities', name:'Pip’s Almost-Legal Oddities', cost:150, tags:['mystery','trade','legal'], baseIncome:18, description:'A bedroom storefront for objects with incomplete paperwork.' }
]);

// The alien web is a local deterministic simulation. Buyers are authored people,
// not disguised rarity rolls, and every price factor is exposed on its receipt.
export const BUSINESS_BUYERS = Object.freeze([
  {
    id:'choir-six', name:'Choir-of-One Six', glyph:'◌', relationKey:'mom', patience:3,
    favoriteTags:['sound','emotion','food','family'], avoidTags:['crime','debt'], callbackDays:1,
    bio:'Six mouths, one login, and a household that reviews parcels in harmony.',
    callback:'The Choir posted a six-part review. Only one mouth disliked the packaging.'
  },
  {
    id:'parcel-ancestor', name:'Parcel Ancestor Uv', glyph:'⌁', relationKey:'dad', patience:4,
    favoriteTags:['history','construction','home','precision'], avoidTags:['weather'], callbackDays:2,
    bio:'Claims to be the legal ancestor of every box. Dad follows the account.',
    callback:'Uv sent a photograph of the item installed inside a much older box.'
  },
  {
    id:'municipal-larva', name:'Municipal Larva 8B', glyph:'◍', relationKey:'shellby', patience:2,
    favoriteTags:['legal','biology','glimmer','safety'], avoidTags:['crime'], callbackDays:1,
    bio:'A junior government organism purchasing supplies before it grows a department.',
    callback:'Larva 8B filed a satisfied-customer permit and accidentally approved the bedroom.'
  },
  {
    id:'grifts-neighbor', name:'Auntie Grift’s Other Neighbor', glyph:'◇', relationKey:'vendor', patience:1,
    favoriteTags:['trade','fashion','money','mystery'], avoidTags:['truth'], callbackDays:1,
    bio:'Refuses to share a name until the return window closes.',
    callback:'The neighbor resold nothing. This is apparently their highest possible compliment.'
  },
  {
    id:'vesper-office', name:'Vesper Coil’s Night Office', glyph:'≣', relationKey:'vesper', patience:5,
    favoriteTags:['truth','casino','precision','space','travel'], avoidTags:['debt'], callbackDays:2,
    bio:'An after-hours compliance desk aboard Starspite. Every review includes the denominator.',
    callback:'The Night Office returned an audited thank-you note with all adjectives disclosed.'
  }
]);

export const BUSINESS_UPGRADES = Object.freeze([
  { id:'listing-nest', name:'Expandable Listing Nest', cost:90, rating:0, description:'+1 escrow listing slot. It chirps whenever a price changes.', effect:'listing slot +1' },
  { id:'translation-seal', name:'Translation Trust Seal', cost:180, rating:5, description:'+8% to disclosed buyer offers and +4% to counter ceilings.', effect:'offer ×1.08 · counter ceiling ×1.04' },
  { id:'family-packing-table', name:'Family Packing Table', cost:260, rating:8, description:'Buyer callbacks add +1 extra rating; also becomes visible beside the bed.', effect:'callback rating +1' },
  { id:'portal-fulfilment', name:'Portal Fulfilment Mouth', cost:520, rating:14, requiresPortal:true, description:'+2 listing slots and buyer callbacks arrive one day sooner. Portal draw odds do not change.', effect:'listing slots +2 · callbacks −1 day' }
]);

export const BUSINESS_BRANCHES = Object.freeze([
  { id:'repair-micro-renovation', businessId:'repair', name:'Micro-Renovation Wing', cost:230, rating:6, addedTags:['home','safety'], incomeBonus:7, offerMultiplier:1.06, description:'Specialize in repairs performed from inside the furniture.' },
  { id:'repair-emergency-insides', businessId:'repair', name:'Emergency Insides', cost:260, rating:6, addedTags:['power','access'], incomeBonus:9, offerMultiplier:1.04, description:'Enter appliances during emergencies and invoice by internal distance.' },
  { id:'food-climate-catering', businessId:'food', name:'Climate Catering', cost:215, rating:6, addedTags:['festival','trade'], incomeBonus:8, offerMultiplier:1.05, description:'Cater weather fronts before they arrive and apologize afterward.' },
  { id:'food-apology-lunch', businessId:'food', name:'Apology Lunch Division', cost:190, rating:6, addedTags:['emotion','family'], incomeBonus:6, offerMultiplier:1.07, description:'Edible apologies with legally optional forgiveness.' },
  { id:'oddities-provenance', businessId:'oddities', name:'Provenance Theatre', cost:280, rating:6, addedTags:['truth','history'], incomeBonus:7, offerMultiplier:1.08, description:'Every object receives a truthful past and a needlessly dramatic curtain.' },
  { id:'oddities-portal-consignment', businessId:'oddities', name:'Portal Consignments', cost:340, rating:8, addedTags:['travel','space'], incomeBonus:10, offerMultiplier:1.05, requiresPortal:true, description:'Sell across impossible distances without pretending distance changed the draw.' }
]);

export const PET_SPECIES = Object.freeze([
  { id:'tax-mite', name:'Tax-Mite', glyph:'✣', tags:['legal','money'], baseBonus:'Finds one loose credit after legal activities.' },
  { id:'sigh-hound', name:'Sigh-Hound', glyph:'⌁', tags:['emotion','safety'], baseBonus:'Softens energy costs when a family activity goes badly.' },
  { id:'pocket-moon', name:'Pocket Moon', glyph:'●', tags:['gravity','mystery'], baseBonus:'Improves gravity-triggered item reactions.' },
  { id:'receipt-eel', name:'Receipt Eel', glyph:'∿', tags:['business','glimmer'], baseBonus:'Adds a small bonus to daily business receipts.' },
  { id:'button-bird', name:'Button Bird', glyph:'❉', tags:['industry','fashion'], baseBonus:'Occasionally repairs one durability after an item is used.' },
  { id:'debt-hamster', name:'Debt Hamster', glyph:'◉', tags:['debt','money'], baseBonus:'Converts a little business loss into pet mass and affection.' }
]);

export const PET_TRAITS = Object.freeze([
  { id:'helpful', name:'Unreasonably Helpful', weight:300000, rarity:'common', tag:'family', effect:'Family activities gain +1 relationship.' },
  { id:'sniffer', name:'Tax-Scented', weight:210000, rarity:'common', tag:'legal', effect:'Legal and debt reactions pay +8%.' },
  { id:'pockets', name:'Has Additional Pockets', weight:180000, rarity:'common', tag:'trade', effect:'Business assets gain a small storage bonus.' },
  { id:'jealous', name:'Professionally Jealous', weight:120000, rarity:'curious', tag:'emotion', effect:'Gift reactions are stronger but make this pet grumble.' },
  { id:'weatherproof', name:'Weatherproof Inside-Out', weight:80000, rarity:'rare', tag:'weather', effect:'Weather activities cost 2 less energy.' },
  { id:'accountant', name:'Instinctive Accountant', weight:60000, rarity:'rare', tag:'business', effect:'Daily business income gains 12%.' },
  { id:'gravity', name:'Keeps Personal Gravity', weight:30000, rarity:'exotic', tag:'gravity', effect:'Gravity reactions gain +25%.' },
  { id:'ancestral', name:'Remembers Future Ancestors', weight:15000, rarity:'legendary', tag:'time', effect:'First reaction each day yields knowledge.' },
  { id:'million-smell', name:'Smells Million-to-One Events', weight:4900, rarity:'legendary', tag:'mystery', effect:'Warns when a receipt is extraordinary; never changes its odds.' },
  { id:'unknown', name:'[TRAIT STILL ARRIVING]', weight:100, rarity:'unknown', tag:'unknown', effect:'The world event treats this pet as a participant.' }
]);

export function catalogCombinationCount() {
  return ITEM_FORMS.length * CORE_BEHAVIORS.length * FUTURE_TRIGGERS.length * QUIRKS.length
    * MATERIALS.length * HISTORIES.length * CONDITIONS.length * STYLE_FAMILIES.length;
}
