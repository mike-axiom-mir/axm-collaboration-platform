import * as THREE from "./vendor/three.module.js";

const SYMBOLS = {
  B: { glyph: "ϟ", name: "BOLT" },
  G: { glyph: "⚙", name: "GEAR" },
  C: { glyph: "▣", name: "CHIP" },
  O: { glyph: "●", name: "ORB" },
  S: { glyph: "✦", name: "STAR" },
  L: { glyph: "◉", name: "LUX" },
  X: { glyph: "✧", name: "CORE" }
};

const DEMO_GRID = [
  ["B", "G", "C", "O", "S"],
  ["G", "G", "C", "S", "B"],
  ["O", "B", "L", "C", "G"],
  ["C", "S", "B", "O", "L"]
];

const WHEEL_DELTAS = [-30, -15, -5, 5, 25, 35];
const currency = new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const ui = {
  shell: document.querySelector("#appShell"),
  stage: document.querySelector("#machineStage"),
  canvas: document.querySelector("#stageCanvas"),
  face: document.querySelector("#faceScreen"),
  grid: document.querySelector("#reelGrid"),
  window: document.querySelector("#reelWindow"),
  wheelRotor: document.querySelector("#wheelRotor"),
  wheelResult: document.querySelector("#wheelResult"),
  bankroll: document.querySelector("#bankrollValue"),
  jackpot: document.querySelector("#jackpotValue"),
  wager: document.querySelector("#wagerValue"),
  slider: document.querySelector("#wagerSlider"),
  quickBets: document.querySelector("#quickBets"),
  spin: document.querySelector("#spinButton"),
  spinLabel: document.querySelector("#spinLabel"),
  spinHint: document.querySelector("#spinHint"),
  consoleMode: document.querySelector("#consoleMode"),
  sequence: document.querySelector("#sequenceValue"),
  lastWinLabel: document.querySelector("#lastWinLabel"),
  lastWinValue: document.querySelector("#lastWinValue"),
  event: document.querySelector("#eventMessage"),
  connection: document.querySelector("#connectionStatus"),
  modeKicker: document.querySelector("#modeKicker"),
  sound: document.querySelector("#soundButton"),
  celebration: document.querySelector("#jackpotCelebration"),
  jackpotWin: document.querySelector("#jackpotWinValue"),
  toast: document.querySelector("#toast")
};

const state = {
  bankroll: 1000,
  jackpot: 0,
  wager: 10,
  minWager: 1,
  maxWager: 100,
  wagerOptions: [1, 2, 5, 10],
  cursor: 0,
  freeSpins: 0,
  lockedFreeWager: null,
  busy: false,
  sound: true,
  connected: false,
  canSpin: true,
  blockReason: null,
  wheelTurns: 0,
  resultQueue: []
};

function makeCell(code) {
  const symbol = SYMBOLS[code] || SYMBOLS.B;
  const cell = document.createElement("div");
  cell.className = "symbol-cell";
  cell.dataset.symbol = code in SYMBOLS ? code : "B";
  cell.innerHTML = `<span class="symbol-glyph">${symbol.glyph}</span><span class="symbol-name">${symbol.name}</span>`;
  return cell;
}

function normalizeGrid(grid) {
  if (!Array.isArray(grid)) return DEMO_GRID.map(row => row.slice());
  if (grid.length === 4 && typeof grid[0] === "string") {
    return grid.map(row => row.slice(0, 5).split("").map(value => value.toUpperCase()));
  }
  if (grid.length === 20 && !Array.isArray(grid[0])) {
    return Array.from({ length: 4 }, (_, row) => grid.slice(row * 5, row * 5 + 5));
  }
  if (grid.length === 5 && Array.isArray(grid[0]) && grid[0].length === 4) {
    return Array.from({ length: 4 }, (_, row) => grid.map(reel => reel[row]));
  }
  if (grid.length === 4 && Array.isArray(grid[0]) && grid[0].length === 5) {
    return grid.map(row => row.map(value => String(value).charAt(0).toUpperCase()));
  }
  return DEMO_GRID.map(row => row.slice());
}

