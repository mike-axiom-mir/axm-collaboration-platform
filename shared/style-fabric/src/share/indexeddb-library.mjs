import { LOCAL_CREATOR_POLICY } from "../core/policy.mjs";
import { stableStringify } from "../core/stable.mjs";
import { admitSkinPack } from "../core/validator.mjs";

const DATABASE = "axm-style-fabric";
const STORE = "skins";
const VERSION = 1;

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, VERSION);
    request.addEventListener("upgradeneeded", () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE, { keyPath: "key" });
      }
    });
    request.addEventListener("success", () => resolve(request.result), { once: true });
    request.addEventListener("error", () => reject(request.error), { once: true });
  });
}

function complete(transaction) {
  return new Promise((resolve, reject) => {
    transaction.addEventListener("complete", () => resolve(), { once: true });
    transaction.addEventListener("abort", () => reject(transaction.error), { once: true });
    transaction.addEventListener("error", () => reject(transaction.error), { once: true });
  });
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.addEventListener("success", () => resolve(request.result), { once: true });
    request.addEventListener("error", () => reject(request.error), { once: true });
  });
}

function signedLibraryPolicy() {
  return {
    ...LOCAL_CREATOR_POLICY,
    id: "axm.style-policy.local-library.v1",
    requireIntegrity: true,
    allowUnsigned: false
  };
}

async function requireAdmission(pack, context) {
  const admission = await admitSkinPack(pack, signedLibraryPolicy());
  if (!admission.ok) {
    const issue = admission.errors[0];
    const error = new Error(
      `${context} rejected: ${issue?.message ?? "pack admission failed"}`
    );
    error.code = issue?.code ?? "PACK_ADMISSION_FAILED";
    error.admission = admission;
    throw error;
  }
  return admission;
}

export class LocalSkinLibrary {
  async save(pack) {
    await requireAdmission(pack, "Library save");
    const key = `${pack.id}@${pack.release}#${pack.integrity.contentSha256}`;
    let database = await openDatabase();
    let transaction = database.transaction(STORE, "readonly");
    const existing = await requestResult(transaction.objectStore(STORE).get(key));
    await complete(transaction);
    database.close();

    if (existing) {
      await requireAdmission(existing.pack, `Existing library entry ${key}`);
      if (stableStringify(existing.pack) !== stableStringify(pack)) {
        const error = new Error(`Immutable library key collision: ${key}`);
        error.code = "IMMUTABLE_LIBRARY_COLLISION";
        throw error;
      }
      return { ok: true, key, status: "ALREADY_PRESENT", savedAt: existing.savedAt };
    }

    database = await openDatabase();
    transaction = database.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).add({
      key,
      pack: structuredClone(pack),
      savedAt: new Date().toISOString()
    });
    await complete(transaction);
    database.close();
    return { ok: true, key, status: "SAVED" };
  }

  async list() {
    const database = await openDatabase();
    const transaction = database.transaction(STORE, "readonly");
    const entries = await requestResult(transaction.objectStore(STORE).getAll());
    await complete(transaction);
    database.close();
    for (const entry of entries) {
      await requireAdmission(entry.pack, `Library entry ${entry.key}`);
    }
    return entries.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  }

  async remove(key) {
    const database = await openDatabase();
    const transaction = database.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).delete(key);
    await complete(transaction);
    database.close();
    return { ok: true, key };
  }
}
