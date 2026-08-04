#!/usr/bin/env node
'use strict';

const assert = require('assert');
const path = require('path');

require(path.join(__dirname, '..', 'runtime', 'game-data.js'));
const D = globalThis.BONK_DATA;
const S = require(path.join(__dirname, '..', 'runtime', 'systems.js'));
let checks = 0;
const ok = (condition, message) => { assert.ok(condition, message); checks += 1; };
const equal = (actual, expected, message) => { assert.deepStrictEqual(actual, expected, message); checks += 1; };

equal(D.classes.length, 3, 'exactly three starting classes');
equal(D.races.length, 2, 'exactly two starting races');
ok(D.races.some(race => race.start === 'Kettlewick'), 'human-side starting position exists');
ok(D.races.some(race => race.start === 'Doodledean'), 'toon-side starting position exists');
ok(D.gear.every(item => item.choice.length === 2 && item.drawback), 'every equipment design exposes two branches and a drawback');
ok(D.gear.every(item => S.GEAR_EFFECTS[item.id]?.length === 2 && S.GEAR_DRAWBACKS[item.id]), 'every equipment branch and drawback has an executable modifier contract');
equal(D.gear.filter(item => item.hybrid).length, 3, 'community-table cooking unlocks three hybrid equipment designs');
ok(D.challenges.every(challenge => challenge.amount > 0 && challenge.where && challenge.text), 'every challenge says count, action and location');
ok(D.quests.every(quest => quest.stages.every(stage => stage.where && stage.target)), 'every adventure stage has an explicit place and machine-readable action');
equal(Object.keys(D.storyChoices).length, 5, 'all five independent adventure threads end in an explicit saved-world decision');
ok(D.quests.every(quest => D.storyChoices[quest.choiceId]?.questId === quest.id), 'every adventure points to its own decision contract');
ok(Object.values(D.storyChoices).every(choice => choice.memoryAt && choice.options.length >= 2 && choice.options.every(option => option.id && option.shortLabel && option.preview && option.consequence && option.memory && option.visual && option.effects)), 'every story branch declares mechanics, preview text and a persistent 3D memory');
ok(D.pets.length >= 6 && D.pets.every(pet => pet.role && pet.want && pet.skill), 'miniature robots have world roles, wants and skills');
ok(D.pets.every(pet => pet.hp > 0 && pet.cooldown > 0 && pet.specialName), 'every miniature has explicit integrity, cooldown and field job');
equal(new Set(D.enemies.map(enemy => enemy.behavior.kind)).size, D.enemies.length, 'every nuisance species owns a different executable comedy behavior');
ok(D.enemies.every(enemy => enemy.behavior.range > 0 && enemy.behavior.cooldown > 0 && enemy.behavior.tell && enemy.defeat), 'every nuisance declares a readable telegraph, cadence and defeat punchline');
equal(D.dropOrigins.length, D.enemies.length, 'every nuisance species owns one authored uncommon-drop origin consequence');
ok(D.dropOrigins.every(origin => D.enemies.some(enemy => enemy.id === origin.enemyId) && origin.at.length === 2 && origin.steward && origin.title && origin.consequence), 'every drop origin names its nuisance, robot steward, exact return site and permanent world change');
equal(new Set(D.dropOrigins.flatMap(origin => Object.keys(origin.effect))).size, D.dropOrigins.length, 'each origin echo changes a different executable world rule instead of repeating a percentage reward');
equal(D.villageLife.length, 13, 'thirteen ambient citizens extend visible robot-world life into Wobblewoods');
equal(D.cookRivals.length, 3, 'cook-off progression is a finite three-rival ladder');
equal(new Set(D.cookRivals.map(rival => rival.legacy.round)).size, 3, 'each cook rival teaches a different permanent kitchen round');
ok(D.cookRivals.every(rival => rival.rounds.length === 3 && rival.rounds.every(score => score > 0 && score < 1) && rival.win && rival.loss), 'each cook rival exposes three legible scores and comedy outcomes');
equal(new Set(D.villageLife.map(citizen => citizen.region)).size, 5, 'ambient routines cover the four towns plus the Wobblewoods weather archive');
ok(['human','toon','robot'].every(race => D.villageLife.some(citizen => citizen.race === race)), 'Human, Toon and robot citizens coexist in ambient village life');
ok(D.villageLife.every(citizen => citizen.route.length >= 3 && citizen.favor && citizen.thanks && citizen.reward), 'every ambient citizen has a route and explicit tiny favor contract');
equal(D.adventureAftermaths.length, 5, 'each independent adventure has one persistent village-robot witness');
ok(D.adventureAftermaths.every(aftermath => D.villageLife.some(citizen => citizen.id === aftermath.witnessId && citizen.race === 'robot')), 'every aftermath report belongs to a real roaming robot citizen');
ok(D.adventureAftermaths.every(aftermath => { const choice = D.storyChoices[aftermath.choiceId]; return choice?.questId === aftermath.questId && choice.options.every(option => aftermath.outcomes[option.id]?.title && aftermath.outcomes[option.id]?.line); }), 'every permanent story outcome gives its witness a distinct named report');
ok(D.challenges.some(challenge => challenge.id === 'robot-street-news' && challenge.event === 'aftermath' && challenge.amount === 5 && challenge.where.includes('Wobblewoods')), 'all five public reports form one explicit location-readable challenge');
equal(D.adventureEncounters.length, 4, 'four ordinary errands become authored combat set pieces');
equal(new Set(D.adventureEncounters.map(encounter => encounter.kind)).size, 4, 'each authored encounter has a distinct readable rule');
ok(D.adventureEncounters.every(encounter => D.enemies.some(enemy => enemy.id === encounter.enemyId) && D.quests.find(quest => quest.id === encounter.questId)?.stages[encounter.stage]?.target === 'encounter:'+encounter.id), 'every encounter connects a real nuisance species to one explicit quest stage');
const forecastRelay = D.adventureEncounters.find(encounter => encounter.id === 'forecast-relay');
ok(forecastRelay.kind === 'forecast' && forecastRelay.count === 6 && forecastRelay.clearings === 3 && forecastRelay.perClearing === 2 && forecastRelay.objective.includes('exactly 2'), 'the Wobblewoods relay states six bonks as two visible successes in each of three clearings');
ok(D.quests.find(quest => quest.id === 'river-on-strike').stages.some(stage => stage.target === 'cookwin:gossip-chowder'), 'the river adventure requires beating the named cook-off rival rather than merely cooking');
equal(D.encounterRecoveries.length, 4, 'every authored combat set piece owns one cross-town recovery visit');
ok(D.encounterRecoveries.every(recovery => D.adventureEncounters.some(encounter => encounter.id === recovery.encounterId) && D.villageLife.some(citizen => citizen.id === recovery.helperId && citizen.race === 'robot')), 'every recovery uses a real named robot citizen and a real encounter');
equal(new Set(D.encounterRecoveries.map(recovery => recovery.helperTown)).size, 4, 'the four recovery helpers visibly cross from four different towns');
ok(D.encounterRecoveries.every(recovery => recovery.offer && recovery.accepted && Object.keys(recovery.mechanic).length === 1), 'each free recovery explains one distinct mechanical assist before acceptance');
ok(D.encounterRecoveries.find(recovery => recovery.encounterId === 'forecast-relay').mechanic.stormSpeed === 0.62, 'Lux-11 recovery changes only the relay cloud drift rule without reducing its six-bonk objective or reward');
equal(D.gearCouncil.requiredReports, 2, 'the equipment council unlock requirement is explicit and finite');
equal(D.gearCouncil.arguments.length, 4, 'the equipment council offers factory wiring plus three genuinely different robot arguments');
equal(new Set(D.gearCouncil.arguments.map(argument => argument.speaker)).size, 4, 'four named cross-town robot opinions remain individually attributable');
ok(D.gearCouncil.arguments.every(argument => argument.effect && argument.line && argument.color), 'every equipment argument explains its tradeoff and speaker before commitment');

