import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialState, createItemFromSeed, drawItems, rarityFromRoll, ticketWonFromRoll,
  unlockPortal, runActivity, performItemAction, startBusiness, buyHomeUpgrade,
  buyPortalUpgrade, advanceTime, marketQuote, migrateState, replayItemFromReceipt,
  redeemCasinoTicket, playCasinoGame, casinoGameMath, casinoInsuranceQuote,
  setCasinoInsurance, buyCasinoLot, travelTo, syncLifeThreads, lifeThreadAtLocation,
  matchingLifeThreadItems, resolveLifeThread, resolveContextReactions, businessOfferQuote,
  businessListingCapacity, businessPetProfile, listBusinessItem, delistBusinessItem,
  acceptBusinessOffer, counterBusinessOffer, assignBusinessPet, buyBusinessUpgrade,
  chooseBusinessBranch, businessTags, districtPhase, districtResidentsNow,
  districtSupplierProfile, districtArcStatus, resolveDistrictArcChoice, resolveDistrictArcReturns,
  districtResidentObservation, interactDistrictResident, giftDistrictItem,
  resolveDistrictDeliveries, districtFamilyEcho, lifeThreadChoices, availableWorkOrder,
  neighborhoodWorkProfile, workPetProfile, matchingWorkTools, workOrderQuote,
  startWorkOrder, resolveWorkReturns, districtHouseholdProfile, householdPetProfile,
  resolveDueLifeConsequences, commonsMaintenanceProfile, commonsMaintenanceOptions,
  commonsMaintenanceAssets, startCommonsMaintenance, resolveCommonsMaintenanceReturns,
  resolveCommonsMaintenanceOverdue, activateCommonsMaintenanceFault, commonsGovernanceOptions,
  chooseCommonsGovernance, starspiteDebtProfile, startStarspiteDebtAftermath,
  resolveStarspiteDebtReturns, SYSTEM_CONSTANTS
} from '../runtime/systems.js';
import { LIFE_THREADS, DISTRICT_RESIDENTS, DISTRICT_CONTEXT_REACTIONS, DISTRICT_ARCS, DISTRICT_SUPPLIER, NEIGHBORHOOD_WORKS, NEIGHBORHOOD_COMMONS, STARSPITE_DEBT_ROUTES, PET_TRAITS, GAME_VERSION } from '../runtime/game-data.js';

const WINNING_TICKET_SEED = '000000000000000000000000000000000000000000000000000000003e3f8dc3';

const seed = value => Number(value).toString(16).padStart(64, '0').slice(-64);

function debtReadyState(stake = 10) {
  const state = createInitialState('Receipt holder');
  state.starspite.access = 'member';
  state.world.locations.push('starspite');
  state.location = 'starspite';
  state.money = 500;
  const loss = playCasinoGame(state,'truth-coin',stake,{ entropyFactory:() => seed(1) });
  assert.equal(loss.won,false);
  assert.equal(travelTo(state,'district').ok,true);
  return { state, loss };
}

test('published weight tables total exactly one million and combinations are honestly separated', () => {
  assert.equal(SYSTEM_CONSTANTS.rarityWeightTotal, 1_000_000);
  assert.equal(SYSTEM_CONSTANTS.petTraitWeightTotal, 1_000_000);
  assert.ok(SYSTEM_CONSTANTS.mechanicalCombinations >= 300_000_000);
  assert.ok(SYSTEM_CONSTANTS.namedCombinationsIncludingStyleFamilies >= 3_000_000_000);
  assert.equal(SYSTEM_CONSTANTS.namedCombinationsIncludingStyleFamilies / SYSTEM_CONSTANTS.mechanicalCombinations, 10);
  assert.equal(SYSTEM_CONSTANTS.starspiteDebtRoutes,3);
});

test('rarity boundaries match the visible fixed table exactly', () => {
  assert.equal(rarityFromRoll(1).id, 'common');
  assert.equal(rarityFromRoll(650_000).id, 'common');
  assert.equal(rarityFromRoll(650_001).id, 'uncommon');
  assert.equal(rarityFromRoll(880_000).id, 'uncommon');
  assert.equal(rarityFromRoll(880_001).id, 'rare');
  assert.equal(rarityFromRoll(970_000).id, 'rare');
  assert.equal(rarityFromRoll(970_001).id, 'exotic');
  assert.equal(rarityFromRoll(995_000).id, 'exotic');
  assert.equal(rarityFromRoll(995_001).id, 'legendary');
  assert.equal(rarityFromRoll(999_900).id, 'legendary');
  assert.equal(rarityFromRoll(999_901).id, 'unknown');
  assert.equal(rarityFromRoll(1_000_000).id, 'unknown');
});

test('casino ticket is exactly one designated outcome in one million', () => {
  assert.equal(ticketWonFromRoll(1), false);
  assert.equal(ticketWonFromRoll(999_999), false);
  assert.equal(ticketWonFromRoll(1_000_000), true);
  assert.throws(() => ticketWonFromRoll(0), /1 through 1,000,000/);
});

test('a real deterministic million-to-one receipt unlocks the Starspite invitation route', () => {
  const state = createInitialState();
  unlockPortal(state);
  const result = drawItems(state, { entropyFactory:() => WINNING_TICKET_SEED });
  assert.equal(result.ok, true);
  assert.equal(result.items[0].receipt.casinoTicketRoll, 1_000_000);
  assert.equal(result.items[0].receipt.casinoTicketWon, true);
  assert.equal(state.world.casinoTicket.status, 'authentic-unredeemed');
  assert.equal(state.starspite.access, 'invited');
  assert.equal(travelTo(state, 'starspite').ok, false);
  const boarded = redeemCasinoTicket(state);
  assert.equal(boarded.ok, true);
  assert.equal(state.starspite.access, 'member');
  assert.equal(state.location, 'starspite');
  assert.ok(state.world.locations.includes('starspite'));
});

test('item generation depends on the entropy seed and catalog, not player state', () => {
  const itemA = createItemFromSeed(seed(44), 1);
  const itemB = createItemFromSeed(seed(44), 1);
  assert.deepEqual(itemA, itemB);
  assert.equal(itemA.receipt.adaptiveLuck, false);
  assert.equal(itemA.receipt.pitySystem, false);
  assert.ok(itemA.styleFamily.name);
  assert.ok(itemA.tags.length >= 2);
  assert.deepEqual(replayItemFromReceipt(itemA.receipt), itemA);
});

test('Starspite table math is exact, public, and includes a zero-edge option', () => {
  const mobius = casinoGameMath('mobius-twelve');
  assert.deepEqual([mobius.winProbabilityNumerator,mobius.winProbabilityDenominator], [1,12]);
  assert.equal(mobius.rtpPercent, 91.667);
  assert.equal(mobius.houseEdgePercent, 8.333);
  const truth = casinoGameMath('truth-coin');
  assert.deepEqual([truth.winProbabilityNumerator,truth.winProbabilityDenominator], [1,2]);
  assert.equal(truth.rtpPercent, 100);
  assert.equal(truth.houseEdgePercent, 0);
});

test('casino play uses a fresh uniform receipt and ignores history, wealth, and relationships', () => {
  const state = createInitialState();
  state.starspite.access = 'member';
  state.world.locations.push('starspite');
  state.location = 'starspite';
  state.money = 100;
  state.relationships.vesper = 999;
  state.starspite.losses = 200;
  const before = state.money;
  const result = playCasinoGame(state, 'truth-coin', 10, { entropyFactory:() => seed(2) });
  assert.equal(result.ok, true);
  assert.equal(result.receipt.rawOutcomeRoll, 2);
  assert.equal(result.receipt.won, true);
  assert.equal(result.receipt.grossReturn, 20);
  assert.equal(result.receipt.net, 10);
  assert.equal(state.money, before + 10);
  assert.equal(result.receipt.adaptiveLuck, false);
  assert.equal(result.receipt.pitySystem, false);
  assert.equal(result.receipt.insuranceChangesOutcome, false);
});

test('item insurance changes disclosed loss cost but cannot alter the casino outcome', () => {
  const state = createInitialState();
  state.starspite.access = 'member';
  state.world.locations.push('starspite');
  state.location = 'starspite';
  state.money = 100;
  const item = createItemFromSeed(seed(71), 1);
  state.inventory.push(item);
  const expectedRefund = casinoInsuranceQuote(item, 10);
  const durability = item.durability;
  assert.equal(setCasinoInsurance(state, item.id).ok, true);
  const result = playCasinoGame(state, 'truth-coin', 10, { entropyFactory:() => seed(1) });
  assert.equal(result.receipt.rawOutcomeRoll, 1);
  assert.equal(result.won, false);
  assert.equal(result.insuranceRefund, expectedRefund);
  assert.equal(result.receipt.insuranceChangesOutcome, false);
  assert.equal(item.durability, durability - 1);
  assert.equal(state.money, 100 - 10 + expectedRefund);
});

test('Starspite auction artifacts have fixed authored provenance instead of fake draw receipts', () => {
  const state = createInitialState();
  state.starspite.access = 'member';
  state.world.locations.push('starspite');
  state.location = 'starspite';
  state.money = 1000;
  const result = buyCasinoLot(state, 'edge-compass');
  assert.equal(result.ok, true);
  assert.equal(result.item.receipt.schema, 'small-odds.authored-lot/v1');
  assert.equal(result.item.receipt.random, false);
  assert.equal('seedHex' in result.item.receipt, false);
  assert.equal(state.starspite.lotsPurchased.includes('edge-compass'), true);
  assert.equal(buyCasinoLot(state, 'edge-compass').ok, false);
  const beforeReaction = result.item.baseValue;
  const play = playCasinoGame(state, 'truth-coin', 2, { entropyFactory:() => seed(1) });
  assert.equal(play.receipt.rawOutcomeRoll, 1);
  assert.equal(play.reactions.length, 1);
  assert.ok(result.item.baseValue > beforeReaction);
  assert.equal(play.receipt.insuranceChangesOutcome, false);
});

test('debt aftermath derives only from a replay-valid saved casino loss', () => {
  const state = createInitialState();
  state.location = 'district';
  state.district.visits = 1;
  state.starspite.history.unshift({ schema:'small-odds.casino-play/v1', won:false, net:-50, gameId:'truth-coin', seedHex:seed(1) });
  assert.equal(starspiteDebtProfile(state).eligibleReceipt,null);
  state.starspite.access = 'member';
  state.location = 'starspite';
  state.money = 100;
  const win = playCasinoGame(state,'truth-coin',10,{ entropyFactory:() => seed(2) });
  assert.equal(win.won,true);
  state.location = 'district';
  assert.equal(starspiteDebtProfile(state).eligibleReceipt,null);
  state.location = 'starspite';
  const loss = playCasinoGame(state,'truth-coin',10,{ entropyFactory:() => seed(1) });
  state.location = 'district';
  const profile = starspiteDebtProfile(state);
  assert.equal(profile.eligibleReceipt.seedHex,loss.receipt.seedHex);
  assert.equal(profile.recoveryTarget,10);
  assert.equal(profile.random,false);
  assert.equal(profile.casinoOddsChanged,false);
});