function renderGrid(grid, winningLines = []) {
  const normalized = normalizeGrid(grid);
  const winningRows = new Map();
  winningLines.forEach(line => {
    const row = Number(line.row ?? line.line ?? -1);
    if (row >= 0 && row < 4) winningRows.set(row, Number(line.count || 5));
  });

  ui.grid.replaceChildren();
  normalized.forEach((row, rowIndex) => row.forEach((code, reelIndex) => {
    const cell = makeCell(code);
    if (winningRows.has(rowIndex) && reelIndex < winningRows.get(rowIndex)) cell.classList.add("win");
    ui.grid.appendChild(cell);
  }));
  ui.window.classList.toggle("has-win", winningRows.size > 0);
}

function setMoney(element, value) {
  element.textContent = currency.format(Math.max(0, Number(value) || 0));
}

function setWager(value, { updateSlider = true } = {}) {
  const affordableMax = Math.max(state.minWager, Math.min(state.maxWager, state.bankroll || state.maxWager));
  const affordable = state.wagerOptions.filter(option => option <= affordableMax);
  const choices = state.freeSpins > 0 && state.lockedFreeWager != null
    ? [state.lockedFreeWager]
    : (affordable.length ? affordable : state.wagerOptions.slice(0, 1));
  const requested = state.freeSpins > 0 && state.lockedFreeWager != null ? state.lockedFreeWager : (Number(value) || choices[0]);
  state.wager = choices.reduce((best, option) => Math.abs(option - requested) < Math.abs(best - requested) ? option : best, choices[0]);
  const optionIndex = Math.max(0, state.wagerOptions.indexOf(state.wager));
  if (updateSlider) ui.slider.value = String(optionIndex);
  ui.slider.style.setProperty("--range", `${(optionIndex / Math.max(1, state.wagerOptions.length - 1)) * 100}%`);
  setMoney(ui.wager, state.wager);
  ui.quickBets.querySelectorAll("button").forEach(button => {
    const amount = Number(button.dataset.bet);
    button.classList.toggle("active", Math.abs(amount - state.wager) < .001);
    button.disabled = amount > affordableMax || state.freeSpins > 0;
  });
  ui.slider.disabled = state.freeSpins > 0;
}

function setWagerOptions(options) {
  if (!Array.isArray(options) || !options.length) return;
  const normalized = [...new Set(options.map(Number).filter(value => Number.isFinite(value) && value > 0))].sort((a, b) => a - b);
  if (!normalized.length) return;
  state.wagerOptions = normalized;
  state.minWager = normalized[0];
  state.maxWager = normalized[normalized.length - 1];
  ui.slider.min = "0";
  ui.slider.max = String(normalized.length - 1);
  ui.slider.step = "1";
  ui.quickBets.style.setProperty("--bet-columns", String(normalized.length));
  ui.quickBets.replaceChildren(...normalized.map(value => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.bet = String(value);
    button.textContent = String(value);
    return button;
  }));
}

function applyState(payload = {}) {
  const root = payload.state || payload;
  state.bankroll = Number(root.bankroll ?? root.balance ?? root.balances?.wallet ?? root.player?.bankroll ?? state.bankroll);
  state.jackpot = Number(root.jackpotPool ?? root.sharedJackpot ?? root.balances?.jackpot ?? (typeof root.jackpot === "number" ? root.jackpot : state.jackpot));
  state.cursor = Number(root.cursor ?? root.sequence ?? root.spinIndex ?? state.cursor);
  state.freeSpins = Number(root.freeSpins?.remaining ?? root.freeSpins ?? root.freeSpinsRemaining ?? state.freeSpins);
  if (root.freeSpins && typeof root.freeSpins === "object") state.lockedFreeWager = root.freeSpins.lockedWager;
  if (typeof root.canSpin === "boolean") state.canSpin = root.canSpin;
  state.blockReason = root.blockReason ?? state.blockReason;
  setWagerOptions(root.wagerOptions);
  state.minWager = Number(root.minWager ?? root.wagerMin ?? state.minWager);
  state.maxWager = Number(root.maxWager ?? root.wagerMax ?? state.maxWager);

  setMoney(ui.bankroll, state.bankroll);
  setMoney(ui.jackpot, state.jackpot);
  ui.sequence.textContent = String(Math.max(0, state.cursor)).padStart(5, "0").slice(-5);
  setWager(Math.min(state.wager, Math.max(state.minWager, state.bankroll)));
  updateSpinMode();
}

