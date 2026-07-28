import { resolveSkinForGame } from "./resolver.mjs";
import { clone, sha256Hex } from "./stable.mjs";

export class SkinRuntime {
  #adapters = new Map();
  #applied = new Map();

  registerAdapter(adapter) {
    for (const method of ["describe", "apply", "rollback"]) {
      if (typeof adapter?.[method] !== "function") {
        throw new TypeError(`Adapter requires ${method}().`);
      }
    }
    if (!adapter.id || this.#adapters.has(adapter.id)) {
      throw new Error(`Adapter ID "${adapter?.id}" is missing or already registered.`);
    }
    this.#adapters.set(adapter.id, adapter);
    return this;
  }

  listAdapters() {
    return [...this.#adapters.values()].map((adapter) => ({
      id: adapter.id,
      contract: clone(adapter.describe())
    }));
  }

  async prepare({ adapterId, packs, instance = null, policy }) {
    const adapter = this.#adapters.get(adapterId);
    if (!adapter) throw new Error(`Unknown adapter: ${adapterId}`);
    const resolution = await resolveSkinForGame({
      packs,
      gameContract: adapter.describe(),
      instance,
      policy
    });
    if (!resolution.ok) return resolution;

    const proposal = {
      type: "axm.skin-apply-proposal",
      version: "1.0",
      adapterId,
      resolved: resolution.resolved,
      receipt: resolution.receipt
    };
    proposal.proposalId = await sha256Hex(proposal);
    return { ok: true, status: "PREVIEW_READY", proposal };
  }

  async preview(proposal) {
    const adapter = this.#adapters.get(proposal?.adapterId);
    if (!adapter) throw new Error(`Unknown adapter: ${proposal?.adapterId}`);
    if (typeof adapter.preview !== "function") {
      return {
        ok: false,
        status: "UNSUPPORTED",
        reason: "Adapter does not implement preview()."
      };
    }
    return adapter.preview(clone(proposal.resolved));
  }

  async apply({ proposal, approval }) {
    if (!approval?.approved || !String(approval.actor ?? "").trim()) {
      return {
        ok: false,
        status: "BLOCKED",
        reason: "Explicit approval with a visible actor is required."
      };
    }
    const adapter = this.#adapters.get(proposal?.adapterId);
    if (!adapter) throw new Error(`Unknown adapter: ${proposal?.adapterId}`);
    if (proposal.resolved?.presentationAuthority !== "ZERO_AUTHORITATIVE_WRITES") {
      return { ok: false, status: "REJECTED", reason: "Presentation authority boundary missing." };
    }

    const adapterResult = await adapter.apply(clone(proposal.resolved));
    if (!adapterResult?.ok || adapterResult.rollbackToken === undefined) {
      return {
        ok: false,
        status: "APPLY_FAILED",
        adapterResult: adapterResult ?? null
      };
    }

    const applyId = await sha256Hex({
      proposalId: proposal.proposalId,
      actor: approval.actor,
      reason: approval.reason ?? null,
      adapterEvidence: adapterResult.evidence ?? null
    });
    this.#applied.set(applyId, {
      adapterId: adapter.id,
      rollbackToken: adapterResult.rollbackToken
    });
    return {
      ok: true,
      status: "APPLIED",
      applyId,
      actor: approval.actor,
      resolutionReceipt: proposal.receipt,
      adapterEvidence: adapterResult.evidence ?? null
    };
  }

  async rollback(applyId, approval) {
    if (!approval?.approved || !String(approval.actor ?? "").trim()) {
      return { ok: false, status: "BLOCKED", reason: "Explicit rollback approval is required." };
    }
    const active = this.#applied.get(applyId);
    if (!active) return { ok: false, status: "NOT_FOUND", reason: "Unknown apply receipt." };
    const adapter = this.#adapters.get(active.adapterId);
    const result = await adapter.rollback(active.rollbackToken);
    if (result?.ok) this.#applied.delete(applyId);
    return {
      ok: Boolean(result?.ok),
      status: result?.ok ? "ROLLED_BACK" : "ROLLBACK_FAILED",
      actor: approval.actor,
      adapterEvidence: result?.evidence ?? null
    };
  }
}