test('all three debt routes stay visible with exact saved-world gates', () => {
  const { state } = debtReadyState();
  let profile = starspiteDebtProfile(state);
  assert.equal(profile.routes.length,STARSPITE_DEBT_ROUTES.length);
  assert.equal(profile.routes.find(route => route.id === 'lane-solidarity-rota').open,true);
  assert.match(profile.routes.find(route => route.id === 'long-table-repayment').reason,/orders 0\/1/);
  assert.match(profile.routes.find(route => route.id === 'hushglass-breathing-room').reason,/trust 0\/3/);
  state.work.completed = 1;
  state.district.households[NEIGHBORHOOD_COMMONS.id].trust = 3;
  state.district.households[NEIGHBORHOOD_COMMONS.id].agreements = 1;
  profile = starspiteDebtProfile(state);
  assert.equal(profile.routes.every(route => route.open),true);
  assert.equal(profile.routes.every(route => route.recoveryPayment === 10),true);
});

test('solidarity aftermath freezes one receipt, returns exactly once, and leaves a durable mark', () => {
  const { state, loss } = debtReadyState();
  const casinoNet = state.starspite.netCredits;
  const beforeMoney = state.money;
  const started = startStarspiteDebtAftermath(state,'lane-solidarity-rota');
  assert.equal(started.ok,true);
  assert.equal(started.receipt.sourceCasinoReceipt.seedHex,loss.receipt.seedHex);
  assert.equal(started.receipt.recoveryPayment,10);
  assert.equal(started.receipt.casinoOddsChanged,false);
  assert.equal(startStarspiteDebtAftermath(state,'lane-solidarity-rota').ok,false);
  state.day = started.receipt.dueDay;
  const first = resolveStarspiteDebtReturns(state);
  const second = resolveStarspiteDebtReturns(state);
  assert.equal(first.length,1);
  assert.equal(second.length,0);
  assert.equal(state.money,beforeMoney + 10);
  assert.equal(state.starspite.netCredits,casinoNet);
  assert.equal(state.district.supplier.standing,1);
  assert.equal(state.relationships.tavi,1);
  assert.equal(state.relationships.oola,1);
  assert.equal(state.district.houseMarks[0].visual,'solidarity-ribbons');
  assert.equal(state.stats.debtAftermathStarts,1);
  assert.equal(state.stats.debtAftermathReturns,1);
});

test('Long Table recovery stays separate from same-day storefront income', () => {
  const { state } = debtReadyState();
  state.work.completed = 1;
  state.money = 1000;
  assert.equal(startBusiness(state,'repair').ok,true);
  state.location = 'district';
  const started = startStarspiteDebtAftermath(state,'long-table-repayment');
  assert.equal(started.ok,true);
  const dueDay = started.receipt.dueDay;
  advanceTime(state,24);
  assert.ok(state.day >= dueDay);
  const returned = state.starspite.aftermath.history[0].receipt;
  assert.equal(returned.routeId,'long-table-repayment');
  assert.equal(returned.moneySeparation.category,'neighborhood-recovery');
  assert.equal(returned.moneySeparation.storefrontDailyIncomeExcluded,true);
  assert.equal(returned.moneySeparation.storefrontIncomeSameDay,state.business.lastDailyReceipt.income);
  assert.equal(returned.recoveryPayment,10);
  assert.deepEqual(Object.keys(returned.before.household).sort(),['agreements','trust','warmth']);
  assert.equal(state.work.standing,1);
  assert.equal(state.work.pressure,1);
  assert.equal(state.business.rating,2);
  assert.equal(state.district.houseMarks[0].visual,'repayment-stamp');
});

test('Hushglass breathing room applies only its frozen household consequences', () => {
  const { state } = debtReadyState();
  const household = state.district.households[NEIGHBORHOOD_COMMONS.id];
  household.trust = 3;
  household.agreements = 1;
  const started = startStarspiteDebtAftermath(state,'hushglass-breathing-room');
  assert.equal(started.ok,true);
  state.day = started.receipt.dueDay;
  const [returned] = resolveStarspiteDebtReturns(state);
  assert.equal(returned.receipt.frozenReturnEffect.warmth,1);
  assert.equal(household.warmth,1);
  assert.equal(household.trust,5);
  assert.equal(state.home.score,2);
  assert.equal(state.relationships.sumi,2);
  assert.equal(state.work.pressure,0);
  assert.equal(state.district.houseMarks[0].visual,'breathing-room-lamp');
});

test('debt aftermath never enters a later casino roll', () => {
  const prepared = debtReadyState();
  const started = startStarspiteDebtAftermath(prepared.state,'lane-solidarity-rota');
  prepared.state.day = started.receipt.dueDay;
  resolveStarspiteDebtReturns(prepared.state);
  prepared.state.location = 'starspite';
  prepared.state.money = 100;

  const control = createInitialState('Control');
  control.starspite.access = 'member';
  control.location = 'starspite';
  control.money = 100;
  const after = playCasinoGame(prepared.state,'mobius-twelve',5,{ entropyFactory:() => seed(77) });
  const plain = playCasinoGame(control,'mobius-twelve',5,{ entropyFactory:() => seed(77) });
  assert.equal(after.receipt.rawOutcomeRoll,plain.receipt.rawOutcomeRoll);
  assert.equal(after.receipt.seedHex,plain.receipt.seedHex);
  assert.equal(after.receipt.won,plain.receipt.won);
});

test('portal draw consumes declared charge and preserves an inspectable receipt', () => {
  const state = createInitialState();
  unlockPortal(state);
  const result = drawItems(state, { entropyFactory: () => seed(99) });
  assert.equal(result.ok, true);
  assert.equal(result.items.length, 1);
  assert.equal(state.portal.charges, 2);
  assert.equal(state.inventory.length, 1);
  assert.equal(state.portal.receipts[0].seedHex, seed(99));
  assert.equal(state.portal.draws, 1);
});

test('context activity wakes a matching held item and changes its history and value', () => {
  const state = createInitialState();
  unlockPortal(state);
  const item = createItemFromSeed(seed(101), 1);
  item.triggerTags = ['family'];
  item.triggerName = 'during a family activity';
  state.inventory.push(item);
  state.location = 'room';
  const before = item.baseValue;
  const result = runActivity(state, 'sort-boxes');
  assert.equal(result.ok, true);
  assert.equal(result.reactions.length, 1);
  assert.ok(item.baseValue > before);
  assert.equal(item.reactionHistory.length, 1);
});

test('multi-tag future triggers require the complete declared context signature', () => {
  const state = createInitialState();
  unlockPortal(state);
  const item = createItemFromSeed(seed(102), 1);
  item.triggerTags = ['power', 'home'];
  item.triggerName = 'during a neighborhood power dip';
  state.inventory.push(item);
  state.location = 'room';
  const before = item.baseValue;
  const ordinaryHome = runActivity(state, 'sort-boxes');
  assert.equal(ordinaryHome.reactions.length, 0);
  assert.equal(item.baseValue, before);
});

test('reaction prose normalizes terminal punctuation instead of showing doubled periods', () => {
  const state = createInitialState();
  const item = createItemFromSeed(seed(103), 1);
  item.triggerTags = ['truth'];
  state.inventory.push(item);
  const result = resolveContextReactions(state, ['truth'], 'A consequence returned.');
  assert.equal(result.length, 1);
  assert.doesNotMatch(result[0].text, /\.\./);
  assert.match(result[0].text, /during A consequence returned\./);
});

test('cocoon action creates a pet with stackable trait evidence', () => {
  const state = createInitialState();
  const item = createItemFromSeed(seed(202), 1);
  item.hatchable = true;
  item.rarity = 'rare';
  state.inventory.push(item);
  const result = performItemAction(state, item.id, 'hatch');
  assert.equal(result.ok, true);
  assert.equal(state.pets.length, 1);
  assert.equal(state.pets[0].traits.length, 3);
  assert.equal(state.pets[0].traitReceipt.adaptiveLuck, false);
});

test('business item synergy and day crossing produce a deterministic receipt', () => {
  const state = createInitialState();
  state.money = 1000;
  assert.equal(startBusiness(state, 'oddities').ok, true);
  const item = createItemFromSeed(seed(303), 1);
  item.tags.push('mystery');
  state.inventory.push(item);
  assert.equal(performItemAction(state, item.id, 'business').ok, true);
  const before = state.money;
  state.hour = 23;
  advanceTime(state, 2);
  assert.ok(state.money > before);
  assert.ok(state.business.lastIncome > 0);
  assert.equal(state.business.lastDailyReceipt.schema, 'small-odds.business-daily/v1');
  assert.equal(state.business.lastDailyReceipt.random, false);
});

test('alien-web offer routing is deterministic, fully factored, and ignores cash on hand', () => {
  const left = createInitialState();
  const right = createInitialState();
  for (const state of [left,right]) {
    state.money = 1000;
    assert.equal(startBusiness(state, 'oddities').ok, true);
    state.player.reputation = 7;
    state.relationships.vendor = 9;
  }
  left.money = 3;
  right.money = 900_000;
  const leftItem = createItemFromSeed(seed(501), 1);
  const rightItem = createItemFromSeed(seed(501), 1);
  leftItem.tags.push('trade');
  rightItem.tags.push('trade');
  const leftQuote = businessOfferQuote(left,leftItem,{ ordinal:4 });
  const rightQuote = businessOfferQuote(right,rightItem,{ ordinal:4 });
  assert.deepEqual(leftQuote.receipt, rightQuote.receipt);
  assert.equal(leftQuote.receipt.random, false);
  assert.equal(leftQuote.receipt.moneyIgnored, true);
  assert.equal(leftQuote.receipt.portalOddsChanged, false);
  assert.equal(Object.keys(leftQuote.receipt.factors).length, 11);
  assert.ok(leftQuote.receipt.buyerRouting.score > 0);
});

test('listing uses reversible escrow and delisting returns the exact item', () => {
  const state = createInitialState();
  state.money = 1000;
  startBusiness(state, 'repair');
  const item = createItemFromSeed(seed(502), 1);
  state.inventory.push(item);
  const listed = listBusinessItem(state,item.id);
  assert.equal(listed.ok, true);
  assert.equal(state.inventory.length, 0);
  assert.equal(state.business.listings.length, 1);
  assert.equal(listed.receipt.schema, 'small-odds.storefront-offer/v1');
  assert.ok(listed.listing.ceiling >= listed.listing.offer);
  listed.listing.offer = listed.listing.ask + 1;
  assert.equal(counterBusinessOffer(state,listed.listing.id).ok, false);
  const delisted = delistBusinessItem(state,listed.listing.id);
  assert.equal(delisted.ok, true);
  assert.equal(state.business.listings.length, 0);
  assert.equal(state.inventory[0], item);
});

