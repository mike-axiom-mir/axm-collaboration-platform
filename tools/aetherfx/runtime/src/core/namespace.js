(function (root) {
  'use strict';

  const AXM = root.AXM = root.AXM || {};
  AXM.version = '1.3.0';
  AXM.status = 'WORKING';

  const toString = Object.prototype.toString;

  AXM.Utils = {
    uid(prefix = 'id') {
      if (root.crypto && typeof root.crypto.randomUUID === 'function') {
        return `${prefix}-${root.crypto.randomUUID()}`;
      }
      return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    },

    clone(value) {
      if (typeof structuredClone === 'function') return structuredClone(value);
      return JSON.parse(JSON.stringify(value));
    },

    clamp(value, min, max) {
      const number = Number(value);
      if (!Number.isFinite(number)) return min;
      return Math.min(max, Math.max(min, number));
    },

    escapeHtml(value) {
      return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
    },

    slugify(value) {
      return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'untitled';
    },

    canonicalJson(value) {
      const seen = new WeakSet();
      const normalize = (input) => {
        if (input === null || typeof input !== 'object') return input;
        if (seen.has(input)) throw new TypeError('Cannot canonicalize circular data.');
        seen.add(input);
        if (Array.isArray(input)) return input.map(normalize);
        return Object.keys(input).sort().reduce((out, key) => {
          out[key] = normalize(input[key]);
          return out;
        }, {});
      };
      return JSON.stringify(normalize(value));
    },

    downloadText(filename, text, mime = 'text/plain;charset=utf-8') {
      const blob = new Blob([text], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },

    downloadJson(filename, value) {
      this.downloadText(filename, `${JSON.stringify(value, null, 2)}\n`, 'application/json;charset=utf-8');
    },

    readJsonFile(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error || new Error('Unable to read file.'));
        reader.onload = () => {
          try {
            resolve(JSON.parse(String(reader.result || '')));
          } catch (error) {
            reject(new Error(`Invalid JSON: ${error.message}`));
          }
        };
        reader.readAsText(file);
      });
    },

    setByPath(target, path, value) {
      const parts = String(path).split('.').filter(Boolean);
      let current = target;
      while (parts.length > 1) {
        const key = parts.shift();
        if (toString.call(current[key]) !== '[object Object]') current[key] = {};
        current = current[key];
      }
      current[parts[0]] = value;
      return target;
    },

    getByPath(target, path, fallback) {
      const result = String(path).split('.').filter(Boolean).reduce((value, key) => {
        if (value === null || value === undefined) return undefined;
        return value[key];
      }, target);
      return result === undefined ? fallback : result;
    },

    debounce(fn, wait = 100) {
      let timer = null;
      return function debounced(...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), wait);
      };
    },

    formatBytes(bytes) {
      if (!Number.isFinite(bytes) || bytes < 1) return '0 B';
      const units = ['B', 'KB', 'MB', 'GB'];
      const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
      return `${(bytes / (1024 ** exponent)).toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
    }
  };

  AXM.EventBus = class EventBus {
    constructor() {
      this.listeners = new Map();
    }

    on(eventName, listener) {
      if (!this.listeners.has(eventName)) this.listeners.set(eventName, new Set());
      this.listeners.get(eventName).add(listener);
      return () => this.off(eventName, listener);
    }

    off(eventName, listener) {
      this.listeners.get(eventName)?.delete(listener);
    }

    emit(eventName, detail) {
      this.listeners.get(eventName)?.forEach((listener) => {
        try {
          listener(detail);
        } catch (error) {
          console.error(`[AXM EventBus] ${eventName}`, error);
        }
      });
    }
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
