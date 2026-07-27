'use strict';

const U = require('./foundation-utils');

const DOCUMENT_SCHEMA = 'axm.universal-edit-document/v1';
const SESSION_SCHEMA = 'axm.universal-edit-session/v1';

function normalizeNode(node) {
  const bounds = node.bounds || {};
  return {
    id: U.text(node.id, 100, 'node id'),
    kind: U.text(node.kind || 'object', 80, 'node kind'),
    parent_id: node.parent_id == null ? null : U.text(node.parent_id, 100, 'parent id'),
    bounds: {
      x: U.finite(bounds.x || 0, 'bounds.x'),
      y: U.finite(bounds.y || 0, 'bounds.y'),
      width: U.finite(bounds.width, 'bounds.width'),
      height: U.finite(bounds.height, 'bounds.height'),
    },
    transform: {
      rotation: U.finite(node.transform && node.transform.rotation || 0, 'rotation'),
      scale_x: U.finite(node.transform && node.transform.scale_x != null ? node.transform.scale_x : 1, 'scale_x'),
      scale_y: U.finite(node.transform && node.transform.scale_y != null ? node.transform.scale_y : 1, 'scale_y'),
    },
    instance_of: node.instance_of == null ? null : U.text(node.instance_of, 100, 'instance source'),
    mask_id: node.mask_id == null ? null : U.text(node.mask_id, 100, 'mask id'),
    locked: node.locked === true,
    properties: U.clone(node.properties || {}),
  };
}

function validateDocument(document) {
  const errors = [];
  if (!document || document.schema !== DOCUMENT_SCHEMA) errors.push('document schema mismatch');
  const nodes = document && Array.isArray(document.nodes) ? document.nodes : [];
  if (nodes.length > 10000) errors.push('node limit exceeded');
  const ids = new Set();
  for (const node of nodes) {
    if (!node.id || ids.has(node.id)) errors.push('duplicate or missing node id ' + (node.id || ''));
    ids.add(node.id);
    if (!(node.bounds && Number.isFinite(node.bounds.x) && Number.isFinite(node.bounds.y) && node.bounds.width > 0 && node.bounds.height > 0)) errors.push('invalid bounds for ' + node.id);
    if (!(node.transform && Number.isFinite(node.transform.rotation) && Number.isFinite(node.transform.scale_x) && Number.isFinite(node.transform.scale_y) && node.transform.scale_x !== 0 && node.transform.scale_y !== 0)) errors.push('invalid transform for ' + node.id);
  }
  for (const node of nodes) {
    if (node.parent_id && !ids.has(node.parent_id)) errors.push('missing parent for ' + node.id);
    if (node.instance_of && !ids.has(node.instance_of)) errors.push('missing instance source for ' + node.id);
    if (node.mask_id && !ids.has(node.mask_id)) errors.push('missing mask for ' + node.id);
  }
  const byId = new Map(nodes.map((node) => [node.id, node]));
  function detectCycle(start, field, label) {
    const visited = new Set();
    let current = start;
    while (current && current[field]) {
      if (visited.has(current.id)) {
        errors.push(label + ' cycle contains ' + start.id);
        return;
      }
      visited.add(current.id);
      current = byId.get(current[field]);
    }
  }
  for (const node of nodes) {
    detectCycle(node, 'parent_id', 'parent');
    detectCycle(node, 'mask_id', 'mask');
  }
  for (const selected of document && document.selection || []) if (!ids.has(selected)) errors.push('selection references missing node ' + selected);
  return { pass: errors.length === 0, errors };
}

function documentDigest(document) {
  return U.sha256(document);
}

function createDocument(spec) {
  spec = U.clone(spec || {});
  const document = {
    schema: DOCUMENT_SCHEMA,
    version: '1.0.0',
    id: U.text(spec.id, 100, 'document id'),
    target_canvas: U.clone(spec.target_canvas || {}),
    nodes: U.boundedArray(spec.nodes || [], 1, 10000, 'nodes').map(normalizeNode),
    selection: [],
    revision: 0,
  };
  const checked = validateDocument(document);
  U.ensure(checked.pass, checked.errors.join('; '));
  return document;
}

function createSession(document, maxHistory) {
  const checked = validateDocument(document);
  U.ensure(checked.pass, checked.errors.join('; '));
  return { schema: SESSION_SCHEMA, version: '1.0.0', document: U.clone(document), undo_stack: [], redo_stack: [], receipts: [], max_history: Math.max(1, Math.min(500, Number(maxHistory) || 100)) };
}

