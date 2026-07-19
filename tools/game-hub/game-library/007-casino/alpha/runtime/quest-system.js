"use strict";

// One shared 1-4 player campaign. Quests consume settled domain events only;
// this module has no reference to a draw spine, slot book, or money ledger.

var catalog = require("../../slots/slot-catalog.js");

function freezeQuest(quest) {
  if (quest.objective.where) Object.freeze(quest.objective.where);
  Object.freeze(quest.objective);
  if (quest.action) Object.freeze(quest.action);
  return Object.freeze(quest);
}

var LUX_CHAPTER = {
  id: "lux5_backroom_v1",
  slotStyleId: "lux-5",
  title: "Something Under the Bar",
  quests: [
    {
      id: "wake_lux5",
      title: "Something Under the Bar",
      description: "Find the forgotten robot cabinet and wake LUX-5 up.",
      objective: { event: "machine_interacted", goal: 1, where: { styleId: "lux-5" } },
      action: { command: "interact", styleId: "lux-5", label: "Wake LUX-5" }
    },
    {
      id: "fund_the_float",
      title: "Put Money Behind It",
      description: "Move personal money into the shared house float.",
      objective: { event: "house_funded", goal: 1 },
      action: { command: "fund_house", amount: 10, label: "Fund house · 10" }
    },
    {
      id: "first_customer",
      title: "First Customer",
      description: "Let the first NPC settle a paid spin on LUX-5.",
      objective: { event: "npc_paid_spin_settled", goal: 1, where: { styleId: "lux-5" } }
    },
    {
      id: "trust_the_table",
      title: "Trust the Table",
      description: "Use two different wagers. The immutable draw order never reads either one.",
      objective: { event: "player_wager_used", goal: 2, uniqueField: "wagerUnits", where: { styleId: "lux-5" } }
    },
    {
      id: "keep_lights_on",
      title: "Keep the Lights On",
      description: "Settle five paid player spins, then close a solvent opening shift.",
      objective: { event: "opening_shift_closed", goal: 1 },
      action: { command: "close_opening_shift", label: "Close opening shift" }
    },
    {
      id: "place_upstairs",
      title: "A Place Upstairs",
      description: "Claim the first permanent traffic lease for the backroom casino.",
      objective: { event: "story_lease_claimed", goal: 1 },
      action: { command: "claim_story_lease", label: "Claim upstairs lease" }
    }
  ]
};

var CHAPTER_COPY = {
  graftgarden: ["Wake Moss & Bolt", "Grow Three Paths", "Let the Risk Branch", "A Guest in the Garden"],
  "mirror-mice": ["Wake the Mirror Mice", "Find Three Reflections", "Bet on Both Sides", "A Guest in the Mirror"],
  "night-courier": ["Call Pip In", "Complete Three Routes", "Choose the Fare", "Pip's First Passenger"],
  "pocket-vault": ["Assemble the Crew", "Try Three Tiny Plans", "Fund the Risk", "A Patron With a Key"],
  weatherheart: ["Wake Nimbus-9", "Read Three Forecasts", "Weather Two Wagers", "A Guest Under the Cloud"],
  "spare-parts-choir": ["Wake the Choir", "Play Three Chords", "Change the Tempo", "A Listener Takes a Seat"],
  nullbloom: ["Let Nullbloom Out", "Close Three Loops", "Risk Around Nothing", "A Guest Brings a Flower"],
  "orbit-oven": ["Preheat the Orbit", "Bake Three Recipes", "Change the Portion", "Dinner for a Patron"],
  "twinlight-relay": ["Wake Both Lights", "Send Three Signals", "Bridge Two Wagers", "The District Answers"]
};

function newSlotChapter(definition) {
  var copy = CHAPTER_COPY[definition.id];
  return {
    id: definition.id + "_story_v1",
    slotStyleId: definition.id,
    title: definition.chapterTitle,
    quests: [
      {
        id: "reveal_" + definition.id,
        title: copy[0],
        description: "Find " + definition.name + " in the next room and bring its little machine personality online.",
        objective: { event: "machine_interacted", goal: 1, where: { styleId: definition.id } },
        action: { command: "interact", styleId: definition.id, label: copy[0] }
      },
      {
        id: "learn_" + definition.id,
        title: copy[1],
        description: "Settle three paid spins and watch how " + definition.signature.toLowerCase() + " resolve.",
        objective: { event: "spin_settled", goal: 3, where: { styleId: definition.id, free: false } }
      },
      {
        id: "risk_" + definition.id,
        title: copy[2],
        description: "Use two different wagers on this machine. Wager scales the result; it never chooses it.",
        objective: { event: "player_wager_used", goal: 2, uniqueField: "wagerUnits", where: { styleId: definition.id } }
      },
      {
        id: "patron_" + definition.id,
        title: copy[3],
        description: "Let an NPC patron settle one paid spin here, using the very same casino-wide Draw Spine.",
        objective: { event: "npc_paid_spin_settled", goal: 1, where: { styleId: definition.id } }
      }
    ]
  };
}

