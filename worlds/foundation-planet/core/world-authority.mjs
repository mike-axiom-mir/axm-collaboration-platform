import { PLANET_DEFAULTS, CONDITION_PROFILES, sampleLatLon } from './planet-model.mjs';
import { createSectorFrame, localToCanonical } from './physics-contract.mjs';
import { createParticipantEntity } from './host-protocol.mjs';

export const AUTHORITY_KERNEL_SCHEMA = 'axm.foundation-planet.authority-kernel/v1';
export const CONTROLLER_INPUT_SCHEMA = 'axm.controller-input/v1';
export const AUTHORITY_PATCH_SCHEMA = 'axm.foundation-planet.authority-patch/v1';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const normalizeLongitude = longitude => ((Number(longitude) + 540) % 360) - 180;
const clone = value => JSON.parse(JSON.stringify(value));

function cleanId(value, label) {
  const id = String(value || '').trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{1,79}$/.test(id)) throw new TypeError(`${label} must use lowercase letters, digits and hyphens`);
  return id;
}

function coordinateOf(value) {
  const latitudeDeg = Number(value?.latitudeDeg ?? value?.lat), longitudeDeg = Number(value?.longitudeDeg ?? value?.lon);
  if (!Number.isFinite(latitudeDeg) || !Number.isFinite(longitudeDeg) || latitudeDeg < -90 || latitudeDeg > 90) throw new TypeError('participant canonical coordinate is invalid');
  return {
    latitudeDeg,
    longitudeDeg: normalizeLongitude(longitudeDeg),
    elevationM: Number.isFinite(Number(value?.elevationM)) ? Number(value.elevationM) : 0
  };
}

function boundedAxes(raw) {
  const source = Array.isArray(raw) ? raw : [];
  return Array.from({ length: 4 }, (_, index) => clamp(Number(source[index]) || 0, -1, 1));
}

function boundedButtons(raw) {
  const buttons = {};
  for (const [key, value] of Object.entries(raw && typeof raw === 'object' ? raw : {}).slice(0, 32)) {
    if (/^[a-z0-9_-]{1,40}$/i.test(key)) buttons[key.toLowerCase()] = value === true;
  }
  return buttons;
}

export function sanitizeControllerInput(packet) {
  if (!packet || packet.schema !== CONTROLLER_INPUT_SCHEMA) throw new TypeError('controller input schema mismatch');
  const sessionId = cleanId(packet.sessionId, 'sessionId'), seatId = cleanId(packet.seatId, 'seatId');
  const sequence = Math.floor(Number(packet.seq));
  if (!Number.isSafeInteger(sequence) || sequence < 0) throw new TypeError('controller input sequence must be a non-negative safe integer');
  return {
    schema: CONTROLLER_INPUT_SCHEMA,
    sessionId,
    seatId,
    seq: sequence,
    axes: boundedAxes(packet.axes),
    buttons: boundedButtons(packet.buttons),
    receivedAt: Number.isFinite(Number(packet.at)) ? Number(packet.at) : null
  };
}

function participantRecord(input, profileId) {
  const coordinate = coordinateOf(input.coordinate || input.location);
  const sample = sampleLatLon(coordinate.latitudeDeg, coordinate.longitudeDeg, { profile: profileId, seed: PLANET_DEFAULTS.seed });
  coordinate.elevationM = Number.isFinite(Number(input.coordinate?.elevationM ?? input.location?.elevationM))
    ? coordinate.elevationM
    : (sample.land ? sample.elevationM : 0);
  return {
    participantId: cleanId(input.participantId || input.id, 'participantId'),
    seatId: cleanId(input.seatId, 'seatId'),
    actorType: ['human', 'ai', 'adapter'].includes(input.actorType) ? input.actorType : 'human',
    coordinate,
    headingDeg: normalizeLongitude(Number(input.headingDeg || 0)),
    movementMode: sample.land ? 'walk' : 'swim',
    velocityEastMps: 0,
    velocityNorthMps: 0,
    input: { strafe: 0, forward: 0, lookX: 0, lookY: 0, sprint: false, action: false },
    lastInputSequence: -1,
    lastInputTick: -1,
    joinedTick: 0,
    presence: 'present',
    surface: { biome: sample.biome, land: sample.land, elevationM: sample.elevationM },
    gameBinding: input.gameBinding ? cleanId(input.gameBinding, 'gameBinding') : null
  };
}