const councilSave = S.newSave({ race: 'toon', classId: 'panzer', seed: 14014, now: 100 });
councilSave.hero.bolts = 17;
const councilItem = S.addGear(councilSave, D.gear.find(gear => gear.id === 'springpan'), () => 0.2).item;
S.equipGear(councilSave, councilItem.uid);
equal(councilItem.argument, 'factory', 'new equipment begins with factory wiring instead of a hidden council modifier');
ok(!S.equipmentCouncilStatus(councilSave, D.gearCouncil).unlocked, 'the physical council starts locked before public robot relationships exist');
equal(S.setGearArgument(councilSave, councilItem.uid, 'quiet', D.gearCouncil).reason, 'locked', 'the council cannot be bypassed from an inventory-only shortcut');
councilSave.world.aftermathReports.alpha = { heard: true, versionsHeard: ['pending'] };
councilSave.world.aftermathReports.beta = { heard: true, versionsHeard: ['choice'] };
ok(S.equipmentCouncilStatus(councilSave, D.gearCouncil).unlocked, 'any two distinct named reports unlock the plainly marked council');
const boltsBeforeCouncil = councilSave.hero.bolts;
ok(S.setGearArgument(councilSave, councilItem.uid, 'quiet', D.gearCouncil).ok, 'Nib-7 can install the quiet bypass');
let councilEffects = S.gearEffects(councilSave);
ok(councilEffects.bonkRadius === 1.25 && councilEffects.powerBonus === 0 && councilEffects.aggroRadius === 1, 'quiet bypass preserves the chosen mechanic while disconnecting raw power and drawback');
ok(S.setGearArgument(councilSave, councilItem.uid, 'heckler', D.gearCouncil).ok, 'Chime-2 can replace the bypass with a heckler overclock');
councilEffects = S.gearEffects(councilSave);
ok(councilEffects.bonkRadius === 1.5625 && councilEffects.powerBonus === 10 && councilEffects.aggroRadius === 1.44, 'heckler overclock applies the branch and drawback twice and adds two raw power');
ok(S.setGearArgument(councilSave, councilItem.uid, 'paradox', D.gearCouncil).ok, 'Lux-11 can install the contradiction harness');
councilEffects = S.gearEffects(councilSave);
ok(councilEffects.bonkRadius === 1.25 && councilEffects.breakfastCrit === 1 && councilEffects.powerBonus === 6 && councilEffects.aggroRadius === 1.44, 'contradiction harness runs both branches, reduces raw power and repeats the drawback');
ok(S.setGearArgument(councilSave, councilItem.uid, 'factory', D.gearCouncil).ok, 'Dock-3 can restore factory wiring without destroying the item');
councilEffects = S.gearEffects(councilSave);
ok(councilEffects.bonkRadius === 1.25 && !councilEffects.breakfastCrit && councilEffects.powerBonus === 8 && councilEffects.aggroRadius === 1.2, 'factory restoration returns the exact selected branch, power and single drawback');
equal(councilSave.hero.bolts, boltsBeforeCouncil, 'every council rewrite is free and leaves ordinary salvage currency untouched');
equal(councilSave.stats.gearArguments, 4, 'only actual wiring changes advance the durable council statistic');
equal(S.setGearArgument(councilSave, councilItem.uid, 'factory', D.gearCouncil).reason, 'unchanged', 'repeating the current argument cannot farm journal or stat progress');
equal(S.setGearArgument(councilSave, councilItem.uid, 'invented', D.gearCouncil).reason, 'invalid', 'unknown equipment arguments are rejected rather than silently normalized during play');
councilItem.argument = 'heckler';

const encounterSave = S.newSave({ race: 'toon', classId: 'pun-slinger', seed: 14014, now: 100 });
equal(encounterSave.world.encounterRecords, {}, 'new saves begin with an explicit authored-encounter ledger');
const hearing = D.adventureEncounters.find(encounter => encounter.id === 'lunch-hearing');
ok(S.beginEncounter(encounterSave, hearing).ok && encounterSave.world.encounterRecords[hearing.id].attempts === 1, 'starting a set piece records an attempt');
S.beginEncounter(encounterSave, hearing);
equal(encounterSave.world.encounterRecords[hearing.id].attempts, 2, 'restarting the visible set piece increments its durable attempt count');
const firstHearingWin = S.winEncounter(encounterSave, hearing);
ok(firstHearingWin.firstWin && firstHearingWin.record.won && firstHearingWin.record.completions === 1, 'first authored-encounter win is distinguished and persisted');
const repeatHearingWin = S.winEncounter(encounterSave, hearing);
ok(!repeatHearingWin.firstWin && repeatHearingWin.record.completions === 2, 'repeat wins remain countable without pretending to be first wins');
equal(encounterSave.journal.filter(entry => entry.text.includes(hearing.title)).length, 1, 'only the first set-piece win creates the systems-level discovery journal entry');

