'use strict';

class MirrorGate {
  constructor(permissionEngine, consentEngine, journal) {
    this.permissions = permissionEngine;
    this.consents = consentEngine;
    this.journal = journal;
  }

  authorize(input) {
    input = input || {};
    const permission = this.permissions.evaluate(input.actor_id, input.permission, input.context);
    if (!permission.allow) {
      this.journal.append('gate_denied', {
        actor: input.actor,
        system: input.context && input.context.system_id || 'mirror-core',
        related_packet: input.related_packet || null,
        payload: { permission: input.permission, reason: permission.reason }
      });
      return { allow: false, reason: permission.reason, permission, consent: null };
    }
    let consent = null;
    if (input.consent) {
      consent = this.consents.evaluate(input.consent);
      if (!consent.allow) {
        this.journal.append('gate_denied', {
          actor: input.actor,
          system: input.consent.system_id,
          related_packet: input.related_packet || null,
          payload: { permission: input.permission, reason: consent.reason }
        });
        return { allow: false, reason: consent.reason, permission, consent };
      }
    }
    this.journal.append('gate_allowed', {
      actor: input.actor,
      system: input.context && input.context.system_id || 'mirror-core',
      related_packet: input.related_packet || null,
      payload: { permission: input.permission, reason: 'scoped permission and consent passed' }
    });
    return { allow: true, reason: 'scoped permission and consent passed', permission, consent };
  }

  require(input) {
    const verdict = this.authorize(input);
    if (!verdict.allow) throw new Error(verdict.reason);
    return verdict;
  }
}

module.exports = { MirrorGate };
