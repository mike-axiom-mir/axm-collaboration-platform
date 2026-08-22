export const GAME_VERSION = '0.26.0-beta';
export const REVIEW_LIMIT = 1000;
export const STARTING_DEBT = 720;
const COMPATIBLE_SAVE_VERSIONS = new Set(['0.9.0-beta', '0.10.0-beta', '0.11.0-beta', '0.12.0-beta', '0.13.0-beta', '0.14.0-beta', '0.15.0-beta', '0.16.0-beta', '0.17.0-beta', '0.18.0-beta', '0.19.0-beta', '0.20.0-beta', '0.21.0-beta', '0.22.0-beta', '0.23.0-beta', '0.24.0-beta', '0.25.0-beta', GAME_VERSION]);

export const RUN_MODES = {
  quick: {
    id: 'quick',
    name: 'Close Enough',
    days: 14,
    dayLength: 22,
    scoreMultiplier: 0.8,
    blurb: 'A sharp six-minute escape. Lower legacy multiplier.'
  },
  standard: {
    id: 'standard',
    name: 'Three Weeks Left',
    days: 21,
    dayLength: 24,
    scoreMultiplier: 1,
    blurb: 'The intended nine-minute pressure-cooker.'
  },
  legend: {
    id: 'legend',
    name: 'One Last Month',
    days: 30,
    dayLength: 24,
    scoreMultiplier: 1.35,
    blurb: 'Stay too long. Earn too much. Regret everything.'
  }
};

export const LANE_DEFS = {
  fuel: {
    id: 'fuel',
    name: 'Plasma Pumps',
    short: 'PUMPS',
    color: '#50f4dc',
    reward: [38, 54],
    resource: 'fuel',
    resourceCost: [4.2, 7.2],
    patience: [16, 23],
    reviewPenalty: [22, 34]
  },
  mart: {
    id: 'mart',
    name: 'Nebula Mart',
    short: 'MART',
    color: '#f4c45b',
    reward: [27, 42],
    resource: 'stock',
    resourceCost: [1.2, 2.5],
    patience: [13, 20],
    reviewPenalty: [18, 29]
  },
  garage: {
    id: 'garage',
    name: 'Repair Bay',
    short: 'BAY',
    color: '#df7bff',
    reward: [52, 78],
    resource: 'stock',
    resourceCost: [2.2, 3.8],
    patience: [20, 30],
    reviewPenalty: [27, 42]
  }
};

export const DISPATCHES = [
  {
    id: 'lane-circuit',
    title: 'Three-lane circuit',
    short: 'LANE CIRCUIT',
    copy: 'Personally clear one Pumps, Mart, and Bay customer before the signal closes.',
    kind: 'manual-lanes',
    goal: 3,
    duration: 74,
    marks: 3
  },
  {
    id: 'hands-on',
    title: 'Hands on the counter',
    short: 'HANDS ON',
    copy: 'Complete five manual services. Automated clears do not count for this dispatch.',
    kind: 'manual',
    goal: 5,
    duration: 68,
    marks: 3
  },
  {
    id: 'clean-sweep',
    title: 'Clean convoy sweep',
    short: 'CLEAN SWEEP',
    copy: 'Serve seven customers by hand or automation without losing anyone.',
    kind: 'clean',
    goal: 7,
    duration: 78,
    marks: 4
  },
  {
    id: 'early-clear',
    title: 'Before the horns',
    short: 'EARLY CLEAR',
    copy: 'Clear four customers while they still have at least 68% patience.',
    kind: 'perfect',
    goal: 4,
    duration: 70,
    marks: 4
  }
];

export const UPGRADES = [
  {
    id: 'patch-kit',
    name: 'Emergency Patch Kit',
    category: 'SURVIVAL',
    price: 120,
    icon: '⌁',
    description: 'Cuts the plasma leak by 55%. It is mostly tape. The tape is glowing.',
    unlock: [],
    visual: 'The ruptured tank stops spraying quite so dramatically.'
  },
  {
    id: 'pump-bot',
    name: 'Pump Drone P-1',
    category: 'AUTOMATION',
    price: 230,
    icon: '◉',
    description: 'Automatically serves the front pump customer.',
    unlock: [],
    visual: 'A turquoise service drone patrols the canopy.'
  },
  {
    id: 'stock-drone',
    name: 'Mart Stockling',
    category: 'AUTOMATION',
    price: 275,
    icon: '▤',
    description: 'Automates basic mart orders and makes snacks 10% more profitable.',
    unlock: [],
    visual: 'The dark shop wakes with warm shelf lights.'
  },
  {
    id: 'queue-beacon',
    name: 'Queue Calm Beacon',
    category: 'SERVICE',
    price: 320,
    icon: '⌾',
    description: 'Customers wait 30% longer; future bad-review penalties fall 10%.',
    unlock: [],
    visual: 'A holographic patience ring floats above the forecourt.'
  },
  {
    id: 'nano-seal',
    name: 'Nano-Sealed Tanks',
    category: 'SURVIVAL',
    price: 440,
    icon: '⬡',
    description: 'Stops the leak permanently and adds 30 units of tank capacity.',
    unlock: ['patch-kit'],
    visual: 'The old tank is rebuilt inside a clean cobalt shell.'
  },
  {
    id: 'garage-arm',
    name: 'Torque-Octopus',
    category: 'AUTOMATION',
    price: 460,
    icon: '⌘',
    description: 'Automates repair jobs and lowers their parts cost by 20%.',
    unlock: ['pump-bot'],
    visual: 'A four-armed repair rig unfolds in the service bay.'
  },
  {
    id: 'solar-wings',
    name: 'Solar Moth Wings',
    category: 'ENDURANCE',
    price: 510,
    icon: '✦',
    description: 'Doubles energy recovery and adds 20 maximum energy.',
    unlock: ['patch-kit'],
    visual: 'Gold solar wings bloom above the roof.'
  },
  {
    id: 'twin-pumps',
    name: 'Twin-Flow Manifold',
    category: 'CAPACITY',
    price: 690,
    icon: '⋈',
    description: 'Pump automation is 80% faster and plasma sales pay 15% more.',
    unlock: ['pump-bot', 'nano-seal'],
    visual: 'A second luminous fuel line ignites beneath the canopy.'
  },
  {
    id: 'synth-kitchen',
    name: 'Zero-G Synth Kitchen',
    category: 'CAPACITY',
    price: 720,
    icon: '◒',
    description: 'Mart automation doubles; premium food pays 35% more.',
    unlock: ['stock-drone'],
    visual: 'The mart gains an orbital kitchen window and a tiny chef hologram.'
  },
  {
    id: 'holo-canopy',
    name: 'Aurora Canopy',
    category: 'PRESTIGE',
    price: 880,
    icon: '△',
    description: 'All sales pay 12% more and bad reviews hurt 20% less. Demand rises 12%.',
    unlock: ['queue-beacon', 'solar-wings'],
    visual: 'The station becomes a luminous landmark visible across the nebula.'
  },
  {
    id: 'service-clone',
    name: 'Licensed Service Clone',
    category: 'AUTOMATION',
    price: 1180,
    icon: '∞',
    description: 'Massively boosts all three service lanes. Legally, it is your cousin.',
    unlock: ['garage-arm', 'synth-kitchen'],
    visual: 'A cheerful clone takes command of the central service tower.'
  },
  {
    id: 'quantum-forecourt',
    name: 'Quantum Forecourt',
    category: 'LEGACY',
    price: 1900,
    icon: '◇',
    description: 'The final form: automation +70%, rewards +25%, patience +20%.',
    unlock: ['twin-pumps', 'holo-canopy', 'service-clone'],
    visual: 'The ruin becomes the brightest station on the frontier.'
  }
];

