(function (root) {
  'use strict';

  const DATA = {
    title: 'BONK & BOLT',
    subtitle: 'THE 24TH HOUR',
    version: '1.1.0-relay-test',
    classes: [
      {
        id: 'panzer',
        name: 'Panzer',
        kicker: 'Professional cookware violence',
        weapon: 'Springpan Supreme',
        color: '#ffb347',
        stats: { power: 8, wit: 3, command: 4 },
        attack: 'Pan Slap',
        special: 'Breakfast Avalanche',
        description: 'Close-range crowd control. Hits ring like a dinner bell and send enemies into undignified cartwheels.'
      },
      {
        id: 'pun-slinger',
        name: 'Pun Slinger',
        kicker: 'Long-range emotional damage',
        weapon: 'Baguette Boomerang',
        color: '#55d6be',
        stats: { power: 5, wit: 9, command: 3 },
        attack: 'Crust Toss',
        special: 'The Longest Sandwich',
        description: 'Ranged ricochet specialist. Every critical hit displays a legally questionable food pun.'
      },
      {
        id: 'gear-shepherd',
        name: 'Gear Shepherd',
        kicker: 'Asks nicely, then overclocks',
        weapon: 'Accordion Wrench',
        color: '#a58bff',
        stats: { power: 4, wit: 5, command: 10 },
        attack: 'Wrench Wheeze',
        special: 'Unionized Uprising',
        description: 'Commands nearby neutral miniatures briefly and turns bonded robots into specialized field partners.'
      }
    ],
    races: [
      {
        id: 'human',
        name: 'Human',
        start: 'Kettlewick',
        color: '#e9a66f',
        perk: 'Second Opinion',
        description: 'Starts in practical Kettlewick. The first branch retune on every equipment find costs zero bolts.'
      },
      {
        id: 'toon',
        name: 'Toon',
        start: 'Doodledean',
        color: '#56d9c5',
        perk: 'Squash Budget',
        description: 'Starts in elastic Doodledean. A perfectly timed dodge stores one comedy charge for the next attack.'
      }
    ],
    regions: [
      { id: 'kettlewick', name: 'Kettlewick', x: -62, z: 18, radius: 43, color: '#efb66c', blurb: 'Human roofs, loud soup, modest insurance.' },
      { id: 'doodledean', name: 'Doodledean', x: 65, z: 28, radius: 45, color: '#4fd0bd', blurb: 'Toon alleys where gravity is a suggestion.' },
      { id: 'boltborough', name: 'Boltborough', x: 8, z: -66, radius: 38, color: '#8ba9ff', blurb: 'Miniature robots living extremely full-sized lives.' },
      { id: 'sizzlebank', name: 'Sizzlebank', x: -52, z: -57, radius: 31, color: '#e97491', blurb: 'Fishing docks and a cook-off crowd with no indoor voices.' },
      { id: 'wobblewoods', name: 'Wobblewoods', x: 69, z: -58, radius: 48, color: '#7bb95b', blurb: 'A forest that changes its mind about straight lines.' },
      { id: 'middle', name: 'The Unreasonably Central Meadow', x: 0, z: 0, radius: 28, color: '#9acb66', blurb: 'Every road arrives here after pretending it did not.' }
    ],
    gear: [
      { id: 'springpan', name: 'Springpan Supreme', slot: 'weapon', rarity: 'oddity', power: 8, choice: ['BONK radius +25%', 'Every 5th attack launches breakfast'], drawback: 'Squeaks alert nuisances from 20% farther away', salvage: 3 },
      { id: 'baguette', name: 'Yesterday\'s Baguette', slot: 'weapon', rarity: 'oddity', power: 7, choice: ['Bread projectile speed +30%', 'Bounces to one extra nuisance'], drawback: 'Bread alerts nuisances from 25% farther away', salvage: 3 },
      { id: 'accordion', name: 'Accordion Wrench', slot: 'weapon', rarity: 'oddity', power: 6, choice: ['Neutral robots obey 50% longer', 'Gear Shepherd special recharges 20% faster'], drawback: 'C-minor flourish adds 12% attack recovery', salvage: 3 },
      { id: 'apology-hammer', name: 'The Apology Hammer', slot: 'weapon', rarity: 'fabled', power: 13, choice: ['Defeated nuisances drop 2 extra bolts', 'Heavy hits briefly recruit the target'], drawback: 'Apologies alert nuisances from 50% farther away', salvage: 12 },
      { id: 'committee-hat', name: 'Hat of Too Many Committees', slot: 'hat', rarity: 'rare', power: 2, choice: ['Every completed adventure pays 3 bolts', 'Quest-givers preview both outcomes without chowder'], drawback: 'Panels take 0.65 dramatic seconds to adjourn', salvage: 7 },
      { id: 'duck-crown', name: 'Golden Duck Crown (Probably)', slot: 'hat', rarity: 'fabled', power: 4, choice: ['Golden Duck odds +40%', 'Every Golden Duck restores full pep'], drawback: 'Bolt gifts include a 4-bolt duck invoice', salvage: 14 },
      { id: 'moonboots', name: 'Moonboots with Grounded Expectations', slot: 'boots', rarity: 'rare', power: 3, choice: ['Dodge distance +30%', 'Landing makes a tiny shockwave'], drawback: 'Fishing targets move 15% faster', salvage: 7 },
      { id: 'tax-trousers', name: 'Tax-Evasion Trousers', slot: 'boots', rarity: 'oddity', power: 1, choice: ['Every salvage pays +1 bolt', 'Equipment retunes cost 3 fewer bolts'], drawback: 'Town nuisances notice you from 25% farther away', salvage: 4 },
      { id: 'dramatic-spoon', name: 'Spoon of Dramatic Timing', slot: 'trinket', rarity: 'rare', power: 2, choice: ['Cook-off timing window +20%', 'Meal world effects last 25% longer'], drawback: 'Applause adds 12% attack recovery', salvage: 8 },
      { id: 'honest-compass', name: 'Suspiciously Honest Compass', slot: 'trinket', rarity: 'fabled', power: 3, choice: ['Nearby nuisances appear on the minimap', 'Bondable robot wants appear on the world map'], drawback: 'The world map marks your last choice as REGRET?', salvage: 13 },
      { id: 'panini-passport', name: 'Panini Passport Press', slot: 'weapon', rarity: 'rare', power: 9, hybrid: true, choice: ['Defeated paperwork drops Sunberry vouchers', 'Bread attacks chain to one nearby nuisance'], drawback: 'Cheese-luggage inspection slows movement 6%', salvage: 9 },
      { id: 'ferry-loafers', name: 'Union Ferry Loafers', slot: 'boots', rarity: 'rare', power: 3, hybrid: true, choice: ['Move 35% faster over the river', 'Dodges heal 3 and shove nearby nuisances'], drawback: 'Every 4th dodge takes a double tea-break cooldown', salvage: 9 },
      { id: 'mayor-face', name: 'The Mayor\'s Spare Face', slot: 'hat', rarity: 'fabled', power: 4, hybrid: true, choice: ['Future equipment drops contain both branches', 'Robot work orders pay +1 Clock Salt'], drawback: 'Town nuisances notice the campaign from 30% farther away', salvage: 15 }
    ],
    ingredients: [
      { id: 'gossip-carp', name: 'Gossip Carp', source: 'Sizzlebank river', meaning: 'Cook-offs: judges reveal their next craving.' },
      { id: 'moon-eel', name: 'Moon Eel', source: 'Night fishing anywhere', meaning: 'Village meal: neutral robots recharge faster.' },
      { id: 'argument-tuna', name: 'Argument Tuna', source: 'Wobblewoods pool', meaning: 'Town meal: villagers settle one blocked quest route.' },
      { id: 'sunberry', name: 'Sunberry', source: 'Kettlewick gardens', meaning: 'Cook-off base and Sprig-0\'s favorite.' },
      { id: 'laughing-leek', name: 'Laughing Leek', source: 'Doodledean stalls', meaning: 'Cook-off rhythm becomes bouncy but more rewarding.' },
      { id: 'clock-salt', name: 'Clock Salt', source: 'Boltborough work orders', meaning: 'Preserves a meal effect through one defeat.' }
    ],
    recipes: [
      { id: 'sunberry-pie', name: 'Sunberry Upside-Down Pie', needs: ['sunberry', 'laughing-leek'], effect: 'Pet Whisper', duration: 60, world: 'Nearby miniature requirements become visible before you raise a stone.' },
      { id: 'gossip-chowder', name: 'Gossip Chowder', needs: ['gossip-carp', 'clock-salt'], effect: 'Loose Lips', duration: 60, world: 'Quest-givers preview the consequence of both dialogue choices.' },
      { id: 'moon-noodles', name: 'Moon-Eel Noodles', needs: ['moon-eel', 'laughing-leek'], effect: 'Low Voltage', duration: 60, world: 'Bonded miniatures use their world job and combat skill 25% faster.' },
      { id: 'peace-tuna', name: 'Argument Tuna à la Truce', needs: ['argument-tuna', 'sunberry'], effect: 'Community Table', duration: 60, world: 'Human, Toon and robot villages share workers, opening hybrid drops.' }
    ],
    cookRivals: [
      { id: 'mayor-marmalade', name: 'Mayor Marmalade', title: 'Citrus Administrator', color: '#f2a64b', rounds: [0.42,0.53,0.49], intro: 'Has outlawed seeds in public office and brought seventeen emergency napkins.', win: 'The mayor signs your knife permit with orange jam.', loss: 'The mayor declares your plate a roundabout and charges it rent.', legacy: { round: 'chop', scale: 1.08, label: 'Civic Knife Permit · CHOP zone permanently 8% wider' } },
      { id: 'wok-goblin', name: 'The Wok Goblin', title: 'Pan Cryptid', color: '#77c96d', rounds: [0.58,0.65,0.60], intro: 'Claims every pan in Sizzlebank by shouting MINE into it.', win: 'The goblin teaches your spoon the illegal third direction.', loss: 'The goblin eats the scorecard, which judges count as confidence.', legacy: { round: 'stir', scale: 1.08, label: 'Illegal Third Direction · STIR zone permanently 8% wider' } },
      { id: 'grandma-torque', name: 'Grandma Torque', title: 'Retired Siege Caterer', color: '#b89ae8', rounds: [0.72,0.78,0.72], intro: 'Once plated soup during an earthquake and blamed the earthquake for trembling.', win: 'Grandma nods once. Three nearby buildings feel validated.', loss: 'Grandma plates your dignity under a tiny silver lid.', legacy: { round: 'plate', scale: 1.08, label: 'Siege Plating · PLATE zone permanently 8% wider' } }
    ],
    pets: [
      { id: 'sprig0', name: 'Sprig-0', role: 'Gardener', home: 'Kettlewick', want: 'Sunberry Upside-Down Pie', wantId: 'sunberry-pie', color: '#8fce66', hp: 58, cooldown: 75, specialName: 'Spring Garden', skill: 'Plants a spring garden and regrows one Sunberry plus one Laughing Leek.' },
      { id: 'ferrybit', name: 'Ferrybit', role: 'Ferry Captain', home: 'Sizzlebank', want: '3 Gossip Carp', wantId: 'gossip-carp', count: 3, color: '#62c7da', hp: 72, cooldown: 14, specialName: 'Pocket Ferry', skill: 'Body-checks the nearest nuisance with a tiny emergency ferry.' },
      { id: 'crumb32', name: 'Crumb-32', role: 'Baker', home: 'Boltborough', want: 'Any cook-off score above 75', wantId: 'cook75', color: '#f0aa63', hp: 54, cooldown: 5, specialName: 'Salvage Soufflé', skill: 'Once per world day, bakes 3 bolts into a fresh non-fabled equipment choice.' },
      { id: 'sirensue', name: 'Siren Sue', role: 'Town Crier', home: 'Doodledean', want: 'Defeat 12 Hecklecrabs in Doodledean', wantId: 'crabs12', color: '#e07ab3', hp: 64, cooldown: 22, specialName: 'Civic Siren', skill: 'Calls every neutral miniature in the region to one target for 14 seconds.' },
      { id: 'mossboss', name: 'Moss Boss', role: 'Forest Ranger', home: 'Wobblewoods', want: 'Release 4 fish into Wobble Pond', wantId: 'release4', color: '#4ea76f', hp: 68, cooldown: 45, specialName: 'Ranger Audit', skill: 'Marks the next nuisance carrying a guaranteed rare drop without creating junk.' },
      { id: 'ledgerling', name: 'Ledgerling', role: 'Accountant', home: 'Boltborough', want: 'Salvage 6 unwanted equipment pieces', wantId: 'salvage6', color: '#9c8ce8', hp: 62, cooldown: 30, specialName: 'Ledger Rebate', skill: 'Adds 2 bolts to the next manual or automatic salvage while preserving fabled safety.' }
    ],
    enemies: [
      { id: 'hecklecrab', name: 'Hecklecrab', region: 'Doodledean', hp: 22, speed: 3.2, color: '#f05d7d', gag: ['RUDE!', 'UNFOLLOWED!', 'CRABsolutely not!'], defeat: 'CRAB HAS LEFT THE CHAT!', behavior: { kind: 'heckle', range: 9, cooldown: 6.5, tell: 'OPEN MIC!' } },
      { id: 'paperwork', name: 'Hostile Paperwork', region: 'Kettlewick', hp: 30, speed: 2.4, color: '#e6d6b5', gag: ['DENIED!', 'FORM 9-BONK!', 'Please hold.'], defeat: 'FILED UNDER: FLOOR!', behavior: { kind: 'form', range: 13, cooldown: 5.8, tell: 'FORM INCOMING!' } },
      { id: 'moodcloud', name: 'Personal Mood Cloud', region: 'Wobblewoods', hp: 38, speed: 2.1, color: '#8871c8', gag: ['DRIZZLED!', 'EMOTIONALLY DAMP!', 'Weather permitting.'], defeat: 'FORECAST: EMBARRASSING RAINBOW!', behavior: { kind: 'puddle', range: 10, cooldown: 7.2, tell: 'LOCALIZED FEELINGS!' } },
      { id: 'loose-screw', name: 'Loose Screw', region: 'Boltborough', hp: 26, speed: 4.1, color: '#80a8d8', gag: ['THREAD LOST!', 'LEFTY LOOSEY!', 'TIGHTEN UP!'], defeat: 'WARRANTY SOMEHOW IMPROVED!', behavior: { kind: 'dash', range: 11, cooldown: 6.2, tell: 'THREAD THE NEEDLE!' } },
      { id: 'tax-goose', name: 'Tax Goose', region: 'Sizzlebank', hp: 45, speed: 3.4, color: '#f5f0dc', gag: ['AUDITED!', 'HONK DEDUCTION!', 'DEPENDENT: GOOSE!'], defeat: 'REFUND WITH FEATHERS!', behavior: { kind: 'steal', range: 6, cooldown: 8, tell: 'SURPRISE AUDIT!' } }
    ],
    dropOrigins: [
      { id: 'paperwork', enemyId: 'paperwork', source: 'Hostile Paperwork', region: 'Kettlewick', regionId: 'kettlewick', at: [-44,17], steward: 'Nib-7', title: 'Duplicate Stamp Garden', color: '#e7c98e', shape: 'stamp', consequence: 'Hostile forms travel 25% slower after Nib-7 folds every duplicate edge.', effect: { formSpeed: 0.75 } },
      { id: 'hecklecrab', enemyId: 'hecklecrab', source: 'Hecklecrab', region: 'Doodledean', regionId: 'doodledean', at: [49,29], steward: 'Chime-2', title: 'Heckle Delay Bell', color: '#e87caf', shape: 'bell', consequence: 'Every open-mic heckle now telegraphs for 0.35 seconds longer.', effect: { heckleWindup: 0.35 } },
      { id: 'moodcloud', enemyId: 'moodcloud', source: 'Personal Mood Cloud', region: 'Wobblewoods', regionId: 'wobblewoods', at: [54,-50], steward: 'Moss Boss', title: 'Public Rainbow Drain', color: '#8fcf83', shape: 'rainbow', consequence: 'Mood puddles deal 1 less damage on every damp tick.', effect: { moodPuddleDamage: 0.5 } },
      { id: 'loose-screw', enemyId: 'loose-screw', source: 'Loose Screw', region: 'Boltborough', regionId: 'boltborough', at: [-8,-54], steward: 'Lux-11', title: 'Identity Thread Lantern', color: '#8dbfea', shape: 'screw', consequence: 'Loose Screws can no longer hijack neutral miniature robots.', effect: { robotHijackImmunity: 1 } },
      { id: 'tax-goose', enemyId: 'tax-goose', source: 'Tax Goose', region: 'Sizzlebank', regionId: 'sizzlebank', at: [-64,-42], steward: 'Dock-3', title: 'One-Bolt Refund Roost', color: '#f2d889', shape: 'feather', consequence: 'Tax Goose audits can steal at most 1 bolt.', effect: { gooseStealCap: 1 } }
    ],
    villageLife: [
      { id: 'kettle-sign', name: 'Auntie Whistle', race: 'human', role: 'Runaway Sign Straightener', region: 'Kettlewick', color: '#d98b71', home: [-66,16], route: [[-66,16],[-58,13],[-55,21]], favor: 'Hold the town sign still while it remembers which way is north.', thanks: 'North has apologized and resumed pointing upward.', reward: { type: 'ingredient', id: 'sunberry', amount: 1 } },
      { id: 'kettle-spoon', name: 'Nib-7', race: 'robot', role: 'Civic Spoon Polisher', region: 'Kettlewick', color: '#7fa9ce', home: [-70,24], route: [[-70,24],[-62,25],[-55,18]], favor: 'Approve one teaspoon for ceremonial soup duty.', thanks: 'The spoon has been promoted beyond its competence.', reward: { type: 'bolts', amount: 1 } },
      { id: 'kettle-mail', name: 'Pip Postscript', race: 'toon', role: 'Mailbox Reassurer', region: 'Kettlewick', color: '#63cdb5', home: [-56,24], route: [[-56,24],[-52,17],[-63,12]], favor: 'Tell this mailbox that an empty day is not personal rejection.', thanks: 'It now describes itself as between letters.', reward: { type: 'ingredient', id: 'clock-salt', amount: 1 } },
      { id: 'doodle-shadow', name: 'Wob Wobson', race: 'toon', role: 'Freelance Shadow Untangler', region: 'Doodledean', color: '#e37bb4', home: [60,27], route: [[60,27],[68,22],[73,31]], favor: 'Stand very still while two shadows swap owners back.', thanks: 'Everyone has the correct silhouette, approximately.', reward: { type: 'bolts', amount: 1 } },
      { id: 'doodle-bell', name: 'Chime-2', race: 'robot', role: 'Punchline Bell Tester', region: 'Doodledean', color: '#8a9ee0', home: [71,35], route: [[71,35],[64,36],[59,30]], favor: 'Laugh once so the punchline bell can calibrate its dignity.', thanks: 'The bell recorded a technically sufficient giggle.', reward: { type: 'ingredient', id: 'laughing-leek', amount: 1 } },
      { id: 'doodle-hat', name: 'Moxie Flap', race: 'human', role: 'Emergency Hat Catcher', region: 'Doodledean', color: '#e6a16e', home: [73,24], route: [[73,24],[66,18],[58,24]], favor: 'Catch this hat before it completes another independent orbit.', thanks: 'The hat is grounded until it learns indoor weather.', reward: { type: 'bolts', amount: 1 } },
      { id: 'bolt-lamp', name: 'Lux-11', race: 'robot', role: 'Lamp Brightness Mediator', region: 'Boltborough', color: '#84b6dc', home: [7,-60], route: [[7,-60],[-1,-63],[14,-69]], favor: 'Settle whether this lamp is bright or merely very confident.', thanks: 'The lamp accepted a binding compromise: pleasantly smug.', reward: { type: 'ingredient', id: 'clock-salt', amount: 1 } },
      { id: 'bolt-crumb', name: 'Darla Dough', race: 'human', role: 'Enormous Crumb Courier', region: 'Boltborough', color: '#dc8d75', home: [-2,-70], route: [[-2,-70],[6,-74],[14,-65]], favor: 'Help classify one enormous crumb as cargo instead of architecture.', thanks: 'The crumb now travels with a tiny passport.', reward: { type: 'ingredient', id: 'sunberry', amount: 1 } },
      { id: 'bolt-roof', name: 'Zip Rivet', race: 'toon', role: 'Very Small Roof Inspector', region: 'Boltborough', color: '#58c9bc', home: [14,-58], route: [[14,-58],[4,-56],[-3,-66]], favor: 'Nod seriously at a roof too small to stand underneath.', thanks: 'The roof passed inspection and immediately demanded a balcony.', reward: { type: 'bolts', amount: 1 } },
      { id: 'sizzle-umbrella', name: 'Mara Marinade', race: 'human', role: 'Soup Umbrella Auditor', region: 'Sizzlebank', color: '#cf7f8d', home: [-55,-52], route: [[-55,-52],[-47,-56],[-42,-48]], favor: 'Test whether this umbrella protects soup from unexpected weather.', thanks: 'The soup remains legally dry on top.', reward: { type: 'ingredient', id: 'laughing-leek', amount: 1 } },
      { id: 'sizzle-ferry', name: 'Dock-3', race: 'robot', role: 'Thimble Ferry Dispatcher', region: 'Sizzlebank', color: '#68b8d2', home: [-43,-63], route: [[-43,-63],[-35,-58],[-48,-47]], favor: 'Authorize a ferry small enough to require passengers to be folded.', thanks: 'The thimble ferry departs whenever someone sneezes east.', reward: { type: 'bolts', amount: 1 } },
      { id: 'sizzle-spice', name: 'Fizz Parsley', race: 'toon', role: 'Runaway Spice Wrangler', region: 'Sizzlebank', color: '#6bc6a4', home: [-50,-45], route: [[-50,-45],[-42,-42],[-58,-60]], favor: 'Corner a paprika cloud before it seasons the river.', thanks: 'The paprika signed a one-bowl containment agreement.', reward: { type: 'ingredient', id: 'clock-salt', amount: 1 } },
      { id: 'wobble-raincheck', name: 'Raincheck-4', race: 'robot', role: 'Forecast Umbrella Archivist', region: 'Wobblewoods', color: '#8fcf83', home: [76,-43], route: [[76,-43],[82,-49],[72,-55]], favor: 'Hold one brass umbrella open while it remembers whether tomorrow is indoors.', thanks: 'Tomorrow has been classified as partly outside with a chance of paperwork.', reward: { type: 'ingredient', id: 'argument-tuna', amount: 1 } },
      { id: 'middle-mile', name: 'Mile-0', race: 'robot', role: 'Companion Distance Auditor', region: 'The Unreasonably Central Meadow', color: '#f0c663', home: [-6,5], route: [[-6,5],[-11,-2],[-2,-8],[7,-3],[6,7]], favor: 'Walk one ceremonial step beside the route lantern without calling it luggage.', thanks: 'The step has been certified as company rather than cargo.', reward: { type: 'bolts', amount: 1 } }
    ],
    gearCouncil: {
      id: 'contradiction-bench', name: 'Civic Contradiction Bench', region: 'Boltborough', at: [27,-52], clerk: 'Arbiter-0', requiredReports: 2,
      locked: 'Hear any 2 named robot reports. Their public disagreements become permanent workshop options here.',
      unlocked: 'Two towns filed incompatible opinions. Arbiter-0 can now rewrite any kept item for free, and rewrite it again whenever you return.',
      arguments: [
        { id: 'factory', speaker: 'Dock-3', name: 'Factory Wiring', color: '#68b8d2', effect: 'Keep the selected branch, original raw power and one live drawback.', line: 'The ferry schedule recommends putting every wire back where the warranty can find it.' },
        { id: 'quiet', speaker: 'Nib-7', name: 'Quiet Bypass', color: '#7fa9ce', effect: 'Keep the selected branch but disconnect all raw power and the entire drawback.', line: 'A useful mechanism does not need to shout, glow or add eight points to a municipal chart.' },
        { id: 'heckler', speaker: 'Chime-2', name: 'Heckler Overclock', color: '#8a9ee0', effect: 'Wire the selected branch twice and add 2 raw power; wire the drawback twice too.', line: 'If one dangerous opinion is funny, the calibrated answer is obviously two dangerous opinions.' },
        { id: 'paradox', speaker: 'Lux-11', name: 'Contradiction Harness', color: '#84b6dc', effect: 'Run both branches, lose 2 raw power and wire the drawback twice.', line: 'The lamp voted for both switches. Brightness remains undecided, but extremely operational.' }
      ]
    },
    adventureAftermaths: [
      {
        id: 'passport-witness', questId: 'stolen-lunch', choiceId: 'lunch', witnessId: 'kettle-spoon', witness: 'Nib-7', readyStage: 2,
        pendingAt: [-59,20], memoryOffset: [-6,1], pendingTitle: 'Passport Hearing Witness',
        pendingLine: 'I counted five defeated forms, six objections and one lunchbox quietly practicing its own signature.',
        outcomes: {
          citizenship: { title: 'Citizen Cafe Stamp Desk', line: 'The lunchbox signs its own ingredient passports now. I polish the stamp between applicants. It outranks my spoon.' },
          contract: { title: 'Lunch Contract Compliance', line: 'The picnic table is measured every morning. The mayor keeps the left half, the lunchbox keeps weekends and all mustard vetoes.' }
        }
      },
      {
        id: 'river-witness', questId: 'river-on-strike', choiceId: 'river', witnessId: 'sizzle-ferry', witness: 'Dock-3', readyStage: 2,
        pendingAt: [-49,-55], memoryOffset: [-5,-6], pendingTitle: 'Cook-Off Labor Witness',
        pendingLine: 'The river accepted the chowder score but has requested written guarantees that nobody calls evaporation a lunch break.',
        outcomes: {
          'ferry-lane': { title: 'Thimble Ferry Dispatcher', line: 'Robot ferries and old water share the crossing. Ducks ride free because nobody found pockets small enough for their tickets.' },
          'toon-rapids': { title: 'Rapids Rescue Dispatcher', line: 'The river loops before breakfast. Ferrybit patrols every bend and fines reckless waves one extremely tiny whistle.' }
        }
      },
      {
        id: 'shadow-witness', questId: 'borrowed-shadow', choiceId: 'shadow', witnessId: 'doodle-bell', witness: 'Chime-2', readyStage: 2,
        pendingAt: [68,30], memoryOffset: [6,-2], pendingTitle: 'Encore Applause Witness',
        pendingLine: 'I certified six spotlight bonks. The crabs appealed because the audience laughed before their union-approved punchline.',
        outcomes: {
          'shadow-contract': { title: 'Shadow Solo Applause Desk', line: 'The shadow receives top billing. I ring twice for invisible labor and once when Mim remembers to sell refreshments.' },
          'shared-billing': { title: 'Double-Act Applause Desk', line: 'Mim and shadow bow separately. My bell now tracks applause, wages and custody of one invisible piano.' }
        }
      },
      {
        id: 'identity-witness', questId: 'smallest-mayor', choiceId: 'brain', witnessId: 'bolt-lamp', witness: 'Lux-11', readyStage: 2,
        pendingAt: [11,-66], memoryOffset: [-6,-1], pendingTitle: 'Identity Plate Witness',
        pendingLine: 'Four identity plates returned. The robots are trying their names aloud; mine still sounds brighter when whispered.',
        outcomes: {
          care: { title: 'Care-Brain Crossing Keeper', line: 'The new rails ask who might fall before asking who was fastest. I keep the crossing lamp pleasantly smug.' },
          courage: { title: 'Courage-Brain Agenda Marshal', line: 'The smallest mayor charges every agenda. I illuminate the retreat route, which courage insists is merely tactical scenery.' },
          curiosity: { title: 'Curiosity-Brain Weather Clerk', line: 'The beacons question passing weather. Today the fog declined to state its destination and was allowed through.' }
        }
      },
      {
        id: 'forecast-witness', questId: 'missing-forecast', choiceId: 'forecast', witnessId: 'wobble-raincheck', witness: 'Raincheck-4', readyStage: 2,
        pendingAt: [78,-43], memoryOffset: [-6,2], pendingTitle: 'Tomorrow Weather Witness',
        pendingLine: 'The three clearings agree tomorrow went missing before breakfast. The violet wrong-light in their records is not ordinary weather.',
        outcomes: {
          'warning-lattice': { title: 'Public Forecast Lattice Keeper', line: 'Every dangerous puddle now asks permission in gold before becoming damp. The village calls this radical transparency.' },
          'rainbow-shelters': { title: 'Rainbow Shelter Ranger', line: 'Defeated clouds leave dry color behind. I inspect every shelter for leaks, applause and unauthorized weather.' }
        }
      },
      {
        id: 'nightline-witness', questId: 'lantern-curfew', choiceId: 'nightline', witnessId: 'middle-mile', witness: 'Mile-0', readyStage: 2,
        pendingAt: [-6,5], memoryOffset: [-7,-1], pendingTitle: 'Companion Route Witness',
        pendingLine: 'The lantern crossed every gold gate because you stayed with it. The clock recorded speed; I recorded company.',
        outcomes: {
          'wide-gates': { title: 'Public Nightline Gate Keeper', line: 'Every rehearsal gate is wider now. A public route should teach the road, not punish the traveler for one crooked step.' },
          'quiet-practice': { title: 'Wandering Lantern Escort', line: 'Nuisances keep their distance during a rehearsal. The lanterns call this hospitality; the crabs call it unfair zoning.' }
        }
      }
    ],
    quests: [
      {
        id: 'stolen-lunch',
        title: 'The Lunch That Filed for Independence',
        giver: 'Mayor Teakettle',
        region: 'Kettlewick',
        choiceId: 'lunch',
        stages: [
          { text: 'Inspect the walking lunchbox outside Kettlewick hall.', where: 'Kettlewick · brass hall marker', target: 'interact:lunchbox' },
          { text: 'Win the Emergency Passport Hearing: stop 5 self-stamping forms.', where: 'Kettlewick · north orchard hearing ring', target: 'encounter:lunch-hearing' },
          { text: 'Choose: grant lunch citizenship or return it to the mayor.', where: 'Kettlewick · town hall', target: 'choice:lunch' }
        ],
        reward: 'Hat of Too Many Committees',
        story: 'A silly missing-lunch job becomes an argument over whether created things can choose where they belong.'
      },
      {
        id: 'river-on-strike',
        title: 'The River Is on Strike',
        giver: 'Dockmaster Ploink',
        region: 'Sizzlebank',
        choiceId: 'river',
        stages: [
          { text: 'Catch 2 Gossip Carp and ask what the river wants.', where: 'Sizzlebank · marked fishing pier', target: 'fish:gossip-carp:2' },
          { text: 'Outcook the named rival with Gossip Chowder.', where: 'Sizzlebank · Cook-Off Plaza', target: 'cookwin:gossip-chowder' },
          { text: 'Choose: build a robot ferry lane or restore the old toon rapids.', where: 'Sizzlebank · union buoy', target: 'choice:river' }
        ],
        reward: 'Ferrybit route + Moonboots choice',
        story: 'A fishing errand becomes a labor negotiation between a river, its ferries, and the people who assumed water never says no.'
      },
      {
        id: 'borrowed-shadow',
        title: 'My Shadow Has a Better Job',
        giver: 'Mim Mime',
        region: 'Doodledean',
        choiceId: 'shadow',
        stages: [
          { text: 'Follow the purple shadow trail through 3 visible checkpoints.', where: 'Doodledean · west cartoon alley', target: 'checkpoint:shadow:3' },
          { text: 'Win the Heckle Encore: bonk 6 crabs inside the visible spotlight.', where: 'Doodledean · crab amphitheater stage', target: 'encounter:shadow-encore' },
          { text: 'Choose which of them keeps Mim\'s stage contract.', where: 'Doodledean · outdoor theater', target: 'choice:shadow' }
        ],
        reward: 'Siren Sue bond requirement + Baguette branch',
        story: 'The shadow is not stolen. It quit. Your “rescue” becomes the strangest contract negotiation in town.'
      },
      {
        id: 'smallest-mayor',
        title: 'Election for the Smallest Mayor',
        giver: 'Clerk Click',
        region: 'Boltborough',
        choiceId: 'brain',
        stages: [
          { text: 'Help 3 miniature robots perform their village jobs.', where: 'Boltborough · icons over work sites', target: 'robotjob:any:3' },
          { text: 'Win the Identity Plate Chase: catch 4 fleeing Loose Screws.', where: 'Boltborough · gear garden chase ring', target: 'encounter:identity-debate' },
          { text: 'Choose a specialist brain: Care, Courage or Curiosity.', where: 'Boltborough · election dais', target: 'choice:brain' }
        ],
        reward: 'First specialist brain + identity vote',
        story: 'A tiny election teaches that the robots lost more than memory: somebody separated usefulness from identity on purpose.'
      },
      {
        id: 'missing-forecast',
        title: 'Tomorrow\'s Weather Is Missing',
        giver: 'Professor Drizzlewick',
        region: 'Wobblewoods',
        choiceId: 'forecast',
        stages: [
          { text: 'Inspect the brass forecast umbrella beside Raincheck-4.', where: 'Wobblewoods · east weather archive', target: 'interact:forecast-vane' },
          { text: 'Win the Three-Clearing Forecast: bonk 6 Mood Clouds, exactly 2 inside each gold clearing.', where: 'Wobblewoods · three gold forecast circles', target: 'encounter:forecast-relay' },
          { text: 'Choose: build public puddle warnings or let rainbows make shelters.', where: 'Wobblewoods · east weather archive', target: 'choice:forecast' }
        ],
        reward: 'Permanent weather pact + Raincheck-4 witness',
        story: 'A missing forecast begins as an umbrella filing error, then reveals that Wobblewoods recorded the violet wrong-light long before the 24th Hour.'
      },
      {
        id: 'lantern-curfew',
        title: 'The Lantern That Missed Curfew',
        giver: 'Lantern-8',
        region: 'The Unreasonably Central Meadow',
        choiceId: 'nightline',
        stages: [
          { text: 'Inspect the brass relay board and let its lost lantern choose your pace.', where: 'Central Meadow · gold relay board', target: 'interact:route-board' },
          { text: 'Finish the Meadow Curfew Circuit by crossing every visible gate in order.', where: 'Central Meadow · follow the one bright gate', target: 'relayfinish:meadow-curfew' },
          { text: 'Choose: widen the public gates or make every rehearsal a nuisance-free escort.', where: 'Central Meadow · Lantern-8', target: 'choice:nightline' }
        ],
        reward: 'Three permanent route rehearsals + saved personal bests',
        story: 'A lost streetlamp refuses to be carried home. It will walk beside someone, but only if the road treats companionship as more important than speed.'
      }
    ],
    routeTrials: [
      {
        id: 'meadow-curfew', title: 'Meadow Curfew Circuit', region: 'Central Meadow', color: '#ffd36b', parSeconds: 70,
        description: 'A compact seven-gate companionship loop. The clock records a personal best but never fails the run.',
        points: [[10,9],[16,0],[12,-12],[0,-17],[-13,-10],[-16,3],[-7,12],[0,8]]
      },
      {
        id: 'two-town-nightline', title: 'Two-Town Nightline', region: 'Kettlewick + Sizzlebank', color: '#71d7cf', parSeconds: 210,
        description: 'Carry one wandering light from the meadow to two settlements and back without skipping the road between them.',
        points: [[-18,8],[-42,17],[-65,12],[-57,-18],[-52,-48],[-28,-33],[-10,-12],[0,8]]
      },
      {
        id: 'vale-companion-tour', title: 'Vale Companion Tour', region: 'Five regions', color: '#a994ff', parSeconds: 430,
        description: 'A full-valley mastery route through every named settlement. No failure state, consumable cost or reward grind.',
        points: [[-29,12],[-62,18],[-52,-57],[8,-66],[69,-58],[65,28],[28,16],[0,8]]
      }
    ],
    adventureEncounters: [
      {
        id: 'lunch-hearing', questId: 'stolen-lunch', stage: 1, kind: 'passport', enemyId: 'paperwork', count: 5,
        region: 'Kettlewick', x: -56, z: -3, color: '#e7c98e', label: 'Start Emergency Passport Hearing',
        title: 'Emergency Passport Hearing', objective: 'Bonk 5 self-stamping forms before the lunchbox recognizes itself as an annex.',
        rule: 'Forms march toward the lunchbox and rejoin the queue if they stamp it.', start: 'THE HEARING IS NOW VIOLENTLY IN SESSION!',
        complete: 'PASSPORT APPROVED · LUNCHBOX NATIONALITY: COMPLICATED'
      },
      {
        id: 'shadow-encore', questId: 'borrowed-shadow', stage: 1, kind: 'spotlight', enemyId: 'hecklecrab', count: 6,
        region: 'Doodledean', x: 86, z: 31, color: '#a879df', label: 'Start Heckle Encore',
        title: 'The Heckle Encore', objective: 'Bonk 6 Hecklecrabs while they stand inside the visible purple spotlight.',
        rule: 'Hits outside the stage light are ignored because the audience claims they did not happen.', start: 'THE CRABS HAVE REQUESTED WORSE SEATS!',
        complete: 'ENCORE WON · THE SHADOW RECEIVES TOP BILLING IN VERY SMALL PRINT'
      },
      {
        id: 'identity-debate', questId: 'smallest-mayor', stage: 1, kind: 'getaway', enemyId: 'loose-screw', count: 4,
        region: 'Boltborough', x: 26, z: -64, color: '#81c7dc', label: 'Start Identity Plate Chase',
        title: 'Identity Plate Chase', objective: 'Catch 4 plate-stealing Loose Screws as they flee around the visible chase ring.',
        rule: 'The thieves flee, loop through the gear garden, then pause to catch their extremely mechanical breath.', start: 'THE IDENTITY PLATES HAVE BEEN ELECTED TO RUN!',
        complete: 'PLATES RECOVERED · EVERY ROBOT GETS ITS OWN NAME BACK'
      },
      {
        id: 'forecast-relay', questId: 'missing-forecast', stage: 1, kind: 'forecast', enemyId: 'moodcloud', count: 6, clearings: 3, perClearing: 2,
        region: 'Wobblewoods', x: 94, z: -47, color: '#8fcf83', label: 'Start Three-Clearing Forecast',
        title: 'The Three-Clearing Forecast', objective: 'Bonk 6 Mood Clouds: exactly 2 inside each of the 3 visible gold forecast circles.',
        rule: 'Only the current gold clearing counts. After 2 valid bonks, the next clearing lights up in plain sight.', start: 'TOMORROW HAS BEEN ASKED TO REPORT TO ALL THREE CLEARINGS!',
        complete: 'FORECAST RECOVERED · TOMORROW ADMITS IT SAW THE VIOLET LIGHT'
      }
    ],
    encounterRecoveries: [
      {
        id: 'hearing-applause-delay', encounterId: 'lunch-hearing', helperId: 'doodle-bell', helper: 'Chime-2', helperTown: 'Doodledean', at: [-48,-3],
        action: 'Ask Chime-2 for free cross-town help', assist: 'Applause Delay',
        failureTitle: 'DECLARED LEGALLY FLATTENED', failureLine: 'The forms classified your defeat as supporting documentation.',
        offer: 'I crossed from Doodledean. One calibrated laugh will make the first form stamp itself out of embarrassment.',
        accepted: 'Chime-2 pre-files one hostile form. The hearing begins at 1 / 5 with no reward penalty.',
        mechanic: { startProgress: 1 }
      },
      {
        id: 'encore-audience-permit', encounterId: 'shadow-encore', helperId: 'kettle-spoon', helper: 'Nib-7', helperTown: 'Kettlewick', at: [78,31],
        action: 'Ask Nib-7 for free cross-town help', assist: 'Expanded Audience Permit',
        failureTitle: 'BOOED INTO TEMPORARY EMPLOYMENT', failureLine: 'The Hecklecrabs hired you as the understudy for Person Who Missed.',
        offer: 'I crossed from Kettlewick carrying a spoon and an audience permit. Only one of those is legally relevant.',
        accepted: 'Nib-7 widens the visible spotlight for every retry until the encore is won. No score or reward is reduced.',
        mechanic: { spotlightRadius: 7.1 }
      },
      {
        id: 'identity-thimble-pitstop', encounterId: 'identity-debate', helperId: 'sizzle-ferry', helper: 'Dock-3', helperTown: 'Sizzlebank', at: [18,-64],
        action: 'Ask Dock-3 for free cross-town help', assist: 'Thimble Pit Stops',
        failureTitle: 'OUTRUN BY MUNICIPAL HARDWARE', failureLine: 'The screws completed a victory lap and requested tiny sponsorship decals.',
        offer: 'I crossed from Sizzlebank with four thimble pit stops. Fleeing hardware is still required to observe ferry breaks.',
        accepted: 'Dock-3 makes every getaway pause last 2.7 seconds until the plates are recovered. No reward is reduced.',
        mechanic: { pauseSeconds: 2.7 }
      },
      {
        id: 'forecast-lamp-cadence', encounterId: 'forecast-relay', helperId: 'bolt-lamp', helper: 'Lux-11', helperTown: 'Boltborough', at: [84,-47],
        action: 'Ask Lux-11 for free cross-town help', assist: 'Patient Weather Lamps',
        failureTitle: 'RAPIDLY OUTVOTED BY RAIN', failureLine: 'The clouds declared all three clearings emotionally unavailable.',
        offer: 'I crossed from Boltborough with three patient lamps. They have agreed not to hurry the weather, even when the weather is being dramatic.',
        accepted: 'Lux-11 slows every relay cloud to 62% drift speed until the forecast is recovered. No reward is reduced.',
        mechanic: { stormSpeed: 0.62 }
      }
    ],
    storyChoices: {
      lunch: {
        questId: 'stolen-lunch',
        region: 'Kettlewick',
        memoryAt: { x: -56, z: 24 },
        options: [
          {
            id: 'citizenship', label: 'GRANT CITIZENSHIP', shortLabel: 'CITIZEN CAFÉ', visual: 'citizen-cafe',
            preview: 'Lunchboxes may choose their own fillings. Kettlewick welcomes Toon cooks.',
            consequence: 'Citizen cooks make every cook-off timing window 12% wider.',
            memory: 'The walking lunchbox now runs a tiny civic café and stamps its own ingredient passport.',
            effects: { cookZone: 1.12 }
          },
          {
            id: 'contract', label: 'RETURN WITH A CONTRACT', shortLabel: 'LUNCH CONTRACT', visual: 'contract-picnic',
            preview: 'The mayor gets lunch; the lunchbox gets weekends, veto rights and a chair.',
            consequence: 'Kettlewick pays 2 ordinary bolts whenever an adventure closes.',
            memory: 'The mayor and lunchbox eat at opposite ends of a legally measured picnic table.',
            effects: { questBolts: 2 }
          }
        ]
      },
      river: {
        questId: 'river-on-strike',
        region: 'Sizzlebank',
        memoryAt: { x: -25, z: -56 },
        options: [
          {
            id: 'ferry-lane', label: 'BUILD THE ROBOT FERRY LANE', shortLabel: 'FERRY LANE', visual: 'ferry-lane',
            preview: 'Reliable robot ferries cross beside protected old water.',
            consequence: 'The permanent ferry lane makes movement over the river 45% faster.',
            memory: 'A procession of miniature ferries now crosses the river and rings a bell for every passenger, including ducks.',
            effects: { riverSpeed: 1.45 }
          },
          {
            id: 'toon-rapids', label: 'RESTORE THE TOON RAPIDS', shortLabel: 'TOON RAPIDS', visual: 'toon-rapids',
            preview: 'Fast chaotic water returns and Ferrybit becomes rescue captain.',
            consequence: 'Every ordinary fishing catch now yields one additional useful fish.',
            memory: 'The river performs three unscheduled loops before breakfast while Ferrybit patrols in a thimble.',
            effects: { fishYield: 1 }
          }
        ]
      },
      shadow: {
        questId: 'borrowed-shadow',
        region: 'Doodledean',
        memoryAt: { x: 71, z: 32 },
        options: [
          {
            id: 'shadow-contract', label: 'THE SHADOW KEEPS THE CONTRACT', shortLabel: 'SHADOW SOLO', visual: 'shadow-solo',
            preview: 'Doodledean credits invisible workers and gives the shadow top billing.',
            consequence: 'Union Hecklecrabs in Doodledean notice the player from 25% less distance.',
            memory: 'The shadow headlines the outdoor theater. Mim sells extremely visible refreshments.',
            effects: { doodledeanAggro: 0.75 }
          },
          {
            id: 'shared-billing', label: 'MIM SHARES THE BILLING', shortLabel: 'DOUBLE BILLING', visual: 'shadow-duet',
            preview: 'Mim and shadow become a double act with separate pay and one enormous poster.',
            consequence: 'The active miniature learns the double act and deals 25% more companion damage.',
            memory: 'Mim and shadow bow separately, then argue over who must carry the invisible piano.',
            effects: { companionDamage: 1.25 }
          }
        ]
      },
      brain: {
        questId: 'smallest-mayor',
        region: 'Boltborough',
        memoryAt: { x: 8, z: -61 },
        options: [
          {
            id: 'care', label: 'CARE', shortLabel: 'CARE', visual: 'brain-care',
            preview: 'Robots protect village life before objectives.',
            consequence: 'Bonded miniatures take 25% less integrity damage.',
            memory: 'Boltborough installed benches, safety rails and one aggressively considerate crossing bell.',
            effects: { petDamageTaken: 0.75 }
          },
          {
            id: 'courage', label: 'COURAGE', shortLabel: 'COURAGE', visual: 'brain-courage',
            preview: 'Robots interrupt danger before calculating the odds.',
            consequence: 'The active miniature deals 25% more companion damage.',
            memory: 'The smallest mayor now begins every meeting by charging bravely at the agenda.',
            effects: { companionDamage: 1.25 }
          },
          {
            id: 'curiosity', label: 'CURIOSITY', shortLabel: 'CURIOSITY', visual: 'brain-curiosity',
            preview: 'Robots investigate the unknown before naming it an enemy.',
            consequence: 'All miniature specialties recover 20% faster during saved play.',
            memory: 'Question-mark beacons survey Boltborough and politely interrogate passing weather.',
            effects: { petCooldownRate: 1.2 }
          }
        ]
      },
      forecast: {
        questId: 'missing-forecast',
        region: 'Wobblewoods',
        memoryAt: { x: 78, z: -35 },
        options: [
          {
            id: 'warning-lattice', label: 'BUILD THE PUBLIC FORECAST LATTICE', shortLabel: 'WARNINGS ON', visual: 'forecast-lattice',
            preview: 'Raincheck-4 makes danger announce itself before anybody gets emotionally damp.',
            consequence: 'Every Mood Cloud puddle displays a 1.1-second gold warning before it can deal damage.',
            memory: 'Three brass forecast lamps now rehearse tomorrow in public and refuse to hide dangerous puddles.',
            effects: { puddleWarning: 1 }
          },
          {
            id: 'rainbow-shelters', label: 'LET RAINBOWS RUN THE SHELTERS', shortLabel: 'RAINBOW SHELTERS', visual: 'rainbow-shelters',
            preview: 'Defeated clouds leave brief dry refuges instead of disappearing without civic responsibility.',
            consequence: 'Defeated Mood Clouds leave a 10-second rainbow shelter that blocks mood-puddle damage.',
            memory: 'Wobblewoods keeps three walking rainbows on shelter duty, each carrying a tiny clipboard.',
            effects: { rainbowShelters: 1 }
          }
        ]
      },
      nightline: {
        questId: 'lantern-curfew',
        region: 'The Unreasonably Central Meadow',
        memoryAt: { x: 13, z: 13 },
        options: [
          {
            id: 'wide-gates', label: 'WIDEN THE PUBLIC NIGHTLINE', shortLabel: 'WIDE NIGHTLINE', visual: 'nightline-stations',
            preview: 'Every route remains timed, but its visible checkpoints welcome a less exact approach.',
            consequence: 'All three replayable route gates become 30% wider without changing their recorded clocks.',
            memory: 'Eight brass stations now lean toward approaching travelers instead of grading their footwork.',
            effects: { routeGateRadius: 1.3 }
          },
          {
            id: 'quiet-practice', label: 'LET THE LANTERNS ESCORT REHEARSALS', shortLabel: 'QUIET ESCORT', visual: 'lantern-caravan',
            preview: 'Practice routes become moving civic safe spaces while their clocks still record honest travel.',
            consequence: 'Ordinary nuisances suspend aggression for the full duration of every active route rehearsal.',
            memory: 'A caravan of small lamps now follows travelers and politely asks nearby nuisances to heckle later.',
            effects: { routeSanctuary: 1 }
          }
        ]
      }
    },
    challenges: [
      { id: 'robot-street-news', title: 'Minutes of Very Small Importance', text: 'Hear 6 robot witness reports after their adventures change', where: 'Kettlewick, Sizzlebank, Doodledean, Boltborough, Wobblewoods and the Central Meadow - gold report markers', event: 'aftermath', target: 'witness', amount: 6, reward: 'Six named robots carry your choices into the 24th Hour' },
      { id: 'crab-accountant', title: 'Crab Accountant', text: 'Defeat 12 Hecklecrabs', where: 'Doodledean · crab amphitheater', event: 'kill', target: 'hecklecrab', amount: 12, reward: 'Siren Sue requirement' },
      { id: 'paper-trail', title: 'Paper Trail, Literally', text: 'Defeat 20 Hostile Paperwork', where: 'Kettlewick · north orchard and hall road', event: 'kill', target: 'paperwork', amount: 20, reward: 'Committee Hat gear choice' },
      { id: 'sustainable-fish', title: 'Put It Back, But Fancier', text: 'Release 4 caught fish into Wobble Pond', where: 'Wobblewoods · blue pond marker', event: 'release', target: 'fish', amount: 4, reward: 'Moss Boss requirement' },
      { id: 'cook-crowd', title: 'Dinner and a Show', text: 'Score 75+ in 3 cook-offs', where: 'Sizzlebank · Cook-Off Plaza', event: 'cook75', target: 'any', amount: 3, reward: 'Crumb-32 requirement' },
      { id: 'clean-closet', title: 'No Junk Drawer', text: 'Auto-salvage or salvage 6 equipment pieces', where: 'Inventory · Salvage mode', event: 'salvage', target: 'gear', amount: 6, reward: 'Ledgerling requirement' },
      { id: 'regional-bonk', title: 'A Bonk in Every Postal Code', text: 'Defeat 5 nuisances in each named region', where: 'Kettlewick, Doodledean, Boltborough, Sizzlebank, Wobblewoods', event: 'regionkill', target: 'all', amount: 25, reward: 'Apology Hammer equipment choice' }
    ],
    brains: [
      { id: 'care', name: 'Care Brain', effect: 'Robots protect villages and revive one another.', color: '#55d6be' },
      { id: 'courage', name: 'Courage Brain', effect: 'Robots interrupt the invader\'s world-breaking attacks.', color: '#ff9b66' },
      { id: 'curiosity', name: 'Curiosity Brain', effect: 'Robots learn the invader\'s patterns and expose weak points.', color: '#a58bff' }
    ]
  };

  root.BONK_DATA = Object.freeze(DATA);
})(typeof window !== 'undefined' ? window : globalThis);
