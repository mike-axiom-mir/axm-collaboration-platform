import {
  calculateSkinIntegrity,
  validateSkinPack,
  verifyEmbeddedAssets,
  verifySkinIntegrity
} from "../core/validator.mjs";
import { sha256Hex, slugify, stableStringify } from "../core/stable.mjs";

export async function finalizePackForExport(pack) {
  const copy = structuredClone(pack);
  copy.integrity = await calculateSkinIntegrity(copy);
  return copy;
}

export async function serializeSkinPack(pack) {
  const finalized = await finalizePackForExport(pack);
  return {
    pack: finalized,
    text: `${stableStringify(finalized, 2)}\n`,
    filename: `${slugify(finalized.metadata?.name ?? finalized.id)}.axmskin.json`
  };
}

export async function downloadSkinPack(pack) {
  const exported = await serializeSkinPack(pack);
  const url = URL.createObjectURL(
    new Blob([exported.text], { type: "application/vnd.axm.skin+json" })
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = exported.filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
  return exported;
}

export async function readSkinPackFile(file, policy) {
  const text = await file.text();
  let pack;
  try {
    pack = JSON.parse(text);
  } catch (cause) {
    return {
      ok: false,
      status: "REJECTED",
      errors: [{ code: "INVALID_JSON", path: "$", message: cause.message }]
    };
  }
  const validation = validateSkinPack(pack, policy);
  if (!validation.ok) return { ok: false, status: "REJECTED", validation, pack };
  const assets = await verifyEmbeddedAssets(pack, policy);
  if (!assets.ok) return { ok: false, status: "REJECTED", validation, assets, pack };
  const integrity = await verifySkinIntegrity(pack);
  return {
    ok: integrity.ok || integrity.status === "UNSIGNED",
    status: integrity.ok ? "INTEGRITY_VERIFIED" : "STRUCTURE_VALIDATED_UNSIGNED",
    validation,
    assets,
    integrity,
    pack
  };
}

export async function rasterFileToAsset(file, role = "texture") {
  const allowed = ["image/png", "image/jpeg", "image/webp"];
  if (!allowed.includes(file.type)) throw new Error(`Unsupported image type: ${file.type || "unknown"}`);
  const buffer = await file.arrayBuffer();
  const hash = await sha256Hex(buffer);
  const data = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result), { once: true });
    reader.addEventListener("error", () => reject(reader.error), { once: true });
    reader.readAsDataURL(file);
  });
  return {
    id: `asset.${hash.slice(0, 16)}`,
    asset: {
      mime: file.type,
      role,
      source: { kind: "embedded-data", data },
      sha256: hash,
      originalName: file.name.slice(0, 120),
      provenance: {
        origin: "user-selected-file",
        license: "LicenseRef-User-Declared",
        metadataStripped: false
      }
    }
  };
}