var CHAPTERS = [LUX_CHAPTER].concat(catalog.newStyles.map(newSlotChapter));
var ALL_QUESTS = [];

CHAPTERS.forEach(function (chapter, chapterIndex) {
  chapter.quests = chapter.quests.map(function (quest, chapterQuestIndex) {
    quest.chapterId = chapter.id;
    quest.slotStyleId = chapter.slotStyleId;
    quest.chapterIndex = chapterIndex;
    quest.chapterQuestIndex = chapterQuestIndex;
    quest.globalIndex = ALL_QUESTS.length;
    var frozen = freezeQuest(quest);
    ALL_QUESTS.push(frozen);
    return frozen;
  });
  Object.freeze(chapter.quests);
  Object.freeze(chapter);
});
Object.freeze(CHAPTERS);
Object.freeze(ALL_QUESTS);

var CAMPAIGN = Object.freeze({
  id: "axm_backroom_ten_slots_v1",
  title: "Ten Lights Under the District",
  chapters: CHAPTERS,
  quests: ALL_QUESTS
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function freshProgress() {
  return {
    schema: "axm.casino-story-progress/v2",
    campaignId: CAMPAIGN.id,
    activeIndex: 0,
    completed: [],
    counters: {},
    uniqueValues: {},
    finished: false
  };
}

function migrateV1(supplied) {
  var state = freshProgress();
  state.activeIndex = Math.max(0, Math.min(LUX_CHAPTER.quests.length, Number(supplied.activeIndex) || 0));
  state.completed = Array.isArray(supplied.completed) ? supplied.completed.filter(function (id) {
    return ALL_QUESTS.some(function (quest) { return quest.id === id; });
  }) : [];
  state.counters = supplied.counters && typeof supplied.counters === "object" ? clone(supplied.counters) : {};
  state.uniqueValues = supplied.uniqueValues && typeof supplied.uniqueValues === "object" ? clone(supplied.uniqueValues) : {};
  return state;
}

function normalizeProgress(first, second) {
  var supplied = typeof first === "string" ? second : first;
  var state;
  if (supplied && supplied.schema === "axm.casino-quest-progress/v1") state = migrateV1(supplied);
  else if (supplied && supplied.schema === "axm.casino-story-progress/v2") state = clone(supplied);
  else state = freshProgress();

  if (state.campaignId !== CAMPAIGN.id) return freshProgress();
  if (!Number.isInteger(state.activeIndex) || state.activeIndex < 0 || state.activeIndex > ALL_QUESTS.length) return freshProgress();
  state.completed = Array.isArray(state.completed) ? state.completed.filter(function (id) {
    return ALL_QUESTS.some(function (quest) { return quest.id === id; });
  }) : [];
  state.counters = state.counters && typeof state.counters === "object" ? state.counters : {};
  state.uniqueValues = state.uniqueValues && typeof state.uniqueValues === "object" ? state.uniqueValues : {};
  state.finished = state.activeIndex >= ALL_QUESTS.length;
  return state;
}

function currentQuest(progress) {
  return progress && !progress.finished ? ALL_QUESTS[progress.activeIndex] || null : null;
}

function chapterByIndex(index) {
  return CHAPTERS[index] || null;
}

function currentChapter(progress) {
  var quest = currentQuest(progress);
  return quest ? chapterByIndex(quest.chapterIndex) : null;
}

function completedChapterIds(progress) {
  return CHAPTERS.filter(function (chapter) {
    return chapter.quests.every(function (quest) { return progress.completed.indexOf(quest.id) !== -1; });
  }).map(function (chapter) { return chapter.id; });
}

function publicState(progress) {
  var quest = currentQuest(progress);
  var chapter = currentChapter(progress);
  var count = quest ? Number(progress.counters[quest.id] || 0) : 0;
  return {
    campaignId: CAMPAIGN.id,
    campaignTitle: CAMPAIGN.title,
    packId: chapter ? chapter.id : null,
    packTitle: chapter ? chapter.title : CAMPAIGN.title,
    slotStyleId: chapter ? chapter.slotStyleId : null,
    activeIndex: progress.activeIndex,
    total: ALL_QUESTS.length,
    completed: progress.completed.slice(),
    completedChapters: completedChapterIds(progress),
    finished: progress.finished,
    chapterIndex: chapter ? quest.chapterIndex : CHAPTERS.length,
    chapterTotal: CHAPTERS.length,
    chapter: chapter ? {
      id: chapter.id,
      title: chapter.title,
      slotStyleId: chapter.slotStyleId,
      activeIndex: quest.chapterQuestIndex,
      total: chapter.quests.length
    } : null,
    current: quest ? {
      id: quest.id,
      title: quest.title,
      description: quest.description,
      slotStyleId: quest.slotStyleId,
      objectiveEvent: quest.objective.event,
      action: quest.action ? clone(quest.action) : null,
      progress: count,
      goal: quest.objective.goal
    } : null
  };
}

function eventMatches(objective, event) {
  if (!event || event.type !== objective.event) return false;
  if (!objective.where) return true;
  return Object.keys(objective.where).every(function (key) {
    return event.data && event.data[key] === objective.where[key];
  });
}

function applyEvent(progress, event) {
  var quest = currentQuest(progress);
  var result = { changed: false, emitted: [] };
  var objective;
  var unique;
  var value;
  var count;
  var completedChapter;
  var next;

  if (!quest || !eventMatches(quest.objective, event)) return result;
  objective = quest.objective;
  if (objective.uniqueField) {
    unique = Array.isArray(progress.uniqueValues[quest.id]) ? progress.uniqueValues[quest.id].slice() : [];
    value = event.data && event.data[objective.uniqueField];
    if (typeof value === "undefined" || unique.indexOf(value) !== -1) return result;
    unique.push(value);
    progress.uniqueValues[quest.id] = unique;
    count = unique.length;
  } else {
    count = Number(progress.counters[quest.id] || 0) + 1;
  }
  progress.counters[quest.id] = count;
  result.changed = true;
  result.emitted.push({
    type: "quest_progressed",
    visibility: "party_a",
    data: { questId: quest.id, styleId: quest.slotStyleId, progress: count, goal: objective.goal }
  });

  if (count < objective.goal) return result;

  progress.completed.push(quest.id);
  progress.activeIndex += 1;
  progress.finished = progress.activeIndex >= ALL_QUESTS.length;
  result.emitted.push({
    type: "quest_completed",
    visibility: "party_a",
    data: { questId: quest.id, styleId: quest.slotStyleId, title: quest.title }
  });

  completedChapter = chapterByIndex(quest.chapterIndex);
  if (quest.chapterQuestIndex === completedChapter.quests.length - 1) {
    result.emitted.push({
      type: "slot_chapter_completed",
      visibility: "party_a",
      data: { chapterId: completedChapter.id, styleId: completedChapter.slotStyleId, title: completedChapter.title }
    });
    result.emitted.push({
      type: "quest_pack_completed",
      visibility: "party_a",
      data: { packId: completedChapter.id, styleId: completedChapter.slotStyleId }
    });
  }

  if (!progress.finished) {
    next = currentQuest(progress);
    if (next.chapterIndex !== quest.chapterIndex) {
      var nextChapter = chapterByIndex(next.chapterIndex);
      result.emitted.push({
        type: "slot_chapter_started",
        visibility: "party_a",
        data: { chapterId: nextChapter.id, styleId: nextChapter.slotStyleId, title: nextChapter.title }
      });
    }
    result.emitted.push({
      type: "quest_started",
      visibility: "party_a",
      data: { questId: next.id, styleId: next.slotStyleId, title: next.title }
    });
  } else {
    result.emitted.push({
      type: "story_campaign_completed",
      visibility: "party_a",
      data: { campaignId: CAMPAIGN.id, chapters: CHAPTERS.length }
    });
  }
  return result;
}

function packById(packId) {
  var pack = CHAPTERS.find(function (chapter) { return chapter.id === packId; });
  if (!pack) throw new Error("unknown quest pack: " + packId);
  return pack;
}

module.exports = Object.freeze({
  CAMPAIGN: CAMPAIGN,
  CHAPTERS: CHAPTERS,
  PACKS: Object.freeze(CHAPTERS.reduce(function (packs, chapter) { packs[chapter.id] = chapter; return packs; }, {})),
  applyEvent: applyEvent,
  chapterByIndex: chapterByIndex,
  currentChapter: currentChapter,
  currentQuest: currentQuest,
  freshProgress: freshProgress,
  normalizeProgress: normalizeProgress,
  packById: packById,
  publicState: publicState
});
