import { missionSummary } from './scoreboard.js';
import { ammoDisplay, groupActorsByCorner, waitingPlayerLabel } from './hud-helpers.js';

export class Hud {
  constructor(partyId) {
    this.partyId = partyId;
    this.$ = (id) => document.getElementById(id);
    this.$('party-name').textContent = partyId === 'all' ? 'ALL PARTIES' : partyId.replace('_', ' ').toUpperCase();
    for (let quarter = 1; quarter <= 4; quarter += 1) this.renderWaitingCard(quarter);
  }

  update(world, stateMeta) {
    const mission = world.mission || {}, goal = mission.deliveryGoal || mission.goal || 5, deliveries = mission.deliveries ?? mission.deliveredCount ?? 0;
    this.$('mission-title').textContent = (mission.title || mission.mode || 'Party House').replaceAll('_', ' ').toUpperCase();
    this.$('party-score').textContent = mission.mode === 'district_dominion'
      ? `A ${mission.partyScores?.party_a || 0} · B ${mission.partyScores?.party_b || 0}`
      : mission.partyScore ?? mission.score ?? 0;
    this.$('party-fund').textContent = formatPartyFund(world.economy, this.partyId);
    const seconds = Math.max(0, Math.ceil(mission.timeRemaining ?? mission.remainingSeconds ?? 0));
    this.$('round-time').textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    const progress = Math.min(100, Math.max(0, goal > 0 ? deliveries / goal * 100 : 0));
    this.$('mission-bar').style.width = `${progress}%`;
    this.$('mission-bar').parentElement.setAttribute('aria-valuenow', String(Math.round(progress)));
    this.$('mission-hint').textContent = mission.hint || `${deliveries}/${goal} packages delivered · Collect at depot`;
    this.renderTerritory(world.territory, mission);
    const justice = world.justice || {};
    this.$('justice-status').textContent = `JUSTICE: ${(justice.stage || 'calm').toUpperCase()}${justice.voluntaryChaos ? ' · VOLUNTARY CHAOS' : ''}`;
    const rules = world.combatRules || {}, friendly = rules.partyFriendlyFire || {};
    const ffText = this.partyId === 'all'
      ? `A ALLY DAMAGE ${friendly.party_a ? 'ON' : 'OFF'} · B ${friendly.party_b ? 'ON' : 'OFF'}`
      : `ALLY DAMAGE: ${friendly[this.partyId] ? 'ON' : 'OFF'} · PVP: ${rules.crossPartyDamage ? 'ON' : 'OFF'}`;
    const ff = this.$('friendly-fire'); ff.textContent = ffText; ff.classList.toggle('on', friendly[this.partyId] === true); ff.classList.toggle('off', friendly[this.partyId] !== true);
    const actors = (world.actors || [])
      .filter((actor) => this.partyId === 'all' || actor.partyId === this.partyId)
      .sort((a, b) => Number(a.slot) - Number(b.slot));
    const byQuarter = groupActorsByCorner(actors);
    for (let quarter = 1; quarter <= 4; quarter += 1) {
      const quarterActors = byQuarter.get(quarter) || [];
      if (quarterActors.length) this.renderPlayerCards(quarter, quarterActors);
      else this.renderWaitingCard(quarter);
    }
    const inSafe = actors.some((a) => a.inSafeZone || a.safeZoneId);
    this.$('safe-zone').classList.toggle('hidden', !inSafe);
    this.renderGroupSaveComputer(world.groupSaveComputer, stateMeta?.tick ?? 0);
    const menuOpen = ['board', 'countdown'].includes(mission.status);
    this.$('mission-menu').classList.toggle('hidden', !menuOpen);
    if (menuOpen) this.renderMissionMenu(mission);
    const complete = mission.phase === 'results' || mission.status === 'results';
    this.$('results').classList.toggle('hidden', !complete);
    if (complete) {
      const summary = missionSummary(mission);
      const fastest = summary.fastestDeliveryTicks == null ? '—' : `${(summary.fastestDeliveryTicks / 30).toFixed(1)}s`;
      if (mission.mode === 'district_dominion') this.renderTerritoryResults(mission);
      else this.renderResults(mission, summary, fastest);
    }
  }

