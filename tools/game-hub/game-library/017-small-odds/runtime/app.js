import {
  SAVE_KEY, MONEY, RARITIES, WORLD_EVENTS, LOCATIONS, ACTORS, ACTIVITIES, LIFE_THREADS,
  HOME_UPGRADES, PORTAL_UPGRADES, BUSINESS_TYPES, BUSINESS_BUYERS, BUSINESS_UPGRADES,
  BUSINESS_BRANCHES, CASINO_GAMES, CASINO_LOTS, DISTRICT_RESIDENTS, NEIGHBORHOOD_WORKS, NEIGHBORHOOD_COMMONS, catalogCombinationCount
} from './game-data.js';
import {
  createInitialState, migrateState, currentWorldEvent, formatPlanetTime, unlockPortal,
  drawItems, marketQuote, performItemAction, runActivity, travelTo, startBusiness,
  buyHomeUpgrade, buyPortalUpgrade, rushPortalCharge, skipToMorning, redeemCasinoTicket,
  playCasinoGame, casinoGameMath, casinoInsuranceQuote, setCasinoInsurance,
  buyCasinoLot, lifeThreadAtLocation, lifeThreadChoices, matchingLifeThreadItems, resolveLifeThread,
  businessListingCapacity, businessPetProfile, listBusinessItem, delistBusinessItem,
  acceptBusinessOffer, counterBusinessOffer, returnBusinessEquipment, assignBusinessPet,
  buyBusinessUpgrade, chooseBusinessBranch, businessTags, districtResidentsNow, districtSupplierProfile, districtHouseholdProfile, householdPetProfile,
  districtArcStatus, resolveDistrictArcChoice, districtResidentObservation, interactDistrictResident,
  giftDistrictItem, districtFamilyEcho, availableWorkOrder, neighborhoodWorkProfile, workPetProfile,
  matchingWorkTools, workOrderQuote, startWorkOrder, commonsMaintenanceProfile,
  commonsMaintenanceOptions, startCommonsMaintenance, commonsGovernanceOptions, chooseCommonsGovernance,
  SYSTEM_CONSTANTS
} from './systems.js';
import { WorldRenderer } from './renderer.js';
import { PocketAudio } from './audio.js';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, character => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;'
})[character]);
const formatCredits = value => `${Number(value || 0).toLocaleString()}${MONEY}`;
const rarityById = id => RARITIES.find(rarity => rarity.id === id) || RARITIES[0];

const elements = {
  splash: $('#splash'), game: $('#gameRoot'), newGame: $('#newGameButton'), continueGame: $('#continueButton'),
  titleButton: $('#titleButton'), money: $('#moneyValue'), energy: $('#energyValue'), charge: $('#chargeValue'),
  place: $('#placeName'), time: $('#planetTime'), kicker: $('#locationKicker'), eventName: $('#eventName'),
  eventSummary: $('#eventSummary'), eventCard: $('#eventCard'), activityList: $('#activityList'),
  activityCount: $('#activityCount'), feed: $('#eventFeed'), actorButton: $('#actorButton'), actorLabel: $('#actorLabel'),
  speech: $('#speechBubble'), speechText: $('#speechText'), prompt: $('#scenePrompt'), pipLabel: $('#pipLabel'),
  panelBackdrop: $('#panelBackdrop'), panel: $('#mainPanel'), panelContent: $('#panelContent'),
  panelTitle: $('#panelTitle'), panelEyebrow: $('#panelEyebrow'), panelClose: $('#panelCloseButton'),
  discovery: $('#discoveryModal'), discoveryClose: $('#discoveryCloseButton'), discoveryKeep: $('#discoveryKeepButton'),
  discoveryReceipt: $('#discoveryReceiptButton'), intro: $('#introCard'), introTitle: $('#introTitle'),
  introText: $('#introText'), introNext: $('#introNextButton'), toast: $('#toast'), toastText: $('#toastText'),
  inventoryDock: $('#inventoryDockText'), portalDock: $('#portalDockText'), homeDock: $('#homeDockText'),
  petsDock: $('#petsDockText'), businessDock: $('#businessDockText')
};

let state = null;
let renderer = null;
let activePanel = null;
let discoveryQueue = [];
let currentDiscovery = null;
let introIndex = 0;
let speechTimer = null;
let toastTimer = null;
let activeReceipt = null;
let activeLifeThreadId = null;
let panelReturnFocus = null;
let pendingTicketReveal = false;
const audio = new PocketAudio(() => state?.settings.sound !== false);

const introBeats = [
  {
    eyebrow:'ONE ORDINARY TERRIBLE DAY',
    title:'Your employer replaced you with a taller hat.',
    text:'Your landlord needs the room for a cousin who exists. By sunset, everything you own fits in one box.',
    action:'CARRY THE BOX HOME'
  },
  {
    eyebrow:'THE OLD ROOM',
    title:'Your parents kept everything. Especially the embarrassing ceiling.',
    text:'Mum hugs you. Dad pretends the new shelf was always planned. Neither asks how long you are staying.',
    action:'GO WALK BY THE GLIMMER'
  },
  {
    eyebrow:'THE SEA IS NOT WATER',
    title:'A machine-shell creature walks out of the Glimmer.',
    text:'Its shell flickers like a tube-age appliance. A highest-value banknote slides from a portal. You reach. The creature takes it back.',
    action:'REACH ANYWAY'
  }
];

function hasSave() {
  try { return Boolean(localStorage.getItem(SAVE_KEY)); }
  catch { return false; }
}

function save() {
  if (!state) return;
  state.updatedAt = new Date().toISOString();
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); }
  catch (error) { showToast(`Save failed: ${error.message}`); }
}

function load() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return null;
  return migrateState(JSON.parse(raw));
}

function showToast(text, duration = 4200) {
  clearTimeout(toastTimer);
  elements.toastText.textContent = text;
  elements.toast.hidden = false;
  toastTimer = setTimeout(() => { elements.toast.hidden = true; }, duration);
}

function showSpeech(text) {
  clearTimeout(speechTimer);
  elements.speechText.textContent = text;
  elements.speech.hidden = false;
  speechTimer = setTimeout(() => { elements.speech.hidden = true; }, 4800);
}

function enterGame() {
  elements.splash.hidden = true;
  elements.game.hidden = false;
  if (!renderer) renderer = new WorldRenderer($('#worldCanvas'), () => ({ state }));
  render();
}

function returnToTitle() {
  closePanel();
  elements.discovery.hidden = true;
  elements.intro.hidden = true;
  elements.game.hidden = true;
  elements.splash.hidden = false;
  elements.continueGame.hidden = !hasSave();
}

function startNewGame() {
  if (hasSave() && !window.confirm('Begin a new life? Export first if you want to keep the current local save.')) return;
  state = createInitialState('Pip');
  save();
  introIndex = 0;
  enterGame();
  showIntroBeat();
}

function continueGame() {
  try {
    state = load();
    if (!state) throw new Error('No local life was found.');
    enterGame();
    showToast(`Day ${state.day}. The house remembered you.`);
  } catch (error) {
    window.alert(`Could not restore this save: ${error.message}`);
  }
}

function showIntroBeat() {
  const beat = introBeats[introIndex];
  if (!beat) {
    elements.intro.hidden = true;
    state.introStep = Math.max(state.introStep, 0);
    render();
    showToast('Move with A/D or click a glowing point. Press E to interact.');
    return;
  }
  elements.intro.querySelector('.eyebrow').textContent = beat.eyebrow;
  elements.introTitle.textContent = beat.title;
  elements.introText.textContent = beat.text;
  elements.introNext.textContent = beat.action;
  elements.intro.hidden = false;
}

function advanceIntro() {
  audio.click();
  introIndex += 1;
  if (introIndex >= introBeats.length) {
    elements.intro.hidden = true;
    state.location = 'shore';
    state.focus = 1;
    save();
    render();
    handleHotspot(0);
    return;
  }
  showIntroBeat();
}

function sceneHotspots(location) {
  const sets = {
    shore: [
      { label: state.portal.unlocked ? 'SHELLBY’S OLD MARK' : 'PORTAL CREATURE', prompt: state.portal.unlocked ? 'Check the portal scorch mark' : 'Reach for the escaping banknote' },
      { label:'GEL TIDE', prompt:'Walk beside the Glimmer' },
      { label:'LOST POCKETS', prompt:'Search what the sea returned' }
    ],
    room: [
      { label:'RANDOMIZER', prompt:'Wake the Random Item Portal Device' },
      { label:'CITY WINDOW', prompt:'Watch the neighborhood misbehave' },
      { label:'OLD SHELF', prompt:'Sort the old moving boxes with Dad' }
    ],
    kitchen: [
      { label:'DINNER ORGANISM', prompt:'Cook whatever dinner becomes' },
      { label:'HEATING ORGAN', prompt:'Help Mum soothe the heating organ' },
      { label:'FAMILY TABLE', prompt:'Sit down without announcing failure' }
    ],
    district: [
      { label:'LIVING NOTICEBOARD', prompt:'Read who is where on Lopsided Lane' },
      { label:'PARCEL SPINE', prompt:'Inspect deliveries that became neighborhood gossip' },
      { label:'PARENTS’ WINDOW', prompt:'See what the house noticed from here' }
    ],
    market: [
      { label:'PRICE ORACLE', prompt:'Hear what became valuable' },
      { label:'EMPTY STALL', prompt:'Consider a bedroom business' },
      { label:'GIANT GROCERIES', prompt:'Carry impossible groceries for credits' }
    ],
    starspite: [
      { label:'EXACT ODDS FLOOR', prompt:'Play a table with the math above it' },
      { label:'HONEST AUCTION', prompt:'Inspect authored artifacts at posted prices' },
      { label:'OBSERVATION LOUNGE', prompt:'Watch the planet become a tiny bad decision' }
    ]
  };
  return sets[location];
}

function updateSceneChrome() {
  const location = LOCATIONS[state.location];
  elements.place.textContent = location.name;
  elements.time.textContent = formatPlanetTime(state);
  elements.kicker.textContent = location.kicker;
  const districtResidents = state.location === 'district' ? districtResidentsNow(state) : [];
  const districtActor = districtResidents.length ? districtResidents[(state.day + Math.floor(state.hour / 6)) % districtResidents.length] : null;
  const actor = districtActor?.actor || ACTORS[location.actor];
  elements.actorLabel.textContent = actor.name;
  const actorLeft = Math.round((districtActor?.current.x || actor.positions[state.location] || .67) * 100);
  elements.actorButton.style.left = `${actorLeft}%`;
  elements.actorButton.style.top = state.location === 'shore' ? '47%' : state.location === 'market' ? '43%' : state.location === 'starspite' ? '40%' : state.location === 'district' ? '42%' : '45%';
  elements.actorButton.setAttribute('aria-label',districtActor ? `Talk with ${actor.name}` : 'Interact with nearby alien');
  elements.actorButton.dataset.districtResident = districtActor?.id || '';
  const hotspots = sceneHotspots(state.location);
  [$('#hotspotA'), $('#hotspotB'), $('#hotspotC')].forEach((button, index) => {
    button.querySelector('b').textContent = hotspots[index].label;
    button.setAttribute('aria-label', hotspots[index].prompt);
  });
  const prompt = hotspots[state.focus % hotspots.length]?.prompt || hotspots[0].prompt;
  elements.prompt.querySelector('span').textContent = prompt;
  const positions = LOCATIONS[state.location].focus;
  elements.pipLabel.style.left = `${(positions[state.focus] || positions[0]) * 100}%`;
  $('.travel').classList.toggle('has-starspite', state.starspite.access === 'member');
  $$('[data-travel]').forEach(button => {
    if (button.dataset.travel === 'starspite') button.hidden = state.starspite.access !== 'member';
    button.classList.toggle('is-current', button.dataset.travel === state.location);
  });
}

function updateHud() {
  elements.money.textContent = state.money.toLocaleString();
  elements.energy.textContent = state.player.energy;
  elements.charge.textContent = `${state.portal.charges}/${state.portal.maxCharges}`;
  elements.inventoryDock.textContent = `${state.inventory.length} item${state.inventory.length === 1 ? '' : 's'}`;
  elements.portalDock.textContent = state.portal.unlocked ? `${state.portal.charges} charge${state.portal.charges === 1 ? '' : 's'} · ${state.portal.draws} draws` : 'not yours yet';
  elements.homeDock.textContent = `score ${state.home.score} · ${state.home.upgrades.length} upgrades`;
  elements.petsDock.textContent = state.pets.length ? `${state.pets.length} companion${state.pets.length === 1 ? '' : 's'}` : 'none yet';
  elements.businessDock.textContent = state.business ? `${state.business.rating} rating` : 'unemployed';
}

function updateEvent() {
  const event = currentWorldEvent(state);
  elements.eventName.textContent = event.name;
  elements.eventSummary.textContent = event.summary;
  elements.eventCard.style.setProperty('--event', event.tint);
}

function activityIcon(activity) {
  if (activity.tags.includes('family')) return '⌂';
  if (activity.tags.includes('pet')) return '✣';
  if (activity.tags.includes('market')) return '₡';
  if (activity.tags.includes('glimmer')) return '≋';
  return '◇';
}

function updateActivities() {
  const activities = ACTIVITIES.filter(activity => activity.location === state.location);
  const lifeThread = lifeThreadAtLocation(state);
  elements.activityCount.textContent = activities.length + (lifeThread ? 1 : 0);
  const lifeMarkup = lifeThread ? (() => {
    const definition = LIFE_THREADS.find(thread => thread.id === lifeThread.definitionId);
    return `<button class="activity activity--thread" data-life-thread="${escapeHtml(lifeThread.id)}">
      <span class="activity__icon">◌</span>
      <span><b>${escapeHtml(definition.title)}</b><small>${escapeHtml(definition.summary.slice(0, 76))}${definition.summary.length > 76 ? '…' : ''}</small></span>
      <span class="activity__cost">LIFE ↗</span>
    </button>`;
  })() : '';
  elements.activityList.innerHTML = lifeMarkup + activities.map(activity => `
    <button class="activity" data-activity="${escapeHtml(activity.id)}">
      <span class="activity__icon">${activityIcon(activity)}</span>
      <span><b>${escapeHtml(activity.label)}</b><small>${escapeHtml(activity.detail.slice(0, 59))}${activity.detail.length > 59 ? '…' : ''}</small></span>
      <span class="activity__cost">${activity.hours}h ${activity.energy ? `· ${activity.energy}⚡` : ''}</span>
    </button>
  `).join('');
}

function updateFeed() {
  elements.feed.innerHTML = state.ledger.slice(0, 8).map(entry => `
    <div class="feed__item feed__item--${escapeHtml(entry.kind)}"><i></i><span>${escapeHtml(entry.text)}</span></div>
  `).join('');
}

function render() {
  if (!state) return;
  updateHud();
  updateSceneChrome();
  updateEvent();
  updateActivities();
  updateFeed();
  if (activePanel) renderPanel();
}

