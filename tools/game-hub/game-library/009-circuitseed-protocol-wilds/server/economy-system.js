'use strict';

class EconomySystem {
  constructor(data, profileStore, worldStore) {
    this.data = data; this.profileStore = profileStore; this.worldStore = worldStore;
    this.recipes = new Map(data.recipes.map(recipe => [recipe.id, recipe]));
    this.orders = new Map(data.orders.map(order => [order.id, order]));
    this.paths = new Set(data.businessPaths.map(path => path.id));
  }
  craft(profileId, recipeId) {
    const recipe = this.recipes.get(recipeId); if (!recipe) throw new Error('unknown-recipe');
    const current = this.profileStore.get(profileId); if (!current.recipes.includes(recipeId) && recipeId !== 'service-kit') throw new Error('recipe-not-discovered');
    for (const [material, count] of Object.entries(recipe.inputs)) if ((current.inventory.materials[material] || 0) < count) throw new Error('missing-material-' + material);
    return this.profileStore.mutate(profileId, profile => {
      for (const [material, count] of Object.entries(recipe.inputs)) profile.inventory.materials[material] -= count;
      for (const [item, count] of Object.entries(recipe.outputs)) profile.inventory.items[item] = (profile.inventory.items[item] || 0) + count;
      profile.history.push({ type: 'crafted', recipeId, at: new Date().toISOString() });
    });
  }
  chooseBusiness(profileId, pathId) {
    if (!this.paths.has(pathId)) throw new Error('unknown-business-path');
    const path = this.data.businessPaths.find(item => item.id === pathId);
    return this.profileStore.mutate(profileId, profile => {
      if (profile.business.path && profile.business.path !== pathId) profile.history.push({ type: 'business-path-changed', from: profile.business.path, to: pathId, at: new Date().toISOString() });
      profile.business.path = pathId;
      if (path?.service && this.recipes.has(path.service) && !profile.recipes.includes(path.service)) profile.recipes.push(path.service);
      profile.history.push({ type: 'business-path-chosen', pathId, unlockedRecipe: path?.service || null, at: new Date().toISOString() });
    });
  }
  setOpen(profileId, open) {
    return this.profileStore.mutate(profileId, profile => {
      if (!profile.business.path) throw new Error('choose-business-path-first');
      profile.business.open = open === true; profile.history.push({ type: 'shop-state', open: profile.business.open, at: new Date().toISOString(), noAwayPenalty: true });
    });
  }
  fulfill(profileId, worldId, orderId) {
    const order = this.orders.get(orderId); if (!order) throw new Error('unknown-order');
    const profile = this.profileStore.get(profileId); const world = this.worldStore.get(worldId);
    const orderReceipt = worldId + ':' + orderId;
    if (!profile.business.open) throw new Error('shop-is-closed');
    if (profile.business.completedOrders.includes(orderReceipt)) throw new Error('order-already-completed');
    if ((profile.inventory.items[order.item] || 0) < order.quantity) throw new Error('ordered-item-missing');
    const demand = world.economy.demand[order.demandKey] || 1;
    const pay = Math.round(order.basePay * Math.max(0.75, Math.min(1.5, demand)));
    const nextWorld = this.worldStore.mutate(worldId, draft => {
      draft.economy.transactions.push({ orderId, profileId, item: order.item, quantity: order.quantity, pay, at: new Date().toISOString() });
      draft.economy.demand[order.demandKey] = Math.max(0.7, Number((demand - 0.08).toFixed(2)));
      for (const key of Object.keys(draft.economy.demand)) if (key !== order.demandKey) draft.economy.demand[key] = Math.min(1.5, Number((draft.economy.demand[key] + 0.03).toFixed(2)));
    });
    const nextProfile = this.profileStore.mutate(profileId, draft => {
      draft.inventory.items[order.item] -= order.quantity; draft.currency += pay; draft.business.reputation += 3;
      draft.business.completedOrders.push(orderReceipt); draft.history.push({ type: 'order-fulfilled', orderId, worldId, pay, demand, at: new Date().toISOString() });
    });
    return { profile: nextProfile, world: nextWorld, transaction: { orderId, worldId, receipt: orderReceipt, pay, demand, reputationGained: 3 } };
  }
  sessionShops(session) {
    return Object.values(session.actors).map(actor => this.profileStore.get(actor.profileId)).filter(profile => profile.business.open).map(profile => ({ profileId: profile.profileId, owner: profile.displayName, name: profile.business.name, path: profile.business.path, reputation: profile.business.reputation, open: true }));
  }
}

module.exports = { EconomySystem };
