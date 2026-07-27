(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AXMVisualActions = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var LEVELS = ['core', 'advanced', 'specialist'];
  var ID = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function array(value) { return Array.isArray(value) ? value : []; }
  function clean(value) { return String(value == null ? '' : value).trim(); }
  function normalized(value) { return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
  function unique(values) { return Array.from(new Set(values)); }
  function intersects(left, right) { return left.some(function (item) { return right.includes(item); }); }

  function validateAction(action) {
    var errors = [];
    if (!action || typeof action !== 'object' || Array.isArray(action)) return { ok:false, errors:['action must be an object'] };
    if (action.schema !== 'axm.visual-action/v1') errors.push('schema must be axm.visual-action/v1');
    if (!ID.test(clean(action.id))) errors.push('id must be a lowercase namespaced token');
    if (!clean(action.title)) errors.push('title is required');
    if (!ID.test(clean(action.family))) errors.push('family must be a lowercase namespaced token');
    if (!LEVELS.includes(action.level)) errors.push('level must be core, advanced, or specialist');
    if (!clean(action.summary)) errors.push('summary is required');
    if (!ID.test(clean(action.handler))) errors.push('handler must be a lowercase namespaced token');
    ['aliases', 'contexts', 'requires'].forEach(function (field) {
      if (action[field] != null && (!Array.isArray(action[field]) || action[field].some(function (item) { return !clean(item); }))) errors.push(field + ' must be an array of non-empty strings');
    });
    array(action.bindings).forEach(function (binding, index) {
      if (!binding || !clean(binding.keys)) errors.push('bindings[' + index + '].keys is required');
      if (binding && binding.platform && !['all', 'windows', 'macos'].includes(binding.platform)) errors.push('bindings[' + index + '].platform is invalid');
      if (binding && binding.context && !clean(binding.context)) errors.push('bindings[' + index + '].context is invalid');
    });
    return { ok:errors.length === 0, errors:errors };
  }

  function platformName(value) {
    var raw = clean(value).toLowerCase();
    if (raw === 'mac' || raw === 'macos' || raw.includes('mac')) return 'macos';
    return 'windows';
  }

  function bindingLabel(binding, platform) {
    if (!binding) return '';
    var isMac = platformName(platform) === 'macos';
    return clean(binding.keys)
      .replace(/Mod/gi, isMac ? '⌘' : 'Ctrl')
      .replace(/Shift/gi, isMac ? '⇧' : 'Shift')
      .replace(/Alt/gi, isMac ? '⌥' : 'Alt');
  }

  function bindingFor(action, platform, contexts) {
    var target = platformName(platform);
    var active = array(contexts);
    return array(action.bindings).find(function (binding) {
      var onPlatform = !binding.platform || binding.platform === 'all' || binding.platform === target;
      var inContext = !binding.context || !active.length || active.includes(binding.context);
      return onPlatform && inContext;
    }) || null;
  }

  function actionStatus(action, options) {
    options = options || {};
    var capabilities = array(options.capabilities);
    var handlers = options.handlers || {};
    var missing = array(action.requires).filter(function (item) { return !capabilities.includes(item); });
    if (missing.length) return { status:'UNSUPPORTED_CAPABILITY', missing:missing };
    if (options.requireHandler !== false && typeof handlers[action.handler] !== 'function') return { status:'UNBOUND_HANDLER', missing:[action.handler] };
    return { status:'READY', missing:[] };
  }

  function scoreAction(action, query) {
    var q = normalized(query);
    if (!q) return action.level === 'core' ? 20 : action.level === 'advanced' ? 10 : 5;
    var tokens = q.split(/\s+/);
    var title = normalized(action.title);
    var aliases = array(action.aliases).map(normalized);
    var family = normalized(action.family);
    var summary = normalized(action.summary);
    var haystack = [title, family, summary].concat(aliases).join(' ');
    if (!tokens.every(function (token) { return haystack.includes(token); })) return -1;
    var score = action.level === 'core' ? 8 : 0;
    if (title === q) score += 100;
    else if (title.startsWith(q)) score += 60;
    else if (title.includes(q)) score += 35;
    if (aliases.some(function (alias) { return alias === q; })) score += 70;
    else if (aliases.some(function (alias) { return alias.includes(q); })) score += 25;
    if (family.includes(q)) score += 12;
    return score;
  }

  function createRegistry(input) {
    var actions = array(input).map(clone);
    var ids = new Set();
    actions.forEach(function (action) {
      var checked = validateAction(action);
      if (!checked.ok) throw new Error((action && action.id ? action.id : 'action') + ': ' + checked.errors.join('; '));
      if (ids.has(action.id)) throw new Error('duplicate action id: ' + action.id);
      ids.add(action.id);
      action.aliases = unique(array(action.aliases).map(clean));
      action.contexts = unique(array(action.contexts).map(clean));
      action.requires = unique(array(action.requires).map(clean));
      action.bindings = array(action.bindings);
      action.destructive = action.destructive === true;
      action.reversible = action.reversible !== false;
    });

    function get(id) { var found = actions.find(function (action) { return action.id === id; }); return found ? clone(found) : null; }

    function search(query, options) {
      options = options || {};
      var contexts = array(options.contexts);
      var includeAdvanced = options.includeAdvanced === true;
      var platform = options.platform || 'windows';
      return actions.map(function (action) {
        var score = scoreAction(action, query);
        var contextMatch = !action.contexts.length || !contexts.length || intersects(action.contexts, contexts);
        var levelMatch = includeAdvanced || action.level === 'core';
        if (score < 0 || !contextMatch || !levelMatch) return null;
        var availability = actionStatus(action, options);
        if (options.supportedOnly && availability.status !== 'READY') return null;
        var binding = bindingFor(action, platform, contexts);
        return Object.assign({}, clone(action), {
          score:score,
          availability:availability.status,
          missing:availability.missing,
          trigger:bindingLabel(binding, platform)
        });
      }).filter(Boolean).sort(function (left, right) {
        return right.score - left.score || LEVELS.indexOf(left.level) - LEVELS.indexOf(right.level) || left.title.localeCompare(right.title);
      });
    }

    function dispatch(id, handlers, environment) {
      var action = actions.find(function (item) { return item.id === id; });
      if (!action) return { ok:false, status:'UNKNOWN_ACTION', actionId:id };
      var checked = actionStatus(action, { capabilities:array(environment && environment.capabilities), handlers:handlers });
      if (checked.status !== 'READY') return { ok:false, status:checked.status, actionId:id, missing:checked.missing };
      try {
        var value = handlers[action.handler](clone(action), clone(action.payload || {}), environment || {});
        return { ok:true, status:'DISPATCHED', actionId:id, value:value };
      } catch (error) {
        return { ok:false, status:'HANDLER_ERROR', actionId:id, error:String(error && error.message || error) };
      }
    }

    function detectConflicts() {
      var slots = [];
      var conflicts = [];
      actions.forEach(function (action) {
        action.bindings.forEach(function (binding) {
          slots.push({actionId:action.id,keys:normalized(binding.keys).replace(/ /g, '+'),binding:binding.keys,platform:binding.platform||'all',context:binding.context||'global'});
        });
      });
      for (var i=0;i<slots.length;i++) for (var j=i+1;j<slots.length;j++) {
        var left=slots[i],right=slots[j];
        var sameKeys=left.keys===right.keys;
        var platformOverlap=left.platform==='all'||right.platform==='all'||left.platform===right.platform;
        var contextOverlap=left.context==='global'||right.context==='global'||left.context===right.context;
        if(left.actionId!==right.actionId&&sameKeys&&platformOverlap&&contextOverlap)conflicts.push({binding:left.binding,platform:left.platform+' / '+right.platform,context:left.context+' / '+right.context,actions:[left.actionId,right.actionId]});
      }
      return conflicts;
    }

    return { list:function(){return clone(actions);}, get:get, search:search, dispatch:dispatch, detectConflicts:detectConflicts };
  }

  return {
    SCHEMA:'axm.visual-action/v1',
    RESULT_SCHEMA:'axm.visual-action-result/v1',
    validateAction:validateAction,
    createRegistry:createRegistry,
    bindingLabel:bindingLabel,
    platformName:platformName
  };
}));