test('counteroffers approach a public ceiling and accepted sales schedule a real callback', () => {
  const state = createInitialState();
  state.money = 1000;
  startBusiness(state, 'food');
  const item = createItemFromSeed(seed(503), 1);
  item.tags.push('food');
  state.inventory.push(item);
  const listed = listBusinessItem(state,item.id).listing;
  listed.ask = listed.ceiling + 100;
  const priorOffer = listed.offer;
  const counter = counterBusinessOffer(state,listed.id);
  assert.equal(counter.ok, true);
  assert.equal(counter.receipt.random, false);
  assert.ok(listed.offer > priorOffer);
  assert.ok(listed.offer <= listed.ceiling);
  const sold = acceptBusinessOffer(state,listed.id);
  assert.equal(sold.ok, true);
  assert.equal(sold.receipt.schema, 'small-odds.storefront-sale/v1');
  assert.equal(state.business.sales, 1);
  assert.equal(state.business.callbacks.length, 1);
  assert.equal(state.stats.itemsSold, 1);
  const ratingBeforeCallback = state.business.rating;
  state.hour = 23;
  advanceTime(state,49);
  assert.equal(state.business.callbacks.length, 0);
  assert.ok(state.business.rating > ratingBeforeCallback);
  assert.ok(state.business.history.some(entry => entry.receipt?.schema === 'small-odds.business-callback/v1'));
});

test('one assigned pet contributes its actual stackable business traits', () => {
  const state = createInitialState();
  state.money = 1000;
  startBusiness(state, 'oddities');
  const pet = {
    id:'pet-test', name:'Ledger Junior', speciesId:'receipt-eel', speciesName:'Receipt Eel', glyph:'∿',
    tags:['business'], baseBonus:'test', affection:1, mood:'ready', originItem:null,
    traits:[
      { id:'accountant', name:'Instinctive Accountant' },
      { id:'pockets', name:'Has Additional Pockets' },
      { id:'helpful', name:'Unreasonably Helpful' },
      { id:'sniffer', name:'Tax-Scented' }
    ], traitReceipt:{ randomClaim:false }
  };
  state.pets.push(pet);
  const beforeCapacity = businessListingCapacity(state);
  assert.equal(assignBusinessPet(state,pet.id).ok, true);
  const profile = businessPetProfile(state);
  assert.equal(profile.offerFactor, 1.12);
  assert.equal(profile.dailyFactor, 1.176);
  assert.equal(profile.listingSlots, 1);
  assert.equal(profile.callbackRating, 1);
  assert.equal(businessListingCapacity(state), beforeCapacity + 1);
  const legalItem = createItemFromSeed(seed(504),1);
  legalItem.tags.push('legal');
  const receipt = businessOfferQuote(state,legalItem).receipt;
  assert.equal(receipt.factors.petTraits, 1.12);
  assert.equal(receipt.factors.petContext, 1.08);
});

test('business upgrades and one permanent branch add declared capability without changing RNG tables', () => {
  const state = createInitialState();
  state.money = 5000;
  unlockPortal(state);
  startBusiness(state, 'repair');
  state.business.rating = 20;
  const rarityTotal = SYSTEM_CONSTANTS.rarityWeightTotal;
  const capacity = businessListingCapacity(state);
  assert.equal(buyBusinessUpgrade(state,'listing-nest').ok, true);
  assert.equal(businessListingCapacity(state), capacity + 1);
  assert.equal(chooseBusinessBranch(state,'repair-micro-renovation').ok, true);
  assert.ok(businessTags(state).includes('home'));
  assert.equal(chooseBusinessBranch(state,'repair-emergency-insides').ok, false);
  assert.equal(SYSTEM_CONSTANTS.rarityWeightTotal, rarityTotal);
});

test('home and portal upgrades buy explicit capability without changing probability tables', () => {
  const state = createInitialState();
  unlockPortal(state);
  state.money = 2000;
  state.home.score = 30;
  const rarityTotalBefore = SYSTEM_CONSTANTS.rarityWeightTotal;
  assert.equal(buyHomeUpgrade(state, 'shelf').ok, true);
  assert.equal(buyPortalUpgrade(state, 'charge-rack').ok, true);
  assert.equal(state.portal.maxCharges, 5);
  assert.equal(SYSTEM_CONSTANTS.rarityWeightTotal, rarityTotalBefore);
});

test('market quote responds to world tags, not a hidden personal luck variable', () => {
  const state = createInitialState();
  const item = createItemFromSeed(seed(404), 1);
  item.tags = ['weather'];
  const eventQuote = marketQuote(item, state);
  item.tags = ['precision'];
  const ordinaryQuote = marketQuote(item, state);
  assert.ok(eventQuote > ordinaryQuote);
  assert.equal('luck' in state.player, false);
});

test('versioned save migration preserves life while restoring missing defaults', () => {
  const original = createInitialState('Nib');
  original.version = 1;
  delete original.starspite;
  delete original.relationships.vesper;
  delete original.settings.receiptDetail;
  const migrated = migrateState(original);
  assert.equal(migrated.player.name, 'Nib');
  assert.equal(migrated.settings.receiptDetail, false);
  assert.equal(migrated.starspite.access, 'locked');
  assert.equal(migrated.relationships.vesper, 0);
  assert.equal(migrated.schema, 'small-odds.save/v1');
});

test('life-thread catalog exposes authored choices without pretending to be random', () => {
  assert.equal(SYSTEM_CONSTANTS.lifeThreadCount, 6);
  assert.equal(new Set(LIFE_THREADS.map(thread => thread.id)).size, LIFE_THREADS.length);
  for (const thread of LIFE_THREADS) {
    assert.ok(thread.choices.length >= 3);
    assert.ok(thread.choices.some(choice => choice.itemTags?.length));
    assert.equal(thread.unattended != null, true);
    assert.equal('weight' in thread, false);
    assert.equal('rarity' in thread, false);
  }
});

test('a deterministic local situation emerges from day, place, event, and relationships', () => {
  const left = createInitialState();
  const right = createInitialState();
  for (const state of [left,right]) {
    state.day = 4;
    state.location = 'kitchen';
    state.world.locations = ['shore','kitchen'];
  }
  right.money = 9000;
  right.inventory.push(createItemFromSeed(seed(888), 1));
  const leftResult = syncLifeThreads(left);
  const rightResult = syncLifeThreads(right);
  assert.equal(leftResult.spawned.definitionId, 'dinner-personhood');
  assert.equal(rightResult.spawned.definitionId, leftResult.spawned.definitionId);
  assert.equal(leftResult.spawned.random, false);
  assert.equal(lifeThreadAtLocation(left).location, 'kitchen');
});

test('a relevant object opens a truthful life-choice route and gains consequential history', () => {
  const state = createInitialState();
  state.day = 4;
  state.location = 'kitchen';
  state.world.locations = ['shore','kitchen'];
  const item = createItemFromSeed(seed(889), 1);
  item.tags.push('legal');
  state.inventory.push(item);
  syncLifeThreads(state);
  const thread = lifeThreadAtLocation(state);
  const beforeDurability = item.durability;
  const beforeValue = item.baseValue;
  assert.ok(matchingLifeThreadItems(state, thread.id, 'object-witness').some(candidate => candidate.id === item.id));
  const result = resolveLifeThread(state, thread.id, 'object-witness', item.id);
  assert.equal(result.ok, true);
  assert.equal(result.receipt.schema, 'small-odds.life-choice/v1');
  assert.equal(result.receipt.random, false);
  assert.equal(result.receipt.itemId, item.id);
  assert.equal(item.durability, beforeDurability - 1);
  assert.ok(item.baseValue > beforeValue);
  assert.equal(state.life.active.length, 0);
  assert.equal(state.life.scheduled.length, 1);
  assert.equal(state.stats.lifeChoices, 1);
});

test('a chosen life response returns as a delayed consequence on a later day', () => {
  const state = createInitialState();
  state.day = 4;
  state.location = 'room';
  state.world.locations = ['shore','room'];
  syncLifeThreads(state);
  const thread = lifeThreadAtLocation(state);
  const choice = resolveLifeThread(state, thread.id, 'hold-the-ladder');
  assert.equal(choice.ok, true);
  assert.equal(state.life.scheduled[0].dueDay, 5);
  const relationAfterChoice = state.relationships.dad;
  state.hour = 23;
  advanceTime(state, 2);
  assert.equal(state.life.scheduled.length, 0);
  assert.ok(state.relationships.dad > relationAfterChoice);
  assert.ok(state.life.history.some(entry => entry.kind === 'consequence' && entry.threadId === thread.id));
  assert.equal(state.stats.lifeConsequences, 1);
});

test('unanswered situations continue without Pip instead of waiting in a quest log', () => {
  const state = createInitialState();
  state.day = 3;
  state.location = 'shore';
  state.world.locations = ['shore'];
  syncLifeThreads(state);
  const thread = lifeThreadAtLocation(state);
  state.hour = 23;
  advanceTime(state, 49);
  assert.ok(state.life.history.some(entry => entry.kind === 'unattended' && entry.threadId === thread.id));
  assert.ok(state.ledger.some(entry => entry.lifeThreadId === thread.id && entry.unattended === true));
});

test('Starspite life situations respect membership and older saves gain current continuity', () => {
  const locked = createInitialState();
  locked.day = 10;
  locked.location = 'starspite';
  locked.world.locations = ['starspite'];
  assert.equal(syncLifeThreads(locked).spawned, null);

  const member = createInitialState();
  member.day = 10;
  member.location = 'starspite';
  member.world.locations = ['starspite'];
  member.starspite.access = 'member';
  assert.equal(syncLifeThreads(member).spawned.definitionId, 'starspite-streak-refugee');

  const old = createInitialState('Vim');
  old.version = 2;
  delete old.life;
  delete old.stats.lifeChoices;
  delete old.stats.lifeConsequences;
  const migrated = migrateState(old);
  assert.equal(migrated.version, GAME_VERSION);
  assert.deepEqual(migrated.life.active, []);
  assert.equal(migrated.stats.lifeChoices, 0);
  assert.equal(migrated.stats.lifeConsequences, 0);
});

test('version-three businesses migrate assets into version-four storefront equipment', () => {
  const old = createInitialState('Old Pip');
  old.version = 3;
  old.money = 1000;
  startBusiness(old,'oddities');
  const equipment = createItemFromSeed(seed(700),1);
  old.business.assets.push(equipment);
  delete old.business.listings;
  delete old.business.upgrades;
  delete old.business.callbacks;
  delete old.business.history;
  delete old.business.sequence;
  delete old.stats.businessListings;
  delete old.stats.businessSales;
  const migrated = migrateState(old);
  assert.equal(migrated.version, GAME_VERSION);
  assert.equal(migrated.business.assets[0].id, equipment.id);
  assert.deepEqual(migrated.business.listings, []);
  assert.deepEqual(migrated.business.callbacks, []);
  assert.equal(migrated.business.sequence, 1);
  assert.equal(migrated.stats.businessListings, 0);
  assert.equal(migrated.stats.businessSales, 0);
});