function handleHotspot(index) {
  state.focus = index;
  const location = state.location;
  if (location === 'shore' && index === 0) {
    if (!state.portal.unlocked) {
      const result = unlockPortal(state);
      audio.portal();
      showSpeech('Krrrp—bloop. The creature puts the machine in your moving box and immediately denies ownership.');
      showToast(result.text, 6000);
      save(); render();
      setTimeout(() => openPanel('portal'), 900);
      return;
    }
    showSpeech('Shellby’s scorch mark smells like warm pennies and unfinished luck.');
  } else if (location === 'shore' && index === 1) {
    performActivity('walk-glimmer'); return;
  } else if (location === 'shore' && index === 2) {
    state.world.hotspots ||= {};
    if (!state.world.hotspots.lostPockets) {
      state.world.hotspots.lostPockets = true;
      state.money += 11; state.world.totalEarned += 11;
      state.player.knowledge += 1;
      state.ledger.unshift({ at:new Date().toISOString(), day:state.day, hour:state.hour, kind:'life', text:'The Glimmer returned eleven credits and somebody else’s pocket. You kept only the credits.' });
      showToast('Found 11 credits and an ethically complicated pocket.');
      audio.success();
      save(); render();
    } else showSpeech('The Glimmer folds over your footprints and offers no additional pockets.');
  } else if (location === 'room' && index === 0) openPanel('portal');
  else if (location === 'room' && index === 1) {
    const event = currentWorldEvent(state);
    showSpeech(`Outside, ${event.name.toLowerCase()} is changing prices and at least one marriage.`);
  } else if (location === 'room' && index === 2) { performActivity('sort-boxes'); return; }
  else if (location === 'kitchen' && index === 0) { performActivity('cook-dinner'); return; }
  else if (location === 'kitchen' && index === 1) { performActivity('repair-heater'); return; }
  else if (location === 'kitchen' && index === 2) {
    state.player.energy = Math.min(state.player.maxEnergy, state.player.energy + 4);
    state.relationships.mom += 1; state.relationships.dad += 1;
    showSpeech('Nobody asks for a plan. Dinner makes a small, supportive noise.');
    showToast('A quiet family moment: +4 energy, +1 with both parents.'); save(); render();
  } else if (location === 'district' && index === 0) openPanel('district');
  else if (location === 'district' && index === 1) openPanel('district');
  else if (location === 'district' && index === 2) {
    const echo = districtFamilyEcho(state);
    showSpeech(echo.parentText);
    showToast(echo.active ? 'The house has a visible neighborhood memory.' : 'The window is waiting for something worth remembering.');
  } else if (location === 'market' && index === 0) openPanel('market');
  else if (location === 'market' && index === 1) openPanel('business');
  else if (location === 'market' && index === 2) { performActivity('work-crowd'); return; }
  else if (location === 'starspite' && index === 0) openPanel('casino');
  else if (location === 'starspite' && index === 1) openPanel('casino',{ section:'auction' });
  else if (location === 'starspite' && index === 2) {
    showSpeech('Below the glass, Pip\'s entire planet looks like a dropped bead. Vesper quietly moves a chair closer to the window.');
    state.player.knowledge += 2;
    state.relationships.vesper += 1;
    showToast('Perspective acquired: +2 knowledge, +1 with Vesper.'); save(); render();
  }
  audio.click();
  render();
}

function performActivity(activityId) {
  const result = runActivity(state, activityId);
  if (result.ok) {
    result.reactions?.length ? audio.reaction() : audio.success();
    showSpeech(result.text);
  } else audio.click();
  showToast(result.text, result.ok ? 5000 : 3500);
  save(); render();
}

function go(locationId) {
  const result = travelTo(state, locationId);
  if (result.ok) audio.travel();
  showToast(result.text);
  save(); render();
}

function actorInteraction() {
  if (state.location === 'district') {
    const residentId = elements.actorButton.dataset.districtResident;
    const result = interactDistrictResident(state,residentId);
    if (result.ok) {
      showSpeech(result.text);
      showToast(`${result.actor.name} noticed the ${result.status} object state. The receipt claims no randomness.`,5600);
      audio.reaction();
      save(); render();
    } else showToast(result.text);
    return;
  }
  const actor = ACTORS[LOCATIONS[state.location].actor];
  const lifeThread = lifeThreadAtLocation(state);
  if (lifeThread) {
    const definition = LIFE_THREADS.find(thread => thread.id === lifeThread.definitionId);
    showSpeech(definition.actorLine);
    audio.click();
    return;
  }
  const relation = state.relationships[actor.id] || 0;
  const index = Math.abs(state.day + state.hour + relation) % actor.lines.length;
  showSpeech(actor.lines[index]);
  audio.click();
}

function openPanel(panel, options = {}) {
  if (elements.panel.hidden) {
    panelReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }
  const changedPanel = activePanel !== panel;
  activePanel = panel;
  if (options.receipt) activeReceipt = options.receipt;
  if (options.threadId) activeLifeThreadId = options.threadId;
  elements.panelBackdrop.hidden = false;
  elements.panel.hidden = false;
  renderPanel();
  if (changedPanel) elements.panelContent.scrollTop = 0;
  setTimeout(() => elements.panelClose.focus(), 0);
}

function closePanel() {
  const returnFocus = panelReturnFocus;
  activePanel = null;
  activeReceipt = null;
  activeLifeThreadId = null;
  panelReturnFocus = null;
  elements.panel.hidden = true;
  elements.panelBackdrop.hidden = true;
  if (returnFocus?.isConnected && typeof returnFocus.focus === 'function') {
    setTimeout(() => returnFocus.focus(), 0);
  }
}

function setPanelHeading(eyebrow, title) {
  elements.panelEyebrow.textContent = eyebrow;
  elements.panelTitle.textContent = title;
}

function emptyState(glyph, title, text, action = '') {
  return `<div class="empty-state"><div><div class="empty-state__glyph">${glyph}</div><h3>${escapeHtml(title)}</h3><p>${escapeHtml(text)}</p>${action}</div></div>`;
}

function inspectableItems() {
  if (!state) return [];
  return [
    ...state.inventory,
    ...state.installed,
    ...(state.business?.assets || []),
    ...(state.business?.listings || []).map(listing => listing.item)
  ];
}

function itemCard(item, options = {}) {
  const quote = marketQuote(item, state);
  const giftAction = state.location === 'district'
    ? '<button class="mini-button" data-open-panel="district">CHOOSE NEIGHBOR</button>'
    : `<button class="mini-button" data-item-action="gift" data-item-id="${escapeHtml(item.id)}">GIFT HERE</button>`;
  const actions = options.actions === false ? '' : `
    <div class="item-card__actions">
      <button class="mini-button" data-item-action="use" data-item-id="${escapeHtml(item.id)}">USE</button>
      <button class="mini-button" data-item-action="sell" data-item-id="${escapeHtml(item.id)}">SELL ${quote}${MONEY}</button>
      ${giftAction}
      ${item.installable ? `<button class="mini-button" data-item-action="install" data-item-id="${escapeHtml(item.id)}">INSTALL</button>` : ''}
      ${item.hatchable ? `<button class="mini-button" data-item-action="hatch" data-item-id="${escapeHtml(item.id)}">HATCH</button>` : ''}
      ${state.business ? `<button class="mini-button" data-item-action="business" data-item-id="${escapeHtml(item.id)}">EQUIP STORE</button><button class="mini-button" data-business-list="${escapeHtml(item.id)}" ${state.business.listings.length >= businessListingCapacity(state) ? 'disabled' : ''}>LIST ON ALIEN WEB</button>` : ''}
      <button class="mini-button" data-item-action="recycle" data-item-id="${escapeHtml(item.id)}">RECYCLE</button>
      <button class="mini-button" data-receipt-id="${escapeHtml(item.id)}">RECEIPT</button>
    </div>`;
  return `
    <article class="item-card" style="--rarity:${escapeHtml(item.rarityColor)}">
      <div class="item-card__top">
        <div class="item-orbit"><i></i><i></i><i></i><b>${escapeHtml(item.glyph)}</b></div>
        <div class="item-card__meta"><span class="item-card__rarity">${escapeHtml(item.rarityLabel)} · ${escapeHtml(item.aura)}</span><h3>${escapeHtml(item.name)}</h3><p class="item-card__subtitle">${escapeHtml(item.subtitle)}</p></div>
      </div>
      <p class="item-card__desc">${escapeHtml(item.description)}</p>
      <div class="item-card__tags">${item.tags.slice(0, 6).map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div>
      <div class="item-card__footer"><span class="item-card__value">${quote}${MONEY}</span><span class="item-card__durability">${item.durability}/${item.maxDurability} condition · ${escapeHtml(item.styleFamily.name)}</span></div>
      ${actions}
    </article>`;
}

function portalPanel() {
  setPanelHeading('FIXED MATH · INSPECTABLE RECEIPTS', 'Random Item Portal Device');
  if (!state.portal.unlocked) return emptyState('◎', 'The machine still belongs to the shore creature', 'At the Glimmer, reach for the highest-value banknote. Losing it may be the first useful thing that happens today.');
  const hasParallel = state.portal.upgrades.includes('parallel-aperture');
  const cost = hasParallel ? 2 : 1;
  const receiptDetail = state.portal.upgrades.includes('receipt-printer') || state.settings.receiptDetail;
  const ticket = state.world.casinoTicket;
  const ticketRoute = ticket?.status === 'authentic-unredeemed' ? `
    <section class="section-block starspite-invite">
      <p class="eyebrow">ONE IN A MILLION · AUTHENTIC RECEIPT #${ticket.drawNumber}</p>
      <h3>The Starspite invitation is reading your name aloud</h3>
      <p>The ticket roll was exactly 1,000,000. Redeeming it unlocks a persistent fifth location with public-odds tables, item insurance, an authored artifact auction, and probability crime.</p>
      <button class="button button--primary button--large" data-redeem-ticket>BOARD THE CASINO SHIP</button>
    </section>` : ticket?.status === 'redeemed' ? `
    <section class="section-block starspite-invite starspite-invite--redeemed">
      <p class="eyebrow">STARSPITE ACCESS · REDEEMED</p><h3>The impossible boarding corridor still fits inside the room</h3>
      <p>The invitation remains tied to draw #${ticket.drawNumber}. Travel does not consume it or alter future portal odds.</p>
      <button class="button" data-travel-direct="starspite">RETURN TO STARSPITE</button>
    </section>` : '';
  const receipts = state.portal.receipts.slice(0, 5).map(receipt => `
    <button class="activity" data-receipt-draw="${receipt.drawNumber}">
      <span class="activity__icon">#${receipt.drawNumber}</span>
      <span><b>${escapeHtml(receipt.rarityResult.toUpperCase())}</b><small>rarity ${receipt.rarityRoll.toLocaleString()} · ticket ${receipt.casinoTicketRoll.toLocaleString()}</small></span>
      <span class="activity__cost">${receipt.casinoTicketWon ? 'TICKET' : 'AUDIT ↗'}</span>
    </button>`).join('');
  return `
    <div class="stat-row">
      <div class="stat"><small>CHARGE</small><b>${state.portal.charges}/${state.portal.maxCharges}</b></div>
      <div class="stat"><small>LIFETIME DRAWS</small><b>${state.portal.draws}</b></div>
      <div class="stat"><small>MECHANICAL COMBOS</small><b>${(SYSTEM_CONSTANTS.mechanicalCombinations/1e6).toFixed(1)}M</b></div>
      <div class="stat"><small>WITH STYLE FAMILIES</small><b>${(SYSTEM_CONSTANTS.namedCombinationsIncludingStyleFamilies/1e9).toFixed(2)}B</b></div>
    </div>
    <section class="section-block">
      <h3>The big switch</h3>
      <p>One fresh 256-bit OS entropy seed per item. Rarity, ticket, and every component are derived without looking at your wealth, failures, inventory, or history.</p>
      <button class="button button--primary button--large" data-portal-draw ${state.portal.charges < cost ? 'disabled' : ''}>GENERATE ${hasParallel ? 'TWO INDEPENDENT ITEMS' : 'ONE RANDOM ITEM'} · ${cost} CHARGE${cost === 1 ? '' : 'S'}</button>
      <button class="button" data-rush-charge ${state.portal.charges >= state.portal.maxCharges || state.money < 45 ? 'disabled' : ''}>BUY RUSH CHARGE · 45${MONEY}</button>
    </section>
    ${ticketRoute}
    <section class="section-block">
      <h3>Published distribution</h3>
      <p>No pity timer. No “player RNG.” Upgrades change charge speed or draw count only.</p>
      <table class="odds-table"><thead><tr><th>RESULT</th><th>WEIGHT / 1,000,000</th><th>CHANCE</th></tr></thead><tbody>
        ${RARITIES.map(rarity => `<tr><td style="color:${rarity.color}">${escapeHtml(rarity.label)}</td><td>${rarity.weight.toLocaleString()}</td><td>${(rarity.weight / 10000).toFixed(rarity.weight < 1000 ? 3 : 2)}%</td></tr>`).join('')}
        <tr><td>Starspite casino ticket</td><td>independent roll = 1,000,000</td><td>0.0001%</td></tr>
      </tbody></table>
    </section>
    <section class="section-block"><h3>Machine upgrades</h3><p>Faster possibilities, never hidden luck.</p><div class="choice-grid">
      ${PORTAL_UPGRADES.map(upgrade => `<article class="choice-card"><h4>${escapeHtml(upgrade.name)}</h4><p>${escapeHtml(upgrade.description)}</p><span class="choice-card__cost">${upgrade.cost}${MONEY}</span><button class="button" data-portal-upgrade="${upgrade.id}" ${state.portal.upgrades.includes(upgrade.id) ? 'disabled' : ''}>${state.portal.upgrades.includes(upgrade.id) ? 'INSTALLED' : 'INSTALL'}</button></article>`).join('')}
    </div></section>
    <section class="section-block"><h3>Recent probability receipts</h3><p>${receiptDetail ? 'Full seeds are available.' : 'Install the Receipt Printer or enable detailed receipts in Settings to expose full seeds on this screen.'}</p>${receipts || '<p>No draws yet.</p>'}</section>`;
}

function inventoryPanel() {
  setPanelHeading('NOT A COLLECTION · A BOX OF POSSIBILITIES', `Items · ${state.inventory.length}`);
  if (!state.inventory.length) return emptyState('▦', 'The moving box is empty', 'Generate an item, search the shore, or wait until you have something regrettable to store.', `<button class="button button--primary" data-open-panel="portal">OPEN RANDOMIZER</button>`);
  return `<div class="panel-grid">${state.inventory.map(item => itemCard(item)).join('')}</div>`;
}

function marketPanel() {
  const event = currentWorldEvent(state);
  setPanelHeading('RAGPICKER MARKET · PRICES MOVE WITH THE WORLD', event.name);
  const boosts = Object.entries(event.boosts).sort((a,b) => b[1]-a[1]);
  return `
    <section class="section-block"><h3>${escapeHtml(event.summary)}</h3><p>Highest matching tag sets an item's temporary event multiplier. Reputation and certain pet traits apply visibly afterward.</p><div class="item-card__tags">${boosts.map(([tag,value]) => `<span class="tag">${escapeHtml(tag)} ×${value.toFixed(2)}</span>`).join('')}</div></section>
    <section class="section-block"><h3>Your live quotes</h3>${state.inventory.length ? `<div class="panel-grid">${state.inventory.map(item => itemCard(item)).join('')}</div>` : '<p>The broker cannot price an empty moving box, although she respects the confidence.</p>'}</section>`;
}