const recoverySave = S.newSave({ race: 'human', classId: 'panzer', seed: 14014, now: 100 });
const hearingRecovery = D.encounterRecoveries.find(recovery => recovery.encounterId === hearing.id);
const ordinaryAttempt = S.beginEncounter(recoverySave, hearing);
ok(ordinaryAttempt.ok && !ordinaryAttempt.assisted, 'a first encounter attempt remains the authored base difficulty');
const firstLoss = S.loseEncounter(recoverySave, hearing, { progress: 2 });
ok(firstLoss.firstLoss && firstLoss.record.losses === 1 && firstLoss.record.lastLossProgress === 2 && firstLoss.record.recoveryAvailable, 'a loss saves progress context and opens a nearby recovery visit');
equal(recoverySave.journal.filter(entry => entry.text.includes('free cross-town recovery')).length, 1, 'the first loss becomes durable story exactly once');
const boltsBeforeRecovery = recoverySave.hero.bolts;
const acceptedRecovery = S.acceptEncounterRecovery(recoverySave, hearing, hearingRecovery);
ok(acceptedRecovery.ok && acceptedRecovery.record.assistReady && !acceptedRecovery.record.recoveryAvailable && acceptedRecovery.record.recoveriesAccepted === 1, 'accepting free help saves the assist and closes only its offer marker');
equal(recoverySave.hero.bolts, boltsBeforeRecovery, 'cross-town recovery never consumes currency');
equal(S.acceptEncounterRecovery(recoverySave, hearing, hearingRecovery).reason, 'already-ready', 'the same saved assist cannot be farmed or stacked');
const assistedAttempt = S.beginEncounter(recoverySave, hearing);
ok(assistedAttempt.assisted && assistedAttempt.record.lastAttemptAssisted, 'the next retry explicitly receives the saved assist');
const assistedLoss = S.loseEncounter(recoverySave, hearing, { progress: 3, assisted: true });
ok(assistedLoss.assisted && assistedLoss.record.assistReady && !assistedLoss.record.recoveryAvailable && assistedLoss.record.losses === 2, 'failing an assisted retry keeps free help active without another chore');
const assistedRetry = S.beginEncounter(recoverySave, hearing);
ok(assistedRetry.assisted, 'free recovery persists through repeated losses until victory');
const assistedWin = S.winEncounter(recoverySave, hearing, { assisted: true });
ok(assistedWin.assisted && assistedWin.record.assistedWins === 1 && !assistedWin.record.assistReady && !assistedWin.record.recoveryAvailable, 'victory records an assisted win and cleanly retires the recovery visit');
ok(!S.beginEncounter(recoverySave, hearing).assisted, 'later replay returns to base rules after the recovery contract is fulfilled');

const aftermathSave = S.newSave({ race: 'human', classId: 'panzer', seed: 14014, now: 100 });
equal(aftermathSave.world.aftermathReports, {}, 'new saves begin with an explicit empty public-memory ledger');
const passportWitness = D.adventureAftermaths.find(aftermath => aftermath.id === 'passport-witness');
ok(!S.aftermathStatus(aftermathSave, passportWitness, D.storyChoices).available, 'a robot cannot spoil an adventure report before its decisive chapter');
aftermathSave.quests['stolen-lunch'] = { stage: 2, progress: 0, complete: false };
const pendingWitness = S.aftermathStatus(aftermathSave, passportWitness, D.storyChoices);
ok(pendingWitness.available && pendingWitness.version === 'pending' && !pendingWitness.heardCurrent, 'winning the decisive chapter exposes a clearly pending witness report');
const firstReport = S.hearAftermath(aftermathSave, passportWitness, D.storyChoices);
ok(firstReport.ok && firstReport.firstReport && firstReport.firstVersion && firstReport.heardCurrent, 'the first robot report becomes a durable heard version');
S.recordChallenge(aftermathSave, 'aftermath', 'witness', 1, D.challenges);
equal(aftermathSave.challenges['robot-street-news'].progress, 1, 'one named witness advances the explicit five-region report challenge once');
const repeatedReport = S.hearAftermath(aftermathSave, passportWitness, D.storyChoices);
ok(repeatedReport.ok && !repeatedReport.firstReport && !repeatedReport.firstVersion, 'revisiting the same report stays available without duplicating progress');
const journalBeforeChoice = aftermathSave.journal.length;
ok(S.applyStoryChoice(aftermathSave, 'lunch', 'citizenship', D.storyChoices).ok, 'the related permanent story choice can update the public report');
const changedWitness = S.aftermathStatus(aftermathSave, passportWitness, D.storyChoices);
ok(changedWitness.version === 'citizenship' && !changedWitness.heardCurrent && changedWitness.line.includes('ingredient passports'), 'the witness visibly has a new outcome-specific version after the choice');
const updatedReport = S.hearAftermath(aftermathSave, passportWitness, D.storyChoices);
ok(updatedReport.firstVersion && !updatedReport.firstReport && updatedReport.report.versionsHeard.includes('pending') && updatedReport.report.versionsHeard.includes('citizenship'), 'updated public memory preserves both witnessed story phases without double-counting the robot');
equal(aftermathSave.journal.length, journalBeforeChoice + 2, 'the choice and its first updated witness version each enter durable journal history');
for (const aftermath of D.adventureAftermaths.filter(entry => entry.id !== 'passport-witness')) {
  aftermathSave.quests[aftermath.questId] = { stage: aftermath.readyStage, progress: 0, complete: false };
  const firstOutcome = D.storyChoices[aftermath.choiceId].options[0];
  S.applyStoryChoice(aftermathSave, aftermath.choiceId, firstOutcome.id, D.storyChoices);
  const report = S.hearAftermath(aftermathSave, aftermath, D.storyChoices);
  if (report.firstReport) S.recordChallenge(aftermathSave, 'aftermath', 'witness', 1, D.challenges);
}
ok(aftermathSave.challenges['robot-street-news'].complete && aftermathSave.challenges['robot-street-news'].progress === 5, 'hearing the five named robots clears the explicit five-region report challenge without repetition');
equal(S.aftermathStatus(aftermathSave, passportWitness, D.storyChoices).reportCount, 5, 'public-memory status exposes exactly five distinct heard robot witnesses');
equal(Object.values(aftermathSave.world.aftermathReports).filter(report => report.heard).length, 5, 'all witnessed adventures remain individually addressable for the finale team');

equal(S.stoneCost(0), 0, 'no stone means no cost');
equal(S.stoneCost(1), 1, 'one held stone costs one');
equal(S.stoneCost(2), 2, 'exactly two held stones both vanish');
equal(S.stoneCost(3), 2, 'three held stones cost only two');
equal(S.stoneCost(27), 2, 'hoarders always lose exactly two');

const human = S.newSave({ race: 'human', classId: 'panzer', seed: 14014, now: 100 });
equal(human.hero.position, { x: -62, z: 18 }, 'human starts in Kettlewick');
const toon = S.newSave({ race: 'toon', classId: 'pun-slinger', seed: 14014, now: 100 });
equal(toon.hero.position, { x: 65, z: 28 }, 'toon starts in Doodledean');

const townSave = S.newSave({ race: 'human', classId: 'panzer', seed: 14014, now: 100 });
const signFavor = D.villageLife.find(citizen => citizen.id === 'kettle-sign');
const favorResult = S.completeVillageFavor(townSave, signFavor);
ok(favorResult.ok && favorResult.villagersHelped === 1, 'a tiny town favor records one helped villager');
equal(townSave.hero.ingredients.sunberry, 1, 'a favor grants its declared useful ingredient instead of generic experience');
equal(S.completeVillageFavor(townSave, signFavor).reason, 'already-helped', 'the same town favor cannot be farmed repeatedly');
equal(townSave.hero.ingredients.sunberry, 1, 'repeat conversation cannot duplicate a favor reward');
const spoonFavor = D.villageLife.find(citizen => citizen.id === 'kettle-spoon');
equal(S.completeVillageFavor(townSave, spoonFavor).reward, '1 bolt', 'bolt-paying citizens use the same saved favor contract');
ok(townSave.world.villageFavors['kettle-sign'] && townSave.world.villageFavors['kettle-spoon'] && townSave.journal.some(entry => entry.text.includes('Tiny town favor')), 'completed favors persist by identity and enter the journal');