export const EVENTS = [
  {
    id: 'opening-swarm',
    day: 2,
    camera: 'forecourt',
    dispatches: [{
      kicker: 'FORECOURT ARRAY · TRAFFIC SPIKE',
      title: 'The quiet ends all at once.',
      copy: 'Seven nav systems tag your ruin as the closest open station. AXM\'s welcome packet arrives after the first horns.'
    }],
    results: {
      partner: 'AXM reposts your claim. The convoy doubles back with friends.',
      soft: 'You dim the sign and meter arrivals. The first queue exhales.'
    },
    kicker: 'AXM FRONTIER PARK · OPENING HOUR',
    title: 'The letter was two weeks late.',
    copy: 'A convoy is already turning into your forecourt. AXM asks whether this is an official partner station.',
    choices: [
      { id: 'partner', label: 'Say “absolutely”', detail: '+20% demand and +18% rewards. The lie becomes marketing.', effect: { demand: 0.2, reward: 0.18, credits: 80 } },
      { id: 'soft', label: 'Claim a soft opening', detail: '+20% patience. Keep the crowd calmer.', effect: { patience: 0.2, goodwill: 18 } }
    ]
  },
  {
    id: 'builder-drone',
    day: 5,
    camera: 'engineering',
    dispatches: [{
      kicker: 'MAINTENANCE BAND · UNPAIRED UNIT',
      title: 'A machine asks who owns it.',
      copy: 'The builder drone projects an empty signature box over the leaking tank and waits with bureaucratic patience.'
    }],
    results: {
      recruit: 'The drone accepts your signature and immediately starts fixing the wrong thing.',
      sell: 'The casing vanishes into a parts skiff. Tourists upload the whole transaction.',
      return: 'AXM logs the return as exceptional service. Nobody believes you.'
    },
    kicker: 'UNCLAIMED AXM BUILDER DRONE',
    title: 'The scavenger was an invitation.',
    copy: 'The old drone waits beside your leaking tank. Its AXM work order has one blank owner field.',
    choices: [
      { id: 'recruit', label: 'Forge the owner field', detail: 'Gain Pump Drone P-1, or 180 credits if already owned.', effect: { grantUpgrade: 'pump-bot', fallbackCredits: 180 } },
      { id: 'sell', label: 'Sell it for parts', detail: '+310 credits, +45 bad reviews when AXM tourists notice.', effect: { credits: 310, reviews: 45 } },
      { id: 'return', label: 'Return it to AXM', detail: '+35 goodwill and fewer bad reviews. Responsible. Suspicious.', effect: { goodwill: 35, reviews: -55 } }
    ]
  },
  {
    id: 'solar-bloom',
    day: 8,
    camera: 'vista',
    dispatches: [{
      kicker: 'AURORA FRONT · NINE MINUTES OUT',
      title: 'The sky becomes an advertisement.',
      copy: 'Every windshield turns toward the violet storm. Battery alarms begin chirping before the first tourist reaches the pumps.'
    }],
    results: {
      viewing: 'The forecourt fills with cameras and overheating batteries.',
      shelter: 'The repair bay becomes a violet-lit refuge. Strangers remember the gesture.'
    },
    kicker: 'NEBULA WEATHER ALERT',
    title: 'A solar bloom paints the station violet.',
    copy: 'The view is magnificent. The radiation is also cooking every cheap battery on the forecourt.',
    choices: [
      { id: 'viewing', label: 'Sell viewing passes', detail: '+420 credits, but a burst of impatient sightseers arrives.', effect: { credits: 420, burst: 8, reviews: 20 } },
      { id: 'shelter', label: 'Open the garage as shelter', detail: '+28 goodwill, +18 stock, customers wait longer.', effect: { goodwill: 28, stock: 18, patience: 0.08 } }
    ]
  },
  {
    id: 'tour-bus',
    day: 11,
    camera: 'forecourt',
    dispatches: [{
      kicker: 'SERVICE REQUEST · PRIORITY SIXTY-THREE',
      title: 'A whole holiday arrives hungry.',
      copy: 'The bus door folds open. Sixty-three voices ask for fuel, snacks, and a repair estimate in the same breath.'
    }],
    results: {
      accept: 'The driver stamps the dashboard. Every passenger stands up at once.',
      ration: 'Emergency packs cross the counter. The bus leaves quieter than it arrived.',
      redirect: 'The bus turns toward AXM Park. Sixty-three review forms open in unison.'
    },
    kicker: 'GALACTIC TOUR BUS · 63 PASSENGERS',
    title: 'They need everything. Immediately.',
    copy: 'The driver offers a guaranteed contract if you promise “frictionless premium service.”',
    choices: [
      { id: 'accept', label: 'Take the contract', detail: '+650 credits, 11-customer burst, rewards permanently +5%.', effect: { credits: 650, burst: 11, reward: 0.05 } },
      { id: 'ration', label: 'Serve emergency rations', detail: '-16 stock, -85 bad reviews, +20 goodwill.', effect: { stock: -16, reviews: -85, goodwill: 20 } },
      { id: 'redirect', label: 'Send them to AXM Park', detail: 'No queue—but +110 bad reviews.', effect: { reviews: 110 } }
    ]
  },
  {
    id: 'inspector',
    day: 15,
    camera: 'engineering',
    dispatches: [{
      kicker: 'AXM COMPLIANCE · LIVE RECORDING',
      title: 'Seven eyes find the one thing you hid.',
      copy: 'The inspector records the glowing puddle, the unpaid notice, and your expression in a single immaculate sweep.'
    }],
    results: {
      repair: 'The compliance light turns green while the invoice turns red.',
      hospitality: 'The hospitality gamble is logged. Seven eyes remain impossible to read.',
      hide: 'The station goes dark. Every tourist camera keeps recording.'
    },
    kicker: 'FRONTIER SAFETY INSPECTION',
    title: 'The inspector points at the fuel puddle.',
    copy: 'She has seven eyes. All seven are looking at the same unpaid maintenance record.',
    choices: [
      { id: 'repair', label: 'Emergency compliance', detail: 'Pay 360 credits. Gain Emergency Patch Kit or Nano-Sealed Tanks.', effect: { credits: -360, conditionalRepair: true } },
      { id: 'hospitality', label: 'Offer nebula hospitality', detail: '-10 stock, +15 goodwill, 50/50 inspection outcome.', effect: { stock: -10, chance: 'inspection' } },
      { id: 'hide', label: 'Turn off the lights', detail: '+130 bad reviews. Somehow, this counts as passing.', effect: { reviews: 130 } }
    ]
  },
  {
    id: 'retirement-broker',
    day: 19,
    camera: 'vista',
    dispatches: [{
      kicker: 'ESCAPE CORRIDOR · FINAL WINDOW',
      title: 'The shuttle has your name on it.',
      copy: 'A broker offers one last broadcast while the retirement route burns green across the nebula.'
    }],
    results: {
      blast: 'Your station becomes the final stop on every route map.',
      quiet: 'You cut the beacon. The shuttle corridor stays clear.'
    },
    kicker: 'PENSION ROUTE CONFIRMED',
    title: 'Your retirement shuttle is on schedule.',
    copy: 'A broker offers to advertise the station before you leave. The final days could be extremely profitable—or fatal.',
    choices: [
      { id: 'blast', label: 'Broadcast the station', detail: 'Demand +28%, rewards +22% for the rest of the run.', effect: { demand: 0.28, reward: 0.22 } },
      { id: 'quiet', label: 'Keep the route quiet', detail: '-15% demand, +12% patience. Protect the exit.', effect: { demand: -0.15, patience: 0.12 } }
    ]
  },
  {
    id: 'legend-offer',
    day: 25,
    camera: 'vista',
    dispatches: [{
      kicker: 'RUMOR MARKET · STATION VALUATION',
      title: 'Someone says AXM wants everything.',
      copy: 'The rumor spikes local traffic. No contract exists, but your last pile of credits suddenly feels temporary.'
    }],
    results: {
      spectacle: 'The last credits become light. The nebula answers with traffic.',
      protect: 'The escape case locks. You stop advertising and count the exits.'
    },
    kicker: 'LEGEND RUN · AXM BUYOUT RUMOR',
    title: 'AXM may buy the station tomorrow.',
    copy: 'Nothing is signed. You can spend heavily on spectacle or protect the cash already in your escape case.',
    modes: ['legend'],
    choices: [
      { id: 'spectacle', label: 'Build one last spectacle', detail: '-800 credits, rewards +45%, demand +35%.', effect: { credits: -800, reward: 0.45, demand: 0.35 } },
      { id: 'protect', label: 'Lock the escape case', detail: '+20% patience, -12% demand.', effect: { patience: 0.2, demand: -0.12 } }
    ]
  }
];