function maintenancePanel() {
  const maintenance = commonsMaintenanceProfile(state);
  const options = commonsMaintenanceOptions(state);
  const governance = commonsGovernanceOptions(state);
  const signed = value => `${Number(value) >= 0 ? '+' : ''}${Number(value)}`;
  const routes = options.routes.map(route => {
    const effect = route.returnEffect;
    const consequences = `return +${route.dueDays} day · integrity ${signed(effect.integrityDelta)} · warmth ${signed(effect.warmthDelta)} · trust ${signed(effect.trustDelta)} · Kettle ${signed(effect.supplierStandingDelta)} · Long Table ${signed(effect.workStandingDelta)} / pressure ${signed(effect.workPressureDelta)} · shop ${signed(effect.businessRatingGain)} · home ${signed(effect.homeGain)}`;
    const civicTerms = [
      route.effectBreakdown.governance ? `${route.effectBreakdown.governance.modelLabel}: ${Object.entries(route.effectBreakdown.governance.effect).filter(([,value]) => Number(value)).map(([key,value]) => `${key.replace(/Delta|Gain/g,'')} ${signed(value)}`).join(' · ') || 'record-only'}` : null,
      route.effectBreakdown.fault ? `${route.effectBreakdown.fault.label}: ${Object.entries(route.effectBreakdown.fault.effect).filter(([,value]) => Number(value)).map(([key,value]) => `${key.replace(/Delta|Gain/g,'')} ${signed(value)}`).join(' · ') || 'record-only'}` : null
    ].filter(Boolean).join(' / ');
    const assetActions = route.requiresAsset && route.open
      ? route.assets.map(asset => `<button class="maintenance-route__action" data-commons-maintenance-route="${escapeHtml(route.id)}" data-commons-maintenance-asset="${escapeHtml(asset.id)}"><span>${escapeHtml(asset.glyph || '◇')}</span><div><b>USE ${escapeHtml(asset.name)}</b><small>${escapeHtml(asset.source)} · ${asset.matchedTags.map(escapeHtml).join(' · ')} · OWNERSHIP RETAINED</small></div></button>`).join('')
      : '';
    const petEvidence = route.requiresReturningPet && route.pet?.pet
      ? `<div class="maintenance-route__evidence"><b>${escapeHtml(route.pet.pet.name)} · ${route.pet.laborPoints} literal points · ${route.pet.previouslyParticipated ? 'NAMED IN PRIOR ACCORD' : 'NO PRIOR ACCORD EVIDENCE'}</b><small>${route.pet.reasons.map(escapeHtml).join(' · ') || 'No matching species or trait tags.'}</small></div>`
      : '';
    const action = !route.requiresAsset && route.open ? `<button class="button button--primary" data-commons-maintenance-route="${escapeHtml(route.id)}">START EXACT SERVICE ROUTE</button>` : '';
    return `<article class="maintenance-route ${route.open ? 'is-open' : 'is-locked'}"><header><span>${route.open ? 'OPEN' : 'LOCKED'}</span><b>${escapeHtml(route.label)}</b></header><p>${escapeHtml(route.detail)}</p><small>${escapeHtml(route.requirement)}</small><div class="maintenance-route__contract">${escapeHtml(`${route.hours}h · energy -${route.energyCost} · ${consequences}`)}</div>${civicTerms ? `<div class="maintenance-route__civic"><b>ADDITIVE CIVIC TERMS</b><small>${escapeHtml(civicTerms)}</small></div>` : ''}${petEvidence}${assetActions}${action}${route.open ? '' : `<p class="maintenance-route__reason">${escapeHtml(route.reason)}</p>`}</article>`;
  }).join('');
  const fault = maintenance.fault;
  const faultCause = fault ? [fault.causeEvidence?.routeId ? `last route ${fault.causeEvidence.routeId}` : 'no prior route', fault.causeEvidence?.assetId ? `asset ${fault.causeEvidence.assetId}` : null, fault.causeEvidence?.petId ? `pet ${fault.causeEvidence.petId}` : null, `pressure ${fault.causeEvidence?.workPressure ?? 0}`].filter(Boolean).join(' · ') : '';
  const faultBlock = fault ? `<article class="maintenance-fault"><div class="maintenance-fault__glyph">${escapeHtml(fault.glyph)}</div><div><p class="eyebrow">DETERMINISTIC FAULT · ${fault.selectedDay === state.day && !fault.activationReceipt ? 'DERIVED PREVIEW' : 'FROZEN PUBLIC RECORD'}</p><h4>${escapeHtml(fault.label)}</h4><p>${escapeHtml(fault.summary)}</p><small>${escapeHtml(fault.trigger)} · evidence: ${escapeHtml(faultCause)} · random no</small>${fault.activationReceipt ? '<button class="receipt-inline" data-commons-fault-receipt>AUDIT ACTIVATION CAUSE ↗</button>' : ''}</div></article>` : '';
  const governanceCards = governance.models.map(model => {
    const effect = model.decisionEffect;
    const immediate = `energy -${model.energyCost} · trust ${signed(effect.trustDelta)} · agreements ${signed(effect.agreementsDelta)} · Kettle ${signed(effect.supplierStandingDelta)} · Long Table ${signed(effect.workStandingDelta)} / pressure ${signed(effect.workPressureDelta)} · shop ${signed(effect.businessRatingGain)} · home ${signed(effect.homeGain)} · ${ACTORS[effect.residentId]?.name || effect.residentId} ${signed(effect.residentRelationshipGain)}`;
    return `<article class="governance-card ${model.current ? 'is-current' : model.open ? 'is-open' : 'is-locked'}"><header><span>${model.current ? 'CURRENT' : model.open ? 'OPEN' : 'LOCKED'}</span><b>${escapeHtml(model.shortLabel)}</b></header><h4>${escapeHtml(model.label)}</h4><p>${escapeHtml(model.ownership)}</p><div class="governance-card__duties"><div><b>RIGHTS</b>${model.rights.map(right => `<small>${escapeHtml(right)}</small>`).join('')}</div><div><b>OBLIGATIONS</b>${model.obligations.map(obligation => `<small>${escapeHtml(obligation)}</small>`).join('')}</div></div><div class="maintenance-route__contract">${escapeHtml(`${model.hours}h · ${immediate}`)}</div><small>${escapeHtml(model.requirement)}</small>${model.open ? `<button class="button button--primary" data-commons-governance-choice="${escapeHtml(model.id)}">ADOPT EXACT OWNERSHIP MODEL</button>` : `<p class="maintenance-route__reason">${escapeHtml(model.reason)}</p>`}</article>`;
  }).join('');
  const governanceBlock = maintenance.cycles >= NEIGHBORHOOD_COMMONS.maintenance.governance.firstChoiceCycle || maintenance.governance.modelId
    ? `<section class="governance-console"><div class="governance-console__head"><div><p class="eyebrow">CIVIC OWNERSHIP · ${governance.required ? 'DECISION REQUIRED' : governance.reviewAvailable ? 'REVIEW OPEN' : 'CHARTER ACTIVE'}</p><h4>${escapeHtml(maintenance.governance.model?.label || 'WHO OWNS THE OBLIGATION?')}</h4><p>${escapeHtml(maintenance.governance.model?.ownership || 'The fault cannot be serviced until the lane names rights, obligations, and the holder of the public duty.')}</p></div><strong>${maintenance.governance.model ? escapeHtml(maintenance.governance.model.shortLabel) : 'UNSET'}</strong></div><div class="commons-console__contract"><b>selected cycle ${maintenance.governance.selectedCycle ?? '—'}</b><b>review cycle ${maintenance.governance.reviewDueCycle ?? 'after first choice'}</b><b>${maintenance.governance.history.length} charter record${maintenance.governance.history.length === 1 ? '' : 's'}</b><b>random no · portal unchanged</b></div>${governance.required || governance.reviewAvailable ? `<div class="governance-grid">${governanceCards}</div>` : ''}${maintenance.governance.lastReceipt ? '<button class="button" data-commons-governance-receipt>AUDIT CURRENT CHARTER</button>' : ''}</section>`
    : '';
  const active = maintenance.active ? `<article class="maintenance-active"><p class="eyebrow">IN SERVICE · EXACT RETURN DAY</p><h4>${escapeHtml(maintenance.active.label)}</h4><p>Started Day ${maintenance.active.startedDay}; returns Day ${maintenance.active.dueDay}. The due-state Long Table override is suspended while this route is active.</p><button class="button" data-commons-maintenance-active-receipt>AUDIT FROZEN START RECEIPT</button></article>` : '';
  const history = maintenance.history.slice(0,8).map((entry,index) => `<div class="district-arc-history"><time>DAY ${entry.day}<br>${String(entry.hour).padStart(2,'0')}:00</time><span>${entry.kind === 'return' ? 'SERVICED' : entry.kind === 'overdue' ? 'OVERDUE' : entry.kind === 'fault' ? 'FAULT' : entry.kind === 'governance' ? 'CHARTER' : 'STARTED'}</span><p>${escapeHtml(entry.text)}${entry.receipt ? `<button class="receipt-inline" data-commons-maintenance-receipt-index="${index}">AUDIT SERVICE CAUSE ↗</button>` : ''}</p></div>`).join('');
  const dateLabel = maintenance.active ? `return Day ${maintenance.active.dueDay}` : maintenance.nextDueDay == null ? 'no service calendar' : maintenance.overdue ? `OVERDUE from Day ${maintenance.nextDueDay}` : maintenance.due ? `DUE Day ${maintenance.nextDueDay}` : `next Day ${maintenance.nextDueDay}`;
  return `<section class="maintenance-console" style="--maintenance:${escapeHtml(maintenance.integrityColor)}"><div class="maintenance-console__head"><div><p class="eyebrow">RECURRING HEAT-LOOP SERVICE · ${escapeHtml(maintenance.integrityLabel)}</p><h3>${escapeHtml(maintenance.resource)}</h3><p>${escapeHtml(maintenance.integritySummary)}</p></div><strong>${maintenance.integrity}<small>/ 8 INTEGRITY</small></strong></div><div class="commons-console__meter"><i style="--warmth:${Math.max(4,maintenance.integrity / 8 * 100)}%"></i></div><div class="commons-console__contract"><b>${maintenance.configured ? 'accord evidenced' : 'accord not evidenced'}</b><b>${escapeHtml(dateLabel)}</b><b>${maintenance.cycles} completed</b><b>${maintenance.overdueCycles} overdue consequence${maintenance.overdueCycles === 1 ? '' : 's'}</b><b>Long Table override ${maintenance.conflictOrderActive ? 'ACTIVE' : maintenance.governanceRequired ? 'held for ownership decision' : 'off'}</b><b>${maintenance.faultHistory.length} fault${maintenance.faultHistory.length === 1 ? '' : 's'} resolved</b><b>random no · portal unchanged</b></div>${faultBlock}${governanceBlock}${active || `<div class="maintenance-routes">${routes}</div>`}${maintenance.conflictOrderActive ? '<div class="maintenance-conflict"><b>THE LONG TABLE HAS POSTED A COMPETING PAID VALVE-JIG ORDER</b><p>That real order uses the normal disclosed wage, owned-tool wear, literal pet labor, the active charter, and the named fault modifier.</p><button class="button" data-open-panel="business">INSPECT THE WORK-BOARD OVERRIDE</button></div>' : ''}${maintenance.lastReceipt ? '<button class="button" data-commons-maintenance-last-receipt>AUDIT LAST SERVICE RECEIPT</button>' : ''}<section class="maintenance-memory"><h4>Recurring maintenance memory</h4><p>Due, active, overdue, charter, and history-derived fault states can override public schedules. Every cause and exact additive effect remains inspectable.</p>${history || (maintenance.configured && maintenance.nextDueDay != null ? `<p>The first lived accord scheduled Day ${maintenance.nextDueDay}; no service route has started yet.</p>` : '<p>No maintenance cycle has started. The first service date waits for a lived Hushglass accord.</p>')}</section></section>`;
}

