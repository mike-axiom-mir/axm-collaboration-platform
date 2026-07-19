"use strict";

// Ten immutable slot styles behind one neutral settlement contract. LUX-5
// keeps its solved reel model. The nine v1 additions use audited finite-book
// payout distributions and style-specific presentation recipes. A row never
// receives a wager, bankroll, actor, owner, casino, or location.

var crypto = require("crypto");
var path = require("path");
var luxRoot = path.resolve(__dirname, "lux-5");
var luxModel = require(path.join(luxRoot, "lux5-model.js"));
var luxRng = require(path.join(luxRoot, "lux5-rng.js"));
var luxBook = require(path.join(luxRoot, "lux5-outcome-book.js"));

var TABLE_LENGTH = 50000;
var PAYOUT_SCALE = 1000000;
var TARGET_RTP_PPM = 960000;

function bucket(count, payoutX, label) {
  return Object.freeze({
    count: count,
    payoutPpm: Math.round(payoutX * PAYOUT_SCALE),
    label: label
  });
}

var LUX_META = Object.freeze({
  id: "lux-5",
  name: "LUX-5",
  shortName: "LUX-5",
  chapterTitle: "Something Under the Bar",
  description: "A balanced five-reel robot with scatters, retriggering free spins, and the six-face Overdrive wheel.",
  signature: "Four horizontal lines · 4/7/18 free spins · Overdrive wheel",
  featureName: "Robot Overdrive",
  layout: "reels",
  icon: "◆",
  accent: "pink",
  volatility: "balanced",
  mathVersion: luxModel.constants.mathVersion,
  targetRtpPercent: 96,
  tableLength: TABLE_LENGTH,
  originalModel: true
});