  renderTerritory(territory, mission) {
    const container = this.$('territory-zones');
    const enabled = territory?.enabled === true;
    container.classList.toggle('hidden', !enabled);
    if (!enabled) {
      container.replaceChildren();
      return;
    }
    container.replaceChildren(...(territory.zones || []).map((zone) => {
      const owner = zone.ownerPartyId === 'party_a' ? 'A' : zone.ownerPartyId === 'party_b' ? 'B' : '•';
      const chip = text('span', `territory-chip ${zone.ownerPartyId || 'neutral'}${zone.contested ? ' contested' : ''}`, `${owner} ${(zone.label || zone.id).replace(' Junction', '').replace(' Crossing', '')}`);
      chip.title = `${zone.label}: ${zone.contested ? 'contested' : zone.ownerPartyId || 'neutral'} · progress ${Math.round(zone.progress || 0)}`;
      return chip;
    }));
    const progressLabel = this.$('mission-bar').parentElement;
    progressLabel.setAttribute('aria-label', `${this.partyId === 'all' ? 'Leading' : this.partyId.replace('_', ' ')} territory score progress`);
  }

  renderGroupSaveComputer(saveComputer, tick) {
    const overlay = this.$('save-computer');
    if (!overlay) return;
    const open = saveComputer?.open === true;
    overlay.classList.toggle('hidden', !open);
    const toast = this.$('save-status-toast');
    const showToast = !open && Boolean(saveComputer?.message) && Number(saveComputer.messageUntilTick) >= Number(tick);
    toast.classList.toggle('hidden', !showToast);
    if (showToast) toast.textContent = saveComputer.message;
    if (!open) return;

    const operation = saveComputer.operation === 'load' ? 'load' : 'save';
    this.$('save-operation-current').textContent = `${operation.toUpperCase()} MODE`;
    this.$('save-operation-save').classList.toggle('active', operation === 'save');
    this.$('save-operation-load').classList.toggle('active', operation === 'load');
    const selectedSlot = Number(saveComputer.selectedSlot) || 1;
    const armed = saveComputer.confirmation;
    const entries = Array.from({ length: 9 }, (_, index) => {
      const slot = index + 1;
      const summary = (saveComputer.catalog || []).find((candidate) => candidate.slot === slot) || { slot, status: 'empty' };
      const card = node('article', `save-slot ${summary.status || 'empty'}${slot === selectedSlot ? ' selected' : ''}${armed?.slot === slot && armed?.operation === operation ? ' armed' : ''}`);
      card.setAttribute('aria-current', String(slot === selectedSlot));
      const heading = node('header', 'save-slot-heading');
      heading.append(text('strong', '', `SLOT ${slot}`), text('span', 'save-slot-state', (summary.status || 'empty').toUpperCase()));
      card.append(heading);
      if (summary.status === 'ready') {
        const distribution = summary.partyDistribution || {};
        const groupTotal = Number(summary.partyFunds?.party_a || 0) + Number(summary.partyFunds?.party_b || 0);
        card.append(text('b', 'save-roster', `${summary.seatCount} FIXED SEAT${summary.seatCount === 1 ? '' : 'S'} · ${summary.seatSlots?.map((value) => `P${value}`).join(' ') || ''}`));
        card.append(text('span', '', `A ${distribution.party_a || 0} · B ${distribution.party_b || 0}`));
        card.append(text('span', '', `Players ${formatCredits(summary.totalPersonalFundsCents)} · Group ${formatCredits(groupTotal)}`));
        card.append(text('time', '', formatSaveDate(summary.updatedAt)));
      } else if (summary.status === 'corrupt') {
        card.append(text('b', 'save-roster', 'LOAD BLOCKED'));
        card.append(text('span', '', 'Save over this slot to repair it.'));
      } else {
        card.append(text('b', 'save-roster', 'EMPTY'));
        card.append(text('span', '', 'Available for a new fixed roster.'));
      }
      if (armed?.slot === slot && armed?.operation === operation) card.append(text('em', 'save-confirm', 'PRESS ACTION AGAIN'));
      return card;
    });
    this.$('save-slot-grid').replaceChildren(...entries);
    this.$('save-computer-message').textContent = saveComputer.message || 'Choose a slot.';
    this.$('save-computer-message').classList.toggle('busy', saveComputer.busy === true);
  }

  renderPlayerCards(quarter, actors) {
    const corner = this.$(`player-card-${quarter}`);
    corner.classList.toggle('multi', actors.length > 1);
    corner.replaceChildren(...actors.map((actor) => this.createPlayerCard(quarter, actor)));
  }