function updateSpinMode() {
  const free = state.freeSpins > 0;
  const blocked = state.connected && !state.canSpin;
  ui.spin.classList.toggle("free-spin", free);
  ui.spinLabel.textContent = blocked ? "BANKRUPT" : (free ? `FREE ×${state.freeSpins}` : "SPIN");
  ui.spinHint.textContent = blocked ? String(state.blockReason || "SESSION ENDED").replaceAll("_", " ") : (free ? "OVERDRIVE READY" : "PRESS SPACE");
  ui.consoleMode.textContent = blocked ? "BANKRUPT" : (free ? "OVERDRIVE" : (state.busy ? "CALCULATING" : "READY"));
  ui.spin.disabled = state.busy || blocked;
  ui.stage.classList.toggle("overdrive", free);
  rig.setOverdrive(free);
}

function toast(message) {
  ui.toast.textContent = message;
  ui.toast.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => ui.toast.classList.remove("show"), 2800);
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function randomCosmeticGrid() {
  const codes = Object.keys(SYMBOLS);
  return Array.from({ length: 4 }, () => Array.from({ length: 5 }, () => codes[Math.floor(Math.random() * codes.length)]));
}

function normalizeResult(payload) {
  const root = payload.result || payload.spin || payload;
  const evaluated = root.evaluation || root.outcome || root;
  const wheel = evaluated.wheel || root.wheel || {};
  const wheelBps = wheel.deltaBps ?? evaluated.wheelDeltaBps;
  const wager = Number(root.wager ?? state.wager);
  const explicitMultiplier = Number(
    evaluated.payoutMultiplier ?? evaluated.multiplier ?? evaluated.payout ??
    (evaluated.payoutPpm != null ? evaluated.payoutPpm / 1_000_000 : NaN)
  );
  const slotPayout = Number(root.slotPayout ?? root.payoutAmount ?? root.win ?? 0);
  const multiplier = Number.isFinite(explicitMultiplier) ? explicitMultiplier : (wager > 0 ? slotPayout / wager : 0);
  return {
    grid: evaluated.grid || root.grid,
    winningLines: evaluated.winningLines || root.winningLines || [],
    multiplier,
    slotPayout,
    totalPayout: Number(root.totalPayout ?? root.payoutAmount ?? root.slotPayout ?? root.win ?? (typeof root.payout === "number" ? root.payout : slotPayout)),
    freeSpinsAwarded: Number(evaluated.freeSpinsAwarded ?? root.freeSpinsAwarded ?? 0),
    freeSpinsRemaining: Number(root.freeSpinsRemaining ?? payload.freeSpinsRemaining ?? state.freeSpins),
    isFreeSpin: Boolean(root.mode === "free" || root.isFreeSpin || root.freeSpin || payload.isFreeSpin),
    wheelTriggered: Boolean(wheel.triggered ?? evaluated.wheelTriggered ?? root.wheelTriggered),
    wheelDelta: wheelBps != null ? Number(wheelBps) / 100 : Number(wheel.delta ?? evaluated.wheelDelta ?? root.wheelDelta ?? 0),
    wheelIndex: Number(wheel.index ?? evaluated.wheelIndex ?? root.wheelIndex ?? -1),
    jackpotHit: Boolean(root.jackpotHit ?? root.jackpot?.hit ?? payload.jackpotHit),
    jackpotPayout: Number(root.jackpotPayout ?? root.jackpot?.payout ?? payload.jackpotPayout ?? 0),
    cursor: Number(root.cursor ?? root.sequence ?? payload.cursor ?? payload.state?.cursor ?? state.cursor + 1),
    bankroll: Number(payload.bankroll ?? payload.state?.bankroll ?? payload.state?.balances?.wallet ?? root.bankroll ?? state.bankroll),
    jackpot: Number((typeof payload.jackpot === "number" ? payload.jackpot : undefined) ?? payload.state?.balances?.jackpot ?? root.jackpotPool ?? state.jackpot)
  };
}

