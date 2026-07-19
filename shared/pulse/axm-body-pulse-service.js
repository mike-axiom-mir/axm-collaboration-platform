'use strict';

const os = require('os');
const childProcess = require('child_process');
const Pulse = require('./axm-body-pulse-core');

function number(value) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; }

function readGpu() {
  try {
    const output = childProcess.execFileSync('C:\\Windows\\System32\\nvidia-smi.exe', [
      '--query-gpu=utilization.gpu,temperature.gpu,memory.used,memory.total',
      '--format=csv,noheader,nounits'
    ], { encoding: 'utf8', timeout: 2000, windowsHide: true });
    const rows = String(output).trim().split(/\r?\n/).filter(Boolean).map(line => line.split(',').map(value => number(value.trim())));
    if (!rows.length) return {};
    const utilization = rows.map(row => row[0]).filter(value => value != null);
    const temperatures = rows.map(row => row[1]).filter(value => value != null);
    const memoryUsed = rows.reduce((sum, row) => sum + (row[2] || 0), 0);
    const memoryTotal = rows.reduce((sum, row) => sum + (row[3] || 0), 0);
    return {
      gpuUsedRatio: utilization.length ? Math.max(...utilization) / 100 : null,
      gpuTemperatureC: temperatures.length ? Math.max(...temperatures) : null,
      gpuMemoryUsedRatio: memoryTotal > 0 ? memoryUsed / memoryTotal : null,
      temperatureSource: 'nvidia-smi:gpu'
    };
  } catch (error) { return {}; }
}

function readBattery() {
  try {
    const script = "$b=Get-CimInstance Win32_Battery | Select-Object -First 1;if($b){[pscustomobject]@{percent=[double]$b.EstimatedChargeRemaining;status=[int]$b.BatteryStatus;onBattery=([int]$b.BatteryStatus -eq 1)}|ConvertTo-Json -Compress}";
    const output = childProcess.execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf8', timeout: 3000, windowsHide: true }).trim();
    if (!output) return {};
    const battery = JSON.parse(output);
    return { batteryPercent: number(battery.percent), onBattery: battery.onBattery === true, batteryStatusCode: number(battery.status) };
  } catch (error) { return {}; }
}

function cpuSnapshot() {
  const cpus = os.cpus();
  let idle = 0;
  let total = 0;
  cpus.forEach(cpu => {
    const times = cpu.times || {};
    idle += Number(times.idle || 0);
    total += Number(times.user || 0) + Number(times.nice || 0) + Number(times.sys || 0) + Number(times.idle || 0) + Number(times.irq || 0);
  });
  return { idle, total };
}

function create(options) {
  if (!options || typeof options.read !== 'function' || typeof options.write !== 'function') throw new Error('Body Pulse read/write adapters required');
  let previousCpu = cpuSnapshot();
  let hardwareCache = { sampledAt: 0, data: {} };

  function hardware() {
    if (Date.now() - hardwareCache.sampledAt < 15000) return hardwareCache.data;
    hardwareCache = { sampledAt: Date.now(), data: Object.assign({}, readGpu(), readBattery()) };
    return hardwareCache.data;
  }

  function read() {
    let state;
    try { state = Pulse.normalize(options.read()); } catch (error) { state = Pulse.createState(); }
    if (!state.modules['asset-fabric']) state = Pulse.registerModule(state, {
      moduleId: 'asset-fabric', name: 'Asset Fabric', goalQueueId: 'creative-fabric-goals', enabled: false,
      priority: 55, activeCadenceMs: 900000, idleCadenceMs: 3600000,
      cost: { cpu: 2, memory: 1, gpu: 0 }, authority: 'incubator-only', promotionGate: 'optional-project-constitution-or-explicit-export'
    });
    if (!state.modules['governed-evolution-lab']) state = Pulse.registerModule(state, {
      moduleId: 'governed-evolution-lab', name: 'Living World Lineage', goalQueueId: 'world-lineage-goals', enabled: false,
      priority: 60, activeCadenceMs: 900000, idleCadenceMs: 7200000,
      cost: { cpu: 4, memory: 2, gpu: 1 }, authority: 'disposable-lineage-only', promotionGate: 'exam-and-steward-review'
    });
    if (!state.modules['mirror-learning-forge']) state = Pulse.registerModule(state, {
      moduleId: 'mirror-learning-forge', name: 'Mirror Learning Forge', goalQueueId: 'mirror-learning-goals', enabled: false,
      allowMaintenance: true, priority: 75, activeCadenceMs: 900000, idleCadenceMs: 7200000,
      cost: { cpu: 4, memory: 4, gpu: 0 }, authority: 'challenger-only', promotionGate: 'held-out-evidence-and-explicit-steward-review'
    });
    return state;
  }

  function write(state) {
    options.write(Pulse.normalize(state));
    return state;
  }

  function sample(state) {
    const current = cpuSnapshot();
    const totalDelta = current.total - previousCpu.total;
    const idleDelta = current.idle - previousCpu.idle;
    previousCpu = current;
    const cpuUsedRatio = totalDelta > 0 ? Math.max(0, Math.min(1, 1 - idleDelta / totalDelta)) : null;
    const totalMemory = os.totalmem();
    const memoryUsedRatio = totalMemory > 0 ? Math.max(0, Math.min(1, 1 - os.freemem() / totalMemory)) : null;
    const sensors = hardware();
    return Pulse.sampleBody(state, {
      cpuUsedRatio,
      memoryUsedRatio,
      gpuUsedRatio: sensors.gpuUsedRatio,
      gpuTemperatureC: sensors.gpuTemperatureC,
      cpuTemperatureC: null,
      temperatureSource: sensors.temperatureSource,
      batteryPercent: sensors.batteryPercent,
      onBattery: sensors.onBattery
    });
  }

  function status() {
    const state = write(sample(read()));
    const result = Pulse.status(state);
    result.body.unknownSignals = ['gpu', 'gpu-thermal', 'cpu-thermal', 'battery'].filter(name => !result.body.knownSignals.includes(name));
    result.body.note = 'CPU and memory come from the local Node host. NVIDIA load and GPU temperature come from nvidia-smi. Battery comes from Windows. MSI Center is present but exposes no supported read-only CIM sensor values on this laptop, so CPU thermal remains unknown.';
    return result;
  }

  function register(input) { return Pulse.status(write(Pulse.registerModule(read(), input))); }
  function setMode(input) { return Pulse.status(write(Pulse.setMode(read(), input.mode, input.actorId || 'unknown'))); }
  function goal(input) { return Pulse.status(write(Pulse.upsertGoal(read(), input))); }
  function deleteGoals(input) { return Pulse.status(write(Pulse.deleteGoals(read(), input.goalIds, input.actorId || 'unknown'))); }

  function request(input) {
    let state = sample(read());
    const result = Pulse.requestPulse(state, input);
    write(result.state);
    const answer = Object.assign({}, result);
    delete answer.state;
    return answer;
  }

  function complete(input) {
    const result = Pulse.completePulse(read(), input);
    write(result.state);
    return { ok: true, receipt: result.receipt, status: Pulse.status(result.state) };
  }

  write(read());
  return { VERSION: Pulse.VERSION, status, register, setMode, goal, deleteGoals, request, complete };
}

module.exports = { create };