const gear = D.gear.find(item => item.id === 'springpan');
const added = S.addGear(human, gear, () => 0.2);
ok(!added.salvaged && human.hero.inventory.length === 1, 'meaningful gear is kept when auto-salvage does not match');
ok(S.equipGear(human, added.item.uid), 'found gear equips');
equal(human.hero.equipment.weapon, added.item.uid, 'equipment slot stores the selected item');
let equippedEffects = S.gearEffects(human);
equal(equippedEffects.bonkRadius, 1.25, 'Springpan radius branch changes the executable combat radius');
equal(equippedEffects.aggroRadius, 1.2, 'Springpan squeak drawback changes executable enemy notice distance');
equal(equippedEffects.powerBonus, 8, 'equipped power contributes to the combat modifier summary');
equal(S.retuneCost(human, added.item.uid), 0, 'Human Second Opinion makes each item first retune free');
const firstRetune = S.retuneGear(human, added.item.uid, D.gear);
ok(firstRetune.ok && firstRetune.cost === 0 && firstRetune.item.branch === 1, 'free first retune actually switches the permanent branch');
equal(S.gearEffects(human).breakfastCrit, 1, 'retuned Springpan activates its every-fifth-attack mechanic');
equal(firstRetune.nextCost, 11, 'repeated manipulation escalates to an explicit bolt cost');
human.hero.bolts = 11;
equal(S.retuneGear(human, added.item.uid, D.gear).cost, 11, 'paid retune consumes the advertised bolt amount');
equal(human.hero.bolts, 0, 'retune currency is actually spent');

const originSave = S.newSave({ race: 'human', classId: 'panzer', seed: 14014, now: 100 });
const paperworkOrigin = D.dropOrigins.find(origin => origin.id === 'paperwork');
const originBolts = originSave.hero.bolts;
const originDrop = S.addGear(originSave, D.gear.find(item => item.id === 'committee-hat'), () => 0.2, { origin: paperworkOrigin, encounterId: 'lunch-hearing' });
ok(originDrop.firstOriginEcho && originDrop.item.origin.source === 'Hostile Paperwork' && originDrop.item.origin.region === 'Kettlewick' && originDrop.item.origin.encounterId === 'lunch-hearing', 'a kept authored-encounter find records species, region and encounter provenance on the item');
ok(S.originEchoStatus(originSave, paperworkOrigin).found && !S.originEchoStatus(originSave, paperworkOrigin).resolved, 'keeping the first find opens one explicit unresolved return journey');
equal(S.originEchoEffects(originSave, D.dropOrigins).formSpeed, 1, 'an unresolved origin echo cannot silently change combat before the return visit');
const resolvedOrigin = S.resolveOriginEcho(originSave, paperworkOrigin);
ok(resolvedOrigin.ok && resolvedOrigin.cost === 0 && S.originEchoEffects(originSave, D.dropOrigins).formSpeed === 0.75, 'Nib-7 settles the remembered form origin for free and activates its exact slower-projectile rule');
equal(originSave.hero.bolts, originBolts, 'settling an origin echo consumes no bolts or item');
equal(S.resolveOriginEcho(originSave, paperworkOrigin).reason, 'already-resolved', 'a resolved echo cannot be farmed for repeated journal or stat progress');
S.salvageGear(originSave, originDrop.item.uid);
ok(S.originEchoStatus(originSave, paperworkOrigin).resolved && S.originEchoEffects(originSave, D.dropOrigins).formSpeed === 0.75, 'the authored world consequence survives later manual salvage instead of holding inventory hostage');
const repeatOrigin = S.addGear(originSave, D.gear.find(item => item.id === 'dramatic-spoon'), () => 0.2, { origin: paperworkOrigin });
ok(!repeatOrigin.firstOriginEcho && Object.keys(originSave.world.originEchoes).length === 1, 'later finds from the same nuisance retain provenance without creating duplicate world chores');
const autoOrigin = S.newSave({ race: 'toon', classId: 'panzer', seed: 14014, now: 100 });
autoOrigin.hero.autoSalvage = 'all-oddities';
const autoDrop = S.addGear(autoOrigin, gear, () => 0.2, { origin: paperworkOrigin });
ok(autoDrop.salvaged && !S.originEchoStatus(autoOrigin, paperworkOrigin).found, 'automatic salvage creates useful bolts but no false kept-item origin echo');
const rolledOrigin = S.newSave({ race: 'toon', classId: 'panzer', seed: 14014, now: 100 });
let rolledDrop = null;
for (let kills = 0; kills < 700 && !rolledDrop; kills += 1) { rolledOrigin.stats.kills = { test: kills }; rolledDrop = S.rollDrop(rolledOrigin, [D.gear.find(item => item.id === 'committee-hat')], 'paperwork', { origin: paperworkOrigin, encounterId: 'lunch-hearing' }); }
ok(rolledDrop?.item.origin.enemyId === 'paperwork' && rolledDrop.item.origin.encounterId === 'lunch-hearing' && rolledDrop.firstOriginEcho, 'the deterministic enemy-drop path carries nuisance and authored-encounter provenance into the kept item and world ledger');
const allOrigins = S.newSave({ race: 'toon', classId: 'panzer', seed: 14014, now: 100 });
D.dropOrigins.forEach(origin => { S.addGear(allOrigins, D.gear.find(item => item.id === 'committee-hat'), () => 0.2, { origin }); S.resolveOriginEcho(allOrigins, origin); });
equal(S.originEchoEffects(allOrigins, D.dropOrigins), { formSpeed: 0.75, heckleWindup: 0.35, moodPuddleDamage: 0.5, robotHijackImmunity: 1, gooseStealCap: 1 }, 'all five robot installations aggregate five distinct bounded nuisance-rule changes');
const paradeSave = S.newSave({ race: 'human', classId: 'panzer', seed: 2030, now: 100 });
equal(S.originParadeStatus(paradeSave, D.dropOrigins), { unlocked: false, count: 0, required: 2, modules: [], next: 2 }, 'the moving museum starts absent and plainly requires two settled origin memories');
paradeSave.world.originEchoes.paperwork = { found: true, resolved: false };
paradeSave.world.originEchoes.hecklecrab = { found: true, resolved: true };
equal(S.originParadeStatus(paradeSave, D.dropOrigins).count, 1, 'merely finding an origin cannot pad the public parade with an unresolved chore');
paradeSave.world.originEchoes.paperwork.resolved = true;
const twoModuleParade = S.originParadeStatus(paradeSave, D.dropOrigins);
ok(twoModuleParade.unlocked && twoModuleParade.count === 2 && twoModuleParade.next === 0, 'two genuinely settled origins unlock one revisitable civic consequence without a reward payment');
equal(twoModuleParade.modules.map(origin => origin.steward), ['Nib-7', 'Chime-2'], 'parade modules retain authored definition order and named robot stewardship');
paradeSave.hero.inventory = [];
equal(S.originParadeStatus(paradeSave, D.dropOrigins).count, 2, 'the moving museum survives empty inventory because settled world history is authoritative');
equal(S.originParadeStatus(allOrigins, D.dropOrigins).count, 5, 'the single parade grows to all five authored origin modules without spawning duplicate chores');
const dayRouteStart = S.originParadeRoute(720, 0), dayRouteHalf = S.originParadeRoute(720, 80);
ok(dayRouteStart.mode === 'parade' && dayRouteHalf.mode === 'parade' && dayRouteStart.x !== dayRouteHalf.x && Math.abs(dayRouteStart.x) <= 18 && dayRouteStart.z >= 10 && dayRouteStart.z <= 34, 'daytime parade follows a deterministic bounded meadow loop');
equal(S.originParadeRoute(1320, 0), S.originParadeRoute(1320, 999), 'nighttime parade parks at one deterministic visible civic site regardless of elapsed play');
equal(S.originParadeRoute(-120, 20).mode, 'parked', 'world-minute normalization keeps wrapped nighttime saves parked');
const paradeSnapshot = JSON.stringify(paradeSave);
S.originParadeStatus(paradeSave, D.dropOrigins);
equal(JSON.stringify(paradeSave), paradeSnapshot, 'derived parade status never mutates the save or invents progression');

