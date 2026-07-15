const EQUIPMENT_SLOTS = [
  ['melee', 'MELEE'],
  ['ranged', 'RANGED'],
  ['ammo', 'AMMO'],
  ['shoes', 'SHOES'],
  ['body', 'BODY'],
  ['hat', 'HAT'],
];

export class InventoryOverlay {
  constructor(rootId, partyId) {
    this.root = document.getElementById(rootId);
    this.partyId = partyId;
    this.signature = '';
  }

  update(world = {}) {
    if (!this.root) return;
    const actors = (world.actors || [])
      .filter((actor) => this.partyId === 'all' || actor.partyId === this.partyId)
      .filter((actor) => actor.inventoryOpen === true || actor.inventory?.open === true)
      .filter((actor) => relativeSlot(actor) !== null)
      .sort((a, b) => Number(a.slot) - Number(b.slot));

    const signature = JSON.stringify(actors.map((actor) => ({
      id: actor.id,
      slot: actor.slot,
      name: actor.displayName,
      party: actor.partyId,
      health: actor.health,
      maxHealth: actor.maxHealth,
      shield: actor.shield,
      inventory: actor.inventory,
    })));
    if (signature === this.signature) return;
    this.signature = signature;

    const byQuarter = new Map();
    actors.forEach((actor) => {
      const quarter = relativeSlot(actor);
      if (!byQuarter.has(quarter)) byQuarter.set(quarter, []);
      byQuarter.get(quarter).push(actor);
    });

    const fragment = document.createDocumentFragment();
    for (let quarter = 1; quarter <= 4; quarter += 1) {
      const occupants = byQuarter.get(quarter) || [];
      if (!occupants.length) continue;
      const region = element('section', `inventory-quarter inventory-q${quarter}${occupants.length > 1 ? ' multi' : ''}`);
      region.setAttribute('aria-label', `Inventory display quadrant ${quarter}`);
      occupants.forEach((actor) => region.append(createPanel(actor)));
      fragment.append(region);
    }
    this.root.replaceChildren(fragment);
  }
}

function createPanel(actor) {
  const inventory = actor.inventory || {};
  const selectedIndex = selectedIndexForInventory(inventory);
  const movingIndex = inventory.selection?.location ? indexForLocation(inventory.selection.location) : null;
  const equipmentState = inventory.equipped || inventory.equipment || {};
  const panel = element('article', `inventory-panel-card ${actor.partyId === 'party_b' ? 'party-b' : 'party-a'}`);

  const header = element('header', 'inventory-header');
  const identity = element('div');
  identity.append(textElement('span', 'inventory-kicker', `${partyLabel(actor.partyId)} · PLAYER ${actor.slot ?? '?'}`));
  identity.append(textElement('strong', 'inventory-player', actor.displayName || actor.seatId || actor.id || 'PLAYER'));
  const vitals = element('div', 'inventory-vitals');
  vitals.append(textElement('span', 'inventory-hp', `HP ${Math.max(0, Math.round(actor.health ?? 0))}/${Math.max(1, Math.round(actor.maxHealth ?? 100))}`));
  vitals.append(textElement('span', 'inventory-shield', `SHIELD ${Math.max(0, Math.round(actor.shield ?? 0))}`));
  header.append(identity, vitals);
  panel.append(header);

  const equipment = element('section', 'inventory-section');
  equipment.append(textElement('h2', 'inventory-section-title', 'EQUIPPED'));
  const equipmentGrid = element('div', 'inventory-equipment-grid');
  EQUIPMENT_SLOTS.forEach(([key, label], index) => equipmentGrid.append(createSlot(label, equipmentState[key], index, selectedIndex, movingIndex, true)));
  equipment.append(equipmentGrid);
  panel.append(equipment);

  const bag = element('section', 'inventory-section inventory-bag-section');
  bag.append(textElement('h2', 'inventory-section-title', 'PACK · 12 SLOTS'));
  const bagGrid = element('div', 'inventory-bag-grid');
  for (let index = 0; index < 12; index += 1) bagGrid.append(createSlot(String(index + 1).padStart(2, '0'), inventory.bag?.[index] ?? null, index + 6, selectedIndex, movingIndex, false));
  bag.append(bagGrid);
  panel.append(bag);

  panel.append(textElement('footer', 'inventory-footer', 'USE PHONE CONTROLLER · PREV · NEXT · USE / EQUIP'));
  return panel;
}

function createSlot(label, item, index, selectedIndex, movingIndex, equipped) {
  const slot = element('div', `inventory-slot${index === selectedIndex ? ' selected' : ''}${index === movingIndex ? ' moving' : ''}${item ? ' occupied' : ' empty'}`);
  slot.setAttribute('data-slot-index', String(index));
  slot.append(textElement('small', 'inventory-slot-label', label));
  slot.append(textElement('strong', 'inventory-item-name', itemName(item)));
  const quantity = itemQuantity(item);
  slot.append(textElement('span', 'inventory-item-meta', quantity === null ? (item && equipped ? 'EQUIPPED' : '—') : `×${quantity}`));
  return slot;
}

function itemName(item) {
  if (!item) return 'EMPTY';
  if (typeof item === 'string') return item;
  return String(item.displayName || item.name || item.itemId || item.id || 'ITEM');
}

function itemQuantity(item) {
  if (!item || typeof item !== 'object') return null;
  const value = item.quantity ?? item.count ?? item.rounds ?? null;
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : null;
}

function relativeSlot(actor) {
  const parsed = Number(actor.slot ?? String(actor.seatId || '').match(/\d+/)?.[0]);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 8) return null;
  return ((parsed - 1) % 4) + 1;
}

function selectedIndexForInventory(inventory = {}) {
  if (Number.isInteger(inventory.selectedIndex)) return Math.max(0, Math.min(17, inventory.selectedIndex));
  const cursorIndex = indexForLocation(inventory.cursor || {});
  if (cursorIndex !== null) return cursorIndex;
  return 0;
}

function indexForLocation(location = {}) {
  if (location.container === 'bag' && Number.isInteger(location.index)) return Math.max(6, Math.min(17, location.index + 6));
  if (location.container === 'equipment') {
    const index = EQUIPMENT_SLOTS.findIndex(([key]) => key === location.slot);
    if (index >= 0) return index;
  }
  return null;
}

function partyLabel(partyId) {
  if (partyId === 'party_b') return 'PARTY B';
  return 'PARTY A';
}

function element(tagName, className = '') {
  const node = document.createElement(tagName);
  if (className) node.className = className;
  return node;
}

function textElement(tagName, className, value) {
  const node = element(tagName, className);
  node.textContent = String(value);
  return node;
}
