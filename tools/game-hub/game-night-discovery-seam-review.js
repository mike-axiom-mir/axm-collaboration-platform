const assert = require('assert');
const fs = require('fs');
const path = require('path');

const gameHub = __dirname;
const workshop = path.resolve(gameHub, '..', '..');
const read = (...parts) => fs.readFileSync(path.join(...parts), 'utf8');
const contract = JSON.parse(read(gameHub, 'GAME_NIGHT_CONTRACT.json'));
const profileContract = JSON.parse(read(workshop, 'shared', 'profile', 'profile-service.contract.json'));
const launcher = read(gameHub, 'game-night.js');
const server = read(gameHub, 'game-hub-server.js');
const postGame = read(gameHub, 'post-game', 'post-game.js');
const theme = JSON.parse(read(workshop, 'skins', 'nostalgia-lab', 'skin.config.json'));

const seams = [
  ['four seats are the default', contract.defaultVisibleSeats === 4],
  ['extra group is optional', contract.optionalExtraSeats === 4 && launcher.includes('visibleSeats')],
  ['shared screen never consumes a seat', contract.truths.screenOccupiesSeat === false],
  ['human and AI seats share one lobby', contract.truths.humanAndAiStayVisible === true],
  ['starting is not counted as playing', contract.truths.startCountsAsPlayed === false],
  ['stopping creates no achievement receipt', contract.truths.stoppedSessionCreatesAchievementReceipt === false],
  ['only confirmed finishes create results', contract.truths.confirmedFinishCreatesResult === true],
  ['result ledger is durable and bounded', server.includes('axm.game-night-results/v1') && server.includes('MAX_RESULTS')],
  ['one named QR exists per ready human', contract.controllerFlow.oneNamedQrPerReadyHuman === true],
  ['same-network requirement is declared', contract.controllerFlow.sameWifiRequiredForLiveInput === true],
  ['cached shell capability is declared', contract.controllerFlow.cachedShellWhereGameSupportsIt === true],
  ['AI uses the declared action vocabulary', contract.controllerFlow.adapterUsesDeclaredActionVocabulary === true],
  ['public shelf contains the current featured game IDs', ['003-robo-pong-cross','006-lumenwake','007-casino-alpha','008-district-party','009-circuitseed-protocol-wilds','010-living-globe-tycoon'].every(id => contract.featuredGames.includes(id)) && !contract.featuredGames.includes('007-lux5-neon-overdrive')],
  ['profile tracking is explicitly opt-in', profileContract.lifecycle === 'OPTIONAL_OPT_IN'],
  ['unknown authorship is never given to the human', profileContract.localHttpAdapter.some(line => line.includes('never reassigned'))],
  ['receipt retries are deduplicated', profileContract.rules.some(line => line.includes('dedupe'))],
  ['badge art is replaceable infrastructure', profileContract.rules.some(line => line.includes('replace the achievement catalog and artwork'))],
  ['post-game reflection has four storage choices', contract.postGame.choices.length === 4],
  ['wisdom promotion requires an explicit click', contract.postGame.sharedWisdomRequiresExplicitClick === true && postGame.includes('explicitPromotion:true')],
  ['human and AI views remain separate evidence', postGame.includes('human') && postGame.includes('ai') && postGame.includes('evidence')],
  ['nostalgia theme is inactive by default', theme.active === false],
  ['nostalgia theme has no remote image dependency', !JSON.stringify(theme).includes('http://') && !JSON.stringify(theme).includes('https://')]
];

const open = seams.filter(([, ok]) => !ok);
seams.forEach(([name, ok]) => console.log(`${ok ? 'PASS' : 'OPEN'} ${name}`));
assert.equal(open.length, 0, `${open.length} Game Night seam(s) remain open`);
console.log(`game night discovery seam review: PASS (${seams.length} seams, 0 open)`);