function districtPanel() {
  setPanelHeading('LOPSIDED LANE · SCHEDULED, RELATED, NOT RANDOM', 'The neighborhood depends on itself');
  const supplier = districtSupplierProfile(state);
  const household = districtHouseholdProfile(state);
  const maintenance = commonsMaintenanceProfile(state);
  const residents = districtResidentsNow(state);
  const residentCards = residents.map(resident => {
    const observation = districtResidentObservation(state,resident.id);
    const arc = districtArcStatus(state,resident.id);
    const giftItems = [...state.inventory].sort((left,right) => {
      const leftMatches = left.tags.filter(tag => resident.interests.includes(tag)).length;
      const rightMatches = right.tags.filter(tag => resident.interests.includes(tag)).length;
      return rightMatches - leftMatches;
    }).slice(0,4);
    const giftButtons = giftItems.map(item => {
      const matches = item.tags.filter(tag => resident.interests.includes(tag));
      return `<button class="district-gift" data-district-gift="${escapeHtml(resident.id)}" data-district-item="${escapeHtml(item.id)}">
        <span style="--item-color:${escapeHtml(item.rarityColor)}">${escapeHtml(item.glyph)}</span>
        <span><b>${escapeHtml(item.name)}</b><small>${matches.length ? `fits ${matches.map(escapeHtml).join(' · ')}` : 'an honest but baffling gift'}</small></span>
        <strong>GIVE</strong>
      </button>`;
    }).join('');
    const arcChoices = arc.eligible ? arc.definition.choices.map(choice => {
      const commitments = [
        `${choice.hours}h`,
        choice.effect?.energy < 0 ? `${choice.effect.energy} energy` : null,
        choice.cost ? `${choice.cost}${MONEY}` : null,
        `co-op ${choice.supplierStandingDelta >= 0 ? '+' : ''}${choice.supplierStandingDelta}`
      ].filter(Boolean).join(' · ');
      return `<button class="district-arc-choice" data-district-arc-resident="${escapeHtml(resident.id)}" data-district-arc-choice="${escapeHtml(choice.id)}"><span><b>${escapeHtml(choice.label)}</b><small>${escapeHtml(choice.detail)}</small></span><strong>${escapeHtml(commitments)}</strong></button>`;
    }).join('') : '';
    const arcMarkup = arc.exists ? `<section class="district-arc ${arc.eligible ? 'is-ready' : ''}">
      <p class="eyebrow">REPEATABLE RESIDENT ARC · CYCLE ${arc.nextCycle} · RANDOM NO</p>
      <h4>${escapeHtml(arc.definition.title)}</h4>
      <p>${escapeHtml(arc.definition.summary)}</p>
      <div class="district-arc__contract"><span>rapport ${arc.relationship}/${arc.definition.minRelationship}</span><span>cooldown ${arc.cooldownDays} days</span><span>return +${arc.definition.dueDays} days</span></div>
      ${arc.eligible ? `<div class="district-arc__choices">${arcChoices}</div>` : `<div class="district-arc__status">${escapeHtml(arc.reason)}</div>`}
    </section>` : '';
    return `<article class="district-resident" style="--resident:${escapeHtml(resident.actor.color)}">
      <header><span>${escapeHtml(resident.glyph)}</span><div><p class="eyebrow">${escapeHtml(resident.phase.toUpperCase())} · ${escapeHtml(resident.current.zone.replaceAll('-',' ').toUpperCase())}</p><h3>${escapeHtml(resident.actor.name)}</h3><small>${escapeHtml(resident.actor.role)} · rapport ${resident.relationship}</small></div><b>${escapeHtml(observation.status.toUpperCase())}</b></header>
      <p class="district-schedule">Right now: ${escapeHtml(resident.current.label)}. <small>${resident.scheduleSource.startsWith('commons-maintenance:') ? `Hushglass maintenance ${escapeHtml(maintenance.scheduleState || 'watching')} override` : resident.scheduleSource.startsWith('household-state:') ? `Hushglass ${escapeHtml(household.label.toLowerCase())} override` : resident.scheduleSource.startsWith('supplier-state:') ? `Co-op ${escapeHtml(supplier.label.toLowerCase())} override` : 'Daily phase schedule'}.</small></p>
      <p>${escapeHtml(observation.text)}</p>
      <div class="item-card__tags">${resident.interests.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div>
      <div class="item-card__actions"><button class="button button--primary" data-district-talk="${escapeHtml(resident.id)}">TALK NOW · 1H</button><button class="button" data-district-observation="${escapeHtml(resident.id)}">AUDIT WHAT THEY NOTICE</button></div>
      ${arcMarkup}
      ${giftButtons ? `<details class="district-gifts"><summary>GIVE AN OBJECT TO ${escapeHtml(resident.actor.name.toUpperCase())}</summary><div>${giftButtons}</div></details>` : ''}
    </article>`;
  }).join('');
  const deliveries = state.district.deliveries.slice(0,8).map((delivery,index) => `<div class="district-delivery ${delivery.status === 'delivered' ? 'is-delivered' : ''}">
    <span>${escapeHtml(delivery.item.glyph || '⇥')}</span><div><b>${escapeHtml(delivery.item.name)}</b><small>${delivery.status === 'delivered' ? `arrived Day ${delivery.deliveredDay}` : `travelling until Day ${delivery.dueDay}`} · fixed route to ${escapeHtml(ACTORS[delivery.residentId]?.name || delivery.residentId)}</small></div>${delivery.receipt ? `<button class="mini-button" data-district-delivery-receipt="${index}">AUDIT</button>` : '<strong>IN FLIGHT</strong>'}
  </div>`).join('');
  const houseMarks = state.district.houseMarks.slice(0,4).map((mark,index) => `<div class="life-echo"><span>${mark.kind === 'delivery' ? 'THE WINDOW CHANGED' : mark.kind === 'supplier' ? 'THE KETTLE CRATE CAME HOME' : mark.kind === 'work' ? 'THE WORKBENCH KEPT THE SHIFT' : mark.kind === 'governance' ? 'THE PUBLIC CHARTER CAME HOME' : mark.kind === 'maintenance' ? 'THE SERVICE ROUTE CAME HOME' : mark.kind === 'commons' ? 'THE HEAT LEDGER CAME HOME' : 'THE HOUSE KEPT THE THANK-YOU'}</span><p>${escapeHtml(mark.parentText)}${mark.receipt ? `<button class="receipt-inline" data-district-house-receipt="${index}">AUDIT CAUSE ↗</button>` : ''}</p></div>`).join('');
  const arcHistory = state.district.arcs.slice(0,8).map((entry,index) => `<div class="district-arc-history"><time>DAY ${entry.day}<br>${String(entry.hour).padStart(2,'0')}:00</time><span>${entry.kind === 'return' ? 'RETURNED' : 'CHOICE'}</span><p>${escapeHtml(entry.text)}<button class="receipt-inline" data-district-arc-receipt="${index}">AUDIT EXACT CAUSE ↗</button></p></div>`).join('');
  const householdHistory = household.history.slice(0,6).map((entry,index) => `<div class="district-arc-history"><time>DAY ${entry.day}<br>${String(entry.hour).padStart(2,'0')}:00</time><span>${entry.kind === 'return' ? 'RETURNED' : entry.kind === 'unattended' ? 'RATIONED' : 'AGREED'}</span><p>${escapeHtml(entry.text)}${entry.receipt ? `<button class="receipt-inline" data-household-receipt-index="${index}">AUDIT COMMONS CAUSE ↗</button>` : ''}</p></div>`).join('');
  return `
    <section class="district-hero"><div><p class="eyebrow">TWO HOUSEHOLDS · RECURRING SERVICE · AUTHORED BID CONFLICT · ZERO SCHEDULE ROLLS</p><h3>A street that remembers who signed, what stayed owned, and when the valve is due</h3><p>Real household history, retained objects, returning pets, Crooked Kettle stock, and one competing Long Table order now cross the shared heat loop. No route can influence the Random Item Portal Device.</p></div><span>${state.district.visits}<small>VISITS</small></span></section>
    <section class="supplier-console" style="--supplier:${escapeHtml(supplier.color)}"><span class="supplier-console__glyph">${escapeHtml(supplier.glyph)}</span><div><p class="eyebrow">PERSISTENT SUPPLIER HOUSEHOLD · ${escapeHtml(supplier.label)}</p><h3>${escapeHtml(supplier.name)}</h3><small>${escapeHtml(supplier.household)}</small><p>${escapeHtml(supplier.description)} ${escapeHtml(supplier.summary)}</p><div class="supplier-console__contract"><b>standing ${supplier.standing}</b><b>daily storefront ×${supplier.businessFactor.toFixed(2)}</b><b>${supplier.pendingReturns} return${supplier.pendingReturns === 1 ? '' : 's'} in flight</b><b>random no · portal unchanged</b></div></div></section>
    <section class="commons-console" style="--commons:${escapeHtml(household.color)}"><div class="commons-console__head"><span>${escapeHtml(household.glyph)}</span><div><p class="eyebrow">SECOND PERSISTENT HOUSEHOLD · ${escapeHtml(household.label)}</p><h3>${escapeHtml(household.name)}</h3><small>${escapeHtml(household.household)}</small><p>${escapeHtml(household.description)} ${escapeHtml(household.summary)}</p></div></div><div class="commons-console__meter"><i style="--warmth:${Math.min(100,Math.max(4,(household.warmth + 8) / 20 * 100))}%"></i></div><div class="commons-console__contract"><b>warmth ${household.warmth}</b><b>trust ${household.trust}</b><b>agreements ${household.agreements}</b><b>Kettle ${supplier.standing}</b><b>Long Table ${state.work.standing} / pressure ${state.work.pressure}</b><b>random no · portal unchanged</b></div>${household.lastReceipt ? '<button class="button" data-household-last-receipt>AUDIT LAST HEAT RECEIPT</button>' : ''}</section>
    ${maintenancePanel()}
    <section class="section-block"><h3>Who is where right now</h3><div class="district-grid">${residentCards}</div></section>
    <section class="section-block"><h3>Dependency memory</h3><p>Every entry binds a relationship prerequisite, exact cooldown, fixed follow-up day, and supplier transition. Nothing here consumes entropy.</p><div>${arcHistory || '<p>No resident arc has moved yet. Build rapport, then choose an authored response.</p>'}</div></section>
    <section class="section-block"><h3>Hushglass commons memory</h3><p>Warmth changes the public schedule only at authored bands. Every agreement and return names all cross-system deltas.</p><div>${householdHistory || '<p>Hushglass is rationing one night of heat. Its hearing has not moved yet.</p>'}</div></section>
    <section class="section-block"><h3>The parcel spine</h3><p>An accepted alien-web sale chooses this lane's recipient through a fixed buyer map. The delivery resolves on its disclosed day and may leave one visible change at home.</p><div class="district-deliveries">${deliveries || '<p>No sold object is travelling through the lane yet.</p>'}</div></section>
    ${houseMarks ? `<section class="section-block"><h3>What Mum and Dad noticed without a quest marker</h3>${houseMarks}</section>` : ''}`;
}

function homePanel() {
  setPanelHeading('THE EMOTIONAL CENTER · ALSO A BUILDING', 'Your parents’ house');
  const relationships = [
    ['Mum Vela',state.relationships.mom],['Dad Obo',state.relationships.dad],['Shellby?',state.relationships.shellby],['Auntie Grift',state.relationships.vendor],
    ...(state.district.visits ? DISTRICT_RESIDENTS.map(resident => [ACTORS[resident.id].name,state.relationships[resident.id]]) : []),
    ...(state.starspite.access === 'member' ? [['Vesper Coil',state.relationships.vesper]] : [])
  ];
  const neighborhoodEcho = districtFamilyEcho(state);
  return `
    <div class="stat-row"><div class="stat"><small>HOME SCORE</small><b>${state.home.score}</b></div><div class="stat"><small>UPGRADES</small><b>${state.home.upgrades.length}</b></div><div class="stat"><small>INSTALLED ODDITIES</small><b>${state.installed.length}</b></div><div class="stat"><small>CREDITS GIVEN TO HOME</small><b>${HOME_UPGRADES.filter(upgrade => state.home.upgrades.includes(upgrade.id)).reduce((sum,upgrade)=>sum+upgrade.cost,0)}${MONEY}</b></div></div>
    <section class="section-block"><h3>Your old bed still recognizes you</h3><p>Sleep advances the local calendar, restores energy, adds declared portal charge, pays any business receipt, and lets tomorrow's world event arrive. There is no real-time absence pressure.</p><button class="button" data-sleep>SLEEP UNTIL MORNING</button></section>
    <section class="section-block district-home-echo"><p class="eyebrow">THE HOUSE NOTICED · NOT A QUEST</p><h3>${neighborhoodEcho.active ? 'Lopsided Lane left evidence at home' : 'The neighborhood is visible from the kitchen'}</h3><p>${escapeHtml(neighborhoodEcho.parentText)}</p>${neighborhoodEcho.receipt ? '<button class="button" data-district-family-receipt>AUDIT THE CAUSE</button>' : ''}</section>
    <section class="section-block"><h3>Relationships made through living</h3><p>No dialogue score quiz. Cook, repair, share time, give objects, and spend on the place everyone lives.</p>${relationships.map(([name,value]) => `<div class="relationship"><b>${escapeHtml(name)}</b><span class="relationship__track"><i style="width:${Math.min(100,Math.max(2,value*2))}%"></i></span><span>${value}</span></div>`).join('')}</section>
    <section class="section-block"><h3>Change the house</h3><p>Each purchase becomes visible in the room or kitchen and affects family life.</p><div class="choice-grid">${HOME_UPGRADES.map(upgrade => `<article class="choice-card"><h4>${escapeHtml(upgrade.name)}</h4><p>${escapeHtml(upgrade.description)}</p><span class="choice-card__cost">${upgrade.cost}${MONEY} · needs ${upgrade.requirement} trust</span><button class="button" data-home-upgrade="${upgrade.id}" ${state.home.upgrades.includes(upgrade.id) ? 'disabled' : ''}>${state.home.upgrades.includes(upgrade.id) ? 'PART OF HOME' : 'BUILD FOR THE FAMILY'}</button></article>`).join('')}</div></section>
    <section class="section-block"><h3>Installed history</h3>${state.installed.length ? `<div class="panel-grid">${state.installed.map(item => itemCard(item,{actions:false})).join('')}</div>` : '<p>The walls contain only old stickers and unrealized parental opinions.</p>'}</section>`;
}

function petsPanel() {
  setPanelHeading('TRAITS STACK · HABITS EMERGE', `Companions · ${state.pets.length}`);
  if (!state.pets.length) return emptyState('✣', 'No creature has chosen your jacket yet', 'Follow the tiny tax-mite at the Glimmer for an accessible first companion, or hatch a Muttering Cocoon from the portal.');
  return `<div class="section-block"><p>Pet traits are additive mechanical behaviors. Rare traits never change future draw odds.</p></div><div class="panel-grid">${state.pets.map(pet => `
    <article class="pet-card"><div class="pet-card__glyph">${escapeHtml(pet.glyph)}</div><div><h3>${escapeHtml(pet.name)}</h3><p>${escapeHtml(pet.speciesName)} · ${escapeHtml(pet.mood)}<br>${escapeHtml(pet.baseBonus)}</p><div class="trait-list">${pet.traits.map(trait => `<span class="trait" title="${escapeHtml(trait.effect)}">${escapeHtml(trait.name)} · ${escapeHtml(trait.rarity)}</span>`).join('')}</div></div></article>`).join('')}</div>`;
}