test('Lopsided Lane residents follow four public schedule phases without random state', () => {
  const state = createInitialState();
  const phases = [[2,'deepnight'],[8,'foreglow'],[14,'highglow'],[20,'afterglow']];
  assert.equal(DISTRICT_RESIDENTS.length,4);
  assert.equal(DISTRICT_CONTEXT_REACTIONS.length,4);
  for (const [hour,phase] of phases) {
    state.hour = hour;
    assert.equal(districtPhase(state),phase);
    const residents = districtResidentsNow(state);
    assert.equal(residents.length,4);
    assert.ok(residents.every(resident => resident.phase === phase && resident.current.zone && Number.isFinite(resident.current.x)));
  }
  assert.ok(DISTRICT_RESIDENTS.every(resident => !('weight' in resident) && !('random' in resident)));
});

test('carried, listed, gifted, and sold objects produce distinct later neighbor observations', () => {
  const state = createInitialState();
  state.money = 1000;
  startBusiness(state,'oddities');
  state.location = 'district';
  const item = createItemFromSeed(seed(810),1);
  item.tags = ['power','history'];
  state.inventory.push(item);
  assert.equal(districtResidentObservation(state,'latch').status,'carried');
  const listed = listBusinessItem(state,item.id,{ ask:40 });
  assert.equal(listed.ok,true);
  assert.equal(districtResidentObservation(state,'latch').status,'listed');
  assert.equal(delistBusinessItem(state,listed.listing.id).ok,true);
  assert.equal(giftDistrictItem(state,'latch',item.id).ok,true);
  assert.equal(districtResidentObservation(state,'latch').status,'gifted');

  const saleState = createInitialState();
  saleState.money = 1000;
  startBusiness(saleState,'oddities');
  const soldItem = createItemFromSeed(seed(811),1);
  soldItem.tags = ['biology','home','weather','business','legal','travel','sound','social','truth','power','history','precision'];
  saleState.inventory.push(soldItem);
  const saleListing = listBusinessItem(saleState,soldItem.id,{ ask:1 });
  const sale = acceptBusinessOffer(saleState,saleListing.listing.id);
  saleState.day = sale.delivery.dueDay;
  resolveDistrictDeliveries(saleState);
  assert.equal(districtResidentObservation(saleState,sale.delivery.residentId).status,'sold');
});

test('district context reactions require both the current event and actual item tags', () => {
  const state = createInitialState();
  state.location = 'district';
  state.world.eventIndex = 7;
  const item = createItemFromSeed(seed(812),1);
  item.tags = ['power'];
  state.inventory.push(item);
  const active = districtResidentObservation(state,'latch');
  assert.equal(active.context.id,'street-power-nap');
  assert.deepEqual(active.receipt.contextMatches,['power']);
  item.tags = ['fashion'];
  const inactive = districtResidentObservation(state,'latch');
  assert.equal(inactive.context,null);
  assert.equal(inactive.receipt.contextReactionId,null);
});

test('a resident gift removes the item and leaves an exact parent and house receipt', () => {
  const state = createInitialState();
  state.location = 'district';
  const item = createItemFromSeed(seed(813),1);
  item.tags = ['power','precision'];
  state.inventory.push(item);
  const rarityTotal = SYSTEM_CONSTANTS.rarityWeightTotal;
  const result = giftDistrictItem(state,'latch',item.id);
  assert.equal(result.ok,true);
  assert.equal(result.receipt.schema,'small-odds.district-gift/v1');
  assert.equal(result.receipt.random,false);
  assert.equal(result.receipt.portalOddsChanged,false);
  assert.deepEqual(result.receipt.matchedTags,['power','precision']);
  assert.equal(state.inventory.some(candidate => candidate.id === item.id),false);
  assert.equal(state.stats.itemsGifted,1);
  assert.equal(state.stats.districtGifts,1);
  assert.equal(state.district.houseMarks[0].visual,'thank-you-pennant');
  assert.equal(districtFamilyEcho(state).active,true);
  assert.equal(SYSTEM_CONSTANTS.rarityWeightTotal,rarityTotal);
});

test('an accepted storefront sale resolves through a fixed neighborhood delivery route', () => {
  const state = createInitialState();
  state.money = 2000;
  startBusiness(state,'oddities');
  const item = createItemFromSeed(seed(814),1);
  item.tags = ['biology','home','weather','business','legal','travel','sound','social','truth','power','history','precision'];
  state.inventory.push(item);
  const listing = listBusinessItem(state,item.id,{ ask:1 });
  const result = acceptBusinessOffer(state,listing.listing.id);
  assert.equal(result.ok,true);
  assert.equal(result.receipt.districtDelivery.random,false);
  assert.equal(result.receipt.districtDelivery.residentId,result.delivery.residentId);
  assert.equal(result.delivery.status,'travelling');
  const rarityTotal = SYSTEM_CONSTANTS.rarityWeightTotal;
  state.day = result.delivery.dueDay;
  const resolved = resolveDistrictDeliveries(state);
  assert.equal(resolved.length,1);
  assert.equal(result.delivery.status,'delivered');
  assert.equal(result.delivery.receipt.schema,'small-odds.district-delivery/v1');
  assert.equal(result.delivery.receipt.random,false);
  assert.equal(result.delivery.receipt.portalOddsChanged,false);
  assert.equal(state.stats.districtDeliveries,1);
  assert.equal(state.district.houseMarks[0].visual,'parcel-periscope');
  assert.equal(districtResidentObservation(state,result.delivery.residentId).status,'sold');
  assert.equal(SYSTEM_CONSTANTS.rarityWeightTotal,rarityTotal);
});

test('version-four saves gain empty district continuity without invented history', () => {
  const old = createInitialState('Before the Lane');
  old.version = 4;
  delete old.district;
  delete old.relationships.tavi;
  delete old.relationships.oola;
  delete old.relationships.nibbin;
  delete old.relationships.latch;
  delete old.stats.districtTalks;
  delete old.stats.districtGifts;
  delete old.stats.districtDeliveries;
  const migrated = migrateState(old);
  assert.equal(migrated.version,GAME_VERSION);
  assert.deepEqual(migrated.district.encounters,[]);
  assert.deepEqual(migrated.district.gifts,[]);
  assert.deepEqual(migrated.district.deliveries,[]);
  assert.deepEqual(migrated.district.houseMarks,[]);
  assert.equal(migrated.relationships.tavi,0);
  assert.equal(migrated.stats.districtDeliveries,0);
});

test('each resident owns a repeatable authored arc with explicit prerequisites and no random field', () => {
  const state = createInitialState();
  assert.equal(DISTRICT_ARCS.length,DISTRICT_RESIDENTS.length);
  assert.equal(DISTRICT_SUPPLIER.bands.length,4);
  for (const resident of DISTRICT_RESIDENTS) {
    const arc = DISTRICT_ARCS.find(candidate => candidate.residentId === resident.id);
    assert.ok(arc);
    assert.ok(arc.choices.length >= 2);
    assert.ok(arc.choices.every(choice => !('random' in choice) && !('weight' in choice)));
    const locked = districtArcStatus(state,resident.id);
    assert.equal(locked.eligible,false);
    assert.equal(locked.prerequisite.current,0);
    state.relationships[resident.id] = arc.minRelationship;
    assert.equal(districtArcStatus(state,resident.id).eligible,true);
  }
});

test('a resident arc changes persistent supplier standing, schedule band, and exact cooldown', () => {
  const state = createInitialState();
  state.location = 'district';
  state.player.energy = 100;
  state.relationships.latch = 1;
  const rarityTotal = SYSTEM_CONSTANTS.rarityWeightTotal;
  const result = resolveDistrictArcChoice(state,'latch','lend-family-bracket');
  assert.equal(result.ok,true);
  assert.equal(result.receipt.schema,'small-odds.district-arc-choice/v1');
  assert.equal(result.receipt.random,false);
  assert.equal(result.receipt.prerequisite.satisfied,true);
  assert.deepEqual(result.receipt.supplier,{ id:DISTRICT_SUPPLIER.id, beforeStanding:0, standingDelta:2, afterStanding:2, beforeState:'balancing', afterState:'stocked', beforeBusinessFactor:1, afterBusinessFactor:1.06 });
  assert.equal(result.receipt.nextAvailableDay,8);
  assert.equal(districtSupplierProfile(state).state,'stocked');
  const latch = districtResidentsNow(state).find(resident => resident.id === 'latch');
  assert.equal(latch.scheduleSource,'supplier-state:stocked');
  assert.equal(districtResidentObservation(state,'latch').receipt.scheduleSource,'supplier-state:stocked');
  assert.equal(districtArcStatus(state,'latch').eligible,false);
  assert.match(districtArcStatus(state,'latch').reason,/due on Day 3/);
  assert.equal(SYSTEM_CONSTANTS.rarityWeightTotal,rarityTotal);
});

test('a district arc return resolves once, crosses into home and business, then obeys cooldown', () => {
  const state = createInitialState();
  state.money = 1000;
  startBusiness(state,'oddities');
  state.location = 'district';
  state.player.energy = 100;
  state.relationships.latch = 1;
  const started = resolveDistrictArcChoice(state,'latch','lend-family-bracket');
  const ratingBefore = state.business.rating;
  state.day = started.receipt.dueDay;
  const first = resolveDistrictArcReturns(state);
  const second = resolveDistrictArcReturns(state);
  assert.equal(first.length,1);
  assert.equal(second.length,0);
  assert.equal(first[0].receipt.schema,'small-odds.district-arc-return/v1');
  assert.equal(first[0].receipt.random,false);
  assert.equal(first[0].receipt.portalOddsChanged,false);
  assert.equal(state.business.rating,ratingBefore + 1);
  assert.equal(state.district.houseMarks[0].visual,'kettle-crate');
  assert.equal(state.stats.districtArcReturns,1);
  assert.equal(districtArcStatus(state,'latch').eligible,false);
  state.day = started.receipt.nextAvailableDay;
  assert.equal(districtArcStatus(state,'latch').eligible,true);
  assert.equal(districtArcStatus(state,'latch').nextCycle,2);
});

test('supplier standing changes daily storefront income by one disclosed deterministic factor', () => {
  const makeBusinessState = standing => {
    const state = createInitialState();
    state.money = 1000;
    startBusiness(state,'oddities');
    state.district.supplier.standing = standing;
    state.hour = 23;
    advanceTime(state,1);
    return state;
  };
  const neutral = makeBusinessState(0);
  const flourishing = makeBusinessState(5);
  assert.equal(neutral.business.lastDailyReceipt.supplierFactor,1);
  assert.equal(flourishing.business.lastDailyReceipt.supplierFactor,1.12);
  assert.equal(flourishing.business.lastDailyReceipt.random,false);
  assert.equal(flourishing.business.lastDailyReceipt.portalOddsChanged,false);
  assert.ok(flourishing.business.lastIncome > neutral.business.lastIncome);
});