export const DECISION_LEGACY_CATALOG = Object.freeze({
  'opening-swarm:partner': Object.freeze({ id: 'partner-beacon', label: 'PARTNER BEACON', tone: 'teal', shape: 'broadcast' }),
  'opening-swarm:soft': Object.freeze({ id: 'soft-opening-shade', label: 'SOFT OPENING', tone: 'amber', shape: 'shade' }),
  'builder-drone:recruit': Object.freeze({ id: 'forged-builder', label: 'FORGED BUILDER', tone: 'violet', shape: 'drone' }),
  'builder-drone:sell': Object.freeze({ id: 'parts-cairn', label: 'PARTS CAIRN', tone: 'amber', shape: 'scrap' }),
  'builder-drone:return': Object.freeze({ id: 'return-relay', label: 'RETURN RELAY', tone: 'teal', shape: 'relay' }),
  'solar-bloom:viewing': Object.freeze({ id: 'bloom-deck', label: 'BLOOM DECK', tone: 'violet', shape: 'deck' }),
  'solar-bloom:shelter': Object.freeze({ id: 'violet-shelter', label: 'VIOLET SHELTER', tone: 'teal', shape: 'shelter' }),
  'tour-bus:accept': Object.freeze({ id: 'bus-contract', label: 'BUS CONTRACT', tone: 'amber', shape: 'contract' }),
  'tour-bus:ration': Object.freeze({ id: 'ration-cache', label: 'RATION CACHE', tone: 'teal', shape: 'rations' }),
  'tour-bus:redirect': Object.freeze({ id: 'redirect-array', label: 'REDIRECT ARRAY', tone: 'red', shape: 'redirect' }),
  'inspector:repair': Object.freeze({ id: 'compliance-seal', label: 'COMPLIANCE SEAL', tone: 'teal', shape: 'seal' }),
  'inspector:hospitality': Object.freeze({ id: 'seven-eye-table', label: 'SEVEN-EYE TABLE', tone: 'amber', shape: 'hospitality' }),
  'inspector:hide': Object.freeze({ id: 'blackout-shutters', label: 'BLACKOUT SHUTTERS', tone: 'red', shape: 'blackout' }),
  'retirement-broker:blast': Object.freeze({ id: 'retirement-spire', label: 'RETIREMENT SPIRE', tone: 'violet', shape: 'spire' }),
  'retirement-broker:quiet': Object.freeze({ id: 'quiet-shroud', label: 'QUIET SHROUD', tone: 'blue', shape: 'shroud' }),
  'legend-offer:spectacle': Object.freeze({ id: 'spectacle-crown', label: 'SPECTACLE CROWN', tone: 'violet', shape: 'crown' }),
  'legend-offer:protect': Object.freeze({ id: 'escape-vault', label: 'ESCAPE VAULT', tone: 'blue', shape: 'vault' })
});

export function decisionLegacy(state) {
  const choices = Array.isArray(state?.stats?.choices) ? state.stats.choices : [];
  const byEvent = new Map();
  for (const record of choices) {
    const event = EVENTS.find(item => item.id === record?.eventId);
    const choice = event?.choices.find(item => item.id === record?.choiceId);
    const legacy = DECISION_LEGACY_CATALOG[`${event?.id}:${choice?.id}`];
    if (!event || !choice || !legacy || byEvent.has(event.id)) continue;
    byEvent.set(event.id, {
      eventId: event.id,
      choiceId: choice.id,
      day: Math.max(1, Math.round(Number(record.day) || event.day)),
      eventDay: event.day,
      order: EVENTS.indexOf(event),
      camera: event.camera,
      ...legacy
    });
  }
  const entries = [...byEvent.values()].sort((a, b) => a.eventDay - b.eventDay || a.order - b.order);
  return {
    count: entries.length,
    latest: entries.at(-1) || null,
    ids: entries.map(entry => `${entry.eventId}:${entry.choiceId}`),
    entries
  };
}

function presentationHash(eventId, seed) {
  let hash = Number(seed) >>> 0;
  for (let index = 0; index < eventId.length; index += 1) {
    hash = Math.imul(hash ^ eventId.charCodeAt(index), 16777619) >>> 0;
  }
  return hash;
}

export function presentEvent(eventId, seed = 0) {
  const event = EVENTS.find(item => item.id === eventId);
  if (!event) return null;
  const presentations = [
    { kicker: event.kicker, title: event.title, copy: event.copy },
    ...(event.dispatches || [])
  ];
  const presentationIndex = presentationHash(event.id, seed) % presentations.length;
  return {
    ...event,
    ...presentations[presentationIndex],
    presentationIndex,
    presentationCount: presentations.length
  };
}

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const mix = (a, b, t) => a + (b - a) * t;

export function decisionRevealFrame(progress = 0, reducedMotion = false) {
  const normalized = clamp(Number(progress) || 0, 0, 1);
  if (reducedMotion) {
    return {
      progress: normalized,
      artifactScale: 1,
      beamOpacity: .1,
      ringLift: 0,
      ringScale: 1,
      ringOpacity: .34,
      shardLift: 0,
      shardOrbit: 0,
      flareScale: 3.2,
      lightIntensity: 7
    };
  }
  const assembly = clamp(normalized / .62, 0, 1);
  const offset = assembly - 1;
  const overshoot = 1 + 2.70158 * offset ** 3 + 1.70158 * offset ** 2;
  return {
    progress: normalized,
    artifactScale: .12 + .88 * Math.max(0, overshoot),
    beamOpacity: .28 * (1 - normalized),
    ringLift: normalized * 4.4,
    ringScale: .55 + normalized * 2.4,
    ringOpacity: Math.sin(normalized * Math.PI) * .56,
    shardLift: normalized * 3.6,
    shardOrbit: normalized * Math.PI * 2.4,
    flareScale: 2.2 + normalized * 4.4,
    lightIntensity: 5 + (1 - normalized) * 10
  };
}

export function debtLiberation(state) {
  const rawDebt = Number(state?.debt);
  const debt = clamp(Number.isFinite(rawDebt) ? rawDebt : STARTING_DEBT, 0, STARTING_DEBT);
  const progress = 1 - debt / STARTING_DEBT;
  let phase = 'LIEN LOCKED';
  let tone = 'warning';
  if (debt <= 0) {
    phase = 'STATION YOURS';
    tone = 'clear';
  } else if (progress >= .72) {
    phase = 'FINAL CLAIM';
    tone = 'opportunity';
  } else if (progress >= .3) {
    phase = 'LIEN CRACKING';
    tone = 'warning';
  }
  return {
    debt,
    paid: STARTING_DEBT - debt,
    progress,
    remaining: 1 - progress,
    links: debt <= 0 ? 0 : Math.max(1, Math.ceil(debt / STARTING_DEBT * 6)),
    phase,
    tone,
    cleared: debt <= 0
  };
}

