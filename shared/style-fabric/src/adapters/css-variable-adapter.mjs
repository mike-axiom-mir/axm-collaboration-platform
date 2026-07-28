function requireStyleTarget(target) {
  if (!target?.style || typeof target.style.setProperty !== "function") {
    throw new TypeError("CSS adapter target requires a CSSStyleDeclaration-like style object.");
  }
}

export function createCssVariableAdapter({
  id,
  contract,
  target,
  previewTarget = null,
  map
}) {
  requireStyleTarget(target);
  if (previewTarget) requireStyleTarget(previewTarget);

  function write(resolved, destination) {
    const previous = [];
    const applied = [];

    for (const [slotId, slotValue] of Object.entries(resolved.slots ?? {})) {
      const slotMap = map[slotId] ?? {};
      for (const [property, cssVariable] of Object.entries(slotMap)) {
        const value = slotValue.material?.[property];
        if (value === undefined) continue;
        previous.push({
          name: cssVariable,
          value: destination.style.getPropertyValue?.(cssVariable) ?? ""
        });
        const cssValue =
          typeof value === "number" && !["opacity", "metallic", "roughness", "gloss"].includes(property)
            ? String(value)
            : String(value);
        destination.style.setProperty(cssVariable, cssValue);
        applied.push({ slot: slotId, property, cssVariable, value: cssValue });
      }
    }
    return { previous, applied };
  }

  function restore(token, destination) {
    for (const entry of token.previous ?? []) {
      if (entry.value) destination.style.setProperty(entry.name, entry.value);
      else destination.style.removeProperty?.(entry.name);
    }
  }

  return {
    id,
    describe() {
      return contract;
    },
    async preview(resolved) {
      if (!previewTarget) {
        return { ok: false, status: "UNSUPPORTED", reason: "No isolated preview target configured." };
      }
      const token = write(resolved, previewTarget);
      return {
        ok: true,
        status: "PREVIEWED",
        evidence: { cssVariablesApplied: token.applied.length },
        rollbackToken: token
      };
    },
    async apply(resolved) {
      const token = write(resolved, target);
      return {
        ok: true,
        rollbackToken: token,
        evidence: { cssVariablesApplied: token.applied.length }
      };
    },
    async rollback(token) {
      restore(token, target);
      return { ok: true, evidence: { cssVariablesRestored: token.previous?.length ?? 0 } };
    }
  };
}