const toonWorkshop = S.newSave({ race: 'toon', classId: 'panzer', seed: 5 });
const toonPan = S.addGear(toonWorkshop, gear, () => 0.2).item;
equal(S.retuneCost(toonWorkshop, toonPan.uid), 8, 'non-Human first retune uses the ordinary workshop price');
equal(S.retuneGear(toonWorkshop, toonPan.uid, D.gear).reason, 'bolts', 'retune refuses to fabricate missing currency');

const discountWorkshop = S.newSave({ race: 'toon', classId: 'panzer', seed: 6 });
const discountPan = S.addGear(discountWorkshop, gear, () => 0.2).item;
const taxDiscount = S.addGear(discountWorkshop, D.gear.find(item => item.id === 'tax-trousers'), () => 0.8).item;
S.equipGear(discountWorkshop, taxDiscount.uid);
equal(S.retuneCost(discountWorkshop, discountPan.uid), 5, 'Tax-Evasion retune branch subtracts three real bolts from workshop cost');

const salvageWorkshop = S.newSave({ race: 'toon', classId: 'panzer', seed: 7 });
const taxSalvage = S.addGear(salvageWorkshop, D.gear.find(item => item.id === 'tax-trousers'), () => 0.2).item;
const sparePan = S.addGear(salvageWorkshop, gear, () => 0.2).item;
S.equipGear(salvageWorkshop, taxSalvage.uid);
S.salvageGear(salvageWorkshop, sparePan.uid);
equal(salvageWorkshop.hero.bolts, sparePan.salvage + 1, 'Tax-Evasion salvage branch pays its promised extra bolt');

const dualWorkshop = S.newSave({ race: 'toon', classId: 'panzer', seed: 8 });
const mayor = S.addGear(dualWorkshop, D.gear.find(item => item.id === 'mayor-face'), () => 0.2).item;
S.equipGear(dualWorkshop, mayor.uid);
const dualBread = S.addGear(dualWorkshop, D.gear.find(item => item.id === 'baguette'), () => 0.2).item;
equal(dualBread.branch, 'both', 'Mayor branch makes a future drop contain both mechanical branches');
equal(S.retuneCost(dualWorkshop, dualBread.uid), null, 'dual-branch equipment cannot be downgraded by retuning');
S.equipGear(dualWorkshop, dualBread.uid);
equippedEffects = S.gearEffects(dualWorkshop);
ok(equippedEffects.projectileSpeed === 1.3 && equippedEffects.breadChains === 1, 'dual-branch equipment executes both effects simultaneously');

const spoonWorkshop = S.newSave({ race: 'toon', classId: 'panzer', seed: 10 });
const spoon = S.addGear(spoonWorkshop, D.gear.find(item => item.id === 'dramatic-spoon'), () => 0.8).item;
S.equipGear(spoonWorkshop, spoon.uid);
S.addIngredient(spoonWorkshop, 'sunberry', 1);
S.addIngredient(spoonWorkshop, 'laughing-leek', 1);
equal(S.cook(spoonWorkshop, D.recipes.find(item => item.id === 'sunberry-pie'), 0.82).duration, 75, 'Dramatic Spoon duration branch extends an actual meal to 75 world minutes');

const fabled = S.addGear(human, D.gear.find(item => item.id === 'apology-hammer'), () => 0.2).item;
ok(S.salvageGear(human, fabled.uid).blocked, 'fabled gear refuses manual salvage');

const recipe = D.recipes.find(item => item.id === 'sunberry-pie');
S.addIngredient(human, 'sunberry', 1);
S.addIngredient(human, 'laughing-leek', 1);
const meal = S.cook(human, recipe, 0.82);
ok(meal.ok && meal.duration === 60, 'successful cook-off creates a one-hour world meal');
ok(S.mealActive(human, 'sunberry-pie'), 'cooked world effect is mechanically queryable');
ok(S.requirementMet(human, D.pets.find(pet => pet.id === 'sprig0')), 'world meal satisfies a robot relationship term');

const duelChef = S.newSave({ race: 'toon', classId: 'panzer', seed: 23 });
equal(S.cookLegacy(duelChef, 'chop', D.cookRivals), 1, 'an undefeated rival grants no invisible kitchen bonus');
S.addIngredient(duelChef, 'sunberry', 2);
S.addIngredient(duelChef, 'laughing-leek', 2);
const marmalade = D.cookRivals[0];
const duelWin = S.cook(duelChef, recipe, 0.81, { rival: marmalade, rivalScore: 0.48 });
ok(duelWin.duel.won && duelWin.duel.firstWin && duelWin.duel.legacy.round === 'chop', 'beating a named rival awards its finite permanent lesson once');
equal(S.cookLegacy(duelChef, 'chop', D.cookRivals), 1.08, 'the earned chop lesson widens exactly its declared round');
equal(S.cookLegacy(duelChef, 'stir', D.cookRivals), 1, 'one rival lesson does not silently widen another round');
equal(duelChef.stats.cookWins, 1, 'cook-off victory persists separately from participation');
ok(duelChef.journal.some(entry => entry.text.includes('Mayor Marmalade')), 'first rival victory becomes remembered story rather than an anonymous percentage');
const duelRematch = S.cook(duelChef, recipe, 0.31, { rival: marmalade, rivalScore: 0.48 });
ok(!duelRematch.duel.won && !duelRematch.duel.firstWin && duelChef.world.cookRivals[marmalade.id].won, 'losing a rematch cannot erase or duplicate an earned lesson');
equal(duelChef.world.cookRecords[recipe.id], 0.81, 'recipe record keeps the best skill result instead of rewarding repetitive volume');
equal(duelChef.world.cookRivals[marmalade.id].attempts, 2, 'rival history records bounded attempts without creating an endless level');
const duelStorage = { value: null, setItem(_key, value) { this.value = value; }, getItem() { return this.value; } };
S.saveToStorage(duelChef, duelStorage);
const restoredChef = S.loadFromStorage(duelStorage);
equal(S.cookLegacy(restoredChef, 'chop', D.cookRivals), 1.08, 'earned rival lesson survives an ordinary save round-trip');
equal(restoredChef.world.cookRecords[recipe.id], 0.81, 'skill-based recipe personal best survives reload');