function businessPanel() {
  setPanelHeading('THE ALIEN WEB · LOCAL, ALIVE, AUDITABLE', state.business ? state.business.name : 'Start something from the bedroom');
  if (!state.business) return `<section class="section-block"><h3>One room, three possible web violations</h3><p>Choose an identity. Items may become reusable equipment or enter reversible escrow for authored buyers. Offers are deterministic, contextual, and fully explained—never disguised rarity rolls.</p><div class="choice-grid">${BUSINESS_TYPES.map(type => `<article class="choice-card"><h4>${escapeHtml(type.name)}</h4><p>${escapeHtml(type.description)}</p><div class="item-card__tags">${type.tags.map(tag=>`<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div><span class="choice-card__cost">${type.cost}${MONEY}</span><button class="button" data-start-business="${type.id}">OPEN WEB WINDOW IN BEDROOM</button></article>`).join('')}</div></section>`;
  const business = state.business;
  const supplier = districtSupplierProfile(state);
  const capacity = businessListingCapacity(state);
  const petProfile = businessPetProfile(state);
  const work = neighborhoodWorkProfile(state);
  const workOrder = availableWorkOrder(state);
  const workPet = workPetProfile(state,workOrder.id);
  const workTools = matchingWorkTools(state,workOrder.id);
  const branch = BUSINESS_BRANCHES.find(candidate => candidate.id === business.branchId) || null;
  const listings = business.listings.map(listing => {
    const buyer = BUSINESS_BUYERS.find(candidate => candidate.id === listing.buyerId) || BUSINESS_BUYERS[0];
    const affinity = listing.offerReceipt?.buyerRouting;
    const beatsAsk = listing.offer >= listing.ask;
    const atCeiling = listing.offer >= listing.ceiling && listing.ask > listing.ceiling;
    return `<article class="store-listing" style="--listing-color:${escapeHtml(listing.item.rarityColor)}">
      <header><span class="store-listing__item">${escapeHtml(listing.item.glyph)}</span><div><p class="eyebrow">ESCROW · DAY ${listing.createdDay} · ${listing.daysListed} REFRESH${listing.daysListed === 1 ? '' : 'ES'}</p><h3>${escapeHtml(listing.item.name)}</h3></div><span class="store-listing__buyer">${escapeHtml(buyer.glyph)}</span></header>
      <p><b>${escapeHtml(buyer.name)}</b> · ${escapeHtml(buyer.bio)}</p>
      <div class="offer-meter"><span style="width:${Math.min(100,Math.round(listing.offer / Math.max(1,listing.ask) * 100))}%"></span></div>
      <div class="store-price-row"><span><small>CURRENT OFFER</small><b>${listing.offer}${MONEY}</b></span><span><small>YOUR POSTED ASK</small><b>${listing.ask}${MONEY}</b></span><span><small>DISCLOSED CEILING</small><b>${listing.ceiling}${MONEY}</b></span></div>
      <p class="store-affinity">Likes: ${affinity?.favoriteMatches?.map(escapeHtml).join(', ') || 'no matching tag'} · avoids: ${affinity?.avoidMatches?.map(escapeHtml).join(', ') || 'nothing relevant'} · relationship route: ${escapeHtml(affinity?.relationshipKey || buyer.relationKey)} ${affinity?.relationshipValue ?? 0}</p>
      <div class="item-card__actions"><button class="button button--primary" data-business-accept="${escapeHtml(listing.id)}">ACCEPT ${listing.offer}${MONEY}</button><button class="button" data-business-counter="${escapeHtml(listing.id)}" ${beatsAsk || atCeiling ? 'disabled' : ''}>${beatsAsk ? 'OFFER BEATS ASK' : atCeiling ? 'CEILING REACHED' : `COUNTER AT ${listing.ask}${MONEY}`}</button><button class="button" data-business-receipt-listing="${escapeHtml(listing.id)}">AUDIT FORMULA</button><button class="button" data-business-delist="${escapeHtml(listing.id)}">DELIST</button></div>
    </article>`;
  }).join('');
  const equipment = business.assets.map(item => `<article class="store-equipment"><span style="--item-color:${escapeHtml(item.rarityColor)}">${escapeHtml(item.glyph)}</span><div><b>${escapeHtml(item.name)}</b><small>${item.tags.filter(tag => businessTags(state).includes(tag)).length} storefront tag matches · shares tags with listings for +4% each, capped at +20%</small></div><button class="mini-button" data-business-equipment-return="${escapeHtml(item.id)}">RETURN</button></article>`).join('');
  const petOptions = state.pets.map(pet => `<button class="pet-shift ${business.assignedPetId === pet.id ? 'is-active' : ''}" data-business-pet="${escapeHtml(pet.id)}"><span>${escapeHtml(pet.glyph)}</span><span><b>${escapeHtml(pet.name)}</b><small>${pet.traits.map(trait => escapeHtml(trait.name)).join(' · ')}</small></span><strong>${business.assignedPetId === pet.id ? 'ON SHIFT' : 'ASSIGN'}</strong></button>`).join('');
  const upgrades = BUSINESS_UPGRADES.map(upgrade => `<article class="choice-card"><h4>${escapeHtml(upgrade.name)}</h4><p>${escapeHtml(upgrade.description)}</p><span class="choice-card__cost">${upgrade.cost}${MONEY} · rating ${upgrade.rating}${upgrade.requiresPortal ? ' · portal' : ''}</span><button class="button" data-business-upgrade="${upgrade.id}" ${business.upgrades.includes(upgrade.id) ? 'disabled' : ''}>${business.upgrades.includes(upgrade.id) ? 'INSTALLED' : 'INSTALL'}</button></article>`).join('');
  const branchChoices = BUSINESS_BRANCHES.filter(candidate => candidate.businessId === business.id).map(candidate => `<article class="choice-card"><h4>${escapeHtml(candidate.name)}</h4><p>${escapeHtml(candidate.description)}</p><div class="item-card__tags">${candidate.addedTags.map(tag => `<span class="tag">+${escapeHtml(tag)}</span>`).join('')}</div><span class="choice-card__cost">${candidate.cost}${MONEY} · rating ${candidate.rating} · offers ×${candidate.offerMultiplier.toFixed(2)}</span><button class="button" data-business-branch="${candidate.id}" ${business.branchId ? 'disabled' : ''}>${business.branchId === candidate.id ? 'THIS STORE’S PATH' : business.branchId ? 'OTHER PATH CHOSEN' : 'GROW THIS BRANCH'}</button></article>`).join('');
  const callbacks = business.callbacks.map(callback => { const buyer = BUSINESS_BUYERS.find(candidate => candidate.id === callback.buyerId); return `<div class="callback-row"><span>${escapeHtml(buyer?.glyph || '◌')}</span><div><b>${escapeHtml(callback.item.name)}</b><small>${escapeHtml(buyer?.name || callback.buyerId)} will respond on Day ${callback.dueDay}</small></div></div>`; }).join('');
  const workToolRows = workTools.map(item => {
    const matched = item.tags.filter(tag => workOrder.requiredTags.includes(tag));
    const choices = NEIGHBORHOOD_WORKS.approaches.map(approach => {
      const quote = workOrderQuote(state,workOrder.id,item.id,approach.id);
      const disabled = !quote.ok || state.player.energy < approach.energyCost || Boolean(state.work.active);
      return `<button class="work-approach" data-work-start="${escapeHtml(workOrder.id)}" data-work-tool="${escapeHtml(item.id)}" data-work-approach="${escapeHtml(approach.id)}" ${disabled ? 'disabled' : ''}><b>${escapeHtml(approach.label)}</b><small>${approach.hours}h · -${approach.energyCost} energy · wage ${quote.ok ? `${quote.wage}${MONEY}` : 'unavailable'} · standing ${approach.standingDelta >= 0 ? '+' : ''}${approach.standingDelta} · pressure ${approach.pressureDelta >= 0 ? '+' : ''}${approach.pressureDelta}</small></button>`;
    }).join('');
    return `<article class="work-tool" style="--item-color:${escapeHtml(item.rarityColor)}"><span>${escapeHtml(item.glyph)}</span><div><h4>${escapeHtml(item.name)}</h4><p>${matched.map(escapeHtml).join(' · ')} · ${item.durability}/${item.maxDurability} condition · loses ${workOrder.toolDurability}</p><div class="work-approaches">${choices}</div></div></article>`;
  }).join('');
  const activeWork = state.work.active ? `<article class="active-work"><span>${escapeHtml(NEIGHBORHOOD_WORKS.glyph)}</span><div><p class="eyebrow">IN PRODUCTION · DUE DAY ${state.work.active.dueDay}</p><h4>${escapeHtml(state.work.active.title)}</h4><p>${escapeHtml(state.work.active.pet.name)} supplied ${state.work.active.pet.laborPoints} literal labor points. Frozen wage: ${state.work.active.wage}${MONEY}.</p><button class="receipt-inline" data-work-receipt-active>AUDIT START RECEIPT ↗</button></div></article>` : '';
  const workHistory = state.work.history.slice(0,8).map((entry,index) => `<div class="business-history"><time>DAY ${entry.day}<br>${String(entry.hour).padStart(2,'0')}:00</time><p>${escapeHtml(entry.text)}${entry.receipt ? `<button class="receipt-inline" data-work-receipt-index="${index}">AUDIT ${escapeHtml(entry.kind.toUpperCase())} ↗</button>` : ''}</p></div>`).join('');
  const history = business.history.slice(0,12).map((entry,index) => `<div class="business-history"><time>DAY ${entry.day}<br>${String(entry.hour).padStart(2,'0')}:00</time><p>${escapeHtml(entry.text)}${entry.receipt ? `<button class="receipt-inline" data-business-receipt-index="${index}">AUDIT ${escapeHtml(entry.receipt.schema.replace('small-odds.','').replace('/v1','').toUpperCase())} ↗</button>` : ''}</p></div>`).join('');
  return `
    <div class="storefront-console"><div><p class="eyebrow">PIP://LOCAL-WEB/${escapeHtml(business.id.toUpperCase())}</p><h3>${escapeHtml(business.description)}</h3><div class="item-card__tags">${businessTags(state).map(tag=>`<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div></div><span class="storefront-console__pulse">LIVE<br><small>NO NETWORK</small></span></div>
    <div class="stat-row"><div class="stat"><small>RATING</small><b>${business.rating}</b></div><div class="stat"><small>ESCROW</small><b>${business.listings.length}/${capacity}</b></div><div class="stat"><small>SALES</small><b>${business.sales}</b></div><div class="stat"><small>LIFETIME</small><b>${business.lifetimeIncome}${MONEY}</b></div></div>
    <section class="supplier-console supplier-console--business" style="--supplier:${escapeHtml(supplier.color)}"><span class="supplier-console__glyph">${escapeHtml(supplier.glyph)}</span><div><p class="eyebrow">NEIGHBORHOOD SERVICE DEPENDENCY · ${escapeHtml(supplier.label)}</p><h3>${escapeHtml(supplier.name)}</h3><p>${escapeHtml(supplier.summary)}</p><div class="supplier-console__contract"><b>standing ${supplier.standing}</b><b>daily service ×${supplier.businessFactor.toFixed(2)}</b><b>${supplier.pendingReturns} return${supplier.pendingReturns === 1 ? '' : 's'} in flight</b><b>disclosed · deterministic</b></div></div></section>
    <section class="work-console ${workOrder.commonsConflict ? 'is-commons-conflict' : ''}" style="--work-color:${escapeHtml(work.pressureColor)}"><div class="work-console__head"><span>${escapeHtml(work.glyph)}</span><div><p class="eyebrow">${workOrder.commonsConflict ? 'HUSHGLASS / LONG TABLE CONFLICT ORDER' : 'PAID NEIGHBORHOOD PRODUCTION'} · ${escapeHtml(work.pressureLabel)}</p><h3>${escapeHtml(work.name)}</h3><p>${escapeHtml(work.pressureSummary)}</p></div></div><div class="supplier-console__contract"><b>standing ${work.standing}</b><b>rivalry pressure ${work.pressure}</b><b>wage factor ×${work.pressureWageFactor.toFixed(2)}</b><b>${work.completed} completed</b><b>${escapeHtml(work.rotationRule)}</b><b>random: false</b></div>${activeWork || `<article class="work-order"><p class="eyebrow">${workOrder.commonsConflict ? 'DUE-STATE OVERRIDE' : 'TODAY\'S AUTHORED ORDER'} · ${escapeHtml(workOrder.requester.toUpperCase())}</p><h4>${escapeHtml(workOrder.title)}</h4><p>${escapeHtml(workOrder.summary)}</p><div class="item-card__tags">${workOrder.requiredTags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div><div class="work-labor"><b>${workPet.pet ? `${escapeHtml(workPet.pet.name)}: ${workPet.laborPoints} labor points` : 'ASSIGN A PET BEFORE ACCEPTING'}</b><small>${workPet.reasons.map(escapeHtml).join(' · ') || 'Only matching species and trait tags contribute. Unrelated traits score zero.'}</small></div>${workToolRows || '<div class="life-no-object">No carried object matches today’s work tags. Listings and equipment remain unavailable as tools because ownership state matters.</div>'}</article>`}${workHistory ? `<details class="district-gifts"><summary>WORK RECEIPTS AND RETURNS</summary>${workHistory}</details>` : ''}</section>
    <section class="section-block storefront-principle"><h3>Prices have causes, not luck</h3><p>Buyer routing and every multiplier use the item, today’s world, storefront tags, equipment, branch, reputation, one relationship, and the assigned pet. Cash on hand and portal history are explicitly ignored.</p><button class="button" data-open-panel="inventory">CHOOSE AN ITEM TO LIST OR EQUIP</button> <button class="button" data-sleep>LET THE WEB TURN TO TOMORROW</button>${business.lastDailyReceipt ? ' <button class="button" data-business-daily-receipt>AUDIT LAST SERVICE INCOME</button>' : ''}</section>
    <section class="section-block"><h3>Live listings · reversible until sold</h3><p>Escrowed items cannot be used, gifted, or insured. Delist to recover one unchanged. World events may still wake their future triggers and change tomorrow’s offer.</p>${listings || '<div class="store-empty"><b>The alien web is staring at an empty shelf.</b><span>Open Inventory and choose LIST ON ALIEN WEB.</span></div>'}</section>
    <section class="section-block"><h3>Buyer messages still travelling</h3><p>Sales leave the inventory immediately, but the object’s life can return as a review, relationship echo, and store reputation.</p>${callbacks || '<p>No parcels are currently writing back.</p>'}</section>
    <section class="section-block"><h3>Pet shipping shift</h3><p>${petProfile.pet ? `${escapeHtml(petProfile.pet.name)} contributes: ${petProfile.reasons.map(escapeHtml).join('; ') || 'company, with no numeric multiplier'}.` : 'Assign exactly one companion. Its actual stackable traits—not its cuteness—determine the visible effect.'}</p><div class="pet-shift-list">${petOptions || '<p>No pet has agreed to payroll yet.</p>'}</div>${business.assignedPetId ? '<button class="button" data-business-pet-clear>CLOCK PET OUT</button>' : ''}</section>
    <section class="section-block"><h3>Reusable store equipment</h3><p>Equipment remains owned and can return to Inventory. Matching tags improve rating immediately; equipment sharing any tag with a listed item improves its next offer.</p><div class="equipment-list">${equipment || '<p>No generated object is operating the store yet.</p>'}</div></section>
    <section class="section-block"><h3>Choose one permanent business branch</h3><p>${branch ? `${escapeHtml(branch.name)} is now part of the store: +${branch.incomeBonus} base service income and ×${branch.offerMultiplier.toFixed(2)} offers.` : 'Two authored specialties are available for this business. This is a permanent identity choice, not a random roll.'}</p><div class="choice-grid">${branchChoices}</div></section>
    <section class="section-block"><h3>Build the bedroom logistics organism</h3><p>Capacity, trust, packing, and fulfilment improve commerce only. None alters item rarity or Starspite outcomes.</p><div class="choice-grid">${upgrades}</div></section>
    <section class="section-block"><h3>Storefront memory</h3>${history || '<p>The ledger is waiting for its first buyer-shaped mistake.</p>'}</section>`;
}

function casinoPanel() {
  setPanelHeading('ONE-IN-A-MILLION DESTINATION · EVERY EDGE POSTED', 'Starspite Casino Ship');
  if (state.starspite.access !== 'member') return emptyState('1∕M', 'Starspite has not accepted your name', 'Only the authentic independent ticket roll of exactly 1,000,000 opens this destination. Money, failure, and persistence cannot persuade it.');
  const insured = state.inventory.find(item => item.id === state.starspite.insuredItemId) || null;
  const tables = CASINO_GAMES.map(game => {
    const math = casinoGameMath(game.id);
    return `<article class="casino-table" style="--table-color:${escapeHtml(game.color)}">
      <header><span>${escapeHtml(game.glyph)}</span><div><p class="eyebrow">${math.winningOutcomes}/${math.outcomes} WIN · ${math.payoutMultiplier}× GROSS</p><h3>${escapeHtml(game.name)}</h3></div></header>
      <p>${escapeHtml(game.description)}</p>
      <div class="casino-math"><span><small>WIN CHANCE</small><b>${(math.winningOutcomes / math.outcomes * 100).toFixed(3)}%</b></span><span><small>RTP</small><b>${math.rtpPercent}%</b></span><span><small>HOUSE EDGE</small><b>${math.houseEdgePercent}%</b></span></div>
      <p class="casino-winning-set">Winning ${escapeHtml(game.outcomeLabel)}${game.winNumbers.length === 1 ? '' : 's'}: ${game.winNumbers.join(', ')}. Insurance changes loss cost only, never this set or the roll.</p>
      <div class="casino-stakes">${game.stakes.map(stake => `<button class="button" data-casino-game="${game.id}" data-casino-stake="${stake}" ${state.money < stake ? 'disabled' : ''}>BET ${stake}${MONEY}<small>WIN RETURNS ${stake * game.payoutMultiplier}${MONEY}</small></button>`).join('')}</div>
    </article>`;
  }).join('');
  const insuranceItems = state.inventory.length ? state.inventory.map(item => `<button class="insurance-item ${insured?.id === item.id ? 'is-active' : ''}" data-casino-insure="${escapeHtml(item.id)}">
      <span class="insurance-item__glyph" style="--item-color:${escapeHtml(item.rarityColor)}">${escapeHtml(item.glyph)}</span>
      <span><b>${escapeHtml(item.name)}</b><small>Refunds up to ${casinoInsuranceQuote(item, 50)}${MONEY} on a losing 50${MONEY} play · costs 1 durability</small></span>
      <strong>${item.durability}/${item.maxDurability}</strong>
    </button>`).join('') : '<p>The moving box is empty. Insurance cannot be made from confidence.</p>';
  const lots = CASINO_LOTS.map(lot => {
    const purchased = state.starspite.lotsPurchased.includes(lot.id);
    return `<article class="choice-card casino-lot" style="--lot-color:${escapeHtml(lot.rarityColor)}"><span class="casino-lot__glyph">${escapeHtml(lot.glyph)}</span><h4>${escapeHtml(lot.name)}</h4><p>${escapeHtml(lot.description)}</p><div class="item-card__tags">${lot.tags.map(tag=>`<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div><span class="choice-card__cost">POSTED ${lot.price}${MONEY} · NOT RANDOM</span><button class="button" data-casino-lot="${lot.id}" ${purchased || state.money < lot.price ? 'disabled' : ''}>${purchased ? 'LEFT THE PLINTH' : 'BUY AUTHORED ARTIFACT'}</button></article>`;
  }).join('');
  const history = state.starspite.history.slice(0, 8).map((receipt,index) => `<button class="activity" data-casino-receipt-index="${index}"><span class="activity__icon">${receipt.won ? 'WIN' : 'LOSS'}</span><span><b>${escapeHtml(receipt.gameName)}</b><small>roll ${receipt.rawOutcomeRoll}/${receipt.outcomeCount} · stake ${receipt.stake}${MONEY} · net ${receipt.net >= 0 ? '+' : ''}${receipt.net}${MONEY}</small></span><span class="activity__cost">AUDIT ↗</span></button>`).join('');
  return `
    <div class="stat-row"><div class="stat"><small>PLAYS</small><b>${state.starspite.gamesPlayed}</b></div><div class="stat"><small>WINS / LOSSES</small><b>${state.starspite.wins}/${state.starspite.losses}</b></div><div class="stat"><small>NET CREDITS</small><b>${state.starspite.netCredits >= 0 ? '+' : ''}${state.starspite.netCredits}${MONEY}</b></div><div class="stat"><small>AUTHORED LOTS</small><b>${state.starspite.lotsPurchased.length}/${CASINO_LOTS.length}</b></div></div>
    <section class="section-block casino-principle"><h3>The ship is allowed to be dangerous, never deceptive</h3><p>Each click requests fresh operating-system entropy. Rejection sampling selects one equally likely integer. No previous loss, relationship, item, trait, wealth, or personal history enters the roll.</p></section>
    <section class="section-block"><h3>Transparent tables</h3><div class="casino-grid">${tables}</div></section>
    <section class="section-block" id="casinoInsurance"><h3>Item-backed loss insurance</h3><p>${insured ? `${escapeHtml(insured.name)} is pledged. It can refund part of a losing stake and loses one durability when it does; it cannot change a result.` : 'Pledge one generated or authored item. The refund is visible before play and never changes the probability.'}</p>${insured ? '<button class="button" data-casino-clear-insurance>REMOVE PLEDGE</button>' : ''}<div class="insurance-list">${insuranceItems}</div></section>
    <section class="section-block" id="casinoAuction"><h3>The honesty auction nobody else is attending</h3><p>These lots have fixed authorship and posted prices. Their receipts explicitly say “random: false”; they do not borrow portal odds or pretend to be generated variants.</p><div class="choice-grid">${lots}</div></section>
    <section class="section-block"><h3>Table receipts</h3>${history || '<p>No wager yet. The casino is trying not to look eager.</p>'}</section>`;
}