  createPlayerCard(quarter, actor) {
    const card = node('article', `player-card ${actor.partyId === 'party_b' ? 'party-b' : 'party-a'}${actor.alive === false ? ' is-downed' : ''}`);
    const health = whole(actor.health, 0);
    const maxHealth = Math.max(1, whole(actor.maxHealth, 100));
    const shield = whole(actor.shield, 0);
    const maxShield = Math.max(0, whole(actor.maxShield, shield));
    const healthPercent = Math.min(100, Math.max(0, health / maxHealth * 100));
    const status = actor.alive === false
      ? 'RESPAWNING'
      : actor.currentVehicleId ? (actor.vehicleSeat === 'driver' ? 'DRIVING' : 'PASSENGER') : 'ON FOOT';

    card.setAttribute('aria-label', `Player ${actor.slot ?? quarter}, ${actor.displayName || actor.seatId || 'waiting'}, ${status}`);
    const heading = node('header', 'player-card-heading');
    const identity = node('div', 'player-identity');
    identity.append(text('span', 'player-number', `P${actor.slot ?? quarter}`));
    identity.append(text('strong', 'player-name', actor.displayName || actor.seatId || actor.id || `PLAYER ${quarter}`));
    heading.append(identity, text('span', 'player-status', status));

    const healthLine = metricLine('HP', `${health}/${maxHealth}`, 'health-value');
    const healthBar = node('div', 'health-bar');
    healthBar.setAttribute('role', 'progressbar');
    healthBar.setAttribute('aria-label', `Player ${actor.slot ?? quarter} health`);
    healthBar.setAttribute('aria-valuemin', '0');
    healthBar.setAttribute('aria-valuemax', String(maxHealth));
    healthBar.setAttribute('aria-valuenow', String(health));
    const healthFill = node('i', 'health-fill');
    healthFill.style.width = `${healthPercent}%`;
    healthBar.append(healthFill);

    const resources = node('div', 'player-resources');
    resources.append(metricLine('SHIELD', `${shield}/${maxShield}`, 'shield-value'));
    resources.append(metricLine('AMMO · LOADED/TOTAL', ammoDisplay(actor.ammoSummary), 'ammo-value'));
    const money = metricLine('PLAYER FUND', formatCredits(actor.walletCents), 'money-value');
    money.classList.add('money-line');
    resources.append(money);
    card.replaceChildren(heading, healthLine, healthBar, resources);
    return card;
  }

  renderWaitingCard(quarter) {
    const corner = this.$(`player-card-${quarter}`);
    const playerLabel = waitingPlayerLabel(this.partyId, quarter);
    corner.classList.remove('multi');
    const card = node('article', 'player-card unassigned');
    card.setAttribute('aria-label', `${playerLabel} waiting`);
    const heading = node('header', 'player-card-heading');
    const identity = node('div', 'player-identity');
    identity.append(text('span', 'player-number', playerLabel));
    identity.append(text('strong', 'player-name', 'WAITING'));
    heading.append(identity, text('span', 'player-status', 'NO ACTOR'));
    const healthLine = metricLine('HP', '—', 'health-value');
    const healthBar = node('div', 'health-bar empty');
    healthBar.setAttribute('aria-hidden', 'true');
    healthBar.append(node('i', 'health-fill'));
    const resources = node('div', 'player-resources');
    resources.append(metricLine('SHIELD', '—', 'shield-value'));
    resources.append(metricLine('AMMO · LOADED/TOTAL', '—', 'ammo-value'));
    const money = metricLine('PLAYER FUND', '—', 'money-value');
    money.classList.add('money-line');
    resources.append(money);
    card.replaceChildren(heading, healthLine, healthBar, resources);
    corner.replaceChildren(card);
  }

  renderMissionMenu(mission) {
    const countdown = mission.status === 'countdown';
    this.$('mission-menu-title').textContent = countdown ? `${mission.title || 'MISSION'} STARTING` : 'MISSION BOARD';
    this.$('mission-menu-copy').textContent = countdown
      ? `${Math.max(0, Math.ceil(mission.timeRemaining || 0))} seconds · ${mission.pendingLayout?.twist || 'new city route'} · leader ACTION cancels`
      : 'Move up/down and press ACTION. Each mission draws a location from its host-owned route deck.';
    this.renderOptions(this.$('mission-menu-options'), countdown ? [] : mission.menuOptions || []);
  }

  renderOptions(container, options) {
    container.replaceChildren(...options.map((option) => {
      const entry = text('div', `menu-option${option.selected ? ' selected' : ''}`, option.label || option.id);
      if (option.selected) entry.setAttribute('aria-current', 'true');
      return entry;
    }));
  }

