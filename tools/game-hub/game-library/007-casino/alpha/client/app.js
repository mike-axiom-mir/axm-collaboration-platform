(function () {
  "use strict";

  var app = document.getElementById("app");
  var toast = document.getElementById("toast");
  var params = new URLSearchParams(window.location.search);
  var playIntent = params.get("play") === "1";
  var requestedRole = params.get("role");
  var role = requestedRole === "controller" ? "controller" : (requestedRole === "party" ? "party" : "host");
  var seatId = params.get("seat") || "";
  var seatToken = params.get("token") || "";
  var partyId = String(params.get("party") || "").toUpperCase();
  var partyToken = params.get("token") || "";
  var hostToken = "";
  var launch = null;
  var state = null;
  var sequence = 0;
  var pollTimer = null;
  var selectedMode = "backroom_story";
  var toastTimer = null;
  var lastVisualDrawIndex = null;
  var recentResults = [];
  var soundEnabled = readSoundPreference();
  var audioContext = null;
  var audioUnlocked = false;
  var lastControllerRenderKey = "";
  var controllerLinkState = "connecting";
  var spinAnimationStartedAt = 0;
  var wheelFaces = ["−30%", "−15%", "−5%", "+5%", "+25%", "+35%"];
  var starterStyleIds = ["lux-5", "graftgarden", "mirror-mice", "night-courier", "pocket-vault", "weatherheart", "spare-parts-choir", "nullbloom", "orbit-oven", "twinlight-relay"];

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[character];
    });
  }

  function money(value) {
    if (value == null) return "hidden";
    return Number(value).toLocaleString(undefined, { minimumFractionDigits: Number(value) % 1 ? 2 : 0, maximumFractionDigits: 2 });
  }

  function duration(milliseconds) {
    if (milliseconds == null) return "STORY";
    var seconds = Math.max(0, Math.ceil(milliseconds / 1000));
    var minutes = Math.floor(seconds / 60);
    return String(minutes).padStart(2, "0") + ":" + String(seconds % 60).padStart(2, "0");
  }

  function readSoundPreference() {
    try { return window.localStorage.getItem("axm-casino-sound-v1") !== "off"; }
    catch (_) { return true; }
  }

  function storeSoundPreference() {
    try { window.localStorage.setItem("axm-casino-sound-v1", soundEnabled ? "on" : "off"); }
    catch (_) { /* Private browsing may reject local preferences; play still works. */ }
  }

  function unlockAudio() {
    if (!soundEnabled) return;
    var AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    if (!audioContext) audioContext = new AudioContextClass();
    audioUnlocked = true;
    if (audioContext.state === "suspended") audioContext.resume().catch(function () {});
  }

  function playTone(frequency, delay, length, wave, volume) {
    if (!soundEnabled || !audioUnlocked || !audioContext) return;
    var start = audioContext.currentTime + (delay || 0);
    var oscillator = audioContext.createOscillator();
    var gain = audioContext.createGain();
    oscillator.type = wave || "sine";
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume || 0.035, start + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(start);
    oscillator.stop(start + length + 0.025);
  }

  function playCue(kind) {
    if (kind === "spin") {
      playTone(210, 0, .07, "square", .018);
      playTone(315, .06, .08, "square", .014);
    } else if (kind === "quiet") {
      playTone(190, 0, .12, "triangle", .018);
      playTone(145, .09, .16, "triangle", .015);
    } else if (kind === "winner" || kind === "return") {
      playTone(440, 0, .18, "sine", .026);
      playTone(660, .06, .22, "sine", .025);
    } else if (kind === "nice" || kind === "big") {
      [392, 523, 659, 784].forEach(function (note, index) { playTone(note, index * .07, .3, "triangle", .025); });
    } else if (kind === "mega") {
      [330, 440, 554, 659, 880].forEach(function (note, index) { playTone(note, index * .055, .42, index % 2 ? "sine" : "triangle", .028); });
    } else if (kind === "wheel") {
      [280, 340, 410, 500, 610, 740].forEach(function (note, index) { playTone(note, index * .055, .14, "square", .018); });
    } else if (kind === "jackpot") {
      [262, 330, 392, 523, 659, 784, 1047].forEach(function (note, index) { playTone(note, index * .075, .5, "triangle", .03); });
    } else if (kind === "bonus") {
      [523, 659, 784, 1047].forEach(function (note, index) { playTone(note, index * .09, .36, index % 2 ? "sine" : "triangle", .028); });
    } else if (kind === "toggle") {
      playTone(523, 0, .12, "sine", .025);
      playTone(784, .08, .18, "sine", .022);
    }
  }

  function payoutTier(spin) {
    if (!spin) return { id: "idle", label: "READY", multiplier: 0 };
    var wager = Math.max(0, Number(spin.wager) || 0);
    var payout = Math.max(0, Number(spin.totalPayout) || 0);
    var multiplier = wager > 0 ? payout / wager : 0;
    if (spin.jackpotHit) return { id: "jackpot", label: "PROGRESSIVE", multiplier: multiplier };
    if (multiplier >= 10) return { id: "mega", label: "MEGA WIN", multiplier: multiplier };
    if (multiplier >= 5) return { id: "big", label: "BIG WIN", multiplier: multiplier };
    if (multiplier >= 2) return { id: "nice", label: "NICE WIN", multiplier: multiplier };
    if (payout > 0) return { id: "return", label: "RETURN", multiplier: multiplier };
    return { id: "quiet", label: "NO WIN", multiplier: 0 };
  }

  function multiplierText(multiplier) {
    if (!Number.isFinite(multiplier)) return "×0";
    return "×" + multiplier.toFixed(multiplier >= 10 ? 1 : 2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
  }

  function rememberSettlement(spin) {
    if (!spin || recentResults.some(function (item) { return item.drawIndex === spin.drawIndex; })) return;
    var tier = payoutTier(spin);
    recentResults.push({
      drawIndex: spin.drawIndex,
      wager: Number(spin.wager) || 0,
      payout: Number(spin.totalPayout) || 0,
      tier: tier.id,
      multiplier: tier.multiplier,
      wheelTriggered: Boolean(spin.wheelTriggered),
      jackpotHit: Boolean(spin.jackpotHit)
    });
    recentResults = recentResults.slice(-6);
  }

  function recentResultStrip() {
    var contents = recentResults.length ? recentResults.slice().reverse().map(function (item) {
      var label = item.jackpotHit ? "JACKPOT" : (item.payout > 0 ? multiplierText(item.multiplier) : "MISS");
      return '<span class="result-chip tier-' + escapeHtml(item.tier) + '" title="Draw ' + item.drawIndex + ' · wager ' + money(item.wager) + ' · payout ' + money(item.payout) + '"><i>' + (item.wheelTriggered ? '◉' : '◆') + '</i><strong>' + escapeHtml(label) + '</strong><small>#' + item.drawIndex + '</small></span>';
    }).join("") : '<span class="result-empty">Your settled draws will appear here.</span>';
    return '<section class="result-trail" aria-label="Recent personal results"><div class="result-trail-heading"><span>YOUR LAST SIX</span><small>HISTORY ONLY · NEVER A FORECAST</small></div><div class="result-chips">' + contents + '</div></section>';
  }

  function riskPanel(player, free) {
    var wager = Math.max(0, Number(player.selectedWager) || 0);
    var wallet = Math.max(0, Number(player.wallet) || 0);
    var percent = wallet > 0 ? wager / wallet * 100 : 100;
    var level = free ? 0 : Math.max(1, Math.min(10, Math.ceil(percent)));
    var bars = Array.from({ length: 10 }, function (_, index) { return '<i' + (index < level ? ' class="active"' : '') + '></i>'; }).join("");
    var label = free ? "Free spin · bet stays locked to its awarding cabinet" : (percent < .1 ? "<0.1" : percent.toFixed(percent >= 10 ? 0 : 1)) + "% of wallet · jackpot cap 100× this bet";
    return '<section class="risk-panel risk-level-' + level + '"><div><span>NEXT-SPIN EXPOSURE</span><strong>' + escapeHtml(label) + '</strong></div><div class="risk-meter" aria-hidden="true">' + bars + '</div><small>Higher wager means more upside and more choke risk. The machine never reads your wallet.</small></section>';
  }

  function bonusTheater(spin) {
    if (!spin || (!spin.wheelTriggered && !spin.jackpotHit && !spin.freeSpinsAwarded)) return "";
    if (Number(spin.freeSpinsAwarded) > 0 && !spin.jackpotHit) {
      return '<div class="overdrive-theater free-spin-theater" role="status" aria-label="' + Number(spin.freeSpinsAwarded) + ' free spins awarded"><div class="free-spin-burst"><small>BONUS UNLOCKED</small><strong>+' + Number(spin.freeSpinsAwarded) + '</strong><span>FREE SPINS</span><i></i><i></i><i></i><i></i></div><div class="theater-caption">BANKED ON THIS CABINET · PRESS SPIN TO USE</div></div>';
    }
    var index = Number.isInteger(Number(spin.wheelIndex)) ? Math.max(0, Math.min(5, Number(spin.wheelIndex))) : 0;
    var jackpot = Boolean(spin.jackpotHit);
    var faces = wheelFaces.map(function (face, faceIndex) {
      return '<span class="wheel-face face-' + faceIndex + (faceIndex === index ? ' selected' : '') + '">' + (jackpot ? '★' : escapeHtml(face)) + '</span>';
    }).join("");
    var center = jackpot ? "JACKPOT" : wheelFaces[index];
    var aria = jackpot ? "Robot transformed into the progressive jackpot spinner" : "Robot transformed into Overdrive wheel face " + wheelFaces[index];
    return '<div class="overdrive-theater ' + (jackpot ? 'jackpot-transform' : 'wheel-transform') + ' wheel-index-' + index + '" role="img" aria-label="' + escapeHtml(aria) + '"><i class="theater-pointer"></i><div class="bonus-wheel">' + faces + '<div class="wheel-core"><small>' + (jackpot ? 'PROGRESSIVE' : 'OVERDRIVE') + '</small><strong>' + escapeHtml(center) + '</strong><i></i><i></i></div></div><div class="theater-caption">' + (jackpot ? '100× BET CAP · REST STAYS IN THE POOL' : 'SIX-FACE RESULT · COMMITTED WITH THIS DRAW') + '</div></div>';
  }

  function winCallout(spin, fresh) {
    var tier = payoutTier(spin);
    if (!fresh || !spin || Number(spin.totalPayout) <= 0) return "";
    return '<div class="win-callout tier-' + escapeHtml(tier.id) + '" role="status"><small>' + escapeHtml(tier.label) + '</small><strong>' + escapeHtml(multiplierText(tier.multiplier)) + '</strong><span>+' + money(spin.totalPayout) + ' cr</span></div>';
  }

  function showToast(message, error) {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.className = "toast show" + (error ? " error" : "");
    toastTimer = setTimeout(function () { toast.className = "toast"; }, 3200);
  }

  async function requestJson(path, options) {
    var response = await fetch(path, options || {});
    var data = await response.json().catch(function () { return { ok: false, error: "invalid local response" }; });
    if (!response.ok || data.ok === false) {
      var error = new Error(data.error || "Local request failed");
      error.localResponse = true;
      throw error;
    }
    return data;
  }

  function postJson(path, value) {
    return requestJson(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(value || {})
    });
  }

  function setControllerLinkState(nextState) {
    if (role !== "controller") return false;
    var previousState = controllerLinkState;
    controllerLinkState = nextState;
    document.body.classList.toggle("controller-link-lost", nextState === "lost");
    app.setAttribute("aria-busy", nextState === "lost" ? "true" : "false");
    return previousState === "lost" && nextState === "live";
  }

  function markControllerLinkLost(message) {
    if (role !== "controller") return;
    var firstLoss = controllerLinkState !== "lost";
    setControllerLinkState("lost");
    if (state && firstLoss) renderController(true);
    if (firstLoss) showToast(message || "Local link lost · retrying", true);
  }

  function controllerRenderKey(player) {
    var contest = state.contest ? { id: state.contest.id, styleId: state.contest.styleId } : null;
    return JSON.stringify({
      status: state.status,
      result: state.result,
      player: player,
      contest: contest,
      controllerLinkState: controllerLinkState,
      styles: (state.styles || []).map(function (style) { return [style.id, style.unlocked, style.discoverable]; })
    });
  }

  function patchControllerLiveMetrics(player) {
    var wallet = app.querySelector("[data-live-wallet]");
    var jackpot = app.querySelector("[data-live-jackpot]");
    var heat = app.querySelector("[data-live-jackpot-heat]");
    var house = app.querySelector("[data-live-house]");
    var party = (state.parties || []).find(function (item) { return item.id === player.partyId; });
    if (wallet) wallet.textContent = money(player.wallet);
    if (jackpot) jackpot.textContent = money(state.jackpot);
    if (heat && state.jackpotHeat) heat.textContent = state.jackpotHeat.ready ? "HEAT READY" : "HEAT " + state.jackpotHeat.current + "/" + state.jackpotHeat.required;
    if (house && party) house.textContent = party.house == null ? party.houseStatus : money(party.house);
  }

  function centerSelectedMachine() {
    var roster = app.querySelector(".machine-roster");
    var selected = roster && roster.querySelector(".machine-card.selected");
    if (!roster || !selected) return;
    roster.scrollLeft = Math.max(0, selected.offsetLeft - (roster.clientWidth - selected.offsetWidth) / 2);
  }

  function beginSpinAnimation() {
    spinAnimationStartedAt = Date.now();
    var stage = app.querySelector(".robot-stage");
    var button = app.querySelector(".spin-button");
    if (stage) stage.classList.add("is-spinning");
    if (button) {
      button.disabled = true;
      button.textContent = "REELS SPINNING…";
    }
  }

  function waitForSpinAnimation() {
    var remaining = Math.max(0, 720 - (Date.now() - spinAnimationStartedAt));
    return new Promise(function (resolve) { setTimeout(resolve, remaining); });
  }

  function redirectToSoloController(candidateLaunch) {
    var controllers = candidateLaunch && candidateLaunch.controllers || [];
    if (!playIntent || controllers.length !== 1 || !controllers[0].url) return false;
    window.location.replace(new URL(controllers[0].url, window.location.href).href);
    return true;
  }

  function initials(name) {
    return String(name || "?").split(/\s+/).map(function (part) { return part.charAt(0); }).join("").slice(0, 2).toUpperCase();
  }

  function modeName(mode) {
    return mode === "house_war" ? "House War" : "Free Play";
  }

  function locationName(location) {
    return { casino_a: "Glow Hearts", casino_b: "Lucky Bolts", contest: "District Contest" }[location] || location;
  }

  function partyClass(id) { return id === "A" ? "party-a" : "party-b"; }

  function styleById(styleId) {
    return (state && state.styles || []).find(function (style) { return style.id === styleId; }) || null;
  }

  function activeStyleFor(player) {
    return styleById(player && (player.activeStyleId || player.selectedStyleId)) || (state.styles || [])[0] || null;
  }

  var emblemShapes = {
    "lux-5": '<rect x="13" y="16" width="38" height="31" rx="13"/><path d="M32 7v9M28 7h8M22 29h4M38 29h4M27 38h10"/><path class="emblem-fill" d="m32 20 5 5-5 5-5-5z"/>',
    "graftgarden": '<path d="M32 54V31M32 40c-9-1-15-6-18-14 10-1 17 3 18 14Zm0-2c8-2 14-8 17-17-10 0-16 6-17 17Z"/><circle cx="32" cy="24" r="8"/><path d="M32 12v5M32 31v5M20 24h5M39 24h5M24 16l4 4M40 16l-4 4"/>',
    "mirror-mice": '<circle cx="20" cy="30" r="11"/><circle cx="44" cy="30" r="11"/><circle cx="13" cy="20" r="5"/><circle cx="51" cy="20" r="5"/><path d="M31 13v38M17 30h2M45 30h2M20 36l3 2M44 36l-3 2M8 43c8 8 16 8 23 2M56 43c-8 8-16 8-23 2"/>',
    "night-courier": '<rect x="13" y="20" width="37" height="25" rx="7"/><circle cx="21" cy="48" r="4"/><circle cx="43" cy="48" r="4"/><path d="M20 20v-6h14l7 6M20 31h23M34 25l7 6-7 6M11 12h5M47 10h6M53 16h3"/>',
    "pocket-vault": '<circle cx="32" cy="32" r="22"/><circle cx="32" cy="32" r="13"/><circle cx="32" cy="32" r="4"/><path d="M32 19v9M32 36v9M19 32h9M36 32h9"/><circle class="emblem-fill" cx="17" cy="15" r="2"/><circle class="emblem-fill" cx="47" cy="15" r="2"/><circle class="emblem-fill" cx="14" cy="48" r="2"/><circle class="emblem-fill" cx="50" cy="48" r="2"/><circle class="emblem-fill" cx="32" cy="8" r="2"/>',
    "weatherheart": '<path d="M18 42h28c8 0 10-11 3-15-2-9-14-12-20-5-8-3-16 3-14 11-6 4-3 9 3 9Z"/><path class="emblem-fill" d="M32 38c-9-5-11 7 0 13 11-6 9-18 0-13Z"/><path d="M45 11v7M53 15l-5 5M37 15l5 5M20 47l-3 6M29 47l-3 6M42 47l-3 6"/>',
    "spare-parts-choir": '<path d="M13 44V31M23 44V23M32 44V16M41 44V25M51 44V33"/><circle cx="13" cy="26" r="4"/><circle cx="23" cy="18" r="4"/><circle cx="32" cy="11" r="4"/><circle cx="41" cy="20" r="4"/><circle cx="51" cy="28" r="4"/><path d="M10 51c14 5 30 5 44 0"/>',
    "nullbloom": '<circle class="emblem-void" cx="32" cy="32" r="10"/><path d="M32 22c-9-15-17-6-10 4-15-4-17 8-4 10-11 10-2 18 8 10 2 15 14 13 13-2 10 8 18-2 10-10 15 2 20-4 10-13 4-15-8-13-3-2-5-8-3-13-13-4-15-16-4-20 10-9 17-1 10 8 15 17 6 10-4 15-11 9 15 4 17-8 5-13Z"/>',
    "orbit-oven": '<circle cx="32" cy="32" r="22"/><circle cx="32" cy="32" r="14"/><circle cx="32" cy="32" r="5"/><path d="M32 10v8M54 32h-8M32 54v-8M10 32h8"/><circle class="emblem-fill" cx="42" cy="18" r="3"/><circle class="emblem-fill" cx="20" cy="43" r="3"/><path d="M27 31h10M27 36h10"/>',
    "twinlight-relay": '<path d="M15 49V28l8-8 8 8v21M33 49V28l8-8 8 8v21M11 49h42"/><circle class="emblem-fill" cx="23" cy="33" r="3"/><circle class="emblem-fill" cx="41" cy="33" r="3"/><path d="M18 16c3-5 7-8 14-8s11 3 14 8M23 20c2-3 5-5 9-5s7 2 9 5M29 40h6"/>'
  };

  function slotEmblem(style, extraClass) {
    var shape = emblemShapes[style && style.id] || emblemShapes["lux-5"];
    return '<svg class="slot-emblem ' + escapeHtml(extraClass || '') + '" viewBox="0 0 64 64" aria-hidden="true" focusable="false">' + shape + '</svg>';
  }

  function signatureLine() {
    return '<footer class="axm-signature"><span>WORKING · LOCAL FIRST</span><strong>AXM — Axiom/Mir</strong><small>Ten fair machines. One shared district.</small></footer>';
  }

  function eventText(event) {
    var data = event.data || {};
    var labels = {
      session_started: "The casino doors opened",
      machine_interacted: (data.styleName || "A machine") + " woke up",
      machine_selected: (data.seatId || "A player") + " chose " + (data.styleName || data.styleId),
      house_funded: "House float received " + money(data.amount),
      house_withdrawn: "An attack wallet took " + money(data.amount),
      player_travelled: (data.seatId || "A player") + " travelled to " + locationName(data.location),
      spin_settled: (data.seatId || "Player") + " settled " + money(data.totalPayout) + " on " + (data.styleName || data.styleId) + " · draw " + data.drawIndex,
      npc_arrived: "A patron chose " + (data.styleName || data.styleId) + " with " + money(data.bankroll),
      npc_visit_completed: "A patron left after " + data.paidSpins + " paid spins",
      npc_changed_machine: "A patron moved to " + (data.styleName || data.styleId) + " for up to " + data.nextSegmentLength + " spins",
      jackpot_hit: (data.actorId || "Someone") + " hit the progressive for " + money(data.payout),
      jackpot_heat_ready: "Progressive heat is ready · the next matching human ticket can pay",
      free_spins_awarded: data.amount + " free spins awarded",
      contest_started: data.spotName + " opened " + (data.styleName || data.styleId) + " for two minutes",
      contest_won: "Party " + data.winnerPartyId + " claimed district traffic",
      contest_ended_no_winner: "The contest closed without a winner",
      traffic_claim_expired: data.spotId + " returned to the district",
      party_bankrupt: "Party " + data.partyId + " went bankrupt",
      session_ended: "Session ended: " + data.reason
    };
    return labels[event.type] || event.type.replace(/_/g, " ");
  }

  function renderSetup(message) {
    app.innerHTML = '<section class="setup-card">' +
      '<div class="mini-bot" aria-hidden="true"><i></i><i></i></div>' +
      '<p class="eyebrow">WORKING · LOCAL ONLY</p>' +
      '<h1>Open the backroom.</h1>' +
      '<p>' + escapeHtml(message || "Choose the first local alpha route. No session is uploaded or published.") + '</p>' +
      '<div class="setup-lightline" aria-label="Ten starting cabinets">' + starterStyleIds.map(function (styleId, index) { return '<span class="setup-light setup-light-' + (index + 1) + '" title="' + escapeHtml(styleId) + '">' + slotEmblem({ id: styleId }, 'setup-emblem') + '</span>'; }).join('') + '</div>' +
      '<div class="mode-grid">' +
        '<button class="mode-card selected" data-mode="backroom_story"><strong>Free Play</strong><span>Choose any of the ten slots immediately. No quests, searches, chapters, or unlock puzzles.</span></button>' +
        '<button class="mode-card" data-mode="house_war"><strong>House War</strong><span>Equal parties from 1v1 through 4v4 attack, switch among ten slots, and chase district contests.</span></button>' +
      '</div>' +
      '<div class="setup-controls">' +
        '<label><span id="count-label">Free-play players</span><select id="player-count"><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option></select></label>' +
        '<button class="button" id="start-session">Start local alpha</button>' +
      '</div>' +
      '<p class="status-message">A full session loads one casino-wide 50,000-position Draw Spine plus ten distinct 50,000-outcome slot books before play.</p>' +
      signatureLine() +
    '</section>';
  }

  function renderError(message) {
    app.innerHTML = '<section class="error-card"><p class="eyebrow">ALPHA STOPPED SAFELY</p><h1>Nothing was overwritten.</h1><p>' + escapeHtml(message) + '</p><button class="button secondary" id="retry">Retry local connection</button></section>';
  }

  function playersAt(location) {
    return (state.players || []).filter(function (player) { return player.location === location; }).map(function (player) {
      return '<span class="person-chip ' + partyClass(player.partyId) + '" title="' + escapeHtml(player.displayName) + '">' + escapeHtml(initials(player.displayName)) + '</span>';
    }).join("");
  }

  function nodeForSpot(spot, index) {
    var claimClass = spot.claim ? " claimed-" + spot.claim.partyId.toLowerCase() : "";
    var claim = spot.claim ? "Party " + spot.claim.partyId + (spot.claim.remainingMs == null ? " · permanent" : " · " + duration(spot.claim.remainingMs)) : "unclaimed";
    return '<div class="map-node spot-' + (index + 1) + claimClass + '"><small>' + escapeHtml(claim) + '</small><strong>' + escapeHtml(spot.name) + '</strong></div>';
  }

  function casinoNode(partyId) {
    var party = state.parties.find(function (item) { return item.id === partyId; });
    if (!party) return "";
    var location = partyId === "A" ? "casino_a" : "casino_b";
    var npcCount = state.activeNpcCounts[partyId] || 0;
    return '<div class="map-node casino-node casino-' + partyId.toLowerCase() + '">' +
      '<small>PARTY ' + partyId + ' · ' + escapeHtml(party.houseStatus) + '</small>' +
      '<strong>' + escapeHtml(party.name) + '</strong>' +
      '<div class="people">' + playersAt(location) + '</div>' +
      '<div class="npc-dots" aria-label="' + npcCount + ' active patrons">' + '●'.repeat(Math.min(4, npcCount)) + '</div>' +
    '</div>';
  }

  function renderMap() {
    var contest = state.contest;
    return '<div class="district-map">' +
      '<div class="district-atmosphere" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div>' +
      '<div class="district-marquee" aria-hidden="true"><span>AXM</span><small>LUCKY LIGHTS DISTRICT</small></div>' +
      casinoNode("A") +
      (state.mode === "house_war" ? casinoNode("B") : "") +
      state.spots.map(nodeForSpot).join("") +
      '<div class="map-node contest-node"><small>' + (contest ? duration(contest.remainingMs) : "quiet") + '</small><strong>' + (contest ? escapeHtml(contest.spotName) : "District cabinet") + '</strong><div class="people">' + playersAt("contest") + '</div></div>' +
    '</div>';
  }

  function renderParty(party) {
    var stats = party.stats || {};
    return '<article class="party-card ' + partyClass(party.id) + '">' +
      '<p class="eyebrow">PARTY ' + party.id + '</p><h3>' + escapeHtml(party.name) + '</h3>' +
      '<div class="money">' + (party.house == null ? escapeHtml(party.houseStatus) : money(party.house) + ' cr') + '</div>' +
      '<div class="substats"><div><span>PLAYER SPINS</span><strong>' + (stats.playerPaidSpins == null ? '—' : stats.playerPaidSpins) + '</strong></div><div><span>NPC SPINS</span><strong>' + (stats.npcPaidSpins == null ? '—' : stats.npcPaidSpins) + '</strong></div><div><span>CONTESTS</span><strong>' + (stats.contestsWon || 0) + '</strong></div><div><span>STATUS</span><strong>' + escapeHtml(party.houseStatus) + '</strong></div></div>' +
    '</article>';
  }

  function renderContest() {
    if (!state.contest) return '<div class="empty">The next district cabinet is preparing.</div>';
    var contestStyle = styleById(state.contest.styleId) || { id: "lux-5" };
    return '<div class="contest-style"><span class="accent-' + escapeHtml(contestStyle.accent || 'pink') + '">' + slotEmblem(contestStyle, 'contest-emblem') + '</span><div><strong>' + escapeHtml(state.contest.styleName) + '</strong><small>One shared cabinet · any wager · gross settled payout wins</small></div></div>' +
      '<div class="scoreboard"><div class="score party-a"><span>GLOW HEARTS</span><strong>' + money(state.contest.scores.A) + '</strong></div><div class="versus">GROSS PAYOUT</div><div class="score party-b"><span>LUCKY BOLTS</span><strong>' + money(state.contest.scores.B) + '</strong></div></div>';
  }

  function renderFreePlayNotice(partyScreen) {
    return '<section class="panel free-play-card"><p class="eyebrow">SLOT-FIRST FREE PLAY</p><h2>All ten slots are ready.</h2><p>' +
      (partyScreen
        ? 'This party screen is view-only. Return to Game Hub and choose <strong>Open Mike controls</strong> to spin.'
        : 'Open a player control link and choose any cabinet. There are no quests, searches, or unlock puzzles.') +
      '</p></section>';
  }

  function machineOverview() {
    return '<div class="machine-overview">' + (state.styles || []).map(function (style) {
      var stateLabel = 'READY';
      return '<div class="machine-summary accent-' + escapeHtml(style.accent) + (style.unlocked ? ' unlocked' : '') + '"><span>' + slotEmblem(style, 'summary-emblem') + '</span><div><strong>' + escapeHtml(style.shortName) + '</strong><small>' + stateLabel + ' · ' + escapeHtml(style.signature) + '</small></div></div>';
    }).join('') + '</div>';
  }

  function controllerLinks() {
    if (!launch) return '<div class="empty">Controller links unavailable.</div>';
    return '<div class="controller-list">' + launch.controllers.map(function (controller) {
      var url = new URL(controller.url, window.location.href).href;
      return '<div class="controller-link"><span><strong>' + escapeHtml(controller.displayName) + '</strong><small>Seat ' + controller.slot + ' · Party ' + controller.partyId + '</small></span><a href="' + escapeHtml(url) + '" target="_blank" rel="noreferrer">OPEN</a></div>';
    }).join("") + '</div>';
  }

  function partyScreenLinks() {
    if (!launch || !launch.partyScreens) return "";
    return '<div class="controller-list">' + launch.partyScreens.map(function (screen) {
      var url = new URL(screen.url, window.location.href).href;
      return '<div class="controller-link"><span><strong>Party ' + escapeHtml(screen.partyId) + ' screen</strong><small>Filtered camera and party ledger</small></span><a href="' + escapeHtml(url) + '" target="_blank" rel="noreferrer">OPEN</a></div>';
    }).join("") + '</div>';
  }

  function eventFeed() {
    var events = (state.events || []).slice(-18).reverse();
    if (!events.length) return '<div class="empty">No settled events yet.</div>';
    return '<div class="event-feed">' + events.map(function (event) {
      return '<div class="event"><i class="event-dot"></i><span><strong>' + escapeHtml(eventText(event)) + '</strong><small>' + escapeHtml(event.type) + '</small></span><time>' + duration(state.nowMs - event.atMs) + ' ago</time></div>';
    }).join("") + '</div>';
  }

  function renderHost() {
    var diagnostic = state.diagnostics || {};
    var result = state.result;
    app.innerHTML = '<header class="topbar">' +
      '<section class="brand-card"><p class="eyebrow">CASINO ALPHA · ' + escapeHtml(state.status.toUpperCase()) + '</p><h1>' + escapeHtml(modeName(state.mode)) + '</h1><p>One authoritative district · Draw Spine ' + state.drawSpine.consumedRows + ' / ' + state.drawSpine.totalRows + ' · ten independent books</p></section>' +
      '<section class="metric-card jackpot"><span>PROGRESSIVE</span><strong>' + money(state.jackpot) + '</strong></section>' +
      '<section class="metric-card"><span>' + (state.mode === "house_war" ? 'CLOSING BELL' : 'CABINETS') + '</span><strong>' + (state.mode === "house_war" ? duration(state.remainingMs) : '10 OPEN') + '</strong></section>' +
      '<section class="metric-card"><span>ACTIVE PATRONS</span><strong>' + Object.values(state.activeNpcCounts).reduce(function (sum, value) { return sum + value; }, 0) + '</strong></section>' +
    '</header>' +
    (result ? '<section class="panel"><p class="eyebrow">SESSION RESULT</p><h2>' + escapeHtml(result.winner_party_id ? 'Party ' + result.winner_party_id + ' wins' : result.outcome) + '</h2><p>' + escapeHtml(result.reason) + ' · ' + result.style_rows_consumed + ' immutable rows consumed.</p><div class="host-actions"><button class="button cyan" data-host-action="handoff">Return result to Game Hub</button></div></section>' : '') +
    '<div class="host-grid"><div class="column">' +
      '<section class="panel"><div class="panel-heading"><div><p class="eyebrow">SHARED WORLD</p><h2>The neon district</h2><p>Party cameras point into this same state.</p></div><span class="tag live">SERVER LIVE</span></div>' + renderMap() + '</section>' +
      (state.mode === "house_war" ? '<section class="panel"><div class="panel-heading"><div><p class="eyebrow">TWO-MINUTE WINDOW</p><h2>District contest</h2></div><span class="tag">' + (state.contest ? duration(state.contest.remainingMs) : 'WAIT') + '</span></div>' + renderContest() + '</section>' : renderFreePlayNotice(false)) +
      '<section class="panel"><div class="panel-heading"><div><p class="eyebrow">TEN STARTING CABINETS</p><h2>Every style is live</h2></div><span class="tag">96% BASE RTP</span></div>' + machineOverview() + '</section>' +
      '<section class="panel"><div class="panel-heading"><div><p class="eyebrow">PARTY LEDGERS</p><h2>Solvency before swagger</h2></div><span class="tag">CONSERVES ' + money(diagnostic.conserved) + '</span></div><div class="party-row">' + state.parties.map(renderParty).join("") + '</div></section>' +
    '</div><aside class="column">' +
      '<section class="panel"><div class="panel-heading"><div><p class="eyebrow">REAL SEATS</p><h2>Player links</h2><p>Open one per phone or local browser.</p></div></div>' + controllerLinks() + '</section>' +
      '<section class="panel"><div class="panel-heading"><div><p class="eyebrow">FILTERED CAMERAS</p><h2>Party screens</h2></div></div>' + partyScreenLinks() + '</section>' +
      '<section class="panel"><div class="panel-heading"><div><p class="eyebrow">SETTLED ONLY</p><h2>Event ledger</h2></div></div>' + eventFeed() + '</section>' +
      '<section class="panel"><div class="panel-heading"><div><p class="eyebrow">ALPHA LAB</p><h2>Host controls</h2></div></div><div class="host-actions"><button class="button secondary" data-host-action="advance">+60 seconds</button><button class="button danger" data-host-action="end" ' + (state.status !== 'running' ? 'disabled' : '') + '>End session</button></div><p class="status-message">Time skip is a local testing aid. It still settles every due NPC outcome.</p></section>' +
    '</aside></div>' + signatureLine();
  }

  var symbolMap = {
    B: ['⚡','bolt'], G: ['⚙','gear'], C: ['▦','chip'], O: ['●','orb'],
    S: ['★','star'], L: ['◆','lux'], X: ['✦','scatter']
  };

  function layoutShape(layout) {
    return {
      reels: [5, 4], graft: [6, 4], mirror: [6, 3], track: [6, 2], vault: [5, 3],
      weather: [4, 4], choir: [5, 3], nullbloom: [7, 7], orbit: [8, 3], twinlight: [8, 3]
    }[layout] || [5, 3];
  }

  function placeholderPresentation(style) {
    var shape = layoutShape(style.layout);
    var fallback = ['·', style.icon, '○', '◇', '⚙'];
    var cells = [];
    for (var index = 0; index < shape[0] * shape[1]; index += 1) cells.push(fallback[index % fallback.length]);
    return { columns: shape[0], rows: shape[1], cells: cells, activeCells: [], summary: style.signature, featureActive: false };
  }

  function outcomeBoard(spin, style) {
    var presentation = spin && spin.styleId === style.id && spin.presentation ? spin.presentation : placeholderPresentation(style);
    var active = presentation.activeCells || [];
    return '<div class="mechanic-board layout-' + escapeHtml(style.layout) + ' board-cols-' + Number(presentation.columns) + ' board-rows-' + Number(presentation.rows) + '">' +
      (presentation.cells || []).map(function (code, index) {
        var item = symbolMap[code] || [code, "token"];
        return '<span class="mechanic-cell ' + escapeHtml(item[1]) + (active.indexOf(index) !== -1 ? ' active' : '') + '" aria-label="' + escapeHtml(item[1]) + '">' + escapeHtml(item[0]) + '</span>';
      }).join('') + '</div>';
  }

  function machineRoster(player) {
    var activeId = player.activeStyleId || player.selectedStyleId;
    var contestLocked = player.location === 'contest' && state.contest;
    return '<section class="machine-picker"><div class="machine-picker-heading"><span>CHOOSE CABINET</span><small>' + (contestLocked ? 'Contest style is fixed' : 'One global draw advances on every settled spin') + '</small></div><div class="machine-roster">' +
      (state.styles || []).map(function (style) {
        var selected = activeId === style.id;
        var disabled = contestLocked ? state.contest.styleId !== style.id : (!style.discoverable || player.freeSpinsRemaining > 0 && !selected);
        var label = style.unlocked ? 'READY' : 'UNAVAILABLE';
        return '<button class="machine-card accent-' + escapeHtml(style.accent) + (selected ? ' selected' : '') + (style.unlocked ? ' unlocked' : ' locked') + '" data-command="select_machine" data-style="' + escapeHtml(style.id) + '" ' + (disabled ? 'disabled' : '') + '><span>' + slotEmblem(style, 'card-emblem') + '</span><strong>' + escapeHtml(style.shortName) + '</strong><small>' + label + '</small></button>';
      }).join('') + '</div></section>';
  }

  function renderController(force) {
    var player = state.ownPlayer;
    if (!player) return renderError("This seat has no private observation.");
    sequence = Math.max(sequence, player.acceptedSequence || 0);
    var renderKey = controllerRenderKey(player);
    if (!force && renderKey === lastControllerRenderKey) {
      patchControllerLiveMetrics(player);
      return;
    }
    var ownLocation = player.partyId === "A" ? "casino_a" : "casino_b";
    var rivalLocation = player.partyId === "A" ? "casino_b" : "casino_a";
    var spin = player.lastSpin;
    var activeStyle = activeStyleFor(player);
    var displaySpin = spin && activeStyle && spin.styleId === activeStyle.id ? spin : null;
    var freshSpin = !!displaySpin && displaySpin.drawIndex !== lastVisualDrawIndex;
    var outcomeMood = !displaySpin ? "idle" : (displaySpin.jackpotHit ? "jackpot" : (Number(displaySpin.freeSpinsAwarded) > 0 ? "bonus" : (Number(displaySpin.totalPayout) > 0 ? "winner" : "quiet")));
    var tier = payoutTier(displaySpin);
    var hasTheater = !!displaySpin && (displaySpin.wheelTriggered || displaySpin.jackpotHit || Number(displaySpin.freeSpinsAwarded) > 0);
    var styleReady = activeStyle && (activeStyle.unlocked || player.location === 'contest');
    var canSpin = state.status === "running" && styleReady && (player.location !== "contest" || state.contest);
    var free = player.freeSpinsRemaining > 0;
    var party = state.parties.find(function (item) { return item.id === player.partyId; });
    if (freshSpin) {
      rememberSettlement(displaySpin);
      playCue(displaySpin.jackpotHit ? "jackpot" : (Number(displaySpin.freeSpinsAwarded) > 0 ? "bonus" : (displaySpin.wheelTriggered ? "wheel" : tier.id)));
    }
    app.innerHTML = '<div class="controller-shell">' +
      '<header class="controller-header"><div class="identity"><span class="party-pill ' + partyClass(player.partyId) + '">PARTY ' + player.partyId + '</span><h1>' + escapeHtml(player.displayName) + '</h1></div><button class="sound-toggle ' + (soundEnabled ? 'is-on' : 'is-off') + '" data-sound-toggle aria-pressed="' + (soundEnabled ? 'true' : 'false') + '" title="Toggle local arcade sound"><span>' + (soundEnabled ? '♪' : '×') + '</span><small>SOUND</small></button><div class="wallet-bubble"><span>WALLET</span><strong data-live-wallet>' + money(player.wallet) + '</strong></div><div class="jackpot-bubble"><span>JACKPOT</span><strong data-live-jackpot>' + money(state.jackpot) + '</strong><small data-live-jackpot-heat>' + (state.jackpotHeat && state.jackpotHeat.ready ? 'HEAT READY' : 'HEAT ' + (state.jackpotHeat ? state.jackpotHeat.current + '/' + state.jackpotHeat.required : 'BUILDING')) + '</small></div></header>' +
      '<div class="controller-link-state ' + controllerLinkState + '" role="status" aria-live="polite"><span>LOCAL LINK</span><strong>' + (controllerLinkState === 'live' ? 'LIVE' : 'LOST · RETRYING') + '</strong><small>' + (controllerLinkState === 'live' ? 'Commands settle on the local server.' : 'Commands are disabled until the authoritative server returns.') + '</small></div>' +
      (state.result ? '<div class="status-message"><strong>' + escapeHtml(state.result.winner_party_id ? 'Party ' + state.result.winner_party_id + ' wins' : state.result.outcome) + '</strong><br>' + escapeHtml(state.result.reason) + '</div>' : '') +
      '<nav class="travel-strip" aria-label="Travel"><button class="travel-button ' + partyClass(player.partyId) + (player.location === ownLocation ? ' selected' : '') + '" data-command="travel" data-location="' + ownLocation + '">Own house</button><button class="travel-button ' + (player.location === rivalLocation ? ' selected' : '') + '" data-command="travel" data-location="' + rivalLocation + '" ' + (state.mode !== 'house_war' ? 'disabled' : '') + '>Rival house</button><button class="travel-button ' + (player.location === 'contest' ? 'selected' : '') + '" data-command="travel" data-location="contest" ' + (!state.contest ? 'disabled' : '') + '>Contest</button></nav>' +
      machineRoster(player) +
      '<section class="robot-stage machine-' + escapeHtml(activeStyle.accent) + ' style-' + escapeHtml(activeStyle.id) + ' layout-' + escapeHtml(activeStyle.layout) + ' mood-' + outcomeMood + ' tier-' + escapeHtml(tier.id) + (hasTheater ? ' has-theater' : '') + (freshSpin ? ' fresh-settlement' : '') + '">' +
        '<div class="stage-grid" aria-hidden="true"></div><div class="machine-halo" aria-hidden="true">' + slotEmblem(activeStyle, 'halo-emblem') + '</div>' +
        (displaySpin && Number(displaySpin.totalPayout) > 0 ? '<div class="win-sparks" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>' : '') +
        winCallout(displaySpin, freshSpin) +
        '<div class="antenna"></div><div class="robot-head"><i class="robot-ear left"></i><i class="robot-ear right"></i><i class="robot-eye left"></i><i class="robot-eye right"></i><i class="robot-cheek left"></i><i class="robot-cheek right"></i><i class="robot-mouth"></i></div>' +
        bonusTheater(displaySpin) +
        '<div class="robot-body"><div class="cabinet-identity"><span class="cabinet-emblem">' + slotEmblem(activeStyle, 'identity-emblem') + '</span><div><div class="machine-title"><span>' + escapeHtml(activeStyle.name) + '</span><small>DRAW ' + (displaySpin ? displaySpin.drawIndex : state.drawSpine.totalConsumed) + '</small></div><div class="machine-signature">' + escapeHtml(activeStyle.signature) + '</div></div><span class="volatility-chip">' + escapeHtml(activeStyle.volatility) + '</span></div><div class="reel-window">' + outcomeBoard(displaySpin, activeStyle) + '</div>' +
        '<div class="spin-readout"><div><span>LAST BET</span><strong>' + (displaySpin ? money(displaySpin.wager) : money(player.selectedWager)) + '</strong></div><div><span>SLOT WIN</span><strong>' + (displaySpin ? money(displaySpin.slotPayout) : '—') + '</strong></div><div><span>TOTAL</span><strong>' + (displaySpin ? money(displaySpin.totalPayout) : '—') + '</strong></div></div>' +
        (displaySpin && displaySpin.presentation ? '<div class="feature-readout ' + (displaySpin.presentation.featureActive ? 'active' : '') + '"><strong>' + escapeHtml(displaySpin.presentation.featureActive ? displaySpin.presentation.featureName : displaySpin.presentation.summary) + '</strong><span>' + escapeHtml(displaySpin.presentation.featureActive ? displaySpin.presentation.featureValue : activeStyle.featureName + ' sleeping') + '</span></div>' : '') +
        (displaySpin ? '<div class="settlement-banner ' + outcomeMood + '"><span>' + (displaySpin.jackpotHit ? 'PROGRESSIVE HIT' : (Number(displaySpin.freeSpinsAwarded) > 0 ? 'FREE SPINS WON' : 'TABLE SETTLED')) + '</span><strong>' + (Number(displaySpin.freeSpinsAwarded) > 0 ? '+' + Number(displaySpin.freeSpinsAwarded) + ' FREE SPINS' : (Number(displaySpin.totalPayout) > 0 ? '+' + money(displaySpin.totalPayout) + ' cr' : 'NO WIN')) + '</strong><small>Ticket committed before the bet was read</small></div>' : '<div class="cabinet-ready"><i></i><span>96% BASE BOOK · DRAW SPINE READY</span><i></i></div>') +
        '<div class="cabinet-console"><div class="console-heading"><span>BET CONSOLE</span><small>Controls belong to this machine</small></div>' +
          '<div class="wager-strip" aria-label="Wager">' + [1,2,5,10].map(function (wager) { return '<button class="wager-button ' + (player.selectedWager === wager ? 'selected' : '') + '" data-command="set_wager" data-wager="' + wager + '" ' + (free ? 'disabled' : '') + '>' + wager + '</button>'; }).join("") + '</div>' +
          (free ? '<div class="free-spin-bank" role="status"><span>FREE SPINS BANKED</span><strong>' + player.freeSpinsRemaining + '</strong><small>Locked to ' + escapeHtml(activeStyle.shortName) + '</small></div>' : '') +
          riskPanel(player, free) +
          '<div class="jackpot-build ' + (state.jackpotHeat && state.jackpotHeat.ready ? 'ready' : '') + '"><div><span>PROGRESSIVE HEAT</span><strong>' + (state.jackpotHeat && state.jackpotHeat.ready ? 'READY' : (state.jackpotHeat ? state.jackpotHeat.current + ' / ' + state.jackpotHeat.required : 'BUILDING')) + '</strong></div><meter min="0" max="' + (state.jackpotHeat ? state.jackpotHeat.required : 1) + '" value="' + (state.jackpotHeat ? state.jackpotHeat.current : 0) + '"></meter><small>Paid co-op spins build eligibility before a jackpot ticket can pay.</small></div>' +
          '<button class="spin-button ' + (free ? 'free' : '') + '" data-command="spin" ' + (!canSpin ? 'disabled' : '') + '>' + (free ? 'FREE SPIN · ' + player.freeSpinsRemaining : 'SPIN · ' + money(player.selectedWager)) + '</button>' +
          '<p class="keyboard-hint">Laptop: Space = spin · 1 / 2 / 3 / 4 = wager 1 / 2 / 5 / 10</p></div>' +
      '</div><div class="robot-feet"><i></i><i></i></div></section>' +
      '<p class="location-note">Playing <strong>' + escapeHtml(activeStyle.shortName) + '</strong> at <strong>' + escapeHtml(locationName(player.location)) + '</strong>' + (player.location === 'contest' && state.contest ? ' · ' + duration(state.contest.remainingMs) : '') + '</p>' +
      recentResultStrip() +
      '<div class="management-strip"><button class="action-button secondary" data-command="fund_house" data-amount="10">Fund house · 10</button><button class="action-button secondary" data-command="withdraw_house" data-amount="10">Take attack cash · 10</button></div>' +
      '<div class="status-message">House: <span data-live-house>' + (party.house == null ? escapeHtml(party.houseStatus) : money(party.house)) + '</span> · Free spins stay locked to the cabinet that awarded them.</div>' +
      signatureLine() +
    '</div>';
    lastControllerRenderKey = renderKey;
    if (controllerLinkState !== "live") {
      app.querySelectorAll("[data-command]").forEach(function (button) { button.disabled = true; });
    }
    patchControllerLiveMetrics(player);
    centerSelectedMachine();
    if (displaySpin) lastVisualDrawIndex = displaySpin.drawIndex;
  }

  function renderPartyScreen() {
    var party = state.parties.find(function (item) { return item.id === partyId; });
    var members = state.players.filter(function (player) { return player.partyId === partyId; });
    app.innerHTML = '<header class="topbar">' +
      '<section class="brand-card"><p class="eyebrow">PARTY ' + escapeHtml(partyId) + ' SCREEN · FILTERED</p><h1>' + escapeHtml(party ? party.name : 'Party view') + '</h1><p>' + escapeHtml(modeName(state.mode)) + ' · one shared authoritative district</p></section>' +
      '<section class="metric-card jackpot"><span>PROGRESSIVE</span><strong>' + money(state.jackpot) + '</strong></section>' +
      '<section class="metric-card"><span>HOUSE</span><strong>' + (party && party.house != null ? money(party.house) : '—') + '</strong></section>' +
      '<section class="metric-card"><span>CLOSING</span><strong>' + duration(state.remainingMs) + '</strong></section>' +
    '</header><div class="host-grid"><div class="column">' +
      '<section class="panel"><div class="panel-heading"><div><p class="eyebrow">PARTY CAMERA</p><h2>The neon district</h2></div><span class="tag live">SERVER LIVE</span></div>' + renderMap() + '</section>' +
      (state.mode === 'house_war' ? '<section class="panel"><div class="panel-heading"><div><p class="eyebrow">GROSS PAYOUT</p><h2>District contest</h2></div></div>' + renderContest() + '</section>' : renderFreePlayNotice(true)) +
    '</div><aside class="column">' +
      '<section class="panel"><p class="eyebrow">READY PARTY</p><h2>' + members.length + ' real seat' + (members.length === 1 ? '' : 's') + '</h2><div class="controller-list">' + members.map(function (member) { return '<div class="controller-link"><span><strong>' + escapeHtml(member.displayName) + '</strong><small>' + escapeHtml(locationName(member.location)) + ' · wallet ' + money(member.wallet) + '</small></span><span class="party-pill ' + partyClass(partyId) + '">' + member.slot + '</span></div>'; }).join('') + '</div></section>' +
      '<section class="panel"><div class="panel-heading"><div><p class="eyebrow">PARTY EVENTS</p><h2>Settled ledger</h2></div></div>' + eventFeed() + '</section>' +
    '</aside></div>' + signatureLine();
  }

  async function bootstrapHost() {
    try {
      var response = await requestJson("./api/host/bootstrap");
      if (response.phase === "waiting") {
        renderSetup(response.launchError || response.persistenceError || "Choose a local alpha route.");
        return;
      }
      launch = response.launch;
      if (redirectToSoloController(launch)) return;
      hostToken = launch.hostToken;
      state = response.state;
      renderHost();
      startPolling();
    } catch (error) {
      renderError(error.message);
    }
  }

  async function poll() {
    try {
      if (role === "controller") {
        var nextState = await requestJson("./api/player/state?seat=" + encodeURIComponent(seatId) + "&token=" + encodeURIComponent(seatToken));
        var recovered = setControllerLinkState("live");
        state = nextState;
        renderController(recovered);
        if (recovered) showToast("Local link restored");
      } else if (role === "party") {
        state = await requestJson("./api/party/state?party=" + encodeURIComponent(partyId) + "&token=" + encodeURIComponent(partyToken));
        renderPartyScreen();
      } else if (hostToken) {
        state = await requestJson("./api/host/state?hostToken=" + encodeURIComponent(hostToken));
        renderHost();
      }
    } catch (error) {
      if (role === "controller" && !error.localResponse) markControllerLinkLost("Local link lost · retrying");
      else showToast(error.message, true);
    }
  }

  function startPolling() {
    clearInterval(pollTimer);
    pollTimer = setInterval(poll, role === "controller" ? 650 : 900);
  }

  async function sendCommand(command) {
    if (role === "controller" && controllerLinkState !== "live") {
      showToast("Local link lost · command not sent", true);
      return;
    }
    var spinning = command && command.type === "spin";
    sequence += 1;
    if (spinning) beginSpinAnimation();
    try {
      var response = await postJson("./api/player/command", {
        seatId: seatId,
        token: seatToken,
        sequence: sequence,
        requestId: seatId + ":" + Date.now() + ":" + sequence,
        command: command
      });
      if (response.result && response.result.totalPayout != null) showToast("Settled " + money(response.result.totalPayout) + " credits");
      if (spinning) await waitForSpinAnimation();
      await poll();
    } catch (error) {
      sequence -= 1;
      if (error.localResponse) showToast(error.message, true);
      else markControllerLinkLost("Local link lost · command not sent · retrying");
    }
  }

  app.addEventListener("click", async function (event) {
    var target = event.target.closest("button, a");
    if (!target || target.disabled) return;
    if (target.hasAttribute("data-sound-toggle")) {
      soundEnabled = !soundEnabled;
      storeSoundPreference();
      if (soundEnabled) {
        unlockAudio();
        playCue("toggle");
      }
      renderController();
      return;
    }
    unlockAudio();
    if (target.dataset.mode) {
      selectedMode = target.dataset.mode;
      app.querySelectorAll(".mode-card").forEach(function (button) { button.classList.toggle("selected", button === target); });
      document.getElementById("count-label").textContent = selectedMode === "house_war" ? "Players per party" : "Free-play players";
      return;
    }
    if (target.id === "retry") return bootstrapHost();
    if (target.id === "start-session") {
      target.disabled = true;
      try {
        var count = Number(document.getElementById("player-count").value);
        var response = await postJson("./api/host/start", selectedMode === "house_war" ? { mode: selectedMode, teamSize: count } : { mode: selectedMode, playerCount: count });
        launch = response.launch;
        if (redirectToSoloController(launch)) return;
        hostToken = launch.hostToken;
        state = response.state;
        renderHost();
        startPolling();
      } catch (error) {
        target.disabled = false;
        showToast(error.message, true);
      }
      return;
    }
    if (target.dataset.hostAction === "advance") {
      await postJson("./api/host/advance", { hostToken: hostToken, milliseconds: 60000 }).then(function (next) { state = next; renderHost(); }).catch(function (error) { showToast(error.message, true); });
      return;
    }
    if (target.dataset.hostAction === "end") {
      await postJson("./api/host/end", { hostToken: hostToken }).then(poll).catch(function (error) { showToast(error.message, true); });
      return;
    }
    if (target.dataset.hostAction === "handoff") {
      try {
        await postJson("/game-api/game/end", { summary: state.result });
        showToast("Result returned to the local Game Hub lobby");
      } catch (_) {
        showToast("Direct runtime test: Game Hub proxy is not active", true);
      }
      return;
    }
    if (!target.dataset.command) return;
    var command = { type: target.dataset.command };
    if (target.dataset.location) command.location = target.dataset.location;
    if (target.dataset.style) command.styleId = target.dataset.style;
    if (target.dataset.wager) command.wager = Number(target.dataset.wager);
    if (target.dataset.amount) command.amount = Number(target.dataset.amount);
    if (command.type === "spin") playCue("spin");
    await sendCommand(command);
  });

  document.addEventListener("keydown", function (event) {
    if (role !== "controller" || !state || state.status !== "running" || controllerLinkState !== "live") return;
    var tag = String(event.target && event.target.tagName || "").toLowerCase();
    if (["button", "input", "select", "textarea", "a"].indexOf(tag) >= 0) return;
    var wagerKeys = { Digit1: 1, Digit2: 2, Digit3: 5, Digit4: 10 };
    var command = event.code === "Space" ? { type: "spin" } : (wagerKeys[event.code] ? { type: "set_wager", wager: wagerKeys[event.code] } : null);
    if (!command) return;
    event.preventDefault();
    if (command.type === "spin") playCue("spin");
    sendCommand(command);
  });

  if (role === "controller") {
    if (!seatId || !seatToken) renderError("This controller link is missing its seat-bound token.");
    else { poll(); startPolling(); }
  } else if (role === "party") {
    if (!partyId || !partyToken) renderError("This party-screen link is missing its party-bound token.");
    else { poll(); startPolling(); }
  } else {
    bootstrapHost();
  }
})();