function lifePanel() {
  const instance = state.life.active.find(thread => thread.id === activeLifeThreadId) || lifeThreadAtLocation(state);
  setPanelHeading('NOT A QUEST · A LIFE IN MOTION', instance ? 'Something is happening' : 'Life kept moving');
  if (!instance) {
    const recent = state.life.history.slice(0, 8).map(entry => `<div class="journal-entry"><time>Day ${entry.day}<br>${String(entry.hour).padStart(2,'0')}:00</time><i></i><span>${escapeHtml(entry.text)}</span></div>`).join('');
    return emptyState('∿', 'Nothing is waiting for acceptance', recent ? 'The situation continued. Its outcome now lives in the journal.' : 'People will have needs, mistakes, and strange afternoons as days and places change.');
  }
  const definition = LIFE_THREADS.find(thread => thread.id === instance.definitionId);
  const actor = ACTORS[definition.actor];
  const supplier = districtSupplierProfile(state);
  const work = neighborhoodWorkProfile(state);
  const petCommons = definition.petChoice ? householdPetProfile(state,definition.petChoice.skillTags) : null;
  const routeLedger = [
    definition.supplierChoice ? { label:'Crooked Kettle', open:supplier.standing >= definition.supplierChoice.minStanding, detail:`standing ${supplier.standing}/${definition.supplierChoice.minStanding}` } : null,
    definition.workChoice ? { label:'Long Table', open:work.standing >= definition.workChoice.minStanding && (definition.workChoice.maximumPressure == null || work.pressure <= definition.workChoice.maximumPressure), detail:`standing ${work.standing}/${definition.workChoice.minStanding}${definition.workChoice.maximumPressure == null ? '' : ` · pressure ${work.pressure}/${definition.workChoice.maximumPressure} max`}` } : null,
    definition.neighborChoice ? { label:ACTORS[definition.neighborChoice.residentId].name, open:Number(state.relationships[definition.neighborChoice.residentId] || 0) >= definition.neighborChoice.minRelationship, detail:`rapport ${Number(state.relationships[definition.neighborChoice.residentId] || 0)}/${definition.neighborChoice.minRelationship}` } : null,
    definition.petChoice ? { label:petCommons.pet?.name || 'Assigned pet', open:Boolean(petCommons.pet && petCommons.laborPoints >= definition.petChoice.minLaborPoints), detail:`literal commons points ${petCommons.laborPoints}/${definition.petChoice.minLaborPoints}` } : null
  ].filter(Boolean);
  const routeLedgerMarkup = routeLedger.length ? `<div class="life-route-ledger">${routeLedger.map(route => `<span class="${route.open ? 'is-open' : 'is-locked'}"><b>${route.open ? 'OPEN' : 'LOCKED'} · ${escapeHtml(route.label)}</b><small>${escapeHtml(route.detail)}</small></span>`).join('')}</div>` : '';
  const choiceMarkup = lifeThreadChoices(state,instance.id).map(choice => {
    const commitments = [
      `${choice.hours}h`,
      choice.effect?.energy < 0 ? `${choice.effect.energy} energy` : null,
      choice.cost ? `${choice.cost}${MONEY}` : null,
      choice.itemTags ? 'relevant object' : null,
      choice.neighborRoute ? `${choice.neighborRoute.residentName} rapport ${choice.neighborRoute.currentRelationship}/${choice.neighborRoute.minimumRelationship}` : null,
      choice.workRoute ? `${choice.workRoute.employerName} standing ${choice.workRoute.currentStanding}/${choice.workRoute.minimumStanding}` : null,
      choice.supplierRoute ? `${choice.supplierRoute.supplierName} standing ${choice.supplierRoute.currentStanding}/${choice.supplierRoute.minimumStanding}` : null,
      choice.petRoute ? `${choice.petRoute.petName} ${choice.petRoute.laborPoints}/${choice.petRoute.minimumLaborPoints} literal points` : null
    ].filter(Boolean).join(' · ');
    if (choice.itemTags) {
      const items = matchingLifeThreadItems(state, instance.id, choice.id);
      const itemButtons = items.map(item => `<button class="life-object" data-life-choice="${escapeHtml(choice.id)}" data-life-thread-id="${escapeHtml(instance.id)}" data-life-item="${escapeHtml(item.id)}">
          <span class="life-object__glyph" style="--item-color:${escapeHtml(item.rarityColor)}">${escapeHtml(item.glyph)}</span>
          <span><b>${escapeHtml(item.name)}</b><small>${item.tags.filter(tag => choice.itemTags.includes(tag)).map(escapeHtml).join(' · ')} · ${item.durability}/${item.maxDurability} condition</small></span>
          <strong>OFFER</strong>
        </button>`).join('');
      return `<article class="life-choice"><p class="eyebrow">OBJECT APPROACH</p><h4>${escapeHtml(choice.label)}</h4><p>${escapeHtml(choice.detail)}</p><span class="choice-card__cost">${escapeHtml(commitments)}</span><div class="life-object-list">${itemButtons || '<div class="life-no-object">Nothing in the moving box truthfully fits. The portal may eventually produce another way.</div>'}</div></article>`;
    }
    const routedClass = choice.neighborRoute ? 'life-choice--neighbor' : choice.workRoute ? 'life-choice--work' : choice.supplierRoute ? 'life-choice--supplier' : choice.petRoute ? 'life-choice--pet' : '';
    const routedLabel = choice.neighborRoute ? 'NEIGHBOR ROUTE · RELATIONSHIP UNLOCK' : choice.workRoute ? 'EMPLOYMENT ROUTE · WORK STANDING UNLOCK' : choice.supplierRoute ? 'SUPPLIER ROUTE · STANDING UNLOCK' : choice.petRoute ? 'PET ROUTE · LITERAL TRAIT UNLOCK' : 'A WAY THROUGH';
    const actionLabel = choice.neighborRoute ? `ASK ${escapeHtml(choice.neighborRoute.residentName.toUpperCase())} TO JOIN` : choice.workRoute ? 'FILE THIS AS PAID WORK' : choice.supplierRoute ? 'BORROW NAMED STEAM' : choice.petRoute ? `LET ${escapeHtml(choice.petRoute.petName.toUpperCase())} AUDIT` : 'DO THIS';
    return `<article class="life-choice ${routedClass}"><p class="eyebrow">${routedLabel}</p><h4>${escapeHtml(choice.label)}</h4><p>${escapeHtml(choice.detail)}</p><span class="choice-card__cost">${escapeHtml(commitments)}</span><button class="button" data-life-choice="${escapeHtml(choice.id)}" data-life-thread-id="${escapeHtml(instance.id)}">${actionLabel}</button></article>`;
  }).join('');
  const echoes = state.life.history.filter(entry => entry.location === definition.location).slice(0, 3).map(entry => `<div class="life-echo"><span>${entry.kind === 'consequence' ? 'RETURNED LATER' : entry.kind === 'unattended' ? 'CONTINUED ALONE' : 'PIP CHOSE'}</span><p>${escapeHtml(entry.text)}</p></div>`).join('');
  return `
    <section class="life-thread-hero" style="--thread-color:${escapeHtml(actor.color)}">
      <div class="life-thread-hero__actor"><i></i><b>${escapeHtml(actor.name)}</b><small>${escapeHtml(actor.role)}</small></div>
      <div><p class="eyebrow">DAY ${instance.openedDay} · ${escapeHtml(LOCATIONS[definition.location].name)}</p><h3>${escapeHtml(definition.title)}</h3><p>${escapeHtml(definition.summary)}</p></div>
    </section>
    <section class="life-principle"><b>No acceptance button. No checklist. No XP.</b><span>If untouched through Day ${instance.expiresDay}, ${escapeHtml(actor.name)} and the world will continue without Pip.</span></section>
    ${routeLedgerMarkup ? `<section class="section-block"><h3>Who can truthfully enter this hearing</h3><p>Locked routes remain visible as authored prerequisites. Open routes appear below; none are rolled.</p>${routeLedgerMarkup}</section>` : ''}
    <section class="section-block"><h3>What Pip could do</h3><p>Each response spends real time or resources. Object, relationship, employment, supplier, and literal pet-trait routes open only from saved world facts. Every decision receives a non-random life receipt and may return later.</p><div class="life-choice-grid">${choiceMarkup}</div></section>
    ${echoes ? `<section class="section-block"><h3>What this place remembers</h3>${echoes}</section>` : ''}`;
}

function journalPanel() {
  setPanelHeading('NO QUEST LOG · JUST WHAT HAPPENED', 'Life, settings & continuity');
  const lifeHistory = state.life.history.slice(0, 12).map((entry,index) => `<div class="journal-entry journal-entry--life"><time>Day ${entry.day}<br>${String(entry.hour).padStart(2,'0')}:00</time><i></i><span>${escapeHtml(entry.text)}${entry.receipt ? `<button class="receipt-inline" data-life-receipt-index="${index}">AUDIT NON-RANDOM LIFE RECEIPT ↗</button>` : ''}</span></div>`).join('');
  return `
    <section class="section-block"><h3>Local continuity</h3><p>Save is automatic and local. Export before clearing browser data or moving devices.</p><button class="button" data-export-save>EXPORT LIFE</button> <button class="button" data-import-save>IMPORT LIFE</button> <input type="file" id="saveImportInput" accept="application/json" hidden><button class="button" data-reset-save>BEGIN AGAIN</button></section>
    <section class="section-block"><h3>Comfort and evidence</h3>
      <div class="settings-row"><span><b>Procedural sound</b><small>Starts only after input; no external audio files.</small></span><button class="switch ${state.settings.sound ? 'is-on':''}" data-setting="sound" aria-pressed="${state.settings.sound}"><i></i></button></div>
      <div class="settings-row"><span><b>World motion</b><small>Also respects the operating system's reduced-motion setting.</small></span><button class="switch ${state.settings.motion ? 'is-on':''}" data-setting="motion" aria-pressed="${state.settings.motion}"><i></i></button></div>
      <div class="settings-row"><span><b>Detailed probability receipts</b><small>Show full 256-bit entropy seed and component indices.</small></span><button class="switch ${state.settings.receiptDetail ? 'is-on':''}" data-setting="receiptDetail" aria-pressed="${state.settings.receiptDetail}"><i></i></button></div>
    </section>
    <section class="section-block"><h3>Life choices that came back later</h3><p>${state.life.scheduled.length ? `${state.life.scheduled.length} consequence${state.life.scheduled.length === 1 ? '' : 's'} still moving through the world. ${state.life.scheduled.length === 1 ? 'Its' : 'Their'} exact outcomes are not previewed as rewards.` : 'No delayed consequence is currently in flight.'}</p>${lifeHistory || '<p>Nothing here yet. Living choices will leave evidence without becoming objectives.</p>'}</section>
    <section class="section-block"><h3>All consequences</h3>${state.ledger.map(entry => `<div class="journal-entry"><time>Day ${entry.day}<br>${String(entry.hour).padStart(2,'0')}:00</time><i></i><span>${escapeHtml(entry.text)}</span></div>`).join('')}</section>`;
}

