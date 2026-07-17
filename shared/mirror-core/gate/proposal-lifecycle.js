'use strict';

const TRANSITIONS = {
  DRAFT: ['VALIDATED', 'REJECTED', 'EXPIRED'],
  VALIDATED: ['PROPOSED', 'AMENDMENT_REQUIRED', 'REJECTED', 'EXPIRED'],
  PROPOSED: ['UNDER_REVIEW', 'APPROVED', 'AMENDMENT_REQUIRED', 'REJECTED', 'CONFLICTED', 'EXPIRED'],
  UNDER_REVIEW: ['APPROVED', 'AMENDMENT_REQUIRED', 'REJECTED', 'CONFLICTED', 'EXPIRED'],
  APPROVED: ['APPLYING', 'CONFLICTED', 'EXPIRED', 'FAILED'],
  APPLYING: ['APPLIED', 'PARTIALLY_APPLIED', 'FAILED', 'CONFLICTED'],
  APPLIED: ['VERIFIED', 'ROLLED_BACK', 'FAILED'],
  VERIFIED: ['ROLLED_BACK'],
  REJECTED: [],
  AMENDMENT_REQUIRED: ['DRAFT'],
  CONFLICTED: ['DRAFT', 'AMENDMENT_REQUIRED'],
  EXPIRED: [],
  FAILED: ['DRAFT', 'ROLLED_BACK'],
  ROLLED_BACK: [],
  PARTIALLY_APPLIED: ['ROLLED_BACK', 'FAILED']
};

function canTransition(from, to) {
  return (TRANSITIONS[from] || []).includes(to);
}

function transition(packet, to) {
  if (!packet || !canTransition(packet.status, to)) throw new Error('illegal proposal transition ' + String(packet && packet.status) + ' -> ' + to);
  packet.status = to;
  return packet;
}

module.exports = { TRANSITIONS, canTransition, transition };
