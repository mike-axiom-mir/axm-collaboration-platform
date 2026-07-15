export type ControllerKind = 'human' | 'adapter' | 'ai';

export interface SeatIdentity {
  roomCode: string;
  sessionId: string;
  seatId: string;
  token: string;
}

export interface VectorState {
  x: number;
  y: number;
  active?: boolean;
  magnitude?: number;
  rawMagnitude?: number;
}

export interface SemanticInputPacket<TInput extends Record<string, unknown> = Record<string, unknown>> extends SeatIdentity {
  seq: number;
  input: TInput;
}

export interface ControllerProfile {
  schemaVersion?: 1;
  profileId: string;
  displayName?: string;
  sendIntervalMs?: number;
  vectors: Record<string, { xField: string; yField: string; activeField?: string | null; retainOnInactive?: boolean }>;
  buttons: Record<string, string>;
  releaseActions?: Record<string, string>;
  labels?: Record<string, string>;
  intent: {
    vectorPairs: Array<{ xField: string; yField: string }>;
    booleanFields: string[];
    pulseFields: string[];
  };
}

export interface SeatScreenObservation {
  ok: true;
  schemaVersion: 1;
  observationType: 'axm-seat-screen-semantics-v1';
  scope: 'same-party-shared-screen-only';
  sessionId: string;
  roomCode: string;
  tick: number | null;
  seatId: string;
  partyId: string;
  screen: Record<string, unknown>;
  self: Record<string, unknown>;
  partyHud: Array<Record<string, unknown>>;
  hud: Record<string, unknown>;
  visible: Record<string, unknown[]>;
  controls: {
    protocol: 'axm-semantic-input-v1';
    profile: string | null;
    inputEndpoint: string;
    nextSequenceMinimum: number;
  };
}
