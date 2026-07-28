import { validateSkinInstance } from "./instance.mjs";
import { resolveSkinForGame } from "./resolver.mjs";
import { clone, sha256Hex, stableStringify } from "./stable.mjs";
import { validateGameSkinContract } from "./validator.mjs";

const ADAPTER_API = "axm.style-adapter.v1";
const PROPOSAL_TYPE = "axm.skin-apply-proposal";
const PROPOSAL_VERSION = "1.0";

function proposalPayload(proposal) {
  if (!proposal || typeof proposal !== "object" || Array.isArray(proposal)) {
    throw new TypeError("Proposal must be an object.");
  }
  const payload = {};
  for (const key of Object.keys(proposal)) {
    if (key === "proposalId") continue;
    const descriptor = Object.getOwnPropertyDescriptor(proposal, key);
    if (!descriptor || !("value" in descriptor)) {
      throw new TypeError(`Proposal field "${key}" must be a data property.`);
    }
    Object.defineProperty(payload, key, {
      value: descriptor.value,
      enumerable: true,
      configurable: true,
      writable: true
    });
  }
  return payload;
}

function proposalField(proposal, key) {
  const descriptor = Object.getOwnPropertyDescriptor(proposal, key);
  if (!descriptor || !("value" in descriptor)) {
    throw new TypeError(`Proposal field "${key}" must be an own data property.`);
  }
  return descriptor.value;
}

async function calculateProposalId(proposal) {
  return sha256Hex(stableStringify(proposalPayload(proposal)));
}

function proposalRejection(status, reason) {
  return { ok: false, status, reason };
}

export class SkinRuntime {
  #adapters = new Map();
  #prepared = new Map();
  #applied = new Map();
  #preparationSequence = 0;
  #applicationSequence = 0;