const pond = S.newSave({ race: 'toon', classId: 'pun-slinger', seed: 17 });
S.addIngredient(pond, 'gossip-carp', 2);
const firstRelease = S.releaseFish(pond, 'gossip-carp');
ok(firstRelease.ok && firstRelease.newSpecies && pond.world.pondSpecies.length === 1, 'first fish release establishes a permanent pond species');
const secondRelease = S.releaseFish(pond, 'gossip-carp');
ok(secondRelease.ok && !secondRelease.newSpecies && pond.world.pondSpecies.length === 1, 'releasing the same fish strengthens the shoal without duplicating ecology entries');
const basket = S.claimPondHarvest(pond);
equal(basket.fish, ['gossip-carp'], 'restored pond produces one sustainable daily ecology basket');
equal(pond.hero.ingredients['gossip-carp'], 1, 'pond basket returns a remembered fish without repetitive fishing');
equal(S.claimPondHarvest(pond).reason, 'already-harvested', 'pond basket cannot be spammed during one world day');
pond.world.day += 1;
ok(S.claimPondHarvest(pond).ok, 'pond produces another basket on the next world day');
let pondCatch = null;
for (let score = 0.31; score < 0.9 && (!pondCatch || pondCatch.id === 'golden-duck'); score += 0.07) pondCatch = S.fishingReward(pond, score, false, { pond: true });
equal(pondCatch.id, 'gossip-carp', 'Wobble Pond catch pool follows the ecosystem the player established');

const hybrid = D.gear.find(item => item.hybrid && item.rarity !== 'fabled');
const lockedHybridSave = S.newSave({ seed: 700 });
let lockedHybrid = null;
for (let kills = 0; kills < 700 && !lockedHybrid; kills += 1) { lockedHybridSave.stats.kills = { test: kills }; lockedHybrid = S.rollDrop(lockedHybridSave, [hybrid], 'paperwork'); }
equal(lockedHybrid, null, 'hybrid equipment cannot drop without the Community Table meal');
lockedHybridSave.world.meals.push({ recipeId: 'peace-tuna', remaining: 60 });
let unlockedHybrid = null;
for (let kills = 0; kills < 700 && !unlockedHybrid; kills += 1) { lockedHybridSave.stats.kills = { test: kills }; unlockedHybrid = S.rollDrop(lockedHybridSave, [hybrid], 'paperwork'); }
ok(unlockedHybrid && unlockedHybrid.item.id === hybrid.id, 'Community Table meal unlocks hybrid Human-Toon-robot drops');

human.hero.stones = 2;
const bond = S.bondPet(human, D.pets.find(pet => pet.id === 'sprig0'));
equal(bond, { ok: true, cost: 2 }, 'bonding with exactly two stones consumes both');
equal(human.hero.stones, 0, 'both stones actually vanish');
ok(human.hero.bondedPets.includes('sprig0'), 'chosen miniature persists in bonded roster');
equal(human.hero.petHealth.sprig0, D.pets.find(pet => pet.id === 'sprig0').hp, 'new bond initializes the miniature at its own maximum integrity');

const sprig = D.pets.find(pet => pet.id === 'sprig0');
const petCombat = S.newSave({ race: 'human', classId: 'panzer', seed: 30 });
petCombat.hero.bondedPets = [sprig.id]; petCombat.hero.activePet = sprig.id; petCombat.hero.petHealth[sprig.id] = sprig.hp;
equal(S.damagePet(petCombat, sprig, 18).hp, sprig.hp - 18, 'bonded miniature damage persists exact integrity');
ok(S.damagePet(petCombat, sprig, 999).downed && petCombat.hero.downedPets.includes(sprig.id), 'zero integrity creates a persistent downed companion');
equal(S.selectPet(petCombat, sprig).reason, 'downed', 'downed miniature cannot be redeployed before recovery');
equal(S.triggerPetSpecial(petCombat, sprig).reason, 'downed', 'downed miniature cannot execute its field job');
equal(S.revivePets(petCombat, D.pets), [sprig.id], 'Golden Duck recovery reports the exact rebuilt miniature');
equal(petCombat.hero.petHealth[sprig.id], sprig.hp, 'Golden Duck recovery restores the miniature to its own maximum');

const petSave = pet => { const state = S.newSave({ race: 'human', classId: 'panzer', seed: 31 }); state.hero.bondedPets=[pet.id];state.hero.activePet=pet.id;state.hero.petHealth[pet.id]=pet.hp;return state; };
const gardenSave = petSave(sprig);
const garden = S.triggerPetSpecial(gardenSave, sprig);
ok(garden.ok && garden.action === 'spring-garden' && gardenSave.hero.ingredients.sunberry === 1 && gardenSave.hero.ingredients['laughing-leek'] === 1, 'Sprig-0 field job regrows two real cooking ingredients');
equal(S.triggerPetSpecial(gardenSave, sprig).reason, 'cooldown', 'miniature field jobs enforce saved-world cooldowns');
gardenSave.world.petCooldowns[sprig.id] = 10; gardenSave.world.meals.push({ recipeId: 'moon-noodles', remaining: 60 }); S.advanceWorld(gardenSave, 1);
equal(gardenSave.world.petCooldowns[sprig.id], 8.75, 'Low Voltage meal accelerates real companion cooldown recovery by 25 percent');

const ferry = D.pets.find(pet => pet.id === 'ferrybit'), ferrySave = petSave(ferry);
equal(S.triggerPetSpecial(ferrySave, ferry).action, 'ferry-charge', 'Ferrybit returns a distinct combat charge action');
const siren = D.pets.find(pet => pet.id === 'sirensue'), sirenSave = petSave(siren);
equal(S.triggerPetSpecial(sirenSave, siren).action, 'civic-siren', 'Siren Sue returns a distinct neutral-robot command action');

