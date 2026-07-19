export class MapChunkLoader {
  constructor(map) {
    this.map = map;
    this.config = map.chunking || {};
    this.enabled = this.config.enabled === true && Array.isArray(this.config.chunks);
    this.cacheLimit = Math.max(8, Number(this.config.cacheLimit) || 32);
    this.prefetchMargin = Math.max(0, Number(this.config.prefetchMarginChunks) || 1);
    this.entries = new Map((this.config.chunks || []).map((entry) => [`${entry.column}:${entry.row}`, entry]));
    this.cache = new Map();
    this.loading = new Map();
    this.wantedKeys = new Set();
    this.failures = new Map();
  }

  keysForBounds(bounds) {
    if (!this.enabled) return [];
    const size = Number(this.config.chunkSize) || 1024;
    const columns = Number(this.config.columns) || Math.ceil(this.map.world.width / size);
    const rows = Number(this.config.rows) || Math.ceil(this.map.world.height / size);
    const firstColumn = Math.max(0, Math.floor(bounds.left / size) - this.prefetchMargin);
    const lastColumn = Math.min(columns - 1, Math.floor(bounds.right / size) + this.prefetchMargin);
    const firstRow = Math.max(0, Math.floor(bounds.top / size) - this.prefetchMargin);
    const lastRow = Math.min(rows - 1, Math.floor(bounds.bottom / size) + this.prefetchMargin);
    const keys = [];
    for (let row = firstRow; row <= lastRow; row += 1) {
      for (let column = firstColumn; column <= lastColumn; column += 1) keys.push(`${column}:${row}`);
    }
    return keys;
  }

  async load(key) {
    if (this.cache.has(key)) return this.cache.get(key).chunk;
    if (this.loading.has(key)) return this.loading.get(key);
    const entry = this.entries.get(key);
    if (!entry?.path) return null;
    const attempt = (this.failures.get(key) || 0) + 1;
    const promise = fetch(entry.path, { cache: 'force-cache' })
      .then((response) => {
        if (!response.ok) throw new Error(`Map chunk ${key} returned HTTP ${response.status}`);
        return response.json();
      })
      .then((chunk) => {
        this.failures.delete(key);
        this.cache.set(key, { chunk, lastUsed: performance.now() });
        this.evict();
        return chunk;
      })
      .catch((error) => {
        this.failures.set(key, attempt);
        if (attempt <= 2) console.warn('[AXM map chunks]', error.message);
        return null;
      })
      .finally(() => this.loading.delete(key));
    this.loading.set(key, promise);
    return promise;
  }

  update(bounds) {
    const keys = this.keysForBounds(bounds);
    this.wantedKeys = new Set(keys);
    const now = performance.now();
    for (const key of keys) {
      const cached = this.cache.get(key);
      if (cached) cached.lastUsed = now;
      else if ((this.failures.get(key) || 0) < 3) this.load(key);
    }
    this.evict();
  }

  visibleChunks(bounds) {
    const chunks = [];
    for (const key of this.keysForBounds(bounds)) {
      const cached = this.cache.get(key);
      if (cached) chunks.push(cached.chunk);
    }
    return chunks.sort((a, b) => (a.row - b.row) || (a.column - b.column));
  }

  evict() {
    if (this.cache.size <= this.cacheLimit) return;
    const candidates = [...this.cache.entries()]
      .filter(([key]) => !this.wantedKeys.has(key))
      .sort((a, b) => a[1].lastUsed - b[1].lastUsed);
    while (this.cache.size > this.cacheLimit && candidates.length) this.cache.delete(candidates.shift()[0]);
  }

  diagnostics() {
    return {
      enabled: this.enabled,
      loaded: this.cache.size,
      loading: this.loading.size,
      wanted: this.wantedKeys.size,
      failed: this.failures.size,
    };
  }
}