export class FoundationAuthorityKernel {
  constructor(options = {}) {
    this.worldId = PLANET_DEFAULTS.id;
    this.lineageId = String(options.lineageId || `${PLANET_DEFAULTS.id}:${PLANET_DEFAULTS.seed}:root`);
    this.profileId = CONDITION_PROFILES[options.profileId] ? options.profileId : 'temperate';
    this.fixedStepSeconds = clamp(Number(options.fixedStepSeconds || 1 / 30), 1 / 120, 1 / 10);
    this.maximumSubsteps = clamp(Math.floor(Number(options.maximumSubsteps || 8)), 1, 16);
    this.maximumParticipants = clamp(Math.floor(Number(options.maximumParticipants || 8)), 1, 64);
    this.inputTimeoutTicks = Math.max(1, Math.ceil(Number(options.inputTimeoutSeconds || .5) / this.fixedStepSeconds));
    this.tick = 0;
    this.elapsedSeconds = 0;
    this.accumulatorSeconds = 0;
    this.participants = new Map();
    this.seatBindings = new Map();
    this.receipts = [];
  }

  join(input) {
    if (this.participants.size >= this.maximumParticipants) throw new Error('authority participant limit reached');
    const participant = participantRecord(input || {}, this.profileId);
    if (this.participants.has(participant.participantId)) throw new Error('participant already joined');
    if (this.seatBindings.has(participant.seatId)) throw new Error('seat already bound');
    participant.joinedTick = this.tick;
    this.participants.set(participant.participantId, participant);
    this.seatBindings.set(participant.seatId, participant.participantId);
    this.recordReceipt({ type: 'participant-joined', participantId: participant.participantId, seatId: participant.seatId });
    return clone(participant);
  }

  disconnect(participantId) {
    const id = cleanId(participantId, 'participantId'), participant = this.participants.get(id);
    if (!participant) throw new Error('participant not found');
    participant.presence = 'disconnected';
    participant.input = { strafe: 0, forward: 0, lookX: 0, lookY: 0, sprint: false, action: false };
    this.recordReceipt({ type: 'participant-disconnected', participantId: id, seatId: participant.seatId });
    return clone(participant);
  }

  reconnect(participantId, seatId) {
    const id = cleanId(participantId, 'participantId'), nextSeatId = cleanId(seatId, 'seatId'), participant = this.participants.get(id);
    if (!participant) throw new Error('participant not found');
    const occupied = this.seatBindings.get(nextSeatId);
    if (occupied && occupied !== id) throw new Error('seat already bound');
    this.seatBindings.delete(participant.seatId);
    this.seatBindings.set(nextSeatId, id);
    participant.seatId = nextSeatId;
    participant.presence = 'present';
    this.recordReceipt({ type: 'participant-reconnected', participantId: id, seatId: nextSeatId });
    return clone(participant);
  }

  acceptControllerInput(rawPacket) {
    const packet = sanitizeControllerInput(rawPacket), participantId = this.seatBindings.get(packet.seatId);
    if (!participantId) throw new Error('controller seat is not bound to a planet participant');
    const participant = this.participants.get(participantId);
    if (participant.presence !== 'present') throw new Error('participant is disconnected');
    if (packet.seq <= participant.lastInputSequence) throw new Error('stale or replayed controller input');
    const [strafe, forward, lookX, lookY] = packet.axes;
    participant.input = {
      strafe, forward: -forward, lookX, lookY,
      sprint: packet.buttons.sprint === true || packet.buttons.l3 === true,
      action: packet.buttons.action === true || packet.buttons.a === true
    };
    participant.lastInputSequence = packet.seq;
    participant.lastInputTick = this.tick;
    return { accepted: true, participantId, seatId: packet.seatId, sequence: packet.seq, tick: this.tick };
  }

  integrateParticipant(participant, dt) {
    const inputFresh = participant.lastInputTick >= 0 && this.tick - participant.lastInputTick <= this.inputTimeoutTicks;
    const input = inputFresh ? participant.input : { strafe: 0, forward: 0, sprint: false, lookX: 0 };
    participant.headingDeg = normalizeLongitude(participant.headingDeg + clamp(Number(input.lookX || 0), -1, 1) * 90 * dt);
    let east = Number(input.strafe || 0), north = Number(input.forward || 0), length = Math.hypot(east, north);
    if (length > 1) { east /= length; north /= length; length = 1; }
    const speedMps = participant.movementMode === 'swim' ? 2.7 : input.sprint ? 8.6 : 4.8;
    const heading = participant.headingDeg * Math.PI / 180;
    const desiredEast = (east * Math.cos(heading) + north * Math.sin(heading)) * speedMps;
    const desiredNorth = (north * Math.cos(heading) - east * Math.sin(heading)) * speedMps;
    const response = 1 - Math.exp(-(inputFresh ? 9 : 6) * dt);
    participant.velocityEastMps += (desiredEast - participant.velocityEastMps) * response;
    participant.velocityNorthMps += (desiredNorth - participant.velocityNorthMps) * response;
    if (length === 0) {
      const drag = Math.exp(-7 * dt);
      participant.velocityEastMps *= drag;
      participant.velocityNorthMps *= drag;
    }
    const velocity = Math.hypot(participant.velocityEastMps, participant.velocityNorthMps);
    const maxSpeed = speedMps * 1.001;
    if (velocity > maxSpeed) {
      participant.velocityEastMps *= maxSpeed / velocity;
      participant.velocityNorthMps *= maxSpeed / velocity;
    }
    const frame = createSectorFrame(participant.coordinate.latitudeDeg, participant.coordinate.longitudeDeg, participant.coordinate.elevationM);
    const moved = localToCanonical(frame, {
      xM: participant.velocityEastMps * dt,
      yM: 0,
      zM: participant.velocityNorthMps * dt
    });
    const sample = sampleLatLon(moved.latitudeDeg, moved.longitudeDeg, { profile: this.profileId, seed: PLANET_DEFAULTS.seed });
    participant.coordinate = {
      latitudeDeg: moved.latitudeDeg,
      longitudeDeg: moved.longitudeDeg,
      elevationM: sample.land ? sample.elevationM : 0
    };
    participant.movementMode = sample.land ? 'walk' : 'swim';
    participant.surface = { biome: sample.biome, land: sample.land, elevationM: sample.elevationM };
  }