test('a trusted resident unlocks one deterministic neighbor route inside an existing life thread', () => {
  const state = createInitialState();
  state.day = 2;
  state.hour = 10;
  state.location = 'room';
  state.life.active = [{ id:'life-neighbor-test', definitionId:'dad-shelf-alibi', location:'room', actor:'dad', openedDay:2, expiresDay:4, worldEventId:'ordinary-day', random:false }];
  assert.equal(lifeThreadChoices(state,'life-neighbor-test').some(choice => choice.id === 'ask-latch-hinge-memory'),false);
  state.relationships.latch = 3;
  const choices = lifeThreadChoices(state,'life-neighbor-test');
  const neighbor = choices.find(choice => choice.id === 'ask-latch-hinge-memory');
  assert.equal(neighbor.neighborRoute.residentName,'Granduncle Latch');
  const result = resolveLifeThread(state,'life-neighbor-test',neighbor.id);
  assert.equal(result.ok,true);
  assert.equal(result.receipt.random,false);
  assert.equal(result.receipt.portalOddsChanged,false);
  assert.equal(result.receipt.neighborRoute.minimumRelationship,3);
  assert.equal(result.receipt.neighborRoute.relationshipBefore,3);
  assert.equal(result.receipt.neighborRoute.relationshipAfter,5);
  assert.equal(result.receipt.neighborRoute.supplierStandingBefore,0);
  assert.equal(result.receipt.neighborRoute.supplierStandingAfter,1);
  assert.equal(state.stats.neighborLifeRoutes,1);
});

test('version-five saves gain neutral dependency state without fabricated arc history', () => {
  const old = createInitialState('Before the Kettle');
  old.version = 5;
  delete old.district.arcs;
  delete old.district.scheduledArcs;
  delete old.district.cooldowns;
  delete old.district.supplier;
  delete old.stats.districtArcChoices;
  delete old.stats.districtArcReturns;
  delete old.stats.neighborLifeRoutes;
  const migrated = migrateState(old);
  assert.equal(migrated.version,GAME_VERSION);
  assert.deepEqual(migrated.district.arcs,[]);
  assert.deepEqual(migrated.district.scheduledArcs,[]);
  assert.deepEqual(migrated.district.cooldowns,{});
  assert.deepEqual(migrated.district.supplier,{ id:DISTRICT_SUPPLIER.id, standing:0, cycles:0, lastReceipt:null });
  assert.equal(migrated.stats.districtArcChoices,0);
  assert.equal(migrated.stats.districtArcReturns,0);
  assert.equal(migrated.stats.neighborLifeRoutes,0);
});

function workReadyState(day = 1) {
  const state = createInitialState('Working Pip');
  state.money = 2000;
  state.day = day;
  state.hour = 10;
  startBusiness(state,'oddities');
  const pet = {
    id:'pet-ledger', name:'Ledger', speciesId:'tax-mite', speciesName:'Tax-Mite', glyph:'P',
    tags:['legal','money'], baseBonus:'Finds one loose credit after legal activities.',
    traits:[{ ...PET_TRAITS.find(trait => trait.id === 'sniffer') }, { ...PET_TRAITS.find(trait => trait.id === 'jealous') }],
    affection:2, mood:'ready to invoice', originItem:null
  };
  state.pets.push(pet);
  assignBusinessPet(state,pet.id);
  const item = createItemFromSeed(seed(900 + day),1);
  item.tags = ['legal','trade','history','precision','power','home','industry','construction','sound','truth','business'];
  item.durability = 3;
  item.maxDurability = 3;
  state.inventory.push(item);
  return { state, pet, item };
}

test('the public work board rotates authored orders by day without a hidden roll', () => {
  const state = createInitialState();
  assert.equal(NEIGHBORHOOD_WORKS.orders.length,3);
  assert.equal(NEIGHBORHOOD_WORKS.approaches.length,2);
  assert.equal(NEIGHBORHOOD_WORKS.pressureBands.length,3);
  assert.equal(availableWorkOrder(state).id,'root-vote-payroll');
  state.day = 2;
  assert.equal(availableWorkOrder(state).id,'parcel-spine-jig');
  state.day = 3;
  assert.equal(availableWorkOrder(state).id,'invoice-hushers');
  assert.ok(NEIGHBORHOOD_WORKS.orders.every(order => !('random' in order) && !('weight' in order)));
  assert.equal(neighborhoodWorkProfile(state).rotationRule,'(day - 1) modulo 3 base orders; Hushglass due state can publish one declared override');
});

test('pet labor counts only literal matching species and trait tags', () => {
  const { state, pet } = workReadyState(1);
  pet.traits.push({ ...PET_TRAITS.find(trait => trait.id === 'weatherproof') });
  const profile = workPetProfile(state,'root-vote-payroll');
  assert.deepEqual(profile.speciesMatches,['legal']);
  assert.deepEqual(profile.traitMatches.map(match => match.id),['sniffer','jealous']);
  assert.equal(profile.laborPoints,5);
  assert.equal(profile.reasons.some(reason => /Weatherproof/.test(reason)),false);
});

test('work quote discloses exact tool, pet, supplier, pressure, and approach arithmetic', () => {
  const { state, item } = workReadyState(1);
  state.district.supplier.standing = 2;
  const quote = workOrderQuote(state,'root-vote-payroll',item.id,'share-the-shift');
  assert.equal(quote.ok,true);
  assert.equal(quote.toolMatches.length,6);
  assert.equal(quote.toolContribution,12);
  assert.equal(quote.petProfile.laborPoints,5);
  assert.equal(quote.petContribution,25);
  assert.equal(quote.ratingContribution,1);
  assert.equal(quote.subtotal,64);
  assert.deepEqual(quote.factors,{ supplier:1.06, competitorPressure:1, approach:1 });
  assert.equal(quote.wage,68);
  assert.equal(quote.random,false);
});

test('starting paid work freezes a non-random quote and spends the selected tool once', () => {
  const { state, pet, item } = workReadyState(1);
  const rarityTotal = SYSTEM_CONSTANTS.rarityWeightTotal;
  const result = startWorkOrder(state,'root-vote-payroll',item.id,'share-the-shift');
  assert.equal(result.ok,true);
  assert.equal(result.receipt.schema,'small-odds.work-order-start/v1');
  assert.equal(result.receipt.random,false);
  assert.equal(result.receipt.portalOddsChanged,false);
  assert.equal(result.receipt.pet.id,pet.id);
  assert.equal(result.receipt.pet.laborPoints,5);
  assert.equal(result.receipt.tool.durabilityBefore,3);
  assert.equal(result.receipt.tool.durabilityAfter,2);
  assert.equal(state.work.active.dueDay,2);
  assert.equal(state.stats.workOrdersStarted,1);
  assert.equal(SYSTEM_CONSTANTS.rarityWeightTotal,rarityTotal);
});

test('a cooperative work return resolves once across pay, pet, Lane, business, supplier, and home', () => {
  const { state, pet, item } = workReadyState(1);
  const started = startWorkOrder(state,'root-vote-payroll',item.id,'share-the-shift');
  const moneyBefore = state.money;
  state.day = started.receipt.dueDay;
  const first = resolveWorkReturns(state);
  const second = resolveWorkReturns(state);
  assert.equal(first.length,1);
  assert.equal(second.length,0);
  assert.equal(first[0].receipt.schema,'small-odds.work-order-return/v1');
  assert.equal(first[0].receipt.random,false);
  assert.equal(first[0].receipt.portalOddsChanged,false);
  assert.equal(state.money,moneyBefore + started.receipt.arithmetic.wage);
  assert.equal(state.work.standing,2);
  assert.equal(state.work.pressure,0);
  assert.equal(state.district.supplier.standing,1);
  assert.equal(state.business.rating,2);
  assert.equal(state.relationships.tavi,1);
  assert.equal(state.home.score,1);
  assert.equal(pet.affection,3);
  assert.equal(state.district.houseMarks[0].visual,'workbench-stamp');
  assert.equal(state.stats.workOrdersCompleted,1);
});

test('rush work pays its published premium and raises rivalry pressure', () => {
  const { state, item } = workReadyState(1);
  const share = workOrderQuote(state,'root-vote-payroll',item.id,'share-the-shift');
  const rush = workOrderQuote(state,'root-vote-payroll',item.id,'beat-the-table');
  assert.ok(rush.wage > share.wage);
  const started = startWorkOrder(state,'root-vote-payroll',item.id,'beat-the-table');
  state.day = started.receipt.dueDay;
  resolveWorkReturns(state);
  assert.equal(state.work.standing,1);
  assert.equal(state.work.pressure,2);
  assert.equal(neighborhoodWorkProfile(state).pressureState,'watching');
  assert.equal(neighborhoodWorkProfile(state).pressureWageFactor,.96);
  assert.equal(state.district.supplier.standing,-1);
  assert.equal(state.business.rating,3);
  assert.equal(state.home.score,0);
});

test('paid-work standing unlocks one deterministic employment route in an existing Life Thread', () => {
  const { state } = workReadyState(3);
  state.location = 'market';
  state.life.active = [{ id:'life-work-test', definitionId:'oracle-memory-price', location:'market', actor:'vendor', openedDay:3, expiresDay:5, worldEventId:'ordinary-day', random:false }];
  assert.equal(lifeThreadChoices(state,'life-work-test').some(choice => choice.id === 'file-memory-as-training'),false);
  state.work.standing = 2;
  state.work.pressure = 2;
  const route = lifeThreadChoices(state,'life-work-test').find(choice => choice.id === 'file-memory-as-training');
  assert.equal(route.workRoute.employerName,NEIGHBORHOOD_WORKS.name);
  assert.equal(route.workRoute.minimumStanding,2);
  const result = resolveLifeThread(state,'life-work-test',route.id);
  assert.equal(result.ok,true);
  assert.equal(result.receipt.random,false);
  assert.equal(result.receipt.portalOddsChanged,false);
  assert.equal(result.receipt.workRoute.standingBefore,2);
  assert.equal(result.receipt.workRoute.standingAfter,3);
  assert.equal(result.receipt.workRoute.pressureBefore,2);
  assert.equal(result.receipt.workRoute.pressureAfter,1);
  assert.equal(state.stats.workLifeRoutes,1);
});

test('version-six saves gain neutral employment continuity without fabricated work', () => {
  const old = createInitialState('Before the Long Table');
  old.version = 6;
  delete old.work;
  delete old.stats.workOrdersStarted;
  delete old.stats.workOrdersCompleted;
  delete old.stats.workLifeRoutes;
  const migrated = migrateState(old);
  assert.equal(migrated.version,GAME_VERSION);
  assert.equal(migrated.work.employerId,NEIGHBORHOOD_WORKS.id);
  assert.equal(migrated.work.standing,0);
  assert.equal(migrated.work.pressure,0);
  assert.equal(migrated.work.active,null);
  assert.deepEqual(migrated.work.history,[]);
  assert.equal(migrated.stats.workOrdersStarted,0);
  assert.equal(migrated.stats.workOrdersCompleted,0);
  assert.equal(migrated.stats.workLifeRoutes,0);
});

function householdReadyState() {
  const ready = workReadyState(4);
  const { state } = ready;
  state.day = 4;
  state.hour = 10;
  state.location = 'district';
  state.world.locations.push('district');
  state.player.energy = 100;
  state.district.supplier.standing = 4;
  state.work.standing = 2;
  state.work.pressure = 0;
  state.relationships.oola = 0;
  state.life.active = [{ id:'life-hushglass-test', definitionId:'hushglass-heat-hearing', location:'district', actor:'sumi', openedDay:4, openedHour:10, expiresDay:6, worldEventId:'ordinary-day', random:false }];
  return ready;
}

