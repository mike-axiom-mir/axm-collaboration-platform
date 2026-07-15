/* ============================================================
   AXM Workshop Navigation

   A deliberately small, session-only trail of visited screens.
   It never reads or writes project state, module saves, checkpoints,
   imports, exports or recovery data. The Hub uses logical destinations
   (Home / module); standalone tools use same-origin AXM routes.
   ============================================================ */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AXMWorkshopNavigation = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const ROUTE_KEY = 'axm.workshop.screen-history.v1';

  function memoryStorage() {
    const values = {};
    return {
      getItem: key => Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null,
      setItem: (key, value) => { values[key] = String(value); },
      removeItem: key => { delete values[key]; }
    };
  }

  function cleanEntry(entry) {
    if (!entry || typeof entry !== 'object') return null;
    if (entry.kind === 'home') {
      return { kind: 'home', layerId: typeof entry.layerId === 'string' ? entry.layerId : '', label: String(entry.label || 'Home').slice(0, 100) };
    }
    if (entry.kind === 'module' && typeof entry.id === 'string' && entry.id) {
      return { kind: 'module', id: entry.id.slice(0, 120), label: String(entry.label || entry.id).slice(0, 100) };
    }
    if (entry.kind === 'route' && isWorkshopRoute(entry.route)) {
      return { kind: 'route', route: entry.route.slice(0, 1000), label: String(entry.label || 'Previous screen').slice(0, 100) };
    }
    return null;
  }

  function entryKey(entry) {
    if (!entry) return '';
    if (entry.kind === 'home') return 'home:' + (entry.layerId || '');
    if (entry.kind === 'module') return 'module:' + entry.id;
    if (entry.kind === 'route') return 'route:' + entry.route;
    return '';
  }

  function createHistory(storage, key, limit) {
    storage = storage || memoryStorage();
    key = key || ROUTE_KEY;
    limit = Math.max(2, Number(limit) || 50);

    function read() {
      try {
        const parsed = JSON.parse(storage.getItem(key) || '[]');
        return Array.isArray(parsed) ? parsed.map(cleanEntry).filter(Boolean).slice(-limit) : [];
      } catch (error) { return []; }
    }
    function write(items) {
      try { storage.setItem(key, JSON.stringify(items.slice(-limit))); } catch (error) {}
      return items;
    }
    function record(entry) {
      const clean = cleanEntry(entry); if (!clean) return read();
      const items = read();
      if (!items.length || entryKey(items[items.length - 1]) !== entryKey(clean)) items.push(clean);
      return write(items);
    }
    function back() {
      const items = read();
      if (items.length < 2) return null;
      items.pop();
      write(items);
      return items[items.length - 1] || null;
    }
    return {
      record,
      back,
      entries: read,
      current: () => { const items = read(); return items[items.length - 1] || null; },
      previous: () => { const items = read(); return items.length > 1 ? items[items.length - 2] : null; },
      canBack: () => read().length > 1,
      clear: () => write([])
    };
  }

  function isWorkshopRoute(route) {
    if (typeof route !== 'string' || route.charAt(0) !== '/' || route.indexOf('//') === 0) return false;
    return /^\/(?:hub|tools|games)(?:\/|$)/.test(route);
  }

  function currentRoute(win) {
    if (!win || !win.location) return null;
    const route = (win.location.pathname || '/') + (win.location.search || '') + (win.location.hash || '');
    return isWorkshopRoute(route) ? route : null;
  }

  function routeHistory(win) {
    let storage;
    try { storage = win.sessionStorage; } catch (error) { storage = memoryStorage(); }
    return createHistory(storage, ROUTE_KEY, 60);
  }

  function recordCurrentRoute(win) {
    const route = currentRoute(win); if (!route) return null;
    const history = routeHistory(win);
    history.record({ kind: 'route', route, label: win.document && win.document.title || 'AXM screen' });
    return history;
  }

  function navigateRouteBack(win) {
    const history = routeHistory(win);
    const destination = history.back();
    if (!destination || destination.kind !== 'route' || !isWorkshopRoute(destination.route)) return false;
    win.location.assign(destination.route);
    return true;
  }

  function installStandalone(options) {
    options = options || {};
    const win = options.window || (typeof window !== 'undefined' ? window : null);
    if (!win || win.top !== win.self) return null;
    const history = recordCurrentRoute(win);
    if (options.button === false || !win.document) return history;

    const mount = function () {
      if (!win.document.body || win.document.getElementById('axmWorkshopBack')) return;
      const style = win.document.createElement('style');
      style.id = 'axmWorkshopBackStyle';
      style.textContent = '.axm-workshop-back{position:fixed;z-index:2147483000;left:9px;top:9px;width:32px;height:32px;padding:0;display:grid;place-items:center;border:1px solid rgba(56,214,236,.38);border-radius:9px;background:linear-gradient(180deg,rgba(17,31,49,.97),rgba(7,14,25,.97));color:#56e1f2;box-shadow:0 8px 24px rgba(0,0,0,.34),inset 0 1px rgba(255,255,255,.05);font:700 22px/1 system-ui,sans-serif;cursor:pointer;backdrop-filter:blur(9px)}.axm-workshop-back:hover{border-color:#56e1f2;background:linear-gradient(180deg,rgba(27,55,75,.98),rgba(8,21,34,.98))}.axm-workshop-back:focus-visible{outline:2px solid #56e1f2;outline-offset:2px}.axm-workshop-back:disabled{opacity:.3;cursor:default;box-shadow:none}';
      const button = win.document.createElement('button');
      button.id = 'axmWorkshopBack';
      button.className = 'axm-workshop-back';
      button.type = 'button';
      button.textContent = '\u2039';
      button.setAttribute('aria-label', 'Go to previous AXM screen');
      button.title = 'Previous AXM screen \u00b7 saved work is unchanged';
      button.disabled = !history.canBack();
      button.addEventListener('click', function () { navigateRouteBack(win); });
      win.document.head.appendChild(style);
      win.document.body.appendChild(button);
    };
    if (win.document.readyState === 'loading') win.document.addEventListener('DOMContentLoaded', mount, { once: true });
    else mount();
    return history;
  }

  return { ROUTE_KEY, memoryStorage, cleanEntry, entryKey, createHistory, isWorkshopRoute, currentRoute, routeHistory, recordCurrentRoute, navigateRouteBack, installStandalone };
});
