(function (root, factory) {
  const data = factory();
  if (typeof module === 'object' && module.exports) module.exports = data;
  else root.HEXBOUND_DATA = data;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const COLORS = {
    ember: '#ff9a3c', glow: '#ffd36a', mint: '#75ffd1', violet: '#b27cff',
    cyan: '#60d7ff', ink: '#090b1a', cream: '#fff4d2', danger: '#ff5876',
    orange: '#ff9a3c', gold: '#ffd36a'
  };

  const FACTIONS = [
    {
      id: 'clockwork-coven', sigil: '◴', name: 'Clockwork Coven', epithet: 'Unionised witches from tomorrow',
      color: '#ff9a3c', accent: '#ffd36a', quote: 'The future is collective bargaining with broomsticks.',
      trait: 'Overtime Magic', detail: 'Buildings finish 30% faster and boroughs pay more Scrap.',
      mods: { buildSpeed: 1.30, scrapIncome: 1.20, attack: 1.00, move: 1.00, sight: 1.00, essence: 1.00, squad: 0 }
    },
    {
      id: 'boo-brigade', sigil: '☁', name: 'The Boo Brigade', epithet: 'Polite ghosts, alarming paperwork',
      color: '#72f5d0', accent: '#d9fff4', quote: 'Kindly surrender. We have filled in the haunting forms.',
      trait: 'Afterlife Dividend', detail: 'Every casualty creates 50% more Essence. Yes, every casualty.',
      mods: { buildSpeed: 1.00, scrapIncome: 1.00, attack: 0.95, move: 1.05, sight: 1.00, essence: 1.50, squad: 0 }
    },
    {
      id: 'moonwake-corsairs', sigil: '☠', name: 'Moonwake Corsairs', epithet: 'Pirates who stole the night shift',
      color: '#b27cff', accent: '#f0d8ff', quote: 'The moon was just sitting there, your honour.',
      trait: 'Anywhere Is A Harbour', detail: 'Ghost Pirate summons cost less and arrive as larger crews.',
      mods: { buildSpeed: 1.00, scrapIncome: 1.00, attack: 1.05, move: 1.08, sight: 1.00, essence: 1.00, squad: 1, summonDiscount: 0.72 }
    },
    {
      id: 'thorn-court', sigil: '♛', name: 'Thorn Court on Tour', epithet: 'Fairytale royalty without a venue',
      color: '#ff5f9e', accent: '#ffc0db', quote: 'We were deposed, but the catering remains excellent.',
      trait: 'Royal Progress', detail: 'Claiming a rooftop is cheaper; fresh boroughs pulse-heal nearby squads.',
      mods: { buildSpeed: 1.05, scrapIncome: 1.00, attack: 1.00, move: 1.00, sight: 1.00, essence: 1.00, squad: 0, claimDiscount: 0.68 }
    },
    {
      id: 'graveyard-shift', sigil: '♜', name: 'The Graveyard Shift', epithet: 'Skeleton night workers, clocked in forever',
      color: '#a9c7ff', accent: '#edf4ff', quote: 'No pulse. Full dental. Very competitive pension.',
      trait: 'Bare-Bones Logistics', detail: 'Squads field two extra fighters but march a little slower.',
      mods: { buildSpeed: 1.00, scrapIncome: 1.00, attack: 0.98, move: 0.92, sight: 1.00, essence: 1.00, squad: 2 }
    },
    {
      id: 'lantern-republic', sigil: '✦', name: 'Tin Lantern Republic', epithet: 'Small armour, enormous civic pride',
      color: '#ffd447', accent: '#fff3b0', quote: 'Our constitution is fireproof up to a point.',
      trait: 'Many Little Lights', detail: 'Squads train 25% faster and Watchmoons reveal a wider area.',
      mods: { buildSpeed: 1.00, scrapIncome: 1.00, attack: 0.94, move: 1.00, sight: 1.35, essence: 1.00, squad: 1, trainSpeed: 1.25 }
    },
    {
      id: 'once-upon-a-mob', sigil: '✺', name: 'Once-Upon-a-Mob', epithet: 'Background villagers demand top billing',
      color: '#9be36c', accent: '#e6ffc9', quote: 'We have names now. The plot is in serious trouble.',
      trait: 'Ensemble Cast', detail: 'Glow income is higher and every trained squad gains one extra fighter.',
      mods: { buildSpeed: 1.00, scrapIncome: 1.00, glowIncome: 1.22, attack: 1.00, move: 1.00, sight: 1.00, essence: 1.00, squad: 1 }
    },
    {
      id: 'temporal-mischief', sigil: '⌛', name: 'Office of Temporal Mischief', epithet: 'Civil servants from several Thursdays',
      color: '#60d7ff', accent: '#d5f7ff', quote: 'Your invasion permit expired tomorrow.',
      trait: 'Flexible Deadline', detail: 'Squads move faster and all field powers recover sooner.',
      mods: { buildSpeed: 1.00, scrapIncome: 1.00, attack: 1.00, move: 1.12, sight: 1.12, essence: 1.00, squad: 0, cooldown: 0.72 }
    }
  ];

  const DOCTRINES = [
    {
      id:'midnight-union', factionId:'clockwork-coven', key:'9', icon:'⚙', name:'Midnight Union', color:'#ff9a3c',
      detail:'Mass Picket Familiars while cheaper Moon Moots turn every claimed roof into a shift office.',
      variant:{unitId:'mobs',name:'Picket Familiar Union',icon:'⚒',role:'Durable mass line · collective',members:3,hp:1.08,damage:.90,train:.90,glow:1.05},
      empire:{buildingId:'moot',buildingGlow:.78,buildingScrap:.78,buildingTime:.80,buildingHp:1.15,incomeScrap:1.06}
    },
    {
      id:'borrowed-tomorrow', factionId:'clockwork-coven', key:'0', icon:'»', name:'Borrowed Tomorrow', color:'#60d7ff',
      detail:'Tomorrow Patrols arrive early and Watchmoons unfold before the present can object.',
      variant:{unitId:'brooms',name:'Tomorrow Patrol',icon:'⌁',role:'Pre-arrived time scouts',speed:1.22,sight:1.15,hp:.90,train:.75,scrap:1.15},
      empire:{buildingId:'watch',buildingGlow:.78,buildingScrap:.78,buildingTime:.75,powerId:'parade',powerCooldown:.80}
    },
    {
      id:'universal-aftercare', factionId:'boo-brigade', key:'9', icon:'✚', name:'Universal Aftercare', color:'#75ffd1',
      detail:'Hospice Haunters make the line hard to erase while Second Wind becomes public healthcare.',
      variant:{unitId:'lanterns',name:'Hospice Haunters',icon:'☁',role:'Spectral care formation',members:2,hp:1.20,damage:.88,train:.90},
      empire:{powerId:'reinforce',powerCost:.70,powerCooldown:.80,cap:30}
    },
    {
      id:'spectral-audit', factionId:'boo-brigade', key:'0', icon:'§', name:'Spectral Audit', color:'#d9fff4',
      detail:'Red-Tape Apparitions prosecute from absurd range while cheap Watchmoons file every roof.',
      variant:{unitId:'hexbows',name:'Red-Tape Apparitions',icon:'¶',role:'Long-range compliance choir',damage:1.12,range:35,speed:1.05,hp:.90,scrap:1.15},
      empire:{buildingId:'watch',buildingGlow:.80,buildingScrap:.80,incomeScrap:1.08}
    },
    {
      id:'letters-of-marque', factionId:'moonwake-corsairs', key:'9', icon:'☠', name:'Letters of Marque', color:'#b27cff',
      detail:'Boarding Parties hit harder and every explored roof becomes a discounted pirate harbour.',
      variant:{unitId:'mobs',name:'Moonwake Boarding Party',icon:'⚔',role:'Fast assault deckhands',members:1,damage:1.20,speed:1.08,hp:1.05,train:1.05},
      empire:{powerId:'pirates',powerCost:.78,powerCooldown:.90}
    },
    {
      id:'black-sail-logistics', factionId:'moonwake-corsairs', key:'0', icon:'⚑', name:'Black-Sail Logistics', color:'#f0d8ff',
      detail:'Crow’s-Nest Cutters map the night while bargain Moon Moots make forward mustering the economy.',
      variant:{unitId:'brooms',name:'Crow’s-Nest Cutters',icon:'⌁',role:'Long-sight corsair scouts',speed:1.18,sight:1.25,range:20,damage:.92},
      empire:{buildingId:'moot',buildingGlow:.70,buildingScrap:.70,buildingTime:.80,buildingHp:1.10,incomeScrap:1.06}
    },
    {
      id:'hedge-knight-tour', factionId:'thorn-court', key:'9', icon:'♛', name:'Hedge-Knight Tour', color:'#ff5f9e',
      detail:'Hedge Knight Processions anchor the war while reinforced Bridgeheads become travelling castles.',
      variant:{unitId:'lanterns',name:'Hedge Knight Procession',icon:'♜',role:'Royal armoured retinue',hp:1.22,damage:1.08,speed:.92,scrap:1.10},
      empire:{buildingId:'bridgehead',buildingGlow:.80,buildingScrap:.80,buildingTime:.90,buildingHp:1.25}
    },
    {
      id:'open-banquet', factionId:'thorn-court', key:'0', icon:'♨', name:'Open Banquet', color:'#ffc0db',
      detail:'Peasant Guest Lists flood the procession and discounted Boroughs ensure every roof gets pudding.',
      variant:{unitId:'mobs',name:'Peasant Guest List',icon:'♟',role:'Huge ceremonial crowd',members:4,hp:.92,damage:.92,train:.82},
      empire:{buildingId:'borough',buildingGlow:.82,buildingScrap:.82,incomeGlow:1.07,cap:20}
    },
    {
      id:'closed-casket-formation', factionId:'graveyard-shift', key:'9', icon:'▣', name:'Closed-Casket Formation', color:'#a9c7ff',
      detail:'Coffin Phalanxes move slowly, refuse politely, and make Bridgeheads nearly impossible to evict.',
      variant:{unitId:'lanterns',name:'Coffin Phalanx',icon:'▣',role:'Extremely heavy night line',members:1,hp:1.32,damage:1.08,speed:.78},
      empire:{buildingId:'bridgehead',buildingGlow:1.05,buildingScrap:1.05,buildingHp:1.30}
    },
    {
      id:'graveyard-collective', factionId:'graveyard-shift', key:'0', icon:'☷', name:'Graveyard Collective', color:'#edf4ff',
      detail:'Night Shift Crowds trade individual glamour for enormous, cheap formations and more room.',
      variant:{unitId:'mobs',name:'Night Shift Crowd',icon:'☷',role:'Mass skeleton workforce',members:5,hp:.86,damage:.88,train:.72,glow:.90},
      empire:{incomeScrap:1.04,cap:50}
    },
    {
      id:'every-window-fortress', factionId:'lantern-republic', key:'9', icon:'✦', name:'Every Window a Fortress', color:'#ffd447',
      detail:'Balcony Beacon Choirs own long lanes while cheap Watchmoons turn districts into civic lookout posts.',
      variant:{unitId:'hexbows',name:'Balcony Beacon Choir',icon:'➶',role:'Long-lane civic marksfolk',range:50,sight:1.15,hp:1.12,damage:.98},
      empire:{buildingId:'watch',buildingGlow:.72,buildingScrap:.72,buildingTime:.82,buildingHp:1.35}
    },
    {
      id:'tiny-marches', factionId:'lantern-republic', key:'0', icon:'✺', name:'Tiny Marches', color:'#fff3b0',
      detail:'Pocket Civic Legions train in crowds, move as a chorus, and fit a suspicious number into one borough.',
      variant:{unitId:'mobs',name:'Pocket Civic Legion',icon:'✺',role:'Very numerous little lights',members:5,speed:1.13,hp:.88,damage:.86,train:.70},
      empire:{buildingId:'moot',buildingGlow:.85,buildingScrap:.85,cap:60}
    },
    {
      id:'everyone-protagonist', factionId:'once-upon-a-mob', key:'9', icon:'!', name:'Everyone Is the Protagonist', color:'#9be36c',
      detail:'Lead Role Riots field fewer stars, but every one has plot armour and an alarming monologue.',
      variant:{unitId:'mobs',name:'Lead Role Riot',icon:'!',role:'Elite protagonist rabble',members:-1,damage:1.22,hp:1.12,speed:1.05,glow:1.15,scrap:1.10,train:1.05},
      empire:{incomeGlow:1.08}
    },
    {
      id:'subplot-chorus', factionId:'once-upon-a-mob', key:'0', icon:'…', name:'Subplot Chorus', color:'#e6ffc9',
      detail:'A Chorus of Subplots fills the skyline with cheap arrows and Boroughs reserve room for the entire cast.',
      variant:{unitId:'hexbows',name:'Chorus of Subplots',icon:'➶',role:'Mass supporting-cast volleys',members:5,damage:.84,range:25,train:.78,glow:.90},
      empire:{buildingId:'borough',buildingGlow:.90,buildingScrap:.90,cap:45}
    },
    {
      id:'preapproved-invasion', factionId:'temporal-mischief', key:'9', icon:'✓', name:'Preapproved Invasion', color:'#60d7ff',
      detail:'Advance Notice Patrols are scouted, stamped, and halfway across the bridge before recruitment begins.',
      variant:{unitId:'brooms',name:'Advance Notice Patrol',icon:'⌛',role:'Pre-filed temporal scouts',speed:1.30,sight:1.20,hp:.85,train:.65},
      empire:{buildingId:'watch',buildingGlow:.85,buildingScrap:.85,buildingTime:.65}
    },
    {
      id:'deadline-extension', factionId:'temporal-mischief', key:'0', icon:'∞', name:'Deadline Extension', color:'#d5f7ff',
      detail:'Adjournment Guards keep battles pending while emergency Second Wind paperwork clears quickly.',
      variant:{unitId:'lanterns',name:'Adjournment Guard',icon:'∞',role:'Deferred heavy formation',hp:1.24,damage:1.08,speed:.90,train:.90},
      empire:{powerId:'reinforce',powerCost:.90,powerCooldown:.70,cap:25}
    }
  ];

  const MAP_TOPOLOGIES = {
    tuesday: {
      id:'clockface-spiral', name:'Clockface Spiral', strategy:'An outer hour-ring and an inner shortcut chain reward timed flanking through the Clockheart.',
      anchors:[
        [520,250,'Pendulum Porch'],[850,170,'Monday Leak'],[1210,150,'Thirteenth Belfry'],[1580,210,'Tomorrow Gutter'],[1890,390,'Wednesday Refusal'],[2110,600,'Last Minute'],[2010,1070,'Clockfall Terrace'],
        [330,750,'Overtime Landing'],[620,570,'Half-Past Hearth'],[900,440,'Secondhand Square'],[1210,520,'Minute Market'],[1580,480,'Hourglass Hall'],[2090,760,'Final Chime'],
        [470,1110,'Sundial Slum'],[820,1280,'Yesterday Yard'],[1180,1320,'Noonless Nook'],[1550,1250,'Late Bell Roof'],[1810,1080,'Morrow Mooring'],[1210,890,'Clockheart']
      ],
      links:[[7,0],[0,1],[1,2],[2,3],[3,4],[4,5],[5,12],[12,6],[6,17],[17,16],[16,15],[15,14],[14,13],[13,7],[7,8],[8,9],[9,10],[10,11],[11,12],[8,0],[8,13],[9,1],[9,14],[10,2],[10,18],[18,15],[18,16],[18,11],[11,3],[11,17]]
    },
    'gargoyle-garage': {
      id:'six-level-switchback', name:'Six-Level Switchback', strategy:'Three parking decks and alternating ramps create broad parallel fronts around dangerous tow roofs.',
      anchors:[
        [430,260,'Ramp A'],[830,250,'Level 2B'],[1230,280,'Ticket Crypt'],[1630,250,'Level 4-Ever'],[2030,300,'Gargoyle Wash'],[2180,500,'Exit Maybe'],[1900,560,'Tow Roost'],
        [300,760,'Entry Spiral'],[650,650,'Compact Coven'],[1050,770,'Lost Car Court'],[1450,650,'Moonroof Row'],[1800,780,'Stone Attendant Bay'],[2110,780,'Final Barrier'],
        [360,1210,'Basement A'],[760,1120,'Basement B'],[1160,1240,'Basement 6B'],[1560,1120,'Oil-Slick Shrine'],[1960,1200,'Long-Term Parking'],[2150,1030,'Ramp to Nowhere']
      ],
      links:[[0,1],[1,2],[2,3],[3,4],[4,5],[5,12],[4,6],[6,11],[6,12],[7,8],[8,9],[9,10],[10,11],[11,12],[13,14],[14,15],[15,16],[16,17],[17,18],[18,12],[7,0],[0,8],[8,1],[1,9],[9,2],[2,10],[10,3],[3,11],[11,4],[4,12],[7,13],[8,14],[9,15],[10,16],[11,17]]
    },
    'royal-table': {
      id:'banquet-spine', name:'Banquet Spine', strategy:'A fast central table runner is flanked by plate circuits above and below the gravy ravine.',
      anchors:[
        [590,740,'Platter West'],[880,760,'Soup Course'],[1190,740,'Royal Centrepiece'],[1500,760,'Gravy Gate'],[1800,740,'Platter East'],[500,330,'Salt Tower'],[850,300,'Pepper Tower'],
        [300,760,"Page's Place"],[1200,300,'Golden Plate'],[1570,320,"Queen's Plate"],[2050,350,'Dessert Keep'],[500,1170,'Crumb Court'],[2120,760,'Last Chair'],
        [850,1200,'Pudding Port'],[1200,1160,'Pea Navy'],[1570,1200,'Goblet Dock'],[2050,1160,'Napkin Bastion'],[1080,520,'Candle Crown'],[1320,960,'Under-Table Embassy']
      ],
      links:[[7,0],[0,1],[1,2],[2,3],[3,4],[4,12],[5,6],[6,8],[8,9],[9,10],[11,13],[13,14],[14,15],[15,16],[7,5],[0,5],[1,6],[1,17],[17,2],[17,8],[2,8],[3,9],[4,10],[12,10],[7,11],[0,11],[1,13],[2,14],[2,18],[18,3],[18,14],[3,15],[4,16],[12,16]]
    },
    'dragon-metro': {
      id:'sleeping-ribcage', name:'Sleeping Ribcage', strategy:'The main rail runs through the dragon while paired ribs support upper and lower ambush loops.',
      anchors:[
        [520,760,'West Tooth'],[820,720,'First Rib'],[1190,760,'Heart Station'],[1560,720,'Second Rib'],[1870,760,'East Tooth'],[450,350,'Upper Molar'],[780,250,'Left Lung'],
        [280,760,'Tail Platform'],[1190,170,'Dreaming Brain'],[1600,250,'Right Lung'],[1990,350,'Upper Fang'],[450,1160,'Lower Molar'],[2120,760,'Snout Terminus'],
        [780,1270,'Stomach Loop'],[1190,1350,'Firebelly'],[1600,1270,'Right Claw'],[1990,1160,'Lower Fang'],[1190,500,'Warm Throat'],[1190,1020,'Sleeping Heart']
      ],
      links:[[7,0],[0,1],[1,2],[2,3],[3,4],[4,12],[5,6],[6,8],[8,9],[9,10],[11,13],[13,14],[14,15],[15,16],[7,5],[7,11],[0,5],[0,11],[1,6],[1,13],[2,17],[17,8],[17,6],[17,9],[2,18],[18,14],[18,13],[18,15],[3,9],[3,15],[4,10],[4,16],[12,10],[12,16]]
    },
    'cloud-annex': {
      id:'department-constellation', name:'Department Constellation', strategy:'Three floating office clusters offer several skybridge transfers and no single compulsory choke.',
      anchors:[
        [430,430,'Left Reception'],[670,280,'Forecast Desk'],[720,650,'Flying Archive'],[980,420,'Accounts Updraft'],[1220,250,'Paradise Cubicle'],[1740,300,'Halo Resources'],[2040,430,'Executive Nimbus'],
        [300,760,'Ground Floor'],[1470,430,'Central Lift'],[980,980,'Lower Accounts'],[1220,1160,'Cloud Cafeteria'],[1740,1080,'Rain Department'],[2110,760,'Golden Parachute'],
        [430,1090,'Complaints Cloud'],[720,1220,'Left Annex'],[1470,980,'Lower Lift'],[2040,1110,'Thunder Payroll'],[1740,720,'East Reception'],[1220,720,'Open-Plan Heaven']
      ],
      links:[[7,0],[0,1],[1,2],[2,14],[14,13],[13,7],[0,2],[2,13],[3,4],[4,8],[8,18],[18,15],[15,10],[10,9],[9,3],[3,18],[4,18],[9,18],[10,18],[5,6],[6,12],[12,16],[16,11],[11,17],[17,5],[6,17],[17,12],[1,4],[2,3],[2,18],[14,9],[14,10],[4,5],[8,5],[8,17],[15,17],[10,11],[15,11]]
    },
    'witch-mall': {
      id:'escalator-atrium', name:'Escalator Atrium', strategy:'Three shopping levels are stitched by diagonal escalators whose direction changes the best mass route.',
      anchors:[
        [430,300,'Food Court West'],[760,260,'Moonwear'],[1120,330,'Atrium North'],[1440,260,'Crystal Kiosk'],[1800,300,'Food Court East'],[2110,450,'Roof Cinema'],[1930,560,'Parking Broom'],
        [300,760,'Service Door'],[650,680,'West Escalator'],[1010,780,'Dead Fountain'],[1370,650,'Central Atrium'],[1760,780,'East Escalator'],[2110,760,'Closing-Time Gate'],
        [380,1190,'Bargain Crypt'],[760,1120,'Lost and Found'],[1120,1250,'Basement Arcade'],[1460,1120,'Potion Outlet'],[1810,1230,'Midnight Sale'],[2080,1080,'Backroom Portal']
      ],
      links:[[0,1],[1,2],[2,3],[3,4],[4,5],[5,12],[4,6],[6,11],[6,12],[7,8],[8,9],[9,10],[10,11],[11,12],[13,14],[14,15],[15,16],[16,17],[17,18],[18,12],[7,0],[8,1],[9,2],[10,3],[11,4],[7,13],[8,14],[9,15],[10,16],[11,17],[0,8],[1,9],[2,10],[3,11],[4,12],[13,8],[15,10],[17,12]]
    }
  };

  const MAPS = [
    { id: 'tuesday', name: 'Rooftops at the End of Tuesday', kicker: 'The clocks refuse to strike Wednesday.', tint: '#16223b', seed: 1601, hazard: 'Clock gusts occasionally haste anyone on a bridge.' },
    { id: 'gargoyle-garage', name: 'Gargoyle Parking Garage', kicker: 'Level 6B has been circling for centuries.', tint: '#241b38', seed: 1602, hazard: 'Stone attendants wake near contested claims.' },
    { id: 'royal-table', name: "The King’s Very Long Dining Table", kicker: 'Mind the gravy ravine. The peas have formed a navy.', tint: '#352017', seed: 1603, hazard: 'Candelabra lanes reveal armies but speed income.' },
    { id: 'dragon-metro', name: 'Subway Inside a Sleeping Dragon', kicker: 'Delays expected due to being digested.', tint: '#182c29', seed: 1604, hazard: 'Warm breath vents briefly reveal the fog.' },
    { id: 'cloud-annex', name: 'Cloud Nine Budget Annex', kicker: 'Paradise was downsized to an open-plan office.', tint: '#17263a', seed: 1605, hazard: 'Loose memos become roaming resource gusts.' },
    { id: 'witch-mall', name: 'Midnight Mall of the Last Witch', kicker: 'Everything must go. Especially the customers.', tint: '#2e1933', seed: 1606, hazard: 'Dead escalators become fast one-way bridges.' }
  ];

  const MAP_MECHANICS = {
    tuesday: {
      id: 'chronogust', icon: 'II', title: 'Chronogust Bridges', color: '#60d7ff',
      first: 7, period: 24, warning: 5, duration: 7,
      effect: 'Lit bridges become time-streams. Squads crossing them move 65% faster.',
      counterplay: 'Stage formations beside a bridge, then launch when the clocks flare.'
    },
    'gargoyle-garage': {
      id: 'gargoyle-tow', icon: 'G6', title: 'Gargoyle Tow Shift', color: '#b27cff',
      first: 8, period: 27, warning: 6, duration: 8,
      effect: 'Contested claim roofs wake their stone attendants, slowing and chipping every nearby army.',
      counterplay: 'Commit enough force to clear a roof, or disengage before the tow shift begins.'
    },
    'royal-table': {
      id: 'banquet-bell', icon: 'FEAST', title: 'Royal Banquet Bell', color: '#ffd36a',
      first: 6, period: 25, warning: 5, duration: 8,
      effect: 'The candelabra blaze. Finished Boroughs produce 65% more Glow and Scrap.',
      counterplay: 'Spread before the bell; a wide kingdom eats better than a cramped castle.'
    },
    'dragon-metro': {
      id: 'dragon-breath', icon: 'DRGN', title: 'Dragon Breath Arrival', color: '#75ffd1',
      first: 9, period: 28, warning: 6, duration: 7,
      effect: 'A warm exhale rolls through the tunnels and temporarily reveals every army.',
      counterplay: 'Read the countdown, reposition before exposure, and raid while the rival is visible.'
    },
    'cloud-annex': {
      id: 'memo-windfall', icon: 'MEMO', title: 'Loose Memo Windfall', color: '#9be8ff',
      first: 7, period: 23, warning: 5, duration: 6,
      effect: 'Each finished player district catches a packet of airborne Glow and Scrap.',
      counterplay: 'Claim broadly: every completed district makes the next windfall larger.'
    },
    'witch-mall': {
      id: 'escalator-rush', icon: '>>', title: 'Midnight Escalator Rush', color: '#ff5f9e',
      first: 5, period: 20, warning: 5, duration: 9,
      effect: 'Bridge escalators alternate eastbound and westbound, boosting matching squads by 55%.',
      counterplay: 'Time a raid with the arrows; pushing against them gains nothing.'
    }
  };

  MAPS.forEach(map => { map.mechanic = MAP_MECHANICS[map.id]; map.topology = MAP_TOPOLOGIES[map.id]; });

  const UNITS = [
    { id: 'mobs', key: 'Q', name: 'Mischief Mob', icon: '⚔', role: 'Line squad · 10', members: 10, glow: 70, scrap: 18, train: 2.4, speed: 74, range: 58, damage: 7.5, hp: 26, sight: 185, color: '#ffb15b' },
    { id: 'hexbows', key: 'W', name: 'Hexbow Choir', icon: '➶', role: 'Ranged squad · 8', members: 8, glow: 62, scrap: 42, train: 3.0, speed: 66, range: 205, damage: 6.2, hp: 19, sight: 215, color: '#73e6ff' },
    { id: 'brooms', key: 'E', name: 'Broom Patrol', icon: '⌁', role: 'Scout squad · 6', members: 6, glow: 54, scrap: 38, train: 2.1, speed: 118, range: 76, damage: 5.6, hp: 18, sight: 290, color: '#d18cff', scout: true },
    { id: 'lanterns', key: 'R', name: 'Lantern Guard', icon: '♜', role: 'Heavy squad · 5', members: 5, glow: 110, scrap: 88, train: 4.0, speed: 50, range: 70, damage: 13.5, hp: 52, sight: 165, color: '#ffd45c' }
    ,{ id: 'overtime-witches', key: 'T', name: 'Overtime Witchpack', icon: '⏱', role: 'Builder-command · 7', members: 7, glow: 96, scrap: 72, train: 3.4, speed: 78, range: 185, damage: 8.2, hp: 22, sight: 220, color: '#ff9a3c', signatureOf: 'clockwork-coven', passive: 'work-aura', passiveLabel: 'Nearby construction runs 50% faster' },
    { id: 'audit-wraiths', key: 'T', name: 'Audit Wraiths', icon: '§', role: 'Essence auditors · 8', members: 8, glow: 104, scrap: 76, train: 3.6, speed: 82, range: 165, damage: 7.1, hp: 21, sight: 235, color: '#75ffd1', signatureOf: 'boo-brigade', passive: 'death-audit', passiveLabel: 'Nearby casualties yield 50% more Essence' },
    { id: 'deckfall-raiders', key: 'T', name: 'Deckfall Raiders', icon: '☠', role: 'Forward muster · 11', members: 11, glow: 112, scrap: 64, train: 3.3, speed: 92, range: 70, damage: 8.5, hp: 25, sight: 195, color: '#b27cff', signatureOf: 'moonwake-corsairs', passive: 'forward-muster', passiveLabel: 'Musters from your district nearest the rival Clock' },
    { id: 'briar-retinue', key: 'T', name: 'Briar Retinue', icon: '♛', role: 'Royal sustain · 6', members: 6, glow: 118, scrap: 92, train: 4.0, speed: 62, range: 115, damage: 7.6, hp: 32, sight: 210, color: '#ff5f9e', signatureOf: 'thorn-court', passive: 'healing-aura', passiveLabel: 'Automatically heals nearby friendly squads' },
    { id: 'coffin-union', key: 'T', name: 'Coffin Union Local 13', icon: '▣', role: 'Reassembling line · 12', members: 12, glow: 105, scrap: 96, train: 4.3, speed: 48, range: 62, damage: 8.8, hp: 31, sight: 170, color: '#a9c7ff', signatureOf: 'graveyard-shift', passive: 'one-reassembly', passiveLabel: 'Reassembles once at 45% strength' },
    { id: 'pocket-paladins', key: 'T', name: 'Pocket Paladin Parade', icon: '✦', role: 'Marching chorus · 14', members: 14, glow: 108, scrap: 84, train: 3.2, speed: 76, range: 54, damage: 5.2, hp: 17, sight: 190, color: '#ffd447', signatureOf: 'lantern-republic', passive: 'march-aura', passiveLabel: 'Nearby squads march 12% faster' },
    { id: 'plot-rioters', key: 'T', name: 'Plot-Twist Rioters', icon: '!', role: 'Last-act mob · 15', members: 15, glow: 86, scrap: 45, train: 2.8, speed: 72, range: 58, damage: 6.5, hp: 18, sight: 180, color: '#9be36c', signatureOf: 'once-upon-a-mob', passive: 'last-act', passiveLabel: 'Damage rises as the cast gets smaller' },
    { id: 'deadline-dragoons', key: 'T', name: 'Deadline Dragoons', icon: '⌛', role: 'Time-lane cavalry · 7', members: 7, glow: 100, scrap: 82, train: 3.1, speed: 105, range: 125, damage: 8.0, hp: 24, sight: 225, color: '#60d7ff', signatureOf: 'temporal-mischief', passive: 'deadline-dash', passiveLabel: 'New move orders gain 60% speed for 3 seconds' }
  ];

  const FORMATION_ROLES = [
    { unitId:'mobs', silhouette:'wedge-crowd', formation:'wedge', equipment:'blade', detail:'A noisy triangular press of blades and improvised courage' },
    { unitId:'hexbows', silhouette:'volley-hoods', formation:'ranks', equipment:'hex-bow', detail:'Disciplined firing ranks with unmistakable crescent bows' },
    { unitId:'brooms', silhouette:'broom-riders', formation:'diamond', equipment:'broom', detail:'Loose diamond scouts carried by long diagonal broom profiles' },
    { unitId:'lanterns', silhouette:'lantern-wall', formation:'wall', equipment:'lantern-shield', detail:'A compact wall of broad, glowing lantern shields' }
  ];

  const FORMATION_KITS = [
    { id:'clockwork-picket', factionId:'clockwork-coven', motif:'gears', headgear:'cog-cap', banner:'swallowtail', material:'#2c2632', trim:'#ff9a3c', light:'#ffd36a', emblem:'XII', detail:'Copper picket standards, cog caps, and union-orange clockwork trim' },
    { id:'spectral-civil-service', factionId:'boo-brigade', motif:'paperwork', headgear:'file-hood', banner:'notched', material:'#182b34', trim:'#75ffd1', light:'#d9fff4', emblem:'FILE', detail:'Translucent file hoods beneath politely notched civil-service standards' },
    { id:'moonwake-deck-crew', factionId:'moonwake-corsairs', motif:'rigging', headgear:'tricorn', banner:'pennant', material:'#20213a', trim:'#b27cff', light:'#f0d8ff', emblem:'MOON', detail:'Moonlit tricorn crews following long rigging pennants across the roofs' },
    { id:'thorn-royal-host', factionId:'thorn-court', motif:'briars', headgear:'thorn-crown', banner:'gonfalon', material:'#243b31', trim:'#ff5f9e', light:'#ffc0db', emblem:'CROWN', detail:'Briar-crowned retainers under extravagant touring gonfalons' },
    { id:'graveyard-night-shift', factionId:'graveyard-shift', motif:'bones', headgear:'skull-helm', banner:'square', material:'#26304a', trim:'#a9c7ff', light:'#edf4ff', emblem:'III', detail:'Ossuary helms and square union standards for the eternal night shift' },
    { id:'lantern-civic-cohort', factionId:'lantern-republic', motif:'windows', headgear:'lantern-helm', banner:'double-tail', material:'#302b24', trim:'#ffd447', light:'#fff3b0', emblem:'WIN', detail:'Tiny civic lantern helms marching beneath double-tailed window banners' },
    { id:'mob-patchwork-company', factionId:'once-upon-a-mob', motif:'patches', headgear:'patch-cap', banner:'ragged', material:'#29352d', trim:'#9be36c', light:'#e6ffc9', emblem:'!', detail:'Deliberately mismatched patch caps and foreground-stealing ragged flags' },
    { id:'temporal-offset-column', factionId:'temporal-mischief', motif:'echoes', headgear:'hourglass-visor', banner:'split', material:'#1d2d3d', trim:'#60d7ff', light:'#d5f7ff', emblem:'T+1', detail:'Offset hourglass visors and split standards arriving one beat early' }
  ];

  const DISTRICT_ARCHITECTURES = [
    { id:'clockwork-industrial', factionId:'clockwork-coven', motif:'gears', roof:'clock-stack', material:'#2c2632', trim:'#ff9a3c', light:'#ffd36a', detail:'Copper shiftworks, clock stacks, and union gear crests' },
    { id:'spectral-bureaucracy', factionId:'boo-brigade', motif:'paperwork', roof:'spectral-arch', material:'#182b34', trim:'#75ffd1', light:'#d9fff4', detail:'Floating files, civic arches, and politely haunted windows' },
    { id:'moonwake-rigging', factionId:'moonwake-corsairs', motif:'rigging', roof:'sail-prow', material:'#20213a', trim:'#b27cff', light:'#e7d7ff', detail:'Ship-prow roofs, mast lines, and moonlit harbour lamps' },
    { id:'thorn-royal-briar', factionId:'thorn-court', motif:'briars', roof:'crown-hedge', material:'#243b31', trim:'#ff5f9e', light:'#ffd6eb', detail:'Living hedge walls, crown gables, and flowering battlements' },
    { id:'graveyard-ossuary', factionId:'graveyard-shift', motif:'bones', roof:'ossuary-steps', material:'#26304a', trim:'#a9c7ff', light:'#eef5ff', detail:'Stacked crypts, bone braces, and night-shift blue lamps' },
    { id:'lantern-civic-miniature', factionId:'lantern-republic', motif:'windows', roof:'civic-turrets', material:'#302b24', trim:'#ffd447', light:'#fff3b0', detail:'Tiny civic towers with an unreasonable number of lit windows' },
    { id:'mob-patchwork-stage', factionId:'once-upon-a-mob', motif:'patches', roof:'scaffold-gable', material:'#29352d', trim:'#9be36c', light:'#eaffce', detail:'Improvised stages, patched awnings, and foreground scaffolds' },
    { id:'temporal-offset-office', factionId:'temporal-mischief', motif:'echoes', roof:'hourglass-offset', material:'#1d2d3d', trim:'#60d7ff', light:'#d5f7ff', detail:'Offset offices whose second outline has already been approved' }
  ];

  const DISTRICT_CONVERSIONS = [
    { id:'thirteenth-hour-union-hall', factionId:'clockwork-coven', buildingId:'borough', name:'Thirteenth-Hour Union Hall', icon:'XIII',
      detail:'Every 12s rings a 4s shift change: nearby allied formations move and recover attacks faster; mixed charters strengthen the bell',
      effect:{ kind:'union-shift', period:12, duration:4, range:520, moveBonus:.18, attackRecoveryBonus:.16 } },
    { id:'spectral-census-bureau', factionId:'boo-brigade', buildingId:'watch', name:'Spectral Census Bureau', icon:'FILE',
      detail:'Every 11s files one bridge-connected fog frontier within four hops; mixed charters quicken the audit',
      effect:{ kind:'spectral-census', period:11, maxHops:4, revealRadius:185, revealSeconds:4.5 } },
    { id:'black-sail-anchorage', factionId:'moonwake-corsairs', buildingId:'moot', name:'Black-Sail Anchorage', icon:'SAIL',
      detail:'Nearby routed formations sail 16% faster; mixed charters strengthen the lane',
      effect:{ kind:'black-sail-route', range:520, speedBonus:.16 } },
    { id:'briarway-gatehouse', factionId:'thorn-court', buildingId:'bridgehead', name:'Briarway Gatehouse', icon:'CROWN',
      detail:'Every 8s repairs nearby allied ordinary districts; mixed charters strengthen the pulse',
      effect:{ kind:'briar-mend', period:8, range:520, repair:14 } },
    { id:'last-rites-exchange', factionId:'graveyard-shift', buildingId:'borough', name:'Last-Rites Exchange', icon:'WAKE',
      detail:'Nearby formation casualties yield 55% extra Essence to this side; mixed charters strengthen the dividend',
      effect:{ kind:'wake-dividend', range:520, essenceBonus:.55 } },
    { id:'foreground-spotlight', factionId:'once-upon-a-mob', buildingId:'watch', name:'Foreground Spotlight', icon:'LEAD',
      detail:'Every 13s casts the nearest visible enemy formation as the lead role for 5s; nearby allied formations deal 18% more damage to it, strengthened by mixed charters',
      effect:{ kind:'lead-role-spotlight', period:13, duration:5, range:520, damageBonus:.18 } },
    { id:'every-window-assembly', factionId:'lantern-republic', buildingId:'borough', name:'Every-Window Assembly', icon:'CIVIC',
      detail:'Every 13s, a visible enemy formation raises 5s of Civic Cover: nearby allied formations take 14% less damage, strengthened by mixed charters',
      effect:{ kind:'civic-cover', period:13, duration:5, range:520, damageReduction:.14 } }
  ];

  const BUILDINGS = [
    { id: 'borough', key: 'Z', name: 'Crooked Borough', icon: '⌂', detail: '+Glow, +Scrap, +80 cap', glow: 80, scrap: 75, time: 4.0, hp: 560 },
    { id: 'moot', key: 'X', name: 'Moon Moot', icon: '♟', detail: 'Forward squad rally', glow: 95, scrap: 110, time: 4.8, hp: 650 },
    { id: 'watch', key: 'C', name: 'Watchmoon', icon: '◉', detail: 'Huge vision, no attack', glow: 50, scrap: 90, time: 3.4, hp: 390 },
    { id: 'bridgehead', key: 'V', name: 'Brave Little Bridgehead', icon: '⚑', detail: 'Heals passing squads', glow: 120, scrap: 145, time: 5.4, hp: 760 }
  ];

  const WONDERWORKS = [
    { id:'shift-bell-foundry', factionId:'clockwork-coven', key:'B', name:'Shift-Bell Foundry', icon:'XII', color:'#ff9a3c', silhouette:'clock', detail:'Every 16s advances every active queue and unfinished district', glow:145, scrap:155, time:6.2, hp:760, max:2, effect:{kind:'shift-bell',period:16,queueSeconds:1.4,buildSeconds:1.1} },
    { id:'gentle-haunting-department', factionId:'boo-brigade', key:'B', name:'Department of Gentle Haunting', icon:'SEC', color:'#75ffd1', silhouette:'ghost', detail:'Files a recurring 5 Essence afterlife dividend', glow:150, scrap:145, time:5.8, hp:690, max:2, effect:{kind:'essence-stipend',period:13,amount:5} },
    { id:'moon-tide-drydock', factionId:'moonwake-corsairs', key:'B', name:'Moon-Tide Drydock', icon:'MOON', color:'#b27cff', silhouette:'drydock', detail:'Automatically launches a free Broom Patrol', glow:155, scrap:150, time:6.0, hp:740, max:2, effect:{kind:'scout-muster',period:22,unitId:'brooms'} },
    { id:'walking-hedge-palace', factionId:'thorn-court', key:'B', name:'Walking Hedge Palace', icon:'CROWN', color:'#ff5f9e', silhouette:'hedge', detail:'Heals friendly formations and districts in a wide royal aura', glow:150, scrap:165, time:6.4, hp:820, max:2, effect:{kind:'hedge-heal',radius:235,healPerSecond:7} },
    { id:'municipal-bone-archive', factionId:'graveyard-shift', key:'B', name:'Municipal Bone Archive', icon:'III', color:'#a9c7ff', silhouette:'archive', detail:'Reassembles one fighter in the most depleted nearby formation', glow:140, scrap:175, time:6.1, hp:850, max:2, effect:{kind:'bone-reinforce',period:12,radius:520,fighters:1} },
    { id:'thousand-windows-embassy', factionId:'lantern-republic', key:'B', name:'Embassy of a Thousand Windows', icon:'WIN', color:'#ffd447', silhouette:'windows', detail:'+100 crowd cap and immense rooftop vision', glow:165, scrap:140, time:5.9, hp:780, max:2, effect:{kind:'windows',cap:100,sight:440} },
    { id:'plot-device-factory', factionId:'once-upon-a-mob', key:'B', name:'Plot Device Factory', icon:'!', color:'#9be36c', silhouette:'plot', detail:'Automatically releases a free Mischief Mob into the current plan', glow:135, scrap:160, time:5.6, hp:720, max:2, effect:{kind:'mob-muster',period:19,unitId:'mobs'} },
    { id:'office-already-done', factionId:'temporal-mischief', key:'B', name:'Office of Already Done', icon:'T-1', color:'#60d7ff', silhouette:'temporal', detail:'Trains squads 22% faster and refreshes Essence powers 18% faster', glow:160, scrap:155, time:6.0, hp:730, max:2, effect:{kind:'already-done',trainSpeed:1.22,cooldownSpeed:1.18} }
  ];

  const CHARTERS = [
    { id: 'pumpkin-market', key: '5', name: 'Pumpkin Night Market', icon: '◒', detail: '+0.95 Glow/s from every chartered district', color: '#ffb15b', glow: .95, scrap: 0, cap: 0, sight: 0, muster: 0 },
    { id: 'junk-jamboree', key: '6', name: 'Junk Jamboree', icon: '⚙', detail: '+0.70 Scrap/s from every chartered district', color: '#60d7ff', glow: 0, scrap: .70, cap: 0, sight: 0, muster: 0 },
    { id: 'impossible-housing', key: '7', name: 'Impossible Housing', icon: '⌂', detail: '+45 crowd cap and +125 vision per district', color: '#ffd447', glow: 0, scrap: 0, cap: 45, sight: 125, muster: 0 },
    { id: 'volunteer-seance', key: '8', name: 'Volunteer Séance', icon: '☁', detail: 'Automatically musters a free Mischief Mob about every 32s', color: '#b27cff', glow: 0, scrap: 0, cap: 0, sight: 0, muster: 32 }
  ];

  const POWERS = [
    { id: 'pirates', key: 'F', name: 'Ghost Pirate Raid', icon: '☠', detail: 'Summon 3 crews anywhere explored', essence: 60, cooldown: 9 },
    { id: 'reinforce', key: 'G', name: 'Second Wind', icon: '✚', detail: 'Restore selected squads in the field', essence: 34, cooldown: 7 },
    { id: 'parade', key: 'H', name: 'Grand Phantom Parade', icon: '♬', detail: 'Six unruly crews march on the enemy', essence: 125, cooldown: 24 }
  ];

  const RIVAL_SCHEMES = [
    {
      id: 'market-heist', icon: 'G$', name: 'The Great Glow Robbery', kicker: 'RAID ECONOMY', color: '#ffd36a',
      detail: 'Rival raiders are pricing up your richest market roof.',
      counterplay: 'Guard the marked economy district, or turn the raid into an expensive walk home.',
      composition: ['brooms', 'mobs', 'hexbows', 'signature']
    },
    {
      id: 'web-cutter', icon: 'WEB', name: 'Cut the Wonderweb', kicker: 'BREAK SYNERGY', color: '#60d7ff',
      detail: 'The rival is aiming at the district that binds your strongest charter network.',
      counterplay: 'Reinforce the marked hub or counter-raid while their mass crosses the roofs.',
      composition: ['lanterns', 'hexbows', 'mobs', 'signature']
    },
    {
      id: 'lantern-blackout', icon: 'EYE', name: 'Blind the Moon', kicker: 'KILL VISION', color: '#b27cff',
      detail: 'A Watchmoon or vision district has been selected for a theatrical blackout.',
      counterplay: 'Meet the attack under your lanterns, then keep a second scout route alive.',
      composition: ['brooms', 'hexbows', 'brooms', 'signature']
    },
    {
      id: 'clock-crash', icon: 'XIII', name: 'Very Final Tuesday', kicker: 'CLOCK ASSAULT', color: '#ff5876',
      detail: 'The rival is massing for a direct attempt on your Grand Clock.',
      counterplay: 'Pull the formation home, use the marked approach, and punish the long commitment.',
      composition: ['lanterns', 'mobs', 'hexbows', 'signature']
    },
    {
      id: 'roof-grab', icon: 'FLAG', name: 'Annex the Punchline', kicker: 'EXPAND + STAGE', color: '#75ffd1',
      detail: 'The rival is claiming an open roof and using it as a forward muster.',
      counterplay: 'Raid the fresh district before its staged squads become a real front.',
      composition: ['mobs', 'brooms', 'hexbows', 'signature']
    }
  ];

  return { COLORS, FACTIONS, DOCTRINES, MAPS, MAP_MECHANICS, MAP_TOPOLOGIES, UNITS, FORMATION_ROLES, FORMATION_KITS, DISTRICT_ARCHITECTURES, DISTRICT_CONVERSIONS, BUILDINGS, WONDERWORKS, CHARTERS, POWERS, RIVAL_SCHEMES, WORLD: { width: 2400, height: 1500, cap: 400 } };
});