function receiptPanel() {
  const receipt = activeReceipt;
  const isCasino = receipt?.schema === 'small-odds.casino-play/v1';
  const isAuthored = receipt?.schema === 'small-odds.authored-lot/v1';
  const isLife = receipt?.schema === 'small-odds.life-choice/v1';
  const isMaintenance = /^small-odds\.commons-(?:maintenance|governance)-/.test(receipt?.schema || '');
  const isHousehold = /^small-odds\.household-/.test(receipt?.schema || '');
  const isWork = /^small-odds\.work-order-/.test(receipt?.schema || '');
  const isBusiness = /^small-odds\.(?:storefront-|business-)/.test(receipt?.schema || '');
  const isDistrict = /^small-odds\.district-/.test(receipt?.schema || '');
  const receiptEyebrow = isCasino ? 'TRANSPARENT TABLE EVIDENCE' : isAuthored ? 'FIXED PROVENANCE · NO RANDOM CLAIM' : isMaintenance ? 'RECURRING COMMONS CAUSALITY · NO RANDOM CLAIM' : isHousehold ? 'HOUSEHOLD COMMONS CAUSALITY · NO RANDOM CLAIM' : isLife ? 'LIVED CAUSALITY · NO RANDOM CLAIM' : isWork ? 'PAID LABOR CAUSALITY · NO RANDOM CLAIM' : isBusiness ? 'ALIEN-WEB CAUSALITY · NO RANDOM CLAIM' : isDistrict ? 'NEIGHBORHOOD CAUSALITY · NO RANDOM CLAIM' : 'REPLAYABLE DRAW EVIDENCE';
  const receiptTitle = isCasino ? receipt.gameName : isAuthored ? 'Authored artifact receipt' : isLife ? 'Life-choice receipt' : isBusiness || isDistrict || isWork || isHousehold || isMaintenance ? receipt.schema.replace('small-odds.','').replace('/v1','').replaceAll('-',' ').toUpperCase() : `Probability receipt #${receipt?.drawNumber ?? '?'}`;
  setPanelHeading(receiptEyebrow,receiptTitle);
  if (!receipt) return emptyState('∅','Receipt missing','The portal remembers the draw, but this view received no evidence.');
  const allItems = inspectableItems();
  const item = allItems.find(candidate => candidate.receipt === receipt || (receipt.seedHex && candidate.receipt.seedHex === receipt.seedHex) || (receipt.lotId && candidate.receipt.lotId === receipt.lotId));
  if (isMaintenance) return `
    <section class="section-block"><h3>${escapeHtml(receipt.modelLabel || receipt.label || receipt.routeLabel || NEIGHBORHOOD_COMMONS.maintenance.resource)}</h3><p>This record binds the saved accord, public service date, ownership rights and obligations, deterministic fault cause, retained asset or returning-pet identity, Hushglass integrity, both neighborhood institutions, work pressure, storefront, home, resident, and visible aftermath. It contains no entropy seed or hidden success roll.</p></section>
    <div class="stat-row"><div class="stat"><small>RANDOM</small><b>NO</b></div><div class="stat"><small>PORTAL ODDS</small><b>UNCHANGED</b></div><div class="stat"><small>DAY</small><b>${receipt.resolvedDay ?? receipt.chosenDay ?? receipt.activatedDay ?? receipt.startedDay ?? '—'}</b></div><div class="stat"><small>INTEGRITY</small><b>${receipt.integrity?.after ?? receipt.prerequisites?.integrity ?? 'FROZEN'}</b></div></div>
    <section class="section-block"><h3>Full recurring-service record</h3><pre class="receipt">${escapeHtml(JSON.stringify(receipt,null,2))}</pre></section>
    <section class="section-block"><h3>What never entered this result</h3><p>Portal draws, casino history, earlier lucky or unlucky outcomes, session length, unrelated pet traits, unowned objects, and any belief that a valve was due to succeed.</p></section>`;
  if (isHousehold) return `
    <section class="section-block"><h3>${escapeHtml(receipt.householdRoute?.householdName || NEIGHBORHOOD_COMMONS.name)}</h3><p>This record binds persistent warmth and trust to named supplier, employer, storefront, home, resident, and house evidence. It contains no entropy seed, hidden success roll, adaptive luck, or pity.</p></section>
    <div class="stat-row"><div class="stat"><small>RANDOM</small><b>NO</b></div><div class="stat"><small>PORTAL ODDS</small><b>UNCHANGED</b></div><div class="stat"><small>DAY</small><b>${receipt.resolvedDay ?? '—'}</b></div><div class="stat"><small>HOUSEHOLD STATE</small><b>${escapeHtml(receipt.householdRoute?.stateAfter || 'RECORDED')}</b></div></div>
    <section class="section-block"><h3>Full household commons record</h3><pre class="receipt">${escapeHtml(JSON.stringify(receipt,null,2))}</pre></section>
    <section class="section-block"><h3>What never entered this result</h3><p>Portal draws, casino history, earlier lucky or unlucky outcomes, session length, wealth beyond an explicit posted cost, unrelated pet traits, and any belief that Hushglass was due to get warm.</p></section>`;
  if (isWork) return `
    <section class="section-block"><h3>${escapeHtml(receipt.title || NEIGHBORHOOD_WORKS.name)}</h3><p>This record binds one authored calendar order, the selected owned tool, literal pet species/trait matches, public wage arithmetic, scheduled consequences, and the rivalry state. It contains no entropy seed, hidden productivity roll, adaptive luck, or pity.</p></section>
    <div class="stat-row"><div class="stat"><small>RANDOM</small><b>NO</b></div><div class="stat"><small>PORTAL ODDS</small><b>UNCHANGED</b></div><div class="stat"><small>WAGE</small><b>${receipt.wage ?? receipt.arithmetic?.wage ?? '—'}${MONEY}</b></div><div class="stat"><small>DAY</small><b>${receipt.resolvedDay ?? receipt.startedDay ?? '—'}</b></div></div>
    ${receipt.commonsMaintenance ? `<section class="section-block"><h3>Hushglass conflict outcome</h3><p>Integrity ${receipt.commonsMaintenance.integrity.before} → ${receipt.commonsMaintenance.integrity.after}; trust ${receipt.commonsMaintenance.householdRoute.trust.before} → ${receipt.commonsMaintenance.householdRoute.trust.after}; next service Day ${receipt.commonsMaintenance.nextDueDay}. The approach was written into household memory, not hidden inside the wage.</p></section>` : ''}
    <section class="section-block"><h3>Full paid-work record</h3><pre class="receipt">${escapeHtml(JSON.stringify(receipt,null,2))}</pre></section>
    <section class="section-block"><h3>What never entered this result</h3><p>Portal rarity, casino history, cash on hand, failed offers, session length, pet cuteness, unrelated traits, and any belief that Pip or the Long Table was due to win work.</p></section>`;
  if (isDistrict) return `
    <section class="section-block"><h3>${escapeHtml(receipt.residentName || receipt.item?.name || 'Lopsided Lane')}</h3><p>This record binds authored schedule state, explicit relationship prerequisites, fixed cooldowns or object context, and visible consequences. It contains no entropy seed, hidden resident roll, adaptive luck, or pity behavior.</p></section>
    <div class="stat-row"><div class="stat"><small>RANDOM</small><b>NO</b></div><div class="stat"><small>PORTAL ODDS</small><b>UNCHANGED</b></div><div class="stat"><small>DAY</small><b>${receipt.day ?? receipt.resolvedDay ?? receipt.deliveredDay ?? receipt.soldDay ?? '—'}</b></div><div class="stat"><small>STATE</small><b>${escapeHtml(receipt.selectedStatus || receipt.route || receipt.choiceId || receipt.arcId || 'GIFT')}</b></div></div>
    <section class="section-block"><h3>Full neighborhood record</h3><pre class="receipt">${escapeHtml(JSON.stringify(receipt,null,2))}</pre></section>
    <section class="section-block"><h3>What never entered this result</h3><p>Portal rarity, casino history, Pip's cash beyond an already-completed sale, previous unlucky outcomes, session length, and any belief that a neighbor was due to react.</p></section>`;
  if (isBusiness) {
    const isOffer = receipt.schema === 'small-odds.storefront-offer/v1';
    const factors = isOffer ? Object.entries(receipt.factors).map(([name,value]) => `<tr><td>${escapeHtml(name.replace(/([A-Z])/g,' $1'))}</td><td>×${Number(value).toFixed(4)}</td></tr>`).join('') : '';
    return `
      <section class="section-block"><h3>${escapeHtml(receipt.itemName || receipt.businessId || 'Bedroom commerce')}</h3><p>This record describes deterministic commerce. It contains no entropy seed, rarity roll, adaptive luck, hidden buyer chance, or pity behavior.</p></section>
      <div class="stat-row"><div class="stat"><small>RANDOM</small><b>NO</b></div><div class="stat"><small>PORTAL ODDS</small><b>UNCHANGED</b></div><div class="stat"><small>DAY</small><b>${receipt.generatedDay ?? receipt.soldDay ?? receipt.resolvedDay ?? receipt.day ?? '—'}</b></div><div class="stat"><small>SCHEMA</small><b>V1</b></div></div>
      ${isOffer ? `<section class="section-block"><h3>Offer arithmetic</h3><p>Base value ${receipt.itemBaseValue}${MONEY} becomes raw ${receipt.rawOffer}, rounded to ${receipt.offer}${MONEY}. The buyer’s deterministic counter ceiling is ${receipt.deterministicCeiling}${MONEY}; Pip’s posted ask is ${receipt.postedAsk}${MONEY}.</p><table class="odds-table"><thead><tr><th>DISCLOSED FACTOR</th><th>MULTIPLIER</th></tr></thead><tbody>${factors}</tbody></table></section>
      <section class="section-block"><h3>Why this buyer arrived</h3><p>${escapeHtml(receipt.buyerName)} scored ${receipt.buyerRouting.score}: favorites [${receipt.buyerRouting.favoriteMatches.map(escapeHtml).join(', ') || 'none'}], avoided [${receipt.buyerRouting.avoidMatches.map(escapeHtml).join(', ') || 'none'}], ${escapeHtml(receipt.buyerRouting.relationshipKey)} relationship ${receipt.buyerRouting.relationshipValue}, rotation tie-break ${receipt.buyerRouting.rotationTieBreak}.</p></section>` : ''}
      <section class="section-block"><h3>Full deterministic record</h3><pre class="receipt">${escapeHtml(JSON.stringify(receipt,null,2))}</pre></section>
      <section class="section-block"><h3>What never entered this result</h3><p>Cash on hand, earlier portal rarities, casino wins or losses, failed counters, session length, and whether Pip seemed due for a customer.</p></section>`;
  }
  if (isCasino) return `
    <section class="section-block"><h3>${escapeHtml(receipt.gameName)} · ${receipt.won ? 'posted win' : 'posted loss'}</h3><p>The receipt binds the seed, uniform outcome, fixed winning set, stake, return, insurance, RTP, and edge. Insurance is applied only after a losing outcome.</p></section>
    <div class="stat-row"><div class="stat"><small>RAW OUTCOME</small><b>${receipt.rawOutcomeRoll}/${receipt.outcomeCount}</b></div><div class="stat"><small>WINNING SET</small><b>${receipt.winningOutcomes.join(', ')}</b></div><div class="stat"><small>GROSS RETURN</small><b>${receipt.grossReturn}${MONEY}</b></div><div class="stat"><small>NET</small><b>${receipt.net >= 0 ? '+' : ''}${receipt.net}${MONEY}</b></div></div>
    <section class="section-block"><h3>Published economics</h3><p>RTP ${receipt.rtpPercent}% · house edge ${receipt.houseEdgePercent}% · gross payout ${receipt.grossPayoutMultiplier}×. Insurance refund ${receipt.insuranceRefund}${MONEY}; changes outcome: ${receipt.insuranceChangesOutcome ? 'yes' : 'no'}.</p></section>
    <section class="section-block"><h3>Full table record</h3><pre class="receipt">${escapeHtml(JSON.stringify(receipt,null,2))}</pre></section>
    <section class="section-block"><h3>What never entered the roll</h3><p>Earlier wins or losses, money beyond stake validation, relationships, item rarity, insurance selection, play duration, and whether the casino thinks Pip is due.</p></section>`;
  if (isAuthored) return `
    <section class="section-block"><h3>${item ? escapeHtml(item.name) : escapeHtml(receipt.lotId)}</h3><p>This object was deliberately authored and sold at a fixed posted price. It has useful mechanics, but no random seed, rarity roll, or statistical uniqueness claim.</p></section>
    <div class="stat-row"><div class="stat"><small>RANDOM</small><b>NO</b></div><div class="stat"><small>POSTED PRICE</small><b>${receipt.postedPrice}${MONEY}</b></div><div class="stat"><small>PURCHASED DAY</small><b>${receipt.purchasedDay}</b></div><div class="stat"><small>SOURCE</small><b>STARSPITE</b></div></div>
    <section class="section-block"><h3>Full provenance record</h3><pre class="receipt">${escapeHtml(JSON.stringify(receipt,null,2))}</pre></section>`;
  if (isLife) {
    const definition = LIFE_THREADS.find(thread => thread.id === receipt.definitionId);
    const choice = definition?.choices.find(candidate => candidate.id === receipt.choiceId) || [definition?.neighborChoice,definition?.workChoice,definition?.supplierChoice,definition?.petChoice].find(candidate => candidate?.id === receipt.choiceId);
    return `
      <section class="section-block"><h3>${escapeHtml(definition?.title || receipt.definitionId)}</h3><p>This receipt records an authored response to a deterministic world situation. It contains no entropy seed, rarity, adaptive luck, or reward roll.</p></section>
      <div class="stat-row"><div class="stat"><small>RANDOM</small><b>NO</b></div><div class="stat"><small>CHOICE</small><b>${escapeHtml(choice?.label || receipt.choiceId)}</b></div><div class="stat"><small>TIME</small><b>${receipt.hours}h</b></div><div class="stat"><small>RETURNS</small><b>${receipt.delayedDueDay ? `DAY ${receipt.delayedDueDay}` : 'NONE'}</b></div></div>
      <section class="section-block"><h3>Object contribution</h3><p>${receipt.itemId ? `${escapeHtml(receipt.itemName)} contributed power ${receipt.itemContribution}; broke: ${receipt.itemBroke ? 'yes' : 'no'}. Its tags opened the approach but did not manufacture a random outcome.` : 'No object was used for this response.'}</p></section>
      ${receipt.workRoute ? `<section class="section-block"><h3>Employment route</h3><p>${escapeHtml(receipt.workRoute.employerName)} standing ${receipt.workRoute.standingBefore} → ${receipt.workRoute.standingAfter}; rivalry pressure ${receipt.workRoute.pressureBefore} → ${receipt.workRoute.pressureAfter}. The unlock came from prior paid work, not a roll.</p></section>` : ''}
      ${receipt.supplierRoute ? `<section class="section-block"><h3>Supplier route</h3><p>${escapeHtml(receipt.supplierRoute.supplierName)} standing ${receipt.supplierRoute.standingBefore} → ${receipt.supplierRoute.standingAfter}. This was saved cooperative capacity, not a roll.</p></section>` : ''}
      ${receipt.petRoute ? `<section class="section-block"><h3>Literal pet route</h3><p>${escapeHtml(receipt.petRoute.petName)} supplied ${receipt.petRoute.laborPoints} points from named matching species and traits: ${escapeHtml(receipt.petRoute.reasons.join('; '))}. Unrelated traits contributed zero.</p></section>` : ''}
      ${receipt.householdRoute ? `<section class="section-block"><h3>Household state</h3><p>${escapeHtml(receipt.householdRoute.householdName)} moved ${escapeHtml(receipt.householdRoute.stateBefore)} → ${escapeHtml(receipt.householdRoute.stateAfter)}; warmth ${receipt.householdRoute.warmth.before} → ${receipt.householdRoute.warmth.after}, trust ${receipt.householdRoute.trust.before} → ${receipt.householdRoute.trust.after}. Route: ${escapeHtml(receipt.householdRoute.routeKind)}.</p></section>` : ''}
      <section class="section-block"><h3>Full causality record</h3><pre class="receipt">${escapeHtml(JSON.stringify(receipt,null,2))}</pre></section>`;
  }
  return `
    <section class="section-block"><h3>${item ? escapeHtml(item.name) : escapeHtml(receipt.rarityResult.toUpperCase())}</h3><p>This receipt proves how the local generator mapped its seed. It does not prove the physical origin of operating-system entropy.</p></section>
    <div class="stat-row"><div class="stat"><small>RARITY ROLL</small><b>${receipt.rarityRoll.toLocaleString()}</b></div><div class="stat"><small>RARITY</small><b>${escapeHtml(receipt.rarityResult)}</b></div><div class="stat"><small>TICKET ROLL</small><b>${receipt.casinoTicketRoll.toLocaleString()}</b></div><div class="stat"><small>TICKET TARGET</small><b>1,000,000</b></div></div>
    <section class="section-block"><h3>Full machine record</h3><pre class="receipt">${escapeHtml(JSON.stringify(receipt,null,2))}</pre></section>
    <section class="section-block"><h3>What never entered the draw</h3><p>Player money, failures, session length, prior results, relationships, inventory, business performance, and whether the game believes you deserve luck.</p></section>`;
}

function renderPanel() {
  if (!activePanel) return;
  const factories = { portal:portalPanel, inventory:inventoryPanel, market:marketPanel, district:districtPanel, home:homePanel, pets:petsPanel, business:businessPanel, casino:casinoPanel, life:lifePanel, journal:journalPanel, receipt:receiptPanel };
  elements.panelContent.innerHTML = (factories[activePanel] || journalPanel)();
}

function executeItemAction(itemId, action) {
  const result = performItemAction(state, itemId, action);
  if (result.ok) {
    action === 'sell' ? audio.success() : action === 'gift' || action === 'hatch' ? audio.reaction() : audio.click();
  }
  showToast(result.text, 5600);
  save(); render();
}

function portalDraw() {
  const parallel = state.portal.upgrades.includes('parallel-aperture');
  const result = drawItems(state, { parallel });
  if (!result.ok) { showToast(result.text); return; }
  audio.portal();
  discoveryQueue.push(...result.items);
  if (result.items.some(item => item.receipt.casinoTicketWon)) pendingTicketReveal = true;
  save(); render(); closePanel();
  setTimeout(showNextDiscovery, 360);
}

function showNextDiscovery() {
  currentDiscovery = discoveryQueue.shift() || null;
  if (!currentDiscovery) { elements.discovery.hidden = true; return; }
  const item = currentDiscovery;
  const quote = marketQuote(item, state);
  elements.discovery.style.setProperty('--rarity', item.rarityColor);
  $('#discoveryRarity').textContent = `${item.rarityLabel.toUpperCase()} ARRIVAL · DRAW #${item.receipt.drawNumber}`;
  $('#discoveryGlyph').textContent = item.glyph;
  $('#discoveryName').textContent = item.name;
  $('#discoverySubtitle').textContent = item.subtitle;
  $('#discoveryDescription').textContent = `${item.description} ${item.provenance}`;
  $('#discoveryValue').textContent = formatCredits(quote);
  $('#discoveryStyle').textContent = item.styleFamily.name;
  $('#discoveryTrigger').textContent = item.triggerName;
  elements.discoveryKeep.textContent = item.receipt.casinoTicketWon ? 'KEEP ITEM · INSPECT THE IMPOSSIBLE TICKET' : 'PUT IT IN THE BOX';
  elements.discovery.hidden = false;
  if (item.rarity === 'unknown' || item.receipt.casinoTicketWon) audio.unknown();
  else audio.success();
}

function closeDiscovery() {
  elements.discovery.hidden = true;
  currentDiscovery = null;
  if (discoveryQueue.length) setTimeout(showNextDiscovery, 180);
  else if (pendingTicketReveal) {
    pendingTicketReveal = false;
    showToast('One in a million. The Starspite invitation is waiting inside the Randomizer.', 6500);
    setTimeout(() => openPanel('portal'), 320);
  } else showToast('The item is in your moving box. Its future trigger is now listening.');
}