test('Hushglass is a four-band authored household with no random route weights', () => {
  const thread = LIFE_THREADS.find(candidate => candidate.id === 'hushglass-heat-hearing');
  assert.equal(NEIGHBORHOOD_COMMONS.bands.length,4);
  assert.equal(NEIGHBORHOOD_COMMONS.id,'hushglass-house');
  assert.equal(thread.householdId,NEIGHBORHOOD_COMMONS.id);
  assert.ok(thread.supplierChoice);
  assert.ok(thread.workChoice);
  assert.ok(thread.neighborChoice);
  assert.ok(thread.petChoice);
  assert.ok(thread.choices.some(choice => choice.itemTags?.includes('power')));
  assert.equal(JSON.stringify(thread).includes('"random"'),false);
  assert.equal(JSON.stringify(thread).includes('"weight"'),false);
  assert.equal(SYSTEM_CONSTANTS.neighborhoodHouseholds,2);
  assert.equal(SYSTEM_CONSTANTS.neighborhoodCommonsBands,4);
});

test('Hushglass warmth selects public resident schedule overrides at exact bands', () => {
  const state = createInitialState();
  let household = districtHouseholdProfile(state);
  assert.equal(household.state,'rationing');
  assert.equal(districtResidentsNow(state).some(resident => resident.scheduleSource.startsWith('household-state:')),false);
  state.district.households[NEIGHBORHOOD_COMMONS.id].warmth = 4;
  household = districtHouseholdProfile(state);
  assert.equal(household.state,'shared');
  const oola = districtResidentsNow(state).find(resident => resident.id === 'oola');
  assert.equal(oola.scheduleSource,'household-state:shared');
  assert.equal(oola.current.zone,'warm-parcel-stop');
  state.district.households[NEIGHBORHOOD_COMMONS.id].warmth = -1;
  assert.equal(districtResidentsNow(state).find(resident => resident.id === 'tavi').scheduleSource,'household-state:cold');
});

test('Hushglass special routes unlock only from their published saved-world prerequisites', () => {
  const { state } = householdReadyState();
  const ids = () => lifeThreadChoices(state,'life-hushglass-test').map(choice => choice.id);
  assert.ok(ids().includes('borrow-kettle-steam'));
  assert.ok(ids().includes('commission-shared-duct'));
  assert.ok(ids().includes('pet-audit-heat-share'));
  assert.equal(ids().includes('ask-oola-warm-parcel'),false);
  state.relationships.oola = 3;
  assert.ok(ids().includes('ask-oola-warm-parcel'));
  state.work.pressure = 5;
  assert.equal(ids().includes('commission-shared-duct'),false);
  state.district.supplier.standing = 1;
  assert.equal(ids().includes('borrow-kettle-steam'),false);
});

test('household pet evidence counts literal matching species and named traits only', () => {
  const { state, pet } = householdReadyState();
  pet.traits.push({ ...PET_TRAITS.find(trait => trait.id === 'weatherproof') });
  const profile = householdPetProfile(state);
  assert.deepEqual(profile.speciesMatches,['legal']);
  assert.deepEqual(profile.traitMatches.map(match => match.id),['sniffer','jealous']);
  assert.equal(profile.laborPoints,5);
  assert.equal(profile.reasons.some(reason => /Weatherproof/.test(reason)),false);
});

test('the pet heat-audit route records exact immediate household, supplier, work, and pet deltas', () => {
  const { state, pet } = householdReadyState();
  const portalBefore = state.portal.charges;
  const result = resolveLifeThread(state,'life-hushglass-test','pet-audit-heat-share');
  assert.equal(result.ok,true);
  assert.equal(result.receipt.schema,'small-odds.life-choice/v1');
  assert.equal(result.receipt.random,false);
  assert.equal(result.receipt.portalOddsChanged,false);
  assert.equal(result.receipt.householdRoute.routeKind,'pet');
  assert.deepEqual(result.receipt.householdRoute.warmth,{ before:0, requestedDelta:2, delta:2, after:2 });
  assert.deepEqual(result.receipt.householdRoute.trust,{ before:0, requestedDelta:3, delta:3, after:3 });
  assert.equal(result.receipt.petRoute.laborPoints,5);
  assert.deepEqual(result.receipt.petRoute.supplier,{ before:4, requestedDelta:1, delta:1, after:5, stateBefore:'stocked', stateAfter:'flourishing' });
  assert.equal(result.receipt.petRoute.workPressure.delta,0);
  assert.equal(pet.affection,3);
  assert.equal(state.district.households[NEIGHBORHOOD_COMMONS.id].agreements,1);
  assert.equal(state.stats.householdLifeChoices,1);
  assert.equal(state.stats.petHouseholdRoutes,1);
  assert.equal(state.portal.charges,portalBefore);
});

test('the Hushglass accord return resolves exactly once across every named system', () => {
  const { state } = householdReadyState();
  const choice = resolveLifeThread(state,'life-hushglass-test','pet-audit-heat-share');
  const scheduled = state.life.scheduled[0];
  const businessBefore = state.business.rating;
  const homeBefore = state.home.score;
  state.day = scheduled.dueDay;
  const first = resolveDueLifeConsequences(state);
  const second = resolveDueLifeConsequences(state);
  assert.equal(first.length,1);
  assert.equal(second.length,0);
  const receipt = first[0].receipt;
  assert.equal(receipt.schema,'small-odds.household-accord-return/v1');
  assert.equal(receipt.random,false);
  assert.equal(receipt.portalOddsChanged,false);
  assert.deepEqual(receipt.portal,{ chargesBefore:state.portal.charges, chargesAfter:state.portal.charges, oddsChanged:false });
  assert.equal(receipt.householdRoute.warmth.before,2);
  assert.equal(receipt.householdRoute.warmth.after,4);
  assert.equal(receipt.householdRoute.stateAfter,'shared');
  assert.equal(state.district.supplier.standing,6);
  assert.equal(state.work.standing,3);
  assert.equal(state.work.pressure,0);
  assert.equal(state.business.rating,businessBefore + 1);
  assert.equal(state.home.score,homeBefore + 2);
  assert.equal(state.relationships.oola,1);
  assert.equal(state.district.houseMarks[0].visual,'heat-share-mobile');
  assert.equal(state.district.households[NEIGHBORHOOD_COMMONS.id].lastReceipt.schema,'small-odds.household-accord-return/v1');
  assert.equal(state.stats.householdReturns,1);
  assert.equal(state.life.scheduled.length,0);
  assert.equal(districtResidentsNow(state).find(resident => resident.id === 'oola').scheduleSource,'household-state:shared');
  assert.equal(choice.receipt.delayedDueDay,scheduled.dueDay);
});

test('an unattended Hushglass hearing changes persistent warmth without fabricating randomness', () => {
  const { state } = householdReadyState();
  state.day = 7;
  state.life.lastSpawnDay = 7;
  const result = syncLifeThreads(state);
  assert.equal(result.expired.length,1);
  assert.equal(districtHouseholdProfile(state).warmth,-1);
  assert.equal(districtHouseholdProfile(state).state,'cold');
  assert.equal(state.district.households[NEIGHBORHOOD_COMMONS.id].lastReceipt.schema,'small-odds.household-unattended/v1');
  assert.equal(state.district.households[NEIGHBORHOOD_COMMONS.id].lastReceipt.random,false);
});

test('version-seven saves gain neutral Hushglass continuity without invented history', () => {
  const old = createInitialState('Before Hushglass');
  old.version = 7;
  delete old.district.households;
  delete old.relationships.sumi;
  delete old.stats.householdLifeChoices;
  delete old.stats.householdReturns;
  delete old.stats.supplierHouseholdRoutes;
  delete old.stats.petHouseholdRoutes;
  const migrated = migrateState(old);
  assert.equal(migrated.version,GAME_VERSION);
  assert.deepEqual(migrated.district.households[NEIGHBORHOOD_COMMONS.id],{ id:NEIGHBORHOOD_COMMONS.id, warmth:0, trust:0, agreements:0, maintenance:{ integrity:0, nextDueDay:null, active:null, cycles:0, overdueCycles:0, lastOverdueDueDay:null, participantPetIds:[], governance:{ modelId:null, selectedDay:null, selectedCycle:null, reviewDueCycle:null, history:[], lastReceipt:null }, fault:null, faultHistory:[], history:[], sequence:1, lastReceipt:null }, history:[], lastReceipt:null });
  assert.equal(migrated.relationships.sumi,0);
  assert.equal(migrated.stats.householdLifeChoices,0);
  assert.equal(migrated.stats.householdReturns,0);
  assert.equal(migrated.stats.supplierHouseholdRoutes,0);
  assert.equal(migrated.stats.petHouseholdRoutes,0);
});

function maintenanceReadyState() {
  const ready = householdReadyState();
  const { state } = ready;
  const chosen = resolveLifeThread(state,'life-hushglass-test','pet-audit-heat-share');
  state.day = chosen.receipt.delayedDueDay;
  resolveDueLifeConsequences(state);
  state.day = state.district.households[NEIGHBORHOOD_COMMONS.id].maintenance.nextDueDay;
  state.hour = 10;
  state.player.energy = 100;
  return ready;
}

test('the saved accord opens a recurring four-band maintenance cycle and a real work-board override', () => {
  const { state, pet } = maintenanceReadyState();
  const profile = commonsMaintenanceProfile(state);
  const options = commonsMaintenanceOptions(state);
  assert.equal(profile.configured,true);
  assert.equal(profile.accordEvidence,true);
  assert.equal(profile.integrity,2);
  assert.equal(profile.integrityState,'patched');
  assert.equal(profile.due,true);
  assert.equal(profile.scheduleState,'due');
  assert.equal(options.routes.find(route => route.id === 'public-rota').open,true);
  assert.equal(options.routes.find(route => route.id === 'returning-pet').open,true);
  assert.equal(options.pet.pet.id,pet.id);
  assert.equal(options.pet.previouslyParticipated,true);
  assert.equal(options.pet.laborPoints,5);
  assert.equal(options.routes.find(route => route.id === 'retained-relay').open,false);
  assert.equal(districtResidentsNow(state).find(resident => resident.id === 'oola').scheduleSource,'commons-maintenance:due');
  assert.equal(availableWorkOrder(state).id,'hushglass-night-valve-jig');
  assert.equal(neighborhoodWorkProfile(state).rotationRule,'Hushglass due-day override; otherwise (day - 1) modulo 3 base orders');
  assert.equal(JSON.stringify(NEIGHBORHOOD_COMMONS.maintenance).includes('"random"'),false);
  assert.equal(JSON.stringify(NEIGHBORHOOD_COMMONS.maintenance).includes('"weight"'),false);
  assert.equal(SYSTEM_CONSTANTS.neighborhoodCommonsMaintenanceBands,4);
  assert.equal(SYSTEM_CONSTANTS.neighborhoodCommonsMaintenanceRoutes,3);
  assert.equal(SYSTEM_CONSTANTS.neighborhoodWorkOrders,4);
});