const crumb = D.pets.find(pet => pet.id === 'crumb32'), crumbSave = petSave(crumb); crumbSave.hero.bolts = 3;
const baked = S.triggerPetSpecial(crumbSave, crumb, { gearList: D.gear, roll: () => 0.2 });
ok(baked.ok && baked.action === 'bake-gear' && baked.reward.item.rarity !== 'fabled' && crumbSave.hero.bolts === 0, 'Crumb-32 converts exactly three bolts into kept non-fabled equipment');
crumbSave.world.petCooldowns[crumb.id] = 0;
equal(S.triggerPetSpecial(crumbSave, crumb, { gearList: D.gear }).reason, 'daily', 'Crumb-32 equipment baking is once per saved-world day rather than a timer chore');

const moss = D.pets.find(pet => pet.id === 'mossboss'), mossSave = petSave(moss);
equal(S.triggerPetSpecial(mossSave, moss).action, 'ranger-audit', 'Moss Boss activates its rare-drop audit');
const audited = S.consumeMossDrop(mossSave, D.gear, () => 0.2);
ok(audited && audited.item.rarity === 'rare' && mossSave.world.petBuffs.mossDrop === 0, 'Ranger audit produces one rare non-junk drop and is consumed');

const ledger = D.pets.find(pet => pet.id === 'ledgerling'), ledgerSave = petSave(ledger);
equal(S.triggerPetSpecial(ledgerSave, ledger).action, 'ledger-rebate', 'Ledgerling activates its explicit salvage rebate');
const ledgerSpare = S.addGear(ledgerSave, D.gear.find(item => item.id === 'springpan'), () => 0.2).item;
S.salvageGear(ledgerSave, ledgerSpare.uid);
equal(ledgerSave.hero.bolts, ledgerSpare.salvage + 2, 'Ledger rebate adds exactly two bolts to the next salvage');

S.damagePet(petCombat, sprig, 999);
const forcedDuck = S.fishingReward(petCombat, 0, false, { forceDuck: true, petList: D.pets });
ok(forcedDuck.id === 'golden-duck' && forcedDuck.revivedPets.includes(sprig.id) && !petCombat.hero.downedPets.length, 'Golden Duck fishing completes the actual downed-pet recovery loop');

const hoarder = S.newSave({ race: 'toon', classId: 'gear-shepherd', seed: 9 });
hoarder.world.meals.push({ recipeId: 'sunberry-pie', remaining: 10 });
hoarder.hero.stones = 5;
equal(S.bondPet(hoarder, D.pets.find(pet => pet.id === 'sprig0')).cost, 2, 'hoarder bonding consumes only two');
equal(hoarder.hero.stones, 3, 'hoarder keeps stones beyond the second');

const storySave = () => S.newSave({ race: 'human', classId: 'panzer', seed: 44 });
const citizenship = storySave();
ok(S.applyStoryChoice(citizenship, 'lunch', 'citizenship', D.storyChoices).ok, 'lunch citizenship becomes a durable decision');
equal(S.storyOutcome(citizenship, 'lunch', D.storyChoices).label, 'GRANT CITIZENSHIP', 'saved decision resolves to its player-facing outcome');
equal(S.storyEffects(citizenship, D.storyChoices).cookZone, 1.12, 'citizen cooks widen the executable cook-off timing window by 12 percent');
equal(S.applyStoryChoice(citizenship, 'lunch', 'contract', D.storyChoices).reason, 'already-decided', 'permanent story decisions cannot be silently switched');

const contract = storySave();
S.applyStoryChoice(contract, 'lunch', 'contract', D.storyChoices);
equal(S.storyEffects(contract, D.storyChoices).questBolts, 2, 'lunch contract creates the declared adventure-closing bolt payment');

const ferryStory = storySave();
S.applyStoryChoice(ferryStory, 'river', 'ferry-lane', D.storyChoices);
equal(S.storyEffects(ferryStory, D.storyChoices).riverSpeed, 1.45, 'robot ferry lane creates the declared river movement multiplier');

const rapidsStory = storySave();
S.applyStoryChoice(rapidsStory, 'river', 'toon-rapids', D.storyChoices);
let rapidsCatch = null;
for (let score = 0.12; score < 0.98 && (!rapidsCatch || rapidsCatch.id === 'golden-duck'); score += 0.07) rapidsCatch = S.fishingReward(rapidsStory, score, false, { storyChoices: D.storyChoices });
ok(rapidsCatch && rapidsCatch.id !== 'golden-duck' && rapidsCatch.quantity === 2, 'restored rapids make one ordinary catch yield two useful fish');
equal(rapidsStory.hero.ingredients[rapidsCatch.id], 2, 'the extra rapid fish reaches the real ingredient inventory');

const soloShadow = storySave();
S.applyStoryChoice(soloShadow, 'shadow', 'shadow-contract', D.storyChoices);
equal(S.storyEffects(soloShadow, D.storyChoices).doodledeanAggro, 0.75, 'shadow contract reduces the declared Doodledean notice range');
const duetShadow = storySave();
S.applyStoryChoice(duetShadow, 'shadow', 'shared-billing', D.storyChoices);
equal(S.storyEffects(duetShadow, D.storyChoices).companionDamage, 1.25, 'shared billing teaches the declared companion damage follow-up');

const careStory = storySave();
S.applyStoryChoice(careStory, 'brain', 'care', D.storyChoices);
equal(careStory.world.specialistBrains, ['care'], 'Care decision connects directly to finale specialist identity');
equal(S.storyEffects(careStory, D.storyChoices).petDamageTaken, 0.75, 'Care reduces bonded miniature integrity damage by 25 percent');
const courageStory = storySave();
S.applyStoryChoice(courageStory, 'brain', 'courage', D.storyChoices);
equal(S.storyEffects(courageStory, D.storyChoices).companionDamage, 1.25, 'Courage increases bonded miniature damage by 25 percent');
const curiosityStory = storySave();
S.applyStoryChoice(curiosityStory, 'brain', 'curiosity', D.storyChoices);
curiosityStory.world.petCooldowns.sprig0 = 10;
S.advanceWorld(curiosityStory, 1, { storyChoices: D.storyChoices });
equal(curiosityStory.world.petCooldowns.sprig0, 8.8, 'Curiosity accelerates saved-play miniature cooldown recovery by 20 percent');

const warningStory = storySave();
S.applyStoryChoice(warningStory, 'forecast', 'warning-lattice', D.storyChoices);
equal(S.storyEffects(warningStory, D.storyChoices).puddleWarning, 1, 'the forecast lattice activates one explicit puddle-warning rule without adding a reward percentage');
equal(S.storyEffects(warningStory, D.storyChoices).rainbowShelters, 0, 'the mutually exclusive forecast choice does not silently grant rainbow shelters too');
const shelterStory = storySave();
S.applyStoryChoice(shelterStory, 'forecast', 'rainbow-shelters', D.storyChoices);
equal(S.storyEffects(shelterStory, D.storyChoices).rainbowShelters, 1, 'the shelter pact activates post-defeat protection without granting the warning lattice');