export function seededRandom(seed = 1) {
  let value = seed >>> 0 || 1;
  return () => {
    value = (value + 0x6D2B79F5) | 0;
    let t = Math.imul(value ^ (value >>> 15), 1 | value);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function dispatchDefinition(state, cycle = state?.dispatch?.cycle || 0) {
  const seedOffset = (Number(state?.seed) >>> 0) % DISPATCHES.length;
  return DISPATCHES[(seedOffset + Math.max(0, Math.floor(Number(cycle) || 0))) % DISPATCHES.length];
}

function createDispatch(state, cycle = 0, carry = {}) {
  const definition = dispatchDefinition(state, cycle);
  const startedAt = Math.max(0, Number(state?.elapsed) || 0);
  return {
    cycle,
    id: definition.id,
    status: 'active',
    progress: 0,
    manualLanes: [],
    startedAt,
    deadline: startedAt + definition.duration,
    resolvedAt: null,
    nextAt: null,
    completed: Math.max(0, Math.floor(Number(carry.completed) || 0)),
    failed: Math.max(0, Math.floor(Number(carry.failed) || 0)),
    streak: Math.max(0, Math.floor(Number(carry.streak) || 0)),
    marks: Math.max(0, Math.floor(Number(carry.marks) || 0)),
    revision: Math.max(0, Math.floor(Number(carry.revision) || 0)),
    lastResult: carry.lastResult || null
  };
}

function resolveDispatch(state, status) {
  const dispatch = state.dispatch;
  if (!dispatch || dispatch.status !== 'active') return false;
  const definition = DISPATCHES.find(item => item.id === dispatch.id);
  if (!definition) return false;
  dispatch.status = status;
  dispatch.resolvedAt = state.elapsed;
  dispatch.nextAt = state.elapsed + 4.5;
  dispatch.revision += 1;
  if (status === 'completed') {
    dispatch.completed += 1;
    dispatch.streak += 1;
    dispatch.marks += definition.marks;
  } else {
    dispatch.failed += 1;
    dispatch.streak = 0;
  }
  dispatch.lastResult = {
    id: definition.id,
    status,
    marks: status === 'completed' ? definition.marks : 0,
    at: state.elapsed
  };
  return true;
}

function recordDispatchService(state, customer, automated, patienceRatio) {
  const dispatch = state.dispatch;
  if (!dispatch || dispatch.status !== 'active') return;
  const definition = DISPATCHES.find(item => item.id === dispatch.id);
  if (!definition) return;
  if (definition.kind === 'manual-lanes' && !automated) {
    if (!dispatch.manualLanes.includes(customer.lane)) dispatch.manualLanes.push(customer.lane);
    dispatch.progress = dispatch.manualLanes.length;
  } else if (definition.kind === 'manual' && !automated) {
    dispatch.progress += 1;
  } else if (definition.kind === 'clean') {
    dispatch.progress += 1;
  } else if (definition.kind === 'perfect' && patienceRatio >= .68) {
    dispatch.progress += 1;
  }
  dispatch.progress = Math.min(definition.goal, dispatch.progress);
  if (dispatch.progress >= definition.goal) resolveDispatch(state, 'completed');
}

export function dispatchStatus(state) {
  const dispatch = state?.dispatch;
  const definition = DISPATCHES.find(item => item.id === dispatch?.id) || dispatchDefinition(state, dispatch?.cycle);
  const status = ['active', 'completed', 'failed'].includes(dispatch?.status) ? dispatch.status : 'active';
  const progress = Math.min(definition.goal, Math.max(0, Math.floor(Number(dispatch?.progress) || 0)));
  const remaining = status === 'active'
    ? Math.max(0, (Number(dispatch?.deadline) || 0) - (Number(state?.elapsed) || 0))
    : Math.max(0, (Number(dispatch?.nextAt) || 0) - (Number(state?.elapsed) || 0));
  return {
    id: definition.id,
    title: definition.title,
    short: definition.short,
    copy: definition.copy,
    kind: definition.kind,
    status,
    progress,
    goal: definition.goal,
    remaining,
    duration: definition.duration,
    marksReward: definition.marks,
    marks: Math.max(0, Math.floor(Number(dispatch?.marks) || 0)),
    completed: Math.max(0, Math.floor(Number(dispatch?.completed) || 0)),
    failed: Math.max(0, Math.floor(Number(dispatch?.failed) || 0)),
    streak: Math.max(0, Math.floor(Number(dispatch?.streak) || 0)),
    revision: Math.max(0, Math.floor(Number(dispatch?.revision) || 0)),
    phase: status === 'completed' ? 'SIGNAL CAPTURED' : status === 'failed' ? 'SIGNAL LOST' : 'LIVE DISPATCH'
  };
}

export function createNewGame(modeId = 'standard', seed = Date.now()) {
  const mode = RUN_MODES[modeId] || RUN_MODES.standard;
  const normalizedSeed = Number(seed) >>> 0;
  const state = {
    version: GAME_VERSION,
    seed: normalizedSeed,
    runId: `${mode.id}-${normalizedSeed}`,
    mode: mode.id,
    elapsed: 0,
    day: 1,
    hour: 7,
    totalDays: mode.days,
    dayLength: mode.dayLength,
    credits: 96,
    debt: STARTING_DEBT,
    fuel: 61,
    fuelCapacity: 100,
    stock: 27,
    stockCapacity: 80,
    energy: 88,
    maxEnergy: 100,
    morale: 62,
    badReviews: 64,
    initialBadReviews: 64,
    goodwill: 0,
    customers: [],
    customerCounter: 0,
    spawnClock: 1.4,
    manualCooldowns: { fuel: 0, mart: 0, garage: 0 },
    autoProgress: { fuel: 0, mart: 0, garage: 0 },
    restCooldown: 0,
    upgrades: [],
    modifiers: { demand: 0, reward: 0, patience: 0 },
    seenEvents: [],
    pendingEvent: null,
    burstRemaining: 0,
    stats: {
      served: 0,
      lost: 0,
      perfect: 0,
      manual: 0,
      automated: 0,
      earned: 0,
      debtPaid: 0,
      fuelLeaked: 0,
      peakQueue: 0,
      choices: []
    },
    ended: false,
    outcome: null,
    lastAction: null,
    telemetry: [],
    dispatch: null
  };
  state.dispatch = createDispatch(state);
  captureTelemetryPoint(state, 'start');
  return state;
}

export function captureTelemetryPoint(state, reason = 'day') {
  if (!state || typeof state !== 'object') return null;
  if (!Array.isArray(state.telemetry)) state.telemetry = [];
  const point = {
    reason: String(reason),
    day: Math.max(1, Math.round(Number(state.day) || 1)),
    elapsed: Math.max(0, Math.round((Number(state.elapsed) || 0) * 10) / 10),
    badReviews: clamp(Math.round(Number(state.badReviews) || 0), 0, REVIEW_LIMIT),
    served: Math.max(0, Math.round(Number(state.stats?.served) || 0)),
    lost: Math.max(0, Math.round(Number(state.stats?.lost) || 0)),
    credits: Math.max(0, Math.round(Number(state.credits) || 0)),
    debt: Math.max(0, Math.round(Number(state.debt) || 0)),
    customers: Math.max(0, Math.round(Number(state.customers?.length) || 0)),
    upgrades: Array.isArray(state.upgrades) ? state.upgrades.length : 0
  };
  const lastIndex = state.telemetry.length - 1;
  const last = state.telemetry[lastIndex];
  if (last && last.day === point.day && last.reason === point.reason) state.telemetry[lastIndex] = point;
  else state.telemetry.push(point);
  state.telemetry = state.telemetry.slice(-40);
  return point;
}

export function hasUpgrade(state, id) {
  return state.upgrades.includes(id);
}

export function derivedStats(state) {
  const quantum = hasUpgrade(state, 'quantum-forecourt');
  const holo = hasUpgrade(state, 'holo-canopy');
  const seal = hasUpgrade(state, 'nano-seal');
  const patch = hasUpgrade(state, 'patch-kit');
  const solar = hasUpgrade(state, 'solar-wings');
  const beacon = hasUpgrade(state, 'queue-beacon');
  const clone = hasUpgrade(state, 'service-clone');
  const pump = hasUpgrade(state, 'pump-bot');
  const twin = hasUpgrade(state, 'twin-pumps');
  const stock = hasUpgrade(state, 'stock-drone');
  const kitchen = hasUpgrade(state, 'synth-kitchen');
  const garage = hasUpgrade(state, 'garage-arm');
  return {
    leakRate: seal ? 0 : patch ? 0.035 : 0.078,
    patienceMultiplier: 1 + state.modifiers.patience + (beacon ? 0.3 : 0) + (quantum ? 0.2 : 0),
    rewardMultiplier: 1 + state.modifiers.reward + (holo ? 0.12 : 0) + (quantum ? 0.25 : 0),
    demandMultiplier: Math.max(0.55, 1 + state.modifiers.demand + (holo ? 0.12 : 0)),
    reviewMultiplier: Math.max(0.45, 1 - (beacon ? 0.1 : 0) - (holo ? 0.2 : 0)),
    energyRecovery: solar ? 1.15 : 0.52,
    manualEnergy: quantum ? 2.5 : clone ? 3.2 : 4.4,
    manualCooldown: quantum ? 0.42 : clone ? 0.62 : 1.05,
    autoRates: {
      fuel: (pump ? 1.15 : 0) + (twin ? 0.95 : 0) + (clone ? 1.15 : 0) + (quantum ? 0.75 : 0),
      mart: (stock ? 1.05 : 0) + (kitchen ? 1.2 : 0) + (clone ? 1.15 : 0) + (quantum ? 0.75 : 0),
      garage: (garage ? 0.82 : 0) + (clone ? 1.15 : 0) + (quantum ? 0.75 : 0)
    },
    laneReward: {
      fuel: twin ? 1.15 : 1,
      mart: (stock ? 1.1 : 1) * (kitchen ? 1.35 : 1),
      garage: 1
    },
    laneCost: { fuel: 1, mart: 1, garage: garage ? 0.8 : 1 }
  };
}

function sampleRange(range, random) {
  return mix(range[0], range[1], random());
}

function pickLane(state, random) {
  const progress = state.day / state.totalDays;
  const roll = random();
  if (roll < 0.46 - progress * 0.04) return 'fuel';
  if (roll < 0.78 - progress * 0.02) return 'mart';
  return 'garage';
}

export function spawnCustomer(state, random = Math.random, forcedLane = null) {
  const lane = forcedLane || pickLane(state, random);
  const def = LANE_DEFS[lane];
  const stats = derivedStats(state);
  const maxPatience = sampleRange(def.patience, random) * stats.patienceMultiplier;
  const customer = {
    id: ++state.customerCounter,
    lane,
    species: Math.floor(random() * 6),
    vehicle: Math.floor(random() * 5),
    patience: maxPatience,
    maxPatience,
    reward: sampleRange(def.reward, random),
    resourceCost: sampleRange(def.resourceCost, random),
    reviewPenalty: sampleRange(def.reviewPenalty, random),
    serviceNeed: lane === 'garage' ? 6.5 : lane === 'mart' ? 4.6 : 5.3,
    arrivedAt: state.elapsed,
    mood: 'calm'
  };
  state.customers.push(customer);
  const queue = state.customers.filter(item => item.lane === lane).length;
  state.stats.peakQueue = Math.max(state.stats.peakQueue, queue);
  state.lastAction = { type: 'arrival', lane, customerId: customer.id };
  return customer;
}

function laneQueue(state, lane) {
  return state.customers.filter(customer => customer.lane === lane);
}

function canConsume(state, customer, stats) {
  const def = LANE_DEFS[customer.lane];
  return state[def.resource] >= customer.resourceCost * stats.laneCost[customer.lane];
}

function completeCustomer(state, customer, automated) {
  const stats = derivedStats(state);
  const def = LANE_DEFS[customer.lane];
  const cost = customer.resourceCost * stats.laneCost[customer.lane];
  state[def.resource] = Math.max(0, state[def.resource] - cost);
  const patienceRatio = customer.patience / customer.maxPatience;
  const earned = Math.round(customer.reward * stats.rewardMultiplier * stats.laneReward[customer.lane] * (0.88 + patienceRatio * 0.22));
  const debtBefore = state.debt;
  const debtShare = state.debt > 0 ? Math.min(state.debt, Math.max(6, Math.round(earned * 0.34))) : 0;
  state.debt = Math.max(0, state.debt - debtShare);
  state.credits += earned - debtShare;
  state.stats.earned += earned;
  state.stats.debtPaid += debtShare;
  state.stats.served += 1;
  state.stats[automated ? 'automated' : 'manual'] += 1;
  if (patienceRatio > 0.68) {
    state.stats.perfect += 1;
    state.goodwill += 1;
    if (state.stats.perfect % 4 === 0) state.badReviews = Math.max(0, state.badReviews - 3);
  }
  state.customers = state.customers.filter(item => item.id !== customer.id);
  state.lastAction = {
    type: 'served',
    lane: customer.lane,
    customerId: customer.id,
    earned,
    automated,
    patienceRatio,
    debtShare,
    debtBefore,
    debtAfter: state.debt
  };
  recordDispatchService(state, customer, automated, patienceRatio);
  return { ok: true, customer, earned, debtShare, debtBefore, debtAfter: state.debt, automated };
}

export function serveNext(state, lane, automated = false) {
  if (state.ended || !LANE_DEFS[lane]) return { ok: false, reason: 'unavailable' };
  const queue = laneQueue(state, lane);
  if (!queue.length) return { ok: false, reason: 'empty' };
  const stats = derivedStats(state);
  const customer = queue[0];
  if (!canConsume(state, customer, stats)) return { ok: false, reason: LANE_DEFS[lane].resource };
  if (!automated) {
    if (state.manualCooldowns[lane] > 0) return { ok: false, reason: 'cooldown' };
    if (state.energy < stats.manualEnergy) return { ok: false, reason: 'energy' };
    state.energy -= stats.manualEnergy;
    state.morale = Math.max(0, state.morale - 0.38);
    state.manualCooldowns[lane] = stats.manualCooldown;
  }
  return completeCustomer(state, customer, automated);
}

export function buySupply(state, kind) {
  if (state.ended) return { ok: false, reason: 'ended' };
  const options = {
    fuel: { price: 118, amount: 42, cap: 'fuelCapacity' },
    stock: { price: 84, amount: 26, cap: 'stockCapacity' }
  };
  const option = options[kind];
  if (!option) return { ok: false, reason: 'unknown' };
  if (state.credits < option.price) return { ok: false, reason: 'credits' };
  if (state[kind] >= state[option.cap] - 0.5) return { ok: false, reason: 'full' };
  state.credits -= option.price;
  const added = Math.min(option.amount, state[option.cap] - state[kind]);
  state[kind] += added;
  state.lastAction = { type: 'supply', kind, added, price: option.price };
  return { ok: true, added, price: option.price };
}

export function takeMicroNap(state) {
  if (state.ended || state.restCooldown > 0) return { ok: false, reason: 'cooldown' };
  state.energy = Math.min(state.maxEnergy, state.energy + 24);
  state.morale = Math.min(100, state.morale + 11);
  state.restCooldown = 34;
  state.badReviews = Math.min(REVIEW_LIMIT, state.badReviews + 8);
  state.lastAction = { type: 'rest' };
  return { ok: true };
}

export function canBuyUpgrade(state, id) {
  const upgrade = UPGRADES.find(item => item.id === id);
  if (!upgrade) return { ok: false, reason: 'unknown' };
  if (hasUpgrade(state, id)) return { ok: false, reason: 'owned' };
  if (!upgrade.unlock.every(requirement => hasUpgrade(state, requirement))) return { ok: false, reason: 'locked' };
  if (state.credits < upgrade.price) return { ok: false, reason: 'credits' };
  return { ok: true, upgrade };
}

export function buyUpgrade(state, id, free = false) {
  const upgrade = UPGRADES.find(item => item.id === id);
  if (!upgrade) return { ok: false, reason: 'unknown' };
  if (hasUpgrade(state, id)) return { ok: false, reason: 'owned' };
  if (!free) {
    const check = canBuyUpgrade(state, id);
    if (!check.ok) return check;
    state.credits -= upgrade.price;
  }
  state.upgrades.push(id);
  if (id === 'nano-seal') {
    state.fuelCapacity += 30;
    state.fuel = Math.min(state.fuelCapacity, state.fuel + 12);
  }
  if (id === 'solar-wings') {
    state.maxEnergy += 20;
    state.energy += 20;
  }
  if (id === 'synth-kitchen') {
    state.stockCapacity += 30;
  }
  state.lastAction = { type: 'upgrade', id, free };
  return { ok: true, upgrade, free };
}

export function nextEventForState(state) {
  return EVENTS.find(event =>
    event.day <= state.day &&
    !state.seenEvents.includes(event.id) &&
    (!event.modes || event.modes.includes(state.mode))
  ) || null;
}

function applyEffect(state, effect, random) {
  if (effect.credits) state.credits = Math.max(0, state.credits + effect.credits);
  if (effect.reviews) state.badReviews = clamp(state.badReviews + effect.reviews, 0, REVIEW_LIMIT);
  if (effect.goodwill) state.goodwill = Math.max(0, state.goodwill + effect.goodwill);
  if (effect.stock) state.stock = clamp(state.stock + effect.stock, 0, state.stockCapacity);
  if (effect.fuel) state.fuel = clamp(state.fuel + effect.fuel, 0, state.fuelCapacity);
  if (effect.demand) state.modifiers.demand += effect.demand;
  if (effect.reward) state.modifiers.reward += effect.reward;
  if (effect.patience) state.modifiers.patience += effect.patience;
  if (effect.burst) state.burstRemaining += effect.burst;
  if (effect.grantUpgrade) {
    if (hasUpgrade(state, effect.grantUpgrade)) state.credits += effect.fallbackCredits || 0;
    else buyUpgrade(state, effect.grantUpgrade, true);
  }
  if (effect.conditionalRepair) {
    if (!hasUpgrade(state, 'patch-kit')) buyUpgrade(state, 'patch-kit', true);
    else if (!hasUpgrade(state, 'nano-seal')) buyUpgrade(state, 'nano-seal', true);
    else state.goodwill += 30;
  }
  if (effect.chance === 'inspection') {
    if (random() < 0.5) {
      state.goodwill += 30;
      state.badReviews = Math.max(0, state.badReviews - 40);
    } else {
      state.badReviews = Math.min(REVIEW_LIMIT, state.badReviews + 95);
    }
  }
}

export function chooseEvent(state, eventId, choiceId, random = Math.random) {
  const event = EVENTS.find(item => item.id === eventId);
  const choice = event?.choices.find(item => item.id === choiceId);
  if (!event || !choice || state.seenEvents.includes(eventId)) return { ok: false, reason: 'invalid' };
  applyEffect(state, choice.effect, random);
  state.seenEvents.push(eventId);
  state.pendingEvent = null;
  state.stats.choices.push({ eventId, choiceId, day: state.day });
  state.lastAction = { type: 'choice', eventId, choiceId };
  return { ok: true, event, choice };
}

function loseCustomer(state, customer) {
  const stats = derivedStats(state);
  const penalty = Math.round(customer.reviewPenalty * stats.reviewMultiplier);
  state.customers = state.customers.filter(item => item.id !== customer.id);
  state.badReviews = Math.min(REVIEW_LIMIT, state.badReviews + penalty);
  state.morale = Math.max(0, state.morale - 1.1);
  state.stats.lost += 1;
  state.lastAction = { type: 'lost', lane: customer.lane, customerId: customer.id, penalty };
  const definition = DISPATCHES.find(item => item.id === state.dispatch?.id);
  if (state.dispatch?.status === 'active' && definition?.kind === 'clean') resolveDispatch(state, 'failed');
}

function calculateSpawnInterval(state) {
  const progress = clamp((state.day - 1) / Math.max(1, state.totalDays - 1), 0, 1);
  const rush = 0.78 + Math.sin((state.hour / 24) * Math.PI * 2 - 1.2) * 0.24;
  const base = mix(3.15, 1.08, Math.pow(progress, 0.78));
  return clamp(base / derivedStats(state).demandMultiplier / rush, 0.52, 4.2);
}

export function calculateScore(state) {
  const mode = RUN_MODES[state.mode] || RUN_MODES.standard;
  const assetSale = Math.round(state.fuel * 1.4 + state.stock * 1.8 + state.upgrades.length * 42);
  const reviewBonus = Math.round((REVIEW_LIMIT - state.badReviews) * 0.7);
  const dispatchBonus = dispatchStatus(state).marks * 30;
  const base = Math.max(0, Math.round(state.credits + assetSale + reviewBonus + dispatchBonus - state.debt));
  return Math.round(base * mode.scoreMultiplier);
}

export function tickGame(state, dt, random = Math.random) {
  if (state.ended || state.pendingEvent || !Number.isFinite(dt) || dt <= 0) return state;
  dt = Math.min(dt, 0.25);
  const beforeDay = state.day;
  state.elapsed += dt;
  const totalDuration = state.totalDays * state.dayLength;
  const dayProgress = (state.elapsed % state.dayLength) / state.dayLength;
  state.day = Math.min(state.totalDays, Math.floor(state.elapsed / state.dayLength) + 1);
  state.hour = Math.floor((7 + dayProgress * 18) % 24);
  const stats = derivedStats(state);

  if (!state.dispatch) state.dispatch = createDispatch(state);
  if (state.dispatch.status === 'active' && state.elapsed >= state.dispatch.deadline) {
    resolveDispatch(state, 'failed');
  } else if (state.dispatch.status !== 'active' && state.elapsed >= state.dispatch.nextAt) {
    const previous = state.dispatch;
    state.dispatch = createDispatch(state, previous.cycle + 1, {
      completed: previous.completed,
      failed: previous.failed,
      streak: previous.streak,
      marks: previous.marks,
      revision: previous.revision + 1,
      lastResult: { id: previous.id, status: 'rotated', marks: 0, at: state.elapsed }
    });
  }

  if (stats.leakRate > 0 && state.fuel > 0) {
    const leaked = Math.min(state.fuel, stats.leakRate * dt);
    state.fuel -= leaked;
    state.stats.fuelLeaked += leaked;
  }
  state.energy = Math.min(state.maxEnergy, state.energy + stats.energyRecovery * dt);
  state.morale = clamp(state.morale + (state.customers.length < 4 ? 0.07 : -0.04) * dt, 0, 100);
  state.restCooldown = Math.max(0, state.restCooldown - dt);
  for (const lane of Object.keys(state.manualCooldowns)) {
    state.manualCooldowns[lane] = Math.max(0, state.manualCooldowns[lane] - dt);
  }

  state.spawnClock -= dt;
  if (state.spawnClock <= 0) {
    spawnCustomer(state, random);
    state.spawnClock += state.burstRemaining > 0 ? 0.36 : calculateSpawnInterval(state);
    if (state.burstRemaining > 0) state.burstRemaining -= 1;
  }

  for (const lane of Object.keys(LANE_DEFS)) {
    const rate = stats.autoRates[lane];
    const queue = laneQueue(state, lane);
    if (rate > 0 && queue.length) {
      state.autoProgress[lane] += rate * dt;
      if (state.autoProgress[lane] >= queue[0].serviceNeed) {
        const result = serveNext(state, lane, true);
        if (result.ok) state.autoProgress[lane] = 0;
        else state.autoProgress[lane] = Math.min(state.autoProgress[lane], queue[0].serviceNeed * 0.92);
      }
    } else {
      state.autoProgress[lane] = Math.max(0, state.autoProgress[lane] - dt * 0.25);
    }
  }

  for (const customer of [...state.customers]) {
    const queuePosition = laneQueue(state, customer.lane).findIndex(item => item.id === customer.id);
    const drain = dt * (1 + queuePosition * 0.055);
    customer.patience -= drain;
    const ratio = customer.patience / customer.maxPatience;
    customer.mood = ratio < 0.24 ? 'furious' : ratio < 0.5 ? 'worried' : 'calm';
    if (customer.patience <= 0) loseCustomer(state, customer);
  }

  if (state.day !== beforeDay) {
    state.morale = clamp(state.morale + 2.5, 0, 100);
    state.lastAction = { type: 'day', day: state.day };
    captureTelemetryPoint(state, 'day');
  }
  const event = nextEventForState(state);
  if (event) state.pendingEvent = event.id;

  if (state.badReviews >= REVIEW_LIMIT) {
    state.ended = true;
    state.outcome = 'reviews';
  } else if (state.elapsed >= totalDuration) {
    state.elapsed = totalDuration;
    state.ended = true;
    state.outcome = 'retired';
  }
  if (state.ended) captureTelemetryPoint(state, 'final');
  return state;
}

export function queueSummary(state, lane) {
  const queue = laneQueue(state, lane);
  const front = queue[0] || null;
  return {
    count: queue.length,
    front,
    urgency: front ? 1 - front.patience / front.maxPatience : 0,
    autoRate: derivedStats(state).autoRates[lane],
    autoProgress: state.autoProgress[lane]
  };
}

export function queueConstellation(state) {
  const lanes = Object.keys(LANE_DEFS).map((lane, order) => {
    const summary = queueSummary(state, lane);
    const patience = summary.front
      ? clamp(summary.front.patience / Math.max(.001, summary.front.maxPatience), 0, 1)
      : 1;
    const urgency = summary.front ? clamp(1 - patience, 0, 1) : 0;
    const tone = !summary.front ? 'clear' : patience < .28 ? 'danger' : patience < .52 ? 'warning' : 'steady';
    return {
      lane,
      order,
      label: LANE_DEFS[lane].short,
      count: summary.count,
      visiblePips: Math.min(5, summary.count),
      overflow: Math.max(0, summary.count - 5),
      patience: Math.round(patience * 1000) / 1000,
      urgency: Math.round(urgency * 1000) / 1000,
      tone,
      phase: tone === 'clear' ? 'CLEAR' : tone === 'danger' ? 'CRITICAL' : tone === 'warning' ? 'STRESSED' : 'STABLE'
    };
  });
  const dominant = lanes
    .filter(lane => lane.count > 0)
    .sort((a, b) => b.urgency - a.urgency || b.count - a.count || a.order - b.order)[0] || null;
  return {
    total: lanes.reduce((sum, lane) => sum + lane.count, 0),
    dominantLane: dominant?.lane || null,
    lanes
  };
}

export function shiftAtmosphere(state) {
  const dayLength = Math.max(.001, Number(state?.dayLength) || 1);
  const elapsed = Math.max(0, Number(state?.elapsed) || 0);
  const cycle = ((elapsed % dayLength) + dayLength) % dayLength;
  const rawProgress = cycle / dayLength;
  const totalHours = (7 + rawProgress * 18) % 24;
  const hour = Math.floor(totalHours);
  const minute = Math.floor((totalHours - hour) * 60);
  let id = 'shift-dawn';
  let phase = 'FIRST LIGHT';
  let tone = 'dawn';
  if (rawProgress >= .78) {
    id = 'shift-night';
    phase = 'DEEP WATCH';
    tone = 'night';
  } else if (rawProgress >= .56) {
    id = 'shift-dusk';
    phase = 'EMBER SHIFT';
    tone = 'dusk';
  } else if (rawProgress >= .22) {
    id = 'shift-day';
    phase = 'HIGH ORBIT';
    tone = 'day';
  }
  return {
    id,
    phase,
    tone,
    progress: Math.round(rawProgress * 1000) / 1000,
    hour,
    minute,
    time: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
  };
}

export function arrivalForecast(state) {
  if (!state || state.ended) {
    return {
      id: 'arrival-settled',
      phase: 'SHIFT CLOSED',
      tone: 'steady',
      seconds: 0,
      progress: 0,
      burst: 0,
      eta: '—'
    };
  }

  const seconds = Math.max(0, Number(state.spawnClock) || 0);
  const burst = Math.max(0, Math.round(Number(state.burstRemaining) || 0));
  const interval = burst > 0 ? .36 : calculateSpawnInterval(state);
  const held = seconds > Math.max(12, interval * 3);
  const progress = held ? 0 : clamp(1 - seconds / Math.max(.1, interval), 0, 1);
  const roundedSeconds = Math.round(seconds * 10) / 10;

  if (held) {
    return {
      id: 'arrival-held',
      phase: 'SIGNAL HELD',
      tone: 'steady',
      seconds: roundedSeconds,
      progress: 0,
      burst,
      eta: 'HELD'
    };
  }
  if (burst > 0) {
    return {
      id: 'arrival-surge',
      phase: 'CONVOY SURGE',
      tone: 'danger',
      seconds: roundedSeconds,
      progress: Math.round(progress * 1000) / 1000,
      burst,
      eta: roundedSeconds < .05 ? 'NOW' : `${roundedSeconds.toFixed(1)} SEC`
    };
  }
  if (seconds <= .72) {
    return {
      id: 'arrival-final',
      phase: 'FINAL APPROACH',
      tone: 'danger',
      seconds: roundedSeconds,
      progress: Math.round(progress * 1000) / 1000,
      burst: 0,
      eta: roundedSeconds < .05 ? 'NOW' : `${roundedSeconds.toFixed(1)} SEC`
    };
  }
  if (seconds <= 1.65) {
    return {
      id: 'arrival-near',
      phase: 'APPROACHING',
      tone: 'warning',
      seconds: roundedSeconds,
      progress: Math.round(progress * 1000) / 1000,
      burst: 0,
      eta: `${roundedSeconds.toFixed(1)} SEC`
    };
  }
  return {
    id: 'arrival-inbound',
    phase: 'ON VECTOR',
    tone: 'steady',
    seconds: roundedSeconds,
    progress: Math.round(progress * 1000) / 1000,
    burst: 0,
    eta: `${roundedSeconds.toFixed(1)} SEC`
  };
}

export function operationalAdvice(state) {
  if (!state || state.ended) {
    return {
      id: 'run-settled',
      tone: 'steady',
      title: 'The shift is settled',
      copy: 'Review the result, then choose whether this station gets another run.',
      action: { type: 'watch', label: 'REVIEW RUN' }
    };
  }

  const stats = derivedStats(state);
  const laneOrder = Object.keys(LANE_DEFS);
  const lanes = laneOrder.map((lane, order) => ({ lane, order, ...queueSummary(state, lane) }));
  const waiting = lanes
    .filter(summary => summary.front)
    .sort((a, b) => b.urgency - a.urgency || a.order - b.order);
  const front = waiting[0] || null;
  const criticalReviews = state.badReviews >= REVIEW_LIMIT * .78;
  const resourcePrices = { fuel: 118, stock: 84 };
  const blocked = waiting
    .filter(summary => {
      const def = LANE_DEFS[summary.lane];
      return state[def.resource] < summary.front.resourceCost * stats.laneCost[summary.lane];
    })
    .sort((a, b) => b.urgency - a.urgency || a.order - b.order)[0];

  if (blocked) {
    const kind = LANE_DEFS[blocked.lane].resource;
    const label = kind === 'fuel' ? 'PLASMA' : 'STOCK';
    const canAfford = state.credits >= resourcePrices[kind];
    return {
      id: `${kind}-blocks-${blocked.lane}`,
      tone: 'danger',
      title: `${LANE_DEFS[blocked.lane].short} cannot serve`,
      copy: `${label} is below this customer's need. ${canAfford ? 'Order a delivery now.' : `Hold the lane and bank ${resourcePrices[kind]} CR for delivery.`}`,
      action: { type: 'supply', kind, lane: blocked.lane, label: `CHECK ${label}` }
    };
  }

  if (front && state.energy < stats.manualEnergy && state.restCooldown <= 0) {
    return {
      id: 'energy-blocks-service',
      tone: criticalReviews ? 'danger' : 'warning',
      title: 'Your hands are empty',
      copy: `Manual service needs ${Math.ceil(stats.manualEnergy)} energy. A micro nap restores 24 but adds 8 reviews.`,
      action: { type: 'rest', label: 'CHECK ENERGY' }
    };
  }

  if (front && (criticalReviews || front.urgency >= .68)) {
    const danger = criticalReviews || front.urgency >= .82;
    return {
      id: `urgent-${front.lane}`,
      tone: danger ? 'danger' : 'warning',
      title: criticalReviews ? 'License margin collapsing' : `${LANE_DEFS[front.lane].short} patience falling`,
      copy: `${LANE_DEFS[front.lane].name} is the most exposed front customer. Clear it before the next review lands.`,
      action: { type: 'serve', lane: front.lane, label: `FOCUS ${LANE_DEFS[front.lane].short}` }
    };
  }

  if (!hasUpgrade(state, 'patch-kit')) {
    const patch = UPGRADES.find(upgrade => upgrade.id === 'patch-kit');
    return {
      id: 'plan-patch-kit',
      tone: 'warning',
      title: 'The tank is still leaking',
      copy: state.credits >= patch.price
        ? 'The emergency patch is affordable. Cut the leak before the rush compounds it.'
        : `Bank ${patch.price} CR for the emergency patch while you keep the queues moving.`,
      action: { type: 'upgrade', id: patch.id, label: 'OPEN PATCH' }
    };
  }

  const affordable = UPGRADES.find(upgrade => canBuyUpgrade(state, upgrade.id).ok);
  if (affordable) {
    return {
      id: `affordable-${affordable.id}`,
      tone: 'opportunity',
      title: 'Cash can become throughput',
      copy: `${affordable.name} is ready to build. The drawer stays non-modal while the station keeps running.`,
      action: { type: 'upgrade', id: affordable.id, label: 'OPEN BUILD' }
    };
  }

  if (front) {
    return {
      id: `watch-${front.lane}`,
      tone: 'steady',
      title: `${LANE_DEFS[front.lane].short} leads the queue`,
      copy: `${LANE_DEFS[front.lane].name} has the least patient front customer. Keep it in view while demand climbs.`,
      action: { type: 'serve', lane: front.lane, label: `FOCUS ${LANE_DEFS[front.lane].short}` }
    };
  }

  const lowSupply = ['fuel', 'stock'].find(kind => state[kind] / state[`${kind}Capacity`] < .25);
  if (lowSupply) {
    return {
      id: `low-${lowSupply}`,
      tone: 'warning',
      title: `${lowSupply === 'fuel' ? 'Plasma' : 'Stock'} reserve is thin`,
      copy: 'The forecourt is quiet. Use the gap to prepare for the next convoy.',
      action: { type: 'supply', kind: lowSupply, label: `CHECK ${lowSupply === 'fuel' ? 'PLASMA' : 'STOCK'}` }
    };
  }

  return {
    id: criticalReviews ? 'quiet-license-risk' : 'quiet-forecourt',
    tone: criticalReviews ? 'warning' : 'steady',
    title: criticalReviews ? 'Protect the remaining margin' : 'A rare quiet second',
    copy: criticalReviews
      ? 'Avoid risky rest and keep every lane ready. One angry convoy can still end the contract.'
      : 'Scan supplies, review the build plan, and let your automation prepare for the next arrival.',
    action: { type: 'watch', label: 'SCAN STATION' }
  };
}

export function sanitizeLoadedState(value) {
  if (!value || !COMPATIBLE_SAVE_VERSIONS.has(value.version) || !RUN_MODES[value.mode]) return null;
  const base = createNewGame(value.mode, value.seed);
  const merged = { ...base, ...value };
  merged.version = GAME_VERSION;
  merged.runId = String(value.runId || base.runId);
  merged.initialBadReviews = clamp(Number(value.initialBadReviews) || base.initialBadReviews, 0, REVIEW_LIMIT);
  merged.manualCooldowns = { ...base.manualCooldowns, ...(value.manualCooldowns || {}) };
  merged.autoProgress = { ...base.autoProgress, ...(value.autoProgress || {}) };
  merged.modifiers = { ...base.modifiers, ...(value.modifiers || {}) };
  merged.stats = { ...base.stats, ...(value.stats || {}) };
  merged.stats.choices = decisionLegacy(merged).entries.map(entry => ({
    eventId: entry.eventId,
    choiceId: entry.choiceId,
    day: entry.day
  }));
  merged.customers = Array.isArray(value.customers) ? value.customers.slice(0, 60) : [];
  merged.upgrades = Array.isArray(value.upgrades) ? value.upgrades.filter(id => UPGRADES.some(upgrade => upgrade.id === id)) : [];
  merged.seenEvents = Array.isArray(value.seenEvents) ? value.seenEvents : [];
  merged.telemetry = Array.isArray(value.telemetry)
    ? value.telemetry.filter(point => point && typeof point === 'object').slice(-40)
    : [];
  const savedDispatch = value.dispatch;
  if (!savedDispatch || !DISPATCHES.some(item => item.id === savedDispatch.id)) {
    merged.dispatch = createDispatch(merged, 0);
  } else {
    const definition = DISPATCHES.find(item => item.id === savedDispatch.id);
    const status = ['active', 'completed', 'failed'].includes(savedDispatch.status) ? savedDispatch.status : 'active';
    merged.dispatch = {
      cycle: Math.max(0, Math.floor(Number(savedDispatch.cycle) || 0)),
      id: definition.id,
      status,
      progress: clamp(Math.floor(Number(savedDispatch.progress) || 0), 0, definition.goal),
      manualLanes: Array.isArray(savedDispatch.manualLanes)
        ? [...new Set(savedDispatch.manualLanes.filter(lane => Object.hasOwn(LANE_DEFS, lane)))].slice(0, 3)
        : [],
      startedAt: Math.max(0, Number(savedDispatch.startedAt) || merged.elapsed),
      deadline: Math.max(merged.elapsed, Number(savedDispatch.deadline) || (merged.elapsed + definition.duration)),
      resolvedAt: Number.isFinite(savedDispatch.resolvedAt) ? Math.max(0, savedDispatch.resolvedAt) : null,
      nextAt: Number.isFinite(savedDispatch.nextAt) ? Math.max(merged.elapsed, savedDispatch.nextAt) : null,
      completed: Math.max(0, Math.floor(Number(savedDispatch.completed) || 0)),
      failed: Math.max(0, Math.floor(Number(savedDispatch.failed) || 0)),
      streak: Math.max(0, Math.floor(Number(savedDispatch.streak) || 0)),
      marks: Math.max(0, Math.floor(Number(savedDispatch.marks) || 0)),
      revision: Math.max(0, Math.floor(Number(savedDispatch.revision) || 0)),
      lastResult: savedDispatch.lastResult && typeof savedDispatch.lastResult === 'object' ? savedDispatch.lastResult : null
    };
    if (status !== 'active' && merged.dispatch.nextAt === null) merged.dispatch.nextAt = merged.elapsed + 4.5;
  }
  if (!merged.telemetry.length) captureTelemetryPoint(merged, 'migrated');
  return merged;
}