function extractResults(payload) {
  const list = payload.spins || payload.results || payload.chain;
  return Array.isArray(list) && list.length ? list.map(normalizeResult) : [normalizeResult(payload)];
}

async function fetchJson(url, options) {
  const response = await fetch(url, {
    headers: { "content-type": "application/json", ...(options?.headers || {}) },
    cache: "no-store",
    ...options
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(data.error?.message || data.error || data.message || `Request failed (${response.status})`);
  return data;
}

async function loadInitialState() {
  try {
    const payload = await fetchJson("/api/state");
    state.connected = true;
    applyState(payload);
    const root = payload.state || payload;
    renderGrid(root.grid || root.lastGrid || DEMO_GRID, root.winningLines || []);
    ui.connection.textContent = "LIVE";
    ui.modeKicker.textContent = "FAIR SEQUENCE · LIVE";
    ui.event.textContent = "LUX-5 is ready. Every accepted spin takes the next neutral outcome.";
  } catch (error) {
    state.connected = false;
    renderGrid(DEMO_GRID);
    ui.connection.textContent = "SERVER OFFLINE";
    ui.modeKicker.textContent = "FAIR SEQUENCE · WAITING";
    ui.event.textContent = "The visual cabinet is ready, but the local casino server is not connected.";
    toast("Start the local LUX-5 server to spin the real outcome book.");
  }
}

async function spin() {
  if (state.busy) return;
  if (!state.connected) {
    toast("LUX-5 is waiting for the local server.");
    return;
  }
  if (!state.canSpin) {
    toast(String(state.blockReason || "This session cannot spin.").replaceAll("_", " "));
    return;
  }
  if (state.freeSpins <= 0 && state.wager > state.bankroll) {
    toast("That wager is larger than your bankroll.");
    return;
  }

  state.busy = true;
  soundEffect("spin");
  ui.spin.disabled = true;
  ui.window.classList.add("spinning");
  ui.window.classList.remove("has-win");
  ui.face.className = "face-screen";
  ui.consoleMode.textContent = state.freeSpins > 0 ? "OVERDRIVE" : "SPINNING";
  rig.setSpinning(true);
  const cosmeticTimer = setInterval(() => renderGrid(randomCosmeticGrid()), 105);

  let payload;
  try {
    payload = await fetchJson("/api/spin", {
      method: "POST",
      body: JSON.stringify({ wager: state.wager, requestId: crypto.randomUUID?.() || `spin-${Date.now()}-${Math.random().toString(16).slice(2)}` })
    });
  } catch (error) {
    clearInterval(cosmeticTimer);
    ui.window.classList.remove("spinning");
    state.busy = false;
    ui.spin.disabled = false;
    rig.setSpinning(false);
    ui.connection.textContent = "ERROR";
    toast(error.message || "Spin could not be accepted.");
    return;
  }

  const elapsedFloor = sleep(850);
  await elapsedFloor;
  clearInterval(cosmeticTimer);
  ui.window.classList.remove("spinning");

  const results = extractResults(payload);
  for (const result of results) await presentResult(result);

  applyState(payload);
  const last = results[results.length - 1];
  if (Number.isFinite(last.bankroll)) state.bankroll = last.bankroll;
  if (Number.isFinite(last.jackpot)) state.jackpot = last.jackpot;
  if (Number.isFinite(last.cursor)) state.cursor = last.cursor;
  if (Number.isFinite(last.freeSpinsRemaining)) state.freeSpins = last.freeSpinsRemaining;
  applyState(state);
  state.busy = false;
  ui.spin.disabled = state.bankroll < state.minWager && state.freeSpins <= 0;
  rig.setSpinning(false);
  updateSpinMode();
}

async function presentResult(result) {
  renderGrid(result.grid, result.winningLines);
  state.cursor = result.cursor;
  state.freeSpins = result.freeSpinsRemaining;
  ui.sequence.textContent = String(Math.max(0, result.cursor)).padStart(5, "0").slice(-5);

  const won = result.slotPayout > 0 || result.multiplier > 0 || result.jackpotHit;
  ui.face.classList.toggle("happy", won);
  ui.face.classList.toggle("worried", !won);
  rig.react(won ? "win" : "loss");
  soundEffect(won ? "win" : "stop");

  if (result.wheelTriggered) await showWheel(result);

  const payout = result.slotPayout || (result.multiplier * state.wager);
  if (payout > 0) {
    ui.lastWinLabel.textContent = result.isFreeSpin ? "OVERDRIVE WIN" : "WIN";
    ui.lastWinValue.textContent = `¤${currency.format(payout)} · ${result.multiplier.toFixed(3)}×`;
    ui.event.textContent = result.wheelTriggered
      ? `LUX-5 transformed and applied a ${signed(result.wheelDelta)} boost to the five-kind profit.`
      : `The neutral sequence paid ${result.multiplier.toFixed(3)}× this wager.`;
  } else {
    ui.lastWinLabel.textContent = "NO LINE WIN";
    ui.lastWinValue.textContent = "NEXT OUTCOME WAITS";
    ui.event.textContent = "No line win. LUX-5 did not change or correct the result.";
  }

  if (result.freeSpinsAwarded > 0) {
    state.freeSpins = Math.max(state.freeSpins, result.freeSpinsRemaining, result.freeSpinsAwarded);
    ui.stage.classList.add("overdrive");
    rig.setOverdrive(true);
    ui.event.textContent = `${result.freeSpinsAwarded} Overdrive spins charged — every free-spin line win pays ×1.5.`;
  }

  if (result.jackpotHit) await showJackpot(result.jackpotPayout);
  await sleep(result.jackpotHit ? 250 : 620);
}

function signed(value) { return `${value >= 0 ? "+" : "−"}${Math.abs(value)}%`; }

async function showWheel(result) {
  const index = result.wheelIndex >= 0 ? result.wheelIndex : Math.max(0, WHEEL_DELTAS.indexOf(result.wheelDelta));
  const delta = WHEEL_DELTAS[index] ?? result.wheelDelta;
  state.wheelTurns += 4;
  ui.wheelResult.textContent = signed(delta);
  ui.stage.classList.add("wheel-open");
  rig.setWheel(true);
  soundEffect("transform");
  await sleep(600);

  const targetDegrees = state.wheelTurns * 360 - index * 60;
  ui.wheelRotor.style.transform = `rotate(${targetDegrees}deg)`;
  await sleep(2450);
  ui.stage.classList.add("wheel-result-shown");
  rig.react("win");
  soundEffect("wheel");
  await sleep(1050);
  ui.stage.classList.remove("wheel-result-shown", "wheel-open");
  rig.setWheel(false);
  await sleep(450);
}

async function showJackpot(amount) {
  ui.jackpotWin.textContent = `¤${currency.format(amount)}`;
  ui.celebration.classList.add("show");
  ui.celebration.setAttribute("aria-hidden", "false");
  rig.setJackpot(true);
  soundEffect("jackpot");
  await sleep(2800);
  ui.celebration.classList.remove("show");
  ui.celebration.setAttribute("aria-hidden", "true");
  rig.setJackpot(false);
}

ui.slider.addEventListener("input", event => setWager(state.wagerOptions[Number(event.target.value)] ?? state.wager, { updateSlider: false }));
ui.quickBets.addEventListener("click", event => {
  const button = event.target.closest("button[data-bet]");
  if (!button || state.busy) return;
  const value = Number(button.dataset.bet);
  setWager(value);
});
ui.spin.addEventListener("click", spin);
ui.sound.addEventListener("click", () => {
  state.sound = !state.sound;
  ui.sound.setAttribute("aria-pressed", String(state.sound));
  if (state.sound) soundEffect("toggle");
});
document.addEventListener("keydown", event => {
  if (event.code === "Space" && !event.repeat && !event.target.matches("input, button")) {
    event.preventDefault();
    spin();
  }
});

function createRobotRig(canvas, host) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "high-performance" });
  } catch (error) {
    host.classList.add("webgl-fallback");
    return { setWheel() {}, setSpinning() {}, setOverdrive() {}, setJackpot() {}, react() {} };
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x070813, .057);
  const camera = new THREE.PerspectiveCamera(31, 1, .1, 70);
  camera.position.set(0, .8, 11.6);

  const bot = new THREE.Group();
  bot.position.y = -.05;
  scene.add(bot);

  const dark = new THREE.MeshStandardMaterial({ color: 0x11172b, roughness: .22, metalness: .72 });
  const shell = new THREE.MeshStandardMaterial({ color: 0x28304d, roughness: .28, metalness: .68 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x071425, roughness: .08, metalness: .35, emissive: 0x03121a, emissiveIntensity: .75 });
  const cyan = new THREE.MeshStandardMaterial({ color: 0x65f7ff, roughness: .15, metalness: .32, emissive: 0x36deec, emissiveIntensity: 2.2 });
  const violet = new THREE.MeshStandardMaterial({ color: 0xaa6cff, roughness: .2, metalness: .32, emissive: 0x7c33d6, emissiveIntensity: 1.9 });
  const pink = new THREE.MeshStandardMaterial({ color: 0xff62dc, roughness: .18, metalness: .28, emissive: 0xd52eaa, emissiveIntensity: 2.1 });

  const roundedBox = (w, h, d, radius, material) => {
    const shape = new THREE.Shape();
    const x = -w / 2, y = -h / 2;
    shape.moveTo(x + radius, y);
    shape.lineTo(x + w - radius, y);
    shape.quadraticCurveTo(x + w, y, x + w, y + radius);
    shape.lineTo(x + w, y + h - radius);
    shape.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    shape.lineTo(x + radius, y + h);
    shape.quadraticCurveTo(x, y + h, x, y + h - radius);
    shape.lineTo(x, y + radius);
    shape.quadraticCurveTo(x, y, x + radius, y);
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: true, bevelSize: .045, bevelThickness: .05, bevelSegments: 3 });
    geometry.center();
    return new THREE.Mesh(geometry, material);
  };

  const body = roundedBox(5.55, 4.12, .72, .42, shell);
  body.position.set(0, -.05, 0);
  bot.add(body);
  const chest = roundedBox(4.95, 3.3, .22, .28, dark);
  chest.position.set(0, -.08, .49);
  bot.add(chest);
  const screen = roundedBox(4.36, 2.16, .07, .18, glass);
  screen.position.set(0, .06, .65);
  bot.add(screen);

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 3.07, .06);
  bot.add(headGroup);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(.34, .46, .6, 16), dark);
  neck.position.y = -.6;
  headGroup.add(neck);
  const head = roundedBox(2.05, 1.25, .84, .38, shell);
  headGroup.add(head);
  const face = roundedBox(1.65, .77, .12, .25, glass);
  face.position.z = .49;
  headGroup.add(face);
  const earGeometry = new THREE.CylinderGeometry(.22, .22, .24, 16);
  const earL = new THREE.Mesh(earGeometry, violet); earL.rotation.z = Math.PI / 2; earL.position.x = -1.12;
  const earR = earL.clone(); earR.position.x = 1.12;
  headGroup.add(earL, earR);
  const antenna = new THREE.Group();
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(.035,.045,.66,8), dark); stem.position.y = .83;
  const tip = new THREE.Mesh(new THREE.SphereGeometry(.12,12,8), cyan); tip.position.y = 1.16;
  antenna.add(stem, tip); headGroup.add(antenna);

  const arms = [];
  [-1, 1].forEach(side => {
    const arm = new THREE.Group();
    arm.position.set(side * 3.15, 1.28, .03);
    const shoulder = new THREE.Mesh(new THREE.SphereGeometry(.45, 18, 12), shell);
    const upper = roundedBox(.66, 2.2, .68, .28, shell); upper.position.y = -1.08;
    const stripe = roundedBox(.14, 1.25, .72, .06, side < 0 ? cyan : violet); stripe.position.set(side * .18, -1.1, .04);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(.42, 16, 12), dark); hand.position.y = -2.3;
    arm.add(shoulder, upper, stripe, hand);
    bot.add(arm); arms.push(arm);
  });

  const feet = [];
  [-1, 1].forEach(side => {
    const leg = roundedBox(1.45, .55, 1.2, .22, shell);
    leg.position.set(side * 1.63, -2.48, .06);
    bot.add(leg); feet.push(leg);
    const footLight = roundedBox(.8,.09,.06,.04,side < 0 ? cyan : violet);
    footLight.position.set(side * 1.63,-2.45,.68);
    bot.add(footLight);
  });

  const sidePanels = [];
  for (let i = 0; i < 6; i += 1) {
    const panel = roundedBox(1.02, .31, .18, .1, i % 2 ? violet : cyan);
    const angle = (i / 6) * Math.PI * 2;
    panel.position.set(Math.sin(angle) * 3.0, .04 + Math.cos(angle) * 2.6, .18);
    panel.rotation.z = -angle;
    panel.userData.home = { x: panel.position.x, y: panel.position.y, r: panel.rotation.z };
    panel.scale.set(.08,.08,.08);
    panel.visible = false;
    bot.add(panel); sidePanels.push(panel);
  }

  const floor = new THREE.Mesh(new THREE.CircleGeometry(5.6, 64), new THREE.MeshStandardMaterial({ color: 0x12152b, roughness: .48, metalness: .35, transparent: true, opacity: .7 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -2.78;
  floor.position.z = .5;
  scene.add(floor);
  const floorRing = new THREE.Mesh(new THREE.RingGeometry(3.5, 3.55, 64), new THREE.MeshBasicMaterial({ color: 0x4cecff, transparent: true, opacity: .38, side: THREE.DoubleSide }));
  floorRing.rotation.x = -Math.PI / 2;
  floorRing.position.y = -2.765;
  scene.add(floorRing);

  const particlesGeometry = new THREE.BufferGeometry();
  const particleCount = 140;
  const points = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount; i += 1) {
    points[i*3] = (Math.random() - .5) * 17;
    points[i*3+1] = (Math.random() - .5) * 11;
    points[i*3+2] = (Math.random() - .5) * 7 - 1;
  }
  particlesGeometry.setAttribute("position", new THREE.BufferAttribute(points, 3));
  const particles = new THREE.Points(particlesGeometry, new THREE.PointsMaterial({ color: 0x73f6ff, size: .035, transparent: true, opacity: .47 }));
  scene.add(particles);

  scene.add(new THREE.HemisphereLight(0x879cff, 0x090914, 1.5));
  const key = new THREE.PointLight(0x55f4ff, 30, 18); key.position.set(-4,4,6); scene.add(key);
  const rim = new THREE.PointLight(0xb05cff, 28, 17); rim.position.set(4,1,3); scene.add(rim);
  const warm = new THREE.PointLight(0xffcf77, 9, 10); warm.position.set(0,-1,5); scene.add(warm);

  let spinning = false, overdrive = false, wheel = false, jackpot = false;
  let wheelMix = 0, reaction = 0;
  const clock = new THREE.Clock();

  function resize() {
    const rect = host.getBoundingClientRect();
    renderer.setSize(rect.width, rect.height, false);
    camera.aspect = rect.width / Math.max(1, rect.height);
    camera.updateProjectionMatrix();
  }
  const observer = new ResizeObserver(resize); observer.observe(host); resize();

  function animate() {
    const dt = Math.min(.05, clock.getDelta());
    const t = clock.elapsedTime;
    wheelMix += ((wheel ? 1 : 0) - wheelMix) * Math.min(1, dt * 5.2);
    reaction *= Math.pow(.08, dt);
    bot.position.y = -.05 + Math.sin(t * 1.25) * .035 + reaction * .06;
    bot.rotation.y = Math.sin(t * .55) * .012;
    headGroup.rotation.z = Math.sin(t * .9) * .012 + reaction * .035;
    headGroup.position.y = 3.07 + wheelMix * .42 + (spinning ? Math.sin(t * 8) * .025 : 0);
    antenna.rotation.z = Math.sin(t * (spinning ? 8 : 2.2)) * (spinning ? .13 : .03);
    arms[0].rotation.z += ((wheel ? -1.35 : .08) - arms[0].rotation.z) * Math.min(1, dt * 5);
    arms[1].rotation.z += ((wheel ? 1.35 : -.08) - arms[1].rotation.z) * Math.min(1, dt * 5);
    arms[0].position.x += ((wheel ? -3.72 : -3.15) - arms[0].position.x) * Math.min(1, dt * 5);
    arms[1].position.x += ((wheel ? 3.72 : 3.15) - arms[1].position.x) * Math.min(1, dt * 5);
    sidePanels.forEach((panel, index) => {
      panel.visible = wheelMix > .03;
      const targetScale = wheel ? 1 : .08;
      panel.scale.setScalar(panel.scale.x + (targetScale - panel.scale.x) * Math.min(1, dt * 7));
      panel.rotation.z = panel.userData.home.r + Math.sin(t*2+index)*.015;
    });
    cyan.emissiveIntensity = (overdrive ? 3.7 : 2.2) + Math.sin(t*3)*.18 + (jackpot ? 3 : 0);
    violet.emissiveIntensity = (overdrive ? 3.2 : 1.9) + Math.sin(t*2.3+1)*.15 + (jackpot ? 2.5 : 0);
    pink.emissiveIntensity = 2.1 + (overdrive ? 1.6 : 0) + (jackpot ? 2.2 : 0);
    floorRing.material.opacity = .32 + Math.sin(t * (spinning ? 5 : 1.8)) * .12 + (overdrive ? .15 : 0);
    floorRing.rotation.z = t * (spinning ? .8 : .12);
    particles.rotation.y = t * .015;
    particles.position.y = Math.sin(t*.25)*.15;
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  animate();

  return {
    setSpinning(value) { spinning = Boolean(value); },
    setOverdrive(value) { overdrive = Boolean(value); },
    setWheel(value) { wheel = Boolean(value); },
    setJackpot(value) { jackpot = Boolean(value); },
    react(kind) { reaction = kind === "win" ? 1 : -.45; }
  };
}

let audioContext;
function soundEffect(kind) {
  if (!state.sound || !window.AudioContext) return;
  audioContext ||= new AudioContext();
  if (audioContext.state === "suspended") audioContext.resume();
  const now = audioContext.currentTime;
  const patterns = {
    spin: [[95, .05, .1], [145, .1, .13], [220, .17, .15]],
    stop: [[120, 0, .08]],
    win: [[330, 0, .09], [495, .09, .12], [660, .19, .16]],
    transform: [[110, 0, .18], [180, .12, .2], [310, .28, .28]],
    wheel: [[440, 0, .11], [660, .1, .13], [880, .22, .2]],
    jackpot: [[262, 0, .22], [330, .14, .22], [392, .28, .22], [523, .44, .48]],
    toggle: [[520, 0, .08]]
  };
  (patterns[kind] || patterns.toggle).forEach(([frequency, delay, duration], index) => {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = kind === "transform" ? "sawtooth" : (index % 2 ? "triangle" : "sine");
    oscillator.frequency.setValueAtTime(frequency, now + delay);
    gain.gain.setValueAtTime(0.0001, now + delay);
    gain.gain.exponentialRampToValueAtTime(kind === "jackpot" ? .07 : .035, now + delay + .018);
    gain.gain.exponentialRampToValueAtTime(.0001, now + delay + duration);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(now + delay);
    oscillator.stop(now + delay + duration + .025);
  });
}

const rig = createRobotRig(ui.canvas, ui.stage);
renderGrid(DEMO_GRID);
setWager(state.wager);
loadInitialState();