const legacyDecision = storySave();
legacyDecision.world.decisions.river = 'BUILD THE ROBOT FERRY LANE';
equal(S.storyOutcome(legacyDecision, 'river', D.storyChoices).id, 'ferry-lane', 'older label-based decisions still resolve to the new durable contract');

const timed = S.newSave({ seed: 22 });
const omen = S.newSave({ seed: 21 });
omen.world.playSeconds = S.OMEN_HOUR * 3600 - 0.25;
S.advanceWorld(omen, 0.5);
ok(omen.world.phase === 'omens' && !omen.world.finaleStarted, 'the 23rd-hour omen begins before the invasion');

const stagedOmen = S.newSave({ seed: 210 });
for (const [fraction, stage] of [[0, 0], [0.01, 1], [0.25, 2], [0.5, 3], [0.75, 4], [1, 5]]) {
  stagedOmen.world.playSeconds = (S.OMEN_HOUR + fraction) * 3600;
  equal(S.omenStage(stagedOmen), stage, 'omen stage '+stage+' has an exact saved-hour boundary');
}
stagedOmen.world.playSeconds = (S.OMEN_HOUR + 0.2499) * 3600;
ok(S.omenProgress(stagedOmen) > 0.249 && S.omenProgress(stagedOmen) < 0.25, 'omen progress is continuous between stage boundaries');
const omenCrossing = S.advanceWorld(stagedOmen, 0.5);
ok(omenCrossing.crossedOmenStage && omenCrossing.omenStage === 2, 'crossing an omen boundary emits a single saved stage transition');

timed.world.playSeconds = S.FINAL_HOUR * 3600 - 0.25;
const crossed = S.advanceWorld(timed, 0.5);
ok(crossed.crossedFinalHour && timed.world.finaleStarted && timed.world.phase === 'invasion', '24 saved hours deterministically start the invasion');

const ruined = S.newSave({ seed: 211 });
ruined.world.playSeconds = S.FINAL_HOUR * 3600;
ruined.world.finaleStarted = true;
ruined.world.finaleLost = true;
ruined.world.phase = 'ruin';
ruined.world.invasion = 0.2999;
const ruinCrossing = S.advanceWorld(ruined, 1);
ok(ruined.world.phase === 'ruin', 'a lost world stays in ruin instead of being overwritten by the 24-hour invasion phase');
ok(ruinCrossing.crossedRuinStage && ruinCrossing.ruinStage === 2, 'slow destruction crosses explicit persistent ruin stages');
ok(ruined.world.invasion > 0.3 && ruined.world.invasion < 0.301, 'destruction advances by saved play rather than away-time pressure');
ruined.world.finaleLost = false;
ruined.world.finaleWon = true;
equal(S.ruinStage(ruined), 2, 'winning a later resistance preserves the scars of the damaged world');

S.recordChallenge(timed, 'kill', 'hecklecrab', 12, D.challenges, 'doodledean');
ok(timed.challenges['crab-accountant'].complete, 'clear kill-count challenge completes without puzzle luck');

const fishSave = S.newSave({ seed: 3 });
const catchResult = S.fishingReward(fishSave, 0.8, false);
ok(catchResult && catchResult.id, 'active fishing always resolves to a catch or Golden Duck');
ok(Object.keys(fishSave.stats.fishCaught).length + fishSave.stats.goldenDucks === 1, 'fishing result persists meaningful progress');

const storage = { value: null, setItem(_key, value) { this.value = value; }, getItem() { return this.value; } };
S.saveToStorage(human, storage);
const restored = S.loadFromStorage(storage);
ok(restored && restored.hero.bondedPets.includes('sprig0'), 'local save round-trip preserves robot bonds');
equal(restored.hero.petHealth.sprig0, sprig.hp, 'local save round-trip preserves companion integrity');
equal(restored.schema, S.SAVE_SCHEMA, 'save schema remains explicit');
const storyStorage = { value: null, setItem(_key, value) { this.value = value; }, getItem() { return this.value; } };
S.saveToStorage(ferryStory, storyStorage);
equal(S.storyOutcome(S.loadFromStorage(storyStorage), 'river', D.storyChoices).id, 'ferry-lane', 'local save round-trip preserves a permanent world decision');
const encounterStorage = { value: null, setItem(_key, value) { this.value = value; }, getItem() { return this.value; } };
S.saveToStorage(encounterSave, encounterStorage);
const restoredEncounter = S.loadFromStorage(encounterStorage);
ok(restoredEncounter.world.encounterRecords[hearing.id].won && restoredEncounter.world.encounterRecords[hearing.id].attempts === 2 && restoredEncounter.world.encounterRecords[hearing.id].completions === 2, 'local save round-trip preserves authored encounter attempts and wins');
const recoveryStorage = { value: null, setItem(_key, value) { this.value = value; }, getItem() { return this.value; } };
S.saveToStorage(recoverySave, recoveryStorage);
const restoredRecovery = S.loadFromStorage(recoveryStorage).world.encounterRecords[hearing.id];
ok(restoredRecovery.losses === 2 && restoredRecovery.assistedWins === 1 && restoredRecovery.recoveriesAccepted === 1 && !restoredRecovery.assistReady, 'local save round-trip preserves losses, accepted recoveries and assisted wins');
const aftermathStorage = { value: null, setItem(_key, value) { this.value = value; }, getItem() { return this.value; } };
S.saveToStorage(aftermathSave, aftermathStorage);
const restoredAftermath = S.loadFromStorage(aftermathStorage);
ok(restoredAftermath.world.aftermathReports['passport-witness'].versionsHeard.includes('pending') && restoredAftermath.world.aftermathReports['passport-witness'].versionsHeard.includes('citizenship'), 'local save round-trip preserves evolving robot-witness history');
const councilStorage = { value: null, setItem(_key, value) { this.value = value; }, getItem() { return this.value; } };
S.saveToStorage(councilSave, councilStorage);
const restoredCouncil = S.loadFromStorage(councilStorage);
ok(restoredCouncil.hero.inventory.find(item => item.uid === councilItem.uid).argument === 'heckler' && restoredCouncil.stats.gearArguments === 4, 'local save round-trip preserves the chosen robot argument and non-farmable rewrite count');
const originStorage = { value: null, setItem(_key, value) { this.value = value; }, getItem() { return this.value; } };
S.saveToStorage(originSave, originStorage);
const restoredOrigin = S.loadFromStorage(originStorage);
ok(restoredOrigin.world.originEchoes.paperwork.resolved && restoredOrigin.hero.inventory.find(item => item.uid === repeatOrigin.item.uid).origin.regionId === 'kettlewick' && restoredOrigin.stats.originEchoes === 1, 'local save round-trip preserves settled origin history, later item provenance and the non-farmable resolution count');

console.log('Bonk & Bolt systems PASS · ' + checks + ' checks');