test('retained store equipment opens a distinct ownership-preserving maintenance route with exact return', () => {
  const { state, item } = maintenanceReadyState();
  state.inventory = state.inventory.filter(candidate => candidate.id !== item.id);
  state.business.assets.push(item);
  const assets = commonsMaintenanceAssets(state);
  assert.equal(assets.length,1);
  assert.equal(assets[0].source,'store-equipment');
  const option = commonsMaintenanceOptions(state).routes.find(route => route.id === 'retained-relay');
  assert.equal(option.open,true);
  const portalBefore = state.portal.charges;
  const started = startCommonsMaintenance(state,'retained-relay',item.id);
  assert.equal(started.ok,true);
  assert.equal(started.receipt.schema,'small-odds.commons-maintenance-start/v1');
  assert.equal(started.receipt.asset.ownershipRetained,true);
  assert.equal(state.business.assets.some(asset => asset.id === item.id),true);
  assert.equal(state.stats.commonsAssetRoutes,1);
  state.day = started.receipt.dueDay;
  const first = resolveCommonsMaintenanceReturns(state);
  const second = resolveCommonsMaintenanceReturns(state);
  assert.equal(first.length,1);
  assert.equal(second.length,0);
  const receipt = first[0].receipt;
  assert.equal(receipt.schema,'small-odds.commons-maintenance-return/v1');
  assert.equal(receipt.random,false);
  assert.equal(receipt.asset.id,item.id);
  assert.equal(receipt.integrity.before,2);
  assert.equal(receipt.integrity.after,5);
  assert.equal(receipt.cycles.after,1);
  assert.equal(receipt.applied.workPressure.delta,1);
  assert.equal(receipt.applied.businessRating.delta,2);
  assert.equal(receipt.applied.home.delta,2);
  assert.equal(state.district.houseMarks[0].visual,'shop-relay-window');
  assert.equal(state.portal.charges,portalBefore);
  assert.equal(state.stats.commonsMaintenanceReturns,1);
});

test('the original Hushglass pet can return through literal saved evidence and gains an exact repeat receipt', () => {
  const { state, pet } = maintenanceReadyState();
  const affectionBefore = pet.affection;
  const started = startCommonsMaintenance(state,'returning-pet');
  assert.equal(started.ok,true);
  assert.equal(started.receipt.pet.id,pet.id);
  assert.equal(started.receipt.pet.previouslyParticipated,true);
  assert.equal(started.receipt.pet.laborPoints,5);
  assert.equal(started.receipt.pet.reasons.some(reason => /Weatherproof/.test(reason)),false);
  assert.equal(state.stats.commonsReturningPetRoutes,1);
  state.day = started.receipt.dueDay;
  const [returned] = resolveCommonsMaintenanceReturns(state);
  assert.equal(returned.receipt.pet.before,affectionBefore);
  assert.equal(returned.receipt.pet.after,affectionBefore + 1);
  assert.equal(returned.receipt.integrity.after,4);
  assert.equal(returned.receipt.householdRoute.trust.delta,2);
  assert.equal(returned.receipt.applied.supplier.delta,1);
  assert.equal(returned.receipt.applied.workStanding.delta,1);
  assert.equal(state.district.houseMarks[0].visual,'pet-valve-seal');
});

test('the Hushglass due state can be resolved through the Long Table paid-work conflict exactly once', () => {
  const { state, item } = maintenanceReadyState();
  const order = availableWorkOrder(state);
  assert.equal(order.commonsConflict,true);
  const quote = workOrderQuote(state,order.id,item.id,'share-the-shift');
  assert.equal(quote.ok,true);
  const started = startWorkOrder(state,order.id,item.id,'share-the-shift');
  assert.equal(started.ok,true);
  assert.equal(started.receipt.calendar.hushglassOverride,true);
  assert.equal(state.district.households[NEIGHBORHOOD_COMMONS.id].maintenance.active.routeId,'long-table-contract');
  assert.equal(state.stats.commonsWorkConflicts,1);
  state.day = started.receipt.dueDay;
  const first = resolveWorkReturns(state);
  const second = resolveWorkReturns(state);
  assert.equal(first.length,1);
  assert.equal(second.length,0);
  const receipt = first[0].receipt;
  assert.equal(receipt.commonsMaintenance.routeId,'long-table-contract');
  assert.equal(receipt.commonsMaintenance.integrity.before,2);
  assert.equal(receipt.commonsMaintenance.integrity.after,5);
  assert.equal(receipt.commonsMaintenance.householdRoute.trust.delta,1);
  assert.equal(receipt.commonsMaintenance.nextDueDay,state.day + NEIGHBORHOOD_COMMONS.maintenance.intervalDays);
  assert.equal(state.district.households[NEIGHBORHOOD_COMMONS.id].maintenance.active,null);
  assert.equal(state.district.houseMarks[0].visual,'shared-contract-stencil');
  assert.equal(state.stats.commonsMaintenanceReturns,1);
});

test('an overdue maintenance day applies one authored deterioration receipt and stays repairable', () => {
  const { state } = maintenanceReadyState();
  const dueDay = commonsMaintenanceProfile(state).nextDueDay;
  state.day = dueDay + NEIGHBORHOOD_COMMONS.maintenance.graceDays + 1;
  const before = commonsMaintenanceProfile(state);
  const first = resolveCommonsMaintenanceOverdue(state);
  const second = resolveCommonsMaintenanceOverdue(state);
  assert.ok(first);
  assert.equal(second,null);
  assert.equal(first.receipt.schema,'small-odds.commons-maintenance-overdue/v1');
  assert.equal(first.receipt.appliedExactlyOnceForDueDay,dueDay);
  assert.equal(first.receipt.integrity.after,before.integrity - 1);
  assert.equal(first.receipt.householdRoute.warmth.delta,-1);
  assert.equal(first.receipt.householdRoute.trust.delta,-1);
  assert.equal(first.receipt.workPressure.delta,1);
  assert.equal(commonsMaintenanceProfile(state).overdue,true);
  assert.equal(state.stats.commonsMaintenanceOverdues,1);
});

test('version-eight saves derive first maintenance eligibility only from real accord evidence', () => {
  const old = createInitialState('Before recurring service');
  old.version = 8;
  old.day = 25;
  const household = old.district.households[NEIGHBORHOOD_COMMONS.id];
  household.warmth = 4;
  household.trust = 4;
  household.agreements = 1;
  household.history = [{ day:25, hour:0, kind:'return', receipt:{ schema:'small-odds.household-accord-return/v1', petRoute:{ petId:'pet-ledger' } } }];
  delete household.maintenance;
  delete old.stats.commonsMaintenanceStarts;
  delete old.stats.commonsMaintenanceReturns;
  delete old.stats.commonsMaintenanceOverdues;
  delete old.stats.commonsWorkConflicts;
  delete old.stats.commonsAssetRoutes;
  delete old.stats.commonsReturningPetRoutes;
  const migrated = migrateState(old);
  const maintenance = migrated.district.households[NEIGHBORHOOD_COMMONS.id].maintenance;
  assert.equal(migrated.version,GAME_VERSION);
  assert.equal(maintenance.integrity,2);
  assert.equal(maintenance.nextDueDay,25);
  assert.equal(maintenance.cycles,0);
  assert.deepEqual(maintenance.history,[]);
  assert.deepEqual(maintenance.participantPetIds,['pet-ledger']);
  assert.equal(migrated.stats.commonsMaintenanceStarts,0);
  assert.equal(migrated.stats.commonsMaintenanceReturns,0);
  assert.equal(commonsMaintenanceProfile(migrated).configured,true);
  assert.equal(commonsMaintenanceProfile(migrated).due,true);
});

function governanceReadyState(firstRoute = 'returning-pet') {
  const ready = maintenanceReadyState();
  const { state, item } = ready;
  let started;
  if (firstRoute === 'retained-relay') {
    state.inventory = state.inventory.filter(candidate => candidate.id !== item.id);
    state.business.assets.push(item);
    started = startCommonsMaintenance(state,'retained-relay',item.id);
  } else if (firstRoute === 'long-table-contract') {
    item.durability = 5;
    started = startWorkOrder(state,availableWorkOrder(state).id,item.id,'share-the-shift');
  } else {
    started = startCommonsMaintenance(state,'returning-pet');
  }
  assert.equal(started.ok,true);
  state.day = started.receipt.dueDay;
  if (firstRoute === 'long-table-contract') resolveWorkReturns(state);
  else resolveCommonsMaintenanceReturns(state);
  state.day = state.district.households[NEIGHBORHOOD_COMMONS.id].maintenance.nextDueDay;
  state.hour = 10;
  state.player.energy = 100;
  activateCommonsMaintenanceFault(state);
  return ready;
}

test('the second due cycle freezes a deterministic fault from actual route history and holds service for ownership', () => {
  const { state, pet } = governanceReadyState('returning-pet');
  const profile = commonsMaintenanceProfile(state);
  const options = commonsMaintenanceOptions(state);
  const governance = commonsGovernanceOptions(state);
  assert.equal(profile.cycles,1);
  assert.equal(profile.fault.definitionId,'signature-drift');
  assert.equal(profile.fault.causeEvidence.routeId,'returning-pet');
  assert.equal(profile.fault.causeEvidence.petId,pet.id);
  assert.equal(profile.fault.activationReceipt.selectionRule,'retained relay > returning named pet > Long Table route or pressure 2+ > public date-fog fallback');
  assert.equal(profile.governanceRequired,true);
  assert.equal(profile.conflictOrderActive,false);
  assert.equal(options.routes.every(route => route.open === false),true);
  assert.equal(options.routes[0].reason,'Choose who owns the public obligation before selecting a service route.');
  assert.notEqual(availableWorkOrder(state).id,'hushglass-night-valve-jig');
  assert.equal(governance.models.length,3);
  assert.equal(governance.models.find(model => model.id === 'communal-charter').open,true);
  assert.equal(activateCommonsMaintenanceFault(state).id,profile.fault.id);
  assert.equal(state.stats.commonsFaultsActivated,1);
  assert.equal(JSON.stringify(NEIGHBORHOOD_COMMONS.maintenance.governance).includes('random'),false);
  assert.equal(JSON.stringify(NEIGHBORHOOD_COMMONS.maintenance.faults).includes('weight'),false);
  assert.equal(SYSTEM_CONSTANTS.neighborhoodCommonsGovernanceModels,3);
  assert.equal(SYSTEM_CONSTANTS.neighborhoodCommonsFaults,4);
});