var NEW_STYLES = [
  {
    id: "graftgarden",
    name: "Moss & Bolt: Graftgarden",
    shortName: "Graftgarden",
    chapterTitle: "Where the Roots Meet",
    description: "Two mechanical gardens grow toward one another. Lit roots pay when their paths graft through the middle.",
    signature: "Edge-to-centre root paths",
    featureName: "Central Graft",
    layout: "graft",
    icon: "❧",
    accent: "green",
    volatility: "low-medium",
    board: { columns: 6, rows: 4 },
    symbols: ["·", "♧", "⚙", "✿", "⌁"],
    winToken: "✿",
    featureThresholdPpm: 8000000,
    distribution: [
      bucket(27500, 0, "Dormant soil"), bucket(8000, 0.5, "Fresh sprout"),
      bucket(6000, 1, "Root return"), bucket(4000, 2, "Joined roots"),
      bucket(2500, 3.99, "Garden line"), bucket(1500, 8, "Central graft"),
      bucket(450, 15, "Neon bloom"), bucket(45, 25, "Grand canopy"),
      bucket(5, 30, "Perfect graft")
    ]
  },
  {
    id: "mirror-mice",
    name: "Mirror Mice",
    shortName: "Mirror Mice",
    chapterTitle: "The Other Side Squeaks",
    description: "Two robot mice score reflected pairs before folding their opposing boards into one bright mirror.",
    signature: "Reflected coordinate pairs",
    featureName: "Mirror Fold",
    layout: "mirror",
    icon: "◫",
    accent: "violet",
    volatility: "medium-high",
    board: { columns: 6, rows: 3 },
    symbols: ["○", "△", "□", "◇", "✦"],
    winToken: "✦",
    featureThresholdPpm: 16000000,
    distribution: [
      bucket(32500, 0, "Empty reflection"), bucket(6000, 0.5, "Tiny twin"),
      bucket(4500, 1, "Even pair"), bucket(3000, 2, "Double image"),
      bucket(2000, 4, "Bright symmetry"), bucket(1200, 8, "Silver mirror"),
      bucket(600, 16, "Mirror fold"), bucket(170, 30, "Perfect reflection"),
      bucket(29, 70, "Prismatic twins"), bucket(1, 170, "Impossible symmetry")
    ]
  },
  {
    id: "night-courier",
    name: "Pip's Night Courier",
    shortName: "Night Courier",
    chapterTitle: "One More Stop Before Dawn",
    description: "Pip completes glowing parcel routes around a twelve-stop night circuit and occasionally catches an express lap.",
    signature: "Origin-to-destination route completion",
    featureName: "Express Lap",
    layout: "track",
    icon: "➜",
    accent: "cyan",
    volatility: "low-medium",
    board: { columns: 6, rows: 2 },
    symbols: ["•", "▣", "➜", "⌂", "★"],
    winToken: "➜",
    featureThresholdPpm: 12000000,
    distribution: [
      bucket(20000, 0, "Missed delivery"), bucket(12000, 0.5, "Local parcel"),
      bucket(8000, 1, "Route return"), bucket(5000, 1.5, "Two-stop run"),
      bucket(3000, 2.5, "Night route"), bucket(1500, 5, "Fast delivery"),
      bucket(400, 12, "Express lap"), bucket(90, 50, "Citywide run"),
      bucket(10, 220, "Pip before sunrise")
    ]
  },
  {
    id: "pocket-vault",
    name: "Pocket Vault Crew",
    shortName: "Vault Crew",
    chapterTitle: "Five Bots, One Very Small Plan",
    description: "Scanner, climber, magnet, decoder, and lookout combinations open increasingly valuable miniature vault rooms.",
    signature: "Complete crew-role combinations",
    featureName: "Multi-room Heist",
    layout: "vault",
    icon: "▤",
    accent: "gold",
    volatility: "high",
    board: { columns: 5, rows: 3 },
    symbols: ["◉", "⌁", "⊕", "⌘", "△"],
    winToken: "▣",
    featureThresholdPpm: 12000000,
    distribution: [
      bucket(39000, 0, "Locked room"), bucket(4000, 0.5, "Loose coin"),
      bucket(2500, 1.5, "Side drawer"), bucket(1800, 3, "First room"),
      bucket(1200, 6, "Two-room job"), bucket(800, 12, "Crew assembled"),
      bucket(400, 25, "Multi-room heist"), bucket(200, 40, "Silent vault"),
      bucket(90, 15, "Magnet mishap"), bucket(10, 70, "Pocket masterplan")
    ]
  },
  {
    id: "weatherheart",
    name: "Nimbus-9 Weatherheart",
    shortName: "Weatherheart",
    chapterTitle: "A Forecast With Feelings",
    description: "Nimbus resolves every board through a precommitted sun, rain, wind, or frost transformation.",
    signature: "Four precommitted weather transformations",
    featureName: "Weatherheart",
    layout: "weather",
    icon: "☁",
    accent: "sky",
    volatility: "medium",
    board: { columns: 4, rows: 4 },
    symbols: ["○", "☂", "❄", "⌁", "☀"],
    winToken: "✦",
    featureThresholdPpm: 8000000,
    distribution: [
      bucket(30000, 0, "Quiet sky"), bucket(7000, 0.5, "Soft drizzle"),
      bucket(5000, 1, "Clear return"), bucket(3500, 2, "Warm front"),
      bucket(2200, 4, "Tailwind"), bucket(1300, 8, "Weatherheart"),
      bucket(700, 15, "Perfect storm"), bucket(280, 9, "Crystal frost"),
      bucket(20, 14, "Four-season sky")
    ]
  },
  {
    id: "spare-parts-choir",
    name: "Choir of Spare Parts",
    shortName: "Spare Parts Choir",
    chapterTitle: "Teach the Scrap to Sing",
    description: "Five scrap robots pay for valid note sets and chords instead of left-to-right symbol lines.",
    signature: "Order-independent musical chords",
    featureName: "Five-Part Encore",
    layout: "choir",
    icon: "♫",
    accent: "rose",
    volatility: "low",
    board: { columns: 5, rows: 3 },
    symbols: ["♩", "♪", "♫", "♬", "·"],
    winToken: "★",
    featureThresholdPpm: 10000000,
    distribution: [
      bucket(15000, 0, "Dissonance"), bucket(15000, 0.5, "Tiny harmony"),
      bucket(9000, 1, "Even chord"), bucket(6000, 1.5, "Bright triad"),
      bucket(3000, 2.5, "Four-note chord"), bucket(1200, 5, "Scrap chorus"),
      bucket(600, 10, "Full harmony"), bucket(200, 15, "Five-part encore")
    ]
  },
  {
    id: "nullbloom",
    name: "Nullbloom",
    shortName: "Nullbloom",
    chapterTitle: "Flowers Around Nothing",
    description: "A shy void creature pays when neon vines form closed loops around empty space, not for ordinary clusters.",
    signature: "Closed loops around negative space",
    featureName: "Grand Enclosure",
    layout: "nullbloom",
    icon: "✾",
    accent: "magenta",
    volatility: "high",
    board: { columns: 7, rows: 7 },
    symbols: ["·", "•", "✣", "❀", "◇"],
    winToken: "✾",
    featureThresholdPpm: 20000000,
    distribution: [
      bucket(36000, 0, "Open vine"), bucket(5000, 0.4, "Tiny loop"),
      bucket(3500, 1, "Closed bud"), bucket(2500, 2, "Small enclosure"),
      bucket(1500, 5, "Neon garden"), bucket(900, 10, "Void bloom"),
      bucket(400, 20, "Grand enclosure"), bucket(150, 40, "Blacklight orchard"),
      bucket(45, 100, "Perfect nothing"), bucket(5, 500, "The void flowers")
    ]
  },
  {
    id: "orbit-oven",
    name: "Orbit Oven",
    shortName: "Orbit Oven",
    chapterTitle: "Dinner Has Entered Orbit",
    description: "Three concentric ingredient rings form radial recipes while the cheerful robot oven tries not to overheat.",
    signature: "Radial three-ring recipes",
    featureName: "Orbital Overheat",
    layout: "orbit",
    icon: "◎",
    accent: "orange",
    volatility: "medium",
    board: { columns: 8, rows: 3 },
    symbols: ["●", "▲", "■", "◆", "✦"],
    winToken: "✦",
    featureThresholdPpm: 15000000,
    distribution: [
      bucket(31000, 0, "Cold oven"), bucket(7000, 0.4, "Warm crumb"),
      bucket(4500, 1, "Simple recipe"), bucket(3000, 2, "Double bake"),
      bucket(2000, 4, "Orbital dish"), bucket(1300, 8, "Chef's ring"),
      bucket(700, 15, "Orbital overheat"), bucket(450, 10, "Meteor meal"),
      bucket(45, 20, "Planet banquet"), bucket(5, 80, "Perfect orbit oven")
    ]
  },
  {
    id: "twinlight-relay",
    name: "Twinlight Relay",
    shortName: "Twinlight Relay",
    chapterTitle: "Meet in the Middle",
    description: "Two beacon robots resolve independent signal boards and multiply the result when both paths bridge at the centre.",
    signature: "Dual boards with a centre bridge",
    featureName: "Twinlight Bridge",
    layout: "twinlight",
    icon: "⇄",
    accent: "blue",
    volatility: "medium-high",
    board: { columns: 8, rows: 3 },
    symbols: ["·", "○", "◇", "➜", "✦"],
    winToken: "✦",
    featureThresholdPpm: 16000000,
    distribution: [
      bucket(34000, 0, "Lost signal"), bucket(5500, 0.5, "Faint ping"),
      bucket(4000, 1, "One beacon"), bucket(2800, 2, "Return signal"),
      bucket(1800, 4, "Double relay"), bucket(1000, 8, "Centre contact"),
      bucket(500, 16, "Twinlight bridge"), bucket(250, 30, "Perfect relay"),
      bucket(100, 40, "District signal"), bucket(45, 15, "Crossed wires"),
      bucket(5, 55, "Two lights, one sky")
    ]
  }
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function seededUint32(seed, styleId, rowIndex, lane) {
  var digest = crypto.createHash("sha256").update([
    "AXM_SLOT_PRESENTATION_V1", seed, styleId, rowIndex, lane
  ].join("|")).digest();
  return digest.readUInt32LE(0) || 0x6d2b79f5;
}

function RowRandom(seed, styleId, rowIndex) {
  this.state = seededUint32(seed, styleId, rowIndex, "layout");
}

RowRandom.prototype.nextUint32 = function () {
  var x = this.state >>> 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  this.state = x >>> 0;
  return this.state;
};

RowRandom.prototype.integer = function (minimum, maximum) {
  return minimum + (this.nextUint32() % (maximum - minimum + 1));
};

function definitionById(styleId) {
  if (styleId === LUX_META.id) return LUX_META;
  return NEW_STYLES.find(function (style) { return style.id === styleId; }) || null;
}

function bucketAt(definition, rowIndex) {
  var cursor = 0;
  for (var index = 0; index < definition.distribution.length; index += 1) {
    cursor += definition.distribution[index].count;
    if (rowIndex < cursor) {
      return {
        rank: index,
        count: definition.distribution[index].count,
        payoutPpm: definition.distribution[index].payoutPpm,
        label: definition.distribution[index].label
      };
    }
  }
  throw new RangeError("style book row is outside its distribution");
}

function fillCells(definition, random) {
  var total = definition.board.columns * definition.board.rows;
  var cells = [];
  for (var index = 0; index < total; index += 1) {
    cells.push(definition.symbols[random.integer(0, definition.symbols.length - 1)]);
  }
  return cells;
}

function activate(cells, active, index, token) {
  if (index < 0 || index >= cells.length || active.indexOf(index) !== -1) return;
  cells[index] = token;
  active.push(index);
}

function compilePresentation(definition, outcomeBucket, rowIndex, seed) {
  var random = new RowRandom(seed, definition.id, rowIndex);
  var columns = definition.board.columns;
  var rows = definition.board.rows;
  var cells = fillCells(definition, random);
  var active = [];
  var paying = outcomeBucket.payoutPpm > 0;
  var strength = Math.max(1, outcomeBucket.rank);
  var summary = paying ? outcomeBucket.label : "No completed " + definition.signature.toLowerCase();
  var featureActive = paying && outcomeBucket.payoutPpm >= definition.featureThresholdPpm;
  var row;
  var column;
  var index;

  if (paying && definition.layout === "graft") {
    row = random.integer(0, rows - 1);
    for (column = 0; column < Math.min(columns, 2 + strength); column += 1) {
      activate(cells, active, row * columns + column, definition.winToken);
    }
  } else if (paying && definition.layout === "mirror") {
    for (index = 0; index < Math.min(9, 1 + strength); index += 1) {
      row = Math.floor(index / 3);
      column = index % 3;
      activate(cells, active, row * columns + column, definition.winToken);
      activate(cells, active, row * columns + (columns - 1 - column), definition.winToken);
    }
  } else if (paying && definition.layout === "track") {
    for (index = 0; index < Math.min(cells.length, 2 + strength); index += 1) {
      activate(cells, active, index, definition.winToken);
    }
  } else if (paying && definition.layout === "vault") {
    for (column = 0; column < Math.min(columns, 1 + Math.ceil(strength / 2)); column += 1) {
      for (row = 0; row < rows; row += 1) activate(cells, active, row * columns + column, definition.winToken);
    }
  } else if (paying && definition.layout === "weather") {
    var weather = ["☀", "☂", "⌁", "❄"][random.integer(0, 3)];
    for (index = 0; index < Math.min(cells.length, 2 + strength); index += 1) {
      activate(cells, active, (index * 5 + random.integer(0, 3)) % cells.length, weather);
    }
    summary = weather + " " + outcomeBucket.label;
  } else if (paying && definition.layout === "choir") {
    for (column = 0; column < Math.min(columns, 2 + Math.ceil(strength / 2)); column += 1) {
      activate(cells, active, columns + column, definition.symbols[column % 4]);
    }
  } else if (paying && definition.layout === "nullbloom") {
    var radius = Math.min(3, 1 + Math.floor(strength / 3));
    var centre = 3;
    for (row = centre - radius; row <= centre + radius; row += 1) {
      for (column = centre - radius; column <= centre + radius; column += 1) {
        if (row === centre - radius || row === centre + radius || column === centre - radius || column === centre + radius) {
          activate(cells, active, row * columns + column, definition.winToken);
        }
      }
    }
  } else if (paying && definition.layout === "orbit") {
    for (index = 0; index < Math.min(3, 1 + Math.floor(strength / 3)); index += 1) {
      column = (random.integer(0, columns - 1) + index * 3) % columns;
      for (row = 0; row < rows; row += 1) activate(cells, active, row * columns + column, definition.winToken);
    }
  } else if (paying && definition.layout === "twinlight") {
    row = random.integer(0, rows - 1);
    var reach = Math.min(4, 1 + Math.ceil(strength / 2));
    for (column = 0; column < reach; column += 1) {
      activate(cells, active, row * columns + column, definition.winToken);
      activate(cells, active, row * columns + (columns - 1 - column), definition.winToken);
    }
  }

  active.sort(function (left, right) { return left - right; });
  return {
    layout: definition.layout,
    columns: columns,
    rows: rows,
    cells: cells,
    activeCells: active,
    featureName: definition.featureName,
    featureActive: featureActive,
    featureValue: outcomeBucket.label,
    summary: summary
  };
}

function luxRowAt(rowIndex, seed) {
  var record = luxRng.generateRecord(seed, rowIndex);
  var row = luxBook.deriveRow(record, rowIndex);
  row.styleId = LUX_META.id;
  row.styleName = LUX_META.name;
  row.presentation = {
    layout: "reels",
    columns: 5,
    rows: 4,
    cells: row.grid.join("").split(""),
    activeCells: [],
    featureName: LUX_META.featureName,
    featureActive: row.wheelTriggered,
    featureValue: row.wheelTriggered ? ((row.wheelDeltaBps >= 0 ? "+" : "") + (row.wheelDeltaBps / 100) + "%") : "",
    summary: row.winningLines.length ? row.winningLines.length + " winning line" + (row.winningLines.length === 1 ? "" : "s") : "No completed line"
  };
  return row;
}

function newStyleRowAt(definition, rowIndex, seed) {
  var outcomeBucket = bucketAt(definition, rowIndex);
  var presentation = compilePresentation(definition, outcomeBucket, rowIndex, seed);
  return {
    schema: "axm-slot-outcome-row",
    version: 1,
    index: rowIndex,
    styleId: definition.id,
    styleName: definition.name,
    grid: [],
    scatterCount: 0,
    freeSpinsAwarded: 0,
    winningLines: [],
    wins: outcomeBucket.payoutPpm > 0 ? [{
      kind: definition.layout,
      label: outcomeBucket.label,
      activeCells: presentation.activeCells.length,
      payoutPpm: outcomeBucket.payoutPpm
    }] : [],
    wheelIndex: null,
    wheelDeltaBps: 0,
    wheelTriggered: false,
    paidPayoutPpm: outcomeBucket.payoutPpm,
    freePayoutPpm: outcomeBucket.payoutPpm,
    jackpotTicket: null,
    humanJackpot: false,
    npcJackpot: false,
    presentation: presentation
  };
}

function rowAt(styleId, rowIndex, seed) {
  var definition = definitionById(styleId);
  if (!definition) throw new RangeError("unknown slot style: " + styleId);
  if (!Number.isInteger(rowIndex) || rowIndex < 0 || rowIndex >= TABLE_LENGTH) {
    throw new RangeError("slot row index must be from 0 through 49,999");
  }
  if (typeof seed !== "string" || !seed) throw new TypeError("slot style seed is required");
  return styleId === LUX_META.id ? luxRowAt(rowIndex, seed) : newStyleRowAt(definition, rowIndex, seed);
}

function auditDefinition(definition) {
  var records = 0;
  var payoutSumPpm = 0;
  var paying = 0;
  var maxPayoutPpm = 0;
  definition.distribution.forEach(function (entry) {
    records += entry.count;
    payoutSumPpm += entry.count * entry.payoutPpm;
    if (entry.payoutPpm > 0) paying += entry.count;
    maxPayoutPpm = Math.max(maxPayoutPpm, entry.payoutPpm);
  });
  return {
    styleId: definition.id,
    records: records,
    targetRtpPercent: 96,
    exactBookRtpPercent: Number((payoutSumPpm / records / PAYOUT_SCALE * 100).toFixed(6)),
    hitRatePercent: Number((paying / records * 100).toFixed(4)),
    maxPayoutX: maxPayoutPpm / PAYOUT_SCALE,
    payoutSumPpm: payoutSumPpm
  };
}

function validateCatalog() {
  var errors = [];
  var ids = {};
  var layouts = {};
  var all = [LUX_META].concat(NEW_STYLES);
  if (!luxModel.validateModel().ok) errors.push("LUX-5 model is invalid");
  if (all.length !== 10) errors.push("catalog must contain exactly ten starting slots");
  all.forEach(function (definition) {
    if (ids[definition.id]) errors.push("duplicate style id: " + definition.id);
    ids[definition.id] = true;
    if (!definition.name || !definition.signature || !definition.featureName) errors.push("incomplete style metadata: " + definition.id);
    if (!definition.originalModel) {
      var audit = auditDefinition(definition);
      if (audit.records !== TABLE_LENGTH) errors.push(definition.id + " must contain exactly 50,000 outcomes");
      if (audit.payoutSumPpm !== TARGET_RTP_PPM * TABLE_LENGTH) errors.push(definition.id + " does not close to exactly 96% RTP");
      if (layouts[definition.layout]) errors.push("new styles must not share a presentation evaluator: " + definition.layout);
      layouts[definition.layout] = true;
    }
  });
  return { ok: errors.length === 0, errors: errors };
}

function publicStyles(unlockedStyleIds, discoverableStyleId) {
  var unlocked = Array.isArray(unlockedStyleIds) ? unlockedStyleIds : [];
  return [LUX_META].concat(NEW_STYLES).map(function (definition) {
    var available = unlocked.indexOf(definition.id) !== -1;
    var audit = definition.originalModel ? null : auditDefinition(definition);
    return {
      id: definition.id,
      name: definition.name,
      shortName: definition.shortName,
      chapterTitle: definition.chapterTitle,
      description: definition.description,
      signature: definition.signature,
      featureName: definition.featureName,
      layout: definition.layout,
      icon: definition.icon,
      accent: definition.accent,
      volatility: definition.volatility,
      mathVersion: definition.mathVersion || 1,
      tableLength: TABLE_LENGTH,
      targetRtpPercent: 96,
      hitRatePercent: audit ? audit.hitRatePercent : null,
      maxPayoutX: audit ? audit.maxPayoutX : null,
      unlocked: available,
      discoverable: available || definition.id === discoverableStyleId,
      locked: !available
    };
  });
}

NEW_STYLES.forEach(function (style) {
  Object.freeze(style.board);
  Object.freeze(style.symbols);
  Object.freeze(style.distribution);
  Object.freeze(style);
});
Object.freeze(NEW_STYLES);

var validation = validateCatalog();
if (!validation.ok) throw new Error("AXM slot catalog validation failed: " + validation.errors.join("; "));

module.exports = Object.freeze({
  constants: Object.freeze({
    tableLength: TABLE_LENGTH,
    payoutScale: PAYOUT_SCALE,
    targetRtpPpm: TARGET_RTP_PPM,
    jackpotDenominator: luxModel.constants.jackpotDenominator,
    humanJackpotThreshold: luxModel.constants.humanJackpotThreshold,
    npcJackpotThreshold: luxModel.constants.npcJackpotThreshold
  }),
  luxMeta: LUX_META,
  newStyles: NEW_STYLES,
  styleIds: Object.freeze([LUX_META.id].concat(NEW_STYLES.map(function (style) { return style.id; }))),
  definitionById: definitionById,
  rowAt: rowAt,
  auditDefinition: auditDefinition,
  publicStyles: publicStyles,
  validateCatalog: validateCatalog,
  clone: clone
});