  renderResults(mission, summary, fastest) {
    this.$('results-mission').textContent = (mission.title || mission.mode || 'MISSION').replaceAll('_', ' ').toUpperCase();
    this.$('results-title').textContent = summary.success ? 'MISSION COMPLETE' : 'MISSION FAILED';
    const stats = node('div', 'result-stats');
    const partyFund = this.partyId === 'all'
      ? formatPartyFund({ partyFunds: summary.partyFundTotals }, 'all')
      : formatCredits(summary.partyFundTotals[this.partyId] || 0);
    const entries = [['Location', mission.layout?.label || mission.result?.layout?.label || 'Default'], ['Score', summary.score], ['Progress', summary.deliveries], ['Gross / player', formatCredits(summary.rewardCents)], [`Player ${summary.rewardSplit.personalPercent}%`, formatCredits(summary.personalRewardCents)], [`Party ${summary.rewardSplit.partyPercent}%`, formatCredits(summary.partyContributionCents)], ['Party fund', partyFund], ['Fastest', fastest], ['Vehicle', summary.vehicleAssisted], ['Dropped', summary.droppedPackages]];
    if (summary.wavesCompleted) entries.push(['Waves', summary.wavesCompleted]);
    if (summary.relayHealth !== null) entries.push(['Relay HP', summary.relayHealth]);
    entries.forEach(([label, value]) => {
      const entry = node('span');
      entry.append(document.createTextNode(`${label} `), text('strong', '', value));
      stats.append(entry);
    });
    const players = node('div', 'result-players');
    if (!summary.individual.length) players.append(text('span', '', 'No completed deliveries'));
    summary.individual.forEach((entry) => {
      const row = node('div', 'result-row');
      const progressLabel = entry.collections ? `${entry.collections} collected` : `${entry.deliveries} delivered`;
      row.append(text('span', '', entry.displayName), text('strong', '', progressLabel), text('small', '', `${entry.vehicleAssisted} vehicle`));
      players.append(row);
    });
    this.$('results-score').replaceChildren(stats, players);
    this.renderOptions(this.$('results-options'), mission.menuOptions || []);
  }

  renderTerritoryResults(mission) {
    const result = mission.result || {};
    const winner = result.winnerPartyId;
    const draw = result.draw || !winner;
    const perspectiveWon = this.partyId === 'all' ? Boolean(winner) : winner === this.partyId;
    this.$('results-mission').textContent = 'DISTRICT DOMINION · FINAL CONTROL REPORT';
    this.$('results-title').textContent = draw ? 'DISTRICT DRAW' : perspectiveWon ? 'DISTRICT WON' : 'DISTRICT LOST';
    const stats = node('div', 'result-stats');
    const scores = result.scores || mission.partyScores || {};
    const owned = result.ownedZones || {};
    const purchases = result.reinforcementsPurchased || {};
    const entries = [
      ['Party A score', scores.party_a || 0],
      ['Party B score', scores.party_b || 0],
      ['A districts', owned.party_a || 0],
      ['B districts', owned.party_b || 0],
      ['A crews sent', purchases.party_a || 0],
      ['B crews sent', purchases.party_b || 0],
      ['Finish', result.reason || 'timer'],
    ];
    entries.forEach(([label, value]) => {
      const entry = node('span');
      entry.append(document.createTextNode(`${label} `), text('strong', '', value));
      stats.append(entry);
    });
    const copy = node('div', 'result-players');
    copy.append(text('span', '', 'The result stays on screen until the host restarts or ends the local session.'));
    this.$('results-score').replaceChildren(stats, copy);
    this.$('results-options').replaceChildren();
  }
}

function formatCredits(cents) {
  const value = Math.max(0, Math.min(99_999_999, Math.round(Number(cents) || 0))) / 100;
  return `DC ${new Intl.NumberFormat('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}`;
}

function formatSaveDate(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'UNKNOWN TIME';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

function formatPartyFund(economy = {}, partyId) {
  const funds = economy.partyFunds || {};
  if (partyId === 'all') return `A ${formatCredits(funds.party_a || 0)} · B ${formatCredits(funds.party_b || 0)}`;
  return formatCredits(funds[partyId] || 0);
}

function whole(value, fallback) {
  return Number.isFinite(Number(value)) ? Math.max(0, Math.round(Number(value))) : fallback;
}

function metricLine(label, value, valueClass) {
  const line = node('div', 'metric-line');
  line.append(text('span', '', label), text('strong', valueClass, value));
  return line;
}

function node(tagName, className = '') {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  return element;
}

function text(tagName, className, value) {
  const element = node(tagName, className);
  element.textContent = String(value);
  return element;
}
