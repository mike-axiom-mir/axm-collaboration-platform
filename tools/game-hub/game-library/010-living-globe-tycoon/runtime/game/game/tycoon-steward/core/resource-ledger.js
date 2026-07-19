(function (root, factory) {
  'use strict';
  var api = factory(typeof module === 'object' && module.exports ? require('./canonical-state') : root.AXMTycoonCanonical);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AXMTycoonLedger = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Canonical) {
  'use strict';

  var RESOURCE_ORDER = ['population', 'labor', 'energy', 'materials', 'funds', 'attention'];
  var ALLOCATABLE = ['population', 'energy', 'materials', 'funds', 'attention'];
  var UNITS = { population: 'people', labor: 'worker-turns', energy: 'energy-units', materials: 'material-units', funds: 'civic-credits', attention: 'attention-points' };

  function createResource(stock, capacity, inflow, outflow, unit) {
    return { stock: stock, capacity: capacity, inflow: inflow, outflow: outflow, reserved: 0, committed: 0, available: stock, unit: unit };
  }

  function createResources() {
    return {
      population: createResource(28, 48, 1, 0, UNITS.population),
      labor: createResource(18, 28, 2, 0, UNITS.labor),
      energy: createResource(86, 130, 14, 9, UNITS.energy),
      materials: createResource(128, 180, 8, 0, UNITS.materials),
      funds: createResource(210, 320, 18, 7, UNITS.funds),
      attention: createResource(22, 30, 4, 1, UNITS.attention)
    };
  }

  function createLedger() { return { schema: 'axm.tycoon-steward.ledger/v0.1', transactions: [], reservations: {} }; }

  function recalculate(resources) {
    RESOURCE_ORDER.forEach(function (name) {
      var resource = resources[name];
      resource.stock = Canonical.round(resource.stock, 4);
      resource.reserved = Canonical.round(resource.reserved, 4);
      resource.committed = Canonical.round(resource.committed, 4);
      resource.available = Canonical.round(resource.stock - resource.reserved, 4);
    });
    return resources;
  }

  function validateTable(resources) {
    var errors = [];
    RESOURCE_ORDER.forEach(function (name) {
      var item = resources && resources[name];
      if (!item) { errors.push('missing resource ' + name); return; }
      ['stock', 'capacity', 'inflow', 'outflow', 'reserved', 'committed', 'available'].forEach(function (field) {
        if (!Number.isFinite(item[field])) errors.push(name + '.' + field + ' must be finite');
      });
      if (item.stock < 0 || item.reserved < 0 || item.stock > item.capacity || item.reserved > item.stock) errors.push(name + ' violates stock/capacity/reservation bounds');
      if (Canonical.round(item.available, 4) !== Canonical.round(item.stock - item.reserved, 4)) errors.push(name + '.available is inconsistent');
    });
    return { ok: errors.length === 0, errors: errors };
  }

  function hasTransaction(ledger, id) {
    return ledger.transactions.some(function (transaction) { return transaction.transactionId === id; });
  }

  function validateAmounts(amounts, allowlist) {
    var errors = [];
    var names = Object.keys(amounts || {}).sort();
    if (!names.length) errors.push('at least one resource amount is required');
    names.forEach(function (name) {
      if (allowlist.indexOf(name) < 0) errors.push('resource not allowed here: ' + name);
      if (!Number.isFinite(amounts[name]) || amounts[name] <= 0) errors.push(name + ' amount must be finite and greater than zero');
    });
    return errors;
  }

  function transaction(input, resource, amount, kind, source, destination) {
    return {
      transactionId: input.transactionId + ':' + resource,
      kind: kind,
      cause: String(input.cause || 'UNSPECIFIED'),
      source: source,
      destination: destination,
      turn: Number(input.turn),
      amount: Canonical.round(amount, 4),
      resource: resource,
      unit: UNITS[resource],
      decisionReference: input.decisionReference || null,
      receiptReference: input.receiptReference || null
    };
  }

  function reserve(state, input) {
    var amounts = input && input.amounts || {};
    var errors = validateAmounts(amounts, ALLOCATABLE);
    if (!input || !input.reservationId || !input.transactionId) errors.push('reservationId and transactionId are required');
    if (state.ledger.reservations[input && input.reservationId]) errors.push('duplicate reservation ID');
    Object.keys(amounts).sort().forEach(function (name) {
      if (state.resources[name] && state.resources[name].available < amounts[name]) errors.push('insufficient available ' + name);
      if (hasTransaction(state.ledger, String(input.transactionId) + ':' + name)) errors.push('duplicate transaction ID for ' + name);
    });
    if (errors.length) return { ok: false, errors: errors, transactions: [] };
    var draft = Canonical.clone(state);
    var reservation = {
      id: input.reservationId,
      zone: input.zone || null,
      decisionReference: input.decisionReference || null,
      createdTurn: input.turn,
      status: 'ACTIVE',
      original: Canonical.clone(amounts),
      remaining: Canonical.clone(amounts)
    };
    var transactions = [];
    Object.keys(amounts).sort().forEach(function (name) {
      draft.resources[name].reserved += amounts[name];
      var tx = transaction(input, name, amounts[name], 'RESERVE', 'stock:' + name, 'reservation:' + input.reservationId);
      draft.ledger.transactions.push(tx); transactions.push(tx);
    });
    draft.ledger.reservations[input.reservationId] = reservation;
    recalculate(draft.resources);
    return { ok: true, state: draft, errors: [], transactions: transactions, reservation: reservation };
  }

  function commitReservation(state, input) {
    var reservation = state.ledger.reservations[input && input.reservationId];
    var amounts = input && input.amounts || {};
    var errors = validateAmounts(amounts, RESOURCE_ORDER);
    if (!reservation || reservation.status !== 'ACTIVE') errors.push('active reservation not found');
    if (!input || !input.transactionId) errors.push('transactionId is required');
    Object.keys(amounts).sort().forEach(function (name) {
      if (reservation && (!Number.isFinite(reservation.remaining[name]) || reservation.remaining[name] < amounts[name])) errors.push('reservation cannot cover ' + name);
      if (state.resources[name] && state.resources[name].stock < amounts[name]) errors.push('stock cannot cover reserved ' + name);
      if (hasTransaction(state.ledger, String(input.transactionId) + ':' + name)) errors.push('duplicate transaction ID for ' + name);
    });
    if (errors.length) return { ok: false, errors: errors, transactions: [] };
    var draft = Canonical.clone(state);
    var targetReservation = draft.ledger.reservations[input.reservationId];
    var transactions = [];
    Object.keys(amounts).sort().forEach(function (name) {
      targetReservation.remaining[name] = Canonical.round(targetReservation.remaining[name] - amounts[name], 4);
      draft.resources[name].reserved -= amounts[name];
      draft.resources[name].stock -= amounts[name];
      draft.resources[name].committed += amounts[name];
      var tx = transaction(input, name, amounts[name], 'COMMIT_RESERVED', 'reservation:' + input.reservationId, input.destination || 'simulation:sink');
      draft.ledger.transactions.push(tx); transactions.push(tx);
    });
    var left = Object.keys(targetReservation.remaining).some(function (name) { return targetReservation.remaining[name] > 0; });
    if (!left) targetReservation.status = 'COMMITTED';
    recalculate(draft.resources);
    return { ok: true, state: draft, errors: [], transactions: transactions, reservation: targetReservation };
  }

  function spendAvailable(state, input) {
    var amounts = input && input.amounts || {};
    var errors = validateAmounts(amounts, RESOURCE_ORDER);
    if (!input || !input.transactionId) errors.push('transactionId is required');
    Object.keys(amounts).sort().forEach(function (name) {
      if (state.resources[name] && state.resources[name].available < amounts[name]) errors.push('insufficient unreserved ' + name);
      if (hasTransaction(state.ledger, String(input.transactionId) + ':' + name)) errors.push('duplicate transaction ID for ' + name);
    });
    if (errors.length) return { ok: false, errors: errors, transactions: [] };
    var draft = Canonical.clone(state), transactions = [];
    Object.keys(amounts).sort().forEach(function (name) {
      draft.resources[name].stock -= amounts[name];
      draft.resources[name].committed += amounts[name];
      var tx = transaction(input, name, amounts[name], 'SPEND_AVAILABLE', 'available:' + name, input.destination || 'simulation:sink');
      draft.ledger.transactions.push(tx); transactions.push(tx);
    });
    recalculate(draft.resources);
    return { ok: true, state: draft, errors: [], transactions: transactions };
  }

  function applyTurnFlows(state, input) {
    var draft = Canonical.clone(state), transactions = [], shortages = [];
    RESOURCE_ORDER.forEach(function (name) {
      var resource = draft.resources[name];
      var net = resource.inflow - resource.outflow;
      if (net > 0) {
        var gained = Math.min(net, resource.capacity - resource.stock);
        if (gained > 0) {
          resource.stock += gained;
          var creditInput = Object.assign({}, input, { transactionId: input.transactionId + ':flow-in' });
          var credit = transaction(creditInput, name, gained, 'TURN_INFLOW', 'world:inflow', 'stock:' + name);
          draft.ledger.transactions.push(credit); transactions.push(credit);
        }
      } else if (net < 0) {
        var requested = Math.abs(net);
        var spendable = Math.max(0, resource.stock - resource.reserved);
        var spent = Math.min(requested, spendable);
        if (spent > 0) {
          resource.stock -= spent;
          resource.committed += spent;
          var flowInput = Object.assign({}, input, { transactionId: input.transactionId + ':flow-out' });
          var debit = transaction(flowInput, name, spent, 'TURN_OUTFLOW', 'available:' + name, 'operations:' + name);
          draft.ledger.transactions.push(debit); transactions.push(debit);
        }
        if (spent < requested) shortages.push({ resource: name, requested: requested, supplied: spent, shortfall: Canonical.round(requested - spent, 4) });
      }
    });
    recalculate(draft.resources);
    return { ok: true, state: draft, transactions: transactions, shortages: shortages, errors: [] };
  }

  return {
    RESOURCE_ORDER: RESOURCE_ORDER,
    ALLOCATABLE: ALLOCATABLE,
    UNITS: UNITS,
    createResources: createResources,
    createLedger: createLedger,
    recalculate: recalculate,
    validateTable: validateTable,
    reserve: reserve,
    commitReservation: commitReservation,
    spendAvailable: spendAvailable,
    applyTurnFlows: applyTurnFlows,
    hasTransaction: hasTransaction
  };
});
