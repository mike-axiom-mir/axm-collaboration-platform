import {
  admitSkinPack,
  calculateSkinIntegrity
} from "../core/validator.mjs";
import { LOCAL_CREATOR_POLICY } from "../core/policy.mjs";
import { sha256Hex, slugify, stableStringify } from "../core/stable.mjs";

function admissionError(message, admission) {
  const issue = admission?.errors?.[0];
  const failure = new Error(issue ? `${message}: ${issue.message}` : message);
  failure.code = issue?.code ?? "PACK_ADMISSION_FAILED";
  failure.admission = admission;
  return failure;
}

export async function finalizePackForExport(pack, policy = LOCAL_CREATOR_POLICY) {
  const currentAdmission = await admitSkinPack(pack, policy);
  if (!currentAdmission.ok) {
    throw admissionError("Pack cannot be finalized", currentAdmission);
  }
  const copy = structuredClone(pack);
  copy.integrity = await calculateSkinIntegrity(copy);
  const signedAdmission = await admitSkinPack(copy, {
    ...policy,
    requireIntegrity: true,
    allowUnsigned: false
  });
  if (!signedAdmission.ok) {
    throw admissionError("Finalized pack failed signed admission", signedAdmission);
  }
  return copy;
}

export async function serializeSkinPack(pack, policy = LOCAL_CREATOR_POLICY) {
  const finalized = await finalizePackForExport(pack, policy);
  return {
    pack: finalized,
    text: `${stableStringify(finalized, 2)}\n`,
    filename: `${slugify(finalized.metadata?.name ?? finalized.id)}.axmskin.json`
  };
}

export async function downloadSkinPack(pack, policy = LOCAL_CREATOR_POLICY) {
  const exported = await serializeSkinPack(pack, policy);
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

export async function readSkinPackFile(file, policy = LOCAL_CREATOR_POLICY) {
  if (Number.isFinite(file?.size) && file.size > policy.maxPackBytes) {
    return {
      ok: false,
      status: "REJECTED",
      errors: [{
        code: "PACK_TOO_LARGE",
        path: "$",
        message: `Selected file exceeds ${policy.maxPackBytes} bytes.`
      }]
    };
  }
  const text = await file.text();
  if (new TextEncoder().encode(text).byteLength > policy.maxPackBytes) {
    return {
      ok: false,
      status: "REJECTED",
      errors: [{
        code: "PACK_TOO_LARGE",
        path: "$",
        message: `Selected file exceeds ${policy.maxPackBytes} bytes.`
      }]
    };
  }
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
  const admission = await admitSkinPack(pack, policy);
  const { structure: validation, assets, integrity } = admission;
  return {
    ok: admission.ok,
    status: admission.ok
      ? integrity.ok
        ? "INTEGRITY_VERIFIED"
        : "STRUCTURE_VALIDATED_UNSIGNED"
      : "REJECTED",
    admission,
    validation,
    assets,
    integrity,
    pack,
    errors: admission.errors
  };
}

export async function rasterFileToAsset(
  file,
  role = "texture",
  policy = LOCAL_CREATOR_POLICY
) {
  const allowed = ["image/png", "image/jpeg", "image/webp"];
  if (!allowed.includes(file.type)) throw new Error(`Unsupported image type: ${file.type || "unknown"}`);
  if (Number.isFinite(file.size) && file.size > policy.maxEmbeddedAssetBytes) {
    throw new Error(`Raster asset exceeds ${policy.maxEmbeddedAssetBytes} bytes.`);
  }
  const buffer = await file.arrayBuffer();
  if (buffer.byteLength > policy.maxEmbeddedAssetBytes) {
    throw new Error(`Raster asset exceeds ${policy.maxEmbeddedAssetBytes} bytes.`);
  }
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
      originalName: String(file.name ?? "selected-raster").slice(0, 120),
      provenance: {
        origin: "user-selected-file",
        license: "LicenseRef-User-Declared",
        metadataStripped: false
      }
    }
  };
}