function findNode(document, id) {
  const node = document.nodes.find((item) => item.id === id);
  U.ensure(node, 'node not found: ' + id);
  return node;
}

function unionBounds(nodes) {
  const minX = Math.min(...nodes.map((node) => node.bounds.x));
  const minY = Math.min(...nodes.map((node) => node.bounds.y));
  const maxX = Math.max(...nodes.map((node) => node.bounds.x + node.bounds.width));
  const maxY = Math.max(...nodes.map((node) => node.bounds.y + node.bounds.height));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function mutate(document, operation) {
  const next = U.clone(document);
  const type = U.text(operation && operation.type, 60, 'operation type');
  if (type === 'select') {
    const ids = U.boundedArray(operation.ids || [], 0, next.nodes.length, 'selection');
    ids.forEach((id) => findNode(next, id));
    next.selection = Array.from(new Set(ids));
  } else if (type === 'transform') {
    const ids = operation.ids || next.selection;
    U.boundedArray(ids, 1, next.nodes.length, 'transform ids');
    const dx = U.finite(operation.dx || 0, 'dx');
    const dy = U.finite(operation.dy || 0, 'dy');
    const rotate = U.finite(operation.rotate || 0, 'rotate');
    const scaleX = U.finite(operation.scale_x == null ? 1 : operation.scale_x, 'scale_x');
    const scaleY = U.finite(operation.scale_y == null ? 1 : operation.scale_y, 'scale_y');
    U.ensure(scaleX !== 0 && scaleY !== 0, 'scale cannot be zero');
    ids.forEach((id) => {
      const node = findNode(next, id);
      U.ensure(!node.locked, 'node is locked: ' + id);
      node.bounds.x += dx;
      node.bounds.y += dy;
      node.bounds.width *= Math.abs(scaleX);
      node.bounds.height *= Math.abs(scaleY);
      node.transform.scale_x *= scaleX;
      node.transform.scale_y *= scaleY;
      node.transform.rotation += rotate;
    });
  } else if (type === 'align') {
    const ids = operation.ids || next.selection;
    const nodes = U.boundedArray(ids, 2, next.nodes.length, 'align ids').map((id) => findNode(next, id));
    U.ensure(['x', 'y'].includes(operation.axis), 'align axis invalid');
    U.ensure(['min', 'center', 'max'].includes(operation.mode), 'align mode invalid');
    const axis = operation.axis;
    const values = nodes.map((node) => axis === 'x' ? [node.bounds.x, node.bounds.x + node.bounds.width / 2, node.bounds.x + node.bounds.width] : [node.bounds.y, node.bounds.y + node.bounds.height / 2, node.bounds.y + node.bounds.height]);
    const index = { min: 0, center: 1, max: 2 }[operation.mode];
    const target = operation.mode === 'min' ? Math.min(...values.map((item) => item[index])) : operation.mode === 'max' ? Math.max(...values.map((item) => item[index])) : values.reduce((sum, item) => sum + item[index], 0) / values.length;
    nodes.forEach((node) => {
      U.ensure(!node.locked, 'node is locked: ' + node.id);
      if (axis === 'x') node.bounds.x += target - [node.bounds.x, node.bounds.x + node.bounds.width / 2, node.bounds.x + node.bounds.width][index];
      else node.bounds.y += target - [node.bounds.y, node.bounds.y + node.bounds.height / 2, node.bounds.y + node.bounds.height][index];
    });
  } else if (type === 'distribute') {
    const ids = operation.ids || next.selection;
    const nodes = U.boundedArray(ids, 3, next.nodes.length, 'distribute ids').map((id) => findNode(next, id));
    U.ensure(['x', 'y'].includes(operation.axis), 'distribute axis invalid');
    const axis = operation.axis;
    nodes.sort((a, b) => (axis === 'x' ? a.bounds.x + a.bounds.width / 2 - b.bounds.x - b.bounds.width / 2 : a.bounds.y + a.bounds.height / 2 - b.bounds.y - b.bounds.height / 2));
    const center = (node) => axis === 'x' ? node.bounds.x + node.bounds.width / 2 : node.bounds.y + node.bounds.height / 2;
    const start = center(nodes[0]);
    const step = (center(nodes[nodes.length - 1]) - start) / (nodes.length - 1);
    nodes.slice(1, -1).forEach((node, index) => {
      const target = start + step * (index + 1);
      if (axis === 'x') node.bounds.x += target - center(node);
      else node.bounds.y += target - center(node);
    });
  } else if (type === 'group') {
    const ids = operation.ids || next.selection;
    const nodes = U.boundedArray(ids, 1, next.nodes.length, 'group ids').map((id) => findNode(next, id));
    const groupId = U.text(operation.id, 100, 'group id');
    U.ensure(!next.nodes.some((node) => node.id === groupId), 'group id already exists');
    const parentIds = new Set(nodes.map((node) => node.parent_id));
    U.ensure(parentIds.size === 1, 'grouped nodes must share a parent');
    const group = normalizeNode({ id: groupId, kind: 'group', parent_id: nodes[0].parent_id, bounds: unionBounds(nodes), properties: { member_ids: ids.slice() } });
    nodes.forEach((node) => { U.ensure(!node.locked, 'node is locked: ' + node.id); node.parent_id = groupId; });
    next.nodes.push(group);
    next.selection = [groupId];
  } else if (type === 'create_instance') {
    const source = findNode(next, operation.source_id);
    const id = U.text(operation.id, 100, 'instance id');
    U.ensure(!next.nodes.some((node) => node.id === id), 'instance id already exists');
    const instance = normalizeNode({ id, kind: source.kind, parent_id: operation.parent_id == null ? source.parent_id : operation.parent_id, bounds: Object.assign({}, source.bounds, { x: source.bounds.x + U.finite(operation.dx || 0, 'dx'), y: source.bounds.y + U.finite(operation.dy || 0, 'dy') }), transform: source.transform, instance_of: source.id, properties: source.properties });
    if (instance.parent_id) findNode(next, instance.parent_id);
    next.nodes.push(instance);
    next.selection = [id];
  } else if (type === 'set_mask') {
    const target = findNode(next, operation.target_id);
    const mask = findNode(next, operation.mask_id);
    U.ensure(target.id !== mask.id, 'node cannot mask itself');
    U.ensure(!target.locked, 'node is locked: ' + target.id);
    target.mask_id = mask.id;
  } else if (type === 'reparent') {
    const node = findNode(next, operation.id);
    const parentId = operation.parent_id == null ? null : U.text(operation.parent_id, 100, 'parent id');
    if (parentId) findNode(next, parentId);
    U.ensure(parentId !== node.id, 'node cannot parent itself');
    U.ensure(!node.locked, 'node is locked: ' + node.id);
    node.parent_id = parentId;
  } else {
    throw new Error('unsupported edit operation: ' + type);
  }
  next.revision += 1;
  const checked = validateDocument(next);
  U.ensure(checked.pass, checked.errors.join('; '));
  return next;
}

function apply(session, operation) {
  U.ensure(session && session.schema === SESSION_SCHEMA, 'edit session required');
  const before = U.clone(session.document);
  const after = mutate(before, operation || {});
  const next = U.clone(session);
  next.undo_stack.push(before);
  if (next.undo_stack.length > next.max_history) next.undo_stack.shift();
  next.redo_stack = [];
  next.document = after;
  next.receipts.push({ schema: 'axm.universal-edit-receipt/v1', operation: U.clone(operation), before_digest: documentDigest(before), after_digest: documentDigest(after), status: 'APPLIED' });
  return next;
}

function undo(session) {
  U.ensure(session && session.schema === SESSION_SCHEMA, 'edit session required');
  U.ensure(session.undo_stack.length, 'nothing to undo');
  const next = U.clone(session);
  const current = next.document;
  next.document = next.undo_stack.pop();
  next.redo_stack.push(current);
  next.receipts.push({ schema: 'axm.universal-edit-receipt/v1', operation: { type: 'undo' }, before_digest: documentDigest(current), after_digest: documentDigest(next.document), status: 'APPLIED' });
  return next;
}

function redo(session) {
  U.ensure(session && session.schema === SESSION_SCHEMA, 'edit session required');
  U.ensure(session.redo_stack.length, 'nothing to redo');
  const next = U.clone(session);
  const current = next.document;
  next.undo_stack.push(current);
  next.document = next.redo_stack.pop();
  next.receipts.push({ schema: 'axm.universal-edit-receipt/v1', operation: { type: 'redo' }, before_digest: documentDigest(current), after_digest: documentDigest(next.document), status: 'APPLIED' });
  return next;
}

module.exports = { DOCUMENT_SCHEMA, SESSION_SCHEMA, createDocument, validateDocument, documentDigest, createSession, apply, undo, redo };
