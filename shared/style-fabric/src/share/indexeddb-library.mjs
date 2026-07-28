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

export class LocalSkinLibrary {
  async save(pack) {
    if (!pack.integrity?.contentSha256) {
      throw new Error("Library saves require a finalized integrity hash.");
    }
    const key = `${pack.id}@${pack.release}#${pack.integrity.contentSha256}`;
    const database = await openDatabase();
    const transaction = database.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).put({
      key,
      pack: structuredClone(pack),
      savedAt: new Date().toISOString()
    });
    await complete(transaction);
    database.close();
    return { ok: true, key };
  }

  async list() {
    const database = await openDatabase();
    const transaction = database.transaction(STORE, "readonly");
    const request = transaction.objectStore(STORE).getAll();
    const entries = await new Promise((resolve, reject) => {
      request.addEventListener("success", () => resolve(request.result), { once: true });
      request.addEventListener("error", () => reject(request.error), { once: true });
    });
    await complete(transaction);
    database.close();
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