test('all three ownership models expose exact eligibility, rights, obligations, and immediate receipts', () => {
  const communal = governanceReadyState();
  communal.state.district.households[NEIGHBORHOOD_COMMONS.id].trust = 4;
  communal.state.business.rating = 9;
  communal.state.district.supplier.standing = 5;
  communal.state.work.standing = 2;
  let options = commonsGovernanceOptions(communal.state);
  assert.equal(options.models.find(model => model.id === 'household-trust').open,false);
  assert.deepEqual(options.models.find(model => model.id === 'service-cooperative').unmet,['store rating 9/10','Kettle standing 5/6','Long Table standing 2/3']);
  const trustBefore = districtHouseholdProfile(communal.state).trust;
  const homeBefore = communal.state.home.score;
  const chosenCommunal = chooseCommonsGovernance(communal.state,'communal-charter');
  assert.equal(chosenCommunal.ok,true);
  assert.equal(chosenCommunal.receipt.schema,'small-odds.commons-governance-choice/v1');
  assert.equal(chosenCommunal.receipt.random,false);
  assert.equal(chosenCommunal.receipt.activeFault.definitionId,'signature-drift');
  assert.equal(chosenCommunal.receipt.householdRoute.trust.after,trustBefore + 1);
  assert.equal(chosenCommunal.receipt.applied.home.after,homeBefore + 1);
  assert.equal(chosenCommunal.receipt.rights.length,2);
  assert.equal(chosenCommunal.receipt.obligations.length,2);
  assert.equal(chosenCommunal.receipt.reviewDueCycle,3);
  assert.equal(communal.state.district.houseMarks[0].visual,'common-valve-charter');

  const householdTrust = governanceReadyState();
  householdTrust.state.district.households[NEIGHBORHOOD_COMMONS.id].trust = 5;
  const agreementsBefore = districtHouseholdProfile(householdTrust.state).agreements;
  const sumiBefore = householdTrust.state.relationships.sumi;
  const chosenTrust = chooseCommonsGovernance(householdTrust.state,'household-trust');
  assert.equal(chosenTrust.ok,true);
  assert.equal(chosenTrust.receipt.householdRoute.agreements.after,agreementsBefore + 1);
  assert.equal(chosenTrust.receipt.applied.residentRelationship.after,sumiBefore + 2);
  assert.equal(householdTrust.state.district.houseMarks[0].visual,'hushglass-trust-deed');

  const cooperative = governanceReadyState();
  cooperative.state.business.rating = 10;
  cooperative.state.district.supplier.standing = 6;
  cooperative.state.work.standing = 3;
  options = commonsGovernanceOptions(cooperative.state);
  assert.equal(options.models.find(model => model.id === 'service-cooperative').open,true);
  const chosenCoop = chooseCommonsGovernance(cooperative.state,'service-cooperative');
  assert.equal(chosenCoop.ok,true);
  assert.equal(chosenCoop.receipt.householdRoute.supplier.delta,1);
  assert.equal(chosenCoop.receipt.applied.workStanding.delta,1);
  assert.equal(chosenCoop.receipt.applied.workPressure.delta,1);
  assert.equal(chosenCoop.receipt.applied.businessRating.delta,1);
  assert.equal(cooperative.state.district.houseMarks[0].visual,'service-coop-license');
});

test('a communal charter composes with creature-signature drift and resolves the frozen fault exactly once', () => {
  const { state, pet } = governanceReadyState('returning-pet');
  const affectionBefore = pet.affection;
  assert.equal(chooseCommonsGovernance(state,'communal-charter').ok,true);
  const option = commonsMaintenanceOptions(state).routes.find(route => route.id === 'returning-pet');
  assert.equal(option.open,true);
  assert.equal(option.returnEffect.integrityDelta,3);
  assert.equal(option.returnEffect.warmthDelta,2);
  assert.equal(option.returnEffect.trustDelta,4);
  assert.equal(option.returnEffect.workPressureDelta,-2);
  assert.equal(option.returnEffect.petAffectionGain,2);
  assert.equal(option.effectBreakdown.governance.modelId,'communal-charter');
  assert.equal(option.effectBreakdown.fault.definitionId,'signature-drift');
  const started = startCommonsMaintenance(state,'returning-pet');
  assert.equal(started.ok,true);
  assert.equal(started.receipt.fault.definitionId,'signature-drift');
  assert.deepEqual(started.receipt.promisedReturn,option.returnEffect);
  state.day = started.receipt.dueDay;
  const first = resolveCommonsMaintenanceReturns(state);
  const second = resolveCommonsMaintenanceReturns(state);
  assert.equal(first.length,1);
  assert.equal(second.length,0);
  const receipt = first[0].receipt;
  assert.equal(receipt.faultResolution.definitionId,'signature-drift');
  assert.equal(receipt.integrity.after,7);
  assert.equal(receipt.pet.after,affectionBefore + 2);
  assert.equal(state.district.households[NEIGHBORHOOD_COMMONS.id].maintenance.fault,null);
  assert.equal(state.district.households[NEIGHBORHOOD_COMMONS.id].maintenance.faultHistory.length,1);
  assert.equal(state.stats.commonsFaultsResolved,1);
  assert.equal(state.stats.commonsMaintenanceReturns,2);
});

test('retained relay and Long Table history select different authored faults without reading RNG state', () => {
  const retained = governanceReadyState('retained-relay');
  assert.equal(commonsMaintenanceProfile(retained.state).fault.definitionId,'relay-backfeed');
  retained.state.district.households[NEIGHBORHOOD_COMMONS.id].trust = 5;
  assert.equal(chooseCommonsGovernance(retained.state,'household-trust').ok,true);
  const retainedOption = commonsMaintenanceOptions(retained.state).routes.find(route => route.id === 'retained-relay');
  assert.equal(retainedOption.returnEffect.integrityDelta,4);
  assert.equal(retainedOption.returnEffect.warmthDelta,2);
  assert.equal(retainedOption.returnEffect.trustDelta,2);
  assert.equal(retainedOption.returnEffect.homeGain,4);
  const assetId = retained.state.business.assets[0].id;
  const retainedStart = startCommonsMaintenance(retained.state,'retained-relay',assetId);
  retained.state.day = retainedStart.receipt.dueDay;
  const [retainedReturn] = resolveCommonsMaintenanceReturns(retained.state);
  assert.equal(retainedReturn.receipt.faultResolution.definitionId,'relay-backfeed');
  assert.equal(retained.state.business.assets.some(asset => asset.id === assetId),true);

  const contracted = governanceReadyState('long-table-contract');
  assert.equal(commonsMaintenanceProfile(contracted.state).fault.definitionId,'bid-hammer');
  contracted.state.business.rating = 10;
  contracted.state.district.supplier.standing = 6;
  contracted.state.work.standing = 3;
  assert.equal(chooseCommonsGovernance(contracted.state,'service-cooperative').ok,true);
  const order = availableWorkOrder(contracted.state);
  assert.equal(order.id,'hushglass-night-valve-jig');
  const tool = contracted.state.inventory.find(item => item.tags.some(tag => order.requiredTags.includes(tag)));
  const started = startWorkOrder(contracted.state,order.id,tool.id,'share-the-shift');
  assert.equal(started.ok,true);
  assert.equal(started.receipt.commonsServicePromise.fault.definitionId,'bid-hammer');
  contracted.state.day = started.receipt.dueDay;
  const [returned] = resolveWorkReturns(contracted.state);
  assert.equal(returned.receipt.commonsMaintenance.faultResolution.definitionId,'bid-hammer');
  assert.equal(returned.receipt.commonsMaintenance.effectBreakdown.governance.modelId,'service-cooperative');
  assert.equal(returned.receipt.commonsMaintenance.applied.supplier.delta,2);
  assert.equal(returned.receipt.commonsMaintenance.applied.workStanding.delta,2);
  assert.equal(returned.receipt.commonsMaintenance.applied.businessRating.delta,2);
  assert.equal(contracted.state.stats.commonsFaultsResolved,1);
});

test('governance review opens only after two additional completed cycles', () => {
  const { state } = governanceReadyState();
  assert.equal(chooseCommonsGovernance(state,'communal-charter').ok,true);
  let started = startCommonsMaintenance(state,'public-rota');
  state.day = started.receipt.dueDay;
  resolveCommonsMaintenanceReturns(state);
  state.day = state.district.households[NEIGHBORHOOD_COMMONS.id].maintenance.nextDueDay;
  activateCommonsMaintenanceFault(state);
  assert.equal(commonsMaintenanceProfile(state).cycles,2);
  assert.equal(commonsMaintenanceProfile(state).governanceReviewAvailable,false);
  started = startCommonsMaintenance(state,'public-rota');
  state.day = started.receipt.dueDay;
  resolveCommonsMaintenanceReturns(state);
  state.day = state.district.households[NEIGHBORHOOD_COMMONS.id].maintenance.nextDueDay;
  activateCommonsMaintenanceFault(state);
  assert.equal(commonsMaintenanceProfile(state).cycles,3);
  assert.equal(commonsMaintenanceProfile(state).governanceReviewAvailable,true);
  state.district.households[NEIGHBORHOOD_COMMONS.id].trust = 5;
  const reviewed = chooseCommonsGovernance(state,'household-trust');
  assert.equal(reviewed.ok,true);
  assert.equal(reviewed.receipt.review,true);
  assert.equal(reviewed.receipt.previousModelId,'communal-charter');
  assert.equal(reviewed.receipt.reviewDueCycle,5);
  assert.equal(state.stats.commonsGovernanceReviews,1);
});

test('version-nine saves gain neutral civic continuity without fabricated choices or faults', () => {
  const old = createInitialState('Before civic ownership');
  old.version = 9;
  const maintenance = old.district.households[NEIGHBORHOOD_COMMONS.id].maintenance;
  delete maintenance.governance;
  delete maintenance.fault;
  delete maintenance.faultHistory;
  delete old.stats.commonsGovernanceChoices;
  delete old.stats.commonsGovernanceReviews;
  delete old.stats.commonsFaultsActivated;
  delete old.stats.commonsFaultsResolved;
  const migrated = migrateState(old);
  const migratedMaintenance = migrated.district.households[NEIGHBORHOOD_COMMONS.id].maintenance;
  assert.equal(migrated.version,GAME_VERSION);
  assert.equal(migratedMaintenance.governance.modelId,null);
  assert.deepEqual(migratedMaintenance.governance.history,[]);
  assert.equal(migratedMaintenance.fault,null);
  assert.deepEqual(migratedMaintenance.faultHistory,[]);
  assert.equal(migrated.stats.commonsGovernanceChoices,0);
  assert.equal(migrated.stats.commonsFaultsActivated,0);
});

test('version-ten saves gain neutral debt-aftermath continuity without invented recovery', () => {
  const old = createInitialState('Before aftermath');
  old.version = 10;
  delete old.starspite.aftermath;
  delete old.stats.debtAftermathStarts;
  delete old.stats.debtAftermathReturns;
  delete old.stats.debtSolidarityRoutes;
  delete old.stats.debtWorkRoutes;
  delete old.stats.debtHouseholdRoutes;
  const migrated = migrateState(old);
  assert.equal(migrated.version,GAME_VERSION);
  assert.equal(migrated.starspite.aftermath.active,null);
  assert.deepEqual(migrated.starspite.aftermath.history,[]);
  assert.equal(migrated.stats.debtAftermathStarts,0);
  assert.equal(migrated.stats.debtAftermathReturns,0);
});
