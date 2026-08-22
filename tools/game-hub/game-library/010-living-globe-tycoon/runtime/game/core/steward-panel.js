(function (root) {
  'use strict';

  function element(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = String(text);
    return node;
  }

  function downloadJson(filename, value) {
    var blob = new Blob([JSON.stringify(value, null, 2) + '\n'], { type: 'application/json' });
    var url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
  }

  function words(value) { return String(value || '').replace(/_/g, ' ').toLowerCase(); }
  function signed(value) { return value > 0 ? '+' + value : String(value); }
  function costs(value) {
    var names = Object.keys(value || {});
    return names.length ? names.map(function (name) { return name + ' ' + value[name]; }).join(' · ') : 'none';
  }
  function money(value) { return '¤' + signed(Math.round(Number(value || 0) * 100) / 100); }
  function costStory(entries) {
    return (entries || []).map(function (entry) {
      var cash = entry.breakdown.filter(function (line) { return line.paidAs === 'funds'; }).map(function (line) { return line.component + ' ' + money(line.value); });
      var stock = entry.breakdown.filter(function (line) { return line.paidAs !== 'funds'; }).map(function (line) { return line.component + ' ' + line.quantity + ' ' + line.unit; });
      return entry.label + ' · ' + costs(entry.costs) + '\nWHY: ' + entry.why[0] + '\nCash: ' + cash.join(' · ') + (stock.length ? '\nPhysical stock: ' + stock.join(' · ') : '');
    }).join('\n\n');
  }

  function mount(options) {
    var bridge = options && options.bridge;
    if (!bridge) throw new TypeError('steward bridge required');
    var toggle = element('button', '', 'Palace');
    toggle.id = 'axmStewardToggle'; toggle.type = 'button'; toggle.setAttribute('aria-expanded', 'false'); toggle.setAttribute('aria-controls', 'axmStewardPanel');
    var panel = element('aside', 'axm-steward-panel'); panel.id = 'axmStewardPanel'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); panel.setAttribute('aria-hidden', 'true'); panel.setAttribute('aria-label', 'Living Globe palace stewardship console');
    panel.innerHTML = '' +
      '<div class="axm-steward-head"><div><h2>PALACE OF STEWARDSHIP</h2><p>living island experiment · v0.10 shared brief + palace errands + deep economy</p></div><button class="axm-steward-close" type="button" aria-label="Close palace console">close</button></div>' +
      '<div class="axm-truth-line">FICTIONAL SATIRE · WORLD-OWNED STATE · HUMAN CHOICES · NOTHING ADVANCES BY ITSELF</div>' +
      '<section class="axm-radio" aria-label="Palace radio"><div class="axm-radio-label">PALACE RADIO · definitely independent</div><div id="axmHeadline" class="axm-headline" aria-live="polite"></div><div id="axmCabinetLine" class="axm-cabinet-line"></div></section>' +
      '<section class="axm-steward-section"><h3>Island pulse</h3><div id="axmPulse" class="axm-pulse-grid"></div><div id="axmEconomyBrief" class="axm-economy-brief"></div><div id="axmMeta" class="axm-meta-strip"></div></section>' +
      '<section class="axm-steward-section axm-dilemma-section"><div class="axm-section-kicker">ONE THING AT A TIME</div><div id="axmDilemma"></div></section>' +
      '<section class="axm-steward-section"><h3>Presidential paperwork</h3><label class="axm-field">Edict<select id="axmEdict"></select></label><div id="axmEdictPreview" class="axm-preview"></div><div class="axm-buttons"><button id="axmIssueEdict" class="primary" type="button">Issue this edict</button></div></section>' +
      '<section class="axm-steward-section"><h3>Let the island live</h3><label class="axm-field">Visible reason<input id="axmReason" maxlength="180" value="Steward the living island with visible costs and consequences."></label><div class="axm-buttons"><button id="axmAdvance" class="primary axm-big-action" type="button">Advance one quarter</button></div><div id="axmStatus" class="axm-status" aria-live="polite">Nothing advances until you choose it.</div></section>' +
      '<details class="axm-steward-section"><summary>Economy books · why money moved</summary><div id="axmEconomy" class="axm-details-body"></div></details>' +
      '<details class="axm-steward-section"><summary>Island voices · factions</summary><div id="axmFactions"></div></details>' +
      '<details class="axm-steward-section"><summary>Living habitats · inhabitants</summary><div id="axmEcology"></div></details>' +
      '<details class="axm-steward-section"><summary>City patch proposals</summary><div class="axm-details-body">' +
        '<label class="axm-field">Operation<select id="axmOperation"><option value="PROPOSE_SERVICE">Build a service</option><option value="PROPOSE_DISTRICT">Set broad district direction</option><option value="PROPOSE_ROAD">Connect two districts</option><option value="PROPOSE_ECO_BUFFER">Protect an ecological buffer</option></select></label>' +
        '<label class="axm-field">District<select id="axmDistrict"></select></label>' +
        '<label class="axm-field axm-service-field">Service<select id="axmService"></select></label>' +
        '<label class="axm-field axm-zone-field axm-hidden">Zone direction<select id="axmZone"></select></label>' +
        '<label class="axm-field axm-road-field axm-hidden">Connect to<select id="axmRoadTo"></select></label>' +
        '<div class="axm-buttons"><button id="axmPreview" type="button">Preview only</button><button id="axmCreate" class="primary" type="button">Create proposal</button></div>' +
        '<div id="axmPreviewBox" class="axm-preview">Previewing never spends or changes the world.</div>' +
        '<div id="axmProposalBox" class="axm-proposal">No proposal selected.</div>' +
        '<div class="axm-buttons"><button id="axmApprove" class="primary" type="button" disabled>Approve—not apply</button><button id="axmReject" class="danger" type="button" disabled>Reject</button><button id="axmApply" class="warn" type="button" disabled>Apply approved change</button><button id="axmUndo" type="button" disabled>Undo latest apply</button></div>' +
      '</div></details>' +
      '<details class="axm-steward-section"><summary>District evidence</summary><div id="axmDistricts" class="axm-details-body"></div></details>' +
      '<details class="axm-steward-section"><summary>Receipts · consequence trail</summary><div id="axmReceipts" class="axm-details-body"></div></details>' +
      '<details class="axm-steward-section"><summary>Tycoon Steward handoff</summary><div class="axm-details-body"><div class="axm-buttons"><a class="axm-link-button" href="game/tycoon-steward/index.html" target="_blank" rel="noopener">Open full Tycoon Steward map</a><button id="axmExport" type="button">Export globe bridge packet</button><button id="axmImport" type="button">Import Tycoon proposal</button></div><input id="axmImportFile" type="file" accept="application/json,.json" hidden><p class="axm-boundary">The Tycoon ruleset may read declared snapshots and submit allowlisted proposals. The living world still validates identity, revision, costs, review and application separately.</p></div></details>' +
      '<section class="axm-steward-section"><p class="axm-boundary">This independent local experiment uses original satire and procedural shapes. Weather, ecology, species, resources, prices, labor, population, factions and elections are compact gameplay abstractions—not science, financial or policy advice, people tracking or proof of balance. Visible hares and foxes remain declared proxies for native ground life and introduced predators.</p></section>';
    document.body.appendChild(toggle); document.body.appendChild(panel);

    var ids = {};
    ['axmHeadline','axmCabinetLine','axmPulse','axmEconomyBrief','axmMeta','axmEconomy','axmDilemma','axmEdict','axmEdictPreview','axmIssueEdict','axmReason','axmAdvance','axmStatus','axmFactions','axmEcology','axmOperation','axmDistrict','axmService','axmZone','axmRoadTo','axmPreview','axmCreate','axmPreviewBox','axmProposalBox','axmApprove','axmReject','axmApply','axmUndo','axmDistricts','axmReceipts','axmExport','axmImport','axmImportFile'].forEach(function (id) { ids[id] = document.getElementById(id); });
    var selectedProposalId = null;

    root.AXMLivingState.SERVICES.forEach(function (name) { var option = element('option', '', words(name)); option.value = name; ids.axmService.appendChild(option); });
    root.AXMLivingState.ZONES.forEach(function (name) { var option = element('option', '', words(name)); option.value = name; ids.axmZone.appendChild(option); });
    root.AXMLivingState.EDICT_ORDER.forEach(function (id, index) { var option = element('option', '', root.AXMLivingState.EDICTS[id].label); option.value = id; option.selected = index === 0; ids.axmEdict.appendChild(option); });

    function reason() { return ids.axmReason.value.trim(); }
    function setStatus(message, error) { ids.axmStatus.textContent = String(message); ids.axmStatus.className = 'axm-status ' + (error ? 'error' : 'ok'); }
    function latestProposal(state) {
      if (selectedProposalId) return state.proposals.filter(function (proposal) { return proposal.id === selectedProposalId; })[0] || null;
      return state.proposals.length ? state.proposals[state.proposals.length - 1] : null;
    }
    function operation() {
      var type = ids.axmOperation.value, districtId = ids.axmDistrict.value;
      if (type === 'PROPOSE_SERVICE') return { type: type, payload: { districtId: districtId, service: ids.axmService.value } };
      if (type === 'PROPOSE_DISTRICT') return { type: type, payload: { districtId: districtId, zone: ids.axmZone.value } };
      if (type === 'PROPOSE_ROAD') return { type: type, payload: { fromDistrictId: districtId, toDistrictId: ids.axmRoadTo.value } };
      return { type: type, payload: { districtId: districtId } };
    }
    function showOperationFields() {
      var type = ids.axmOperation.value;
      panel.querySelector('.axm-service-field').classList.toggle('axm-hidden', type !== 'PROPOSE_SERVICE');
      panel.querySelector('.axm-zone-field').classList.toggle('axm-hidden', type !== 'PROPOSE_DISTRICT');
      panel.querySelector('.axm-road-field').classList.toggle('axm-hidden', type !== 'PROPOSE_ROAD');
    }
    function metric(parent, label, value, tone) {
      var box = element('div', 'axm-pulse ' + (tone || '')); box.appendChild(element('span', '', label)); box.appendChild(element('strong', '', value)); parent.appendChild(box);
    }
    function renderDilemma(state) {
      ids.axmDilemma.replaceChildren();
      var dilemma = state.society.currentDilemma;
      if (!dilemma) {
        ids.axmDilemma.appendChild(element('div', 'axm-no-dilemma', 'The cabinet has no crisis in the queue. This is either excellent stewardship or a filing delay. Advance a quarter when ready.'));
        return;
      }
      ids.axmDilemma.appendChild(element('h3', 'axm-dilemma-title', dilemma.title));
      ids.axmDilemma.appendChild(element('p', 'axm-dilemma-brief', dilemma.briefing));
      var choices = element('div', 'axm-choice-list');
      dilemma.choices.forEach(function (choice) {
        var button = element('button', 'axm-choice', ''); button.type = 'button';
        var resourceEffects = Object.keys(choice.effects && choice.effects.resources || {}).map(function (name) { return name + ' ' + signed(choice.effects.resources[name]); });
        button.appendChild(element('strong', '', choice.label)); button.appendChild(element('span', '', choice.summary + (resourceEffects.length ? ' · ' + resourceEffects.join(' · ') : ' · no resource cost')));
        button.addEventListener('click', function () { handle(bridge.resolveDilemma(dilemma.id, choice.id, reason()), 'Decision recorded. The island—not the palace headline—gets the consequences.'); });
        choices.appendChild(button);
      });
      ids.axmDilemma.appendChild(choices);
      ids.axmDilemma.appendChild(element('small', 'axm-choice-note', 'No choice is automatic. Unaffordable choices are refused without partial effects.'));
    }
    function renderEdict() {
      var preview = bridge.previewEdict(ids.axmEdict.value);
      if (!preview.label) { ids.axmEdictPreview.textContent = (preview.errors || ['Unknown edict.']).join(' · '); ids.axmIssueEdict.disabled = true; return; }
      var factions = Object.keys(preview.factionEffects || {}).filter(function (id) { return preview.factionEffects[id]; }).map(function (id) { return words(id) + ' ' + signed(preview.factionEffects[id]); });
      ids.axmEdictPreview.textContent = preview.summary + '\nDuration: ' + preview.duration + ' quarter' + (preview.duration === 1 ? '' : 's') + ' · cost: ' + costs(preview.costs) + '\nFaction response: ' + (factions.join(' · ') || 'neutral') + (preview.errors.length ? '\nUnavailable: ' + preview.errors.join(' · ') : '');
      ids.axmIssueEdict.disabled = !preview.ok;
    }
    function renderEconomy(state) {
      var economy = state.economy, treasury = economy.treasury;
      ids.axmEconomy.replaceChildren();
      var headline = element('div', 'axm-books-head');
      headline.appendChild(element('strong', treasury.net < 0 ? 'falling' : 'rising', 'Treasury ' + money(treasury.net) + ' this quarter'));
      headline.appendChild(element('span', '', 'income ' + money(treasury.produced) + ' · expenses ¤' + treasury.consumed + ' · balance ¤' + treasury.closingFunds));
      ids.axmEconomy.appendChild(headline);

      var incomeGrid = element('div', 'axm-book-grid');
      Object.keys(treasury.income).filter(function (id) { return id !== 'total' && treasury.income[id]; }).forEach(function (id) {
        var row = element('div', 'axm-book-row'); row.appendChild(element('span', '', words(id))); row.appendChild(element('strong', '', money(treasury.income[id]))); incomeGrid.appendChild(row);
      });
      Object.keys(treasury.expenses).filter(function (id) { return id !== 'total' && treasury.expenses[id]; }).forEach(function (id) {
        var row = element('div', 'axm-book-row expense'); row.appendChild(element('span', '', words(id))); row.appendChild(element('strong', '', '−¤' + treasury.expenses[id])); incomeGrid.appendChild(row);
      });
      if (!incomeGrid.children.length) incomeGrid.appendChild(element('div', 'axm-book-note', 'No quarter is on the books yet. Advance time when you want the island to trade, work and pay its bills.'));
      ids.axmEconomy.appendChild(incomeGrid);

      ids.axmEconomy.appendChild(element('h4', '', 'SECTORS'));
      var sectorGrid = element('div', 'axm-sector-grid');
      root.AXMLivingState.SECTOR_ORDER.forEach(function (id) {
        var sector = economy.sectors[id], card = element('div', 'axm-sector-card');
        card.appendChild(element('strong', '', sector.label));
        card.appendChild(element('span', '', 'sales ' + money(sector.grossRevenue) + ' · wages ¤' + sector.wageBill + ' · inputs ¤' + sector.inputCosts));
        card.appendChild(element('span', sector.treasuryContribution < 0 ? 'falling' : 'rising', 'treasury ' + money(sector.treasuryContribution)));
        card.appendChild(element('small', '', sector.outputNote)); sectorGrid.appendChild(card);
      });
      ids.axmEconomy.appendChild(sectorGrid);

      var supply = state.supply;
      ids.axmEconomy.appendChild(element('h4', '', 'PRODUCT CHAINS · DEEP LEDGER'));
      ids.axmEconomy.appendChild(element('div', 'axm-supply-headline', supply.casualHeadline));
      var supplyPulse = element('div', 'axm-compact-grid');
      [
        ['Active firms', supply.enterprises.filter(function (firm) { return firm.lifecycle === 'ACTIVE'; }).length],
        ['Idle firms', supply.enterprises.filter(function (firm) { return firm.lifecycle === 'IDLE'; }).length],
        ['Private capital', '¤' + supply.finance.businessCapital],
        ['Trade-ready lots', supply.tradeReadiness.lots.length]
      ].forEach(function (entry) { var card = element('div', 'axm-compact-card'); card.appendChild(element('strong', '', entry[0])); card.appendChild(element('span', '', entry[1])); supplyPulse.appendChild(card); });
      ids.axmEconomy.appendChild(supplyPulse);
      var goodsGrid = element('div', 'axm-book-grid');
      root.AXMLivingState.GOOD_ORDER.slice().sort(function (a, b) {
        var pa = supply.inventory[a].price / supply.inventory[a].referencePrice, pb = supply.inventory[b].price / supply.inventory[b].referencePrice;
        return pb - pa || a.localeCompare(b);
      }).slice(0, 10).forEach(function (id) {
        var good = supply.inventory[id], row = element('div', 'axm-price-row');
        var label = element('div', ''); label.appendChild(element('strong', '', good.label)); label.appendChild(element('small', '', words(good.stage) + ' · ' + good.stock + '/' + good.capacity + ' ' + good.unit)); row.appendChild(label);
        row.appendChild(element('span', good.price > good.referencePrice * 1.12 ? 'warn' : good.price < good.referencePrice * 0.88 ? 'good' : '', '¤' + good.price + ' · ref ¤' + good.referencePrice)); goodsGrid.appendChild(row);
      });
      ids.axmEconomy.appendChild(goodsGrid);
      ids.axmEconomy.appendChild(element('div', 'axm-trade-line', supply.market.explanation + '\n' + supply.tradeReadiness.explanation + '\nExternal typed trade is not connected; these lots remain on the island until a later explicit trade system exists.'));

      ids.axmEconomy.appendChild(element('h4', '', 'LIVING COSTS · CAUSED BY RESERVES'));
      var priceGrid = element('div', 'axm-book-grid');
      root.AXMLivingState.PRICE_ORDER.forEach(function (id) {
        var price = economy.prices[id], row = element('div', 'axm-price-row');
        var label = element('div', ''); label.appendChild(element('strong', '', price.label)); label.appendChild(element('small', '', price.explanation)); row.appendChild(label);
        row.appendChild(element('span', price.current > price.reference * 1.08 ? 'warn' : price.current < price.reference * 0.92 ? 'good' : '', '¤' + price.current + ' · ref ¤' + price.reference)); priceGrid.appendChild(row);
      });
      ids.axmEconomy.appendChild(priceGrid);
      ids.axmEconomy.appendChild(element('div', 'axm-labor-line', 'Labor force ' + economy.labor.laborForce + ' · employed ' + economy.labor.employed + ' · unemployment ' + Math.round(economy.labor.unemploymentRate * 100) + '% · wage ¤' + economy.labor.wagePerWorker + ' · productivity ' + Math.round(economy.labor.productivity * 100) + '%\nFormal work ' + economy.labor.formalEmployed + ' · local livelihoods ' + economy.labor.localLivelihoodEmployed + '\n' + economy.labor.explanation));
      ids.axmEconomy.appendChild(element('div', 'axm-trade-line', economy.trade.explanation + '\nVisitors ' + (economy.ledger.length ? economy.ledger[economy.ledger.length - 1].visitors : 0) + ' · civic export revenue ¤' + economy.trade.exportRevenue + ' · protected civic material reserve ' + economy.trade.reserveTarget + '\nHouseholds kept ' + money(economy.households.retainedIncome) + ' after spending and taxes, including ' + money(economy.households.localLivelihoodIncome) + ' from local fishing, repair, care and household work. Private money is not palace money.'));
    }
    function render() {
      var state = bridge.observeState(), summary = bridge.summary(), society = state.society;
      var latestHeadline = society.headlines[society.headlines.length - 1];
      ids.axmHeadline.textContent = latestHeadline ? latestHeadline.text : 'PALACE RADIO IS CHECKING ITS MICROPHONE';
      ids.axmCabinetLine.textContent = society.lastCabinetLine;
      ids.axmPulse.replaceChildren();
      metric(ids.axmPulse, 'Public approval', Math.round(society.publicApproval) + '%', society.publicApproval < 45 ? 'bad' : 'good');
      metric(ids.axmPulse, 'Treasury', money(state.economy.treasury.net), state.economy.treasury.net < 0 ? 'bad' : state.economy.treasury.net > 0 ? 'good' : '');
      metric(ids.axmPulse, 'Living costs', state.economy.consumerPriceIndex, state.economy.consumerPriceIndex > 115 ? 'bad' : state.economy.consumerPriceIndex > 105 ? 'warn' : 'good');
      metric(ids.axmPulse, 'Election', society.election.quartersUntilElection + ' qtrs', society.election.quartersUntilElection <= 2 ? 'warn' : '');
      ids.axmEconomyBrief.textContent = state.supply.casualHeadline + '\nTreasury ' + money(state.economy.treasury.net) + ' · private product sales ¤' + state.supply.market.salesRevenue + ' · industry tax/share ' + money(state.economy.sectors.industry.treasuryContribution) + ' · trade-ready lots ' + state.supply.tradeReadiness.lots.length;
      ids.axmMeta.textContent = 'Year ' + state.calendar.year + ' · Q' + state.calendar.quarter + ' · ' + words(state.calendar.season) + ' · ' + state.climate.temperatureC + ' °C · rain ' + state.climate.rainfallMm + ' mm' + (state.climate.rainfallRegime ? ' (' + words(state.climate.rainfallRegime) + ')' : '') + ' · rev ' + state.revision;

      renderEconomy(state);
      renderDilemma(state);
      renderEdict();

      ids.axmFactions.replaceChildren();
      root.AXMLivingState.FACTION_ORDER.forEach(function (id) {
        var faction = society.factions[id], card = element('div', 'axm-faction');
        var head = element('div', 'axm-faction-head'); head.appendChild(element('strong', '', faction.label)); head.appendChild(element('span', faction.trend < 0 ? 'falling' : faction.trend > 0 ? 'rising' : '', Math.round(faction.support) + '% ' + (faction.trend ? signed(faction.trend) : ''))); card.appendChild(head);
        card.appendChild(element('small', '', faction.request)); ids.axmFactions.appendChild(card);
      });

      ids.axmEcology.replaceChildren();
      var ecoSummary = element('div', 'axm-eco-summary', 'Food web ' + Math.round(state.ecologyDynamics.foodWebHealth * 100) + '% · pollination ' + Math.round(state.ecologyDynamics.pollinationService * 100) + '% · insect control ' + Math.round(state.ecologyDynamics.naturalPestControl * 100) + '% · seed dispersal ' + Math.round(state.ecologyDynamics.seedDispersalService * 100) + '% · shore recycling ' + Math.round(state.ecologyDynamics.shorelineRecycling * 100) + '% · pest pressure ' + Math.round(state.ecologyDynamics.pestPressure * 100) + '% · introduced pressure ' + Math.round(state.ecologyDynamics.invasivePressure * 100) + '%'); ids.axmEcology.appendChild(ecoSummary);
      var habitatGrid = element('div', 'axm-compact-grid');
      root.AXMLivingState.HABITAT_ORDER.forEach(function (id) { var habitat = state.habitats[id], card = element('div', 'axm-compact-card'); card.appendChild(element('strong', '', habitat.label)); card.appendChild(element('span', '', 'quality ' + Math.round(habitat.quality) + ' · links ' + Math.round(habitat.connectivity))); habitatGrid.appendChild(card); });
      ids.axmEcology.appendChild(habitatGrid);
      var speciesGrid = element('div', 'axm-species-list');
      root.AXMLivingState.SPECIES_ORDER.forEach(function (id) { var species = state.inhabitants[id], row = element('div', 'axm-species'); row.title = species.role; row.appendChild(element('span', '', species.label)); row.appendChild(element('strong', species.trend < 0 ? 'falling' : species.trend > 0 ? 'rising' : '', species.population + '/' + species.capacity + (species.trend ? ' ' + signed(species.trend) : '') + (species.status !== 'PRESENT' ? ' · ' + words(species.status) : ''))); speciesGrid.appendChild(row); });
      ids.axmEcology.appendChild(speciesGrid);

      var priorDistrict = ids.axmDistrict.value, priorRoad = ids.axmRoadTo.value;
      ids.axmDistrict.replaceChildren(); ids.axmRoadTo.replaceChildren();
      state.districts.forEach(function (district) {
        var a = element('option', '', district.name); a.value = district.id; ids.axmDistrict.appendChild(a);
        var b = element('option', '', district.name); b.value = district.id; ids.axmRoadTo.appendChild(b);
      });
      if (state.districts.some(function (district) { return district.id === priorDistrict; })) ids.axmDistrict.value = priorDistrict;
      if (state.districts.some(function (district) { return district.id === priorRoad; })) ids.axmRoadTo.value = priorRoad;
      if (ids.axmRoadTo.value === ids.axmDistrict.value && state.districts.length > 1) ids.axmRoadTo.selectedIndex = (ids.axmDistrict.selectedIndex + 1) % state.districts.length;

      ids.axmDistricts.replaceChildren();
      state.districts.forEach(function (district) {
        var card = element('div', 'axm-district'), head = element('div', 'axm-district-head');
        head.appendChild(element('strong', '', district.name)); head.appendChild(element('span', '', words(district.zone) + ' · ' + words(district.habitat))); card.appendChild(head);
        card.appendChild(element('small', '', 'pop ' + district.population + '/' + district.housingCapacity + ' · jobs ' + district.jobs + ' · water ' + district.people.waterAccess + ' · health ' + district.people.health));
        card.appendChild(element('small', '', 'soil ' + Math.round(district.soil.fertility * 100) + '% · moisture ' + Math.round(district.soil.moisture * 100) + '% · biodiversity ' + district.ecology.biodiversity + ' · pollution ' + district.ecology.pollution));
        var deposits = state.supply.deposits[district.id], strongest = Object.keys(deposits).sort(function (a, b) { return deposits[b].quality - deposits[a].quality || a.localeCompare(b); }).slice(0, 2);
        var firms = state.supply.enterprises.filter(function (enterprise) { return enterprise.districtId === district.id && enterprise.lifecycle !== 'CLOSED'; });
        card.appendChild(element('small', '', 'underfoot: ' + strongest.map(function (id) { return words(id) + ' ' + Math.round(deposits[id].quality); }).join(' · ') + ' · firms: ' + (firms.length ? firms.map(function (firm) { return words(firm.type); }).join(', ') : 'none yet')));
        var gaps = Object.keys(district.needs).filter(function (key) { return district.needs[key] > 0; }).map(function (key) { return words(key) + ' ' + district.needs[key]; });
        card.appendChild(element('small', '', gaps.length ? 'pressures: ' + gaps.join(' · ') : 'no measured gap in the current rules')); ids.axmDistricts.appendChild(card);
      });

      var proposal = latestProposal(state), currentRevision = state.revision;
      if (proposal) {
        selectedProposalId = proposal.id;
        ids.axmProposalBox.textContent = proposal.id + '\nstatus: ' + proposal.status + '\ntarget revision: ' + proposal.targetRevision + '\ncosts: ' + costs(proposal.estimatedCosts) + '\n\n' + costStory(proposal.economicBreakdowns) + '\n\nEffects: ' + proposal.expectedEffects.join(' ') + '\nRisks: ' + proposal.risks.join(' ');
      } else ids.axmProposalBox.textContent = 'No proposal selected.';
      ids.axmApprove.disabled = !proposal || proposal.status !== 'PROPOSAL_ONLY' || proposal.targetRevision !== currentRevision;
      ids.axmReject.disabled = !proposal || proposal.status !== 'PROPOSAL_ONLY';
      ids.axmApply.disabled = !proposal || proposal.status !== 'APPROVED_NOT_APPLIED' || proposal.targetRevision !== currentRevision;
      ids.axmUndo.disabled = !proposal || proposal.status !== 'APPLIED' || proposal.appliedRevision !== currentRevision;

      ids.axmReceipts.replaceChildren();
      state.receipts.slice(-10).reverse().forEach(function (receipt) { ids.axmReceipts.appendChild(element('div', 'axm-receipt', '#' + receipt.sequence + ' · ' + words(receipt.kind) + ' · rev ' + receipt.worldRevision + '\n' + receipt.reason)); });
      if (!state.receipts.length) ids.axmReceipts.appendChild(element('div', 'axm-receipt', 'No receipt yet. Even bureaucracy must begin somewhere.'));
      showOperationFields();
    }

    function handle(result, success) {
      if (result && result.ok) { setStatus(success, false); render(); return true; }
      setStatus((result && result.errors || ['Action refused.']).join(' · '), true); render(); return false;
    }

    var closeButton = panel.querySelector('.axm-steward-close');
    function announceOpen() { try { root.dispatchEvent(new CustomEvent('axm-palace-open')); } catch (error) {} }
    function open(syncNative) {
      announceOpen(); panel.classList.add('open'); panel.setAttribute('aria-hidden', 'false'); document.body.classList.add('axm-palace-open'); toggle.setAttribute('aria-expanded', 'true');
      if (syncNative) bridge.syncNativeObservation(); render(); closeButton.focus();
    }
    function close(focusToggle) {
      panel.classList.remove('open'); panel.setAttribute('aria-hidden', 'true'); document.body.classList.remove('axm-palace-open'); toggle.setAttribute('aria-expanded', 'false');
      if (focusToggle) toggle.focus();
    }
    toggle.addEventListener('click', function (event) { event.stopPropagation(); if (panel.classList.contains('open')) close(true); else open(true); });
    closeButton.addEventListener('click', function () { close(true); });
    root.addEventListener('keydown', function (event) { if (event.key === 'Escape' && panel.classList.contains('open')) { event.preventDefault(); close(true); } });
    ['pointerdown','pointerup','click','wheel','touchstart'].forEach(function (name) { panel.addEventListener(name, function (event) { event.stopPropagation(); }, { passive: name === 'wheel' || name === 'touchstart' }); });
    ids.axmOperation.addEventListener('change', showOperationFields);
    ids.axmDistrict.addEventListener('change', function () { if (ids.axmRoadTo.value === ids.axmDistrict.value) ids.axmRoadTo.selectedIndex = (ids.axmDistrict.selectedIndex + 1) % ids.axmRoadTo.options.length; });
    ids.axmEdict.addEventListener('change', renderEdict);
    ids.axmIssueEdict.addEventListener('click', function () { handle(bridge.issueEdict(ids.axmEdict.value, reason()), 'Edict issued with visible costs and an expiry date. The palace is delighted with the stationery.'); });
    ids.axmPreview.addEventListener('click', function () {
      var preview = bridge.previewOperations([operation()]);
      ids.axmPreviewBox.textContent = (preview.affordable ? 'Affordable under current stocks.' : 'Not currently valid or affordable.') + '\nNo change applied.\nCosts: ' + costs(preview.estimatedCosts) + '\n\n' + costStory(preview.economicBreakdowns) + '\n\nEffects: ' + preview.expectedEffects.join(' ') + '\nRisks: ' + preview.risks.join(' ') + (preview.errors.length ? '\nRefused: ' + preview.errors.join(' · ') : '');
      setStatus('Preview refreshed. The world was not changed.', false); render();
    });
    ids.axmCreate.addEventListener('click', function () { var result = bridge.createProposal([operation()], reason()); if (result.ok) selectedProposalId = result.proposal.id; handle(result, 'Proposal created. It is waiting for a separate review.'); });
    ids.axmApprove.addEventListener('click', function () { var proposal = latestProposal(bridge.observeState()); if (proposal) handle(bridge.reviewProposal(proposal.id, 'APPROVE', reason()), 'Proposal approved, but still not applied.'); });
    ids.axmReject.addEventListener('click', function () { var proposal = latestProposal(bridge.observeState()); if (proposal) handle(bridge.reviewProposal(proposal.id, 'REJECT', reason()), 'Proposal rejected and retained in the receipt trail.'); });
    ids.axmApply.addEventListener('click', function () { var proposal = latestProposal(bridge.observeState()); if (proposal) handle(bridge.applyApprovedProposal(proposal.id, proposal.approvalToken, reason()), 'Approved proposal applied to the local strategic world state.'); });
    ids.axmUndo.addEventListener('click', function () { var proposal = latestProposal(bridge.observeState()); if (proposal) handle(bridge.undoProposal(proposal.id, reason()), 'Latest applied proposal was reversed.'); });
    ids.axmAdvance.addEventListener('click', function () { handle(bridge.advanceQuarter(reason()), 'One strategic quarter advanced. Palace Radio is already taking credit.'); });
    ids.axmExport.addEventListener('click', function () { downloadJson('axm-living-globe-bridge-rev-' + bridge.summary().revision + '.json', bridge.exportPacket()); setStatus('Bridge packet exported locally.', false); });
    ids.axmImport.addEventListener('click', function () { ids.axmImportFile.click(); });
    ids.axmImportFile.addEventListener('change', function (event) {
      var file = event.target.files && event.target.files[0]; event.target.value = ''; if (!file) return;
      if (file.size > 1024 * 1024) { setStatus('Import refused: proposal exceeds 1 MB.', true); return; }
      var reader = new FileReader();
      reader.onload = function () {
        try { var packet = JSON.parse(String(reader.result)); var result = bridge.submitCityPatchProposal(packet); if (result.ok) selectedProposalId = result.proposal.id; handle(result, 'Tycoon proposal imported for local review; it was not applied.'); }
        catch (error) { setStatus('Import refused: ' + error.message, true); }
      };
      reader.onerror = function () { setStatus('Import refused: file could not be read.', true); };
      reader.readAsText(file);
    });

    render();
    return { refresh: render, open: function () { open(false); }, close: function () { close(false); }, isOpen: function () { return panel.classList.contains('open'); } };
  }

  root.AXMGlobeStewardPanel = { mount: mount };
})(typeof globalThis !== 'undefined' ? globalThis : this);