function exportSave() {
  const payload = JSON.stringify(state, null, 2);
  const blob = new Blob([payload], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `small-odds-day-${state.day}.json`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast('Life exported. The file contains no secret account data.');
}

async function importSave(file) {
  try {
    const candidate = migrateState(JSON.parse(await file.text()));
    state = candidate;
    save(); closePanel(); render();
    showToast(`Imported Day ${state.day}. The house accepted the continuity paperwork.`);
  } catch (error) { showToast(`Import refused: ${error.message}`, 6000); }
}

function handlePanelClick(event) {
  const target = event.target.closest('button');
  if (!target) return;
  audio.click();
  if (target.dataset.districtArcResident) {
    const result = resolveDistrictArcChoice(state,target.dataset.districtArcResident,target.dataset.districtArcChoice);
    result.ok ? audio.success() : audio.click();
    showToast(result.text,result.ok ? 7000 : 4400); save(); render();
  } else if (target.dataset.districtTalk) {
    const result = interactDistrictResident(state,target.dataset.districtTalk);
    result.ok ? audio.reaction() : audio.click();
    showToast(result.text,6200); save(); render();
  } else if (target.dataset.districtGift) {
    const result = giftDistrictItem(state,target.dataset.districtGift,target.dataset.districtItem);
    result.ok ? audio.success() : audio.click();
    showToast(result.text,6500); save(); render();
  } else if (target.dataset.districtObservation) {
    activeReceipt = districtResidentObservation(state,target.dataset.districtObservation).receipt || null;
    activePanel = 'receipt'; renderPanel(); elements.panelContent.scrollTop = 0;
  } else if (target.dataset.districtDeliveryReceipt != null) {
    activeReceipt = state.district.deliveries[Number(target.dataset.districtDeliveryReceipt)]?.receipt || null;
    activePanel = 'receipt'; renderPanel(); elements.panelContent.scrollTop = 0;
  } else if (target.dataset.districtHouseReceipt != null) {
    activeReceipt = state.district.houseMarks[Number(target.dataset.districtHouseReceipt)]?.receipt || null;
    activePanel = 'receipt'; renderPanel(); elements.panelContent.scrollTop = 0;
  } else if (target.dataset.districtArcReceipt != null) {
    activeReceipt = state.district.arcs[Number(target.dataset.districtArcReceipt)]?.receipt || null;
    activePanel = 'receipt'; renderPanel(); elements.panelContent.scrollTop = 0;
  } else if (target.dataset.householdReceiptIndex != null) {
    activeReceipt = state.district.households?.[NEIGHBORHOOD_COMMONS.id]?.history?.[Number(target.dataset.householdReceiptIndex)]?.receipt || null;
    activePanel = 'receipt'; renderPanel(); elements.panelContent.scrollTop = 0;
  } else if (target.hasAttribute('data-household-last-receipt')) {
    activeReceipt = state.district.households?.[NEIGHBORHOOD_COMMONS.id]?.lastReceipt || null;
    activePanel = 'receipt'; renderPanel(); elements.panelContent.scrollTop = 0;
  } else if (target.dataset.commonsGovernanceChoice) {
    const result = chooseCommonsGovernance(state,target.dataset.commonsGovernanceChoice);
    result.ok ? audio.success() : audio.click(); showToast(result.text,result.ok ? 7600 : 5200); save(); render();
  } else if (target.dataset.commonsMaintenanceRoute) {
    const result = startCommonsMaintenance(state,target.dataset.commonsMaintenanceRoute,target.dataset.commonsMaintenanceAsset || null);
    result.ok ? audio.success() : audio.click(); showToast(result.text,result.ok ? 7200 : 4800); save(); render();
  } else if (target.dataset.commonsMaintenanceReceiptIndex != null) {
    activeReceipt = state.district.households?.[NEIGHBORHOOD_COMMONS.id]?.maintenance?.history?.[Number(target.dataset.commonsMaintenanceReceiptIndex)]?.receipt || null;
    activePanel = 'receipt'; renderPanel(); elements.panelContent.scrollTop = 0;
  } else if (target.hasAttribute('data-commons-maintenance-active-receipt')) {
    activeReceipt = state.district.households?.[NEIGHBORHOOD_COMMONS.id]?.maintenance?.active?.startReceipt || null;
    activePanel = 'receipt'; renderPanel(); elements.panelContent.scrollTop = 0;
  } else if (target.hasAttribute('data-commons-maintenance-last-receipt')) {
    activeReceipt = state.district.households?.[NEIGHBORHOOD_COMMONS.id]?.maintenance?.lastReceipt || null;
    activePanel = 'receipt'; renderPanel(); elements.panelContent.scrollTop = 0;
  } else if (target.hasAttribute('data-commons-governance-receipt')) {
    activeReceipt = state.district.households?.[NEIGHBORHOOD_COMMONS.id]?.maintenance?.governance?.lastReceipt || null;
    activePanel = 'receipt'; renderPanel(); elements.panelContent.scrollTop = 0;
  } else if (target.hasAttribute('data-commons-fault-receipt')) {
    activeReceipt = state.district.households?.[NEIGHBORHOOD_COMMONS.id]?.maintenance?.fault?.activationReceipt || null;
    activePanel = 'receipt'; renderPanel(); elements.panelContent.scrollTop = 0;
  } else if (target.hasAttribute('data-district-family-receipt')) {
    activeReceipt = state.district.houseMarks[0]?.receipt || null;
    activePanel = 'receipt'; renderPanel(); elements.panelContent.scrollTop = 0;
  } else if (target.dataset.lifeChoice) {
    const result = resolveLifeThread(state, target.dataset.lifeThreadId, target.dataset.lifeChoice, target.dataset.lifeItem || null);
    if (result.ok) {
      result.reactions?.length ? audio.reaction() : audio.success();
      closePanel();
      showSpeech(result.text);
    }
    showToast(result.text, result.ok ? 6500 : 4200);
    save(); render();
  } else if (target.hasAttribute('data-work-start')) {
    const result = startWorkOrder(state,target.dataset.workStart,target.dataset.workTool,target.dataset.workApproach);
    result.ok ? audio.success() : audio.click(); showToast(result.text,result.ok ? 7200 : 4800); save(); render();
  } else if (target.hasAttribute('data-work-receipt-active')) {
    activeReceipt = state.work.active?.startReceipt || null; activePanel = 'receipt'; renderPanel(); elements.panelContent.scrollTop = 0;
  } else if (target.dataset.workReceiptIndex != null) {
    activeReceipt = state.work.history[Number(target.dataset.workReceiptIndex)]?.receipt || null; activePanel = 'receipt'; renderPanel(); elements.panelContent.scrollTop = 0;
  } else if (target.dataset.itemAction) executeItemAction(target.dataset.itemId, target.dataset.itemAction);
  else if (target.dataset.businessList) {
    const result = listBusinessItem(state,target.dataset.businessList); result.ok ? audio.success() : audio.click(); showToast(result.text,6200); save(); render();
  } else if (target.dataset.businessAccept) {
    const result = acceptBusinessOffer(state,target.dataset.businessAccept); result.ok ? audio.success() : audio.click(); showToast(result.text,6500); save(); render();
  } else if (target.dataset.businessCounter) {
    const result = counterBusinessOffer(state,target.dataset.businessCounter); result.ok ? audio.reaction() : audio.click(); showToast(result.text,6200); save(); render();
  } else if (target.dataset.businessDelist) {
    const result = delistBusinessItem(state,target.dataset.businessDelist); showToast(result.text); save(); render();
  } else if (target.dataset.businessEquipmentReturn) {
    const result = returnBusinessEquipment(state,target.dataset.businessEquipmentReturn); showToast(result.text); save(); render();
  } else if (target.hasAttribute('data-business-pet')) {
    const result = assignBusinessPet(state,target.dataset.businessPet); result.ok ? audio.reaction() : audio.click(); showToast(result.text,6200); save(); render();
  } else if (target.hasAttribute('data-business-pet-clear')) {
    const result = assignBusinessPet(state,null); showToast(result.text); save(); render();
  } else if (target.dataset.businessUpgrade) {
    const result = buyBusinessUpgrade(state,target.dataset.businessUpgrade); result.ok ? audio.success() : audio.click(); showToast(result.text,6200); save(); render();
  } else if (target.dataset.businessBranch) {
    const result = chooseBusinessBranch(state,target.dataset.businessBranch); result.ok ? audio.unknown() : audio.click(); showToast(result.text,6500); save(); render();
  } else if (target.dataset.businessReceiptListing) {
    activeReceipt = state.business?.listings.find(listing => listing.id === target.dataset.businessReceiptListing)?.offerReceipt || null; activePanel = 'receipt'; renderPanel(); elements.panelContent.scrollTop = 0;
  } else if (target.dataset.businessReceiptIndex != null) {
    activeReceipt = state.business?.history[Number(target.dataset.businessReceiptIndex)]?.receipt || null; activePanel = 'receipt'; renderPanel(); elements.panelContent.scrollTop = 0;
  } else if (target.hasAttribute('data-business-daily-receipt')) {
    activeReceipt = state.business?.lastDailyReceipt || null; activePanel = 'receipt'; renderPanel(); elements.panelContent.scrollTop = 0;
  }
  else if (target.dataset.receiptId) {
    const item = inspectableItems().find(candidate => candidate.id === target.dataset.receiptId);
    if (item) { activeReceipt = item.receipt; activePanel = 'receipt'; renderPanel(); elements.panelContent.scrollTop = 0; }
  } else if (target.dataset.receiptDraw) {
    activeReceipt = state.portal.receipts.find(receipt => String(receipt.drawNumber) === target.dataset.receiptDraw);
    activePanel = 'receipt'; renderPanel(); elements.panelContent.scrollTop = 0;
  } else if (target.hasAttribute('data-portal-draw')) portalDraw();
  else if (target.hasAttribute('data-rush-charge')) {
    const result = rushPortalCharge(state); showToast(result.text); save(); render();
  } else if (target.dataset.portalUpgrade) {
    const result = buyPortalUpgrade(state,target.dataset.portalUpgrade); showToast(result.text); save(); render();
  } else if (target.dataset.homeUpgrade) {
    const result = buyHomeUpgrade(state,target.dataset.homeUpgrade); result.ok ? audio.success() : audio.click(); showToast(result.text); save(); render();
  } else if (target.dataset.startBusiness) {
    const result = startBusiness(state,target.dataset.startBusiness); result.ok ? audio.success() : audio.click(); showToast(result.text); save(); render();
  } else if (target.hasAttribute('data-redeem-ticket')) {
    const result = redeemCasinoTicket(state); result.ok ? audio.unknown() : audio.click(); showToast(result.text, 7000); save(); closePanel(); render();
  } else if (target.dataset.travelDirect) {
    closePanel(); go(target.dataset.travelDirect);
  } else if (target.dataset.casinoGame) {
    const result = playCasinoGame(state,target.dataset.casinoGame,Number(target.dataset.casinoStake)); result.ok ? (result.won ? audio.unknown() : audio.click()) : audio.click(); showToast(result.text, 6500); save(); render();
  } else if (target.hasAttribute('data-casino-insure')) {
    const result = setCasinoInsurance(state,target.dataset.casinoInsure); showToast(result.text, 5200); save(); render();
  } else if (target.hasAttribute('data-casino-clear-insurance')) {
    const result = setCasinoInsurance(state,null); showToast(result.text); save(); render();
  } else if (target.dataset.casinoLot) {
    const result = buyCasinoLot(state,target.dataset.casinoLot); result.ok ? audio.unknown() : audio.click(); showToast(result.text, 6000); save(); render();
  } else if (target.dataset.casinoReceiptIndex != null) {
    activeReceipt = state.starspite.history[Number(target.dataset.casinoReceiptIndex)]; activePanel = 'receipt'; renderPanel(); elements.panelContent.scrollTop = 0;
  } else if (target.dataset.lifeReceiptIndex != null) {
    activeReceipt = state.life.history[Number(target.dataset.lifeReceiptIndex)]?.receipt || null; activePanel = 'receipt'; renderPanel(); elements.panelContent.scrollTop = 0;
  } else if (target.hasAttribute('data-sleep')) {
    const result = skipToMorning(state); audio.success(); showToast(result.text); save(); render();
  } else if (target.dataset.openPanel) openPanel(target.dataset.openPanel);
  else if (target.dataset.setting) {
    state.settings[target.dataset.setting] = !state.settings[target.dataset.setting]; save(); renderPanel(); render();
  } else if (target.hasAttribute('data-export-save')) exportSave();
  else if (target.hasAttribute('data-import-save')) $('#saveImportInput')?.click();
  else if (target.hasAttribute('data-reset-save')) {
    if (window.confirm('Erase this local life and return to the title? Export first if it matters.')) {
      localStorage.removeItem(SAVE_KEY); state = null; returnToTitle();
    }
  }
}

function moveFocus(direction) {
  const count = LOCATIONS[state.location].focus.length;
  state.focus = Math.max(0, Math.min(count - 1, state.focus + direction));
  audio.click();
  render();
}

function handleKeyboard(event) {
  if (!state || elements.game.hidden || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
  if (event.key === 'Escape') {
    if (!elements.discovery.hidden) closeDiscovery();
    else if (!elements.panel.hidden) closePanel();
    else if (!elements.intro.hidden) { introIndex = introBeats.length; showIntroBeat(); }
    return;
  }
  if (!elements.discovery.hidden || !elements.intro.hidden) return;
  if (!elements.panel.hidden) {
    if (event.key.toLowerCase() === 'i') openPanel('inventory');
    return;
  }
  const key = event.key.toLowerCase();
  if (key === 'a' || event.key === 'ArrowLeft') moveFocus(-1);
  else if (key === 'd' || event.key === 'ArrowRight') moveFocus(1);
  else if (key === 'e' || event.key === 'Enter') handleHotspot(Math.min(2,state.focus));
  else if (key === 'i') openPanel('inventory');
  else if (key === 'r') openPanel('portal');
  else if (key === 'h') openPanel('home');
  else if (key === 'p') openPanel('pets');
  else if (key === 'b') openPanel('business');
}

elements.newGame.addEventListener('click', startNewGame);
elements.continueGame.addEventListener('click', continueGame);
elements.titleButton.addEventListener('click', returnToTitle);
elements.introNext.addEventListener('click', advanceIntro);
elements.panelClose.addEventListener('click', closePanel);
elements.panelBackdrop.addEventListener('click', closePanel);
elements.panelContent.addEventListener('click', handlePanelClick);
elements.panelContent.addEventListener('change', event => {
  if (event.target.id === 'saveImportInput' && event.target.files?.[0]) importSave(event.target.files[0]);
});
elements.discoveryClose.addEventListener('click', closeDiscovery);
elements.discoveryKeep.addEventListener('click', closeDiscovery);
elements.discoveryReceipt.addEventListener('click', () => {
  if (!currentDiscovery) return;
  const receipt = currentDiscovery.receipt;
  elements.discovery.hidden = true;
  openPanel('receipt',{ receipt });
});
elements.actorButton.addEventListener('click', actorInteraction);
elements.activityList.addEventListener('click', event => {
  const lifeButton = event.target.closest('[data-life-thread]');
  if (lifeButton) {
    audio.click();
    openPanel('life', { threadId:lifeButton.dataset.lifeThread });
    return;
  }
  const button = event.target.closest('[data-activity]');
  if (button) performActivity(button.dataset.activity);
});
[$('#hotspotA'),$('#hotspotB'),$('#hotspotC')].forEach((button,index)=>button.addEventListener('click',()=>handleHotspot(index)));
$$('[data-travel]').forEach(button => button.addEventListener('click', () => go(button.dataset.travel)));
$$('[data-panel]').forEach(button => button.addEventListener('click', () => openPanel(button.dataset.panel)));
$('#marketInfoButton').addEventListener('click', () => openPanel('market'));
$('#settingsButton').addEventListener('click', () => openPanel('journal'));
document.addEventListener('keydown', handleKeyboard);

elements.continueGame.hidden = !hasSave();
window.addEventListener('beforeunload', save);