  step(deltaSeconds) {
    const delta = Number(deltaSeconds);
    if (!Number.isFinite(delta) || delta < 0) throw new TypeError('authority deltaSeconds must be finite and non-negative');
    this.accumulatorSeconds += Math.min(delta, this.fixedStepSeconds * this.maximumSubsteps);
    let substeps = 0;
    while (this.accumulatorSeconds + 1e-12 >= this.fixedStepSeconds && substeps < this.maximumSubsteps) {
      this.tick += 1;
      for (const participant of this.participants.values()) this.integrateParticipant(participant, this.fixedStepSeconds);
      this.elapsedSeconds += this.fixedStepSeconds;
      this.accumulatorSeconds -= this.fixedStepSeconds;
      substeps += 1;
    }
    return { tick: this.tick, elapsedSeconds: this.elapsedSeconds, substeps, participants: this.participants.size };
  }

  recordReceipt(event) {
    this.receipts.push({ schema: 'axm.foundation-planet.authority-event/v1', tick: this.tick, ...event });
    this.receipts = this.receipts.slice(-256);
  }

  participant(participantId) {
    const participant = this.participants.get(cleanId(participantId, 'participantId'));
    return participant ? clone(participant) : null;
  }

  snapshot() {
    return {
      schema: AUTHORITY_KERNEL_SCHEMA,
      worldId: this.worldId,
      lineageId: this.lineageId,
      profileId: this.profileId,
      fixedStepSeconds: this.fixedStepSeconds,
      tick: this.tick,
      elapsedSeconds: this.elapsedSeconds,
      participants: Array.from(this.participants.values()).map(clone),
      receipts: clone(this.receipts),
      authority: { movement: 'host', canonicalPosition: 'host', worldPersistence: 'living-world-state-server' }
    };
  }

  createPatch(expectedRevision, options = {}) {
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) throw new TypeError('expectedRevision must be a non-negative safe integer');
    const operations = Array.from(this.participants.values()).map(participant => ({
      type: 'upsert-entity',
      entity: createParticipantEntity({
        participantId: participant.participantId,
        seatId: participant.seatId,
        actorType: participant.actorType,
        coordinate: participant.coordinate,
        headingDeg: participant.headingDeg,
        movementMode: participant.movementMode,
        presence: participant.presence,
        lastInputSequence: participant.lastInputSequence,
        gameBinding: participant.gameBinding
      })
    }));
    operations.push({ type: 'set-fact', key: 'authority-tick', value: { tick: this.tick, elapsedSeconds: Number(this.elapsedSeconds.toFixed(6)), participantCount: this.participants.size, fixedStepSeconds: this.fixedStepSeconds } });
    return {
      schema: AUTHORITY_PATCH_SCHEMA,
      worldId: this.worldId,
      lineageId: this.lineageId,
      expectedRevision,
      source: 'foundation-planet-authority-kernel',
      actor: String(options.actor || 'foundation-authority').slice(0, 120),
      operations,
      applyAuthority: false,
      resetAuthority: false
    };
  }
}

export function authorityDescription() {
  return {
    schema: AUTHORITY_KERNEL_SCHEMA,
    fixedStep: true,
    canonicalPlanetMovement: true,
    maximumDefaultParticipants: 8,
    controllerInputSchema: CONTROLLER_INPUT_SCHEMA,
    replayProtection: 'monotonic-seat-sequence',
    positionClaimsFromClients: false,
    hostOwnsMovement: true,
    persistenceOwner: 'living-world-state-server',
    generalRigidBodyEngine: false
  };
}