  registerAdapter(adapter) {
    for (const method of ["describe", "apply", "rollback"]) {
      if (typeof adapter?.[method] !== "function") {
        throw new TypeError(`Adapter requires ${method}().`);
      }
    }
    if (
      typeof adapter.id !== "string" ||
      !adapter.id.trim() ||
      this.#adapters.has(adapter.id)
    ) {
      throw new Error(`Adapter ID "${adapter?.id}" is missing or already registered.`);
    }

    const contract = clone(adapter.describe());
    const validation = validateGameSkinContract(contract);
    if (contract?.adapterApi !== ADAPTER_API) {
      validation.errors.push({
        code: "INVALID_ADAPTER_API",
        path: "$.adapterApi",
        message: `adapterApi must be ${ADAPTER_API}.`
      });
      validation.ok = false;
    }
    if (!validation.ok) {
      const detail = validation.errors
        .map((entry) => entry.message ?? String(entry))
        .join("; ");
      throw new TypeError(`Adapter contract rejected: ${detail}`);
    }

    const contractCanonical = stableStringify(contract);
    this.#adapters.set(adapter.id, {
      id: adapter.id,
      contract,
      contractCanonical,
      preview:
        typeof adapter.preview === "function"
          ? adapter.preview.bind(adapter)
          : null,
      apply: adapter.apply.bind(adapter),
      rollback: adapter.rollback.bind(adapter)
    });
    return this;
  }

  listAdapters() {
    return [...this.#adapters.values()].map((adapter) => ({
      id: adapter.id,
      contract: clone(adapter.contract)
    }));
  }

  async prepare({ adapterId, packs, instance = null, policy }) {
    const adapter = this.#adapters.get(adapterId);
    if (!adapter) throw new Error(`Unknown adapter: ${adapterId}`);

    if (instance !== null) {
      const instanceValidation = validateSkinInstance(instance);
      if (!instanceValidation.ok) {
        return {
          ok: false,
          status: "REJECTED",
          errors: instanceValidation.errors.map((message) => ({
            code: "INVALID_SKIN_INSTANCE",
            path: "$.instance",
            message
          })),
          validation: { instance: instanceValidation }
        };
      }
    }

    const resolution = await resolveSkinForGame({
      packs,
      gameContract: clone(adapter.contract),
      instance,
      policy
    });
    if (!resolution.ok) return resolution;

    const contractSha256 = await sha256Hex(adapter.contractCanonical);
    const proposal = {
      type: PROPOSAL_TYPE,
      version: PROPOSAL_VERSION,
      adapterId,
      contractSha256,
      preparationSequence: ++this.#preparationSequence,
      resolved: resolution.resolved,
      receipt: resolution.receipt
    };
    proposal.proposalId = await calculateProposalId(proposal);
    const stored = clone(proposal);
    this.#prepared.set(proposal.proposalId, {
      state: "READY",
      adapterId,
      proposal: stored,
      canonical: stableStringify(stored)
    });
    return { ok: true, status: "PREVIEW_READY", proposal };
  }

  async #verifyPreparedProposal(candidate) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      return proposalRejection("REJECTED", "A prepared proposal object is required.");
    }
    let candidateId;
    try {
      if (
        proposalField(candidate, "type") !== PROPOSAL_TYPE ||
        proposalField(candidate, "version") !== PROPOSAL_VERSION
      ) {
        return proposalRejection("REJECTED", "Proposal type, version, or ID is invalid.");
      }
      candidateId = proposalField(candidate, "proposalId");
    } catch {
      return proposalRejection("REJECTED", "Proposal type, version, or ID is invalid.");
    }
    if (typeof candidateId !== "string") {
      return proposalRejection("REJECTED", "Proposal type, version, or ID is invalid.");
    }

    const prepared = this.#prepared.get(candidateId);
    if (!prepared) {
      return proposalRejection("REJECTED", "Proposal was not prepared by this runtime.");
    }

    let actualId;
    let canonical;
    try {
      actualId = await calculateProposalId(candidate);
      canonical = stableStringify(candidate);
    } catch (error) {
      return proposalRejection("REJECTED", `Proposal is not safe canonical data: ${error.message}`);
    }
    if (actualId !== candidateId) {
      return proposalRejection("REJECTED", "Proposal digest does not match its contents.");
    }
    if (canonical !== prepared.canonical) {
      return proposalRejection("REJECTED", "Proposal differs from the exact prepared envelope.");
    }

    const current = this.#prepared.get(candidateId);
    if (current !== prepared) {
      return proposalRejection("REJECTED", "Prepared proposal state changed during verification.");
    }
    if (prepared.state === "APPLYING") {
      return proposalRejection("BUSY", "Proposal apply is already in progress.");
    }
    if (prepared.state !== "READY") {
      return proposalRejection("REPLAYED", "Proposal has already been used.");
    }

    const adapter = this.#adapters.get(prepared.adapterId);
    if (!adapter) {
      return proposalRejection("REJECTED", "Prepared proposal adapter is no longer available.");
    }
    if (prepared.proposal.contractSha256 !== await sha256Hex(adapter.contractCanonical)) {
      return proposalRejection("REJECTED", "Adapter contract no longer matches the prepared proposal.");
    }
    const final = this.#prepared.get(candidateId);
    if (final !== prepared) {
      return proposalRejection("REJECTED", "Prepared proposal state changed during verification.");
    }
    if (final.state === "APPLYING") {
      return proposalRejection("BUSY", "Proposal apply is already in progress.");
    }
    if (final.state !== "READY") {
      return proposalRejection("REPLAYED", "Proposal has already been used.");
    }
    return { ok: true, prepared, adapter };
  }

  async preview(proposal) {
    const verified = await this.#verifyPreparedProposal(proposal);
    if (!verified.ok) return verified;
    if (!verified.adapter.preview) {
      return {
        ok: false,
        status: "UNSUPPORTED",
        reason: "Adapter does not implement preview()."
      };
    }
    return verified.adapter.preview(clone(verified.prepared.proposal.resolved));
  }

  async apply({ proposal, approval }) {
    const actor = typeof approval?.actor === "string" ? approval.actor.trim() : "";
    if (approval?.approved !== true || !actor) {
      return {
        ok: false,
        status: "BLOCKED",
        reason: "Explicit approval with a visible actor is required."
      };
    }
    if (approval.reason !== undefined && approval.reason !== null && typeof approval.reason !== "string") {
      return {
        ok: false,
        status: "BLOCKED",
        reason: "Approval reason must be visible string data when supplied."
      };
    }

    const verified = await this.#verifyPreparedProposal(proposal);
    if (!verified.ok) return verified;

    const current = this.#prepared.get(verified.prepared.proposal.proposalId);
    if (current !== verified.prepared || current.state !== "READY") {
      return current?.state === "APPLYING"
        ? proposalRejection("BUSY", "Proposal apply is already in progress.")
        : proposalRejection("REPLAYED", "Proposal has already been used.");
    }
    current.state = "APPLYING";

    const resolved = current.proposal.resolved;
    if (resolved?.presentationAuthority !== "ZERO_AUTHORITATIVE_WRITES") {
      current.state = "FAILED";
      return proposalRejection("REJECTED", "Presentation authority boundary missing.");
    }

    let adapterResult;
    try {
      adapterResult = await verified.adapter.apply(clone(resolved));
    } catch (error) {
      current.state = "FAILED";
      return {
        ok: false,
        status: "APPLY_FAILED",
        reason: error.message,
        adapterResult: null
      };
    }
    if (!adapterResult?.ok || adapterResult.rollbackToken === undefined) {
      current.state = "FAILED";
      return {
        ok: false,
        status: "APPLY_FAILED",
        adapterResult: adapterResult ?? null
      };
    }

    const operationSequence = ++this.#applicationSequence;
    const applyId = await sha256Hex({
      proposalId: current.proposal.proposalId,
      operationSequence,
      actor,
      reason: approval.reason ?? null
    });
    this.#applied.set(applyId, {
      state: "ACTIVE",
      adapterId: verified.adapter.id,
      proposalId: current.proposal.proposalId,
      rollbackToken: adapterResult.rollbackToken
    });
    current.state = "CONSUMED";
    return {
      ok: true,
      status: "APPLIED",
      applyId,
      actor,
      resolutionReceipt: clone(current.proposal.receipt),
      adapterEvidence: adapterResult.evidence ?? null
    };
  }

  async rollback(applyId, approval) {
    const actor = typeof approval?.actor === "string" ? approval.actor.trim() : "";
    if (approval?.approved !== true || !actor) {
      return { ok: false, status: "BLOCKED", reason: "Explicit rollback approval is required." };
    }
    const active = this.#applied.get(applyId);
    if (!active) return { ok: false, status: "NOT_FOUND", reason: "Unknown apply receipt." };
    if (active.state === "ROLLING_BACK") {
      return { ok: false, status: "BUSY", reason: "Rollback is already in progress." };
    }

    const adapter = this.#adapters.get(active.adapterId);
    if (!adapter) {
      return { ok: false, status: "ROLLBACK_FAILED", reason: "Adapter is unavailable." };
    }
    active.state = "ROLLING_BACK";

    let result;
    try {
      result = await adapter.rollback(active.rollbackToken);
    } catch (error) {
      active.state = "ACTIVE";
      return {
        ok: false,
        status: "ROLLBACK_FAILED",
        actor,
        reason: error.message,
        adapterEvidence: null
      };
    }
    if (result?.ok) this.#applied.delete(applyId);
    else active.state = "ACTIVE";
    return {
      ok: Boolean(result?.ok),
      status: result?.ok ? "ROLLED_BACK" : "ROLLBACK_FAILED",
      actor,
      adapterEvidence: result?.evidence ?? null
    };
  }
}
